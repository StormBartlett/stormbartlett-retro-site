# A desk button that swaps computers

Interest score: **88/100**.

Implementation commits: `b6df222` and `6c6b176`.

## What changed

A physical red desk button cycles a classic Mac, laptop and RTX rig while the portfolio OS keeps running. The modern keyboard has rainbow keycaps and a light strip. Model reopening retains its renderer with no hidden frame loop. CRT wallpaper and conspicuous selection outlines return; Games and Playground have little illustrated folder icons. Safari testing also fixed landscape controls covering the model and Snake's clipped D-pad.

## Why it works as a short

The visual hook is one press replacing the entire computer while the exact same open folder stays on its screen. Follow with a phone demonstration: drag a file into a nested folder, then run a tiny tower-defence game. It connects the 3D toy to working software.

## How it was built

React Three Fiber keeps one opted-in Canvas alive and pauses it offscreen. One DesktopOS DOM host moves between the flat view and each model's CSS3D screen. A small textured mesh supplies the desk switch; instanced keycap colors supply the rainbow. CRT effects use a single CSS overlay so WebKit's transformed screen stays intact. Opus 5.5 high reviewed lifecycle and recovery; Codex implemented and verified the changes in native iPhone simulator Safari and Chromium.

## 25-second script

0–4s: Close shot of the classic Mac. “My portfolio has a hardware switch.” Press the red button.

4–9s: Laptop, then RTX rig with rainbow keyboard. “Same desktop. Different computer. Your open apps stay put.”

9–15s: Enter desktop, reopen model, drag the mouse against the keyboard. “The scene stays warm, and the desk has collisions.”

15–21s: Phone Safari: nested file drop, then a tower popping balloons. “The little OS works on a phone too.”

21–25s: CRT desktop and highlighted Games folder. “Old computer energy. Actual working games.”

Capture portrait Safari and the landscape fix. Avoid presenting simulator frame rate as physical-phone performance.
