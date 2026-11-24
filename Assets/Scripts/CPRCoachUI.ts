// CPRCoachUI — passive UIKit view for the HandsOn CPR coach.
//
// Owns: the StepWindow (frosted glass plate, step label, instruction, counter, one pinch button,
// hold progress bar) and the StepTabBar (vertical glass capsule with 5 round icon tabs).
// Exposes small setters + one event (onAction). No step logic. Never moves its own root —
// CPRCoach owns the CPRCoachUI root transform (head-follow / chest-anchored).
//
// Scene contract (authored by the bootstrap step):
//   CPRCoachUI (this script)
//     StepWindow  (host, local x 2.6)  — panel content is attached here at runtime
//     StepTabBar  (host, local x -8.5) — tab bar content is attached here at runtime
// Hosts are resolved through the optional @inputs, else by child name. Missing hosts fail closed.
//
// UIKit 4.0.0 / InteractionKit 4.0.0, System3 theme. Layout = Flex columns; depth separation =
// Canvas on each panel host + one +Z on each stacked layer (backing -> content -> tab icons).

import Event, {PublicApi} from "InteractionKit.lspkg/Utils/Event"
import {Button} from "UIKit.lspkg/Scripts/Components/Button/Button"
import {addContentToElement} from "UIKit.lspkg/Scripts/Components/Content/ElementContentFactory"
import {ElementContent} from "UIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexLayout} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {ProgressBar} from "UIKit.lspkg/Scripts/Components/ProgressBar/ProgressBar"
import {RoundedRectangle, GradientParameters} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {RoundedRectangleVisual} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"
import {CanvasController} from "UIKit.lspkg/Scripts/Utility/CanvasController"
import {createChildSceneObjectWithParentLayer} from "UIKit.lspkg/Scripts/Utility/SceneUtilities"
import {IMAGE_MATERIAL_ASSET} from "UIKit.lspkg/Scripts/Utility/Assets"

const THEME = "System3"

// Text sizes are font numbers (em-square cm = size / 43.886), scaled from the Specs type scale
// (calibrated at 110 cm) to the ~60 cm reading distance of this window.
const READ_SCALE = 60 / 110
const SIZE_LABEL = Math.round(38 * READ_SCALE) // Caption
const SIZE_INSTRUCTION = Math.round(48 * READ_SCALE) // Headline2
const SIZE_COUNTER = Math.round(105 * READ_SCALE) // Title1 — largest element
const SIZE_BUTTON = Math.round(39 * READ_SCALE) // Button

// Depth lifts (cm): one absolute +Z per stacked coplanar layer.
const CONTENT_Z = 0.1
const TAB_ICON_Z = 0.08

// StepWindow geometry (cm) — full extent 15 x 12.
const WIN_W = 15
const WIN_H = 12
const WIN_PAD = 0.6
const INNER_W = WIN_W - WIN_PAD * 2
const ROW_GAP = 0.3
const LABEL_H = 1.0
const INSTR_H = 3.0
const COUNTER_H = 3.0
const FOOTER_H = 2.8
const BUTTON_W = 10
const BUTTON_H = 2.6
const PROGRESS_W = 10
const PROGRESS_H = 0.8

// StepTabBar geometry (cm) — 3.2 x 15 capsule, 5 round 2.4 cm tabs.
const BAR_W = 3.2
const BAR_H = 15
const TAB_SIZE = 2.4
const TAB_GAP = 0.4
const TAB_ICON = 1.4
const TAB_COUNT = 5

const DARK_ICON = new vec4(0.1, 0.11, 0.13, 1)

function solidGradient(c: vec4): GradientParameters {
  return {
    type: "Linear",
    start: new vec2(-1, 0),
    end: new vec2(1, 0),
    stop0: {enabled: true, color: c, percent: 0},
    stop1: {enabled: true, color: c, percent: 0.5},
    stop2: {enabled: true, color: c, percent: 1}
  } as GradientParameters
}

function scaleRgb(c: vec4, k: number): vec4 {
  return new vec4(Math.min(1, c.x * k), Math.min(1, c.y * k), Math.min(1, c.z * k), c.w)
}

@component
export class CPRCoachUI extends BaseScriptComponent {
  @ui.group_start("Settings")
  @input
  @widget(new ColorWidget())
  accentColor: vec4 = new vec4(0.949, 0.224, 0.173, 1) // #F2392C
  @input
  @widget(new ColorWidget())
  glassTint: vec4 = new vec4(0.12, 0.13, 0.15, 0.75) // dark neutral glass: white text stays legible on additive display
  @input
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  @ui.group_start("References")
  @input
  @allowUndefined
  stepWindow: SceneObject
  @input
  @allowUndefined
  stepTabBar: SceneObject
  @input
  @allowUndefined
  iconCheck: Texture // warning
  @input
  @allowUndefined
  iconCall: Texture // call
  @input
  @allowUndefined
  iconHands: Texture // back_hand
  @input
  @allowUndefined
  iconPush: Texture // monitor_heart
  @input
  @allowUndefined
  iconDone: Texture // check_circle
  @ui.group_end

  private onActionEvent: Event<void> = new Event<void>()
  /** Fires when the user pinches the step button. */
  public readonly onAction: PublicApi<void> = this.onActionEvent.publicApi()

  // Buffered state — setters may run before the build.
  private stepLabel: string = "Step 1 of 5"
  private instruction: string = ""
  private counter: string = ""
  private buttonLabel: string = "Start CPR"
  private buttonVisible: boolean = true
  private buttonAccent: boolean = true
  private holdValue: number = 0
  private holdVisible: boolean = false
  private activeTab: number = 0
  private visible: boolean = true

  private built: boolean = false
  private labelText: Text | null = null
  private instructionText: Text | null = null
  private counterText: Text | null = null
  private button: Button | null = null
  private buttonContent: ElementContent | null = null
  private buttonObject: SceneObject | null = null
  private progress: ProgressBar | null = null
  private progressObject: SceneObject | null = null
  private tabFills: SceneObject[] = []
  private tabIcons: (Image | null)[] = []
  private tabFallbackLabels: (Text | null)[] = []
  private themeGradients: {d: GradientParameters; h: GradientParameters; t: GradientParameters} | null = null
  private buttonReady: boolean = false

  onAwake(): void {
    const win = this.stepWindow ?? this.findChild(this.sceneObject, "StepWindow")
    const bar = this.stepTabBar ?? this.findChild(this.sceneObject, "StepTabBar")
    if (!win || !bar) {
      print("CPRCoachUI: StepWindow / StepTabBar host not found under CPRCoachUI. Check scene wiring.")
      return
    }
    this.stepWindow = win
    this.stepTabBar = bar
    this.buildWindow(win)
    this.buildTabBar(bar)
    this.built = true
    this.applyAll()
  }

  // ─── Public API (ui_api contract) ──────────────────────────────────────

  public setStepLabel(text: string): void {
    this.stepLabel = text
    if (this.labelText) this.labelText.text = text
  }

  public setInstruction(text: string): void {
    this.instruction = text
    if (this.instructionText) this.instructionText.text = text
  }

  public setCounter(text: string): void {
    this.counter = text
    if (this.counterText) this.counterText.text = text
  }

  public setButton(label: string, visible: boolean, accent: boolean): void {
    this.buttonLabel = label
    this.buttonVisible = visible
    this.buttonAccent = accent
    this.applyButton()
  }

  public setHoldProgress(value01: number, visible: boolean): void {
    this.holdValue = isNaN(value01) ? 0 : Math.max(0, Math.min(1, value01))
    this.holdVisible = visible
    this.applyProgress()
  }

  public setActiveTab(index: number): void {
    this.activeTab = Math.max(0, Math.min(TAB_COUNT - 1, Math.floor(index)))
    this.applyTabs()
  }

  public setVisible(visible: boolean): void {
    this.visible = visible
    if (this.stepWindow) this.stepWindow.enabled = visible
    if (this.stepTabBar) this.stepTabBar.enabled = visible
  }

  // ─── Build: StepWindow ─────────────────────────────────────────────────

  private buildWindow(win: SceneObject): void {
    new CanvasController(win).ensure(new vec2(WIN_W, WIN_H))

    // Layer 0: frosted glass plate.
    const backing = createChildSceneObjectWithParentLayer("Backing", win)
    const plate = backing.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    plate.size = new vec2(WIN_W, WIN_H)
    plate.cornerRadius = 1.4
    plate.gradient = false
    plate.backgroundColor = this.glassTint
    plate.border = true
    plate.borderSize = 0.08
    plate.borderColor = new vec4(1, 1, 1, 0.45)

    // Layer 1: content column, one +Z lift.
    const content = createChildSceneObjectWithParentLayer("Content", win)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false
    col.direction = FlexDirection.Column
    col.width = INNER_W
    col.height = WIN_H - WIN_PAD * 2
    col.justifyContent = FlexJustify.Center
    col.alignItems = FlexAlign.Center
    col.rowGap = ROW_GAP

    const items: FlexItem[] = []
    const label = this.makeText(content, "StepLabel", LABEL_H, SIZE_LABEL, 500, new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85), false)
    this.labelText = label.text
    items.push(label.item)

    const instr = this.makeText(content, "Instruction", INSTR_H, SIZE_INSTRUCTION, 600, this.textColor, true)
    this.instructionText = instr.text
    items.push(instr.item)

    const counter = this.makeText(content, "Counter", COUNTER_H, SIZE_COUNTER, 700, this.textColor, false)
    this.counterText = counter.text
    items.push(counter.item)

    // Footer slot: button and hold progress share it (mutually exclusive).
    const footer = createChildSceneObjectWithParentLayer("Footer", content)
    const footerItem = footer.createComponent(FlexItem.getTypeName()) as FlexItem
    footerItem.overrideWidth = INNER_W
    footerItem.overrideHeight = FOOTER_H
    footerItem.flexGrow = 0
    footerItem.flexShrink = 0
    items.push(footerItem)

    this.buildButton(footer)
    this.buildProgress(footer)

    col.addItems(items)
  }

  private makeText(
    parent: SceneObject,
    name: string,
    height: number,
    size: number,
    weight: number,
    color: vec4,
    wrap: boolean
  ): {text: Text; item: FlexItem} {
    const so = createChildSceneObjectWithParentLayer(name, parent)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size
    t.weight = weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Shrink
    t.layoutRect = Rect.create(-INNER_W / 2, INNER_W / 2, -height / 2, height / 2)
    t.textFill.color = color
    t.text = ""
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = INNER_W
    item.overrideHeight = height
    item.flexGrow = 0
    item.flexShrink = 0
    return {text: t, item}
  }

  private buildButton(footer: SceneObject): void {
    const so = createChildSceneObjectWithParentLayer("ActionButton", footer)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: THEME, shape: "Capsule", style: "Primary"}) // before initialize()
    btn.size = new vec3(BUTTON_W, BUTTON_H, 1)
    btn.initialize()
    this.buttonContent = addContentToElement(so, {text: this.buttonLabel, textSize: SIZE_BUTTON})
    btn.onTriggerUp.add(() => this.onActionEvent.invoke())
    btn.onInitialized.add(() => {
      this.buttonReady = true
      const v = btn.visual
      if (v instanceof RoundedRectangleVisual) {
        this.themeGradients = {d: v.defaultGradient, h: v.hoveredGradient, t: v.triggeredGradient}
      }
      this.applyButton()
    })
    this.button = btn
    this.buttonObject = so
  }

  private buildProgress(footer: SceneObject): void {
    const so = createChildSceneObjectWithParentLayer("HoldProgress", footer)
    const bar = so.createComponent(ProgressBar.getTypeName()) as ProgressBar
    bar.size = new vec3(PROGRESS_W, PROGRESS_H, 1)
    bar.updateValue(0)
    this.progress = bar
    this.progressObject = so
  }

  // ─── Build: StepTabBar ─────────────────────────────────────────────────

  private buildTabBar(bar: SceneObject): void {
    new CanvasController(bar).ensure(new vec2(BAR_W, BAR_H))

    // Layer 0: glass capsule.
    const backing = createChildSceneObjectWithParentLayer("Backing", bar)
    const capsule = backing.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    capsule.size = new vec2(BAR_W, BAR_H)
    capsule.cornerRadius = BAR_W / 2
    capsule.gradient = false
    capsule.backgroundColor = this.glassTint
    capsule.border = true
    capsule.borderSize = 0.08
    capsule.borderColor = new vec4(1, 1, 1, 0.45)

    // Layer 1: tab column, one +Z lift.
    const tabs = createChildSceneObjectWithParentLayer("Tabs", bar)
    tabs.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const col = tabs.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false
    col.direction = FlexDirection.Column
    col.width = BAR_W
    col.height = BAR_H
    col.justifyContent = FlexJustify.Center
    col.alignItems = FlexAlign.Center
    col.rowGap = TAB_GAP

    const icons = this.resolveIcons()
    const fallbackGlyphs = ["!", "112", "✋", "♥", "✓"]
    const items: FlexItem[] = []
    for (let i = 0; i < TAB_COUNT; i++) {
      const cell = createChildSceneObjectWithParentLayer("Tab" + i, tabs)
      const item = cell.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = TAB_SIZE
      item.overrideHeight = TAB_SIZE
      item.flexGrow = 0
      item.flexShrink = 0
      items.push(item)

      // Active fill circle (layer 1 of the tab).
      const fillSo = createChildSceneObjectWithParentLayer("ActiveFill", cell)
      const fill = fillSo.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
      fill.size = new vec2(TAB_SIZE, TAB_SIZE)
      fill.cornerRadius = TAB_SIZE / 2
      fill.gradient = false
      fill.backgroundColor = new vec4(1, 1, 1, 0.95)
      fill.border = false
      this.tabFills.push(fillSo)

      // Icon (layer 2 of the tab, +Z over the fill).
      const iconSo = createChildSceneObjectWithParentLayer("Icon", cell)
      iconSo.getTransform().setLocalPosition(new vec3(0, 0, TAB_ICON_Z))
      const tex = icons[i]
      if (tex) {
        const img = iconSo.createComponent("Component.Image") as Image
        img.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
        img.mainPass.baseTex = tex
        img.mainPass.depthTest = true
        img.mainPass.depthWrite = false
        img.stretchMode = StretchMode.Fit
        iconSo.getTransform().setLocalScale(new vec3(TAB_ICON, TAB_ICON, 1))
        this.tabIcons.push(img)
        this.tabFallbackLabels.push(null)
      } else {
        // Text-glyph fallback when an icon texture is unavailable.
        const t = iconSo.createComponent("Component.Text") as Text
        t.depthTest = true
        t.size = SIZE_LABEL
        t.weight = 700
        t.horizontalAlignment = HorizontalAlignment.Center
        t.verticalAlignment = VerticalAlignment.Center
        t.horizontalOverflow = HorizontalOverflow.Shrink
        t.layoutRect = Rect.create(-TAB_ICON / 2, TAB_ICON / 2, -TAB_ICON / 2, TAB_ICON / 2)
        t.text = fallbackGlyphs[i]
        this.tabIcons.push(null)
        this.tabFallbackLabels.push(t)
      }
    }
    col.addItems(items)
  }

  private resolveIcons(): (Texture | null)[] {
    const wired: (Texture | undefined)[] = [this.iconCheck, this.iconCall, this.iconHands, this.iconPush, this.iconDone]
    // Paths produced by /icon-selector (.clad/steps/icon.json); loaded only when an @input is unwired.
    const paths = [
      "../Icons/warning.png",
      "../Icons/call.png",
      "../Icons/back_hand.png",
      "../Icons/monitor_heart.png",
      "../Icons/check_circle.png"
    ]
    const out: (Texture | null)[] = []
    for (let i = 0; i < TAB_COUNT; i++) {
      let tex: Texture | null = wired[i] ?? null
      if (!tex) {
        try {
          tex = requireAsset(paths[i]) as Texture
        } catch (e) {
          print("CPRCoachUI: icon " + paths[i] + " unavailable, using text glyph")
          tex = null
        }
      }
      out.push(tex)
    }
    return out
  }

  // ─── Apply buffered state ──────────────────────────────────────────────

  private applyAll(): void {
    this.setStepLabel(this.stepLabel)
    this.setInstruction(this.instruction)
    this.setCounter(this.counter)
    this.applyButton()
    this.applyProgress()
    this.applyTabs()
    this.setVisible(this.visible)
  }

  private applyButton(): void {
    if (!this.built || !this.buttonObject) return
    this.buttonObject.enabled = this.buttonVisible
    if (this.buttonContent) {
      this.buttonContent.text = this.buttonLabel
      this.buttonContent.useTextColorOverride = this.buttonAccent
      if (this.buttonAccent) this.buttonContent.textColorOverride = new vec4(1, 1, 1, 1)
    }
    if (!this.buttonReady || !this.button) return
    const v = this.button.visual
    if (!(v instanceof RoundedRectangleVisual)) return
    if (this.buttonAccent) {
      v.defaultGradient = solidGradient(this.accentColor)
      v.hoveredGradient = solidGradient(scaleRgb(this.accentColor, 1.15))
      v.triggeredGradient = solidGradient(scaleRgb(this.accentColor, 0.75))
    } else if (this.themeGradients) {
      v.defaultGradient = this.themeGradients.d
      v.hoveredGradient = this.themeGradients.h
      v.triggeredGradient = this.themeGradients.t
    }
  }

  private applyProgress(): void {
    if (!this.built || !this.progressObject || !this.progress) return
    this.progressObject.enabled = this.holdVisible
    this.progress.updateValue(this.holdValue)
  }

  private applyTabs(): void {
    if (!this.built) return
    for (let i = 0; i < TAB_COUNT; i++) {
      const active = i === this.activeTab
      const finished = i < this.activeTab
      this.tabFills[i].enabled = active
      const tint = active
        ? DARK_ICON
        : new vec4(this.textColor.x, this.textColor.y, this.textColor.z, finished ? 1 : 0.45)
      const img = this.tabIcons[i]
      if (img) img.mainPass.baseColor = tint
      const t = this.tabFallbackLabels[i]
      if (t) t.textFill.color = tint
    }
  }

  // ─── Utils ─────────────────────────────────────────────────────────────

  private findChild(root: SceneObject, name: string): SceneObject | null {
    const n = root.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const c = root.getChild(i)
      if (c.name === name) return c
    }
    for (let i = 0; i < n; i++) {
      const found = this.findChild(root.getChild(i), name)
      if (found) return found
    }
    return null
  }
}
