// DC2: grabbing the case due now shows a ghost of its size at its planned slot, with the tag
// "Layer N · K of 30 · kg". Layer 2 (case 7) shows a turned ghost; case 15 is on layer 3.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ORDER} from "../Scripts/StackRightPickList"
import {getController, freshPallet, dropOnSlot} from "./StackRightLeafHelpers"

@component
export class StackRightDC2GhostScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    // A case that is not due yet cannot be picked.
    c.simulateGrab(1)
    expect(c.isGhostVisible()).toBe(false)

    c.simulateGrab(0)
    expect(c.isGhostVisible()).toBe(true)
    expect(c.getGhostWorldPosition().distance(c.getSlotWorldPosition(0)) < 1).toBe(true)
    expect(c.getGhostSize().distance(ORDER[0].size) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 1 · 1 of 30 · 17 kg")
    c.simulateRelease(0, c.getSlotWorldPosition(0))

    for (let i = 1; i < 6; i++) dropOnSlot(c, i)
    await sleep(100)

    // Layer 2: turned 90 degrees, ghost has x and z swapped.
    c.simulateGrab(6)
    const s = ORDER[6].size
    expect(c.isSlotTurned(6)).toBe(true)
    expect(c.getGhostSize().distance(new vec3(s.z, s.y, s.x)) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 2 · 7 of 30 · 14 kg")
    c.simulateRelease(6, c.getSlotWorldPosition(6))

    for (let i = 7; i < 14; i++) dropOnSlot(c, i)
    await sleep(100)

    c.simulateGrab(14)
    expect(c.getGhostTagText()).toBe("Layer 3 · 15 of 30 · 10 kg")
    expect(c.isSlotTurned(14)).toBe(false)
    expect(c.getGhostSize().distance(ORDER[14].size) < 0.1).toBe(true)
  }
}
