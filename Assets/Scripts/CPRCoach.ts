// HandsOn CPR — core logic for a Snap SPECS Lens.
// Flow: Check -> Call 112 -> Watch first (hands demo the push) -> Place hands -> Hold -> Push <-> Swap -> Help is here.
//
// Owns: step state (Step enum), count / timers / swap reminder, the Hold sub-state of Place
// (pinch-hold on the guide OR both palms on it), the beat, guide press animation + texture swap,
// audio cues (Voice on/off), manikin placement/visibility, and where the UI frame goes
// (head-follow in Check/Call, anchored on the hands guide from Watch on). Drives CPRCoachUI
// only through its public setters and listens to its events. Pose math lives in CPRCoachPlacement.ts.
//
// Scene setup (done by the bootstrap step):
//   CPRCoach root (top of hierarchy) carries this script + clickAudio; children ButtonAudio / HoldAudio.
//   Wire ui, uiRoot, guide, guideVisual, guideInteractable, heart, manikin, camera, textures.

import { IK } from "InteractionKit.lspkg/IK";
import { Interactable } from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { CPRCoachUI, Screen, HANDS_PX } from "./CPRCoachUI";
import * as Placement from "./CPRCoachPlacement";

enum Step { Check, Call, Watch, Place, Push, Done }

const WHITE = new vec4(1, 1, 1, 0.9);
const GREEN = new vec4(0.2, 0.78, 0.48, 1);

// Mesh payload: chest point (lower half of breastbone, nipple line) in Manikin.glb local cm.
const CHEST_LOCAL = new vec3(0, 21, -9); // lower half of the breastbone (~13 cm below the shoulder line)
const FLOOR_BELOW_EYE = 90;   // cm, kneeling eye height above the floor
const GUIDE_LIFT = 0.5;       // cm above the chest surface
const SWAP_SHOW_SECS = 3;
const FRAME_IN_FRONT = 12;    // cm the UI frame floats in front of the chest, toward the eyes

const TAB: Record<Step, number> = {
  [Step.Check]: 0, [Step.Call]: 1, [Step.Watch]: 2, [Step.Place]: 2, [Step.Push]: 3, [Step.Done]: 4,
};
const SCREEN: Record<Step, Screen> = {
  [Step.Check]: "check", [Step.Call]: "call", [Step.Watch]: "watch",
  [Step.Place]: "place", [Step.Push]: "push", [Step.Done]: "done",
};

@component
export class CPRCoach extends BaseScriptComponent {
  @ui.group_start("References")
  @input @allowUndefined instructionText: Text;   // legacy, unused (text lives in CPRCoachUI)
  @input @allowUndefined counterText: Text;       // legacy, unused
  @input guide: SceneObject;                      // glowing hands guide
  @input guideVisual: RenderMeshVisual;
  @input clickAudio: AudioComponent;
  @input camera: SceneObject;
  @input ui: CPRCoachUI;
  @input uiRoot: SceneObject;
  @input heart: SceneObject;                      // legacy heart plane; the heart tile now lives in CPRCoachUI
  @input manikin: SceneObject;
  @input @allowUndefined guideInteractable: Interactable;
  @input handsWhite: Texture;
  @input handsGreen: Texture;
  @input @allowUndefined buttonAudio: AudioComponent;
  @input @allowUndefined holdAudio: AudioComponent;
  @ui.group_end

  @ui.group_start("Settings")
  @input @widget(new SliderWidget(100, 120, 1)) bpm: number = 110;           // per minute
  @input @widget(new SliderWidget(2, 6, 0.5)) pressDepth: number = 4;        // cm the guide moves down per press
  @input @widget(new SliderWidget(5, 20, 1)) handRadius: number = 10;        // cm, palms to guide
  @input @widget(new SliderWidget(5, 300, 5)) swapEvery: number = 120;       // seconds between swap reminders
  @input @widget(new SliderWidget(0.5, 3, 0.1)) holdSeconds: number = 1;
  @input @widget(new SliderWidget(35, 70, 1)) followDistance: number = 45;   // cm, head-follow frame
  @input @widget(new SliderWidget(40, 250, 1)) manikinDistance: number = 170; // cm, eyes to chest (flat)
  @input @widget(new SliderWidget(1, 2, 0.05)) chestWindowScale: number = 1.5; // legacy, unused (frame scales with distance)
  @ui.group_end

  private started = false;
  private step = Step.Check;
  private count = 0;
  private pushStart = 0;
  private lastBeat = 0;
  private nextSwap = 0;
  private swapUntil = 0;
  private handsOnSince = -1;
  private pinching = false;
  private holding = false;
  private chestPos = vec3.zero();
  private guideScale = vec3.one();
  private uiScale = vec3.one();
  private following = true;
  private voiceOn = true;
  private lastCue = -1;
  private lastCount = -1;
  private bannerOn = false;

  onAwake() {
    const missing: string[] = [];
    if (!this.guide) missing.push("guide");
    if (!this.guideVisual) missing.push("guideVisual");
    if (!this.clickAudio) missing.push("clickAudio");
    if (!this.camera) missing.push("camera");
    if (!this.ui) missing.push("ui");
    if (!this.uiRoot) missing.push("uiRoot");
    if (!this.manikin) missing.push("manikin");
    if (missing.length > 0) print("[CPRCoach] ERROR: unwired @input(s): " + missing.join(", "));

    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.update());
  }

  // Cross-component work: siblings (UI module, IK) are awake by now.
  private onStart() {
    if (this.guide) {
      this.guideScale = this.guide.getTransform().getLocalScale();
      this.guide.enabled = false;
    }
    if (this.heart) this.heart.enabled = false;
    if (this.uiRoot) this.uiScale = this.uiRoot.getTransform().getLocalScale();
    if (this.guideVisual && this.guideVisual.mainMaterial) {
      this.guideVisual.mainMaterial = this.guideVisual.mainMaterial.clone();
    }
    this.placeManikin();
    if (this.ui) {
      this.ui.onAction.add(() => this.next());
      this.ui.onVoice.add(() => this.toggleVoice());
      this.ui.onEnd.add(() => this.end());
    }
    if (this.guideInteractable) {
      this.guideInteractable.onTriggerStart.add(() => { this.pinching = true; });
      this.guideInteractable.onTriggerEnd.add(() => { this.pinching = false; });
      this.guideInteractable.onTriggerCanceled.add(() => { this.pinching = false; });
    }
    this.started = true;
    this.goTo(Step.Check);
    this.snapFollow();
  }

  // Called by the main pill button (ui.onAction).
  next() {
    if (!this.started || this.step === Step.Place) return;
    this.play(this.buttonAudio);
    if (this.step === Step.Done) { this.goTo(Step.Check); return; }
    this.goTo(this.step + 1);
  }

  /** Toolbar "End": stop the session and return to the first step. */
  private end() {
    if (!this.started) return;
    this.play(this.buttonAudio);
    this.goTo(Step.Check);
  }

  /** Toolbar "Voice on/off": mute or unmute every audio cue. */
  private toggleVoice() {
    this.voiceOn = !this.voiceOn;
    this.ui.setVoice(this.voiceOn);
  }

  private play(a: AudioComponent | undefined) {
    if (a && this.voiceOn) a.play(1);
  }

  private goTo(step: Step) {
    this.step = step;
    this.handsOnSince = -1;
    this.holding = false;
    this.pinching = false;
    this.swapUntil = 0;
    this.bannerOn = false;
    this.lastCue = -1;
    this.lastCount = -1;

    if (step === Step.Check || step === Step.Call) {
      if (step === Step.Check) this.setFollow(true);
      if (this.guide) this.guide.enabled = false;
    }
    if (step === Step.Watch) {
      this.placeGuide();
      this.setColor(WHITE);
      this.anchorUi();
    }
    if (step === Step.Place) { this.moveGuide(0); this.setColor(WHITE); }
    if (step === Step.Push) {
      const now = getTime();
      this.count = 0;
      this.pushStart = now;
      this.lastBeat = now;
      this.nextSwap = now + this.swapEvery;
      this.setColor(GREEN);
    }
    if (step === Step.Done) { this.moveGuide(0); if (this.guide) this.guide.enabled = false; }
    this.show();
  }

  private show() {
    if (!this.started) return;
    this.ui.setScreen(SCREEN[this.step]);
    this.ui.setActiveTab(TAB[this.step]);
    if (this.step === Step.Push) {
      this.ui.setCounter(0);
      this.ui.setTick(0);
      this.ui.setSwapBanner(false);
      this.ui.setHeartPulse(1);
    }
    if (this.step === Step.Done) {
      const secs = Math.floor(getTime() - this.pushStart);
      const mm = Math.floor(secs / 60);
      const ss = ("0" + (secs % 60)).slice(-2);
      this.ui.setStats(`${mm}:${ss}`, `${this.count}`);
    }
  }

  private isOnDevice(): boolean {
    return !global.deviceInfoSystem.isEditor();
  }

  // Manikin: chest manikinDistance ahead, floor 90 cm below the eyes. Hidden on real glasses.
  private placeManikin() {
    if (!this.manikin || !this.camera) return;
    if (this.isOnDevice()) { this.manikin.enabled = false; return; }
    const pose = Placement.manikinPose(this.camera.getTransform(), this.manikinDistance, FLOOR_BELOW_EYE, CHEST_LOCAL);
    const t = this.manikin.getTransform();
    t.setWorldPosition(pose.position);
    t.setWorldRotation(pose.rotation);
    this.manikin.enabled = true;
  }

  // Guide on the manikin's chest in the editor; camera-relative fallback on device.
  private placeGuide() {
    if (this.manikin && this.manikin.enabled && !this.isOnDevice()) {
      const mt = this.manikin.getTransform();
      this.chestPos = Placement.chestPoint(mt, CHEST_LOCAL).add(new vec3(0, GUIDE_LIFT, 0));
    } else {
      // Centre of the chest: ~50 cm ahead and 35 cm below the eyes when kneeling beside the person.
      const cam = this.camera.getTransform();
      const ahead = cam.forward.uniformScale(-1); // camera looks down -Z
      this.chestPos = cam.getWorldPosition()
        .add(ahead.uniformScale(50))
        .add(vec3.down().uniformScale(35));
    }
    this.guide.getTransform().setWorldPosition(this.chestPos);
    this.guide.getTransform().setLocalScale(this.guideScale);
    this.guide.enabled = true;
  }

  // From Watch on: the Figma frame is anchored so its hands point sits on the guide.
  private anchorUi() {
    this.following = false;
    const camT = this.camera.getTransform();
    const dist = this.chestPos.distance(camT.getWorldPosition()) - FRAME_IN_FRONT;
    const handsLocal = new vec3(
      (HANDS_PX.x - 720) * Placement.FIGMA_K,
      (405 - HANDS_PX.y) * Placement.FIGMA_K,
      0,
    );
    const f = Placement.frameAtPoint(camT, this.chestPos, handsLocal, Math.max(30, dist));
    const ut = this.uiRoot.getTransform();
    ut.setWorldPosition(f.pose.position);
    ut.setWorldRotation(f.pose.rotation);
    ut.setLocalScale(this.uiScale.uniformScale(f.scale));
  }

  private setFollow(on: boolean) {
    this.following = on;
    if (on && this.uiRoot) {
      this.uiRoot.getTransform().setLocalScale(this.uiScale.uniformScale(this.followDistance / Placement.FRAME_REF));
      this.snapFollow();
    }
  }

  private snapFollow() {
    if (!this.uiRoot || !this.camera || !this.following) return;
    const p = Placement.frameFollowTarget(this.camera.getTransform(), this.followDistance);
    const t = this.uiRoot.getTransform();
    t.setWorldPosition(p.position);
    t.setWorldRotation(p.rotation);
  }

  private update() {
    if (!this.started) return;
    if (this.following && (this.step === Step.Check || this.step === Step.Call)) this.followTick();
    if (this.step === Step.Watch) this.demoPress();
    if (this.step === Step.Place) this.checkHands();
    if (this.step === Step.Push) this.beat();
  }

  private followTick() {
    const t = this.uiRoot.getTransform();
    const cur = { position: t.getWorldPosition(), rotation: t.getWorldRotation() };
    const p = Placement.frameFollowPose(this.camera.getTransform(), this.followDistance, cur, getDeltaTime());
    t.setWorldPosition(p.position);
    t.setWorldRotation(p.rotation);
  }

  // Watch first: the ghost hands push down and let the chest rise at the CPR rhythm.
  private demoPress() {
    const phase = (getTime() * this.bpm / 60) % 1;          // 0..1 each press
    const down = phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0;
    this.moveGuide(down);
    const cue = down > 0.3 ? 1 : 0;
    if (cue !== this.lastCue) {
      this.lastCue = cue;
      this.ui.setCue(cue === 1);
    }
  }

  // Place / Hold: green while pinch-holding the guide OR both palms are on it; after holdSeconds, Push.
  private checkHands() {
    const onGuide = (side: "left" | "right") => {
      const hand = IK.HandInputData.getHand(side);
      if (!hand || !hand.isTracked()) return false;
      const palm = hand.getPalmCenter();
      return palm !== null && palm.distance(this.chestPos) < this.handRadius;
    };
    const active = this.pinching || (onGuide("left") && onGuide("right"));

    if (!active) {
      if (this.holding) {
        this.holding = false;
        this.handsOnSince = -1;
        this.setColor(WHITE);
        this.ui.setScreen("place");
      }
      return;
    }
    const now = getTime();
    if (!this.holding) {
      this.holding = true;
      this.handsOnSince = now;
      this.setColor(GREEN);
      this.ui.setScreen("hold");
    }
    const p = Math.min(1, (now - this.handsOnSince) / this.holdSeconds);
    this.ui.setHoldProgress(p);
    if (p >= 1) {
      this.play(this.holdAudio);
      this.pinching = false;
      this.goTo(Step.Push);
    }
  }

  // Push: click + count each beat; the guide presses with you; the heart pulses.
  private beat() {
    const now = getTime();
    const interval = 60 / this.bpm;

    if (now - this.lastBeat >= interval) {
      this.lastBeat += interval;
      if (now - this.lastBeat >= interval) this.lastBeat = now; // resync after a stall
      this.count++;
      this.play(this.clickAudio);
    }
    const phase = Math.min(1, (now - this.lastBeat) / interval);
    this.moveGuide(phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0);

    const ease = 1 - phase;
    this.ui.setHeartPulse(1 + 0.12 * ease * ease);

    if (this.count !== this.lastCount) {
      this.lastCount = this.count;
      this.ui.setCounter(this.count);
      this.ui.setTick(this.count);
    }

    if (now >= this.nextSwap) {
      this.swapUntil = now + SWAP_SHOW_SECS;
      this.nextSwap += this.swapEvery;
    }
    const banner = now < this.swapUntil;
    if (banner !== this.bannerOn) {
      this.bannerOn = banner;
      this.ui.setSwapBanner(banner);
    }
  }

  // down: 0 = resting, 1 = fully pressed.
  private moveGuide(down: number) {
    if (!this.guide) return;
    const t = this.guide.getTransform();
    t.setWorldPosition(this.chestPos.add(vec3.down().uniformScale(this.pressDepth * down)));
    t.setLocalScale(this.guideScale.uniformScale(1 - 0.05 * down));
  }

  // Tint + texture: green hands while held / pushing, white otherwise.
  private setColor(c: vec4) {
    if (!this.guideVisual || !this.guideVisual.mainMaterial) return;
    const pass = this.guideVisual.mainMaterial.mainPass;
    pass.baseColor = c;
    const tex = c === GREEN ? this.handsGreen : this.handsWhite;
    if (tex) pass.baseTex = tex;
  }
}
