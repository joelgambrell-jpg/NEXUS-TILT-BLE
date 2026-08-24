window.NEXUSTiltSimulator = {
  emit(channel, callback) {
    const evt = window.NEXUSTiltProtocol.createSimulatedEvent(channel);
    callback(evt);
    return evt;
  },
  emitBadCadence(callback) {
    const evt = window.NEXUSTiltProtocol.createSimulatedEvent(window.NEXUSTiltProtocol.CHANNELS.OK);
    evt.cadenceValid = false;
    evt.signalConfidence = 0.35;
    callback(evt);
    return evt;
  }
};
