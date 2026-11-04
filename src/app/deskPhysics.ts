/** Small swept-AABB solver in desk X/Z space. No physics engine or render loop. */
export type DeskBody = { x: number; z: number; halfX: number; halfZ: number };
export type DeskWorld = Map<string, DeskBody>;
export type DeskMove = { x: number; z: number; hitX: boolean; hitZ: boolean };
const GAP = 0.002;
// Stops land a hair outside the face, so rounding can never start the next sweep inside it.
const SKIN = 1e-9;

export function rotatedFootprint(width: number, depth: number, angle: number) {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return { halfX: (width * c + depth * s) / 2, halfZ: (width * s + depth * c) / 2 };
}

/** Continuous collision detection prevents fast pointer moves and throws tunnelling. */
export function moveOnDesk(body: DeskBody, x: number, z: number, obstacles: Iterable<DeskBody>): DeskMove {
  let px = body.x, pz = body.z, dx = x - px, dz = z - pz;
  let hitX = false, hitZ = false;
  const others = Array.from(obstacles).filter(other => other !== body);
  for (let pass = 0; pass < 3 && (Math.abs(dx) + Math.abs(dz) > 1e-9); pass++) {
    let earliest = 1, axis: "x" | "z" | null = null, face = 0;
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
    }
    px += dx * earliest; pz += dz * earliest;
    if (!axis) break;
    dx *= 1 - earliest; dz *= 1 - earliest;
    if (axis === "x") { px = face; dx = 0; hitX = true; }
    else { pz = face; dz = 0; hitZ = true; }
  }
  body.x = px; body.z = pz;
  return { x: px, z: pz, hitX, hitZ };
}
