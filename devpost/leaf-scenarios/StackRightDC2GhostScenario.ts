// DC2: grabbing the correct next carton shows its ghost on the pallet with the tag
// "Layer N · Heavy/Light · kg". A wrong carton shows no ghost.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getController, freshPallet, settle} from "./StackRightLeafHelpers"

@component
export class StackRightDC2GhostScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    expect(c.isGhostVisible()).toBe(false)
    expect(c.isCartonGlowing(0)).toBe(true)

    // Wrong carton grabbed: no ghost. Put it back off the pallet (no mistake).
    c.simulateGrab(3)
    await sleep(200)
    expect(c.isGhostVisible()).toBe(false)
    c.simulateRelease(3, c.getCartonHomePosition(3))
    await settle(c)

    // Correct carton grabbed: ghost on its slot, tag text.
    c.simulateGrab(0)
    await sleep(200)
    expect(c.isGhostVisible()).toBe(true)
    expect(c.isGhostTagVisible()).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 1 · Heavy · 14 kg")
    const g = c.getGhostWorldPosition()
    expect(g.distance(c.getSlotWorldPosition(0)) < 1).toBe(true)
    const p = c.getPalletWorldPosition()
    expect(Math.abs(g.x - p.x) <= 58.25).toBe(true)
    expect(Math.abs(g.z - p.z) <= 58.25).toBe(true)

    // Releasing off the pallet hides the ghost and costs no mistake.
    const before = c.getMistakes()
    c.simulateRelease(0, c.getCartonHomePosition(0))
    await settle(c)
    expect(c.isGhostVisible()).toBe(false)
    expect(c.getMistakes()).toBe(before)
  }
}
