import * as THREE from "three";

/**
 * Procedural shapes for the desk props: sculpted mouse shells, the sword blade and its stone.
 * Everything is built once per mount from a few dozen numbers, so the props add no download.
 */

/** A dome over a rounded footprint. Local space: +y up, -z is the front (toward the screen). */
export type ShellSpec = {
  halfWidth: number;
  /** Footprint reach in front of and behind the origin. */
  front: number;
  back: number;
  height: number;
  /** x/z of the highest point; the surface is pulled toward it. */
  apex: [number, number];
  /** Footprint superellipse exponent: 2 is an ellipse, higher is squarer. */
  squareness: number;
  /** Profile exponent at the sides and back: below 1 gives upright walls and a flat crown. */
  wall: number;
  /** Profile exponent toward the front: 1 is a long even slope down to the buttons. */
  slope: number;
  /** Footprint width multiplier at the very front (1 = no taper). */
  taper: number;
};

const pow = (value: number, exponent: number) => Math.sign(value) * Math.pow(Math.abs(value), exponent);

/** Point on the shell: `theta` goes around the footprint (0 = +x, -π/2 = front), `v` from rim (0) to apex (1). */
export function shellPoint(spec: ShellSpec, theta: number, v: number, target = new THREE.Vector3()) {
  const c = Math.cos(theta), s = Math.sin(theta), e = 2 / spec.squareness;
  const z = pow(s, e) * (s > 0 ? spec.back : spec.front);
  const frontness = Math.max(0, -z / spec.front);
  const x = pow(c, e) * spec.halfWidth * THREE.MathUtils.lerp(1, spec.taper, frontness * frontness);
  const profile = THREE.MathUtils.lerp(spec.wall, spec.slope, Math.pow(Math.max(0, -s), 3));
  const phi = v * Math.PI / 2, reach = Math.pow(Math.cos(phi), profile), rise = Math.pow(Math.sin(phi), profile);
  return target.set(
    spec.apex[0] + (x - spec.apex[0]) * reach,
    spec.height * rise,
    spec.apex[1] + (z - spec.apex[1]) * reach,
  );
}

/** Smooth closed shell. Columns wrap, so there is no shading seam. */
export function shellGeometry(spec: ShellSpec, around = 44, rings = 12) {
  const positions = new Float32Array((around * rings + 1) * 3), indices: number[] = [], point = new THREE.Vector3();
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < around; i++) {
    shellPoint(spec, i / around * Math.PI * 2, ring / rings, point).toArray(positions, (ring * around + i) * 3);
  }
  const pole = around * rings;
  shellPoint(spec, 0, 1, point).toArray(positions, pole * 3);
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < around; i++) {
    const a = ring * around + i, b = ring * around + (i + 1) % around;
    if (ring === rings - 1) indices.push(a, pole, b);
    else indices.push(a, a + around, b, b, a + around, b + around);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A thin strip lying on the shell between two (theta, v) points, e.g. the seam between two
 * buttons. `lift` stands it just proud of the surface so it never z-fights.
 */
export function shellStrip(spec: ShellSpec, from: [number, number], to: [number, number], halfWidth: number, lift = .0015, steps = 10) {
  const positions: number[] = [], indices: number[] = [];
  const point = new THREE.Vector3(), next = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, dt = 1 / steps;
    shellPoint(spec, THREE.MathUtils.lerp(from[0], to[0], t), THREE.MathUtils.lerp(from[1], to[1], t), point);
    shellPoint(spec, THREE.MathUtils.lerp(from[0], to[0], t + dt), THREE.MathUtils.lerp(from[1], to[1], t + dt), next);
    side.subVectors(next, point).cross(up).normalize().multiplyScalar(halfWidth);
    positions.push(point.x - side.x, point.y + lift, point.z - side.z, point.x + side.x, point.y + lift, point.z + side.z);
    if (i < steps) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A band around the shell between two heights, pushed slightly outward; optionally hue-shifted along its length. */
export function shellBand(spec: ShellSpec, v0: number, v1: number, offset = .002, around = 44, hues?: [number, number]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], point = new THREE.Vector3(), color = new THREE.Color();
  for (let i = 0; i < around; i++) {
    const theta = i / around * Math.PI * 2;
    for (const v of [v0, v1]) {
      shellPoint(spec, theta, v, point);
      const dx = point.x - spec.apex[0], dz = point.z - spec.apex[1], length = Math.hypot(dx, dz) || 1;
      positions.push(point.x + dx / length * offset, point.y, point.z + dz / length * offset);
      if (hues) {
        // Out and back, so the loop closes on the same colour.
        color.setHSL(THREE.MathUtils.lerp(hues[0], hues[1], 1 - Math.abs(1 - 2 * i / around)), 1, .62);
        colors.push(color.r, color.g, color.b);
      }
    }
    const a = i * 2, b = (i + 1) % around * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (hues) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const SWORD_BLADE = { length: .9, halfWidth: .046, halfThickness: .011 };

/**
 * Tapered blade hanging down from y = 0: a hexagonal section with a flat fuller down the middle
 * and bevelled edges. Faceted on purpose, so each plane catches the studio lights differently.
 */
export function swordBladeGeometry() {
  const { length, halfWidth, halfThickness: t } = SWORD_BLADE;
  // [y, half width]: shoulder, start of the taper, tip.
  const stations: [number, number][] = [[0, halfWidth], [-.05, halfWidth * .94], [-length * .8, halfWidth * .74], [-length, 0]];
  const ring = ([y, w]: [number, number]) => {
    const flat = w * .34, depth = w ? t : 0;
    return [[-w, 0], [-flat, depth], [flat, depth], [w, 0], [flat, -depth], [-flat, -depth]].map(([x, z]) => new THREE.Vector3(x, y, z));
  };
  const rings = stations.map(ring), positions: number[] = [], colors: number[] = [];
  const edge = new THREE.Color("#f4f7fa"), fuller = new THREE.Color("#9fadb9");
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 6; j++) {
    const a = rings[i][j], a1 = rings[i][(j + 1) % 6], b = rings[i + 1][j], b1 = rings[i + 1][(j + 1) % 6];
    const color = j === 1 || j === 4 ? fuller : edge;
    for (const vertex of [a, b, b1, a, b1, a1]) { positions.push(vertex.x, vertex.y, vertex.z); colors.push(color.r, color.g, color.b); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Outline of the stone, bottom to top, as [radius, height]. The last point is the rim of the flat top. */
export const STONE_PROFILE: [number, number][] = [
  [.34, 0], [.325, .1], [.305, .12], [.268, .125], [.228, .315], [.24, .325], [.258, .365], [.246, .38],
];
export const STONE_TOP = STONE_PROFILE[STONE_PROFILE.length - 1][1];

/**
 * Stepped octagonal plinth as one faceted mesh. Each face gets a slightly different grey so it
 * reads as hewn stone; the layout is seeded, so it is identical on every visit.
 */
export function stoneGeometry(sides = 8, seed = 1986) {
  let state = seed;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const positions: number[] = [], colors: number[] = [], base = new THREE.Color("#6d706c"), color = new THREE.Color();
  const corner = (radius: number, y: number, side: number) => {
    const angle = side / sides * Math.PI * 2;
    return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
  };
  const face = (vertices: number[][], shade: number) => {
    color.copy(base).multiplyScalar(shade);
    for (const vertex of vertices) { positions.push(...vertex); colors.push(color.r, color.g, color.b); }
  };
  for (let step = 0; step < STONE_PROFILE.length - 1; step++) {
    const [r0, y0] = STONE_PROFILE[step], [r1, y1] = STONE_PROFILE[step + 1];
    // Higher tiers are a touch lighter, as if worn smooth.
    const tier = .92 + .16 * y0 / STONE_TOP;
    for (let side = 0; side < sides; side++) {
      const a = corner(r0, y0, side), b = corner(r0, y0, side + 1), c = corner(r1, y1, side), d = corner(r1, y1, side + 1);
      face([a, b, d, a, d, c], tier * (.94 + random() * .12));
    }
  }
  const [rim, top] = STONE_PROFILE[STONE_PROFILE.length - 1];
  for (let side = 0; side < sides; side++) face([[0, top, 0], corner(rim, top, side), corner(rim, top, side + 1)], 1.1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
