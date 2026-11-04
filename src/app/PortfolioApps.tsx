"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";

const loading = () => <div className="app-loading" role="status">Reading floppy disk…</div>;
export const portfolioApps = [
  { id: "games", name: "Games", description: "A tiny arcade, tucked inside your computer.", glyph: "game", category: "Unwind" },
  { id: "star-patrol", name: "Star Patrol", description: "Command marines. Hold the alien frontier.", glyph: "terminal", category: "Games" },
  { id: "balloon-bastion", name: "Balloon Bastion", description: "Build, upgrade, and hold back the balloons.", glyph: "paint", category: "Games" },
  { id: "mossblade", name: "Mossblade", description: "A small sword. A mossy world. An adventure.", glyph: "plant", category: "Games" },
  { id: "finder", name: "Finder", description: "A little filesystem. Follow your curiosity.", glyph: "folder", category: "Explore" },
  { id: "project-tasks", name: "Project Manager", description: "Noteception, UNSW, and the work in progress.", glyph: "tasks", category: "Explore" },
  { id: "pixel-studio", name: "Pixel Studio", description: "Small canvas. Big pixel energy.", glyph: "paint", category: "Make" },
  { id: "terminal", name: "Terminal", description: "Take the scenic route through the command line.", glyph: "terminal", category: "Explore" },
  { id: "sound-lab", name: "Sound Lab", description: "Make a tiny chiptune. Sound starts with you.", glyph: "sound", category: "Make" },
  { id: "focus-timer", name: "Focus Garden", description: "A quiet timer for a little good work.", glyph: "plant", category: "Unwind" },
  { id: "snake", name: "Snake Garden", description: "One more strawberry. One more round.", glyph: "snake", category: "Unwind" },
  { id: "postcards", name: "Post Office", description: "Make a pixel postcard to take with you.", glyph: "mail", category: "Make" },
  { id: "preferences", name: "Control Panel", description: "Make this little desktop feel like yours.", glyph: "settings", category: "System" },
] as const;

export const appComponents: Record<string, ComponentType<{ onOpenApp?: (id: string) => void }>> = {
  games: Games,
  "star-patrol": dynamic(() => import("./apps/StarPatrol"), { loading }),
  "balloon-bastion": dynamic(() => import("./apps/BalloonBastion"), { loading }),
  mossblade: dynamic(() => import("./apps/Mossblade"), { loading }),
  finder: dynamic(() => import("./apps/FinderApp"), { loading }),
  "project-tasks": dynamic(() => import("./apps/ProjectTasks"), { loading }),
  "pixel-studio": dynamic(() => import("./apps/PixelStudio"), { loading }),
  terminal: dynamic(() => import("./apps/TerminalApp"), { loading }),
  "sound-lab": dynamic(() => import("./apps/SoundLab"), { loading }),
  "focus-timer": dynamic(() => import("./apps/FocusTimer"), { loading }),
  snake: dynamic(() => import("./apps/SnakeGarden"), { loading }),
  postcards: dynamic(() => import("./apps/Postcards"), { loading }),
  preferences: dynamic(() => import("./apps/ControlPanel"), { loading }),
};

export function AppGlyph({ glyph, size = 32 }: { glyph: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" shapeRendering="crispEdges">
    {glyph === "folder" ? <><path d="M3 8h10l3 4h13v15H3z" fill="var(--app-icon-fill,#f3e8bb)"/><path d="M3 14h26M8 19h7"/></> :
    glyph === "paint" ? <><path d="M5 4h22v24H5z" fill="var(--app-icon-fill,#f2c9d8)"/><path d="m10 21 9-12 4 3-9 12-5 1zM9 7h5M20 23h4"/><path d="m18 11 4 3"/></> :
    glyph === "terminal" ? <><path d="M3 6h26v21H3z" fill="var(--app-icon-fill,#cdd7f5)"/><path d="M3 11h26m-21 5 4 3-4 3m7 0h7M6 8h2m2 0h2"/></> :
    glyph === "tasks" ? <><path d="M5 5h22v23H5z" fill="var(--app-icon-fill,#cce4cf)"/><path d="M5 11h22M9 16l2 2 3-4m3 2h6M9 23h4m4 0h6M12 3h8v5h-8z"/></> :
    glyph === "sound" ? <><path d="M3 7h26v20H3z" fill="var(--app-icon-fill,#ddd0ef)"/><path d="M7 11h18v8H7zM9 27l2-5h10l2 5"/><circle cx="11" cy="15" r="2"/><circle cx="21" cy="15" r="2"/></> :
    glyph === "plant" ? <><path d="m10 21 2 8h8l2-8z" fill="var(--app-icon-fill,#efc3a9)"/><path d="M16 21V9m0 7C5 18 5 8 5 8s11-1 11 8Zm0-4C27 14 27 4 27 4s-11-1-11 8Z" fill="#bbd4ae"/></> :
    glyph === "snake" ? <><path d="M7 7h16v6H11v6h13v7H6v-6m14-7V7" strokeWidth="5" stroke="var(--app-icon-fill,#9fbf91)"/><path d="M21 6h1m2 0h1M25 10h4"/></> :
    glyph === "mail" ? <><path d="M3 8h26v18H3z" fill="var(--app-icon-fill,#f0d7b9)"/><path d="m3 8 13 11L29 8M3 26l9-10m17 10-9-10"/></> :
    glyph === "settings" ? <><path d="M4 5h24v23H4z" fill="var(--app-icon-fill,#d0d9df)"/><path d="M10 9v15m6-15v15m6-15v15M7 13h6m0 7h6m0-9h6" strokeWidth="2"/></> :
    <><rect x="4" y="4" width="24" height="24" rx="3" fill="var(--app-icon-fill,#dfd1ee)"/><path d="M10 9v14m-7-7h14m5-5h2m-2 9h2"/></>}
  </svg>;
}

export function Playground({ onOpenApp }: { onOpenApp?: (id: string) => void }) {
  const [filter, setFilter] = useState("All");
  return <div className="playground-app">
    <div className="playground-heading"><span className="eyebrow">STORM’S SOFTWARE CABINET / VOL. 01</span><h1>Made to be played with.</h1><p>A few small things hiding inside a small computer. Open something. Make something. Stay a while.</p></div>
    <div className="app-filters" aria-label="Filter apps">{["All", "Explore", "Make", "Unwind", "System"].map(category => <button key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
    <div className="app-grid">{portfolioApps.filter(app => app.category !== "Games" && (filter === "All" || app.category === filter)).map(app => <button className="app-card" key={app.id} onClick={() => onOpenApp?.(app.id)}><AppGlyph glyph={app.glyph} size={36}/><span><strong>{app.name}</strong><small>{app.description}</small></span><span aria-hidden="true">↗</span></button>)}</div>
    <div className="playground-footnote">Handmade for the browser. Your creations stay on this device.</div>
  </div>;
}

export function AppLauncher({ onOpenApp, onClose, initialQuery = "" }: { onOpenApp: (id: string) => void; onClose: () => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const choices = [{id:"about-portfolio",name:"About Storm",description:"Software developer. Curious by default.",glyph:"tasks"}, {id:"playground",name:"Playground",description:"Browse every little app.",glyph:"game"}, ...portfolioApps].filter(app => `${app.name} ${app.description}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { previousFocus.current = document.activeElement as HTMLElement; input.current?.focus(); return () => previousFocus.current?.focus(); }, []);
  const launch = (id: string) => { onOpenApp(id); onClose(); };
  return <div className="launcher-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="app-launcher" role="dialog" aria-modal="true" aria-label="Find an app" onKeyDown={e => {
      if(e.key === "Escape") { e.preventDefault(); onClose(); }
      if(e.key === "ArrowDown") { e.preventDefault(); setIndex(i => Math.min(choices.length - 1, i + 1)); }
      if(e.key === "ArrowUp") { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
      if(e.key === "Enter" && e.target === input.current && choices[index]) { e.preventDefault(); launch(choices[index].id); }
      if(e.key === "Tab") { const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,input')); const first=items[0],last=items[items.length-1]; if(e.shiftKey && document.activeElement === first){e.preventDefault();last?.focus();} else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();} }
    }}>
      <div className="launcher-search"><span aria-hidden="true">⌕</span><input ref={input} aria-label="Search apps" placeholder="Find something wonderful…" value={query} onChange={e => {setQuery(e.target.value);setIndex(0);}}/><button aria-label="Close app search" onClick={onClose}>Esc</button></div>
      <div className="launcher-results">{choices.map((app,i) => <button key={app.id} className={i === index ? "active" : ""} onClick={() => launch(app.id)} onMouseEnter={() => setIndex(i)}><AppGlyph glyph={app.glyph}/><span><strong>{app.name}</strong><small>{app.description}</small></span><span aria-hidden="true">↵</span></button>)}{!choices.length && <p>No apps found. Try “paint” or “garden”.</p>}</div>
      <footer>↑↓ to explore · Enter to open · ⌘ / Ctrl K anywhere</footer>
    </section>
  </div>;
}

export function Games({ onOpenApp }: { onOpenApp?: (id: string) => void }) {
  const games = [...portfolioApps.filter(app => ["star-patrol", "balloon-bastion", "mossblade", "snake"].includes(app.id)), {id:"falling-sand",name:"Falling Sand",description:"A tiny sandbox of moving materials.",glyph:"paint"}];
  return <div className="playground-app games-library"><span className="eyebrow">STORM’S POCKET ARCADE / INSERT CURIOSITY</span><h1>One more round.</h1><p>Original pixels. Little worlds. Keyboard or thumbs.</p><div className="app-grid">{games.map((game,i) => <button className="app-card game-card" key={game.id} onClick={() => onOpenApp?.(game.id)}><span className={`game-cover game-cover-${i}`}><AppGlyph glyph={game.glyph} size={42}/><small>0{i+1}</small></span><span><strong>{game.name}</strong><small>{game.description}</small></span><span aria-hidden="true">▶</span></button>)}</div><p className="playground-footnote">Games pause when the browser tab is hidden. No downloads, no accounts.</p></div>;
}
