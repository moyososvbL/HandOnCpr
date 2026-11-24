# HandsOn CPR — build brief for the Lens Studio agent

Build this Lens in the open Lens Studio project using the Lens Studio MCP tools (and CLAD skills).
Design reference: Figma "HandsOn CPR · User flow" (Apple Vision Pro–style frosted glass).
Logic already exists: `Assets/Scripts/CPRCoach.ts` — do not rewrite it, wire the scene to it.
Textures already exist in `Assets/Textures/`: `hands_white.png`, `hands_green.png`, `heart.png` (all have transparency).

## 1. Scene basics
- Camera Object has Device Tracking (World). Keep it.
- Remove/disable `InteractionKitExamples`. Keep `InteractionKit` and `UIKit` packages.

## 2. Hands guide (on the chest)
- Create a SceneObject `HandsGuide` with a plane mesh (about 22 × 22 cm) lying flat, facing up (like hands resting on a chest).
- Material: unlit, alpha-blended, texture `hands_white.png`, base colour white.
- Swap the texture to `hands_green.png` whenever the script sets the GREEN colour (or simply tint — the script sets `mainPass.baseColor`).
- Assign to CPRCoach inputs `guide` and `guideVisual`.

## 3. Main glass window (follows the user, UIKit)
Use a UIKit Frame/Container (frosted glass, rounded corners ~4 cm, slightly translucent grey) about 45 cm in front of the user, slightly above eye line:
- `Step` text (small, 60 % white), e.g. "Step 3 of 5"
- `Instruction` text (large, white, semibold) → CPRCoach `instructionText`
- `Counter` text (very large, thin) → CPRCoach `counterText`
- One pinch button (UIKit/InteractionKit button). Its on-pinch calls `CPRCoach.next()`.
  Button label per step: Check "Start CPR" (red #F2392C), Call "Called", Watch "I'm ready", Push "Help arrived", Done "Finish".

## 4. Step tab bar (left ornament)
Vertical glass capsule to the left of the window with 5 round icons: alert, phone, hand, heartbeat, check.
Active step = filled white circle with dark icon; finished = white icon; upcoming = 45 % opacity.

## 5. Heart (Push step only)
A plane with `heart.png` (about 15 cm) floating to the right of the window. Scale it 1.0 → 1.12 on every beat
(read the beat from CPRCoach, or pulse at 110 BPM: every 0.545 s). Hidden in other steps.

## 6. Sound + voice
- Short click sound on each beat → CPRCoach `clickAudio`.
- Optional: text-to-speech of each step's instruction when it appears.

## 7. Check in the Preview
Pinch through: Check → Call 112 → Watch first (white hands press up/down at 110 BPM) → Place → hands turn green → Push (counter, click, heart beats, hands press) → Swap reminder every 2 min → Help arrived → summary → Finish.
Fix any errors in the Logger before finishing.
