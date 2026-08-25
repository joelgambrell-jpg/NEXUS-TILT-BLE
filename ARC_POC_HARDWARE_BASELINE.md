# ARC Systems — POC Hardware & Continuation Baseline

Saved: 2026-08-25

This file is the handoff baseline for continuing ARC development in a new chat. Do not guess hardware details that are marked TBD; verify them physically during assembly.

## Product / Architecture

ARC = Adaptive Retrofit Connectivity. Tagline: “If you can see it, we can track it.”

Current POC is a standalone ARC testing system first. NEXUS integration comes after the standalone POC is approved. NEXUS will launch ARC and receive/display the completed test record. ARC remains the test execution system.

Primary field platform is iPad. Testing must work without internet. Test state and records save locally first and sync later. One active test per ARC device. Completed customer records show only final accepted readings; rejects/retests and other engineering/audit events remain internal.

## Confirmed POC Hardware

### Controller
- Seeed Studio XIAO ESP32-C3, pre-soldered version.
- Intended role: ARC retrofit controller, optical processing, event qualification, device identity and wireless transport.

### Optical Sensors
- Adafruit ALS-PT19 Analog Light Sensor Breakout.
- Adafruit PID: 2748.
- Multiple sensors purchased.
- Architecture: independent optical sensing channels for the tester indicator states rather than attempting to infer every state from one sensor.
- Initial logical channels for TILT POC: OPEN, SHORT, TRANSFORMER_OK.
- Exact GPIO/ADC assignments: TBD and must be locked against the XIAO ESP32-C3 pin capabilities before firmware wiring.

### Battery
- LiPo pouch cell.
- Marking: LP-503562.
- Nominal voltage: 3.7 V.
- Capacity: 1200 mAh.
- Two-wire connector/pigtail.
- IMPORTANT: verify connector polarity with a meter before first connection to the XIAO. Mechanical connector compatibility does not prove polarity compatibility.
- Battery percentage must NOT be fabricated. Battery telemetry remains unavailable until a valid voltage-measurement method is implemented and characterized.

### Wiring / Prototype Materials
- JST-PH 2.0 two-pin connector/pigtail kit purchased.
- Micro Center Parts Pal prototype/electronics kit purchased.

## Physical / Enclosure Context

ARC module is being designed as a strap-on/retrofit module for the existing test tool rather than modifying the calibrated instrument internally.

The enclosure indexes against the tool so the optical sensors remain aligned with the tester indicator lights. Prior enclosure discussion established that the white sticker/label area was measured at approximately 3 1/16 inches wide. There is a slight indent around the sticker area that can be used for indexing. A top indexing feature is also desired so the module cannot slide downward. Clearance of roughly 1/2 inch around the center of the TEST button is desired. The module only needs to extend down approximately to the OPEN/SHORT writing on the tester label. Exact enclosure dimensions remain subject to final physical measurements.

## Instrument / Calibration Evidence

The calibrated test instrument and ARC retrofit module are two different assets and must remain separate in the data model.

Standalone test setup requires calibration verification. Technician may either:
1. manually enter calibration/tool-ID information,
2. photograph the calibration sticker/tool ID using the iPad,
3. or use both.

The photo is verification/source evidence only. Future enhancement may read the calibration sticker barcode automatically, but that is not required for the POC.

## Optical Detection Baseline

Do NOT hard-code guessed light thresholds as production values before physical testing.

Firmware should include an engineering LEARN/CALIBRATE mode. Once ARC is mounted on the actual test instrument, capture per-channel raw measurements for:
- ambient/background light,
- LED off,
- LED on,
- actual flash/pulse pattern,
- adjacent-indicator optical cross-talk,
- enclosure light leakage,
- repeated OPEN events,
- repeated SHORT events,
- repeated TRANSFORMER_OK events.

Each optical channel should have its own baseline and threshold/hysteresis values. Firmware should perform optical event qualification and cadence/stability validation. The iPad/web test engine should receive a qualified ARC event rather than trying to interpret raw optical samples.

## Existing ARC Event Contract

Current logical channels:
- OPEN
- SHORT
- TRANSFORMER_OK

Existing BLE service UUID reserved in software:
- Service: `8f4d0001-7b6a-4f4b-8f44-4e4558555354`
- Event characteristic: `8f4d0002-7b6a-4f4b-8f44-4e4558555354`

Event model currently supports fields such as:
- deviceId
- firmwareVersion
- channel
- cadenceValid
- measuredCadenceHz
- pulseCount
- durationMs
- signalConfidence
- batteryPct (must be null/unavailable until legitimate battery measurement exists)
- detectedAt
- source

Recommended firmware addition for physical POC: monotonically increasing device event sequence number so duplicate/lost/reordered transport events can be diagnosed.

## iPad Transport Constraint

The field UX is designed primarily for iPad. The current web BLE bridge uses `navigator.bluetooth`. Standard Safari/iPadOS does not provide the Web Bluetooth path required by that bridge. Therefore transport must remain abstracted from the ARC test engine.

Architecture target:

`ARC Test Engine -> ARC Transport Adapter -> Physical ARC Device`

Do not make the core test engine dependent on one transport implementation. A POC BLE bridge/native wrapper/other iPad-capable transport can be substituted without changing test sequencing, records or customer evidence.

## Test Flow Already Established

1. Open saved/custom test plan.
2. Standalone mode requires Tester Name, Project Name, Equipment ID, Equipment Type, Test Plan and Calibration Verification. Special Notes optional.
3. ARC displays one required test point at a time (example A-B).
4. Tester performs the physical test.
5. ARC hardware detects/qualifies the instrument indication and sends the reading.
6. ARC displays the detected reading with ACCEPT and REJECT / RETEST.
7. ACCEPT records the reading and advances to the next required point.
8. REJECT / RETEST does not appear in the customer-facing final readings but remains internal audit evidence.
9. An accepted reading can be cleared and retested, but a reason/note is mandatory. The original event remains in internal audit history.
10. PAUSE supports a test split across sessions. Sessions retain timestamps.
11. END TEST may be used for any legitimate reason (failed connection, rain, safety, end of shift, etc.). Tester enters the reason. ARC records the reading evidence and the tester's decision to end; ARC does not invent a PASS/FAIL conclusion.
12. Normal sequence completion produces COMPLETED. Tester-ended sequence produces ENDED.
13. Completed customer record shows final accepted readings and appropriate test metadata, not internal work/retest clutter.

## Current Software Baseline

Repository: `joelgambrell-jpg/NEXUS-TILT-BLE`

Current web/PWA work includes:
- ARC branded field interface.
- Standalone test plan builder.
- Standard canned test and customizable plans.
- Local-first/offline test execution.
- Persistent interrupted-test recovery.
- Pause/resume and multi-session tracking.
- End Test with required reason.
- Accepted-reading clear/retest with mandatory audit note.
- Customer-facing completed test record.
- Print / Save PDF workflow.
- Email handoff workflow.
- Local data export.
- Durable record sync queue architecture.
- ARC device diagnostics and raw engineering event log.
- POC BLE simulator.
- iPad/PWA field hardening and Field Focus mode.
- Connection-loss auto-pause/reconnect workflow.
- Automated software self-check/qualification scenarios.

Recent development sequence reached offline/PWA cache v22 before this hardware-baseline handoff.

## Next Development Work

When continuing:
1. Verify XIAO ESP32-C3 exact usable ADC pins and lock the three ALS-PT19 GPIO assignments.
2. Document sensor wiring/power/ground topology.
3. Define the first firmware project structure and firmware version convention.
4. Implement sensor raw-sampling and engineering calibration/learn mode.
5. Implement per-channel threshold/hysteresis and pulse/cadence qualification.
6. Implement stable ARC Device ID and event sequence number.
7. Implement/choose the iPad-capable transport while preserving the transport abstraction.
8. Feed physical-device events into the existing ARC event contract.
9. Run physical qualification: dark/ambient/bright conditions, misalignment, cross-talk, repeated readings, disconnect/reconnect, battery operation and extended runtime.
10. Replace simulator assumptions with measured physical baselines only after evidence is collected.

## POC Engineering Rule

Do not make the customer record look like an engineering/debug log. ARC can retain detailed raw/audit evidence internally, but the final customer-facing test record should remain clean and show the legitimate final accepted test readings and tester-controlled test completion/end information.
