// Shared helpers for the Stack Right LEAF scenarios. Lives in Assets/Tests/.
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {StackRightController} from "../Scripts/StackRightController"

export function getController(): StackRightController {
  const so = findSceneObjectByName("StackRightController")
  if (!so) throw new Error("StackRightController scene object not found")
  const c = so.getComponent(StackRightController.getTypeName()) as StackRightController
  if (!c) throw new Error("StackRightController component not found")
  return c
}

/** World point from Pallet-local cm (x right, y up from the floor, z toward the user). */
export function palletPoint(c: StackRightController, x: number, y: number, z: number): vec3 {
  return c.getPalletWorldTransform().multiplyPoint(new vec3(x, y, z))
}

/** Grabs case i and drops it a few cm above its slot (inside the 15 cm snap radius). */
export function dropOnSlot(c: StackRightController, i: number): void {
  c.simulateGrab(i)
  c.simulateRelease(i, c.getSlotWorldPosition(i).add(new vec3(0, 5, 0)))
}

/** Grabs case i and drops it at a Pallet-local point. */
export function dropAt(c: StackRightController, i: number, x: number, y: number, z: number): void {
  c.simulateGrab(i)
  c.simulateRelease(i, palletPoint(c, x, y, z))
}

/** Waits until no case is sliding (back home or up the queue). */
export async function settle(c: StackRightController): Promise<void> {
  for (let k = 0; k < 50; k++) {
    let busy = false
    for (let i = 0; i < c.getCaseCount(); i++) if (c.isCaseReturning(i)) busy = true
    if (!busy) return
    await sleep(100)
  }
}

export async function freshPallet(c: StackRightController): Promise<void> {
  c.reset()
  await sleep(300)
}

/** Angle in degrees between two rotations. */
export function angleDeg(a: quat, b: quat): number {
  const d = Math.min(1, Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z))
  return (2 * Math.acos(d) * 180) / Math.PI
}

/** True when exactly cases next..next+3 are shown on the shelf (plus the placed ones). */
export function queueShowsNextFour(c: StackRightController): boolean {
  const next = c.getNextIndex()
  for (let i = 0; i < c.getCaseCount(); i++) {
    const inQueue = i >= next && i < next + c.getQueueSize()
    if (c.isCaseShown(i) !== (inQueue || c.isCasePlaced(i))) return false
    if (inQueue && c.getQueuePosition(i) !== i - next) return false
  }
  return true
}

/** True when only the case due now is interactable. */
export function onlyDueCaseInteractable(c: StackRightController): boolean {
  const next = c.getNextIndex()
  for (let i = 0; i < c.getCaseCount(); i++) if (c.isCaseInteractable(i) !== (i === next)) return false
  return true
}

/** The Reset button's UIKit Button lives on a runtime child "ButtonFace" under "ResetButton". */
export function findResetButton(): Interactable {
  const resetRoot = findSceneObjectByName("ResetButton")
  const btn = findInteractablesByName("ButtonFace", undefined, true)
    .filter((b) => b.getSceneObject().getParent() === resetRoot)[0]
  if (!btn) throw new Error("Reset button interactable not found")
  return btn
}

/** The Interactable of case i (on its runtime scene object, e.g. Case_00_Laundry). */
export function findCaseInteractable(c: StackRightController, i: number): Interactable {
  const it = findInteractablesByName(c.getCaseName(i), undefined, true)[0]
  if (!it) throw new Error("Interactable for " + c.getCaseName(i) + " not found")
  return it
}
