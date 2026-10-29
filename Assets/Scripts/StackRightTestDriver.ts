// StackRightTestDriver.ts
// TEST/DEMO ONLY. Stand-in for LEAF while LEAF isn't installed: drives the controller through its
// test hooks (simulateGrab / simulateRelease / pressReset, the same code path as real SIK grabs)
// a moment after the Lens starts.
//   mode "off"      - does nothing (normal play)
//   mode "selftest" - checks done criteria 1-5, prints "[StackRightTest] PASS/FAIL ..." lines, then resets
//   mode "ghost"    - 3 cartons placed, next carton held above the pallet: ghost + tag showing
//   mode "mistake"  - chips dropped on the pallet while heavy is due: red tip showing
//   mode "complete" - all 8 placed: completion card showing
// Expects: the StackRightController component. Must not: change game rules.
import {StackRightController} from "./StackRightController"
import {ghostTagText, PICK_LIST} from "./StackRightPickList"

@component
export class StackRightTestDriver extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightTestDriver – test/demo states (set mode to off for normal play)</span>')
  @ui.separator
  @input
  @hint("The StackRightController to drive")
  controller: StackRightController

  @input
  @hint("off | selftest | ghost | mistake | complete")
  @widget(new ComboBoxWidget([
    new ComboBoxItem("off", "off"),
    new ComboBoxItem("selftest", "selftest"),
    new ComboBoxItem("ghost", "ghost"),
    new ComboBoxItem("mistake", "mistake"),
    new ComboBoxItem("complete", "complete"),
  ]))
  mode: string = "off"

  @input
  @hint("Seconds to wait after start before driving")
  startDelaySec: number = 1.5

  private passed = 0
  private failed = 0

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
      for (let i = 0; i < 3; i++) this.dropOnSlot(i)
      c.simulateGrab(3)
      // Hold the carton in the air in front of the pallet, as if carried there.
      const held = c.getSlotWorldPosition(3).add(new vec3(20, 75, 35))
      this.cartonObject(3).getTransform().setWorldPosition(held)
    } else if (this.mode === "mistake") {
      c.tipDurationSec = 120 // demo only: keep the tip up long enough to frame a screenshot
      c.simulateGrab(7)
      c.simulateRelease(7, c.getPalletWorldPosition().add(new vec3(0, 40, 0)))
    } else if (this.mode === "complete") {
      for (let i = 0; i < 8; i++) this.dropOnSlot(i)
    }
  }

  // ---------------------------------------------------------------------------------------
  // Self-test: one block per done criterion in devpost/design-brief.md
  // ---------------------------------------------------------------------------------------
  private async selfTest(): Promise<void> {
    const c = this.controller
    c.reset()
    await this.wait(0.3)

    // DC1: pallet on the floor ~1 m ahead, shelf bay with 8 cartons ~1.4 m to the right.
    const cam = c.getCameraWorldPosition()
    const pallet = c.getPalletWorldPosition()
    const shelf = c.getShelfWorldPosition()
    this.check("DC1", "pallet ~100 cm ahead (got " + (cam.z - pallet.z).toFixed(0) + ")", cam.z - pallet.z >= 80 && cam.z - pallet.z <= 120)
    this.check("DC1", "pallet centred (dx " + (pallet.x - cam.x).toFixed(0) + ")", Math.abs(pallet.x - cam.x) < 20)
    this.check("DC1", "pallet on floor, " + (cam.y - pallet.y).toFixed(0) + " cm below eyes", cam.y - pallet.y >= 140 && cam.y - pallet.y <= 170)
    this.check("DC1", "shelf ~140 cm right (got " + (shelf.x - cam.x).toFixed(0) + ")", shelf.x - cam.x >= 120 && shelf.x - cam.x <= 160)
    this.check("DC1", "8 cartons", c.getCartonCount() === 8)
    let onShelf = true
    for (let i = 0; i < c.getCartonCount(); i++) {
      const p = c.getCartonWorldPosition(i)
      if (c.isCartonPlaced(i) || Math.abs(p.x - shelf.x) > 30 || Math.abs(p.z - shelf.z) > 120 || p.y < shelf.y + 35) onShelf = false
    }
    this.check("DC1", "all 8 cartons sit on the shelf bay", onShelf)
    this.check("DC1", "counter reads 0 / 8", c.getCounterText() === "0 / 8")
    this.check("DC1", "first carton glows on the shelf", c.isCartonGlowing(0))

    // DC2: grabbing the correct next carton shows its ghost with "Layer N · Heavy/Light · kg".
    this.check("DC2", "no ghost before grab", !c.isGhostVisible())
    c.simulateGrab(0)
    this.check("DC2", "ghost visible after grabbing next carton", c.isGhostVisible())
    this.check("DC2", "ghost sits on carton 0's slot", c.getGhostWorldPosition().distance(c.getSlotWorldPosition(0)) < 0.5)
    this.check("DC2", "tag reads '" + c.getGhostTagText() + "'", c.isGhostTagVisible() && c.getGhostTagText() === ghostTagText(PICK_LIST[0]) && c.getGhostTagText() === "Layer 1 · Heavy · 14 kg")

    // DC3: drop within 15 cm snaps, counter goes up, next ghost appears on next grab.
    c.simulateRelease(0, c.getSlotWorldPosition(0).add(new vec3(10, 5, 0)))
    this.check("DC3", "carton 0 snapped (dropped 10 cm off)", c.isCartonPlaced(0))
    this.check("DC3", "snapped square onto the slot", c.getCartonWorldPosition(0).distance(c.getSlotWorldPosition(0)) < 0.5)
    this.check("DC3", "counter reads 1 / 8", c.getCounterText() === "1 / 8")
    this.check("DC3", "ghost hidden after placing", !c.isGhostVisible() && !c.isGhostTagVisible())
    c.simulateGrab(1)
    this.check("DC3", "next ghost appears on grabbing carton 1", c.isGhostVisible() && c.getGhostWorldPosition().distance(c.getSlotWorldPosition(1)) < 0.5)
    this.check("DC3", "next tag reads '" + c.getGhostTagText() + "'", c.getGhostTagText() === ghostTagText(PICK_LIST[1]))
    c.simulateRelease(1, c.getSlotWorldPosition(1).add(new vec3(0, 5, 0)))
    this.check("DC3", "carton 1 snapped, counter 2 / 8", c.isCartonPlaced(1) && c.getCounterText() === "2 / 8")
    const before = c.getMistakes()
    c.simulateGrab(2)
    c.simulateRelease(2, c.getSlotWorldPosition(2).add(new vec3(0, 5, 30)))
    this.check("DC3", "drop 30 cm off the ghost (on pallet) does not snap", !c.isCartonPlaced(2) && c.getMistakes() === before + 1)
    await this.settle()
    c.simulateGrab(2)
    // 90 cm toward the user from the pallet centre: on the floor in front of the pallet.
    c.simulateRelease(2, c.getPalletWorldPosition().add(new vec3(0, 30, 90)))
    this.check("DC3", "release off the pallet: back to shelf, no mistake", !c.isCartonPlaced(2) && c.getMistakes() === before + 1)
    await this.settle()

    // DC4: crushable carton dropped while heavy is due -> back to shelf + red tip.
    const m = c.getMistakes()
    c.simulateGrab(7)
    this.check("DC4", "no ghost for a carton that isn't next", !c.isGhostVisible())
    c.simulateRelease(7, c.getPalletWorldPosition().add(new vec3(0, 40, 0)))
    this.check("DC4", "chips not placed, sliding back", !c.isCartonPlaced(7) && c.isCartonReturning(7))
    this.check("DC4", "red tip shows '" + c.getTipText() + "'", c.isTipVisible() && c.getTipText() === "Chips go on top. Heavy first.")
    this.check("DC4", "counts one mistake", c.getMistakes() === m + 1)
    await this.settle()
    this.check("DC4", "chips back at home on the shelf", c.getCartonWorldPosition(7).distance(c.getCartonHomePosition(7)) < 0.5)
    await this.wait(4.2)
    this.check("DC4", "tip hides after ~4 s", !c.isTipVisible())

    // DC5: after all 8, the completion card shows time + mistakes; Reset clears the pallet.
    for (let i = 2; i < 8; i++) this.dropOnSlot(i)
    this.check("DC5", "all 8 placed, counter 8 / 8", c.isComplete() && c.getCounterText() === "8 / 8")
    const card = c.getCompletionText()
    this.check("DC5", "completion card visible", c.isCompletionVisible())
    this.check("DC5", "card: '" + card.replace(/\n/g, " | ") + "'",
      card.indexOf("Time ") >= 0 && card.indexOf("Mistakes " + c.getMistakes()) >= 0 && card.indexOf("Wrap and label") >= 0)
    await this.wait(1)
    this.check("DC5", "card stays up", c.isCompletionVisible())
    c.pressReset()
    let allHome = true
    for (let i = 0; i < 8; i++) if (c.isCartonPlaced(i) || c.getCartonWorldPosition(i).distance(c.getCartonHomePosition(i)) > 0.5) allHome = false
    this.check("DC5", "Reset: pallet cleared, all cartons home", allHome)
    this.check("DC5", "Reset: counter 0 / 8, card hidden, mistakes 0", c.getCounterText() === "0 / 8" && !c.isCompletionVisible() && c.getMistakes() === 0)

    print("[StackRightTest] DONE: " + this.passed + " passed, " + this.failed + " failed")
  }

  // ---------------------------------------------------------------------------------------
  private dropOnSlot(i: number): void {
    this.controller.simulateGrab(i)
    this.controller.simulateRelease(i, this.controller.getSlotWorldPosition(i).add(new vec3(0, 5, 0)))
  }

  private cartonObject(i: number): SceneObject {
    return this.controller.pickList.getChild(i)
  }

  private check(dc: string, what: string, ok: boolean): void {
    if (ok) this.passed++
    else this.failed++
    print("[StackRightTest] " + (ok ? "PASS" : "FAIL") + " " + dc + ": " + what)
  }

  private async settle(): Promise<void> {
    for (let k = 0; k < 30; k++) {
      let busy = false
      for (let i = 0; i < this.controller.getCartonCount(); i++) if (this.controller.isCartonReturning(i)) busy = true
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
