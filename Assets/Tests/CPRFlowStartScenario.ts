// Criterion 1: pinch "Start CPR", then "Called": Check -> Call 112 -> Watch first; tab 0 -> 1 -> 2.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {STEP, expectTab, pressStepButton, step, text, waitReady} from "./CPRTestUtils"

@component
export class CPRFlowStartScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")

    expect(step()).toBe(STEP.Check)
    expect(text("StepLabel")).toBe("Step 1 of 5")
    expect(text("Instruction")).toBe("Not responding?\nNot breathing normally?")
    expectTab(0)

    await pressStepButton(hand, "Start CPR", STEP.Call)
    expect(text("StepLabel")).toBe("Step 2 of 5")
    expect(text("Instruction")).toBe("Call 112.\nPut the phone on speaker.")
    expectTab(1)

    await pressStepButton(hand, "Called", STEP.Watch)
    expect(text("StepLabel")).toBe("Step 3 of 5")
    expect(text("Instruction")).toBe("Watch, then copy.\nLock your fingers. Push straight down.")
    expectTab(2)

    await hand.hand.hide()
  }
}
