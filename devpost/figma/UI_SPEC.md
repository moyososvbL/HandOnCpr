# HandsOn CPR — UI spec (must match Figma)

The 8 PNGs in this folder ARE the design. Match them screen by screen: layout, text, colours, sizes, order.
Source: Figma "HandsOn CPR · User flow". The room photo in the PNGs is only a stand-in for what the
glasses see; in the Lens, the background is the real room / the preview manikin.

## Screens and exact copy
| # | File | Step tag | Title | Sub text | Button / other |
|---|---|---|---|---|---|
| 1 | 01-check.png | Step 1 of 5 | Not responding?\nNot breathing normally? | — | Red pill "Start CPR" (heart icon) |
| 2 | 02-call-112.png | Step 2 of 5 | Call 112 (very large, light weight) | Put the phone on speaker | Glowing red circle with phone icon above title; white pill "Called" (check icon) |
| 3 | 03-watch-first.png | Step 3 of 5 | Watch, then copy | Lock your fingers. Push straight down. | White pill "I'm ready"; white hands on chest pressing on loop; side tag switches "Push down 5 cm" / "Let the chest rise" |
| 4 | 04-place-hands.png | Step 3 of 5 | Match your hands to the guide | Arms straight. Shoulders over hands. | Thin progress bar (empty); white hands; tag "Centre of chest" (white dot) |
| 5 | 05-hold.png | Step 3 of 5 | Hold still | Hands found. Starting the beat. | Progress bar filling green over 1 s; hands GREEN; tag "Hands in place" (green dot) |
| 6 | 06-push.png | Step 4 of 5 | Push hard, push fast (left-aligned) | — | Huge thin counter, "compressions" under it, rhythm bar (14 ticks, current tick red & taller), chips "110 / min" and "5 cm deep", glass pill "Help arrived". Heart tile to the right with chip "In rhythm" (green dot). Hands green. |
| 7 | 07-swap.png | same as 6 | — | — | Plus white banner on top: clock icon, "Swap with someone if you can", grey "2 min". Shows 3 s. |
| 8 | 08-help-is-here.png | — | Help is here | — | Small heart tile on top; two stats (time m:ss, compressions) in thin numerals with small grey labels; white pill "Finish" |

On every screen: step tab bar (left) and toolbar ornament ("Voice on", "End") just under the window.

## Tokens
- Glass window: fill #5C5C61 at 42 % opacity, background blur, 1 px white border at 30 %, corner radius large (~46 px at 620 px width ≈ 7 % of width), soft drop shadow.
- Ornaments (tab bar, toolbar, chips/tags): same glass, ~34–45 % opacity, fully rounded.
- Red (primary, beat tick, call): #F2382B, with a soft red glow on the Start CPR button and call circle.
- Green (hands found, in rhythm, progress): #33C77B.
- Text: white. Step tag 60 % white, medium. Sub text 72 % white, regular. Titles semibold. Counter and stats: thin/ultralight, the largest element. Dark text on white pills: #1A1A1F.
- Buttons: fully rounded pills. Primary red (Start CPR); light = white 95 % with dark text (Called, I'm ready, Finish); glass = white 14 % + 30 % border (Help arrived). Icon left of label.
- Font: SF Pro in Figma. In Lens use the closest clean sans available (default UI font), keeping the same weights.

## Step tab bar (left ornament)
Vertical glass capsule, 5 round tabs (alert, phone, hand, heartbeat, check).
Active = white filled circle with dark icon. Done = white icon. Upcoming = 45 % opacity icon.
Active tab: Check→1, Call→2, Watch/Place/Hold→3, Push/Swap→4, Help is here→5.

## Proportions
Keep the same proportions as the PNGs (fraction of the view each element takes): e.g. the window is about
40 % of the view width on screens 1–5 and 8; on Push/Swap the window sits left and the heart tile right.
Position rules from the design brief still apply (follow mode for 1–2, chest-anchored from 3 on).
The hands must sit on the CENTRE OF THE CHEST (lower half of breastbone), never on the stomach.

## Heart
Use Assets/Textures/heart.png on a light rounded tile (as in 06/08). It scales up ~12 % on every beat.
