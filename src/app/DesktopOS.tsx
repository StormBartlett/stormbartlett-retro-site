"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppErrorBoundary from "./AppErrorBoundary";
import dynamic from "next/dynamic";
import { AppGlyph, AppLauncher, appComponents, portfolioApps } from "./PortfolioApps";
import { installDesktopSounds } from "./DesktopSounds";
import { suppressDragClick } from "./dragClicks";
import { createLocalCoordinateMetrics } from "./desktopCoordinates";
import { desktopMoveError, FOLDER_STORAGE_KEY, purgeDesktopFolders, restoreDesktopFolders, restoreDesktopIcons, restoreDesktopTrash, type DesktopFolders } from "./desktopFiles";
import { hydrateDesktopPreferences } from "./apps/desktopPreferences";
const TiptapEditor = dynamic(() => import("./TiptapEditor"));
const TodoEditor = dynamic(() => import("./TodoEditor"));
const FallingSand = dynamic(() => import("./FallingSand"));
import { useFullscreen } from "./FullscreenContext";


const desktopStorage = {
  getItem(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } },
  setItem(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* Session remains usable when storage is unavailable. */ } },
  removeItem(key: string) { try { window.localStorage.removeItem(key); } catch {} },
};

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

const DESKTOP_BIN_POSITION = { x: 392, y: 44 };
const MOBILE_TOP_ROW_ORDER = ["about", "projects", "playground", "pixel-studio", "activity", "terminal", "skills", "games", "bin"] as const;
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




function IconArtwork({item,size=48}:{item:{id:string;label:string;app?:string;windowId?:string;type?:"file"|"folder"};size?:number}) {
  const app=item.app??item.windowId??item.id;
  const glyph=portfolioApps.find(entry=>entry.id===app)?.glyph??(app==="playground"?"game":undefined);
  return glyph?<AppGlyph glyph={glyph} size={size}/>:<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><use href={`#${getSpriteId(item)}`}/></svg>;
}

const baseIcons: Icon[] = [
  { id: "about", label: "About Storm", app: "about-portfolio", x: 32, y: 44 },
  { id: "skills", label: "Skills.txt", app: "skills", x: 32, y: 152 },
  { id: "calculator", label: "Calculator", app: "calculator", x: 32, y: 260 },
  { id: "projects", label: "Projects", app: "projects", x: 152, y: 44, type: "folder" },
  { id: "falling-sand", label: "Falling Sand", app: "falling-sand", x: 152, y: 152 },
  { id: "activity", label: "Project Manager", app: "project-tasks", x: 152, y: 260 },
  { id: "playground", label: "Playground", app: "playground", x: 272, y: 44, type: "folder" },
  { id: "pixel-studio", label: "Pixel Studio", app: "pixel-studio", x: 272, y: 152 },
  { id: "terminal", label: "Terminal", app: "terminal", x: 272, y: 260 },
  { id: "games", label: "Games", app: "games", x: 392, y: 152, type: "folder" },
];

function defaultFolders(): DesktopFolders {
  return {
    blog:{label:"Blog",items:[{id:"blog-recursion",label:"Recursive Algorithms.txt",type:"file",x:20,y:20,app:"blog-recursion",windowId:"blog-recursion"},{id:"blog-sorting",label:"Mathematics of Sorting.txt",type:"file",x:120,y:20,app:"blog-sorting",windowId:"blog-sorting"},{id:"blog-graphs",label:"Graph Theory.txt",type:"file",x:220,y:20,app:"blog-graphs",windowId:"blog-graphs"},{id:"test-folder",label:"Test Folder",type:"folder",app:"test-folder",x:20,y:120}]},
    "test-folder":{label:"Test Folder",items:[]},
    projects:{label:"Projects",items:[{id:"project-notetime",label:"NoteTime.txt",type:"file",x:20,y:20,app:"project-notetime",windowId:"project-notetime"},{id:"project-fallingsand",label:"FallingSandGame.txt",type:"file",x:120,y:20,app:"project-fallingsand",windowId:"project-fallingsand"}]},
    games:{label:"Games",items:[...portfolioApps.filter(app=>["star-patrol","balloon-bastion","mossblade","snake"].includes(app.id)),{id:"falling-sand",name:"Falling Sand"}].map((app,i)=>({id:`game-${app.id}`,app:app.id,windowId:app.id,label:app.name,x:20+i%3*110,y:20+Math.floor(i/3)*110}))},
    playground:{label:"Playground",items:portfolioApps.filter(app=>app.category!=="Games"&&app.id!=="games").map((app,i)=>({id:`cabinet-${app.id}`,app:app.id,windowId:app.id,label:app.name,x:20+i%3*110,y:20+Math.floor(i/3)*110}))},
  };
}

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

My strongest thread is turning complex workflows into usable software: React/Next.js product architecture at Noteception, visualisation layers for simulation and data-heavy tooling, and AI/search-backed interfaces that need to stay understandable under real use.

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
  const [folders,setFolders]=useState<DesktopFolders>(defaultFolders);
  const [fileNotice,setFileNotice]=useState("");
  const [windows, setWindows] = useState<Record<string, Win>>({
    ...Object.fromEntries([...portfolioApps.map(app => app.id), "playground"].map(id => [id, { id, open: false, z: 10 }])),
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
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [hardwareQuery, setHardwareQuery] = useState("");
  const hardwareCursorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if(!modelScreen && hardwareCursorRef.current) hardwareCursorRef.current.style.display = "none"; }, [modelScreen]);
  const [discovered, setDiscovered] = useState(false);
  const openWinRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    hydrateDesktopPreferences();
    const stopSounds = installDesktopSounds();
    let sequence = "";
    let lastTextInput: HTMLInputElement | HTMLTextAreaElement | null = null;
    const rememberTextInput = (event: FocusEvent) => {
      if(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) lastTextInput = event.target;
    };
    document.addEventListener("focusin", rememberTextInput);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setLauncherOpen(v => !v); return; }
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) return;
      sequence = (sequence + e.key).slice(-128);
      if (sequence.endsWith("ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba")) { setDiscovered(true); openWinRef.current("terminal"); }
    };
    const onHardware = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (!key) return;
      if (key === "Escape") { setLauncherOpen(false); document.activeElement?.dispatchEvent(new KeyboardEvent("keydown",{key,code:"Escape",bubbles:true,cancelable:true})); return; }
      const focused = document.activeElement;
      const active = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
        ? focused : lastTextInput?.isConnected ? lastTextInput : focused;
      if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && !active.readOnly && !active.disabled) {
        active.focus({preventScroll:true});
        if(key === "Enter") { active.dispatchEvent(new KeyboardEvent("keydown", {key, bubbles:true,cancelable:true})); return; }
        if(key.length === 1 || key === "Backspace") {
          const start = active.selectionStart ?? active.value.length, end = active.selectionEnd ?? start;
          const from = key === "Backspace" && start === end ? Math.max(0,start-1) : start;
          const value = active.value.slice(0,from) + (key === "Backspace" ? "" : key) + active.value.slice(end);
          const prototype = active instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype,"value")?.set?.call(active,value);
          active.dispatchEvent(new Event("input", { bubbles:true }));
          const cursor = from + (key === "Backspace" ? 0 : 1);
          try { active.setSelectionRange(cursor,cursor); } catch {}
          return;
        }
      }
      if(key.length === 1) setHardwareQuery(key);
      setLauncherOpen(true);
    };
    const onHardwarePointer = (event: Event) => {
      const {u,v} = (event as CustomEvent<{u:number;v:number}>).detail ?? {};
      const cursor=hardwareCursorRef.current, desktop=desktopRef.current;
      if(!cursor || !desktop || !Number.isFinite(u) || !Number.isFinite(v)) return;
      cursor.style.transform = `translate(${Math.max(0,Math.min(1,u)) * (desktop.clientWidth - 20)}px,${Math.max(0,Math.min(1,v)) * (desktop.clientHeight - 24)}px)`;
      cursor.style.display="block";
    };
    const onHardwareClick = () => {
      const cursor=hardwareCursorRef.current;
      if(cursor && cursor.style.display === "block") {
        const rect=cursor.getBoundingClientRect(), x=rect.left+1, y=rect.top+1;
        const hit=document.elementFromPoint(x,y);
        const control=hit?.closest<HTMLElement>("button,a,input,textarea,select");
        if(control) {control.focus();control.click();return;}
        if(hit && hit.closest(".desktop")) {
          hit.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerId:999,pointerType:"mouse",button:0,clientX:x,clientY:y}));
          hit.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,pointerId:999,pointerType:"mouse",button:0,clientX:x,clientY:y}));
          return;
        }
      }
      openWinRef.current("playground");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("storm-hardware-key", onHardware);
    window.addEventListener("storm-hardware-click", onHardwareClick);
    window.addEventListener("storm-hardware-pointer", onHardwarePointer);
    return () => { stopSounds(); document.removeEventListener("focusin", rememberTextInput); window.removeEventListener("keydown", onKey); window.removeEventListener("storm-hardware-key", onHardware); window.removeEventListener("storm-hardware-click", onHardwareClick); window.removeEventListener("storm-hardware-pointer", onHardwarePointer); };
  }, []);
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
    movePositions?: Map<string, { x: number; y: number }>;
  } | null>(null);
  const dragGhostRef=useRef<HTMLDivElement>(null);
  const dragClickCleanupRef=useRef<(()=>void)|null>(null);
  const dragCleanupRef=useRef<(()=>void)|null>(null);
  const springRef=useRef<{key:string;timer:number}|null>(null);
  useEffect(()=>()=>{dragCleanupRef.current?.();dragClickCleanupRef.current?.();if(springRef.current)clearTimeout(springRef.current.timer);},[]);
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
    const apps=new Set(Object.keys(windows));
    const restoredFolders=restoreDesktopFolders(desktopStorage.getItem(FOLDER_STORAGE_KEY),folders,apps);
    setFolders(restoredFolders);
    for(const id of Object.keys(restoredFolders))setWindows(prev=>prev[id]?prev:{...prev,[id]:{id,open:false,z:10}});
    const restoredTrash=restoreDesktopTrash(desktopStorage.getItem("nx-trash"),restoredFolders,apps);
    setTrash(restoredTrash);
    const otherLayouts=ICON_STORAGE_KEYS.filter(key=>key!==iconStorageKey).map(key=>desktopStorage.getItem(key));
    setIcons(fitIconsToViewport(restoreDesktopIcons(desktopStorage.getItem(iconStorageKey),otherLayouts,initialIcons,restoredFolders,restoredTrash,apps)));
    setIconsReady(true);
    const savedTrashPos = desktopStorage.getItem(trashPosStorageKey);
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
    const savedBinPos = desktopStorage.getItem(binPosStorageKey);
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
    const savedCrt = desktopStorage.getItem("nx-crt-off");
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

  useEffect(()=>{if(iconsReady)desktopStorage.setItem(FOLDER_STORAGE_KEY,JSON.stringify(folders));},[folders,iconsReady]);

  // On mobile variants, arrange icons into a grid that fits the screen
  useEffect(() => {
    if (!iconsReady) return;
    if (!isMobile) return;
    arrangeIcons();
  }, [iconsReady, isMobile, mobileVariant, modelScreen]);

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
    desktopStorage.setItem(iconStorageKey, JSON.stringify(icons));
  }, [icons, iconStorageKey, iconsReady, loadedIconStorageKey]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    desktopStorage.setItem("nx-trash", JSON.stringify(trash));
  }, [iconStorageKey, iconsReady, loadedIconStorageKey, trash]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    if (trashPos) {
      desktopStorage.setItem(trashPosStorageKey, JSON.stringify(trashPos));
    } else {
      desktopStorage.removeItem(trashPosStorageKey);
    }
  }, [iconStorageKey, iconsReady, loadedIconStorageKey, trashPos, trashPosStorageKey]);
  useEffect(() => {
    if (!iconsReady || loadedIconStorageKey !== iconStorageKey) return;
    if (binPos) {
      desktopStorage.setItem(binPosStorageKey, JSON.stringify(binPos));
    } else {
      desktopStorage.removeItem(binPosStorageKey);
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

  const folderRegistry=Object.fromEntries(Object.entries(folders).map(([id,folder])=>[id,{items:folder.items,setItems:(update:React.SetStateAction<BrowserItem[]>)=>setFolders(prev=>({...prev,[id]:{...prev[id],items:typeof update==="function"?update(prev[id]?.items??[]):update}}))}]));
  const folderCounts=Object.fromEntries(Object.entries(folders).map(([id,folder])=>[id,folder.items.length]));
  function createFolder(parentId="desktop") {
    if(Object.keys(folders).length>=150){setFileNotice("Folder limit reached.");return;}
    const siblings=parentId==="desktop"?icons:folders[parentId]?.items??[];
    let label="Untitled folder";for(let n=2;siblings.some(item=>item.label.toLowerCase()===label.toLowerCase());n++)label=`Untitled folder ${n}`;
    const id=`desk-folder-${globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const next={...folders,[id]:{label,items:[]}};
    const item:Icon={id,label,app:id,type:"folder",x:20+(siblings.length%3)*110,y:20+Math.floor(siblings.length/3)*110};
    const error=desktopMoveError(next,[...icons,item],trash,[id],parentId);
    if(error){setFileNotice(error);return;}
    setFolders(prev=>({...prev,[id]:{label,items:[]},...(parentId!=="desktop"?{[parentId]:{...prev[parentId],items:[...prev[parentId].items,{...item,windowId:id}]}}:{})}));
    if(parentId==="desktop")setIcons(prev=>[...prev,{...item,...clampToDesktop(40+icons.length%5*104,60+Math.floor(icons.length/5)*104)}]);
    setWindows(prev=>({...prev,[id]:{id,open:false,z:10}}));setSelection(new Set([id]));setFileNotice("");
  }

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

  function updateDropTarget(clientX:number,clientY:number,positions?:Map<string,{x:number;y:number}>) {
    const st=dragStateRef.current;if(!st)return;
    if(positions)st.movePositions=positions;
    const resolved=resolveDrop(clientX,clientY);
    const folder=resolved?.key.match(/^(?:window|folder):(.*)$/)?.[1];
    const valid=folder?!desktopMoveError(folders,icons,trash,st.items.map(item=>item.id),folder):true;
    const key=valid?resolved?.key??null:null;
    setDropTarget(previous=>previous===key?previous:key);
    if(springRef.current?.key!==key){if(springRef.current)clearTimeout(springRef.current.timer);springRef.current=null;
      if(key?.startsWith("folder:")&&folder&&!windows[folder]?.open)springRef.current={key,timer:window.setTimeout(()=>{openWinRef.current(folder);},650)};
    }
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
    if(springRef.current)clearTimeout(springRef.current.timer);springRef.current=null;
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
    const target=key.match(/^(?:window|folder):(.*)$/)?.[1]??(key==="desktop"?"desktop":null);
    if(target){
      const error=desktopMoveError(folders,icons,trash,ids,target);
      if(error){setFileNotice(error);if(st.source.kind==="desktop"&&st.startPositions){const starts=st.startPositions;setIcons(prev=>prev.map(item=>starts.has(item.id)?{...item,...starts.get(item.id)!}:item));}return;}
    }
    setFileNotice("");

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
      if (st.source.kind === "desktop") {
        const positions=st.movePositions;
        if(positions)setIcons(prev=>prev.map(item=>positions.has(item.id)?{...item,...positions.get(item.id)!}:item));
        return;
      }
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
            type: it.type,
            app: it.app,
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
  function beginItemDrag(e:React.PointerEvent,source:DragSource,item:DragItem) {
    if(e.button!==0||!desktopRef.current||dragStateRef.current)return;
    dragClickCleanupRef.current?.();dragClickCleanupRef.current=null;
    const element=e.currentTarget as HTMLElement,pointer=e.pointerId,startX=e.clientX,startY=e.clientY;
    let metrics:ReturnType<typeof createLocalCoordinateMetrics>|null=null;
    let dragging=false,frame=0,lastX=startX,lastY=startY;
    const paint=()=>{frame=0;if(!metrics)return;const p=metrics.clientToLocal(lastX,lastY);if(dragGhostRef.current)dragGhostRef.current.style.transform=`translate(${p.x-48}px,${p.y-30}px)`;updateDropTarget(lastX,lastY);};
    const move=(ev:PointerEvent)=>{
      if(ev.pointerId!==pointer)return;
      if(!dragging){if(dragStateRef.current||Math.hypot(ev.clientX-startX,ev.clientY-startY)<(ev.pointerType==="touch"?8:5))return;if(!desktopRef.current)return;dragging=true;metrics=createLocalCoordinateMetrics(desktopRef.current);dragStateRef.current={source,items:[item]};const p=metrics.clientToLocal(ev.clientX,ev.clientY);setDragGhost({item,x:p.x-48,y:p.y-30});try{element.setPointerCapture(pointer);}catch{}}
      if(ev.cancelable)ev.preventDefault();lastX=ev.clientX;lastY=ev.clientY;if(!frame)frame=requestAnimationFrame(paint);
    };
    const finish=(ev?:PointerEvent,cancelled=false)=>{
      if(ev&&ev.pointerId!==pointer)return;
      cancelAnimationFrame(frame);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);window.removeEventListener("blur",blur);window.removeEventListener("keydown",escape);
      try{element.releasePointerCapture(pointer);}catch{}
      // Suppress the click generated by this drag without altering icon artwork.
      if(dragging&&!cancelled)dragClickCleanupRef.current=suppressDragClick(element,pointer);
      if(dragging)finishDrag(ev?.clientX??lastX,ev?.clientY??lastY,!cancelled);dragCleanupRef.current=null;
    };
    const up=(ev:PointerEvent)=>finish(ev);const cancel=(ev:PointerEvent)=>finish(ev,true);const blur=()=>finish(undefined,true);const escape=(ev:KeyboardEvent)=>{if(ev.key==="Escape"){ev.preventDefault();if(dragging)dragClickCleanupRef.current=suppressDragClick(element,pointer,true);finish(undefined,true);}};
    dragCleanupRef.current?.();dragCleanupRef.current=()=>finish(undefined,true);
    window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",up);window.addEventListener("pointercancel",cancel);window.addEventListener("blur",blur);window.addEventListener("keydown",escape);
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
    desktopStorage.setItem("nx-crt-off", crtOff ? "1" : "0");
  }, [crtOff]);

  useEffect(() => {
    const savedDark = desktopStorage.getItem("nx-dark-mode");
    if (savedDark === "0") setDarkMode(false);
    if (savedDark === "1") setDarkMode(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", darkMode);
    desktopStorage.setItem("nx-dark-mode", darkMode ? "1" : "0");
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
      : Math.min(680, Math.max(200, desktopWidth - 16));
    const estimatedWindowHeight = Math.min(490, Math.max(180, desktopHeight - 88));
    const maxX = Math.max(8, desktopWidth - estimatedWindowWidth - 8);
    const maxY = Math.max(0, desktopHeight - estimatedWindowHeight - 8);
    const base = isMobile ? mobileWindowCascadeBase : WINDOW_CASCADE_BASE;
    const step = isMobile ? MOBILE_WINDOW_CASCADE_STEP : WINDOW_CASCADE_STEP;
    const x = base.x + slot * step.x;
    const y = base.y + slot * step.y;

    return {
      x: isMobile ? 8 : Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(0, y)),
    };
  };

  const openWin = (id: string) => {
    const currentWindow = windows[id];
    if (!currentWindow) return;
    setLauncherOpen(false);
    window.dispatchEvent(new CustomEvent("storm-app-focus", {detail:{id}}));

    const shouldCascade = !currentWindow.open;
    const nextPosition = shouldCascade ? getCascadedWindowPosition(openCascadeIndexRef.current) : null;
    if (shouldCascade) openCascadeIndexRef.current += 1;

    setWindows((w) => {
      if (!w[id]) return w;
      return { ...w, [id]: { ...w[id], ...(nextPosition ?? {}), open: true, z: nextZ + 1 } };
    });
    setNextZ((z) => z + 1);
  };
  useEffect(() => { openWinRef.current = openWin; });
  const frontWin = (id: string) => {
    window.dispatchEvent(new CustomEvent("storm-app-focus", {detail:{id}}));
    setWindows((w) => ({ ...w, [id]: { ...w[id], z: nextZ + 1 } }));
    setNextZ((z) => z + 1);
  };
  const closeWin = (id: string) => {
    window.dispatchEvent(new CustomEvent("storm-app-focus", {detail:{id:null}}));
    setWindows((w) => ({ ...w, [id]: { ...w[id], open: false } }));
  };

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
    // Reset positions, not filesystem membership, visitor folders or Trash.
    const defaults=new Map(initialIcons.map(item=>[item.id,item]));
    setIcons(list=>list.map((item,index)=>{
      const position=defaults.get(item.id)??{x:32+(index%4)*120,y:44+Math.floor(index/4)*108};
      return {...item,...clampToDesktop(position.x,position.y)};
    }));
    setSelection(new Set());
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

  /** Folder windows delete into the Trash, which keeps a folder's contents reachable. */
  function trashFolderItem(folderId: string, item: BrowserItem) {
    setFolders(prev => prev[folderId] ? { ...prev, [folderId]: { ...prev[folderId], items: prev[folderId].items.filter(entry => entry.id !== item.id) } } : prev);
    addToTrash([{ id: item.id, label: item.label, app: item.app, type: item.type, x: 0, y: 0 }]);
  }

  /** Permanent deletion must also leave saved layouts, or another screen size would restore it. */
  function deletePermanently(ids: string[]) {
    if (!ids.length) return;
    setTrash(prev => prev.filter(item => !ids.includes(item.id)));
    setFolders(prev => purgeDesktopFolders(prev, ids));
    for (const key of ICON_STORAGE_KEYS) {
      if (key === iconStorageKey) continue;
      try {
        const saved: unknown = JSON.parse(desktopStorage.getItem(key) ?? "null");
        if (Array.isArray(saved)) desktopStorage.setItem(key, JSON.stringify(saved.filter(item => !ids.includes(item?.id))));
      } catch { /* A damaged layout is ignored when it is next restored. */ }
    }
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
    TRASH_POSITION_STORAGE_KEYS.forEach((key) => desktopStorage.removeItem(key));
    BIN_POSITION_STORAGE_KEYS.forEach((key) => desktopStorage.removeItem(key));
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
      setSelection(previous => previous.size === sel.size && [...sel].every(id => previous.has(id)) ? previous : sel);
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
    "storm-desktop",
    embedded && !modelScreen ? "embedded-screen" : "",
    modelScreen ? "model-screen-content" : "",
    isMobile ? "mobile" : "",
    isMobilePortrait ? "mobile-portrait" : isMobile ? "mobile-landscape" : "",
  ].filter(Boolean).join(" ");

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
              <div className="menu-label">STORM OS · 1.0</div>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("playground"); setOpenMenu(null); }}>Open Playground…</button>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("finder"); setOpenMenu(null); }}>Browse Files…</button>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("preferences"); setOpenMenu(null); }}>Control Panel…</button>
              <button className="menu-entry" role="menuitem" onClick={() => { openWin("about-portfolio"); setOpenMenu(null); }}>About Storm Bartlett</button>
            </div>
          </div>

          <div className={`menu ${openMenu === "file" ? "is-open" : ""}`}>
            <button className="menu-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "file"} onClick={() => toggleMenu("file")} onMouseEnter={() => trackHover("file")}>
              File
            </button>
            <div className="menu-dropdown" role="menu">
              <button className="menu-entry" role="menuitem" onClick={()=>{createFolder();setOpenMenu(null);}}>New Folder</button>
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
        <div className="menubar-right">
          <button className="launcher-trigger" onClick={() => setLauncherOpen(true)} aria-label="Find an app" title="Find an app (⌘ / Ctrl K)">⌕</button>
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
        <div ref={hardwareCursorRef} className="hardware-screen-cursor" aria-hidden="true"/>
        {icons.filter(icon => !isMobile || (MOBILE_TOP_ROW_ORDER as readonly string[]).includes(icon.id) || !baseIcons.some(item => item.id === icon.id)).map((icon) => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            icons={icons}
            canDrag={iconsReady} canStartDrag={()=>!dragStateRef.current}
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
            ref={dragGhostRef} className="drag-ghost-layer"
            style={{ position: "absolute", left: 0, top: 0, transform:`translate(${dragGhost.x}px,${dragGhost.y}px)`, zIndex: 30000, pointerEvents: "none" }}
          >
            <div className="desktop-icon drag-ghost-icon" style={{ position: "relative", left: 0, top: 0 }}>
              <div className="icon">
                <IconArtwork item={dragGhost.item}/>
              </div>
              <span className="icon-label">{dragGhost.item.label}</span>
            </div>
          </div>
        )}

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
            const pointer = e.pointerId;
            let desktopMetrics: ReturnType<typeof createLocalCoordinateMetrics> | null = null;
            let startLocal = { x: 0, y: 0 };
            let moved: { x: number; y: number } | null = null;

            // Use the stored position as starting point (like DesktopIcon does with icon.x/y)
            const currentPos = binPos || defaultBinPos;
            const sx = currentPos.x;
            const sy = currentPos.y;
            let dragging = false;

            // Moves write to the element; React only hears about the final position.
            const move = (ev: PointerEvent) => {
              if (ev.pointerId !== pointer) return;
              if (!dragging) {
                if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return; // Threshold before starting drag
                if (!desktopRef.current) return;
                dragging = true;
                binDragStateRef.current.hasDragged = true;
                desktopMetrics = createLocalCoordinateMetrics(desktopRef.current);
                startLocal = desktopMetrics.clientToLocal(startX, startY);
                try { binRef.current?.setPointerCapture(pointer); } catch {}
              }
              if (ev.cancelable) ev.preventDefault();
              const currentLocal = desktopMetrics!.clientToLocal(ev.clientX, ev.clientY);
              moved = clampToDesktop(sx + currentLocal.x - startLocal.x, sy + currentLocal.y - startLocal.y);
              if (binRef.current) { binRef.current.style.left = `${moved.x}px`; binRef.current.style.top = `${moved.y}px`; }
            };

            const finish = (commit: boolean) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              window.removeEventListener('pointercancel', cancel);
              window.removeEventListener('blur', blur);
              if (dragging) { try { binRef.current?.releasePointerCapture(pointer); } catch {} }
              if (commit && moved) setBinPos(moved);
              else if (binRef.current) { binRef.current.style.left = `${sx}px`; binRef.current.style.top = `${sy}px`; }
              if (dragCleanupRef.current === abort) dragCleanupRef.current = null;
            };
            const up = (ev: PointerEvent) => { if (ev.pointerId === pointer) finish(true); };
            const cancel = (ev: PointerEvent) => { if (ev.pointerId === pointer) finish(false); };
            const blur = () => finish(false);
            const abort = () => finish(false);

            dragCleanupRef.current?.();
            dragCleanupRef.current = abort;
            window.addEventListener('pointermove', move, { passive: false });
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', cancel);
            window.addEventListener('blur', blur);
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
          onClick={(e) => {if (!binDragStateRef.current.hasDragged && (e.detail === 0 || isMobile)) openWin("bin");}}
          aria-label="Trash"
        >
          <div className="icon">
            <Image
              src={trash.length > 0 ? "/trash-full.svg" : "/trash.svg"} 
              alt="" 
              width={48}
              height={48}
              aria-hidden="true"
            />
          </div>
          <span className="icon-label">Trash</span>
        </button>

        <div className="desktop-signature"><strong>Storm Bartlett</strong><span>Software developer</span></div>
        <nav className="desktop-dock" aria-label="Quick launch">
          {[{id:"finder",label:"Files",glyph:"folder"},{id:"project-tasks",label:"Work",glyph:"tasks"},{id:"games",label:"Games",glyph:"game"},{id:"pixel-studio",label:"Paint",glyph:"paint"},{id:"terminal",label:"Terminal",glyph:"terminal"}].map(app => <button key={app.id} onClick={() => openWin(app.id)} aria-label={`Open ${app.label}`} title={app.label} className={windows[app.id]?.open ? "running" : ""}><AppGlyph glyph={app.glyph} size={28}/><span>{app.label}</span></button>)}
          <button onClick={() => setLauncherOpen(true)} aria-label="All apps"><span className="dock-grid" aria-hidden="true">⊞</span><span>All apps</span></button>
        </nav>
        {fileNotice&&<div className="file-operation-notice" role="status">{fileNotice}<button onClick={()=>setFileNotice("")} aria-label="Dismiss">×</button></div>}
        {discovered && <button className="secret-badge" onClick={() => setDiscovered(false)}>✦ Secret handshake discovered</button>}
        {portfolioApps.map(app=>{const App=appComponents[app.id];return <Window key={app.id} id={app.id} title={app.name} windows={windows} frontWin={frontWin} closeWin={closeWin} className={`portfolio-app-window app-${app.id}`}>{app.id==="games"?<BlogBrowser folderId="games" items={folders.games.items} windows={windows} openWin={openWin} setNextZ={setNextZ} darkMode={darkMode} beginItemDrag={beginItemDrag} dropTarget={dropTarget} dragSourceId={dragGhost?.item.id??null} folderCounts={folderCounts} onCreateFolder={createFolder} onDeleteItem={trashFolderItem}/>:<App onOpenApp={openWin}/>}</Window>;})}
        {Object.entries(folders).filter(([id])=>!["blog","test-folder","projects","games"].includes(id)).map(([id,folder])=><Window key={id} id={id} title={folder.label} windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window"><BlogBrowser folderId={id} items={folder.items} windows={windows} openWin={openWin} setNextZ={setNextZ} darkMode={darkMode} beginItemDrag={beginItemDrag} dropTarget={dropTarget} dragSourceId={dragGhost?.item.id??null} folderCounts={folderCounts} onCreateFolder={createFolder} onDeleteItem={trashFolderItem}/></Window>)}
        {launcherOpen && <AppLauncher initialQuery={hardwareQuery} onOpenApp={openWin} onClose={() => {setLauncherOpen(false);setHardwareQuery("");}}/>}

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
            items={folders.blog.items}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts} onCreateFolder={createFolder} onDeleteItem={trashFolderItem}
          />
        </Window>

        <Window id="bin" title="Trash" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <TrashBrowser
            trash={trash}
            restoreIcon={restoreIcon}
            restoreAll={restoreAll}
            deletePermanently={deletePermanently}
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
            items={folders["test-folder"].items}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts} onCreateFolder={createFolder} onDeleteItem={trashFolderItem}
          />
        </Window>
        <Window id="projects" title="Projects" windows={windows} frontWin={frontWin} closeWin={closeWin} className="blog-window">
          <BlogBrowser
            folderId="projects"
            items={folders.projects.items}
            windows={windows}
            openWin={openWin}
            setNextZ={setNextZ}
            darkMode={darkMode}
            beginItemDrag={beginItemDrag}
            dropTarget={dropTarget}
            dragSourceId={dragGhost?.item.id ?? null}
            folderCounts={folderCounts} onCreateFolder={createFolder} onDeleteItem={trashFolderItem}
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
                <button className="menu-entry" role="menuitem" onClick={()=>{createFolder();setCtxMenu(null);}}>New Folder</button>
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
                <button className="menu-entry" role="menuitem" onClick={() => { deletePermanently(trash.map(item => item.id)); setTrashCtxMenu(null); }}>Empty Trash</button>
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

function DesktopIcon({ icon, icons, canDrag, canStartDrag, selection, setSelection, onDbl, onDragStart, onDragMove, onDragEnd, isDropTarget }: { icon: Icon; icons: Icon[]; canDrag: boolean; canStartDrag:()=>boolean; setIcons: React.Dispatch<React.SetStateAction<Icon[]>>; selection: Set<string>; setSelection: (s: Set<string>) => void; onDbl: () => void; onDragStart?: (ids: string[]) => void; onDragMove?: (x: number, y: number, positions?:Map<string,{x:number;y:number}>) => void; onDragEnd?: (x: number, y: number, dragging: boolean) => void; isDropTarget?: boolean; }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const cleanupRef=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cleanupRef.current?.(),[]);
  const down=(e:React.PointerEvent)=>{
    if(e.button!==0||!canDrag||!canStartDrag())return;e.preventDefault();
    const nextSel=selection.has(icon.id)?new Set(selection):new Set(e.shiftKey?[...selection,icon.id]:[icon.id]);setSelection(nextSel);didDrag.current=false;
    const desktop=ref.current?.closest<HTMLElement>(".desktop");if(!desktop)return;
    const pointer=e.pointerId,startX=e.clientX,startY=e.clientY;
    let metrics:ReturnType<typeof createLocalCoordinateMetrics>|null=null,start={x:0,y:0};
    const starts=new Map(icons.filter(item=>nextSel.has(item.id)).map(item=>[item.id,{x:item.x,y:item.y}]));
    const elements=new Map([...starts.keys()].map(id=>[id,desktop.querySelector<HTMLElement>(`.desktop-icon[data-id="${CSS.escape(id)}"]`)]));
    let dragging=false,frame=0,lastX=startX,lastY=startY;
    const paint=()=>{
      frame=0;if(!metrics)return;const p=metrics.clientToLocal(lastX,lastY),positions=new Map<string,{x:number;y:number}>();
      for(const [id,origin] of starts){const pos={x:Math.max(8,Math.min(metrics.width-104,origin.x+p.x-start.x)),y:Math.max(0,Math.min(metrics.height-104,origin.y+p.y-start.y))};positions.set(id,pos);const element=elements.get(id);if(element){element.style.left=`${pos.x}px`;element.style.top=`${pos.y}px`;}}
      onDragMove?.(lastX,lastY,positions);
    };
    const move=(ev:PointerEvent)=>{
      if(ev.pointerId!==pointer)return;
      if(!dragging){if(!canStartDrag()||Math.hypot(ev.clientX-startX,ev.clientY-startY)<(ev.pointerType==="touch"?8:4))return;setSelection(nextSel);dragging=true;didDrag.current=true;metrics=createLocalCoordinateMetrics(desktop);start=metrics.clientToLocal(startX,startY);try{ref.current?.setPointerCapture(pointer);}catch{}for(const element of elements.values())element?.classList.add("dragging");onDragStart?.([...nextSel]);}
      if(ev.cancelable)ev.preventDefault();lastX=ev.clientX;lastY=ev.clientY;if(!frame)frame=requestAnimationFrame(paint);
    };
    const finish=(ev?:PointerEvent,cancelled=false)=>{
      if(ev&&ev.pointerId!==pointer)return;
      cancelAnimationFrame(frame);frame=0;
      if(dragging&&!cancelled){lastX=ev?.clientX??lastX;lastY=ev?.clientY??lastY;paint();}
      cancelAnimationFrame(frame);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);window.removeEventListener("blur",blur);window.removeEventListener("keydown",escape);
      for(const [id,element] of elements){element?.classList.remove("dragging");const origin=starts.get(id)!;if(element){element.style.left=`${origin.x}px`;element.style.top=`${origin.y}px`;}}
      try{ref.current?.releasePointerCapture(pointer);}catch{}
      if(dragging)onDragEnd?.(ev?.clientX??lastX,ev?.clientY??lastY,!cancelled);cleanupRef.current=null;
    };
    const up=(ev:PointerEvent)=>finish(ev);const cancel=(ev:PointerEvent)=>finish(ev,true);const blur=()=>finish(undefined,true);const escape=(ev:KeyboardEvent)=>{if(ev.key==="Escape"){ev.preventDefault();finish(undefined,true);}};
    cleanupRef.current?.();cleanupRef.current=()=>finish(undefined,true);
    window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",up);window.addEventListener("pointercancel",cancel);window.addEventListener("blur",blur);window.addEventListener("keydown",escape);
  };
  const didDrag = useRef(false);
  return (
    <button ref={ref} className={`desktop-icon ${selection.has(icon.id) ? "is-selected" : ""}  ${isDropTarget ? "is-over" : ""}`} data-id={icon.id} data-folder={icon.type === "folder" ? "true" : undefined} data-dropzone={icon.type === "folder" ? "ifolder" : undefined} style={{ left: icon.x, top: icon.y, position: "absolute" }} onDoubleClick={onDbl} onPointerDown={down} onClick={(e) => { if(e.detail===0){didDrag.current=false;onDbl();return;}if (didDrag.current) { didDrag.current = false; return; } if (matchMedia("(pointer: coarse)").matches) onDbl(); }}>
      <div className="icon">
        <IconArtwork item={icon}/>
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
    const el = divRef.current;
    const desktop = el?.closest(".desktop") as HTMLElement | null;
    if (!w?.open || !el || !desktop) return;
    const fit = () => {
      if (!desktop.clientWidth || !desktop.clientHeight) return;
      const maxX = Math.max(0, desktop.clientWidth - el.offsetWidth - 4);
      const maxY = Math.max(0, desktop.clientHeight - el.offsetHeight - 8);
      const x = Math.max(0, Math.min(maxX, parseFloat(el.style.left) || 0));
      const y = Math.max(0, Math.min(maxY, parseFloat(el.style.top) || 0));
      if (parseFloat(el.style.left) !== x) el.style.left = `${x}px`;
      if (parseFloat(el.style.top) !== y) el.style.top = `${y}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(desktop); observer.observe(el);
    return () => observer.disconnect();
  }, [w?.open]);

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
      restoreStateRef.current = {
        left: el.style.left || "80px",
        top: el.style.top || "80px",
        width: el.style.width || `${el.offsetWidth}px`,
        height: el.style.height || `${el.offsetHeight}px`
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
        divRef.current.style.left = `${Math.max(0, Math.min((dragPlane?.clientWidth ?? innerWidth) - Math.min(divRef.current.offsetWidth, 120), windowStartX + dx))}px`;
        divRef.current.style.top = `${Math.max(0, Math.min((dragPlane?.clientHeight ?? innerHeight) - 70, windowStartY + dy))}px`;
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
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
      window.removeEventListener("pointercancel", up);
    };
    
    window.addEventListener("pointermove", move as (this: Window, ev: PointerEvent) => void);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  
  return (
    <section className={`window ${className || ''}`} ref={divRef} style={{ zIndex: w.z as number, position: "absolute" }} data-app={id} role="region" aria-label={title} onPointerDown={() => frontWin(id)}>
      <header className="titlebar" onPointerDown={(e)=>{ if ((e.target as HTMLElement).closest("button")) return; e.preventDefault(); e.stopPropagation(); down(e); }} onDoubleClick={toggleMaximize}>
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
      <div className="window-body"><AppErrorBoundary>{children}</AppErrorBoundary></div>
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

type BrowserItem = { id: string; label: string; type?: "file" | "folder"; app: string; x: number; y: number; windowId?: string };

function TrashBrowser({
  trash,
  deletePermanently,
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
  deletePermanently: (ids: string[]) => void;
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
            onClick={(e) => {setSelection(new Set([icon.id])); if (!dragSourceId && windows[icon.app] && (e.detail === 0 || matchMedia("(pointer: coarse)").matches)) openWin(icon.app);}}
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
              <IconArtwork item={icon}/>
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
            deletePermanently([trashCtxMenu.id]);
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
  windows,
  openWin,
  setNextZ,
  darkMode,
  beginItemDrag,
  dropTarget,
  dragSourceId,
  folderCounts,
  onCreateFolder,
  onDeleteItem,
}: {
  folderId: string;
  items: BrowserItem[];
  windows: Record<string, Win>;
  openWin: (id: string) => void;
  setNextZ: (fn: (z: number) => number) => void;
  darkMode: boolean;
  beginItemDrag: (e: React.PointerEvent, source: DragSource, item: DragItem) => void;
  dropTarget: string | null;
  dragSourceId: string | null;
  folderCounts: Record<string, number>;
  onCreateFolder:(id:string)=>void;
  onDeleteItem:(folderId:string,item:BrowserItem)=>void;
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
    if (item.type !== "folder" && item.windowId) {
      if (windows[item.windowId]) openWin(item.windowId);
      setNextZ((z) => z + 1);
    } else if (item.type === "folder") {
      openWin(item.id);
      setNextZ((z) => z + 1);
    }
  };

  return (
    <><div className="folder-toolbar"><button onClick={()=>onCreateFolder(folderId)}>New folder</button></div><div
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
          onClick={(e) => {setSelection(new Set([item.id])); if (!dragSourceId && (e.detail === 0 || matchMedia("(pointer: coarse)").matches)) openItem(item);}}
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
              app: item.app || item.windowId || item.id,
              type: item.type,
            });
          }}
        >
          <div className="icon">
            <IconArtwork item={item}/>
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
            const item = items.find(i => i.id === browserCtxMenu.itemId);
            if (item) onDeleteItem(folderId, item);
            setBrowserCtxMenu(null);
            setSelection(new Set());
          }}>Delete</button>
        </div>
      )}
    </div></>
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

function fitIconsToViewport(icons: Icon[]): Icon[] {
  const width = typeof window !== "undefined" ? window.innerWidth : 1280;
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const maxX = Math.max(8, width - 140);
  const maxY = Math.max(0, height - 200);
  return icons.map((i) => ({
    ...i,
    x: Math.min(Math.max(8, i.x), maxX),
    y: Math.min(Math.max(0, i.y), maxY),
  }));
}
