// DC4: a drop on the pallet but not on the ghost slides back, counts a mistake and shows a red tip:
// overhang (> 2 cm over the edge in the planned orientation) or gap. Off the pallet: back, no mistake.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {TIP_GAP, TIP_OVERHANG} from "../Scripts/StackRightController"
import {getController, freshPallet, dropOnSlot, dropAt, settle} from "./StackRightLeafHelpers"

@component
export class StackRightDC4MistakesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)
    dropOnSlot(c, 0)
    await settle(c)

    // Gap: on the pallet, inside the edge, not on the ghost.
    let m = c.getMistakes()
    dropAt(c, 1, 0, 45, 10)
    expect(c.isCasePlaced(1)).toBe(false)
    expect(c.isCaseReturning(1)).toBe(true)
    expect(c.getMistakes()).toBe(m + 1)
    expect(c.isTipVisible()).toBe(true)
    expect(c.getTipText()).toBe(TIP_GAP)
    await settle(c)
    expect(c.getCaseWorldPosition(1).distance(c.getCaseHomePosition(1)) < 1).toBe(true)

    // Overhang: 55 x 37 sack centred at x 48 hangs 48 + 27.5 - 58.25 = 17.25 cm over the right edge.
    m = c.getMistakes()
    dropAt(c, 1, 48, 45, -29)
    expect(c.isCasePlaced(1)).toBe(false)
    expect(c.getMistakes()).toBe(m + 1)
    expect(c.getTipText()).toBe(TIP_OVERHANG)
    await settle(c)

    // Within the 2 cm tolerance (31.5 + 27.5 = 59: 0.75 cm over) counts as a gap, not an overhang.
    dropAt(c, 1, 31.5, 45, 10)
    expect(c.getTipText()).toBe(TIP_GAP)
    await settle(c)

    // Off the pallet: slides back, no mistake.
    m = c.getMistakes()
    dropAt(c, 1, 0, 30, 90)
    expect(c.isCaseReturning(1)).toBe(true)
    expect(c.getMistakes()).toBe(m)
    await settle(c)
    expect(c.getCaseWorldPosition(1).distance(c.getCaseHomePosition(1)) < 1).toBe(true)

    // Overhang is judged in the planned orientation: a turned layer-3 water case (58 wide turned,
    // 38 unturned) at x 35 hangs 35 + 29 - 58.25 = 5.75 cm over; unturned it would fit.
    for (let i = 1; i < 12; i++) dropOnSlot(c, i)
    await settle(c)
    m = c.getMistakes()
    dropAt(c, 12, 35, 80, 0)
    expect(c.getMistakes()).toBe(m + 1)
    expect(c.getTipText()).toBe(TIP_OVERHANG)
    await settle(c)

    // Tip hides after ~4 s.
    await sleep(4500)
    expect(c.isTipVisible()).toBe(false)
  }
}
