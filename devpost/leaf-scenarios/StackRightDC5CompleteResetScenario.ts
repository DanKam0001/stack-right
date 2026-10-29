// DC5: after all 8 cartons the completion card shows on the pallet with time and mistakes,
// and Reset (pinched through real SIK input) clears the pallet.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {getController, freshPallet, dropOnSlot, settle, resetButtonFaceName} from "./StackRightLeafHelpers"

@component
export class StackRightDC5CompleteResetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    // One deliberate mistake (eggs while heavy is due), then a clean build of all 8.
    c.simulateGrab(6)
    c.simulateRelease(6, c.getPalletWorldPosition().add(new vec3(0, 60, 0)))
    await settle(c)
    for (let i = 0; i < 8; i++) {
      dropOnSlot(c, i)
      await sleep(100)
      expect(c.isCartonPlaced(i)).toBe(true)
    }
    expect(c.isComplete()).toBe(true)
    expect(c.getCounterText()).toBe("8 / 8")
    expect(c.isCompletionVisible()).toBe(true)
    const card = c.getCompletionText()
    expect(card.includes("Time ")).toBe(true)
    expect(card.includes("Mistakes 1")).toBe(true)
    expect(card.includes("Wrap and label")).toBe(true)

    // Card stays up.
    await sleep(1000)
    expect(c.isCompletionVisible()).toBe(true)

    // Reset via the real UIKit button.
    const resetRoot = findSceneObjectByName("ResetButton")
    const btn = findInteractablesByName(resetButtonFaceName(), undefined, true)
      .filter((b) => b.getSceneObject().getParent() === resetRoot)[0]
    if (!btn) throw new Error("Reset button interactable not found")
    await new DefaultLeafInteractor().trigger(btn)
    await sleep(400)

    expect(c.isCompletionVisible()).toBe(false)
    expect(c.getPlacedCount()).toBe(0)
    expect(c.getMistakes()).toBe(0)
    expect(c.getCounterText()).toBe("0 / 8")
    for (let i = 0; i < 8; i++) {
      expect(c.isCartonPlaced(i)).toBe(false)
      expect(c.getCartonWorldPosition(i).distance(c.getCartonHomePosition(i)) < 1).toBe(true)
    }
    expect(c.isCartonGlowing(0)).toBe(true)
  }
}
