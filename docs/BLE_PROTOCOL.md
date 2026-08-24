# NEXUS TILT BLE Protocol v1

## Purpose

The BLE device reports validated optical TILT events. Project, equipment, technician, and workflow context stay in NEXUS and are not stored in the hardware protocol.

## BLE service

- Service UUID: `8f4d0001-7b6a-4f4b-8f44-4e4558555354`
- Event characteristic UUID: `8f4d0002-7b6a-4f4b-8f44-4e4558555354`
- Characteristic behavior: Notify
- Payload encoding: UTF-8 JSON

## Required event payload

```json
{
  "protocol": "NEXUS-TILT-1",
  "deviceType": "TILT_OPTICAL_BRIDGE",
  "deviceId": "TILT-POC-001",
  "firmwareVersion": "0.1.0",
  "eventType": "TILT_OPTICAL_EVENT",
  "channel": "TRANSFORMER_OK",
  "cadenceValid": true,
  "measuredCadenceHz": 2.0,
  "pulseCount": 3,
  "durationMs": 1500,
  "signalConfidence": 0.99,
  "batteryPct": 87,
  "sequence": 142
}
```

`detectedAt` is optional in firmware. If it is absent, the receiving application timestamps the event when the BLE notification is received.

## Channels

- `OPEN`
- `SHORT`
- `TRANSFORMER_OK`

## Validation rule

The hardware reports an event only after it recognizes the optical flash cadence. NEXUS still requires the operator to Accept or Retest before the event becomes a completed quality record.

## Browser note

The current POC uses the Web Bluetooth API for direct browser-to-device communication. Browser support varies by platform. The BLE protocol is intentionally independent of Web Bluetooth so a native app, wrapper, or other bridge can use the same device protocol later without changing the ESP32 event format.
