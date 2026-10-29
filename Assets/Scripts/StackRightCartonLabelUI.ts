// StackRightCartonLabelUI.ts
// Owns: the printed labels on one carton (name + "14 kg · HEAVY" / "FRAGILE") on the faces the
// user sees: the side facing the pallet (-X, seen while the carton is on the shelf), the near
// side (+Z, seen on the pallet) and the top. Created at runtime by the controller on each carton.
// Must not: hold game state.

@component
export class StackRightCartonLabelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">StackRightCartonLabelUI – printed carton labels</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Label text size (about 44 = 1 cm em height)")
  @widget(new SliderWidget(40, 300, 1))
  labelSize: number = 120

  @ui.group_end

  setup(name: string, detail: string, size: vec3): void {
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2
    const off = 0.3
    // -X face (seen from the pallet side while on the shelf): +Z normal rotated to -X
    this.face("LabelSide", name, detail, new vec3(-hx - off, 0, 0), quat.angleAxis(-Math.PI / 2, vec3.up()), size.z, size.y)
    // +Z face (near side on the pallet)
    this.face("LabelFront", name, detail, new vec3(0, 0, hz + off), quat.quatIdentity(), size.x, size.y)
    // top face, readable from the user's side
    this.face("LabelTop", name, detail, new vec3(0, hy + off, 0), quat.angleAxis(-Math.PI / 2, vec3.right()), size.x, size.z)
  }

  private face(objName: string, name: string, detail: string, pos: vec3, rot: quat, w: number, h: number): void {
    const so = global.scene.createSceneObject(objName)
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(pos)
    so.getTransform().setLocalRotation(rot)
    const t = so.createComponent("Component.Text") as Text
    t.text = name + "\n" + detail
    t.size = this.labelSize
    t.depthTest = true
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Shrink
    const hw = w / 2 - 2
    const hh = h / 2 - 2
    t.layoutRect = Rect.create(-hw, hw, -hh, hh)
  }
}
