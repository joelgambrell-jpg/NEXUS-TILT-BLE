# Future NEXUS Integration Contract

> **DO NOT make the standalone POC depend on NEXUS.**
>
> This document preserves the intended integration architecture so the proven standalone TILT system can later be handed to the NEXUS project without reverse-engineering assumptions.

## Current development priority

The current approval target is the **non-NEXUS standalone TILT BLE POC**.

Build and prove first:

1. Customizable reusable TILT test plans.
2. Standard canned 10-point test as the default starting template.
3. Add/remove/rename test points for equipment-specific requirements.
4. BLE optical result capture from the physical TILT meter.
5. Cadence validation to reject unrelated/ambient light events.
6. Technician Accept or Retest decision for every detected result.
7. Final timestamped completed-test record.
8. Immediate completed-test viewing.
9. Standalone local storage and `.tilt.json` export.
10. iPad-first field operation.

NEXUS/Firebase integration comes **after standalone POC approval**.

## Integration boundary

The TILT system must remain a reusable testing engine. Do not put NEXUS project logic, Firebase paths, NEXUS authentication, CCS logic, Package Export logic, or NEXUS UI assumptions inside the BLE device protocol or core test engine.

Keep these layers separate:

```text
TILT meter
    ↓ optical indication
BLE hardware / firmware
    ↓ NEXUS-TILT-1 event protocol
TILT test engine
    ↓ accepted test results
TILT completed-test record
    ↓ adapter boundary
Standalone destination OR NEXUS destination
```

## Intended NEXUS field experience

NEXUS is expected to be used primarily on iPad in the field.

The intended future workflow is:

```text
NEXUS equipment page
    ↓
Launch/open embedded TILT testing experience
    ↓
NEXUS supplies equipment + prepared test-plan context
    ↓
Technician performs test using BLE TILT device
    ↓
Accept / Retest each detected result
    ↓
Final required point accepted
    ↓
Completed test finalized immediately
    ↓
Completed record written to NEXUS/Firebase
    ↓
NEXUS equipment status updates immediately
    ↓
Full completed TILT data is viewable in NEXUS in real time
```

The user should not manually export a file from the TILT module and then import it into NEXUS.

## NEXUS test-plan ownership

For NEXUS use, prepared test plans should be stored **inside NEXUS** under the applicable project/equipment context. They may be created weeks before field testing.

A plan should include at minimum:

- planId
- plan format/version
- projectId
- equipmentId
- equipment name
- plan name
- template origin
- STANDARD or CUSTOM designation
- ordered test points
- expected indication per point
- createdBy
- createdAt
- status

The standard canned test is a starting template, not a fixed mandatory sequence. There is no hard-coded `HALF TEST` behavior. A shorter/different test is a customized plan made by adding/removing/editing the required test points.

## Launch contract: NEXUS → TILT

The future NEXUS host should pass a launch object to the TILT runner rather than requiring the TILT runner to query NEXUS internals.

Proposed contract:

```json
{
  "type": "NEXUS_TILT_LAUNCH",
  "contractVersion": 1,
  "mode": "NEXUS",
  "project": {
    "projectId": "PROJECT-ID",
    "projectName": "Project Name"
  },
  "equipment": {
    "equipmentId": "EQUIPMENT-ID",
    "equipmentName": "Equipment Name"
  },
  "technician": {
    "userId": "USER-ID",
    "displayName": "Technician Name"
  },
  "plan": {
    "planId": "PLAN-ID",
    "name": "TILT Test Plan",
    "planType": "CUSTOM",
    "tests": []
  }
}
```

Do not require every field above for standalone mode.

## Completion contract: TILT → NEXUS

After the final required test point is accepted, the TILT runner should create one complete immutable execution object and send it to the NEXUS adapter immediately.

Proposed top-level structure:

```json
{
  "type": "NEXUS_TILT_COMPLETE",
  "contractVersion": 1,
  "record": {
    "recordId": "TILT-RECORD-ID",
    "recordFormat": "NEXUS-TILT-COMPLETED-1",
    "planId": "PLAN-ID",
    "projectId": "PROJECT-ID",
    "equipmentId": "EQUIPMENT-ID",
    "equipmentName": "Equipment Name",
    "status": "COMPLETE",
    "startedAt": "ISO-8601",
    "completedAt": "ISO-8601",
    "technician": {},
    "device": {},
    "tests": []
  }
}
```

Each accepted test should preserve at minimum:

- testId
- order
- group
- test point label
- expected indication
- observed indication
- PASS/FAIL/REVIEW mapping as applicable
- detectedAt
- acceptedAt
- technician identity
- BLE device ID
- firmware version
- cadence validity
- measured cadence/frequency data available from hardware
- pulse count/duration data available from hardware
- signal/confidence data available from hardware
- source/transport information

Do not reduce the NEXUS handoff to a single `PASS` flag. The detailed accepted test evidence is part of the quality record.

## Immediate NEXUS persistence

Future NEXUS integration requirement:

**The completed test must become viewable in NEXUS as soon as testing concludes.**

Expected sequence:

1. Last required point accepted.
2. TILT execution becomes COMPLETE.
3. Full completed record is frozen/finalized.
4. Adapter sends full record to NEXUS.
5. NEXUS writes the record to Firebase.
6. NEXUS writes/updates a lightweight equipment TILT summary/status.
7. Existing NEXUS real-time listeners update the equipment UI/dashboard.
8. User can immediately open the completed TILT record.

The lightweight equipment summary is for fast status/progress rendering. The full test record remains the authoritative detailed record.

## Offline / weak connectivity requirement

Field Wi-Fi cannot be assumed to be perfect.

If a NEXUS-mode test finishes while the NEXUS host/Firebase is unavailable:

- finalize the completed test locally;
- mark the integration state `PENDING_SYNC`;
- never make the technician repeat a successfully completed test solely because connectivity failed;
- retry synchronization when the NEXUS host becomes available;
- preserve the same recordId so retrying cannot create duplicate completed tests;
- change integration state to `SYNCED` only after NEXUS confirms persistence.

## iPad BLE note

Field deployment is expected to be predominantly iPad. Do not make the core application depend exclusively on desktop Web Bluetooth.

Maintain a transport boundary so the same `NEXUS-TILT-1` events can arrive through:

- Web Bluetooth during compatible desktop development/testing;
- an iOS/iPadOS native BLE bridge using CoreBluetooth for production field use.

The test engine must not care which transport produced a valid protocol event.

## Standalone mode

Standalone operation is a first-class product path, not a temporary simulator.

Standalone mode should:

- run without NEXUS;
- use the same BLE protocol and test engine;
- support the standard canned template and custom plans;
- allow Accept/Retest;
- finalize a complete record;
- show completed data immediately;
- save locally;
- allow export as `.tilt.json`;
- avoid requiring NEXUS IDs or Firebase.

This is the mode being proven first.

## Future Package Export

After NEXUS integration, completed TILT records should be consumable by NEXUS Package Export. Package Export should read the authoritative saved NEXUS TILT record; it should not query the BLE device or reconstruct results from UI state.

## Rules for future developers

1. Do not change `NEXUS-TILT-1` casually after hardware firmware is deployed. Version protocol changes.
2. Do not put NEXUS/Firebase-specific fields into the physical BLE device payload unless they are genuinely device-level data.
3. Do not let NEXUS integration break standalone operation.
4. Do not let standalone conveniences weaken the immutable completed-record model required by NEXUS.
5. Keep simulator, Web Bluetooth, and iOS native BLE transports interchangeable above the transport boundary.
6. Preserve raw/derived cadence evidence used to validate the physical indication.
7. Retest discards/replaces the current candidate; Accept creates the accepted test result.
8. Once the completed execution record is finalized, corrections should eventually use an auditable void/retest/correction workflow rather than silently editing historical data.
9. NEXUS should own project/equipment context. The TILT device should remain generic enough for standalone/commercial use.
10. Integration code should adapt the proven standalone record format rather than rebuilding the TILT test engine inside NEXUS.
