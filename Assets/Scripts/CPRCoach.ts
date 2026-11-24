// HandsOn CPR — core logic for a Snap SPECS Lens.
// Flow: Check -> Call 112 -> Watch first (hands demo the push) -> Place hands -> Hold -> Push <-> Swap -> Help is here.
//
// Owns: step state (Step enum), count / timers / swap reminder, the Hold sub-state of Place
// (pinch-hold on the guide OR both palms on it), the beat, guide press animation + texture swap,
// heart pulse, audio cues, manikin visibility, and the step window placement mode (head-follow
// in Check/Call, chest-anchored from Watch on). Drives CPRCoachUI only through its public setters
// and listens to ui.onAction -> next(). Pose math lives in CPRCoachPlacement.ts.
// Must not: build UI, import UIKit, or move anything the UI module owns below its root.
// Size note: ~300 lines because this is the user-mandated single coach file (extended, not split);
// pure math was already moved out to CPRCoachPlacement.ts.
//
// Scene setup (done by the bootstrap step):
//   CPRCoach root (top of hierarchy) carries this script + clickAudio; children ButtonAudio / HoldAudio.
//   Wire ui, uiRoot, guide, guideVisual, guideInteractable, heart, manikin, camera, textures.

import { IK } from "InteractionKit.lspkg/IK";
import { Interactable } from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { CPRCoachUI } from "./CPRCoachUI";
import * as Placement from "./CPRCoachPlacement";

enum Step { Check, Call, Watch, Place, Push, Done }

const WHITE = new vec4(1, 1, 1, 0.9);
const GREEN = new vec4(0.2, 0.78, 0.48, 1);

// Mesh payload: chest point (lower half of breastbone, nipple line) in Manikin.glb local cm.
const CHEST_LOCAL = new vec3(0, 21, -9); // lower half of the breastbone (~13 cm below the shoulder line)
const FLOOR_BELOW_EYE = 90;   // cm, kneeling eye height above the floor
const GUIDE_LIFT = 0.5;       // cm above the chest surface
const SWAP_SHOW_SECS = 3;

const TAB: Record<Step, number> = {
  [Step.Check]: 0, [Step.Call]: 1, [Step.Watch]: 2, [Step.Place]: 2, [Step.Push]: 3, [Step.Done]: 4,
};
const LINES: Record<Step, string> = {
  [Step.Check]: "Not responding?\nNot breathing normally?",
  [Step.Call]: "Call 112.\nPut the phone on speaker.",
  [Step.Watch]: "Watch, then copy.\nLock your fingers. Push straight down.",
  [Step.Place]: "Match your hands to the guide.\nArms straight. Shoulders over hands.",
  [Step.Push]: "Push hard, push fast.",
  [Step.Done]: "Help is here",
};
const BUTTONS: Record<Step, { label: string; visible: boolean; accent: boolean }> = {
  [Step.Check]: { label: "Start CPR", visible: true, accent: true },
  [Step.Call]: { label: "Called", visible: true, accent: false },
  [Step.Watch]: { label: "I'm ready", visible: true, accent: false },
  [Step.Place]: { label: "", visible: false, accent: false },
  [Step.Push]: { label: "Help arrived", visible: true, accent: false },
  [Step.Done]: { label: "Finish", visible: true, accent: false },
};

@component
export class CPRCoach extends BaseScriptComponent {
  @ui.group_start("References")
  @input @allowUndefined instructionText: Text;   // legacy fallback; text now lives in CPRCoachUI
  @input @allowUndefined counterText: Text;       // legacy fallback
  @input guide: SceneObject;                      // glowing hands guide
  @input guideVisual: RenderMeshVisual;
  @input clickAudio: AudioComponent;
  @input camera: SceneObject;
  @input ui: CPRCoachUI;
  @input uiRoot: SceneObject;
  @input heart: SceneObject;
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
  @input @widget(new SliderWidget(35, 70, 1)) followDistance: number = 45;   // cm, head-follow window
  @input @widget(new SliderWidget(40, 90, 1)) manikinDistance: number = 60;  // cm, eyes to chest (flat)
  @input @widget(new SliderWidget(1, 2, 0.05)) chestWindowScale: number = 1.5;
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
  private headDir = new vec3(0, 0, -1);
  private guideScale = vec3.one();
  private heartScale = vec3.one();
  private uiScale = vec3.one();
  private following = true;
  private lastCounter = "";

  onAwake() {
    const missing: string[] = [];
    if (!this.guide) missing.push("guide");
    if (!this.guideVisual) missing.push("guideVisual");
    if (!this.clickAudio) missing.push("clickAudio");
    if (!this.camera) missing.push("camera");
    if (!this.ui) missing.push("ui");
    if (!this.uiRoot) missing.push("uiRoot");
    if (!this.heart) missing.push("heart");
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
    if (this.heart) {
      this.heartScale = this.heart.getTransform().getLocalScale();
      this.heart.enabled = false;
    }
    if (this.uiRoot) this.uiScale = this.uiRoot.getTransform().getLocalScale();
    if (this.guideVisual && this.guideVisual.mainMaterial) {
      this.guideVisual.mainMaterial = this.guideVisual.mainMaterial.clone();
    }
    this.placeManikin();
    if (this.ui && this.ui.onAction) this.ui.onAction.add(() => this.next());
    if (this.guideInteractable) {
      this.guideInteractable.onTriggerStart.add(() => { this.pinching = true; });
      this.guideInteractable.onTriggerEnd.add(() => { this.pinching = false; });
      this.guideInteractable.onTriggerCanceled.add(() => { this.pinching = false; });
    }
    this.started = true;
    this.goTo(Step.Check);
    this.snapFollow();
  }

  // Called by the step button (ui.onAction) or any legacy pinch button.
  next() {
    if (!this.started || this.step === Step.Place) return;
    if (this.buttonAudio) this.buttonAudio.play(1);
    if (this.step === Step.Done) { this.goTo(Step.Check); return; }
    this.goTo(this.step + 1);
  }

  private goTo(step: Step) {
    this.step = step;
    this.handsOnSince = -1;
    this.holding = false;
    this.swapUntil = 0;

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
    if (this.heart) {
      this.heart.enabled = step === Step.Push;
      this.heart.getTransform().setLocalScale(this.heartScale);
    }
    this.show();
  }

  private show() {
    if (!this.started) return;
    const b = BUTTONS[this.step];
    this.ui.setStepLabel(`Step ${TAB[this.step] + 1} of 5`);
    this.ui.setActiveTab(TAB[this.step]);
    this.ui.setButton(b.label, b.visible, b.accent);
    this.ui.setHoldProgress(0, false);
    let instruction = LINES[this.step];
    let counter = "";
    if (this.step === Step.Push) counter = "0";
    if (this.step === Step.Done) {
      const secs = Math.floor(getTime() - this.pushStart);
      const mm = Math.floor(secs / 60);
      const ss = ("0" + (secs % 60)).slice(-2);
      counter = `Time ${mm}:${ss} · ${this.count} compressions`;
    }
    this.setInstruction(instruction);
    this.setCounter(counter);
  }

  private setInstruction(text: string) {
    this.ui.setInstruction(text);
    if (this.instructionText) this.instructionText.text = text;
  }

  private setCounter(text: string) {
    if (text === this.lastCounter) return;
    this.lastCounter = text;
    this.ui.setCounter(text);
    if (this.counterText) this.counterText.text = text;
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
      this.headDir = Placement.towardHead(mt);
    } else {
      // Centre of the chest: ~50 cm ahead and 35 cm below the eyes when kneeling beside the person.
      const cam = this.camera.getTransform();
      const ahead = cam.forward.uniformScale(-1); // camera looks down -Z
      this.chestPos = cam.getWorldPosition()
        .add(ahead.uniformScale(50))
        .add(vec3.down().uniformScale(35));
      this.headDir = Placement.flatForward(cam);
    }
    this.guide.getTransform().setWorldPosition(this.chestPos);
    this.guide.getTransform().setLocalScale(this.guideScale);
    this.guide.enabled = true;
  }

  // From Watch on: window beyond the guide toward the head, heart to the user's right.
  private anchorUi() {
    this.setFollow(false);
    const camPos = this.camera.getTransform().getWorldPosition();
    const win = Placement.anchoredWindowPose(this.chestPos, this.headDir, camPos);
    const ut = this.uiRoot.getTransform();
    ut.setWorldPosition(win.position);
    ut.setWorldRotation(win.rotation);
    ut.setLocalScale(this.uiScale.uniformScale(this.chestWindowScale));
    if (this.heart) {
      const hp = Placement.heartPose(this.chestPos, Placement.rightOf(this.headDir), camPos);
      const ht = this.heart.getTransform();
      ht.setWorldPosition(hp.position);
      ht.setWorldRotation(hp.rotation);
    }
  }

  private setFollow(on: boolean) {
    this.following = on;
    if (on && this.uiRoot) {
      this.uiRoot.getTransform().setLocalScale(this.uiScale);
      this.snapFollow();
    }
  }

  private snapFollow() {
    if (!this.uiRoot || !this.camera || !this.following) return;
    const p = Placement.followTarget(this.camera.getTransform(), this.followDistance, 3);
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
    const p = Placement.followPose(this.camera.getTransform(), this.followDistance, cur, getDeltaTime());
    t.setWorldPosition(p.position);
    t.setWorldRotation(p.rotation);
  }

  // Watch first: the ghost hands push down and let the chest rise at the CPR rhythm.
  private demoPress() {
    const phase = (getTime() * this.bpm / 60) % 1;          // 0..1 each press
    const down = phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0;
    this.moveGuide(down);
    this.setCounter(down > 0.3 ? "Push down 5 cm" : "Let the chest rise");
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
        this.setInstruction(LINES[Step.Place]);
        this.ui.setHoldProgress(0, false);
      }
      return;
    }
    const now = getTime();
    if (!this.holding) {
      this.holding = true;
      this.handsOnSince = now;
      this.setColor(GREEN);
      this.setInstruction("Hold still");
    }
    const p = Math.min(1, (now - this.handsOnSince) / this.holdSeconds);
    this.ui.setHoldProgress(p, true);
    if (p >= 1) {
      if (this.holdAudio) this.holdAudio.play(1);
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
      this.clickAudio.play(1);
    }
    const phase = Math.min(1, (now - this.lastBeat) / interval);
    this.moveGuide(phase < 0.5 ? Math.sin(phase * 2 * Math.PI) : 0);

    if (this.heart) {
      const ease = 1 - phase;
      const s = 1 + 0.12 * ease * ease;
      this.heart.getTransform().setLocalScale(this.heartScale.uniformScale(s));
    }

    if (now >= this.nextSwap) {
      this.swapUntil = now + SWAP_SHOW_SECS;
      this.nextSwap += this.swapEvery;
    }
    this.setCounter(now < this.swapUntil ? "Swap with someone if you can" : `${this.count}`);
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
