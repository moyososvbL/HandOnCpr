// Criterion 3: "I'm ready" -> Place. A short 0.4 s pinch on HandsGuide shows the Hold screen
// while held, then reverts to Place; a >= 1.2 s pinch-and-hold starts Push on its own.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {STEP, goToWatch, guideInteractable, holdFillWidth, obj, pressStepButton, sideTag, step, text, waitReady} from "./CPRTestUtils"

const PLACE = "Match your hands to the guide"
const HOLD = "Hold still"

@component
export class CPRHoldToPushScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")
    await goToWatch(hand)
    await pressStepButton(hand, "I'm ready", STEP.Place)
    const progress = obj("HoldProgress")
    const fill0 = holdFillWidth()
    print(`[CPRTest] place: instr="${text("Instruction")}" sideTag="${sideTag()}" button=${obj("ActionButton").enabled} progress=${progress.enabled} fill=${fill0.toFixed(3)}`)
    expect(text("StepLabel")).toBe("Step 3 of 5")
    expect(text("Instruction")).toBe(PLACE)
    expect(sideTag()).toBe("Centre of chest")
    expect(obj("ActionButton").enabled).toBe(false)
    expect(progress.enabled).toBe(true)
    expect(obj("HandsGuide").enabled).toBe(true)

    // Short pinch: Hold screen while held, then back to Place.
    let sawHold = false
    let sawHoldTag = false
    let maxFill = fill0
    let pinchDone = false
    const watch = (async () => {
      while (!pinchDone) {
        if (text("Instruction") === HOLD) sawHold = true
        if (sideTag() === "Hands in place") sawHoldTag = true
        maxFill = Math.max(maxFill, holdFillWidth())
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
    print(`[CPRTest] short pinch: step=${step()} holdSeen=${sawHold} holdTagSeen=${sawHoldTag} maxFill=${maxFill.toFixed(3)} (rest ${fill0.toFixed(3)}) instr="${text("Instruction")}" sideTag="${sideTag()}" fillNow=${holdFillWidth().toFixed(3)}`)
    expect(sawHold).toBe(true)
    expect(sawHoldTag).toBe(true)
    expect(maxFill > fill0).toBe(true)
    expect(step()).toBe(STEP.Place)
    expect(text("StepLabel")).toBe("Step 3 of 5")
    expect(text("Instruction")).toBe(PLACE)
    expect(sideTag()).toBe("Centre of chest")

    // Long pinch-and-hold: Push starts by itself.
    await hand.pinchHold(guideInteractable(), 1300)
    await sleep(200)
    print(`[CPRTest] long hold: step=${step()} label="${text("StepLabel")}" instr="${text("Instruction")}" progress=${progress.enabled}`)
    expect(step()).toBe(STEP.Push)
    expect(text("StepLabel")).toBe("Step 4 of 5")
    expect(text("Instruction")).toBe("Push hard, push fast")
    expect(progress.enabled).toBe(false)
    await hand.hand.hide()
  }
}
