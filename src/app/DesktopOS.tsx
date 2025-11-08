"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import TiptapEditor from "./TiptapEditor";

type Icon = { id: string; label: string; app: string; x: number; y: number };
type Win = { id: string; open: boolean; z: number };

const baseIcons: Icon[] = [
  { id: "about", label: "About Me", app: "about", x: 40, y: 64 },
  { id: "skills", label: "Skills", app: "skills", x: 160, y: 64 },
  { id: "experience", label: "Experience", app: "experience", x: 280, y: 64 },
  { id: "calculator", label: "Calculator", app: "calculator", x: 400, y: 64 },
  { id: "readme", label: "README.txt", app: "readme", x: 520, y: 64 },
  { id: "todo", label: "TODO.txt", app: "todo", x: 640, y: 64 },
];

export default function DesktopOS({ embedded = false, mobileVariant }: { embedded?: boolean; mobileVariant?: "portrait" | "landscape" }) {
  const isMobile = !!mobileVariant;
  const isMobilePortrait = mobileVariant === "portrait";
  const initialIcons: Icon[] = baseIcons;
  const [icons, setIcons] = useState<Icon[]>(initialIcons);
  const [trash, setTrash] = useState<Icon[]>([]);
  const [windows, setWindows] = useState<Record<string, Win>>({
    about: { id: "about", open: false, z: 10 },
    skills: { id: "skills", open: false, z: 10 },
    experience: { id: "experience", open: false, z: 10 },
    calculator: { id: "calculator", open: false, z: 10 },
    readme: { id: "readme", open: false, z: 10 },
    todo: { id: "todo", open: false, z: 10 },
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
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const menubarRef = useRef<HTMLElement | null>(null);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const dragOverTrash = false;
  const [trashCtxMenu, setTrashCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const trashCtxRef = useRef<HTMLDivElement | null>(null);
  const [trashPos, setTrashPos] = useState<{ x: number; y: number } | null>(null);

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
    const savedTrash = localStorage.getItem("nx-trash");
    if (savedTrash) {
      try { setTrash(JSON.parse(savedTrash) as Icon[]); } catch {}
    }
    const savedTrashPos = localStorage.getItem("nx-trash-pos");
    if (savedTrashPos) {
      try {
        const p = JSON.parse(savedTrashPos) as { x: number; y: number };
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          const c = clampToDesktop(p.x, p.y);
          setTrashPos(c);
        }
      } catch {}
    }
    const savedCrt = localStorage.getItem("nx-crt-off");
    if (savedCrt === "1") setCrtOff(true);
    const update = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [initialIcons]);

  // On mobile variants, arrange icons into a grid that fits the screen
  useEffect(() => {
    if (!iconsReady) return;
    if (!isMobile) return;
    arrangeIcons();
  }, [iconsReady, isMobile, mobileVariant]);

  // Initialize trash position on mobile if not set
  useEffect(() => {
    if (!iconsReady) return;
    if (!isMobile) return;
    if (trashPos !== null) return; // Only initialize if not already set
    const width = typeof window !== "undefined" ? window.innerWidth : 1280;
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const defaultX = Math.max(8, width - 96 - 24);
    const defaultY = Math.max(36, height - 96 - 24);
    setTrashPos({ x: defaultX, y: defaultY });
  }, [iconsReady, isMobile, trashPos]);

  useEffect(() => {
    localStorage.setItem("nx-icons", JSON.stringify(icons));
  }, [icons]);
  useEffect(() => {
    localStorage.setItem("nx-trash", JSON.stringify(trash));
  }, [trash]);
  useEffect(() => {
    if (trashPos) {
      localStorage.setItem("nx-trash-pos", JSON.stringify(trashPos));
    } else {
      localStorage.removeItem("nx-trash-pos");
    }
  }, [trashPos]);
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
      if (e.key === "Escape") {
        setOpenMenu(null);
        setCtxMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close context menu when clicking outside it
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  // Close trash context menu when clicking outside it
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (trashCtxRef.current && !trashCtxRef.current.contains(e.target as Node)) {
        setTrashCtxMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
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
    // Clear current icons and trash, then restore defaults
    setIcons(initialIcons);
    setTrash([]);
    setSelection(new Set());
    localStorage.removeItem("nx-icons");
    localStorage.removeItem("nx-trash");
    setTrashPos(null);
    localStorage.removeItem("nx-trash-pos");
  }

  function deleteSelectedIcons() {
    if (selection.size === 0) return;
    setIcons((list) => {
      const keep: Icon[] = [];
      const removed: Icon[] = [];
      list.forEach((i) => {
        if (selection.has(i.id)) removed.push(i); else keep.push(i);
      });
      if (removed.length) addToTrash(removed);
      return keep;
    });
    setSelection(new Set());
  }

  // removed helper; consolidated into onIconDragEnd to avoid double adds

  function addToTrash(items: Icon[]) {
    if (!items.length) return;
    setTrash((prev) => {
      const existing = new Set(prev.map((i) => i.id));
      const unique = items.filter((i) => !existing.has(i.id));
      return unique.length ? [...unique, ...prev] : prev;
    });
  }

  function clampToDesktop(x: number, y: number): { x: number; y: number } {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    // Subtract menubar height (28px) from viewport when desktop rect is unavailable
    const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    const maxX = Math.max(8, width - 140);
    const maxY = Math.max(36, height - 200);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(36, y), maxY) };
  }

  function restoreIcon(id: string, at?: { x: number; y: number }) {
    setTrash((t) => {
      const idx = t.findIndex((it) => it.id === id);
      if (idx < 0) return t;
      const item = t[idx];
      const pos = at ? clampToDesktop(at.x, at.y) : { x: item.x, y: item.y };
      setIcons((list) => [{ ...item, x: pos.x, y: pos.y }, ...list]);
      const next = [...t];
      next.splice(idx, 1);
      return next;
    });
  }

  function restoreAll() {
    setTrash((t) => {
      if (t.length === 0) return t;
      setIcons((list) => [...t, ...list]);
      return [];
    });
  }

  function clientToDesktop(clientX: number, clientY: number): { left: number; top: number } | null {
    if (!desktopRef.current) return null;
    const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = rect && cssW ? rect.width / cssW : 1;
    const scaleY = rect && cssH ? rect.height / cssH : 1;
    const d = desktopRef.current.getBoundingClientRect();
    const left = (clientX - d.left) / scaleX;
    const top = (clientY - d.top) / scaleY;
    return { left, top };
  }

  // Drag-to-trash disabled

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

  // Removed copyPortfolioLink (unused)

  function toggleCRT() {
    setCrtOff((v) => !v);
  }

  function resetTrashPosition() {
    setTrashPos(null);
    localStorage.removeItem("nx-trash-pos");
  }

  function onContextMenu(e: React.MouseEvent) {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    // If right-clicked an icon and it's not selected, select it
    const target = e.target as HTMLElement;
    const iconBtn = target.closest<HTMLButtonElement>('.desktop-icon');
    if (iconBtn) {
      const id = iconBtn.dataset.id || "";
      if (id && !selection.has(id)) setSelection(new Set([id]));
    }
    if (!desktopRef.current) return;
    const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = rect && cssW ? rect.width / cssW : 1;
    const scaleY = rect && cssH ? rect.height / cssH : 1;
    const d = desktopRef.current.getBoundingClientRect();
    const left = (e.clientX - d.left) / scaleX;
    const top = (e.clientY - d.top) / scaleY;
    setCtxMenu({ x: left, y: top });
  }

  function onDesktopMouseDown(e: React.MouseEvent) {
    if ((e as unknown as PointerEvent).button !== 0) return; // left-click only
    const target = e.target as HTMLElement;
    const clickedIcon = !!target.closest('.desktop-icon');
    const clickedWindow = !!target.closest('.window');
    const clickedMenu = !!(target.closest('.menu-dropdown') || target.closest('.context-menu'));
    if (clickedIcon || clickedWindow || clickedMenu) return;
    e.preventDefault();
    setCtxMenu(null);
    setOpenMenu(null);
    setSelection(new Set());
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

  const rootClass = [
    embedded ? "embedded-screen" : "",
    isMobile ? "mobile" : "",
    isMobilePortrait ? "mobile-portrait" : isMobile ? "mobile-landscape" : "",
  ].filter(Boolean).join(" ");

  // Compute default trash position if not set; ensure it's inside the desktop container
  const defaultTrashPos = trashPos || (() => {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    // Subtract menubar height (28px) when falling back to viewport height
    const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    return { x: Math.max(8, width - 96 - 24), y: Math.max(36, height - 96 - 24) };
  })();

  return (
    <div className={rootClass || undefined}>
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

          {(true) && (
            <div className={`menu ${openMenu === "edit" ? "is-open" : ""}`}>
              <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "edit"} onClick={() => toggleMenu("edit")} onMouseEnter={() => trackHover("edit")}>
                Edit
              </button>
              <div className="menu-dropdown" role="menu">
                <a className="menu-entry" role="menuitem" href="mailto:storm@stormbartlett.com" onClick={() => setOpenMenu(null)}>Email Storm…</a>
              </div>
            </div>
          )}

          {!isMobilePortrait && (
            <div className={`menu ${openMenu === "view" ? "is-open" : ""}`}>
              <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "view"} onClick={() => toggleMenu("view")} onMouseEnter={() => trackHover("view")}>
                View
              </button>
              <div className="menu-dropdown" role="menu">
                <button className="menu-entry" role="menuitem" onClick={() => { toggleCRT(); setOpenMenu(null); }}>Toggle CRT Scanlines</button>
                <button className="menu-entry" role="menuitem" onClick={() => { arrangeIcons(); setOpenMenu(null); }}>Arrange Icons</button>
                <button className="menu-entry" role="menuitem" onClick={() => { resetIcons(); setOpenMenu(null); }}>Reset Desktop Icons</button>
              <button className="menu-entry" role="menuitem" onClick={() => { resetTrashPosition(); setOpenMenu(null); }}>Reset Trash Position</button>
              </div>
            </div>
          )}

          <div className={`menu ${openMenu === "go" ? "is-open" : ""}`} data-id="go">
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "go"} onClick={() => toggleMenu("go")} onMouseEnter={() => trackHover("go")}>
              Go
            </button>
            <div className="menu-dropdown" role="menu">
              <a className="menu-entry" role="menuitem" href="https://github.com/stormbartlett" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>GitHub</a>
              <a className="menu-entry" role="menuitem" href="https://www.linkedin.com/in/stormbartlett/" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>LinkedIn</a>
              <a className="menu-entry" role="menuitem" href="/Storm_Bartlett_Resume.pdf" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>Resume</a>
            </div>
          </div>

          {!isMobile && (
            <div className={`menu ${openMenu === "window" ? "is-open" : ""}`}>
              <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "window"} onClick={() => toggleMenu("window")} onMouseEnter={() => trackHover("window")}>
                Window
              </button>
              <div className="menu-dropdown" role="menu">
                <button className="menu-entry" role="menuitem" onClick={() => { bringAllToFront(); setOpenMenu(null); }}>Bring All to Front</button>
                <button className="menu-entry" role="menuitem" onClick={() => { closeAllWindows(); setOpenMenu(null); }}>Close All</button>
              </div>
            </div>
          )}

          {!isMobilePortrait && (
            <div className={`menu ${openMenu === "help" ? "is-open" : ""}`}>
              <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "help"} onClick={() => toggleMenu("help")} onMouseEnter={() => trackHover("help")}>
                Help
              </button>
              <div className="menu-dropdown" role="menu">
                <button className="menu-entry" role="menuitem" onClick={() => { openWin("about"); setOpenMenu(null); }}>About This Portfolio</button>
              </div>
            </div>
          )}
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

      <main id="desktop" className="desktop" ref={desktopRef} onContextMenu={onContextMenu} onMouseDown={onDesktopMouseDown}>
        {icons.map((icon) => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            icons={icons}
            canDrag={iconsReady}
            setIcons={setIcons}
            selection={selection}
            setSelection={setSelection}
            onDbl={() => { if (windows[icon.app]) openWin(icon.app); }}
          />
        ))}

        {/* Trash icon (draggable) */}
        <button
          ref={trashRef}
          className={`desktop-icon trash-icon ${dragOverTrash ? 'is-over' : ''} ${trash.length > 0 ? 'has-items' : ''}`}
          style={{ 
            position: 'absolute', 
            left: defaultTrashPos.x,
            top: defaultTrashPos.y,
          }}
          onClick={() => { if (windows['trash']) openWin('trash'); }}
          onPointerDown={(e) => {
            if ((e as unknown as PointerEvent).button !== 0) return;
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const start = trashRef.current?.getBoundingClientRect();
            const dRect = desktopRef.current?.getBoundingClientRect();
            // Compute starting position relative to the desktop container
            const sx = start && dRect
              ? start.left - dRect.left
              : (typeof window !== 'undefined' ? Math.max(8, (window.innerWidth - 96 - 24)) : 8);
            const sy = start && dRect
              ? start.top - dRect.top
              : (typeof window !== 'undefined' ? Math.max(36, (window.innerHeight - 28 - 96 - 24)) : 36);
            const move = (ev: PointerEvent) => {
              const nx = sx + (ev.clientX - startX);
              const ny = sy + (ev.clientY - startY);
              const c = clampToDesktop(nx, ny);
              setTrashPos({ x: c.x, y: c.y });
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          aria-label="Open Trash"
        >
          <div className="icon">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
              <use href="#icon-trash"></use>
            </svg>
          </div>
          <span className="icon-label">Trash</span>
        </button>

        <Window id="about" title="About Me" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={"Hi, I'm Storm Bartlett. Retro UI enjoyer, frontend-focused full‑stack engineer.\nTypeScript, React/Next.js, Node, design systems, accessibility."} />
        </Window>
        <Window id="skills" title="Skills" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={"Languages: TypeScript, JavaScript, HTML/CSS\nFrameworks: Next.js, SvelteKit, Node\nUI: A11y, motion, design systems"} />
        </Window>
        <Window id="experience" title="Experience" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor />
        </Window>
        <Window id="calculator" title="Calculator" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <Calculator />
        </Window>
        <Window id="readme" title="README.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={`Welcome to my retro desktop.

This is a playground portfolio — part Lisa, part classic Mac.

Highlights:
- TypeScript + React/Next.js
- A11y-first UI & motion
- Design systems enjoyer

Beware: Clicking icons may open portals.`} />
        </Window>
        <Window id="todo" title="TODO.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={`Ship something delightful
Add a spinning watch cursor (for dramatic effect)
Refill coffee ☕`} />
        </Window>
        
        <Window id="trash" title="Trash" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          {trash.length === 0 ? (
            <p>Trash is empty.</p>
          ) : (
            <div className="trash-window-grid">
              {trash.map((it) => (
                <button
                  key={it.id}
                  className="trash-item"
                  onDoubleClick={() => restoreIcon(it.id)}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    const pos = clientToDesktop(e.clientX, e.clientY);
                    if (pos) setTrashCtxMenu({ x: pos.left, y: pos.top, id: it.id });
                  }}
                  onPointerDown={(e) => {
                    if ((e as unknown as PointerEvent).button !== 0) return;
                    const startX = e.clientX, startY = e.clientY;
                    // create a drag ghost similar to desktop icons
                    const ghost = document.createElement('div');
                    ghost.className = 'desktop-icon drag-ghost';
                    ghost.style.position = 'fixed';
                    ghost.style.left = `${startX - 24}px`;
                    ghost.style.top = `${startY - 24}px`;
                    ghost.style.pointerEvents = 'none';
                    ghost.style.zIndex = '9999';
                    ghost.innerHTML = `<div class="icon"><svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true"><use href="#icon-file-txt"></use></svg></div><span class="icon-label">${it.label.replace(/</g,'&lt;')}</span>`;
                    document.body.appendChild(ghost);
                    const move = (ev: PointerEvent) => {
                      ghost.style.left = `${ev.clientX - 24}px`;
                      ghost.style.top = `${ev.clientY - 24}px`;
                    };
                    const up = (ev: PointerEvent) => {
                      window.removeEventListener('pointermove', move);
                      window.removeEventListener('pointerup', up);
                      ghost.remove();
                      const dx = ev.clientX - startX, dy = ev.clientY - startY;
                      const moved = Math.hypot(dx, dy) > 6;
                      if (!moved) return;
                      const pos = clientToDesktop(ev.clientX, ev.clientY);
                      if (!pos) return;
                      restoreIcon(it.id, { x: pos.left - 48, y: pos.top - 24 });
                    };
                    window.addEventListener('pointermove', move, { passive: true });
                    window.addEventListener('pointerup', up, { passive: true });
                  }}
                >
                  <div className="icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                      <use href="#icon-file-txt"></use>
                    </svg>
                  </div>
                  <span className="icon-label">{it.label}</span>
                </button>
              ))}
            </div>
          )}
        </Window>
        {ctxMenu && (
          <div
            ref={ctxMenuRef}
            className="context-menu"
            style={{
              position: "absolute",
              left: ctxMenu.x,
              top: ctxMenu.y,
              minWidth: 200,
              padding: 4,
              background: darkMode ? "var(--bg-window)" : "#ffffff",
              color: darkMode ? "#ffffff" : "#101010",
              border: "2px solid var(--border)",
              boxShadow: "0 4px 12px var(--shadow)",
              zIndex: 4000,
            }}
            role="menu"
          >
            <button className="menu-entry" role="menuitem" onClick={() => {
              if (selection.size === 0) return;
              Array.from(selection).forEach((id) => {
                const i = icons.find((it) => it.id === id);
                if (i) openWin(i.app);
              });
              setCtxMenu(null);
            }}>Open</button>
            <button className="menu-entry" role="menuitem" onClick={() => { deleteSelectedIcons(); setCtxMenu(null); }}>Delete</button>
            <button className="menu-entry" role="menuitem" onClick={() => { setSelection(new Set(icons.map(i => i.id))); setCtxMenu(null); }}>Select All</button>
          </div>
        )}
        {trashCtxMenu && (
          <div
            ref={trashCtxRef}
            className="context-menu"
            style={{
              position: "absolute",
              left: trashCtxMenu.x,
              top: trashCtxMenu.y,
              minWidth: 200,
              padding: 4,
              background: darkMode ? "var(--bg-window)" : "#ffffff",
              color: darkMode ? "#ffffff" : "#101010",
              border: "2px solid var(--border)",
              boxShadow: "0 4px 12px var(--shadow)",
              zIndex: 4000,
            }}
            role="menu"
          >
            <button className="menu-entry" role="menuitem" onClick={() => { restoreIcon(trashCtxMenu.id); setTrashCtxMenu(null); }}>Put Back</button>
            <button className="menu-entry" role="menuitem" onClick={() => { restoreAll(); setTrashCtxMenu(null); }}>Put Back All</button>
          </div>
        )}
      </main>
    </div>
  );
}

function DesktopIcon({ icon, icons, canDrag, setIcons, selection, setSelection, onDbl, onDragMove, onDragEnd }: { icon: Icon; icons: Icon[]; canDrag: boolean; setIcons: React.Dispatch<React.SetStateAction<Icon[]>>; selection: Set<string>; setSelection: (s: Set<string>) => void; onDbl: () => void; onDragMove?: (x: number, y: number) => void; onDragEnd?: (x: number, y: number, dragging: boolean) => void; }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [burst, setBurst] = useState(false);
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!canDrag) return;
    // prevent touch scrolling while dragging icons
    e.preventDefault();
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
      if (onDragMove) onDragMove(ev.clientX, ev.clientY);
    };
    const up = (ev?: PointerEvent) => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
      if (dragging) {
        try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
      }
      if (onDragEnd) onDragEnd(ev?.clientX ?? startX, ev?.clientY ?? startY, dragging);
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
    : icon.id === "readme" || icon.id === "todo"
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
  useEffect(() => {
    // Autofocus any ProseMirror instance inside when window opens or is brought to front
    const pm = divRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
    const cm = divRef.current?.querySelector('.cm-content') as HTMLElement | null;
    (pm || cm)?.focus();
  }, [w?.open, w?.z]);
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
      <header className="titlebar" onPointerDown={(e)=>{ e.preventDefault(); down(e); }}>
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


