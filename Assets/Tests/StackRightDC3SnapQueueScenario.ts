// DC3: dropping on the ghost snaps the case into its slot with the planned rotation, updates the
// counter, and the queue moves up (cases slide to their new home slots). Full 30-case run.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PLAN} from "../Scripts/StackRightPickList"
import {getController, freshPallet, dropOnSlot, settle, angleDeg, queueShowsNextFour, onlyDueCaseInteractable} from "./StackRightLeafHelpers"

@component
export class StackRightDC3SnapQueueScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    // First case: dropped 10 cm off the slot still snaps square.
    const placedBefore = c.getPlacedCount()
    c.simulateGrab(0)
    c.simulateRelease(0, c.getSlotWorldPosition(0).add(new vec3(10, 3, 0)))
    expect(c.getPlacedCount()).toBe(placedBefore + 1)
    expect(c.getCaseWorldPosition(0).distance(c.getSlotWorldPosition(0)) < 0.5).toBe(true)
    expect(angleDeg(c.getCaseWorldRotation(0), c.getSlotWorldRotation(0)) < 1).toBe(true)
    expect(c.getCounterText()).toBe("Layer 1 · 1 / 30")
    expect(c.isGhostVisible()).toBe(false)

    // Queue shift: case 1 slides from slot 1 to the front slot, case 4 enters at the back.
    expect(queueShowsNextFour(c)).toBe(true)
    expect(c.isCaseReturning(1)).toBe(true)
    await settle(c)
    expect(c.getCaseWorldPosition(1).distance(c.getQueueSlotWorldPosition(0, 1)) < 1).toBe(true)
    expect(c.getCaseWorldPosition(4).distance(c.getQueueSlotWorldPosition(3, 4)) < 1).toBe(true)
    expect(c.isCaseShown(5)).toBe(false)
    expect(onlyDueCaseInteractable(c)).toBe(true)
    expect(c.isCaseGlowing(1)).toBe(true)

    // Remaining 29 cases, each checked for snap, rotation, counter and queue.
    for (let i = 1; i < 30; i++) {
      dropOnSlot(c, i)
      expect(c.isCasePlaced(i)).toBe(true)
      expect(c.getCaseWorldPosition(i).distance(c.getSlotWorldPosition(i)) < 0.5).toBe(true)
      expect(angleDeg(c.getCaseWorldRotation(i), c.getSlotWorldRotation(i)) < 1).toBe(true)
      const layerShown = PLAN[Math.min(i + 1, 29)].layer
      expect(c.getCounterText()).toBe("Layer " + layerShown + " · " + (i + 1) + " / 30")
      expect(queueShowsNextFour(c)).toBe(true)
      await sleep(30)
    }
    expect(c.isComplete()).toBe(true)
  }
}
