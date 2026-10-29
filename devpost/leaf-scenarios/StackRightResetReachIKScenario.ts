// Reachability: a standing user can physically pinch the Reset button (IK arm + head).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {getController, dropOnSlot, resetButtonFaceName} from "./StackRightLeafHelpers"

@component
export class StackRightResetReachIKScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    c.reset()
    dropOnSlot(c, 0)
    expect(c.getPlacedCount()).toBe(1)

    const resetRoot = findSceneObjectByName("ResetButton")
    const btn = findInteractablesByName(resetButtonFaceName(), undefined, true)
      .filter((b) => b.getSceneObject().getParent() === resetRoot)[0]
    if (!btn) throw new Error("Reset button interactable not found")
    await this.ik.trigger(btn)
    await sleep(400)
    expect(c.getPlacedCount()).toBe(0)
  }
}
