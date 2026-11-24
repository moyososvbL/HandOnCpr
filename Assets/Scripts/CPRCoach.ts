// HandsOn CPR — core logic for a Snap SPECS Lens.
// Flow: Check -> Call 112 -> Watch first (hands demo the push) -> Place hands -> Hold -> Push <-> Swap -> Help is here.
//
// Scene setup:
//   1. Add this script to an empty SceneObject.
//   2. Drag in: instruction Text, counter Text, the hands guide (a plane with the hands
//      texture, additive/screen material) and its RenderMeshVisual, a click AudioComponent,
//      and the Camera object.
//   3. Wire each pinch button's "on pinched" to call next().

import { IK } from "InteractionKit.lspkg/IK";

enum Step { Check, Call, Watch, Place, Push, Done }

const WHITE = new vec4(1, 1, 1, 0.9);
const GREEN = new vec4(0.2, 0.78, 0.48, 1);

@component
export class CPRCoach extends BaseScriptComponent {
  @input instructionText: Text;
  @input counterText: Text;
  @input guide: SceneObject;             // glowing hands guide
  @input guideVisual: RenderMeshVisual;
  @input clickAudio: AudioComponent;
  @input camera: SceneObject;

  @input bpm: number = 110;              // 100–120 per minute
  @input pressDepth: number = 4;         // cm the guide moves down on each press
  @input handRadius: number = 10;        // cm, how close palms must be to the guide
  @input swapEvery: number = 120;        // seconds between swap reminders

  private step = Step.Check;
  private count = 0;
  private pushStart = 0;
  private lastBeat = 0;
  private nextSwap = 0;
  private swapUntil = 0;
  private handsOnSince = -1;
  private chestPos = vec3.zero();

  onAwake() {
    this.guide.enabled = false;
    this.createEvent("UpdateEvent").bind(() => this.update());
    this.show();
  }

  // Called by every pinch button.
  next() {
    if (this.step === Step.Done) { this.goTo(Step.Check); return; }
    this.goTo(this.step + 1);
  }

  private goTo(step: Step) {
    this.step = step;
    this.handsOnSince = -1;
    if (step === Step.Watch) { this.placeGuide(); this.setColor(WHITE); }
    if (step === Step.Place) this.setColor(WHITE);
    if (step === Step.Push) {
      const now = getTime();
      this.count = 0;
      this.pushStart = now;
      this.lastBeat = now;
      this.nextSwap = now + this.swapEvery;
      this.setColor(GREEN);
    }
    if (step === Step.Done || step === Step.Check) this.guide.enabled = false;
    this.show();
  }

  private show() {
    const lines: Record<Step, string> = {
      [Step.Check]: "Not responding?\nNot breathing normally?",
      [Step.Call]: "Call 112\nPut the phone on speaker",
      [Step.Watch]: "Watch, then copy\nLock your fingers. Push straight down.",
      [Step.Place]: "Match your hands to the guide\nArms straight. Shoulders over hands.",
      [Step.Push]: "Push hard, push fast",
      [Step.Done]: "",
    };
    this.instructionText.text = lines[this.step];
    this.counterText.text = "";
    if (this.step === Step.Done) {
      const secs = Math.floor(getTime() - this.pushStart);
      const mm = Math.floor(secs / 60);
      const ss = ("0" + (secs % 60)).slice(-2);
      this.instructionText.text = `Help is here\n${mm}:${ss} · ${this.count} compressions`;
    }
  }

  // Centre of the chest: ~50 cm ahead and 35 cm below the eyes when kneeling beside the person.
  private placeGuide() {
    const cam = this.camera.getTransform();
    const ahead = cam.forward.uniformScale(-1); // camera looks down -Z
    this.chestPos = cam.getWorldPosition()
      .add(ahead.uniformScale(50))
      .add(vec3.down().uniformScale(35));
    this.guide.getTransform().setWorldPosition(this.chestPos);
    this.guide.enabled = true;
  }

  private update() {
    if (this.step === Step.Watch) this.demoPress();
    if (this.step === Step.Place) this.checkHands();
    if (this.step === Step.Push) this.beat();
  }

  // Watch first: the ghost hands push down and let the chest rise at the CPR rhythm.
  private demoPress() {
    const phase = (getTime() * this.bpm / 60) % 1;          // 0..1 each press
    const down = phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0;
    this.moveGuide(down);
    this.counterText.text = down > 0.3 ? "Push down 5 cm" : "Let the chest rise";
  }

  // Place: guide turns green when both palms are on it; after 1 s, start the beat.
  private checkHands() {
    const onGuide = (side: "left" | "right") => {
      const hand = IK.HandInputData.getHand(side);
      if (!hand.isTracked()) return false;
      const palm = hand.getPalmCenter();
      return palm !== null && palm.distance(this.chestPos) < this.handRadius;
    };
    const both = onGuide("left") && onGuide("right");
    this.setColor(both ? GREEN : WHITE);
    this.counterText.text = both ? "Hold still" : "";

    if (!both) { this.handsOnSince = -1; return; }
    if (this.handsOnSince < 0) this.handsOnSince = getTime();
    if (getTime() - this.handsOnSince > 1) this.goTo(Step.Push);
  }

  // Push: click + count each beat; the guide presses with you.
  private beat() {
    const now = getTime();
    const interval = 60 / this.bpm;

    if (now - this.lastBeat >= interval) {
      this.lastBeat += interval;
      this.count++;
      this.clickAudio.play(1);
    }
    const phase = (now - this.lastBeat) / interval;
    this.moveGuide(phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0);

    if (now >= this.nextSwap) {
      this.swapUntil = now + 3;
      this.nextSwap += this.swapEvery;
    }
    this.counterText.text = now < this.swapUntil
      ? "Swap with someone if you can"
      : `${this.count}`;
  }

  // down: 0 = resting, 1 = fully pressed.
  private moveGuide(down: number) {
    const t = this.guide.getTransform();
    t.setWorldPosition(this.chestPos.add(vec3.down().uniformScale(this.pressDepth * down)));
    const s = 1 - 0.05 * down;
    t.setLocalScale(new vec3(s, s, s));
  }

  private setColor(c: vec4) {
    this.guideVisual.mainMaterial.mainPass.baseColor = c;
  }
}
