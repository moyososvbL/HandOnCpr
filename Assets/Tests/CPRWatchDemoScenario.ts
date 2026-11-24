// Criterion 2: on Watch first the manikin is on the floor, the HandsGuide is enabled on its chest
// (torso, not near the hip end) and the counter cue alternates between the two demo lines.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObject, matchSceneObjectName, matchSceneObjectParentName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CPRHandInteractor} from "./CPRHandInteractor"
import {coach, goToWatch, state, text, waitReady} from "./CPRTestUtils"

const CHEST_LOCAL = new vec3(0, 21, -9) // CPRCoach.ts chest point (Manikin local cm)
const FLOOR_BELOW_EYE = 90
const PUSH = "Push down 5 cm"
const RISE = "Let the chest rise"

@component
export class CPRWatchDemoScenario extends Scenario {
  async run(): Promise<void> {
    await waitReady()
    const hand = new CPRHandInteractor("right")
    await goToWatch(hand)
    await hand.hand.hide()

    const c = coach()
    const manikin = c.manikin
    const guide = c.guide
    const camPos = c.camera.getTransform().getWorldPosition()

    // Manikin visible and grounded 90 cm below the eyes.
    const mesh = findSceneObject(
      (so) => matchSceneObjectName("Manikin")(so) && matchSceneObjectParentName("Scene0")(so),
    )
    const rmv = mesh.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    expect(manikin.enabled).toBe(true)
    expect(mesh.enabled).toBe(true)
    expect(rmv.enabled).toBe(true)
    const floorY = camPos.y - FLOOR_BELOW_EYE
    const mPos = manikin.getTransform().getWorldPosition()
    print(`[CPRTest] cam y=${camPos.y.toFixed(1)} manikin root y=${mPos.y.toFixed(1)} mesh aabb min y=${rmv.worldAabbMin().y.toFixed(1)} floor=${floorY.toFixed(1)}`)
    expect(Math.abs(mPos.y - floorY) < 1).toBe(true)
    expect(Math.abs(rmv.worldAabbMin().y - floorY) < 2).toBe(true)

    // Guide enabled at the chest point (horizontal match; vertical within lift + press depth).
    expect(guide.enabled).toBe(true)
    const chest = manikin.getTransform().getWorldTransform().multiplyPoint(CHEST_LOCAL)
    const g = guide.getTransform().getWorldPosition()
    const horiz = new vec2(g.x - chest.x, g.z - chest.z).length
    const dy = g.y - chest.y
    print(`[CPRTest] guide=(${g.x.toFixed(1)},${g.y.toFixed(1)},${g.z.toFixed(1)}) chest=(${chest.x.toFixed(1)},${chest.y.toFixed(1)},${chest.z.toFixed(1)}) horiz=${horiz.toFixed(2)} dy=${dy.toFixed(2)}`)
    expect(horiz < 1).toBe(true)
    expect(dy > -(c.pressDepth + 1) && dy < 1.5).toBe(true)
    const statedChest: vec3 = state().chestPos
    expect(new vec2(statedChest.x - chest.x, statedChest.z - chest.z).length < 0.5).toBe(true)

    // Inside the torso: within the mesh footprint, in the head-ward half of its length
    // (head is mesh local -Z), well away from the hip / feet end.
    const local = mesh.getTransform().getInvertedWorldTransform().multiplyPoint(statedChest)
    const lo = rmv.localAabbMin()
    const hi = rmv.localAabbMax()
    const along = (local.z - lo.z) / (hi.z - lo.z) // 0 = head end, 1 = foot end
    const across = (local.x - lo.x) / (hi.x - lo.x)
    print(`[CPRTest] guide in mesh local=(${local.x.toFixed(3)},${local.y.toFixed(3)},${local.z.toFixed(3)}) aabb z=[${lo.z.toFixed(3)},${hi.z.toFixed(3)}] along=${along.toFixed(2)} across=${across.toFixed(2)}`)
    expect(across > 0.3 && across < 0.7).toBe(true)
    expect(along > 0.1 && along < 0.5).toBe(true)

    // Counter cue alternates for ~2.5 s (about 4.5 presses at 110/min).
    const seen: {[k: string]: number} = {}
    let switches = 0
    let last = text("Counter")
    const t0 = getTime()
    while (getTime() - t0 < 2.5) {
      await nextFrame()
      const cur = text("Counter")
      seen[cur] = (seen[cur] ?? 0) + 1
      if (cur !== last) switches++
      last = cur
    }
    print(`[CPRTest] counter values seen: ${JSON.stringify(seen)} switches=${switches}`)
    expect(Object.keys(seen).length).toBe(2)
    expect((seen[PUSH] ?? 0) > 0).toBe(true)
    expect((seen[RISE] ?? 0) > 0).toBe(true)
    expect(switches >= 6).toBe(true)
  }
}
