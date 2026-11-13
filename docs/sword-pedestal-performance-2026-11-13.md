# Sword pedestal, panel-sized screens and idle performance — 13 November 2026

Follow-up to `3be32d1` / [fixed-screen-hardware.md](fixed-screen-hardware.md).

## What changed

| Area | Change |
| --- | --- |
| Switch | The left-of-monitor switch box is now a stone pedestal holding a small sword (original design: swept blue guard, wrapped grip, brass pommel, cyan gem). The brass button on the base steps forward: Mac → Laptop → RTX. It stands on whichever desk is showing; it does not float. |
| Easter egg | On the RTX, the button only makes the sword hum. Pulling the sword (drag up on the grip, click, or Enter on the hidden "Pull the sword" button) sends you back to the Mac. On earlier machines the sword rattles and stays put. The gem glows faintly on the last machine as the only visual hint. |
| Transitions | Forward: an amber scanline sweeps up the scene with a dithered edge (760 ms), and a matching sweep crosses the live screen. Back in time: the sword lifts, a light column rises, blue motes drift up, a ring crosses the desk and the rigs swap through chunky blue cells with a cyan wash (1.5 s). The live screen gets a matching blue flash. Reduced motion skips all of it. |
| Screen sizing | The OS keeps one height (600 CSS px) and center, so the camera and live desktop never move. Width follows each panel: 800 (Mac, 4:3), 960 (laptop, 16:10), 1067 (RTX, 16:9). Black side bars are gone. Width eases with the transition; the desktop DOM is never remounted. |
| CRT | 40 px glass corners so the desktop no longer pokes past the bezel. Tube edge shading and a soft highlight on the Mac; a faint panel sheen on the LCDs. |
| About window | "Forever Curious." removed. The window is now 384×308 (was 320×350): wider and shorter, with no scrolling. |
| Mobile | Portrait framing fits the pedestal-to-tower span (screen grows from 102 to 114 px wide on a 393 px phone). A screen-alignment guard re-projects the glass after every resize, visual-viewport change, orientation change or `pageshow`. If the CSS3D layer drifts from the WebGL canvas (the in-app-browser symptom), it corrects the offset and scale. It also refreshes a stale canvas size. `?view=model` opens phones straight into the 3D desk without changing their saved choice. |

## Performance (measured)

Headless Google Chrome 156 on an M1 Max (ANGLE Metal), 1280×800 at DPR 2, production build. Draw calls are counted by wrapping WebGL draw functions. "GPU process" and "renderer" are CPU time of those Chrome processes (`ps`), which is a proxy: it is not GPU shader time.

Idle cost, from an interleaved A/B of baseline (`c92e929`) and the final build: medians of 3 alternating runs under the same machine load.

| Idle, 5 s window | Baseline | Now |
| --- | --- | --- |
| Mac: rAF callbacks/s | 61 | 20 |
| Mac: main thread ms/s | 126 | 30 |
| Mac: renderer process ms/s | 164 | 58 |
| Mac: GPU process ms/s | 118 | 104 |
| RTX: WebGL draws/s | 3,713 | 1,817 |
| RTX: rAF callbacks/s | 82 | 44 |
| RTX: main thread ms/s | 153 | 94 |
| RTX: renderer process ms/s | 214 | 140 |
| RTX: GPU process ms/s | 166 | 180 (range 158–184; no improvement) |

Draw calls per frame: Mac 106 → 58, laptop 165 → 139, RTX 182 → 77. The new pedestal adds about 13 draws.

Where the time went, and the fixes:

1. **Matrix rain** was the main idle cost. With it disabled, Mac idle fell to 0 across main thread, renderer and GPU process. It ran `fillText` with `shadowBlur` for about 280 glyphs a frame on a DPR-2 canvas, and woke every display refresh. Now: a lazily built glyph atlas (`drawImage`), DPR 1, and a timer that wakes only for the 20 fps frames it draws. A trivial 2 px repaint at 20 fps costs about 60 ms/s in the GPU process here, so most of what remains is Chrome compositing this page per frame, not the rain itself. CRT filters and blend modes measured as negligible.
2. **Draw calls.** Static case meshes are merged per material at load, and each fan's blades merge into one mesh per rotor. Clickable laptop keycaps and controls stay separate. The glTF cache is untouched; merged geometry is owned and disposed with the rig.
3. **A hint-pulse regression caught before release**: the gem pulse first forced continuous 60 fps renders on the RTX (79 rAF/s, about 4,700 draws/s). It now updates only on frames that render anyway.

Load and switches: 3 runs each. Warm OS shader cache.

| | Baseline | Now |
| --- | --- | --- |
| First rig ready (Mac) | 1,233–1,264 ms | 1,127–1,280 ms |
| All three rigs prepared | 2,126–2,147 ms | 2,019–2,166 ms |
| Forward switch, click to settled | 722–738 ms | 764–776 ms (animation length 760 ms) |
| Pull to settled Mac | — | 1,812–1,823 ms (300 ms lift + 1.5 s warp) |
| Worst frame gap during 24 switches | 17 ms | 17 ms |
| Long tasks during switches | 0 | 0 |

The first run on a cold Metal shader cache took 4.6 s to show the Mac, with 2.4 s of long tasks, mostly shader compilation. It could not be repeated or cleared without touching system caches, so it was not re-measured after the changes.

## Verification

- `npm test`: 174 passed (3 new). Covers panel aspect, constant CSS scale, pedestal footprint on the desk, peripheral clearance, mesh merging (count, kept keys/rotors, unchanged bounds), and sword pull timing.
- `npm run build`: passed. Lint: no errors (7 existing warnings).
- **Chromium** (desktop): all three rigs, both transitions, the hum, the refusal rattle and the pull. No shader errors in the final build (an earlier one used the reserved GLSL word `active`; fixed). Fans render at about 24 fps while the RTX is idle.
- **WebKit 26.4** (Playwright) and Chromium, iPhone portrait 393×659 and landscape 852×393 with touch: taps through all rigs, a simulated toolbar collapse (+80 px and back), and the pull. Glass-corner projection matched the screen's DOM rect within 0.03 px every time. An About window opened before a switch was still open after it.
- **iOS Simulator Safari** (iPhone 17, iOS 26.5): the 3D desk loads via `?view=model`, and the live desktop renders inside the CRT, aligned, in the new portrait framing. Playwright's WebKit screenshots drop CSS3D layers even on a minimal test page, which is why they showed a black screen. Real Safari does not.

## Gaps

- No tap-driven switch or sword pull in real simulator Safari: simulator input needs access approval, which was not given during this run. Touch flows were verified in Playwright WebKit and Chromium only.
- No physical iPhone, no Instagram or other in-app browser. The alignment guard targets that symptom but has not been seen correcting a real drift.
- Windows dragged past x = 800 on the RTX are not clamped when switching back to the Mac; they stay partly off-screen until moved.
- RTX idle GPU-process time did not improve. Dev-mode `GL_INVALID_OPERATION` warnings and the trash-icon hydration warning are older and unchanged.

## Profiling hooks

`performance.mark("storm:…")` marks for chunk, canvas, compile, ready and switch phases are always on (no cost without an observer). `?perf` exposes the R3F state as `window.__stormThree` for draw-call inspection. `.claude/launch.json` gains a `prod` entry (`next start` on port 3779).

## Reversal

All changes are local and uncommitted on `codex/portfolio-overhaul-20261104`. New file: `src/app/SwordPedestal.tsx`. Edited: `OldMac3D.tsx`, `hardwareScene.ts` (+ test), `MatrixBackground.tsx`, `HardwareGallery.module.css`, `globals.css`, `DesktopOS.tsx`, `page.tsx`. GLB assets and the Blender script are unchanged.

## Follow-up (same day): level desk, bigger panels, bezel, dock, files

Note: this follow-up supersedes the "one height, fixed center" screen model and the desk-height-tracking pedestal described above.

- **Level desk.** One shared desk at a single height for every computer; the camera is unchanged. Only the desk's finish blends (cream → dark for the RTX). Machines use real-world scales on it: Mac 1, laptop 0.7, RTX 0.84. Newer screens are therefore bigger (RTX 2.94 × 1.65 world units vs the Mac's 1.6 × 1.2; 209 px wide on a 393 px phone, was 135). The live desktop keeps its 600 CSS px height, and its 3D position and size ease with each switch. The pedestal sits at x −1.95, clear of the widest panel (unit-tested).
- **Mac bezel.** The tan bezel ring had square inner corners around a rounded black glass seal, so the case pocket showed at the corners. At load, the bezel takes the ivory case material and a black backing closes the corners. GLB files unchanged.
- **Moulded plastic.** The Mac's ivory surfaces get a 128² tileable stipple normal map, generated in code, on box-projected UVs (cloned geometry). It adds one texture and one shader variant. The Mac was ready at ~1.27 s in both of the 2 runs after the change, vs 1.13–1.28 s before; that is within run-to-run variation.
- **Dock** auto-hides: a bottom hot zone or keyboard focus reveals it on desktop. On touch, a handle shows it for 3.5 s. Verified in Chromium and WebKit.
- **Fonts.** Every Silkscreen, Courier Prime and VT323 face is requested at startup, so menus no longer flash a fallback font on first open. All faces were loaded within 1 s in Chromium.
- **Files.** Folder windows lose their "New folder" toolbar. Right-click empty space for New Folder and Paste; right-click items for Open, Copy, Cut and Move to Trash. ⌘/Ctrl+C, X and V work on the desktop. The clipboard is memory-only and empty after a reload. Pasted copies persist like any other file. Copies are named Finder-style ("copy", "copy 2"), and folders are deep-copied.
- Verified: 176 tests and the build pass. An end-to-end Chromium run of every menu path passed, plus a reload. Phone alignment in WebKit stayed within 0.03 px. Switches kept a worst frame gap of 17 ms, with no long tasks.

## Follow-up: corner-pinned screen, portrait framing, vents (same day)

- **iOS Safari screen offset.** With drei's `Html transform`, iOS Safari drew the live desktop about 10 CSS px right of the RTX panel (less on the laptop) while `getBoundingClientRect` reported it aligned, so the alignment guard could not see it. Red markers at the layout corners sat on the WebGL panel and the CSS3D layer did not, so this is Safari compositing the nested perspective layer. The screen is now pinned with one projective `matrix3d` per rendered frame (`quadMatrix3d`, unit-tested): its four corners land on the projected glass corners and no CSS perspective context is involved. Width, size and position ease with the model blend in the same frame. Verified in iOS Simulator Safari (iPhone 17, portrait and landscape, all three machines, pull and forward), plus Chromium and Playwright WebKit (drift ≤ 0.08 px). Clicks and window drags through the pinned screen track the pointer, and the camera orbit keeps it pinned.
- **Portrait framing** now centres the pedestal-to-RTX-mouse span (x −2.4 to 4.1). Before, the pedestal touched the left edge and the RTX tower ran off the right (NDC up to 1.25). It now fits within ±0.93 on 375–402 px phones.
- **Mac side vents.** The slots were straight boxes on a tapering wall, so one end sank into the plastic, most visibly on the left. `seatSideVents` raycasts each slot onto its wall, aligns it to the wall normal and stands it 2 mm proud, so both sides now match.
- **Screen overlays.** The laptop and RTX show the desktop clean: no scanlines or sheen, just a 1 px edge. The old Mac keeps its CRT scanlines, now visible in dark mode too.
- **Mobile windows.** Title-bar buttons are square at 22 px: a 32 px button `min-height` meant for app content was stretching them. The Project Manager's Edit, Visit and filter controls use the pixel face.
