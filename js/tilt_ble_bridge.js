window.NEXUSTiltBLEBridge = class {
  constructor({ onEvent, onStatus, onError } = {}) {
    this.onEvent = onEvent || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onError = onError || (() => {});
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.decoder = new TextDecoder();
    this._boundDisconnected = this._handleDisconnected.bind(this);
    this._boundNotification = this._handleNotification.bind(this);
  }

  static get SERVICE_UUID() {
    return '8f4d0001-7b6a-4f4b-8f44-4e4558555354';
  }

  static get EVENT_CHARACTERISTIC_UUID() {
    return '8f4d0002-7b6a-4f4b-8f44-4e4558555354';
  }

  get supported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  get connected() {
    return !!this.device?.gatt?.connected;
  }

  async connect() {
    if (!this.supported) {
      const error = new Error('Web Bluetooth is not supported in this browser.');
      this.onError(error);
      throw error;
    }

    try {
      this.onStatus({ state: 'CONNECTING', message: 'Select the NEXUS TILT device...' });

      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [window.NEXUSTiltBLEBridge.SERVICE_UUID] }],
        optionalServices: [window.NEXUSTiltBLEBridge.SERVICE_UUID]
      });

      this.device.addEventListener('gattserverdisconnected', this._boundDisconnected);
      this.server = await this.device.gatt.connect();

      const service = await this.server.getPrimaryService(window.NEXUSTiltBLEBridge.SERVICE_UUID);
      this.characteristic = await service.getCharacteristic(window.NEXUSTiltBLEBridge.EVENT_CHARACTERISTIC_UUID);
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this._boundNotification);

      this.onStatus({
        state: 'CONNECTED',
        message: 'TILT device connected',
        deviceName: this.device.name || 'NEXUS TILT',
        deviceId: this.device.id || ''
      });

      return this.device;
    } catch (error) {
      this.onStatus({ state: 'DISCONNECTED', message: 'TILT device not connected' });
      this.onError(error);
      throw error;
    }
  }

  disconnect() {
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener('characteristicvaluechanged', this._boundNotification);
      }
      if (this.device) {
        this.device.removeEventListener('gattserverdisconnected', this._boundDisconnected);
        if (this.device.gatt?.connected) this.device.gatt.disconnect();
      }
    } finally {
      this.characteristic = null;
      this.server = null;
      this.device = null;
      this.onStatus({ state: 'DISCONNECTED', message: 'TILT device disconnected' });
    }
  }

  _handleDisconnected() {
    this.characteristic = null;
    this.server = null;
    this.onStatus({ state: 'DISCONNECTED', message: 'TILT device disconnected' });
  }

  _handleNotification(event) {
    try {
      const value = event.target.value;
      const text = this.decoder.decode(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)).trim();
      if (!text) return;

      const parsed = JSON.parse(text);
      const normalized = window.NEXUSTiltProtocol.normalizeEvent(parsed, 'BLE');

      if (!window.NEXUSTiltProtocol.validateEvent(normalized)) {
        throw new Error('Received an invalid TILT BLE event.');
      }

      this.onEvent(normalized);
    } catch (error) {
      this.onError(error);
    }
  }
};
