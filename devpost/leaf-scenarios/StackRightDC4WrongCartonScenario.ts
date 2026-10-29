// DC4: dropping a crushable carton when a heavy one is due sends it back to the shelf and
// shows the red tip (for about 4 s).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getController, freshPallet, settle} from "./StackRightLeafHelpers"

@component
export class StackRightDC4WrongCartonScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    const CHIPS = 7
    const m = c.getMistakes()
    c.simulateGrab(CHIPS)
    await sleep(100)
    expect(c.isGhostVisible()).toBe(false)
    c.simulateRelease(CHIPS, c.getPalletWorldPosition().add(new vec3(0, 60, 0)))
    await sleep(200)

    expect(c.isCartonPlaced(CHIPS)).toBe(false)
    expect(c.getMistakes()).toBe(m + 1)
    expect(c.isTipVisible()).toBe(true)
    expect(c.getTipText()).toBe("Chips go on top. Heavy first.")
    expect(c.isCartonReturning(CHIPS)).toBe(true)
    await settle(c)
    expect(c.getCartonWorldPosition(CHIPS).distance(c.getCartonHomePosition(CHIPS)) < 1).toBe(true)
    expect(c.getPlacedCount()).toBe(0)

    // Wrong heavy carton: "Not this one yet" tip.
    c.simulateGrab(4)
    c.simulateRelease(4, c.getPalletWorldPosition().add(new vec3(0, 60, 0)))
    await sleep(200)
    expect(c.getMistakes()).toBe(m + 2)
    expect(c.getTipText()).toBe("Not this one yet. Follow the arrow.")
    await settle(c)

    // Tip hides after about 4 s.
    await sleep(4500)
    expect(c.isTipVisible()).toBe(false)
  }
}
