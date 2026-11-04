# Storm OS

Storm Bartlett’s personal portfolio, disguised as a small retro computer. Next.js, React, TypeScript, Three.js; original browser-local mini apps.

## Run

```sh
npm ci
npm run dev
```

Open the URL printed by Next.js. `npm run build` produces the production build; `npm start` serves it. `npm test` runs the Vim editor, filesystem integrity, and app-launch integration tests. `npm run lint` checks source.

## Explore

- **About Storm / Project Manager:** portfolio and current Noteception / UNSW work, with a separate visitor task list.
- **Finder:** nested folders, breadcrumbs, search and type filters, icon/list views, editable visitor notes. Original portfolio files stay protected.
- **Playground:** Pixel Studio (drawing tools, fill, history, PNG export), Sound Lab (chiptune sequencer/WAV export), Focus Garden, Post Office (SVG postcards), Terminal, and Control Panel.
- **Games:** Star Patrol, Balloon Bastion, Mossblade, Snake Garden, and Falling Sand.
- **Search:** click the magnifier or press Command/Ctrl K. Desktop icons open with double-click; touch and keyboard activation open directly.

## Games

All art is original procedural pixel art; these are small browser games, with no third-party game assets.

| Game | Controls / objective |
| --- | --- |
| Star Patrol | Select rangers; right-click to move/attack. On touch, Squad → Move/Attack → tap map. Train reinforcements and protect the relay through four waves. Space pauses. |
| Balloon Bastion | Select a tower, place it on grass, start a round. Select placed towers to upgrade/sell. Protect your lives through 12 rounds. |
| Mossblade | WASD/arrows move; Space/J swings. Touch D-pad and sword button provided. Find three sunstones and reach the north arch. |
| Snake Garden | Focus the game, then use arrows/WASD, swipe, or touch D-pad. |

New games pause when the browser tab hides or another app takes focus; resume explicitly. Closing a game ends its current session.

## Local data

Notes, task lists, artwork, postcard drafts, compositions, preferences, and scores stay in this browser profile. No server database or public guestbook. Restricted storage falls back to the current session; clearing site data removes saved work. Export artwork, audio, and postcards to keep copies.

## Implementation

`PortfolioApps.tsx` is the lazy-loaded app registry and shared launcher. Each mini app owns its component and CSS module under `src/app/apps`. `finderModel.ts` validates stored visitor files and rejects filesystem cycles and app injection. `DesktopOS.tsx` owns windows and legacy desktop interactions; `storm-app-focus` pauses background games. `RetroHardware.tsx` creates the keyboard and mouse using instanced keys and a local label atlas; its gesture events connect to desktop actions. The physical mouse moves a screen pointer and activates controls; physical keys type into the last focused input. Drag/throw either device, or use Reset desk to bring them back.

The 3D scene is optional. Phone desktop mode avoids a WebGL dependency. Desktop/model view and CSS3D screen alignment need real-device checks in iOS Safari, Chrome iOS, and embedded webviews before claiming complete cross-browser parity. See `docs/portfolio-review.md` for the review findings.

## Hardware collection

Model view has a three-way switcher: Classic Mac, Studio Laptop, and RTX Workstation. These are original Blender models, with their screen placement and framing exported alongside the glTF assets. The desktop stays mounted while hardware changes, so open apps and in-memory work survive. The laptop's baked keycaps carry key metadata and can type into desktop inputs; the other machines retain draggable external peripherals.

Regenerate geometry and the manifest with Blender 4.1 or later:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/blender/build_hardware.py -- --output public/models
```

Optional `--sources <directory>` saves editable `.blend` files. Models use local geometry/materials and no remote textures. Only the selected hardware is loaded; the scene still renders on demand. The three rigs use the same OS with responsive screen sizes rather than separate app implementations.


## Retro interactions

The classic Mac defaults to a tapered angular case. **Case: angular / rounded** restores the earlier model instantly; its original GLB is retained. Mouse and keyboard use blockier geometry and collide with each other and the computer. Hardware changes are kept in a separate commit for a complete revert.

Games is a plain folder. Games boot into play/building; **Esc / ?** opens controls and pause/resume. Desktop files keep their artwork while dragging into/out of folders and Trash. New folders and moved subtrees can nest five levels; older deep Finder notes remain readable. Finder also supports cut/paste and undoing moves.

See [interaction notes](docs/retro-interactions.md) for implementation and validation details.
