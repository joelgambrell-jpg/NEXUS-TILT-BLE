# ARC Systems TILT BLE POC

Proof-of-concept infrastructure for an ARC retrofit device that observes a TILT tester's OPEN / SHORT / TRANSFORMER OK indication, records accepted field readings, and produces a completed Pre Torque TILT Test record.

## Canonical ARC workflow

The main GitHub Pages application is `index.html`. As of ARC 40, it uses one canonical application controller (`js/app.js`) rather than stacking button/start/completion override scripts.

```text
Build Test Plan
  -> Connect ARC Device (or use POC simulator)
  -> Open Test
  -> Perform one displayed test point
  -> ARC detects OPEN / SHORT / TRANSFORMER OK
  -> Tester Accepts or Rejects / Retests
  -> Live Pre Torque TILT Test matrix fills in
  -> Test Complete
  -> Save Locally / Email Test / Save Locally + Email
  -> Completed Test Record
```

## Build Test Plan

The plan contains:

- Plan name
- Project name
- Equipment ID
- Equipment type
- Tester name
- Special notes
- Calibration verification by manual information, calibration-sticker photo, or both
- Ordered test points

The tester name is plan data and follows the test into every accepted reading and the completed record.

## Standard live test matrix

The standard template is the Pre Torque TILT Test matrix:

- Phase to Phase: A-B, A-C, B-C
- Phase to Ground: A-G, B-G, C-G
- Phase to Neutral: A-N, B-N, C-N
- Neutral to Ground: N-G

As the test runs, each accepted cell is filled in immediately:

- `TRANSFORMER_OK` -> `GO — TRANSFORMER OK`
- `OPEN` -> `NO GO — OPEN`
- `SHORT` -> `NO GO — SHORT`

Each accepted cell also carries tester and acceptance time. Retests are retained in the engine audit history.

## Record behavior

A completed test is not automatically finalized. The tester chooses:

- Save Locally
- Email Test
- Save Locally + Email

Saved local records can be reopened, downloaded as `.arc.json`, emailed again, or printed/saved as PDF from the completed-record view.

## Hardware architecture

```text
TILT tester
  -> 3 optical channels: OPEN / SHORT / TRANSFORMER OK
  -> Seeed Studio XIAO ESP32-C3
  -> ARC BLE event
  -> ARC test engine
  -> Accept / Retest
  -> live matrix
  -> completed record
```

The ARC retrofit device and the calibrated test instrument are separate assets in the record.

## POC hardware

- Seeed Studio XIAO ESP32-C3
- 3 x ALS-PT19 visible-light sensor breakouts
- 3.7 V LiPo battery
- OPEN = A0 / GPIO2
- SHORT = A1 / GPIO3
- TRANSFORMER_OK = A2 / GPIO4
- cadence qualification in firmware
- no fabricated optical thresholds
- no fabricated battery percentage; battery remains unavailable until a qualified voltage measurement path exists

## Offline and recovery

ARC is local-first. Active runs are persisted to IndexedDB for interrupted-test recovery. Completed records selected for local saving are stored locally and duplicated to IndexedDB. JavaScript, CSS, and navigation are network-first in the service worker so stale cached application code does not override current builds.

## Future NEXUS integration

ARC remains independently usable for the POC. NEXUS integration is documented separately in `docs/FUTURE_NEXUS_INTEGRATION.md` and should consume the completed ARC record rather than become a dependency of the hardware test flow.
