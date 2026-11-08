# Stack Right LEAF scenarios (v2, 30-case order)

Copies of `Assets/Tests/*.ts`, which is the live copy registered by the root `LeafIndex` SceneObject.
They need LEAF 2.0.2, the version that matches the project's SIK 2.0 (`SpectaclesInteractionKit.lspkg`).
LEAF 4.0 imports `InteractionKit.lspkg/...` and breaks the whole TypeScript build of this project.

Last run: 2026-11-08, in the Lens Studio preview. All 7 scenarios passed. The log is in
`../selftest-2026-11-08.log`, after the TestDriver self-test.

| Scenario id | Done criterion |
|---|---|
| dc1-layout | 1. Pallet ~1 m ahead on the floor, shelf ~1.4 m right, next 4 cases on the lower shelf (case due now nearest the pallet), 180 cm height-limit outline, counter "Layer 1 · 0 / 30" |
| dc2-ghost-and-tag | 2. Only the case due now can be grabbed. The ghost has the case's size at its slot, and the tag reads "Layer N · K of 30 · kg". The layer-2 ghost is turned. Case 15 is on layer 3 |
| dc3-snap-queue-30 | 3. Full 30-case run. Each case snaps with the planned rotation, the counter steps, and the queue moves up and slides to the new home slots |
| dc4-overhang-gap-offpallet | 4. Gap drop, overhang drop, the 2 cm tolerance, an off-pallet drop (no mistake), overhang in the turned orientation, and the tip hiding after 4 s |
| dc5-layer-notes-orientation | 5. "Layer N done…" note after layers 1–4 and none after 5. Layer 2 is placed 90° against layer 1, and the layers alternate after that |
| dc6-complete-and-reset | 6. Completion card (30 cases · 5 layers · 157 cm, time, mistakes, wrap line). The card stays up, then the real Reset button pinch clears the pallet |
| reset-reach-ik | Extra: IK reachability of the Reset button |

Note: DC2–DC6 drive grab and release through the controller's `simulateGrab`/`simulateRelease` hooks.
These run the same code path as SIK `onManipulationStart/End`. Reset is pressed through real SIK input.
No test covers a real SIK carry of a case from the shelf to the pallet, so check that by hand in Interactive Preview.
