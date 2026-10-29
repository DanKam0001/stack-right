// StackRightController.ts
// Stack Right: pallet-building trainer. Owns ALL game state (next carton, placed count,
// mistakes, timer) and the rules: ghost on grab, snap within 15 cm, wrong carton / wrong spot
// -> slide back + red tip + mistake, released off the pallet -> slide back (no mistake),
// completion card, reset, next-carton glow, off-view arrow + chime.
//
// Expects (@input): the authored Pallet, ShelfBay, PickList root (8 Carton_i_* children in pick
// order), Ghost, OffViewArrow, ResetPost SceneObjects; the four StackRightLabelUI panels
// (GhostTag, Counter, TipText, CompletionCard); the StackRightResetButtonUI; the 1 cm box mesh
// and unlit base material used for every placeholder visual.
//
// Real SIK grab/release events and the LEAF test hooks (simulateGrab / simulateRelease) run
// through the same handleGrab / handleRelease code path.
// Must not: build UI text itself (labels live in the *UI.ts modules).
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {PICK_LIST, CartonSpec, PALLET_SIZE_CM, ghostTagText} from "./StackRightPickList"
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

export const TIP_WRONG_SPOT = "Wrong spot. Drop it on the ghost."
export const TIP_NOT_YET = "Not this one yet. Follow the arrow."

interface CartonState {
  index: number
  spec: CartonSpec
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
  @hint("PickList (stand-in for barcode scan): its 8 children are the cartons, in pick order")
  pickList: SceneObject
  @input
  @hint("Ghost carton root (child of Pallet)")
  ghost: SceneObject
  @input
  @hint("Arrow on the pallet edge that points at the next carton when it is out of view")
  offViewArrow: SceneObject
  @input
  @hint("Short post under the Reset button")
  resetPost: SceneObject
  @input
  @hint("Tag on the ghost: 'Layer N · Heavy · 14 kg'")
  ghostTag: StackRightLabelUI
  @input
  @hint("'3 / 8' counter on the pallet's near edge")
  counter: StackRightLabelUI
  @input
  @hint("Red tip shown on the pallet for a few seconds after a mistake")
  tipText: StackRightLabelUI
  @input
  @hint("Completion card: time, mistakes, 'Wrap and label'")
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
  @hint("How long the red tip stays on the pallet (s)")
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
  @hint("Soft glow around the next carton on the shelf")
  @widget(new ColorWidget())
  glowColor: vec4 = new vec4(1, 1, 0.55, 0.35)

  @input("vec4", "{1,0.35,0.35,1}")
  @hint("Tip text colour (bright red, not dark)")
  @widget(new ColorWidget())
  tipColor: vec4 = new vec4(1, 0.35, 0.35, 1)
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Print grab/release decisions to the log")
  debugLogs: boolean = false
  @ui.group_end

  // ---- state (single owner) ----
  private cartons: CartonState[] = []
  private nextIndex = 0
  private placedCount = 0
  private mistakes = 0
  private complete = false
  private grabbedIndex = -1
  private startTime = -1
  private finishTime = -1
  private tipHideAt = -1
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
    this.buildGhost()
    this.buildArrow()
    this.buildCartons()
    this.buildAudio()

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    for (const c of this.cartons) {
      const i = c.index
      c.manip.onManipulationStart.add(() => this.handleGrab(i))
      c.manip.onManipulationEnd.add(() => this.handleRelease(i, c.so.getTransform().getWorldPosition()))
      c.interactable.onHoverEnter.add(() => this.setHover(i, true))
      c.interactable.onHoverExit.add(() => this.setHover(i, false))
    }
    this.resetButton.onReset.add(() => this.reset())
    this.tipText.setTextColor(this.tipColor)
    this.ready = true
    this.reset()
    const cam = WorldCameraFinderProvider.getInstance()
    print("[StackRight] ready. camera world pos = " + cam.getTransform().getWorldPosition() +
      " pallet = " + this.getPalletWorldPosition() + " shelf = " + this.getShelfWorldPosition())
  }

  // =====================================================================================
  // Public API (used by the scene and by LEAF tests)
  // =====================================================================================
  getPlacedCount(): number { return this.placedCount }
  getMistakes(): number { return this.mistakes }
  /** Index into the pick list of the carton that is due next (8 when complete). */
  getNextIndex(): number { return this.nextIndex }
  isComplete(): boolean { return this.complete }
  isGhostVisible(): boolean { return this.ghost.enabled }
  getGhostTagText(): string { return this.ghostTag.isVisible() ? this.ghostTagString : "" }
  isGhostTagVisible(): boolean { return this.ghostTag.isVisible() }
  getTipText(): string { return this.tipString }
  isTipVisible(): boolean { return this.tipText.isVisible() }
  isCompletionVisible(): boolean { return this.completionCard.isVisible() }
  getCompletionText(): string { return this.completionString }
  getCounterText(): string { return this.counter.getText() }
  isArrowVisible(): boolean { return this.arrowVisible }
  isNextCartonInView(): boolean { return this.nextInView }
  getCartonCount(): number { return this.cartons.length }
  getCartonName(i: number): string { return this.cartons[i] ? this.cartons[i].so.name : "" }
  isCartonPlaced(i: number): boolean { return !!this.cartons[i] && this.cartons[i].placed }
  isCartonReturning(i: number): boolean { return !!this.cartons[i] && this.cartons[i].returning }
  isCartonGlowing(i: number): boolean { return !!this.cartons[i] && this.cartons[i].glow.enabled }
  getGrabbedIndex(): number { return this.grabbedIndex }
  getGhostWorldPosition(): vec3 { return this.ghost.getTransform().getWorldPosition() }
  /** Where carton i snaps to on the pallet (centre of the carton). */
  getSlotWorldPosition(i: number): vec3 { return this.palletT.getWorldTransform().multiplyPoint(this.slotCenterLocal(PICK_LIST[i])) }
  getCartonWorldPosition(i: number): vec3 { return this.cartons[i].so.getTransform().getWorldPosition() }
  getCartonHomePosition(i: number): vec3 { return this.cartons[i].home }
  getPalletWorldPosition(): vec3 { return this.palletT.getWorldPosition() }
  getShelfWorldPosition(): vec3 { return this.shelfBay.getTransform().getWorldPosition() }
  getCameraWorldPosition(): vec3 { return WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition() }

  /** Test hook: same code path as a real SIK grab. */
  simulateGrab(cartonIndex: number): void {
    this.handleGrab(cartonIndex)
  }

  /** Test hook: moves carton to worldPos, then runs the same code path as a real SIK release. */
  simulateRelease(cartonIndex: number, worldPos: vec3): void {
    const c = this.cartons[cartonIndex]
    if (!c) return
    if (!c.placed) c.so.getTransform().setWorldPosition(worldPos)
    this.handleRelease(cartonIndex, worldPos)
  }

  /** Test hook: same path as pinching the Reset button. */
  pressReset(): void {
    this.resetButton.press()
  }

  /** Clears the pallet and returns every carton to the shelf. */
  reset(): void {
    for (const c of this.cartons) {
      c.placed = false
      c.grabbed = false
      c.returning = false
      c.hovered = false
      c.so.getTransform().setWorldPosition(c.home)
      c.so.getTransform().setWorldRotation(quat.quatIdentity())
      c.interactable.enabled = true
      c.manip.enabled = true
      c.bodyMat.mainPass.baseColor = c.spec.color
    }
    this.nextIndex = 0
    this.placedCount = 0
    this.mistakes = 0
    this.complete = false
    this.grabbedIndex = -1
    this.startTime = -1
    this.finishTime = -1
    this.tipHideAt = -1
    this.tipString = ""
    this.completionString = ""
    this.ghostTagString = ""
    this.ghost.enabled = false
    this.ghostTag.setVisible(false)
    this.tipText.setVisible(false)
    this.completionCard.setVisible(false)
    this.wasOutOfView = false
    this.updateCounter()
    this.updateGlow()
    this.log("reset")
  }

  // =====================================================================================
  // Rules
  // =====================================================================================
  private handleGrab(i: number): void {
    const c = this.cartons[i]
    if (!c || c.placed || this.complete) return
    c.grabbed = true
    c.returning = false
    this.grabbedIndex = i
    if (this.startTime < 0) this.startTime = getTime()
    if (i === this.nextIndex) {
      this.showGhostFor(c.spec)
    } else {
      this.hideGhost()
    }
    this.updateGlow()
    this.log("grab " + c.so.name + (i === this.nextIndex ? " (correct, ghost shown)" : " (not next)"))
  }

  private handleRelease(i: number, worldPos: vec3): void {
    const c = this.cartons[i]
    if (!c || c.placed) return
    c.grabbed = false
    if (this.grabbedIndex === i) this.grabbedIndex = -1
    this.hideGhost()

    const local = this.palletT.getInvertedWorldTransform().multiplyPoint(worldPos)
    const half = PALLET_SIZE_CM.x / 2 + OFF_PALLET_MARGIN_CM
    const onPallet = Math.abs(local.x) <= half && Math.abs(local.z) <= half && local.y >= -20 && local.y <= 250

    if (this.complete) {
      this.sendHome(c)
      return
    }

    if (i === this.nextIndex) {
      const slot = this.slotCenterLocal(c.spec)
      const dx = local.x - slot.x
      const dz = local.z - slot.z
      const dy = local.y - slot.y
      const horiz = Math.sqrt(dx * dx + dz * dz)
      if (horiz <= this.snapDistanceCm && dy >= -this.snapDistanceCm && dy <= Math.max(this.snapDistanceCm, this.dropHeightAllowanceCm)) {
        this.place(c)
      } else if (onPallet) {
        this.mistake(c, TIP_WRONG_SPOT)
      } else {
        this.log("released " + c.so.name + " off the pallet: back to shelf, no mistake")
        this.sendHome(c)
      }
    } else {
      if (onPallet) {
        const due = PICK_LIST[this.nextIndex]
        const tip = !c.spec.heavy && due.heavy
          ? c.spec.tipName + " " + c.spec.tipVerb + " on top. Heavy first."
          : TIP_NOT_YET
        this.mistake(c, tip)
      } else {
        this.log("released " + c.so.name + " off the pallet: back to shelf, no mistake")
        this.sendHome(c)
      }
    }
    this.updateGlow()
  }

  private place(c: CartonState): void {
    const t = c.so.getTransform()
    t.setWorldPosition(this.palletT.getWorldTransform().multiplyPoint(this.slotCenterLocal(c.spec)))
    t.setWorldRotation(this.palletT.getWorldRotation())
    c.placed = true
    c.returning = false
    c.manip.enabled = false
    c.interactable.enabled = false
    c.bodyMat.mainPass.baseColor = c.spec.color
    this.placedCount++
    this.nextIndex++
    this.play("snap")
    this.log("placed " + c.so.name + " -> " + this.placedCount + "/" + this.cartons.length)
    if (this.nextIndex >= this.cartons.length) this.finish()
    this.updateCounter()
    this.updateGlow()
  }

  private mistake(c: CartonState, tip: string): void {
    this.mistakes++
    this.tipString = tip
    this.tipText.setText(tip)
    this.tipText.setVisible(true)
    this.tipHideAt = getTime() + this.tipDurationSec
    this.play("mistake")
    this.log("mistake #" + this.mistakes + " (" + c.so.name + "): " + tip)
    this.sendHome(c)
  }

  private finish(): void {
    this.complete = true
    this.finishTime = getTime()
    const secs = Math.max(0, Math.round(this.finishTime - (this.startTime < 0 ? this.finishTime : this.startTime)))
    const mm = Math.floor(secs / 60)
    const ss = secs % 60
    const time = mm + ":" + (ss < 10 ? "0" : "") + ss
    this.completionString = "Pallet done!\nTime " + time + "  ·  Mistakes " + this.mistakes + "\nWrap and label the pallet."
    this.completionCard.setText(this.completionString)
    this.completionCard.setVisible(true)
    this.tipText.setVisible(false)
    this.arrowVisible = false
    this.offViewArrow.enabled = false
    this.play("complete")
  }

  private sendHome(c: CartonState): void {
    c.returning = true
    c.returnT = 0
    c.returnFrom = c.so.getTransform().getWorldPosition()
  }

  private showGhostFor(spec: CartonSpec): void {
    const center = this.slotCenterLocal(spec)
    this.ghost.getTransform().setLocalPosition(center)
    this.ghostFill.getTransform().setLocalScale(spec.size)
    BoxFactory.layoutWireBox(this.ghostWire, spec.size.add(new vec3(0.6, 0.6, 0.6)), 0.8)
    this.ghost.enabled = true
    this.ghostTagString = ghostTagText(spec)
    this.ghostTag.setText(this.ghostTagString)
    this.ghostTag.sceneObject.getTransform().setLocalPosition(
      new vec3(center.x, spec.slot.y + spec.size.y + 7, center.z + spec.size.z / 2 + 3))
    this.ghostTag.setVisible(true)
  }

  private hideGhost(): void {
    this.ghost.enabled = false
    this.ghostTag.setVisible(false)
  }

  private slotCenterLocal(spec: CartonSpec): vec3 {
    return new vec3(spec.slot.x, spec.slot.y + spec.size.y / 2, spec.slot.z)
  }

  private updateCounter(): void {
    this.counter.setText(this.placedCount + " / " + this.cartons.length)
  }

  private updateGlow(): void {
    for (const c of this.cartons) {
      c.glow.enabled = !this.complete && c.index === this.nextIndex && !c.grabbed && !c.placed
    }
  }

  private setHover(i: number, on: boolean): void {
    const c = this.cartons[i]
    if (!c || c.placed) return
    c.hovered = on
    const k = on ? 0.4 : 0
    const col = c.spec.color
    c.bodyMat.mainPass.baseColor = new vec4(col.x + (1 - col.x) * k, col.y + (1 - col.y) * k, col.z + (1 - col.z) * k, 1)
  }

  // =====================================================================================
  // Per-frame: slide-back, tip timeout, glow pulse, off-view arrow + chime
  // =====================================================================================
  private onUpdate(): void {
    if (!this.ready) return
    const now = getTime()
    const dt = getDeltaTime()

    for (const c of this.cartons) {
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
      this.tipHideAt = -1
      this.tipText.setVisible(false)
    }

    const pulse = 0.65 + 0.35 * Math.sin(now * 3)
    for (const c of this.cartons) {
      if (c.glow.enabled) {
        c.glowMat.mainPass.baseColor = new vec4(this.glowColor.x, this.glowColor.y, this.glowColor.z, this.glowColor.w * pulse)
      }
    }

    this.updateOffView(now)
  }

  private updateOffView(now: number): void {
    if (this.complete || this.nextIndex >= this.cartons.length) {
      this.arrowVisible = false
      this.offViewArrow.enabled = false
      return
    }
    const next = this.cartons[this.nextIndex]
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
    for (const top of [40, 100]) {
      this.factory.makeBox(v, "Board", new vec3(60, 3, 240), new vec3(0, top - 1.5, 0), board)
      this.factory.makeBox(v, "Beam", new vec3(3, 6, 240), new vec3(-31.5, top - 3, 0), beam)
    }
  }

  private buildResetPostVisual(): void {
    this.factory.makeBox(this.resetPost, "PostVisual", new vec3(4, 84, 4), new vec3(0, 42, 0), new vec4(0.75, 0.8, 0.9, 1))
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
    head1.getTransform().setLocalRotation(quat.angleAxis(0.7, vec3.up()))
    const head2 = this.factory.makeBox(this.offViewArrow, "HeadB", new vec3(10, 1.5, 3.5), new vec3(5.5, 0, 2.7), yellow).getSceneObject()
    head2.getTransform().setLocalRotation(quat.angleAxis(-0.7, vec3.up()))
    this.offViewArrow.enabled = false
  }

  private buildCartons(): void {
    const n = Math.min(this.pickList.getChildrenCount(), PICK_LIST.length)
    if (n !== PICK_LIST.length) print("[StackRight] WARNING: PickList has " + this.pickList.getChildrenCount() + " children, expected " + PICK_LIST.length)
    for (let i = 0; i < n; i++) {
      const so = this.pickList.getChild(i)
      const spec = PICK_LIST[i]
      const body = this.factory.makeBox(so, "Body", spec.size, vec3.zero(), spec.color)
      const glowRmv = this.factory.makeBox(so, "Glow", spec.size.add(new vec3(5, 5, 5)), vec3.zero(), this.glowColor, true)
      const labels = so.createComponent(StackRightCartonLabelUI.getTypeName()) as StackRightCartonLabelUI
      labels.setup(spec.name, spec.kg + " kg · " + (spec.heavy ? "HEAVY" : "FRAGILE"), spec.size)

      const col = so.createComponent("Physics.ColliderComponent") as ColliderComponent
      const shape = Shape.createBoxShape()
      shape.size = spec.size
      col.shape = shape
      const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
      const manip = so.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
      manip.setCanRotate(false)
      manip.setCanScale(false)

      this.cartons.push({
        index: i, spec, so,
        home: so.getTransform().getWorldPosition(),
        placed: false, grabbed: false, returning: false, returnFrom: vec3.zero(), returnT: 0, hovered: false,
        interactable, manip,
        bodyMat: body.mainMaterial,
        glow: glowRmv.getSceneObject(),
        glowMat: glowRmv.mainMaterial,
      })
    }
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
