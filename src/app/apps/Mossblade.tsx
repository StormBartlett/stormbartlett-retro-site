"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./Mossblade.module.css";

type Phase = "ready" | "playing" | "paused" | "won" | "lost";
type Direction = "up" | "right" | "down" | "left";
type Tile = "grass" | "path" | "water" | "bridge" | "tree" | "rock";
type Enemy = { id: number; x: number; y: number; homeX: number; homeY: number; hp: number; flash: number; kind: "rose" | "moss" };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Pickup = { x: number; y: number; taken: boolean };
type Game = {
  player: { x: number; y: number; facing: Direction; health: number; invulnerable: number; attack: number; cooldown: number; step: number };
  enemies: Enemy[];
  stones: Pickup[];
  hearts: Pickup[];
  particles: Particle[];
  hitIds: Set<number>;
  queuedAttack: boolean;
  time: number;
  kills: number;
  message: string;
  messageTime: number;
};
type Hud = { health: number; stones: number; message: string };

const TILE = 16;
const COLS = 28;
const ROWS = 22;
const VIEW_W = 320;
const VIEW_H = 224;
const MAX_HEALTH = 5;
const START = { x: 14.5 * TILE, y: 19.5 * TILE };
const SAFE_RADIUS = 2.5 * TILE;
const INITIAL_GRACE = 3;
const EXIT = { x: 14.5 * TILE, y: 1.8 * TILE };
const STONES = [{ x: 5.5 * TILE, y: 5.5 * TILE }, { x: 23.5 * TILE, y: 6.5 * TILE }, { x: 22.5 * TILE, y: 16.5 * TILE }];
const FACING: Record<Direction, { x: number; y: number; angle: number }> = {
  up: { x: 0, y: -1, angle: -Math.PI / 2 }, right: { x: 1, y: 0, angle: 0 },
  down: { x: 0, y: 1, angle: Math.PI / 2 }, left: { x: -1, y: 0, angle: Math.PI },
};
const KEY_CONTROLS: Record<string, string> = {
  ArrowUp: "up", KeyW: "up", ArrowRight: "right", KeyD: "right",
  ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", Space: "attack", KeyJ: "attack",
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const seed = (x: number, y: number) => ((x * 7919 + y * 6271 + x * y * 31) >>> 0) % 997;

function makeWorld(): Tile[][] {
  return Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x): Tile => {
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return "tree";
    const pond = (x >= 4 && x <= 8 && y >= 12 && y <= 15 && !(x === 4 && y === 12) && !(x === 8 && y === 15)) || (x >= 18 && x <= 21 && y >= 9 && y <= 12 && !(x === 18 && y === 9));
    const path = x === 14 || x === 15 || ((y === 5 || y === 6) && x >= 5 && x <= 24) || ((y === 16 || y === 17) && x >= 14 && x <= 23) || (y === 11 && x >= 14 && x <= 24);
    if (path) return pond ? "bridge" : "path";
    if (pond) return "water";
    const protectedArea = [...STONES, EXIT, START].some((point) => Math.hypot(x + .5 - point.x / TILE, y + .5 - point.y / TILE) < 2.1);
    if (!protectedArea && seed(x, y) % 13 === 0) return "tree";
    if (!protectedArea && seed(x, y) % 41 === 0) return "rock";
    return "grass";
  }));
}
const WORLD = makeWorld();

function createGame(): Game {
  const positions = [[7.5, 6.5], [5.5, 8.5], [20.5, 6.5], [23.5, 8.5], [21.5, 17.5], [17.5, 16.5], [12.5, 4.5]];
  return {
    player: { ...START, facing: "up", health: MAX_HEALTH, invulnerable: 0, attack: 0, cooldown: 0, step: 0 },
    enemies: positions.map(([x, y], id) => ({ id, x: x * TILE, y: y * TILE, homeX: x * TILE, homeY: y * TILE, hp: id % 3 === 0 ? 3 : 2, flash: 0, kind: id % 3 === 0 ? "moss" : "rose" })),
    stones: STONES.map((stone) => ({ ...stone, taken: false })),
    hearts: [{ x: 14.5 * TILE, y: 10.5 * TILE, taken: false }, { x: 10.5 * TILE, y: 6.5 * TILE, taken: false }],
    particles: [], hitIds: new Set(), queuedAttack: false, time: 0, kills: 0,
    message: "The clearing is safe. Follow the paths north.", messageTime: 5,
  };
}

function blocked(x: number, y: number, radius: number): boolean {
  for (const px of [x - radius, x + radius]) {
    for (const py of [y - radius, y + radius]) {
      const tile = WORLD[Math.floor(py / TILE)]?.[Math.floor(px / TILE)];
      if (!tile || tile === "tree" || tile === "rock" || tile === "water") return true;
    }
  }
  return false;
}

function move(body: { x: number; y: number }, dx: number, dy: number, radius: number) {
  if (!blocked(body.x + dx, body.y, radius)) body.x += dx;
  if (!blocked(body.x, body.y + dy, radius)) body.y += dy;
}

function burst(game: Game, x: number, y: number, color: string, reduced: boolean) {
  if (reduced) return;
  for (let index = 0; index < 7 && game.particles.length < 70; index++) {
    const angle = index * Math.PI * 2 / 7;
    game.particles.push({ x, y, vx: Math.cos(angle) * 28, vy: Math.sin(angle) * 28 - 7, life: .35, color });
  }
}

function advance(game: Game, held: Set<string>, dt: number, reduced: boolean): "won" | "lost" | undefined {
  game.time += dt;
  game.messageTime = Math.max(0, game.messageTime - dt);
  const player = game.player;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.attack = Math.max(0, player.attack - dt);
  const active = (control: string) => [...held].some((key) => (KEY_CONTROLS[key] || key.replace("touch:", "")) === control);
  let dx = Number(active("right")) - Number(active("left"));
  let dy = Number(active("down")) - Number(active("up"));
  const magnitude = Math.hypot(dx, dy);
  if (magnitude) {
    dx /= magnitude;
    dy /= magnitude;
    player.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
    move(player, dx * 68 * dt, dy * 68 * dt, 5);
    player.step += dt * 11;
  }
  if ((active("attack") || game.queuedAttack) && player.cooldown <= 0) {
    player.attack = .2;
    player.cooldown = .34;
    game.hitIds.clear();
    game.queuedAttack = false;
  }

  const protectedPlayer = game.time < INITIAL_GRACE || distance(player, START) <= SAFE_RADIUS;
  const facing = FACING[player.facing];
  for (const enemy of game.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    const range = distance(player, enemy);
    if (player.attack > 0 && range < 29 && range > 0 && ((enemy.x - player.x) * facing.x + (enemy.y - player.y) * facing.y) / range > -.1 && !game.hitIds.has(enemy.id)) {
      game.hitIds.add(enemy.id);
      enemy.hp--;
      enemy.flash = .22;
      move(enemy, (enemy.x - player.x) / range * 9, (enemy.y - player.y) / range * 9, 5);
      burst(game, enemy.x, enemy.y - 3, enemy.kind === "rose" ? "#f6b9a0" : "#c5ed9d", reduced);
      if (enemy.hp <= 0) {
        game.kills++;
        if (game.kills % 2 === 0) game.hearts.push({ x: enemy.x, y: enemy.y, taken: false });
      }
    }
    if (enemy.hp <= 0) continue;
    const pursuing = !protectedPlayer && range < 105;
    const target = pursuing ? player : { x: enemy.homeX + Math.sin(game.time * .7 + enemy.id) * 13, y: enemy.homeY + Math.cos(game.time * .6 + enemy.id) * 10 };
    const tx = target.x - enemy.x;
    const ty = target.y - enemy.y;
    const length = Math.hypot(tx, ty);
    if (length > 2 && !enemy.flash) {
      const speed = (pursuing ? enemy.kind === "moss" ? 20 : 25 : 9) * dt;
      move(enemy, tx / length * speed, ty / length * speed, 5);
    }
    if (!protectedPlayer && distance(player, enemy) < 11 && !player.invulnerable) {
      player.health--;
      player.invulnerable = 1.25;
      const nx = player.x - enemy.x;
      const ny = player.y - enemy.y;
      const n = Math.hypot(nx, ny) || 1;
      move(player, nx / n * 10, ny / n * 10, 5);
      burst(game, player.x, player.y, "#f4d7b2", reduced);
      if (player.health <= 0) return "lost";
    }
  }
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
  for (const stone of game.stones) {
    if (!stone.taken && distance(player, stone) < 12) {
      stone.taken = true;
      const count = game.stones.filter((item) => item.taken).length;
      game.message = count === 3 ? "The northern arch is awake. Follow the path north!" : `Sunstone ${count}/3 found. The grove glows a little brighter.`;
      game.messageTime = 5;
      burst(game, stone.x, stone.y - 4, "#ffe6a0", reduced);
    }
  }
  for (const heart of game.hearts) {
    if (!heart.taken && player.health < MAX_HEALTH && distance(player, heart) < 11) {
      heart.taken = true;
      player.health++;
      burst(game, heart.x, heart.y, "#f4a5a0", reduced);
    }
  }
  game.particles = game.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    return particle.life > 0;
  });
  if (game.stones.every((stone) => stone.taken) && distance(player, EXIT) < 13) return "won";
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#773a49";
  ctx.fillRect(x - 4, y - 2, 9, 4);
  ctx.fillRect(x - 3, y + 2, 7, 2);
  ctx.fillRect(x - 1, y + 4, 3, 1);
  ctx.fillStyle = "#f29391";
  ctx.fillRect(x - 3, y - 3, 3, 5);
  ctx.fillRect(x + 1, y - 3, 3, 5);
  ctx.fillRect(x - 2, y + 1, 5, 2);
  ctx.fillRect(x, y + 3, 1, 1);
  ctx.fillStyle = "#ffd2bd";
  ctx.fillRect(x - 2, y - 2, 1, 2);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  ctx.fillStyle = "#253d34";
  ctx.fillRect(x + 2, y + 9, 14, 6);
  ctx.fillStyle = "#695842";
  ctx.fillRect(x + 6, y + 6, 5, 9);
  ctx.fillStyle = "#8c7651";
  ctx.fillRect(x + 7, y + 7, 2, 6);
  ctx.fillStyle = "#213f39";
  ctx.fillRect(x + 1, y - 2, 15, 12);
  ctx.fillRect(x + 4, y - 7, 10, 17);
  ctx.fillStyle = variant % 2 ? "#3c6650" : "#416c50";
  ctx.fillRect(x + 2, y - 3, 12, 10);
  ctx.fillRect(x + 5, y - 8, 7, 15);
  ctx.fillStyle = "#67915b";
  ctx.fillRect(x + 5, y - 5, 5, 2);
  ctx.fillRect(x + 3, y, 3, 2);
  ctx.fillStyle = "#82a56a";
  ctx.fillRect(x + 6, y - 6, 2, 1);
}

function drawHero(ctx: CanvasRenderingContext2D, game: Game, reduced: boolean) {
  const player = game.player;
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const step = reduced ? 0 : Math.sin(player.step) > 0 ? 1 : 0;
  ctx.fillStyle = "#284637";
  ctx.fillRect(x - 5, y - 1, 11, 4);
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) ctx.globalAlpha = .45;
  ctx.fillStyle = "#182d38";
  ctx.fillRect(x - 4, y - 6, 9, 7);
  ctx.fillRect(x - 4, y, 3, 3 - step);
  ctx.fillRect(x + 2, y, 3, 2 + step);
  ctx.fillStyle = "#78a99a";
  ctx.fillRect(x - 4, y - 8, 9, 6);
  ctx.fillStyle = "#4a7e78";
  ctx.fillRect(x - 5, y - 6, 3, 6);
  ctx.fillRect(x + 3, y - 6, 3, 6);
  ctx.fillStyle = "#f3cfa0";
  ctx.fillRect(x - 3, y - 14, 7, 7);
  ctx.fillRect(x - 6, y - 4, 2, 3);
  ctx.fillRect(x + 5, y - 4, 2, 3);
  ctx.fillStyle = "#263f42";
  ctx.fillRect(x - 4, y - 16, 8, 4);
  ctx.fillRect(x - 5, y - 14, 3, 5);
  ctx.fillStyle = "#df9563";
  ctx.fillRect(x - 4, y - 8, 9, 2);
  ctx.fillRect(x + 4, y - 7, 4, 2);
  ctx.fillStyle = "#1a3035";
  if (player.facing === "down") { ctx.fillRect(x - 2, y - 11, 1, 2); ctx.fillRect(x + 2, y - 11, 1, 2); }
  else if (player.facing === "left") ctx.fillRect(x - 3, y - 11, 1, 2);
  else if (player.facing === "right") ctx.fillRect(x + 3, y - 11, 1, 2);
  else { ctx.fillRect(x - 3, y - 14, 7, 6); ctx.fillStyle = "#8ab8a0"; ctx.fillRect(x - 2, y - 5, 5, 2); }
  ctx.globalAlpha = 1;
  if (player.attack > 0) {
    const facing = FACING[player.facing];
    const progress = 1 - player.attack / .2;
    const angle = facing.angle - .95 + progress * 1.9;
    ctx.save();
    ctx.translate(x, y - 5);
    ctx.rotate(angle);
    ctx.fillStyle = "#f4efc8";
    ctx.fillRect(8, -2, 18, 3);
    ctx.fillStyle = "#b6d8c1";
    ctx.fillRect(9, 1, 14, 1);
    ctx.fillStyle = "#e1af6b";
    ctx.fillRect(6, -4, 3, 8);
    ctx.fillStyle = "#75563d";
    ctx.fillRect(2, -1, 5, 2);
    ctx.restore();
    if (!reduced) {
      ctx.strokeStyle = "#e6efb7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 5, 25, facing.angle - .9, angle);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#b0c9bc";
    ctx.fillRect(x - 7, y - 10, 2, 8);
    ctx.fillStyle = "#d4b278";
    ctx.fillRect(x - 8, y - 3, 4, 2);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number, reduced: boolean) {
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const bob = !reduced && Math.sin(time * 6 + enemy.id) > .1 ? 1 : 0;
  const moss = enemy.kind === "moss";
  ctx.fillStyle = "#294538";
  ctx.fillRect(x - 6, y, 13, 3);
  ctx.fillStyle = enemy.flash ? "#fff0ce" : moss ? "#719a69" : "#cf7e7b";
  ctx.fillRect(x - 6, y - 7 + bob, 13, 8 - bob);
  ctx.fillRect(x - 4, y - 10 + bob, 9, 11 - bob);
  ctx.fillStyle = enemy.flash ? "#fff0ce" : moss ? "#9db77a" : "#efa78d";
  ctx.fillRect(x - 3, y - 8 + bob, 7, 3);
  ctx.fillStyle = "#303b3a";
  ctx.fillRect(x - 3, y - 4 + bob, 1, 2);
  ctx.fillRect(x + 3, y - 4 + bob, 1, 2);
  ctx.fillRect(x, y - 1 + bob, 2, 1);
  if (moss) {
    ctx.fillStyle = "#354f39";
    ctx.fillRect(x, y - 14 + bob, 1, 5);
    ctx.fillStyle = "#b8ca84";
    ctx.fillRect(x - 3, y - 15 + bob, 4, 2);
    ctx.fillRect(x + 1, y - 13 + bob, 3, 2);
  }
}

function drawGame(canvas: HTMLCanvasElement, game: Game, reduced: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const cameraX = Math.round(clamp(game.player.x - VIEW_W / 2, 0, COLS * TILE - VIEW_W));
  const cameraY = Math.round(clamp(game.player.y - VIEW_H / 2, 0, ROWS * TILE - VIEW_H));
  ctx.fillStyle = "#54774b";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cameraX, -cameraY);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * TILE;
      const py = y * TILE;
      if (px < cameraX - 16 || px > cameraX + VIEW_W || py < cameraY - 16 || py > cameraY + VIEW_H + 24) continue;
      const tile = WORLD[y][x];
      const variation = seed(x, y);
      if (tile === "path") {
        ctx.fillStyle = variation % 2 ? "#acaa79" : "#a5a373";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#92945f";
        ctx.fillRect(px + variation % 10 + 2, py + 4, 2, 1);
        ctx.fillRect(px + 10, py + 12, 2, 1);
      } else if (tile === "water" || tile === "bridge") {
        ctx.fillStyle = "#3e7777";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#6d9b8a";
        const ripple = reduced ? 0 : Math.floor(game.time * 2 + x + y) % 3;
        ctx.fillRect(px + 2 + ripple, py + 5, 6, 1);
        ctx.fillRect(px + 8 - ripple, py + 12, 5, 1);
        if (tile === "bridge") {
          ctx.fillStyle = "#695e48"; ctx.fillRect(px, py + 1, 16, 14);
          ctx.fillStyle = "#b5a17a";
          for (let plank = 0; plank < 4; plank++) ctx.fillRect(px + plank * 4, py + 2, 3, 12);
          ctx.fillStyle = "#dbc293"; ctx.fillRect(px, py + 2, 16, 1);
        }
      } else {
        ctx.fillStyle = variation % 3 === 0 ? "#5d8050" : variation % 3 === 1 ? "#587c4c" : "#54774b";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#6c8c57";
        ctx.fillRect(px + variation % 12 + 1, py + 4, 2, 2);
        ctx.fillStyle = "#3f6845";
        ctx.fillRect(px + 4, py + 11, 1, 3);
        ctx.fillRect(px + 5, py + 12, 2, 1);
        if (tile === "grass" && variation % 7 === 0) {
          ctx.fillStyle = variation % 2 ? "#e0be8a" : "#bac68b";
          ctx.fillRect(px + 11, py + 8, 2, 2);
        }
      }
    }
  }

  const count = game.stones.filter((stone) => stone.taken).length;
  const ex = EXIT.x;
  const ey = EXIT.y;
  ctx.fillStyle = "#2a4a41";
  ctx.fillRect(ex - 13, ey - 20, 27, 25);
  ctx.fillStyle = count === 3 ? "#c5dbae" : "#687c63";
  ctx.fillRect(ex - 8, ey - 15, 17, 19);
  ctx.fillStyle = count === 3 ? "#719d83" : "#334e45";
  ctx.fillRect(ex - 6, ey - 13, 13, 18);
  ctx.fillStyle = "#9d9e78";
  ctx.fillRect(ex - 14, ey - 19, 5, 25);
  ctx.fillRect(ex + 10, ey - 19, 5, 25);
  ctx.fillRect(ex - 10, ey - 24, 21, 6);
  ctx.fillStyle = "#c2bc8b";
  ctx.fillRect(ex - 13, ey - 19, 3, 3);
  ctx.fillRect(ex + 11, ey - 19, 3, 3);
  for (let index = 0; index < 3; index++) { ctx.fillStyle = index < count ? "#ffe3a0" : "#526148"; ctx.fillRect(ex - 7 + index * 6, ey - 23, 3, 3); }
  if (count === 3) { ctx.fillStyle = "#e6efbc"; ctx.fillRect(ex - 1, ey - 9, 3, 9); ctx.fillRect(ex - 3, ey - 6, 7, 3); }

  for (const stone of game.stones) {
    ctx.fillStyle = "#3e6248"; ctx.fillRect(stone.x - 9, stone.y - 3, 18, 9);
    ctx.fillStyle = "#8c9c6b"; ctx.fillRect(stone.x - 7, stone.y - 5, 14, 8);
    ctx.fillStyle = "#bec28a"; ctx.fillRect(stone.x - 6, stone.y - 5, 12, 2);
    if (!stone.taken) {
      const bob = reduced ? 0 : Math.round(Math.sin(game.time * 3) * 2);
      const y = stone.y - 12 + bob;
      ctx.fillStyle = "#8b6f41"; ctx.fillRect(stone.x - 4, y - 2, 9, 8);
      ctx.fillStyle = "#efc87c"; ctx.fillRect(stone.x - 3, y - 4, 7, 8); ctx.fillRect(stone.x - 1, y + 4, 3, 2);
      ctx.fillStyle = "#fff2bc"; ctx.fillRect(stone.x - 2, y - 3, 2, 5);
    }
  }
  for (const heart of game.hearts) if (!heart.taken) drawHeart(ctx, Math.round(heart.x), Math.round(heart.y) - 4);

  const objects: { depth: number; draw: () => void }[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (WORLD[y][x] === "tree") objects.push({ depth: y * TILE + 13, draw: () => drawTree(ctx, x * TILE, y * TILE, seed(x, y)) });
      else if (WORLD[y][x] === "rock") objects.push({ depth: y * TILE + 12, draw: () => {
        ctx.fillStyle = "#3f5849"; ctx.fillRect(x * TILE + 1, y * TILE + 8, 15, 6);
        ctx.fillStyle = "#848e72"; ctx.fillRect(x * TILE + 2, y * TILE + 4, 12, 8); ctx.fillRect(x * TILE + 5, y * TILE + 1, 7, 11);
        ctx.fillStyle = "#afb08a"; ctx.fillRect(x * TILE + 5, y * TILE + 2, 6, 2);
        ctx.fillStyle = "#53784a"; ctx.fillRect(x * TILE + 2, y * TILE + 9, 5, 3);
      } });
    }
  }
  objects.push({ depth: game.player.y, draw: () => drawHero(ctx, game, reduced) });
  for (const enemy of game.enemies) objects.push({ depth: enemy.y, draw: () => drawEnemy(ctx, enemy, game.time, reduced) });
  objects.sort((a, b) => a.depth - b.depth).forEach((object) => object.draw());
  for (const particle of game.particles) { ctx.fillStyle = particle.color; ctx.fillRect(Math.round(particle.x), Math.round(particle.y), 2, 2); }
  ctx.restore();

  // A tiny hand-drawn map keeps the three paths legible at mobile sizes.
  const mapX = VIEW_W - 65;
  const mapY = 9;
  ctx.fillStyle = "#203d35e8"; ctx.fillRect(mapX - 3, mapY - 3, COLS * 2 + 6, ROWS * 2 + 6);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const tile = WORLD[y][x];
    ctx.fillStyle = tile === "water" ? "#6a9991" : tile === "tree" || tile === "rock" ? "#2b4d3b" : tile === "path" || tile === "bridge" ? "#a3a278" : "#64825a";
    ctx.fillRect(mapX + x * 2, mapY + y * 2, 2, 2);
  }
  for (const stone of game.stones) if (!stone.taken) { ctx.fillStyle = "#ffe7a3"; ctx.fillRect(mapX + stone.x / 8 - 1, mapY + stone.y / 8 - 1, 3, 3); }
  ctx.fillStyle = count === 3 ? "#f2f6c1" : "#b6d2b0"; ctx.fillRect(mapX + EXIT.x / 8 - 1, mapY + EXIT.y / 8 - 1, 3, 3);
  ctx.fillStyle = "#fff4dc"; ctx.fillRect(mapX + Math.floor(game.player.x / 8) - 1, mapY + Math.floor(game.player.y / 8) - 1, 3, 3);
}

function hudFor(game: Game): Hud {
  const stones = game.stones.filter((stone) => stone.taken).length;
  return { health: game.player.health, stones, message: game.messageTime > 0 ? game.message : stones === 3 ? "All sunstones found. Return to the northern arch ↑" : distance(game.player, START) <= SAFE_RADIUS ? "The clearing is safe. Follow the paths north." : "Find the golden dots on your map. Swing to clear a path." };
}

export default function Mossblade() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState<Hud>({ health: MAX_HEALTH, stones: 0, message: "The clearing is safe. Follow the paths north." });
  const [reducedMotion, setReducedMotion] = useState(false);
  const game = useRef<Game>(createGame());
  const held = useRef(new Set<string>());
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>(phase);
  const instructionsId = useId();
  const hudRef = useRef(hud);

  const changePhase = useCallback((next: Phase) => {
    held.current.clear();
    game.current.queuedAttack = false;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const syncHud = useCallback(() => {
    const next = hudFor(game.current);
    const previous = hudRef.current;
    if (previous.health !== next.health || previous.stones !== next.stones || previous.message !== next.message) {
      hudRef.current = next;
      setHud(next);
    }
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const heldControls = held.current;
    const pause = () => { if (phaseRef.current === "playing") changePhase("paused"); };
    const visibility = () => { if (document.hidden) pause(); };
    const appFocus = (event: Event) => {
      if ((event as CustomEvent<{ id: string | null }>).detail?.id !== "mossblade") pause();
    };
    window.addEventListener("blur", pause);
    window.addEventListener("storm-app-focus", appFocus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", pause);
      window.removeEventListener("storm-app-focus", appFocus);
      document.removeEventListener("visibilitychange", visibility);
      heldControls.clear();
    };
  }, [changePhase]);

  useEffect(() => {
    if (canvas.current) drawGame(canvas.current, game.current, reducedMotion);
    if (phase !== "playing") return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (phaseRef.current !== "playing") return;
      const dt = last ? Math.min((now - last) / 1000, .04) : 0;
      last = now;
      const ended = advance(game.current, held.current, dt, reducedMotion);
      syncHud();
      if (canvas.current) drawGame(canvas.current, game.current, reducedMotion);
      if (ended) changePhase(ended);
      else frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, reducedMotion, changePhase, syncHud]);

  const focusGame = () => surface.current?.focus({ preventScroll: true });
  const start = () => {
    game.current = createGame();
    syncHud();
    changePhase("playing");
    focusGame();
  };
  const resume = () => { changePhase("playing"); focusGame(); };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement && (event.code === "Space" || event.code === "Enter")) return;
    if (KEY_CONTROLS[event.code]) {
      event.preventDefault();
      if (phaseRef.current === "playing") held.current.add(event.code);
    } else if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
      event.preventDefault();
      if (phaseRef.current === "playing") changePhase("paused");
      else if (phaseRef.current === "paused") resume();
    }
  };
  const keyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (KEY_CONTROLS[event.code]) held.current.delete(event.code);
  };
  const touchDown = (event: PointerEvent<HTMLButtonElement>, control: string) => {
    event.preventDefault();
    focusGame();
    if (phaseRef.current !== "playing") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    held.current.add(`touch:${control}`);
    if (control === "attack") game.current.queuedAttack = true;
  };
  const touchUp = (control: string) => held.current.delete(`touch:${control}`);
  const control = (name: Direction | "attack", label: string, icon: string) => (
    <button
      className={name === "attack" ? styles.attackButton : `${styles.directionButton} ${styles[name]}`}
      type="button"
      aria-label={label}
      disabled={phase !== "playing"}
      onPointerDown={(event) => touchDown(event, name)}
      onPointerUp={() => touchUp(name)}
      onPointerCancel={() => touchUp(name)}
      onLostPointerCapture={() => touchUp(name)}
      onClick={(event) => {
        if (event.detail !== 0 || phaseRef.current !== "playing") return;
        if (name === "attack") game.current.queuedAttack = true;
        else {
          game.current.player.facing = name;
          move(game.current.player, FACING[name].x * 8, FACING[name].y * 8, 5);
        }
        focusGame();
      }}
      onContextMenu={(event) => event.preventDefault()}
      key={name}
    >{icon}{name === "attack" && <span>SWING</span>}</button>
  );

  return (
    <div
      className={styles.game}
      ref={surface}
      tabIndex={0}
      role="application"
      aria-label="Mossblade, a small original pixel adventure"
      aria-describedby={instructionsId}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && phaseRef.current === "playing") changePhase("paused");
      }}
    >
      <div className={styles.topBar}>
        <div className={styles.wordmark}><span aria-hidden="true">✦</span> MOSSBLADE<small>THE SLEEPING GROVE</small></div>
        <button type="button" className={styles.pauseButton} disabled={phase === "ready" || phase === "won" || phase === "lost"} onClick={() => phase === "playing" ? changePhase("paused") : resume()}>{phase === "paused" ? "Resume" : "Pause"}</button>
      </div>
      <div className={styles.hud}>
        <span className={styles.hearts} aria-label={`${hud.health} of ${MAX_HEALTH} hearts`}>
          {Array.from({ length: MAX_HEALTH }, (_, index) => <span key={index} className={index >= hud.health ? styles.emptyHeart : undefined} aria-hidden="true">♥</span>)}
        </span>
        <span className={styles.stoneCount}><span aria-hidden="true">◆</span> {hud.stones}/3 <small>SUNSTONES</small></span>
      </div>
      <div className={styles.viewport} onPointerDown={(event) => { if (event.target === canvas.current) focusGame(); }}>
        <canvas ref={canvas} width={VIEW_W} height={VIEW_H} className={styles.canvas} aria-label="Forest game world. Golden map dots mark sunstones. Your marker is white." />
        {phase !== "playing" && (
          <div className={styles.overlay}>
            <div className={styles.card}>
              <div className={styles.cardGlyph} aria-hidden="true">{phase === "won" ? "✧" : phase === "lost" ? "❧" : "⚔"}</div>
              <h2>{phase === "ready" ? "A little courage." : phase === "paused" ? "A moment of quiet." : phase === "won" ? "The grove awakens." : "Rest, little wanderer."}</h2>
              <p>{phase === "ready" ? "Gather three sunstones. Brave the garden creatures. Open the ancient arch to the north." : phase === "paused" ? "Your adventure is right where you left it." : phase === "won" ? `Three sunstones, a forest full of light. You made it in ${Math.max(1, Math.round(game.current.time))} seconds.` : `${hud.stones}/3 sunstones found. Keep moving, face a creature, then swing. Hearts restore your courage.`}</p>
              <button type="button" className={styles.primaryButton} onClick={phase === "paused" ? resume : start}>{phase === "ready" ? "Enter the grove →" : phase === "paused" ? "Keep wandering →" : "Wander again →"}</button>
              {phase === "paused" && <button type="button" className={styles.restartButton} onClick={start}>Start over</button>}
            </div>
          </div>
        )}
      </div>
      <p className={styles.quest} aria-live="polite">{hud.message}</p>
      <div className={styles.controls}>
        <div className={styles.dpad} aria-label="Movement controls">
          {control("up", "Move up", "↑")}{control("left", "Move left", "←")}
          <span className={styles.dpadCenter} aria-hidden="true">✦</span>
          {control("right", "Move right", "→")}{control("down", "Move down", "↓")}
        </div>
        <div className={styles.controlHint} id={instructionsId}><span>WASD / arrows</span>move<span>SPACE / J</span>swing<span>P / ESC</span>pause</div>
        {control("attack", "Swing sword, hold to repeat", "⚔")}
      </div>
      <div className={styles.footer}>An original pocket adventure <span>NO SAVE · JUST PLAY</span></div>
    </div>
  );
}
