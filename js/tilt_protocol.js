window.NEXUSTiltProtocol = Object.freeze({
  PROTOCOL: 'NEXUS-TILT-1',
  DEVICE_TYPE: 'TILT_OPTICAL_BRIDGE',
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
      batteryPct: 100,
      sequence: Date.now(),
      detectedAt: new Date().toISOString(),
      source: 'SIMULATOR'
    };
  },

  normalizeEvent(evt, source = 'BLE') {
    if (!evt || typeof evt !== 'object') return null;

    return {
      protocol: evt.protocol || this.PROTOCOL,
      deviceType: evt.deviceType || this.DEVICE_TYPE,
      deviceId: String(evt.deviceId || 'TILT-UNKNOWN'),
      firmwareVersion: String(evt.firmwareVersion || ''),
      eventType: evt.eventType || 'TILT_OPTICAL_EVENT',
      channel: evt.channel,
      cadenceValid: evt.cadenceValid === true,
      measuredCadenceHz: Number(evt.measuredCadenceHz ?? 0),
      pulseCount: Number(evt.pulseCount ?? 0),
      durationMs: Number(evt.durationMs ?? 0),
      signalConfidence: Number(evt.signalConfidence ?? 0),
      batteryPct: Number(evt.batteryPct ?? 0),
      sequence: Number(evt.sequence ?? Date.now()),
      detectedAt: evt.detectedAt || new Date().toISOString(),
      source: evt.source || source
    };
  },

  validateEvent(evt) {
    if (!evt || evt.protocol !== this.PROTOCOL) return false;
    if (evt.deviceType !== this.DEVICE_TYPE) return false;
    if (evt.eventType !== 'TILT_OPTICAL_EVENT') return false;
    if (!Object.values(this.CHANNELS).includes(evt.channel)) return false;
    if (evt.cadenceValid !== true) return false;
    if (!Number.isFinite(evt.measuredCadenceHz) || evt.measuredCadenceHz <= 0) return false;
    if (!Number.isFinite(evt.pulseCount) || evt.pulseCount < 1) return false;
    if (!Number.isFinite(evt.durationMs) || evt.durationMs <= 0) return false;
    if (!Number.isFinite(evt.signalConfidence) || evt.signalConfidence < 0 || evt.signalConfidence > 1) return false;
    if (!Number.isFinite(evt.batteryPct) || evt.batteryPct < 0 || evt.batteryPct > 100) return false;
    return true;
  }
});
