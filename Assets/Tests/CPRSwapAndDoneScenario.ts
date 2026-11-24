// Criterion 5: swap reminder shows ~3 s then the count returns; "Help arrived" -> Help is here
// with "Time m:ss · N compressions"; "Finish" -> Step 1 of 5.
// swapEvery is lowered at RUNTIME only (script instance), never in the scene; the scenario's
// Lens reset discards it.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {STEP, coach, goToPush, isNumber, pressStepButton, step, text, waitReady} from "./CPRTestUtils"

const SWAP = "Swap with someone if you can"
const TEST_SWAP_EVERY = 5

async function waitFor(cond: () => boolean, timeoutSecs: number): Promise<boolean> {
  const t0 = getTime()
  while (!cond()) {
    if (getTime() - t0 > timeoutSecs) return false
    await nextFrame()
  }
  return true
}

@component
export class CPRSwapAndDoneScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const c = coach()
    const original = c.swapEvery
    c.swapEvery = TEST_SWAP_EVERY // read in goTo(Push), so set before the hold completes
    try {
      const hand = new CPRHandInteractor("right")
      await goToPush(hand)
      const pushAt = getTime()

      const shown = await waitFor(() => text("Counter") === SWAP, TEST_SWAP_EVERY + 3)
      const shownAt = getTime()
      print(`[CPRTest] swap shown=${shown} after ${(shownAt - pushAt).toFixed(2)} s in Push`)
      expect(shown).toBe(true)
      const back = await waitFor(() => isNumber(text("Counter")), 6)
      const shownFor = getTime() - shownAt
      print(`[CPRTest] swap visible for ${shownFor.toFixed(2)} s, then counter="${text("Counter")}"`)
      expect(back).toBe(true)
      expect(shownFor > 2.5 && shownFor < 3.5).toBe(true)

      await pressStepButton(hand, "Help arrived", STEP.Done)
      const counter = text("Counter")
      print(`[CPRTest] done: instr="${text("Instruction")}" counter="${counter}"`)
      expect(text("Instruction")).toBe("Help is here")
      expect(text("StepLabel")).toBe("Step 5 of 5")
      expect(/^Time \d+:\d\d · \d+ compressions$/.test(counter)).toBe(true)
      const n = parseInt(counter.split("· ")[1])
      expect(n > 0).toBe(true)

      await pressStepButton(hand, "Finish", STEP.Check)
      expect(text("StepLabel")).toBe("Step 1 of 5")
      expect(step()).toBe(STEP.Check)
      await hand.hand.hide()
    } finally {
      c.swapEvery = original
    }
  }
}
