#include <Arduino.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <math.h>

#ifndef ARC_FIRMWARE_VERSION
#define ARC_FIRMWARE_VERSION "0.1.0-poc"
#endif

static const char* ARC_SERVICE_UUID = "8f4d0001-7b6a-4f4b-8f44-4e4558555354";
static const char* ARC_EVENT_UUID   = "8f4d0002-7b6a-4f4b-8f44-4e4558555354";

static const uint8_t PIN_OPEN = A0;   // D0 / GPIO2 / ADC1_CH2
static const uint8_t PIN_SHORT = A1;  // D1 / GPIO3 / ADC1_CH3
static const uint8_t PIN_OK = A2;     // D2 / GPIO4 / ADC1_CH4

static const uint32_t SAMPLE_INTERVAL_MS = 5;
static const uint32_t RAW_PRINT_INTERVAL_MS = 100;
static const uint32_t EVENT_SEQUENCE_PERSIST_INTERVAL = 32;

enum ChannelIndex : uint8_t {
  CH_OPEN = 0,
  CH_SHORT = 1,
  CH_OK = 2,
  CH_COUNT = 3
};

struct ChannelConfig {
  uint16_t onThreshold = 0;
  uint16_t offThreshold = 0;
  float minHz = 0.0f;
  float maxHz = 0.0f;
  uint16_t minPulses = 0;
  uint16_t eventGapMs = 0;
};

struct ChannelRuntime {
  uint16_t raw = 0;
  bool high = false;
  bool eventActive = false;
  uint32_t firstRiseMs = 0;
  uint32_t lastRiseMs = 0;
  uint32_t lastTransitionMs = 0;
  uint16_t pulseCount = 0;
  uint16_t peakRaw = 0;
  uint16_t troughRaw = 4095;
};

struct CaptureState {
  bool active = false;
  ChannelIndex channel = CH_OPEN;
  uint32_t startMs = 0;
  uint32_t durationMs = 0;
  uint32_t count = 0;
  uint64_t sum = 0;
  uint16_t minValue = 4095;
  uint16_t maxValue = 0;
};

static ChannelConfig configs[CH_COUNT];
static ChannelRuntime runtimeState[CH_COUNT];
static CaptureState captureState;
static Preferences prefs;
static BLECharacteristic* eventCharacteristic = nullptr;
static bool bleClientConnected = false;
static bool rawLogging = false;
static uint32_t lastSampleMs = 0;
static uint32_t lastRawPrintMs = 0;
static uint32_t eventSequence = 0;
static String deviceId;
static String serialBuffer;

static const char* channelName(ChannelIndex ch) {
  switch (ch) {
    case CH_OPEN: return "OPEN";
    case CH_SHORT: return "SHORT";
    case CH_OK: return "TRANSFORMER_OK";
    default: return "UNKNOWN";
  }
}

static uint8_t channelPin(ChannelIndex ch) {
  switch (ch) {
    case CH_OPEN: return PIN_OPEN;
    case CH_SHORT: return PIN_SHORT;
    case CH_OK: return PIN_OK;
    default: return PIN_OPEN;
  }
}

static bool parseChannel(const String& value, ChannelIndex& out) {
  String v = value;
  v.trim();
  v.toUpperCase();
  if (v == "OPEN") { out = CH_OPEN; return true; }
  if (v == "SHORT") { out = CH_SHORT; return true; }
  if (v == "OK" || v == "TRANSFORMER_OK" || v == "TRANSFORMER-OK") {
    out = CH_OK;
    return true;
  }
  return false;
}

static bool configQualified(const ChannelConfig& c) {
  return c.onThreshold > c.offThreshold &&
         c.offThreshold > 0 &&
         c.minHz > 0.0f &&
         c.maxHz >= c.minHz &&
         c.minPulses >= 2 &&
         c.eventGapMs > 0;
}

static String configKey(ChannelIndex ch, const char* suffix) {
  String prefix;
  switch (ch) {
    case CH_OPEN: prefix = "o_"; break;
    case CH_SHORT: prefix = "s_"; break;
    case CH_OK: prefix = "k_"; break;
    default: prefix = "x_"; break;
  }
  return prefix + suffix;
}

static void loadConfig(ChannelIndex ch) {
  ChannelConfig& c = configs[ch];
  c.onThreshold = prefs.getUShort(configKey(ch, "on").c_str(), 0);
  c.offThreshold = prefs.getUShort(configKey(ch, "off").c_str(), 0);
  c.minHz = prefs.getFloat(configKey(ch, "minhz").c_str(), 0.0f);
  c.maxHz = prefs.getFloat(configKey(ch, "maxhz").c_str(), 0.0f);
  c.minPulses = prefs.getUShort(configKey(ch, "pulses").c_str(), 0);
  c.eventGapMs = prefs.getUShort(configKey(ch, "gap").c_str(), 0);
}

static void saveConfig(ChannelIndex ch) {
  const ChannelConfig& c = configs[ch];
  prefs.putUShort(configKey(ch, "on").c_str(), c.onThreshold);
  prefs.putUShort(configKey(ch, "off").c_str(), c.offThreshold);
  prefs.putFloat(configKey(ch, "minhz").c_str(), c.minHz);
  prefs.putFloat(configKey(ch, "maxhz").c_str(), c.maxHz);
  prefs.putUShort(configKey(ch, "pulses").c_str(), c.minPulses);
  prefs.putUShort(configKey(ch, "gap").c_str(), c.eventGapMs);
}

static void clearConfig(ChannelIndex ch) {
  configs[ch] = ChannelConfig{};
  saveConfig(ch);
  runtimeState[ch] = ChannelRuntime{};
}

static String makeDeviceId() {
  uint64_t mac = ESP.getEfuseMac();
  char id[32];
  snprintf(id, sizeof(id), "ARC-%04X%08X",
           (uint16_t)(mac >> 32),
           (uint32_t)mac);
  return String(id);
}

class ArcServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleClientConnected = true;
    Serial.println("[BLE] client connected");
  }

  void onDisconnect(BLEServer* server) override {
    bleClientConnected = false;
    Serial.println("[BLE] client disconnected; advertising restarted");
    server->getAdvertising()->start();
  }
};

static void startBle() {
  String advertisedName = "ARC-POC-" + deviceId.substring(max(0, (int)deviceId.length() - 6));
  BLEDevice::init(advertisedName.c_str());
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new ArcServerCallbacks());

  BLEService* service = server->createService(ARC_SERVICE_UUID);
  eventCharacteristic = service->createCharacteristic(
    ARC_EVENT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  eventCharacteristic->addDescriptor(new BLE2902());
  eventCharacteristic->setValue("ARC ready");
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(ARC_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();

  Serial.printf("[BLE] advertising %s\n", advertisedName.c_str());
}

static void resetRuntimeEvent(ChannelIndex ch) {
  ChannelRuntime& r = runtimeState[ch];
  r.eventActive = false;
  r.firstRiseMs = 0;
  r.lastRiseMs = 0;
  r.lastTransitionMs = 0;
  r.pulseCount = 0;
  r.peakRaw = 0;
  r.troughRaw = 4095;
}

static void persistSequenceIfNeeded() {
  if ((eventSequence % EVENT_SEQUENCE_PERSIST_INTERVAL) == 0) {
    prefs.putUInt("event_seq", eventSequence);
  }
}

static void emitQualifiedEvent(ChannelIndex ch, uint32_t nowMs) {
  ChannelRuntime& r = runtimeState[ch];
  const ChannelConfig& c = configs[ch];

  if (r.pulseCount < 2 || r.lastRiseMs <= r.firstRiseMs) {
    resetRuntimeEvent(ch);
    return;
  }

  const uint32_t spanMs = r.lastRiseMs - r.firstRiseMs;
  const float measuredHz = ((float)(r.pulseCount - 1) * 1000.0f) / (float)spanMs;
  const bool cadenceValid = measuredHz >= c.minHz && measuredHz <= c.maxHz && r.pulseCount >= c.minPulses;

  if (!cadenceValid) {
    Serial.printf("[REJECT] %s pulses=%u cadence=%.3fHz allowed=%.3f..%.3fHz\n",
                  channelName(ch), r.pulseCount, measuredHz, c.minHz, c.maxHz);
    resetRuntimeEvent(ch);
    return;
  }

  const float thresholdSpan = max(1, (int)c.onThreshold - (int)c.offThreshold);
  const float observedSpan = max(0, (int)r.peakRaw - (int)r.troughRaw);
  float confidence = observedSpan / thresholdSpan;
  if (confidence > 1.0f) confidence = 1.0f;
  if (confidence < 0.0f) confidence = 0.0f;

  eventSequence++;
  persistSequenceIfNeeded();

  char json[512];
  snprintf(json, sizeof(json),
    "{\"deviceId\":\"%s\",\"firmwareVersion\":\"%s\",\"eventSequence\":%lu,"
    "\"channel\":\"%s\",\"cadenceValid\":true,\"measuredCadenceHz\":%.3f,"
    "\"pulseCount\":%u,\"durationMs\":%lu,\"signalConfidence\":%.3f,"
    "\"batteryPct\":null,\"detectedAtMs\":%lu,\"source\":\"arc-esp32c3\"}",
    deviceId.c_str(), ARC_FIRMWARE_VERSION, (unsigned long)eventSequence,
    channelName(ch), measuredHz, r.pulseCount,
    (unsigned long)(nowMs - r.firstRiseMs), confidence,
    (unsigned long)nowMs
  );

  Serial.printf("[EVENT] %s\n", json);
  if (eventCharacteristic != nullptr) {
    eventCharacteristic->setValue((uint8_t*)json, strlen(json));
    if (bleClientConnected) {
      eventCharacteristic->notify();
    }
  }

  resetRuntimeEvent(ch);
}

static void sampleChannel(ChannelIndex ch, uint32_t nowMs) {
  ChannelRuntime& r = runtimeState[ch];
  const ChannelConfig& c = configs[ch];
  r.raw = analogRead(channelPin(ch));

  if (r.raw > r.peakRaw) r.peakRaw = r.raw;
  if (r.raw < r.troughRaw) r.troughRaw = r.raw;

  if (captureState.active && captureState.channel == ch) {
    captureState.count++;
    captureState.sum += r.raw;
    if (r.raw < captureState.minValue) captureState.minValue = r.raw;
    if (r.raw > captureState.maxValue) captureState.maxValue = r.raw;
  }

  if (!configQualified(c)) return;

  if (!r.high && r.raw >= c.onThreshold) {
    r.high = true;
    r.lastTransitionMs = nowMs;
    if (!r.eventActive) {
      r.eventActive = true;
      r.firstRiseMs = nowMs;
      r.lastRiseMs = nowMs;
      r.pulseCount = 1;
      r.peakRaw = r.raw;
      r.troughRaw = r.raw;
    } else {
      r.lastRiseMs = nowMs;
      r.pulseCount++;
    }
  } else if (r.high && r.raw <= c.offThreshold) {
    r.high = false;
    r.lastTransitionMs = nowMs;
  }

  if (r.eventActive && !r.high && (nowMs - r.lastTransitionMs) >= c.eventGapMs) {
    emitQualifiedEvent(ch, nowMs);
  }
}

static void serviceCapture(uint32_t nowMs) {
  if (!captureState.active) return;
  if ((nowMs - captureState.startMs) < captureState.durationMs) return;

  captureState.active = false;
  if (captureState.count == 0) {
    Serial.println("[CAPTURE] no samples collected");
    return;
  }

  const double average = (double)captureState.sum / (double)captureState.count;
  Serial.printf("[CAPTURE] channel=%s durationMs=%lu samples=%lu min=%u max=%u avg=%.2f\n",
                channelName(captureState.channel),
                (unsigned long)captureState.durationMs,
                (unsigned long)captureState.count,
                captureState.minValue,
                captureState.maxValue,
                average);
}

static void printStatus() {
  Serial.println();
  Serial.println("=== ARC POC STATUS ===");
  Serial.printf("Device ID: %s\n", deviceId.c_str());
  Serial.printf("Firmware: %s\n", ARC_FIRMWARE_VERSION);
  Serial.printf("BLE client: %s\n", bleClientConnected ? "CONNECTED" : "not connected");
  Serial.printf("Event sequence: %lu\n", (unsigned long)eventSequence);
  Serial.println("Battery: unavailable (no qualified voltage measurement path)");

  for (uint8_t i = 0; i < CH_COUNT; i++) {
    ChannelIndex ch = (ChannelIndex)i;
    const ChannelConfig& c = configs[i];
    Serial.printf("%s raw=%u qualified=%s on=%u off=%u cadence=%.3f..%.3fHz minPulses=%u gap=%ums\n",
                  channelName(ch), runtimeState[i].raw,
                  configQualified(c) ? "YES" : "NO",
                  c.onThreshold, c.offThreshold, c.minHz, c.maxHz,
                  c.minPulses, c.eventGapMs);
  }
  Serial.println("======================");
  Serial.println();
}

static void printHelp() {
  Serial.println("ARC engineering commands:");
  Serial.println("  help");
  Serial.println("  status");
  Serial.println("  raw on");
  Serial.println("  raw off");
  Serial.println("  capture <OPEN|SHORT|TRANSFORMER_OK> <milliseconds>");
  Serial.println("  set <channel> <onThreshold> <offThreshold> <minHz> <maxHz> <minPulses> <eventGapMs>");
  Serial.println("  clear <OPEN|SHORT|TRANSFORMER_OK|all>");
  Serial.println();
  Serial.println("No default threshold/cadence values are supplied. Measure the real tester first.");
}

static int tokenize(String input, String tokens[], int maxTokens) {
  input.trim();
  int count = 0;
  int start = 0;
  while (start < (int)input.length() && count < maxTokens) {
    while (start < (int)input.length() && input[start] == ' ') start++;
    if (start >= (int)input.length()) break;
    int end = input.indexOf(' ', start);
    if (end < 0) end = input.length();
    tokens[count++] = input.substring(start, end);
    start = end + 1;
  }
  return count;
}

static void handleCommand(String command) {
  command.trim();
  if (command.length() == 0) return;

  String tokens[10];
  int count = tokenize(command, tokens, 10);
  String op = tokens[0];
  op.toLowerCase();

  if (op == "help") {
    printHelp();
    return;
  }

  if (op == "status") {
    printStatus();
    return;
  }

  if (op == "raw" && count >= 2) {
    String state = tokens[1];
    state.toLowerCase();
    rawLogging = (state == "on");
    Serial.printf("[RAW] logging %s\n", rawLogging ? "ON" : "OFF");
    return;
  }

  if (op == "capture" && count >= 3) {
    if (captureState.active) {
      Serial.println("[CAPTURE] another capture is already active");
      return;
    }
    ChannelIndex ch;
    if (!parseChannel(tokens[1], ch)) {
      Serial.println("[ERROR] unknown channel");
      return;
    }
    uint32_t duration = (uint32_t)tokens[2].toInt();
    if (duration < 100 || duration > 60000) {
      Serial.println("[ERROR] capture duration must be 100..60000 ms");
      return;
    }
    captureState = CaptureState{};
    captureState.active = true;
    captureState.channel = ch;
    captureState.startMs = millis();
    captureState.durationMs = duration;
    Serial.printf("[CAPTURE] started %s for %lums\n", channelName(ch), (unsigned long)duration);
    return;
  }

  if (op == "set" && count >= 8) {
    ChannelIndex ch;
    if (!parseChannel(tokens[1], ch)) {
      Serial.println("[ERROR] unknown channel");
      return;
    }

    ChannelConfig candidate;
    candidate.onThreshold = (uint16_t)tokens[2].toInt();
    candidate.offThreshold = (uint16_t)tokens[3].toInt();
    candidate.minHz = tokens[4].toFloat();
    candidate.maxHz = tokens[5].toFloat();
    candidate.minPulses = (uint16_t)tokens[6].toInt();
    candidate.eventGapMs = (uint16_t)tokens[7].toInt();

    if (!configQualified(candidate)) {
      Serial.println("[ERROR] invalid config. Require on>off>0, minHz>0, maxHz>=minHz, minPulses>=2, eventGapMs>0");
      return;
    }

    configs[ch] = candidate;
    saveConfig(ch);
    resetRuntimeEvent(ch);
    Serial.printf("[CONFIG] saved qualified values for %s\n", channelName(ch));
    printStatus();
    return;
  }

  if (op == "clear" && count >= 2) {
    String target = tokens[1];
    target.toLowerCase();
    if (target == "all") {
      for (uint8_t i = 0; i < CH_COUNT; i++) clearConfig((ChannelIndex)i);
      Serial.println("[CONFIG] all channel qualification values cleared");
      return;
    }
    ChannelIndex ch;
    if (!parseChannel(tokens[1], ch)) {
      Serial.println("[ERROR] unknown channel");
      return;
    }
    clearConfig(ch);
    Serial.printf("[CONFIG] cleared %s\n", channelName(ch));
    return;
  }

  Serial.println("[ERROR] unknown/incomplete command. Type help.");
}

static void serviceSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      handleCommand(serialBuffer);
      serialBuffer = "";
    } else if (serialBuffer.length() < 250) {
      serialBuffer += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(700);

  analogReadResolution(12);
  pinMode(PIN_OPEN, INPUT);
  pinMode(PIN_SHORT, INPUT);
  pinMode(PIN_OK, INPUT);

  prefs.begin("arc-poc", false);
  for (uint8_t i = 0; i < CH_COUNT; i++) loadConfig((ChannelIndex)i);
  eventSequence = prefs.getUInt("event_seq", 0);
  deviceId = makeDeviceId();

  Serial.println();
  Serial.println("ARC Systems POC firmware");
  Serial.printf("Device: %s\n", deviceId.c_str());
  Serial.printf("Firmware: %s\n", ARC_FIRMWARE_VERSION);
  Serial.println("Optical pins: OPEN=A0/GPIO2, SHORT=A1/GPIO3, TRANSFORMER_OK=A2/GPIO4");
  Serial.println("Battery percentage disabled until a real measurement path is characterized.");

  startBle();
  printStatus();
  printHelp();
}

void loop() {
  const uint32_t nowMs = millis();
  serviceSerial();

  if ((nowMs - lastSampleMs) >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = nowMs;
    sampleChannel(CH_OPEN, nowMs);
    sampleChannel(CH_SHORT, nowMs);
    sampleChannel(CH_OK, nowMs);
    serviceCapture(nowMs);
  }

  if (rawLogging && (nowMs - lastRawPrintMs) >= RAW_PRINT_INTERVAL_MS) {
    lastRawPrintMs = nowMs;
    Serial.printf("[RAW] ms=%lu OPEN=%u SHORT=%u TRANSFORMER_OK=%u\n",
                  (unsigned long)nowMs,
                  runtimeState[CH_OPEN].raw,
                  runtimeState[CH_SHORT].raw,
                  runtimeState[CH_OK].raw);
  }

  delay(1);
}
