// LEAF test helpers for HandsOn CPR. Read-only access to Lens state; drives it only through
// the real interactables (ActionButton, HandsGuide) and, for the swap test, a runtime-only
// tweak of CPRCoach.swapEvery (never written to the scene).
//
// UI (CPRCoachUI) object names repeat ("Label" in every pill, "Text" in every chip, "Heart" in
// several tiles), so lookups are scoped by parent name.
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {
  findSceneObject,
  findSceneObjectByName,
  matchSceneObjectName,
  matchSceneObjectParentName,
  nextFrame,
  sleep,
} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Interactable} from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {RoundedRectangle} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {CPRCoach} from "../Scripts/CPRCoach"
import {CPRCoachUI} from "../Scripts/CPRCoachUI"
import {CPRHandInteractor} from "./CPRHandInteractor"

// Mirrors the private Step enum in CPRCoach.ts.
export const STEP = {Check: 0, Call: 1, Watch: 2, Place: 3, Push: 4, Done: 5}

export function coach(): CPRCoach {
  const so = findSceneObjectByName("CPRCoach")
  if (!so) throw new Error("CPRCoach scene object not found")
  const c = so.getComponent(CPRCoach.getTypeName()) as CPRCoach
  if (!c) throw new Error("CPRCoach script not found")
  return c
}

export function coachUI(): CPRCoachUI {
  const so = findSceneObjectByName("CPRCoachUI")
  if (!so) throw new Error("CPRCoachUI scene object not found")
  const c = so.getComponent(CPRCoachUI.getTypeName()) as CPRCoachUI
  if (!c) throw new Error("CPRCoachUI script not found")
  return c
}

/** Private runtime state of the coach (read-only use). */
export function state(): any {
  return coach() as any
}

export function step(): number {
  return state().step as number
}

/** Scene object `name` whose direct parent is `parent`. */
export function child(parent: string, name: string): SceneObject {
  const so = findSceneObject((o) => matchSceneObjectName(name)(o) && matchSceneObjectParentName(parent)(o))
  if (!so) throw new Error(`"${parent}/${name}" not found`)
  return so
}

export function obj(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`"${name}" not found`)
  return so
}

function textOf(so: SceneObject): string {
  const t = so.getComponent("Component.Text") as Text
  if (!t) throw new Error(`"${so.name}" has no Text`)
  return t.text
}

/** Window text under StepWindow/Content: StepLabel, Instruction, SubText, Counter, CounterCaption. */
export function text(name: string): string {
  return textOf(child("Content", name))
}

export function textIn(parent: string, name: string): string {
  return textOf(child(parent, name))
}

/** Is the window text object itself enabled (e.g. StepLabel hidden on Done)? */
export function textShown(name: string): boolean {
  return child("Content", name).enabled
}

export function buttonLabel(): string {
  return textIn("ActionButton", "Label")
}

export function sideTag(): string {
  return textIn("SideTag", "Text")
}

export function holdFillWidth(): number {
  const rr = child("HoldProgress", "Fill").getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  return rr.size.x
}

export function activeTabs(): number[] {
  const out: number[] = []
  for (let i = 0; i < 5; i++) {
    const fill = child("Tab" + i, "ActiveFill")
    if (fill.enabled) out.push(i)
  }
  return out
}

export function expectTab(index: number): void {
  const tabs = activeTabs()
  print(`[CPRTest] active tabs = [${tabs.join(",")}], expected [${index}]`)
  expect(tabs.length).toBe(1)
  expect(tabs[0]).toBe(index)
}

export function actionButton(): Interactable {
  const b = findInteractableByName("ActionButton")
  if (!b) throw new Error("ActionButton interactable not found")
  return b
}

export function guideInteractable(): Interactable {
  const b = findInteractableByName("HandsGuide")
  if (!b) throw new Error("HandsGuide interactable not found")
  return b
}

/** Wait for the Lens to finish onStart and the UI to build. */
export async function waitReady(): Promise<void> {
  await sleep(1500)
  for (let i = 0; i < 120 && !(coach() as any).started; i++) await nextFrame()
  expect((coach() as any).started).toBe(true)
}

/** Pinch the action pill, which must currently read `label`, and expect `toStep` afterwards. */
export async function pressStepButton(hand: CPRHandInteractor, label: string, toStep: number): Promise<void> {
  expect(buttonLabel()).toBe(label)
  expect(obj("ActionButton").enabled).toBe(true)
  const before = step()
  await hand.pinch(actionButton())
  print(`[CPRTest] pinched "${label}": step ${before} -> ${step()}`)
  expect(step()).toBe(toStep)
}

/** Check -> Call -> Watch. */
export async function goToWatch(hand: CPRHandInteractor): Promise<void> {
  expect(step()).toBe(STEP.Check)
  await pressStepButton(hand, "Start CPR", STEP.Call)
  await pressStepButton(hand, "Called", STEP.Watch)
}

/** Check -> ... -> Place -> (hold) -> Push. */
export async function goToPush(hand: CPRHandInteractor): Promise<void> {
  await goToWatch(hand)
  await pressStepButton(hand, "I'm ready", STEP.Place)
  await hand.pinchHold(guideInteractable(), 1300)
  await sleep(200)
  expect(step()).toBe(STEP.Push)
}

export async function waitFor(cond: () => boolean, timeoutSecs: number): Promise<boolean> {
  const t0 = getTime()
  while (!cond()) {
    if (getTime() - t0 > timeoutSecs) return false
    await nextFrame()
  }
  return true
}

export function isNumber(s: string): boolean {
  return /^\d+$/.test(s)
}
