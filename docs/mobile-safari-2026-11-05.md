# Mobile Safari verification — 5 November 2026

Implementation: `b6df222` (3D lifecycle, desk switch, RGB keyboard) and `6c6b176` (CRT, icons, selection, fonts and game layout). Local production preview: `http://localhost:3778/`.

## Browser checks

Native Safari was exercised through Xcode Device Hub's iPhone 17 simulator, iOS 26.4.1. These were native simulated touch interactions, not a desktop viewport resize. Chromium was checked separately in the in-app browser.

| Area | Verified behavior |
| --- | --- |
| Computer models | Classic Mac, laptop and RTX setup render with the same live OS screen. Physical red desk button cycles rigs. Returning from desktop preserves the selected rig, camera, open folder and scene. |
| Orientation | Portrait works. Landscape exposed a selector covering the model; a compact side selector now leaves it visible and respects the safe area. |
| Peripherals | Mouse dragging works on Safari. Chromium dragging stops the mouse beside the keyboard and tests keyboard movement toward the Mac. Existing swept-collision tests cover bounds and fast motion. |
| Files | Dragged Skills.txt from desktop into Projects, into a newly created nested folder, then back to desktop. Its lightning artwork stayed unchanged. Selection has a contrasting black/cream outline and inverted label. |
| Star Patrol | Boots directly; touch movement and pause/help respond. Units and hostiles render and fight. |
| Balloon Bastion | Built a tower by touch and cleared round one: ten pops, fifteen lives remaining. |
| Mossblade | Boots directly; held direction and sword touch controls respond; game-over/restart UI renders. |
| Snake Garden | Restart, direction input and pause work. A clipped down button was found and fixed by reserving space for the full D-pad. |
| Falling Sand | Touch drawing creates sand piles and a water pool; material selection works. |
| CRT | Single scanline/vignette overlay, visible in both browsers. Legacy duplicate layer disabled. No filter added around the CSS3D ancestor. |

## Performance and review

Claude Opus 5.5 high reviewed the initial lifecycle and the implementation. Codex applied the findings. Reopening now reuses the opted-in Canvas and GPU resources; hiding switches the render loop to `never`, removes the Matrix animation and cancels hardware gestures/inertia. A fresh mobile visitor still starts on the flat desktop. Explicitly saved mobile model preference is retained.

Context restoration rebuilds lighting. An active lost context gets one rebuild attempt after 2.5 seconds, then graphics failure falls back to a usable desktop. Stale slot cleanup cannot detach a newer screen. GLTF assets are unchanged; the rounded case remains selectable.

163 tests passed. The final production build passed. Chromium DOM inspection confirmed the hidden scene still has one Canvas, and the final CRT overlay is displayed while the old overlay is disabled.

Limits: this was simulator Safari, not physical iPhone hardware; Android was not exercised. No GPU-context stress test or frame-time/memory benchmark was run. Retaining an opted-in scene trades some GPU memory for faster reopening. Failed network chunks or cached GLTF load rejections may still need a reload. Finder and desktop keep separate file stores, as documented previously.

Screenshot evidence is stored with the task artifacts: `ios-safari-model-landscape.png`, `ios-safari-rgb-model.png`, `ios-safari-tower-defence.png`, `ios-safari-snake-controls.png`, `ios-safari-sand-water.png`, `ios-safari-crt-desktop.png`, and `crt-desktop-preview.png`.

## Reversal

Revert `b6df222` for the warm scene, switch and RGB changes. Revert `6c6b176` for the visual and Snake layout changes. No Blender source or GLB file was overwritten in this follow-up.
