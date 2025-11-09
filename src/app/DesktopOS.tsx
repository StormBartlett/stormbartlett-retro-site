"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import TiptapEditor from "./TiptapEditor";
import FallingSand from "./FallingSand";
import { useFullscreen } from "./FullscreenContext";

type Icon = { id: string; label: string; app: string; x: number; y: number };
type Win = { id: string; open: boolean; z: number };

const baseIcons: Icon[] = [
  { id: "about", label: "About Me.txt", app: "about", x: 40, y: 64 },
  { id: "skills", label: "Skills.txt", app: "skills", x: 160, y: 64 },
  { id: "experience", label: "Experience.txt", app: "experience", x: 280, y: 64 },
  { id: "calculator", label: "Calculator.txt", app: "calculator", x: 400, y: 64 },
  { id: "readme", label: "README.txt", app: "readme", x: 520, y: 64 },
  { id: "todo", label: "TODO.txt", app: "todo", x: 640, y: 64 },
  { id: "blog", label: "Blog", app: "blog", x: 760, y: 64 },
  { id: "falling-sand", label: "Falling Sand", app: "falling-sand", x: 40, y: 160 },
];

export default function DesktopOS({ embedded = false, mobileVariant }: { embedded?: boolean; mobileVariant?: "portrait" | "landscape" }) {
  const isMobile = !!mobileVariant;
  const isMobilePortrait = mobileVariant === "portrait";
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const initialIcons: Icon[] = baseIcons;
  const [icons, setIcons] = useState<Icon[]>(initialIcons);
  const [trash, setTrash] = useState<BrowserItem[]>([]);
  const [testFolderItems, setTestFolderItems] = useState<BrowserItem[]>([]);
  const [blogItems, setBlogItems] = useState<BrowserItem[]>([]);
  const [windows, setWindows] = useState<Record<string, Win>>({
    about: { id: "about", open: false, z: 10 },
    skills: { id: "skills", open: false, z: 10 },
    experience: { id: "experience", open: false, z: 10 },
    calculator: { id: "calculator", open: false, z: 10 },
    readme: { id: "readme", open: false, z: 10 },
    todo: { id: "todo", open: false, z: 10 },
    blog: { id: "blog", open: false, z: 10 },
    "falling-sand": { id: "falling-sand", open: false, z: 10 },
    trash: { id: "trash", open: false, z: 10 },
    "blog-recursion": { id: "blog-recursion", open: false, z: 10 },
    "blog-sorting": { id: "blog-sorting", open: false, z: 10 },
    "blog-graphs": { id: "blog-graphs", open: false, z: 10 },
    "blog-bitcoin": { id: "blog-bitcoin", open: false, z: 10 },
    "blog-bitcoin-pdf": { id: "blog-bitcoin-pdf", open: false, z: 10 },
    "blog-attention": { id: "blog-attention", open: false, z: 10 },
    "blog-attention-pdf": { id: "blog-attention-pdf", open: false, z: 10 },
    "test-folder": { id: "test-folder", open: false, z: 10 },
  });
  const [nextZ, setNextZ] = useState(10);
  const [crtOff, setCrtOff] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectionRef = useRef<Set<string>>(new Set());
  const iconsRef = useRef<Icon[]>(initialIcons);
  const [iconsReady, setIconsReady] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  // Shared draggable plane: items being dragged from folders appear here
  const [draggingFromFolder, setDraggingFromFolder] = useState<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>(null);
  const draggingFromFolderRef = useRef<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<null | "apple" | "file" | "edit" | "view" | "go" | "window" | "help">(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const menubarRef = useRef<HTMLElement | null>(null);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const [dragOverTrash, setDragOverTrash] = useState(false);
  const dragOverTrashRef = useRef(false);
  const [trashCtxMenu, setTrashCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const trashCtxRef = useRef<HTMLDivElement | null>(null);
  const [trashPos, setTrashPos] = useState<{ x: number; y: number } | null>(null);
  const trashDragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const blogRef = useRef<HTMLButtonElement | null>(null);
  const [dragOverBlog, setDragOverBlog] = useState(false);
  const dragOverBlogRef = useRef(false);
  const [dragOverFolderIcon, setDragOverFolderIcon] = useState<string | null>(null);
  const dragOverFolderIconRef = useRef<string | null>(null);
  const blogFolderAddItemsRef = useRef<((items: BrowserItem[]) => void) | null>(null);
  const draggedDesktopIconIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // Reset icons on page refresh - don't load from localStorage
    setIcons(initialIcons);
    setIconsReady(true);
    const savedTrash = localStorage.getItem("nx-trash");
    if (savedTrash) {
      try { 
        const parsed = JSON.parse(savedTrash);
        // Handle migration from Icon[] to BrowserItem[]
        if (parsed.length > 0 && 'app' in parsed[0]) {
          // Old format (Icon[]), convert to BrowserItem[]
          const converted: BrowserItem[] = parsed.map((icon: Icon, idx: number) => ({
            id: icon.id,
            label: icon.label,
            type: "file" as const,
            x: 20 + (idx % 3) * 100,
            y: 20 + Math.floor(idx / 3) * 100,
            windowId: icon.app
          }));
          setTrash(converted);
        } else {
          setTrash(parsed as BrowserItem[]);
        }
      } catch {}
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
    // Wait for next frame to ensure desktopRef is available
    requestAnimationFrame(() => {
      if (!desktopRef.current) return;
      const deskRect = desktopRef.current.getBoundingClientRect();
      const width = deskRect.width || (typeof window !== "undefined" ? window.innerWidth : 1280);
      const height = deskRect.height || (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
      const defaultX = Math.max(8, width - 96 - 8);
      const defaultY = Math.max(8, height - 96 - 8);
      const clamped = clampToDesktop(defaultX, defaultY);
      setTrashPos(clamped);
    });
  }, [iconsReady, isMobile, trashPos]);

  // Don't persist icons to localStorage - reset on refresh
  // useEffect(() => {
  //   localStorage.setItem("nx-icons", JSON.stringify(icons));
  // }, [icons]);
  useEffect(() => {
    if (trash.length > 0) {
      localStorage.setItem("nx-trash", JSON.stringify(trash));
    } else {
      localStorage.removeItem("nx-trash");
    }
  }, [trash]);
  useEffect(() => {
    if (trashPos) {
      localStorage.setItem("nx-trash-pos", JSON.stringify(trashPos));
    } else {
      localStorage.removeItem("nx-trash-pos");
    }
  }, [trashPos]);

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
      const newItems: BrowserItem[] = items
        .filter((i) => !existing.has(i.id))
        .map((icon, idx) => ({
          id: icon.id,
          label: icon.label,
          type: "file" as const,
          x: 20 + ((prev.length + idx) % 3) * 100,
          y: 20 + Math.floor((prev.length + idx) / 3) * 100,
          windowId: icon.app
        }));
      return newItems.length ? [...newItems, ...prev] : prev;
    });
  }

  function clampToDesktop(x: number, y: number): { x: number; y: number } {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    // Subtract menubar height (28px) from viewport when desktop rect is unavailable
    const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    // Trash icon is 96px wide, so ensure it fits with padding
    const maxX = Math.max(8, width - 96 - 8);
    const maxY = Math.max(8, height - 96 - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }

  function clampIconToDesktop(x: number, y: number): { x: number; y: number } {
    const deskRect = desktopRef.current?.getBoundingClientRect();
    const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
    // Subtract menubar height (28px) from viewport when desktop rect is unavailable
    const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    // Desktop icons are approximately 96px wide (including label), so ensure they fit with padding
    const iconWidth = 96;
    const iconHeight = 96; // Icon + label height
    const maxX = Math.max(8, width - iconWidth - 8);
    const maxY = Math.max(8, height - iconHeight - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }

  function restoreIcon(id: string, at?: { x: number; y: number }) {
    setTrash((t) => {
      const idx = t.findIndex((it) => it.id === id);
      if (idx < 0) return t;
      const item = t[idx];
      const defaultPos = { x: 40 + (icons.length % 6) * 120, y: 64 + Math.floor(icons.length / 6) * 96 };
      const pos = at ? clampIconToDesktop(at.x, at.y) : clampIconToDesktop(defaultPos.x, defaultPos.y);
      // Convert BrowserItem back to Icon
      const icon: Icon = {
        id: item.id,
        label: item.label,
        app: item.windowId || item.id,
        x: pos.x,
        y: pos.y
      };
      setIcons((list) => [icon, ...list]);
      const next = [...t];
      next.splice(idx, 1);
      return next;
    });
  }

  function restoreAll() {
    setTrash((t) => {
      if (t.length === 0) return t;
      // Convert BrowserItems back to Icons
      const restoredIcons: Icon[] = t.map((item, idx) => {
        const defaultPos = { x: 40 + (idx % 6) * 120, y: 64 + Math.floor(idx / 6) * 96 };
        const clampedPos = clampIconToDesktop(defaultPos.x, defaultPos.y);
        return {
          id: item.id,
          label: item.label,
          app: item.windowId || item.id,
          x: clampedPos.x,
          y: clampedPos.y
        };
      });
      setIcons((list) => [...restoredIcons, ...list]);
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

  // Sync refs to avoid including them in dependency arrays
  useEffect(() => {
    iconsRef.current = icons;
  }, [icons]);
  
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  
  useEffect(() => {
    draggingFromFolderRef.current = draggingFromFolder;
  }, [draggingFromFolder]);

  // Drag-to-trash and folder icon detection
  useEffect(() => {
    if (!desktopRef.current || !trashRef.current) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      // Check if a desktop icon is being dragged
      const desktopIcon = document.querySelector('.desktop-icon.dragging') as HTMLElement;
      const isDraggingFromFolder = draggingFromFolderRef.current !== null;
      
      if (desktopIcon || isDraggingFromFolder) {
        // Store dragged icon IDs in ref (captured during drag to avoid race condition)
        if (desktopIcon) {
          const draggingIcons = document.querySelectorAll('.desktop-icon.dragging');
          draggedDesktopIconIdsRef.current = Array.from(draggingIcons)
            .map(el => el.getAttribute('data-id'))
            .filter((id): id is string => id !== null && id !== 'trash' && id !== 'blog');
        }
        
        // Check blog folder icon (before trash, like trash is checked)
        if (blogRef.current) {
          const blogRect = blogRef.current.getBoundingClientRect();
          const overBlog = e.clientX >= blogRect.left && e.clientX <= blogRect.right &&
                           e.clientY >= blogRect.top && e.clientY <= blogRect.bottom;
          // Only update if value changed
          if (dragOverBlogRef.current !== overBlog) {
            dragOverBlogRef.current = overBlog;
            setDragOverBlog(overBlog);
          }
        }
        
        // Check trash
        if (trashRef.current) {
          const trashRect = trashRef.current.getBoundingClientRect();
          const overTrash = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                            e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
          // Only update if value changed
          if (dragOverTrashRef.current !== overTrash) {
            dragOverTrashRef.current = overTrash;
            setDragOverTrash(overTrash);
          }
        }
        
        // Check folder icons (test-folder, etc. - blog is handled separately above)
        const folderIcons = ['test-folder']; // Add other folder IDs here (blog is handled separately)
        let foundFolder: string | null = null;
        
        for (const folderId of folderIcons) {
          const folderIcon = document.querySelector(`.desktop-icon[data-id="${folderId}"]`) as HTMLElement;
          if (folderIcon) {
            const folderRect = folderIcon.getBoundingClientRect();
            const overFolder = e.clientX >= folderRect.left && e.clientX <= folderRect.right &&
                              e.clientY >= folderRect.top && e.clientY <= folderRect.bottom;
            if (overFolder) {
              foundFolder = folderId;
              break;
            }
          }
        }
        
        // Only update if value changed
        if (dragOverFolderIconRef.current !== foundFolder) {
          dragOverFolderIconRef.current = foundFolder;
          setDragOverFolderIcon(foundFolder);
        }
      } else {
        // Only update if values changed
        if (dragOverBlogRef.current) {
          dragOverBlogRef.current = false;
          setDragOverBlog(false);
        }
        if (dragOverTrashRef.current) {
          dragOverTrashRef.current = false;
          setDragOverTrash(false);
        }
        if (dragOverFolderIconRef.current !== null) {
          dragOverFolderIconRef.current = null;
          setDragOverFolderIcon(null);
        }
        draggedDesktopIconIdsRef.current = [];
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      // Use stored icon IDs from ref (captured during drag) to avoid race condition
      // where desktop icon removes 'dragging' class before we can detect it
      const draggedIconIds = draggedDesktopIconIdsRef.current.length > 0 
        ? draggedDesktopIconIdsRef.current
        : (() => {
            // Fallback: try to get from DOM if ref is empty
            const draggingIcons = document.querySelectorAll('.desktop-icon.dragging');
            return Array.from(draggingIcons)
              .map(el => el.getAttribute('data-id'))
              .filter((id): id is string => id !== null && id !== 'trash' && id !== 'blog');
          })();
      
      // Verify drop position for folder icons
      const folderIcons = ['blog', 'test-folder'];
      let actualDropFolder: string | null = null;
      for (const folderId of folderIcons) {
        const folderIcon = document.querySelector(`.desktop-icon[data-id="${folderId}"]`) as HTMLElement;
        if (folderIcon) {
          const folderRect = folderIcon.getBoundingClientRect();
          const overFolder = e.clientX >= folderRect.left && e.clientX <= folderRect.right &&
                            e.clientY >= folderRect.top && e.clientY <= folderRect.bottom;
          if (overFolder) {
            actualDropFolder = folderId;
            break;
          }
        }
      }
      
      // Check folder icons first (before trash) - verify we're actually dropping on it
      // Note: blog folder is handled separately (like trash) below, so skip it here
      if (actualDropFolder && actualDropFolder !== "blog") {
        // Check if dragging from folder (use ref)
        if (draggingFromFolderRef.current) {
          const item = draggingFromFolderRef.current.item;
          
          if (actualDropFolder === "test-folder") {
            // Add to test folder
            setTestFolderItems(prev => [...prev, { 
              ...item, 
              x: 20 + (prev.length % 3) * 100, 
              y: 20 + Math.floor(prev.length / 3) * 100 
            }]);
            
            // Remove from source folder
            if (draggingFromFolderRef.current.sourceFolder === "blog") {
              // Handle blog folder items if needed - items are managed by BlogBrowser state
            } else if (draggingFromFolderRef.current.sourceFolder === "test-folder") {
              setTestFolderItems(prev => prev.filter(i => i.id !== item.id));
            }
            
            setDraggingFromFolder(null);
            
            // Open the folder window
            openWin("test-folder");
            
            if (dragOverFolderIconRef.current !== null) {
              dragOverFolderIconRef.current = null;
              setDragOverFolderIcon(null);
            }
            draggedDesktopIconIdsRef.current = [];
            if (dragOverTrashRef.current) {
              dragOverTrashRef.current = false;
              setDragOverTrash(false);
            }
            return;
          }
        }
        
        // Handle desktop icons being dragged onto folder icons
        // Note: blog folder is handled separately (like trash) below, so skip it here
        if (draggedIconIds.length > 0 && actualDropFolder !== "blog") {
          // Get all selected icon IDs
          const selectedIds = draggedIconIds.filter(id => id !== actualDropFolder);
          
          // Also check selection state for any additional selected icons (use ref)
          const allSelectedIds = new Set(selectedIds);
          selectionRef.current.forEach(id => {
            if (id !== 'trash' && id !== actualDropFolder) allSelectedIds.add(id);
          });
          
          if (allSelectedIds.size > 0) {
            const iconsToMove = iconsRef.current.filter(i => allSelectedIds.has(i.id));
            
            if (actualDropFolder === "test-folder") {
              // Add to test folder
              setTestFolderItems(prev => {
                const newItems = iconsToMove.map((icon, idx) => ({
                  id: icon.id,
                  label: icon.label,
                  type: "file" as const,
                  x: 20 + ((prev.length + idx) % 3) * 100,
                  y: 20 + Math.floor((prev.length + idx) / 3) * 100,
                  windowId: icon.app
                }));
                return [...prev, ...newItems];
              });
              
              // Remove from desktop
              setIcons(prev => prev.filter(i => !allSelectedIds.has(i.id)));
              setSelection(sel => {
                const next = new Set(sel);
                allSelectedIds.forEach(id => next.delete(id));
                return next;
              });
              
              // Open the folder window
              openWin("test-folder");
            }
          }
        }
        if (dragOverFolderIconRef.current !== null) {
          dragOverFolderIconRef.current = null;
          setDragOverFolderIcon(null);
        }
        draggedDesktopIconIdsRef.current = [];
        if (dragOverBlogRef.current) {
          dragOverBlogRef.current = false;
          setDragOverBlog(false);
        }
        if (dragOverTrashRef.current) {
          dragOverTrashRef.current = false;
          setDragOverTrash(false);
        }
        return;
      }
      
      // Check blog folder icon (before trash, like how folder icons are checked before trash)
      if (blogRef.current) {
        const blogRect = blogRef.current.getBoundingClientRect();
        const overBlog = e.clientX >= blogRect.left && e.clientX <= blogRect.right &&
                         e.clientY >= blogRect.top && e.clientY <= blogRect.bottom;
        
        if (overBlog) {
          // Check if dragging from folder (use ref)
          if (draggingFromFolderRef.current) {
            const item = draggingFromFolderRef.current.item;
            // Add to blog folder - use setBlogItems directly like trash uses setTrash
            setBlogItems(prev => {
              const existing = new Set(prev.map(i => i.id));
              if (existing.has(item.id)) return prev;
              return [...prev, {
                id: item.id,
                label: item.label,
                type: item.type,
                x: 20 + (prev.length % 3) * 100,
                y: 20 + Math.floor(prev.length / 3) * 100,
                windowId: item.windowId
              }];
            });
            
            // Remove from source folder
            if (draggingFromFolderRef.current.sourceFolder === "test-folder") {
              setTestFolderItems(prev => prev.filter(i => i.id !== item.id));
            } else if (draggingFromFolderRef.current.sourceFolder === "blog") {
              // Don't remove if dragging within blog folder
            }
            
            setDraggingFromFolder(null);
            
            if (dragOverFolderIconRef.current !== null) {
              dragOverFolderIconRef.current = null;
              setDragOverFolderIcon(null);
            }
            draggedDesktopIconIdsRef.current = [];
            if (dragOverBlogRef.current) {
              dragOverBlogRef.current = false;
              setDragOverBlog(false);
            }
            if (dragOverTrashRef.current) {
              dragOverTrashRef.current = false;
              setDragOverTrash(false);
            }
            return;
          } else if (draggedIconIds.length > 0) {
            // Use stored icon IDs from ref
            // Also check selection state for any additional selected icons (use ref)
            const allSelectedIds = new Set(draggedIconIds);
            selectionRef.current.forEach(id => {
              if (id !== 'trash' && id !== 'blog') allSelectedIds.add(id);
            });
            
            if (allSelectedIds.size > 0) {
              const iconsToMove = iconsRef.current.filter(i => allSelectedIds.has(i.id));
              if (iconsToMove.length > 0) {
                // Add all selected icons to blog folder - use setBlogItems directly like trash uses setTrash
                setBlogItems(prev => {
                  const existing = new Set(prev.map(i => i.id));
                  const newItems: BrowserItem[] = iconsToMove
                    .filter(icon => !existing.has(icon.id))
                    .map((icon, idx) => ({
                      id: icon.id,
                      label: icon.label,
                      type: "file" as const,
                      x: 20 + ((prev.length + idx) % 3) * 100,
                      y: 20 + Math.floor((prev.length + idx) / 3) * 100,
                      windowId: icon.app
                    }));
                  return [...prev, ...newItems];
                });
                
                // Remove all selected icons from desktop
                setIcons(prev => prev.filter(i => !allSelectedIds.has(i.id)));
                setSelection(sel => {
                  const next = new Set(sel);
                  allSelectedIds.forEach(id => next.delete(id));
                  return next;
                });
                
                if (dragOverFolderIconRef.current !== null) {
                  dragOverFolderIconRef.current = null;
                  setDragOverFolderIcon(null);
                }
                draggedDesktopIconIdsRef.current = [];
                if (dragOverBlogRef.current) {
                  dragOverBlogRef.current = false;
                  setDragOverBlog(false);
                }
                if (dragOverTrashRef.current) {
                  dragOverTrashRef.current = false;
                  setDragOverTrash(false);
                }
                return;
              }
            }
          }
        }
      }
      
      // Check trash
      if (!trashRef.current) {
        if (dragOverBlogRef.current) {
          dragOverBlogRef.current = false;
          setDragOverBlog(false);
        }
        if (dragOverTrashRef.current) {
          dragOverTrashRef.current = false;
          setDragOverTrash(false);
        }
        if (dragOverFolderIconRef.current !== null) {
          dragOverFolderIconRef.current = null;
          setDragOverFolderIcon(null);
        }
        draggedDesktopIconIdsRef.current = [];
        return;
      }
      
      const trashRect = trashRef.current.getBoundingClientRect();
      const overTrash = e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
                        e.clientY >= trashRect.top && e.clientY <= trashRect.bottom;
      
      if (overTrash) {
        // Check if dragging from folder (use ref)
        if (draggingFromFolderRef.current) {
          const item = draggingFromFolderRef.current.item;
          // Add to trash - convert BrowserItem to Icon format
          addToTrash([{
            id: item.id,
            label: item.label,
            app: item.windowId || item.id,
            x: 0,
            y: 0
          } as Icon]);
          // Remove from source folder
          if (draggingFromFolderRef.current.sourceFolder === "test-folder") {
            setTestFolderItems(prev => prev.filter(i => i.id !== item.id));
          } else if (draggingFromFolderRef.current.sourceFolder === "blog") {
            // Handle blog folder items if needed
          }
          setDraggingFromFolder(null);
        } else if (draggedIconIds.length > 0) {
          // Use stored icon IDs from ref
          // Also check selection state for any additional selected icons (use ref)
          const allSelectedIds = new Set(draggedIconIds);
          selectionRef.current.forEach(id => {
            if (id !== 'trash') allSelectedIds.add(id);
          });
          
          if (allSelectedIds.size > 0) {
            const iconsToDelete = iconsRef.current.filter(i => allSelectedIds.has(i.id));
            if (iconsToDelete.length > 0) {
              // Add all selected icons to trash and remove from desktop
              addToTrash(iconsToDelete);
              setIcons(prev => prev.filter(i => !allSelectedIds.has(i.id)));
              setSelection(sel => {
                const next = new Set(sel);
                allSelectedIds.forEach(id => next.delete(id));
                return next;
              });
            }
          }
        }
      }
      // Only update state if values changed
      if (dragOverBlogRef.current) {
        dragOverBlogRef.current = false;
        setDragOverBlog(false);
      }
      if (dragOverTrashRef.current) {
        dragOverTrashRef.current = false;
        setDragOverTrash(false);
      }
      if (dragOverFolderIconRef.current !== null) {
        dragOverFolderIconRef.current = null;
        setDragOverFolderIcon(null);
      }
      draggedDesktopIconIdsRef.current = [];
    };
    
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [setTestFolderItems, openWin]);

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
      // Recalculate start position using current scale to ensure exact cursor alignment
      const startDesktopX = (marqueeStart.current.x - d.left) / scaleX;
      const startDesktopY = (marqueeStart.current.y - d.top) / scaleY;
      const currentDesktopX = (ev.clientX - d.left) / scaleX;
      const currentDesktopY = (ev.clientY - d.top) / scaleY;
      const left = Math.min(startDesktopX, currentDesktopX);
      const top = Math.min(startDesktopY, currentDesktopY);
      const width = Math.abs(currentDesktopX - startDesktopX);
      const height = Math.abs(currentDesktopY - startDesktopY);
      Object.assign(marqueeRef.current.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      
      // Convert marquee box to screen coordinates for collision detection
      // Icons use getBoundingClientRect() which returns screen coordinates
      const boxLeft = left * scaleX + d.left;
      const boxTop = top * scaleY + d.top;
      const boxWidth = width * scaleX;
      const boxHeight = height * scaleY;
      const box = new DOMRect(boxLeft, boxTop, boxWidth, boxHeight);
      
      const buttons = desktopRef.current.querySelectorAll<HTMLButtonElement>(`.desktop-icon`);
      const sel = new Set<string>();
      buttons.forEach((btn) => {
        const r = btn.getBoundingClientRect();
        const id = btn.dataset.id || "";
        // Check rectangle intersection in screen coordinates
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
    const y = Math.max(8, height - 96 - 8);
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
                <button className="menu-entry" role="menuitem" onClick={() => { toggleFullscreen(); setOpenMenu(null); }}>{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</button>
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
            clampIconToDesktop={clampIconToDesktop}
            dragOver={icon.id === "blog" ? dragOverBlog : dragOverFolderIcon === icon.id}
            iconRef={icon.id === "blog" ? blogRef : undefined}
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
              clampIconToDesktop={clampIconToDesktop}
            />
          </div>
        )}

        {/* Trash bin icon (always visible) */}
        <button
          ref={trashRef}
          className={`desktop-icon trash-icon ${trash.length > 0 ? 'has-items' : ''} ${dragOverTrash ? 'is-over' : ''} ${selection.has('trash') ? 'is-selected' : ''}`}
          style={{ 
            position: 'absolute', 
            left: defaultTrashPos.x,
            top: defaultTrashPos.y,
          }}
          data-id="trash"
          onDoubleClick={() => {
            // Only open window if we didn't drag
            if (!trashDragStateRef.current.hasDragged) {
              openWin('trash');
            }
            trashDragStateRef.current.hasDragged = false;
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
            setTrashCtxMenu({ x: left, y: top, id: 'trash' });
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
            
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              if (dragging) {
                try { trashRef.current?.releasePointerCapture(e.pointerId); } catch {}
              }
            };
            
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onClick={() => {
            if (!trashDragStateRef.current.hasDragged) {
              setSelection(new Set(['trash']));
            }
          }}
          aria-label="Trash"
        >
          <div className="icon">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
              <use href={trash.length > 0 ? "#icon-trash-full" : "#icon-trash"}></use>
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
        
        <Window id="falling-sand" title="Falling Sand" windows={windows} frontWin={frontWin} closeWin={closeWin} className="falling-sand-window">
          <FallingSand />
        </Window>
        
        <Window id="blog" title="Blog" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
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
            folderId="blog"
            initialItems={blogItems}
            setBlogItems={setBlogItems}
            testFolderItems={testFolderItems}
            setTestFolderItems={setTestFolderItems}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
            clampIconToDesktop={clampIconToDesktop}
            addItemsRef={blogFolderAddItemsRef}
          />
        </Window>
        
        <Window id="trash" title="Trash" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
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
            folderId="trash"
            initialItems={trash}
            setTrashItems={setTrash}
            testFolderItems={testFolderItems}
            setTestFolderItems={setTestFolderItems}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
            clampIconToDesktop={clampIconToDesktop}
            blogFolderAddItemsRef={blogFolderAddItemsRef}
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
        <Window id="blog-bitcoin" title="Bitcoin Whitepaper.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="bitcoin" />
        </Window>
        <Window id="blog-bitcoin-pdf" title="Bitcoin Whitepaper.pdf" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="bitcoin-pdf" />
        </Window>
        <Window id="blog-attention" title="Attention Is All You Need.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="attention" />
        </Window>
        <Window id="blog-attention-pdf" title="Attention Is All You Need.pdf" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <BlogPostContent postId="attention-pdf" />
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
            folderId="test-folder"
            initialItems={testFolderItems}
            testFolderItems={testFolderItems}
            setTestFolderItems={setTestFolderItems}
            draggingFromFolder={draggingFromFolder}
            setDraggingFromFolder={setDraggingFromFolder}
            clampIconToDesktop={clampIconToDesktop}
            blogFolderAddItemsRef={blogFolderAddItemsRef}
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
            <button className="menu-entry" role="menuitem" onClick={() => { openWin('trash'); setTrashCtxMenu(null); }}>Open</button>
            {trash.length > 0 && (
              <>
                <button className="menu-entry" role="menuitem" onClick={() => { restoreAll(); setTrashCtxMenu(null); }}>Put Back All</button>
                <button className="menu-entry" role="menuitem" onClick={() => { setTrash([]); localStorage.removeItem("nx-trash"); setTrashCtxMenu(null); }}>Empty Trash</button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DesktopIcon({ icon, icons, canDrag, setIcons, selection, setSelection, onDbl, onDragMove, onDragEnd, clampIconToDesktop, dragOver, iconRef }: { icon: Icon; icons: Icon[]; canDrag: boolean; setIcons: React.Dispatch<React.SetStateAction<Icon[]>>; selection: Set<string>; setSelection: (s: Set<string>) => void; onDbl: () => void; onDragMove?: (x: number, y: number) => void; onDragEnd?: (x: number, y: number, dragging: boolean) => void; clampIconToDesktop: (x: number, y: number) => { x: number; y: number }; dragOver?: boolean; iconRef?: React.MutableRefObject<HTMLButtonElement | null>; }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  
  // Sync internal ref with external ref if provided
  useEffect(() => {
    if (iconRef) {
      iconRef.current = ref.current;
    }
  }, [iconRef]);
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
    // Ensure we don't divide by zero - if cssW/cssH is 0 or rect is missing, use scale of 1
    const sx = (rect && cssW > 0) ? rect.width / cssW : 1;
    const sy = (rect && cssH > 0) ? rect.height / cssH : 1;
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
        // Add 'dragging' class to all selected icons
        icons.forEach((it) => {
          if (nextSel.has(it.id)) {
            const iconEl = document.querySelector(`.desktop-icon[data-id="${it.id}"]`) as HTMLElement;
            iconEl?.classList.add('dragging');
          }
        });
      }
      setIcons((list) => list.map((i) => {
        if (!nextSel.has(i.id)) return i;
        const s = starts.get(i.id) || { x: i.x, y: i.y };
        const newPos = clampIconToDesktop(s.x + dx, s.y + dy);
        return { ...i, x: newPos.x, y: newPos.y };
      }));
      if (onDragMove) onDragMove(ev.clientX, ev.clientY);
    };
    const up = (ev?: PointerEvent) => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
      if (dragging) {
        try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
        // Remove 'dragging' class from all selected icons
        icons.forEach((it) => {
          if (nextSel.has(it.id)) {
            const iconEl = document.querySelector(`.desktop-icon[data-id="${it.id}"]`) as HTMLElement;
            iconEl?.classList.remove('dragging');
          }
        });
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
    : icon.id === "blog"
    ? "icon-folder"
    : icon.id === "falling-sand"
    ? "icon-file-binary"
    : "icon-file";
  return (
    <button ref={ref} className={`desktop-icon ${selection.has(icon.id) ? "is-selected" : ""} ${burst ? "is-burst" : ""} ${dragOver ? "is-over" : ""}`} data-id={icon.id} style={{ left: icon.x, top: icon.y, position: "absolute" }} onDoubleClick={onDbl} onPointerDown={down} onClick={() => { setBurst(true); window.setTimeout(() => setBurst(false), 500); }}>
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
  
  // Auto-maximize falling-sand window when it opens
  useEffect(() => {
    if (w?.open && id === "falling-sand" && !isMaximizedRef.current && divRef.current) {
      const el = divRef.current;
      restoreStateRef.current = {
        left: el.style.left || "80px",
        top: el.style.top || "80px",
        width: el.style.width || "800px",
        height: el.style.height || ""
      };
      
      const screenEl = el.closest('.embedded-screen') as HTMLElement | null;
      const desktopEl = el.closest('.desktop') as HTMLElement | null;
      if (screenEl) {
        const css = window.getComputedStyle(screenEl);
        const cssW = parseFloat(css.width || '0');
        const cssH = parseFloat(css.height || '0');
        
        let availableHeight = cssH - 28;
        let topPosition = "28px";
        if (desktopEl) {
          const desktopCss = window.getComputedStyle(desktopEl);
          const desktopCssH = parseFloat(desktopCss.height || '0');
          availableHeight = desktopCssH;
          topPosition = "0px";
        }
        
        el.style.left = "0px";
        el.style.top = topPosition;
        el.style.width = `${cssW}px`;
        el.style.height = `${availableHeight}px`;
        isMaximizedRef.current = true;
      }
    }
  }, [w?.open, id]);
  
  if (!w?.open) return null;
  
  const getScale = () => {
    const screenEl = divRef.current?.closest('.embedded-screen') as HTMLElement | null;
    const rect = screenEl?.getBoundingClientRect();
    const css = screenEl ? window.getComputedStyle(screenEl) : null;
    const cssW = css ? parseFloat(css.width || '0') : 0;
    const cssH = css ? parseFloat(css.height || '0') : 0;
    const scaleX = rect && cssW ? rect.width / cssW : 1;
    const scaleY = rect && cssH ? rect.height / cssH : 1;
    return { scaleX, scaleY };
  };
  
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
      restoreStateRef.current = {
        left: el.style.left || "80px",
        top: el.style.top || "80px",
        width: el.style.width || (className?.includes('blog-window') ? "600px" : "420px"),
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
    const { scaleX, scaleY } = getScale();
    const sx = parseInt(divRef.current?.style.left || "80", 10);
    const sy = parseInt(divRef.current?.style.top || "80", 10);
    frontWin(id);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scaleX, dy = (ev.clientY - startY) / scaleY;
      if (divRef.current && !isMaximizedRef.current) {
        divRef.current.style.left = `${Math.max(0, sx + dx)}px`;
        divRef.current.style.top = `${Math.max(0, sy + dy)}px`;
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
    const { scaleX, scaleY } = getScale();
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
        el.style.left = `${Math.max(0, newLeft)}px`;
        el.style.top = `${Math.max(0, newTop)}px`;
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
  setTrashItems,
  setBlogItems,
  testFolderItems: externalTestFolderItems,
  setTestFolderItems: setExternalTestFolderItems,
  draggingFromFolder,
  setDraggingFromFolder,
  clampIconToDesktop,
  addItemsRef,
  blogFolderAddItemsRef
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
  setTrashItems?: React.Dispatch<React.SetStateAction<BrowserItem[]>>;
  setBlogItems?: React.Dispatch<React.SetStateAction<BrowserItem[]>>;
  testFolderItems?: BrowserItem[];
  setTestFolderItems?: React.Dispatch<React.SetStateAction<BrowserItem[]>>;
  draggingFromFolder?: { item: BrowserItem; x: number; y: number; sourceFolder: string } | null;
  setDraggingFromFolder?: React.Dispatch<React.SetStateAction<{ item: BrowserItem; x: number; y: number; sourceFolder: string } | null>>;
  clampIconToDesktop?: (x: number, y: number) => { x: number; y: number };
  addItemsRef?: React.MutableRefObject<((items: BrowserItem[]) => void) | null>;
  blogFolderAddItemsRef?: React.MutableRefObject<((items: BrowserItem[]) => void) | null>;
}) {
  const browserRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<BrowserItem[]>(initialItems || (folderId === "trash" ? [] : [
    { id: "blog-recursion", label: "Recursive Algorithms.txt", type: "file", x: 20, y: 20, windowId: "blog-recursion" },
    { id: "blog-sorting", label: "Mathematics of Sorting.txt", type: "file", x: 120, y: 20, windowId: "blog-sorting" },
    { id: "blog-graphs", label: "Graph Theory.txt", type: "file", x: 220, y: 20, windowId: "blog-graphs" },
    { id: "blog-bitcoin", label: "Bitcoin Whitepaper.txt", type: "file", x: 20, y: 120, windowId: "blog-bitcoin" },
    { id: "blog-bitcoin-pdf", label: "Bitcoin Whitepaper.pdf", type: "file", x: 120, y: 120, windowId: "blog-bitcoin-pdf" },
    { id: "blog-attention", label: "Attention Is All You Need.txt", type: "file", x: 20, y: 220, windowId: "blog-attention" },
    { id: "blog-attention-pdf", label: "Attention Is All You Need.pdf", type: "file", x: 120, y: 220, windowId: "blog-attention-pdf" },
    { id: "test-folder", label: "Test Folder", type: "folder", x: 20, y: 320 },
  ]));
  
  // Expose function to add items to this folder (for drag-and-drop from desktop)
  useEffect(() => {
    if (addItemsRef) {
      addItemsRef.current = (newItems: BrowserItem[]) => {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const itemsToAdd = newItems.filter(item => !existingIds.has(item.id));
          return [...prev, ...itemsToAdd];
        });
      };
    }
    return () => {
      if (addItemsRef) {
        addItemsRef.current = null;
      }
    };
  }, [addItemsRef]);
  
  // Sync items with external state for trash and blog folders
  // Use a ref to track the last synced value to prevent circular updates
  const lastSyncedInitialItemsRef = useRef<string | null>(null);
  
  useEffect(() => {
    if ((folderId === "trash" || folderId === "blog") && initialItems) {
      // Serialize initialItems to compare
      const newJson = JSON.stringify(initialItems.map(i => ({ id: i.id, label: i.label, type: i.type, x: i.x, y: i.y, windowId: i.windowId })).sort((a, b) => a.id.localeCompare(b.id)));
      
      // Only sync if the external value is different from what we last synced
      // This prevents circular updates when we update items internally
      if (lastSyncedInitialItemsRef.current !== newJson) {
        setItems(prev => {
          const prevJson = JSON.stringify(prev.map(i => ({ id: i.id, label: i.label, type: i.type, x: i.x, y: i.y, windowId: i.windowId })).sort((a, b) => a.id.localeCompare(b.id)));
          if (prevJson !== newJson) {
            lastSyncedInitialItemsRef.current = newJson;
            return initialItems;
          }
          return prev;
        });
      }
    }
  }, [folderId, initialItems]);
  
  // Update parent state when items change (for trash and blog folders)
  useEffect(() => {
    if (folderId === "trash" && setTrashItems) {
      // Update the last synced ref to prevent circular updates
      const itemsJson = JSON.stringify(items.map(i => ({ id: i.id, label: i.label, type: i.type, x: i.x, y: i.y, windowId: i.windowId })).sort((a, b) => a.id.localeCompare(b.id)));
      lastSyncedInitialItemsRef.current = itemsJson;
      setTrashItems(items);
    }
    if (folderId === "blog" && setBlogItems) {
      // Update the last synced ref to prevent circular updates
      const itemsJson = JSON.stringify(items.map(i => ({ id: i.id, label: i.label, type: i.type, x: i.x, y: i.y, windowId: i.windowId })).sort((a, b) => a.id.localeCompare(b.id)));
      lastSyncedInitialItemsRef.current = itemsJson;
      setBlogItems(items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  // Use external testFolderItems if provided (for shared state), otherwise local state
  const [localTestFolderItems, setLocalTestFolderItems] = useState<BrowserItem[]>([]);
  const testFolderItems = externalTestFolderItems !== undefined ? externalTestFolderItems : localTestFolderItems;
  const setTestFolderItems = setExternalTestFolderItems || setLocalTestFolderItems;
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState(false);
  const [desktopDragOverBrowser, setDesktopDragOverBrowser] = useState(false);
  const dragOverFolderRef = useRef(false);
  const dragOverTargetFolderRef = useRef<string | null>(null);
  const dragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });
  const desktopDragOverTargetRef = useRef<string | null>(null);
  const desktopDraggedIconRef = useRef<string | null>(null);
  const desktopDraggedIconIdsRef = useRef<string[]>([]);
  const desktopDragOverBrowserRef = useRef(false);
  const desktopIconsRef = useRef(desktopIcons);
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
    
    return { x: Math.max(8, desktopX), y: Math.max(8, desktopY) };
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
    
    // Calculate the offset from where the user clicked on the item (grab point)
    // This ensures the item stays anchored to the cursor position
    let offsetX = 0;
    let offsetY = 0;
    if (browserRef.current) {
      const browserRect = browserRef.current.getBoundingClientRect();
      const startBrowserX = startX - browserRect.left;
      const startBrowserY = startY - browserRect.top;
      offsetX = startBrowserX - startItemX;
      offsetY = startBrowserY - startItemY;
    }
    
    // Convert initial browser position to desktop coordinates
    const initialDesktopCoords = browserToDesktopCoords(item.x, item.y, e.clientX, e.clientY);
    if (!initialDesktopCoords) return;
    
    // Store initial desktop position for delta-based movement
    const startDesktopX = initialDesktopCoords.x;
    const startDesktopY = initialDesktopCoords.y;
    
    // Get scale for delta calculation (same as DesktopIcon uses)
    const getDesktopScale = () => {
      if (!desktopRef?.current) return { scaleX: 1, scaleY: 1 };
      const screenEl = desktopRef.current.closest('.embedded-screen') as HTMLElement | null;
      const rect = screenEl?.getBoundingClientRect();
      const css = screenEl ? window.getComputedStyle(screenEl) : null;
      const cssW = css ? parseFloat(css.width || '0') : 0;
      const cssH = css ? parseFloat(css.height || '0') : 0;
      const scaleX = rect && cssW ? rect.width / cssW : 1;
      const scaleY = rect && cssH ? rect.height / cssH : 1;
      return { scaleX, scaleY };
    };
    
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
            
            // Calculate new position anchored to cursor (maintains grab point)
            const newX = browserX - offsetX;
            const newY = browserY - offsetY;
            
            // Only show desktop ghost if dragging outside browser
            if (isOutsideBrowser && setDraggingFromFolder && clampIconToDesktop) {
              // Calculate desktop position using delta movement (like DesktopIcon does)
              // This properly accounts for zoom by dividing delta by scale
              const { scaleX, scaleY } = getDesktopScale();
              const desktopDx = dx / scaleX;
              const desktopDy = dy / scaleY;
              const newDesktopX = startDesktopX + desktopDx;
              const newDesktopY = startDesktopY + desktopDy;
              
              const clampedCoords = clampIconToDesktop(newDesktopX, newDesktopY);
              setDraggingFromFolder(prev => prev ? {
                ...prev,
                x: clampedCoords.x,
                y: clampedCoords.y
              } : {
                item,
                x: clampedCoords.x,
                y: clampedCoords.y,
                sourceFolder: folderId
              });
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
              if (targetFolderId === "blog" && item.type === "file" && folderId !== "blog" && blogFolderAddItemsRef?.current) {
                // Moving to blog folder from another folder
                blogFolderAddItemsRef.current([{ 
                  ...item, 
                  x: 20 + (0 % 3) * 100, 
                  y: 20 + Math.floor(0 / 3) * 100 
                }]);
                setItems(list => list.filter(i => i.id !== itemId));
                // Open the blog folder window
                openWin("blog");
              } else if (targetFolderId === "test-folder" && item.type === "file" && folderId !== "test-folder") {
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
            if (browserRef.current && browserRect) {
              const browserX = ev.clientX - browserRect.left;
              const browserY = ev.clientY - browserRect.top;
              const newX = Math.max(10, Math.min(browserRect.width - 100, browserX - offsetX));
              const newY = Math.max(10, Math.min(browserRect.height - 100, browserY - offsetY));
              setItems(list => list.map(i => i.id === itemId ? { ...i, x: newX, y: newY } : i));
            }
          } else if (desktopCoords && setDesktopIcons && clampIconToDesktop) {
            // Dropped on desktop - add to desktop icons
            const clampedCoords = clampIconToDesktop(desktopCoords.x, desktopCoords.y);
            const existingIcon = desktopIcons?.find(i => i.id === item.id);
            if (!existingIcon) {
              setDesktopIcons(prev => {
                if (prev.some(i => i.id === item.id)) {
                  return prev.map(i => 
                    i.id === item.id 
                      ? { ...i, x: clampedCoords.x, y: clampedCoords.y }
                      : i
                  );
                }
                if (item.type === "file") {
                  return [...prev, {
                    id: item.id,
                    label: item.label,
                    app: item.windowId || item.id,
                    x: clampedCoords.x,
                    y: clampedCoords.y
                  }];
                } else if (item.type === "folder") {
                  return [...prev, {
                    id: item.id,
                    label: item.label,
                    app: item.id,
                    x: clampedCoords.x,
                    y: clampedCoords.y
                  }];
                }
                return prev;
              });
            } else {
              setDesktopIcons(prev => prev.map(i => 
                i.id === item.id 
                  ? { ...i, x: clampedCoords.x, y: clampedCoords.y }
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

  // Sync desktopIcons ref to avoid including it in dependency array
  useEffect(() => {
    desktopIconsRef.current = desktopIcons;
  }, [desktopIcons]);

  // Handle desktop icon drag into browser - check on pointer move
  useEffect(() => {
    if (!desktopRef?.current || !setDesktopIcons || !browserRef.current) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      // Check if desktop icons are being dragged
      const draggingIcons = document.querySelectorAll('.desktop-icon.dragging');
      if (draggingIcons.length > 0 && browserRef.current) {
        // Store all dragged icon IDs (use first one for ref compatibility, but handle all in drop)
        const draggedIds = Array.from(draggingIcons)
          .map(el => el.getAttribute('data-id'))
          .filter((id): id is string => id !== null && id !== 'trash');
        desktopDraggedIconRef.current = draggedIds[0] || null;
        desktopDraggedIconIdsRef.current = draggedIds; // Store IDs in ref for drop handler
        
        const rect = browserRef.current.getBoundingClientRect();
        const overBrowser = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        // Only update state if value actually changed
        if (desktopDragOverBrowserRef.current !== overBrowser) {
          desktopDragOverBrowserRef.current = overBrowser;
          setDesktopDragOverBrowser(overBrowser);
        }
        
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
                const wasOverFolder = dragOverFolderRef.current;
                dragOverFolderRef.current = true;
                if (!wasOverFolder) {
                  setDragOverFolder(true);
                }
                return currentItems;
              }
            }
            const wasOverFolder = dragOverFolderRef.current;
            dragOverFolderRef.current = false;
            if (wasOverFolder) {
              setDragOverFolder(false);
            }
            return currentItems;
          });
        } else {
          desktopDragOverTargetRef.current = null;
          const wasOverFolder = dragOverFolderRef.current;
          dragOverFolderRef.current = false;
          if (wasOverFolder) {
            setDragOverFolder(false);
          }
        }
      } else {
        desktopDraggedIconRef.current = null;
        desktopDragOverTargetRef.current = null;
        desktopDraggedIconIdsRef.current = [];
        if (desktopDragOverBrowserRef.current) {
          desktopDragOverBrowserRef.current = false;
          setDesktopDragOverBrowser(false);
        }
      }
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      // Read refs at the moment of drop
      const dragOverTarget = desktopDragOverTargetRef.current;
      const wasOverFolder = dragOverFolderRef.current;
      
      // Use stored icon IDs from ref (captured during drag) to avoid race condition
      // where desktop icon removes 'dragging' class before we can detect it
      const draggedIconIds = desktopDraggedIconIdsRef.current.length > 0 
        ? desktopDraggedIconIdsRef.current
        : (() => {
            // Fallback: try to get from DOM if ref is empty
            const draggingIcons = document.querySelectorAll('.desktop-icon.dragging');
            return Array.from(draggingIcons)
              .map(el => el.getAttribute('data-id'))
              .filter((id): id is string => id !== null && id !== 'trash' && id !== 'blog');
          })();
      
      if (draggedIconIds.length > 0 && browserRef.current && setDesktopIcons) {
        const rect = browserRef.current.getBoundingClientRect();
        const overBrowser = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (overBrowser) {
          // Get all selected desktop icons (use ref to avoid dependency)
          const selectedIcons = desktopIconsRef.current?.filter(i => draggedIconIds.includes(i.id)) || [];
          
          if (selectedIcons.length > 0) {
            // Check if dropped on a folder icon FIRST
            if (dragOverTarget && wasOverFolder) {
              if (dragOverTarget === "blog" && blogFolderAddItemsRef?.current) {
                // Add all selected icons to blog folder
                const newItems = selectedIcons.map((icon, idx) => ({
                  id: icon.id,
                  label: icon.label,
                  type: "file" as const,
                  x: 20 + (idx % 3) * 100,
                  y: 20 + Math.floor(idx / 3) * 100,
                  windowId: icon.app
                }));
                blogFolderAddItemsRef.current(newItems);
                // Remove all selected icons from desktop
                setDesktopIcons(prev => prev.filter(i => !draggedIconIds.includes(i.id)));
                // Open the blog folder window
                openWin("blog");
                // Clear refs
                desktopDraggedIconRef.current = null;
                desktopDragOverTargetRef.current = null;
                if (dragOverFolderRef.current) {
                  dragOverFolderRef.current = false;
                  setDragOverFolder(false);
                }
                return;
              } else if (dragOverTarget === "test-folder") {
                // Add all selected icons to test folder
                setTestFolderItems(prev => {
                  const newItems = selectedIcons.map((icon, idx) => ({
                    id: icon.id,
                    label: icon.label,
                    type: "file" as const,
                    x: 20 + ((prev.length + idx) % 3) * 100,
                    y: 20 + Math.floor((prev.length + idx) / 3) * 100,
                    windowId: icon.app
                  }));
                  return [...prev, ...newItems];
                });
                // Remove all selected icons from desktop
                setDesktopIcons(prev => prev.filter(i => !draggedIconIds.includes(i.id)));
                // Clear refs
                desktopDraggedIconRef.current = null;
                desktopDragOverTargetRef.current = null;
                if (dragOverFolderRef.current) {
                  dragOverFolderRef.current = false;
                  setDragOverFolder(false);
                }
                return;
              } else if (dragOverTarget === "trash" && folderId === "trash" && setTrashItems) {
                // Add all selected icons to trash folder
                setTrashItems(prev => {
                  const newItems = selectedIcons.map((icon, idx) => ({
                    id: icon.id,
                    label: icon.label,
                    type: "file" as const,
                    x: 20 + ((prev.length + idx) % 3) * 100,
                    y: 20 + Math.floor((prev.length + idx) / 3) * 100,
                    windowId: icon.app
                  }));
                  return [...prev, ...newItems];
                });
                // Remove all selected icons from desktop
                setDesktopIcons(prev => prev.filter(i => !draggedIconIds.includes(i.id)));
                // Clear refs
                desktopDraggedIconRef.current = null;
                desktopDragOverTargetRef.current = null;
                if (dragOverFolderRef.current) {
                  dragOverFolderRef.current = false;
                  setDragOverFolder(false);
                }
                return;
              }
            }
            
            // Dropped into the folder window (not on a folder icon) - add to current folder
            const browserX = e.clientX - rect.left - 48;
            const browserY = e.clientY - rect.top - 24;
            
            setItems(prev => {
              const existingIds = new Set(prev.map(i => i.id));
              const newItems: BrowserItem[] = [];
              
              selectedIcons.forEach((icon, idx) => {
                if (existingIds.has(icon.id)) {
                  // Item already exists in this folder, just update position
                  const existingItem = prev.find(i => i.id === icon.id);
                  if (existingItem) {
                    newItems.push({
                      ...existingItem,
                      x: Math.max(10, browserX + (idx % 3) * 100),
                      y: Math.max(10, browserY + Math.floor(idx / 3) * 100)
                    });
                  }
                } else {
                  // Add new item to this folder
                  newItems.push({
                    id: icon.id,
                    label: icon.label,
                    type: "file" as const,
                    x: Math.max(10, browserX + (idx % 3) * 100),
                    y: Math.max(10, browserY + Math.floor(idx / 3) * 100),
                    windowId: icon.app
                  });
                }
              });
              
              // Merge with existing items, updating positions for existing ones
              const updated = prev.map(item => {
                const updatedItem = newItems.find(ni => ni.id === item.id);
                return updatedItem || item;
              });
              
              // Add new items that don't exist yet
              const added = newItems.filter(ni => !existingIds.has(ni.id));
              
              return [...updated, ...added];
            });
            
            // Remove all selected icons from desktop (they're now in the folder)
            setDesktopIcons(prev => prev.filter(i => !draggedIconIds.includes(i.id)));
          }
        }
      }
      
      // Clear refs
      desktopDraggedIconRef.current = null;
      desktopDragOverTargetRef.current = null;
      desktopDraggedIconIdsRef.current = [];
      if (dragOverFolderRef.current) {
        dragOverFolderRef.current = false;
        setDragOverFolder(false);
      }
      if (desktopDragOverBrowserRef.current) {
        desktopDragOverBrowserRef.current = false;
        setDesktopDragOverBrowser(false);
      }
    };
    
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [desktopRef, setDesktopIcons, setItems, setTestFolderItems, folderId, setTrashItems]);

  return (
    <div 
      className={`blog-browser ${desktopDragOverBrowser ? 'drag-over-browser' : ''}`}
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
            background: 'var(--bg-window)',
            color: 'var(--text)',
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

function BlogPostContent({ postId }: { postId: "recursion" | "sorting" | "graphs" | "bitcoin" | "bitcoin-pdf" | "attention" | "attention-pdf" }) {
  const [viewMode, setViewMode] = useState<"html" | "pdf">(postId.endsWith("-pdf") ? "pdf" : "html");
  
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
    bitcoin: {
      title: "Bitcoin: A Peer-to-Peer Electronic Cash System",
      meta: "Published: October 31, 2008 | Author: Satoshi Nakamoto",
      pdfPath: "/bitcoin.pdf",
      content: (
        <>
          <div style={{ marginBottom: "16px", padding: "8px", background: "var(--bg-window)", border: "1px solid var(--border)", borderRadius: "4px" }}>
            <button 
              onClick={() => setViewMode(viewMode === "html" ? "pdf" : "html")}
              style={{ 
                padding: "6px 12px", 
                background: "var(--accent)", 
                color: "#101010", 
                border: "1px solid var(--border)", 
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600"
              }}
            >
              View {viewMode === "html" ? "PDF" : "HTML"}
            </button>
          </div>
          <h3>Abstract</h3>
          <p>A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution. Digital signatures provide part of the solution, but the main benefits are lost if a trusted third party is still required to prevent double-spending. We propose a solution to the double-spending problem using a peer-to-peer network. The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work, forming a record that cannot be changed without redoing the proof-of-work. The longest chain not only serves as proof of the sequence of events witnessed, but proof that it came from the largest pool of CPU power. As long as a majority of CPU power is controlled by nodes that are not cooperating to attack the network, they&apos;ll generate the longest chain and outpace attackers. The network itself requires minimal structure. Messages are broadcast on a best effort basis, and nodes can leave and rejoin the network at will, accepting the longest proof-of-work chain as proof of what happened while they were gone.</p>
          
          <h3>1. Introduction</h3>
          <p>Commerce on the Internet has come to rely almost exclusively on financial institutions serving as trusted third parties to process electronic payments. While the system works well enough for most transactions, it still suffers from the inherent weaknesses of the trust based model. Completely non-reversible transactions are not really possible, since financial institutions cannot avoid mediating disputes. The cost of mediation increases transaction costs, limiting the minimum practical transaction size and cutting off the possibility for small casual transactions, and there is a broader cost in the loss of ability to make non-reversible payments for non-reversible services. With the possibility of reversal, the need for trust spreads. Merchants must be wary of their customers, hassling them for more information than they would otherwise need. A certain percentage of fraud is accepted as unavoidable. These costs and payment uncertainties can be avoided in person by using physical currency, but no mechanism exists to make payments over a communications channel without a trusted party.</p>
          
          <p>What is needed is an electronic payment system based on cryptographic proof instead of trust, allowing any two willing parties to transact directly with each other without the need for a trusted third party. Transactions that are computationally impractical to reverse would protect sellers from fraud, and routine escrow mechanisms could easily be implemented to protect buyers. In this paper, we propose a solution to the double-spending problem using a peer-to-peer distributed timestamp server to generate computational proof of the chronological order of transactions. The system is secure as long as honest nodes collectively control more CPU power than any cooperating group of attacker nodes.</p>
          
          <h3>2. Transactions</h3>
          <p>We define an electronic coin as a chain of digital signatures. Each owner transfers the coin to the next by digitally signing a hash of the previous transaction and the public key of the next owner and adding these to the end of the coin. A payee can verify the signatures to verify the chain of ownership.</p>
          
          <p>The problem of course is the payee can&apos;t verify that one of the owners did not double-spend the coin. A common solution is to introduce a trusted central authority, or mint, that checks every transaction for double spending. After each transaction, the coin must be returned to the mint to issue a new coin, and only coins issued directly from the mint are trusted not to be double-spent. The problem with this solution is that the fate of the entire money system depends on the company running the mint, with every transaction having to go through them, just like a bank.</p>
          
          <p>We need a way for the payee to know that the previous owners did not sign any earlier transactions. For our purposes, the earliest transaction is the one that counts, so we don&apos;t care about later attempts to double-spend. The only way to confirm the absence of a transaction is to be aware of all transactions. In the mint based model, the mint was aware of all transactions and decided which arrived first. To accomplish this without a trusted party, transactions must be publicly announced, and we need a system for participants to agree on a single history of the order in which they were received. The payee needs proof that at the time of each transaction, the majority of nodes agreed it was the first received.</p>
          
          <h3>3. Timestamp Server</h3>
          <p>The solution we propose begins with a timestamp server. A timestamp server works by taking a hash of a block of items to be timestamped and widely publishing the hash, such as in a newspaper or Usenet post. The timestamp proves that the data must have existed at the time, obviously, in order to get into the hash. Each timestamp includes the previous timestamp in its hash, forming a chain, with each additional timestamp reinforcing the ones before it.</p>
          
          <h3>4. Proof-of-Work</h3>
          <p>To implement a distributed timestamp server on a peer-to-peer basis, we need to use a proof-of-work system similar to Adam Back&apos;s Hashcash, rather than newspaper or Usenet posts. The proof-of-work involves scanning for a value that when hashed, such as with SHA-256, the hash begins with a number of zero bits. The average work required is exponential in the number of zero bits required and can be verified by executing a single hash.</p>
          
          <p>For our timestamp network, we implement the proof-of-work by incrementing a nonce in the block until a value is found that gives the block&apos;s hash the required zero bits. Once the CPU effort has been expended to make it satisfy the proof-of-work, the block cannot be changed without redoing the work. As later blocks are chained after it, the work to change the block would include redoing all the blocks after it.</p>
          
          <h3>5. Network</h3>
          <p>The steps to run the network are as follows:</p>
          <ol>
            <li>New transactions are broadcast to all nodes.</li>
            <li>Each node collects new transactions into a block.</li>
            <li>Each node works on finding a difficult proof-of-work for its block.</li>
            <li>When a node finds a proof-of-work, it broadcasts the block to all nodes.</li>
            <li>Nodes accept the block only if all transactions in it are valid and not already spent.</li>
            <li>Nodes express their acceptance of the block by working on creating the next block in the chain, using the hash of the accepted block as the previous hash.</li>
          </ol>
          
          <p>Nodes always consider the longest chain to be the correct one and will keep working on extending it. If two nodes broadcast different versions of the next block simultaneously, some nodes may receive one or the other first. In that case, they work on the first one they received, but save the other branch in case it becomes longer. The tie will be broken when the next proof-of-work is found and one branch becomes longer; the nodes that were working on the other branch will then switch to the longer one.</p>
          
          <h3>6. Incentive</h3>
          <p>By convention, the first transaction in a block is a special transaction that starts a new coin owned by the creator of the block. This adds an incentive for nodes to support the network, and provides a way to initially distribute coins into circulation, since there is no central authority to issue them. The steady addition of a constant of amount of new coins is analogous to gold miners expending resources to add gold to circulation. In our case, it is CPU time and electricity that is expended.</p>
          
          <p>The incentive can also be funded with transaction fees. If the output value of a transaction is less than its input value, the difference is a transaction fee that is added to the incentive value of the block containing the transaction. Once a predetermined number of coins have entered circulation, the incentive can transition entirely to transaction fees and be completely inflation free.</p>
          
          <h3>7. Reclaiming Disk Space</h3>
          <p>Once the latest transaction in a coin is buried under enough blocks, the spent transactions before it can be discarded to save disk space. To facilitate this without breaking the block&apos;s hash, transactions are hashed in a Merkle Tree, with only the root included in the block&apos;s hash. Old blocks can then be compacted by stubbing off branches of the tree. The interior hashes do not need to be stored.</p>
          
          <h3>8. Simplified Payment Verification</h3>
          <p>It is possible to verify payments without running a full network node. A user only needs to keep a copy of the block headers of the longest proof-of-work chain, which he can get by querying network nodes until he&apos;s convinced he has the longest chain, and obtain the Merkle branch linking the transaction to the block it&apos;s timestamped in. He can&apos;t check the transaction for himself, but by linking it to a place in the chain, he can see that a network node has accepted it, and blocks added after it further confirm the network has accepted it.</p>
          
          <h3>9. Combining and Splitting Value</h3>
          <p>Although it would be possible to handle coins individually, it would be unwieldy to make a separate transaction for every cent in a transfer. To allow value to be split and combined, transactions contain multiple inputs and outputs. Normally there will be either a single input from a larger previous transaction or multiple inputs combining smaller amounts, and at most two outputs: one for the payment, and one returning the change, if any, back to the sender.</p>
          
          <h3>10. Privacy</h3>
          <p>Traditional banking models achieve privacy by limiting access to information to the parties involved and the trusted third party. The necessity to announce all transactions publicly precludes this method, but privacy can still be maintained by breaking the flow of information in another place: by keeping public keys anonymous. The public can see that someone is sending an amount to someone else, but without information linking the transaction to anyone. This is similar to the level of information released by stock exchanges, where the time and size of individual trades, the &quot;tape&quot;, is made public, but without telling who the parties were.</p>
          
          <h3>11. Calculations</h3>
          <p>We consider the scenario of an attacker trying to generate an alternate chain faster than the honest chain. Even if this is accomplished, it does not throw the system open to arbitrary changes, such as creating value out of thin air or taking money that never belonged to the attacker. Nodes will not accept an invalid transaction as payment, and honest nodes will never accept a block containing them. An attacker can only try to change one of his own transactions to take back money he recently spent.</p>
          
          <p>The race between the honest chain and an attacker chain can be characterized as a Binomial Random Walk. The success event is the honest chain being extended by one block, increasing its lead by +1, and the failure event is the attacker&apos;s chain being extended by one block, reducing the gap by -1.</p>
          
          <p>The probability of an attacker catching up from a given deficit is analogous to a Gambler&apos;s Ruin problem. Suppose a gambler with unlimited credit starts at a deficit and plays potentially an infinite number of trials to try to reach breakeven. We can calculate the probability he ever reaches breakeven, or that an attacker ever catches up with the honest chain, as follows:</p>
          
          <div className="equation">
            p = probability an honest node finds the next block<br/>
            q = probability the attacker finds the next block<br/>
            q<sub>z</sub> = probability the attacker will ever catch up from z blocks behind
          </div>
          
          <p>Given our assumption that p &gt; q, the probability drops exponentially as the number of blocks the attacker has to catch up with increases. With the odds against him, if he doesn&apos;t make a lucky lunge forward early on, his chances become vanishingly small as he falls further behind.</p>
          
          <h3>12. Conclusion</h3>
          <p>We have proposed a system for electronic transactions without relying on trust. We started with the usual framework of coins made from digital signatures, which provides strong control of ownership, but is incomplete without a way to prevent double-spending. To solve this, we proposed a peer-to-peer network using proof-of-work to record a public history of transactions that quickly becomes computationally impractical for an attacker to change if honest nodes control a majority of CPU power. The network is robust in its unstructured simplicity. Nodes work all at once with little coordination. They do not need to be identified, since messages are not routed to any particular place and only need to be delivered on a best effort basis. Nodes can leave and rejoin the network at will, accepting the proof-of-work chain as proof of what happened while they were gone. They vote with their CPU power, expressing their acceptance of valid blocks by working on extending them and rejecting invalid blocks by refusing to work on them. Any needed rules and incentives can be enforced with this consensus mechanism.</p>
        </>
      ),
    },
    attention: {
      title: "Attention Is All You Need",
      meta: "Published: June 12, 2017 | Authors: Vaswani et al.",
      pdfPath: "/attention.pdf",
      content: (
        <>
          <div style={{ marginBottom: "16px", padding: "8px", background: "var(--bg-window)", border: "1px solid var(--border)", borderRadius: "4px" }}>
            <button 
              onClick={() => setViewMode(viewMode === "html" ? "pdf" : "html")}
              style={{ 
                padding: "6px 12px", 
                background: "var(--accent)", 
                color: "#101010", 
                border: "1px solid var(--border)", 
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600"
              }}
            >
              View {viewMode === "html" ? "PDF" : "HTML"}
            </button>
          </div>
          <h3>Abstract</h3>
          <p>The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show that these models are superior in quality while being more parallelizable and requiring significantly less time to train. Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task, improving over the existing best results, including ensembles, by over 2 BLEU. On the WMT 2014 English-to-French translation task, our model establishes a new single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on eight GPUs, a small fraction of the training costs of the best models from the literature. We show that the Transformer generalizes well to other tasks by applying it successfully to English constituency parsing with large and limited training data.</p>
          
          <h3>1. Introduction</h3>
          <p>Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures.</p>
          
          <p>Recurrent models typically factor computation along the symbol positions of the input and output sequences. Aligning positions to steps in computation time, they generate a sequence of hidden states h<sub>t</sub>, as a function of the previous hidden state h<sub>t-1</sub> and the input for position t. This inherently sequential nature precludes parallelization within training examples, which becomes critical at longer sequence lengths, as memory constraints limit batching across examples. Recent work has achieved significant improvements in computational efficiency through factorization tricks and conditional computation, while also improving model performance in case studies. The fundamental constraint of sequential computation, however, remains.</p>
          
          <p>Attention mechanisms have become an integral part of compelling sequence modeling and transduction models in various tasks, allowing modeling of dependencies without regard to their distance in the input or output sequences. In all but a few cases, however, such attention mechanisms are used in conjunction with a recurrent network.</p>
          
          <p>In this work we propose the Transformer, a model architecture eschewing recurrence and relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization and can reach a new state of the art in translation quality after being trained for as little as twelve hours on eight P100 GPUs.</p>
          
          <h3>2. Background</h3>
          <p>The goal of reducing sequential computation also forms the foundation of the Extended Neural GPU, ByteNet and ConvS2S, all of which use convolutional neural networks as basic building block, computing hidden representations in parallel for all input and output positions. In these models, the number of operations required to relate signals from two arbitrary input or output positions grows in the distance between positions, linearly for ConvS2S and logarithmically for ByteNet. This makes it more difficult to learn dependencies between distant positions. In the Transformer this is reduced to a constant number of operations, albeit at the cost of reduced effective resolution due to averaging attention-weighted positions, an effect we counteract with Multi-Head Attention.</p>
          
          <p>Self-attention, sometimes called intra-attention, is an attention mechanism relating different positions of a single sequence in order to compute a representation of the sequence. Self-attention has been used successfully in a variety of tasks including reading comprehension, abstractive summarization, textual entailment and learning task-independent sentence representations.</p>
          
          <p>End-to-end memory networks are based on a recurrent attention mechanism instead of sequence-aligned recurrence and have been shown to perform well on simple-language question answering and language modeling tasks.</p>
          
          <p>To the best of our knowledge, however, the Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.</p>
          
          <h3>3. Model Architecture</h3>
          <p>Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations (x<sub>1</sub>, ..., x<sub>n</sub>) to a sequence of continuous representations z = (z<sub>1</sub>, ..., z<sub>n</sub>). Given z, the decoder then generates an output sequence (y<sub>1</sub>, ..., y<sub>m</sub>) of symbols one element at a time. At each step the model is auto-regressive, consuming the previously generated symbols as additional input when generating the next.</p>
          
          <p>The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder, shown in the left and right halves of Figure 1, respectively.</p>
          
          <h4>3.1 Encoder and Decoder Stacks</h4>
          <p><strong>Encoder:</strong> The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network. We employ a residual connection around each of the two sub-layers, followed by layer normalization. That is, the output of each sub-layer is LayerNorm(x + Sublayer(x)), where Sublayer(x) is the function implemented by the sub-layer itself. To facilitate these residual connections, all sub-layers in the model, as well as the embedding layers, produce outputs of dimension d<sub>model</sub> = 512.</p>
          
          <p><strong>Decoder:</strong> The decoder is also composed of a stack of N = 6 identical layers. In addition to the two sub-layers in each encoder layer, the decoder inserts a third sub-layer, which performs multi-head attention over the output of the encoder stack. Similar to the encoder, we employ residual connections around each of the sub-layers, followed by layer normalization. We also modify the self-attention sub-layer in the decoder stack to prevent positions from attending to subsequent positions. This masking, combined with fact that the output embeddings are offset by one position, ensures that the predictions for position i can depend only on the known outputs at positions less than i.</p>
          
          <h4>3.2 Attention</h4>
          <p>An attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.</p>
          
          <h4>3.2.1 Scaled Dot-Product Attention</h4>
          <p>We call our particular attention &quot;Scaled Dot-Product Attention&quot; (Figure 2). The input consists of queries and keys of dimension d<sub>k</sub>, and values of dimension d<sub>v</sub>. We compute the dot products of the query with all keys, divide each by √d<sub>k</sub>, and apply a softmax function to obtain the weights on the values.</p>
          
          <p>In practice, we compute the attention function on a set of queries simultaneously, packed together into a matrix Q. The keys and values are also packed together into matrices K and V. We compute the matrix of outputs as:</p>
          
          <div className="equation">
            Attention(Q, K, V) = softmax(QK<sup>T</sup> / √d<sub>k</sub>)V
          </div>
          
          <h4>3.2.2 Multi-Head Attention</h4>
          <p>Instead of performing a single attention function with d<sub>model</sub>-dimensional keys, values and queries, we found it beneficial to linearly project the queries, keys and values h times with different, learned linear projections to d<sub>k</sub>, d<sub>k</sub> and d<sub>v</sub> dimensions, respectively. On each of these projected versions of queries, keys and values we then perform the attention function in parallel, yielding d<sub>v</sub>-dimensional output values. These are concatenated and once again projected, resulting in the final values, as depicted in Figure 2.</p>
          
          <p>Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.</p>
          
          <div className="equation">
            MultiHead(Q, K, V) = Concat(head<sub>1</sub>, ..., head<sub>h</sub>)W<sup>O</sup><br/>
            where head<sub>i</sub> = Attention(QW<sub>i</sub><sup>Q</sup>, KW<sub>i</sub><sup>K</sup>, VW<sub>i</sub><sup>V</sup>)
          </div>
          
          <p>Where the projections are parameter matrices W<sub>i</sub><sup>Q</sup> ∈ ℝ<sup>d<sub>model</sub>×d<sub>k</sub></sup>, W<sub>i</sub><sup>K</sup> ∈ ℝ<sup>d<sub>model</sub>×d<sub>k</sub></sup>, W<sub>i</sub><sup>V</sup> ∈ ℝ<sup>d<sub>model</sub>×d<sub>v</sub></sup> and W<sup>O</sup> ∈ ℝ<sup>hd<sub>v</sub>×d<sub>model</sub></sup>.</p>
          
          <p>In this work we employ h = 8 parallel attention layers, or heads. For each of these we use d<sub>k</sub> = d<sub>v</sub> = d<sub>model</sub>/h = 64. Due to the reduced dimension of each head, the total computational cost is similar to that of single-head attention with full dimensionality.</p>
          
          <h4>3.3 Position-wise Feed-Forward Networks</h4>
          <p>In addition to attention sub-layers, each of the layers in our encoder and decoder contains a fully connected feed-forward network, which is applied to each position separately and identically. This consists of two linear transformations with a ReLU activation in between.</p>
          
          <div className="equation">
            FFN(x) = max(0, xW<sub>1</sub> + b<sub>1</sub>)W<sub>2</sub> + b<sub>2</sub>
          </div>
          
          <p>While the linear transformations are the same across different positions, they use different parameters from layer to layer. Another way of describing this is as two convolutions with kernel size 1. The dimensionality of input and output is d<sub>model</sub> = 512, and the inner-layer has dimensionality d<sub>ff</sub> = 2048.</p>
          
          <h4>3.4 Embeddings and Softmax</h4>
          <p>Similarly to other sequence transduction models, we use learned embeddings to convert the input tokens and output tokens to vectors of dimension d<sub>model</sub>. We also use the usual learned linear transformation and softmax function to convert the decoder output to predicted next-token probabilities. In our model, we share the same weight matrix between the two embedding layers and the pre-softmax linear transformation. In the embedding layers, we multiply those weights by √d<sub>model</sub>.</p>
          
          <h4>3.5 Positional Encoding</h4>
          <p>Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. To this end, we add &quot;positional encodings&quot; to the input embeddings at the bottoms of the encoder and decoder stacks. The positional encodings have the same dimension d<sub>model</sub> as the embeddings, so that the two can be summed. There are many choices of positional encodings, learned and fixed.</p>
          
          <p>In this work, we use sine and cosine functions of different frequencies:</p>
          
          <div className="equation">
            PE<sub>(pos,2i)</sub> = sin(pos / 10000<sup>2i/d<sub>model</sub></sup>)<br/>
            PE<sub>(pos,2i+1)</sub> = cos(pos / 10000<sup>2i/d<sub>model</sub></sup>)
          </div>
          
          <p>where pos is the position and i is the dimension. That is, each dimension of the positional encoding corresponds to a sinusoid. The wavelengths form a geometric progression from 2π to 10000 · 2π. We chose this function because we hypothesized it would allow the model to easily learn to attend by relative positions, since for any fixed offset k, PE<sub>pos+k</sub> can be represented as a linear function of PE<sub>pos</sub>.</p>
          
          <h3>4. Why Self-Attention</h3>
          <p>In this section we compare various aspects of self-attention layers to the recurrent and convolutional layers commonly used for mapping one variable-length sequence of symbol representations (x<sub>1</sub>, ..., x<sub>n</sub>) to another sequence of equal length (z<sub>1</sub>, ..., z<sub>n</sub>), with x<sub>i</sub>, z<sub>i</sub> ∈ ℝ<sub>d</sub>, such as the hidden layers of a typical sequence transduction encoder or decoder. Motivating our use of self-attention we consider three desiderata.</p>
          
          <p>One is the total computational complexity per layer. Another is the amount of computation that can be parallelized, as measured by the minimum number of sequential operations required. The third is the path length between long-range dependencies in the network. Learning long-range dependencies is a key challenge in many sequence transduction tasks. One key factor affecting the ability to learn such dependencies is the length of the paths forward and backward signals have to traverse in the network. The shorter these paths between any combination of positions in the input and output sequences, the easier it is to learn long-range dependencies.</p>
          
          <p>As noted in Table 1, a self-attention layer connects all positions with a constant number of sequentially executed operations, whereas a recurrent layer requires O(n) sequential operations. In terms of computational complexity, self-attention layers are faster than recurrent layers when the sequence length n is smaller than the representation dimensionality d, which is most often the case with sentence representations used by state-of-the-art models in machine translations, such as word-piece and byte-pair representations. To improve computational performance for tasks involving very long sequences, self-attention could be restricted to considering only a neighborhood of size r in the input sequence centered around the respective output position. This would increase the maximum path length to O(n/r). We plan to investigate this approach further in future work.</p>
          
          <p>A single convolutional layer with kernel width k &lt; n does not connect all pairs of input and output positions. Doing so requires a stack of O(n/k) convolutional layers in the case of contiguous kernels, or O(log<sub>k</sub>(n)) in the case of dilated convolutions, increasing the length of the longest paths between any two positions in the network. Convolutional layers are generally more expensive than recurrent layers, by a factor of k. Separable convolutions, however, decrease the complexity considerably, to O(k · n · d + n · d<sup>2</sup>). Even with k = n, the complexity of a separable convolution is equal to the combination of a self-attention layer and a point-wise feed-forward layer, the approach we take in our model.</p>
          
          <p>As side benefit, self-attention could yield more interpretable models. We inspect attention distributions from our model and present and discuss examples in the appendix. Not only do individual attention heads clearly learn to perform different tasks, many appear to exhibit behavior related to the syntactic and semantic structure of the sentences.</p>
          
          <h3>5. Training</h3>
          <p>This section describes the training regime for our models.</p>
          
          <h4>5.1 Training Data and Batching</h4>
          <p>We trained on the standard WMT 2014 English-German dataset consisting of about 4.5 million sentence pairs. Sentences were encoded using byte-pair encoding, which has a shared source-target vocabulary of about 37000 tokens. For English-French, we used the significantly larger WMT 2014 English-French dataset consisting of 36M sentences and split tokens into a 32000 word-piece vocabulary.</p>
          
          <h4>5.2 Hardware and Schedule</h4>
          <p>We trained our models on one machine with 8 NVIDIA P100 GPUs. For our base models using the hyperparameters described throughout the paper, each training step took about 0.4 seconds. We trained the base models for a total of 100,000 steps or 12 hours. For our big models, step time was 1.0 seconds. The big models were trained for 300,000 steps (3.5 days).</p>
          
          <h4>5.3 Optimizer</h4>
          <p>We used the Adam optimizer with β<sub>1</sub> = 0.9, β<sub>2</sub> = 0.98 and ε = 10<sup>-9</sup>. We varied the learning rate over the course of training, according to the formula:</p>
          
          <div className="equation">
            lrate = d<sub>model</sub><sup>-0.5</sup> · min(step<sup>-0.5</sup>, step · warmup_steps<sup>-1.5</sup>)
          </div>
          
          <p>This corresponds to increasing the learning rate linearly for the first warmup_steps training steps, and decreasing it thereafter proportionally to the inverse square root of the step number. We used warmup_steps = 4000.</p>
          
          <h4>5.4 Regularization</h4>
          <p>We employed three types of regularization during training:</p>
          <ol>
            <li><strong>Residual Dropout:</strong> We apply dropout to the output of each sub-layer, before it is added to the sub-layer input and normalized. In addition, we apply dropout to the sums of the embeddings and the positional encodings in both the encoder and decoder stacks. For the base model, we use a rate of P<sub>drop</sub> = 0.1.</li>
            <li><strong>Label Smoothing:</strong> During training, we employed label smoothing of value ε<sub>ls</sub> = 0.1. This hurts perplexity, as the model learns to be more unsure, but improves accuracy and BLEU score.</li>
          </ol>
          
          <h3>6. Results</h3>
          <h4>6.1 Machine Translation</h4>
          <p>On the WMT 2014 English-to-German translation task, the big transformer model (Transformer (big) in Table 2) outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new state-of-the-art BLEU score of 28.4. The configuration of this model is listed in the bottom line of Table 3. Training took 3.5 days on 8 P100 GPUs. Even our base model surpasses all previously published models and ensembles, at a fraction of the training cost of any of the competitive models.</p>
          
          <p>On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost of the previous state-of-the-art model. The Transformer (big) model trained for English-to-French used dropout rate P<sub>drop</sub> = 0.1 instead of 0.3.</p>
          
          <h4>6.2 Model Variations</h4>
          <p>To evaluate the importance of different components of the Transformer, we varied our base model in different ways, measuring the change in performance on English-to-German translation development set, newstest2013. We used beam search with a beam size of 4 and length penalty α = 0.6. These hyperparameters were chosen after experimentation on the development set. We report results using averaged 5-model checkpoints.</p>
          
          <h3>7. Conclusion</h3>
          <p>In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention.</p>
          
          <p>For translation tasks, the Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers. On both WMT 2014 English-to-German and WMT 2014 English-to-French translation tasks, we achieve a new state of the art. In the former task our best model outperforms even all previously reported ensembles.</p>
          
          <p>We are excited about the future of attention-based models. We plan to extend the Transformer to problems involving input and output modalities other than text and to investigate local, restricted attention mechanisms to efficiently handle large inputs and outputs such as images, audio and video. Making generation less sequential is another research goals of ours.</p>
          
          <p>The code we used to train and evaluate our models is available at https://github.com/tensorflow/tensor2tensor.</p>
        </>
      ),
    },
  };

  const post = posts[postId.replace("-pdf", "") as keyof typeof posts];
  
  if (!post) {
    return <div className="blog-posts"><p>Post not found.</p></div>;
  }

  // Handle PDF viewing
  if (viewMode === "pdf" && post.pdfPath) {
    return (
      <div className="blog-posts" style={{ height: "100%", padding: 0 }}>
        <div style={{ marginBottom: "8px", padding: "8px", background: "var(--bg-window)", borderBottom: "1px solid var(--border)" }}>
          <button 
            onClick={() => setViewMode("html")}
            style={{ 
              padding: "6px 12px", 
              background: "var(--accent)", 
              color: "#101010", 
              border: "1px solid var(--border)", 
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "600"
            }}
          >
            View HTML
          </button>
        </div>
        <iframe 
          src={post.pdfPath}
          style={{ 
            width: "100%", 
            height: "calc(100% - 50px)", 
            border: "none",
            background: "white"
          }}
          title={`PDF: ${post.title}`}
        />
      </div>
    );
  }

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

function mergeIconsWithDefaults(saved: Icon[], desktopRef: React.RefObject<HTMLDivElement | null>): Icon[] {
  const byId = new Map(saved.map((i) => [i.id, i] as const));
  const merged: Icon[] = [];
  baseIcons.forEach((def) => {
    const s = byId.get(def.id);
    merged.push(s ? { ...s } : { ...def });
  });
  const deskRect = desktopRef.current?.getBoundingClientRect();
  const width = deskRect?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const height = deskRect?.height ?? (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
  const iconWidth = 96;
  const iconHeight = 96;
  const maxX = Math.max(8, width - iconWidth - 8);
  const maxY = Math.max(8, height - iconHeight - 8);
  return merged.map((i) => ({
    ...i,
    x: Math.min(Math.max(8, i.x), maxX),
    y: Math.min(Math.max(8, i.y), maxY),
  }));
}


