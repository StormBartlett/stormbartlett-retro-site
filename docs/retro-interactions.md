# Retro interactions — 5 November 2026

## Hardware

The classic Mac now has a planar front, tapered rear and crisp case/bezel edges. The original rounded GLB is retained as `public/models/studio-mac-rounded.glb`; use the **Case: angular / rounded** button to switch without losing desktop state. The Blender generator supports `--classic-style angular|rounded` and remains the editable source.

Keyboard caps, keyboard case and single-button mouse use small, flat chamfers. A small continuous X/Z collision solver handles fast throws and pointer jumps, sliding along obstacles. Peripheral footprints account for rotation, and the monitor/laptop/tower have static desk footprints. There is no physics dependency or continuous idle render loop.

## Files

Desktop folders share one persistent folder registry, including Games and Playground. Icon artwork comes from the same renderer on the desktop, in folders, in Trash and in drag previews. Folder moves retain their contents. Both the desktop registry and Finder reject self/descendant moves and limit the full moved subtree to five folder levels.

Desktop dragging updates element positions once per animation frame and commits file coordinates on release. Folder drag previews also move directly without a React update per pointer event. Perspective-aware coordinates are measured at gesture start. Hovering a valid desktop folder opens it after 650 ms; invalid or cancelled drops leave the source intact.

Finder supports pointer dragging to folders, favorites and breadcrumbs, plus Cmd/Ctrl X/V for moving files and Cmd/Ctrl Z to undo a move. Portfolio document contents remain read-only; original document placements can be saved separately. Deleting a visitor folder containing original portfolio files is refused until those files are moved out. Version 1 saved notes remain readable. Existing saves deeper than five levels keep their notes and structure; new folder moves and creation enforce the five-level limit.

## Games

Games is a plain folder. Star Patrol, Mossblade and Snake open directly into play; Balloon Bastion opens its build phase. Promotional headers, decorative footers and entry cards are removed. A small status bar and functional game controls remain; Esc or ? opens basic controls, pause/resume and restart. Pixel canvases scale without smoothing. Star Patrol uses its native canvas resolution instead of allocating a high-DPR canvas.

## Verification

Automated tests cover collision sweeps and sliding, subtree limits/cycles, stored app identifiers, Finder content/placement persistence and game simulation behavior. Desktop and phone browser checks include game boot/help/resume, tower placement, folder move/reload behavior and physical peripheral collisions. Native mobile browsers still need real-device testing.


The final integrated tree passed **161 tests**, TypeScript, a production build and diff whitespace checks. The requested Opus 5.5 review and focused performance follow-up are summarized in [the review notes](opus-5.5-review-2026-11-05.md).

Falling Sand now uses one drawing canvas and CSS scanlines. Its old per-frame image readback, noise and channel-copy processing are removed. It stops scheduling simulation frames while paused, hidden or at zero FPS, preserves the requested frame schedule, and repaints resize/drawing operations while stopped. Regression checks cover a 45 FPS target on a 60 Hz clock, hidden mounting, stopped resizing and timer cleanup.

Hardware is isolated in commit `c0508e6`; reverting that commit restores the preceding hardware while keeping the file/game overhaul. The rounded case is also selectable directly in model view.
