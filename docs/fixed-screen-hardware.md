# Fixed-screen hardware follow-up

Implementation: `3be32d1`, 5 November 2026. Reverting that commit restores the previous switch, model layout and floating controls without changing the GLB assets.

## Behavior

- One 800×600 OS screen and one camera framing serve every rig. Cases align their aperture centers and orientations to it; wide apertures use black margins. The desktop and open windows never resize during a model switch.
- A complementary Bayer pixel dissolve blends cases, desks and peripherals. The switch remains left of the monitor, and its support changes height with the desk. The entire switch face is an accessible click/keyboard target.
- PC blades rotate independently of housings and lights. Animation requests at most 30 fps and pauses offscreen, in desktop view and with reduced motion. Manual orbit/zoom remains available, but selecting a rig never moves the camera.
- Desktop idle preloading fetches and parses the assets. Model view then compiles shaders, initializes textures and uses one invisible normal render to upload geometry. Cached rig materials belong to their clones; the original GLTF cache stays intact.
- The floating computer selector, screen-zoom controls and hint strip are gone. The portfolio signature uses the pixel UI font for both the name and role.

## Review

Claude Opus 5.5 high performed a read-only source review, with the model confirmed in usage metadata. Codex implemented the changes. Review findings applied: complementary outgoing/incoming masks, fading peripherals and desks, derived laptop collision footprints, correct screen rotation composition, initial/restored shadow invalidation, texture/buffer warming, per-rig asset failure containment, explicit transition invalidation, inactive hit-handler removal, and the existing view's activity guard.

Two suggestions were intentionally not adopted: manual orbit remains a visitor control, and matching every model's aperture width would distort their different aspect ratios. Fixed-size letterboxing preserves the OS view and the authored models.

## Verification

171 tests passed, including shared aperture alignment, unchanged fan housings/world positions, reduced-motion transition bounds, and initial peripheral clearance against the aligned chassis and switch. TypeScript and the final production build passed.

Chromium exercised physical-button clicks and Enter activation, all three rigs, completed GPU preparation, dissolve rendering and fan rendering with no recorded shader errors. The screen's measured rectangle was identical for Mac, laptop and RTX: x 589.918640, y 234.688629, width 284.017761, height 219.159607 in that test viewport. Button-focus scrolling exposed a CSS3D wrapper issue; non-scrolling clipping fixed it.

Safari retesting was incomplete: the iPhone simulator restarted but Safari stalled at a black launch screen. Desktop Safari loaded the test route, but interactive verification stopped when the browser was taken over. No Safari pass is claimed for this follow-up. The earlier native simulator results remain documented in `mobile-safari-2026-11-05.md`. Browser automation became unavailable after the interruption, before a final screenshot could be saved.

No timing benchmark or physical-device GPU/memory test was performed. Preloading reduces network/parse work and first-use uploads; it cannot remove delays caused by host CPU/GPU pressure. Retained assets trade memory for faster switching. The preview remains local at `http://localhost:3778/`.
