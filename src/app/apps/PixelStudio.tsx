"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./PixelStudio.module.css";

type Size = 24 | 32;
type Tool = "pencil" | "eraser" | "fill" | "picker";
type Artwork = { size: Size; pixels: string[] };
type Point = { x: number; y: number };
type Stamp = "mushroom" | "cat" | "heart";
type Stroke = { pointerId: number; before: Artwork; last: Point | null; changed: boolean };

const STORAGE_KEY = "storm-pixel-studio-v1";
const HISTORY_LIMIT = 50;
const PALETTE = [
  ["Ink", "#292633"], ["Paper", "#fffaf2"],
  ["Rose", "#eea5b3"], ["Peach", "#f5c5a4"],
  ["Butter", "#f6e7a1"], ["Mint", "#a9d8b3"],
  ["Sky", "#aad4e8"], ["Lilac", "#c6b4e1"],
  ["Berry", "#bb6b8c"], ["Leaf", "#6d9d7c"],
  ["Denim", "#6b8ba5"], ["Cocoa", "#9c7c72"],
] as const;
const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pencil", label: "Pencil", key: "P" },
  { id: "eraser", label: "Erase", key: "E" },
  { id: "fill", label: "Fill", key: "F" },
  { id: "picker", label: "Pick", key: "I" },
];
const STAMPS: Record<Stamp, { label: string; rows: string[]; colors: Record<string, string> }> = {
  mushroom: {
    label: "Shroom",
    rows: [
      ".....kkkkkk.....", "...kkppppppkk...", "..kpppwppwpppk..",
      ".kppppppppppppk.", ".kppwppppppwppk.", "kppppppppppppppk",
      "kppppwppwppppppk", ".kkkkkkkkkkkkkk.", ".....kcccck.....",
      ".....kkcckk.....", ".....kcccck.....", ".....kcccck.....",
      ".....kkkkkk.....",
    ],
    colors: { k: "#292633", p: "#eea5b3", w: "#fffaf2", c: "#f6e7a1" },
  },
  cat: {
    label: "Kitty",
    rows: [
      ".kk.......kk.", ".kpk.....kpk.", ".kppk...kppk.", ".kpppkkkpppk.",
      ".kpppppppppk.", "kpppppppppppk", "kpwkppppkwppk", "kppppprpppppk",
      ".kpppkkkpppk.", "..kpppppppk..", "...kkkkkkk...",
    ],
    colors: { k: "#292633", p: "#c6b4e1", r: "#eea5b3", w: "#fffaf2" },
  },
  heart: {
    label: "Heart",
    rows: [
      ".kkk...kkk.", "kpppk.kpppk", "kpwppkppppk", "kpppppppppk",
      ".kpppppppk.", "..kpppppk..", "...kpppk...", "....kpk....", ".....k.....",
    ],
    colors: { k: "#292633", p: "#eea5b3", w: "#fffaf2" },
  },
};

function starter(size: Size, stamp: Stamp): Artwork {
  const pixels = Array<string>(size * size).fill("");
  const { rows, colors } = STAMPS[stamp];
  const left = Math.floor((size - Math.max(...rows.map((row) => row.length))) / 2);
  const top = Math.floor((size - rows.length) / 2);
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (colors[pixel]) pixels[(top + y) * size + left + x] = colors[pixel];
  }));
  return { size, pixels };
}

function isArtwork(value: unknown): value is Artwork {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Artwork>;
  return (candidate.size === 24 || candidate.size === 32)
    && Array.isArray(candidate.pixels)
    && candidate.pixels.length === candidate.size * candidate.size
    && candidate.pixels.every((pixel) => typeof pixel === "string" && (pixel === "" || /^#[\da-f]{6}$/i.test(pixel)));
}

function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {tool === "pencil" && <path d="m3 10 7-7 3 3-7 7-4 1 1-4Zm6-6 3 3M3 10l3 3" />}
      {tool === "eraser" && <path d="m2 9 6-7 6 5-6 7H6L2 9Zm4-4 6 5M8 14h6" />}
      {tool === "fill" && <><path d="m2 8 6-6 5 5-6 6-5-5Zm0 0h11M6 1l3 3" /><path d="M13 10s-2 2-2 3a2 2 0 0 0 4 0c0-1-2-3-2-3Z" /></>}
      {tool === "picker" && <path d="m3 10 6-6 3 3-6 6H3v-3Zm5-7 5 5M10 3l2-2 3 3-2 2M3 13l-2 2" />}
    </svg>
  );
}

export default function PixelStudio() {
  const [art, setArt] = useState<Artwork>(() => starter(24, "mushroom"));
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<string>(PALETTE[2][1]);
  const [grid, setGrid] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [message, setMessage] = useState("A tiny canvas. A little possibility.");
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(art);
  const past = useRef<Artwork[]>([]);
  const future = useRef<Artwork[]>([]);
  const stroke = useRef<Stroke | null>(null);
  const descriptionId = useId();

  function display(next: Artwork) {
    current.current = next;
    setArt(next);
    setCursor((point) => ({ x: Math.min(point.x, next.size - 1), y: Math.min(point.y, next.size - 1) }));
  }

  function syncHistory() {
    setHistory({ undo: past.current.length, redo: future.current.length });
  }

  function remember(previous: Artwork) {
    past.current = [...past.current, previous].slice(-HISTORY_LIMIT);
    future.current = [];
    syncHistory();
  }

  function commit(next: Artwork, announcement: string) {
    if (next.size === current.current.size && next.pixels.every((pixel, index) => pixel === current.current.pixels[index])) return;
    remember(current.current);
    display(next);
    setMessage(announcement);
  }

  function undo() {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(current.current);
    display(previous);
    syncHistory();
    setMessage("Undone. Every pixel gets a second chance.");
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    display(next);
    syncHistory();
    setMessage("Redone.");
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const restored: unknown = JSON.parse(raw);
        if (isArtwork(restored)) {
          current.current = restored;
          setArt(restored);
          setMessage("Welcome back, little masterpiece.");
        }
      }
    } catch {
      setSaved(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(art));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [art, ready]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const cell = 12;
    context.imageSmoothingEnabled = false;
    art.pixels.forEach((pixel, index) => {
      const x = index % art.size;
      const y = Math.floor(index / art.size);
      context.fillStyle = pixel || ((x + y) % 2 ? "#edeae5" : "#fffdf8");
      context.fillRect(x * cell, y * cell, cell, cell);
    });
    if (grid) {
      context.strokeStyle = "rgba(41,38,51,.18)";
      context.lineWidth = 1;
      context.beginPath();
      for (let line = 1; line < art.size; line++) {
        context.moveTo(line * cell + 0.5, 0);
        context.lineTo(line * cell + 0.5, art.size * cell);
        context.moveTo(0, line * cell + 0.5);
        context.lineTo(art.size * cell, line * cell + 0.5);
      }
      context.stroke();
    }
    if (focused) {
      context.strokeStyle = "#fff";
      context.lineWidth = 3;
      context.strokeRect(cursor.x * cell + 2, cursor.y * cell + 2, cell - 4, cell - 4);
      context.strokeStyle = "#292633";
      context.lineWidth = 1;
      context.strokeRect(cursor.x * cell + 2, cursor.y * cell + 2, cell - 4, cell - 4);
    }
  }, [art, grid, focused, cursor]);

  function position(event: PointerEvent<HTMLCanvasElement>): Point | null {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    return { x: Math.floor(x * current.current.size), y: Math.floor(y * current.current.size) };
  }

  function paint(from: Point, to: Point) {
    const previous = current.current;
    const pixels = [...previous.pixels];
    const ink = tool === "eraser" ? "" : color;
    let { x, y } = from;
    const dx = Math.abs(to.x - x);
    const dy = -Math.abs(to.y - y);
    const sx = x < to.x ? 1 : -1;
    const sy = y < to.y ? 1 : -1;
    let error = dx + dy;
    let changed = false;
    // Join sampled pointer positions so quick strokes cannot leave gaps.
    for (;;) {
      const index = y * previous.size + x;
      if (pixels[index] !== ink) {
        pixels[index] = ink;
        changed = true;
      }
      if (x === to.x && y === to.y) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x += sx; }
      if (doubled <= dx) { error += dx; y += sy; }
    }
    if (changed) {
      display({ size: previous.size, pixels });
      if (stroke.current) stroke.current.changed = true;
    }
  }

  function applyAt(point: Point) {
    const previous = current.current;
    const index = point.y * previous.size + point.x;
    if (tool === "picker") {
      const picked = previous.pixels[index];
      if (picked) {
        setColor(picked);
        setTool("pencil");
        setMessage("Color picked. Pencil ready.");
      } else {
        setMessage("That pixel is transparent. Pick a painted one.");
      }
      return;
    }
    if (tool === "fill") {
      const target = previous.pixels[index];
      if (target === color) return;
      const pixels = [...previous.pixels];
      const queue = [index];
      pixels[index] = color;
      for (let head = 0; head < queue.length; head++) {
        const pixel = queue[head];
        const x = pixel % previous.size;
        const y = Math.floor(pixel / previous.size);
        const neighbors = [
          ...(x > 0 ? [pixel - 1] : []), ...(x < previous.size - 1 ? [pixel + 1] : []),
          ...(y > 0 ? [pixel - previous.size] : []), ...(y < previous.size - 1 ? [pixel + previous.size] : []),
        ];
        neighbors.forEach((neighbor) => {
          if (pixels[neighbor] === target) {
            pixels[neighbor] = color;
            queue.push(neighbor);
          }
        });
      }
      commit({ size: previous.size, pixels }, "A little splash of color.");
      return;
    }
    const before = current.current;
    paint(point, point);
    if (!stroke.current && before !== current.current) remember(before);
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if ((event.pointerType === "mouse" && event.button !== 0) || stroke.current) return;
    const point = position(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    setCursor(point);
    if (tool === "fill" || tool === "picker") {
      applyAt(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    stroke.current = { pointerId: event.pointerId, before: current.current, last: point, changed: false };
    paint(point, point);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = stroke.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = position(event);
    if (point) {
      paint(active.last || point, point);
      setCursor(point);
    }
    active.last = point;
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    const active = stroke.current;
    if (!active || active.pointerId !== event.pointerId) return;
    stroke.current = null;
    if (active.changed) {
      remember(active.before);
      setMessage("Looking lovely. Keep going.");
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function resize(size: Size) {
    const previous = current.current;
    const pixels = Array<string>(size * size).fill("");
    const offset = Math.floor((size - previous.size) / 2);
    previous.pixels.forEach((pixel, index) => {
      const x = index % previous.size + offset;
      const y = Math.floor(index / previous.size) + offset;
      if (x >= 0 && x < size && y >= 0 && y < size) pixels[y * size + x] = pixel;
    });
    commit({ size, pixels }, `${size} × ${size} canvas. Artwork centered; resizing is undoable.`);
  }

  function exportPng() {
    const output = document.createElement("canvas");
    const scale = 16;
    const artwork = current.current;
    output.width = artwork.size * scale;
    output.height = artwork.size * scale;
    const context = output.getContext("2d");
    if (!context) { setMessage("PNG export is unavailable in this browser."); return; }
    artwork.pixels.forEach((pixel, index) => {
      if (!pixel) return;
      context.fillStyle = pixel;
      context.fillRect((index % artwork.size) * scale, Math.floor(index / artwork.size) * scale, scale, scale);
    });
    try {
      output.toBlob((blob) => {
        if (!blob) { setMessage("Could not export. Please try again."); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `tiny-masterpiece-${artwork.size}x${artwork.size}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("PNG exported. Tiny art, ready for the world.");
      }, "image/png");
    } catch {
      setMessage("Could not export. Please try again.");
    }
  }

  function shortcuts(event: KeyboardEvent<HTMLElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || stroke.current) return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo(); else undo();
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      const chosen = TOOLS.find((item) => item.key.toLowerCase() === key);
      if (chosen) { event.preventDefault(); setTool(chosen.id); }
    }
  }

  function canvasKey(event: KeyboardEvent<HTMLCanvasElement>) {
    const direction: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    if (direction[event.key]) {
      event.preventDefault();
      const delta = direction[event.key];
      setCursor((point) => ({
        x: Math.max(0, Math.min(art.size - 1, point.x + delta.x)),
        y: Math.max(0, Math.min(art.size - 1, point.y + delta.y)),
      }));
    } else if ((event.key === " " || event.key === "Enter") && !stroke.current) {
      event.preventDefault();
      applyAt(cursor);
    }
  }

  return (
    <section className={styles.studio} aria-label="Pixel studio" onKeyDown={shortcuts}>
      <div className={styles.tools} role="group" aria-label="Drawing tools">
        {TOOLS.map((item) => (
          <button key={item.id} className={`${styles.button} ${tool === item.id ? styles.active : ""}`} type="button" aria-pressed={tool === item.id} aria-label={`${item.label} tool (${item.key})`} title={`${item.label} (${item.key})`} onClick={() => setTool(item.id)}>
            <ToolIcon tool={item.id} />{item.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <div className={styles.canvasFrame}>
          <canvas ref={canvas} className={styles.canvas} width={art.size * 12} height={art.size * 12} tabIndex={0} role="img" aria-label={`Editable ${art.size} by ${art.size} pixel canvas`} aria-describedby={descriptionId} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={canvasKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onContextMenu={(event) => event.preventDefault()} />
        </div>
        <div className={styles.palette} role="group" aria-label="Color palette">
          {PALETTE.map(([name, value]) => (
            <button key={value} type="button" className={`${styles.swatch} ${color.toLowerCase() === value ? styles.selectedSwatch : ""}`} style={{ backgroundColor: value }} aria-label={`Select ${name.toLowerCase()} color`} aria-pressed={color.toLowerCase() === value} title={name} onClick={() => { setColor(value); if (tool === "eraser" || tool === "picker") setTool("pencil"); }} />
          ))}
          <label className={styles.customColor} title="Choose a custom color">
            <input type="color" value={color} aria-label="Custom drawing color" onChange={(event) => { setColor(event.target.value); setTool("pencil"); }} />
            <span aria-hidden="true">+</span>
          </label>
          <span className={styles.paletteHint}>COLOR</span>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.history} role="group" aria-label="Edit artwork">
          <button className={styles.button} type="button" disabled={!history.undo} aria-label="Undo last edit" title="Undo (⌘/Ctrl Z)" onClick={undo}>↶</button>
          <button className={styles.button} type="button" disabled={!history.redo} aria-label="Redo last edit" title="Redo (⌘/Ctrl Shift Z)" onClick={redo}>↷</button>
          <button className={styles.button} type="button" onClick={() => commit({ size: art.size, pixels: Array<string>(art.size * art.size).fill("") }, "A fresh canvas. Clear can be undone.")}>Clear</button>
        </div>
        <button className={`${styles.button} ${grid ? styles.active : ""}`} type="button" aria-pressed={grid} aria-label="Show pixel grid" onClick={() => setGrid(!grid)}>Grid</button>
        <select className={styles.size} aria-label="Canvas dimensions" value={art.size} onChange={(event) => resize(Number(event.target.value) as Size)}>
          <option value="24">24 × 24</option><option value="32">32 × 32</option>
        </select>
      </div>

      <div className={styles.starters} role="group" aria-label="Starter artwork">
        <span className={styles.starterLabel}>Try:</span>
        {(Object.keys(STAMPS) as Stamp[]).map((stamp) => (
          <button className={styles.starterButton} key={stamp} type="button" aria-label={`Load ${STAMPS[stamp].label.toLowerCase()} starter artwork (undoable)`} onClick={() => commit(starter(art.size, stamp), `${STAMPS[stamp].label} starter loaded. Make it yours.`)}>{STAMPS[stamp].label}</button>
        ))}
        <button className={`${styles.button} ${styles.export}`} type="button" title="Download a crisp PNG with a transparent background" onClick={exportPng}>PNG ↓</button>
      </div>

      <div className={styles.status}><span className={`${styles.saveDot} ${!saved ? styles.unsaved : ""}`} aria-hidden="true" />{ready ? (saved ? "Saved on this device" : "Local save unavailable · use PNG") : "Opening canvas…"}</div>
      <span className={styles.srOnly} role="status" aria-live="polite">{message}</span>
      <span className={styles.srOnly} id={descriptionId}>Draw with a mouse or finger. Keyboard: arrows move the cursor; Space or Enter applies the selected tool. P pencil, E eraser, F fill, I color picker. Command or Control Z undoes an edit.</span>
    </section>
  );
}
