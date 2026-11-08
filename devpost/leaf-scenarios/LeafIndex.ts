import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {StackRightDC1LayoutScenario} from "./StackRightDC1LayoutScenario"
import {StackRightDC2GhostScenario} from "./StackRightDC2GhostScenario"
import {StackRightDC3SnapQueueScenario} from "./StackRightDC3SnapQueueScenario"
import {StackRightDC4MistakesScenario} from "./StackRightDC4MistakesScenario"
import {StackRightDC5LayersScenario} from "./StackRightDC5LayersScenario"
import {StackRightDC6CompleteResetScenario} from "./StackRightDC6CompleteResetScenario"
import {StackRightResetReachIKScenario} from "./StackRightResetReachIKScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-layout", typename: StackRightDC1LayoutScenario.getTypeName()},
    {id: "dc2-ghost-and-tag", typename: StackRightDC2GhostScenario.getTypeName()},
    {id: "dc3-snap-queue-30", typename: StackRightDC3SnapQueueScenario.getTypeName()},
    {id: "dc4-overhang-gap-offpallet", typename: StackRightDC4MistakesScenario.getTypeName()},
    {id: "dc5-layer-notes-orientation", typename: StackRightDC5LayersScenario.getTypeName()},
    {id: "dc6-complete-and-reset", typename: StackRightDC6CompleteResetScenario.getTypeName()},
    {id: "reset-reach-ik", typename: StackRightResetReachIKScenario.getTypeName()},
  ]
}
