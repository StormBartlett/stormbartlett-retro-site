"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Icon = { id: string; label: string; app: string; x: number; y: number };
type Win = { id: string; open: boolean; z: number };

const baseIcons: Icon[] = [
  { id: "about", label: "About Me", app: "about", x: 40, y: 64 },
  { id: "skills", label: "Skills", app: "skills", x: 160, y: 64 },
  { id: "experience", label: "Experience", app: "experience", x: 280, y: 64 },
  { id: "calculator", label: "Calculator", app: "calculator", x: 400, y: 64 },
  { id: "readme", label: "README.txt", app: "readme", x: 520, y: 64 },
  { id: "todo", label: "TODO.txt", app: "todo", x: 640, y: 64 },
  { id: "haiku", label: "haiku.txt", app: "haiku", x: 760, y: 64 },
  { id: "cat", label: "cat-ascii.txt", app: "cat", x: 880, y: 64 },
];

export default function DesktopOS({ embedded = false }: { embedded?: boolean }) {
  const initialIcons: Icon[] = baseIcons;
  const [icons, setIcons] = useState<Icon[]>(initialIcons);
  const [windows, setWindows] = useState<Record<string, Win>>({
    about: { id: "about", open: false, z: 10 },
    skills: { id: "skills", open: false, z: 10 },
    experience: { id: "experience", open: false, z: 10 },
    calculator: { id: "calculator", open: false, z: 10 },
    readme: { id: "readme", open: false, z: 10 },
    todo: { id: "todo", open: false, z: 10 },
    haiku: { id: "haiku", open: false, z: 10 },
    cat: { id: "cat", open: false, z: 10 },
  });
  const [nextZ, setNextZ] = useState(10);
  const [crtOff, setCrtOff] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [iconsReady, setIconsReady] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const [openMenu, setOpenMenu] = useState<null | "apple" | "file" | "edit" | "view" | "go" | "window" | "help">(null);
  const menubarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nx-icons");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Icon[];
        const merged = mergeIconsWithDefaults(parsed);
        setIcons(merged);
      } catch {
        setIcons(initialIcons);
      }
    } else {
      setIcons(initialIcons);
    }
    setIconsReady(true);
    const savedCrt = localStorage.getItem("nx-crt-off");
    if (savedCrt === "1") setCrtOff(true);
    const update = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    localStorage.setItem("nx-icons", JSON.stringify(icons));
  }, [icons]);
  useEffect(() => {
    const crt = document.querySelector(".crt");
    if (!crt) return;
    crt.classList.toggle("crt-off", crtOff);
    localStorage.setItem("nx-crt-off", crtOff ? "1" : "0");
  }, [crtOff]);

  useEffect(() => {
    const savedDark = localStorage.getItem("nx-dark-mode");
    if (savedDark === "1") setDarkMode(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("nx-dark-mode", darkMode ? "1" : "0");
  }, [darkMode]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menubarRef.current) return;
      if (!menubarRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleMenu(id: NonNullable<typeof openMenu>) {
    setOpenMenu((m) => (m === id ? null : id));
  }
  function trackHover(id: NonNullable<typeof openMenu>) {
    setOpenMenu((m) => (m ? id : m));
  }

  const openWin = (id: string) => {
    setWindows((w) => ({ ...w, [id]: { ...w[id], open: true, z: nextZ + 1 } }));
    setNextZ((z) => z + 1);
  };
  const frontWin = (id: string) => {
    setWindows((w) => ({ ...w, [id]: { ...w[id], z: nextZ + 1 } }));
    setNextZ((z) => z + 1);
  };
  const closeWin = (id: string) => setWindows((w) => ({ ...w, [id]: { ...w[id], open: false } }));

  function closeAllWindows() {
    setWindows((w) => {
      const entries = Object.entries(w).map(([k, v]) => [k, { ...v, open: false }]);
      return Object.fromEntries(entries) as typeof w;
    });
  }

  function bringAllToFront() {
    setWindows((w) => {
      let zBase = nextZ;
      const updated: Record<string, Win> = { ...w };
      Object.keys(updated).forEach((id) => {
        if (updated[id].open) {
          zBase += 1;
          updated[id] = { ...updated[id], z: zBase };
        }
      });
      setNextZ(zBase);
      return updated;
    });
  }

  function resetIcons() {
    setIcons(initialIcons);
    localStorage.removeItem("nx-icons");
  }

  function arrangeIcons() {
    setIcons((list) => {
      const colWidth = 120;
      const rowHeight = 96;
      const startX = 40;
      const startY = 64;
      const usableHeight = typeof window !== "undefined" ? Math.max(200, window.innerHeight - 160) : 600;
      const perColumn = Math.max(1, Math.floor(usableHeight / rowHeight));
      const sorted = [...list].sort((a, b) => a.label.localeCompare(b.label));
      return sorted.map((icon, idx) => {
        const col = Math.floor(idx / perColumn);
        const row = idx % perColumn;
        return { ...icon, x: startX + col * colWidth, y: startY + row * rowHeight };
      });
    });
  }

  function copyPortfolioLink() {
    try {
      const href = typeof window !== "undefined" ? window.location.href : "";
      if (href && navigator.clipboard) navigator.clipboard.writeText(href);
    } catch {}
  }

  function toggleCRT() {
    setCrtOff((v) => !v);
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    marqueeStart.current = { x: e.clientX, y: e.clientY };
    const el = document.createElement("div");
    el.className = "marquee";
    marqueeRef.current = el;
    desktopRef.current?.appendChild(el);
    const move = (ev: MouseEvent) => {
      if (!marqueeStart.current || !marqueeRef.current || !desktopRef.current) return;
      const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
      const rect = screenEl?.getBoundingClientRect();
      const css = screenEl ? window.getComputedStyle(screenEl) : null;
      const cssW = css ? parseFloat(css.width || '0') : 0;
      const cssH = css ? parseFloat(css.height || '0') : 0;
      const scaleX = rect && cssW ? rect.width / cssW : 1;
      const scaleY = rect && cssH ? rect.height / cssH : 1;
      const d = desktopRef.current.getBoundingClientRect();
      const left = (Math.min(marqueeStart.current.x, ev.clientX) - d.left) / scaleX;
      const top = (Math.min(marqueeStart.current.y, ev.clientY) - d.top) / scaleY;
      const width = Math.abs(ev.clientX - marqueeStart.current.x) / scaleX;
      const height = Math.abs(ev.clientY - marqueeStart.current.y) / scaleY;
      Object.assign(marqueeRef.current.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      const box = new DOMRect(left + d.left, top + d.top, width, height);
      const buttons = desktopRef.current.querySelectorAll<HTMLButtonElement>(`.desktop-icon`);
      const sel = new Set<string>();
      buttons.forEach((btn) => {
        const r = btn.getBoundingClientRect();
        const id = btn.dataset.id || "";
        const inter = !(r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom);
        if (inter) sel.add(id);
        btn.classList.toggle("is-selected", sel.has(id));
      });
      setSelection(sel);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      marqueeRef.current?.remove();
      marqueeRef.current = null;
      marqueeStart.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div className={embedded ? "embedded-screen" : undefined}>
      <header ref={menubarRef} className="menubar" role="banner" aria-label="Menu Bar">
        <nav className="menubar-left" aria-label="Primary">
          <div className={`menu ${openMenu === "apple" ? "is-open" : ""}`}>
            <button className="menu-trigger menu-trigger-apple" type="button" aria-haspopup="menu" aria-expanded={openMenu === "apple"} onClick={() => toggleMenu("apple")} onMouseEnter={() => trackHover("apple")}>
              <Image src="/lightning-logo-black.svg" width={17} height={20} alt="" className="apple-pixel" />
            </button>
            <div className="menu-dropdown" role="menu">
              <div className="menu-label">Storm Bartlett</div>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("about"); setOpenMenu(null); }}>About Storm Bartlett</button>
              <a className="menu-entry" role="menuitem" href="https://github.com/stormbartlett" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>GitHub</a>
            </div>
          </div>

          <div className={`menu ${openMenu === "file" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "file"} onClick={() => toggleMenu("file")} onMouseEnter={() => trackHover("file")}>
              File
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("about"); setOpenMenu(null); }}>New About Window</button>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("skills"); setOpenMenu(null); }}>New Skills Window</button>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("calculator"); setOpenMenu(null); }}>New Calculator</button>
              <button className="menu-entry" role="menuitem" onClick={() => { closeAllWindows(); setOpenMenu(null); }}>Close All</button>
            </div>
          </div>

          <div className={`menu ${openMenu === "edit" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "edit"} onClick={() => toggleMenu("edit")} onMouseEnter={() => trackHover("edit")}>
              Edit
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={() => { copyPortfolioLink(); setOpenMenu(null); }}>Copy Portfolio Link</button>
              <a className="menu-entry" role="menuitem" href="mailto:storm@stormbartlett.com" onClick={() => setOpenMenu(null)}>Email Storm…</a>
            </div>
          </div>

          <div className={`menu ${openMenu === "view" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "view"} onClick={() => toggleMenu("view")} onMouseEnter={() => trackHover("view")}>
              View
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={() => { toggleCRT(); setOpenMenu(null); }}>Toggle CRT Scanlines</button>
              <button className="menu-entry" role="menuitem" onClick={() => { arrangeIcons(); setOpenMenu(null); }}>Arrange Icons</button>
              <button className="menu-entry" role="menuitem" onClick={() => { resetIcons(); setOpenMenu(null); }}>Reset Desktop Icons</button>
            </div>
          </div>

          <div className={`menu ${openMenu === "go" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "go"} onClick={() => toggleMenu("go")} onMouseEnter={() => trackHover("go")}>
              Go
            </button>
            <div className="menu-dropdown" role="menu">
              <a className="menu-entry" role="menuitem" href="https://github.com/stormbartlett" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>GitHub</a>
              <a className="menu-entry" role="menuitem" href="https://www.linkedin.com/in/stormbartlett/" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>LinkedIn</a>
              <a className="menu-entry" role="menuitem" href="/Storm_Bartlett_Resume.pdf" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>Resume</a>
            </div>
          </div>

          <div className={`menu ${openMenu === "window" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "window"} onClick={() => toggleMenu("window")} onMouseEnter={() => trackHover("window")}>
              Window
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={() => { bringAllToFront(); setOpenMenu(null); }}>Bring All to Front</button>
              <button className="menu-entry" role="menuitem" onClick={() => { closeAllWindows(); setOpenMenu(null); }}>Close All</button>
            </div>
          </div>

          <div className={`menu ${openMenu === "help" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "help"} onClick={() => toggleMenu("help")} onMouseEnter={() => trackHover("help")}>
              Help
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("about"); setOpenMenu(null); }}>About This Portfolio</button>
            </div>
          </div>
        </nav>
        <div className="menubar-right" aria-live="polite">
          <span className="menu-user">Storm Bartlett</span>
          <button
            className="dark-mode-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Light Mode" : "Dark Mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div className="theme-toggle-anim" aria-hidden="true">
              <svg className="sun" width="17" height="17" viewBox="0 0 16 16">
                <use href="#icon-sun" />
              </svg>
              <div className="moon">
                <Image src="/moon-white.svg" width={17} height={17} alt="" />
              </div>
            </div>
          </button>
          <span>{clock}</span>
        </div>
      </header>

      <main id="desktop" className="desktop" ref={desktopRef} onContextMenu={onContextMenu}>
        {icons.map((icon) => (
          <DesktopIcon key={icon.id} icon={icon} icons={icons} canDrag={iconsReady} setIcons={setIcons} selection={selection} setSelection={setSelection} onDbl={() => openWin(icon.app)} />
        ))}

        <Window id="about" title="About Me" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <p><strong>Hi, I&apos;m Storm Bartlett</strong>. Retro UI enjoyer, frontend-focused full‑stack engineer.</p>
          <p>TypeScript, React/Next.js, Node, design systems, accessibility.</p>
        </Window>
        <Window id="skills" title="Skills" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <ul><li>Languages: TypeScript, JavaScript, HTML/CSS</li><li>Frameworks: Next.js, SvelteKit, Node</li><li>UI: A11y, motion, design systems</li></ul>
        </Window>
        <Window id="experience" title="Experience" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <p>Founder — NoteTime Pty Ltd</p>
        </Window>
        <Window id="calculator" title="Calculator" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <Calculator />
        </Window>
        <Window id="readme" title="README.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <pre style={{whiteSpace:"pre-wrap", margin:0}}>
{`Welcome to my retro desktop.

This is a playground portfolio — part Lisa, part classic Mac.

Highlights:
- TypeScript + React/Next.js
- A11y-first UI & motion
- Design systems enjoyer

Beware: Clicking icons may open portals.`}
          </pre>
        </Window>
        <Window id="todo" title="TODO.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <ul>
            <li>Ship something delightful</li>
            <li>Add a spinning watch cursor (for dramatic effect)</li>
            <li>Refill coffee ☕</li>
          </ul>
        </Window>
        <Window id="haiku" title="haiku.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <pre style={{whiteSpace:"pre-wrap", margin:0}}>
{`pixels hum softly
scanlines breathe in quiet loops
code dreams in monospace`}
          </pre>
        </Window>
        <Window id="cat" title="cat-ascii.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <pre aria-label="ASCII cat" style={{whiteSpace:"pre", margin:0}}>
{String.raw`/\_/\  (
( o.o ) )  meow
 > ^ < (
`}
          </pre>
        </Window>
      </main>
    </div>
  );
}

function DesktopIcon({ icon, icons, canDrag, setIcons, selection, setSelection, onDbl }: { icon: Icon; icons: Icon[]; canDrag: boolean; setIcons: React.Dispatch<React.SetStateAction<Icon[]>>; selection: Set<string>; setSelection: (s: Set<string>) => void; onDbl: () => void; }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [burst, setBurst] = useState(false);
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!canDrag) return;
    const nextSel = selection.has(icon.id) ? new Set(selection) : new Set([icon.id]);
    setSelection(nextSel);
    const startX = e.clientX, startY = e.clientY;
    // Compute current CSS transform scale of the embedded screen
    const screenEl = ref.current?.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const sx = rect && cssW ? rect.width / cssW : 1;
    const sy = rect && cssH ? rect.height / cssH : 1;
    const starts = new Map<string, { x: number; y: number }>();
    icons.forEach((it) => {
      if (nextSel.has(it.id)) starts.set(it.id, { x: it.x, y: it.y });
    });
    let dragging = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / sx, dy = (ev.clientY - startY) / sy;
      if (!dragging) {
        const dist = Math.hypot(dx, dy);
        if (dist < 4) return;
        dragging = true;
        ref.current?.setPointerCapture(e.pointerId);
      }
      setIcons((list) => list.map((i) => {
        if (!nextSel.has(i.id)) return i;
        const s = starts.get(i.id) || { x: i.x, y: i.y };
        return { ...i, x: Math.max(8, s.x + dx), y: Math.max(36, s.y + dy) };
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
      if (dragging) {
        try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
      }
    };
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
  };
  const spriteId = icon.id === "about"
    ? "icon-file-txt"
    : icon.id === "skills"
    ? "icon-file-binary"
    : icon.id === "experience"
    ? "icon-file-html"
    : icon.id === "calculator"
    ? "icon-file-binary"
    : icon.id === "readme" || icon.id === "todo" || icon.id === "haiku" || icon.id === "cat"
    ? "icon-file-txt"
    : "icon-file";
  return (
    <button ref={ref} className={`desktop-icon ${selection.has(icon.id) ? "is-selected" : ""} ${burst ? "is-burst" : ""}`} data-id={icon.id} style={{ left: icon.x, top: icon.y, position: "absolute" }} onDoubleClick={onDbl} onPointerDown={down} onClick={() => { setBurst(true); window.setTimeout(() => setBurst(false), 500); }}>
      <div className="icon">
        <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
          <use href={`#${spriteId}`}></use>
        </svg>
      </div>
      <span className="icon-label">{icon.label}</span>
    </button>
  );
}

function Window({ id, title, windows, frontWin, closeWin, children }: { id: string; title: string; windows: Record<string, Win>; frontWin: (id: string) => void; closeWin: (id: string) => void; children: React.ReactNode; }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const w = windows[id];
  if (!w?.open) return null;
  const down = (e: React.PointerEvent) => {
    const startX = e.clientX, startY = e.clientY;
    // Compute scale of embedded screen to adjust drag deltas
    const screenEl = divRef.current?.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = rect && cssW ? rect.width / cssW : 1;
    const scaleY = rect && cssH ? rect.height / cssH : 1;
    const sx = parseInt(divRef.current?.style.left || "80", 10);
    const sy = parseInt(divRef.current?.style.top || "80", 10);
    frontWin(id);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scaleX, dy = (ev.clientY - startY) / scaleY;
      if (divRef.current) {
        divRef.current.style.left = `${Math.max(0, sx + dx)}px`;
        divRef.current.style.top = `${Math.max(28, sy + dy)}px`;
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
  };
  return (
    <section className="window" ref={divRef} style={{ zIndex: w.z as number, position: "absolute" }} data-app={id}>
      <header className="titlebar" onPointerDown={down}>
        <div className="title">{title}</div>
        <div className="window-controls"><button className="btn-close" onClick={() => closeWin(id)}>✕</button></div>
      </header>
      <div className="window-body">{children}</div>
    </section>
  );
}

function Calculator() {
  const [expr, setExpr] = useState("0");
  const append = (k: string) => setExpr((e) => (e === "0" && /[0-9]/.test(k) ? k : e + k));
  const clear = () => setExpr("0");
  const evalExpr = () => {
    try {
      const safe = expr.replace(/[^0-9+\-*/.]/g, "");
      setExpr(String(Function("\"use strict\";return(" + safe + ")")()));
    } catch {
      setExpr("Error");
      setTimeout(clear, 900);
    }
  };
  return (
    <div className="calc">
      <div className="calc-display">{expr}</div>
      <div className="calc-keys">
        <button className="key wide" onClick={clear}>C</button>
        <button className="key" onClick={() => append("/")}>÷</button>
        <button className="key" onClick={() => append("*")}>×</button>
        <button className="key" onClick={() => append("7")}>7</button>
        <button className="key" onClick={() => append("8")}>8</button>
        <button className="key" onClick={() => append("9")}>9</button>
        <button className="key" onClick={() => append("-")}>−</button>
        <button className="key" onClick={() => append("4")}>4</button>
        <button className="key" onClick={() => append("5")}>5</button>
        <button className="key" onClick={() => append("6")}>6</button>
        <button className="key" onClick={() => append("+")}>+</button>
        <button className="key" onClick={() => append("1")}>1</button>
        <button className="key" onClick={() => append("2")}>2</button>
        <button className="key" onClick={() => append("3")}>3</button>
        <button className="key tall" onClick={evalExpr}>=</button>
        <button className="key wide" onClick={() => append("0")}>0</button>
        <button className="key" onClick={() => append(".")}>.</button>
      </div>
    </div>
  );
}

function mergeIconsWithDefaults(saved: Icon[]): Icon[] {
  const byId = new Map(saved.map((i) => [i.id, i] as const));
  const merged: Icon[] = [];
  baseIcons.forEach((def) => {
    const s = byId.get(def.id);
    merged.push(s ? { ...s } : { ...def });
  });
  const width = typeof window !== "undefined" ? window.innerWidth : 1280;
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxX = Math.max(8, width - 140);
  const maxY = Math.max(36, height - 200);
  return merged.map((i) => ({
    ...i,
    x: Math.min(Math.max(8, i.x), maxX),
    y: Math.min(Math.max(36, i.y), maxY),
  }));
}


