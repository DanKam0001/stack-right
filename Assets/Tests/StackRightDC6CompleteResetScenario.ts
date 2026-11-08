// DC6: after case 31 the completion card shows cases, layers, height, time and mistakes and stays
// up; Reset (pinched through real SIK input) clears the pallet and restarts the order.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {STACK_HEIGHT_CM} from "../Scripts/StackRightPickList"
import {getController, freshPallet, dropOnSlot, dropAt, settle, findResetButton, queueShowsNextFour, onlyDueCaseInteractable} from "./StackRightLeafHelpers"

@component
export class StackRightDC6CompleteResetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    await freshPallet(c)

    // One deliberate gap mistake, then a clean build of all 31.
    dropOnSlot(c, 0)
    dropAt(c, 1, 0, 45, 10)
    await settle(c)
    for (let i = 1; i < 31; i++) {
      dropOnSlot(c, i)
      await sleep(20)
    }
    expect(c.isComplete()).toBe(true)
    expect(c.getCounterText()).toBe("Layer 5 · 31 / 31")
    expect(Math.abs(c.getStackTopCm() - STACK_HEIGHT_CM) < 0.5).toBe(true)
    expect(Math.round(STACK_HEIGHT_CM)).toBe(127)
    expect(c.getStackTopCm() < 180).toBe(true)
    expect(c.isCompletionVisible()).toBe(true)
    const card = c.getCompletionText()
    expect(card.indexOf("Pallet done! 31 cases · 5 layers · " + Math.round(STACK_HEIGHT_CM) + " cm\n") === 0).toBe(true)
    expect(/\nTime \d+:\d\d · Mistakes 1 \(1 gap\)\n/.test(card)).toBe(true)
    expect(card.indexOf("Wrap and label the pallet.") > 0).toBe(true)

    await sleep(1000)
    expect(c.isCompletionVisible()).toBe(true)

    // Reset via the real UIKit button.
    await new DefaultLeafInteractor().trigger(findResetButton())
    await sleep(400)
    expect(c.isCompletionVisible()).toBe(false)
    expect(c.getPlacedCount()).toBe(0)
    expect(c.getMistakes()).toBe(0)
    expect(c.getNextIndex()).toBe(0)
    expect(c.getCounterText()).toBe("Layer 1 · 0 / 31")
    for (let i = 0; i < 31; i++) expect(c.isCasePlaced(i)).toBe(false)
    expect(queueShowsNextFour(c)).toBe(true)
    expect(c.isCaseGlowing(0)).toBe(true)
    expect(onlyDueCaseInteractable(c)).toBe(true)
  }
}
