// Reachability: a standing user can physically pinch the Reset button (IK arm + head).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {getController, freshPallet, dropOnSlot, findResetButton} from "./StackRightLeafHelpers"

@component
export class StackRightResetReachIKScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)
    dropOnSlot(c, 0)
    expect(c.getPlacedCount()).toBe(1)

    await this.ik.trigger(findResetButton())
    await sleep(400)
    expect(c.getPlacedCount()).toBe(0)
  }
}
