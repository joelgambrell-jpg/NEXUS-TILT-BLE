# PECKER / ARC Build Notes

Living authoritative requirements and development backlog for the PECKER tester and ARC web/app interface.

Last updated: 2026-09-14

## Development Priority

PECKER is the active hardware-development direction. The earlier ARC optical retrofit/TILT bridge remains a valid product path, but retrofit-specific development is paused until PECKER reaches the appropriate maturity. Do not delete or overwrite the legacy retrofit baseline; resume it from `ARC_POC_HARDWARE_BASELINE.md` when needed.

Shared ARC test-engine, record, offline, transport, audit and field-UX work should be designed so it can support both PECKER and future ARC retrofit devices.

## Product Direction

PECKER is a de-energized electrical verification tool. The field interface must remain extremely simple while ARC records and interprets detailed electrical data over BLE.

Primary target capabilities:
- Continuity testing on panels, conductors, long wire runs, and large equipment.
- OPEN / PASS identification.
- SHORT / FAIL identification.
- Transformer identification and verification.
- PT testing.
- CT testing, including low-resistance windings that ordinary meters may interpret as a short.
- Low-voltage ratio verification against transformer/PT supplier documentation or submittals.
- Polarity/phase relationship testing where supported by the developed test method.
- Inductive/pulse/waveform response capture.
- Comparison of physical measurements against ARC-loaded expected values.
- Discovery-mode testing when no ARC test profile is loaded.
- All operation limited to verified de-energized equipment.

## Field Controls

PECKER should have only:
- One TEST button.
- Green LED.
- Red LED.
- Blue LED.
- Loud buzzer.
- Test leads / appropriate adapters.

No equipment-mode button is planned. No display is required on PECKER. No result should remain latched after TEST is released.

### LED / Buzzer Behavior

BLUE SOLID: PECKER powered, serviceable and READY. BLE/normal ready state.

BLUE FLASHING: TEST is held and PECKER is actively testing.

GREEN: valid PASS for the active routine.

RED + FAIL TONE: FAIL / RETEST. Inconclusive is treated as FAIL/RETEST. SHORT is a fail condition.

ALL THREE LEDs + DISTINCT TRANSFORMER TONE: TRANSFORMER OK. Tone must be unmistakably different from fail/short tone.

TEST RELEASED: green OFF, red OFF, buzzer OFF, blue immediately returns solid READY. ARC may retain the completed result; PECKER does not physically latch it.

## Operating Modes

### ARC Standardized Test Mode

When ARC loads a profile, that profile determines the allowed sequence, expected results, ranges and tolerances. PECKER must execute the standardized routine rather than substitute Discovery Mode.

Initial families:
- Panelboard / continuity.
- General conductor continuity.
- Transformer.
- PT.
- CT.

Profiles may contain expected values from drawings, submittals, supplier paperwork, equipment setup or engineering configuration.

### Discovery Mode

When PECKER is powered with no ARC profile loaded, it automatically defaults to Discovery Mode. No mode button is required.

Discovery progressively interrogates the de-energized circuit using safe low-energy methods and may classify OPEN, SHORT, normal conductor continuity, winding-like response, transformer-like response, CT-like response, PT-like response, or INCONCLUSIVE. Inconclusive is FAIL/RETEST.

Discovery must not rely on resistance alone.

## ARC Website / App Authoritative Backlog

### Test Setup

Support Tester Name, Project Name, Equipment ID, Equipment Type, Test Plan/Profile, calibration/serviceability verification and optional Special Notes.

Add equipment/test-type selection during setup and load the resulting standardized profile into PECKER automatically.

Keep the interface script-driven: ARC presents one required test point/action at a time (for example A-B). The installer should not need to understand raw electrical measurements.

### Instrument Identity / Calibration / Serviceability

The old retrofit architecture treated the calibrated test instrument and ARC retrofit module as separate assets. Preserve that capability for future retrofit work.

For PECKER, PECKER itself becomes the measurement instrument and must have its own stable Device ID, firmware version, hardware revision, calibration/serviceability information and proving history.

Calibration/serviceability evidence should support:
- Manual Tool/Device ID and calibration information.
- Calibration date/status where applicable.
- Photo of calibration/service sticker using phone/iPad/laptop camera where supported.
- Photo retained as source evidence.
- Future barcode/QR reading of tool/calibration labels without making barcode capture mandatory.
- Proving-unit result and timestamp.

Do not fabricate battery, calibration or serviceability information when it is unavailable.

### Scripted Test Execution

Preserve the established ARC execution model:
1. Show one required test point/action at a time.
2. Receive a qualified PECKER result/measurement.
3. Display the installer-facing result simply.
4. ACCEPT records the result and advances.
5. REJECT / RETEST remains internal audit evidence and does not clutter the final customer record.
6. Clearing/retesting an accepted result requires a reason/note; preserve the original event internally.
7. PAUSE supports work split across sessions and preserves timestamps.
8. END TEST requires a legitimate user-entered reason and must not invent a PASS/FAIL conclusion.
9. Normal sequence completion = COMPLETED; user-ended sequence = ENDED.

### Quick / One-Off Testing

Provide a lightweight Quick Test workflow with no full project/equipment setup required. Connect PECKER, observe Discovery Mode or run the appropriate quick operation, display detailed measurements for authorized/advanced users, and allow optional save/export.

PECKER must still function standalone with ARC disconnected.

### Customer Record vs Engineering/Audit Record

Keep two presentation layers:
- Customer-facing completed record: clean final accepted readings, required metadata and completion/end information.
- Internal engineering/audit data: raw measurements, rejected/retested events, confidence/signature information, diagnostics, reconnect events and other development/troubleshooting evidence.

Do not make the customer record look like a debug log.

### Offline / Local-First

Primary field platform remains iPad, but ARC must support laptops and phones as well.

Testing must work without internet. Save active test state and records locally first and sync later. Preserve interrupted-test recovery after reload/crash/offline restart. One active test per ARC/PECKER device unless architecture is intentionally revised later.

Maintain durable record sync-queue behavior so temporary network loss does not lose accepted evidence.

### Connection Loss / Recovery

Preserve connection-loss auto-pause/reconnect behavior. Never fabricate a result because BLE was interrupted. Preserve a loaded standardized profile through reasonable reconnect events where safe. Record enough device/event sequencing information to diagnose duplicate, lost or reordered events.

### Completed Records / Output

Preserve/support:
- Completed test record viewer.
- Print / Save PDF workflow.
- Email handoff workflow.
- Local data export.
- Optional future NEXUS handoff/integration.

### Field Focus

Maintain a hardened Field Focus experience: minimal text, one action at a time, large touch targets, obvious connection/test state, and no unnecessary engineering data for installers.

Advanced engineering/diagnostic information should be available separately for development, QA and troubleshooting.

## Detailed BLE Data

ARC should retain detailed data when available:
- Device ID.
- Firmware version.
- Hardware revision.
- Device event sequence number.
- Test profile ID/version.
- Operating mode: STANDARDIZED or DISCOVERY.
- Equipment/test type.
- Timestamp/session.
- Result.
- Raw ADC samples where appropriate.
- Applied test voltage.
- Measured voltage.
- Injected/measured current.
- Calculated resistance.
- Winding resistance.
- Ratio.
- Phase/polarity information.
- Inductive response.
- Pulse rise/decay values.
- Waveform/signature values.
- Signature/confidence metrics where used internally.
- Expected document/submittal values.
- Tolerance used.
- Document-match status.
- Failure/retest reason.
- Proving/self-test status.
- Battery information only when legitimately measured.

## BLE / Cross-Platform Requirement - CRITICAL

PECKER BLE must work with Windows laptops, macOS laptops, Android phones/tablets, iPhones and iPads.

PECKER should expose standards-based BLE GATT services/characteristics so the same firmware can communicate with browser and native clients.

Do NOT design ARC around Web Bluetooth as the only transport. Safari/iOS/iPadOS requires a native BLE path. This is a client-platform issue, not a reason to abandon BLE.

### Transport Abstraction

ARC Test Engine -> ARC Transport Adapter -> Physical ARC/PECKER Device.

Core concepts:
- connect()
- disconnect()
- getStatus()
- loadTestProfile(profile)
- subscribeToEvents()
- receiveMeasurementPacket()
- sendCommand()

Implementations:
1. WEB_BLUETOOTH for supported Chrome/Edge/Android environments.
2. NATIVE_BLE for iPhone/iPad through Apple CoreBluetooth using an ARC native wrapper/app. Evaluate Capacitor or equivalent so the existing HTML/CSS/JS interface can be reused.
3. Optional future USB/serial service/debug transport.

ARC should detect the available transport, keep the same PECKER GATT protocol across transports, recover cleanly from disconnects, and avoid exposing transport complexity to installers.

## PECKER BLE Protocol Direction

Current PECKER POC UUIDs:
- Service: `7a100001-5045-434b-4552-000000000001`
- Event characteristic: `7a100002-5045-434b-4552-000000000001`

Legacy ARC UUID support exists and should not be casually removed; it will matter when retrofit development resumes.

Production protocol should evolve beyond simple text notifications while maintaining development compatibility.

Needed concepts:
- HELLO / device capabilities.
- READY.
- PROFILE_LOAD.
- PROFILE_ACCEPTED / PROFILE_REJECTED.
- DISCOVERY_MODE.
- TEST_STARTED.
- MEASUREMENT_DATA.
- RESULT_OPEN.
- RESULT_PASS.
- RESULT_SHORT.
- RESULT_FAIL_RETEST.
- RESULT_TRANSFORMER_OK.
- CT/PT/transformer detailed measurement packets.
- TEST_RELEASED / READY.
- PROVING_TEST_STARTED.
- PROVING_TEST_RESULT.
- ERROR / diagnostic code.

## PECKER Hardware Direction

Current direction:
- ESP32-S3-class controller for Rev A; candidate Adafruit ESP32-S3 Feather with PSRAM.
- Standards-based BLE GATT peripheral.
- Controlled approximately 6 V test rail rather than relying solely on 3.3 V.
- DRV8833-class H-bridge/test driver for reversible/pulsed excitation.
- ADS1115-class precision ADC for slower high-resolution measurements.
- Separate faster ADC path for waveform acquisition; exact part not frozen.
- Current-sense amplifier and precision shunts; exact stack not frozen.
- Precision op-amp/conditioning; exact part not frozen.
- Precision switching/routing; exact part not frozen.
- Kelvin/4-wire capability for low-resistance CT/winding measurement.
- Strong input/output protection.
- Improved field TEST button.
- Louder buzzer.
- Three LEDs only: green, red, blue.

Do not freeze fast ADC/current-sense/op-amp/analog-switch choices until electrical measurement ranges are finalized together.

## PECKER Proving Unit

Build a dedicated proving unit alongside PECKER development for field confidence/serviceability checks, development calibration, repeatable algorithm testing, unit-to-unit comparison and verification after repair/firmware updates.

Candidate proving conditions:
- Known OPEN.
- Known SHORT.
- Known resistance representing long conductor run.
- Known low-resistance CT-like inductive reference.
- Known PT/ratio reference.
- Small characterized transformer reference.
- Deliberately abnormal/fault reference.

References must be characterized/documented, not arbitrary.

Future goal: PECKER recognizes the proving unit and automatically verifies test output voltage, current source/current measurement, precision ADC, waveform channel, OPEN, SHORT, transformer detection, CT path and PT path.

Solid BLUE READY should ultimately mean serviceable/ready, not merely powered.

## Safety / Test Philosophy

- PECKER is for de-energized equipment only.
- Add voltage-presence/pre-test check before active excitation.
- External voltage outside the allowed de-energized threshold blocks testing and produces unsafe-to-test/fail behavior.
- Inconclusive is RETEST, never field PASS.
- Use multiple measurements where practical rather than a single resistance value or visual waveform.
- Transformer/PT/CT verification should compare independent measurements when possible.
- Low-energy testing does not prove insulation withstand, thermal performance, protection operation, loaded regulation or other tests requiring different procedures/equipment.

## Legacy ARC Retrofit Track - PAUSED, PRESERVED

The original ARC retrofit concept remains valid and is intentionally preserved for later resumption.

Existing baseline file: `ARC_POC_HARDWARE_BASELINE.md`.

Legacy concepts to preserve include:
- Strap-on/non-invasive ARC module for an existing calibrated tester.
- Independent optical sensing of OPEN, SHORT and TRANSFORMER_OK indicators.
- ALS-PT19 sensor development and per-channel learn/calibrate behavior.
- Ambient/off/on/pulse/cadence/cross-talk/light-leakage characterization.
- Qualified optical events rather than web UI interpretation of raw light samples.
- Separate calibrated instrument identity vs ARC retrofit-device identity.
- Legacy ARC BLE UUID/event compatibility.
- Enclosure indexing/alignment requirements.

Do not spend current PECKER development effort rebuilding these pieces unless they are shared infrastructure. Resume the retrofit track from its baseline when PECKER priorities allow.

## Shared Architecture Rule

Where practical, new ARC work should be device-agnostic. Test plans, records, offline storage, audit history, transport abstraction, reconnect handling, customer reports and NEXUS integration should accept device capabilities rather than hard-code PECKER-only assumptions. This allows PECKER and future ARC retrofit devices to use the same ARC platform.

## Development Principle

Installer experience remains TILT-simple even as the instrument becomes more capable:
1. Connect leads as instructed.
2. Hold TEST.
3. Observe PASS / FAIL / TRANSFORMER OK.
4. Release TEST.
5. PECKER returns to READY.

ARC and PECKER firmware handle the complexity in the background.
