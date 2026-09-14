# PECKER / ARC Build Notes

Living requirements and development notes for the PECKER tester and ARC web/app interface.

Last updated: 2026-09-14

## Product Direction

PECKER is a de-energized electrical verification tool. The field interface must remain extremely simple while ARC records and interprets the detailed electrical data over BLE.

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

## Field Controls - Keep This Simple

PECKER should have only:

- One TEST button.
- Green LED.
- Red LED.
- Blue LED.
- Loud buzzer.
- Test leads / appropriate adapters.

No equipment-mode button is planned.
No display is required on PECKER.
No result should remain latched after the TEST button is released.

### LED / Buzzer Behavior

BLUE SOLID
- PECKER powered and ready for service.
- BLE/normal ready state.

BLUE FLASHING
- TEST button is held and PECKER is actively testing.

GREEN
- Valid PASS result for the active test routine.

RED + FAIL TONE
- FAIL / RETEST required.
- Inconclusive results are treated as FAIL/RETEST for equipment safety.
- SHORT is a fail condition.

ALL THREE LEDs + DISTINCT TRANSFORMER TONE
- TRANSFORMER OK result.
- The transformer-success tone must be clearly different from the fail/short tone.

TEST BUTTON RELEASED
- Green OFF.
- Red OFF.
- Buzzer OFF.
- Blue returns immediately to solid READY.
- No previous result remains displayed on the physical tester.

ARC may retain the completed measurement/result even though PECKER clears the physical indication.

## Operating Modes

PECKER should use software-driven testing. The installer should not select complex electrical modes on the tester.

### 1. ARC Standardized Test Mode

When ARC has loaded a test profile, the profile determines the allowed test sequence and expected result.

Examples:

- PANELBOARD / CONTINUITY -> standardized continuity routine.
- TRANSFORMER -> standardized winding/ratio/inductive verification routine.
- PT -> standardized PT routine.
- CT -> standardized CT routine.

The loaded profile may contain expected values from drawings, submittals, supplier paperwork, equipment setup, or engineering configuration.

PECKER should not substitute Discovery Mode for a loaded standardized test. It should run the required approved routine.

### 2. Discovery Mode

When PECKER is powered and no ARC test profile is loaded, PECKER automatically defaults to Discovery Mode.

Discovery Mode should progressively interrogate the de-energized circuit using safe low-energy tests and classify the electrical behavior without requiring a mode button.

Potential discoveries include:

- OPEN.
- SHORT.
- Normal continuity / conductor path.
- Winding-like response.
- Transformer-like response.
- CT-like response.
- PT-like response.
- Inconclusive -> FAIL / RETEST.

Automatic discovery must not rely on resistance alone. CT windings and other low-resistance inductive devices may resemble a direct short to a conventional meter.

## ARC Website / App Work Required

### Test Setup

Add equipment/test-type selection during test setup. ARC should be able to load the resulting test profile into PECKER automatically.

Initial equipment/test families:

- Panelboard / continuity.
- Transformer.
- PT.
- CT.
- General / conductor continuity.

Test profiles should eventually include expected electrical values and tolerances from project documentation.

### Quick / One-Off Testing

ARC should have a lightweight Quick Test workflow for testing outside a formal project/equipment record.

Requirements:

- No full equipment setup required.
- Connect PECKER.
- Allow a quick test or simply observe PECKER Discovery Mode.
- Show the detected result and detailed measurements.
- Allow optional save/export of the result.

PECKER must still function standalone when ARC is not connected.

### Detailed BLE Data

The field LEDs remain simple, but ARC should retain detailed test data when available, including fields such as:

- Device ID.
- Firmware version.
- Test profile ID/version.
- Operating mode: STANDARDIZED or DISCOVERY.
- Equipment/test type.
- Timestamp.
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

Do not expose complex diagnostic values to installers unless needed. ARC should preserve them for QA, engineering, troubleshooting, audit, and future algorithm development.

## BLE / Cross-Platform Requirement - IMPORTANT

PECKER BLE must work with:

- Windows laptops.
- macOS laptops.
- Android phones/tablets.
- iPhones.
- iPads.

The BLE peripheral itself should use normal standards-based BLE GATT services/characteristics so the same PECKER firmware can communicate with both browser-based and native clients.

### Browser Limitation

Do NOT design ARC around Web Bluetooth as the only BLE transport.

Web Bluetooth works well in supported Chromium environments such as Chrome/Edge on many desktop systems and Chrome on Android, but Safari/iOS/iPadOS does not provide normal Web Bluetooth support. Therefore an ARC page that directly calls `navigator.bluetooth` cannot be the only production connection method if iPads/iPhones are required.

This is a browser/platform limitation, not a reason to change PECKER away from BLE.

### Required ARC BLE Architecture

Create a transport abstraction so the ARC test engine does not care how the BLE connection was established.

Conceptual interface:

- connect()
- disconnect()
- getStatus()
- loadTestProfile(profile)
- subscribeToEvents()
- receiveMeasurementPacket()
- sendCommand()

Transport implementations:

1. WEB_BLUETOOTH
   - Chrome/Edge desktop where supported.
   - Chrome Android where supported.

2. NATIVE_BLE
   - iPhone/iPad using Apple CoreBluetooth through an ARC native wrapper/app.
   - The preferred production direction is to reuse the existing ARC web UI in a lightweight native shell/bridge rather than rebuilding the entire interface separately.
   - Capacitor or an equivalent native bridge should be evaluated so the existing HTML/CSS/JS ARC application can call native CoreBluetooth on iOS/iPadOS.

3. Future optional transports
   - USB/serial service/debug connection if useful.
   - Other transports may be added without changing test logic.

### Connection Behavior

ARC should:

- Detect which BLE transport is available.
- Use Web Bluetooth when it is genuinely supported.
- Use the native BLE bridge on iPhone/iPad.
- Keep the same PECKER BLE service/characteristic protocol across transports.
- Clearly show connection state without exposing unnecessary technical details to the installer.
- Recover cleanly from BLE disconnect/reconnect.
- Preserve an active standardized test profile through reasonable reconnect events where safe.
- Never fabricate a test result because BLE was interrupted.

## PECKER BLE Protocol Direction

Current PECKER proof-of-concept UUIDs already used by ARC:

- Service UUID: `7a100001-5045-434b-4552-000000000001`
- Event characteristic UUID: `7a100002-5045-434b-4552-000000000001`

Legacy ARC UUID support currently exists and should not be removed casually while migrating.

The production protocol should evolve beyond simple text notifications while retaining backward compatibility during development.

Needed command/event concepts:

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
- TEST_RELEASED / return to READY.
- PROVING_TEST_STARTED.
- PROVING_TEST_RESULT.
- ERROR / diagnostic code.

## PECKER Hardware Direction

Current development direction:

- Move from XIAO ESP32-C3 proof-of-concept toward ESP32-S3-class controller for Rev A development.
- Candidate development controller: Adafruit ESP32-S3 Feather with PSRAM.
- Keep BLE as a standard BLE GATT peripheral.
- Controlled approximately 6 V test rail rather than relying solely on 3.3 V GPIO/rail.
- DRV8833-class H-bridge/test driver for reversible/pulsed excitation.
- ADS1115-class precision ADC for slow high-resolution measurements.
- Separate faster ADC path for waveform acquisition; exact part not yet frozen.
- Current-sense amplifier and precision shunts; exact analog stack not yet frozen.
- Precision op-amp/analog conditioning; exact part not yet frozen.
- Precision switching/routing network; exact part not yet frozen.
- Kelvin/4-wire capability for low-resistance CT/winding measurements.
- Strong input/output protection.
- Improved field TEST button.
- Louder field buzzer.
- Three LEDs only: green, red, blue.

Do not freeze the fast ADC/current-sense/op-amp/analog-switch component choices until the required electrical measurement ranges are finalized together.

## Proving Unit

Build a dedicated PECKER proving unit alongside development of the next tester.

Purpose:

1. Field confidence check / ready-for-service verification.
2. Development calibration and repeatable algorithm testing.
3. Comparison of one PECKER unit to another.
4. Verification after repair/firmware updates.

Candidate proving conditions:

- Known OPEN.
- Known SHORT.
- Known resistance representing a long conductor run.
- Known low-resistance CT-like inductive reference.
- Known PT/ratio reference.
- Small characterized transformer reference.
- Deliberately abnormal/fault reference.

Reference components should be characterized and documented rather than using arbitrary loads.

Future goal: PECKER should recognize the proving unit and run an automated self-verification sequence, checking items such as:

- Test output voltage.
- Current source/current measurement.
- Precision ADC.
- Waveform channel.
- OPEN detection.
- SHORT detection.
- Transformer detection.
- CT test path.
- PT test path.

Solid BLUE READY should ultimately represent a serviceable tester, not merely that the microcontroller has power.

## Safety / Test Philosophy

- PECKER is for de-energized equipment only.
- Add a voltage-presence/pre-test check before enabling active excitation.
- If external voltage is detected outside the allowed de-energized threshold, block the test and return FAIL/unsafe-to-test behavior.
- An inconclusive test is not a field PASS; it requires RETEST.
- Complex classification should use multiple measurements where practical instead of relying on a single resistance value or visual waveform.
- Transformer/PT/CT verification should compare independent measurements when possible.
- Do not claim that low-energy de-energized testing proves insulation withstand, thermal performance, protection operation, loaded regulation, or other tests that require different procedures/equipment.

## Development Principle

The installer experience should remain TILT-simple even as the internal instrument becomes significantly more capable:

1. Connect leads as instructed.
2. Hold TEST.
3. Observe PASS / FAIL / TRANSFORMER OK.
4. Release TEST.
5. PECKER returns to READY.

ARC and PECKER firmware handle the complexity in the background.
