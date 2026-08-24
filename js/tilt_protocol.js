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
  validateEvent(evt) {
    if (!evt || evt.protocol !== this.PROTOCOL) return false;
    if (evt.eventType !== 'TILT_OPTICAL_EVENT') return false;
    if (!Object.values(this.CHANNELS).includes(evt.channel)) return false;
    if (evt.cadenceValid !== true) return false;
    return true;
  }
});
