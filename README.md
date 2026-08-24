# NEXUS TILT BLE

Proof-of-concept infrastructure for a BLE add-on that observes a TILT tester's OPEN / SHORT / TRANSFORMER OK indicator cadence and records accepted test results.

## Current POC scope

- Build and save a planned TILT test before field execution.
- Support Full, Half, and Custom test scopes.
- Run one test point at a time.
- Simulate BLE OPEN / SHORT / OK events while hardware is being built.
- Require technician Accept or Retest before a detected result becomes an official record.
- Save accepted records with date/time, planned test context, observed indication, and simulated device metadata.
- Keep planned tests and completed records separate.

## Architecture

```text
TILT meter
  -> optical sensors
  -> XIAO ESP32-C3
  -> BLE protocol
  -> NEXUS TILT engine
  -> Accept / Retest
  -> accepted record
  -> NEXUS integration
```

The hardware protocol intentionally does not contain NEXUS project/equipment fields. NEXUS supplies project context after receiving the device event, which keeps the BLE device reusable outside NEXUS later.

## Development mode

Open `index.html` through GitHub Pages or a local web server. The simulator buttons stand in for the future ESP32 BLE device.

## Planned hardware

- Seeed Studio XIAO ESP32-C3
- 3 x ALS-PT19 visible-light sensor breakouts
- 3.7 V LiPo battery
- 3 optical channels: OPEN / SHORT / TRANSFORMER OK
- cadence validation in firmware

## Next hardware step

When the electronics arrive, capture the actual TILT flash waveform and replace the simulator input with BLE notifications that follow `NEXUS-TILT-1`.
