// StackRightPickList.ts
// STAND-IN FOR BARCODE SCAN. A real picker's Lens would read the case's barcode when it is
// picked up. For the preview, the order is fixed: 31 cases of real store freight (sacks, cartons,
// shrink-wrapped tin trays, a long carton) in the warehouse system's heaviest-first sequence
// (5 layers). The learner should replace these lines with real order lines.
//
// Owns: the order (case data: name, weight, class, real size in cm, shape, colour, turned flag)
// and the LOAD PLAN, which is generated in code from the case sizes (not hand-placed): each layer
// is row (shelf) packed - cases in order, left to right while a row fits the 116.5 cm pallet, a
// new row nearer the user when it doesn't, row depth = deepest case in it, every row centred in x
// and the layer centred in z. Also the plan checks (overlaps, level layers, crossing joints).
// Pure data/logic, no scene access.
// Must not: touch the scene, hold game state.
//
// Case sizes are W (x) x H (y) x D (z) in cm, in the case's own frame. Plan positions are in
// Pallet-local cm: x right, z toward the user (near edge = +z), y up from the floor.
// Pallet deck top is at y = 15.

/** How the case is drawn: carton (box), sack (soft bag), tray (tins in a shrink-wrapped tray), long (112 cm carton). */
export type CaseShape = "carton" | "sack" | "tray" | "long"

export interface CaseSpec {
  key: string // used in scene object names, e.g. Case_03_PetFood
  name: string // printed on the case
  kg: number
  fragile: boolean // true = crushable, goes on top
  layer: number // 1..5
  size: vec3 // W x H x D, cm (case frame)
  shape: CaseShape
  turned: boolean // placed turned 90 degrees about up (case W runs along pallet z)
  color: vec4 // bright, light-saturated label colour (additive display: no dark colours)
}

export interface PlannedSlot {
  center: vec3 // Pallet-local centre of the case when placed
  layer: number // 1..5
  turned: boolean // true = turned 90 degrees about up (case W runs along pallet z)
  row: number // 0 = far row
  col: number // 0 = leftmost case in the row
}

export const PALLET_SIZE_CM = new vec3(116.5, 15, 116.5)
export const PALLET_DECK_Y = 15
export const HEIGHT_LIMIT_CM = 180

interface OrderLine {key: string, name: string, kg: number, fragile: boolean, layer: number,
  w: number, d: number, h: number, count: number, shape: CaseShape, turned: boolean, color: vec4}

// The order, sizes W x D x H in cm, already heaviest first. Every case in a layer has the same H,
// so each layer finishes level. Layers 3 and 4 are turned so their joints cross the layer below.
const ORDER_LINES: OrderLine[] = [
  {key: "PetFood", name: "PET FOOD 20kg", kg: 20, fragile: false, layer: 1, w: 55, d: 37, h: 14, count: 6, shape: "sack", turned: false, color: new vec4(1.0, 0.62, 0.5, 1)},
  {key: "Laundry", name: "LAUNDRY 4x4L", kg: 17, fragile: false, layer: 2, w: 38, d: 58, h: 30, count: 6, shape: "carton", turned: false, color: new vec4(0.6, 0.55, 1.0, 1)},
  {key: "Water", name: "WATER 24", kg: 14, fragile: false, layer: 3, w: 38, d: 58, h: 25, count: 4, shape: "carton", turned: true, color: new vec4(0.35, 0.75, 1.0, 1)},
  {key: "Juice", name: "JUICE 12x1L", kg: 12, fragile: false, layer: 3, w: 38, d: 29, h: 25, count: 4, shape: "carton", turned: true, color: new vec4(1.0, 0.7, 0.3, 1)},
  {key: "Tomatoes", name: "TINNED TOMATOES 2x24", kg: 10, fragile: false, layer: 4, w: 57, d: 38, h: 13, count: 6, shape: "tray", turned: true, color: new vec4(1.0, 0.42, 0.42, 1)},
  {key: "Bread", name: "BREAD", kg: 4, fragile: true, layer: 5, w: 56, d: 45, h: 30, count: 2, shape: "carton", turned: false, color: new vec4(1.0, 0.85, 0.45, 1)},
  {key: "PaperTowel", name: "PAPER TOWEL 12", kg: 3, fragile: false, layer: 5, w: 112, d: 25, h: 30, count: 1, shape: "long", turned: false, color: new vec4(0.8, 0.9, 1.0, 1)},
  {key: "Chips", name: "CHIPS", kg: 2, fragile: true, layer: 5, w: 56, d: 45, h: 30, count: 2, shape: "carton", turned: false, color: new vec4(0.5, 1.0, 0.6, 1)},
]

// Shown on the pallet when a layer is finished: true for this plan (see the joint check below).
const LAYER_DONE_NOTES: {[layer: number]: string} = {
  1: "Cartons next: their joints miss the sack seams.",
  2: "Next layer turns 90° so the joints cross.",
  3: "Flat trays next: keep the top level.",
  4: "Light and fragile last: bread, towels, chips.",
}

function buildOrder(): CaseSpec[] {
  const out: CaseSpec[] = []
  for (const l of ORDER_LINES) {
    for (let k = 0; k < l.count; k++) {
      out.push({key: l.key, name: l.name, kg: l.kg, fragile: l.fragile, layer: l.layer,
        size: new vec3(l.w, l.h, l.d), shape: l.shape, turned: l.turned, color: l.color})
    }
  }
  return out
}

export const ORDER: CaseSpec[] = buildOrder()
export const LAYER_COUNT = ORDER.reduce((m, c) => Math.max(m, c.layer), 0)

/** True when the layer's cases are placed turned 90 degrees (from the order data). */
export function isTurnedLayer(layer: number): boolean {
  for (const c of ORDER) if (c.layer === layer && c.turned) return true
  return false
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
 * Generates the slot plan for the whole order. For each layer: take its cases in order, each with
 * its footprint (turned when the line says so), fill a row left to right while it fits the pallet,
 * start a new row nearer the user when it doesn't (row depth = deepest case in it), centre each
 * row in x and the whole layer in z, and stack the layer on the previous layer's top. Prints an
 * error when a layer overflows the pallet or mixes case heights.
 */
export function buildPlan(order: CaseSpec[]): PlannedSlot[] {
  const plan: PlannedSlot[] = []
  const S = PALLET_SIZE_CM.x
  let bottom = PALLET_DECK_Y
  let i = 0
  while (i < order.length) {
    const layer = order[i].layer
    const start = i
    while (i < order.length && order[i].layer === layer) i++

    const rows: {items: number[], width: number, depth: number}[] = []
    for (let k = start; k < i; k++) {
      const fp = footprint(order[k], order[k].turned)
      let row = rows[rows.length - 1]
      if (!row || row.width + fp.x > S + 0.001) {
        row = {items: [], width: 0, depth: 0}
        rows.push(row)
      }
      row.items.push(k)
      row.width += fp.x
      row.depth = Math.max(row.depth, fp.y)
    }

    const height = order[start].size.y
    let depth = 0
    for (const r of rows) {
      depth += r.depth
      if (r.width > S + 0.001) print("[StackRightPickList] ERROR: layer " + layer + " row is " + r.width + " cm wide, pallet is " + S)
    }
    if (depth > S + 0.001) print("[StackRightPickList] ERROR: layer " + layer + " is " + depth + " cm deep, pallet is " + S)
    for (let k = start; k < i; k++) {
      if (Math.abs(order[k].size.y - height) > 0.001) {
        print("[StackRightPickList] ERROR: layer " + layer + " mixes heights (" + order[k].name + " is " + order[k].size.y + " cm, layer is " + height + " cm)")
      }
    }

    let z = -depth / 2
    rows.forEach((r, ri) => {
      let x = -r.width / 2
      r.items.forEach((k, ci) => {
        const fp = footprint(order[k], order[k].turned)
        plan.push({
          center: new vec3(x + fp.x / 2, bottom + order[k].size.y / 2, z + r.depth / 2),
          layer, turned: order[k].turned, row: ri, col: ci,
        })
        x += fp.x
      })
      z += r.depth
    })
    bottom += height
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
  return "Layer " + layer + " done.\n" + (LAYER_DONE_NOTES[layer] || "Start the next layer on the ghost.")
}

// ---------------------------------------------------------------------------------------------
// Plan checks (used by the self-test, the LEAF scenarios and the report)
// ---------------------------------------------------------------------------------------------
interface Rect2 {x0: number, x1: number, z0: number, z1: number}

function slotRect(k: number): Rect2 {
  const fp = footprint(ORDER[k], PLAN[k].turned)
  const c = PLAN[k].center
  return {x0: c.x - fp.x / 2, x1: c.x + fp.x / 2, z0: c.z - fp.y / 2, z1: c.z + fp.y / 2}
}

function layerSlots(layer: number): number[] {
  const out: number[] = []
  for (let k = 0; k < PLAN.length; k++) if (PLAN[k].layer === layer) out.push(k)
  return out
}

/** Pairs of cases in the same layer whose footprints overlap, e.g. "3/4". Empty = no overlaps. */
export function planOverlaps(): string[] {
  const out: string[] = []
  for (let a = 0; a < PLAN.length; a++) {
    for (let b = a + 1; b < PLAN.length; b++) {
      if (PLAN[a].layer !== PLAN[b].layer) continue
      const ra = slotRect(a), rb = slotRect(b)
      const ox = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0)
      const oz = Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0)
      if (ox > 0.01 && oz > 0.01) out.push(a + "/" + b)
    }
  }
  return out
}

/** Cases whose footprint reaches past the pallet edge. Empty = all inside. */
export function planOutsidePallet(): number[] {
  const h = PALLET_SIZE_CM.x / 2 + 0.01
  const out: number[] = []
  for (let k = 0; k < PLAN.length; k++) {
    const r = slotRect(k)
    if (r.x0 < -h || r.x1 > h || r.z0 < -h || r.z1 > h) out.push(k)
  }
  return out
}

/** True when every case in the layer has its top at the same height. */
export function isLayerLevel(layer: number): boolean {
  const ks = layerSlots(layer)
  if (ks.length === 0) return false
  const top = PLAN[ks[0]].center.y + ORDER[ks[0]].size.y / 2
  for (const k of ks) if (Math.abs(PLAN[k].center.y + ORDER[k].size.y / 2 - top) > 0.01) return false
  return true
}

/** Number of different footprints (size in pallet axes) in the layer. */
export function layerFootprintCount(layer: number): number {
  const seen: string[] = []
  for (const k of layerSlots(layer)) {
    const fp = footprint(ORDER[k], PLAN[k].turned)
    const key = fp.x.toFixed(1) + "x" + fp.y.toFixed(1)
    if (seen.indexOf(key) < 0) seen.push(key)
  }
  return seen.length
}

/** A joint: where two neighbouring cases in a layer touch. axis "x" = a line x = at (running along z). */
export interface Joint {axis: "x" | "z", at: number, from: number, to: number}

export function layerJoints(layer: number): Joint[] {
  const ks = layerSlots(layer)
  const out: Joint[] = []
  for (const a of ks) {
    for (const b of ks) {
      if (a === b) continue
      const ra = slotRect(a), rb = slotRect(b)
      if (Math.abs(ra.x1 - rb.x0) < 0.01) {
        const from = Math.max(ra.z0, rb.z0), to = Math.min(ra.z1, rb.z1)
        if (to - from > 0.01) out.push({axis: "x", at: ra.x1, from, to})
      }
      if (Math.abs(ra.z1 - rb.z0) < 0.01) {
        const from = Math.max(ra.x0, rb.x0), to = Math.min(ra.x1, rb.x1)
        if (to - from > 0.01) out.push({axis: "z", at: ra.z1, from, to})
      }
    }
  }
  return out
}

/**
 * Joints of `upper` that run along a joint of the layer below (same line within 2 cm, sharing more
 * than 5 cm), e.g. "x=0 for 76 cm". Empty = every joint crosses the layer below.
 */
export function alignedJoints(upper: number): string[] {
  const out: string[] = []
  const lower = layerJoints(upper - 1)
  for (const u of layerJoints(upper)) {
    for (const l of lower) {
      if (u.axis !== l.axis || Math.abs(u.at - l.at) > 2) continue
      const shared = Math.min(u.to, l.to) - Math.max(u.from, l.from)
      if (shared > 5) {
        const s = u.axis + "=" + (Math.round(u.at * 10) / 10) + " for " + Math.round(shared) + " cm"
        if (out.indexOf(s) < 0) out.push(s)
      }
    }
  }
  return out
}

/** One line per layer: rows and footprints, for the log/report. */
export function describePlan(): string[] {
  const out: string[] = []
  for (let l = 1; l <= LAYER_COUNT; l++) {
    const rows: string[] = []
    for (const k of layerSlots(l)) {
      const fp = footprint(ORDER[k], PLAN[k].turned)
      const r = PLAN[k].row
      rows[r] = (rows[r] ? rows[r] + " + " : "") + ORDER[k].key + " " + fp.x + "x" + fp.y
    }
    const ks = layerSlots(l)
    out.push("layer " + l + (isTurnedLayer(l) ? " (turned)" : "") + ", top " + (PLAN[ks[0]].center.y + ORDER[ks[0]].size.y / 2) +
      " cm: " + rows.map((s, r) => "row " + r + " [" + s + "]").join(" | "))
  }
  return out
}
