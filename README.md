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
