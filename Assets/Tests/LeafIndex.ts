import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {CPRFlowStartScenario} from "./CPRFlowStartScenario"
import {CPRWatchDemoScenario} from "./CPRWatchDemoScenario"
import {CPRHoldToPushScenario} from "./CPRHoldToPushScenario"
import {CPRPushRateScenario} from "./CPRPushRateScenario"
import {CPRSwapAndDoneScenario} from "./CPRSwapAndDoneScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "cpr-1-start-call-watch", typename: CPRFlowStartScenario.getTypeName()},
    {id: "cpr-2-watch-demo", typename: CPRWatchDemoScenario.getTypeName()},
    {id: "cpr-3-hold-to-push", typename: CPRHoldToPushScenario.getTypeName()},
    {id: "cpr-4-push-rate", typename: CPRPushRateScenario.getTypeName()},
    {id: "cpr-5-swap-and-done", typename: CPRSwapAndDoneScenario.getTypeName()},
  ]
}
