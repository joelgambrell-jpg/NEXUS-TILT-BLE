window.NEXUSTiltBLEBridge=class{
  constructor({onEvent,onStatus,onError}={}){
    this.onEvent=onEvent||(()=>{});
    this.onStatus=onStatus||(()=>{});
    this.onError=onError||(()=>{});
    this.device=null;
    this.server=null;
    this.characteristic=null;
    this.decoder=new TextDecoder();
    this.activeServiceUuid='';
    this.activeCharacteristicUuid='';
    this._boundDisconnected=this._handleDisconnected.bind(this);
    this._boundNotification=this._handleNotification.bind(this);
  }

  static get LEGACY_SERVICE_UUID(){return'8f4d0001-7b6a-4f4b-8f44-4e4558555354'}
  static get LEGACY_EVENT_CHARACTERISTIC_UUID(){return'8f4d0002-7b6a-4f4b-8f44-4e4558555354'}
  static get PECKER_SERVICE_UUID(){return'7a100001-5045-434b-4552-000000000001'}
  static get PECKER_EVENT_CHARACTERISTIC_UUID(){return'7a100002-5045-434b-4552-000000000001'}
  static get SERVICE_UUID(){return this.LEGACY_SERVICE_UUID}
  static get EVENT_CHARACTERISTIC_UUID(){return this.LEGACY_EVENT_CHARACTERISTIC_UUID}

  get supported(){return typeof navigator!=='undefined'&&!!navigator.bluetooth}
  get connected(){return!!this.device?.gatt?.connected}

  _status(i){
    window.ARCDeviceDiagnostics?.connection(i);
    this.onStatus(i);
    if(i.state==='CONNECTED')window.dispatchEvent(new CustomEvent('arc-device-connected',{detail:i}));
    if(i.state==='DISCONNECTED')window.dispatchEvent(new CustomEvent('arc-device-disconnected',{detail:i}));
  }

  _error(e){window.ARCDeviceDiagnostics?.error(e);this.onError(e)}

  async _resolveCharacteristic(){
    const options=[
      [window.NEXUSTiltBLEBridge.PECKER_SERVICE_UUID,window.NEXUSTiltBLEBridge.PECKER_EVENT_CHARACTERISTIC_UUID],
      [window.NEXUSTiltBLEBridge.LEGACY_SERVICE_UUID,window.NEXUSTiltBLEBridge.LEGACY_EVENT_CHARACTERISTIC_UUID]
    ];
    let lastError=null;
    for(const [serviceUuid,characteristicUuid] of options){
      try{
        const service=await this.server.getPrimaryService(serviceUuid);
        const characteristic=await service.getCharacteristic(characteristicUuid);
        this.activeServiceUuid=serviceUuid;
        this.activeCharacteristicUuid=characteristicUuid;
        return characteristic;
      }catch(e){lastError=e}
    }
    throw lastError||new Error('No supported ARC/PECKER BLE service was found.');
  }

  async connect(){
    if(!this.supported){
      const e=new Error('Bluetooth device selection is not available in this browser. Open ARC in Chrome or Edge on a Web Bluetooth capable device.');
      this._status({state:'ERROR',message:e.message});this._error(e);throw e;
    }
    try{
      this._status({state:'CONNECTING',message:'Select PECKER or an ARC device...'});
      const services=[window.NEXUSTiltBLEBridge.PECKER_SERVICE_UUID,window.NEXUSTiltBLEBridge.LEGACY_SERVICE_UUID];
      this.device=await navigator.bluetooth.requestDevice({
        filters:[
          {services:[window.NEXUSTiltBLEBridge.PECKER_SERVICE_UUID]},
          {services:[window.NEXUSTiltBLEBridge.LEGACY_SERVICE_UUID]}
        ],
        optionalServices:services
      });
      this.device.addEventListener('gattserverdisconnected',this._boundDisconnected);
      this.server=await this.device.gatt.connect();
      this.characteristic=await this._resolveCharacteristic();
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged',this._boundNotification);
      const isPecker=this.activeServiceUuid===window.NEXUSTiltBLEBridge.PECKER_SERVICE_UUID;
      this._status({
        state:'CONNECTED',
        message:isPecker?'PECKER connected':'ARC device connected',
        deviceName:this.device.name||(isPecker?'PECKER':'ARC DEVICE'),
        deviceId:this.device.id||'',
        deviceType:isPecker?'PECKER':'ARC'
      });
      return this.device;
    }catch(e){
      const cancelled=e?.name==='NotFoundError';
      this._status({state:cancelled?'DISCONNECTED':'ERROR',message:cancelled?'Device selection cancelled.':`ARC connection failed: ${e?.message||e}`});
      this._error(e);throw e;
    }
  }

  disconnect(){
    try{
      if(this.characteristic)this.characteristic.removeEventListener('characteristicvaluechanged',this._boundNotification);
      if(this.device){
        this.device.removeEventListener('gattserverdisconnected',this._boundDisconnected);
        if(this.device.gatt?.connected)this.device.gatt.disconnect();
      }
    }finally{
      this.characteristic=null;this.server=null;this.device=null;this.activeServiceUuid='';this.activeCharacteristicUuid='';
      this._status({state:'DISCONNECTED',message:'ARC device disconnected'});
    }
  }

  _handleDisconnected(){
    this.characteristic=null;this.server=null;this.activeServiceUuid='';this.activeCharacteristicUuid='';
    this._status({state:'DISCONNECTED',message:'ARC device disconnected'});
  }

  _parsePeckerText(text){
    if(!/^PECKER\b/i.test(text)&&!/RESULT\s*:/i.test(text))return null;
    const resultMatch=text.match(/RESULT\s*:\s*([^\r\n]+)/i);
    if(!resultMatch)return null;
    const adcMatch=text.match(/ADC\s*:\s*(-?\d+(?:\.\d+)?)/i);
    return window.NEXUSTiltProtocol.createPeckerEvent({
      result:resultMatch[1],
      adc:adcMatch?adcMatch[1]:null,
      deviceId:this.device?.id||this.device?.name||'PECKER',
      firmwareVersion:'PECKER-POC-BLE',
      rawText:text,
      source:'BLE'
    });
  }

  _handleNotification(event){
    try{
      const v=event.target.value;
      const text=this.decoder.decode(v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)).trim();
      if(!text)return;

      let n=null;
      if(this.activeServiceUuid===window.NEXUSTiltBLEBridge.PECKER_SERVICE_UUID){
        n=this._parsePeckerText(text);
      }

      if(!n){
        try{
          const parsed=JSON.parse(text);
          n=window.NEXUSTiltProtocol.normalizeEvent(parsed,'BLE');
        }catch(jsonError){
          n=this._parsePeckerText(text);
          if(!n)throw jsonError;
        }
      }

      if(!window.NEXUSTiltProtocol.validateEvent(n))throw Error('Received an invalid ARC/PECKER BLE event.');
      window.ARCDeviceDiagnostics?.event(n);
      this.onEvent(n);
    }catch(e){this._error(e)}
  }
};
