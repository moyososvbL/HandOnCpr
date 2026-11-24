// CPRCoachUI — the HandsOn CPR view, built to match devpost/figma (01-check … 08-help-is-here).
//
// Every element is laid out in Figma frame pixels (1440 x 810, origin = frame centre 720,405)
// on this script's SceneObject, which CPRCoach places either in front of the eyes (follow mode)
// or so that the Figma "hands" point (720, 640) sits on the 3D hands guide (chest mode).
// 1 Figma px = K cm at the 45 cm reference; CPRCoach scales the root by distance / 45.
//
// Owns: glass window (step tag, title, sub text, call circle, counter, rhythm ticks, chips,
// stats, progress bar, one pill button), step tab bar, toolbar ornament (Voice / End), side tag
// next to the hands, heart tiles, swap banner. Exposes setters + three events. No step logic.
//
// Pills are hand-built (RoundedRectangle + Image + Text + collider + IK Interactable) because
// the design needs exact colours / dark icons on light pills that the UIKit Button theme
// cannot express. Tokens come from devpost/figma/UI_SPEC.md.

import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {TargetingMode} from "InteractionKit.lspkg/Core/Interactor/Interactor"
import {RoundedRectangle} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {createChildSceneObjectWithParentLayer} from "UIKit.lspkg/Scripts/Utility/SceneUtilities"
import {IMAGE_MATERIAL_ASSET} from "UIKit.lspkg/Scripts/Utility/Assets"

export type Screen = "check" | "call" | "watch" | "place" | "hold" | "push" | "done"

// ─── Frame mapping ────────────────────────────────────────────────────────
const K = 0.0178 // cm per Figma px at 45 cm (matches CPRCoachPlacement.FIGMA_K)
const FX = 720
const FY = 405
/** Figma frame point used to anchor the frame on the hands guide (centre of the palms). */
export const HANDS_PX = new vec2(720, 640)
const pos = (x: number, y: number, z: number = 0) => new vec3((x - FX) * K, (FY - y) * K, z)
const cm = (p: number) => p * K
const fontSize = (p: number) => p * K * 43.886 // Text size units: em-square cm = size / 43.886

// Depth layers (cm, before root scaling): plate -> content -> overlay.
const Z_PLATE = 0
const Z_CONTENT = 0.06
const Z_TOP = 0.12

// ─── Tokens (UI_SPEC.md) ─────────────────────────────────────────────────
const RED = new vec4(0.949, 0.22, 0.169, 1) // #F2382B
const GREEN = new vec4(0.2, 0.78, 0.482, 1) // #33C77B
const DARK = new vec4(0.102, 0.102, 0.122, 1) // #1A1A1F
// RoundedRectangle draws its colour opaque (alpha is ignored), and the SPECS display is additive
// (the glass reads as see-through anyway). So every translucent Figma token is pre-composited
// over the glass it sits on (#5C5C61) to get the same visible tone.
const GLASS_RGB = new vec3(0.361, 0.361, 0.38) // #5C5C61
const over = (rgb: vec3, a: number, base: vec3 = GLASS_RGB) =>
  new vec4(base.x + (rgb.x - base.x) * a, base.y + (rgb.y - base.y) * a, base.z + (rgb.z - base.z) * a, 1)
const WHITE3 = new vec3(1, 1, 1)
const GLASS = new vec4(GLASS_RGB.x, GLASS_RGB.y, GLASS_RGB.z, 1) // window fill (#5C5C61 @ 42 % glass)
const ORNAMENT = new vec4(0.33, 0.33, 0.35, 1) // tab bar / toolbar / chips (slightly lighter glass in Figma reads darker here)
const PILL_GLASS = over(WHITE3, 0.14) // "Help arrived", Voice on, End
const PILL_GLASS_HOVER = over(WHITE3, 0.26)
const BORDER = over(WHITE3, 0.3) // 1 px white @ 30 %
const LIGHT = new vec4(0.96, 0.96, 0.965, 1) // white pills @ 95 %
const TILE = new vec4(0.96, 0.96, 0.965, 1)
const TICK = over(WHITE3, 0.42)
const TRACK = over(WHITE3, 0.28)
const GLOW_NEAR = over(new vec3(0.949, 0.22, 0.169), 0.32)
const GLOW_FAR = over(new vec3(0.949, 0.22, 0.169), 0.14)
const w = (a: number) => new vec4(1, 1, 1, a) // text / icon tint (alpha works on Text and Image)

type Rect4 = [number, number, number, number] // x0, y0, x1, y1 in Figma px

// Window rectangle per screen, measured from the PNGs.
const WINDOW: Record<Screen, Rect4> = {
  check: [411, 151, 1029, 468],
  call: [441, 91, 999, 588],
  watch: [451, 111, 989, 396],
  place: [451, 111, 989, 326],
  hold: [451, 111, 989, 326],
  push: [171, 81, 649, 648],
  done: [421, 101, 1019, 571]
}
const STEP_TAG: Record<Screen, string> = {
  check: "Step 1 of 5",
  call: "Step 2 of 5",
  watch: "Step 3 of 5",
  place: "Step 3 of 5",
  hold: "Step 3 of 5",
  push: "Step 4 of 5",
  done: ""
}
const WIN_RADIUS = 46
const TICKS = 14

type PillStyle = "red" | "light" | "glass"

type Pill = {
  so: SceneObject
  bg: RoundedRectangle
  glow: RoundedRectangle[]
  icon: Image
  iconSo: SceneObject
  label: Text
  labelSo: SceneObject
  collider: ColliderComponent
  shape: BoxShape
  style: PillStyle
}

type Chip = {so: SceneObject; bg: RoundedRectangle; dot: RoundedRectangle; dotSo: SceneObject; icon: Image; iconSo: SceneObject; text: Text; textSo: SceneObject}

@component
export class CPRCoachUI extends BaseScriptComponent {
  @ui.group_start("References")
  @input
  @allowUndefined
  stepWindow: SceneObject
  @input
  @allowUndefined
  stepTabBar: SceneObject
  @ui.group_end

  @ui.group_start("Icons (Assets/Icons) and heart")
  @input @allowUndefined iconAlert: Texture // error_fill0
  @input @allowUndefined iconCall: Texture // call_fill0
  @input @allowUndefined iconHand: Texture // back_hand_fill0
  @input @allowUndefined iconHeartbeat: Texture // ecg_heart_fill0
  @input @allowUndefined iconCheck: Texture // check
  @input @allowUndefined iconVoice: Texture // volume_up
  @input @allowUndefined iconClose: Texture // close_wght500
  @input @allowUndefined iconClock: Texture // schedule_fill0
  @input @allowUndefined iconUp: Texture // arrow_upward
  @input @allowUndefined iconDown: Texture // arrow_downward
  @input @allowUndefined heartTexture: Texture // Assets/Textures/heart.png
  @input @allowUndefined uiFont: Font // Assets/Fonts/Inter.ttf (Regular 400; closest to SF Pro)
  @input @allowUndefined fontExtraLight: Font // Inter-ExtraLight.ttf (200) — counter, stats
  @input @allowUndefined fontLight: Font // Inter-Light.ttf (300) — "Call 112"
  @input @allowUndefined fontMedium: Font // Inter-Medium.ttf (500) — step tag, chips
  @input @allowUndefined fontSemiBold: Font // Inter-SemiBold.ttf (600) — titles, pills
  @ui.group_end

  private onActionEvent = new Event<void>()
  /** Main pill button (Start CPR / Called / I'm ready / Help arrived / Finish). */
  public readonly onAction: PublicApi<void> = this.onActionEvent.publicApi()
  private onVoiceEvent = new Event<void>()
  /** Toolbar "Voice on/off". */
  public readonly onVoice: PublicApi<void> = this.onVoiceEvent.publicApi()
  private onEndEvent = new Event<void>()
  /** Toolbar "End". */
  public readonly onEnd: PublicApi<void> = this.onEndEvent.publicApi()

  private built = false
  private screen: Screen = "check"
  private activeTab = 0
  private voiceOn = true

  // Window
  private winPlate: RoundedRectangle
  private winPlateSo: SceneObject
  private stepLabel: Text
  private title: Text
  private sub: Text
  private counter: Text
  private counterCaption: Text
  private callGroup: SceneObject
  private progressGroup: SceneObject
  private progressFill: RoundedRectangle
  private progressFillSo: SceneObject
  private tickGroup: SceneObject
  private ticks: {so: SceneObject; rr: RoundedRectangle}[] = []
  private chipRate: Chip
  private chipDepth: Chip
  private statGroup: SceneObject
  private statTime: Text
  private statCount: Text
  private action: Pill
  private actionHandler: () => void = () => this.onActionEvent.invoke()

  // Ornaments
  private tabFills: SceneObject[] = []
  private tabIcons: Image[] = []
  private toolbarSo: SceneObject
  private voicePill: Pill
  private endPill: Pill
  private sideTag: Chip
  private heartTileSo: SceneObject
  private heartImgSo: SceneObject
  private heartChip: Chip
  private smallHeartSo: SceneObject
  private bannerSo: SceneObject

  // Textures
  private tex: {[k: string]: Texture | null} = {}

  onAwake(): void {
    const root = this.sceneObject
    new CanvasController(root).ensure(new vec2(cm(1440), cm(810)))
    const win = this.stepWindow ?? this.child(root, "StepWindow") ?? createChildSceneObjectWithParentLayer("StepWindow", root)
    const bar = this.stepTabBar ?? this.child(root, "StepTabBar") ?? createChildSceneObjectWithParentLayer("StepTabBar", root)
    win.getTransform().setLocalPosition(vec3.zero())
    bar.getTransform().setLocalPosition(vec3.zero())
    this.loadTextures()
    this.buildWindow(win)
    this.buildTabBar(bar)
    this.buildToolbar(root)
    this.buildSideTag(root)
    this.buildHeart(root)
    this.buildBanner(root)
    this.built = true
    this.setScreen(this.screen)
    this.setActiveTab(this.activeTab)
  }

  // ─── Public API ────────────────────────────────────────────────────────

  public setScreen(s: Screen): void {
    this.screen = s
    if (!this.built) return
    this.layout(s)
  }

  public setActiveTab(index: number): void {
    this.activeTab = Math.max(0, Math.min(4, Math.floor(index)))
    if (!this.built) return
    for (let i = 0; i < 5; i++) {
      const active = i === this.activeTab
      this.tabFills[i].enabled = active
      this.tabIcons[i].mainPass.baseColor = active ? DARK : w(i < this.activeTab ? 1 : 0.45)
    }
  }

  /** Push: the big compression number. */
  public setCounter(n: number): void {
    if (this.counter) this.counter.text = `${n}`
  }

  /** Push: highlight tick `i` (0..13) of the rhythm bar. */
  public setTick(i: number): void {
    const cur = ((Math.floor(i) % TICKS) + TICKS) % TICKS
    for (let t = 0; t < this.ticks.length; t++) {
      const on = t === cur
      const x = 223 + t * 16.6
      this.ticks[t].so.getTransform().setLocalPosition(pos(x, 429, Z_CONTENT))
      this.ticks[t].rr.size = new vec2(cm(on ? 10 : 8), cm(on ? 44 : 22))
      this.ticks[t].rr.cornerRadius = cm(on ? 5 : 4)
      this.fill(this.ticks[t].rr, on ? RED : TICK)
    }
  }

  /** Place / Hold: thin bar under the sub text, green fill. */
  public setHoldProgress(value01: number): void {
    const v = isNaN(value01) ? 0 : Math.max(0, Math.min(1, value01))
    const width = Math.max(18, 260 * v)
    this.progressFill.size = new vec2(cm(width), cm(8))
    this.progressFillSo.getTransform().setLocalPosition(pos(590 + width / 2, 278, Z_TOP))
  }

  /** Watch: side tag text follows the demo press. */
  public setCue(down: boolean): void {
    if (this.screen !== "watch") return
    this.setChip(this.sideTag, 1069, 621, 203, down ? "Push down 5 cm" : "Let the chest rise", null, this.tex[down ? "down" : "up"])
  }

  public setSwapBanner(visible: boolean): void {
    if (this.bannerSo) this.bannerSo.enabled = visible && this.screen === "push"
  }

  /** Push: heart image scale (1 = rest, ~1.12 on the beat). */
  public setHeartPulse(scale: number): void {
    if (!this.heartImgSo) return
    const s = cm(286) * scale
    this.heartImgSo.getTransform().setLocalScale(new vec3(s, s, 1))
  }

  public setStats(time: string, count: string): void {
    if (this.statTime) this.statTime.text = time
    if (this.statCount) this.statCount.text = count
  }

  public setVoice(on: boolean): void {
    this.voiceOn = on
    this.layoutToolbar()
  }

  public setVisible(visible: boolean): void {
    this.sceneObject.getChildrenCount() // keep API; children follow the root
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) this.sceneObject.getChild(i).enabled = visible
  }

  // ─── Layout per screen ─────────────────────────────────────────────────

  private layout(s: Screen): void {
    const [x0, y0, x1, y1] = WINDOW[s]
    const cx = (x0 + x1) / 2
    const ww = x1 - x0
    const wh = y1 - y0
    this.winPlateSo.getTransform().setLocalPosition(pos(cx, (y0 + y1) / 2, Z_PLATE))
    this.winPlate.size = new vec2(cm(ww), cm(wh))
    this.winPlate.cornerRadius = cm(WIN_RADIUS)

    const show = (o: SceneObject, on: boolean) => {
      o.enabled = on
    }
    show(this.callGroup, s === "call")
    show(this.progressGroup, s === "place" || s === "hold")
    show(this.tickGroup, s === "push")
    show(this.chipRate.so, s === "push")
    show(this.chipDepth.so, s === "push")
    show(this.statGroup, s === "done")
    show(this.counter.getSceneObject(), s === "push")
    show(this.counterCaption.getSceneObject(), s === "push")
    show(this.sub.getSceneObject(), s === "call" || s === "watch" || s === "place" || s === "hold")
    show(this.stepLabel.getSceneObject(), s !== "done")
    show(this.heartTileSo, s === "push")
    show(this.heartChip.so, s === "push")
    show(this.smallHeartSo, s === "done")
    show(this.sideTag.so, s === "watch" || s === "place" || s === "hold")
    if (s !== "push") this.bannerSo.enabled = false

    this.stepLabel.text = STEP_TAG[s]
    switch (s) {
      case "check":
        this.placeText(this.stepLabel, cx, 200, 500, 24, 15, 500, w(0.6), "c")
        this.placeText(this.title, cx, 276, 580, 100, 33, 600, w(1), "c")
        this.title.text = "Not responding?\nNot breathing normally?"
        this.setPill(this.action, cx, 396, 194, 56, "Start CPR", "red", this.tex["heartbeat"], 19)
        break
      case "call":
        this.placeText(this.stepLabel, cx, 140, 500, 24, 15, 500, w(0.6), "c")
        this.callGroup.getTransform().setLocalPosition(vec3.zero())
        this.placeText(this.title, cx, 372, 520, 90, 70, 300, w(1), "c")
        this.title.text = "Call 112"
        this.placeText(this.sub, cx, 440, 500, 28, 18, 400, w(0.72), "c")
        this.sub.text = "Put the phone on speaker"
        this.setPill(this.action, cx, 516, 160, 56, "Called", "light", this.tex["check"], 19)
        break
      case "watch":
        this.placeText(this.stepLabel, cx, 160, 500, 24, 15, 500, w(0.6), "c")
        this.placeText(this.title, cx, 204, 520, 44, 32, 600, w(1), "c")
        this.title.text = "Watch, then copy"
        this.placeText(this.sub, cx, 249, 500, 28, 18, 400, w(0.72), "c")
        this.sub.text = "Lock your fingers. Push straight down."
        this.setPill(this.action, cx, 323, 186, 57, "I'm ready", "light", this.tex["check"], 19)
        this.setCue(false)
        break
      case "place":
      case "hold": {
        const hold = s === "hold"
        this.placeText(this.stepLabel, cx, 160, 500, 24, 15, 500, w(0.6), "c")
        this.placeText(this.title, cx, 204, 520, 44, 32, 600, w(1), "c")
        this.title.text = hold ? "Hold still" : "Match your hands to the guide"
        this.placeText(this.sub, cx, 249, 500, 28, 18, 400, w(0.72), "c")
        this.sub.text = hold ? "Hands found. Starting the beat." : "Arms straight. Shoulders over hands."
        this.action.so.enabled = false
        this.setHoldProgress(0)
        if (hold) this.setChip(this.sideTag, 985, 621, 166, "Hands in place", GREEN, null)
        else this.setChip(this.sideTag, 989, 621, 172, "Centre of chest", w(1), null)
        break
      }
      case "push":
        this.placeText(this.stepLabel, 219, 131, 400, 24, 15, 500, w(0.6), "l")
        this.placeText(this.title, 219, 168, 420, 40, 30, 600, w(1), "l")
        this.title.text = "Push hard, push fast"
        this.placeText(this.counter, 219, 272, 420, 130, 150, 200, w(1), "l")
        this.placeText(this.counterCaption, 219, 367, 300, 26, 17, 400, w(0.72), "l")
        this.setChip(this.chipRate, 268.5, 498, 99, "110 / min", null, null, 15)
        this.setChip(this.chipDepth, 385.5, 498, 111, "5 cm deep", null, null, 15)
        this.setPill(this.action, 312, 575, 186, 58, "Help arrived", "glass", null, 19)
        this.setChip(this.heartChip, 1149.5, 460, 128, "In rhythm", GREEN, null)
        this.setTick(0)
        break
      case "done":
        this.placeText(this.title, cx, 312, 520, 52, 38, 600, w(1), "c")
        this.title.text = "Help is here"
        this.setPill(this.action, cx, 499, 125, 56, "Finish", "light", null, 19)
        break
    }
    this.layoutToolbar()
  }

  private layoutToolbar(): void {
    if (!this.built) return
    const [x0, , x1, y1] = WINDOW[this.screen]
    const cx = (x0 + x1) / 2
    const cy = y1 + 24 + 30
    this.toolbarSo.getTransform().setLocalPosition(pos(cx, cy, Z_PLATE).sub(pos(FX, FY)))
    // Re-apply after the first layout pass: RoundedRectangle styling set during onAwake can be reset on init.
    this.setPill(this.voicePill, 668.5, 405, 133, 42, this.voiceOn ? "Voice on" : "Voice off", "glass", this.tex["voice"], 16)
    this.setPill(this.endPill, 789.5, 405, 95, 42, "End", "glass", this.tex["close"], 16)
  }

  // ─── Build ─────────────────────────────────────────────────────────────

  private buildWindow(win: SceneObject): void {
    const plate = this.rect(win, "Backing", 720, 310, 618, 317, GLASS, WIN_RADIUS, BORDER, Z_PLATE)
    this.winPlate = plate.rr
    this.winPlateSo = plate.so
    const content = createChildSceneObjectWithParentLayer("Content", win)

    this.stepLabel = this.text(content, "StepLabel")
    this.title = this.text(content, "Instruction")
    this.sub = this.text(content, "SubText")
    this.counter = this.text(content, "Counter")
    this.counterCaption = this.text(content, "CounterCaption")
    this.counterCaption.text = "compressions"

    // Call circle (screen 2): red disc with soft glow rings + phone icon.
    this.callGroup = createChildSceneObjectWithParentLayer("CallCircle", content)
    this.rect(this.callGroup, "Glow2", 720, 243, 164, 164, over(new vec3(RED.x, RED.y, RED.z), 0.18), 82, null, Z_CONTENT)
    this.rect(this.callGroup, "Glow1", 720, 243, 132, 132, over(new vec3(RED.x, RED.y, RED.z), 0.42), 66, null, Z_CONTENT + 0.01)
    this.rect(this.callGroup, "Disc", 720, 243, 100, 100, RED, 50, null, Z_CONTENT + 0.02)
    this.image(this.callGroup, "Phone", this.tex["call"], 720, 243, 34, w(1), Z_TOP)

    // Hold progress (screens 4–5).
    this.progressGroup = createChildSceneObjectWithParentLayer("HoldProgress", content)
    this.rect(this.progressGroup, "Track", 720, 278, 260, 8, TRACK, 4, null, Z_CONTENT)
    const fill = this.rect(this.progressGroup, "Fill", 599, 278, 18, 8, GREEN, 4, null, Z_TOP)
    this.progressFill = fill.rr
    this.progressFillSo = fill.so

    // Rhythm bar (screen 6).
    this.tickGroup = createChildSceneObjectWithParentLayer("RhythmBar", content)
    for (let i = 0; i < TICKS; i++) {
      this.ticks.push(this.rect(this.tickGroup, "Tick" + i, 223 + i * 16.6, 429, 8, 22, TICK, 4, null, Z_CONTENT))
    }
    this.chipRate = this.chip(content, "ChipRate")
    this.chipDepth = this.chip(content, "ChipDepth")

    // Summary stats (screen 8).
    this.statGroup = createChildSceneObjectWithParentLayer("Stats", content)
    this.statTime = this.text(this.statGroup, "StatTime")
    this.placeText(this.statTime, 637, 380, 220, 70, 55, 200, w(1), "c")
    const tl = this.text(this.statGroup, "StatTimeLabel")
    this.placeText(tl, 637, 425, 220, 22, 15, 400, w(0.6), "c")
    tl.text = "time"
    this.statCount = this.text(this.statGroup, "StatCount")
    this.placeText(this.statCount, 801, 380, 220, 70, 55, 200, w(1), "c")
    const cl = this.text(this.statGroup, "StatCountLabel")
    this.placeText(cl, 801, 425, 220, 22, 15, 400, w(0.6), "c")
    cl.text = "compressions"

    // Small heart tile inside the window (screen 8).
    this.smallHeartSo = createChildSceneObjectWithParentLayer("SmallHeart", content)
    this.rect(this.smallHeartSo, "Tile", 720, 206, 130, 130, TILE, 28, null, Z_CONTENT)
    this.image(this.smallHeartSo, "Heart", this.tex["heart"], 720, 206, 126, w(1), Z_TOP)

    this.action = this.pill(content, "ActionButton", this.actionHandler)
  }

  private buildTabBar(bar: SceneObject): void {
    this.rect(bar, "Backing", 91, 365.5, 68, 301, ORNAMENT, 34, BORDER, Z_PLATE)
    const keys = ["alert", "call", "hand", "heartbeat", "check"]
    for (let i = 0; i < 5; i++) {
      const cy = 249 + i * 58
      const cell = createChildSceneObjectWithParentLayer("Tab" + i, bar)
      const fill = this.rect(cell, "ActiveFill", 91, cy, 52, 52, LIGHT, 26, null, Z_CONTENT)
      this.tabFills.push(fill.so)
      this.tabIcons.push(this.image(cell, "Icon", this.tex[keys[i]], 91, cy, 22, w(0.45), Z_TOP).img)
    }
  }

  private buildToolbar(root: SceneObject): void {
    // Built around the frame centre, then the group is moved under the window.
    this.toolbarSo = createChildSceneObjectWithParentLayer("Toolbar", root)
    this.rect(this.toolbarSo, "Backing", 720, 405, 252, 60, ORNAMENT, 30, BORDER, Z_PLATE)
    this.voicePill = this.pill(this.toolbarSo, "VoiceButton", () => this.onVoiceEvent.invoke())
    this.endPill = this.pill(this.toolbarSo, "EndButton", () => this.onEndEvent.invoke())
  }

  private buildSideTag(root: SceneObject): void {
    this.sideTag = this.chip(root, "SideTag")
  }

  private buildHeart(root: SceneObject): void {
    this.heartTileSo = createChildSceneObjectWithParentLayer("HeartTile", root)
    this.rect(this.heartTileSo, "Tile", 1149.5, 259.5, 300, 300, TILE, 60, null, Z_PLATE)
    this.heartImgSo = this.image(this.heartTileSo, "Heart", this.tex["heart"], 1149.5, 259.5, 286, w(1), Z_CONTENT).so
    this.heartChip = this.chip(root, "RhythmChip")
  }

  private buildBanner(root: SceneObject): void {
    this.bannerSo = createChildSceneObjectWithParentLayer("SwapBanner", root)
    this.rect(this.bannerSo, "Backing", 839.5, 64.5, 435, 55, LIGHT, 27.5, null, Z_PLATE)
    this.image(this.bannerSo, "Clock", this.tex["clock"], 656, 64.5, 24, DARK, Z_CONTENT)
    const t = this.text(this.bannerSo, "BannerText")
    this.placeText(t, 683, 64.5, 300, 30, 19, 600, DARK, "l")
    t.text = "Swap with someone if you can"
    const m = this.text(this.bannerSo, "BannerTime")
    this.placeText(m, 986, 64.5, 60, 26, 16, 400, new vec4(0.45, 0.45, 0.48, 1), "l")
    m.text = "2 min"
    this.bannerSo.enabled = false
  }

  // ─── Primitives ────────────────────────────────────────────────────────

  /** Opaque, pre-composited fill (see the token note at the top) + optional 1.5 px border. */
  private fill(rr: RoundedRectangle, color: vec4, border: vec4 | null = null): void {
    rr.backgroundColor = new vec4(color.x, color.y, color.z, 1)
    rr.border = border !== null
    if (border) {
      rr.borderSize = cm(1.5)
      rr.borderColor = border
    }
  }

  private rect(parent: SceneObject, name: string, x: number, y: number, wPx: number, hPx: number, color: vec4, radiusPx: number, border: vec4 | null, z: number): {so: SceneObject; rr: RoundedRectangle} {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    so.getTransform().setLocalPosition(pos(x, y, z))
    const rr = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rr.size = new vec2(cm(wPx), cm(hPx))
    rr.cornerRadius = cm(radiusPx)
    rr.gradient = false
    this.fill(rr, color, border)
    return {so, rr}
  }

  private text(parent: SceneObject, name: string): Text {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    const t = so.createComponent("Component.Text") as Text
    this.applyWeight(t, 400)
    t.depthTest = true
    t.verticalAlignment = VerticalAlignment.Center
    t.verticalOverflow = VerticalOverflow.Overflow
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.text = ""
    return t
  }

  /** Static Inter files stand in for SF Pro weights (Lens picks one Font per Text). */
  private applyWeight(t: Text, weight: number): void {
    const byWeight: [number, Font | undefined][] = [
      [200, this.fontExtraLight],
      [300, this.fontLight],
      [400, this.uiFont],
      [500, this.fontMedium],
      [600, this.fontSemiBold]
    ]
    let best: Font | undefined
    let bestD = 1e9
    for (const [wgt, f] of byWeight) {
      if (!f) continue
      const d = Math.abs(wgt - weight)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    if (best) t.font = best
    else t.weight = weight
  }

  /** x,y = centre (align "c") or left edge + vertical centre (align "l"), in Figma px. */
  private placeText(t: Text, x: number, y: number, wPx: number, hPx: number, sizePx: number, weight: number, color: vec4, align: "c" | "l"): void {
    const cx = align === "c" ? x : x + wPx / 2
    t.getSceneObject().getTransform().setLocalPosition(pos(cx, y, Z_TOP))
    t.size = fontSize(sizePx)
    this.applyWeight(t, weight)
    t.horizontalAlignment = align === "c" ? HorizontalAlignment.Center : HorizontalAlignment.Left
    t.layoutRect = Rect.create(-cm(wPx) / 2, cm(wPx) / 2, -cm(hPx) / 2, cm(hPx) / 2)
    t.textFill.color = color
  }

  private image(parent: SceneObject, name: string, tex: Texture | null, x: number, y: number, sizePx: number, tint: vec4, z: number): {so: SceneObject; img: Image} {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    so.getTransform().setLocalPosition(pos(x, y, z))
    so.getTransform().setLocalScale(new vec3(cm(sizePx), cm(sizePx), 1))
    const img = so.createComponent("Component.Image") as Image
    img.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
    if (tex) img.mainPass.baseTex = tex
    img.mainPass.baseColor = tint
    img.mainPass.depthTest = true
    img.mainPass.depthWrite = false
    img.stretchMode = StretchMode.Fit
    so.enabled = tex !== null
    return {so, img}
  }

  private pill(parent: SceneObject, name: string, onPress: () => void): Pill {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    const glow: RoundedRectangle[] = []
    for (let i = 0; i < 2; i++) {
      const g = createChildSceneObjectWithParentLayer("Glow" + i, so)
      g.getTransform().setLocalPosition(new vec3(0, -cm(4), -0.02 - 0.01 * i))
      const rr = g.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      rr.gradient = false
      rr.border = false
      glow.push(rr)
    }
    const bgSo = createChildSceneObjectWithParentLayer("Background", so)
    const bg = bgSo.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    bg.gradient = false
    const iconSo = createChildSceneObjectWithParentLayer("Icon", so)
    const icon = iconSo.createComponent("Component.Image") as Image
    icon.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
    icon.mainPass.depthTest = true
    icon.mainPass.depthWrite = false
    icon.stretchMode = StretchMode.Fit
    const label = this.text(so, "Label")
    // Same collider + Interactable setup as UIKit's Element (own BoxShape, TargetingMode.All).
    const collider = so.createComponent("ColliderComponent") as ColliderComponent
    collider.fitVisual = false
    const shape = Shape.createBoxShape()
    shape.size = new vec3(cm(160), cm(56), cm(20))
    collider.shape = shape
    const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = TargetingMode.All
    const p: Pill = {so, bg, glow, icon, iconSo, label, labelSo: label.getSceneObject(), collider, shape, style: "light"}
    interactable.onTriggerEnd.add(() => onPress())
    interactable.onHoverEnter.add(() => this.hover(p, true))
    interactable.onHoverExit.add(() => this.hover(p, false))
    return p
  }

  /** cx, cy in Figma px (frame space, or parent space for toolbar pills). */
  private setPill(p: Pill, cx: number, cy: number, wPx: number, hPx: number, label: string, style: PillStyle, icon: Texture | null, labelPx: number): void {
    p.style = style
    p.so.enabled = true
    p.so.getTransform().setLocalPosition(pos(cx, cy, Z_TOP))
    p.bg.size = new vec2(cm(wPx), cm(hPx))
    p.bg.cornerRadius = cm(hPx / 2)
    this.fill(p.bg, this.pillColor(style, false), style === "glass" ? BORDER : null)
    const red = style === "red"
    for (let i = 0; i < p.glow.length; i++) {
      p.glow[i].getSceneObject().enabled = red
      const grow = 16 + i * 18
      p.glow[i].size = new vec2(cm(wPx + grow), cm(hPx + grow))
      p.glow[i].cornerRadius = cm((hPx + grow) / 2)
      this.fill(p.glow[i], i === 0 ? GLOW_NEAR : GLOW_FAR)
    }
    const fg = style === "light" ? DARK : w(1)
    const iconPx = labelPx + 2
    const gap = icon ? 8 : 0
    const labelW = this.estimateWidth(label, labelPx, 600)
    const contentW = (icon ? iconPx + gap : 0) + labelW
    const left = -contentW / 2
    p.iconSo.enabled = icon !== null
    if (icon) {
      p.icon.mainPass.baseTex = icon
      p.icon.mainPass.baseColor = fg
      p.iconSo.getTransform().setLocalPosition(new vec3(cm(left + iconPx / 2), 0, 0.04))
      p.iconSo.getTransform().setLocalScale(new vec3(cm(iconPx), cm(iconPx), 1))
    }
    p.label.text = label
    p.label.size = fontSize(labelPx)
    this.applyWeight(p.label, style === "glass" && labelPx < 18 ? 500 : 600)
    p.label.horizontalAlignment = HorizontalAlignment.Left
    p.label.horizontalOverflow = HorizontalOverflow.Overflow
    const lx = left + (icon ? iconPx + gap : 0)
    p.label.layoutRect = Rect.create(0, cm(labelW + 40), -cm(hPx) / 2, cm(hPx) / 2)
    p.labelSo.getTransform().setLocalPosition(new vec3(cm(lx), 0, 0.04))
    p.label.textFill.color = fg
    p.shape.size = new vec3(cm(wPx), cm(hPx), cm(20))
    p.collider.shape = p.shape
  }

  private pillColor(style: PillStyle, hovered: boolean): vec4 {
    if (style === "red") return hovered ? new vec4(1, 0.3, 0.24, 1) : RED
    if (style === "light") return hovered ? w(1) : LIGHT
    return hovered ? PILL_GLASS_HOVER : PILL_GLASS
  }

  private hover(p: Pill, on: boolean): void {
    this.fill(p.bg, this.pillColor(p.style, on), p.style === "glass" ? BORDER : null)
  }

  private chip(parent: SceneObject, name: string): Chip {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    const bgSo = createChildSceneObjectWithParentLayer("Background", so)
    const bg = bgSo.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    bg.gradient = false
    bg.border = true
    bg.borderSize = cm(1.5)
    bg.borderColor = BORDER
    const dotSo = createChildSceneObjectWithParentLayer("Dot", so)
    const dot = dotSo.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    dot.gradient = false
    dot.border = false
    dot.size = new vec2(cm(9), cm(9))
    dot.cornerRadius = cm(4.5)
    const iconSo = createChildSceneObjectWithParentLayer("Icon", so)
    const icon = iconSo.createComponent("Component.Image") as Image
    icon.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
    icon.mainPass.depthTest = true
    icon.mainPass.depthWrite = false
    icon.stretchMode = StretchMode.Fit
    const text = this.text(so, "Text")
    return {so, bg, dot, dotSo, icon, iconSo, text, textSo: text.getSceneObject()}
  }

  /** Glass chip centred at (cx, cy) Figma px; optional coloured dot or icon left of the text. */
  private setChip(c: Chip, cx: number, cy: number, wPx: number, label: string, dot: vec4 | null, icon: Texture | null, labelPx: number = 16): void {
    const hPx = labelPx >= 16 ? 40 : 34
    c.so.getTransform().setLocalPosition(pos(cx, cy, Z_TOP))
    c.bg.size = new vec2(cm(wPx), cm(hPx))
    c.bg.cornerRadius = cm(hPx / 2)
    this.fill(c.bg, ORNAMENT, BORDER)
    const lead = dot ? 9 : icon ? 18 : 0
    const gap = lead > 0 ? 9 : 0
    const labelW = this.estimateWidth(label, labelPx, 500)
    const left = -(lead + gap + labelW) / 2
    c.dotSo.enabled = dot !== null
    if (dot) {
      c.dot.backgroundColor = dot
      c.dotSo.getTransform().setLocalPosition(new vec3(cm(left + 4.5), 0, 0.04))
    }
    c.iconSo.enabled = icon !== null
    if (icon) {
      c.icon.mainPass.baseTex = icon
      c.icon.mainPass.baseColor = w(1)
      c.iconSo.getTransform().setLocalPosition(new vec3(cm(left + 9), 0, 0.04))
      c.iconSo.getTransform().setLocalScale(new vec3(cm(18), cm(18), 1))
    }
    c.text.text = label
    c.text.size = fontSize(labelPx)
    this.applyWeight(c.text, 500)
    c.text.horizontalAlignment = HorizontalAlignment.Left
    c.text.horizontalOverflow = HorizontalOverflow.Overflow
    c.text.layoutRect = Rect.create(0, cm(labelW + 40), -cm(hPx) / 2, cm(hPx) / 2)
    c.text.textFill.color = w(0.92)
    c.textSo.getTransform().setLocalPosition(new vec3(cm(left + lead + gap), 0, 0.04))
  }

  /** Rough SF-Pro-like advance width for centring icon + label groups. */
  private estimateWidth(s: string, sizePx: number, weight: number): number {
    let units = 0
    for (const ch of s) {
      if (ch === " ") units += 0.27
      else if ("il1.'|".indexOf(ch) >= 0) units += 0.27
      else if ("mwMW".indexOf(ch) >= 0) units += 0.82
      else if (ch >= "A" && ch <= "Z") units += 0.66
      else if (ch >= "0" && ch <= "9") units += 0.58
      else units += 0.53
    }
    return units * sizePx * (weight >= 600 ? 1.03 : 1)
  }

  private loadTextures(): void {
    const wired: {[k: string]: Texture | undefined} = {
      alert: this.iconAlert,
      call: this.iconCall,
      hand: this.iconHand,
      heartbeat: this.iconHeartbeat,
      check: this.iconCheck,
      voice: this.iconVoice,
      close: this.iconClose,
      clock: this.iconClock,
      up: this.iconUp,
      down: this.iconDown,
      heart: this.heartTexture
    }
    const missing: string[] = []
    for (const k in wired) {
      this.tex[k] = wired[k] ?? null
      if (!wired[k]) missing.push(k)
    }
    if (missing.length > 0) print("CPRCoachUI: unwired textures: " + missing.join(", "))
  }

  private child(root: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const c = root.getChild(i)
      if (c.name === name) return c
    }
    return null
  }
}
