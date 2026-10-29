// DC1: at start the pallet is on the floor about 1 m ahead at real size, and the shelf bay
// with 8 cartons is about 1.4 m to the right.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getController, freshPallet} from "./StackRightLeafHelpers"

@component
export class StackRightDC1LayoutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)
    const cam = c.getCameraWorldPosition()
    const pallet = c.getPalletWorldPosition()
    const shelf = c.getShelfWorldPosition()

    // Pallet: ~100 cm ahead (-z), roughly centred, on the floor (140-170 cm below the eyes).
    const ahead = cam.z - pallet.z
    expect(ahead >= 80 && ahead <= 120).toBe(true)
    expect(Math.abs(pallet.x - cam.x) < 20).toBe(true)
    const drop = cam.y - pallet.y
    expect(drop >= 140 && drop <= 170).toBe(true)

    // Shelf bay: ~140 cm to the right (+x).
    const right = shelf.x - cam.x
    expect(right >= 120 && right <= 160).toBe(true)

    // 8 cartons on the shelf, none placed, all inside the shelf bay's footprint (60 D x 240 W).
    expect(c.getCartonCount()).toBe(8)
    for (let i = 0; i < 8; i++) {
      expect(c.isCartonPlaced(i)).toBe(false)
      const p = c.getCartonWorldPosition(i)
      expect(Math.abs(p.x - shelf.x) <= 30).toBe(true)
      expect(Math.abs(p.z - shelf.z) <= 120).toBe(true)
      expect(p.y > shelf.y + 35).toBe(true)
    }

    // Named scene objects exist; the stand-in pick list is obvious in the hierarchy.
    expect(findSceneObjectByName("Pallet") != null).toBe(true)
    expect(findSceneObjectByName("ShelfBay") != null).toBe(true)
    expect(findSceneObjectByName("PickList (stand-in for barcode scan)") != null).toBe(true)
    expect(c.getCounterText()).toBe("0 / 8")
  }
}
