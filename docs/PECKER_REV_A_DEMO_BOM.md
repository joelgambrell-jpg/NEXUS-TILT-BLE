# PECKER Rev A Demonstrator BOM

Status: LEAN ONE-UNIT DEMONSTRATOR
Date: 2026-09-14

Purpose: build one complete PECKER Rev A demonstrator suitable for bench validation, controlled demonstrations, and securing funding for later development builds. This list intentionally removes duplicate/spare purchases while preserving the frozen Rev A measurement, protection, BLE, and field-interface architecture.

## Core build — one unit only

| Qty | Part | Purpose | Target source |
|---:|---|---|---|
| 1 | Adafruit 5477 ESP32-S3 Feather, 4 MB Flash / 2 MB PSRAM | Main controller / BLE / USB-C / LiPo management | Adafruit |
| 1 | Adafruit 3297 DRV8833 breakout | Reversible/pulsed excitation | Adafruit |
| 1 | Adjustable TPS61088 boost module | LiPo to 6.00 V test rail | Reputable marketplace seller; characterize before use |
| 1 | TI TPS2553DBVR-1 | Protected ~300 mA 6 V rail | DigiKey |
| 1 | 88.7 kOhm 1% resistor | TPS2553-1 current-limit programming | DigiKey |
| 1 | TI ADS131M04IPWR | 4-channel simultaneous 24-bit ADC | DigiKey |
| 1 | VPG Y14750R10000B9R 0.100 ohm 4-terminal shunt | Precision DUT current measurement | DigiKey |
| 1 | TI TLV1702AIDGKR | Dual FORCE/SENSE external-voltage comparator | DigiKey |
| 8 | 1 kV US1M rectifiers | Full-wave FORCE/SENSE voltage detectors | DigiKey |
| 8 | Susumu RGV 470 kOhm 0.1% HV resistors | High-voltage detector divider strings | DigiKey |
| 2 | BAS70-class low-leakage Schottky clamps | Comparator input protection | DigiKey |
| 2 | 23.7 kOhm 0.1% resistors | Detector low-side dividers | DigiKey |
| 1 | 71.5 kOhm 0.1% resistor | Comparator reference divider | DigiKey |
| 1 | 10.0 kOhm 0.1% resistor | Comparator reference divider | DigiKey |
| 2 | 10 nF C0G/NP0 capacitors | Voltage-detector filtering | DigiKey |
| 1 | Adafruit 5791 PAM8904 piezo driver | Audible status/warning tones | Adafruit |
| 1 | Large passive piezo element | Sounder | Adafruit |
| 1 | Adafruit 328 protected 2500 mAh LiPo | Main battery | Adafruit |
| 1 | 220 uF / 16 V low-ESR capacitor | 6 V rail bulk capacitance | DigiKey; use current in-stock equivalent if selected Panasonic suffix is unavailable |
| 2 | 2.00 ohm 1% >=0.25 W resistors | DRV8833 nominal 100 mA current regulation | DigiKey |

## ADC analog passives

Buy only enough for the one demonstrator plus unavoidable package quantities.

- CH0: two 1.00 kOhm 0.1% low-TCR resistors + one 10 nF C0G/NP0 capacitor.
- CH1: fixed ~60 V peak SENSE divider, TI-style EOS protection, two 1.00 kOhm filter resistors, one 10 nF C0G/NP0 differential capacitor.
- CH2: fixed ~8 V peak FORCE divider, TI-style EOS protection, two 1.00 kOhm filter resistors, one 10 nF C0G/NP0 differential capacitor.
- CH3: leave unused/terminated per TI guidance.

Do not add INA181, OPA2320, TMUX1133, ADS1115, MCP3204, MCP4725 or another precision reference.

## Field lead system — one demonstrator

| Qty | Part | Purpose |
|---:|---|---|
| 1 | ATTEND 216A-04MAF M12 A-coded 4-pin panel receptacle | PECKER field connector |
| 1 | ATTEND 216A-04FO0 or equivalent quality field-attachable M12 A-coded 4-pin female plug | Build the lead harness without buying a $40+ premade cable |
| 2 | Mueller BU-75K Kelvin clips | FORCE/SENSE termination at DUT |
| ~6 ft | Flexible 4-conductor cable | M12-to-Kelvin lead harness |

Pin semantics remain:
1. FORCE+
2. SENSE+
3. FORCE-
4. SENSE-

## Controls / enclosure

Use one of each only:
- SPST-NO momentary TEST button.
- SPST latching master ON/OFF switch.
- One blue LED, one green LED, one red LED.
- Three 1 kOhm LED resistors.
- One swing-open enclosure large enough for the Feather, boost module, driver, ADC/protection carrier, battery and M12 panel connector.
- Perfboard/carrier board or one-off prototype PCB.
- One TSSOP-20 adapter if hand-building the ADS131M04 section.
- Hookup wire, heat-shrink, JST/locking internal connectors, standoffs and mounting hardware only as needed.

## Do not buy for the demonstrator

- Duplicate/spare controller boards.
- Duplicate ADCs/comparators/driver boards.
- Spare LiPo.
- Spare Kelvin clips.
- Spare M12 harness.
- Three TPS61088 modules; use one reputable adjustable module and thoroughly characterize it before installation.
- 470 uF bulk capacitor unless scope testing proves 220 uF insufficient.
- Production PCB quantities.
- Cosmetic production enclosure/tooling.
- Separate charger, fuel gauge, display, mode selector, banana jacks or USB panel extension.

## Budget target

Target a complete one-unit demonstrator purchase of approximately $220–$240 delivered, depending mainly on enclosure, boost-module seller, shipping and passive minimum quantities. The largest single component costs are the VPG precision shunt and two Mueller Kelvin clips; retain these because they directly support the low-resistance measurement demonstration.

## Demonstration acceptance gate

Before presenting the unit:
1. Verify stable 6.00 V rail across battery operating range.
2. Verify TPS2553-1 latch-off and DRV8833 ~100 mA current ceiling.
3. Calibrate ADC current, FORCE and SENSE channels.
4. Verify FORCE and SENSE external-voltage interlocks independently inhibit excitation.
5. Verify OPEN / SHORT / known resistance behavior.
6. Verify representative transformer/winding response and waveform capture.
7. Verify BLE reporting to ARC and standalone LED/tone behavior.
8. Run the proving-unit checks and retain the result as demo evidence.

This demonstrator is for de-energized-equipment testing and controlled demonstrations. It is not a CAT-rated absence-of-voltage instrument.