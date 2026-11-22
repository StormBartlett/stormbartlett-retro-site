/** Small swept-AABB solver in desk X/Z space. No physics engine or render loop. */
export type DeskRect = { minX: number; maxX: number; minZ: number; maxZ: number };
export type DeskBody = {
  x: number; z: number; halfX: number; halfZ: number;
  /** Movable bodies are shoved along when something runs into them; fixed ones stop it. */
  movable?: boolean;
  /** The body's centre stays inside this rect, less its own footprint (the desk's edges). */
  bounds?: DeskRect;
  /** Momentum, owned by whoever animates the body. Pushes write into it. */
  vx?: number; vz?: number; spin?: number;
};
export type DeskWorld = Map<string, DeskBody>;
export type DeskPush = { body: DeskBody; axis: "x" | "z" };
export type DeskMove = { x: number; z: number; hitX: boolean; hitZ: boolean; pushed: DeskPush[] };
const GAP = 0.002;
// Stops land a hair outside the face, so rounding can never start the next sweep inside it.
const SKIN = 1e-9;
/** A push can pass through one more movable body (mouse → keyboard → …), no further. */
const PUSH_DEPTH = 2;
/** A body that only clips a corner by this much side-steps it instead of stopping dead. */
const SLIP = 0.16;

export function rotatedFootprint(width: number, depth: number, angle: number) {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return { halfX: (width * c + depth * s) / 2, halfZ: (width * s + depth * c) / 2 };
}

function within(value: number, min: number, max: number) {
  return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, value));
}

/** True when two footprints overlap (closer than the contact gap). */
export function overlaps(a: DeskBody, b: DeskBody) {
  return Math.abs(a.x - b.x) < a.halfX + b.halfX + GAP - SKIN * 2 && Math.abs(a.z - b.z) < a.halfZ + b.halfZ + GAP - SKIN * 2;
}

/** Whether a footprint fits inside its bounds and clear of every other body. */
export function fits(body: DeskBody, obstacles: Iterable<DeskBody>) {
  const b = body.bounds;
  if (b && (body.x - body.halfX < b.minX - 1e-9 || body.x + body.halfX > b.maxX + 1e-9 || body.z - body.halfZ < b.minZ - 1e-9 || body.z + body.halfZ > b.maxZ + 1e-9)) return false;
  for (const other of obstacles) if (other !== body && overlaps(body, other)) return false;
  return true;
}

/**
 * Continuous collision detection prevents fast pointer moves and throws tunnelling. A movable
 * body in the way is pushed along the contact axis (as far as it can go itself), and the mover
 * follows it; a fixed body, or a pushed one that is itself blocked, stops the mover on that axis.
 */
export function moveOnDesk(body: DeskBody, x: number, z: number, obstacles: Iterable<DeskBody>, depth = 0): DeskMove {
  const b = body.bounds;
  let hitX = false, hitZ = false;
  if (b) {
    const cx = within(x, b.minX + body.halfX, b.maxX - body.halfX), cz = within(z, b.minZ + body.halfZ, b.maxZ - body.halfZ);
    hitX = cx !== x; hitZ = cz !== z; x = cx; z = cz;
  }
  let px = body.x, pz = body.z, dx = x - px, dz = z - pz;
  const others = Array.from(obstacles).filter(other => other !== body);
  const pushed: DeskPush[] = [];
  for (let pass = 0; pass < 4 && (Math.abs(dx) + Math.abs(dz) > 1e-9); pass++) {
    let earliest = 1, axis: "x" | "z" | null = null, face = 0, hit: DeskBody | null = null;
    for (const other of others) {
      const left = other.x - other.halfX - body.halfX - GAP;
      const right = other.x + other.halfX + body.halfX + GAP;
      const back = other.z - other.halfZ - body.halfZ - GAP;
      const front = other.z + other.halfZ + body.halfZ + GAP;
      if ((!dx && (px <= left || px >= right)) || (!dz && (pz <= back || pz >= front))) continue;
      const tx1 = dx ? (left - px) / dx : -Infinity, tx2 = dx ? (right - px) / dx : Infinity;
      const tz1 = dz ? (back - pz) / dz : -Infinity, tz2 = dz ? (front - pz) / dz : Infinity;
      const enterX = Math.min(tx1, tx2), enterZ = Math.min(tz1, tz2);
      const enter = Math.max(enterX, enterZ), leave = Math.min(Math.max(tx1, tx2), Math.max(tz1, tz2));
      if (enter < -1e-8 || enter > earliest || enter > leave || leave < 0) continue;
      earliest = Math.max(0, enter);
      axis = enterX > enterZ ? "x" : "z";
      face = axis === "x" ? (dx > 0 ? left - SKIN : right + SKIN) : (dz > 0 ? back - SKIN : front + SKIN);
      hit = other;
    }
    px += dx * earliest; pz += dz * earliest;
    if (!axis || !hit) break;
    dx *= 1 - earliest; dz *= 1 - earliest;
    if (axis === "x") px = face; else pz = face;
    if (hit.movable && depth < PUSH_DEPTH) {
      // The pushed body sweeps from where it is, with the mover parked at the contact face.
      body.x = px; body.z = pz;
      const want = axis === "x" ? dx : dz, before = axis === "x" ? hit.x : hit.z;
      const result = moveOnDesk(hit, axis === "x" ? hit.x + dx : hit.x, axis === "z" ? hit.z + dz : hit.z, [body, ...others], depth + 1);
      const moved = (axis === "x" ? hit.x : hit.z) - before;
      // Only a push in the mover's direction counts; anything else leaves it at the face.
      let follow = Math.sign(moved) === Math.sign(want) ? moved : 0;
      if (follow) {
        // Swept too: the pushed body may have side-stepped a corner the mover now meets itself.
        const step = moveOnDesk(body, axis === "x" ? px + follow : px, axis === "z" ? pz + follow : pz, [hit, ...others], PUSH_DEPTH + 1);
        follow = axis === "x" ? step.x - px : step.z - pz;
        px = step.x; pz = step.z;
      }
      if (axis === "x") { dx = 0; if (Math.abs(follow) < Math.abs(want) - 1e-9) hitX = true; }
      else { dz = 0; if (Math.abs(follow) < Math.abs(want) - 1e-9) hitZ = true; }
      if (follow) pushed.push({ body: hit, axis }, ...result.pushed);
      continue;
    }
    // Clipping a corner: step sideways round it (swept, pushing nothing) and carry on next pass.
    if (depth <= PUSH_DEPTH) {
      const pos = axis === "x" ? pz : px, centre = axis === "x" ? hit.z : hit.x;
      const reach = axis === "x" ? hit.halfZ + body.halfZ + GAP : hit.halfX + body.halfX + GAP;
      const side = pos >= centre ? centre + reach + SKIN * 2 : centre - reach - SKIN * 2;
      if (Math.abs(side - pos) < SLIP) {
        body.x = px; body.z = pz;
        const step = moveOnDesk(body, axis === "x" ? px : side, axis === "x" ? side : pz, others, PUSH_DEPTH + 1);
        if (!step.hitX && !step.hitZ) {
          // The rest of the move is offset by the step; it still has to end on the desk.
          let ex = px + dx, ez = pz + dz;
          px = step.x; pz = step.z;
          if (axis === "x") ez = pz + dz; else ex = px + dx;
          if (b) { ex = within(ex, b.minX + body.halfX, b.maxX - body.halfX); ez = within(ez, b.minZ + body.halfZ, b.maxZ - body.halfZ); }
          dx = ex - px; dz = ez - pz;
          continue;
        }
        body.x = px; body.z = pz;
      }
    }
    if (axis === "x") { dx = 0; hitX = true; }
    else { dz = 0; hitZ = true; }
  }
  body.x = px; body.z = pz;
  return { x: px, z: pz, hitX, hitZ, pushed };
}

/**
 * Hands a mover's momentum to what it pushed: the pushed body picks up the mover's speed along
 * the contact axis, plus a spin from how far off-centre it was struck.
 */
export function transferMomentum(mover: DeskBody, vx: number, vz: number, pushes: DeskPush[]) {
  for (const { body, axis } of pushes) {
    const inertia = body.halfX * body.halfX + body.halfZ * body.halfZ || 1;
    if (axis === "x") {
      body.vx = vx * .9;
      body.spin = (body.spin ?? 0) + (mover.z - body.z) * vx * .7 / inertia;
    } else {
      body.vz = vz * .9;
      body.spin = (body.spin ?? 0) - (mover.x - body.x) * vz * .7 / inertia;
    }
    body.spin = Math.max(-4, Math.min(4, body.spin));
  }
}
