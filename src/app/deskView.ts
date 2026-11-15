import type { HardwareId } from "./hardwareProfiles";
import { framingDistance, type HardwareProfile } from "./hardwareProfiles";

/**
 * The desk and the front camera, as plain numbers with no Three.js import. The 3D scene uses
 * them, and so does the 2D placeholder that draws the desk forming before Three.js has loaded.
 */

/** One level desk for every computer. */
export const DESK_Y = -1.54;
/** The slab itself: its top face is at DESK_Y. */
export const DESK_SLAB = { center: [.45, DESK_Y - .05, .35] as [number, number, number], size: [9.6, .1, 5.6] as [number, number, number] };
/** Desk finish per computer; the shared desk blends between them. */
export const DESK_COLORS: Record<HardwareId, string> = { classic: "#aaa18d", laptop: "#aaa18d", rgb: "#292f38" };

export const CAMERA_FOV = 28;
export const FIXED_FRAMING = { target: [.45, -.15, .35] as [number, number, number], width: 6.2, height: 4.1, distance: 9.5 };
/** Portrait phones: centred on the pedestal (x −2.4) to RTX mouse (x 4.1) span, with a small margin. */
export const PORTRAIT_FRAMING = { ...FIXED_FRAMING, target: [.85, -.15, .35] as [number, number, number], width: 6.9 };
/** The front view sits slightly to the right of straight-on and above the target. */
const CAMERA_YAW = .16, CAMERA_RISE = .22;

/** Where the camera stands for the front view at a given viewport aspect. */
export function frontCamera(aspect: number) {
  // Distance steps in tenths of aspect, so a resize does not re-frame on every pixel.
  const stepped = Math.round(aspect * 10) / 10, framing = stepped < 1 ? PORTRAIT_FRAMING : FIXED_FRAMING;
  const distance = framingDistance({ framing } as HardwareProfile, stepped, CAMERA_FOV), [x, y, z] = framing.target;
  return { target: framing.target, position: [x + Math.sin(CAMERA_YAW) * distance, y + distance * CAMERA_RISE, z + Math.cos(CAMERA_YAW) * distance] as [number, number, number] };
}

type Vec = [number, number, number];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => { const length = Math.hypot(...a) || 1; return [a[0] / length, a[1] / length, a[2] / length]; };

/** The desk top's four corners in viewport pixels, as the front camera sees them (back-left, back-right, front-right, front-left). */
export function deskOutline(width: number, height: number): [number, number][] {
  const aspect = width / Math.max(1, height), { position, target } = frontCamera(aspect);
  const forward = unit(sub(target, position)), right = unit(cross(forward, [0, 1, 0])), up = cross(right, forward);
  const tan = Math.tan(CAMERA_FOV * Math.PI / 360), [cx, , cz] = DESK_SLAB.center, hx = DESK_SLAB.size[0] / 2, hz = DESK_SLAB.size[2] / 2;
  return ([[cx - hx, cz - hz], [cx + hx, cz - hz], [cx + hx, cz + hz], [cx - hx, cz + hz]] as const).map(([x, z]) => {
    const point = sub([x, DESK_Y, z], position), depth = Math.max(1e-6, dot(point, forward));
    return [(dot(point, right) / (depth * tan * aspect) + 1) / 2 * width, (1 - dot(point, up) / (depth * tan)) / 2 * height];
  });
}
