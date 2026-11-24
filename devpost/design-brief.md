---
status: approved
---

# Design brief: HandsOn CPR

## The one spatial moment
I'm kneeling beside someone who has collapsed, both hands locked on the centre of their chest. Right above my hands, in the same downward glance, I see the compression counter climbing and a heart pulsing to a 110 BPM click. The glowing hands guide on the chest presses with me, so I never have to look away or hold a phone.

## Why it belongs on glasses
- Uses: draws in the world (the guide sits on the chest at real size), leaves your body free (both hands do compressions), and keeps your eyes on the patient.
- Why it's better than the phone or laptop version: you need both hands for CPR, so you can't hold a phone. Bystanders freeze because they don't know where to put their hands or how fast to push. Here, where and how fast are shown right on the chest, and the rhythm is both shown and heard, so you can follow it under stress.

## Product or overlay
- Type: overlay. It guides real compressions on a real person. In the preview it becomes a trainer on a virtual manikin.
- What the real version would sense: where the patient's chest is (the user pins it), and whether both palms are on the guide (hand tracking).
- Stand-in for the preview:
  - **Patient:** a simple virtual CPR training manikin lying on its back on the floor, about 60 cm in front of the user. Adult size, built from basic shapes (head, neck, torso, arms), in a **light** neutral grey so it doesn't go see-through on the additive display. It's hidden when running on real glasses.
  - **Chest position:** in the preview, the hands guide is placed automatically on the manikin's chest when Watch first starts: centre of the chest, lower half of the breastbone, on the line between the nipples. On real glasses, the user pinches once on the patient's chest (a ray hit against the world mesh or floor) to pin it, and can pinch again to adjust.
  - **Hands in place:** pinch-and-hold on the hands guide for 1 second (in the preview, click and hold the mouse on the guide). On real glasses, the existing two-palm check (both palms within 10 cm of the guide) also counts. Either one works.

## Where things live
- Where the user is looking during the main task: down at their hands on the chest, about 50–60 cm ahead and below eye level.
- **Two placement modes:**
  - **Follow mode (Check, Call 112):** the glass window lazily follows your head at about eye level, 45 cm away, because you're not looking at the chest yet.
  - **Chest-anchored mode (Watch first, Place hands, Hold, Push, Swap, Help is here):** everything anchors to the chest and stays put while you move.
- Manikin: on the floor, about 60 cm in front of the user at start, lying on its back, adult size. Visible from Lens start (default).
- Hands guide: a plane about 22 × 22 cm lying flat on the chest, facing up. Texture `hands_white.png`, and `hands_green.png` when green. Unlit and alpha-blended.
- Glass window (chest-anchored): compact, about 25 cm beyond the hands guide towards the patient's head, raised about 12 cm and tilted to face the user. The counter and instructions sit just above the hands in the same glance. Frosted glass, rounded corners, slightly translucent light grey.
  - Inside the window: step label (small, 60% white, e.g. "Step 3 of 5"), instruction (large, white, semibold), counter (the **largest** element), one pinch button, and a short progress bar (Hold step only).
  - Text is big enough to read from kneeling distance (about 60–80 cm).
- Step tab bar: a vertical glass capsule on the left edge of the window with 5 round icons: alert (Check), phone (Call 112), hand (Watch first, Place hands, Hold) (default grouping), heartbeat (Push and Swap), check (Help is here). Active step: filled white circle with a dark icon. Finished: white icon. Upcoming: 45% opacity.
- Heart: `heart.png`, about 10 cm, to the right of the hands at chest height, about 20 cm away.

## Hands and input
- Advance a step: pinch the single big button in the window. Labels: Check "Start CPR" (red #F2392C), Call 112 "Called", Watch first "I'm ready", Push "Help arrived", Help is here "Finish". Place hands and Hold have no button.
- Hands in place: pinch-and-hold on the hands guide for 1 second. On glasses, both palms on the guide also counts.
- Real glasses only: pinch on the patient's chest to pin the guide, and pinch again to adjust.
- Targets are big and highlight when aimed at.
- Voice: none required. Optional text-to-speech reads each step's instruction when it appears. It never replaces a button.

## When things show
The 8-step flow, with one card visible at a time:
1. **Check**: "Not responding? Not breathing normally?" → pinch **Start CPR**. Follow mode.
2. **Call 112**: "Call 112. Put the phone on speaker." → pinch **Called**. Follow mode.
3. **Watch first**: the guide appears on the manikin's chest and the UI switches to chest-anchored. The white ghost hands push down 5 cm and let the chest rise on a loop at 110 per minute, and the cue switches between "Push down 5 cm" and "Let the chest rise". → pinch **I'm ready**.
4. **Place hands**: "Match your hands to the guide. Arms straight. Shoulders over hands." The guide is white.
5. **Hold**: as soon as the pinch-hold (or both palms) starts, the guide turns green, the window says "Hold still", and the progress bar fills over 1 second. Letting go early resets it to white and empties the bar. When the bar is full, it moves to Push automatically, with no extra button press.
6. **Push**: "Push hard, push fast." The beat runs at 110 BPM: a click sound each beat, the counter goes up each beat, the heart pulses 1.0 → 1.12 each beat, and the hands guide presses with the beat. The heart is only visible in this step.
7. **Swap reminder**: every 120 s during Push, "Swap with someone if you can" replaces the counter for 3 s, then the counter returns. The beat keeps going.
8. **Help is here**: pinch **Help arrived** during Push → "Help is here" with the real elapsed time (m:ss) and the compression count. Pinch **Finish** → back to Check, and the guide is hidden.
- The progress bar shows only during Hold. The hands guide is hidden in Check, Call 112 and after Finish.
- If something needs attention out of view: the click sound carries the rhythm even when the user glances away. Nothing else is needed, because all chest-mode content sits in one glance.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Clicking "Start CPR", then "Called", moves the window from Check to Call 112 to Watch first, and the step tab bar highlights each step.
2. On Watch first, the grey manikin lies on the floor and the white hands guide sits on the centre of its chest (not the stomach), pushing down and rising on a loop at about 110 per minute, with the cue switching between "Push down 5 cm" and "Let the chest rise".
3. After clicking "I'm ready", clicking and holding on the hands guide turns it green, the window says "Hold still", the bar fills over 1 second, and Push starts on its own. Letting go early resets it to white.
4. On Push, the counter goes up with a click sound on every beat, the heart beside the hands pulses with each beat, and the hands guide presses with the beat. Walking around the manikin, the window, counter, heart and hands stay anchored to the chest.
5. The "Swap with someone if you can" reminder appears for 3 seconds. Then clicking "Help arrived" shows the summary with the real time and compression count, and "Finish" returns to the start. (The swap interval is an Inspector input. Keep 120 s as the real value, and shorten it, for example to 10 s, for preview checks and LEAF tests.)

## Out of scope
- Measuring real compression depth or rate (the "Faster / Slower" stretch goal).
- Recognizing a real person or chest. The user pins it on glasses, and the manikin stands in for it in the preview.
- Rescue breaths, AED guidance, or calling 112 from the Lens.
- Remembering sessions, or sharing the Lens between rescuers.
- Recording, identifying, or following anyone.

## Risks and open questions
- Medical: this is a guidance aid for hands-only CPR (100–120/min, about 5–6 cm deep, full recoil, minimal pauses), not a replacement for training or emergency services. Say so in the video and description.
- Real-glasses pinch-to-pin on the world mesh, and the two-palm hand check, can't be tried in the preview. Feel unproven.
- Whether the chest-anchored window (25 cm beyond the hands, 12 cm up) stays inside the narrow SPECS view while kneeling, and is readable under stress. Check it in the preview from a kneeling height. Feel unproven on glasses.
- The frosted-glass look (Figma "HandsOn CPR · User flow") on an additive display: keep the glass light and the text bright. Dark glass will vanish.
- `Assets/Scripts/CPRCoach.ts` already holds the step logic, beat, swap timer and two-palm check. Extend it for pinch-hold, the progress bar, the two placement modes, the manikin and the tab bar, rather than rewriting it.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
