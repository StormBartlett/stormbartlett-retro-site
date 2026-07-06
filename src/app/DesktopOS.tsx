"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import TiptapEditor from "./TiptapEditor";
import TodoEditor from "./TodoEditor";
import FallingSand from "./FallingSand";
import { useFullscreen } from "./FullscreenContext";

type Icon = { id: string; label: string; app: string; x: number; y: number; type?: "file" | "folder" };
type Win = { id: string; open: boolean; z: number; x?: number; y?: number };
type DragSource = { kind: "desktop" } | { kind: "folder"; folderId: string } | { kind: "trash" };
type DragItem = { id: string; label: string; app: string; type?: "file" | "folder" };
type ViewMode = "model" | "desktop";
type DesktopOSProps = {
  embedded?: boolean;
  modelScreen?: boolean;
  mobileVariant?: "portrait" | "landscape";
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
};

const WINDOW_CASCADE_BASE = { x: 80, y: 132 };
const WINDOW_CASCADE_STEP = { x: 28, y: -18 };
const MOBILE_WINDOW_CASCADE_STEP = { x: 4, y: -8 };
const WINDOW_CASCADE_SLOTS = 8;
const DESKTOP_ICON_SIZE = 96;
const BROWSER_ICON_SIZE = 96;
const MOBILE_ICON_SIZE = 100;
type LocalCoordinateMetrics = {
  rect: DOMRect;
  width: number;
  height: number;
  clientToLocal: (clientX: number, clientY: number) => { x: number; y: number };
};
const DESKTOP_BIN_POSITION = { x: 252, y: 73 };
const MOBILE_TOP_ROW_ORDER = ["about", "skills", "bin", "calculator", "projects", "falling-sand", "activity"] as const;
const ICON_STORAGE_KEYS = ["nx-icons", "nx-icons-mobile-portrait", "nx-icons-mobile-landscape"];
const TRASH_POSITION_STORAGE_KEYS = ["nx-trash-pos", "nx-trash-pos-mobile-portrait", "nx-trash-pos-mobile-landscape"];
const BIN_POSITION_STORAGE_KEYS = ["nx-bin-pos", "nx-bin-pos-mobile-portrait", "nx-bin-pos-mobile-landscape"];
const TEXT_FILE_EXTENSION_RE = /\.(txt|md|markdown|rtf)$/i;

function getSpriteId({ id, label, type }: { id: string; label: string; type?: "file" | "folder" }) {
  if (type === "folder") return "icon-folder";
  if (id === "about") return "icon-file-about";
  if (id === "skills") return "icon-file-skills";
  if (id === "calculator") return "icon-calculator";
  if (id === "falling-sand") return "icon-hourglass";
  if (id === "activity") return "icon-activity";
  if (type === "file" || TEXT_FILE_EXTENSION_RE.test(label)) return "icon-file-txt";
  return "icon-file";
}

function getIconSpriteId(icon: Icon) {
  return getSpriteId(icon);
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (Math.abs(rows[pivot][col]) < 1e-9) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];

    const divisor = rows[col][col];
    for (let i = col; i <= size; i++) rows[col][i] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let i = col; i <= size; i++) rows[row][i] -= factor * rows[col][i];
    }
  }

  return rows.map((row) => row[size]);
}

function createLocalCoordinateMetrics(element: HTMLElement): LocalCoordinateMetrics {
  const rect = element.getBoundingClientRect();
  const width = element.clientWidth;
  const height = element.clientHeight;

  const measurePoint = (x: number, y: number) => {
    const marker = document.createElement("div");
    marker.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:1px;height:1px;visibility:hidden;pointer-events:none;`;
    element.appendChild(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.remove();
    return { x: markerRect.left, y: markerRect.top };
  };

  const screenPoints = [
    measurePoint(0, 0),
    measurePoint(width, 0),
    measurePoint(0, height),
    measurePoint(width, height),
  ];
  const localPoints = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ];

  const matrix: number[][] = [];
  const vector: number[] = [];
  screenPoints.forEach((point, index) => {
    const local = localPoints[index];
    matrix.push([point.x, point.y, 1, 0, 0, 0, -local.x * point.x, -local.x * point.y]);
    vector.push(local.x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -local.y * point.x, -local.y * point.y]);
    vector.push(local.y);
  });

  const solution = solveLinearSystem(matrix, vector);
  if (!solution) {
    const scaleX = rect.width / (width || 1);
    const scaleY = rect.height / (height || 1);
    return {
      rect,
      width,
      height,
      clientToLocal: (clientX, clientY) => ({
        x: (clientX - rect.left) / (scaleX || 1),
        y: (clientY - rect.top) / (scaleY || 1),
      }),
    };
  }

  const [a, b, c, d, e, f, g, h] = solution;
  return {
    rect,
    width,
    height,
    clientToLocal: (clientX, clientY) => {
      const denominator = g * clientX + h * clientY + 1;
      return {
        x: (a * clientX + b * clientY + c) / denominator,
        y: (d * clientX + e * clientY + f) / denominator,
      };
    },
  };
}

const baseIcons: Icon[] = [
  { id: "about", label: "About.txt", app: "about", x: 40, y: 64 },
  { id: "skills", label: "Skills.txt", app: "skills", x: 160, y: 64 },
  { id: "calculator", label: "Calculator", app: "calculator", x: 400, y: 64 },
  { id: "projects", label: "Projects", app: "projects", x: 520, y: 64, type: "folder" },
  { id: "falling-sand", label: "Falling Sand", app: "falling-sand", x: 640, y: 64 },
  { id: "activity", label: "Activity Monitor", app: "activity", x: 760, y: 64 },
];

function buildMobileTopRowLayout(width: number, isPortrait: boolean) {
  const preferredColumnCount = isPortrait || width < 740 ? 3 : MOBILE_TOP_ROW_ORDER.length;
  const maxColumnCount = Math.max(1, Math.min(MOBILE_TOP_ROW_ORDER.length, Math.floor(width / (MOBILE_ICON_SIZE + 2))));
  const columnCount = Math.min(preferredColumnCount, maxColumnCount);
  const gap = columnCount === 3 ? 4 : Math.max(2, Math.floor((width - MOBILE_ICON_SIZE * columnCount) / (columnCount + 1)));
  const totalWidth = MOBILE_ICON_SIZE * columnCount + gap * (columnCount - 1);
  const startX = columnCount === 3 ? 8 : Math.max(2, Math.floor((width - totalWidth) / 2));
  const startY = isPortrait ? 64 : 48;
  const rowHeight = isPortrait ? 112 : 104;
  const layout: Partial<Record<(typeof MOBILE_TOP_ROW_ORDER)[number], { x: number; y: number }>> = {};

  MOBILE_TOP_ROW_ORDER.forEach((id, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    layout[id] = {
      x: startX + column * (MOBILE_ICON_SIZE + gap),
      y: startY + row * rowHeight,
    };
  });

  return layout;
}

const aboutText = `Hi, I'm Storm Bartlett, a front-end-focused software engineer who builds interfaces for technical systems and works across the full stack when the problem needs it.

My strongest thread is turning complex workflows into usable software: React/Next.js product architecture at NoteTime, visualisation layers for simulation and data-heavy tooling, and AI/search-backed interfaces that need to stay understandable under real use.

I care about the parts that make software survive after the first version: clear component boundaries, fast UI, reliable data flow, tests, documentation, and enough system understanding to debug beyond the front end.

About this site:
- Retro desktop OS interface design
- Built with Next.js, React, TypeScript, and Three.js
- TipTap/ProseMirror editor with custom Vim behaviour
- Interactive falling-sand simulation`;

const skillsText = `Front-End:
React, Next.js, TypeScript, JavaScript, HTML, CSS/Sass, Tailwind
Component architecture, responsive and accessible UI, performance profiling, dashboards, search-backed UI, Chrome extensions

AI & Product Systems:
AI service integration, transcript and note workflows, indexed search, evaluation harnesses, regression suites, user-facing AI UX

Back-End & Data:
Node.js/Express, Python/Flask/Django, REST APIs, WebSockets, JWT/OAuth
PostgreSQL, MongoDB, SQL, Firebase Firestore, ETL/data pipelines, time-series and IoT telemetry

Simulation, Optimisation & Research:
Java parallel genetic algorithms, clustering optimisation, simulation data flows, visualisation of model outputs, Rust/WGPU physics simulation, Three.js, Matplotlib, scikit-learn

Engineering Practice:
Git/GitHub, GitHub Actions, Docker, Linux, CI/CD, automated testing, code review, ADRs, documentation, Agile/Scrum`;

const blogPostTexts = {
  recursion: `Understanding Recursive Algorithms
Published: March 15, 2024

Recursion is one of the most elegant problem-solving techniques in computer science. When we define a function that calls itself, we're leveraging the power of mathematical induction.

The classic example is the Fibonacci sequence, defined as:

F(n) = F(n-1) + F(n-2)

where F(0) = 0 and F(1) = 1.

In functional programming, this translates beautifully:

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

The time complexity follows the golden ratio: O(phi^n) where phi ~= 1.618. This exponential growth makes naive recursion impractical for large n, but memoization can reduce it to O(n).`,
  sorting: `The Mathematics of Sorting
Published: February 28, 2024

Sorting algorithms reveal fundamental limits in computation. The comparison-based sorting lower bound tells us that any comparison sort must perform at least Omega(n log n) comparisons in the worst case.

This comes from information theory. With n! possible permutations, we need at least:

log2(n!) ~= n log2(n) - n log2(e)

bits of information to distinguish between all permutations.

For merge sort, the recurrence relation is:

T(n) = 2T(n/2) + O(n)

Solving this using the master theorem gives us T(n) = O(n log n), which matches the theoretical lower bound. Quicksort achieves O(n log n) average case, but its worst case is O(n^2) due to poor pivot selection.

The optimal sorting algorithm depends on your data distribution. For nearly-sorted data, insertion sort's O(n) best case makes it ideal.`,
  graphs: `Graph Theory and Network Analysis
Published: January 10, 2024

Graphs model relationships in everything from social networks to routing algorithms. The shortest path problem is fundamental to network analysis.

Dijkstra's algorithm finds the shortest path from a source vertex s to all other vertices in a weighted graph. The key insight is maintaining a priority queue of vertices ordered by their current shortest distance estimate.

The algorithm's time complexity is O((V + E) log V) using a binary heap, where V is vertices and E is edges. For dense graphs, this becomes O(V^2 log V).

The Bellman-Ford algorithm handles negative edge weights but has higher complexity: O(VE). It's based on the relaxation principle:

d[v] = min(d[v], d[u] + w(u,v))

where d[v] is the shortest distance to vertex v, and w(u,v) is the weight of edge (u,v).

For unweighted graphs, breadth-first search gives us the shortest path in O(V + E) time, optimal for this case. The BFS tree structure reveals interesting properties about graph connectivity.

Network flow problems extend these concepts. The max-flow min-cut theorem states that the maximum flow equals the minimum cut capacity, a beautiful duality result connecting optimization and graph structure.`,
};

const projectPostTexts = {
  notetime: `NoteTime

Try it at https://notetime.ai.`,
  fallingsand: `Falling Sand Game (working title)
Status: In development - not yet announced

A falling-sand simulation crossed with a mining game, written in Rust. Every pixel is a cell with real physical behavior: sand piles, water flows, lava ignites wood, steam rises when the two meet, and the world is fully destructible.

The simulation runs on the GPU via compute shaders, which is what makes it viable at a meaningful scale: millions of cells updated in parallel per frame instead of the thousands a CPU-bound cellular automaton tops out at. The mining layer sits on top of the sim, so tunnels collapse, fluids drain into what you dig, and ore veins react to heat and pressure like everything else.

More details coming when it's ready to announce.`,
};

const aboutPortfolioRows = [
  { icon: "/about-portfolio-icons/terminal.png", label: "Full Stack Engineer" },
  { icon: "/about-portfolio-icons/ai.png", label: "AI Explorer" },
  { icon: "/about-portfolio-icons/chart.png", label: "Data Storyteller" },
  { icon: "/about-portfolio-icons/bulb.png", label: "Product Thinker" },
];

export default function DesktopOS({ embedded = false, modelScreen = false, mobileVariant, viewMode, onViewModeChange }: DesktopOSProps) {
  const { isFullscreen, setFullscreen } = useFullscreen();
  const isMobile = !!mobileVariant;
  const isMobilePortrait = mobileVariant === "portrait";
  const currentViewMode = viewMode ?? (isFullscreen ? "desktop" : "model");
  const initialIcons: Icon[] = baseIcons;
  const variantStorageSuffix = mobileVariant ?? "landscape";
  const iconStorageKey = isMobile ? `nx-icons-mobile-${variantStorageSuffix}` : "nx-icons";
  const trashPosStorageKey = isMobile ? `nx-trash-pos-mobile-${variantStorageSuffix}` : "nx-trash-pos";
  const binPosStorageKey = isMobile ? `nx-bin-pos-mobile-${variantStorageSuffix}` : "nx-bin-pos";
  const mobileWindowCascadeBase = { x: isMobilePortrait ? 8 : 14, y: isMobilePortrait ? 20 : 8 };
  const initialWindowCascadeBase = isMobile ? mobileWindowCascadeBase : WINDOW_CASCADE_BASE;
  const [icons, setIcons] = useState<Icon[]>(initialIcons);
  const [trash, setTrash] = useState<Icon[]>([]);
  const [testFolderItems, setTestFolderItems] = useState<BrowserItem[]>([]);
  const [projectFolderItems, setProjectFolderItems] = useState<BrowserItem[]>([
    { id: "project-notetime", label: "NoteTime.txt", type: "file", x: 20, y: 20, windowId: "project-notetime" },
    { id: "project-fallingsand", label: "FallingSandGame.txt", type: "file", x: 120, y: 20, windowId: "project-fallingsand" },
  ]);
  const [blogFolderItems, setBlogFolderItems] = useState<BrowserItem[]>([
    { id: "blog-recursion", label: "Recursive Algorithms.txt", type: "file", x: 20, y: 20, windowId: "blog-recursion" },
    { id: "blog-sorting", label: "Mathematics of Sorting.txt", type: "file", x: 120, y: 20, windowId: "blog-sorting" },
    { id: "blog-graphs", label: "Graph Theory.txt", type: "file", x: 220, y: 20, windowId: "blog-graphs" },
    { id: "test-folder", label: "Test Folder", type: "folder", x: 20, y: 120 },
  ]);
  const [windows, setWindows] = useState<Record<string, Win>>({
    about: { id: "about", open: false, z: 11, ...initialWindowCascadeBase },
    "about-portfolio": { id: "about-portfolio", open: false, z: 10 },
    skills: { id: "skills", open: false, z: 10 },
    calculator: { id: "calculator", open: false, z: 10 },
    activity: { id: "activity", open: false, z: 10 },
    todo: { id: "todo", open: false, z: 10 },
    "falling-sand": { id: "falling-sand", open: false, z: 10 },
    trash: { id: "trash", open: false, z: 10 },
    bin: { id: "bin", open: false, z: 10 },
    "blog-recursion": { id: "blog-recursion", open: false, z: 10 },
    "blog-sorting": { id: "blog-sorting", open: false, z: 10 },
    "blog-graphs": { id: "blog-graphs", open: false, z: 10 },
    "test-folder": { id: "test-folder", open: false, z: 10 },
    projects: { id: "projects", open: false, z: 10 },
    "project-notetime": { id: "project-notetime", open: false, z: 10 },
    "project-fallingsand": { id: "project-fallingsand", open: false, z: 10 },
  });
  const [nextZ, setNextZ] = useState(11);
  const [crtOff, setCrtOff] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [iconsReady, setIconsReady] = useState(false);
  const [loadedIconStorageKey, setLoadedIconStorageKey] = useState(iconStorageKey);
  const [darkMode, setDarkMode] = useState(true);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  // Central drag-and-drop controller state (see beginItemDrag/finishDrag)
  const dragStateRef = useRef<{
    source: DragSource;
    items: DragItem[];
    startPositions?: Map<string, { x: number; y: number }>;
  } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ item: DragItem; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<null | "apple" | "file" | "edit" | "view" | "go" | "window" | "help">(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; restricted?: boolean } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);
  const menubarRef = useRef<HTMLElement | null>(null);
  const binRef = useRef<HTMLButtonElement | null>(null);
  const [trashCtxMenu, setTrashCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const trashCtxRef = useRef<HTMLDivElement | null>(null);
  const [trashPos, setTrashPos] = useState<{ x: number; y: number } | null>(null);
  const [binPos, setBinPos] = useState<{ x: number; y: number } | null>(null);
  const binDragStateRef = useRef<{ hasDragged: boolean }>({ hasDragged: false });

  const getDesktopSize = () => {
    const desktopEl = desktopRef.current;
    const desktopCss = desktopEl ? window.getComputedStyle(desktopEl) : null;
    const cssWidth = desktopCss ? parseFloat(desktopCss.width || "0") : 0;
    const cssHeight = desktopCss ? parseFloat(desktopCss.height || "0") : 0;
    const deskRect = desktopEl?.getBoundingClientRect();
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight - 28 : 772;
    const width = cssWidth || desktopEl?.clientWidth || deskRect?.width || viewportWidth;
    const height = cssHeight || desktopEl?.clientHeight || deskRect?.height || viewportHeight;

    return {
      width: isMobile && !modelScreen ? Math.min(width, viewportWidth) : width,
      height: isMobile && !modelScreen ? Math.min(height, viewportHeight) : height,
    };
  };

  const getMobileTopRowLayout = () => {
    const { width } = getDesktopSize();
    return buildMobileTopRowLayout(width, isMobilePortrait);
  };

  const getDefaultBinPosition = () => {
    if (isMobile) {
      const mobileLayout = getMobileTopRowLayout();
      const bin = mobileLayout.bin ?? DESKTOP_BIN_POSITION;
      return clampToDesktop(bin.x, bin.y);
    }

    return clampToDesktop(DESKTOP_BIN_POSITION.x, DESKTOP_BIN_POSITION.y);
  };

  useEffect(() => {
    const saved = localStorage.getItem(iconStorageKey);
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
    const savedTrashPos = localStorage.getItem(trashPosStorageKey);
    if (savedTrashPos) {
      try {
        const p = JSON.parse(savedTrashPos) as { x: number; y: number };
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          const c = clampToDesktop(p.x, p.y);
          setTrashPos(c);
        }
      } catch {}
    } else {
      setTrashPos(null);
    }
    const savedBinPos = localStorage.getItem(binPosStorageKey);
    if (savedBinPos) {
      try {
        const p = JSON.parse(savedBinPos) as { x: number; y: number };
        if (typeof p?.x === 'number' && typeof p?.y === 'number') {
          const c = clampToDesktop(p.x, p.y);
          setBinPos(c);
        }
      } catch {}
    } else {
      setBinPos(null);
    }
    const savedCrt = localStorage.getItem("nx-crt-off");
    if (savedCrt === "1") setCrtOff(true);
    const update = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const t = setInterval(update, 30_000);
    setLoadedIconStorageKey(iconStorageKey);
    return () => clearInterval(t);
  }, [binPosStorageKey, iconStorageKey, initialIcons, trashPosStorageKey]);

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

  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    localStorage.setItem(iconStorageKey, JSON.stringify(icons));
  }, [icons, iconStorageKey, iconsReady, loadedIconStorageKey]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    localStorage.setItem("nx-trash", JSON.stringify(trash));
  }, [iconStorageKey, iconsReady, loadedIconStorageKey, trash]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    if (trashPos) {
      localStorage.setItem(trashPosStorageKey, JSON.stringify(trashPos));
    } else {
      localStorage.removeItem(trashPosStorageKey);
    }
  }, [iconStorageKey, iconsReady, loadedIconStorageKey, trashPos, trashPosStorageKey]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    if (binPos) {
      localStorage.setItem(binPosStorageKey, JSON.stringify(binPos));
    } else {
      localStorage.removeItem(binPosStorageKey);
    }
  }, [binPos, binPosStorageKey, iconStorageKey, iconsReady, loadedIconStorageKey]);

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

  // ============================================================
  // Central drag-and-drop controller
  //
  // Every drag (desktop icons, folder items, trash items) reports to this
  // one place. Targets are resolved with elementsFromPoint so the topmost
  // window under the cursor wins, exactly like a native desktop.
  // ============================================================

  const folderRegistry: Record<string, { items: BrowserItem[]; setItems: React.Dispatch<React.SetStateAction<BrowserItem[]>> }> = {
    blog: { items: blogFolderItems, setItems: setBlogFolderItems },
    "test-folder": { items: testFolderItems, setItems: setTestFolderItems },
    projects: { items: projectFolderItems, setItems: setProjectFolderItems },
  };
  const folderCounts: Record<string, number> = {
    blog: blogFolderItems.length,
    "test-folder": testFolderItems.length,
    projects: projectFolderItems.length,
  };

  function resolveDrop(clientX: number, clientY: number): { key: string; el: HTMLElement } | null {
    const st = dragStateRef.current;
    if (!st) return null;
    const draggedIds = new Set(st.items.map((i) => i.id));
    for (const raw of document.elementsFromPoint(clientX, clientY)) {
      if (!(raw instanceof HTMLElement)) continue;
      const icon = raw.closest<HTMLElement>(".desktop-icon");
      // Skip whatever is being dragged — it sits right under the cursor
      if (icon && (icon.classList.contains("dragging") || draggedIds.has(icon.dataset.id || ""))) continue;
      const zoneEl = raw.closest<HTMLElement>("[data-dropzone]");
      const winEl = raw.closest<HTMLElement>(".window");
      if (zoneEl && (!winEl || winEl.contains(zoneEl))) {
        const kind = zoneEl.dataset.dropzone;
        if (kind === "ifolder") {
          const id = zoneEl.dataset.id || "";
          if (id && !draggedIds.has(id) && folderRegistry[id]) return { key: `folder:${id}`, el: zoneEl };
          continue;
        }
        if (kind === "bfolder") {
          const id = zoneEl.dataset.folderId || "";
          const sameSource = st.source.kind === "folder" && st.source.folderId === id;
          if (id && !draggedIds.has(id) && !sameSource && folderRegistry[id]) return { key: `folder:${id}`, el: zoneEl };
          continue;
        }
        if (kind === "window") {
          const id = zoneEl.dataset.folderId || "";
          if (draggedIds.has(id)) return null; // folder into its own window
          return { key: `window:${id}`, el: zoneEl };
        }
        if (kind === "trashwin") return { key: "trashwin", el: zoneEl };
        if (kind === "bin") {
          if (st.source.kind !== "trash") return { key: "bin", el: zoneEl };
          continue;
        }
        if (kind === "desktop") return { key: "desktop", el: zoneEl };
        continue;
      }
      if (winEl) return null;      // over a plain window: not a target
      if (icon) continue;          // over a loose icon: what's underneath decides
    }
    return null;
  }

  function updateDropTarget(clientX: number, clientY: number) {
    if (!dragStateRef.current) return;
    setDropTarget(resolveDrop(clientX, clientY)?.key ?? null);
  }

  /** Pointer position → local top-left inside a drop zone, icon anchored under the cursor. */
  function zoneLocalPoint(el: HTMLElement, clientX: number, clientY: number) {
    const m = createLocalCoordinateMetrics(el);
    const p = m.clientToLocal(clientX, clientY);
    return {
      x: Math.max(8, Math.min(Math.max(8, m.width - BROWSER_ICON_SIZE - 8), p.x - 48)),
      y: Math.max(8, Math.min(Math.max(8, m.height - BROWSER_ICON_SIZE - 8), p.y - 30)),
    };
  }

  function finishDrag(clientX: number, clientY: number, didDrag: boolean) {
    const st = dragStateRef.current;
    dragStateRef.current = null;
    setDragGhost(null);
    setDropTarget(null);
    if (!st || !didDrag) return;
    dragStateRef.current = st;               // resolveDrop needs it
    const resolved = resolveDrop(clientX, clientY);
    dragStateRef.current = null;
    const ids = st.items.map((i) => i.id);

    if (!resolved) {
      // Cancelled (over a plain window / menubar): desktop icons snap back.
      if (st.source.kind === "desktop" && st.startPositions) {
        const starts = st.startPositions;
        setIcons((prev) => prev.map((i) => (starts.has(i.id) ? { ...i, ...starts.get(i.id)! } : i)));
      }
      return;
    }
    const { key, el } = resolved;

    const removeFromSource = () => {
      if (st.source.kind === "desktop") {
        setIcons((prev) => prev.filter((i) => !ids.includes(i.id)));
        setSelection(new Set());
      } else if (st.source.kind === "folder") {
        const folderId = st.source.folderId;
        folderRegistry[folderId]?.setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      } else {
        setTrash((prev) => prev.filter((i) => !ids.includes(i.id)));
      }
    };

    if (key === "desktop") {
      if (st.source.kind === "desktop") return; // already live-moved
      const p = clientToDesktop(clientX, clientY);
      const base = p ? clampToDesktop(p.left - 48, p.top - 30) : clampToDesktop(40, 80);
      setIcons((prev) => {
        const next = prev.map((i) => {
          const hit = st.items.find((it) => it.id === i.id);
          return hit ? { ...i, x: base.x, y: base.y } : i;
        });
        const additions = st.items
          .filter((it) => !prev.some((i) => i.id === it.id))
          .map((it, idx) => ({
            id: it.id,
            label: it.label,
            app: it.app,
            type: it.type,
            ...clampToDesktop(base.x + idx * 24, base.y + idx * 24),
          }));
        return [...next, ...additions];
      });
      removeFromSource();
      return;
    }

    if (key === "bin") {
      addToTrash(st.items.map((it) => ({ id: it.id, label: it.label, app: it.app, type: it.type, x: 0, y: 0 })));
      removeFromSource();
      return;
    }

    if (key === "trashwin") {
      const pos = zoneLocalPoint(el, clientX, clientY);
      if (st.source.kind === "trash") {
        setTrash((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, x: pos.x, y: pos.y } : i)));
        return;
      }
      addToTrash(st.items.map((it, idx) => ({
        id: it.id,
        label: it.label,
        app: it.app,
        type: it.type,
        x: pos.x + (idx % 3) * 100,
        y: pos.y + Math.floor(idx / 3) * 100,
      })));
      removeFromSource();
      return;
    }

    const folderMatch = key.match(/^(?:window|folder):(.*)$/);
    if (folderMatch) {
      const targetId = folderMatch[1];
      const reg = folderRegistry[targetId];
      if (!reg) return;
      const droppedOnWindow = key.startsWith("window:");
      const pos = droppedOnWindow ? zoneLocalPoint(el, clientX, clientY) : null;

      if (st.source.kind === "folder" && st.source.folderId === targetId) {
        // Reposition within the same folder window
        if (pos) reg.setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, x: pos.x, y: pos.y } : i)));
        return;
      }

      reg.setItems((prev) => {
        const existing = new Set(prev.map((i) => i.id));
        const startSlot = prev.length;
        const additions = st.items
          .filter((it) => !existing.has(it.id))
          .map((it, idx) => ({
            id: it.id,
            label: it.label,
            type: it.type === "folder" ? ("folder" as const) : ("file" as const),
            x: pos ? pos.x + (idx % 3) * 100 : 20 + ((startSlot + idx) % 3) * 100,
            y: pos ? pos.y + Math.floor(idx / 3) * 100 : 20 + Math.floor((startSlot + idx) / 3) * 100,
            windowId: it.type === "folder" ? undefined : it.app,
          }));
        return [...prev, ...additions];
      });
      removeFromSource();
      return;
    }
  }

  /** Start dragging an item that lives in a folder window or the trash. */
  function beginItemDrag(e: React.PointerEvent, source: DragSource, item: DragItem) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragging = true;
        dragStateRef.current = { source, items: [item] };
      }
      const p = clientToDesktop(ev.clientX, ev.clientY);
      if (p) setDragGhost({ item, x: p.left - 48, y: p.top - 30 });
      updateDropTarget(ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      finishDrag(ev.clientX, ev.clientY, dragging);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Desktop icons live-move; the controller only tracks targets and the drop. */
  function beginDesktopDrag(iconIds: string[]) {
    const dragged = icons.filter((i) => iconIds.includes(i.id));
    dragStateRef.current = {
      source: { kind: "desktop" },
      items: dragged.map((i) => ({ id: i.id, label: i.label, app: i.app, type: i.type })),
      startPositions: new Map(dragged.map((i) => [i.id, { x: i.x, y: i.y }])),
    };
  }

  useEffect(() => {
    const crt = document.querySelector(".crt");
    if (!crt) return;
    crt.classList.toggle("crt-off", crtOff);
    localStorage.setItem("nx-crt-off", crtOff ? "1" : "0");
  }, [crtOff]);

  useEffect(() => {
    const savedDark = localStorage.getItem("nx-dark-mode");
    if (savedDark === "0") setDarkMode(false);
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

  const openCascadeIndexRef = useRef(1);
  const getCascadedWindowPosition = (index: number) => {
    const slot = index % WINDOW_CASCADE_SLOTS;
    const desktopEl = desktopRef.current;
    const desktopCss = desktopEl ? window.getComputedStyle(desktopEl) : null;
    const desktopCssWidth = desktopCss ? parseFloat(desktopCss.width || "0") : 0;
    const desktopCssHeight = desktopCss ? parseFloat(desktopCss.height || "0") : 0;
    const desktopWidth = desktopCssWidth || (typeof window !== "undefined" ? window.innerWidth : 1280);
    const desktopHeight = desktopCssHeight || (typeof window !== "undefined" ? window.innerHeight - 28 : 772);
    const estimatedWindowWidth = isMobile
      ? Math.min(desktopWidth * (isMobilePortrait ? 0.86 : 0.84), isMobilePortrait ? 420 : 480)
      : 220;
    const estimatedWindowHeight = isMobile ? Math.min(400, Math.max(260, desktopHeight - 16)) : 96;
    const maxX = Math.max(8, desktopWidth - estimatedWindowWidth - 8);
    const maxY = Math.max(0, desktopHeight - estimatedWindowHeight - 8);
    const base = isMobile ? mobileWindowCascadeBase : WINDOW_CASCADE_BASE;
    const step = isMobile ? MOBILE_WINDOW_CASCADE_STEP : WINDOW_CASCADE_STEP;
    const x = base.x + slot * step.x;
    const y = base.y + slot * step.y;

    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(0, y)),
    };
  };

  const openWin = (id: string) => {
    const currentWindow = windows[id];
    if (!currentWindow) return;

    const shouldCascade = !currentWindow.open;
    const nextPosition = shouldCascade ? getCascadedWindowPosition(openCascadeIndexRef.current) : null;
    if (shouldCascade) openCascadeIndexRef.current += 1;

    setWindows((w) => {
      if (!w[id]) return w;
      return { ...w, [id]: { ...w[id], ...(nextPosition ?? {}), open: true, z: nextZ + 1 } };
    });
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
    ICON_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("nx-trash");
    setTrashPos(null);
    TRASH_POSITION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setBinPos(null);
    BIN_POSITION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
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
    const { width, height } = getDesktopSize();
    const iconSize = isMobile ? MOBILE_ICON_SIZE : DESKTOP_ICON_SIZE;
    const maxX = Math.max(8, width - iconSize - 8);
    const maxY = Math.max(0, height - iconSize - 8);
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
    const point = createLocalCoordinateMetrics(desktopRef.current).clientToLocal(clientX, clientY);
    return { left: point.x, top: point.y };
  }

  // Drag-to-trash disabled

  function arrangeIcons() {
    setIcons((list) => {
      if (isMobile) {
        const mobileLayout = getMobileTopRowLayout();
        return list.map((icon) => {
          const position = mobileLayout[icon.id as keyof typeof mobileLayout];
          return position ? { ...icon, ...position } : icon;
        });
      }

      const colWidth = isMobile ? 150 : 120;
      const rowHeight = isMobile ? 126 : 96;
      const startX = isMobile ? 28 : 40;
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

  function resetTrashPosition() {
    setTrashPos(null);
    setBinPos(null);
    TRASH_POSITION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    BIN_POSITION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
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
    const point = clientToDesktop(e.clientX, e.clientY);
    if (!point) return;
    setCtxMenu({ x: point.left, y: point.top, restricted });
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
    const desktop = desktopRef.current!;
    desktop.appendChild(el);
    // Compute screen-to-local coordinate transform using reference points
    // This correctly handles rotation, scale, and perspective from CSS3D transforms
    const toLocal = (() => {
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:absolute;pointer-events:none;width:0;height:0;visibility:hidden';
      desktop.appendChild(tmp);
      tmp.style.left = '0px'; tmp.style.top = '0px';
      const p0 = tmp.getBoundingClientRect();
      tmp.style.left = '100px';
      const p1 = tmp.getBoundingClientRect();
      tmp.style.left = '0px'; tmp.style.top = '100px';
      const p2 = tmp.getBoundingClientRect();
      tmp.remove();
      // Forward: screen = A * local + T where A = [[a,c],[b,d]]
      const a = (p1.left - p0.left) / 100;
      const b = (p1.top - p0.top) / 100;
      const c = (p2.left - p0.left) / 100;
      const d = (p2.top - p0.top) / 100;
      const tx = p0.left, ty = p0.top;
      const det = a * d - c * b;
      return (cx: number, cy: number) => {
        const dx = cx - tx, dy = cy - ty;
        return { x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det };
      };
    })();
    const move = (ev: MouseEvent) => {
      if (!marqueeStart.current || !marqueeRef.current || !desktopRef.current) return;
      const s = toLocal(marqueeStart.current.x, marqueeStart.current.y);
      const e = toLocal(ev.clientX, ev.clientY);
      const left = Math.min(s.x, e.x);
      const top = Math.min(s.y, e.y);
      const width = Math.abs(e.x - s.x);
      const height = Math.abs(e.y - s.y);
      Object.assign(marqueeRef.current.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
      // Hit-test in screen coordinates so zoom/rotation transforms don't cause offset
      const boxLeft = Math.min(marqueeStart.current.x, ev.clientX);
      const boxTop = Math.min(marqueeStart.current.y, ev.clientY);
      const boxRight = Math.max(marqueeStart.current.x, ev.clientX);
      const boxBottom = Math.max(marqueeStart.current.y, ev.clientY);
      const buttons = desktopRef.current.querySelectorAll<HTMLButtonElement>(`.desktop-icon`);
      const sel = new Set<string>();
      buttons.forEach((btn) => {
        const r = btn.getBoundingClientRect();
        const id = btn.dataset.id || "";
        const inter = !(r.right < boxLeft || r.left > boxRight || r.bottom < boxTop || r.top > boxBottom);
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
    embedded && !modelScreen ? "embedded-screen" : "",
    modelScreen ? "model-screen-content" : "",
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
  const defaultBinPos = binPos || getDefaultBinPosition();
  const toggleViewMode = () => {
    const nextMode: ViewMode = currentViewMode === "desktop" ? "model" : "desktop";
    if (onViewModeChange) {
      onViewModeChange(nextMode);
    } else {
      setFullscreen(nextMode === "desktop");
    }
    setOpenMenu(null);
  };

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
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("about-portfolio"); setOpenMenu(null); }}>About Storm Bartlett</button>
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

          <div className={`menu ${openMenu === "view" ? "is-open" : ""}`} data-id="view">
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "view"} onClick={() => toggleMenu("view")} onMouseEnter={() => trackHover("view")}>
              View
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={toggleViewMode}>
                {currentViewMode === "desktop" ? "View Model" : "View Desktop"}
              </button>
              <button className="menu-entry" role="menuitem" onClick={() => { arrangeIcons(); setOpenMenu(null); }}>Arrange Icons</button>
              {!isMobile && (
                <button className="menu-entry" role="menuitem" onClick={() => { resetIcons(); setOpenMenu(null); }}>Reset Desktop Icons</button>
              )}
              <button className="menu-entry" role="menuitem" onClick={() => { resetTrashPosition(); setOpenMenu(null); }}>{isMobile ? "Reset Trash" : "Reset Trash Position"}</button>
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

      <main id="desktop" className="desktop" ref={desktopRef} data-dropzone="desktop" onContextMenu={onContextMenu} onMouseDown={onDesktopMouseDown}>
        {icons.map((icon) => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            icons={icons}
            canDrag={iconsReady}
            setIcons={setIcons}
            selection={selection}
            setSelection={setSelection}
            isDropTarget={dropTarget === `folder:${icon.id}`}
            onDragStart={beginDesktopDrag}
            onDragMove={updateDropTarget}
            onDragEnd={finishDrag}
            onDbl={() => { if (windows[icon.app]) openWin(icon.app); }}
          />
        ))}

        {/* Drag ghost: single overlay following the pointer during item drags */}
        {dragGhost && (
          <div
            className="drag-ghost-layer"
            style={{ position: "absolute", left: dragGhost.x, top: dragGhost.y, zIndex: 30000, pointerEvents: "none" }}
          >
            <div className="desktop-icon drag-ghost-icon" style={{ position: "relative", left: 0, top: 0 }}>
              <div className="icon">
                <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
                  <use href={`#${getSpriteId({ ...dragGhost.item, type: dragGhost.item.type })}`}></use>
                </svg>
              </div>
              <span className="icon-label">{dragGhost.item.label}</span>
            </div>
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
            
            const desktopMetrics = createLocalCoordinateMetrics(desktopRef.current);
            const startLocal = desktopMetrics.clientToLocal(startX, startY);
            
            // Use the stored position as starting point (like DesktopIcon does with icon.x/y)
            const currentPos = trashPos || defaultTrashPos;
            const sx = currentPos.x;
            const sy = currentPos.y;
            let dragging = false;
            
            const move = (ev: PointerEvent) => {
              const currentLocal = desktopMetrics.clientToLocal(ev.clientX, ev.clientY);
              const dx = currentLocal.x - startLocal.x;
              const dy = currentLocal.y - startLocal.y;
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
          className={`desktop-icon trash-icon ${trash.length > 0 ? 'has-items' : ''} ${dropTarget === 'bin' ? 'is-over' : ''} ${selection.has("bin") ? "is-selected" : ""}`}
          data-id="bin"
          data-dropzone="bin"
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
            const desktopMetrics = createLocalCoordinateMetrics(desktopRef.current);
            const startLocal = desktopMetrics.clientToLocal(startX, startY);
            
            // Use the stored position as starting point (like DesktopIcon does with icon.x/y)
            const currentPos = binPos || defaultBinPos;
            const sx = currentPos.x;
            const sy = currentPos.y;
            let dragging = false;
            
            const move = (ev: PointerEvent) => {
              const currentLocal = desktopMetrics.clientToLocal(ev.clientX, ev.clientY);
              const dx = currentLocal.x - startLocal.x;
              const dy = currentLocal.y - startLocal.y;
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
            const point = clientToDesktop(e.clientX, e.clientY);
            if (!point) return;
            setTrashCtxMenu({ x: point.left, y: point.top, id: 'bin' });
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
          <TiptapEditor initialText={aboutText} />
        </Window>
        <Window id="about-portfolio" title="About Storm Bartlett" windows={windows} frontWin={frontWin} closeWin={closeWin} className="about-portfolio-window">
          <AboutPortfolioContent />
        </Window>
        <Window id="skills" title="Skills" windows={windows} frontWin={frontWin} closeWin={closeWin}>
          <TiptapEditor initialText={skillsText} />
        </Window>
        <Window id="calculator" title="Calculator" windows={windows} frontWin={frontWin} closeWin={closeWin} className="calculator-window">
          <Calculator />
        </Window>
        <Window id="activity" title="Activity Monitor" windows={windows} frontWin={frontWin} closeWin={closeWin} className="activity-window">
          <ActivityMonitor openWin={openWin} />
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
            folderId="blog"
            items={blogFolderItems}
            setItems={setBlogFolderItems}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts}
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
            darkMode={darkMode}
            openWin={openWin}
            windows={windows}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
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
            folderId="test-folder"
            items={testFolderItems}
            setItems={setTestFolderItems}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts}
          />
        </Window>
        <Window id="projects" title="Projects" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <BlogBrowser
            folderId="projects"
            items={projectFolderItems}
            setItems={setProjectFolderItems}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts}
          />
        </Window>
        <Window id="project-notetime" title="NoteTime.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <ProjectPostContent postId="notetime" />
        </Window>
        <Window id="project-fallingsand" title="FallingSandGame.txt" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window blog-post-window">
          <ProjectPostContent postId="fallingsand" />
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

function DesktopIcon({ icon, icons, canDrag, setIcons, selection, setSelection, onDbl, onDragStart, onDragMove, onDragEnd, isDropTarget }: { icon: Icon; icons: Icon[]; canDrag: boolean; setIcons: React.Dispatch<React.SetStateAction<Icon[]>>; selection: Set<string>; setSelection: (s: Set<string>) => void; onDbl: () => void; onDragStart?: (ids: string[]) => void; onDragMove?: (x: number, y: number) => void; onDragEnd?: (x: number, y: number, dragging: boolean) => void; isDropTarget?: boolean; }) {
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
    const desktopEl = ref.current?.closest('.desktop') as HTMLElement | null;
    const desktopMetrics = desktopEl ? createLocalCoordinateMetrics(desktopEl) : null;
    const startLocal = desktopMetrics?.clientToLocal(startX, startY) ?? { x: startX, y: startY };
    const desktopCss = desktopEl ? window.getComputedStyle(desktopEl) : null;
    const desktopCssWidth = desktopCss ? parseFloat(desktopCss.width || "0") : 0;
    const desktopCssHeight = desktopCss ? parseFloat(desktopCss.height || "0") : 0;
    const iconSize = desktopEl?.classList.contains("mobile") ? MOBILE_ICON_SIZE : DESKTOP_ICON_SIZE;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight - 28 : 772;
    const deskWidth = desktopCssWidth || desktopEl?.clientWidth || viewportWidth;
    const deskHeight = desktopCssHeight || desktopEl?.clientHeight || viewportHeight;
    const maxX = Math.max(8, deskWidth - iconSize - 8);
    const maxY = Math.max(0, deskHeight - iconSize - 8);
    const starts = new Map<string, { x: number; y: number }>();
    icons.forEach((it) => {
      if (nextSel.has(it.id)) starts.set(it.id, { x: it.x, y: it.y });
    });
    let dragging = false;
    const move = (ev: PointerEvent) => {
      const currentLocal = desktopMetrics?.clientToLocal(ev.clientX, ev.clientY) ?? { x: ev.clientX, y: ev.clientY };
      const dx = currentLocal.x - startLocal.x;
      const dy = currentLocal.y - startLocal.y;
      if (!dragging) {
        const dist = Math.hypot(dx, dy);
        if (dist < 4) return;
        dragging = true;
        try { ref.current?.setPointerCapture(e.pointerId); } catch {}
        ref.current?.classList.add('dragging');
        if (onDragStart) onDragStart(Array.from(nextSel));
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
  const spriteId = getIconSpriteId(icon);
  return (
    <button ref={ref} className={`desktop-icon ${selection.has(icon.id) ? "is-selected" : ""} ${burst ? "is-burst" : ""} ${isDropTarget ? "is-over" : ""}`} data-id={icon.id} data-folder={icon.type === "folder" ? "true" : undefined} data-dropzone={icon.type === "folder" ? "ifolder" : undefined} style={{ left: icon.x, top: icon.y, position: "absolute" }} onDoubleClick={onDbl} onPointerDown={down} onClick={() => { setBurst(true); window.setTimeout(() => setBurst(false), 500); }}>
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
  const [closeHover, setCloseHover] = useState(false);
  const restoreStateRef = useRef<{ left: string; top: string; width: string; height: string } | null>(null);
  const w = windows[id];
  useEffect(() => {
    if (!w?.open || w.x === undefined || w.y === undefined || !divRef.current) return;
    divRef.current.style.left = `${w.x}px`;
    divRef.current.style.top = `${w.y}px`;
  }, [w?.open, w?.x, w?.y]);

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
    const dragPlane = divRef.current?.closest('.desktop') as HTMLElement | null;
    const dragMetrics = dragPlane ? createLocalCoordinateMetrics(dragPlane) : null;
    const startLocal = dragMetrics?.clientToLocal(startX, startY) ?? { x: startX, y: startY };
    
    // Get initial window position - read from computed style, which is already in CSS pixels
    const computedStyle = divRef.current ? window.getComputedStyle(divRef.current) : null;
    const windowStartX = computedStyle ? parseFloat(computedStyle.left) || 80 : 80;
    const windowStartY = computedStyle ? parseFloat(computedStyle.top) || 80 : 80;
    
    frontWin(id);
    const move = (ev: PointerEvent) => {
      const currentLocal = dragMetrics?.clientToLocal(ev.clientX, ev.clientY) ?? { x: ev.clientX, y: ev.clientY };
      const dx = currentLocal.x - startLocal.x;
      const dy = currentLocal.y - startLocal.y;
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
    const el = divRef.current;
    if (!el) return;
    const resizePlane = el.closest('.desktop') as HTMLElement | null;
    const resizeMetrics = resizePlane ? createLocalCoordinateMetrics(resizePlane) : null;
    const startLocal = resizeMetrics?.clientToLocal(startX, startY) ?? { x: startX, y: startY };
    
    const startLeft = parseInt(el.style.left || "80", 10);
    const startTop = parseInt(el.style.top || "80", 10);
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const computedStyle = window.getComputedStyle(el);
    const cssMinWidth = parseFloat(computedStyle.minWidth || "0");
    const cssMinHeight = parseFloat(computedStyle.minHeight || "0");
    const minWidth = Math.max(Number.isFinite(cssMinWidth) ? cssMinWidth : 0, 200);
    const minHeight = Math.max(Number.isFinite(cssMinHeight) ? cssMinHeight : 0, 150);
    
    const move = (ev: PointerEvent) => {
      const currentLocal = resizeMetrics?.clientToLocal(ev.clientX, ev.clientY) ?? { x: ev.clientX, y: ev.clientY };
      const dx = currentLocal.x - startLocal.x;
      const dy = currentLocal.y - startLocal.y;
      
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
      <header className="titlebar" onPointerDown={(e)=>{ e.preventDefault(); e.stopPropagation(); down(e); }} onDoubleClick={toggleMaximize}>
        <div className="title">{title}</div>
        <div className="window-controls">
          <button
            className="btn-zoom"
            type="button"
            aria-label={`Zoom ${title}`}
            title="Zoom"
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
          >
            Zoom
          </button>
          <button
            className={`btn-close ${closeHover ? "is-hovered" : ""}`}
            type="button"
            aria-label={`Close ${title}`}
            title="Close"
            onPointerEnter={() => setCloseHover(true)}
            onPointerMove={() => setCloseHover(true)}
            onPointerLeave={() => setCloseHover(false)}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            onBlur={() => setCloseHover(false)}
            onClick={() => closeWin(id)}
          >
            Close
          </button>
        </div>
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
  setTrash,
  restoreIcon,
  restoreAll,
  trashCtxMenu,
  setTrashCtxMenu,
  trashCtxRef,
  darkMode,
  openWin,
  windows,
  beginItemDrag,
  dropTarget,
  dragSourceId,
}: {
  trash: Icon[];
  setTrash: React.Dispatch<React.SetStateAction<Icon[]>>;
  restoreIcon: (id: string, at?: { x: number; y: number }) => void;
  restoreAll: () => void;
  trashCtxMenu: { x: number; y: number; id: string } | null;
  setTrashCtxMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; id: string } | null>>;
  trashCtxRef: React.RefObject<HTMLDivElement | null>;
  darkMode: boolean;
  openWin: (id: string) => void;
  windows: Record<string, Win>;
  beginItemDrag: (e: React.PointerEvent, source: DragSource, item: DragItem) => void;
  dropTarget: string | null;
  dragSourceId: string | null;
}) {
  const browserRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());

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
      className={`blog-browser ${dropTarget === "trashwin" ? "is-drop-target" : ""}`}
      ref={browserRef}
      data-dropzone="trashwin"
      onPointerDown={(e) => {
        if (e.target === browserRef.current) setSelection(new Set());
      }}
    >
      {trash.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text)" }}>
          <p>Trash is empty</p>
        </div>
      ) : (
        trash.map((icon) => (
          <button
            key={icon.id}
            className={`browser-icon ${selection.has(icon.id) ? "is-selected" : ""} ${dragSourceId === icon.id ? "is-drag-source" : ""}`}
            style={{ position: "absolute", left: icon.x, top: icon.y }}
            onClick={() => setSelection(new Set([icon.id]))}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (icon.app && windows[icon.app]) openWin(icon.app);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const browserRect = browserRef.current?.getBoundingClientRect();
              if (browserRect) {
                setTrashCtxMenu({ x: e.clientX - browserRect.left, y: e.clientY - browserRect.top, id: icon.id });
              }
              if (!selection.has(icon.id)) setSelection(new Set([icon.id]));
            }}
            onPointerDown={(e) => beginItemDrag(e, { kind: "trash" }, { id: icon.id, label: icon.label, app: icon.app, type: icon.type })}
          >
            <div className="icon">
              <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
                <use href={`#${getSpriteId(icon)}`}></use>
              </svg>
            </div>
            <span className="icon-label">{icon.label}</span>
          </button>
        ))
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
  folderId,
  items,
  setItems,
  windows,
  openWin,
  setNextZ,
  darkMode,
  beginItemDrag,
  dropTarget,
  dragSourceId,
  folderCounts,
}: {
  folderId: string;
  items: BrowserItem[];
  setItems: React.Dispatch<React.SetStateAction<BrowserItem[]>>;
  windows: Record<string, Win>;
  openWin: (id: string) => void;
  setNextZ: (fn: (z: number) => number) => void;
  darkMode: boolean;
  beginItemDrag: (e: React.PointerEvent, source: DragSource, item: DragItem) => void;
  dropTarget: string | null;
  dragSourceId: string | null;
  folderCounts: Record<string, number>;
}) {
  const browserRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [browserCtxMenu, setBrowserCtxMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const browserCtxMenuRef = useRef<HTMLDivElement | null>(null);

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

  const openItem = (item: BrowserItem) => {
    if (item.type === "file" && item.windowId) {
      if (windows[item.windowId]) openWin(item.windowId);
      setNextZ((z) => z + 1);
    } else if (item.type === "folder") {
      openWin(item.id);
      setNextZ((z) => z + 1);
    }
  };

  return (
    <div
      className={`blog-browser ${dropTarget === `window:${folderId}` ? "is-drop-target" : ""}`}
      ref={browserRef}
      data-dropzone="window"
      data-folder-id={folderId}
      onPointerDown={(e) => {
        if (e.target === browserRef.current) setSelection(new Set());
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          className={`browser-icon ${item.type} ${selection.has(item.id) ? "is-selected" : ""} ${dragSourceId === item.id ? "is-drag-source" : ""} ${item.type === "folder" && dropTarget === `folder:${item.id}` ? "drag-over" : ""}`}
          data-dropzone={item.type === "folder" ? "bfolder" : undefined}
          data-folder-id={item.type === "folder" ? item.id : undefined}
          style={{ position: "absolute", left: item.x, top: item.y }}
          onClick={() => setSelection(new Set([item.id]))}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            openItem(item);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!browserRef.current) return;
            const browserRect = browserRef.current.getBoundingClientRect();
            setBrowserCtxMenu({ x: e.clientX - browserRect.left, y: e.clientY - browserRect.top, itemId: item.id });
            if (!selection.has(item.id)) setSelection(new Set([item.id]));
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            beginItemDrag(e, { kind: "folder", folderId }, {
              id: item.id,
              label: item.label,
              app: item.type === "folder" ? item.id : item.windowId || item.id,
              type: item.type,
            });
          }}
        >
          <div className="icon">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
              <use href={`#${getSpriteId(item)}`}></use>
            </svg>
          </div>
          <span className="icon-label">{item.label}</span>
          {item.type === "folder" && (folderCounts[item.id] ?? 0) > 0 && (
            <span className="folder-count" aria-label={`${folderCounts[item.id]} items`}>{folderCounts[item.id]}</span>
          )}
        </button>
      ))}

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
            if (item) openItem(item);
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
  return <TiptapEditor initialText={blogPostTexts[postId]} />;
}

function ProjectPostContent({ postId }: { postId: "notetime" | "fallingsand" }) {
  return <TiptapEditor initialText={projectPostTexts[postId]} />;
}

function AboutPortfolioContent() {
  return (
    <div className="about-portfolio">
      <div className="about-portfolio-header">
        <Image src="/about-portfolio-icons/mac.png" alt="" width={48} height={48} className="about-portfolio-mac" aria-hidden="true" />
        <div className="about-portfolio-copy">
          <div>Storm Bartlett</div>
          <div>Builder.</div>
          <div>Forever Curious.</div>
        </div>
      </div>
      <div className="about-portfolio-rule" aria-hidden="true" />
      <ul className="about-portfolio-list" aria-label="Portfolio highlights">
        {aboutPortfolioRows.map((row) => (
          <li key={row.label} className="about-portfolio-row">
            <Image src={row.icon} alt="" width={28} height={28} className="about-portfolio-icon" aria-hidden="true" />
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
      <div className="about-portfolio-rule" aria-hidden="true" />
      <div className="about-portfolio-location">New South Wales, Australia</div>
    </div>
  );
}

type ActivityProcess = {
  pid: number;
  name: string;
  status: string;
  base: number;   // typical %CPU
  jitter: number; // random-walk range around base
  href?: string;  // external link
  opens?: string; // window id to open on double-click
};

const ACTIVITY_PROCESSES: ActivityProcess[] = [
  { pid: 404, name: "noteception.com", status: "running", base: 58, jitter: 14, href: "https://noteception.com" },
  { pid: 1024, name: "Xenostratum", status: "compiling", base: 76, jitter: 16, opens: "falling-sand" },
  { pid: 7, name: "learning_rust", status: "fighting borrowck", base: 38, jitter: 20 },
  { pid: 68, name: "vibe_coding", status: "vibing", base: 3, jitter: 2 },
];

function ActivityMonitor({ openWin }: { openWin: (id: string) => void }) {
  const [tick, setTick] = useState(0);
  const [cpus, setCpus] = useState<number[]>(() => ACTIVITY_PROCESSES.map((p) => p.base));
  const historyRef = useRef<number[]>([]);
  const graphRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTick((k) => k + 1);
      setCpus((prev) =>
        prev.map((v, i) => {
          const p = ACTIVITY_PROCESSES[i];
          const next = v + (Math.random() - 0.5) * p.jitter;
          const min = Math.max(1, p.base - p.jitter);
          const max = Math.min(99, p.base + p.jitter);
          return Math.round(Math.min(max, Math.max(min, next)));
        })
      );
    }, 900);
    return () => clearInterval(t);
  }, []);

  const total = Math.min(100, Math.round(cpus.reduce((a, b) => a + b, 0) / cpus.length));

  // Blocky scrolling load graph, quantised into 4px cells
  useEffect(() => {
    const hist = historyRef.current;
    hist.push(total);
    if (hist.length > 96) hist.shift();
    const canvas = graphRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const colW = 4;
    const gap = 2;
    const cols = Math.floor(width / (colW + gap));
    const recent = hist.slice(-cols);
    recent.forEach((v, i) => {
      const steps = Math.max(1, Math.round((v / 100) * (height / 4)));
      for (let s = 0; s < steps; s++) {
        ctx.fillRect(i * (colW + gap), height - (s + 1) * 4 + 1, colW, 3);
      }
    });
  }, [total]);

  return (
    <div className="activity">
      <div className="activity-summary">
        <span>CPU LOAD</span>
        <span>{total}%</span>
      </div>
      <canvas ref={graphRef} className="activity-graph" width={396} height={64} aria-label="CPU load history" />
      <div className="proc-row proc-header" aria-hidden="true">
        <span>PID</span>
        <span>Process</span>
        <span>Status</span>
        <span className="proc-cpu">%CPU</span>
        <span />
      </div>
      {ACTIVITY_PROCESSES.map((p, i) => (
        <div
          key={p.pid}
          className="proc-row"
          onDoubleClick={p.opens ? () => openWin(p.opens!) : undefined}
          title={p.opens ? "Double-click to open" : undefined}
        >
          <span>{p.pid}</span>
          <span className="proc-name">
            {p.href ? (
              <a href={p.href} target="_blank" rel="noopener noreferrer">{p.name}</a>
            ) : (
              p.name
            )}
          </span>
          <span className="proc-status">
            {p.status}
            {p.status === "compiling" ? ".".repeat((tick % 3) + 1) : ""}
          </span>
          <span className="proc-cpu">{cpus[i]}</span>
          <div className="proc-bar" role="progressbar" aria-valuenow={cpus[i]} aria-valuemin={0} aria-valuemax={100}>
            <div className="proc-bar-fill" style={{ width: `${cpus[i]}%` }} />
          </div>
        </div>
      ))}
      <div className="activity-footer">{ACTIVITY_PROCESSES.length} processes &middot; 1 vibing &middot; mem 128K ok</div>
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
