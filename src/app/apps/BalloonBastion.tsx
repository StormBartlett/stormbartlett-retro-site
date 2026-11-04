"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BalloonBastion.module.css";
import arcade from "./Arcade.module.css";
import ArcadeMenu, { handleGameBlur } from "./ArcadeMenu";

const WIDTH = 480;
const HEIGHT = 320;
const TILE = 40;
const LAST_ROUND = 12;
const MAX_TOWERS = 20;
const PATH = [
  { x: -20, y: 140 }, { x: 100, y: 140 }, { x: 100, y: 60 }, { x: 260, y: 60 },
  { x: 260, y: 220 }, { x: 380, y: 220 }, { x: 380, y: 140 }, { x: 500, y: 140 },
];
const PATH_LENGTH = PATH.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - PATH[index].x, point.y - PATH[index].y), 0);
const WATER = new Set(["0,6", "1,6", "0,7", "1,7", "10,0", "11,0"]);
const ROCKS = new Set(["7,7", "11,6"]);

type Kind = "pin" | "pot" | "frost";
type Phase = "ready" | "running" | "paused" | "lost" | "won";
type Point = { x: number; y: number };
type Tower = Point & { id: number; kind: Kind; level: number; cooldown: number; spent: number; aim: Point };
type Balloon = Point & { id: number; distance: number; hp: number; maxHp: number; speed: number; slowUntil: number };
type Shot = Point & { target: number; kind: Kind; damage: number; speed: number; splash: number; slow: number };
type Particle = Point & { vx: number; vy: number; age: number; color: string };
type Game = {
  phase: Phase; cash: number; lives: number; round: number; pops: number; time: number; nextId: number;
  towers: Tower[]; balloons: Balloon[]; shots: Shot[]; particles: Particle[];
  spawnLeft: number; spawned: number; spawnTimer: number;
};
type UI = { kind: Kind | null; towerId: number | null; hover: Point | null; reducedMotion: boolean };
type HUD = Pick<Game, "phase" | "cash" | "lives" | "round" | "pops" | "spawnLeft"> & { remaining: number; towerCount: number };

const TYPES: Record<Kind, { name: string; cost: number; range: number; cooldown: number; damage: number; color: string; note: string }> = {
  pin: { name: "Pinwheel", cost: 70, range: 108, cooldown: 0.65, damage: 1, color: "#d8b9ed", note: "Quick single targets" },
  pot: { name: "Pebble Pot", cost: 110, range: 94, cooldown: 1.25, damage: 2, color: "#edbf8b", note: "Splash for a crowd" },
  frost: { name: "Frost Bell", cost: 95, range: 90, cooldown: 0.95, damage: 1, color: "#abd7e9", note: "Slows fast balloons" },
};

function newGame(): Game {
  return { phase: "ready", cash: 210, lives: 15, round: 0, pops: 0, time: 0, nextId: 1, towers: [], balloons: [], shots: [], particles: [], spawnLeft: 0, spawned: 0, spawnTimer: 0 };
}

function hudFor(game: Game): HUD {
  return { phase: game.phase, cash: game.cash, lives: game.lives, round: game.round, pops: game.pops, spawnLeft: game.spawnLeft, remaining: game.balloons.length + game.spawnLeft, towerCount: game.towers.length };
}

function alongPath(distance: number): Point {
  for (let index = 1; index < PATH.length; index++) {
    const from = PATH[index - 1];
    const to = PATH[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance <= length) return { x: from.x + (to.x - from.x) * distance / length, y: from.y + (to.y - from.y) * distance / length };
    distance -= length;
  }
  return PATH[PATH.length - 1];
}

function pathDistance(point: Point): number {
  let nearest = Infinity;
  for (let index = 1; index < PATH.length; index++) {
    const from = PATH[index - 1];
    const to = PATH[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const factor = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)));
    nearest = Math.min(nearest, Math.hypot(point.x - from.x - factor * dx, point.y - from.y - factor * dy));
  }
  return nearest;
}

function tileCenter(point: Point): Point {
  return { x: Math.max(20, Math.min(460, Math.floor(point.x / TILE) * TILE + 20)), y: Math.max(20, Math.min(300, Math.floor(point.y / TILE) * TILE + 20)) };
}

function legalSite(game: Game, point: Point): boolean {
  const tile = `${Math.floor(point.x / TILE)},${Math.floor(point.y / TILE)}`;
  return point.x >= 20 && point.x <= 460 && point.y >= 20 && point.y <= 300 && !WATER.has(tile) && !ROCKS.has(tile)
    && pathDistance(point) >= 35 && !game.towers.some((tower) => Math.hypot(tower.x - point.x, tower.y - point.y) < 32);
}

function towerStats(tower: Tower) {
  const type = TYPES[tower.kind];
  return {
    range: type.range + (tower.level - 1) * 15,
    damage: type.damage + tower.level - 1,
    cooldown: type.cooldown * Math.pow(0.84, tower.level - 1),
    upgrade: Math.round(type.cost * (0.7 + (tower.level - 1) * 0.55)),
    sell: Math.floor(tower.spent * 0.7),
  };
}

function tick(game: Game, delta: number, reducedMotion: boolean) {
  if (game.phase !== "running") return;
  game.time += delta;
  game.spawnTimer -= delta;
  while (game.spawnLeft > 0 && game.spawnTimer <= 0 && game.balloons.length < 100) {
    const hp = Math.min(7, 1 + Math.floor((game.round - 1) / 3) + (game.round >= 3 && game.spawned % 5 === 0 ? 1 : 0));
    game.balloons.push({ id: game.nextId++, ...PATH[0], distance: 0, hp, maxHp: hp, speed: 32 + game.round * 2 + (game.spawned % 3) * 2, slowUntil: 0 });
    game.spawnLeft -= 1;
    game.spawned += 1;
    game.spawnTimer += Math.max(0.3, 0.83 - game.round * 0.027);
  }

  for (const balloon of game.balloons) {
    balloon.distance += balloon.speed * (balloon.slowUntil > game.time ? 0.5 : 1) * delta;
    Object.assign(balloon, alongPath(balloon.distance));
    if (balloon.distance >= PATH_LENGTH) { balloon.hp = 0; game.lives = Math.max(0, game.lives - 1); }
  }
  game.balloons = game.balloons.filter((balloon) => balloon.hp > 0);
  if (!game.lives) { game.phase = "lost"; return; }

  for (const tower of game.towers) {
    tower.cooldown = Math.max(0, tower.cooldown - delta);
    if (tower.cooldown > 0 || game.shots.length >= 180) continue;
    const stats = towerStats(tower);
    let target: Balloon | null = null;
    for (const balloon of game.balloons) {
      if (Math.hypot(balloon.x - tower.x, balloon.y - tower.y) <= stats.range && (!target || balloon.distance > target.distance)) target = balloon;
    }
    if (!target) continue;
    tower.aim = { x: target.x, y: target.y };
    game.shots.push({ x: tower.x, y: tower.y - 8, target: target.id, kind: tower.kind, damage: stats.damage, speed: tower.kind === "pot" ? 190 : 290, splash: tower.kind === "pot" ? 34 + tower.level * 5 : 0, slow: tower.kind === "frost" ? 1.5 + tower.level * 0.4 : 0 });
    tower.cooldown = stats.cooldown;
  }

  const pop = (balloon: Balloon, shot: Shot) => {
    if (balloon.hp <= 0) return;
    balloon.hp -= shot.damage;
    if (shot.slow) balloon.slowUntil = game.time + shot.slow;
    if (balloon.hp <= 0) {
      game.pops += 1;
      game.cash += 5 + balloon.maxHp * 2;
      if (!reducedMotion && game.particles.length < 90) {
        for (let piece = 0; piece < 5; piece++) {
          const angle = piece * Math.PI * 2 / 5;
          game.particles.push({ x: balloon.x, y: balloon.y, vx: Math.cos(angle) * 38, vy: Math.sin(angle) * 38, age: 0.35, color: "#fff4ca" });
        }
      }
    }
  };
  game.shots = game.shots.filter((shot) => {
    const target = game.balloons.find((balloon) => balloon.id === shot.target && balloon.hp > 0);
    if (!target) return false;
    const distance = Math.hypot(target.x - shot.x, target.y - shot.y);
    const travel = shot.speed * delta;
    if (distance <= travel + 6) {
      if (shot.splash) game.balloons.forEach((balloon) => { if (Math.hypot(balloon.x - target.x, balloon.y - target.y) <= shot.splash) pop(balloon, shot); });
      else pop(target, shot);
      return false;
    }
    shot.x += (target.x - shot.x) / distance * travel;
    shot.y += (target.y - shot.y) / distance * travel;
    return true;
  });
  game.balloons = game.balloons.filter((balloon) => balloon.hp > 0);
  game.particles = game.particles.filter((particle) => {
    particle.age -= delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta;
    return particle.age > 0;
  });
  if (game.spawnLeft === 0 && game.balloons.length === 0) {
    game.cash += 25 + game.round * 8;
    game.shots = [];
    game.particles = [];
    game.phase = game.round >= LAST_ROUND ? "won" : "ready";
  }
}

function drawTower(context: CanvasRenderingContext2D, tower: Pick<Tower, "x" | "y" | "kind" | "level">, alpha = 1) {
  const x = Math.round(tower.x);
  const y = Math.round(tower.y);
  context.globalAlpha = alpha;
  context.fillStyle = "#294233";
  context.fillRect(x - 15, y + 8, 30, 6);
  context.fillStyle = "#302f2b";
  context.fillRect(x - 13, y - 10, 26, 22);
  context.fillRect(x - 9, y - 15, 18, 5);
  context.fillStyle = TYPES[tower.kind].color;
  context.fillRect(x - 10, y - 8, 20, 17);
  context.fillRect(x - 6, y - 12, 12, 4);
  context.fillStyle = "#faf3d6";
  context.fillRect(x - 8, y - 6, 4, 7);
  context.fillStyle = "#302f2b";
  if (tower.kind === "pin") {
    context.fillRect(x - 2, y - 21, 4, 17); context.fillRect(x - 9, y - 16, 18, 4);
    context.fillStyle = "#f6e2b6"; context.fillRect(x - 2, y - 16, 4, 4);
  } else if (tower.kind === "pot") {
    context.fillRect(x - 7, y - 17, 14, 10); context.fillStyle = "#837867"; context.fillRect(x - 4, y - 15, 8, 5);
  } else {
    context.fillRect(x - 2, y - 23, 4, 13); context.fillRect(x - 6, y - 20, 12, 4);
    context.fillStyle = "#e6f8ff"; context.fillRect(x - 2, y - 20, 4, 4);
  }
  context.fillStyle = "#302f2b";
  for (let level = 0; level < tower.level; level++) context.fillRect(x - 7 + level * 6, y + 4, 4, 3);
  context.globalAlpha = 1;
}

function paint(context: CanvasRenderingContext2D, game: Game, ui: UI) {
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, WIDTH, HEIGHT);
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 12; column++) {
      const x = column * TILE;
      const y = row * TILE;
      const key = `${column},${row}`;
      context.fillStyle = (row + column) % 2 ? "#c6d69b" : "#cdddab";
      context.fillRect(x, y, TILE, TILE);
      if (WATER.has(key)) {
        context.fillStyle = "#729ba8"; context.fillRect(x, y, TILE, TILE);
        context.fillStyle = "#b3d6d4"; context.fillRect(x + 5, y + 11, 12, 2); context.fillRect(x + 23, y + 27, 10, 2);
      } else if (ROCKS.has(key)) {
        context.fillStyle = "#657565"; context.fillRect(x + 11, y + 17, 23, 15); context.fillRect(x + 16, y + 12, 14, 6);
        context.fillStyle = "#9ca88f"; context.fillRect(x + 16, y + 15, 10, 4);
      } else {
        context.fillStyle = "#a0b77e"; context.fillRect(x + 7 + column % 4, y + 9, 2, 4); context.fillRect(x + 29, y + 29 - row % 3, 4, 2);
      }
    }
  }
  for (const width of [32, 26]) {
    context.fillStyle = width === 32 ? "#9a865e" : "#e3d0a4";
    for (let index = 1; index < PATH.length; index++) {
      const from = PATH[index - 1]; const to = PATH[index];
      context.fillRect(Math.min(from.x, to.x) - width / 2, Math.min(from.y, to.y) - width / 2, Math.abs(to.x - from.x) + width, Math.abs(to.y - from.y) + width);
    }
  }
  context.fillStyle = "#c6b183";
  for (let distance = 25; distance < PATH_LENGTH; distance += 37) {
    const point = alongPath(distance); context.fillRect(Math.round(point.x) - 2, Math.round(point.y) - 1, 5, 3);
  }
  // A little gate marks the exit. All artwork is drawn from simple pixel shapes.
  context.fillStyle = "#383b32";
  context.fillRect(464, 116, 7, 12); context.fillRect(464, 152, 7, 12);
  context.fillStyle = "#ede4c8"; context.fillRect(466, 119, 3, 6); context.fillRect(466, 155, 3, 6);
  context.font = "bold 9px monospace"; context.textAlign = "left"; context.fillStyle = "#3f5039";
  context.fillText("IN →", 7, 116); context.fillText("HOME", 438, 181);

  const selected = game.towers.find((tower) => tower.id === ui.towerId);
  const ghost = ui.kind && ui.hover ? tileCenter(ui.hover) : null;
  const rangeSource = ghost || selected;
  if (rangeSource) {
    const valid = !ghost || legalSite(game, ghost);
    const range = ghost && ui.kind ? TYPES[ui.kind].range : selected ? towerStats(selected).range : 0;
    context.beginPath(); context.arc(rangeSource.x, rangeSource.y, range, 0, Math.PI * 2);
    context.fillStyle = valid ? "rgba(255,255,231,.22)" : "rgba(179,62,68,.15)"; context.fill();
    context.strokeStyle = valid ? "#52754e" : "#af4c55"; context.lineWidth = 1; context.setLineDash([4, 4]); context.stroke(); context.setLineDash([]);
  }
  for (const tower of game.towers) {
    if (tower.id === ui.towerId) { context.strokeStyle = "#fff9da"; context.lineWidth = 2; context.strokeRect(tower.x - 18, tower.y - 27, 36, 43); }
    drawTower(context, tower);
  }
  if (ghost && ui.kind) {
    context.fillStyle = legalSite(game, ghost) ? "rgba(255,255,236,.35)" : "rgba(188,62,61,.4)";
    context.fillRect(ghost.x - 19, ghost.y - 19, 38, 38);
    drawTower(context, { ...ghost, kind: ui.kind, level: 1 }, 0.65);
  } else if (ui.hover && !ui.kind) {
    const cursor = tileCenter(ui.hover);
    context.strokeStyle = "#faf4da"; context.lineWidth = 2;
    context.strokeRect(cursor.x - 18, cursor.y - 18, 36, 36);
  }
  for (const balloon of game.balloons) {
    const x = Math.round(balloon.x);
    const y = Math.round(balloon.y + (ui.reducedMotion ? 0 : Math.sin(game.time * 4 + balloon.id) * 1.5));
    const palette = ["#e8797a", "#79b8dd", "#92c476", "#e6bd62", "#be91d5", "#e49c78", "#e5c9e8"];
    context.fillStyle = "#423a3b"; context.fillRect(x - 5, y - 10, 10, 19); context.fillRect(x - 8, y - 6, 16, 11);
    context.fillStyle = palette[Math.min(6, balloon.hp - 1)]; context.fillRect(x - 4, y - 8, 8, 15); context.fillRect(x - 6, y - 5, 12, 9);
    context.fillStyle = "#fff1dc"; context.fillRect(x - 3, y - 6, 3, 4);
    context.fillStyle = "#423a3b"; context.fillRect(x - 1, y + 9, 2, 3); context.fillRect(x, y + 13, 1, 5);
    if (balloon.slowUntil > game.time) { context.fillStyle = "#e9ffff"; context.fillRect(x - 9, y - 12, 3, 3); context.fillRect(x + 7, y + 3, 3, 3); }
  }
  for (const shot of game.shots) {
    context.fillStyle = shot.kind === "frost" ? "#f2ffff" : shot.kind === "pot" ? "#645346" : "#443545";
    const size = shot.kind === "pot" ? 5 : 3; context.fillRect(Math.round(shot.x) - 1, Math.round(shot.y) - 1, size, size);
  }
  if (!ui.reducedMotion) for (const particle of game.particles) { context.fillStyle = particle.color; context.fillRect(Math.round(particle.x), Math.round(particle.y), 3, 3); }
  // The menu covers game over and help. This only marks a Space pause, which can still build.
  if (game.phase === "paused") {
    context.fillStyle = "#faf4da"; context.textAlign = "center"; context.font = "bold 12px monospace";
    context.fillText("PAUSED", WIDTH / 2, 16);
  }
}

function TowerIcon({ kind }: { kind: Kind }) {
  return <svg width="29" height="29" viewBox="0 0 29 29" aria-hidden="true" shapeRendering="crispEdges"><path fill="#30332e" d="M5 14h19v13H5zM8 10h13v5H8z" /><path fill={TYPES[kind].color} d="M8 16h13v8H8zM11 12h7v5h-7z" />{kind === "pin" ? <path fill="#30332e" d="M13 1h3v14h-3zM7 6h15v3H7z" /> : kind === "pot" ? <><path fill="#30332e" d="M9 4h12v10H9z" /><path fill="#a99579" d="M12 6h6v4h-6z" /></> : <><path fill="#30332e" d="M13 1h3v13h-3zM8 5h13v3H8z" /><path fill="#e8ffff" d="M13 5h3v3h-3z" /></>}</svg>;
}

export default function BalloonBastion() {
  const gameRef = useRef<Game>(newGame());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiRef = useRef<UI>({ kind: "pin", towerId: null, hover: null, reducedMotion: false });
  const speedRef = useRef(1);
  const [hud, setHud] = useState<HUD>(() => hudFor(gameRef.current));
  const [kind, setKind] = useState<Kind | null>("pin");
  const [towerId, setTowerId] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [helpOpen,setHelpOpen]=useState(false);
  const [notice, setNotice] = useState("Build on grass, then start round 1.");

  const draw = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) paint(context, gameRef.current, uiRef.current);
  }, []);
  const sync = useCallback(() => { setHud(hudFor(gameRef.current)); draw(); }, [draw]);

  const pauseWhileAway = useCallback(() => {
    if (gameRef.current.phase !== "running") return;
    gameRef.current.phase = "paused"; setHelpOpen(true); setNotice("Paused."); setHud(hudFor(gameRef.current)); draw();
  }, [draw]);

  useEffect(() => {
    canvasRef.current?.focus({ preventScroll: true });
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { uiRef.current.reducedMotion = query.matches; draw(); };
    updateMotion();
    const onVisibility = () => { if (document.hidden) pauseWhileAway(); };
    const onAppFocus = (event: Event) => {
      const { detail } = event as CustomEvent<{ id: string | null }>;
      if (detail?.id !== "balloon-bastion") pauseWhileAway();
    };
    query.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pauseWhileAway);
    window.addEventListener("storm-app-focus", onAppFocus);
    return () => {
      query.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pauseWhileAway);
      window.removeEventListener("storm-app-focus", onAppFocus);
    };
  }, [draw, pauseWhileAway]);

  useEffect(() => {
    if (hud.phase !== "running") return;
    let frame = 0;
    let last = 0;
    let lastHUD = 0;
    const animate = (now: number) => {
      const game = gameRef.current;
      if (game.phase !== "running" || document.hidden) return;
      const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      // Small simulation steps keep fast projectiles and 3× speed reliable.
      const elapsed = delta * speedRef.current;
      const steps = Math.max(1, Math.ceil(elapsed / 0.025));
      for (let step = 0; step < steps; step++) tick(game, elapsed / steps, uiRef.current.reducedMotion);
      draw();
      if (now - lastHUD >= 100 || game.phase !== "running") { setHud(hudFor(game)); lastHUD = now; }
      if (game.phase === "running") frame = requestAnimationFrame(animate);
      else setNotice(game.phase === "won" ? "All 12 rounds cleared." : game.phase === "lost" ? "Game over." : `Round ${game.round} clear.`);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [hud.phase, draw]);

  const selectKind = (next: Kind) => {
    const nextKind = kind === next ? null : next;
    uiRef.current.kind = nextKind; uiRef.current.towerId = null;
    setKind(nextKind); setTowerId(null);
    setNotice(nextKind ? `${TYPES[nextKind].name}: ${TYPES[nextKind].note.toLowerCase()}.` : "Select a tower to inspect it.");
    draw();
  };

  const interact = (point: Point) => {
    const game = gameRef.current;
    if (game.phase === "lost" || game.phase === "won") return;
    const existing = game.towers.find((tower) => Math.hypot(tower.x - point.x, tower.y - point.y) <= 23);
    if (existing) {
      uiRef.current.towerId = existing.id; uiRef.current.kind = null; uiRef.current.hover = null;
      setTowerId(existing.id); setKind(null); setNotice(`${TYPES[existing.kind].name}, level ${existing.level}.`); draw(); return;
    }
    const selectedKind = uiRef.current.kind;
    if (!selectedKind) { uiRef.current.towerId = null; setTowerId(null); draw(); setNotice("Choose a tower, then select grass."); return; }
    const position = tileCenter(point);
    uiRef.current.hover = position;
    if (!legalSite(game, position)) { setNotice("Can't build there."); draw(); return; }
    if (game.towers.length >= MAX_TOWERS) { setNotice("20 towers maximum."); return; }
    if (game.cash < TYPES[selectedKind].cost) { setNotice("Not enough coins."); return; }
    const tower: Tower = { ...position, id: game.nextId++, kind: selectedKind, level: 1, cooldown: 0, spent: TYPES[selectedKind].cost, aim: { x: position.x, y: position.y - 20 } };
    game.cash -= tower.spent; game.towers.push(tower);
    uiRef.current.towerId = tower.id; uiRef.current.kind = null; uiRef.current.hover = null;
    setTowerId(tower.id); setKind(null); setNotice(`${TYPES[selectedKind].name} built.`); sync();
  };

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(WIDTH - 1, (event.clientX - rect.left) / rect.width * WIDTH)), y: Math.max(0, Math.min(HEIGHT - 1, (event.clientY - rect.top) / rect.height * HEIGHT)) };
  };

  const startOrPause = () => {
    const game = gameRef.current;
    if (game.phase === "running") { game.phase = "paused"; setNotice("Paused. You can still build."); }
    else if (game.phase === "paused") { game.phase = "running"; setNotice("Resumed."); }
    else if (game.phase === "ready") {
      if (!game.towers.length) { setNotice("Build a tower first."); return; }
      game.round += 1; game.spawnLeft = 7 + game.round * 3; game.spawned = 0; game.spawnTimer = 0.35; game.phase = "running";
      setNotice(`Round ${game.round}.`);
    }
    sync();
  };

  const selected = gameRef.current.towers.find((tower) => tower.id === towerId);
  const selectedStats = selected ? towerStats(selected) : null;
  const ended = hud.phase === "won" || hud.phase === "lost";

  const reset=()=>{
    gameRef.current=newGame();uiRef.current.kind="pin";uiRef.current.towerId=null;uiRef.current.hover=null;
    setKind("pin");setTowerId(null);setHelpOpen(false);setNotice("Build on grass, then start round 1.");sync();canvasRef.current?.focus({preventScroll:true});
  };
  const help=()=>{
    const game=gameRef.current;
    if(game.phase==="won"||game.phase==="lost")return;
    if(helpOpen){if(game.phase==="paused"){game.phase="running";setNotice("Resumed.");}setHelpOpen(false);canvasRef.current?.focus({preventScroll:true});}
    else {if(game.phase==="running")game.phase="paused";setHelpOpen(true);}
    sync();
  };
  return <section className={`${arcade.shell} ${styles.game}`} aria-label="Balloon Bastion tower defence game" onBlur={event=>handleGameBlur(event,pauseWhileAway,()=>canvasRef.current)} onKeyDownCapture={event=>{
    if(event.key==="Escape"&&!event.repeat){event.preventDefault();event.stopPropagation();help();return;}
    if(helpOpen||ended)return;
    const towerKey=Number(event.key)-1;
    if(towerKey>=0&&towerKey<3){event.preventDefault();selectKind((Object.keys(TYPES) as Kind[])[towerKey]);}
    if(event.code==="Space"&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();event.stopPropagation();startOrPause();}
  }}>
    <div className={arcade.hud} aria-label="Village status"><span>COINS <strong>{hud.cash}</strong></span><span>LIVES <strong>{hud.lives}</strong></span><span>ROUND <strong>{hud.round}/12</strong></span><span>POPS <strong>{hud.pops}</strong></span><span className={arcade.spacer}/><button onClick={help} aria-label="Help and pause">?</button></div>
    <div className={arcade.field}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className={arcade.canvas} tabIndex={0} aria-label="Battlefield. Choose a tower, then click grass. Arrows move cursor, Enter builds, Space starts round. Escape for controls."
        onPointerDown={event=>{event.preventDefault();event.currentTarget.focus({preventScroll:true});interact(pointerPosition(event));}}
        onPointerMove={event=>{if(event.pointerType==="mouse"&&uiRef.current.kind){uiRef.current.hover=pointerPosition(event);draw();}}}
        onPointerLeave={()=>{uiRef.current.hover=null;draw();}}
        onKeyDown={event=>{
          if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();const current=tileCenter(uiRef.current.hover||{x:180,y:180});uiRef.current.hover=tileCenter({x:current.x+(event.key==="ArrowRight"?TILE:event.key==="ArrowLeft"?-TILE:0),y:current.y+(event.key==="ArrowDown"?TILE:event.key==="ArrowUp"?-TILE:0)});draw();}
          else if(event.key==="Enter"){event.preventDefault();interact(uiRef.current.hover||{x:180,y:180});}
        }}/>
      {(helpOpen||ended)&&<ArcadeMenu title={ended?hud.phase==="won"?"ALL WAVES CLEARED":"GAME OVER":"PAUSED"} controls={ended?[`${hud.pops} balloons popped`]:["1 / 2 / 3: choose tower","Click grass: build · Click tower: inspect","Arrows + Enter: keyboard building","Space: start / pause wave","Keep balloons away from the exit."]} action={ended?reset:help} label={ended?"Play again":"Resume"} restart={ended?undefined:reset}/>}
    </div>
    <div className={`${arcade.toolbar} ${styles.shop}`} aria-label="Choose a tower to build">{(Object.keys(TYPES) as Kind[]).map((towerKind,i)=><button key={towerKind} aria-pressed={kind===towerKind} disabled={ended} onClick={()=>selectKind(towerKind)} title={TYPES[towerKind].note}><TowerIcon kind={towerKind}/><span>{TYPES[towerKind].name} · {TYPES[towerKind].cost}<kbd>{i+1}</kbd></span></button>)}</div>
    {selected&&selectedStats&&<div className={arcade.toolbar}><span className={styles.towerName}>{TYPES[selected.kind].name} · LV {selected.level}</span><button disabled={ended||selected.level>=3||hud.cash<selectedStats.upgrade} onClick={()=>{
      const game=gameRef.current,tower=game.towers.find(item=>item.id===towerId);if(!tower||tower.level>=3)return;const cost=towerStats(tower).upgrade;if(game.cash<cost)return;game.cash-=cost;tower.spent+=cost;tower.level++;setNotice(`Level ${tower.level}`);sync();
    }}>{selected.level>=3?"Max level":`Upgrade · ${selectedStats.upgrade}`}</button><button disabled={ended} onClick={()=>{const game=gameRef.current;game.cash+=selectedStats.sell;game.towers=game.towers.filter(tower=>tower.id!==towerId);uiRef.current.towerId=null;setTowerId(null);setNotice(`Sold · ${selectedStats.sell} coins`);sync();}}>Sell · {selectedStats.sell}</button></div>}
    <div className={arcade.toolbar}><button disabled={ended||helpOpen} onClick={startOrPause}>{hud.phase==="running"?"Pause":hud.phase==="paused"?"Resume":`Start round ${Math.min(12,hud.round+1)}`}</button><button aria-label={`Game speed ${speed} times. Click to change.`} onClick={()=>{const next=speed===3?1:speed+1;speedRef.current=next;setSpeed(next);}}>{speed}×</button></div>
    <div className={arcade.status} role="status">{notice}</div>
  </section>;
}
