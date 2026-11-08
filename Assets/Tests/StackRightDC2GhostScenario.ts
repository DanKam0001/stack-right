// DC2: grabbing the case due now shows a ghost of its size at its planned slot, with the tag
// "Layer N · K of 31 · kg". Layer 2 (case 7) is not turned; layer 3 (water case 13, juice case 17)
// and layer 4 (tray case 21) show turned ghosts; the 112 cm paper towel (case 29) is not turned.
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
    expect(c.getGhostTagText()).toBe("Layer 1 · 1 of 31 · 20 kg")
    c.simulateRelease(0, c.getSlotWorldPosition(0))

    for (let i = 1; i < 6; i++) dropOnSlot(c, i)
    await sleep(100)

    // Layer 2: not turned, ghost = case size.
    c.simulateGrab(6)
    expect(c.isSlotTurned(6)).toBe(false)
    expect(c.getGhostSize().distance(ORDER[6].size) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 2 · 7 of 31 · 17 kg")
    c.simulateRelease(6, c.getSlotWorldPosition(6))

    for (let i = 7; i < 12; i++) dropOnSlot(c, i)
    await sleep(100)

    // Layer 3 (mixed, turned 90 degrees): ghost has x and z swapped, water then juice.
    const turned = (k: number): vec3 => new vec3(ORDER[k].size.z, ORDER[k].size.y, ORDER[k].size.x)
    c.simulateGrab(12)
    expect(c.isSlotTurned(12)).toBe(true)
    expect(c.getGhostSize().distance(turned(12)) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 3 · 13 of 31 · 14 kg")
    c.simulateRelease(12, c.getSlotWorldPosition(12))
    for (let i = 13; i < 16; i++) dropOnSlot(c, i)
    await sleep(100)
    c.simulateGrab(16)
    expect(c.isSlotTurned(16)).toBe(true)
    expect(c.getGhostSize().distance(turned(16)) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 3 · 17 of 31 · 12 kg")
    c.simulateRelease(16, c.getSlotWorldPosition(16))
    for (let i = 17; i < 20; i++) dropOnSlot(c, i)
    await sleep(100)

    // Layer 4 trays: turned as well, so their joints cross layer 3.
    c.simulateGrab(20)
    expect(c.isSlotTurned(20)).toBe(true)
    expect(c.getGhostSize().distance(turned(20)) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 4 · 21 of 31 · 10 kg")
    c.simulateRelease(20, c.getSlotWorldPosition(20))
    for (let i = 21; i < 28; i++) dropOnSlot(c, i)
    await sleep(100)

    // Layer 5: the 112 cm paper-towel carton, not turned.
    c.simulateGrab(28)
    expect(c.isSlotTurned(28)).toBe(false)
    expect(Math.abs(c.getGhostSize().x - 112) < 0.1).toBe(true)
    expect(c.getGhostTagText()).toBe("Layer 5 · 29 of 31 · 3 kg")
  }
}
