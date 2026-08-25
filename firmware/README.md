# ARC Systems POC Firmware

Firmware target: Seeed Studio XIAO ESP32-C3 + three Adafruit ALS-PT19 analog light sensors.

Firmware version starts at `0.1.0-poc`. This is an engineering bring-up build, not a production threshold package.

## Locked optical pins

- OPEN: D0 / A0 / GPIO2 / ADC1_CH2
- SHORT: D1 / A1 / GPIO3 / ADC1_CH3
- TRANSFORMER_OK: D2 / A2 / GPIO4 / ADC1_CH4

## Build

Open the `firmware` folder as the PlatformIO project and use the `seeed_xiao_esp32c3` environment.

```text
pio run
pio run --target upload
pio device monitor --baud 115200
```

## First boot behavior

The firmware:

- creates a stable ARC device ID from the ESP32-C3 hardware MAC,
- starts the reserved ARC BLE service and event characteristic,
- samples all three optical inputs,
- exposes raw engineering data over Serial,
- loads per-channel qualification values from Preferences/NVS,
- keeps battery percentage unavailable,
- does not emit a qualified optical event for a channel until that channel has measured thresholds and cadence rules saved.

## Serial engineering commands

Type `help` in the serial monitor.

Core commands:

```text
status
raw on
raw off
capture OPEN 3000
capture SHORT 3000
capture TRANSFORMER_OK 3000
set OPEN <onThreshold> <offThreshold> <minHz> <maxHz> <minPulses> <eventGapMs>
set SHORT <onThreshold> <offThreshold> <minHz> <maxHz> <minPulses> <eventGapMs>
set TRANSFORMER_OK <onThreshold> <offThreshold> <minHz> <maxHz> <minPulses> <eventGapMs>
clear OPEN
clear SHORT
clear TRANSFORMER_OK
clear all
```

`capture` prints min / max / average raw ADC values for the requested interval. It does not automatically invent a threshold.

`set` stores physically measured qualification values for one channel. `onThreshold` must be greater than `offThreshold`, providing hysteresis. Cadence limits and pulse count must come from the actual instrument measurements.

## Physical learn sequence

For each channel:

1. Mount ARC in the intended optical position.
2. Capture ambient / indicator OFF.
3. Capture indicator ON or the brightest part of the real flash.
4. Run the actual tester indication repeatedly and keep raw logging on long enough to observe the flash timing.
5. Repeat while neighboring indicators are active to quantify cross-talk.
6. Repeat under dark, normal indoor and bright field lighting.
7. Choose thresholds with margin between the measured OFF/leakage envelope and ON envelope.
8. Choose cadence limits and minimum pulse count from the measured real indication.
9. Save those values with `set`.
10. Run repeated qualification tests and verify false-positive / missed-event performance before treating the configuration as approved.

## BLE event contract

Service UUID:

`8f4d0001-7b6a-4f4b-8f44-4e4558555354`

Event characteristic UUID:

`8f4d0002-7b6a-4f4b-8f44-4e4558555354`

Qualified notifications are JSON and include:

- `deviceId`
- `firmwareVersion`
- `eventSequence`
- `channel`
- `cadenceValid`
- `measuredCadenceHz`
- `pulseCount`
- `durationMs`
- `signalConfidence`
- `batteryPct` = `null`
- `detectedAtMs`
- `source` = `arc-esp32c3`

`eventSequence` increases monotonically for each emitted device event during operation and is persisted periodically so transport duplicates/loss/reordering can be diagnosed.

## POC boundary

The ESP32-C3 qualifies optical indications. It does not decide whether the customer's test passed, does not select the equipment test point, and does not create the final customer record. Those remain responsibilities of the ARC field test engine and tester Accept / Reject-Retest workflow.
