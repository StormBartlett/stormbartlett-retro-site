# Hardware collection

Three original Blender rigs share the same mounted portfolio desktop:

- **Classic Mac:** angular ivory case, CRT recess, glass gasket, floppy drive, rainbow badge, vents, carry handle and feet. The earlier rounded asset is retained.
- **Studio Laptop:** aluminium unibody, hinged 16:10 display, mesh key legends, clickable keycaps, search trackpad, speakers and ports.
- **RTX Workstation:** wide display, glass-sided custom tower, visible triple-fan GPU, RGB intake fans, CPU cooling, memory, power supply and front I/O.

`assets/blender/build_hardware.py` generates the self-contained GLBs and `hardware-manifest.json`. Screen dimensions/placement and camera framing are authored with the geometry, so every rig uses the same calculation on every browser. Optional `--sources <directory>` exports editable Blender files. Blender 4.1.1 generated these assets.

## Runtime

The initial rig loads first. Desktop idle time preloads the three self-contained GLBs (about 3 MB combined); phones start this work after opting into model view. Parsed scenes stay in the loader cache. Background preparation compiles materials, initializes textures, and renders each hidden rig once with all fragments discarded to upload its geometry. Each asset is below 1.3 MB. Hardware lettering and reflections are local, with no remote HDRI or texture requests.

All rigs fit around one fixed 800×600 OS aperture. Wider screens retain black margins so the models and desktop keep their original proportions. The camera is framed on initial load or a meaningful viewport change; selecting a rig never reframes it. Manual orbit/zoom remains available. The same HTML host and app windows survive every switch.

The selected rig is saved using the existing protected storage helpers. A physical red button left of the monitor cycles cases with a 720 ms pixel dissolve. The floating selector, screen-zoom controls and hint strip were removed. The screen tap/desktop exit remains available. CSS3D wrappers use non-scrolling clipping so focusing the physical button cannot shift its projected position.

Seven PC blade groups rotate around their own hubs; housings and RGB rings stay fixed. A single timer requests at most 30 fps for visible fans. Static rigs, hidden model view and reduced-motion mode have no recurring fan timer. Shadow maps update for model transitions and peripheral motion, rather than for every fan frame. The studio keeps a single opted-in renderer alive for fast reopening, with a 1.5 DPR cap on phones.

The fixed-screen implementation is isolated in `3be32d1`. No Blender source or GLB file was changed. See [verification and review](fixed-screen-hardware.md).

## Validation

- 86 automated tests passed, including GLB headers, embedded resources, size bounds, laptop interaction metadata, aperture ratios and phone/desktop framing.
- TypeScript, targeted ESLint and production build passed.
- Chromium visual checks cover all three rigs at desktop and 390×844 phone sizes, aligned live screens and saved model selection. An open calculator retained its value through hardware changes.
- After cycling laptop → RTX → laptop, clicking the built-in trackpad opened search and the physical 3 key entered `3`. External keyboard input also worked.
- On phones, View screen fit the display, tapping the display returned to the full desktop, and the hardware selector stayed clear of the model. No browser warnings/errors were recorded during the final check.
- Real iPhone Safari/Chrome and Android hardware still require device checks; viewport emulation does not establish native cross-browser parity.
