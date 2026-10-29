---
status: draft
---

# Design brief: Stack Right

<!-- Filled in by plan-lens from devpost/interview-answers.md (written in advance; the learner was not available live). Uses the learner's words. Values marked (default) were not chosen by the learner. -->

A pallet-building trainer for new warehouse pickers in a supermarket distribution warehouse. It teaches the thing new pickers usually learn from mistakes: build a mixed pallet that won't crush or topple, with heavy solid cartons at the bottom, crushables like chips and eggs on top, and every layer square to the pallet edges.

## The one spatial moment
I'm standing next to an empty pallet on the floor, holding a carton I just grabbed from the shelf bay. A glowing ghost of that carton sits on the pallet at real size, exactly where it should go, with a small tag on its face: "Layer 1 · Heavy · 14 kg". I drop it on the ghost, it snaps square, and the next ghost appears.

## Why it belongs on glasses
- Uses: draws in the world (the guide sits on the pallet at real size) and leaves your body free (eyes on the pallet, hands on the boxes).
- Why it's better than the phone or laptop version: there's no clipboard or scanner screen to read. The instruction is the carton's exact spot on the pallet, at real size, so you learn by placing, not by reading a diagram and translating it.

## Product or overlay
- Type: product. A training simulator: the virtual pallet, shelf bay and cartons are the experience, so a new picker can practise before touching real stock.
- What the real version would sense: the carton's barcode when it's picked up.
- Stand-in for the preview: a fixed pick list of 8 cartons in a set order, which the Lens already knows. No scanning or recognition. The Lens knows which carton was grabbed because it's a virtual carton.
- Pick list (default; the learner should replace this with real lines from their warehouse), heaviest first:
  1. Bottled water 24-pack, 14 kg, heavy
  2. Soft drink 24 cans, 9 kg, heavy
  3. Canned tomatoes 12-pack, 10 kg, heavy
  4. Laundry liquid 4 x 4 L, 17 kg, heavy
  5. Pasta 20 x 500 g, 10 kg, heavy
  6. Bread 10 loaves, 4 kg, light, fragile
  7. Eggs 15 dozen, 10 kg, light, fragile
  8. Chips 20 bags, 2 kg, light, fragile

## Where things live
- Where the user is looking during the main task: down at the pallet most of the time, sometimes to the right at the shelf bay.
- Pallet: on the floor about 1 m in front of the user, Australian standard 116.5 x 116.5 cm, 15 cm tall.
- Shelf bay: about 1.4 m away to the user's right (moved in from 2 m so carrying with the mouse isn't awkward in the preview; default), two shelves at 40 cm and 100 cm high holding the 8 cartons. About 240 cm wide, 60 cm deep, 4 cartons per shelf (default). Tall cartons go on the top shelf so nothing on the lower shelf reaches the upper one (default).
- Cartons: real sizes, roughly 30 to 60 cm per side. Heavy ones (drinks, tins) are bigger with bold, bright-coloured labels. Crushables (chips, eggs, bread) are smaller with a fragile icon. Labels use light, saturated colours, not dark ones (default; see Risks).
- Ghost carton: on the pallet where the current carton goes, same size as the carton, glowing outline in a light colour (default: pale cyan, about 30% fill).
- Slot plan: heavy cartons fill layer 1 square to the pallet edges, crushables go on layer 2 on top of them. CLAD lays out the exact slots so the 8 cartons fit inside the 116.5 cm footprint (default).
- Tag on the ghost: a small label on the ghost's side facing the user, readable from 1 m (default: text at least 4 cm tall, light text on a translucent panel).
- Progress: a small "3 / 8" counter on the near edge of the pallet, not floating in the user's face.
- Reset button: on the pallet's near corner, about 12 cm wide, at roughly 90 cm height on a short post.

## Hands and input
- Grab a carton from the shelf and drag it over to the pallet: a standard SIK grab, which works with the mouse.
- Let go within about 15 cm of the ghost and the carton snaps square into place. Placed cartons are locked in place, not left to physics, so the stack can't topple by accident (default).
- One big "Reset pallet" button (pinch) clears the pallet and puts all cartons back on the shelf.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Ghost: only the next ghost is shown, never the whole plan. It appears when the correct next carton is grabbed and hides when that carton is placed.
- Tag: shows when the user picks up a carton and hides when it's placed.
- Next carton on the shelf: gets a soft glow so the user knows which one to grab (default; see open questions).
- Wrong carton (for example a crushable when a heavy one is due) or the right carton dropped on the wrong spot on the pallet: the carton slides back to the shelf, and a short red tip shows on the pallet for 4 seconds, for example "Chips go on top. Heavy first." Each counts as one mistake. Red is a bright red, not dark (default).
- Carton released anywhere off the pallet (on the floor, in the air): it slides back to the shelf and does not count as a mistake (default).
- If the next carton is out of view: a short chime plays, and a small arrow on the pallet edge points toward it.
- When the pallet is done: a completion card on the pallet shows time taken and mistakes, plus a "Wrap and label" reminder. It stays until Reset is pressed.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When the Lens starts, the pallet sits on the floor about 1 m ahead at real size, and the shelf bay with 8 cartons is about 1.4 m to the right.
2. Grabbing the correct next carton shows its ghost on the pallet with the tag "Layer N · Heavy/Light · kg".
3. Dropping it within 15 cm of the ghost snaps it into place, the counter goes up, and the next ghost appears.
4. Dropping a crushable carton when a heavy one is due sends it back to the shelf and shows the red tip.
5. After all 8 cartons, the completion card appears on the pallet with time and mistakes, and Reset clears the pallet.

## Out of scope
- Barcode scanning or recognizing real cartons. The pick list is fixed.
- More than one pallet or pick list, random orders, or difficulty levels.
- Real physics stacking, crushing or toppling simulation. Placement is snap-to-slot.
- Saving scores or progress between sessions.
- Wrapping and labelling the pallet (only a reminder on the completion card).
- Two-hand carrying gestures. One-hand grab carries the demo.

## Risks and open questions
- **These answers were drafted by Claude, not written by the learner.** `interview-answers.md` says it was "drafted by Claude on the learner's behalf ... from the plan agreed in chat", and the "(Learner: add your own real example here.)" note is still unfilled. Before approving, the learner should read every line and confirm it matches what they want, especially the real example and the pick list (default above).
- **How does the user know which carton to grab first?** Done criterion 2 says the ghost appears when the correct carton is grabbed. Before that, nothing on the pallet says what's next. I added a soft glow on the next carton (default). An alternative is showing the ghost before the grab. The learner should pick one.
- **Dark labels on heavy cartons.** The answers say heavy cartons are "darker-labelled". The glasses display is additive, so dark colours look see-through. I'd have pushed back on this. The brief uses bold, bright labels instead (default). If the learner wants "heavy = dark", it may not read on glasses.
- **Shelf bay 2 m to the right.** It sits well outside the narrow view (about 32° wide) while the user looks at the pallet, so every pick means turning away. The chime and arrow cover this. In the preview, carrying a carton about 2 to 3 m from shelf to pallet with mouse grab may feel awkward. If it does, move the shelf closer (about 1.2 to 1.5 m, still to the right).
- **Looking steeply down.** A pallet on the floor 1 m away sits far below eye level, and the tag sits at floor height on the ghost's side. Readability from standing height should be checked in the preview: logic proven, feel unproven.
- **Lower shelf at 40 cm** means bending down to pick, like the real job. That's fine, but it's worth checking that those cartons are easy to reach with the mouse in the preview.
- **Wrong order among heavy cartons.** The order is fixed, so grabbing any carton that isn't next is a mistake, even one heavy carton in place of another. The tip text for that case isn't decided. Default: "Not this one yet. Follow the arrow."
- **Reset button between the user and the pallet** could be pressed by accident while placing cartons on the near side. Check this in the preview.
- **Feel unproven:** carrying real-size cartons with real hand tracking, holding a heavy carton's weight, and comfort over a full 8-carton build can only be judged on real glasses.

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
