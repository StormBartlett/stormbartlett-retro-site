"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import styles from "./StarPatrol.module.css";
import arcade from "./Arcade.module.css";
import ArcadeMenu, { handleGameBlur } from "./ArcadeMenu";

type Point = { x: number; y: number };
type Phase = "briefing" | "playing" | "paused" | "won" | "lost";
type Command = "select" | "move" | "attack";
type Order = { kind: "hold" | "move" | "attack"; x: number; y: number; target?: number };
type Ranger = Point & { id: number; hp: number; cooldown: number; order: Order; aim: number; flash: number };
type Alien = Point & { id: number; hp: number; maxHp: number; cooldown: number; brute: boolean; aim: number; speed: number };
type Shot = Point & { tx: number; ty: number; life: number; duration: number; enemy?: boolean };
type Particle = Point & { vx: number; vy: number; life: number; color: string };
type Pickup = Point & { id: number; value: number };
type Marker = Point & { life: number; attack: boolean };
type World = {
  phase: Phase; rangers: Ranger[]; aliens: Alien[]; selected: number[];
  relayHp: number; resources: number; wave: number; pending: number;
  incoming: boolean; waveTimer: number; spawnTimer: number; supplyTimer: number;
  training: number; trainTimer: number; turretTimer: number; turretAim: number;
  kills: number; elapsed: number; nextId: number; seed: number;
  shots: Shot[]; particles: Particle[]; pickups: Pickup[]; markers: Marker[];
  message: string; messageTime: number;
};
type View = {
  phase: Phase; hp: number; resources: number; wave: number; enemyCount: number;
  incoming: boolean; waveTimer: number; selected: number; squad: number; training: number;
  trainProgress: number; kills: number; message: string; elapsed: number;
};
type Gesture = { start: Point; current: Point; pointerId: number; dragging: boolean; add: boolean };

const WIDTH = 512;
const HEIGHT = 384;
const RELAY: Point = { x: 77, y: 194 };
const RELAY_HP = 900;
const RANGER_HP = 100;
const TRAIN_COST = 45;
const TRAIN_TIME = 3;
const SQUAD_CAP = 8;
const LAST_WAVE = 4;
const WAVE_SIZES = [6, 9, 13, 18];
const RANGE = 113;
const COLORS = { cyan: "#b7f3dc", teal: "#619e9a", orange: "#ec9270", gold: "#e8d295" };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function random(world: World) {
  world.seed = (world.seed * 1664525 + 1013904223) >>> 0;
  return world.seed / 4294967296;
}

function makeRanger(id: number, x: number, y: number): Ranger {
  return { id, x, y, hp: RANGER_HP, cooldown: .1, aim: 0, flash: 0, order: { kind: "hold", x, y } };
}

function createWorld(): World {
  const rangers = [makeRanger(1, 145, 155), makeRanger(2, 165, 181), makeRanger(3, 165, 209), makeRanger(4, 145, 235)];
  return {
    phase: "briefing", rangers, aliens: [], selected: [1, 2, 3, 4], relayHp: RELAY_HP,
    resources: 90, wave: 0, pending: 0, incoming: true, waveTimer: 5, spawnTimer: 0,
    supplyTimer: 0, training: 0, trainTimer: 0, turretTimer: 0, turretAim: 0,
    kills: 0, elapsed: 0, nextId: 20, seed: 70419, shots: [], particles: [], markers: [],
    pickups: [{ id: 11, x: 239, y: 109, value: 30 }, { id: 12, x: 297, y: 286, value: 30 }, { id: 13, x: 383, y: 180, value: 35 }],
    message: "Four waves. Keep the relay online.", messageTime: 0,
  };
}

function snapshot(world: World): View {
  return {
    phase: world.phase, hp: Math.ceil(Math.max(0, world.relayHp)), resources: world.resources,
    wave: world.wave, enemyCount: world.aliens.length + world.pending, incoming: world.incoming,
    waveTimer: Math.ceil(world.waveTimer), selected: world.selected.length, squad: world.rangers.length,
    training: world.training, trainProgress: world.training ? 1 - world.trainTimer / TRAIN_TIME : 0,
    kills: world.kills, message: world.message, elapsed: Math.floor(world.elapsed),
  };
}

function tell(world: World, message: string) {
  world.message = message;
  world.messageTime = world.elapsed;
}

function approach(unit: Point, target: Point, speed: number, dt: number) {
  const length = distance(unit, target);
  if (length <= 1) return true;
  const step = Math.min(length, speed * dt);
  unit.x = clamp(unit.x + (target.x - unit.x) / length * step, 12, WIDTH - 12);
  unit.y = clamp(unit.y + (target.y - unit.y) / length * step, 32, HEIGHT - 14);
  return length <= step + 2;
}

function separate<T extends Point>(units: T[], radius: number) {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i]; const b = units[j];
      const dx = b.x - a.x; const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length >= radius) continue;
      const push = (radius - length) * .34;
      const nx = length > .01 ? dx / length : (i % 2 ? 1 : -1);
      const ny = length > .01 ? dy / length : .5;
      a.x = clamp(a.x - nx * push, 12, WIDTH - 12);
      a.y = clamp(a.y - ny * push, 32, HEIGHT - 14);
      b.x = clamp(b.x + nx * push, 12, WIDTH - 12);
      b.y = clamp(b.y + ny * push, 32, HEIGHT - 14);
    }
  }
}

function shot(world: World, from: Point, target: Point, enemy = false) {
  world.shots.push({ x: from.x, y: from.y - 5, tx: target.x, ty: target.y - 5, life: 0, duration: Math.max(.06, distance(from, target) / 350), enemy });
}

function burst(world: World, at: Point, color: string, reduced: boolean) {
  if (reduced) return;
  for (let i = 0; i < 7; i++) {
    const angle = random(world) * Math.PI * 2;
    const speed = 8 + random(world) * 30;
    world.particles.push({ ...at, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + random(world) * .4, color });
  }
  if (world.particles.length > 100) world.particles.splice(0, world.particles.length - 100);
}

function nearestAlien(world: World, at: Point, maxRange: number) {
  let closest: Alien | undefined;
  let best = maxRange;
  for (const alien of world.aliens) {
    if (alien.hp <= 0) continue;
    const gap = distance(at, alien);
    if (gap < best) { closest = alien; best = gap; }
  }
  return closest;
}

function updateWorld(world: World, dt: number, reduced: boolean) {
  if (world.phase !== "playing") return;
  world.elapsed += dt;
  world.supplyTimer += dt;
  if (world.supplyTimer >= 5) { world.supplyTimer -= 5; world.resources += 3; }

  if (world.training) {
    world.trainTimer -= dt;
    if (world.trainTimer <= 0) {
      const ranger = makeRanger(world.nextId++, 111, 184 + (world.rangers.length % 3) * 14);
      world.rangers.push(ranger);
      world.selected.push(ranger.id);
      world.training--;
      world.trainTimer = world.training ? TRAIN_TIME : 0;
      tell(world, "Reinforcement ready. Ranger reporting in.");
    }
  }

  if (world.incoming) {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) {
      world.wave++;
      world.pending = WAVE_SIZES[world.wave - 1];
      world.incoming = false;
      world.spawnTimer = .1;
      tell(world, world.wave === LAST_WAVE ? "FINAL WAVE. Hold the line, rangers." : `Wave ${world.wave} detected. Skitters closing in.`);
    }
  } else if (world.pending > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      const brute = world.wave >= 3 && world.pending % 6 === 0;
      const lane = Math.floor(random(world) * 3);
      const x = lane === 0 ? 475 + random(world) * 20 : lane === 1 ? 380 + random(world) * 85 : 410 + random(world) * 85;
      const y = lane === 0 ? 85 + random(world) * 220 : lane === 1 ? 39 : HEIGHT - 18;
      const hp = brute ? 170 + world.wave * 12 : 44 + world.wave * 10;
      world.aliens.push({ id: world.nextId++, x, y, hp, maxHp: hp, cooldown: .4, brute, aim: Math.PI, speed: brute ? 24 : 29 + world.wave * 2 });
      world.pending--;
      world.spawnTimer = world.wave >= 3 ? .28 : .52;
    }
  }

  for (const ranger of world.rangers) {
    if (ranger.hp <= 0) continue;
    ranger.cooldown = Math.max(0, ranger.cooldown - dt);
    ranger.flash = Math.max(0, ranger.flash - dt);
    const orderedTarget = ranger.order.target ? world.aliens.find((alien) => alien.id === ranger.order.target && alien.hp > 0) : undefined;
    if (ranger.order.target && !orderedTarget) ranger.order = { kind: "hold", x: ranger.x, y: ranger.y };
    const searchRange = ranger.order.kind === "attack" ? RANGE + 45 : RANGE;
    const target = orderedTarget ?? nearestAlien(world, ranger, searchRange);
    const inRange = target && distance(ranger, target) <= RANGE;

    if (ranger.order.kind === "move") {
      ranger.aim = Math.atan2(ranger.order.y - ranger.y, ranger.order.x - ranger.x);
      if (approach(ranger, ranger.order, 47, dt)) ranger.order = { kind: "hold", x: ranger.x, y: ranger.y };
    } else if (ranger.order.kind === "attack") {
      const destination = target ?? ranger.order;
      ranger.aim = Math.atan2(destination.y - ranger.y, destination.x - ranger.x);
      if (!inRange && approach(ranger, destination, 47, dt) && !orderedTarget) ranger.order = { kind: "hold", x: ranger.x, y: ranger.y };
    }
    if (target && inRange) {
      ranger.aim = Math.atan2(target.y - ranger.y, target.x - ranger.x);
      if (ranger.cooldown <= 0) {
        target.hp -= 19;
        ranger.cooldown = .63;
        ranger.flash = .09;
        shot(world, ranger, target);
      }
    }
  }

  world.turretTimer -= dt;
  const turretTarget = nearestAlien(world, RELAY, 135);
  if (turretTarget) {
    world.turretAim = Math.atan2(turretTarget.y - RELAY.y, turretTarget.x - RELAY.x);
    if (world.turretTimer <= 0) {
      turretTarget.hp -= 10;
      world.turretTimer = .9;
      shot(world, { x: RELAY.x + 8, y: RELAY.y - 17 }, turretTarget);
    }
  }

  for (const alien of world.aliens) {
    if (alien.hp <= 0) continue;
    alien.cooldown = Math.max(0, alien.cooldown - dt);
    let target: Ranger | undefined;
    let gap = 145;
    for (const ranger of world.rangers) {
      if (ranger.hp <= 0) continue;
      const candidate = distance(alien, ranger);
      if (candidate < gap) { gap = candidate; target = ranger; }
    }
    const destination = target ?? RELAY;
    const reach = target ? (alien.brute ? 21 : 16) : 44;
    alien.aim = Math.atan2(destination.y - alien.y, destination.x - alien.x);
    if (distance(alien, destination) > reach) approach(alien, destination, alien.speed, dt);
    else if (alien.cooldown <= 0) {
      const damage = alien.brute ? 17 : 7 + world.wave;
      if (target) target.hp -= damage;
      else world.relayHp -= damage;
      alien.cooldown = alien.brute ? 1.05 : .85;
      burst(world, destination, COLORS.orange, reduced);
    }
  }

  separate(world.rangers, 14);
  separate(world.aliens, 15);

  for (const pickup of world.pickups) {
    if (!world.rangers.some((ranger) => ranger.hp > 0 && distance(ranger, pickup) < 19)) continue;
    const amount = pickup.value;
    world.resources += amount;
    pickup.value = 0;
    tell(world, `Salvage recovered. +${amount} supply for reinforcements.`);
    burst(world, pickup, COLORS.cyan, reduced);
  }
  world.pickups = world.pickups.filter((pickup) => pickup.value > 0);

  for (const alien of world.aliens) {
    if (alien.hp > 0) continue;
    world.kills++;
    burst(world, alien, COLORS.orange, reduced);
    if (random(world) < .14) world.pickups.push({ x: alien.x, y: alien.y, id: world.nextId++, value: 15 });
  }
  for (const ranger of world.rangers) {
    if (ranger.hp <= 0) burst(world, ranger, COLORS.teal, reduced);
  }
  world.aliens = world.aliens.filter((alien) => alien.hp > 0);
  world.rangers = world.rangers.filter((ranger) => ranger.hp > 0);
  const living = new Set(world.rangers.map((ranger) => ranger.id));
  world.selected = world.selected.filter((id) => living.has(id));

  for (const projectile of world.shots) projectile.life += dt;
  world.shots = world.shots.filter((projectile) => projectile.life < projectile.duration);
  for (const particle of world.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
  world.particles = world.particles.filter((particle) => particle.life > 0);
  for (const marker of world.markers) marker.life -= dt;
  world.markers = world.markers.filter((marker) => marker.life > 0);

  if (world.relayHp <= 0) {
    world.phase = "lost";
    tell(world, "Relay signal lost. The outpost has fallen.");
  } else if (!world.incoming && world.pending === 0 && world.aliens.length === 0) {
    if (world.wave === LAST_WAVE) {
      world.phase = "won";
      tell(world, "All four waves repelled. Relay secure. Nice work, commander.");
    } else {
      world.incoming = true;
      world.waveTimer = 10;
      world.resources += 25;
      tell(world, `Wave ${world.wave} clear. +25 supply. Regroup and reinforce.`);
    }
  }
}

function makeTerrain() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  let seed = 417;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = "#283d40"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Hand-built terrain layers: shale shelf, worn causeway, reclaimed landing pad.
  for (let i = 0; i < 1250; i++) {
    const x = Math.floor(rand() * WIDTH / 4) * 4; const y = Math.floor(rand() * HEIGHT / 4) * 4;
    ctx.fillStyle = ["#2c4142", "#304646", "#24383b", "#344749"][Math.floor(rand() * 4)];
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 3) * 2, 2);
  }
  ctx.fillStyle = "#1d2e33"; ctx.fillRect(0, 0, WIDTH, 32);
  for (let x = 0; x < WIDTH; x += 16) { ctx.fillStyle = "#182a2f"; ctx.fillRect(x, 26 + Math.floor(rand() * 3) * 3, 16, 8); ctx.fillStyle = "#3b5051"; ctx.fillRect(x + 1, 25, 13, 2); }
  ctx.fillStyle = "#3b4b49"; ctx.fillRect(122, 175, 344, 36); ctx.fillRect(273, 176, 32, 151);
  ctx.fillStyle = "#45534e"; ctx.fillRect(122, 178, 344, 2); ctx.fillRect(276, 211, 2, 112);
  ctx.fillStyle = "#2e4141";
  for (let x = 146; x < 464; x += 31) ctx.fillRect(x, 184, 14, 3);
  ctx.fillStyle = "#495650"; ctx.fillRect(25, 142, 106, 109);
  ctx.fillStyle = "#3c4c49"; ctx.fillRect(29, 146, 98, 101);
  ctx.strokeStyle = "#657165"; ctx.lineWidth = 1; ctx.strokeRect(34.5, 151.5, 87, 90);
  for (let y = 147; y < 247; y += 24) { ctx.fillStyle = "#485752"; ctx.fillRect(29, y, 98, 1); }
  for (let x = 32; x < 124; x += 14) { ctx.fillStyle = "#b49f68"; ctx.fillRect(x, 143, 7, 3); ctx.fillRect(x, 248, 7, 3); }
  for (let i = 0; i < 29; i++) {
    const x = 12 + Math.floor(rand() * (WIDTH - 24)); const y = 44 + Math.floor(rand() * (HEIGHT - 56));
    if ((x < 180 && y > 120 && y < 265) || (y > 165 && y < 220)) continue;
    const size = 3 + Math.floor(rand() * 6);
    ctx.fillStyle = "#1b3034"; ctx.fillRect(x + 2, y + 3, size + 3, size);
    ctx.fillStyle = "#4d5b54"; ctx.fillRect(x, y, size + 2, size);
    ctx.fillStyle = "#627064"; ctx.fillRect(x + 1, y, size - 1, 2);
  }
  // Rusted barricades and an abandoned communications mast.
  [[196, 58], [347, 336], [420, 72]].forEach(([x, y]) => {
    ctx.fillStyle = "#1a2d31"; ctx.fillRect(x + 3, y + 5, 31, 10);
    ctx.fillStyle = "#657168"; ctx.fillRect(x, y, 30, 10);
    ctx.fillStyle = "#8f9a85"; ctx.fillRect(x, y, 30, 2);
    ctx.fillStyle = "#354844"; for (let n = 3; n < 28; n += 8) ctx.fillRect(x + n, y + 3, 4, 7);
  });
  ctx.fillStyle = "#1a2d31"; ctx.fillRect(53, 79, 27, 13);
  ctx.fillStyle = "#8b9887"; ctx.fillRect(60, 60, 4, 26); ctx.fillRect(48, 61, 28, 3); ctx.fillRect(56, 53, 12, 3);
  ctx.fillStyle = "#c59e73"; ctx.fillRect(61, 49, 2, 5);
  ctx.fillStyle = "#84927b"; ctx.font = "7px monospace"; ctx.fillText("R-07", 35, 265); ctx.fillText("CAUTION / BREACH", 388, 360);
  return canvas;
}

function healthBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, value: number, color: string) {
  ctx.fillStyle = "#15282d"; ctx.fillRect(Math.round(x - width / 2) - 1, Math.round(y) - 1, width + 2, 4);
  ctx.fillStyle = color; ctx.fillRect(Math.round(x - width / 2), Math.round(y), Math.ceil(width * clamp(value, 0, 1)), 2);
}

function drawRelay(ctx: CanvasRenderingContext2D, world: World) {
  const x = RELAY.x - 31; const y = RELAY.y - 29;
  ctx.fillStyle = "#1a2b2b"; ctx.fillRect(x + 4, y + 8, 65, 53);
  ctx.fillStyle = "#738c80"; ctx.fillRect(x, y + 12, 62, 40);
  ctx.fillStyle = "#a6b5a1"; ctx.fillRect(x, y + 9, 62, 8); ctx.fillRect(x + 8, y, 46, 14);
  ctx.fillStyle = "#cad0b5"; ctx.fillRect(x + 10, y, 42, 3); ctx.fillRect(x, y + 9, 62, 2);
  ctx.fillStyle = "#4c6864"; ctx.fillRect(x + 8, y + 20, 46, 23);
  ctx.fillStyle = "#253f42"; ctx.fillRect(x + 12, y + 24, 38, 19);
  ctx.fillStyle = "#90d8bc"; ctx.fillRect(x + 16, y + 26, 30, 4); ctx.fillRect(x + 17, y + 33, 5, 3); ctx.fillRect(x + 25, y + 33, 5, 3);
  ctx.fillStyle = "#b8c1a5"; ctx.fillRect(x + 2, y + 20, 5, 25); ctx.fillRect(x + 55, y + 20, 5, 25);
  ctx.fillStyle = "#415c59"; ctx.fillRect(x + 22, y + 41, 20, 12);
  ctx.fillStyle = "#202f33"; ctx.fillRect(x + 26, y + 43, 12, 10);
  ctx.fillStyle = "#c5b884"; ctx.fillRect(x + 7, y + 48, 8, 3); ctx.fillRect(x + 49, y + 48, 8, 3);
  ctx.fillStyle = "#456661"; ctx.fillRect(x + 27, y - 7, 17, 18);
  ctx.fillStyle = "#c6cdb3"; ctx.fillRect(x + 29, y - 8, 13, 6);
  ctx.save(); ctx.translate(RELAY.x + 5, RELAY.y - 27); ctx.rotate(world.turretAim);
  ctx.fillStyle = "#d5d6b5"; ctx.fillRect(0, -3, 19, 5); ctx.fillStyle = "#4a6f69"; ctx.fillRect(0, -3, 10, 2); ctx.restore();
  if (world.relayHp < RELAY_HP * .5) { ctx.fillStyle = "#313b35"; ctx.fillRect(x + 10, y + 10, 11, 4); ctx.fillRect(x + 14, y + 13, 4, 10); }
  healthBar(ctx, RELAY.x, y - 16, 58, world.relayHp / RELAY_HP, world.relayHp < 250 ? COLORS.orange : COLORS.cyan);
}

function drawRanger(ctx: CanvasRenderingContext2D, ranger: Ranger, selected: boolean, time: number) {
  const x = Math.round(ranger.x); const y = Math.round(ranger.y);
  ctx.fillStyle = "#152c2eaa"; ctx.fillRect(x - 8, y + 5, 17, 5);
  if (selected) {
    ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + 4, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const step = ranger.order.kind !== "hold" ? Math.floor(time * 8 + ranger.id) % 2 * 2 : 0;
  ctx.fillStyle = "#94a999"; ctx.fillRect(x - 5, y + 1 + step, 4, 6 - step); ctx.fillRect(x + 2, y + 3 - step, 4, 4 + step);
  ctx.fillStyle = "#263f43"; ctx.fillRect(x - 6, y + 6 + step, 5, 2); ctx.fillRect(x + 2, y + 6 - step, 5, 2);
  ctx.fillStyle = "#a9c2ae"; ctx.fillRect(x - 6, y - 7, 12, 10); ctx.fillRect(x - 9, y - 6, 4, 6); ctx.fillRect(x + 6, y - 6, 4, 6);
  ctx.fillStyle = "#d0dac0"; ctx.fillRect(x - 5, y - 12, 10, 7); ctx.fillRect(x - 8, y - 6, 3, 2);
  ctx.fillStyle = "#203a43"; ctx.fillRect(x - 4, y - 10, 8, 3);
  ctx.fillStyle = "#8de0d5"; ctx.fillRect(x - 3, y - 10, 5, 1); ctx.fillRect(x - 2, y - 4, 4, 3);
  ctx.save(); ctx.translate(x, y - 3); ctx.rotate(ranger.aim);
  ctx.fillStyle = "#2a4549"; ctx.fillRect(3, -2, 13, 4); ctx.fillStyle = "#8ca49a"; ctx.fillRect(5, -3, 6, 2);
  if (ranger.flash > 0) { ctx.fillStyle = "#f5e3a0"; ctx.fillRect(16, -3, 5, 5); }
  ctx.restore();
  if (selected || ranger.hp < RANGER_HP) healthBar(ctx, x, y - 17, 20, ranger.hp / RANGER_HP, ranger.hp < 35 ? COLORS.orange : COLORS.cyan);
}

function drawAlien(ctx: CanvasRenderingContext2D, alien: Alien, time: number) {
  const x = Math.round(alien.x); const y = Math.round(alien.y);
  ctx.fillStyle = "#172b2fa8"; ctx.fillRect(x - 11, y + 3, 22, 7);
  ctx.save(); ctx.translate(x, y - 1); ctx.rotate(alien.aim);
  const step = Math.floor(time * 9 + alien.id) % 2 * 2;
  const size = alien.brute ? 1.35 : 1;
  ctx.scale(size, size);
  ctx.fillStyle = "#9f654c";
  ctx.fillRect(-7, -10 + step, 4, 8); ctx.fillRect(1, -11 + step, 3, 8); ctx.fillRect(-7, 4, 4, 7 - step); ctx.fillRect(1, 4, 3, 8 - step);
  ctx.fillStyle = "#db9b70"; ctx.fillRect(-9, -7, 16, 13); ctx.fillRect(4, -5, 6, 9);
  ctx.fillStyle = "#935949"; ctx.fillRect(-9, 3, 13, 3); ctx.fillRect(-11, -4, 4, 7);
  ctx.fillStyle = alien.brute ? "#d8c29a" : "#b97857"; ctx.fillRect(-7, -7, 10, 4); ctx.fillRect(-4, -3, 6, 5);
  ctx.fillStyle = "#f7dda2"; ctx.fillRect(7, -4, 3, 2); ctx.fillRect(7, 2, 3, 2);
  if (alien.brute) { ctx.fillStyle = "#f0d6a2"; ctx.fillRect(6, -8, 7, 3); ctx.fillRect(6, 6, 7, 3); }
  ctx.restore();
  if (alien.hp < alien.maxHp || alien.brute) healthBar(ctx, x, y - (alien.brute ? 22 : 16), alien.brute ? 27 : 18, alien.hp / alien.maxHp, COLORS.orange);
}

function drawWorld(canvas: HTMLCanvasElement, terrain: HTMLCanvasElement | null, world: World, gesture: Gesture | null, reduced: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (terrain) ctx.drawImage(terrain, 0, 0);
  else { ctx.fillStyle = "#283d40"; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  for (const pickup of world.pickups) {
    const x = Math.round(pickup.x); const y = Math.round(pickup.y);
    ctx.fillStyle = "#18373a"; ctx.fillRect(x - 9, y + 4, 20, 5);
    ctx.fillStyle = "#5c9c96"; ctx.fillRect(x - 5, y - 8, 5, 13); ctx.fillRect(x + 2, y - 4, 5, 10);
    ctx.fillStyle = "#b3e9d0"; ctx.fillRect(x - 4, y - 9, 2, 10); ctx.fillRect(x + 3, y - 5, 2, 8);
    ctx.fillStyle = "#e8d79b"; ctx.fillRect(x - 1, y - 2, 3, 8);
  }
  drawRelay(ctx, world);
  const units = [...world.rangers.map((unit) => ({ unit, type: "ranger" as const })), ...world.aliens.map((unit) => ({ unit, type: "alien" as const }))].sort((a, b) => a.unit.y - b.unit.y);
  const time = reduced ? 0 : world.elapsed;
  for (const entry of units) {
    if (entry.type === "ranger") drawRanger(ctx, entry.unit as Ranger, world.selected.includes(entry.unit.id), time);
    else drawAlien(ctx, entry.unit as Alien, time);
  }
  for (const projectile of world.shots) {
    const progress = Math.min(1, projectile.life / projectile.duration);
    const x = projectile.x + (projectile.tx - projectile.x) * progress;
    const y = projectile.y + (projectile.ty - projectile.y) * progress;
    ctx.strokeStyle = projectile.enemy ? COLORS.orange : "#f8e4a1";
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (projectile.tx - projectile.x) * .06, y - (projectile.ty - projectile.y) * .06); ctx.stroke();
  }
  for (const particle of world.particles) { ctx.fillStyle = particle.color; ctx.fillRect(Math.round(particle.x), Math.round(particle.y), 2, 2); }
  for (const marker of world.markers) {
    ctx.strokeStyle = marker.attack ? COLORS.orange : COLORS.cyan;
    const radius = reduced ? 8 : 5 + (1 - marker.life / .9) * 13;
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(marker.x - 2, marker.y - 2, 4, 4);
  }
  if (gesture?.dragging) {
    const x = Math.min(gesture.start.x, gesture.current.x); const y = Math.min(gesture.start.y, gesture.current.y);
    const width = Math.abs(gesture.start.x - gesture.current.x); const height = Math.abs(gesture.start.y - gesture.current.y);
    ctx.fillStyle = "#b7f3dc20"; ctx.fillRect(x, y, width, height); ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
  }
}

export default function StarPatrol() {
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) { worldRef.current = createWorld(); worldRef.current.phase = "playing"; worldRef.current.selected = worldRef.current.rangers.map(ranger=>ranger.id); }
  const [view, setView] = useState<View>(() => snapshot(worldRef.current!));
  const [command, setCommand] = useState<Command>("select");
  const commandRef = useRef<Command>("select");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const battlefieldRef = useRef<HTMLDivElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const reducedRef = useRef(false);

  const redraw = useCallback(() => {
    if (canvasRef.current && worldRef.current) drawWorld(canvasRef.current, terrainRef.current, worldRef.current, gestureRef.current, reducedRef.current);
  }, []);
  const publish = useCallback(() => setView(snapshot(worldRef.current!)), []);
  const focusBoard = () => battlefieldRef.current?.focus({ preventScroll: true });

  const setMode = useCallback((mode: Command) => {
    commandRef.current = mode;
    setCommand(mode);
  }, []);

  const start = useCallback(() => {
    const next = createWorld(); next.phase = "playing"; next.selected = next.rangers.map(ranger=>ranger.id);
    worldRef.current = next; gestureRef.current = null;
    setMode("select"); publish(); redraw();
    battlefieldRef.current?.focus({ preventScroll: true });
  }, [publish, redraw, setMode]);

  const pause = useCallback(() => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    world.phase = "paused"; gestureRef.current = null; publish(); redraw();
  }, [publish, redraw]);

  const togglePause = useCallback(() => {
    const world = worldRef.current!;
    if (world.phase === "playing") pause();
    else if (world.phase === "paused") { world.phase = "playing"; publish(); battlefieldRef.current?.focus({ preventScroll: true }); }
  }, [pause, publish]);

  const selectAll = useCallback(() => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    world.selected = world.rangers.map((ranger) => ranger.id);
    setMode("select"); tell(world, `${world.selected.length} rangers selected. Right-click, or pick Move / Attack.`);
    publish(); redraw();
  }, [publish, redraw, setMode]);

  const issueOrder = useCallback((point: Point, kind: "move" | "attack", target?: Alien) => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    const squad = world.rangers.filter((ranger) => world.selected.includes(ranger.id));
    if (!squad.length) { tell(world, "Select a ranger first, or press Squad to select everyone."); publish(); return; }
    const columns = Math.ceil(Math.sqrt(squad.length));
    const rows = Math.ceil(squad.length / columns);
    squad.forEach((ranger, index) => {
      const x = clamp(point.x + ((index % columns) - (columns - 1) / 2) * 18, 14, WIDTH - 14);
      const y = clamp(point.y + (Math.floor(index / columns) - (rows - 1) / 2) * 18, 34, HEIGHT - 14);
      ranger.order = { kind, x, y, target: target?.id };
    });
    world.markers.push({ ...point, life: .9, attack: kind === "attack" });
    tell(world, kind === "attack" ? target ? "Target acquired. Focus fire." : "Attack-move. Engage anything on the way." : "Squad moving. Watch the flanks.");
    publish(); redraw();
  }, [publish, redraw]);

  const hold = useCallback(() => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    world.rangers.filter((ranger) => world.selected.includes(ranger.id)).forEach((ranger) => { ranger.order = { kind: "hold", x: ranger.x, y: ranger.y }; });
    tell(world, "Holding position. Weapons ready."); publish(); redraw();
  }, [publish, redraw]);

  const train = useCallback(() => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    if (world.rangers.length + world.training >= SQUAD_CAP) { tell(world, "Squad at capacity. Eight rangers maximum."); publish(); return; }
    if (world.resources < TRAIN_COST) { tell(world, "Need 45 supply. Move onto cyan salvage to collect more."); publish(); return; }
    world.resources -= TRAIN_COST; world.training++;
    if (world.training === 1) world.trainTimer = TRAIN_TIME;
    tell(world, "Training a ranger. Reinforcement ready in 3 seconds."); publish();
  }, [publish]);

  useEffect(() => {
    terrainRef.current = makeTerrain();
    redraw(); battlefieldRef.current?.focus({preventScroll:true});
  }, [redraw]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedRef.current = media.matches; redraw(); };
    update(); media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [redraw]);

  useEffect(() => {
    const visibility = () => { if (document.hidden) pause(); };
    const appFocus = (event: Event) => { if ((event as CustomEvent<{ id: string | null }>).detail?.id !== "star-patrol") pause(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", pause);
    window.addEventListener("storm-app-focus", appFocus);
    return () => {
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", pause);
      window.removeEventListener("storm-app-focus", appFocus);
    };
  }, [pause]);

  useEffect(() => {
    if (view.phase !== "playing") return;
    let frame = 0; let previous: number | null = null; let uiElapsed = 0;
    const animate = (time: number) => {
      const world = worldRef.current!;
      if (world.phase !== "playing") return;
      const dt = previous === null ? 0 : Math.min(.05, Math.max(0, (time - previous) / 1000));
      previous = time;
      updateWorld(world, dt, reducedRef.current); redraw(); uiElapsed += dt;
      if (uiElapsed > .15 || world.phase !== "playing") { publish(); uiElapsed = 0; }
      if (world.phase === "playing") frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [view.phase, publish, redraw]);

  const toWorld = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / (rect.width || 1) * WIDTH, 0, WIDTH), y: clamp((event.clientY - rect.top) / (rect.height || 1) * HEIGHT, 0, HEIGHT) };
  };
  const hitAlien = (point: Point) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return nearestAlien(worldRef.current!, point, Math.max(19, 13 * WIDTH / (rect.width || WIDTH)));
  };

  const clickMap = (point: Point, add = false) => {
    const world = worldRef.current!;
    if (world.phase !== "playing") return;
    if (commandRef.current === "move") { issueOrder(point, "move"); return; }
    if (commandRef.current === "attack") { issueOrder(point, "attack", hitAlien(point)); return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const tolerance = Math.max(17, 14 * WIDTH / (rect.width || WIDTH));
    const ranger = [...world.rangers].sort((a, b) => distance(a, point) - distance(b, point)).find((unit) => distance(unit, point) <= tolerance);
    if (ranger) {
      world.selected = add ? world.selected.includes(ranger.id) ? world.selected.filter((id) => id !== ranger.id) : [...world.selected, ranger.id] : [ranger.id];
      tell(world, `${world.selected.length} ${world.selected.length === 1 ? "ranger" : "rangers"} selected. Awaiting orders.`);
    } else {
      const enemy = hitAlien(point);
      if (enemy && world.selected.length) { issueOrder(point, "attack", enemy); return; }
      if (!add) world.selected = [];
      tell(world, "Select your rangers, or press Squad to select all.");
    }
    publish(); redraw();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;
    if (worldRef.current!.phase !== "playing" || event.button !== 0) return;
    focusBoard();
    const point = toWorld(event);
    gestureRef.current = { start: point, current: point, pointerId: event.pointerId, dragging: false, add: event.shiftKey };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.current = toWorld(event);
    const rect = canvasRef.current!.getBoundingClientRect();
    if (distance(gesture.current, gesture.start) * rect.width / WIDTH > 6 && commandRef.current === "select") gesture.dragging = true;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current; gestureRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId || worldRef.current!.phase !== "playing") return;
    const point = toWorld(event);
    if (!gesture.dragging) { clickMap(point, gesture.add); return; }
    const world = worldRef.current!;
    const left = Math.min(gesture.start.x, point.x); const right = Math.max(gesture.start.x, point.x);
    const top = Math.min(gesture.start.y, point.y); const bottom = Math.max(gesture.start.y, point.y);
    const selected = world.rangers.filter((unit) => unit.x >= left && unit.x <= right && unit.y >= top && unit.y <= bottom).map((unit) => unit.id);
    world.selected = gesture.add ? [...new Set([...world.selected, ...selected])] : selected;
    tell(world, `${world.selected.length} rangers selected. Give the order.`); publish(); redraw();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === "escape" && !event.repeat) { event.preventDefault(); event.stopPropagation(); togglePause(); return; }
    const isButton = event.target instanceof HTMLElement && !!event.target.closest("button");
    if (event.code === "Space" && !isButton) {
      event.preventDefault(); event.stopPropagation();
      if (worldRef.current!.phase === "briefing") start(); else togglePause();
      return;
    }
    if (worldRef.current!.phase !== "playing") return;
    if (!["s", "m", "a", "h", "r", "escape"].includes(key)) return;
    event.preventDefault(); event.stopPropagation();
    if (key === "s") selectAll();
    else if (key === "m") setMode("move");
    else if (key === "a") setMode("attack");
    else if (key === "h") hold();
    else if (key === "r") train();
    else pause();
  };

  const playing = view.phase === "playing";
  const paused = view.phase === "paused";
  const trainingFull = view.squad + view.training >= SQUAD_CAP;
  const canTrain = playing && !trainingFull && view.resources >= TRAIN_COST;
  const missionTime = `${Math.floor(view.elapsed / 60)}:${String(view.elapsed % 60).padStart(2, "0")}`;

  return <section className={`${arcade.shell} ${styles.game}`} aria-label="Star Patrol real-time strategy game" onKeyDown={onKeyDown} onBlur={event=>handleGameBlur(event,pause,()=>battlefieldRef.current)}>
    <div className={arcade.hud} aria-label="Mission status"><span>RELAY <strong>{Math.ceil(view.hp/RELAY_HP*100)}%</strong></span><span>SUPPLY <strong>{view.resources}</strong></span><span>WAVE <strong>{view.wave||1}/4</strong></span><span className={arcade.spacer}/><span>{missionTime}</span><button onClick={()=>playing?pause():togglePause()} aria-label="Help and pause">?</button></div>
    <div ref={battlefieldRef} tabIndex={0} role="group" aria-label="Battlefield. Click or drag to select. Right-click to move or attack. Escape for controls." className={`${arcade.field} ${styles.battlefield} ${command!=="select"?styles.orderCursor:""}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={()=>{gestureRef.current=null;redraw();}} onLostPointerCapture={()=>{gestureRef.current=null;}} onContextMenu={event=>{event.preventDefault();if(!playing)return;focusBoard();const point=toWorld(event),target=hitAlien(point);issueOrder(point,target?"attack":"move",target);}}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className={arcade.canvas} role="img" aria-label={`Outpost battlefield. ${view.squad} rangers, ${view.enemyCount} hostiles. Relay health ${Math.ceil(view.hp/RELAY_HP*100)} percent.`}/>
      {!playing&&<ArcadeMenu title={paused?"PAUSED":view.phase==="won"?"MISSION COMPLETE":"RELAY LOST"} controls={paused?["Click / drag: select rangers","Right-click: move or attack","S: squad   M: move   A: attack","R: train   H: hold   Space: pause","Touch: Squad → Move / Attack → map"]:[`${view.kills} hostiles defeated · ${missionTime}`]} action={paused?togglePause:start} label={paused?"Resume":"Play again"} restart={paused?start:undefined}/>}
    </div>
    <div className={arcade.toolbar} role="group" aria-label="Squad commands">
      <button disabled={!playing} aria-pressed={command==="select"} onClick={selectAll}>Squad <kbd>S</kbd></button>
      <button disabled={!playing||!view.selected} aria-pressed={command==="move"} onClick={()=>setMode("move")}>Move <kbd>M</kbd></button>
      <button disabled={!playing||!view.selected} aria-pressed={command==="attack"} onClick={()=>setMode("attack")}>Attack <kbd>A</kbd></button>
      <button disabled={!playing||!view.selected} onClick={hold}>Hold <kbd>H</kbd></button>
      <button disabled={!canTrain} onClick={train}>Train · 45 <kbd>R</kbd>{view.training>0?` (${view.training})`:""}</button>
    </div>
    <div className={arcade.status} role="status">{view.selected}/{view.squad} selected · {view.enemyCount} hostiles · {view.kills} defeated{trainingFull?" · Squad full":""}</div>
  </section>;
}
