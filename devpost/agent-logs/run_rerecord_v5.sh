#!/bin/sh
# Session 7 (2026-11-09): completion card moved above the 180 cm line and scaled 1.5x (one hand edit in
# StackRightController.ts); recompile, re-test, and re-record the scripted demo with the same framing.
cd "$(dirname "$0")/../.." || exit 1
claude -p "$(cat <<'PROMPT'
Lens Studio is open with this project (Stack Right). Work through the CLAD skills and the Lens Studio MCP. Bash and ffmpeg (C:/ffmpeg/bin/ffmpeg.exe) are available.

One hand edit since the last session: in Assets/Scripts/StackRightController.ts the completion card is now placed at max(stackTop + 24, HEIGHT_LIMIT_CM + 30) and scaled 1.5x, so it no longer sits across the 180 cm height line. Do NOT redesign anything else.

1. Recompile TypeScript; fix only real compile errors, minimally.
2. Re-run the self-test driver and the LEAF scenarios; append results to devpost/selftest-2026-11-09.log.
3. Re-record exactly as the previous session did (see devpost/agent-logs/run_demo_v4.sh steps 3 to 5 and its transcript 06-demo-v4.jsonl for the exact preview size, the ffmpeg region and the driver "demo" mode): same framing and camera, ffmpeg gdigrab of the Preview panel at 30 fps, x264 crf 18, to devpost/video/raw_demo.mp4; record_start.txt with milliseconds; all [DEMO] and [StackRight] lines with timestamps to devpost/video/demo_beats.log. Stop ffmpeg cleanly with q right after "[DEMO] end" (do not let it run on). Then set the driver mode back to "off" and save the scene.
4. Extract check frames into devpost/video/check-*.png (same five beats) and look at each. Specifically confirm the completion card is fully in frame, above the height line, not overlapping it, and readable. If the card is cut off at the top of the frame, lower the max() offset from +30 to +15 (or reduce the scale to 1.3) and record again (at most 2 more attempts).

Known gotchas: injected mouse input does not register grabs; CaptureRuntimeViewTool and the preview-interaction package install can freeze Lens Studio; open pop-ups silently block the TypeScript compiler (if compiles stop reporting, say so instead of looping). Don't touch .agents/skills, .claude/skills or Plugins/.

Do not git commit, push, or touch anything outside this project folder. When done, print a short report: compile result, test totals, recording path/length/resolution, demo beat times relative to recording start, what each check frame showed, anything unfinished.
PROMPT
)" --mcp-config .mcp.json --strict-mcp-config --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/07-rerecord-v5.jsonl 2> devpost/agent-logs/07-rerecord-v5.err
echo "exit $?"
