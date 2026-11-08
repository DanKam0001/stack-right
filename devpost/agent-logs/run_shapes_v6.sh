#!/bin/sh
# Session 8 (2026-11-09): the learner (a warehouse picker) asked for real freight instead of tidy identical cartons:
# odd sizes mixed inside a layer, non-box shapes (sacks, shrink-wrapped tin trays, a long carton), and the pallet
# sitting on a ride-on pallet jack. No avatar: on Specs the wearer is the picker. Rebuild, re-test, re-record.
cd "$(dirname "$0")/../.." || exit 1
claude -p "$(cat <<'PROMPT'
Lens Studio is open with this project (Stack Right; devpost/design-brief.md is the approved brief). Work through the CLAD skills and the Lens Studio MCP. Bash and ffmpeg (C:/ffmpeg/bin/ffmpeg.exe) are available. Read Assets/Scripts/*.ts first; StackRightPickList.ts owns the order and the computed plan.

The learner (who picks real store orders) reviewed the demo: every case is a tidy identical carton, which is not what real freight looks like. Make the order realistic. Keep every existing rule, interaction, the ghost/tag/snap/tip/card behaviour, the demo driver and the tests working.

1. New order (replace ORDER_LINES; still heaviest first; sizes W x D x H cm; every case in a layer has the same H so each layer finishes level):
   - Layer 1: PET FOOD 20kg, 20 kg, w 55, d 37, h 14, count 6, shape "sack".
   - Layer 2: LAUNDRY 4x4L, 17 kg, w 38, d 58, h 30, count 6, shape "carton".
   - Layer 3 (MIXED, turned 90): WATER 24, 14 kg, w 38, d 58, h 25, count 4, carton; then JUICE 12x1L, 12 kg, w 38, d 29, h 25, count 4, carton. Turned, water is 58 across x 38 deep, 2 per row, 2 rows; the juice fills the leftover 38 cm strip, 4 across.
   - Layer 4: TINNED TOMATOES 2x24, 10 kg, w 57, d 38, h 13, count 6, shape "tray" (2 per row, 3 rows).
   - Layer 5 (MIXED, fragile on top): BREAD, 4 kg, w 56, d 45, h 30, count 2; PAPER TOWEL 12, 3 kg, w 112, d 25, h 30, count 1, shape "long" carton; CHIPS, 2 kg, w 56, d 45, h 30, count 2.
   Total 31 cases, deck 15 + 14+30+25+13+30 = 127 cm.
   Pick bright, light colours per line (additive display, no dark colours); keep fragile flags for bread and chips.

2. Plan stays computed, not hand-placed. Replace the one-footprint grid with row (shelf) packing per layer: take the layer's cases in order, footprint per line (turned per layer, so put a per-line or per-layer turned flag in the data instead of TURNED_LAYERS=[2,4]; layer 3 is turned), fill a row left to right while it fits 116.5 cm, start a new row nearer the user when it doesn't, row depth = deepest case in it; centre each row in x and the whole layer in z. Print an error if a layer overflows the pallet or mixes heights. The joints of each layer should cross the one below: check the plan does that for this order and say so in the report.
   The layer-done note is now per layer, two lines, true for the plan, e.g. "Layer 2 done.\nNext layer turns 90° so the joints cross." vs "Layer 3 done.\nFlat trays next: keep the top level." Write them to be accurate for each layer.

3. Shapes, built from primitives/mesh builder (no new material assets without a shader; reuse the existing case materials/BoxFactory pattern):
   - sack: a soft, rounded, pillow-like bag (e.g. a flattened, slightly squashed ellipsoid/capsule or a stack of 2-3 shrinking rounded slabs with a crimped seam at the ends). It must not read as a sharp cube.
   - tray: a low cardboard tray (about 4 cm lip) with the tins visible as a grid of short cylinders on top of it, plus a faint clear shrink-wrap box around it.
   - long: an ordinary carton but 112 cm long, so it reads as the odd one.
   - carton: as now.
   Labels (name + kg + HEAVY/FRAGILE) still readable on every shape. The ghost can stay the wire bounding box of the footprint. Grab colliders = the bounding box. Make sure sacks, trays and the 112 cm carton sit on the pick face without poking through the shelf uprights (widen the shelf or the queue spacing if needed, keep it 1.4 m to the right).

4. Ride-on pallet jack: the pallet sits on the forks of a ride-on electric pallet jack (the kind an order picker stands on). Build it from primitives at real size: two forks under the pallet visible in the pallet's openings, the power unit (about 80 wide, 60 deep, 120 tall, safety yellow/orange, bright) at the pallet's edge on the side that does not block the user's view of the pallet, the pick face or the ghost, a small operator platform and a tiller/handle. It is scenery only (no physics, not grabbable, no game rules), and must not hide the Reset button, the counter, the tag, the tips or the completion card from the default position or the demo camera. The pallet keeps its current position and deck height so the plan and tests stay valid.

5. Demo driver ("demo" mode in StackRightTestDriver.ts): keep the beats and their [DEMO] log names: intro, case1, overhang, gap, case2, layer1, layer2, layer3mixed, fast, layer5, complete, reset, end. Changes: rename "layer2turn" to two beats: "layer2" (layer 2 at 0.9 s per case) and "layer3mixed" (first water case slow: 3 s carry, 1.5 s hover; rest of the water at 0.9 s; first juice case slow: 3 s carry, 1.5 s hover; rest of the juice at 0.9 s). "fast" = layer 4 at 0.5 s per case. "layer5" = layer 5 at 1.4 s per case but hover 1.5 s over the ghost for the long paper towel carton. Other beat timings unchanged. Default driver mode must be "off" when you finish.

6. Update the self-test driver checks and the LEAF scenarios (Assets/Tests and copies in devpost/leaf-scenarios) for the new order: 31 cases, 5 layers, 127 cm, tag text "Layer N · K of 31 · kg", per-layer done notes, the turned layer, plus new checks: the plan has no overlaps and stays inside the pallet; every layer is level; layer 3 and layer 5 contain more than one footprint. Run them; append results to devpost/selftest-2026-11-09.log. Everything must pass.

7. Look at it: CapturePanelScreenshotTool of the Preview at the demo camera, with the order at layer 1 (sacks), mid layer 3 (mixed + ghost), layer 4 (trays), and the completion card; save as devpost/screenshots/v4-*.png and check by eye that sacks read as sacks, trays show tins, the jack reads as a pallet jack, and nothing important is hidden. Fix what doesn't.

8. Re-record exactly as before (see devpost/agent-logs/run_demo_v4.sh steps 3-5 and the 06/07 transcripts for preview size, ffmpeg region and camera): ffmpeg gdigrab of the Preview panel, 30 fps, x264 crf 18, to devpost/video/raw_demo.mp4 (overwrite); record_start.txt with ms; all [DEMO] and [StackRight] lines to devpost/video/demo_beats.log; stop ffmpeg with q right after "[DEMO] end". Extract check frames devpost/video/check-*.png at case1 hover, overhang tip, gap tip, layer3mixed first-juice hover, layer5 paper-towel hover, completion card; look at each. Set the driver back to "off" and save the scene.

Known gotchas: injected mouse input does not register grabs; CaptureRuntimeViewTool and the preview-interaction package install can freeze Lens Studio; open pop-ups silently block the TypeScript compiler (if compiles stop reporting, say so instead of looping). Don't touch .agents/skills, .claude/skills or Plugins/. Units are cm; keep everything bright.

Do not git commit, push, or touch anything outside this project folder. When done, print a short report: what changed per file, the computed plan per layer (rows and footprints) and whether the joints cross, how each shape was built, where the jack is, test totals, recording path/length, demo beat times relative to recording start, what each check frame showed, and anything unfinished or that looks off.
PROMPT
)" --mcp-config .mcp.json --strict-mcp-config --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/08-shapes-v6.jsonl 2> devpost/agent-logs/08-shapes-v6.err
echo "exit $?"
