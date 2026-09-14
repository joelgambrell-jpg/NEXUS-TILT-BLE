# PECKER Rev A Bill of Materials

Status: FROZEN BASELINE
Date: 2026-09-14

This file is the current hardware purchasing/build baseline for the first full PECKER Rev A prototype. It supersedes the older ADS1115/MCP3204/INA181/OPA2320/TMUX1133/TPS3700 direction for Rev A.

## System architecture

Protected 1-cell LiPo -> Adafruit ESP32-S3 Feather + TPS61088 6 V boost -> TPS2553-1 protected 6 V rail -> DRV8833 excitation driver -> FORCE leads.

Measurement uses one VPG 0.100 ohm true 4-terminal shunt and one TI ADS131M04 4-channel simultaneous 24-bit ADC. FORCE and SENSE are fixed channels; no analog mux is used.

External-voltage warning uses two independent passive rectifier/divider channels feeding the two comparators of one TLV1702. Either FORCE or SENSE voltage detection inhibits the DRV8833 hardware path and triggers the red warning state / voltage-warning tone.

The field lead interface is one four-pin A-coded M12 connector with fixed pin semantics:
1. FORCE+
2. SENSE+
3. FORCE-
4. SENSE-

## BUY — core electronics

| Qty to buy | Qty used | Manufacturer / part | Purpose | Rev A note |
|---:|---:|---|---|---|
| 2 | 1 | Adafruit 5477 — ESP32-S3 Feather, 4 MB Flash / 2 MB PSRAM | Main controller, BLE, USB-C charging/service, battery monitor | One build + one spare/dev board |
| 3 | 1 | TPS61088 adjustable boost module | LiPo to regulated 6.00 V test rail | Buy three identical modules from one reputable seller; characterize before use |
| 2 | 1 | Adafruit 3297 — DRV8833 breakout | Reversible/pulsed low-energy excitation | Modify current regulation for nominal 100 mA |
| 3 | 1 | TI TPS2553DBVR-1 | 6 V rail current-limited latch-off protection | SOT-23; locate after boost and before DRV8833 |
| 3 | 1 | 88.7 kOhm 1% resistor | TPS2553-1 ILIM programming | TI table gives about 299 mA nominal, about 262–342 mA device range |
| 3 | 1 | TI ADS131M04IPWR | 4-channel simultaneous 24-bit ADC | TSSOP-20 |
| 2 | 1 | VPG Y14750R10000B9R, CSM3637F | Precision DUT current shunt | 0.100 ohm, 0.1%, 3 W, true four-terminal, 10 ppm/C |
| 3 | 1 | TI TLV1702AIDGKR | Dual external-voltage comparator | One comparator FORCE, one SENSE |
| 4 | 2 | Nexperia BAS70 family, e.g. BAS70,215 | Comparator-node rail clamps | One per detector channel plus spares |
| 12 | 8 | Diodes Inc. US1M-13-F | 1 kV full-wave detector rectifiers | Four FORCE + four SENSE; spares included |
| 12 | 8 | Susumu RGV3216P-4703-B-T5 | Detector high-voltage divider | 470 kOhm, 0.1%, high-voltage 1206; four per detector |
| 4 | 2 | 23.7 kOhm 0.1% thin-film resistor | Detector low-side divider | One FORCE, one SENSE |
| 3 | 1 | 71.5 kOhm 0.1% thin-film resistor | TLV1702 shared reference divider upper leg | 3.3 V to approximately 405 mV reference |
| 3 | 1 | 10.0 kOhm 0.1% thin-film resistor | TLV1702 shared reference divider lower leg | Shared reference |
| 4 | 2 | 10 nF C0G/NP0 capacitor | External-voltage detector filtering | One per detector |
| 2 | 1 | Adafruit 5791 — PAM8904 STEMMA Piezo Driver Amp | Loud distinct warning/result tones | Drive from Feather logic supply |
| 3 | 1 | Passive piezo element, approx. 27 mm | Sounder | No active buzzer |
| 2 | 1 | Adafruit 328 — protected 3.7 V 2500 mAh LiPo | Main battery | One installed + one spare is preferred |

## BUY — DRV8833 / 6 V rail parts

| Qty to buy | Qty used | Part / value | Purpose | Rev A note |
|---:|---:|---|---|---|
| 4 | 2 | 2.00 ohm, 1%, 1206, >=0.25 W low-inductance resistor | DRV8833 current regulation | One per DRV8833 current-sense channel used; nominal 100 mA per TI 0.2 V / Rsense relationship |
| 3 | 1 | Panasonic EEU-FR1C221, 220 uF 16 V | Local DRV8833 / 6 V bulk capacitance | Populate 220 uF initially |
| 1 | 0 | Footprint/space for 470 uF 16 V low-ESR capacitor | Optional rail-energy tuning | Do not populate unless scope testing shows it is needed |
| as needed | as used | 0.1 uF ceramic bypass capacitors | Local IC decoupling | Place per manufacturer datasheets |
| as needed | as used | 1 uF / 10 uF ceramic local bypass where required | Rail stability / module decoupling | Follow module and IC datasheets |

## BUY — ADS131M04 analog network

### CH0 — current shunt

CH0 is permanently assigned to the VPG 0.100 ohm Kelvin shunt.

| Qty to buy | Qty used | Part / value | Purpose |
|---:|---:|---|---|
| 6 | 2 | 1.00 kOhm, 0.1%, low-TCR thin-film | ADS131M04 CH0 differential anti-alias series resistors |
| 4 | 1 | 10 nF C0G/NP0 | ADS131M04 CH0 differential anti-alias capacitor |

Use ADS131M04 PGA gain dynamically. At the nominal 100 mA ceiling the shunt produces about 10 mV, which fits PGA x64 comfortably.

### CH1 — SENSE / transformer-secondary response

Rev A hardware range is fixed at approximately 60 V peak. Use a fixed passive divider; no op amp and no analog switch.

Populate the divider with precision, low-TCR resistors sized so 60 V peak remains within the ADS131M04 +/-1.2 V PGA x1 input range with margin. Calibrate the exact installed divider ratio in firmware. Keep the TI-recommended 1 kOhm / 1 kOhm / 10 nF differential input filter immediately before the ADC and use the TI ADS131M0x EOS protection topology on this field-exposed channel.

### CH2 — FORCE / applied excitation monitor

Rev A hardware range is fixed at approximately 8 V peak. Use a fixed passive divider, calibrated in firmware, followed by the same TI-recommended 1 kOhm / 1 kOhm / 10 nF differential anti-alias filter. Use the TI ADS131M0x EOS protection topology because this channel is connected to the field-exposed FORCE output.

### CH3 — reserve

Leave CH3 available for future auxiliary measurement. Do not add an analog mux just to use it. Terminate the unused input according to TI recommendations until assigned.

## BUY — field connection

| Qty to buy | Qty used | Manufacturer / part | Purpose |
|---:|---:|---|---|
| 2 | 1 | ATTEND 216A-04MAF, M12 A-coded 4-pin male panel receptacle | PECKER universal field connector | 4 A / 250 V class connector; one spare recommended |
| 2 | 1 | ATTEND M12-4R00-2427004, M12 A-coded 4-pin female-to-open-leads cable, 2 m | Prototype lead harness | Cut/terminate to Kelvin clips; spare harness recommended |
| 4 | 2 | Mueller BU-75K Kelvin clip | FORCE/SENSE Kelvin jaws | Gold-plated isolated jaws; one clip per DUT side; two spares recommended if budget allows |
| as needed | — | Flexible four-conductor cable, strain relief, heat-shrink | Lead construction | Maintain fixed M12 pin semantics |

If larger jaws become necessary during field trials, Mueller BU-78K is the preferred larger Kelvin-clip alternative; it is not required for the initial BOM.

## BUY — controls / indicators

| Qty to buy | Qty used | Part | Purpose |
|---:|---:|---|---|
| 2 | 1 | SPST-NO momentary panel pushbutton | TEST control | Rugged panel type; thumb-sized |
| 2 | 1 | SPST latching mechanical panel switch | Master ON/OFF | USB-C charging remains available when practical with unit switched off |
| 5 | 1 | Blue diffused LED | READY / BLE / TESTING |
| 5 | 1 | Green diffused LED | PASS |
| 5 | 1 | Red diffused LED | FAIL / RETEST / external-voltage warning |
| 10 | 3 | 1.00 kOhm 1% resistor | LED current limiting | Starting value; adjust only if brightness testing requires it |

## BUY — prototype construction

| Qty | Item | Purpose |
|---:|---|---|
| 2 | Small prototype carrier PCBs / perfboard suitable for TSSOP adapters and passives | Analog/protection prototype assembly |
| 2 | TSSOP-20 breakout/adaptor boards | ADS131M04 prototype handling if custom PCB is not yet fabricated |
| 2 | Small four-terminal shunt carrier PCBs | Preserve true Kelvin routing to Y14750R10000B9R |
| assortment | JST-PH / locking low-voltage connectors | Internal serviceable wiring |
| assortment | 22–28 AWG hookup wire | Internal wiring |
| assortment | Heat-shrink tubing | Insulation / strain relief |
| assortment | M2/M2.5/M3 standoffs and hardware | Internal mounting |
| 1 | Swing-open prototype enclosure | Rev A housing |

## ALREADY OWNED / REUSE IF AVAILABLE

Before buying duplicate bench supplies, check current PECKER/ARC inventory for:
- USB-C data cable.
- Breadboard / prototype wiring.
- Solder / soldering tools.
- Multimeter.
- Oscilloscope if available for 6 V rail characterization.
- Existing XIAO ESP32C3 POC hardware, which remains useful as a firmware/BLE reference but is not the Rev A controller.
- Existing LEDs, resistors, switches, piezos, headers, hookup wire and enclosure stock where they meet the Rev A requirement.

## DO NOT BUY FOR REV A

The following are intentionally removed from the Rev A architecture:
- ADS1115.
- MCP3204.
- INA181.
- OPA2320.
- TMUX1133.
- MCP4725 DAC.
- TPS3700.
- Separate LiPo charger board.
- Separate battery/fuel-gauge board.
- Dedicated FORCE-output TVS for normal inductive flyback.
- PTC/resettable fuse in the FORCE measurement path.
- Separate buzzer MOSFET.
- Active buzzer.
- RGB LED.
- Display.
- Mode selector.
- Banana-jack field interface.
- Panel USB extension.

## Rev A hardware ranges / frozen targets

- Logic: 3.3 V.
- Test rail: 6.00 V nominal.
- DUT current ceiling: 100 mA nominal through DRV8833 current regulation.
- Upstream 6 V rail protection: approximately 300 mA nominal TPS2553-1 latch-off limit using 88.7 kOhm RILIM.
- CH0: 0.100 ohm VPG four-terminal current shunt.
- CH1 SENSE range: approximately 60 V peak.
- CH2 FORCE range: approximately 8 V peak.
- External-voltage warning threshold: approximately 24–30 VAC nominal, characterized on the finished board rather than treated as a calibrated line-voltage measurement.
- External-voltage detection must never trip from PECKER's own approximately 6 V excitation and must reliably trip well below nominal 120 VAC.
- FORCE and SENSE voltage-presence detection are independent.
- Any external-voltage indication hardware-inhibits the DRV8833 and triggers red LED + unique urgent tone.

## Required Rev A bench acceptance tests before field use

1. Characterize all three TPS61088 modules at LiPo 3.0 / 3.3 / 3.7 / 4.2 V and selected loads; verify 6.00 V regulation, ripple, temperature and transient behavior.
2. Verify TPS2553-1 latch-off behavior and actual trip current with the selected 88.7 kOhm ILIM resistor.
3. Verify DRV8833 current-chop behavior and actual current ceiling with the installed 2.00 ohm resistor.
4. Scope the 6 V rail during open-circuit, short-circuit and representative inductive DUT disconnects. Start with 220 uF local bulk capacitance; move to 470 uF only if measured VM overshoot requires it.
5. Calibrate ADS131M04 CH0 current, CH1 SENSE and CH2 FORCE divider ratios.
6. Verify ADS131M04 noise and stability with the boost converter running and with BLE active.
7. Verify external-voltage detector actual trip/release behavior on both FORCE and SENSE channels, including 6 V non-trip and safe controlled low-voltage AC ramp testing. Do not use PECKER as an absence-of-voltage instrument.
8. Verify that either comparator independently prevents DRV8833 excitation even if firmware attempts to test.
9. Verify TEST-button release immediately clears normal PASS/FAIL/TRANSFORMER-OK indication and returns BLUE solid READY.
10. Run the dedicated PECKER proving unit before field demonstrations.

## Production-PCB direction

Rev A may use breakout/module hardware to prove the architecture. The later integrated PCB should use genuine components from authorized distribution, including the TPS61088, ADS131M04, TLV1702, TPS2553-1 and VPG shunt. Do not copy an unknown TPS61088 module layout blindly into production.
