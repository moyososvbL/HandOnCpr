// Criterion 3: "I'm ready" -> Place. A short 0.4 s pinch on HandsGuide keeps Place and leaves
// HoldProgress hidden; a >= 1.2 s pinch-and-hold starts Push on its own.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {STEP, goToWatch, guideInteractable, pressStepButton, step, text, waitReady} from "./CPRTestUtils"

@component
export class CPRHoldToPushScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")
    await goToWatch(hand)
    await pressStepButton(hand, "I'm ready", STEP.Place)
    const progress = findSceneObjectByName("HoldProgress")
    expect(findSceneObjectByName("ActionButton").enabled).toBe(false)
    expect(progress.enabled).toBe(false)
    expect(findSceneObjectByName("HandsGuide").enabled).toBe(true)

    // Short pinch: progress shows while held, then hides; still Place.
    let sawProgress = false
    let pinchDone = false
    const watch = (async () => {
      while (!pinchDone) {
        if (progress.enabled) sawProgress = true
        await nextFrame()
      }
    })()
    try {
      await hand.pinchHold(guideInteractable(), 400)
    } finally {
      pinchDone = true
    }
    await watch
    await sleep(500)
    print(`[CPRTest] short pinch: step=${step()} progressSeenWhileHeld=${sawProgress} progressNow=${progress.enabled} instr="${text("Instruction")}"`)
    expect(sawProgress).toBe(true)
    expect(step()).toBe(STEP.Place)
    expect(progress.enabled).toBe(false)
    expect(text("StepLabel")).toBe("Step 3 of 5")
    expect(text("Instruction")).toBe("Match your hands to the guide.\nArms straight. Shoulders over hands.")

    // Long pinch-and-hold: Push starts by itself.
    await hand.pinchHold(guideInteractable(), 1300)
    await sleep(200)
    print(`[CPRTest] long hold: step=${step()} label="${text("StepLabel")}" instr="${text("Instruction")}"`)
    expect(step()).toBe(STEP.Push)
    expect(text("StepLabel")).toBe("Step 4 of 5")
    expect(text("Instruction")).toBe("Push hard, push fast.")
    expect(progress.enabled).toBe(false)
    await hand.hand.hide()
  }
}
