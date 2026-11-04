# A portfolio with a whole pocket arcade inside

**Social-interest score: 96/100**

**Implementation commit:** `b707e14` — Overhaul retro portfolio with playable arcade, creative apps and interactive hardware.

## What changed

Kept the retro desktop and added a Games folder with three original games: Star Patrol (marine squad versus an alien swarm), Balloon Bastion (12 rounds of tower defence), and Mossblade (a little sword adventure). Snake and Falling Sand also live in the arcade.

Added a nested, searchable Finder; a proper pixel-art editor with undo/fill/PNG export; project manager featuring Noteception and UNSW; terminal; chiptune sequencer with WAV export; focus garden; postcard maker with SVG export; wallpaper/control panel; and an app launcher. Preferences and creations stay in the visitor’s browser.

Built a procedural keyboard and mouse with bevelled keycaps, labels, cables, press animation and bounded throws. The 3D mouse moves a cursor on the monitor, and the keyboard types into focused inputs. Added a desk and viewport-aware scene framing.

Opus 5.5 high reviewed and fixed mobile detection, viewport/touch handling, lazy 3D loading and on-demand rendering. Ten Sol xhigh agents delivered isolated features; three continued with the games. One desktop instance preserves app state across 3D/desktop switches. Verification includes 76 tests, TypeScript, production builds, runtime dependency audit and Chromium checks. Real iPhone Safari/Chrome still need device testing.

## Why it is interesting

The opening looks like one small old computer. Every interaction reveals something useful or playable. Throwing the mouse, typing on a physical-looking key, then opening a tiny RTS gives the demo a clear visual hook. Pixel painting, music and games offer several fast, distinct cuts.

## 40-second short script

| Time | Picture | Voiceover |
| --- | --- | --- |
| 0–4s | Slow reveal of the 3D workstation. Drag and throw the mouse. | “I put a whole operating system inside my portfolio.” |
| 4–9s | Click two physical keys; show letters appearing in search. | “The keyboard actually types. The mouse controls the little screen.” |
| 9–17s | Enter desktop → Games. Train marines, order the squad, show an alien wave. | “Open Games and there’s a tiny strategy game. Select your squad, train reinforcements, survive the swarm.” |
| 17–24s | Place a tower; balloons pop. Cut to a sword swing in the forest. | “There’s balloon tower defence, and a pocket sword adventure.” |
| 24–31s | Pixel Studio mushroom → palette change → PNG export. Cut to a chiptune grid. | “You can paint pixel art, make a chiptune, or send yourself home with a pixel postcard.” |
| 31–36s | Navigate nested Finder folders; switch between desktop and monitor with work preserved. | “It all opens from the same simple desktop, and your work survives the switch.” |
| 36–40s | Phone desktop view → pull back to the workstation. | “A small computer with a lot to discover.” |

## How it was built

Next.js/React/TypeScript shell; lazy app chunks; canvas simulations and pixel rendering; Web Audio for music; validated local browser persistence; Three.js instanced keyboard keys and a generated label atlas. The model screen uses one placement across device classes. The 3D scene renders on demand, ambient rain caps its frame rate and respects reduced motion, and games pause when another app takes focus or the tab hides.

Capture the demo from a local production build. Use original artwork/gameplay only. Keep the real-device testing limitation in the longer devlog; do not claim every mobile browser has been tested.
