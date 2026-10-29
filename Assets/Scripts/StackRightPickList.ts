// StackRightPickList.ts
// STAND-IN FOR BARCODE SCAN. A real picker's Lens would read the carton's barcode when it is
// picked up. For the preview, the pick list is fixed: 8 cartons in a set order, heaviest first.
// The learner should replace these lines with real lines from their warehouse.
//
// Owns: carton data (name, weight, class, real size in cm, colour) and the slot plan
// (where each carton goes on the 116.5 x 116.5 cm pallet). Pure data, no scene access.
// Must not: touch the scene, hold game state.
//
// Sizes are W (x) x H (y) x D (z) in cm. Slot positions are in Pallet-local cm:
// x right, z toward the user (near edge = +z), y = bottom of the carton above the floor.
// Pallet deck top is at y = 15. Layer 1 cartons are 32 cm tall, so layer 2 sits at y = 47.

export interface CartonSpec {
  key: string // used in scene object names, e.g. Carton_0_Water
  name: string // shown on the carton
  tipName: string // used in the red tip, e.g. "Chips go on top."
  tipVerb: string // "go" / "goes"
  kg: number
  heavy: boolean // false = light + fragile (crushable)
  layer: number // 1 or 2
  size: vec3 // W x H x D, cm
  color: vec4 // bright, light-saturated label colour (additive display: no dark colours)
  slot: vec3 // Pallet-local: x, bottom y, z
}

export const PALLET_SIZE_CM = new vec3(116.5, 15, 116.5)
export const PALLET_DECK_Y = 15

export const PICK_LIST: CartonSpec[] = [
  {key: "Water", name: "WATER 24", tipName: "Water", tipVerb: "goes", kg: 14, heavy: true, layer: 1,
    size: new vec3(56, 32, 46), color: new vec4(0.3, 0.72, 1.0, 1), slot: new vec3(-28.5, 15, -34)},
  {key: "SoftDrink", name: "SOFT DRINK", tipName: "Soft drink", tipVerb: "goes", kg: 9, heavy: true, layer: 1,
    size: new vec3(56, 32, 46), color: new vec4(1.0, 0.45, 0.3, 1), slot: new vec3(28.5, 15, -34)},
  {key: "Tomatoes", name: "TOMATOES", tipName: "Tomatoes", tipVerb: "go", kg: 10, heavy: true, layer: 1,
    size: new vec3(37, 32, 56), color: new vec4(1.0, 0.35, 0.45, 1), slot: new vec3(-38.5, 15, 18)},
  {key: "Laundry", name: "LAUNDRY", tipName: "Laundry", tipVerb: "goes", kg: 17, heavy: true, layer: 1,
    size: new vec3(37, 32, 56), color: new vec4(0.55, 0.5, 1.0, 1), slot: new vec3(0, 15, 18)},
  {key: "Pasta", name: "PASTA", tipName: "Pasta", tipVerb: "goes", kg: 10, heavy: true, layer: 1,
    size: new vec3(37, 32, 56), color: new vec4(1.0, 0.75, 0.2, 1), slot: new vec3(38.5, 15, 18)},
  {key: "Bread", name: "BREAD", tipName: "Bread", tipVerb: "goes", kg: 4, heavy: false, layer: 2,
    size: new vec3(50, 26, 36), color: new vec4(1.0, 0.82, 0.55, 1), slot: new vec3(-29, 47, -33)},
  {key: "Eggs", name: "EGGS", tipName: "Eggs", tipVerb: "go", kg: 10, heavy: false, layer: 2,
    size: new vec3(46, 28, 36), color: new vec4(0.95, 0.9, 0.7, 1), slot: new vec3(27, 47, -33)},
  {key: "Chips", name: "CHIPS", tipName: "Chips", tipVerb: "go", kg: 2, heavy: false, layer: 2,
    size: new vec3(50, 34, 40), color: new vec4(0.45, 1.0, 0.55, 1), slot: new vec3(0, 47, 20)},
]

export function ghostTagText(c: CartonSpec): string {
  return "Layer " + c.layer + " · " + (c.heavy ? "Heavy" : "Light") + " · " + c.kg + " kg"
}
