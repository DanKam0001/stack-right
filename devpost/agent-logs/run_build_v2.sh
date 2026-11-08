#!/bin/sh
# Session 4: rebuild Stack Right against the revised brief (2026-11-08): 30-case weight-sequenced
# order, generated layer plan with 90° interlock, pick-face queue, overhang/gap tips, height limit.
cd "$(dirname "$0")/../.." || exit 1
claude -p "$(cat <<'EOF'
The design brief in devpost/design-brief.md was revised and approved today (status: approved, revised: 2026-11-08). Read it fully, then rebuild the Stack Right Lens in Lens Studio through CLAD and the Lens Studio MCP so it matches the revised brief. Use the CLAD skills (specs-experience-builder approach, lens-api, specs-preview-interaction, specs-leaf-*) as needed. Lens Studio is open with this project.

The existing build (Assets/Scripts/StackRight*.ts, committed as 80cc4b6) is the starting point: the floor alignment, pallet/shelf/reset/arrow visuals, BoxFactory, label UIs, audio, SIK grab with test hooks, slide-back, glow, off-view arrow and chime all stay. What changes:

1. Order + plan (StackRightPickList.ts): replace the 8-carton list with the 30-case order in the brief (5 layers). Generate the slot plan in code, not by hand: for each layer, take the case footprint, turn it 90 degrees on layers 2 and 4, fit as many as fit the 116.5 cm pallet as a centred grid, fill in a consistent order (far row to near row, left to right), stack layer bottoms on the previous layer's top (deck top y = 15). Each planned slot needs: centre, layer number, whether it is turned 90 degrees. Keep it pure data/logic.
2. Cases are created at runtime under the PickList root (reuse any authored children for the first ones, create the rest), all 30. Only the next 4 not-yet-placed cases are shown on the pick face (lower shelf, 4 slots along the shelf, the one due now in the slot nearest the pallet); the others are disabled until they enter the queue. Only the case due now is interactable. When a case is placed, the queue moves up (cases slide to their new home slots).
3. Placing snaps the case to its slot with the planned rotation (pallet rotation, plus 90 degrees about up when turned). The ghost uses the case's size with x/z swapped when turned. Tag text: "Layer N · K of 30 · kg". Counter: "Layer N · K / 30".
4. Mistakes: case dropped on the pallet but not on the ghost -> slide back, mistake, red tip: "Overhang. Keep it inside the edge." if any part of the case footprint (in the planned orientation, centred on the drop point) would hang more than 2 cm over the pallet edge, else "That leaves a gap. Drop it on the ghost." Off the pallet -> back, no mistake. Remove the old heavy-first and not-this-one-yet rules.
5. Layer done (layers 1-4): white note on the pallet for 4 s, reuse the tip panel with white text: "Layer N done. Next layer turns 90° so the joints don't line up."
6. Height-limit outline at 180 cm above the floor around the pallet footprint (thin pale wire box edge or rectangle) with a small label "Height limit 180 cm".
7. Completion card: "Pallet done! 30 cases · 5 layers · <height> cm\nTime m:ss · Mistakes n\nWrap and label the pallet." Height = the computed stack top. Keep the timer starting at the first grab.
8. Update StackRightTestDriver.ts and the LEAF scenarios (devpost/leaf-scenarios, and Assets/Tests if LEAF is installed there) to cover all 6 done criteria, including a full 30-case run through the test hooks, an overhang drop, a gap drop, an off-pallet drop, the layer-2 orientation check, the queue shift, and reset. Run them in the preview and report pass/fail per done criterion. Write the log to devpost/selftest-2026-11-08.log.
9. Save the scene. Take preview screenshots into devpost/screenshots/v2-*.png: start layout, a ghost mid-build on layer 3 (turned vs layer 2 visible), an overhang tip, a layer-done note, the completed pallet with the completion card.

Known gotchas from the last build on this machine: CaptureRuntimeViewTool installed packages and froze Lens Studio ("Synchronization is already in progress"), so prefer CapturePanelScreenshotTool of the Preview panel. Open pop-ups in Lens Studio silently block the TypeScript compiler; if compiles stop reporting, say so instead of looping. An empty .mat crashed the lens, so don't create material assets without a shader. Keep everything bright on the additive display (no dark colours), units are cm.

Do not git commit, push, or touch anything outside this project folder. When done, print a short report: what changed, per-criterion test results, screenshots taken, anything unfinished.
EOF
)" --mcp-config .mcp.json --strict-mcp-config --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/04-build-v2.jsonl 2> devpost/agent-logs/04-build-v2.err
echo "exit $?"
