// StackRightPickList.ts
// STAND-IN FOR BARCODE SCAN. A real picker's Lens would read the case's barcode when it is
// picked up. For the preview, the order is fixed: 30 cases in the warehouse system's
// heaviest-first sequence (5 layers). The learner should replace these lines with real order lines.
//
// Owns: the order (case data: name, weight, class, real size in cm, colour) and the LOAD PLAN,
// which is generated in code from the case sizes (not hand-placed): each layer is a centred grid
// of as many cases as fit the 116.5 cm pallet, and layers 2 and 4 are turned 90 degrees so the
// joints don't line up (interlock). Pure data/logic, no scene access.
// Must not: touch the scene, hold game state.
//
// Case sizes are W (x) x H (y) x D (z) in cm, in the case's own frame. Plan positions are in
// Pallet-local cm: x right, z toward the user (near edge = +z), y up from the floor.
// Pallet deck top is at y = 15.

export interface CaseSpec {
  key: string // used in scene object names, e.g. Case_03_Laundry
  name: string // printed on the case
  kg: number
  fragile: boolean // true = crushable, goes on top
  layer: number // 1..5
  size: vec3 // W x H x D, cm (case frame)
  color: vec4 // bright, light-saturated label colour (additive display: no dark colours)
}

export interface PlannedSlot {
  center: vec3 // Pallet-local centre of the case when placed
  layer: number // 1..5
  turned: boolean // true = turned 90 degrees about up (case W runs along pallet z)
  row: number // 0 = far row
  col: number // 0 = left column
}

export const PALLET_SIZE_CM = new vec3(116.5, 15, 116.5)
export const PALLET_DECK_Y = 15
export const HEIGHT_LIMIT_CM = 180
/** Layers that are turned 90 degrees relative to layer 1 (interlock). */
export const TURNED_LAYERS = [2, 4]

interface OrderLine {key: string, name: string, kg: number, fragile: boolean, layer: number,
  w: number, d: number, h: number, count: number, color: vec4}

// The order from devpost/design-brief.md, sizes W x D x H in cm, already heaviest first.
const ORDER_LINES: OrderLine[] = [
  {key: "Laundry", name: "LAUNDRY 4x4L", kg: 17, fragile: false, layer: 1, w: 38, d: 58, h: 30, count: 6, color: new vec4(0.6, 0.55, 1.0, 1)},
  {key: "Water", name: "WATER 24", kg: 14, fragile: false, layer: 2, w: 38, d: 58, h: 30, count: 6, color: new vec4(0.35, 0.75, 1.0, 1)},
  {key: "Tomatoes", name: "TOMATOES 24", kg: 10, fragile: false, layer: 3, w: 29, d: 58, h: 25, count: 8, color: new vec4(1.0, 0.4, 0.5, 1)},
  {key: "SoftDrink", name: "SOFT DRINK 24", kg: 9, fragile: false, layer: 4, w: 38, d: 58, h: 25, count: 6, color: new vec4(1.0, 0.6, 0.3, 1)},
  {key: "Eggs", name: "EGGS", kg: 10, fragile: true, layer: 5, w: 58, d: 58, h: 32, count: 1, color: new vec4(1.0, 0.92, 0.7, 1)},
  {key: "Bread", name: "BREAD", kg: 4, fragile: true, layer: 5, w: 58, d: 58, h: 32, count: 1, color: new vec4(1.0, 0.8, 0.5, 1)},
  {key: "Chips", name: "CHIPS", kg: 2, fragile: true, layer: 5, w: 58, d: 58, h: 32, count: 2, color: new vec4(0.5, 1.0, 0.6, 1)},
]

function buildOrder(): CaseSpec[] {
  const out: CaseSpec[] = []
  for (const l of ORDER_LINES) {
    for (let k = 0; k < l.count; k++) {
      out.push({key: l.key, name: l.name, kg: l.kg, fragile: l.fragile, layer: l.layer,
        size: new vec3(l.w, l.h, l.d), color: l.color})
    }
  }
  return out
}

export const ORDER: CaseSpec[] = buildOrder()
export const LAYER_COUNT = ORDER.reduce((m, c) => Math.max(m, c.layer), 0)

export function isTurnedLayer(layer: number): boolean {
  return TURNED_LAYERS.indexOf(layer) >= 0
}

/** Footprint on the pallet (x = across, z = depth) of a case in the planned orientation. */
export function footprint(spec: CaseSpec, turned: boolean): vec2 {
  return turned ? new vec2(spec.size.z, spec.size.x) : new vec2(spec.size.x, spec.size.z)
}

/** Ghost / placed size in pallet axes: the case size with x and z swapped when turned. */
export function plannedSize(spec: CaseSpec, turned: boolean): vec3 {
  return turned ? new vec3(spec.size.z, spec.size.y, spec.size.x) : spec.size
}

/**
 * Generates the slot plan for the whole order. For each layer: take the footprint of the layer's
 * case (turned 90 degrees on TURNED_LAYERS), fit as many as fit the pallet as a centred, tight
 * grid, fill far row to near row, left to right, and stack the layer on the previous layer's top.
 * Every case in a layer must share one footprint and height (out of scope: mixed layers).
 */
export function buildPlan(order: CaseSpec[]): PlannedSlot[] {
  const plan: PlannedSlot[] = []
  let bottom = PALLET_DECK_Y
  let i = 0
  while (i < order.length) {
    const layer = order[i].layer
    const first = order[i]
    const turned = isTurnedLayer(layer)
    const fp = footprint(first, turned)
    const cols = Math.floor(PALLET_SIZE_CM.x / fp.x)
    const rows = Math.floor(PALLET_SIZE_CM.z / fp.y)
    const x0 = -(cols * fp.x) / 2 + fp.x / 2
    const z0 = -(rows * fp.y) / 2 + fp.y / 2
    let n = 0
    while (i < order.length && order[i].layer === layer) {
      if (n >= cols * rows) {
        print("[StackRightPickList] ERROR: layer " + layer + " has more cases than fit (" + cols * rows + ")")
        break
      }
      const row = Math.floor(n / cols)
      const col = n % cols
      plan.push({
        center: new vec3(x0 + col * fp.x, bottom + first.size.y / 2, z0 + row * fp.y),
        layer, turned, row, col,
      })
      n++
      i++
    }
    while (i < order.length && order[i].layer === layer) i++ // skip any overflow
    bottom += first.size.y
  }
  return plan
}

export const PLAN: PlannedSlot[] = buildPlan(ORDER)

/** Top of the finished stack above the floor (cm). */
export const STACK_HEIGHT_CM = PLAN.reduce((m, s, k) => Math.max(m, s.center.y + ORDER[k].size.y / 2), PALLET_DECK_Y)

/** Number of cases in each layer, index = layer. */
export function layerCaseCount(layer: number): number {
  let n = 0
  for (const c of ORDER) if (c.layer === layer) n++
  return n
}

/** True when case i is the last one of its layer in the order. */
export function isLastOfLayer(i: number): boolean {
  return i < ORDER.length && (i === ORDER.length - 1 || ORDER[i + 1].layer !== ORDER[i].layer)
}

export function ghostTagText(i: number): string {
  return "Layer " + ORDER[i].layer + " · " + (i + 1) + " of " + ORDER.length + " · " + ORDER[i].kg + " kg"
}

export function layerDoneText(layer: number): string {
  return "Layer " + layer + " done.\nNext layer turns 90° so the joints don't line up."
}
