// StackRightTestDriver.ts
// TEST/DEMO ONLY. Drives the controller through its test hooks (simulateGrab / simulateRelease /
// pressReset, the same code path as real SIK grabs) a moment after the Lens starts.
//   mode "off"       - does nothing (normal play)
//   mode "selftest"  - checks done criteria 1-6 (full 30-case run), prints "[StackRightTest] PASS/FAIL ..." lines
//   mode "ghost"     - 14 cases placed (layers 1-2 + 2 of layer 3), case 15 held above the pallet: ghost + tag
//   mode "overhang"  - case 1 dropped hanging over the pallet edge: red overhang tip showing
//   mode "layerdone" - layer 1 finished: white "Layer 1 done" note showing
//   mode "complete"  - all 30 placed: completion card showing
//   mode "paced"     - real-time run with pauses, for screenshots
//   mode "demo"      - scripted run for the demo video: every case carried along an arc from the
//                      pick face to its drop point, one overhang and one gap mistake, Reset at the
//                      end; prints "[DEMO] <beat>" at the start of each beat
// Expects: the StackRightController component. Must not: change game rules.
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {StackRightController, TIP_GAP, TIP_OVERHANG} from "./StackRightController"
import {ORDER, PLAN, ghostTagText, layerDoneText, plannedSize, footprint, HEIGHT_LIMIT_CM, STACK_HEIGHT_CM, LAYER_COUNT} from "./StackRightPickList"

@component
export class StackRightTestDriver extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightTestDriver – test/demo states (set mode to off for normal play)</span>')
  @ui.separator
  @input
  @hint("The StackRightController to drive")
  controller: StackRightController

  @input
  @hint("off | selftest | ghost | overhang | layerdone | complete | paced | demo")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("off", "off"),
    new ComboBoxItem("selftest", "selftest"),
    new ComboBoxItem("ghost", "ghost"),
    new ComboBoxItem("overhang", "overhang"),
    new ComboBoxItem("layerdone", "layerdone"),
    new ComboBoxItem("complete", "complete"),
    new ComboBoxItem("paced", "paced"),
    new ComboBoxItem("demo", "demo"),
  ]))
  mode: string = "off"

  @input
  @hint("Seconds to wait after start before driving")
  startDelaySec: number = 1.5

  @input
  @hint("demo only: hold the camera at a fixed recording viewpoint (device tracking off for the run)")
  demoCamera: boolean = true

  @input
  @hint("demo only: camera eye, pallet-local cm (x right, y up from the floor, z toward the user)")
  demoEye: vec3 = new vec3(-60, 165, 480)

  @input
  @hint("demo only: point the camera looks at, pallet-local cm")
  demoLookAt: vec3 = new vec3(57, 72, -40)

  private passed = 0
  private failed = 0
  private dcResults: {[dc: string]: [number, number]} = {}

  onAwake(): void {
    if (this.mode === "off") return
    this.createEvent("OnStartEvent").bind(() => {
      this.wait(this.startDelaySec).then(() => this.runMode())
    })
  }

  private async runMode(): Promise<void> {
    const c = this.controller
    print("[StackRightTest] mode = " + this.mode)
    if (this.mode === "selftest") {
      await this.selfTest()
    } else if (this.mode === "ghost") {
      for (let i = 0; i < 14; i++) this.dropOnSlot(i)
      await this.settle()
      c.simulateGrab(14)
      // Hold the case in the air in front of its slot, as if carried there.
      const held = c.getSlotWorldPosition(14).add(new vec3(25, 45, 45))
      c.pickList.getChild(14).getTransform().setWorldPosition(held)
    } else if (this.mode === "overhang") {
      c.tipDurationSec = 120 // demo only: keep the tip up long enough to frame a screenshot
      this.dropOnSlot(0)
      c.simulateGrab(1)
      c.simulateRelease(1, this.palletPoint(48, 40, -29))
    } else if (this.mode === "layerdone") {
      c.tipDurationSec = 120
      for (let i = 0; i < 6; i++) this.dropOnSlot(i)
    } else if (this.mode === "complete") {
      for (let i = 0; i < ORDER.length; i++) this.dropOnSlot(i)
    } else if (this.mode === "demo") {
      await this.demo()
    } else if (this.mode === "paced") {
      // Real-time run: 3 cases held over their ghost then dropped, with pauses, one gap drop, then the rest.
      c.tipDurationSec = 120
      for (let i = 0; i < 3; i++) {
        c.simulateGrab(i)
        c.pickList.getChild(i).getTransform().setWorldPosition(c.getSlotWorldPosition(i).add(new vec3(0, 30, 0)))
        print("[StackRightTest] paced: holding case " + i + " over its ghost")
        await this.wait(6)
        c.simulateRelease(i, c.getSlotWorldPosition(i).add(new vec3(0, 5, 0)))
        await this.wait(3)
      }
      c.simulateGrab(3)
      c.simulateRelease(3, this.palletPoint(0, 45, 10))
      print("[StackRightTest] paced: gap drop, tip '" + c.getTipText().replace(/\n/g, " | ") + "'")
      await this.wait(8)
      await this.settle()
      const last = ORDER.length - 1
      for (let i = 3; i < last; i++) this.dropOnSlot(i)
      c.simulateGrab(last)
      c.pickList.getChild(last).getTransform().setWorldPosition(c.getSlotWorldPosition(last).add(new vec3(0, 30, 0)))
      print("[StackRightTest] paced: holding case " + last + " over its ghost (layer 5)")
      await this.wait(8)
      c.simulateRelease(last, c.getSlotWorldPosition(last).add(new vec3(0, 5, 0)))
      print("[StackRightTest] paced: card '" + c.getCompletionText().split("\n").join(" | ") + "'")
    }
  }

  // ---------------------------------------------------------------------------------------
  // Demo: the scripted run recorded for the demo video. Every grab and release goes through the
  // controller's test hooks, so the rules are the real ones; only the carry in between is animated.
  // ---------------------------------------------------------------------------------------
  private async demo(): Promise<void> {
    const c = this.controller
    c.reset()
    if (this.demoCamera) this.setDemoCamera()
    const layerCases = (layer: number): number[] => {
      const out: number[] = []
      for (let i = 0; i < PLAN.length; i++) if (PLAN[i].layer === layer) out.push(i)
      return out
    }

    this.beat("intro")
    await this.wait(4)

    this.beat("case1")
    await this.demoPlace(0, 3, 1.5, 0.4)
    await this.wait(1.5)

    // Case 2 hangs ~15 cm over the side edge nearest the pick face, in the near row.
    this.beat("overhang")
    await this.settle()
    const fp = footprint(ORDER[1], PLAN[1].turned)
    const deckY = PLAN[1].center.y + 3
    c.simulateGrab(1)
    await this.carry(1, this.palletPoint(58.25 + 15 - fp.x / 2, deckY, PLAN[3].center.z), 2.5)
    c.simulateRelease(1, this.caseWorld(1))
    await this.wait(3.5)

    // Case 2 dropped on the near-left slot, well inside the edge but far from its own ghost.
    this.beat("gap")
    await this.settle()
    c.simulateGrab(1)
    await this.carry(1, this.palletPoint(PLAN[3].center.x, deckY, PLAN[3].center.z), 2.5)
    c.simulateRelease(1, this.caseWorld(1))
    await this.wait(3.5)

    this.beat("case2")
    await this.settle()
    await this.demoPlace(1, 2, 0.3, 0.3)

    this.beat("layer1")
    for (const i of layerCases(1).slice(2)) await this.demoPlaceTimed(i, 1.4)
    await this.wait(3.5)

    this.beat("layer2turn")
    const l2 = layerCases(2)
    await this.demoPlace(l2[0], 3, 1.5, 0.4)
    for (const i of l2.slice(1)) await this.demoPlaceTimed(i, 0.9)

    this.beat("fast")
    for (const i of layerCases(3).concat(layerCases(4))) await this.demoPlaceTimed(i, 0.5)

    this.beat("layer5")
    for (const i of layerCases(5)) await this.demoPlaceTimed(i, 1.4)

    this.beat("complete")
    print("[DEMO] card '" + c.getCompletionText().replace(/\n/g, " | ") + "'")
    await this.wait(7)

    this.beat("reset")
    c.pressReset()
    await this.wait(3)

    this.beat("end")
  }

  private beat(name: string): void {
    print("[DEMO] " + name)
  }

  /** Fixed recording viewpoint: device tracking off for this run only (the next preview start restores it). */
  private setDemoCamera(): void {
    const camSo = WorldCameraFinderProvider.getInstance().getComponent().getSceneObject()
    const tracking = camSo.getComponent("Component.DeviceTracking")
    if (tracking) tracking.enabled = false
    const eye = this.palletPoint(this.demoEye.x, this.demoEye.y, this.demoEye.z)
    const look = this.palletPoint(this.demoLookAt.x, this.demoLookAt.y, this.demoLookAt.z)
    const t = camSo.getTransform()
    t.setWorldPosition(eye)
    t.setWorldRotation(quat.lookAt(eye.sub(look).normalize(), vec3.up())) // camera looks down its -Z
    print("[DEMO] camera eye " + this.v(eye) + " looking at " + this.v(look))
  }

  /** Grab, carry to just above the ghost, hover, lower and release onto the slot (snaps). */
  private async demoPlace(i: number, carrySec: number, hoverSec: number, lowerSec: number): Promise<void> {
    const c = this.controller
    const slot = c.getSlotWorldPosition(i)
    c.simulateGrab(i)
    // Hover high enough that the held case does not cover the ghost tag; quick placements stay low.
    const lift = hoverSec > 0 ? 45 : 25
    await this.carry(i, slot.add(new vec3(0, lift, 0)), carrySec)
    if (hoverSec > 0) await this.wait(hoverSec)
    await this.carry(i, slot.add(new vec3(0, 3, 0)), lowerSec, false)
    c.simulateRelease(i, this.caseWorld(i))
  }

  /** One case in a fixed total time: 70% carry, 15% lower, 15% rest. */
  private async demoPlaceTimed(i: number, totalSec: number): Promise<void> {
    await this.demoPlace(i, totalSec * 0.7, 0, totalSec * 0.15)
    await this.wait(totalSec * 0.15)
  }

  private caseWorld(i: number): vec3 {
    return this.controller.pickList.getChild(i).getTransform().getWorldPosition()
  }

  /**
   * Moves held case i to `to` over `sec`, eased in/out. With `arc`, the path rises to about 30 cm
   * above the stack top (bottom of the case), so the ghost below stays visible during the carry.
   */
  private carry(i: number, to: vec3, sec: number, arc: boolean = true): Promise<void> {
    const t = this.controller.pickList.getChild(i).getTransform()
    const from = t.getWorldPosition()
    const peak = Math.max(this.controller.getFloorWorldY() + this.controller.getStackTopCm() + 30 + ORDER[i].size.y / 2,
      Math.max(from.y, to.y) + 10)
    const ctrlY = arc ? 2 * peak - (from.y + to.y) / 2 : (from.y + to.y) / 2 // quadratic: midpoint reaches peak
    const start = getTime()
    return new Promise((resolve) => {
      const ev = this.createEvent("UpdateEvent")
      ev.bind(() => {
        const u = sec > 0 ? Math.min(1, (getTime() - start) / sec) : 1
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2 // ease in/out cubic
        const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * ctrlY + e * e * to.y
        t.setWorldPosition(new vec3(from.x + (to.x - from.x) * e, y, from.z + (to.z - from.z) * e))
        if (u >= 1) {
          this.removeEvent(ev)
          resolve()
        }
      })
    })
  }

  // ---------------------------------------------------------------------------------------
  // Self-test: one block per done criterion in devpost/design-brief.md
  // ---------------------------------------------------------------------------------------
  private async selfTest(): Promise<void> {
    const c = this.controller
    const N = ORDER.length
    c.reset()
    await this.wait(0.3)

    // DC1: pallet on the floor ~1 m ahead at real size, pick face ~1.4 m right with the first 4
    // cases, height-limit outline at 180 cm.
    const cam = c.getCameraWorldPosition()
    const pallet = c.getPalletWorldPosition()
    const shelf = c.getShelfWorldPosition()
    this.check("DC1", "pallet ~100 cm ahead (got " + (cam.z - pallet.z).toFixed(0) + ")", cam.z - pallet.z >= 80 && cam.z - pallet.z <= 120)
    this.check("DC1", "pallet centred (dx " + (pallet.x - cam.x).toFixed(0) + ")", Math.abs(pallet.x - cam.x) < 20)
    this.check("DC1", "pallet on floor, " + (cam.y - pallet.y).toFixed(0) + " cm below eyes", cam.y - pallet.y >= 140 && cam.y - pallet.y <= 170)
    this.check("DC1", "shelf ~140 cm right (got " + (shelf.x - cam.x).toFixed(0) + ")", shelf.x - cam.x >= 120 && shelf.x - cam.x <= 160)
    this.check("DC1", N + " cases in the order (got " + c.getCaseCount() + ")", c.getCaseCount() === 30)
    this.check("DC1", "queue shows exactly cases 0-3", this.queueOk(0))
    let lowerShelf = true
    for (let i = 0; i < 4; i++) {
      const p = c.getCaseWorldPosition(i)
      const bottom = p.y - ORDER[i].size.y / 2 - c.getFloorWorldY()
      if (Math.abs(bottom - 40) > 0.5 || Math.abs(p.x - shelf.x) > 1) lowerShelf = false
    }
    this.check("DC1", "queue sits on the lower shelf (bottom 40 cm)", lowerShelf)
    let nearest = true
    const d0 = this.flatDist(c.getCaseWorldPosition(0), pallet)
    for (let i = 1; i < 4; i++) if (this.flatDist(c.getCaseWorldPosition(i), pallet) <= d0) nearest = false
    this.check("DC1", "case due now is in the slot nearest the pallet (" + d0.toFixed(0) + " cm)", nearest)
    const limitAbove = c.getHeightLimitWorldY() - c.getFloorWorldY()
    this.check("DC1", "height-limit outline " + limitAbove.toFixed(1) + " cm above the floor, visible",
      Math.abs(limitAbove - HEIGHT_LIMIT_CM) < 0.5 && c.isHeightLimitVisible())
    this.check("DC1", "counter reads '" + c.getCounterText() + "'", c.getCounterText() === "Layer 1 · 0 / 30")
    this.check("DC1", "case 0 glows, only case 0 interactable", c.isCaseGlowing(0) && this.onlyInteractable(0))

    // DC2: grabbing the case due now shows its ghost in the planned slot, turned to the layer, with the tag.
    c.simulateGrab(1)
    this.check("DC2", "grabbing a later case does nothing (no ghost)", !c.isGhostVisible() && c.getGrabbedIndex() === -1)
    this.check("DC2", "no ghost before grab", !c.isGhostVisible())
    c.simulateGrab(0)
    this.check("DC2", "ghost visible after grabbing case 0", c.isGhostVisible())
    this.check("DC2", "ghost sits on case 0's planned slot", c.getGhostWorldPosition().distance(c.getSlotWorldPosition(0)) < 0.5)
    this.check("DC2", "layer-1 ghost size = case size " + this.v(c.getGhostSize()), c.getGhostSize().distance(ORDER[0].size) < 0.01)
    this.check("DC2", "tag reads '" + c.getGhostTagText() + "'", c.isGhostTagVisible() && c.getGhostTagText() === "Layer 1 · 1 of 30 · 17 kg")

    // DC3: drop within 15 cm snaps, counter goes up, queue moves up, next case glows.
    c.simulateRelease(0, c.getSlotWorldPosition(0).add(new vec3(10, 5, 0)))
    this.check("DC3", "case 0 snapped (dropped 10 cm off)", c.isCasePlaced(0))
    this.check("DC3", "snapped square onto the slot", c.getCaseWorldPosition(0).distance(c.getSlotWorldPosition(0)) < 0.5 &&
      this.angleDeg(c.getCaseWorldRotation(0), c.getSlotWorldRotation(0)) < 0.5)
    this.check("DC3", "counter reads '" + c.getCounterText() + "'", c.getCounterText() === "Layer 1 · 1 / 30")
    this.check("DC3", "ghost hidden after placing", !c.isGhostVisible() && !c.isGhostTagVisible())
    this.check("DC3", "queue moved up: cases 1-4 shown, 5+ hidden", this.queueOk(1))
    this.check("DC3", "case 1 sliding to the front slot", c.isCaseReturning(1) &&
      c.getCaseHomePosition(1).distance(c.getQueueSlotWorldPosition(0, 1)) < 0.5)
    await this.settle()
    this.check("DC3", "case 1 now in the front slot, case 4 at the back", c.getCaseWorldPosition(1).distance(c.getQueueSlotWorldPosition(0, 1)) < 0.5 &&
      c.getCaseWorldPosition(4).distance(c.getQueueSlotWorldPosition(3, 4)) < 0.5)
    this.check("DC3", "next case (1) glows and is the only one interactable", c.isCaseGlowing(1) && !c.isCaseGlowing(0) && this.onlyInteractable(1))

    // DC4: on the pallet but off the ghost -> back + red tip (overhang / gap) + mistake; off the pallet -> back, no mistake.
    let m = c.getMistakes()
    c.simulateGrab(1)
    c.simulateRelease(1, this.palletPoint(0, 45, 10)) // 39 cm from the ghost, fully inside the edge
    this.check("DC4", "gap drop: not placed, sliding back", !c.isCasePlaced(1) && c.isCaseReturning(1))
    this.check("DC4", "gap drop: tip '" + c.getTipText().replace(/\n/g, " | ") + "'", c.isTipVisible() && c.getTipKind() === "gap" && c.getTipText() === TIP_GAP)
    this.check("DC4", "gap drop: one mistake", c.getMistakes() === m + 1)
    await this.settle()
    this.check("DC4", "case back home on the pick face", c.getCaseWorldPosition(1).distance(c.getCaseHomePosition(1)) < 0.5)
    c.simulateGrab(1)
    c.simulateRelease(1, this.palletPoint(48, 45, -29)) // 38 cm wide case centred 48 cm out: 9 cm over the edge
    this.check("DC4", "overhang drop: tip '" + c.getTipText().replace(/\n/g, " | ") + "'", c.isTipVisible() && c.getTipKind() === "overhang" && c.getTipText() === TIP_OVERHANG)
    this.check("DC4", "overhang drop: one more mistake", c.getMistakes() === m + 2 && !c.isCasePlaced(1))
    await this.settle()
    c.simulateGrab(1)
    c.simulateRelease(1, this.palletPoint(40, 45, 10)) // 40 + 19 = 59 cm: 0.75 cm over, inside the 2 cm tolerance
    this.check("DC4", "drop 0.75 cm over the edge counts as gap, not overhang", c.getTipKind() === "gap" && c.getMistakes() === m + 3)
    await this.settle()
    c.simulateGrab(1)
    c.simulateRelease(1, this.palletPoint(0, 30, 90)) // on the floor in front of the pallet
    this.check("DC4", "off-pallet drop: back, no mistake", !c.isCasePlaced(1) && c.isCaseReturning(1) && c.getMistakes() === m + 3)
    await this.settle()
    this.check("DC4", "case back home after off-pallet drop", c.getCaseWorldPosition(1).distance(c.getCaseHomePosition(1)) < 0.5)
    await this.wait(this.controller.tipDurationSec + 0.3)
    this.check("DC4", "tip hides after ~4 s", !c.isTipVisible())

    // DC5 + DC6: build the rest; layer notes after layers 1-4; layers 2/4 turned vs 1/3; queue shifts every time.
    let queueFails = 0
    let snapFails = 0
    for (let i = 1; i < N; i++) {
      if (i === 6) {
        // Turned layer: the ghost is the case with x/z swapped, and an overhang is judged in that orientation.
        c.simulateGrab(6)
        const want = plannedSize(ORDER[6], true)
        this.check("DC2", "layer-2 ghost turned: size " + this.v(c.getGhostSize()) + " = " + this.v(want),
          c.getGhostSize().distance(want) < 0.01 && c.getGhostSize().x !== ORDER[6].size.x)
        this.check("DC2", "layer-2 tag reads '" + c.getGhostTagText() + "'", c.getGhostTagText() === "Layer 2 · 7 of 30 · 14 kg")
        m = c.getMistakes()
        c.simulateRelease(6, this.palletPoint(35, 80, 0)) // turned: 35 + 29 = 64 over; unturned it would fit
        this.check("DC4", "overhang judged in the planned (turned) orientation", c.getTipKind() === "overhang" && c.getMistakes() === m + 1)
        await this.settle()
      }
      if (i === 14) {
        c.simulateGrab(14)
        this.check("DC2", "case 15 tag reads '" + c.getGhostTagText() + "'", c.getGhostTagText() === "Layer 3 · 15 of 30 · 10 kg")
        this.check("DC2", "layer-3 ghost not turned", c.getGhostSize().distance(ORDER[14].size) < 0.01)
      }
      const layer = PLAN[i].layer
      this.dropOnSlot(i)
      if (!c.isCasePlaced(i) || c.getCaseWorldPosition(i).distance(c.getSlotWorldPosition(i)) > 0.5 ||
        this.angleDeg(c.getCaseWorldRotation(i), c.getSlotWorldRotation(i)) > 0.5) snapFails++
      if (i + 1 < N && !this.queueOk(i + 1)) queueFails++
      const lastOfLayer = i === N - 1 || PLAN[i + 1].layer !== layer
      if (lastOfLayer && layer < LAYER_COUNT) {
        this.check("DC5", "layer " + layer + " done note: '" + c.getTipText().replace(/\n/g, " | ") + "'",
          c.isTipVisible() && c.getTipKind() === "layer" && c.getTipText() === layerDoneText(layer))
      }
      if (lastOfLayer && layer === LAYER_COUNT) {
        this.check("DC5", "no 'turns 90°' note after the last layer", c.getTipKind() !== "layer")
      }
    }
    this.check("DC3", "every case snapped onto its slot with the planned rotation (" + snapFails + " misses)", snapFails === 0)
    this.check("DC3", "queue moved up after every placement (" + queueFails + " misses)", queueFails === 0)

    // Orientation: each layer-2/4 case is 90 deg from layer 1/3 cases about up.
    for (const [a, b] of [[0, 6], [6, 12], [12, 20]]) {
      const ang = this.angleDeg(c.getCaseWorldRotation(a), c.getCaseWorldRotation(b))
      this.check("DC5", "layer " + PLAN[a].layer + " vs layer " + PLAN[b].layer + " placed " + ang.toFixed(1) + "° apart", Math.abs(ang - 90) < 0.5)
    }
    let allTurned = true
    for (let i = 0; i < N; i++) if (PLAN[i].turned !== (PLAN[i].layer === 2 || PLAN[i].layer === 4)) allTurned = false
    this.check("DC5", "plan turns exactly layers 2 and 4", allTurned)
    this.logJoints()

    // DC6: completion card + Reset.
    this.check("DC6", "all 30 placed, counter '" + c.getCounterText() + "'", c.isComplete() && c.getCounterText() === "Layer 5 · 30 / 30")
    this.check("DC6", "stack top " + c.getStackTopCm().toFixed(1) + " cm (~157), under the 180 cm limit",
      Math.abs(c.getStackTopCm() - 157) < 0.5 && Math.abs(STACK_HEIGHT_CM - 157) < 0.5 && c.getStackTopCm() < HEIGHT_LIMIT_CM)
    const card = c.getCompletionText()
    this.check("DC6", "completion card visible", c.isCompletionVisible())
    this.check("DC6", "card: '" + card.replace(/\n/g, " | ") + "'",
      card.indexOf("Pallet done! 30 cases · 5 layers · 157 cm\n") === 0 && /\nTime \d+:\d\d · Mistakes /.test(card) &&
      card.indexOf("Mistakes " + c.getMistakes()) >= 0 && card.indexOf("\nWrap and label the pallet.") >= 0)
    this.check("DC6", "card groups mistakes by rule (" + c.getOverhangMistakes() + " overhang, " + c.getGapMistakes() + " gap)",
      c.getOverhangMistakes() + c.getGapMistakes() === c.getMistakes() &&
      (c.getOverhangMistakes() === 0 || card.indexOf(c.getOverhangMistakes() + " overhang") >= 0) &&
      (c.getGapMistakes() === 0 || card.indexOf(c.getGapMistakes() + " gap") >= 0))
    await this.wait(1)
    this.check("DC6", "card stays up", c.isCompletionVisible())
    c.pressReset()
    let allClear = true
    for (let i = 0; i < N; i++) if (c.isCasePlaced(i)) allClear = false
    this.check("DC6", "Reset: pallet cleared", allClear)
    this.check("DC6", "Reset: order restarts, first 4 cases on the pick face", this.queueOk(0) && c.getNextIndex() === 0)
    this.check("DC6", "Reset: counter '" + c.getCounterText() + "', card hidden, mistakes 0",
      c.getCounterText() === "Layer 1 · 0 / 30" && !c.isCompletionVisible() && c.getMistakes() === 0)
    this.check("DC6", "Reset: case 0 glows and is interactable", c.isCaseGlowing(0) && this.onlyInteractable(0))

    print("[StackRightTest] SUMMARY per done criterion:")
    for (const dc of Object.keys(this.dcResults).sort()) {
      const [p, f] = this.dcResults[dc]
      print("[StackRightTest]   " + dc + ": " + (f === 0 ? "PASS" : "FAIL") + " (" + p + " passed, " + f + " failed)")
    }
    print("[StackRightTest] DONE: " + this.passed + " passed, " + this.failed + " failed")
  }

  // ---------------------------------------------------------------------------------------
  /** Cases next..next+3 shown on the pick face (homes = queue slots); every other unplaced case hidden. */
  private queueOk(next: number): boolean {
    const c = this.controller
    for (let i = 0; i < c.getCaseCount(); i++) {
      if (c.isCasePlaced(i)) continue
      const q = i - next
      const inQueue = q >= 0 && q < c.getQueueSize()
      if (c.isCaseShown(i) !== inQueue) return false
      if (inQueue && c.getCaseHomePosition(i).distance(c.getQueueSlotWorldPosition(q, i)) > 0.5) return false
    }
    return true
  }

  private onlyInteractable(i: number): boolean {
    const c = this.controller
    for (let k = 0; k < c.getCaseCount(); k++) if (c.isCaseInteractable(k) !== (k === i)) return false
    return true
  }

  /** Prints which joint lines (cm, pallet axes) each pair of neighbouring layers share. */
  private logJoints(): void {
    const joints = (layer: number, axis: "x" | "z"): number[] => {
      const out: number[] = []
      for (let i = 0; i < PLAN.length; i++) {
        if (PLAN[i].layer !== layer) continue
        const fp = footprint(ORDER[i], PLAN[i].turned)
        const half = axis === "x" ? fp.x / 2 : fp.y / 2
        const ctr = axis === "x" ? PLAN[i].center.x : PLAN[i].center.z
        for (const e of [ctr - half, ctr + half]) {
          const r = Math.round(e * 10) / 10
          if (Math.abs(r) < 55 && out.indexOf(r) < 0) out.push(r)
        }
      }
      return out.sort((a, b) => a - b)
    }
    for (let l = 1; l < LAYER_COUNT; l++) {
      const shared: string[] = []
      for (const axis of ["x", "z"] as ("x" | "z")[]) {
        const lo = joints(l, axis), hi = joints(l + 1, axis)
        for (const j of lo) if (hi.indexOf(j) >= 0) shared.push(axis + "=" + j)
      }
      print("[StackRightTest] INFO joints shared by layers " + l + " and " + (l + 1) + ": " + (shared.length ? shared.join(", ") : "none"))
    }
  }

  private palletPoint(x: number, y: number, z: number): vec3 {
    return this.controller.getPalletWorldTransform().multiplyPoint(new vec3(x, y, z))
  }

  private dropOnSlot(i: number): void {
    this.controller.simulateGrab(i)
    this.controller.simulateRelease(i, this.controller.getSlotWorldPosition(i).add(new vec3(0, 5, 0)))
  }

  private flatDist(a: vec3, b: vec3): number {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z))
  }

  private angleDeg(a: quat, b: quat): number {
    const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
    return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI
  }

  private v(p: vec3): string {
    return "(" + p.x.toFixed(0) + ", " + p.y.toFixed(0) + ", " + p.z.toFixed(0) + ")"
  }

  private check(dc: string, what: string, ok: boolean): void {
    if (ok) this.passed++
    else this.failed++
    const r = this.dcResults[dc] || [0, 0]
    r[ok ? 0 : 1]++
    this.dcResults[dc] = r
    print("[StackRightTest] " + (ok ? "PASS" : "FAIL") + " " + dc + ": " + what)
  }

  private async settle(): Promise<void> {
    for (let k = 0; k < 30; k++) {
      let busy = false
      for (let i = 0; i < this.controller.getCaseCount(); i++) if (this.controller.isCaseReturning(i)) busy = true
      if (!busy) return
      await this.wait(0.1)
    }
  }

  private wait(sec: number): Promise<void> {
    return new Promise((resolve) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => resolve())
      ev.reset(sec)
    })
  }
}
