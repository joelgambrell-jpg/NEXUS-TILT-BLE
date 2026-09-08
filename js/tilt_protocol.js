window.NEXUSTiltProtocol = Object.freeze({
  PROTOCOL: 'NEXUS-TILT-1',
  DEVICE_TYPE: 'TILT_OPTICAL_BRIDGE',
  PECKER_DEVICE_TYPE: 'PECKER',
  CHANNELS: Object.freeze({
    OPEN: 'OPEN',
    SHORT: 'SHORT',
    OK: 'TRANSFORMER_OK'
  }),

  createSimulatedEvent(channel) {
    const valid = Object.values(this.CHANNELS).includes(channel);
    if (!valid) throw new Error('Unknown TILT channel');
    return {
      protocol: this.PROTOCOL,
      deviceType: this.DEVICE_TYPE,
      deviceId: 'TILT-SIM-001',
      firmwareVersion: 'SIM-0.1.0',
      eventType: 'TILT_OPTICAL_EVENT',
      channel,
      cadenceValid: true,
      measuredCadenceHz: 2.0,
      pulseCount: 3,
      durationMs: 1500,
      signalConfidence: 0.99,
      batteryPct: null,
      adc: null,
      measurementMethod: 'SIMULATOR',
      sequence: Date.now(),
      detectedAt: new Date().toISOString(),
      source: 'SIMULATOR'
    };
  },

  createPeckerEvent({result, adc = null, deviceId = 'PECKER', firmwareVersion = 'POC-BLE', rawText = '', source = 'BLE'} = {}) {
    const normalizedResult = String(result || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const channel = normalizedResult === 'TRANSFORMER_OK' ? this.CHANNELS.OK :
      normalizedResult === 'SHORT' ? this.CHANNELS.SHORT :
      normalizedResult === 'OPEN' ? this.CHANNELS.OPEN : '';
    if (!channel) throw new Error(`Unknown PECKER result: ${result}`);
    const parsedAdc = adc == null || adc === '' ? null : Number(adc);
    return {
      protocol: this.PROTOCOL,
      deviceType: this.PECKER_DEVICE_TYPE,
      deviceId: String(deviceId || 'PECKER'),
      firmwareVersion: String(firmwareVersion || ''),
      eventType: 'PECKER_TEST_EVENT',
      channel,
      cadenceValid: true,
      measuredCadenceHz: 1,
      pulseCount: 1,
      durationMs: 1,
      signalConfidence: 1,
      batteryPct: null,
      adc: Number.isFinite(parsedAdc) ? parsedAdc : null,
      measurementMethod: 'DIRECT_ELECTRICAL',
      rawText: String(rawText || ''),
      sequence: Date.now(),
      detectedAt: new Date().toISOString(),
      source
    };
  },

  normalizeEvent(evt, source = 'BLE') {
    if (!evt || typeof evt !== 'object') return null;
    const rawBattery = evt.batteryPct;
    const rawAdc = evt.adc ?? evt.rawAdc ?? evt.adcValue;
    return {
      protocol: evt.protocol || this.PROTOCOL,
      deviceType: evt.deviceType || this.DEVICE_TYPE,
      deviceId: String(evt.deviceId || (evt.deviceType === this.PECKER_DEVICE_TYPE ? 'PECKER' : 'TILT-UNKNOWN')),
      firmwareVersion: String(evt.firmwareVersion || ''),
      eventType: evt.eventType || (evt.deviceType === this.PECKER_DEVICE_TYPE ? 'PECKER_TEST_EVENT' : 'TILT_OPTICAL_EVENT'),
      channel: evt.channel,
      cadenceValid: evt.cadenceValid === true,
      measuredCadenceHz: Number(evt.measuredCadenceHz ?? 0),
      pulseCount: Number(evt.pulseCount ?? 0),
      durationMs: Number(evt.durationMs ?? 0),
      signalConfidence: Number(evt.signalConfidence ?? 0),
      batteryPct: rawBattery == null ? null : Number(rawBattery),
      adc: rawAdc == null ? null : Number(rawAdc),
      measurementMethod: String(evt.measurementMethod || ''),
      rawText: String(evt.rawText || ''),
      sequence: Number(evt.sequence ?? evt.eventSequence ?? Date.now()),
      detectedAt: evt.detectedAt || new Date().toISOString(),
      source: evt.source || source
    };
  },

  validateEvent(evt) {
    if (!evt || evt.protocol !== this.PROTOCOL) return false;
    if (!Object.values(this.CHANNELS).includes(evt.channel)) return false;
    if (evt.batteryPct != null && (!Number.isFinite(evt.batteryPct) || evt.batteryPct < 0 || evt.batteryPct > 100)) return false;
    if (evt.adc != null && (!Number.isFinite(evt.adc) || evt.adc < 0 || evt.adc > 4095)) return false;

    if (evt.deviceType === this.PECKER_DEVICE_TYPE) {
      if (evt.eventType !== 'PECKER_TEST_EVENT') return false;
      return true;
    }

    if (evt.deviceType !== this.DEVICE_TYPE) return false;
    if (evt.eventType !== 'TILT_OPTICAL_EVENT') return false;
    if (evt.cadenceValid !== true) return false;
    if (!Number.isFinite(evt.measuredCadenceHz) || evt.measuredCadenceHz <= 0) return false;
    if (!Number.isFinite(evt.pulseCount) || evt.pulseCount < 1) return false;
    if (!Number.isFinite(evt.durationMs) || evt.durationMs <= 0) return false;
    if (!Number.isFinite(evt.signalConfidence) || evt.signalConfidence < 0 || evt.signalConfidence > 1) return false;
    return true;
  }
});
