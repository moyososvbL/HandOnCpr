# HandsOn CPR — Plan

A Snap SPECS Lens that coaches a bystander through hands-only CPR, hands-free.

## Problem
In cardiac arrest, bystanders freeze. They don't know where to put their hands or how fast to push.
Phone apps don't solve this: you need both hands to do CPR, so you can't hold a phone.

## Who it's for
Untrained bystanders: family members, students, coworkers, anyone first on the scene.

## Why glasses
- Both hands stay free for compressions.
- The guidance stays in view, right on the patient, so you never look away.
- The rhythm is shown and heard, so you can follow it under stress.

## Core flow (one complete loop)
1. **Check**: "Not responding? Not breathing normally?" → pinch **Yes**.
2. **Call**: "Call 112 now. Put phone on speaker." → pinch **Called**.
3. **Place**: tap the patient's chest to pin a glowing target there (centre of chest, lower half of breastbone).
   Hand tracking turns the target **green** when both hands are on it.
4. **Push**: a ring pulses at **110 BPM** with a click sound.
   Counter shows compressions. Prompt: "Push hard, push fast — 5 cm deep."
5. **Keep going**: every 2 minutes: "Swap with someone if you can." Repeat until help arrives.
6. **Stop**: pinch **Help arrived** → shows time spent and compression count.

## Medical basis
Hands-only CPR as recommended for untrained bystanders: 100–120 compressions/min, about 5–6 cm deep,
full chest recoil, minimal pauses. The Lens is a guidance aid, not a replacement for training or emergency services.

## Build pieces (Lens Studio)
| Piece | What it does |
|---|---|
| Step manager | Moves through steps 1–6, one card visible at a time |
| Pinch buttons | Yes / Called / Help arrived (Spectacles Interaction Kit) |
| Chest target | World-placed glowing ring, set by tap |
| Hand check | Both hands near target → target turns green |
| Metronome | Ring scale pulse + click audio every 545 ms (110 BPM) |
| Counter + timer | Compression count, 2-minute swap reminder |

**Stretch goal (only if time allows):** track up/down hand motion to show "Faster" / "Slower".

## Prompt for the coding agent
> Using CLAD and the Lens Studio MCP, build a Spectacles Lens called HandsOn CPR. Keep it minimal.
> Steps: Check → Call 112 → Place hands → Push → Help arrived, each a floating card with one pinch button.
> In Place, a tap pins a glowing ring to the surface; it turns green when both tracked hands are within 10 cm of it.
> In Push, the ring pulses and a click sound plays at 110 BPM, a counter increments each beat,
> and every 120 s a "Swap rescuers if you can" card shows for 3 s. Help arrived shows total time and count.
> Use large text, high contrast, red/white. It must run in the Lens Studio preview.

## Demo video (under 3 min)
- 0:00–0:20: Problem: bystanders freeze, and phones need your hands.
- 0:20–2:30: Full run in the Lens Studio preview: check, call, place, push with sound, swap reminder, help arrived.
- 2:30–2:55: Who it helps, what I learned, what comes next (real compression-depth sensing).

## Timeline
- Nov 25–28: Step flow, buttons, chest target
- Nov 29–Dec 2: Metronome, counter, hand check
- **Dec 3, 12PM ET: live project review** (show the working flow)
- Dec 4–5: Polish and fixes
- Dec 6: Record video, write description
- **Dec 7, 5PM EST: submit**
