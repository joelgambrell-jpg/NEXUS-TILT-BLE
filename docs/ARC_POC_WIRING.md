# ARC POC Wiring Baseline

## Locked sensor inputs

The three optical channels use ADC1 pins on the Seeed Studio XIAO ESP32-C3:

| ARC channel | XIAO pin | ESP32-C3 GPIO | ADC |
| --- | --- | --- | --- |
| OPEN | D0 / A0 | GPIO2 | ADC1_CH2 |
| SHORT | D1 / A1 | GPIO3 | ADC1_CH3 |
| TRANSFORMER_OK | D2 / A2 | GPIO4 | ADC1_CH4 |

Do not move the optical inputs to D3 / A3 (GPIO5 / ADC2) for the POC. ADC2 has ESP32-C3 limitations and can conflict with wireless operation; the three ADC1 inputs above are the reliable analog path for a BLE device.

## ALS-PT19 breakout wiring

Each Adafruit ALS-PT19 breakout has three connections:

- `+` -> XIAO `3V3`
- `-` -> XIAO `GND`
- `OUT` -> its assigned analog input above

All three sensors share the XIAO 3.3 V and GND rails, while each `OUT` remains independent.

The ALS-PT19 breakout accepts approximately 2.5 V to 5.5 V supply and produces an analog voltage that increases with received light. Using 3.3 V keeps the sensor supply and ESP32-C3 ADC domain aligned for this POC.

## POC bench topology

```text
XIAO ESP32-C3 3V3
  +-- ALS-PT19 OPEN +
  +-- ALS-PT19 SHORT +
  +-- ALS-PT19 TRANSFORMER_OK +

XIAO ESP32-C3 GND
  +-- ALS-PT19 OPEN -
  +-- ALS-PT19 SHORT -
  +-- ALS-PT19 TRANSFORMER_OK -

ALS-PT19 OPEN OUT ------------> D0 / A0 / GPIO2
ALS-PT19 SHORT OUT -----------> D1 / A1 / GPIO3
ALS-PT19 TRANSFORMER_OK OUT --> D2 / A2 / GPIO4
```

## Battery

POC battery: LP-503562, 3.7 V nominal, 1200 mAh.

Before connecting the battery to the XIAO battery input, verify polarity with a multimeter. Connector fit is not proof of correct polarity.

Battery percentage remains unavailable in software until a real voltage-sensing path is added and characterized. Do not derive or invent battery percentage from runtime or RSSI.

## First physical checkout

1. Power the XIAO from USB first; leave the LiPo disconnected.
2. Confirm common 3.3 V and GND rails.
3. Connect only the OPEN sensor and verify raw serial readings change when light is applied/blocked.
4. Repeat for SHORT and TRANSFORMER_OK individually.
5. Connect all three sensors and check for stable independent readings.
6. Mount the sensors over the actual tester indicators and use firmware engineering capture mode to record OFF, ON, ambient, flash cadence, cross-talk and leakage data.
7. Only after those measurements are collected should threshold/hysteresis and cadence values be treated as qualified.

## Engineering rule

No guessed optical threshold is considered a production value. The firmware starts in an unqualified state and requires physical measurements before event qualification is enabled.
