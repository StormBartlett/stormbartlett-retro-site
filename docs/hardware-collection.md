# Hardware collection

Three original Blender rigs share the same mounted portfolio desktop:

- **Classic Mac:** rounded ivory case, Boolean-cut CRT recess, glass gasket, floppy drive, rainbow badge, vents, carry handle and feet.
- **Studio Laptop:** aluminium unibody, hinged 16:10 display, mesh key legends, clickable keycaps, search trackpad, speakers and ports.
- **RTX Workstation:** wide display, glass-sided custom tower, visible triple-fan GPU, RGB intake fans, CPU cooling, memory, power supply and front I/O.

`assets/blender/build_hardware.py` generates the self-contained GLBs and `hardware-manifest.json`. Screen dimensions/placement and camera framing are authored with the geometry, so every rig uses the same calculation on every browser. Optional `--sources <directory>` exports editable Blender files. Blender 4.1.1 generated these assets.

## Runtime

Only the selected GLB loads, then stays in the loader cache for switching back. Each asset is below 1.3 MB. Materials and lettering are local; there are no remote textures, HDRIs or font fetches for the hardware. Studio reflections use a one-frame, 128px procedural environment. Rendering remains on demand with a 1.5 DPR cap on phones.

The hardware mesh is keyed per rig so React Three Fiber rebinds hit testing after a model swap. The HTML screen is deliberately unkeyed: its DOM host and all open app state survive. Display sizes are 800×600, 1000×625 and 1120×630; each matches the corresponding physical aperture's aspect ratio. No separate OS implementation is needed.

The selected rig is saved using the existing protected storage helpers. Reset desk restores peripheral positions and camera framing. Screen zoom uses the active display dimensions. Phones retain the direct desktop exit and use a bottom hardware selector.

## Validation

- 86 automated tests passed, including GLB headers, embedded resources, size bounds, laptop interaction metadata, aperture ratios and phone/desktop framing.
- TypeScript, targeted ESLint and production build passed.
- Chromium visual checks cover all three rigs at desktop and 390×844 phone sizes, aligned live screens and saved model selection. An open calculator retained its value through hardware changes.
- After cycling laptop → RTX → laptop, clicking the built-in trackpad opened search and the physical 3 key entered `3`. External keyboard input also worked.
- On phones, View screen fit the display, tapping the display returned to the full desktop, and the hardware selector stayed clear of the model. No browser warnings/errors were recorded during the final check.
- Real iPhone Safari/Chrome and Android hardware still require device checks; viewport emulation does not establish native cross-browser parity.
