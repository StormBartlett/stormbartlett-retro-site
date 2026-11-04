# Making a portfolio feel like a computer

**Interest score: 94/100**

**Implementation commits:**
- `c0508e6` — Angular Mac case, blockier peripherals and swept desk collisions. Revert this commit to restore the preceding hardware independently.
- `1aa05d7` — Native file dragging, persistent nested folders, direct game boots, compact retro controls and performance fixes.

## What changed

A sharper, tapered Mac replaces the soft case by default, with the original rounded model still one click away. Throw the mouse or keyboard and they stop/slide against each other and the computer. Games launch into their worlds, with controls tucked behind Esc. Files keep their icons when moved between desktop folders; nested contents survive reloads. New moves allow five folder levels.

## Why it is interesting

The satisfying moments are interactions: a mouse bumps into a keyboard, a folder springs open under a dragged file, and a tiny game boots without a landing page. The visual change comes from making the portfolio behave more like an old computer, while removing decorative web copy.

## 25-second short script

- **0–4s:** Orbit the angular Mac and tap its keys. “I wanted my portfolio to feel like a computer.”
- **4–8s:** Throw the mouse at the keyboard; it collides. “Even the mouse knows where the desk is.”
- **8–13s:** Drag a file into a folder, carry it into a nested folder, then undo. “Files keep their icons. Folders actually work.”
- **13–18s:** Open Games → Star Patrol. Units immediately fight. Press Esc, then resume. “No splash screen. Just play.”
- **18–22s:** Cut to Mossblade on a phone, moving with the D-pad and swinging a sword.
- **22–25s:** Toggle angular/rounded Mac. “Old shape or new shape?”

## How it works

Blender generates the tapered shell and exports the existing screen geometry contract. The old GLB remains available as a runtime case variant. A lightweight continuous X/Z collision solver checks swept peripheral footprints, accounting for rotation, and slides along contact faces. It adds no physics dependency or idle render loop.

File drags paint DOM positions at animation-frame cadence and commit coordinates at release. The same artwork renderer serves desktop, folders, Trash and drag images. Shared tree validation rejects cycles and over-deep moved subtrees; old deep Finder notes remain readable.

Games share pixel-style controls and a local Esc menu. Hidden/unfocused games pause. Falling Sand now uses one canvas plus CSS scanlines, replacing CPU image readback/noise/channel-copy processing; it schedules no simulation frames while stopped and keeps its selected FPS schedule.

Opus 5.5 high reviewed and fixed persistence, focus, cancellation and collision edge cases. Final validation: 161 tests, TypeScript, production build, and desktop/phone-width Chromium checks. Native iPhone Safari/Android testing remains outstanding; there is no measured cross-device performance claim.
