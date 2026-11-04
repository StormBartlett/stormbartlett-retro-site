# Portfolio code, performance and mobile review

Opus 5.5 high reviewed and patched the shell, mobile detection, input handling, and rendering. Integration validation subsequently ran 76 automated tests, TypeScript, production builds, and Chromium browser checks at desktop and phone sizes. Real iPhone browsers remain untested.

## Confirmed findings and fixes

| Area | Finding | Fix |
| --- | --- | --- |
| `layout.tsx` | An inline script blocked pinch and double-tap gestures globally and rewrote the viewport meta every 50ms. | Removed the script and the scale limits from the viewport config. The icon sprite is unchanged. |
| `page.tsx` | Three.js was imported eagerly, even on phones showing the flat desktop. | `OldMac3D` is loaded with `next/dynamic` (`ssr: false`) and only renders in model mode. |
| `page.tsx` | `isMobile` started `false`, so phones briefly mounted the model. The 3D scene never appeared in server HTML, and neither did the desktop. | The server and first client render are the flat desktop. Phones stay on it unless they saved "model". |
| `page.tsx` | Changing view mode remounted `DesktopOS` and lost open windows and app state. | One `DesktopOS` instance stays mounted, and its host element moves between the page and the 3D screen slot. |
| `page.tsx` | There was no way out of model mode if WebGL or the model failed. | Added an "Enter Desktop" DOM button outside the 3D scene. An error boundary falls back to the desktop on chunk, WebGL or GLB failure. |
| `page.tsx`, `FullscreenContext.tsx` | `localStorage` calls could throw when storage was blocked. | Reads and writes are wrapped, and the choice lasts for the session. Context value and callbacks are now stable. |
| `OldMac3D.tsx` | Mobile detection differed from the page (820px, plus `devicePixelRatio >= 2`, which made retina Macs "mobile"). | One shared query: `(max-width: 900px), (pointer: coarse)`. |
| `OldMac3D.tsx` | Screen scale and position differed by device class (0.0763 vs 0.0685). | One placement everywhere. It uses the former "mobile" values, which phones and retina Macs were already getting. |
| `OldMac3D.tsx` | A timer-driven DOM alignment loop measured and nudged the screen. | Removed, along with the calibration UI, dead comments and the unused `Mouse3D`. |
| `OldMac3D.tsx` | The start camera `[-1.96, 23.17, 17.02]` was immediately clamped by Orbit's max distance. | The initial camera now fits the workstation to viewport aspect ratio, including portrait phones. |
| `OldMac3D.tsx` | "View Screen" distance used unrelated units and always hit the clamp, so the screen overflowed in portrait. | Distance is computed from the screen's world size and the current aspect ratio. |
| `OldMac3D.tsx` | The canvas rendered continuously, with contact shadows re-rendered every frame and a shadow map nothing appeared to cast into. | Added `frameloop="demand"` with explicit invalidation and a mobile DPR cap of 1.5. Integration adds a single 1024px directional shadow map for the movable keyboard and mouse; it updates only when a frame is requested. |
| `OldMac3D.tsx` | Every pointer move re-rendered the whole scene through React state. | The tooltip is positioned directly on its DOM node. |
| `MatrixBackground.tsx` | The rain ran at display refresh rate and ignored reduced-motion settings. | Capped at about 30fps with speed and trail scaled to match. Reduced motion (OS setting or `data-reduce-effects="true"`) draws one still frame. The loop stays paused while hidden. |

## Design notes

- **Moving the host:** React still treats the host as a child of the page's `home` div, and that div never unmounts. React events keep working because they are handled at the document.
- **Screen input:** the 3D screen sits in an overlay beside the Canvas event source. Screen pointer events never reach OrbitControls or R3F, so nothing calls `stopPropagation`, which would also have blocked the desktop's React handlers.

## Needs checking

**Real devices (not yet tested):**
- iPhone Safari and iPhone Chrome: default desktop view, Enter Desktop, model mode alignment and orbit, rotation, toolbar collapse, and pinch zoom.
- Android Chrome, plus at least one desktop browser for the same model mode checks.

**Build and first render:**
- `DesktopOS` now renders on the server for the first time. Any `window` access during its render, or a hydration mismatch, will show up in the build or in the browser console.
- Wide screens now paint the flat desktop first, then switch to model mode after hydration. Check that this transition looks acceptable.

**Visual and behaviour checks:**
- Confirm the shared screen placement against the model, particularly on non-retina monitors, which used the other values before. The constants are at the top of `OldMac3D.tsx`.
- Confirm that the Html transform appears on first load with demand rendering, and that model and hardware shadows appear.
- Integration enables mesh shadows, adds a desk at the measured GLB base height, and renders the procedural keyboard/mouse. Verify their placement and press/throw interactions.

## Known limitations

- **Native touch:** integration removed blanket touch blocking on body/desktop. Only icons, titlebars, resize handles, and drawing/game canvases capture manipulation gestures.
- **Moving DOM nodes:** iframes inside the desktop reload, and inner scroll positions may reset, when the host moves between views. React state is unaffected.
- **Icon/window layout:** mobile icons now re-arrange on view changes. Window resize observers re-clamp app windows when moving between model and desktop.
- **Failed model:** on wide screens, falling back after a failure saves "desktop", so the visitor stays there until they choose the model again.

## Integrated apps and browser checks

- Ten Sol xhigh feature agents contributed Finder, Pixel Studio, Project Manager, Terminal, Sound Lab, Focus Garden, Snake Garden, Post Office, Control Panel, and procedural 3D hardware. Three agents continued with original Star Patrol, Balloon Bastion, and Mossblade games.
- Phone-width browser checks: Games folder and Pixel Studio render; Star Patrol trained a fifth ranger, moved the squad, and recorded three enemy defeats; Balloon Bastion built a tower and completed round one with ten pops and bonus payment.
- Mossblade's opening was adjusted after visual testing: the initial clearing is safe, with three seconds of grace outside it. Focused simulation checks cover idle survival and normal combat afterward.
- One desktop instance preserves a counter through repeated model/desktop switches in the integration test; this specifically guards against app state loss.
- Runtime dependency audit reports zero advisories after compatible updates and removal of the unused external vimirror dependency. Development tooling still has moderate transitive advisories; no force-downgrades applied.

- Final model integration visually checked at 1280×800: monitor screen aligned with its bezel; procedural keyboard, mouse, and desk render. Physical G key opened app search with `g`. Follow-up typing exposed focus loss from the canvas; retaining the last focused text input fixes subsequent hardware keystrokes.

- Final hardware input recheck: two successive physical G-key clicks produced `gg` in app search. Dragging the 3D mouse moved the screen cursor (observed left/top change); no React scene state update is needed per pointer frame.
