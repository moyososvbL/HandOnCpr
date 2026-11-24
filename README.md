# HandsOn CPR

A Snap SPECS Lens that coaches a bystander through hands-only CPR, hands-free.

In cardiac arrest, bystanders freeze: they don't know where to put their hands or how fast to push, and a phone app needs a hand you don't have. HandsOn CPR keeps both hands free and puts the guidance right on the patient's chest. A glowing hands guide shows where to push, a 110 BPM click and pulsing heart set the pace, and a counter tracks compressions, all in one downward glance.

**Flow:** Check → Call 112 → Watch first (ghost hands demo the push) → Place hands → Hold → Push (with a swap reminder every 2 minutes) → Help is here (time and compression count).

## Who it's for

Untrained bystanders: family members, students, coworkers, anyone first on the scene.

> HandsOn CPR is a guidance aid for hands-only CPR (100–120 compressions/min, about 5–6 cm deep). It does not replace CPR training or emergency services. Always call your local emergency number.

## Open it in Lens Studio 5.25

1. Install [Lens Studio](https://ar.snap.com/download) **5.25 or newer**.
2. Clone this repo:
   ```
   git clone https://github.com/moyososvbL/HandOnCpr.git
   ```
3. In Lens Studio choose **File > Open Project** and pick `HandOnCpr.esproj`. Lens Studio rebuilds `Cache/` on first open.
4. In the **Preview** panel, choose SPECS and Interactive Preview. Click to pinch, use WASD to move, and use Q/E to go down and up.
5. Pinch through the steps. On **Place hands**, click and hold on the hands guide for 1 second to start compressions.

## Project layout

- `Assets/Scripts/CPRCoach.ts`: step flow, beat, counter, hold check, and swap reminder
- `Assets/Textures/`: hands guide (white/green) and heart textures
- `devpost/`: design brief, plan, and build prompt
