# Opus 5.5 review — 5 November 2026

Claude Code ran `claude-opus-5-5` at high effort. Model usage confirmed Opus 5.5; no fallback model or dependencies were used. The main reviewer made focused fixes and added regression tests. The implementation and browser pass were completed by Codex.

## Main fixes from Opus

- **Durable file moves:** restored items moved from folders to desktop, stopped moved items reappearing in their old location, retained custom folder contents across screen layouts, and validated stored shortcuts/Trash records.
- **Existing Finder notes:** old saves deeper than five levels remain intact after repeated reloads. New moves validate only their complete moved subtree, so unrelated legacy folders do not block other file operations.
- **Native folder behavior:** Delete in folder windows goes to Trash; Finder spring-opens folders after 650 ms. Cut, Paste and Undo move buttons make those actions reachable on touch. Keyboard activation works after a drag.
- **Game focus:** Balloon Bastion takes focus at boot, pauses while away and resumes properly. Snake pauses when another app takes focus. Pause menus do not pull focus away from other apps; clicks inside a game keep the keyboard attached to its board.
- **Pointer costs:** Trash dragging paints positions directly and commits once. Marquee selection avoids unchanged updates. Coordinate measurement waits until a real drag starts. The hardware cursor uses a transform.
- **Hardware:** case changes keep the camera view; laptop keys and external devices share the orbit-control interaction counter; the physical Esc key reaches games. Swept collisions gained a numerical safety margin, with tests for all initial device placements.

## Integration decisions and targeted follow-up

Reset Desktop Icons now resets positions while retaining custom folders, folder membership and Trash. An integration test verifies the data still exists after reload. Concurrent file gestures are gated so an unstarted second gesture cannot finish the active one. Cancelled folder drags do not leave stale click suppression behind. The final targeted Opus pass found Escape-release activation and keyboard activation being swallowed after a drag; both were fixed with regression checks.

Falling Sand's separate Opus review identified frame-rate scheduling drift, hidden-at-mount stalling, and resize not repainting a stopped canvas. All were fixed and covered by regression tests. Its second canvas and CPU pixel-copy/noise shader were removed in favor of CSS scanlines. Zero FPS and background pause have no pending simulation frame timers; drawing at zero FPS still works.

## Validation and limits

The integrated tree passed 161 tests, TypeScript and a production build before final preview verification. Browser checks include physical collisions, reversible Mac case, file drag/reload/undo, five-level nesting, direct game boot, Esc help/resume, keyboard tower placement, phone movement controls and zero-FPS drawing.

Native iPhone Safari and Android testing remain outstanding. Safari focus handling was improved from code review, not validated on an actual Safari device. The two file browsers retain separate stores; cross-store desktop/Finder dragging is not provided. Default app icons remain recoverable after reload, and Put Back does not resolve duplicate names. Collisions assume the tested, non-overlapping device starts.
