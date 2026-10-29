// StackRightLabelUI.ts
// Owns: one world-space label = UIKit BackPlate (translucent panel) + one light Text.
// Used for the ghost tag, the "3 / 8" counter, the red tip, and the completion card.
// Passive view: the controller pushes text/visibility in through setText / setVisible.
// Expects: nothing wired; all fields are Inspector-tunable presentation.
// Must not: hold game state or make game decisions.
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

@component
export class StackRightLabelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightLabelUI – translucent panel with light text</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Panel width in cm")
  @widget(new SliderWidget(4, 120, 0.5))
  panelWidth: number = 30

  @input
  @hint("Panel height in cm")
  @widget(new SliderWidget(2, 60, 0.5))
  panelHeight: number = 8

  @input
  @hint("Text size (about 44 = 1 cm em height; 180 = about 4 cm)")
  @widget(new SliderWidget(40, 400, 1))
  textSize: number = 180

  @input("vec4", "{1,1,1,1}")
  @hint("Text colour. Keep it light: the Specs display is additive, so dark colours look see-through.")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Text shown before the controller sets anything")
  initialText: string = ""

  @input
  @hint("Visible when the Lens starts")
  startVisible: boolean = true

  @input
  @hint("Turn the panel every frame so it faces the user's eyes")
  faceCamera: boolean = true
  @ui.group_end

  private text: Text
  private backPlate: BackPlate
  private ready = false
  private wantVisible = true
  private currentText = ""
  private camT: Transform | null = null

  onAwake(): void {
    this.wantVisible = this.startVisible
    this.currentText = this.initialText
    this.sceneObject.createComponent("Component.Canvas")
    this.backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.backPlate.size = new vec2(this.panelWidth, this.panelHeight)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    this.text = content.createComponent("Component.Text") as Text
    this.text.depthTest = true
    this.text.size = this.textSize
    this.text.textFill.color = this.textColor
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Shrink
    this.text.verticalOverflow = VerticalOverflow.Shrink
    const hw = this.panelWidth / 2 - 0.8
    const hh = this.panelHeight / 2 - 0.5
    this.text.layoutRect = Rect.create(-hw, hw, -hh, hh)
    this.text.text = this.currentText

    this.backPlate.onInitialized.add(() => {
      this.backPlate.size = new vec2(this.panelWidth, this.panelHeight)
      this.ready = true
      this.sceneObject.enabled = this.wantVisible
    })

    this.createEvent("UpdateEvent").bind(() => this.faceUser())
  }

  setText(msg: string): void {
    this.currentText = msg
    if (this.text) this.text.text = msg
  }

  getText(): string {
    return this.currentText
  }

  setTextColor(c: vec4): void {
    if (this.text) this.text.textFill.color = c
  }

  setVisible(v: boolean): void {
    this.wantVisible = v
    if (this.ready) this.sceneObject.enabled = v
  }

  /** Logical visibility (what the controller asked for). */
  isVisible(): boolean {
    return this.wantVisible
  }

  private faceUser(): void {
    if (!this.faceCamera) return
    if (!this.camT) {
      const cam = WorldCameraFinderProvider.getInstance()
      if (!cam) return
      this.camT = cam.getTransform()
    }
    const t = this.sceneObject.getTransform()
    const dir = this.camT.getWorldPosition().sub(t.getWorldPosition())
    if (dir.length < 0.001) return
    t.setWorldRotation(quat.lookAt(dir.normalize(), vec3.up()))
  }
}
