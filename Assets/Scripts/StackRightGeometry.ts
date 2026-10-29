// StackRightGeometry.ts
// Owns: tiny helpers that build primitive box visuals (pallet, shelves, cartons, ghost, arrow)
// from one 1 cm box mesh + one unlit material that is cloned per box. These are the obvious
// placeholder visuals; swap the boxMesh / baseMaterial @inputs on the controller to upgrade.
// Scale always lives on the leaf "Visual" child, never on a node that owns a collider.
// Must not: hold game state or create text.

export class BoxFactory {
  constructor(private mesh: RenderMesh, private baseMaterial: Material) {}

  makeMaterial(color: vec4, translucent: boolean): Material {
    const mat = this.baseMaterial.clone()
    mat.mainPass.baseColor = color
    if (translucent) {
      mat.mainPass.blendMode = BlendMode.Normal
      mat.mainPass.depthWrite = false
    }
    return mat
  }

  /** Creates a child SceneObject with a box visual of `size` cm centred at `localPos`. */
  makeBox(parent: SceneObject, name: string, size: vec3, localPos: vec3, color: vec4,
    translucent: boolean = false): RenderMeshVisual {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.getTransform()
    t.setLocalPosition(localPos)
    t.setLocalScale(size)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.mesh
    rmv.mainMaterial = this.makeMaterial(color, translucent)
    return rmv
  }

  /** 12 thin bars outlining a box of `size` centred at the parent's origin. */
  makeWireBox(parent: SceneObject, name: string, size: vec3, thickness: number, color: vec4): SceneObject {
    const root = global.scene.createSceneObject(name)
    root.setParent(parent)
    const mat = this.makeMaterial(color, true)
    for (let i = 0; i < 12; i++) {
      const bar = global.scene.createSceneObject("Edge" + i)
      bar.setParent(root)
      const rmv = bar.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = this.mesh
      rmv.mainMaterial = mat
    }
    BoxFactory.layoutWireBox(root, size, thickness)
    return root
  }

  static layoutWireBox(root: SceneObject, size: vec3, th: number): void {
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2
    const specs: [vec3, vec3][] = []
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) specs.push([new vec3(0, sy * hy, sz * hz), new vec3(size.x + th, th, th)])
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) specs.push([new vec3(sx * hx, 0, sz * hz), new vec3(th, size.y + th, th)])
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) specs.push([new vec3(sx * hx, sy * hy, 0), new vec3(th, th, size.z + th)])
    for (let i = 0; i < 12 && i < root.getChildrenCount(); i++) {
      const t = root.getChild(i).getTransform()
      t.setLocalPosition(specs[i][0])
      t.setLocalScale(specs[i][1])
    }
  }
}
