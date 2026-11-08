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

  /** Creates a child SceneObject with a box visual of `size` cm centred at `localPos` (`material` = share one). */
  makeBox(parent: SceneObject, name: string, size: vec3, localPos: vec3, color: vec4,
    translucent: boolean = false, material: Material = null): RenderMeshVisual {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.getTransform()
    t.setLocalPosition(localPos)
    t.setLocalScale(size)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.mesh
    rmv.mainMaterial = material || this.makeMaterial(color, translucent)
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

// ---------------------------------------------------------------------------------------------
// MeshBuilder shapes for the freight (built once, shared by every case of that shape)
// ---------------------------------------------------------------------------------------------
type V3 = [number, number, number]

/** Collects triangles and fixes their winding so each one faces `outward` (CCW from outside). */
class TriMesh {
  verts: number[] = []
  idx: number[] = []
  private n = 0

  vertex(p: V3, nrm: V3): number {
    this.verts.push(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], 0, 0)
    return this.n++
  }

  tri(a: number, b: number, c: number, outward: V3): void {
    const P = (k: number): V3 => [this.verts[k * 8], this.verts[k * 8 + 1], this.verts[k * 8 + 2]]
    const pa = P(a), pb = P(b), pc = P(c)
    const u: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]]
    const v: V3 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]
    const cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0]
    if (cx * outward[0] + cy * outward[1] + cz * outward[2] >= 0) this.idx.push(a, b, c)
    else this.idx.push(a, c, b)
  }

  build(): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2},
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    mb.appendVerticesInterleaved(this.verts)
    mb.appendIndices(this.idx)
    mb.updateMesh()
    return mb.getMesh()
  }
}

function spow(v: number, e: number): number {
  return (v < 0 ? -1 : 1) * Math.pow(Math.abs(v), e)
}

export class ShapeMeshes {
  private static pillow: RenderMesh = null
  private static tinBodies: RenderMesh = null
  private static tinLids: RenderMesh = null

  /**
   * Soft sack: a 1 cm superellipsoid (boxy in plan, rounded top and bottom), centred on the
   * origin. Scale it to the sack size like the 1 cm box mesh.
   */
  static pillowMesh(): RenderMesh {
    if (ShapeMeshes.pillow) return ShapeMeshes.pillow
    const m = new TriMesh()
    const LAT = 10, LON = 28, eV = 0.55, eH = 0.3
    const ring: number[][] = []
    for (let i = 0; i <= LAT; i++) {
      const th = -Math.PI / 2 + Math.PI * i / LAT
      const row: number[] = []
      for (let j = 0; j < LON; j++) {
        const ph = 2 * Math.PI * j / LON
        const r = spow(Math.cos(th), eV)
        const p: V3 = [0.5 * r * spow(Math.cos(ph), eH), 0.5 * spow(Math.sin(th), eV), 0.5 * r * spow(Math.sin(ph), eH)]
        const len = Math.max(1e-6, Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]))
        row.push(m.vertex(p, [p[0] / len, p[1] / len, p[2] / len]))
      }
      ring.push(row)
    }
    const at = (k: number): V3 => [m.verts[k * 8], m.verts[k * 8 + 1], m.verts[k * 8 + 2]]
    for (let i = 0; i < LAT; i++) {
      for (let j = 0; j < LON; j++) {
        const a = ring[i][j], b = ring[i][(j + 1) % LON], c = ring[i + 1][(j + 1) % LON], d = ring[i + 1][j]
        const o = at(c), o2 = at(a)
        const out: V3 = [o[0] + o2[0], o[1] + o2[1], o[2] + o2[2]]
        m.tri(a, b, c, out)
        m.tri(a, c, d, out)
      }
    }
    ShapeMeshes.pillow = m.build()
    return ShapeMeshes.pillow
  }

  /**
   * Tins for a tray, in cm, centred on the origin in x/z with the tin bottoms at y = 0: a grid of
   * `cols` x `rows` short cylinders filling `areaX` x `areaZ`. Bodies and lids are separate meshes
   * so they can take different colours. Shared by every tray (all trays in the order are the same).
   */
  static tinMeshes(cols: number, rows: number, areaX: number, areaZ: number, height: number): RenderMesh[] {
    if (ShapeMeshes.tinBodies) return [ShapeMeshes.tinBodies, ShapeMeshes.tinLids]
    const SEG = 14
    const pitchX = areaX / cols, pitchZ = areaZ / rows
    const r = Math.min(pitchX, pitchZ) / 2 - 0.4
    const bodies = new TriMesh(), lids = new TriMesh()
    for (let cx = 0; cx < cols; cx++) {
      for (let cz = 0; cz < rows; cz++) {
        const ox = -areaX / 2 + pitchX * (cx + 0.5), oz = -areaZ / 2 + pitchZ * (cz + 0.5)
        const bot: number[] = [], top: number[] = [], lid: number[] = []
        for (let s = 0; s < SEG; s++) {
          const a = 2 * Math.PI * s / SEG
          const nx = Math.cos(a), nz = Math.sin(a)
          bot.push(bodies.vertex([ox + r * nx, 0, oz + r * nz], [nx, 0, nz]))
          top.push(bodies.vertex([ox + r * nx, height, oz + r * nz], [nx, 0, nz]))
          lid.push(lids.vertex([ox + (r - 0.3) * nx, height + 0.2, oz + (r - 0.3) * nz], [0, 1, 0]))
        }
        const centre = lids.vertex([ox, height + 0.2, oz], [0, 1, 0])
        for (let s = 0; s < SEG; s++) {
          const s2 = (s + 1) % SEG
          const am = 2 * Math.PI * (s + 0.5) / SEG
          const out: V3 = [Math.cos(am), 0, Math.sin(am)]
          bodies.tri(bot[s], bot[s2], top[s2], out)
          bodies.tri(bot[s], top[s2], top[s], out)
          lids.tri(centre, lid[s], lid[s2], [0, 1, 0])
        }
      }
    }
    ShapeMeshes.tinBodies = bodies.build()
    ShapeMeshes.tinLids = lids.build()
    return [ShapeMeshes.tinBodies, ShapeMeshes.tinLids]
  }
}
