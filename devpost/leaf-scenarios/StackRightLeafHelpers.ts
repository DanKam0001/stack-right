// Shared helpers for the Stack Right LEAF scenarios. Lives in Assets/Tests/.
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {StackRightController} from "../Scripts/StackRightController"

export function getController(): StackRightController {
  const so = findSceneObjectByName("StackRightController")
  if (!so) throw new Error("StackRightController scene object not found")
  const c = so.getComponent(StackRightController.getTypeName()) as StackRightController
  if (!c) throw new Error("StackRightController component not found")
  return c
}

/** Drops carton i a few cm above its slot (inside the 15 cm snap radius). */
export function dropOnSlot(c: StackRightController, i: number): void {
  c.simulateGrab(i)
  c.simulateRelease(i, c.getSlotWorldPosition(i).add(new vec3(0, 5, 0)))
}

/** Waits until every returning carton has slid back to the shelf. */
export async function settle(c: StackRightController): Promise<void> {
  for (let k = 0; k < 40; k++) {
    let busy = false
    for (let i = 0; i < c.getCartonCount(); i++) if (c.isCartonReturning(i)) busy = true
    if (!busy) return
    await sleep(100)
  }
}

export async function freshPallet(c: StackRightController): Promise<void> {
  c.reset()
  await sleep(300)
}

/** The Reset button's UIKit Button lives on a runtime child "ButtonFace" under "ResetButton". */
export function resetButtonFaceName(): string {
  return "ButtonFace"
}
