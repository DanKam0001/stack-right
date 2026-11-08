# plan-lens interview answers (written in advance)

Drafted by Claude on the learner's behalf on 2026-10-29, while the learner was at work, from the plan agreed in chat.
The learner reviews and edits these, and the brief they produce, before approving it.

## 1. The idea
A pallet-building trainer for new warehouse pickers. I work in a supermarket distribution warehouse. The hardest
thing in your first weeks is building a mixed pallet that won't crush or topple: heavy, solid cartons at the bottom,
crushables like chips and eggs on top, every layer square to the pallet edges. Mostly you learn it on the job, from
mistakes. Working name: **Stack Right**. A common one on the floor: eighty cases into a hundred-case order, the
pallet starts to lean because an early layer went down with gaps, and every layer above it makes it worse. You
either strip it back and restack, or it leaves the dock leaning and something gets crushed in the truck.

## 2. The spatial moment
I'm standing next to an empty pallet on the floor, holding a carton I just grabbed from the shelf bay. A glowing
ghost of that carton sits on the pallet, at real size, exactly where it should go, with a small tag on its face:
"Layer 1 · Heavy · 14 kg". I drop it on the ghost, it snaps square, and the next ghost appears. Uses: draws in the world
(the guide sits on the pallet at real size) and leaves your body free (eyes on the pallet, hands on the boxes; no
clipboard or scanner screen to read).

## 3. Product or overlay
For the hackathon it's a **product**: a training simulator. The virtual pallet, shelf bay and cartons are the experience,
so a new picker can practise before touching real stock. The real-warehouse version would scan the carton's barcode; the
preview stand-in is a fixed pick list of 8 cartons in a set order, which the Lens already knows.

## 4. Where things live
- I'm looking down at the pallet most of the time, and sometimes to my right at the shelf bay.
- Pallet: on the floor about 1 m in front of me, Australian standard size 116.5 x 116.5 cm, 15 cm tall.
- Shelf bay: about 2 m away, to my right, with two shelves at 40 cm and 100 cm high holding the 8 cartons.
- Cartons: real sizes, roughly 30 to 60 cm per side; heavy ones (drinks, tins) are bigger and darker-labelled, and
  crushables (chips, eggs, bread) are lighter and marked with a fragile icon.
- Ghost carton: on the pallet where the current carton goes, same size, glowing outline, light colour.
- Tag on the ghost: a small label on the ghost's side facing me, readable from 1 m.
- Progress: a small "3 / 8" counter on the near edge of the pallet, not floating in my face.

## 5. Hands
- Grab a carton from the shelf and drag it over to the pallet (standard grab, works with the mouse).
- Let go within about 15 cm of the ghost and it snaps square into place.
- One big "Reset pallet" button on the pallet's near corner, about 12 cm wide, at roughly 90 cm height on a short post.
- No voice.

## 6. When it shows
- Only the next ghost is shown, never the whole plan at once.
- The tag shows when I pick up a carton and hides when it's placed.
- If I drop the wrong carton (a crushable when a heavy one is due) or drop it on the wrong spot, the carton slides back
  to the shelf and a short red tip shows on the pallet for 4 seconds: "Chips go on top. Heavy first."
- If the next carton is out of view, play a short chime and show a small arrow on the pallet edge pointing toward it.
- When the pallet is done: a completion card on the pallet shows time taken and mistakes, plus a "Wrap and label" reminder.

## 7. Done
1. When the Lens starts, the pallet sits on the floor about 1 m ahead at real size, and the shelf bay with 8 cartons is
   about 2 m to the right.
2. Grabbing the correct next carton shows its ghost on the pallet with the tag "Layer N · Heavy/Light · kg".
3. Dropping it within 15 cm of the ghost snaps it into place, the counter goes up, and the next ghost appears.
4. Dropping a crushable carton when a heavy one is due sends it back to the shelf and shows the red tip.
5. After all 8 cartons, the completion card appears on the pallet with time and mistakes, and Reset clears the pallet.

## People and consent
Nobody else is involved. It's my own practice space.
