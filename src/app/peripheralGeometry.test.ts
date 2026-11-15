import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { shellBand, shellGeometry, shellPoint, shellStrip, stoneGeometry, STONE_PROFILE, STONE_TOP, SWORD_BLADE, swordBladeGeometry, type ShellSpec } from "./peripheralGeometry";

const spec: ShellSpec = { halfWidth: .158, front: .31, back: .27, height: .16, apex: [-.035, .07], squareness: 2.5, wall: .72, slope: .92, taper: .86 };

/** Every triangle's normal should point away from `inside`. */
function facesOutward(geometry: THREE.BufferGeometry, inside: (centroid: THREE.Vector3) => THREE.Vector3) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry, position = flat.getAttribute("position");
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3(), centroid = new THREE.Vector3();
  let inward = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    normal.subVectors(b, a).cross(centroid.subVectors(c, a));
    if (normal.lengthSq() < 1e-16) continue;
    centroid.copy(a).add(b).add(c).divideScalar(3);
    if (normal.dot(centroid.clone().sub(inside(centroid))) < 0) inward++;
  }
  return inward === 0;
}

describe("mouse shells", () => {
  it("stay inside their footprint and peak at the apex", () => {
    const geometry = shellGeometry(spec); geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    expect(min.x).toBeCloseTo(-spec.halfWidth, 5); expect(max.x).toBeCloseTo(spec.halfWidth, 5);
    expect(min.z).toBeCloseTo(-spec.front, 5); expect(max.z).toBeCloseTo(spec.back, 5);
    expect(min.y).toBe(0); expect(max.y).toBeCloseTo(spec.height, 5);
    expect(shellPoint(spec, 1.2, 1).distanceTo(new THREE.Vector3(spec.apex[0], spec.height, spec.apex[1]))).toBeLessThan(1e-9);
    expect(facesOutward(geometry, () => new THREE.Vector3(spec.apex[0], 0, spec.apex[1]))).toBe(true);
    geometry.dispose();
  });

  it("narrows toward the buttons and slopes down to them more gently than the sides", () => {
    expect(Math.abs(shellPoint(spec, -Math.PI / 2 + .6, 0).x)).toBeLessThan(Math.abs(shellPoint(spec, Math.PI / 2 - .6, 0).x));
    // Half-way up, the front has risen less than the side wall has.
    expect(shellPoint(spec, -Math.PI / 2, .5).y).toBeLessThan(shellPoint(spec, 0, .5).y);
  });

  it("lays seams and rim bands on the surface", () => {
    const seam = shellStrip(spec, [-Math.PI / 2, .1], [-Math.PI / 2, .8], .004, .0015), position = seam.getAttribute("position");
    for (let i = 0; i < position.count; i += 2) {
      const on = shellPoint(spec, -Math.PI / 2, THREE.MathUtils.lerp(.1, .8, i / 2 / 10));
      expect((position.getX(i) + position.getX(i + 1)) / 2).toBeCloseTo(on.x, 5);
      expect(position.getY(i)).toBeCloseTo(on.y + .0015, 5);
    }
    const band = shellBand(spec, 0, .012, .003, 24, [.47, .88]);
    expect(band.getAttribute("color").count).toBe(band.getAttribute("position").count);
    band.computeBoundingBox();
    expect(band.boundingBox!.max.x).toBeGreaterThan(spec.halfWidth);
    expect(band.boundingBox!.max.x).toBeLessThan(spec.halfWidth + .0031);
    seam.dispose(); band.dispose();
  });
});

describe("sword and stone", () => {
  it("builds a closed-sided blade that tapers to a point", () => {
    const blade = swordBladeGeometry(); blade.computeBoundingBox();
    const { min, max } = blade.boundingBox!;
    expect(min.y).toBeCloseTo(-SWORD_BLADE.length, 6); expect(max.y).toBe(0);
    expect(max.x).toBeCloseTo(SWORD_BLADE.halfWidth, 6); expect(max.z).toBeCloseTo(SWORD_BLADE.halfThickness, 6);
    expect(facesOutward(blade, centroid => new THREE.Vector3(0, centroid.y, 0))).toBe(true);
    expect(blade.getAttribute("color").count).toBe(blade.getAttribute("position").count);
    blade.dispose();
  });

  it("keeps the stone's footprint and flat top", () => {
    const stone = stoneGeometry(); stone.computeBoundingBox();
    const { min, max } = stone.boundingBox!;
    expect(min.y).toBe(0); expect(max.y).toBeCloseTo(STONE_TOP, 6);
    // The widest ring is the base: it must stay within the pedestal's collision radius.
    expect(Math.max(max.x, max.z, -min.x, -min.z)).toBeCloseTo(STONE_PROFILE[0][0], 6);
    expect(facesOutward(stone, centroid => new THREE.Vector3(0, Math.min(centroid.y, STONE_TOP - .01), 0))).toBe(true);
    // Seeded: the same faces get the same greys on every visit.
    const again = stoneGeometry();
    expect(Array.from(again.getAttribute("color").array)).toEqual(Array.from(stone.getAttribute("color").array));
    stone.dispose(); again.dispose();
  });
});
