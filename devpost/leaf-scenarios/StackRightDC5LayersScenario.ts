// DC5: after layers 1-4 a white two-line note specific to that layer shows (layer 2's says the next
// layer turns 90 degrees); layers 3 and 4 are placed turned 90 degrees, layers 1, 2 and 5 are not.
// The generated plan has no overlaps, stays on the pallet, finishes every layer level, mixes
// footprints on layers 3 and 5, and every layer's joints cross the layer below.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  PLAN, ORDER, isLastOfLayer, layerDoneText, planOverlaps, planOutsidePallet, isLayerLevel, layerFootprintCount, alignedJoints,
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
      await sleep(20)
    }
    // No "turns 90" note after the last layer: the completion card shows instead.
    expect(c.getTipKind() === "layer" && c.isTipVisible()).toBe(false)

    // Notes are per layer and two lines.
    expect(layerDoneText(2)).toBe("Layer 2 done.\nNext layer turns 90° so the joints cross.")
    expect(layerDoneText(3)).toBe("Layer 3 done.\nFlat trays next: keep the top level.")
    expect(layerDoneText(1) !== layerDoneText(4)).toBe(true)

    // Orientation: layers 3 and 4 turned 90 degrees, layers 1, 2 and 5 not.
    expect(c.isSlotTurned(0)).toBe(false)
    expect(c.isSlotTurned(6)).toBe(false)
    expect(c.isSlotTurned(12)).toBe(true)
    expect(c.isSlotTurned(16)).toBe(true)
    expect(c.isSlotTurned(20)).toBe(true)
    expect(c.isSlotTurned(26)).toBe(false)
    expect(angleDeg(c.getCaseWorldRotation(0), c.getCaseWorldRotation(6)) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(6), c.getCaseWorldRotation(12)) - 90) < 1).toBe(true)
    expect(angleDeg(c.getCaseWorldRotation(12), c.getCaseWorldRotation(20)) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(20), c.getCaseWorldRotation(26)) - 90) < 1).toBe(true)

    // The generated plan.
    expect(planOverlaps().length).toBe(0)
    expect(planOutsidePallet().length).toBe(0)
    for (let l = 1; l <= 5; l++) expect(isLayerLevel(l)).toBe(true)
    expect(layerFootprintCount(3) > 1).toBe(true)
    expect(layerFootprintCount(5) > 1).toBe(true)
    for (let l = 2; l <= 5; l++) expect(alignedJoints(l).length).toBe(0)
  }
}
