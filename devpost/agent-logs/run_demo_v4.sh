#!/bin/sh
# Session 6 (2026-11-09): wrap the red tip so it fits the view, add a scripted "demo" driver mode
# that plays a full order like a person would, and screen-record it from the preview for the video.
cd "$(dirname "$0")/../.." || exit 1
claude -p "$(cat <<'EOF'
Lens Studio is open with this project (Stack Right; devpost/design-brief.md is the approved brief). Work through the CLAD skills and the Lens Studio MCP. Bash and ffmpeg (C:/ffmpeg/bin/ffmpeg.exe) are available.

Goal: a clean screen recording of the Lens being played, for a demo video under 3 minutes. Do these in order.

1. Tip fits the view. The red tip ("That leaves a gap. Drop it on the ghost.") is currently one line wider than the view and gets cut off at both sides. Make every tip and the layer-done note break into two lines at the sentence break (". " -> ".\n"), and make sure the text block is no wider than the pallet (116.5 cm) when seen from the default position. Keep the size readable. Update any test that checks the exact tip string (the controller's getTipText or similar; LEAF scenarios in Assets/Tests and their copies in devpost/leaf-scenarios).

2. Demo mode. Add mode "demo" to Assets/Scripts/StackRightTestDriver.ts (next to the existing "paced" mode). It plays the whole order through the controller's existing grab/release hooks, but the held case visibly travels from its pick-face slot to the drop point along a smooth arc (ease in/out, lifted about 30 cm above the stack top) while it is held, so the ghost is visible during the carry. Script, with a log line "[DEMO] <beat>" at the start of each beat:
   - intro: 4 s idle on the start layout.
   - case1: slow carry (3 s), hover 1.5 s right above the ghost so the tag can be read, drop -> snap. Pause 1.5 s.
   - overhang: case 2 carried to a spot where it hangs about 15 cm over the pallet's side edge, drop -> red overhang tip, slides back. Pause 3.5 s.
   - gap: case 2 dropped on the pallet but clearly away from its slot -> red gap tip, slides back. Pause 3.5 s.
   - case2: case 2 carried to its ghost and placed (2 s carry).
   - layer1: rest of layer 1 at 1.4 s per case. Hold on the layer-done note 3.5 s.
   - layer2turn: first case of layer 2 slowly (3 s carry, 1.5 s hover) so the turned ghost is obvious, then the rest of layer 2 at 0.9 s per case.
   - fast: layers 3 and 4 at 0.5 s per case (the video will also speed this up).
   - layer5: layer 5 at 1.4 s per case.
   - complete: hold on the completion card 7 s.
   - reset: press Reset, hold 3 s.
   - end.
   The demo mode must not change any game rule; it only drives the hooks and moves the held case. Leave the default driver mode "off" when you finish.

3. Framing. The video needs a 16:9 landscape view that shows the pallet, the pick face and the ghost tag at the same time, and later the completion card at the top of the stack. Make the Preview panel as large and landscape as Lens Studio allows (maximize/undock it; set a 16:9 preview resolution such as 1920x1080 if the option exists). Pick a viewpoint a person could plausibly stand at (eye height about 165 cm, a step back and to the left of the default so both pallet and shelf are in frame). If the demo mode can set the camera transform in the preview without fighting device tracking, do it there (and restore the default camera behaviour outside demo mode); otherwise position the preview camera with the Interactive Preview controls before recording. Take a CapturePanelScreenshotTool screenshot of the framing and check by eye that pallet, shelf, tag and the 180 cm line are all in frame before recording.

4. Record. Start ffmpeg in the background capturing the screen region of the Preview panel only (gdigrab, -framerate 30, offset/size of the panel, or the whole window then crop), x264 crf 18, to devpost/video/raw_demo.mp4. Write the wall-clock time ffmpeg started (with milliseconds) to devpost/video/record_start.txt. Then switch the driver to demo mode and restart the preview, wait until the "[DEMO] end" log line (or 4 minutes max), then stop ffmpeg cleanly (send q). Copy every "[DEMO]" and "[StackRight]" log line with its timestamp into devpost/video/demo_beats.log. Afterwards set the driver mode back to "off" and save the scene.

5. Check the recording: extract frames at the case1 hover, the overhang tip, the gap tip, the layer2turn hover and the completion card (ffmpeg -ss using the beat times relative to record_start) into devpost/video/check-*.png, look at each one, and report honestly whether each shows what it should (text readable, nothing cut off). If something important is out of frame or unreadable, fix the framing and record again (at most 2 more attempts).

6. Re-run the self-test and the LEAF scenarios after the tip change; append results to devpost/selftest-2026-11-09.log.

Known gotchas on this machine: injected mouse input does not register grabs in the preview, so don't rely on it. CaptureRuntimeViewTool and the preview-interaction package install can freeze Lens Studio or break the compile, so avoid them. Open pop-ups silently block the TypeScript compiler; if compiles stop reporting, say so instead of looping. Don't create material assets without a shader. Don't touch .agents/skills, .claude/skills or Plugins/. Keep everything bright on the additive display; units are cm.

Do not git commit, push, or touch anything outside this project folder. When done, print a short report: the tip change, the demo beats with their times relative to the recording start, the recording's path, length and resolution, what each check frame showed, test totals, and anything unfinished.
EOF
)" --mcp-config .mcp.json --strict-mcp-config --permission-mode auto --output-format stream-json --verbose \
  > devpost/agent-logs/06-demo-v4.jsonl 2> devpost/agent-logs/06-demo-v4.err
echo "exit $?"
