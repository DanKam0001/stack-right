// DC3: dropping the carton within 15 cm of the ghost snaps it, the counter goes up, and the
// next ghost appears. A drop further than 15 cm (still on the pallet) does not snap.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getController, freshPallet, settle} from "./StackRightLeafHelpers"

@component
export class StackRightDC3SnapScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    // 12 cm off the slot horizontally: snaps square onto the slot.
    c.simulateGrab(0)
    await sleep(100)
    c.simulateRelease(0, c.getSlotWorldPosition(0).add(new vec3(12, 10, 0)))
    await sleep(200)
    expect(c.isCartonPlaced(0)).toBe(true)
    expect(c.getCartonWorldPosition(0).distance(c.getSlotWorldPosition(0)) < 0.5).toBe(true)
    expect(c.getPlacedCount()).toBe(1)
    expect(c.getCounterText()).toBe("1 / 8")
    expect(c.isGhostVisible()).toBe(false)
    expect(c.getNextIndex()).toBe(1)
    expect(c.isCartonGlowing(1)).toBe(true)

    // Next carton grabbed: the next ghost appears with its own tag.
    c.simulateGrab(1)
    await sleep(200)
    expect(c.isGhostVisible()).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 1 · Heavy · 9 kg")

    // 30 cm off its slot but still on the pallet: no snap, sent back, counted as a mistake.
    const m = c.getMistakes()
    c.simulateRelease(1, c.getSlotWorldPosition(1).add(new vec3(-30, 5, 0)))
    await sleep(200)
    expect(c.isCartonPlaced(1)).toBe(false)
    expect(c.getPlacedCount()).toBe(1)
    expect(c.getMistakes()).toBe(m + 1)
    expect(c.getTipText()).toBe("Wrong spot. Drop it on the ghost.")
    await settle(c)
    expect(c.getCartonWorldPosition(1).distance(c.getCartonHomePosition(1)) < 1).toBe(true)

    // Placed cartons are locked: grabbing carton 0 again changes nothing.
    c.simulateGrab(0)
    expect(c.getGrabbedIndex()).toBe(-1)
  }
}
