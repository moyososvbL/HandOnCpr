// Criterion 5: SwapBanner shows ~3 s then hides while the Counter keeps counting; "Help arrived"
// -> Help is here with StatTime "m:ss" and StatCount "N"; "Finish" -> Step 1 of 5.
// swapEvery is lowered at RUNTIME only (script instance), never in the scene; the scenario's
// Lens reset discards it and it is restored in finally.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {
  STEP,
  coach,
  expectTab,
  goToPush,
  isNumber,
  obj,
  pressStepButton,
  step,
  text,
  textIn,
  textShown,
  waitFor,
  waitReady,
} from "./CPRTestUtils"

const SWAP = "Swap with someone if you can"
const TEST_SWAP_EVERY = 5

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
      const banner = obj("SwapBanner")
      expect(banner.enabled).toBe(false)

      const shown = await waitFor(() => banner.enabled, TEST_SWAP_EVERY + 3)
      const shownAt = getTime()
      print(`[CPRTest] swap shown=${shown} after ${(shownAt - pushAt).toFixed(2)} s in Push, text="${textIn("SwapBanner", "BannerText")}"`)
      expect(shown).toBe(true)
      expect(textIn("SwapBanner", "BannerText")).toBe(SWAP)

      // While the banner is up the Counter keeps showing (and advancing) the number.
      const cStart = text("Counter")
      let numeric = true
      let cLast = cStart
      while (banner.enabled && getTime() - shownAt < 6) {
        const s = text("Counter")
        if (!isNumber(s)) numeric = false
        else cLast = s
        await nextFrame()
      }
      const shownFor = getTime() - shownAt
      print(`[CPRTest] swap visible for ${shownFor.toFixed(2)} s; counter ${cStart} -> ${cLast} numeric=${numeric} bannerNow=${banner.enabled}`)
      expect(banner.enabled).toBe(false)
      expect(shownFor > 2.5 && shownFor < 3.5).toBe(true)
      expect(numeric).toBe(true)
      expect(isNumber(cStart)).toBe(true)
      expect(parseInt(cLast) > parseInt(cStart)).toBe(true)

      await pressStepButton(hand, "Help arrived", STEP.Done)
      // Counting stops on Done; the (hidden) Counter keeps the last number shown in Push.
      const finalCount = parseInt(text("Counter"))
      const pushSecs = getTime() - pushAt
      const statTime = textIn("Stats", "StatTime")
      const statCount = textIn("Stats", "StatCount")
      print(`[CPRTest] done: instr="${text("Instruction")}" stepLabelShown=${textShown("StepLabel")} stats=${obj("Stats").enabled} StatTime="${statTime}" StatCount="${statCount}" (last counter ${finalCount}, push ~${pushSecs.toFixed(1)} s)`)
      expect(text("Instruction")).toBe("Help is here")
      expect(textShown("StepLabel")).toBe(false)
      expect(obj("Stats").enabled).toBe(true)
      expect(/^\d+:\d\d$/.test(statTime)).toBe(true)
      expect(isNumber(statCount)).toBe(true)
      const n = parseInt(statCount)
      expect(n > 0).toBe(true)
      expect(Math.abs(n - finalCount) <= 2).toBe(true)
      const [mm, ss] = statTime.split(":").map((x) => parseInt(x))
      expect(Math.abs(mm * 60 + ss - pushSecs) <= 2).toBe(true)
      expectTab(4)

      await pressStepButton(hand, "Finish", STEP.Check)
      print(`[CPRTest] finish: step=${step()} label="${text("StepLabel")}" shown=${textShown("StepLabel")}`)
      expect(text("StepLabel")).toBe("Step 1 of 5")
      expect(textShown("StepLabel")).toBe(true)
      expect(step()).toBe(STEP.Check)
      expectTab(0)
      await hand.hand.hide()
    } finally {
      c.swapEvery = original
    }
  }
}
