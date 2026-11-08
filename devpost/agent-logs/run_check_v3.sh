#!/bin/sh
# Session 5 (2026-11-09): recompile after the per-rule mistake breakdown on the completion card,
# re-run the self-test + LEAF, then hand-check real play in Interactive Preview (timer, drag feel).
cd "$(dirname "$0")/../.." || exit 1
claude -p "$(cat <<'EOF'
Lens Studio is open with this project (Stack Right, see devpost/design-brief.md, status approved). Work through CLAD skills and the Lens Studio MCP only.

One small code change was made by hand since the last build: the completion card now groups mistakes by rule ("Mistakes 3 (2 overhang · 1 gap)"), with getOverhangMistakes()/getGapMistakes() on the controller and one new DC6 check in Assets/Scripts/StackRightTestDriver.ts. Do NOT redesign anything. Tasks:

1. Recompile TypeScript and report any errors (fix only real compile errors, minimally).
2. Re-run the self-test driver and the LEAF scenarios (Assets/Tests) in the preview. Append the results to devpost/selftest-2026-11-09.log (pass/fail per check and per done criterion, with totals).
3. Real-play hand-check, as a person with a mouse would play it, NOT through the test hooks: use the preview interaction tooling (specs-preview-interaction / PreviewPanelTool) to grab the glowing case on the pick face, drag it to the pallet and release it on the ghost, for at least the first 3 cases, with a deliberate pause of a few seconds between cases. Also do one deliberate wrong drop (gap) by mouse. Report: did grab/drag/snap work by mouse, did the ghost and tag appear, did the red tip appear, and roughly how the drag feels (does the case follow the cursor at a sensible depth, is it easy to land on the ghost). Then confirm the timer measures real time: either finish the order by mouse, or (if that is too slow) place the rest through the test hooks after the real-time mouse placements and check the completion card shows Time greater than 0:00 and the mistake breakdown. If it shows 0:00 after real waiting, find out why and fix it minimally.
4. Readability: from the default user position, check the ghost tag and the progress text are readable both at layer 1 (looking down) and at layer 5 (about 157 cm). Report, don't redesign; only nudge a text position/size if it is clearly unreadable.
5. Take screenshots into devpost/screenshots/v3-*.png: a mouse-held case over its ghost, the red gap tip, and the completion card with the mistake breakdown visible.
6. Save the scene.

Known gotchas on this machine: CaptureRuntimeViewTool can freeze Lens Studio, so prefer CapturePanelScreenshotTool of the Preview panel. Open pop-ups in Lens Studio silently block the TypeScript compiler; if compiles stop reporting, say so instead of looping. Don't create material assets without a shader. Don't touch .agents/skills or Plugins/. Keep everything bright (additive display), units are cm.

Do not git commit, push, or touch anything outside this project folder. When done, print a short report: compile result, test totals, the hand-check findings (be honest about anything that felt off), readability, screenshots taken, any change you made and why.
EOF
)" --mcp-config .mcp.json --strict-mcp-config --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/05-check-v3.jsonl 2> devpost/agent-logs/05-check-v3.err
echo "exit $?"
