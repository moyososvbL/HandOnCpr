// LEAF test helper: right-hand interactor for HandsOn CPR.
// Adds pinch-and-hold (the LEAF base trigger() releases immediately).
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor"
import {PINCH_POSITION_OFFSET} from "Leaf.lspkg/Interactors/interactor/handInput/Gestures"
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {HandType} from "InteractionKit.lspkg/Providers/HandInputData/HandType"
import {awaitEventOnce, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"

export class CPRHandInteractor extends LeafSingleHandInteractor {
  constructor(handType: HandType = "right") {
    super(handType, true)
  }

  /** Pinch a button and release (hover -> select -> release). */
  async pinch(target: Interactable): Promise<void> {
    await this.trigger(target)
    await sleep(300)
  }

  /** Move the hand to the target, pinch, keep the pinch for holdMs, then release. */
  async pinchHold(target: Interactable, holdMs: number): Promise<void> {
    const pos = target.getTransform().getWorldPosition()
    await this.hand.setPosition(pos.add(PINCH_POSITION_OFFSET[this.handType]))
    await this.hand.makeGesture("pinch")
    await this.enterHover(target)
    await nextFrame()
    const started = awaitEventOnce(target.onTriggerStart, {
      timeoutMs: 3000,
      description: `onTriggerStart on "${target.getSceneObject().name}"`,
    })
    this.startSelecting()
    try {
      await started
      await sleep(holdMs)
    } finally {
      this.stopSelecting()
    }
    await nextFrame()
    await nextFrame()
    await this.exitHover()
    await this.hand.makeGesture("relaxed")
  }
}
