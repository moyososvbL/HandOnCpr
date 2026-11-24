// CPRCoachPlacement — pure pose math for HandsOn CPR. No @component, no scene mutation.
// Owns: where the manikin, the step window (follow + chest-anchored) and the heart go.
// Callers (CPRCoach) apply the returned poses. All units cm, rotations as quat (radians).

export type Pose = { position: vec3; rotation: quat };

/** Camera forward flattened onto the floor plane (camera looks down local -Z). */
export function flatForward(camT: Transform): vec3 {
  const f = camT.forward.uniformScale(-1);
  const flat = new vec3(f.x, 0, f.z);
  return flat.length < 1e-4 ? new vec3(0, 0, -1) : flat.normalize();
}

/** Yaw-only rotation that maps local -Z onto `dir` (flat). */
export function yawToward(dir: vec3): quat {
  return quat.fromEulerAngles(0, Math.atan2(-dir.x, -dir.z), 0);
}

/** Rotation whose +Z (the UI front face) points from `from` toward `to`. */
export function faceToward(from: vec3, to: vec3): quat {
  const d = to.sub(from);
  return d.length < 1e-4 ? quat.quatIdentity() : quat.lookAt(d.normalize(), vec3.up());
}

/**
 * Manikin root pose: grounded origin on the floor (camY - floorBelowEye), head away from the
 * user (local -Z along camera flat forward), chest point `chestDistance` cm ahead of the eyes.
 * `chestLocal` is the mesh's chest point (mesh payload chest_point_local_cm, z = -14).
 */
export function manikinPose(camT: Transform, chestDistance: number, floorBelowEye: number, chestLocal: vec3): Pose {
  const cam = camT.getWorldPosition();
  const fwd = flatForward(camT);
  // Local -Z == fwd, so a local z of -14 sits 14 cm further along fwd than the origin.
  const rootAhead = chestDistance + chestLocal.z; // 60 + (-14) = 46
  const position = new vec3(cam.x, cam.y - floorBelowEye, cam.z).add(fwd.uniformScale(rootAhead));
  return { position, rotation: yawToward(fwd) };
}

/** World chest point of a placed manikin (handles its scale/rotation). */
export function chestPoint(manikinT: Transform, chestLocal: vec3): vec3 {
  return manikinT.getWorldTransform().multiplyPoint(chestLocal);
}

/** Direction from chest toward the manikin's head (its local -Z), flattened. */
export function towardHead(manikinT: Transform): vec3 {
  const b = manikinT.back; // local -Z in world
  const flat = new vec3(b.x, 0, b.z);
  return flat.length < 1e-4 ? new vec3(0, 0, -1) : flat.normalize();
}

/** Target follow pose: `distance` ahead (flat), `dropCm` below eye, yaw-only facing the camera. */
export function followTarget(camT: Transform, distance: number, dropCm: number): Pose {
  const cam = camT.getWorldPosition();
  const fwd = flatForward(camT);
  const position = cam.add(fwd.uniformScale(distance)).add(new vec3(0, -dropCm, 0));
  return { position, rotation: yawToward(fwd) };
}

/** Lazy head follow: exponential approach toward the follow target at `rate` per second. */
export function followPose(camT: Transform, distance: number, current: Pose, dt: number, rate: number = 4, dropCm: number = 3): Pose {
  const target = followTarget(camT, distance, dropCm);
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return {
    position: vec3.lerp(current.position, target.position, k),
    rotation: quat.slerp(current.rotation, target.rotation, k),
  };
}

/** Chest-anchored window: 25 cm beyond the guide toward the head, 12 cm up, tilted to face the user. */
export function anchoredWindowPose(chestPos: vec3, headDir: vec3, camPos: vec3, beyondCm: number = 25, upCm: number = 12): Pose {
  const position = chestPos.add(headDir.uniformScale(beyondCm)).add(new vec3(0, upCm, 0));
  return { position, rotation: faceToward(position, camPos) };
}

/** Heart: `rightCm` to the user's right of the guide, slightly raised, upright, facing the user. */
export function heartPose(chestPos: vec3, right: vec3, camPos: vec3, rightCm: number = 20, upCm: number = 6): Pose {
  const position = chestPos.add(right.uniformScale(rightCm)).add(new vec3(0, upCm, 0));
  const d = camPos.sub(position);
  const flat = new vec3(d.x, 0, d.z);
  const rotation = flat.length < 1e-4 ? quat.quatIdentity() : quat.lookAt(flat.normalize(), vec3.up());
  return { position, rotation };
}

// ─── Figma frame mapping ──────────────────────────────────────────────────
// The UI is authored on a plane in "Figma frame" coordinates: 1 Figma px = FIGMA_K cm at
// FRAME_REF cm from the eye (the 1440 px frame spans the ~32° SPECS view). Scaling the plane
// by distance / FRAME_REF keeps every element at the same angular size as in the PNGs.
export const FIGMA_K = 0.0178;
export const FRAME_REF = 45;

/** Camera look direction (camera looks down local -Z). */
export function lookDir(camT: Transform): vec3 {
  return camT.forward.uniformScale(-1).normalize();
}

/** Follow mode: frame centre on the view direction `distance` ahead, facing the camera. */
export function frameFollowTarget(camT: Transform, distance: number): Pose {
  const cam = camT.getWorldPosition();
  const look = lookDir(camT);
  const position = cam.add(look.uniformScale(distance));
  return { position, rotation: quat.lookAt(look.uniformScale(-1), vec3.up()) };
}

/** Lazy follow toward frameFollowTarget at `rate` per second. */
export function frameFollowPose(camT: Transform, distance: number, current: Pose, dt: number, rate: number = 4): Pose {
  const target = frameFollowTarget(camT, distance);
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return {
    position: vec3.lerp(current.position, target.position, k),
    rotation: quat.slerp(current.rotation, target.rotation, k),
  };
}

/**
 * Chest mode: a frame plane `distance` cm from the eye along the ray to `point`, facing the
 * camera, positioned so the frame-local point `frameLocal` (cm at FRAME_REF) lands on `point`'s
 * line of sight. Returns the pose and the uniform scale to apply (distance / FRAME_REF).
 */
export function frameAtPoint(camT: Transform, point: vec3, frameLocal: vec3, distance: number): { pose: Pose; scale: number } {
  const cam = camT.getWorldPosition();
  const dir = point.sub(cam).normalize();
  const rotation = quat.lookAt(dir.uniformScale(-1), vec3.up());
  const scale = distance / FRAME_REF;
  const anchor = cam.add(dir.uniformScale(distance));
  const position = anchor.sub(rotation.multiplyVec3(frameLocal.uniformScale(scale)));
  return { pose: { position, rotation }, scale };
}

/** User's right on the floor plane given a flat forward. */
export function rightOf(fwd: vec3): vec3 {
  return fwd.cross(vec3.up()).normalize();
}
