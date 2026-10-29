# Stack Right LEAF scenarios (written, NOT yet run)

These are kept outside `Assets/` because the LEAF package (`Leaf.lspkg`) is not installed yet.
Inside `Assets/` they would break the TypeScript build.

To use them:
1. Restart Lens Studio, then rebuild the scene from `../stackright-scene-bootstrap.json`
   (VirtualScene apply `phaseA` → recompile → apply `phaseB` → save).
2. Sign in to Lens Studio and install LEAF (Asset Library, or the `specs-leaf-install-packages` skill).
3. Copy every `.ts` file here into `Assets/Tests/` (imports expect `../Scripts/StackRightController`).
4. Add a root SceneObject `LeafIndex` with the `LeafIndex.ts` script, recompile, and run the scenarios.

| Scenario id | Done criterion |
|---|---|
| dc1-layout | 1. Pallet ~1 m ahead on the floor; shelf ~1.4 m right with 8 cartons |
| dc2-ghost-on-grab | 2. Correct grab shows the ghost and the "Layer N · Heavy/Light · kg" tag |
| dc3-snap-counter-next | 3. Drop within 15 cm snaps, the counter goes up, next ghost appears |
| dc4-wrong-carton-tip | 4. Crushable when heavy is due: back to the shelf + red tip |
| dc5-complete-and-reset | 5. Completion card with time + mistakes; Reset (real button pinch) clears |
| reset-reach-ik | Extra: IK reachability of the Reset button |

Note: DC2–DC5 drive grab/release through the controller's `simulateGrab`/`simulateRelease` hooks
(same code path as SIK `onManipulationStart/End`), not through a simulated mouse drag. A real
SIK carry of a carton from shelf to pallet is not covered by a test; check it by hand in
Interactive Preview.
