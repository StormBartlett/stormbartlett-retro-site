"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./SnakeGarden.module.css";

type Point = { x: number; y: number };
type Direction = "up" | "right" | "down" | "left";
type Status = "ready" | "running" | "paused" | "over" | "won";
type Game = {
  snake: Point[];
  direction: Direction;
  food: Point | null;
  score: number;
  status: Status;
};

const CELLS = 20;
const CELL_SIZE = 18;
const BOARD_SIZE = CELLS * CELL_SIZE;
const BEST_KEY = "storm-snake-garden-best-v1";
const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down", right: "left", down: "up", left: "right",
};
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left",
  w: "up", d: "right", s: "down", a: "left",
};
const FOOD_NAMES = ["strawberry", "apple", "cherries"];
const FOOD_ART = [
  ["...g...", "..ggg..", ".xxxxx.", "xxxxxxx", "xoxoxox", ".xxxxx.", "..xxx.."],
  ["....g..", "...g...", ".xx.xx.", "xxxxxxx", "xoxxxxx", "xxxxxxx", ".xx.xx."],
  ["...gg..", "..g.g..", ".g..g..", "xxx.xxx", "xox.xox", "xxx.xxx", ".x...x."],
];

function initialGame(): Game {
  return {
    snake: [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
    direction: "right",
    food: { x: 14, y: 9 },
    score: 0,
    status: "ready",
  };
}

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function plantFood(snake: Point[]): Point | null {
  const occupied = new Set(snake.map(({ x, y }) => y * CELLS + x));
  const available: Point[] = [];
  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      if (!occupied.has(y * CELLS + x)) available.push({ x, y });
    }
  }
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

function drawGarden(canvas: HTMLCanvasElement, game: Game) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(canvas.width / BOARD_SIZE, 0, 0, canvas.height / BOARD_SIZE, 0, 0);
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#e9efdc";
  context.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Quiet checkerboard: enough structure to judge a turn without a busy grid.
  context.fillStyle = "#e3ead6";
  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      if ((x + y) % 2 === 0) context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  if (game.food) {
    const art = FOOD_ART[game.score % FOOD_ART.length];
    art.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel === ".") return;
        context.fillStyle = pixel === "g" ? "#7b9057" : pixel === "o" ? "#e9efdc" : "#33442d";
        context.fillRect(game.food!.x * CELL_SIZE + 2 + x * 2, game.food!.y * CELL_SIZE + 2 + y * 2, 2, 2);
      });
    });
  }

  game.snake.forEach((part, index) => {
    const x = part.x * CELL_SIZE;
    const y = part.y * CELL_SIZE;
    context.fillStyle = index === 0 ? "#263824" : "#60764c";
    context.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    if (index > 0) {
      context.fillStyle = "#8da071";
      context.fillRect(x + 3, y + 3, 3, 3);
    } else {
      const eyes: Record<Direction, Point[]> = {
        right: [{ x: 11, y: 4 }, { x: 11, y: 11 }],
        left: [{ x: 4, y: 4 }, { x: 4, y: 11 }],
        up: [{ x: 4, y: 4 }, { x: 11, y: 4 }],
        down: [{ x: 4, y: 11 }, { x: 11, y: 11 }],
      };
      context.fillStyle = "#f7f9ed";
      eyes[game.direction].forEach((eye) => context.fillRect(x + eye.x, y + eye.y, 3, 3));
    }
  });
}

export default function SnakeGarden() {
  const [game, setGame] = useState<Game>(initialGame);
  const [best, setBest] = useState(0);
  const gameRef = useRef(game);
  const turnsRef = useRef<Direction[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);

  const publish = useCallback((next: Game) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const start = useCallback((direction: Direction = "right") => {
    const next = initialGame();
    next.status = "running";
    next.direction = direction === "left" ? "right" : direction;
    next.food = plantFood(next.snake);
    turnsRef.current = [];
    publish(next);
    arenaRef.current?.focus({ preventScroll: true });
  }, [publish]);

  const pause = useCallback(() => {
    if (gameRef.current.status !== "running") return;
    turnsRef.current = [];
    publish({ ...gameRef.current, status: "paused" });
  }, [publish]);

  const togglePause = useCallback(() => {
    const current = gameRef.current;
    if (current.status === "running") pause();
    else if (current.status === "paused") {
      publish({ ...current, status: "running" });
      arenaRef.current?.focus({ preventScroll: true });
    }
  }, [pause, publish]);

  const steer = useCallback((direction: Direction) => {
    const current = gameRef.current;
    if (current.status === "ready") {
      start(direction);
      return;
    }
    if (current.status !== "running") return;
    // Validate against the LAST planned turn, then consume exactly one per tick.
    // Two fast perpendicular inputs can never reverse the snake inside a tick.
    const queue = turnsRef.current;
    const preceding = queue[queue.length - 1] ?? current.direction;
    if (queue.length < 2 && direction !== preceding && direction !== OPPOSITE[preceding]) {
      queue.push(direction);
    }
  }, [start]);

  const tick = useCallback(() => {
    const current = gameRef.current;
    if (current.status !== "running") return;
    const direction = turnsRef.current.shift() ?? current.direction;
    const vector = VECTORS[direction];
    const head = { x: current.snake[0].x + vector.x, y: current.snake[0].y + vector.y };
    const eats = !!current.food && samePoint(head, current.food);
    const body = eats ? current.snake : current.snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS || body.some((part) => samePoint(part, head))) {
      turnsRef.current = [];
      publish({ ...current, status: "over" });
      return;
    }
    const snake = [head, ...current.snake];
    if (!eats) snake.pop();
    const food = eats ? plantFood(snake) : current.food;
    publish({ snake, direction, food, score: current.score + Number(eats), status: food ? "running" : "won" });
  }, [publish]);

  useEffect(() => {
    if (game.status !== "running") return;
    const timer = window.setTimeout(tick, Math.max(86, 164 - game.score * 3));
    return () => window.clearTimeout(timer);
  }, [game, tick]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
    };
  }, [pause]);

  useEffect(() => {
    let saved = 0;
    try {
      const value = Number(window.localStorage.getItem(BEST_KEY));
      if (Number.isSafeInteger(value) && value >= 0 && value <= CELLS * CELLS) saved = value;
      const nextBest = Math.max(saved, game.score);
      if (nextBest > saved) window.localStorage.setItem(BEST_KEY, String(nextBest));
    } catch { /* A private or restricted browser can still play. */ }
    setBest((previous) => Math.max(previous, saved, game.score));
  }, [game.score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const width = canvas.getBoundingClientRect().width;
      const resolution = Math.max(1, Math.round(width * Math.min(window.devicePixelRatio || 1, 3)));
      canvas.width = resolution;
      canvas.height = resolution;
      drawGarden(canvas, gameRef.current);
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canvasRef.current) drawGarden(canvasRef.current, game);
  }, [game]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = KEY_DIRECTIONS[event.key] ?? KEY_DIRECTIONS[event.key.toLowerCase()];
    if (direction) {
      event.preventDefault();
      event.stopPropagation();
      steer(direction);
      return;
    }
    if (event.key === "Escape" && gameRef.current.status === "running") {
      event.preventDefault();
      event.stopPropagation();
      pause();
      return;
    }
    const isButton = event.target instanceof HTMLElement && !!event.target.closest("button");
    if (!isButton && (event.code === "Space" || event.key.toLowerCase() === "p") && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      if (["ready", "over", "won"].includes(gameRef.current.status)) start();
      else togglePause();
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;
    arenaRef.current?.focus({ preventScroll: true });
    swipeRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const origin = swipeRef.current;
    swipeRef.current = null;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const active = game.status === "running";
  const paused = game.status === "paused";
  const finished = game.status === "over" || game.status === "won";

  return (
    <section
      className={styles.game}
      aria-label="Snake Garden"
      onKeyDown={onKeyDown}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pause(); }}
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <svg className={styles.flower} viewBox="0 0 24 28" aria-hidden="true">
            <path fill="currentColor" d="M9 0h6v6h6v6h-6v6H9v-6H3V6h6z" />
            <path fill="#f4f3e9" d="M9 6h6v6H9z" />
            <path fill="#65774d" d="M10 18h3v10h-3zM4 19h6v5H7v-2H4zm9 2h7v3h-4v2h-3z" />
          </svg>
          <div><h1 className={styles.title}>Snake Garden</h1><p className={styles.subtitle}>Small snake. Big appetite.</p></div>
        </div>
        <span className={styles.edition}>EST.<br />1984*</span>
      </header>

      <div className={styles.scorebar}>
        <div className={styles.counter}><span>SNACKS</span><strong>{String(game.score).padStart(2, "0")}</strong></div>
        <div className={styles.scoreMessage}><span className={`${styles.statusDot} ${active ? styles.activeDot : ""}`} />{active ? "HAPPILY GROWING" : paused ? "ON A LITTLE BREAK" : finished ? "ANOTHER LITTLE ADVENTURE?" : "YOUR GARDEN AWAITS"}</div>
        <div className={`${styles.counter} ${styles.best}`}><span>BEST</span><strong>{String(best).padStart(2, "0")}</strong></div>
      </div>

      <div
        ref={arenaRef}
        className={styles.arena}
        tabIndex={0}
        role="group"
        aria-label="Game board. Arrow keys or W A S D to move; Space or P to pause. You can also swipe."
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipeRef.current = null; }}
        onLostPointerCapture={() => { swipeRef.current = null; }}
      >
        <canvas ref={canvasRef} width={BOARD_SIZE} height={BOARD_SIZE} className={styles.canvas} role="img" aria-label={`Pixel garden. Snake length ${game.snake.length}. ${FOOD_NAMES[game.score % FOOD_NAMES.length]} to collect.`} />
        {!active && (
          <div className={styles.overlay}>
            <div className={styles.overlayCard}>
              <span className={styles.overlaySymbol} aria-hidden="true">{paused ? "Ⅱ" : game.status === "won" ? "✿" : game.status === "over" ? ":')" : "✿"}</span>
              <h2>{paused ? "Taking a breather." : game.status === "won" ? "A very full garden." : game.status === "over" ? "A wall. A lesson." : "A little room to grow."}</h2>
              <p>{paused ? "Your snacks will wait for you." : game.status === "won" ? "Every square, a little victory." : game.status === "over" ? `${game.score} ${game.score === 1 ? "snack" : "snacks"} collected. Shall we try again?` : "Find a snack. Take a turn.\nSee how far a little snake can go."}</p>
              <button className={styles.primaryButton} onClick={() => paused ? togglePause() : start()}>{paused ? "Keep growing" : finished ? "Plant a new game" : "Let’s grow"}<span aria-hidden="true">→</span></button>
              {!finished && !paused && <span className={styles.startHint}>or press an arrow key</span>}
            </div>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.keyHelp}><span><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd><span className={styles.or}>or</span><b>WASD</b></span><small>to wander · space to pause</small></div>
        <button className={styles.pauseButton} disabled={!active && !paused} onClick={togglePause} aria-label={paused ? "Resume game" : "Pause game"}>{paused ? "▶ Resume" : "Ⅱ Pause"}</button>
      </div>

      <div className={styles.touchControls} aria-label="Direction controls">
        <button className={styles.up} aria-label="Move up" onClick={() => steer("up")}>↑</button>
        <button className={styles.left} aria-label="Move left" onClick={() => steer("left")}>←</button>
        <span className={styles.padCenter} aria-hidden="true">✿</span>
        <button className={styles.right} aria-label="Move right" onClick={() => steer("right")}>→</button>
        <button className={styles.down} aria-label="Move down" onClick={() => steer("down")}>↓</button>
        <span className={styles.swipeHint}>a thumb-sized<br />adventure.<br /><b>swipe to steer, too.</b></span>
      </div>

      <footer className={styles.footer}><span>GROW SLOW. TURN OFTEN.</span><span>* A STATE OF MIND</span></footer>
      <span className={styles.srOnly} role="status" aria-live="polite">{game.status === "over" ? `Game over. ${game.score} snacks collected.` : game.status === "won" ? "You filled the garden!" : game.status === "paused" ? "Game paused." : ""}</span>
    </section>
  );
}
