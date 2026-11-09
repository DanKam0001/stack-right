// DC1: pallet ~1 m ahead on the floor, shelf to the right with the next 4 cases on the lower
// shelf (case due now nearest the pallet), height-limit outline at 180 cm, counter at 0 / 34.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ORDER} from "../Scripts/StackRightPickList"
import {getController,freshPallet, queueShowsNextFour, onlyDueCaseInteractable} from "./StackRightLeafHelpers"

@component
export class StackRightDC1LayoutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    const cam = c.getCameraWorldPosition()
    const pallet = c.getPalletWorldPosition()
    const ahead = new vec2(pallet.x - cam.x, pallet.z - cam.z).length
    expect(ahead > 80 && ahead < 120).toBe(true)
    expect(Math.abs(pallet.x - cam.x) < 10).toBe(true)
    const drop = cam.y - c.getFloorWorldY()
    expect(drop >= 140 && drop <= 170).toBe(true)

    const shelf = c.getShelfWorldPosition()
    const right = shelf.x - cam.x
    expect(right >= 120 && right <= 160).toBe(true)

    expect(c.getCaseCount()).toBe(34)
    expect(queueShowsNextFour(c)).toBe(true)
    for (let i = 0; i < 4; i++) {
      // Bottom of each queued case on the lower shelf (40 cm).
      const bottom = c.getCaseWorldPosition(i).y - c.getFloorWorldY() - ORDER[i].size.y / 2
      expect(Math.abs(bottom - 40) < 1).toBe(true)
      // Front-aligned on the 120 cm deep board: pallet-facing side 2 cm behind the front edge (shelf x - 30).
      const front = c.getCaseWorldPosition(i).x - ORDER[i].size.x / 2 - shelf.x
      expect(Math.abs(front + 28) < 1).toBe(true)
      expect(front + ORDER[i].size.x <= 90).toBe(true)
    }
    // Case due now is the queued case closest to the pallet.
    const d0 = c.getCaseWorldPosition(0).distance(pallet)
    for (let i = 1; i < 4; i++) expect(c.getCaseWorldPosition(i).distance(pallet) > d0).toBe(true)

    expect(c.isHeightLimitVisible()).toBe(true)
    expect(Math.abs(c.getHeightLimitWorldY() - c.getFloorWorldY() - 180) < 0.5).toBe(true)
    expect(c.getCounterText()).toBe("Layer 1 · 0 / 34")
    expect(c.isCaseGlowing(0)).toBe(true)
    expect(onlyDueCaseInteractable(c)).toBe(true)
  }
}
