// Criterion 1: pinch "Start CPR", then "Called": Check -> Call 112 -> Watch first; tab 0 -> 1 -> 2.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {STEP, buttonLabel, expectTab, pressStepButton, step, text, waitReady} from "./CPRTestUtils"

@component
export class CPRFlowStartScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")

    const log = (tag: string) =>
      print(`[CPRTest] ${tag}: step=${step()} label="${text("StepLabel")}" instr=${JSON.stringify(text("Instruction"))} button="${buttonLabel()}"`)

    log("check")
    expect(step()).toBe(STEP.Check)
    expect(text("StepLabel")).toBe("Step 1 of 5")
    expect(text("Instruction")).toBe("Not responding?\nNot breathing normally?")
    expectTab(0)

    await pressStepButton(hand, "Start CPR", STEP.Call)
    log("call")
    expect(text("StepLabel")).toBe("Step 2 of 5")
    expect(text("Instruction")).toBe("Call 112")
    expect(buttonLabel()).toBe("Called")
    expectTab(1)

    await pressStepButton(hand, "Called", STEP.Watch)
    log("watch")
    expect(text("StepLabel")).toBe("Step 3 of 5")
    expect(text("Instruction")).toBe("Watch, then copy")
    expect(buttonLabel()).toBe("I'm ready")
    expectTab(2)

    await hand.hand.hide()
  }
}
