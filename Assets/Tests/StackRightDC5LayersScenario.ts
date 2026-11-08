// DC5: after layers 1-4 a white note says the next layer turns 90 degrees; layer 2 cases are placed
// turned 90 degrees against layer 1 (and the layers alternate after that).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PLAN, isLastOfLayer, layerDoneText} from "../Scripts/StackRightPickList"
import {getController, freshPallet, dropOnSlot, angleDeg} from "./StackRightLeafHelpers"

@component
export class StackRightDC5LayersScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    for (let i = 0; i < 30; i++) {
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

    // Layer 2 orientation: turned 90 degrees against layer 1, and back again on layer 3.
    expect(c.isSlotTurned(0)).toBe(false)
    expect(c.isSlotTurned(6)).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(0), c.getCaseWorldRotation(6)) - 90) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(6), c.getCaseWorldRotation(12)) - 90) < 1).toBe(true)
    expect(Math.abs(angleDeg(c.getCaseWorldRotation(12), c.getCaseWorldRotation(20)) - 90) < 1).toBe(true)
  }
}
