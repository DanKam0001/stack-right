---
status: approved
revised: 2026-11-08
---

# Design brief: Stack Right

<!-- First filled in by plan-lens from devpost/interview-answers.md (written in advance; the learner was not available live). Revised 2026-11-08 after the learner's review: in a real distribution centre the warehouse system already sends cases heaviest-first and a store order is 100+ cases, so "heavy on the bottom" is not the skill a new picker lacks. The skill is WHERE each case goes so every layer stays tight, level and square, layers interlock, nothing overhangs, and the pallet stays under the height limit. The learner approved the revision and delegated the open choices. Values marked (default) were not chosen by the learner. -->

A pallet-building trainer for new pickers in a supermarket distribution centre. The warehouse system already hands you the cases in a sensible order, heaviest first. What it doesn't tell you is where each odd-sized case goes. Eighty cases into a hundred-case order, a pallet starts to lean because an early layer went down with gaps, and every layer above makes it worse. Stack Right shows the right spot for every case, at real size, on the pallet in front of you.

## The one spatial moment
I'm halfway up a pallet, holding the next case the system sent me. A glowing ghost of it sits on the pallet at real size, exactly where it fits: flush to the edge, tight against its neighbour, level with the rest of the layer. The tag says "Layer 3 · 15 of 30 · 10 kg". I drop it on the ghost, it snaps square, and the next case is waiting on the pick face. When a layer finishes, the next one's ghost is turned 90°, so the joints don't line up and the stack locks together.

## Why it belongs on glasses
- Uses: draws in the world (the right spot is shown on the pallet at real size) and leaves your body free (eyes on the pallet, both hands on the case).
- Why it's better than the phone or laptop version: a paper load plan or a picture on a scanner screen has to be turned into a position in your head, case after case, a hundred times an order. Here the answer is the spot itself, so there's nothing to translate and nothing to put down.

## Product or overlay
- Type: product. A training simulator: the virtual pallet, pick face and cases are the experience, so a new picker can build a full mixed pallet before touching real stock.
- What the real version would sense: the case's barcode when it's picked, and the real pallet's position.
- Stand-in for the preview: a fixed 30-case order, already in the system's heaviest-first sequence, which the Lens knows. No scanning or recognition. A real order is 100+ cases; 30 keeps the demo short (default).
- The load plan is worked out in code from the case sizes, not hand-placed: each layer is filled with as many cases as fit the 116.5 cm pallet (a grid, centred), and every other layer is turned 90° so joints don't stack (the interlock).
- The order (default; the learner can swap in real lines), sizes W x D x H in cm:
  1. Layer 1: Laundry liquid 4 x 4 L, 17 kg, 38 x 58 x 30, 6 cases
  2. Layer 2: Bottled water 24-pack, 14 kg, 38 x 58 x 30, 6 cases (turned 90°)
  3. Layer 3: Canned tomatoes 24-pack, 10 kg, 29 x 58 x 25, 8 cases
  4. Layer 4: Soft drink 24 cans, 9 kg, 38 x 58 x 25, 6 cases (turned 90°)
  5. Layer 5: crushables on top, 58 x 58 x 32: Chips x 2 (2 kg), Bread (4 kg), Eggs (10 kg), fragile, 4 cases
  - Total 30 cases, finished height about 157 cm with the 15 cm pallet.

## Where things live
- Where the user is looking during the main task: down at the pallet most of the time, sometimes to the right at the pick face.
- Pallet: on the floor about 1 m in front of the user, Australian standard 116.5 x 116.5 cm, 15 cm tall.
- Pick face (the existing shelf bay): about 1.4 m to the user's right. The next 4 cases of the order sit on the lower shelf, the one due now nearest the pallet. When a case is placed, the queue moves up and the next case in the order appears at the back. The rest of the order is not shown.
- Cases: real sizes. Bright, light-saturated label colours (additive display, no dark colours), name + weight + HEAVY or FRAGILE printed on the faces the user sees.
- Ghost: on the pallet where the current case goes, same size and orientation as the case will have when placed, pale cyan, about 30% fill, with an outline.
- Tag on the ghost: "Layer N · K of 30 · kg", on the ghost's side facing the user, at least 4 cm text.
- Height limit: a thin pale outline around the pallet footprint at 180 cm above the floor, with a small label "Height limit 180 cm" (default height).
- Progress: "Layer 3 · 15 / 30" on the near edge of the pallet.
- Reset button: on the pallet's near corner on a short post.

## Hands and input
- Grab the case from the pick face and carry it to the pallet: a standard SIK grab, which works with the mouse.
- Let go within about 15 cm of the ghost and the case snaps square into place, turned to match the plan. Placed cases are locked, not left to physics.
- One big "Reset pallet" button (pinch) clears the pallet and restarts the order.
- Targets are big and highlight when aimed at. Voice: none.

## When things show
- Only the next ghost is shown, never the whole plan. It appears when the case due now is grabbed and hides when it's placed.
- The case due now glows softly on the pick face (decided by the learner's delegation: glow, not a pre-grab ghost, so the pallet only ever shows one instruction).
- Case dropped on the pallet but not on the ghost: it slides back to the pick face, a short red tip shows on the pallet for 4 seconds, and it counts as one mistake. The tip says why that spot is wrong:
  - any part would hang over the pallet edge: "Overhang. Keep it inside the edge."
  - otherwise: "That leaves a gap. Drop it on the ghost."
- Case released off the pallet (floor, air): it slides back, no mistake.
- A later case in the queue can't be grabbed until it's due (only the front case is interactable).
- Layer finished: a short white note on the pallet for 4 seconds: "Layer N done. Next layer turns 90° so the joints don't line up." (Not shown after the last layer.)
- If the case due now is out of view: a short chime plays, and a small arrow on the pallet edge points toward it.
- Pallet done: a completion card on the pallet shows cases, layers, height, time taken and mistakes, plus "Wrap and label the pallet." It stays until Reset is pressed.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When the Lens starts, the pallet sits on the floor about 1 m ahead at real size, the pick face about 1.4 m to the right shows the first 4 cases of the order, and the height-limit outline is at 180 cm.
2. Grabbing the case due now shows its ghost in the planned slot, turned to the layer's orientation, with the tag "Layer N · K of 30 · kg".
3. Dropping it within 15 cm of the ghost snaps it into place, the counter goes up, the pick-face queue moves up, and the next case glows.
4. Dropping a case on the pallet away from the ghost sends it back and shows the right red tip (overhang or gap) and counts a mistake; dropping it off the pallet sends it back with no mistake.
5. Finishing each of layers 1 to 4 shows the "turns 90°" note, and layers 2 and 4 are placed turned 90° compared with layers 1 and 3 (joints offset).
6. After all 30 cases, the completion card shows 30 cases, 5 layers, about 157 cm, time and mistakes, and Reset clears the pallet and restarts the order.

## Out of scope
- Barcode scanning or recognizing real cases or a real pallet. The order is fixed.
- Choosing the order (the warehouse system does that) or random orders and difficulty levels.
- Mixed-height layers and free-form packing: each layer in this order is one case height, so the plan is a centred grid per layer.
- Real physics stacking, crushing or toppling simulation. Placement is snap-to-slot.
- Saving scores or progress between sessions.
- Wrapping and labelling the pallet (only a reminder on the completion card).
- Two-hand carrying gestures. One-hand grab carries the demo.

## Risks and open questions
- **These answers were drafted by Claude, not written by the learner.** The learner reviewed them on 2026-11-08, corrected the premise (orders are 100+ cases and arrive weight-sequenced), asked for a generic floor example, and delegated the remaining choices. The order above is still a default.
- **30 cases is a lot to place with a mouse in a demo video.** The video can speed up the middle layers; the logic is the same for every case.
- **Shelf to the right is outside the narrow view** (about 32° wide) while looking at the pallet, so every pick means turning. The chime and arrow cover this.
- **Looking steeply down** at a floor pallet early on, and the top layer at about 157 cm later: tag readability at both heights should be checked in the preview. Logic proven, feel unproven.
- **Reset button between the user and the pallet** could be pressed by accident while placing near-side cases. Check in the preview.
- **Feel unproven:** carrying real cases with real hand tracking, case weight, and comfort over a full order can only be judged on real glasses.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
