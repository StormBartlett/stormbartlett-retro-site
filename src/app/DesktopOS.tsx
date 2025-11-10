"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import TiptapEditor from "./TiptapEditor";
import TodoEditor from "./TodoEditor";
import FallingSand from "./FallingSand";

type Icon = { id: string; label: string; app: string; x: number; y: number };
type Win = { id: string; open: boolean; z: number };

const baseIcons: Icon[] = [
  { id: "about", label: "About.txt", app: "about", x: 40, y: 64 },
  { id: "skills", label: "Skills.txt", app: "skills", x: 160, y: 64 },
  // { id: "experience", label: "Xp.txt", app: "experience", x: 280, y: 64 },
  { id: "calculator", label: "Calculator", app: "calculator", x: 400, y: 64 },
  { id: "falling-sand", label: "Falling Sand", app: "falling-sand", x: 640, y: 64 },
];

export default function DesktopOS({ embedded = false, mobileVariant }: { embedded?: boolean; mobileVariant?: "portrait" | "landscape" }) {
  const isMobile = !!mobileVariant;
  const isMobilePortrait = mobileVariant === "portrait";
  const initialIcons: Icon[] = baseIcons;
  const [icons, setIcons] = useState<Icon[]>(initialIcons);
  const [trash, setTrash] = useState<Icon[]>([]);
  const [testFolderItems, setTestFolderItems] = useState<BrowserItem[]>([]);
  const blogBrowserAddItemRef = useRef<((item: BrowserItem) => void) | null>(null);
  const [windows, setWindows] = useState<Record<string, Win>>({
    about: { id: "about", open: false, z: 10 },
    skills: { id: "skills", open: false, z: 10 },
    experience: { id: "experience", open: false, z: 10 },
    calculator: { id: "calculator", open: false, z: 10 },
    todo: { id: "todo", open: false, z: 10 },
    "falling-sand": { id: "falling-sand", open: false, z: 10 },
    trash: { id: "trash", open: false, z: 10 },
    bin: { id: "bin", open: false, z: 10 },
    "blog-recursion": { id: "blog-recursion", open: false, z: 10 },
    "blog-sorting": { id: "blog-sorting", open: false, z: 10 },
    "blog-graphs": { id: "blog-graphs", open: false, z: 10 },
    "test-folder": { id: "test-folder", open: false, z: 10 },
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
  // Shared draggable plane: items being dragged from folders appear here
  const [draggingFromFolder, setDraggingFromFolder] = useState<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<null | "apple" | "file" | "edit" | "view" | "go" | "window" | "help">(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; restricted?: boolean } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const menubarRef = useRef<HTMLElement | null>(null);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const binRef = useRef<HTMLButtonElement | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const [dragOverBin, setDragOverBin] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [trashCtxMenu, setTrashCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const trashCtxRef = useRef<HTMLDivElement | null>(null);
  const [trashPos, setTrashPos] = useState<{ x: number; y: number } | null>(null);
  const [binPos, setBinPos] = useState<{ x: number; y: number } | null>(null);
  const trashDragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const binDragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const dragOverTargetRef = useRef<string | null>(null);

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
    const savedBinPos = localStorage.getItem("nx-bin-pos");
    if (savedBinPos) {
      try {
        const p = JSON.parse(savedBinPos) as { x: number; y: number };
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          const c = clampToDesktop(p.x, p.y);
          setBinPos(c);
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
    // Wait for next frame to ensure desktopRef is available
    requestAnimationFrame(() => {
      if (!desktopRef.current) return;
      const deskRect = desktopRef.current.getBoundingClientRect();
      const width = deskRect.width || (typeof window !== "undefined" ? window.innerWidth : 1280);
      const height = deskRect.height || (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
      const defaultX = Math.max(8, width - 96 - 8);
      const defaultY = Math.max(36, height - 96 - 8);
      const clamped = clampToDesktop(defaultX, defaultY);
      setTrashPos(clamped);
    });
  }, [iconsReady, isMobile, trashPos]);

  // Initialize bin position on mobile if not set
  useEffect(() => {
    if (!iconsReady) return;
    if (!isMobile) return;
    if (binPos !== null) return; // Only initialize if not already set
    // Wait for next frame to ensure desktopRef is available
    requestAnimationFrame(() => {
      if (!desktopRef.current) return;
      const deskRect = desktopRef.current.getBoundingClientRect();
      const width = deskRect.width || (typeof window !== "undefined" ? window.innerWidth : 1280);
      const height = deskRect.height || (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
      const defaultX = 8;
      const defaultY = Math.max(36, height - 96 - 8);
      const clamped = clampToDesktop(defaultX, defaultY);
      setBinPos(clamped);
    });
  }, [iconsReady, isMobile, binPos]);

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
    if (binPos) {
      localStorage.setItem("nx-bin-pos", JSON.stringify(binPos));
    } else {
      localStorage.removeItem("nx-bin-pos");
    }
  }, [binPos]);

  // Ensure trash icon stays visible on window resize
  useEffect(() => {
    if (!trashPos) return;
    const handleResize = () => {
      const clamped = clampToDesktop(trashPos.x, trashPos.y);
      if (clamped.x !== trashPos.x || clamped.y !== trashPos.y) {
        setTrashPos(clamped);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [trashPos]);

  // Ensure bin icon stays visible on window resize
  useEffect(() => {
    if (!binPos) return;
    const handleResize = () => {
      const clamped = clampToDesktop(binPos.x, binPos.y);
      if (clamped.x !== binPos.x || clamped.y !== binPos.y) {
        setBinPos(clamped);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [binPos]);

  // Track which icons are currently being dragged
  const isDraggingRef = useRef(false);
  const draggedIconIdsRef = useRef<Set<string>>(new Set());

  // Capture selection when dragging starts
  useEffect(() => {
    const draggedIcons = document.querySelectorAll('.desktop-icon.dragging');
    if (draggedIcons.length > 0 && selection.size > 0) {
      // Capture the current selection when dragging starts
      draggedIconIdsRef.current = new Set(selection);
      isDraggingRef.current = true;
    } else if (draggedIcons.length === 0 && isDraggingRef.current) {
      // Dragging ended, but keep the IDs for the drop handler
    }
  }, [selection]);

  // Handle drag-over detection for trash/bin and folder icons
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Check if any desktop icons are being dragged
      const draggedIcons = document.querySelectorAll('.desktop-icon.dragging');
      
      if (draggedIcons.length > 0) {
        isDraggingRef.current = true;
        // Update dragged IDs from current selection
        if (selection.size > 0) {
          draggedIconIdsRef.current = new Set(selection);
        }

        const draggedIds = Array.from(draggedIconIdsRef.current);

        // Check if over trash icon (Blog folder)
        if (trashRef.current) {
          const trashRect = trashRef.current.getBoundingClientRect();
          const overTrash = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                            e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
          if (overTrash && draggedIds.length > 0 && !draggedIds.includes('trash')) {
            setDragOverTrash(true);
            dragOverTargetRef.current = 'trash';
          } else if (dragOverTargetRef.current === 'trash' && !overTrash) {
            setDragOverTrash(false);
            if (!overTrash) dragOverTargetRef.current = null;
          }
        }

        // Check if over bin icon
        if (binRef.current) {
          const binRect = binRef.current.getBoundingClientRect();
          const overBin = e.clientX >= binRect.left && e.clientX <= binRect.right &&
                          e.clientY >= binRect.top && e.clientY <= binRect.bottom;
          if (overBin && draggedIds.length > 0 && !draggedIds.includes('bin')) {
            setDragOverBin(true);
            dragOverTargetRef.current = 'bin';
          } else if (dragOverTargetRef.current === 'bin' && !overBin) {
            setDragOverBin(false);
            if (!overBin) dragOverTargetRef.current = null;
          }
        }
      } else {
        // No dragging happening
        if (!isDraggingRef.current) {
          setDragOverTrash(false);
          setDragOverBin(false);
          setDragOverFolder(null);
          dragOverTargetRef.current = null;
        }
      }
    };

    const handlePointerUp = () => {
      const targetId = dragOverTargetRef.current;
      const iconIds = Array.from(draggedIconIdsRef.current);
      
      // Small delay to ensure DesktopIcon has finished its drag handling
      setTimeout(() => {
        if (iconIds.length > 0 && targetId) {
          const iconsToMove = icons.filter(i => iconIds.includes(i.id));
          
          if (iconsToMove.length > 0) {
            if (targetId === 'bin') {
              // Move to trash - works for both files and folders
              addToTrash(iconsToMove);
              setIcons(prev => prev.filter(i => !iconIds.includes(i.id)));
              setSelection(new Set()); // Clear selection after moving
            } else if (targetId === 'trash') {
              // Move to Blog folder (trash window)
              {
                const addItem = blogBrowserAddItemRef.current;
                if (addItem) {
                  iconsToMove.forEach((icon, idx) => {
                    const browserItem: BrowserItem = {
                      id: icon.id,
                      label: icon.label,
                      type: icon.id === 'test-folder' || icon.app === 'test-folder' ? "folder" : "file",
                      x: 20 + (idx % 3) * 100,
                      y: 20 + Math.floor(idx / 3) * 100,
                      windowId: icon.app
                    };
                    addItem(browserItem);
                  });
                  setIcons(prev => prev.filter(i => !iconIds.includes(i.id)));
                  setSelection(new Set()); // Clear selection after moving
                }
              }
            }
          }
        }

        setDragOverTrash(false);
        setDragOverBin(false);
        setDragOverFolder(null);
        dragOverTargetRef.current = null;
        draggedIconIdsRef.current.clear();
        isDraggingRef.current = false;
      }, 50);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [icons, setIcons, selection, setSelection]);

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
      if (!unique.length) return prev;
      
      // Calculate positions for new items, stacking from top-left in a 3-column grid
      const existingPositions = prev.map(i => ({ x: i.x || 0, y: i.y || 0 }));
      const newItemsWithPositions = unique.map((icon) => {
        // Find first available position in grid starting from top-left
        let found = false;
        let x = 20;
        let y = 20;
        
        // Search grid row by row, column by column
        for (let row = 0; row < 20 && !found; row++) {
          for (let col = 0; col < 3 && !found; col++) {
            x = 20 + col * 100;
            y = 20 + row * 100;
            // Check if this position is available (not overlapping)
            if (!existingPositions.some(p => Math.abs(p.x - x) < 96 && Math.abs(p.y - y) < 96)) {
              found = true;
            }
          }
        }
        
        // Mark this position as taken
        existingPositions.push({ x, y });
        return { ...icon, x, y };
      });
      
      return [...newItemsWithPositions, ...prev];
    });
  }

  function clampToDesktop(x: number, y: number): { x: number; y: number } {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    // Detect current CSS transform scale applied to the embedded screen (if any)
    const screenEl = desktopRef.current?.closest('.embedded-screen') as HTMLElement | null;
    const screenRect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = screenRect && cssW ? screenRect.width / cssW : 1;
    const scaleY = screenRect && cssH ? screenRect.height / cssH : 1;

    // Convert the (possibly scaled) desktop rect back into unscaled CSS pixels
    const width = (deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280)) / (scaleX || 1);
    // Subtract menubar height (28px) from viewport when desktop rect is unavailable
    const height = (deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772)) / (scaleY || 1);
    // Trash icon is 96px wide, so ensure it fits with padding
    const maxX = Math.max(8, width - 96 - 8);
    const maxY = Math.max(0, height - 96 - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(0, y), maxY) };
  }

  function restoreIcon(id: string, at?: { x: number; y: number }) {
    setTrash((t) => {
      const idx = t.findIndex((it) => it.id === id);
      if (idx < 0) return t;
      const item = t[idx];
      const pos = at ? clampToDesktop(at.x, at.y) : { x: item.x, y: item.y };
      setIcons((list) => {
        // Check if icon already exists on desktop
        const existingIdx = list.findIndex((i) => i.id === id);
        if (existingIdx >= 0) {
          // Update existing icon position
          return list.map((i) => i.id === id ? { ...i, x: pos.x, y: pos.y } : i);
        }
        // Add new icon
        return [{ ...item, x: pos.x, y: pos.y }, ...list];
      });
      const next = [...t];
      next.splice(idx, 1);
      return next;
    });
  }

  function restoreAll() {
    setTrash((t) => {
      if (t.length === 0) return t;
      setIcons((list) => {
        // Filter out any items that already exist on desktop to avoid duplicates
        const existingIds = new Set(list.map(i => i.id));
        const newItems = t.filter(item => !existingIds.has(item.id));
        return [...newItems, ...list];
      });
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
    // If clicking on empty desktop (no icon), restrict to Select All only
    const restricted = !iconBtn;
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
    setCtxMenu({ x: left, y: top, restricted });
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
    const x = Math.max(8, width - 96 - 8);
    const y = Math.max(36, height - 96 - 8);
    return clampToDesktop(x, y);
  })();

  // Compute default bin position if not set; ensure it's inside the desktop container
  const defaultBinPos = binPos || (() => {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    const x = 8;
    const y = Math.max(36, height - 96 - 8);
    return clampToDesktop(x, y);
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
            <div className={`menu ${openMenu === "edit" ? "is-open" : ""}`} data-id="edit">
              <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "edit"} onClick={() => toggleMenu("edit")} onMouseEnter={() => trackHover("edit")}>
                Edit
              </button>
              <div className="menu-dropdown" role="menu">
                <a className="menu-entry" role="menuitem" href="mailto:stormbartlett@icloud.com" onClick={() => setOpenMenu(null)}>Email Storm…</a>
              </div>
            </div>
          )}

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

          <div className={`menu ${openMenu === "go" ? "is-open" : ""}`} data-id="go">
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "go"} onClick={() => toggleMenu("go")} onMouseEnter={() => trackHover("go")}>
              Go
            </button>
            <div className="menu-dropdown" role="menu">
              <a className="menu-entry" role="menuitem" href="https://github.com/stormbartlett" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>GitHub</a>
              <a className="menu-entry" role="menuitem" href="https://www.linkedin.com/in/stormbartlett/" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>LinkedIn</a>
              <a className="menu-entry" role="menuitem" href="https://www.youtube.com/@stormbartlett64" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>YouTube</a>
              {/* <a className="menu-entry" role="menuitem" href="/Storm_Bartlett_Resume.pdf" target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenu(null)}>Resume</a> */}
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
        
        {/* Shared draggable plane: items being dragged from folders */}
        {draggingFromFolder && (
          <div
            key={`dragging-${draggingFromFolder.item.id}`}
            style={{
              position: 'absolute',
              left: draggingFromFolder.x,
              top: draggingFromFolder.y,
              zIndex: 20000,
              pointerEvents: 'none'
            }}
          >
            <DesktopIcon
              icon={{
                id: draggingFromFolder.item.id,
                label: draggingFromFolder.item.label,
                app: draggingFromFolder.item.windowId || draggingFromFolder.item.id,
                x: 0,
                y: 0
              }}
              icons={[]}
              canDrag={false}
              setIcons={() => {}}
              selection={new Set()}
              setSelection={() => {}}
              onDbl={() => {}}
            />
          </div>
        )}

        {/* ============================================
            BLOG FOLDER ICON - TEMPORARILY HIDDEN
            To restore: Uncomment the block below
            ============================================ */}
        {/* Blog folder icon (draggable) */}
        {/* <button
          ref={trashRef}
          className={`desktop-icon trash-icon ${dragOverTrash ? 'is-over' : ''}`}
          data-id="trash"
          style={{ 
            position: 'absolute', 
            left: defaultTrashPos.x,
            top: defaultTrashPos.y,
          }}
          onDoubleClick={() => {
            // Only open window if we didn't drag
            if (!trashDragStateRef.current.hasDragged) {
              openWin('trash');
            }
            trashDragStateRef.current.hasDragged = false;
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            trashDragStateRef.current.hasDragged = false;
            const startX = e.clientX, startY = e.clientY;
            if (!desktopRef.current) return;
            
            // Compute current CSS transform scale of the embedded screen (like DesktopIcon does)
            const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
            const rect = screenEl?.getBoundingClientRect();
            const css = screenEl ? window.getComputedStyle(screenEl) : null;
            const cssW = css ? parseFloat(css.width || '0') : 0;
            const cssH = css ? parseFloat(css.height || '0') : 0;
            const scaleX = rect && cssW ? rect.width / cssW : 1;
            const scaleY = rect && cssH ? rect.height / cssH : 1;
            
            // Use the stored position as starting point (like DesktopIcon does with icon.x/y)
            const currentPos = trashPos || defaultTrashPos;
            const sx = currentPos.x;
            const sy = currentPos.y;
            let dragging = false;
            
            const move = (ev: PointerEvent) => {
              const dx = (ev.clientX - startX) / scaleX;
              const dy = (ev.clientY - startY) / scaleY;
              const dist = Math.hypot(dx, dy);
              
              if (!dragging) {
                if (dist < 4) return; // Threshold before starting drag
                dragging = true;
                trashDragStateRef.current.hasDragged = true;
                e.preventDefault(); // Only prevent default when actually dragging
                trashRef.current?.setPointerCapture(e.pointerId);
              }
              
              const nx = sx + dx;
              const ny = sy + dy;
              const c = clampToDesktop(nx, ny);
              setTrashPos({ x: c.x, y: c.y });
            };
            
            const up = (ev?: PointerEvent) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              if (dragging) {
                try { trashRef.current?.releasePointerCapture(e.pointerId); } catch {}
              }
            };
            
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          aria-label="Open Blog"
        >
          <div className="icon">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
              <use href="#icon-folder"></use>
            </svg>
          </div>
          <span className="icon-label">Blog</span>
        </button> */}

        {/* Trash bin icon (draggable) */}
        <button
          ref={binRef}
          className={`desktop-icon trash-icon ${trash.length > 0 ? 'has-items' : ''} ${dragOverBin ? 'is-over' : ''} ${selection.has("bin") ? "is-selected" : ""}`}
          data-id="bin"
          style={{ 
            position: 'absolute', 
            left: defaultBinPos.x,
            top: defaultBinPos.y,
          }}
          onDoubleClick={() => {
            // Only open window if we didn't drag
            if (!binDragStateRef.current.hasDragged) {
              openWin('bin');
            }
            binDragStateRef.current.hasDragged = false;
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            binDragStateRef.current.hasDragged = false;
            // Toggle selection (like DesktopIcon)
            const nextSel = selection.has("bin") ? new Set(selection) : new Set(["bin"]);
            setSelection(nextSel);
            const startX = e.clientX, startY = e.clientY;
            if (!desktopRef.current) return;
            
            // Compute current CSS transform scale of the embedded screen (like DesktopIcon does)
            const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
            const rect = screenEl?.getBoundingClientRect();
            const css = screenEl ? window.getComputedStyle(screenEl) : null;
            const cssW = css ? parseFloat(css.width || '0') : 0;
            const cssH = css ? parseFloat(css.height || '0') : 0;
            const scaleX = rect && cssW ? rect.width / cssW : 1;
            const scaleY = rect && cssH ? rect.height / cssH : 1;
            
            // Use the stored position as starting point (like DesktopIcon does with icon.x/y)
            const currentPos = binPos || defaultBinPos;
            const sx = currentPos.x;
            const sy = currentPos.y;
            let dragging = false;
            
            const move = (ev: PointerEvent) => {
              const dx = (ev.clientX - startX) / scaleX;
              const dy = (ev.clientY - startY) / scaleY;
              const dist = Math.hypot(dx, dy);
              
              if (!dragging) {
                if (dist < 4) return; // Threshold before starting drag
                dragging = true;
                binDragStateRef.current.hasDragged = true;
                e.preventDefault(); // Only prevent default when actually dragging
                binRef.current?.setPointerCapture(e.pointerId);
              }
              
              const nx = sx + dx;
              const ny = sy + dy;
              const c = clampToDesktop(nx, ny);
              setBinPos({ x: c.x, y: c.y });
            };
            
            const up = (ev?: PointerEvent) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              if (dragging) {
                try { binRef.current?.releasePointerCapture(e.pointerId); } catch {}
              }
            };
            
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onContextMenu={(e) => {
            if (isMobile) return;
            e.preventDefault();
            e.stopPropagation();
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
            setTrashCtxMenu({ x: left, y: top, id: 'bin' });
          }}
          aria-label="Trash"
        >
          <div className="icon">
            <img 
              src={trash.length > 0 ? "/trash-full.svg" : "/trash.svg"} 
              alt="" 
              width="48" 
              height="48"
              aria-hidden="true"
            />
          </div>
          <span className="icon-label">Trash</span>
        </button>

        <Window id="about" title="About Me" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={"Hi, I'm Storm Bartlett, a frontend-focused full‑stack engineer.\nMy main focus is on TypeScript, React/Next.js and backends like Node.js and PostgreSQL."} />
        </Window>
        <Window id="skills" title="Skills" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={"Front-End:\nReact (Hooks), Next.js, HTML5, CSS3/Sass, Tailwind\nAccessible/Responsive UI, Chrome extensions\n\nBack-End:\nNode.js (Express), Python (Django/Flask)\nREST APIs, JWT/OAuth, WebSockets\n\nDatabases:\nPostgreSQL, MongoDB, SQL, Firebase Firestore\n\nCloud & Tools:\nGit/GitHub, GitHub Actions (CI/CD), Docker, Linux, GCP\n"
            } />
        </Window>
        <Window id="experience" title="Experience" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor />
        </Window>
        <Window id="calculator" title="Calculator" windows={windows} frontWin={frontWin} closeWin={closeWin} className="calculator-window">
          <Calculator />
        </Window>
        <Window id="todo" title="TODO.txt" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TodoEditor initialText={`[ ] Ship something delightful
[ ] Add a spinning watch cursor (for dramatic effect)
[ ] Refill coffee ☕`} />
        </Window>
        <Window id="falling-sand" title="Falling Sand" windows={windows} frontWin={frontWin} closeWin={closeWin} className="falling-sand-window">
          <FallingSand />
        </Window>
        
        <Window id="trash" title="Blog" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <BlogBrowser 
            windows={windows} 
            openWin={openWin} 
            frontWin={frontWin} 
            closeWin={closeWin} 
            nextZ={nextZ} 
            setNextZ={setNextZ}
            desktopIcons={icons}
            setDesktopIcons={setIcons}
            desktopRef={desktopRef}
            testFolderItems={testFolderItems}
            setTestFolderItems={setTestFolderItems}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
            addItemRef={blogBrowserAddItemRef}
            darkMode={darkMode}
          />
        </Window>
        
        <Window id="bin" title="Trash" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <TrashBrowser 
            trash={trash}
            restoreIcon={restoreIcon}
            restoreAll={restoreAll}
            setTrash={setTrash}
            trashCtxMenu={trashCtxMenu}
            setTrashCtxMenu={setTrashCtxMenu}
            trashCtxRef={trashCtxRef}
            desktopIcons={icons}
            setDesktopIcons={setIcons}
            desktopRef={desktopRef}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
            darkMode={darkMode}
            openWin={openWin}
            windows={windows}
          />
        </Window>
        
        {/* Individual blog post windows */}
        <Window id="blog-recursion" title="Recursive Algorithms.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="recursion" />
        </Window>
        <Window id="blog-sorting" title="Mathematics of Sorting.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="sorting" />
        </Window>
        <Window id="blog-graphs" title="Graph Theory.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="graphs" />
        </Window>
        <Window id="test-folder" title="Test Folder" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <BlogBrowser 
            windows={windows} 
            openWin={openWin} 
            frontWin={frontWin} 
            closeWin={closeWin} 
            nextZ={nextZ} 
            setNextZ={setNextZ}
            desktopIcons={icons}
            setDesktopIcons={setIcons}
            desktopRef={desktopRef}
            darkMode={darkMode}
            folderId="test-folder"
            initialItems={testFolderItems}
            testFolderItems={testFolderItems}
            setTestFolderItems={setTestFolderItems}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
          />
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
            {ctxMenu.restricted ? (
              <button className="menu-entry" role="menuitem" onClick={() => { setSelection(new Set(icons.map(i => i.id))); setCtxMenu(null); }}>Select All</button>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
        {trashCtxMenu && trashCtxMenu.id === 'bin' && (
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
            {trash.length > 0 && (
              <>
                <button className="menu-entry" role="menuitem" onClick={() => { restoreAll(); setTrashCtxMenu(null); }}>Put Back All</button>
                <button className="menu-entry" role="menuitem" onClick={() => { setTrash([]); setTrashCtxMenu(null); }}>Empty Trash</button>
              </>
            )}
            {trash.length === 0 && (
              <div className="menu-entry" style={{ color: "var(--text)", opacity: 0.7, cursor: "default" }}>Trash is empty</div>
            )}
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
    // Compute desktop bounds in unscaled CSS pixels for proper clamping
    const desktopEl = ref.current?.closest('.desktop') as HTMLElement | null;
    const deskRect = desktopEl?.getBoundingClientRect();
    const deskWidth = (deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280)) / (sx || 1);
    const deskHeight = (deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772)) / (sy || 1);
    const maxX = Math.max(8, deskWidth - 96 - 8);
    const maxY = Math.max(0, deskHeight - 96 - 8);
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
        ref.current?.classList.add('dragging');
      }
      setIcons((list) => list.map((i) => {
        if (!nextSel.has(i.id)) return i;
        const s = starts.get(i.id) || { x: i.x, y: i.y };
        const nx = Math.min(maxX, Math.max(8, s.x + dx));
        const ny = Math.min(maxY, Math.max(0, s.y + dy));
        return { ...i, x: nx, y: ny };
      }));
      if (onDragMove) onDragMove(ev.clientX, ev.clientY);
    };
    const up = (ev?: PointerEvent) => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
      if (dragging) {
        try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
        ref.current?.classList.remove('dragging');
      }
      if (onDragEnd) onDragEnd(ev?.clientX ?? startX, ev?.clientY ?? startY, dragging);
    };
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
  };
  const spriteId = icon.id === "about"
    ? "icon-file-txt"
    : icon.id === "skills"
    ? "icon-file-txt"
    : icon.id === "experience"
    ? "icon-file-txt"
    : icon.id === "calculator"
    ? "icon-file-binary"
    : icon.id === "todo"
    ? "icon-file-txt"
    : icon.id === "falling-sand"
    ? "icon-file-binary"
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

function Window({ id, title, windows, frontWin, closeWin, children, className }: { id: string; title: string; windows: Record<string, Win>; frontWin: (id: string) => void; closeWin: (id: string) => void; children: React.ReactNode; className?: string; }) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const isMaximizedRef = useRef(false);
  const restoreStateRef = useRef<{ left: string; top: string; width: string; height: string } | null>(null);
  const w = windows[id];
  useEffect(() => {
    // Autofocus any ProseMirror instance inside when window opens or is brought to front
    const pm = divRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
    const cm = divRef.current?.querySelector('.cm-content') as HTMLElement | null;
    (pm || cm)?.focus();
  }, [w?.open, w?.z]);
  
  // Reset maximize state when window is closed
  useEffect(() => {
    if (!w?.open) {
      isMaximizedRef.current = false;
      restoreStateRef.current = null;
    }
  }, [w?.open]);
  
  if (!w?.open) return null;
  
  const toggleMaximize = () => {
    const el = divRef.current;
    if (!el) return;
    
    if (isMaximizedRef.current) {
      // Restore
      if (restoreStateRef.current) {
        el.style.left = restoreStateRef.current.left;
        el.style.top = restoreStateRef.current.top;
        el.style.width = restoreStateRef.current.width;
        el.style.height = restoreStateRef.current.height;
      }
      isMaximizedRef.current = false;
      restoreStateRef.current = null;
    } else {
      // Maximize
      const defaultWidth = className?.includes('blog-window') ? "600px" : 
                           className?.includes('calculator-window') ? "160px" : 
                           "420px";
      restoreStateRef.current = {
        left: el.style.left || "80px",
        top: el.style.top || "80px",
        width: el.style.width || defaultWidth,
        height: el.style.height || ""
      };
      
      const screenEl = el.closest('.embedded-screen') as HTMLElement | null;
      const desktopEl = el.closest('.desktop') as HTMLElement | null;
      if (screenEl) {
        const css = window.getComputedStyle(screenEl);
        const cssW = parseFloat(css.width || '0');
        const cssH = parseFloat(css.height || '0');
        
        // Use desktop's actual available height if available, otherwise calculate from screen
        let availableHeight = cssH - 28; // Screen height minus menubar
        let topPosition = "28px"; // Default: account for menubar if positioning relative to screen
        if (desktopEl) {
          const desktopCss = window.getComputedStyle(desktopEl);
          const desktopCssH = parseFloat(desktopCss.height || '0');
          // Desktop is positioned with inset: 28px 0 0 0, so windows inside desktop are relative to desktop
          // Position window at top of desktop (0px relative to desktop, which is already 28px from screen top)
          availableHeight = desktopCssH;
          topPosition = "0px";
        }
        
        el.style.left = "0px";
        el.style.top = topPosition;
        el.style.width = `${cssW}px`;
        el.style.height = `${availableHeight}px`;
      }
      isMaximizedRef.current = true;
    }
  };
  
  const down = (e: React.PointerEvent) => {
    const startX = e.clientX, startY = e.clientY;
    // Compute current CSS transform scale of the embedded screen (same as DesktopIcon)
    const screenEl = divRef.current?.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const sx = rect && cssW ? rect.width / cssW : 1;
    const sy = rect && cssH ? rect.height / cssH : 1;
    
    // Get initial window position - read from computed style, which is already in CSS pixels
    const computedStyle = divRef.current ? window.getComputedStyle(divRef.current) : null;
    const windowStartX = computedStyle ? parseFloat(computedStyle.left) || 80 : 80;
    const windowStartY = computedStyle ? parseFloat(computedStyle.top) || 80 : 80;
    
    frontWin(id);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / sx, dy = (ev.clientY - startY) / sy;
      if (divRef.current && !isMaximizedRef.current) {
        // Allow full-screen movement - windows can move anywhere
        divRef.current.style.left = `${windowStartX + dx}px`;
        divRef.current.style.top = `${windowStartY + dy}px`;
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
  };
  
  const handleResize = (e: React.PointerEvent, direction: string) => {
    if (isMaximizedRef.current) return; // Don't allow resizing when maximized
    e.preventDefault();
    e.stopPropagation();
    frontWin(id);
    const startX = e.clientX;
    const startY = e.clientY;
    // Compute current CSS transform scale of the embedded screen (same as DesktopIcon)
    const screenEl = divRef.current?.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = rect && cssW ? rect.width / cssW : 1;
    const scaleY = rect && cssH ? rect.height / cssH : 1;
    const el = divRef.current;
    if (!el) return;
    
    const startLeft = parseInt(el.style.left || "80", 10);
    const startTop = parseInt(el.style.top || "80", 10);
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const minWidth = 200;
    const minHeight = 150;
    
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scaleX;
      const dy = (ev.clientY - startY) / scaleY;
      
      let newLeft = startLeft;
      let newTop = startTop;
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      if (direction.includes('e')) {
        newWidth = Math.max(minWidth, startWidth + dx);
      }
      if (direction.includes('w')) {
        newWidth = Math.max(minWidth, startWidth - dx);
        newLeft = startLeft + (startWidth - newWidth);
      }
      if (direction.includes('s')) {
        newHeight = Math.max(minHeight, startHeight + dy);
      }
      if (direction.includes('n')) {
        newHeight = Math.max(minHeight, startHeight - dy);
        newTop = startTop + (startHeight - newHeight);
      }
      
      if (el) {
        // Allow full-screen movement - windows can be positioned anywhere
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        el.style.width = `${newWidth}px`;
        el.style.height = `${newHeight}px`;
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
    <section className={`window ${className || ''}`} ref={divRef} style={{ zIndex: w.z as number, position: "absolute" }} data-app={id}>
      <header className="titlebar" onPointerDown={(e)=>{ e.preventDefault(); down(e); }} onDoubleClick={toggleMaximize}>
        <div className="title">{title}</div>
        <div className="window-controls"><button className="btn-close" onClick={() => closeWin(id)}>✕</button></div>
      </header>
      <div className="window-body">{children}</div>
      {/* Resize handles */}
      <div className="window-resize-handle nw" onPointerDown={(e) => handleResize(e, 'nw')} />
      <div className="window-resize-handle ne" onPointerDown={(e) => handleResize(e, 'ne')} />
      <div className="window-resize-handle sw" onPointerDown={(e) => handleResize(e, 'sw')} />
      <div className="window-resize-handle se" onPointerDown={(e) => handleResize(e, 'se')} />
      <div className="window-resize-handle n" onPointerDown={(e) => handleResize(e, 'n')} />
      <div className="window-resize-handle s" onPointerDown={(e) => handleResize(e, 's')} />
      <div className="window-resize-handle w" onPointerDown={(e) => handleResize(e, 'w')} />
      <div className="window-resize-handle e" onPointerDown={(e) => handleResize(e, 'e')} />
    </section>
  );
}

type BrowserItem = { id: string; label: string; type: "file" | "folder"; x: number; y: number; windowId?: string };

function TrashBrowser({
  trash,
  restoreIcon,
  restoreAll,
  setTrash,
  trashCtxMenu,
  setTrashCtxMenu,
  trashCtxRef,
  desktopIcons,
  setDesktopIcons,
  desktopRef,
  draggingFromFolder,
  setDraggingFromFolder,
  darkMode,
  openWin,
  windows
}: {
  trash: Icon[];
  restoreIcon: (id: string, at?: { x: number; y: number }) => void;
  restoreAll: () => void;
  setTrash: React.Dispatch<React.SetStateAction<Icon[]>>;
  trashCtxMenu: { x: number; y: number; id: string } | null;
  setTrashCtxMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; id: string } | null>>;
  trashCtxRef: React.RefObject<HTMLDivElement | null>;
  desktopIcons?: Icon[];
  setDesktopIcons?: React.Dispatch<React.SetStateAction<Icon[]>>;
  desktopRef?: React.RefObject<HTMLDivElement | null>;
  draggingFromFolder?: { item: BrowserItem; x: number; y: number; sourceFolder: string } | null;
  setDraggingFromFolder?: React.Dispatch<React.SetStateAction<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>>;
  darkMode: boolean;
  openWin: (id: string) => void;
  windows: Record<string, { id: string; open: boolean; z: number }>;
}) {
  const browserRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const dragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const desktopDraggedIconRef = useRef<string | null>(null);
  const clickTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const lastClickTimeRef = useRef<{ [key: string]: number }>({});
  const isDoubleClickRef = useRef<{ [key: string]: boolean }>({});

  // Convert trash items to BrowserItem format with positions
  const [trashItems, setTrashItems] = useState<BrowserItem[]>(() => {
    return trash.map((icon, idx) => ({
      id: icon.id,
      label: icon.label,
      type: "file" as const,
      x: icon.x || (20 + (idx % 3) * 100),
      y: icon.y || (20 + Math.floor(idx / 3) * 100),
      windowId: icon.app
    }));
  });

  // Sync trashItems when trash changes
  useEffect(() => {
    setTrashItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const newItems = trash.filter(icon => !existingIds.has(icon.id));
      
      // Update existing items and filter out removed ones
      const updated = prev.map(item => {
        const icon = trash.find(i => i.id === item.id);
        return icon ? { ...item, label: icon.label, windowId: icon.app, x: icon.x || item.x, y: icon.y || item.y } : item;
      }).filter(item => trash.some(i => i.id === item.id));
      
      // Add new items with their positions from trash (which should already have x, y set)
      newItems.forEach((icon) => {
        const existingPositions = updated.map(i => ({ x: i.x, y: i.y }));
        // Use position from icon if available, otherwise calculate
        let x = icon.x || 20;
        let y = icon.y || 20;
        
        // If no position set or position conflicts, find next available spot
        if (!icon.x || !icon.y || existingPositions.some(p => Math.abs(p.x - x) < 96 && Math.abs(p.y - y) < 96)) {
          // Find first available position in grid from top-left
          let found = false;
          for (let row = 0; row < 10 && !found; row++) {
            for (let col = 0; col < 3 && !found; col++) {
              x = 20 + col * 100;
              y = 20 + row * 100;
              if (!existingPositions.some(p => Math.abs(p.x - x) < 96 && Math.abs(p.y - y) < 96)) {
                found = true;
              }
            }
          }
        }
        
        updated.push({
          id: icon.id,
          label: icon.label,
          type: "file" as const,
          x,
          y,
          windowId: icon.app
        });
      });
      
      return updated;
    });
  }, [trash]);

  // Helper to convert browser coordinates to desktop coordinates
  const browserToDesktopCoords = (browserX: number, browserY: number, clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!browserRef.current || !desktopRef?.current) return null;
    const browserRect = browserRef.current.getBoundingClientRect();
    const desktopRect = desktopRef.current.getBoundingClientRect();
    const screenEl = browserRef.current.closest('.embedded-screen') as HTMLElement | null;
    const screenRect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = screenRect && cssW ? screenRect.width / cssW : 1;
    const scaleY = screenRect && cssH ? screenRect.height / cssH : 1;
    
    const desktopX = (clientX - desktopRect.left) / scaleX - 48;
    const desktopY = (clientY - desktopRect.top) / scaleY - 24;
    
    return { x: Math.max(8, desktopX), y: Math.max(0, desktopY) };
  };

  const handleItemPointerDown = (itemId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    
    const item = trashItems.find(i => i.id === itemId);
    if (!item || !setDraggingFromFolder) return;
    
    const nextSel = selection.has(itemId) ? new Set(selection) : new Set([itemId]);
    setSelection(nextSel);
    
    dragStateRef.current.hasDragged = false;
    setDraggedItem(itemId);
    const startX = e.clientX, startY = e.clientY;
    const startItemX = item.x;
    const startItemY = item.y;
    
    const initialDesktopCoords = browserToDesktopCoords(item.x, item.y, e.clientX, e.clientY);
    if (!initialDesktopCoords) return;
    
    let dragging = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dist = Math.hypot(dx, dy);
      
      if (!dragging && dist > 4) {
        dragging = true;
        dragStateRef.current.hasDragged = true;
        e.preventDefault();
      }
      
      if (dragging) {
        if (browserRef.current) {
          const browserRect = browserRef.current.getBoundingClientRect();
          const browserX = ev.clientX - browserRect.left;
          const browserY = ev.clientY - browserRect.top;
          const isOutsideBrowser = browserX < 0 || browserX > browserRect.width || browserY < 0 || browserY > browserRect.height;
          
          const newX = startItemX + dx;
          const newY = startItemY + dy;
          
          if (isOutsideBrowser && setDraggingFromFolder) {
            const desktopCoords = browserToDesktopCoords(item.x, item.y, ev.clientX, ev.clientY);
            if (desktopCoords) {
              setDraggingFromFolder(prev => prev ? {
                ...prev,
                x: desktopCoords.x,
                y: desktopCoords.y
              } : {
                item,
                x: desktopCoords.x,
                y: desktopCoords.y,
                sourceFolder: "bin"
              });
            }
          } else if (setDraggingFromFolder) {
            setDraggingFromFolder(null);
          }
          
          const clampedX = Math.max(10, Math.min(browserRect.width - 100, newX));
          const clampedY = Math.max(10, Math.min(browserRect.height - 100, newY));
          setTrashItems(list => list.map(i => i.id === itemId ? { ...i, x: clampedX, y: clampedY } : i));
        }
      }
    };

    const up = (ev?: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      
      if (dragging && ev && setDraggingFromFolder) {
        const browserRect = browserRef.current?.getBoundingClientRect();
        const isWithinBrowser = browserRect && 
          ev.clientX >= browserRect.left && 
          ev.clientX <= browserRect.right && 
          ev.clientY >= browserRect.top && 
          ev.clientY <= browserRect.bottom;
        
        const desktopCoords = browserToDesktopCoords(item.x, item.y, ev.clientX, ev.clientY);
        
        if (isWithinBrowser) {
          // Update position within trash
          if (browserRef.current) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const newX = Math.max(10, Math.min(browserRect.width - 100, startItemX + dx));
            const newY = Math.max(10, Math.min(browserRect.height - 100, startItemY + dy));
            setTrashItems(list => list.map(i => i.id === itemId ? { ...i, x: newX, y: newY } : i));
            // Update trash state with new position
            setTrash(prev => prev.map(i => i.id === itemId ? { ...i, x: newX, y: newY } : i));
          }
        } else if (desktopCoords && setDesktopIcons && !isDoubleClickRef.current[itemId]) {
          // Dropped on desktop - restore icon (but not if it was a double-click)
          restoreIcon(itemId, desktopCoords);
          setTrashItems(list => list.filter(i => i.id !== itemId));
        }
        
        setDraggingFromFolder(null);
      } else if (setDraggingFromFolder) {
        setDraggingFromFolder(null);
      }
      
      setDraggedItem(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Handle desktop icon drag into trash browser
  useEffect(() => {
    if (!desktopRef?.current || !setDesktopIcons || !browserRef.current) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      const desktopIcon = document.querySelector('.desktop-icon.dragging') as HTMLElement;
      if (desktopIcon && browserRef.current) {
        desktopDraggedIconRef.current = desktopIcon.dataset.id || null;
      } else {
        desktopDraggedIconRef.current = null;
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      const draggedIconId = desktopDraggedIconRef.current;
      
      if (draggedIconId && browserRef.current && setDesktopIcons) {
        const rect = browserRef.current.getBoundingClientRect();
        const overBrowser = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (overBrowser) {
          const desktopIcon = desktopIcons?.find(i => i.id === draggedIconId);
          if (desktopIcon) {
            // Add to trash
            const browserX = e.clientX - rect.left - 48;
            const browserY = e.clientY - rect.top - 24;
            const newX = Math.max(10, browserX);
            const newY = Math.max(10, browserY);
            
            setTrash(prev => {
              if (prev.some(i => i.id === desktopIcon.id)) {
                return prev.map(i => i.id === desktopIcon.id ? { ...i, x: newX, y: newY } : i);
              }
              return [...prev, {
                id: desktopIcon.id,
                label: desktopIcon.label,
                app: desktopIcon.app,
                x: newX,
                y: newY
              }];
            });
            
            // Remove from desktop
            setDesktopIcons(prev => prev.filter(i => i.id !== draggedIconId));
          }
        }
      }
      
      desktopDraggedIconRef.current = null;
    };
    
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [desktopRef, setDesktopIcons, desktopIcons, setTrash]);

  // Close trash context menu when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (trashCtxRef.current && !trashCtxRef.current.contains(e.target as Node)) {
        setTrashCtxMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [trashCtxRef, setTrashCtxMenu]);

  return (
    <div 
      className="blog-browser" 
      ref={browserRef}
      onPointerDown={(e) => {
        if (e.target === browserRef.current) {
          setSelection(new Set());
        }
      }}
    >
      {trashItems.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text)' }}>
          <p style={{ color: '#ffffff' }}>Trash is empty</p>
        </div>
      ) : (
        trashItems.map((item) => {
          const isDraggingToDesktop = draggedItem === item.id && draggingFromFolder?.item.id === item.id && draggingFromFolder?.sourceFolder === "bin";
          
          return (
            <button
              key={item.id}
              className={`browser-icon ${selection.has(item.id) ? 'is-selected' : ''} ${draggedItem === item.id ? 'dragging' : ''}`}
              style={{ 
                position: 'absolute', 
                left: item.x, 
                top: item.y,
                opacity: isDraggingToDesktop ? 0 : 1,
                pointerEvents: isDraggingToDesktop ? 'none' : 'auto'
              }}
              onClick={() => {
                const now = Date.now();
                const lastClick = lastClickTimeRef.current[item.id] || 0;
                const timeSinceLastClick = now - lastClick;
                
                // If clicks are very close together, mark as potential double-click
                if (timeSinceLastClick < 300) {
                  isDoubleClickRef.current[item.id] = true;
                }
                lastClickTimeRef.current[item.id] = now;
                
                if (!dragStateRef.current.hasDragged) {
                  // If there's already a pending timeout, this is likely a double-click
                  // Let onDoubleClick handle it, but don't create another timeout
                  if (clickTimeoutRef.current[item.id]) {
                    return;
                  }
                  
                  // Delay the click action to allow double-click to cancel it
                  clickTimeoutRef.current[item.id] = setTimeout(() => {
                    // Only select if it wasn't a double-click
                    if (!isDoubleClickRef.current[item.id]) {
                      const nextSel = selection.has(item.id) ? new Set(selection) : new Set([item.id]);
                      setSelection(nextSel);
                    }
                    delete clickTimeoutRef.current[item.id];
                    isDoubleClickRef.current[item.id] = false;
                  }, 200);
                }
                dragStateRef.current.hasDragged = false;
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Mark as double-click to prevent restore on pointer up
                isDoubleClickRef.current[item.id] = true;
                
                // Cancel any pending click timeout
                if (clickTimeoutRef.current[item.id]) {
                  clearTimeout(clickTimeoutRef.current[item.id]);
                  delete clickTimeoutRef.current[item.id];
                }
                
                // Open the file/app if it has a valid windowId
                // Don't check hasDragged - double-click intent is clear even with small movements
                if (item.windowId && windows[item.windowId]) {
                  openWin(item.windowId);
                }
                dragStateRef.current.hasDragged = false;
                setSelection(new Set());
                
                // Clear the double-click flag after a delay
                setTimeout(() => {
                  isDoubleClickRef.current[item.id] = false;
                }, 300);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const browserRect = browserRef.current?.getBoundingClientRect();
                if (browserRect) {
                  setTrashCtxMenu({
                    x: e.clientX - browserRect.left,
                    y: e.clientY - browserRect.top,
                    id: item.id
                  });
                }
                if (!selection.has(item.id)) {
                  setSelection(new Set([item.id]));
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                handleItemPointerDown(item.id, e);
              }}
            >
              <div className="icon">
                <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
                  <use href="#icon-file-txt"></use>
                </svg>
              </div>
              <span className="icon-label">{item.label}</span>
            </button>
          );
        })
      )}
      
      {/* Trash context menu */}
      {trashCtxMenu && trashCtxMenu.id !== 'bin' && (
        <div
          ref={trashCtxRef}
          className="context-menu"
          style={{
            position: 'absolute',
            left: trashCtxMenu.x,
            top: trashCtxMenu.y,
            minWidth: 200,
            padding: 4,
            background: darkMode ? "var(--bg-window)" : "#ffffff",
            color: darkMode ? "#ffffff" : "#101010",
            border: '2px solid var(--border)',
            boxShadow: '0 4px 12px var(--shadow)',
            zIndex: 4000,
          }}
          role="menu"
        >
          <button className="menu-entry" role="menuitem" onClick={() => { 
            restoreIcon(trashCtxMenu.id); 
            setTrashCtxMenu(null); 
            setSelection(new Set());
          }}>Put Back</button>
          <button className="menu-entry" role="menuitem" onClick={() => { 
            restoreAll(); 
            setTrashCtxMenu(null); 
            setSelection(new Set());
          }}>Put Back All</button>
          <button className="menu-entry" role="menuitem" onClick={() => { 
            setTrash(prev => prev.filter(i => i.id !== trashCtxMenu.id));
            setTrashCtxMenu(null); 
            setSelection(new Set());
          }}>Delete Permanently</button>
        </div>
      )}
    </div>
  );
}

function BlogBrowser({ 
  windows, 
  openWin, 
  frontWin, 
  closeWin, 
  nextZ, 
  setNextZ,
  desktopIcons,
  setDesktopIcons,
  desktopRef,
  folderId = "blog",
  initialItems,
  testFolderItems: externalTestFolderItems,
  setTestFolderItems: setExternalTestFolderItems,
  draggingFromFolder,
  setDraggingFromFolder,
  addItemRef,
  darkMode
}: { 
  windows: Record<string, Win>; 
  openWin: (id: string) => void; 
  frontWin: (id: string) => void; 
  closeWin: (id: string) => void; 
  nextZ: number; 
  setNextZ: (fn: (z: number) => number) => void;
  desktopIcons?: Icon[];
  setDesktopIcons?: React.Dispatch<React.SetStateAction<Icon[]>>;
  desktopRef?: React.RefObject<HTMLDivElement | null>;
  folderId?: string;
  initialItems?: BrowserItem[];
  testFolderItems?: BrowserItem[];
  setTestFolderItems?: React.Dispatch<React.SetStateAction<BrowserItem[]>>;
  draggingFromFolder?: { item: BrowserItem; x: number; y: number; sourceFolder: string } | null;
  setDraggingFromFolder?: React.Dispatch<React.SetStateAction<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>>;
  addItemRef?: React.MutableRefObject<((item: BrowserItem) => void) | null>;
  darkMode: boolean;
}) {
  const browserRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<BrowserItem[]>(initialItems || [
    { id: "blog-recursion", label: "Recursive Algorithms.txt", type: "file", x: 20, y: 20, windowId: "blog-recursion" },
    { id: "blog-sorting", label: "Mathematics of Sorting.txt", type: "file", x: 120, y: 20, windowId: "blog-sorting" },
    { id: "blog-graphs", label: "Graph Theory.txt", type: "file", x: 220, y: 20, windowId: "blog-graphs" },
    { id: "test-folder", label: "Test Folder", type: "folder", x: 20, y: 120 },
  ]);

  // Expose function to add items from outside (e.g., when dragging onto folder icon)
  useEffect(() => {
    if (addItemRef) {
      addItemRef.current = (item: BrowserItem) => {
        setItems(prev => {
          // Check if item already exists
          if (prev.some(i => i.id === item.id)) {
            return prev.map(i => i.id === item.id ? item : i);
          }
          // Find a position that doesn't overlap
          const existingPositions = prev.map(i => ({ x: i.x, y: i.y }));
          let x = item.x || 20;
          let y = item.y || 20;
          while (existingPositions.some(p => Math.abs(p.x - x) < 96 && Math.abs(p.y - y) < 96)) {
            x += 100;
            if (x > 500) {
              x = 20;
              y += 100;
            }
          }
          return [...prev, { ...item, x, y }];
        });
      };
    }
    return () => {
      if (addItemRef) {
        addItemRef.current = null;
      }
    };
  }, [addItemRef]);
  // Use external testFolderItems if provided (for shared state), otherwise local state
  const [localTestFolderItems, setLocalTestFolderItems] = useState<BrowserItem[]>([]);
  const testFolderItems = externalTestFolderItems !== undefined ? externalTestFolderItems : localTestFolderItems;
  const setTestFolderItems = setExternalTestFolderItems || setLocalTestFolderItems;
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState(false);
  const dragOverFolderRef = useRef(false);
  const dragOverTargetFolderRef = useRef<string | null>(null);
  const dragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const desktopDragOverTargetRef = useRef<string | null>(null);
  const desktopDraggedIconRef = useRef<string | null>(null);
  const [browserCtxMenu, setBrowserCtxMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const browserCtxMenuRef = useRef<HTMLDivElement | null>(null);

  // Helper to convert browser coordinates to desktop coordinates
  const browserToDesktopCoords = (browserX: number, browserY: number, clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!browserRef.current || !desktopRef?.current) return null;
    const browserRect = browserRef.current.getBoundingClientRect();
    const desktopRect = desktopRef.current.getBoundingClientRect();
    const screenEl = browserRef.current.closest('.embedded-screen') as HTMLElement | null;
    const screenRect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = screenRect && cssW ? screenRect.width / cssW : 1;
    const scaleY = screenRect && cssH ? screenRect.height / cssH : 1;
    
    // Calculate desktop position from client coordinates
    const desktopX = (clientX - desktopRect.left) / scaleX - 48;
    const desktopY = (clientY - desktopRect.top) / scaleY - 24;
    
    return { x: Math.max(8, desktopX), y: Math.max(0, desktopY) };
  };

  // Helper to find which window is on top at a given point
  const getTopWindowAtPoint = (clientX: number, clientY: number): string | null => {
    const elementAtPoint = document.elementFromPoint(clientX, clientY);
    if (!elementAtPoint) return null;
    
    // Find the window element
    const windowEl = elementAtPoint.closest('.window') as HTMLElement | null;
    if (!windowEl) return null;
    
    const windowId = windowEl.dataset.app;
    return windowId || null;
  };

  const handleItemPointerDown = (itemId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    
    // Get the item first - don't call setState inside setItems callback
    const item = items.find(i => i.id === itemId);
    if (!item || !setDraggingFromFolder) return;
    
    // Handle selection (like desktop)
    const nextSel = selection.has(itemId) ? new Set(selection) : new Set([itemId]);
    setSelection(nextSel);
    
    dragStateRef.current.hasDragged = false;
    setDraggedItem(itemId);
    const startX = e.clientX, startY = e.clientY;
    
    // Store the starting position of the item
    const startItemX = item.x;
    const startItemY = item.y;
    
    // Convert initial browser position to desktop coordinates
    const initialDesktopCoords = browserToDesktopCoords(item.x, item.y, e.clientX, e.clientY);
    if (!initialDesktopCoords) return;
    
    let dragging = false;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const dist = Math.hypot(dx, dy);
        
        if (!dragging && dist > 4) {
          dragging = true;
          dragStateRef.current.hasDragged = true;
          e.preventDefault();
        }
        
        if (dragging) {
          // Update browser item position during drag so it follows cursor
          if (browserRef.current) {
            const browserRect = browserRef.current.getBoundingClientRect();
            const browserX = ev.clientX - browserRect.left;
            const browserY = ev.clientY - browserRect.top;
            
            // Check if dragging outside browser bounds
            const isOutsideBrowser = browserX < 0 || browserX > browserRect.width || browserY < 0 || browserY > browserRect.height;
            
            // Calculate new position based on delta from start (maintains grab point)
            const newX = startItemX + dx;
            const newY = startItemY + dy;
            
            // Only show desktop ghost if dragging outside browser
            if (isOutsideBrowser && setDraggingFromFolder) {
              // Start/update dragging on desktop plane
              const desktopCoords = browserToDesktopCoords(item.x, item.y, ev.clientX, ev.clientY);
              if (desktopCoords) {
              setDraggingFromFolder(prev => prev ? {
                ...prev,
                  x: desktopCoords.x,
                  y: desktopCoords.y
              } : {
                item,
                  x: desktopCoords.x,
                  y: desktopCoords.y,
                sourceFolder: folderId
              });
              }
            } else if (setDraggingFromFolder) {
              // Clear desktop ghost if back inside browser
              setDraggingFromFolder(null);
            }
            
            // Always update item position in browser during drag (whether inside or outside)
            // Clamp to browser bounds
            const clampedX = Math.max(10, Math.min(browserRect.width - 100, newX));
            const clampedY = Math.max(10, Math.min(browserRect.height - 100, newY));
            setItems(list => list.map(i => i.id === itemId ? { ...i, x: clampedX, y: clampedY } : i));
            
            // Check if over folder within browser window
            dragOverTargetFolderRef.current = null;
            if (browserX >= 0 && browserX <= browserRect.width && browserY >= 0 && browserY <= browserRect.height) {
              const folders = items.filter(i => i.type === "folder" && i.id !== itemId);
              for (const folder of folders) {
                const folderRect = { 
                  left: folder.x, 
                  top: folder.y, 
                  right: folder.x + 96, 
                  bottom: folder.y + 96 
                };
                const overFolder = browserX >= folderRect.left && browserX <= folderRect.right && 
                                  browserY >= folderRect.top && browserY <= folderRect.bottom;
                if (overFolder) {
                  dragOverTargetFolderRef.current = folder.id;
                  dragOverFolderRef.current = true;
                  setDragOverFolder(true);
                  break;
                }
              }
            }
            
            if (!dragOverTargetFolderRef.current) {
              dragOverFolderRef.current = false;
              setDragOverFolder(false);
            }
          }
        }
      };

      const up = (ev?: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        
        if (dragging && ev && setDraggingFromFolder) {
          // Check if dropped within browser bounds first (more reliable than elementFromPoint)
          const browserRect = browserRef.current?.getBoundingClientRect();
          const isWithinBrowser = browserRect && 
            ev.clientX >= browserRect.left && 
            ev.clientX <= browserRect.right && 
            ev.clientY >= browserRect.top && 
            ev.clientY <= browserRect.bottom;
          
          const desktopCoords = browserToDesktopCoords(item.x, item.y, ev.clientX, ev.clientY);
          
          // Check if dropped within the same folder window
          if (isWithinBrowser) {
            if (dragOverTargetFolderRef.current && dragOverFolderRef.current) {
              // Dropped on a folder icon
              const targetFolderId = dragOverTargetFolderRef.current;
              
              // Only move to nested folder if it's different from current folder
              // Check: if source folder equals target folder, don't move (just update position)
              if (targetFolderId === "test-folder" && item.type === "file" && folderId !== "test-folder") {
                // Moving to test-folder from another folder
                setTestFolderItems(prev => [...prev, { 
                  ...item, 
                  x: 20 + (prev.length % 3) * 100, 
                  y: 20 + Math.floor(prev.length / 3) * 100 
                }]);
                setItems(list => list.filter(i => i.id !== itemId));
              }
              // If dragging to the same folder icon (folderId === targetFolderId), do nothing - just update position below
            }
            
            // Always update position if dropped within same folder window (whether on folder icon or not)
            if (browserRef.current) {
              const dx = ev.clientX - startX;
              const dy = ev.clientY - startY;
              const newX = Math.max(10, Math.min(browserRect.width - 100, startItemX + dx));
              const newY = Math.max(10, Math.min(browserRect.height - 100, startItemY + dy));
              setItems(list => list.map(i => i.id === itemId ? { ...i, x: newX, y: newY } : i));
            }
          } else if (desktopCoords && setDesktopIcons) {
            // Dropped on desktop - add to desktop icons
            const existingIcon = desktopIcons?.find(i => i.id === item.id);
            if (!existingIcon) {
              setDesktopIcons(prev => {
                if (prev.some(i => i.id === item.id)) {
                  return prev.map(i => 
                    i.id === item.id 
                      ? { ...i, x: desktopCoords.x, y: desktopCoords.y }
                      : i
                  );
                }
                if (item.type === "file") {
                  return [...prev, {
                    id: item.id,
                    label: item.label,
                    app: item.windowId || item.id,
                    x: desktopCoords.x,
                    y: desktopCoords.y
                  }];
                } else if (item.type === "folder") {
                  return [...prev, {
                    id: item.id,
                    label: item.label,
                    app: item.id,
                    x: desktopCoords.x,
                    y: desktopCoords.y
                  }];
                }
                return prev;
              });
            } else {
              setDesktopIcons(prev => prev.map(i => 
                i.id === item.id 
                  ? { ...i, x: desktopCoords.x, y: desktopCoords.y }
                  : i
              ));
            }
            setItems(list => list.filter(i => i.id !== itemId));
          }
          
          setDraggingFromFolder(null);
        } else if (setDraggingFromFolder) {
          setDraggingFromFolder(null);
        }
        
        setDraggedItem(null);
        dragOverTargetFolderRef.current = null;
        dragOverFolderRef.current = false;
        setDragOverFolder(false);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
  };

  // Expose function to add items from desktop
  const addItemFromDesktop = useRef<((item: BrowserItem) => void) | null>(null);
  addItemFromDesktop.current = (item: BrowserItem) => {
    setItems(prev => [...prev, item]);
  };
  
  // Close browser context menu when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (browserCtxMenuRef.current && !browserCtxMenuRef.current.contains(e.target as Node)) {
        setBrowserCtxMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  // Handle desktop icon drag into browser - check on pointer move
  useEffect(() => {
    if (!desktopRef?.current || !setDesktopIcons || !browserRef.current) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      // Check if a desktop icon is being dragged
      const desktopIcon = document.querySelector('.desktop-icon.dragging') as HTMLElement;
      if (desktopIcon && browserRef.current) {
        desktopDraggedIconRef.current = desktopIcon.dataset.id || null;
        
        const rect = browserRef.current.getBoundingClientRect();
        const overBrowser = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (overBrowser) {
          // Check if over any folder
          desktopDragOverTargetRef.current = null;
          setItems(currentItems => {
            const folders = currentItems.filter(i => i.type === "folder");
            for (const folder of folders) {
              const folderRect = { 
                left: folder.x + rect.left, 
                top: folder.y + rect.top, 
                right: folder.x + rect.left + 96, 
                bottom: folder.y + rect.top + 96 
              };
              const overFolder = e.clientX >= folderRect.left && e.clientX <= folderRect.right &&
                                e.clientY >= folderRect.top && e.clientY <= folderRect.bottom;
              if (overFolder) {
                desktopDragOverTargetRef.current = folder.id;
                dragOverFolderRef.current = true;
                  setDragOverFolder(true);
                return currentItems;
              }
            }
            dragOverFolderRef.current = false;
              setDragOverFolder(false);
            return currentItems;
          });
        } else {
          desktopDragOverTargetRef.current = null;
          dragOverFolderRef.current = false;
            setDragOverFolder(false);
        }
      } else {
        desktopDraggedIconRef.current = null;
        desktopDragOverTargetRef.current = null;
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      // Read refs at the moment of drop
      const draggedIconId = desktopDraggedIconRef.current;
      const dragOverTarget = desktopDragOverTargetRef.current;
      const wasOverFolder = dragOverFolderRef.current;
      
      if (draggedIconId && browserRef.current && setDesktopIcons) {
        const rect = browserRef.current.getBoundingClientRect();
        const overBrowser = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (overBrowser) {
          const desktopIcon = desktopIcons?.find(i => i.id === draggedIconId);
          if (desktopIcon) {
            // Check if dropped on a folder FIRST
            if (dragOverTarget && wasOverFolder) {
              if (dragOverTarget === "test-folder") {
                // Add to test folder
                setTestFolderItems(prev => {
                  const newItems = [...prev, {
                    id: desktopIcon.id,
                    label: desktopIcon.label,
                    type: "file" as const,
                    x: 20 + (prev.length % 3) * 100,
                    y: 20 + Math.floor(prev.length / 3) * 100,
                    windowId: desktopIcon.app
                  }];
                  return newItems;
                });
                // Remove from desktop
                setDesktopIcons(prev => prev.filter(i => i.id !== draggedIconId));
                // Clear refs
                desktopDraggedIconRef.current = null;
                desktopDragOverTargetRef.current = null;
                  setDragOverFolder(false);
                  dragOverFolderRef.current = false;
                return;
              }
            }
            
            // Add to browser at drop position (only if NOT dropped on folder)
            // Check if item already exists in browser to avoid duplicates
            setItems(prev => {
              const exists = prev.some(i => i.id === desktopIcon.id);
              if (exists) {
                // Item already exists, just update position
                return prev.map(i => 
                  i.id === desktopIcon.id 
                    ? { ...i, x: Math.max(10, e.clientX - rect.left - 48), y: Math.max(10, e.clientY - rect.top - 24) }
                    : i
                );
              }
              // Add new item
            const browserX = e.clientX - rect.left - 48;
            const browserY = e.clientY - rect.top - 24;
              return [...prev, {
                id: desktopIcon.id,
                label: desktopIcon.label,
                    type: "file" as const,
                x: Math.max(10, browserX),
                y: Math.max(10, browserY),
                windowId: desktopIcon.app
              }];
            });
            setDesktopIcons(prev => prev.filter(i => i.id !== draggedIconId));
          }
        }
      }
      
      // Clear refs
      desktopDraggedIconRef.current = null;
      desktopDragOverTargetRef.current = null;
        setDragOverFolder(false);
        dragOverFolderRef.current = false;
    };
    
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [desktopRef, setDesktopIcons, desktopIcons, setItems, setTestFolderItems]);

  return (
    <div 
      className="blog-browser" 
      ref={browserRef}
      onPointerDown={(e) => {
        // Clear selection when clicking on empty space
        if (e.target === browserRef.current) {
          setSelection(new Set());
        }
      }}
    >
      {items.map((item) => {
        // Only hide browser icon when dragging outside the folder (to desktop)
        // When dragging within the same folder, keep it visible
        const isDraggingToDesktop = draggedItem === item.id && draggingFromFolder?.item.id === item.id && draggingFromFolder?.sourceFolder === folderId;
        const isDraggingWithinFolder = draggedItem === item.id && !draggingFromFolder;
        
        return (
        <button
          key={item.id}
          className={`browser-icon ${item.type} ${selection.has(item.id) ? 'is-selected' : ''} ${draggedItem === item.id ? 'dragging' : ''} ${item.type === 'folder' && dragOverFolder ? 'drag-over' : ''}`}
          style={{ 
            position: 'absolute', 
            left: item.x, 
            top: item.y,
            opacity: isDraggingToDesktop ? 0 : 1,
            pointerEvents: isDraggingToDesktop ? 'none' : 'auto'
          }}
          onClick={(e) => {
            // Only select on single click, don't open
            if (!dragStateRef.current.hasDragged) {
              const nextSel = selection.has(item.id) ? new Set(selection) : new Set([item.id]);
              setSelection(nextSel);
            }
            dragStateRef.current.hasDragged = false;
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Cancel any pending drag
            dragStateRef.current.hasDragged = false;
            if (setDraggingFromFolder) {
              setDraggingFromFolder(null);
            }
            setDraggedItem(null);
            
            if (item.type === "file" && item.windowId) {
              openWin(item.windowId);
              setNextZ((z) => z + 1);
            } else if (item.type === "folder") {
              // Open folder window - use item.id as the window ID
              openWin(item.id);
              setNextZ((z) => z + 1);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Don't show context menu if dragging
            if (dragStateRef.current.hasDragged) return;
            
            if (!browserRef.current) return;
            const browserRect = browserRef.current.getBoundingClientRect();
            setBrowserCtxMenu({
              x: e.clientX - browserRect.left,
              y: e.clientY - browserRect.top,
              itemId: item.id
            });
            
            // Select item if not already selected
            if (!selection.has(item.id)) {
              setSelection(new Set([item.id]));
            }
          }}
          onPointerDown={(e) => {
            // Don't start drag on right-click
            if (e.button !== 0) return;
            handleItemPointerDown(item.id, e);
          }}
        >
          <div className="icon">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
              <use href={item.type === "folder" ? "#icon-folder" : "#icon-file-txt"}></use>
            </svg>
          </div>
          <span className="icon-label">{item.label}</span>
          {item.type === "folder" && item.id === "test-folder" && testFolderItems.length > 0 && (
            <span className="folder-count" aria-label={`${testFolderItems.length} items`}>{testFolderItems.length}</span>
          )}
        </button>
        );
      })}
      
      {/* Browser context menu */}
      {browserCtxMenu && (
        <div
          ref={browserCtxMenuRef}
          className="context-menu"
          style={{
            position: 'absolute',
            left: browserCtxMenu.x,
            top: browserCtxMenu.y,
            minWidth: 200,
            padding: 4,
            background: darkMode ? "var(--bg-window)" : "#ffffff",
            color: darkMode ? "#ffffff" : "#101010",
            border: '2px solid var(--border)',
            boxShadow: '0 4px 12px var(--shadow)',
            zIndex: 4000,
          }}
          role="menu"
        >
          <button className="menu-entry" role="menuitem" onClick={() => {
            const item = items.find(i => i.id === browserCtxMenu.itemId);
            if (item) {
              if (item.type === "file" && item.windowId) {
                openWin(item.windowId);
                setNextZ((z) => z + 1);
              } else if (item.type === "folder") {
                openWin(item.id);
                setNextZ((z) => z + 1);
              }
            }
            setBrowserCtxMenu(null);
          }}>Open</button>
          <button className="menu-entry" role="menuitem" onClick={() => {
            setItems(list => list.filter(i => i.id !== browserCtxMenu.itemId));
            setBrowserCtxMenu(null);
            setSelection(new Set());
          }}>Delete</button>
        </div>
      )}
    </div>
  );
}

  
function BlogPostContent({ postId }: { postId: "recursion" | "sorting" | "graphs" }) {
  const posts = {
    recursion: {
      title: "Understanding Recursive Algorithms",
      meta: "Published: March 15, 2024",
      content: (
        <>
          <p>Recursion is one of the most elegant problem-solving techniques in computer science. When we define a function that calls itself, we&apos;re leveraging the power of mathematical induction.</p>
          <p>The classic example is the Fibonacci sequence, defined as:</p>
          <div className="equation">
            F(n) = F(n-1) + F(n-2)
          </div>
          <p>where F(0) = 0 and F(1) = 1.</p>
          <p>In functional programming, this translates beautifully:</p>
          <pre className="code-block">{`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`}</pre>
          <p>The time complexity follows the golden ratio: O(φⁿ) where φ ≈ 1.618. This exponential growth makes naive recursion impractical for large n, but memoization can reduce it to O(n).</p>
        </>
      ),
    },
    sorting: {
      title: "The Mathematics of Sorting",
      meta: "Published: February 28, 2024",
      content: (
        <>
          <p>Sorting algorithms reveal fundamental limits in computation. The comparison-based sorting lower bound tells us that any comparison sort must perform at least Ω(n log n) comparisons in the worst case.</p>
          <p>This comes from information theory. With n! possible permutations, we need at least:</p>
          <div className="equation">
            log₂(n!) ≈ n log₂(n) - n log₂(e)
          </div>
          <p>bits of information to distinguish between all permutations.</p>
          <p>For merge sort, the recurrence relation is:</p>
          <div className="equation">
            T(n) = 2T(n/2) + O(n)
          </div>
          <p>Solving this using the master theorem gives us T(n) = O(n log n), which matches the theoretical lower bound. Quicksort achieves O(n log n) average case, but its worst case is O(n²) due to poor pivot selection.</p>
          <p>The optimal sorting algorithm depends on your data distribution. For nearly-sorted data, insertion sort&apos;s O(n) best case makes it ideal.</p>
        </>
      ),
    },
    graphs: {
      title: "Graph Theory and Network Analysis",
      meta: "Published: January 10, 2024",
      content: (
        <>
          <p>Graphs model relationships in everything from social networks to routing algorithms. The shortest path problem is fundamental to network analysis.</p>
          <p>Dijkstra&apos;s algorithm finds the shortest path from a source vertex s to all other vertices in a weighted graph. The key insight is maintaining a priority queue of vertices ordered by their current shortest distance estimate.</p>
          <p>The algorithm&apos;s time complexity is O((V + E) log V) using a binary heap, where V is vertices and E is edges. For dense graphs, this becomes O(V² log V).</p>
          <p>The Bellman-Ford algorithm handles negative edge weights but has higher complexity: O(VE). It&apos;s based on the relaxation principle:</p>
          <div className="equation">
            d[v] = min(d[v], d[u] + w(u,v))
          </div>
          <p>where d[v] is the shortest distance to vertex v, and w(u,v) is the weight of edge (u,v).</p>
          <p>For unweighted graphs, breadth-first search gives us the shortest path in O(V + E) time—optimal for this case. The BFS tree structure reveals interesting properties about graph connectivity.</p>
          <p>Network flow problems extend these concepts. The max-flow min-cut theorem states that the maximum flow equals the minimum cut capacity, a beautiful duality result connecting optimization and graph structure.</p>
        </>
      ),
    },
  };

  const post = posts[postId];
  return (
    <div className="blog-posts">
      <article className="blog-post">
        <h2 className="blog-title">{post.title}</h2>
        <div className="blog-meta">{post.meta}</div>
        <div className="blog-content">{post.content}</div>
      </article>
    </div>
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
  const maxY = Math.max(0, height - 200);
  return merged.map((i) => ({
    ...i,
    x: Math.min(Math.max(8, i.x), maxX),
    y: Math.min(Math.max(0, i.y), maxY),
  }));
}


