// StackRightController.ts
// Stack Right: pallet-building trainer. Owns ALL game state (case due now, placed count,
// mistakes, timer, pick-face queue) and the rules: ghost on grab (turned on layers 2 and 4),
// snap within 15 cm with the planned rotation, dropped on the pallet but off the ghost ->
// slide back + red "overhang" / "gap" tip + mistake, released off the pallet -> slide back
// (no mistake), "layer done" note, completion card, reset, glow on the case due now,
// off-view arrow + chime, height-limit outline.
//
// Expects (@input): the authored Pallet, ShelfBay, PickList root (cases are created at runtime
// under it; any authored children are reused for the first ones), Ghost, OffViewArrow, ResetPost
// SceneObjects; the four StackRightLabelUI panels (GhostTag, Counter, TipText, CompletionCard);
// the StackRightResetButtonUI; the 1 cm box mesh and unlit base material used for every
// placeholder visual.
//
// Pick face: only the next QUEUE_SIZE not-yet-placed cases are shown, on the lower shelf, the one
// due now in the slot nearest the pallet. The rest are disabled until they enter the queue. Only
// the case due now is interactable.
//
// Real SIK grab/release events and the LEAF test hooks (simulateGrab / simulateRelease) run
// through the same handleGrab / handleRelease code path.
// Must not: build UI text itself (labels live in the *UI.ts modules), or plan slots (PickList does).
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {
  ORDER, PLAN, CaseSpec, PALLET_SIZE_CM, PALLET_DECK_Y, HEIGHT_LIMIT_CM, LAYER_COUNT, STACK_HEIGHT_CM,
  footprint, plannedSize, ghostTagText, layerDoneText, isLastOfLayer,
} from "./StackRightPickList"
import {BoxFactory} from "./StackRightGeometry"
import {StackRightLabelUI} from "./StackRightLabelUI"
import {StackRightResetButtonUI} from "./StackRightResetButtonUI"
import {StackRightCartonLabelUI} from "./StackRightCartonLabelUI"

const SFX_CHIME = requireAsset("../GeneratedSFX/StackRightChime.wav") as AudioTrackAsset
const SFX_SNAP = requireAsset("../GeneratedSFX/StackRightSnap.wav") as AudioTrackAsset
const SFX_MISTAKE = requireAsset("../GeneratedSFX/StackRightMistake.wav") as AudioTrackAsset
const SFX_COMPLETE = requireAsset("../GeneratedSFX/StackRightComplete.wav") as AudioTrackAsset

const CHIME_COOLDOWN_SEC = 6
const OFF_PALLET_MARGIN_CM = 5
/** A drop whose footprint hangs further than this over the pallet edge is an overhang. */
const OVERHANG_TOLERANCE_CM = 2
const QUEUE_SIZE = 4
/** Lower shelf of the bay (ShelfBay-local): top of the board, and the 4 queue slots along it. */
const SHELF_TOP_Y = 40
const QUEUE_FRONT_Z = 90 // slot nearest the pallet (and the user)
const QUEUE_PITCH_Z = -60 // each later queue slot is further along the shelf

// Two lines (break at the sentence) so the tip stays narrower than the pallet in view.
export const TIP_OVERHANG = "Overhang.\nKeep it inside the edge."
export const TIP_GAP = "That leaves a gap.\nDrop it on the ghost."

interface CaseState {
  index: number
  spec: CaseSpec
  so: SceneObject
  home: vec3
  placed: boolean
  grabbed: boolean
  returning: boolean
  returnFrom: vec3
  returnT: number
  hovered: boolean
  interactable: Interactable
  manip: InteractableManipulation
  bodyMat: Material
  bodyColor: vec4
  glow: SceneObject
  glowMat: Material
}

@component
export class StackRightController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightController – pallet-building trainer rules + test API</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Pallet root: on the floor, origin at the centre of its footprint")
  pallet: SceneObject
  @input
  @hint("Shelf bay root: on the floor to the user's right")
  shelfBay: SceneObject
  @input
  @hint("PickList (stand-in for barcode scan): cases are created under it at runtime, in order")
  pickList: SceneObject
  @input
  @hint("Ghost case root (child of Pallet)")
  ghost: SceneObject
  @input
  @hint("Arrow on the pallet edge that points at the case due now when it is out of view")
  offViewArrow: SceneObject
  @input
  @hint("Short post under the Reset button")
  resetPost: SceneObject
  @input
  @hint("Tag on the ghost: 'Layer N · K of 30 · kg'")
  ghostTag: StackRightLabelUI
  @input
  @hint("'Layer N · K / 30' counter on the pallet's near edge")
  counter: StackRightLabelUI
  @input
  @hint("Red tip (mistakes) / white note (layer done) shown on the pallet for a few seconds")
  tipText: StackRightLabelUI
  @input
  @hint("Completion card: cases, layers, height, time, mistakes, 'Wrap and label'")
  completionCard: StackRightLabelUI
  @input
  @hint("Reset pallet button")
  resetButton: StackRightResetButtonUI
  @input
  @hint("1 cm box mesh used for every placeholder visual")
  boxMesh: RenderMesh
  @input
  @hint("Unlit material cloned for every placeholder visual")
  baseMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Release within this horizontal distance (cm) of the ghost to snap")
  @widget(new SliderWidget(5, 40, 1))
  snapDistanceCm: number = 15

  @input
  @hint("Mouse-friendly allowance: how far ABOVE the ghost (cm) a release still snaps. Below, the limit is snapDistanceCm.")
  @widget(new SliderWidget(0, 120, 1))
  dropHeightAllowanceCm: number = 60

  @input
  @hint("How long the red tip / layer note stays on the pallet (s)")
  @widget(new SliderWidget(1, 10, 0.5))
  tipDurationSec: number = 4

  @input
  @hint("Place the floor this far below the user's eyes at start (cm). The work area root (this object's parent) is moved to camera.y - eyeHeightCm.")
  @widget(new SliderWidget(100, 200, 1))
  eyeHeightCm: number = 150

  @input("vec4", "{0.6,1,1,0.3}")
  @hint("Ghost fill colour (pale cyan, about 30% fill)")
  @widget(new ColorWidget())
  ghostColor: vec4 = new vec4(0.6, 1, 1, 0.3)

  @input("vec4", "{1,1,0.55,0.35}")
  @hint("Soft glow around the case due now on the pick face")
  @widget(new ColorWidget())
  glowColor: vec4 = new vec4(1, 1, 0.55, 0.35)

  @input("vec4", "{1,0.35,0.35,1}")
  @hint("Tip text colour (bright red, not dark)")
  @widget(new ColorWidget())
  tipColor: vec4 = new vec4(1, 0.35, 0.35, 1)

  @input("vec4", "{1,1,1,1}")
  @hint("Layer-done note text colour")
  @widget(new ColorWidget())
  noteColor: vec4 = new vec4(1, 1, 1, 1)

  @input("vec4", "{0.85,0.95,1,0.7}")
  @hint("Height-limit outline colour (thin, pale)")
  @widget(new ColorWidget())
  heightLimitColor: vec4 = new vec4(0.85, 0.95, 1, 0.7)
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Print grab/release decisions to the log")
  debugLogs: boolean = false
  @ui.group_end

  // ---- state (single owner) ----
  private cases: CaseState[] = []
  private nextIndex = 0
  private placedCount = 0
  private mistakes = 0
  private overhangMistakes = 0
  private gapMistakes = 0
  private complete = false
  private grabbedIndex = -1
  private startTime = -1
  private finishTime = -1
  private tipHideAt = -1
  private tipKind = "" // "" | "overhang" | "gap" | "layer"
  private ghostTagString = ""
  private tipString = ""
  private completionString = ""
  private arrowVisible = false
  private nextInView = true
  private lastChimeAt = -100
  private wasOutOfView = false

  private factory: BoxFactory
  private ghostFill: SceneObject
  private ghostWire: SceneObject
  private heightLimit: SceneObject
  private palletT: Transform
  private returnDuration = 0.6
  private audio: {[k: string]: AudioComponent} = {}
  private ready = false

  onAwake(): void {
    if (!this.validateRefs()) return
    this.factory = new BoxFactory(this.boxMesh, this.baseMaterial)
    this.palletT = this.pallet.getTransform()
    this.alignFloorToCamera()
    this.buildPalletVisual()
    this.buildShelfVisual()
    this.buildResetPostVisual()
    this.buildHeightLimit()
    this.buildGhost()
    this.buildArrow()
    this.buildCases()
    this.buildAudio()

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    for (const c of this.cases) {
      const i = c.index
      c.manip.onManipulationStart.add(() => this.handleGrab(i))
      c.manip.onManipulationEnd.add(() => this.handleRelease(i, c.so.getTransform().getWorldPosition()))
      c.interactable.onHoverEnter.add(() => this.setHover(i, true))
      c.interactable.onHoverExit.add(() => this.setHover(i, false))
    }
    this.resetButton.onReset.add(() => this.reset())
    this.ready = true
    this.reset()
    const cam = WorldCameraFinderProvider.getInstance()
    print("[StackRight] ready. " + this.cases.length + " cases, " + LAYER_COUNT + " layers, stack " + STACK_HEIGHT_CM +
      " cm. camera = " + cam.getTransform().getWorldPosition() + " pallet = " + this.getPalletWorldPosition() +
      " shelf = " + this.getShelfWorldPosition())
  }

  // =====================================================================================
  // Public API (used by the scene and by LEAF tests)
  // =====================================================================================
  getPlacedCount(): number { return this.placedCount }
  getMistakes(): number { return this.mistakes }
  getOverhangMistakes(): number { return this.overhangMistakes }
  getGapMistakes(): number { return this.gapMistakes }
  /** Index into the order of the case due now (30 when complete). */
  getNextIndex(): number { return this.nextIndex }
  isComplete(): boolean { return this.complete }
  isGhostVisible(): boolean { return this.ghost.enabled }
  getGhostTagText(): string { return this.ghostTag.isVisible() ? this.ghostTagString : "" }
  isGhostTagVisible(): boolean { return this.ghostTag.isVisible() }
  /** Ghost box size in Pallet axes (x across, z depth). */
  getGhostSize(): vec3 { return this.ghostFill.getTransform().getLocalScale() }
  getTipText(): string { return this.tipString }
  /** "overhang" | "gap" | "layer" | "" */
  getTipKind(): string { return this.tipKind }
  isTipVisible(): boolean { return this.tipText.isVisible() }
  isCompletionVisible(): boolean { return this.completionCard.isVisible() }
  getCompletionText(): string { return this.completionString }
  getCounterText(): string { return this.counter.getText() }
  isArrowVisible(): boolean { return this.arrowVisible }
  isNextCaseInView(): boolean { return this.nextInView }
  getCaseCount(): number { return this.cases.length }
  getCaseName(i: number): string { return this.cases[i] ? this.cases[i].so.name : "" }
  isCasePlaced(i: number): boolean { return !!this.cases[i] && this.cases[i].placed }
  isCaseReturning(i: number): boolean { return !!this.cases[i] && this.cases[i].returning }
  isCaseGlowing(i: number): boolean { return !!this.cases[i] && this.cases[i].glow.enabled }
  isCaseShown(i: number): boolean { return !!this.cases[i] && this.cases[i].so.enabled }
  isCaseInteractable(i: number): boolean { return !!this.cases[i] && this.cases[i].interactable.enabled }
  /** Queue position of case i on the pick face (0 = due now), or -1 if placed / not in the queue. */
  getQueuePosition(i: number): number {
    if (!this.cases[i] || this.cases[i].placed) return -1
    const q = i - this.nextIndex
    return q >= 0 && q < QUEUE_SIZE ? q : -1
  }
  getQueueSize(): number { return QUEUE_SIZE }
  getQueueSlotWorldPosition(q: number, i: number): vec3 { return this.queueHome(q, this.cases[i].spec) }
  getGrabbedIndex(): number { return this.grabbedIndex }
  getGhostWorldPosition(): vec3 { return this.ghost.getTransform().getWorldPosition() }
  /** Where case i snaps to on the pallet (centre of the case). */
  getSlotWorldPosition(i: number): vec3 { return this.palletT.getWorldTransform().multiplyPoint(PLAN[i].center) }
  getSlotWorldRotation(i: number): quat { return this.plannedRotation(i) }
  isSlotTurned(i: number): boolean { return PLAN[i].turned }
  getSlotLayer(i: number): number { return PLAN[i].layer }
  getCaseWorldPosition(i: number): vec3 { return this.cases[i].so.getTransform().getWorldPosition() }
  getCaseWorldRotation(i: number): quat { return this.cases[i].so.getTransform().getWorldRotation() }
  getCaseHomePosition(i: number): vec3 { return this.cases[i].home }
  getPalletWorldPosition(): vec3 { return this.palletT.getWorldPosition() }
  getPalletWorldTransform(): mat4 { return this.palletT.getWorldTransform() }
  getShelfWorldPosition(): vec3 { return this.shelfBay.getTransform().getWorldPosition() }
  getCameraWorldPosition(): vec3 { return WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition() }
  /** Floor height (world y): the pallet root sits on the floor. */
  getFloorWorldY(): number { return this.palletT.getWorldPosition().y }
  getHeightLimitWorldY(): number { return this.heightLimit.getTransform().getWorldPosition().y }
  isHeightLimitVisible(): boolean { return this.heightLimit.enabled && this.heightLimit.isEnabledInHierarchy }
  /** Top of the placed stack above the floor (cm). */
  getStackTopCm(): number { return this.stackTop() }

  /** Test hook: same code path as a real SIK grab. */
  simulateGrab(caseIndex: number): void {
    this.handleGrab(caseIndex)
  }

  /** Test hook: moves the case to worldPos, then runs the same code path as a real SIK release. */
  simulateRelease(caseIndex: number, worldPos: vec3): void {
    const c = this.cases[caseIndex]
    if (!c) return
    if (!c.placed) c.so.getTransform().setWorldPosition(worldPos)
    this.handleRelease(caseIndex, worldPos)
  }

  /** Test hook: same path as pinching the Reset button. */
  pressReset(): void {
    this.resetButton.press()
  }

  /** Clears the pallet and restarts the order: the first 4 cases on the pick face. */
  reset(): void {
    for (const c of this.cases) {
      c.placed = false
      c.grabbed = false
      c.returning = false
      c.hovered = false
      c.so.getTransform().setWorldRotation(quat.quatIdentity())
      c.bodyMat.mainPass.baseColor = c.bodyColor
    }
    this.nextIndex = 0
    this.placedCount = 0
    this.mistakes = 0
    this.overhangMistakes = 0
    this.gapMistakes = 0
    this.complete = false
    this.grabbedIndex = -1
    this.startTime = -1
    this.finishTime = -1
    this.completionString = ""
    this.ghostTagString = ""
    this.hideTip()
    this.ghost.enabled = false
    this.ghostTag.setVisible(false)
    this.completionCard.setVisible(false)
    this.wasOutOfView = false
    this.layoutQueue(false)
    this.updateCounter()
    this.updateStackFollowers()
    this.log("reset")
  }

  // =====================================================================================
  // Rules
  // =====================================================================================
  private handleGrab(i: number): void {
    const c = this.cases[i]
    if (!c || c.placed || this.complete || i !== this.nextIndex) return
    c.grabbed = true
    c.returning = false
    this.grabbedIndex = i
    if (this.startTime < 0) this.startTime = getTime()
    this.showGhostFor(i)
    this.updateGlow()
    this.log("grab " + c.so.name + " (ghost shown, layer " + PLAN[i].layer + (PLAN[i].turned ? ", turned 90" : "") + ")")
  }

  private handleRelease(i: number, worldPos: vec3): void {
    const c = this.cases[i]
    if (!c || c.placed) return
    c.grabbed = false
    if (this.grabbedIndex === i) this.grabbedIndex = -1
    this.hideGhost()

    if (this.complete || i !== this.nextIndex) {
      this.sendHome(c)
      this.updateGlow()
      return
    }

    const local = this.palletT.getInvertedWorldTransform().multiplyPoint(worldPos)
    const halfPallet = PALLET_SIZE_CM.x / 2
    const reach = halfPallet + OFF_PALLET_MARGIN_CM
    const onPallet = Math.abs(local.x) <= reach && Math.abs(local.z) <= reach && local.y >= -20 && local.y <= 250

    const slot = PLAN[i].center
    const dx = local.x - slot.x
    const dz = local.z - slot.z
    const dy = local.y - slot.y
    const horiz = Math.sqrt(dx * dx + dz * dz)
    if (horiz <= this.snapDistanceCm && dy >= -this.snapDistanceCm && dy <= Math.max(this.snapDistanceCm, this.dropHeightAllowanceCm)) {
      this.place(c)
    } else if (onPallet) {
      // Would any part of the case (planned orientation, centred on the drop point) hang over the edge?
      const fp = footprint(c.spec, PLAN[i].turned)
      const over = Math.max(Math.abs(local.x) + fp.x / 2, Math.abs(local.z) + fp.y / 2) - halfPallet
      if (over > OVERHANG_TOLERANCE_CM) this.mistake(c, "overhang", TIP_OVERHANG)
      else this.mistake(c, "gap", TIP_GAP)
    } else {
      this.log("released " + c.so.name + " off the pallet: back to the pick face, no mistake")
      this.sendHome(c)
    }
    this.updateGlow()
  }

  private place(c: CaseState): void {
    const i = c.index
    const t = c.so.getTransform()
    t.setWorldPosition(this.getSlotWorldPosition(i))
    t.setWorldRotation(this.plannedRotation(i))
    c.placed = true
    c.returning = false
    c.bodyMat.mainPass.baseColor = c.bodyColor
    this.placedCount++
    this.nextIndex++
    this.play("snap")
    this.log("placed " + c.so.name + " -> " + this.placedCount + "/" + this.cases.length)
    if (this.nextIndex >= this.cases.length) {
      this.finish()
    } else if (isLastOfLayer(i)) {
      this.showTip("layer", layerDoneText(PLAN[i].layer), this.noteColor)
    }
    this.layoutQueue(true)
    this.updateCounter()
    this.updateStackFollowers()
  }

  private mistake(c: CaseState, kind: string, tip: string): void {
    this.mistakes++
    if (kind === "overhang") this.overhangMistakes++
    else if (kind === "gap") this.gapMistakes++
    this.showTip(kind, tip, this.tipColor)
    this.play("mistake")
    this.log("mistake #" + this.mistakes + " (" + c.so.name + "): " + tip.replace(/\n/g, " "))
    this.sendHome(c)
  }

  private showTip(kind: string, msg: string, color: vec4): void {
    this.tipKind = kind
    this.tipString = msg
    this.tipText.setText(msg)
    this.tipText.setTextColor(color)
    this.tipText.setVisible(true)
    this.tipHideAt = getTime() + this.tipDurationSec
  }

  private hideTip(): void {
    this.tipHideAt = -1
    this.tipKind = ""
    this.tipString = ""
    this.tipText.setVisible(false)
  }

  // " (2 overhang · 1 gap)" so the learner sees which rule they broke; empty when there were none.
  private mistakeBreakdown(): string {
    const parts: string[] = []
    if (this.overhangMistakes > 0) parts.push(this.overhangMistakes + " overhang")
    if (this.gapMistakes > 0) parts.push(this.gapMistakes + " gap")
    return parts.length > 0 ? " (" + parts.join(" · ") + ")" : ""
  }

  private finish(): void {
    this.complete = true
    this.finishTime = getTime()
    const secs = Math.max(0, Math.round(this.finishTime - (this.startTime < 0 ? this.finishTime : this.startTime)))
    const mm = Math.floor(secs / 60)
    const ss = secs % 60
    const time = mm + ":" + (ss < 10 ? "0" : "") + ss
    const height = Math.round(this.stackTop())
    this.completionString = "Pallet done! " + this.cases.length + " cases · " + LAYER_COUNT + " layers · " + height + " cm\n" +
      "Time " + time + " · Mistakes " + this.mistakes + this.mistakeBreakdown() + "\nWrap and label the pallet."
    this.completionCard.setText(this.completionString)
    // Above the 180 cm line, not across it, and larger so it reads from where the picker stands.
    const cardT = this.completionCard.sceneObject.getTransform()
    cardT.setLocalPosition(new vec3(0, Math.max(this.stackTop() + 24, HEIGHT_LIMIT_CM + 30), 20))
    cardT.setLocalScale(new vec3(1.5, 1.5, 1.5))
    this.completionCard.setVisible(true)
    this.hideTip()
    this.arrowVisible = false
    this.offViewArrow.enabled = false
    this.play("complete")
  }

  private sendHome(c: CaseState): void {
    c.returning = true
    c.returnT = 0
    c.returnFrom = c.so.getTransform().getWorldPosition()
  }

  private showGhostFor(i: number): void {
    const spec = this.cases[i].spec
    const slot = PLAN[i]
    const size = plannedSize(spec, slot.turned)
    this.ghost.getTransform().setLocalPosition(slot.center)
    this.ghostFill.getTransform().setLocalScale(size)
    BoxFactory.layoutWireBox(this.ghostWire, size.add(new vec3(0.6, 0.6, 0.6)), 0.8)
    this.ghost.enabled = true
    this.ghostTagString = ghostTagText(i)
    this.ghostTag.setText(this.ghostTagString)
    this.ghostTag.sceneObject.getTransform().setLocalPosition(
      new vec3(slot.center.x, slot.center.y + size.y / 2 + 7, slot.center.z + size.z / 2 + 3))
    this.ghostTag.setVisible(true)
  }

  private hideGhost(): void {
    this.ghost.enabled = false
    this.ghostTag.setVisible(false)
  }

  /** Pallet rotation, plus 90 degrees about up when the slot is turned. */
  private plannedRotation(i: number): quat {
    const r = this.palletT.getWorldRotation()
    return PLAN[i].turned ? r.multiply(quat.angleAxis(Math.PI / 2, vec3.up())) : r
  }

  private stackTop(): number {
    if (this.placedCount === 0) return PALLET_DECK_Y
    const k = this.placedCount - 1
    return PLAN[k].center.y + this.cases[k].spec.size.y / 2
  }

  /** World position of queue slot q (0 = due now, nearest the pallet) on the lower shelf. */
  private queueHome(q: number, spec: CaseSpec): vec3 {
    const local = new vec3(0, SHELF_TOP_Y + spec.size.y / 2, QUEUE_FRONT_Z + q * QUEUE_PITCH_Z)
    return this.shelfBay.getTransform().getWorldTransform().multiplyPoint(local)
  }

  /**
   * Shows the next QUEUE_SIZE not-yet-placed cases on the pick face and hides the rest.
   * animate = true: cases already on the shelf slide up to their new slot; a case entering the
   * queue appears at the back.
   */
  private layoutQueue(animate: boolean): void {
    for (const c of this.cases) {
      if (c.placed) {
        c.so.enabled = true
        continue
      }
      const q = c.index - this.nextIndex
      const inQueue = q >= 0 && q < QUEUE_SIZE
      const wasShown = c.so.enabled
      c.so.enabled = inQueue
      if (!inQueue) {
        c.returning = false
        continue
      }
      c.home = this.queueHome(q, c.spec)
      if (animate && wasShown) {
        if (!c.grabbed) this.sendHome(c)
      } else {
        c.returning = false
        c.so.getTransform().setWorldPosition(c.home)
        c.so.getTransform().setWorldRotation(quat.quatIdentity())
      }
    }
    this.updateInteractivity()
    this.updateGlow()
  }

  /** Only the case due now can be grabbed. */
  private updateInteractivity(): void {
    for (const c of this.cases) {
      const on = !this.complete && !c.placed && c.index === this.nextIndex
      c.interactable.enabled = on
      c.manip.enabled = on
      if (!on && c.hovered) this.setHover(c.index, false)
    }
  }

  private updateCounter(): void {
    const layer = PLAN[Math.min(this.nextIndex, PLAN.length - 1)].layer
    this.counter.setText("Layer " + layer + " · " + this.placedCount + " / " + this.cases.length)
  }

  /** Keeps the tip/note and the off-view arrow just above the current stack top. */
  private updateStackFollowers(): void {
    const top = this.stackTop()
    this.tipText.sceneObject.getTransform().setLocalPosition(new vec3(0, Math.max(75, top + 28), top > 50 ? 30 : 62))
    this.offViewArrow.getTransform().setLocalPosition(new vec3(35, top + 3, 52))
  }

  private updateGlow(): void {
    for (const c of this.cases) {
      c.glow.enabled = !this.complete && c.index === this.nextIndex && !c.grabbed && !c.placed
    }
  }

  private setHover(i: number, on: boolean): void {
    const c = this.cases[i]
    if (!c || c.placed) return
    c.hovered = on
    const k = on ? 0.4 : 0
    const col = c.bodyColor
    c.bodyMat.mainPass.baseColor = new vec4(col.x + (1 - col.x) * k, col.y + (1 - col.y) * k, col.z + (1 - col.z) * k, 1)
  }

  // =====================================================================================
  // Per-frame: slide-back / queue slide, tip timeout, glow pulse, off-view arrow + chime
  // =====================================================================================
  private onUpdate(): void {
    if (!this.ready) return
    const now = getTime()
    const dt = getDeltaTime()

    for (const c of this.cases) {
      if (!c.returning) continue
      c.returnT = Math.min(1, c.returnT + dt / this.returnDuration)
      const e = 1 - Math.pow(1 - c.returnT, 3)
      c.so.getTransform().setWorldPosition(vec3.lerp(c.returnFrom, c.home, e))
      if (c.returnT >= 1) {
        c.returning = false
        c.so.getTransform().setWorldRotation(quat.quatIdentity())
      }
    }

    if (this.tipHideAt > 0 && now >= this.tipHideAt) {
      this.hideTip()
    }

    const pulse = 0.65 + 0.35 * Math.sin(now * 3)
    for (const c of this.cases) {
      if (c.glow.enabled) {
        c.glowMat.mainPass.baseColor = new vec4(this.glowColor.x, this.glowColor.y, this.glowColor.z, this.glowColor.w * pulse)
      }
    }

    this.updateOffView(now)
  }

  private updateOffView(now: number): void {
    if (this.complete || this.nextIndex >= this.cases.length) {
      this.arrowVisible = false
      this.offViewArrow.enabled = false
      return
    }
    const next = this.cases[this.nextIndex]
    const target = next.so.getTransform().getWorldPosition()
    const cam = WorldCameraFinderProvider.getInstance()
    this.nextInView = cam.inFoV(target)
    const show = !this.nextInView && this.grabbedIndex < 0
    this.arrowVisible = show
    this.offViewArrow.enabled = show
    if (show) {
      const from = this.offViewArrow.getTransform().getWorldPosition()
      const dx = target.x - from.x
      const dz = target.z - from.z
      const yaw = Math.atan2(-dz, dx) // arrow geometry points along local +X
      this.offViewArrow.getTransform().setWorldRotation(quat.angleAxis(yaw, vec3.up()))
      if (!this.wasOutOfView && now - this.lastChimeAt >= CHIME_COOLDOWN_SEC) {
        this.lastChimeAt = now
        this.play("chime")
      }
    }
    this.wasOutOfView = show
  }

  // =====================================================================================
  // Build (placeholder visuals on authored roots)
  // =====================================================================================
  /** Puts the floor (work-area root) eyeHeightCm below the camera's current height. */
  private alignFloorToCamera(): void {
    const root = this.sceneObject.getParent()
    if (!root) return
    const cam = WorldCameraFinderProvider.getInstance()
    if (!cam) return
    const camY = cam.getTransform().getWorldPosition().y
    const t = root.getTransform()
    const p = t.getWorldPosition()
    t.setWorldPosition(new vec3(p.x, camY - this.eyeHeightCm, p.z))
    this.log("floor aligned: camera y = " + camY + ", floor y = " + (camY - this.eyeHeightCm))
  }

  private buildPalletVisual(): void {
    const v = global.scene.createSceneObject("PalletVisual")
    v.setParent(this.pallet)
    const wood = new vec4(1.0, 0.8, 0.5, 1)
    const woodLight = new vec4(1.0, 0.88, 0.65, 1)
    const S = PALLET_SIZE_CM.x
    // three bearers along z (bottom 11 cm)
    for (const x of [-S / 2 + 5, 0, S / 2 - 5]) {
      this.factory.makeBox(v, "Bearer", new vec3(10, 11, S), new vec3(x, 5.5, 0), wood)
    }
    // seven deck boards along x (top 4 cm), square to the edges
    const n = 7
    const bw = 13.5
    const gap = (S - n * bw) / (n - 1)
    for (let k = 0; k < n; k++) {
      const z = -S / 2 + bw / 2 + k * (bw + gap)
      this.factory.makeBox(v, "Deck", new vec3(S, 4, bw), new vec3(0, 13, z), woodLight)
    }
  }

  private buildShelfVisual(): void {
    const v = global.scene.createSceneObject("ShelfVisual")
    v.setParent(this.shelfBay)
    const post = new vec4(0.45, 0.65, 1.0, 1)
    const beam = new vec4(1.0, 0.62, 0.25, 1)
    const board = new vec4(0.85, 0.88, 0.95, 1)
    // 240 W (along z) x 60 D (along x); shelf tops at 40 and 100 cm
    for (const x of [-28, 28]) for (const z of [-118, 118]) {
      this.factory.makeBox(v, "Post", new vec3(4, 150, 4), new vec3(x, 75, z), post)
    }
    for (const top of [SHELF_TOP_Y, 100]) {
      this.factory.makeBox(v, "Board", new vec3(60, 3, 240), new vec3(0, top - 1.5, 0), board)
      this.factory.makeBox(v, "Beam", new vec3(3, 6, 240), new vec3(-31.5, top - 3, 0), beam)
    }
  }

  private buildResetPostVisual(): void {
    this.factory.makeBox(this.resetPost, "PostVisual", new vec3(4, 84, 4), new vec3(0, 42, 0), new vec4(0.75, 0.8, 0.9, 1))
  }

  /** Thin pale rectangle around the pallet footprint at HEIGHT_LIMIT_CM above the floor, plus a label. */
  private buildHeightLimit(): void {
    this.heightLimit = global.scene.createSceneObject("HeightLimit")
    this.heightLimit.setParent(this.pallet)
    this.heightLimit.getTransform().setLocalPosition(new vec3(0, HEIGHT_LIMIT_CM, 0))
    const S = PALLET_SIZE_CM.x
    const th = 0.8
    for (const sz of [-1, 1]) {
      this.factory.makeBox(this.heightLimit, "EdgeX", new vec3(S + th, th, th), new vec3(0, 0, sz * S / 2), this.heightLimitColor, true)
    }
    for (const sx of [-1, 1]) {
      this.factory.makeBox(this.heightLimit, "EdgeZ", new vec3(th, th, S + th), new vec3(sx * S / 2, 0, 0), this.heightLimitColor, true)
    }
    const label = global.scene.createSceneObject("HeightLimitLabel")
    label.setParent(this.heightLimit)
    // Front-right corner, so it never sits behind the centred completion card.
    label.getTransform().setLocalPosition(new vec3(S / 2, 3, S / 2))
    const t = label.createComponent("Component.Text") as Text
    t.text = "Height limit " + HEIGHT_LIMIT_CM + " cm"
    t.size = 110
    t.depthTest = true
    t.textFill.color = new vec4(this.heightLimitColor.x, this.heightLimitColor.y, this.heightLimitColor.z, 1)
    t.horizontalAlignment = HorizontalAlignment.Right
    t.verticalAlignment = VerticalAlignment.Bottom
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.layoutRect = Rect.create(-60, 0, 0, 4)
  }

  private buildGhost(): void {
    this.ghostFill = this.factory.makeBox(this.ghost, "GhostFill", new vec3(1, 1, 1), vec3.zero(), this.ghostColor, true).getSceneObject()
    this.ghostWire = this.factory.makeWireBox(this.ghost, "GhostOutline", new vec3(10, 10, 10), 0.8,
      new vec4(this.ghostColor.x, this.ghostColor.y, this.ghostColor.z, 0.95))
    this.ghost.enabled = false
  }

  private buildArrow(): void {
    const yellow = new vec4(1, 0.95, 0.3, 1)
    // flat arrow on the pallet edge, pointing along local +X
    this.factory.makeBox(this.offViewArrow, "Shaft", new vec3(16, 1.5, 4), new vec3(-4, 0, 0), yellow)
    const head1 = this.factory.makeBox(this.offViewArrow, "HeadA", new vec3(10, 1.5, 3.5), new vec3(5.5, 0, -2.7), yellow).getSceneObject()
    // each head bar leans in toward the tip (+X), so the pair forms a ">" rather than a fork
    head1.getTransform().setLocalRotation(quat.angleAxis(-0.7, vec3.up()))
    const head2 = this.factory.makeBox(this.offViewArrow, "HeadB", new vec3(10, 1.5, 3.5), new vec3(5.5, 0, 2.7), yellow).getSceneObject()
    head2.getTransform().setLocalRotation(quat.angleAxis(0.7, vec3.up()))
    this.offViewArrow.enabled = false
  }

  /** All cases of the order, under PickList: authored children are reused, the rest created. */
  private buildCases(): void {
    for (let i = 0; i < ORDER.length; i++) {
      const spec = ORDER[i]
      let so: SceneObject
      if (i < this.pickList.getChildrenCount()) {
        so = this.pickList.getChild(i)
      } else {
        so = global.scene.createSceneObject("Case")
        so.setParent(this.pickList)
      }
      so.name = "Case_" + (i < 10 ? "0" : "") + i + "_" + spec.key
      // Neighbouring cases in a layer alternate between two shades so the joints read clearly.
      const slot = PLAN[i]
      const k = (slot.row + slot.col) % 2 === 0 ? 0 : 0.3
      const bodyColor = new vec4(spec.color.x + (1 - spec.color.x) * k, spec.color.y + (1 - spec.color.y) * k,
        spec.color.z + (1 - spec.color.z) * k, 1)
      const body = this.factory.makeBox(so, "Body", spec.size, vec3.zero(), bodyColor)
      const glowRmv = this.factory.makeBox(so, "Glow", spec.size.add(new vec3(5, 5, 5)), vec3.zero(), this.glowColor, true)
      const labels = so.createComponent(StackRightCartonLabelUI.getTypeName()) as StackRightCartonLabelUI
      labels.setup(spec.name, spec.kg + " kg · " + (spec.fragile ? "FRAGILE" : "HEAVY"), spec.size)

      const col = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      const shape = Shape.createBoxShape()
      shape.size = spec.size
      col.shape = shape
      const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
      const manip = so.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
      manip.setCanRotate(false)
      manip.setCanScale(false)

      this.cases.push({
        index: i, spec, so,
        home: so.getTransform().getWorldPosition(),
        placed: false, grabbed: false, returning: false, returnFrom: vec3.zero(), returnT: 0, hovered: false,
        interactable, manip,
        bodyMat: body.mainMaterial,
        bodyColor,
        glow: glowRmv.getSceneObject(),
        glowMat: glowRmv.mainMaterial,
      })
    }
    for (let k = ORDER.length; k < this.pickList.getChildrenCount(); k++) this.pickList.getChild(k).enabled = false
  }

  private buildAudio(): void {
    const tracks: {[k: string]: AudioTrackAsset} = {chime: SFX_CHIME, snap: SFX_SNAP, mistake: SFX_MISTAKE, complete: SFX_COMPLETE}
    for (const k of Object.keys(tracks)) {
      const so = global.scene.createSceneObject("Sfx_" + k)
      so.setParent(this.sceneObject)
      const a = so.createComponent("Component.AudioComponent") as AudioComponent
      a.audioTrack = tracks[k]
      a.playbackMode = Audio.PlaybackMode.LowLatency
      a.volume = 0.8
      this.audio[k] = a
    }
  }

  private play(k: string): void {
    const a = this.audio[k]
    if (!a) return
    if (a.isPlaying()) a.stop(false)
    a.play(1)
  }

  private log(msg: string): void {
    if (this.debugLogs) print("[StackRight] " + msg)
  }

  private validateRefs(): boolean {
    const missing: string[] = []
    const refs: {[k: string]: any} = {
      pallet: this.pallet, shelfBay: this.shelfBay, pickList: this.pickList, ghost: this.ghost,
      offViewArrow: this.offViewArrow, resetPost: this.resetPost, ghostTag: this.ghostTag, counter: this.counter,
      tipText: this.tipText, completionCard: this.completionCard, resetButton: this.resetButton,
      boxMesh: this.boxMesh, baseMaterial: this.baseMaterial,
    }
    for (const k of Object.keys(refs)) if (isNull(refs[k])) missing.push(k)
    if (missing.length > 0) {
      print("[StackRight] ERROR: unwired @input(s): " + missing.join(", "))
      return false
    }
    return true
  }
}
