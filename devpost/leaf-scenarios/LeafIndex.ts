import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {StackRightDC1LayoutScenario} from "./StackRightDC1LayoutScenario"
import {StackRightDC2GhostScenario} from "./StackRightDC2GhostScenario"
import {StackRightDC3SnapScenario} from "./StackRightDC3SnapScenario"
import {StackRightDC4WrongCartonScenario} from "./StackRightDC4WrongCartonScenario"
import {StackRightDC5CompleteResetScenario} from "./StackRightDC5CompleteResetScenario"
import {StackRightResetReachIKScenario} from "./StackRightResetReachIKScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-layout", typename: StackRightDC1LayoutScenario.getTypeName()},
    {id: "dc2-ghost-on-grab", typename: StackRightDC2GhostScenario.getTypeName()},
    {id: "dc3-snap-counter-next", typename: StackRightDC3SnapScenario.getTypeName()},
    {id: "dc4-wrong-carton-tip", typename: StackRightDC4WrongCartonScenario.getTypeName()},
    {id: "dc5-complete-and-reset", typename: StackRightDC5CompleteResetScenario.getTypeName()},
    {id: "reset-reach-ik", typename: StackRightResetReachIKScenario.getTypeName()},
  ]
}
