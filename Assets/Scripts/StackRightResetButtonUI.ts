// StackRightResetButtonUI.ts
// Owns: the "Reset pallet" pinch button (UIKit Button + raw label), which sits on a short post
// at the pallet's near corner. Emits onReset; the controller decides what Reset does.
// Expects: nothing wired. Must not: change game state itself.
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const BUTTON_LABEL_Z = 0.08

@component
export class StackRightResetButtonUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightResetButtonUI – big pinch button that resets the pallet</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Button label")
  label: string = "Reset pallet"

  @input
  @hint("Button width in cm (brief: about 12 cm)")
  @widget(new SliderWidget(6, 30, 0.5))
  buttonWidth: number = 12

  @input
  @hint("Button height in cm")
  @widget(new SliderWidget(3, 15, 0.5))
  buttonHeight: number = 6

  @input
  @hint("Label text size")
  @widget(new SliderWidget(30, 120, 1))
  labelSize: number = 56

  @input
  @hint("Turn the button every frame so it faces the user")
  faceCamera: boolean = true
  @ui.group_end

  private _onReset = new Event<void>()
  get onReset(): PublicApi<void> {
    return this._onReset.publicApi()
  }

  private button: Button
  private camT: Transform | null = null

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const face = global.scene.createSceneObject("ButtonFace")
    face.setParent(this.sceneObject)
    this.button = face.createComponent(Button.getTypeName()) as Button
    this.button.size = new vec3(this.buttonWidth, this.buttonHeight, 1)
    this.button.onInitialized.add(() => {
      this.button.size = new vec3(this.buttonWidth, this.buttonHeight, 1)
    })
    this.button.onTriggerUp.add(() => this._onReset.invoke())

    const labelSO = global.scene.createSceneObject("ButtonLabel")
    labelSO.setParent(face)
    labelSO.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z + 0.5))
    const t = labelSO.createComponent("Component.Text") as Text
    t.text = this.label
    t.depthTest = true
    t.size = this.labelSize
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const w = this.buttonWidth - 0.5
    t.layoutRect = Rect.create(-w / 2, w / 2, -1.5, 1.5)

    this.createEvent("UpdateEvent").bind(() => this.faceUser())
  }

  /** Same path as a real pinch on the button (used by tests). */
  press(): void {
    this._onReset.invoke()
  }

  private faceUser(): void {
    if (!this.faceCamera) return
    if (!this.camT) {
      const cam = WorldCameraFinderProvider.getInstance()
      if (!cam) return
      this.camT = cam.getTransform()
    }
    const t = this.sceneObject.getTransform()
    const d = this.camT.getWorldPosition().sub(t.getWorldPosition())
    if (d.length < 0.001) return
    t.setWorldRotation(quat.lookAt(d.normalize(), vec3.up()))
  }
}
