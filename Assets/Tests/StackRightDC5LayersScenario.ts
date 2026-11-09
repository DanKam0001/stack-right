// DC5: after layers 1-4 a white two-line note specific to that layer shows (layer 2's says the next
// layer turns 90 degrees); layer 3 and the layer-4 trays are placed turned 90 degrees, layers 1, 2,
// 5 and the layer-4 soup are not. Layer 4 is stepped: the soup fills the back half (a 26 cm step,
// step note, hidden by the next grab), the trays fill the front two high and the layer ends level.
// The generated plan has no overlaps, stays on the pallet, finishes every layer level, never steps
// more than 26 cm, carries every second-tier tray on a first-tier one, mixes footprints on layers
// 3 and 5, and every layer's joints cross the layer below.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  PLAN, ORDER, isLastOfLayer, layerDoneText, planOverlaps, planOutsidePallet, isLayerLevel, layerFootprintCount, alignedJoints,
  layerZones, layerTopCm, stepAfterCase, stepNoteText, unsupportedTierSlots, MAX_STEP_CM,
} from "../Scripts/StackRightPickList"
import {getController, freshPallet, dropOnSlot, angleDeg} from "./StackRightLeafHelpers"

@component
export class StackRightDC5LayersScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    for (let i = 0; i < ORDER.length; i++) {
      dropOnSlot(c, i)
      if (isLastOfLayer(i) && PLAN[i].layer < 5) {
        expect(c.isTipVisible()).toBe(true)
        expect(c.getTipKind()).toBe("layer")
        expect(c.getTipText()).toBe(layerDoneText(PLAN[i].layer))
      }
      if (i === 22) {
        // Last soup: the back stands 26 cm above the front and the step note is up.
        expect(c.isTipVisible()).toBe(true)
        expect(c.getTipKind()).toBe("step")
        expect(c.getTipText()).toBe(stepNoteText(22))
        expect(c.getTipText()).toBe("Not enough soup for a full layer: step at the back.\nThe trays fill the front, two high, back to level.")
        const back = c.getCaseWorldPosition(22).y + ORDER[22].size.y / 2 - c.getFloorWorldY()
        expect(Math.abs(back - layerTopCm(3) - 26) < 0.5).toBe(true)
      }
      if (i === 23) expect(c.isTipVisible()).toBe(false) // the next grab hid the step note
      expect(stepAfterCase(i) <= MAX_STEP_CM + 0.01).toBe(true)
      await sleep(20)
    }
    // No "turns 90" note after the last layer: the completion card shows instead.
    expect(c.getTipKind() === "layer" && c.isTipVisible()).toBe(false)

    // Notes are per layer and two lines.
    expect(layerDoneText(2)).toBe("Layer 2 done.\nNext layer turns 90° so the joints cross.")
    expect(layerDoneText(3)).toBe("Layer 3 done.\nHeavy soup next: back half first.")
    expect(layerDoneText(4)).toBe("Layer 4 done.\nThe front caught up: level again.")
    expect(layerDoneText(1) !== layerDoneText(4)).toBe(true)

    // Orientation: layer 3 and the layer-4 trays turned 90 degrees; layers 1, 2, 5 and the soup not.
    expect(c.isSlotTurned(0)).toBe(false)
    expect(c.isSlotTurned(6)).toBe(false)
    expect(c.isSlotTurned(12)).toBe(true)
    expect(c.isSlotTurned(16)).toBe(true)
    expect(c.isSlotTurned(20)).toBe(false)
    expect(c.isSlotTurned(23)).toBe(true)
    expect(c.isSlotTurned(29)).toBe(false)
    expect(angleDeg(c.getCaseWorldRotation(0), c.getCaseWorldRotation(6)) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(6), c.getCaseWorldRotation(12)) - 90) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(12), c.getCaseWorldRotation(20)) - 90) < 1).toBe(true)
    expect(angleDeg(c.getCaseWorldRotation(12), c.getCaseWorldRotation(23)) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(23), c.getCaseWorldRotation(29)) - 90) < 1).toBe(true)

    // The generated plan.
    expect(planOverlaps().length).toBe(0)
    expect(planOutsidePallet().length).toBe(0)
    for (let l = 1; l <= 5; l++) expect(isLayerLevel(l)).toBe(true)
    expect(layerFootprintCount(3) > 1).toBe(true)
    expect(layerFootprintCount(5) > 1).toBe(true)
    for (let l = 2; l <= 5; l++) expect(alignedJoints(l).length).toBe(0)

    // Layer 4: two zones (soup far, trays near), 26 cm step after the soup, second tier carried, level at 110 cm.
    expect(layerZones(4).join(",")).toBe("far,near")
    expect(Math.abs(stepAfterCase(22) - 26) < 0.01).toBe(true)
    expect(Math.abs(stepAfterCase(28)) < 0.01).toBe(true)
    expect(unsupportedTierSlots().length).toBe(0)
    expect(PLAN[26].tier).toBe(1)
    expect(Math.abs(layerTopCm(4) - 110) < 0.01).toBe(true)
  }
}
