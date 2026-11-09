// StackRightPickList.ts
// STAND-IN FOR BARCODE SCAN. A real picker's Lens would read the case's barcode when it is
// picked up. For the preview, the order is fixed: 34 cases of real store freight (sacks, cartons,
// shrink-wrapped tin trays, a long carton) in the warehouse system's heaviest-first sequence
// (5 layers). The learner should replace these lines with real order lines.
//
// Owns: the order (case data: name, weight, class, real size in cm, shape, colour, turned flag)
// and the LOAD PLAN, which is generated in code from the case sizes (not hand-placed): each layer
// is row (shelf) packed - cases in order, left to right while a row fits the 116.5 cm pallet, a
// new row nearer the user when it doesn't, row depth = deepest case in it, every row centred in x
// and the layer centred in z. A line can be given a ZONE (far or near half of the pallet): its
// cases are row packed inside that half, and when the half is full a new TIER starts on top. That
// is how a real order that can't fill a layer is built: a one-sided step (a hill) that a later
// line brings back to level. Also the plan checks (overlaps, level layers, steps, crossing joints).
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
  zone: Zone // part of the pallet its line fills
  color: vec4 // bright, light-saturated label colour (additive display: no dark colours)
}

/** Part of a layer a line fills: far = back half (z -58.25..0), near = front half (z 0..58.25), full = whole pallet. */
export type Zone = "full" | "far" | "near"

export interface PlannedSlot {
  center: vec3 // Pallet-local centre of the case when placed
  layer: number // 1..5
  turned: boolean // true = turned 90 degrees about up (case W runs along pallet z)
  zone: Zone
  tier: number // 0 = on the layer below, 1 = on the zone's first tier, ...
  row: number // 0 = far row (within the zone and tier)
  col: number // 0 = leftmost case in the row
}

export const PALLET_SIZE_CM = new vec3(116.5, 15, 116.5)
export const PALLET_DECK_Y = 15
export const HEIGHT_LIMIT_CM = 180
/** Largest step allowed between the two halves of a layer while it is built (one soup case high). */
export const MAX_STEP_CM = 26

interface OrderLine {key: string, name: string, kg: number, fragile: boolean, layer: number,
  w: number, d: number, h: number, count: number, shape: CaseShape, turned: boolean, zone?: Zone, color: vec4}

// The order, sizes W x D x H in cm, already heaviest first. Layers 1-3 and 5 use one case height
// each. Layer 4 is a real store layer: only 3 soup cases, enough for the back half, so the back
// steps up 26 cm (a hill); the tomato trays then fill the front two high (2 x 13 = 26) and the
// layer finishes level. Layers 3 and 4 are turned so their joints cross the layer below.
const ORDER_LINES: OrderLine[] = [
  {key: "PetFood", name: "PET FOOD 20kg", kg: 20, fragile: false, layer: 1, w: 55, d: 37, h: 14, count: 6, shape: "sack", turned: false, color: new vec4(1.0, 0.62, 0.5, 1)},
  {key: "Laundry", name: "LAUNDRY 4x4L", kg: 17, fragile: false, layer: 2, w: 38, d: 58, h: 30, count: 6, shape: "carton", turned: false, color: new vec4(0.6, 0.55, 1.0, 1)},
  {key: "Water", name: "WATER 24", kg: 14, fragile: false, layer: 3, w: 38, d: 58, h: 25, count: 4, shape: "carton", turned: true, color: new vec4(0.35, 0.75, 1.0, 1)},
  {key: "Juice", name: "JUICE 12x1L", kg: 12, fragile: false, layer: 3, w: 38, d: 29, h: 25, count: 4, shape: "carton", turned: true, color: new vec4(1.0, 0.7, 0.3, 1)},
  {key: "Soup", name: "SOUP 24x500g", kg: 11, fragile: false, layer: 4, w: 38, d: 57, h: 26, count: 3, shape: "carton", turned: false, zone: "far", color: new vec4(1.0, 0.55, 0.9, 1)},
  {key: "Tomatoes", name: "TINNED TOMATOES 2x24", kg: 10, fragile: false, layer: 4, w: 57, d: 38, h: 13, count: 6, shape: "tray", turned: true, zone: "near", color: new vec4(1.0, 0.42, 0.42, 1)},
  {key: "Bread", name: "BREAD", kg: 4, fragile: true, layer: 5, w: 56, d: 45, h: 30, count: 2, shape: "carton", turned: false, color: new vec4(1.0, 0.85, 0.45, 1)},
  {key: "PaperTowel", name: "PAPER TOWEL 12", kg: 3, fragile: false, layer: 5, w: 112, d: 25, h: 30, count: 1, shape: "long", turned: false, color: new vec4(0.8, 0.9, 1.0, 1)},
  {key: "Chips", name: "CHIPS", kg: 2, fragile: true, layer: 5, w: 56, d: 45, h: 30, count: 2, shape: "carton", turned: false, color: new vec4(0.5, 1.0, 0.6, 1)},
]

// Shown on the pallet when a layer is finished: true for this plan (see the joint check below).
const LAYER_DONE_NOTES: {[layer: number]: string} = {
  1: "Cartons next: their joints miss the sack seams.",
  2: "Next layer turns 90° so the joints cross.",
  3: "Heavy soup next: back half first.",
  4: "The front caught up: level again.",
}

// Shown when the last case of a zone lands and leaves the layer with a step.
const STEP_NOTES: {[layer: number]: string} = {
  4: "Not enough soup for a full layer: step at the back.\nThe trays fill the front, two high, back to level.",
}

function buildOrder(): CaseSpec[] {
  const out: CaseSpec[] = []
  for (const l of ORDER_LINES) {
    for (let k = 0; k < l.count; k++) {
      out.push({key: l.key, name: l.name, kg: l.kg, fragile: l.fragile, layer: l.layer,
        size: new vec3(l.w, l.h, l.d), shape: l.shape, turned: l.turned, zone: l.zone || "full", color: l.color})
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

/** z range (pallet-local, near edge = +z) of a zone. */
export function zoneRange(zone: Zone): vec2 {
  const h = PALLET_SIZE_CM.z / 2
  return zone === "far" ? new vec2(-h, 0) : zone === "near" ? new vec2(0, h) : new vec2(-h, h)
}

/**
 * Generates the slot plan for the whole order. For each layer and each zone in it, the zone's cases
 * in order, each with its footprint (turned when the line says so): fill a row left to right while
 * it fits the pallet, start a new row nearer the user when it doesn't (row depth = deepest case in
 * it), and start a new tier on top when the next row doesn't fit the zone's depth. Each row is
 * centred in x, each tier's rows in the zone's z range. The layer sits on the previous layer's top
 * and is as high as its highest zone. Prints an error when a row or zone overflows, a tier mixes
 * case heights, a finished layer is not level, or the step between zones ever exceeds MAX_STEP_CM
 * while the layer is built in order.
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

    const zones: Zone[] = []
    for (let k = start; k < i; k++) if (zones.indexOf(order[k].zone) < 0) zones.push(order[k].zone)
    let layerTop = bottom
    for (const zone of zones) {
      const zr = zoneRange(zone)
      const zoneDepth = zr.y - zr.x
      const tiers: {rows: {items: number[], width: number, depth: number}[], depth: number, height: number}[] = []
      for (let k = start; k < i; k++) {
        if (order[k].zone !== zone) continue
        const fp = footprint(order[k], order[k].turned)
        let tier = tiers[tiers.length - 1]
        let row = tier ? tier.rows[tier.rows.length - 1] : undefined
        if (!row || row.width + fp.x > S + 0.001) {
          if (!tier || tier.depth + fp.y > zoneDepth + 0.001) {
            tier = {rows: [], depth: 0, height: 0}
            tiers.push(tier)
          }
          row = {items: [], width: 0, depth: 0}
          tier.rows.push(row)
        }
        row.items.push(k)
        row.width += fp.x
        tier.depth += Math.max(0, fp.y - row.depth)
        row.depth = Math.max(row.depth, fp.y)
        tier.height = Math.max(tier.height, order[k].size.y)
      }

      let tierBottom = bottom
      tiers.forEach((t, ti) => {
        if (t.depth > zoneDepth + 0.001) print("[StackRightPickList] ERROR: layer " + layer + " " + zone + " zone is " + t.depth + " cm deep, zone is " + zoneDepth)
        let z = (zr.x + zr.y) / 2 - t.depth / 2
        t.rows.forEach((r, ri) => {
          if (r.width > S + 0.001) print("[StackRightPickList] ERROR: layer " + layer + " row is " + r.width + " cm wide, pallet is " + S)
          let x = -r.width / 2
          r.items.forEach((k, ci) => {
            const fp = footprint(order[k], order[k].turned)
            if (Math.abs(order[k].size.y - t.height) > 0.001) {
              print("[StackRightPickList] ERROR: layer " + layer + " tier mixes heights (" + order[k].name + " is " + order[k].size.y + " cm, tier is " + t.height + " cm)")
            }
            plan[k] = {
              center: new vec3(x + fp.x / 2, tierBottom + order[k].size.y / 2, z + r.depth / 2),
              layer, turned: order[k].turned, zone, tier: ti, row: ri, col: ci,
            }
            x += fp.x
          })
          z += r.depth
        })
        tierBottom += t.height
      })
      layerTop = Math.max(layerTop, tierBottom)
    }

    for (let k = start; k < i; k++) {
      const top = plan[k].center.y + order[k].size.y / 2
      if (Math.abs(top - layerTop) > 0.01 && !hasCaseOnTop(plan, order, k, start, i)) {
        print("[StackRightPickList] ERROR: layer " + layer + " is not level when finished (" + order[k].name + " top " + top + " cm, layer top " + layerTop + " cm)")
      }
      const step = stepAfter(plan, order, k)
      if (step > MAX_STEP_CM + 0.01) {
        print("[StackRightPickList] ERROR: layer " + layer + " step is " + step + " cm after case " + (k + 1) + ", max " + MAX_STEP_CM)
      }
    }
    bottom = layerTop
  }
  return plan
}

/** True when another case of the same layer (order indices from..to-1) sits directly on case k. */
function hasCaseOnTop(plan: PlannedSlot[], order: CaseSpec[], k: number, from: number, to: number): boolean {
  const top = plan[k].center.y + order[k].size.y / 2
  for (let j = from; j < to; j++) {
    if (j === k || Math.abs(plan[j].center.y - order[j].size.y / 2 - top) > 0.01) continue
    if (rectOverlap(rectOf(plan, order, k), rectOf(plan, order, j))) return true
  }
  return false
}

/**
 * Height difference (cm) between the highest and lowest zone of case k's layer right after case k
 * is placed, building in order. A zone with nothing placed yet counts at the layer's bottom; a
 * layer with one zone always gives 0.
 */
function stepAfter(plan: PlannedSlot[], order: CaseSpec[], k: number): number {
  const layer = order[k].layer
  let first = k
  while (first > 0 && order[first - 1].layer === layer) first--
  let last = k
  while (last + 1 < order.length && order[last + 1].layer === layer) last++
  let bottom = 1e9
  for (let j = first; j <= last; j++) bottom = Math.min(bottom, plan[j].center.y - order[j].size.y / 2)
  const tops: {[zone: string]: number} = {}
  for (let j = first; j <= last; j++) tops[order[j].zone] = bottom
  for (let j = first; j <= k; j++) tops[order[j].zone] = Math.max(tops[order[j].zone], plan[j].center.y + order[j].size.y / 2)
  let hi = -1e9, lo = 1e9
  for (const z in tops) { hi = Math.max(hi, tops[z]); lo = Math.min(lo, tops[z]) }
  return hi - lo
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

/** Step (cm) between the highest and lowest zone of case i's layer right after case i is placed. */
export function stepAfterCase(i: number): number {
  return stepAfter(PLAN, ORDER, i)
}

/** True when case i is the last of its zone, the layer goes on in another zone, and it leaves a step. */
export function isStepNoteAfter(i: number): boolean {
  return i + 1 < ORDER.length && ORDER[i + 1].layer === ORDER[i].layer && ORDER[i + 1].zone !== ORDER[i].zone &&
    stepAfterCase(i) > 0.01
}

export function stepNoteText(i: number): string {
  return STEP_NOTES[ORDER[i].layer] || "Step in the layer: fill the low side next, back to level."
}

// ---------------------------------------------------------------------------------------------
// Plan checks (used by the self-test, the LEAF scenarios and the report)
// ---------------------------------------------------------------------------------------------
interface Rect2 {x0: number, x1: number, z0: number, z1: number}

/** Joints closer than this (cm) count as touching: the two zones of a layer are centred in their halves. */
const JOINT_GAP_CM = 1.5

function rectOf(plan: PlannedSlot[], order: CaseSpec[], k: number): Rect2 {
  const fp = footprint(order[k], plan[k].turned)
  const c = plan[k].center
  return {x0: c.x - fp.x / 2, x1: c.x + fp.x / 2, z0: c.z - fp.y / 2, z1: c.z + fp.y / 2}
}

function rectOverlap(a: Rect2, b: Rect2): boolean {
  return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01
}

function slotRect(k: number): Rect2 {
  return rectOf(PLAN, ORDER, k)
}

function slotBottom(k: number): number { return PLAN[k].center.y - ORDER[k].size.y / 2 }
function slotTop(k: number): number { return PLAN[k].center.y + ORDER[k].size.y / 2 }

function layerSlots(layer: number): number[] {
  const out: number[] = []
  for (let k = 0; k < PLAN.length; k++) if (PLAN[k].layer === layer) out.push(k)
  return out
}

/** Zones used by the layer, in order of first case. */
export function layerZones(layer: number): Zone[] {
  const out: Zone[] = []
  for (const k of layerSlots(layer)) if (out.indexOf(PLAN[k].zone) < 0) out.push(PLAN[k].zone)
  return out
}

/** Top (cm above the floor) of a finished layer, or of one zone of it. */
export function layerTopCm(layer: number, zone?: Zone): number {
  let top = 0
  for (const k of layerSlots(layer)) if (!zone || PLAN[k].zone === zone) top = Math.max(top, slotTop(k))
  return top
}

/** Pairs of cases whose boxes overlap (same zone and tier, or anywhere in 3D), e.g. "3/4". Empty = none. */
export function planOverlaps(): string[] {
  const out: string[] = []
  for (let a = 0; a < PLAN.length; a++) {
    for (let b = a + 1; b < PLAN.length; b++) {
      if (!rectOverlap(slotRect(a), slotRect(b))) continue
      const sameTier = PLAN[a].layer === PLAN[b].layer && PLAN[a].zone === PLAN[b].zone && PLAN[a].tier === PLAN[b].tier
      const oy = Math.min(slotTop(a), slotTop(b)) - Math.max(slotBottom(a), slotBottom(b))
      if (sameTier || oy > 0.01) out.push(a + "/" + b)
    }
  }
  return out
}

/** Cases whose footprint reaches past the pallet edge or out of their zone. Empty = all inside. */
export function planOutsidePallet(): number[] {
  const h = PALLET_SIZE_CM.x / 2 + 0.01
  const out: number[] = []
  for (let k = 0; k < PLAN.length; k++) {
    const r = slotRect(k)
    const zr = zoneRange(PLAN[k].zone)
    if (r.x0 < -h || r.x1 > h || r.z0 < -h || r.z1 > h || r.z0 < zr.x - 0.01 || r.z1 > zr.y + 0.01) out.push(k)
  }
  return out
}

/** Cases on a tier above the first that are not fully carried by a case of the tier below. Empty = all carried. */
export function unsupportedTierSlots(): number[] {
  const out: number[] = []
  for (let k = 0; k < PLAN.length; k++) {
    if (PLAN[k].tier === 0) continue
    const r = slotRect(k)
    let carried = false
    for (const j of layerSlots(PLAN[k].layer)) {
      if (PLAN[j].zone !== PLAN[k].zone || PLAN[j].tier !== PLAN[k].tier - 1 || Math.abs(slotTop(j) - slotBottom(k)) > 0.01) continue
      const s = slotRect(j)
      if (s.x0 <= r.x0 + 0.01 && s.x1 >= r.x1 - 0.01 && s.z0 <= r.z0 + 0.01 && s.z1 >= r.z1 - 0.01) carried = true
    }
    if (!carried) out.push(k)
  }
  return out
}

/** True when the finished layer has one flat top: every case with nothing on it reaches the layer top. */
export function isLayerLevel(layer: number): boolean {
  const ks = layerSlots(layer)
  if (ks.length === 0) return false
  const top = layerTopCm(layer)
  for (const k of ks) {
    if (Math.abs(slotTop(k) - top) < 0.01) continue
    if (!ks.some(j => j !== k && Math.abs(slotBottom(j) - slotTop(k)) < 0.01 && rectOverlap(slotRect(j), slotRect(k)))) return false
  }
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

/**
 * Joints of a layer's bottom face (cases standing on the layer below) or top face (cases with
 * nothing of the layer on them). Cases closer than JOINT_GAP_CM count as touching.
 */
export function layerJoints(layer: number, face: "bottom" | "top" = "bottom"): Joint[] {
  const all = layerSlots(layer)
  const base = Math.min(...all.map(slotBottom))
  const top = layerTopCm(layer)
  const ks = all.filter(k => face === "bottom" ? Math.abs(slotBottom(k) - base) < 0.01 : Math.abs(slotTop(k) - top) < 0.01)
  const out: Joint[] = []
  for (const a of ks) {
    for (const b of ks) {
      if (a === b) continue
      const ra = slotRect(a), rb = slotRect(b)
      if (rb.x0 - ra.x1 > -0.01 && rb.x0 - ra.x1 < JOINT_GAP_CM) {
        const from = Math.max(ra.z0, rb.z0), to = Math.min(ra.z1, rb.z1)
        if (to - from > 0.01) out.push({axis: "x", at: (ra.x1 + rb.x0) / 2, from, to})
      }
      if (rb.z0 - ra.z1 > -0.01 && rb.z0 - ra.z1 < JOINT_GAP_CM) {
        const from = Math.max(ra.x0, rb.x0), to = Math.min(ra.x1, rb.x1)
        if (to - from > 0.01) out.push({axis: "z", at: (ra.z1 + rb.z0) / 2, from, to})
      }
    }
  }
  return out
}

/**
 * Joints of `upper`'s bottom face that run along a joint of the top face of the layer below (same
 * line within 2 cm, sharing more than 5 cm), e.g. "x=0 for 76 cm". Empty = every joint crosses.
 */
export function alignedJoints(upper: number): string[] {
  const out: string[] = []
  const lower = layerJoints(upper - 1, "top")
  for (const u of layerJoints(upper, "bottom")) {
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

/** One line per layer: zones, tiers, rows and footprints, for the log/report. */
export function describePlan(): string[] {
  const out: string[] = []
  for (let l = 1; l <= LAYER_COUNT; l++) {
    const parts: string[] = []
    for (const zone of layerZones(l)) {
      const groups: {[key: string]: string} = {}
      const keys: string[] = []
      for (const k of layerSlots(l)) {
        if (PLAN[k].zone !== zone) continue
        const fp = footprint(ORDER[k], PLAN[k].turned)
        const g = (zone === "full" ? "" : zone + " ") + (PLAN[k].tier > 0 || zone !== "full" ? "tier " + PLAN[k].tier + " " : "") + "row " + PLAN[k].row
        if (keys.indexOf(g) < 0) keys.push(g)
        groups[g] = (groups[g] ? groups[g] + " + " : "") + ORDER[k].key + " " + fp.x + "x" + fp.y
      }
      for (const g of keys) parts.push(g + " [" + groups[g] + "]")
    }
    const joints = layerJoints(l).map(j => j.axis + "=" + (Math.round(j.at * 10) / 10))
    out.push("layer " + l + (isTurnedLayer(l) ? " (turned)" : "") + ", top " + layerTopCm(l) + " cm: " + parts.join(" | ") +
      "; joints " + joints.filter((s, n) => joints.indexOf(s) === n).join(" "))
  }
  return out
}
