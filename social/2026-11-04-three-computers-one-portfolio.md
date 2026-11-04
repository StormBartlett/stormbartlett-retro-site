# Three computers. One portfolio.

**Interest score: 96/100**

**Implementation commit:** `5914539` — Add Blender hardware collection with shared live desktop.

## What changed

Rebuilt the classic Mac in Blender, then added an aluminium laptop and a glass-sided RTX/RGB workstation. A hardware switcher changes the computer around the live portfolio desktop. Open apps and their values survive; laptop keycaps type, its trackpad opens search, and external keyboards/mice remain interactive. Phone framing, screen zoom and a direct desktop exit keep it usable on small screens.

## Why this is interesting

The portfolio behaves like a small computer collection. The reveal is immediate: switch a vintage Mac into a laptop, then a custom gaming PC, while the exact same app stays open. The physical keyboard typing into the virtual computer gives the short a second payoff.

## 20-second short script

- **0–3s:** Orbit the ivory Mac. Caption: “My portfolio needed a new computer.”
- **3–6s:** Open Calculator, enter 7. Click Laptop. “So I built three.”
- **6–10s:** Switch to RTX PC. Show the glass panel, GPU and RGB fans. “All in Blender. All running the same desktop.”
- **10–14s:** Return to Laptop. Click its trackpad, then a physical key to type into search. “And the keys actually work.”
- **14–18s:** Cut to phone: change hardware, zoom the screen, tap into the full desktop. “Tiny screen? Still a proper computer.”
- **18–20s:** Three rapid hardware cuts. Caption: “Which desk are you choosing?”

## How it works

`assets/blender/build_hardware.py` authors bevelled geometry, cutouts, local materials and mesh lettering, exporting three self-contained GLBs plus a screen/framing manifest. Blender 4.1.1 generated the models. Each GLB is below 1.3 MB; only the selected rig loads, and Three.js renders on demand.

An unkeyed HTML screen keeps one DesktopOS instance alive while placement and dimensions change per rig. Keyed hardware meshes rebind raycasting after swaps. glTF extras identify laptop keys and the trackpad; pointer taps feed the existing desktop input bridge. Aspect-aware camera distances fit the setup on phones.

Validated with 86 tests, TypeScript, targeted ESLint, a production build and Chromium desktop/390×844 checks. Native iPhone browsers remain a device-testing follow-up.
