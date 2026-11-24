// Criterion 4: on Push the counter rises at ~110/min (+-10%), HeartTile and HandsGuide enabled.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {coach, goToPush, isNumber, obj, text, textIn, waitReady} from "./CPRTestUtils"

const TARGET_BPM = 110
const SAMPLE_SECS = 10

@component
export class CPRPushRateScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")
    await goToPush(hand)
    await hand.hand.hide()
    await sleep(500)

    const c = coach()
    const heartTile = obj("HeartTile")
    const chip = obj("RhythmChip")
    print(`[CPRTest] push: heartTile=${heartTile.enabled} rhythmChip=${chip.enabled} "${textIn("RhythmChip", "Text")}" guide=${c.guide.enabled} legacyHeart=${c.heart ? c.heart.enabled : "n/a"} caption="${text("CounterCaption")}"`)
    expect(heartTile.enabled).toBe(true)
    expect(chip.enabled).toBe(true)
    expect(textIn("RhythmChip", "Text")).toBe("In rhythm")
    expect(c.guide.enabled).toBe(true)
    expect(text("CounterCaption")).toBe("compressions")

    // Sample at a counter change so the window starts on a beat.
    let start = text("Counter")
    while (text("Counter") === start) await nextFrame()
    start = text("Counter")
    expect(isNumber(start)).toBe(true)
    const n0 = parseInt(start)
    const t0 = getTime()
    let last = n0
    let monotonic = true
    let allNumeric = true
    while (getTime() - t0 < SAMPLE_SECS) {
      await nextFrame()
      const s = text("Counter")
      if (!isNumber(s)) {
        allNumeric = false
        continue
      }
      const n = parseInt(s)
      if (n < last) monotonic = false
      last = n
    }
    const dt = getTime() - t0
    const rate = ((last - n0) / dt) * 60
    print(`[CPRTest] counter ${n0} -> ${last} over ${dt.toFixed(2)} s = ${rate.toFixed(1)}/min numeric=${allNumeric}`)
    expect(allNumeric).toBe(true)
    expect(monotonic).toBe(true)
    expect(last > n0).toBe(true)
    expect(rate >= TARGET_BPM * 0.9 && rate <= TARGET_BPM * 1.1).toBe(true)

    expect(heartTile.enabled).toBe(true)
    expect(c.guide.enabled).toBe(true)
  }
}
