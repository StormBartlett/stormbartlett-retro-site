# One screen, three dissolving computers

Interest score: **91/100**.

Implementation commit: `3be32d1`.

## What changed

The portfolio's OS screen and camera stay fixed while a classic Mac, laptop and RGB PC dissolve around them. A red button left of the monitor changes the hardware. Seven fan rotors spin independently. The models preload and warm their shaders, textures and geometry. Floating controls were removed and the portfolio signature now uses pixel lettering.

## Why it is interesting

The open window does not move or reset while the entire computer around it changes. A close-up on the stationary window makes the pixel dissolve immediately understandable, then the spinning fans provide the reveal.

## How it works

Each rig is aligned to one shared screen plane and a constant desktop resolution. Different screen proportions retain black margins. A Bayer fragment mask gives outgoing and incoming geometry complementary pixels, without extra render targets. GPU preparation happens before switching; hidden fans have no animation timer. Opus 5.5 high reviewed the rendering lifecycle and Codex implemented the fixes and tests.

## 20-second script

0–4s: Open a folder on the classic Mac. “Watch the window. It stays right here.”

4–10s: Press the left-hand button twice: pixel dissolve into laptop, then PC. “Only the computer changes.”

10–15s: Close-up on spinning intake and GPU fans. “Real meshes, separate rotors, one live desktop.”

15–20s: Return to the classic Mac and the same open folder. “The next computer is already warmed up.”

Capture the production preview. Use actual measured timing if adding a performance comparison; do not imply this follow-up passed mobile Safari testing.
