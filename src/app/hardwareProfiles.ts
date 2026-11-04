import manifest from "../../public/models/hardware-manifest.json";
import type { DeskBody } from "./deskPhysics";

export type Vec3 = [number, number, number];
export type HardwareId = "classic" | "laptop" | "rgb";
export type HardwareProfile = {
  id: HardwareId;
  label: string;
  subtitle: string;
  asset: string;
  screen: { position: Vec3; rotation: Vec3; width: number; height: number; cssWidth: number; cssHeight: number; radius: number };
  framing: { target: Vec3; width: number; height: number; distance: number };
  keyboard: boolean;
  mouse: Vec3;
  bounds: [number, number, number, number];
};

// Generated alongside the glTF files by assets/blender/build_hardware.py.
export const HARDWARE_PROFILES = manifest as HardwareProfile[];
export const HARDWARE_STORAGE_KEY = "storm-hardware-profile-v1";
export function hardwareProfile(value: unknown): HardwareProfile {
  return HARDWARE_PROFILES.find(profile => profile.id === value) ?? HARDWARE_PROFILES[0];
}
/** Fixed collision footprints for each computer, in desk X/Z space. */
export function deskObstacles(id: HardwareId): DeskBody[] {
  if (id === "classic") return [{ x: 0, z: -.65, halfX: 1.16, halfZ: .85 }];
  if (id === "laptop") return [{ x: 0, z: .35, halfX: 1.97, halfZ: 1.30 }];
  return [{ x: -.75, z: -.3, halfX: .61, halfZ: .48 }, { x: 2.2, z: -.05, halfX: .91, halfZ: .98 }];
}
export function keyboardStart(id: HardwareId): Vec3 {
  return [id === "rgb" ? -.75 : -.1, -1.54, 1.4];
}
export function screenScale(profile: HardwareProfile) {
  return profile.screen.width * 40 / profile.screen.cssWidth;
}
export function framingDistance(profile: HardwareProfile, aspect: number, fov: number) {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const tan = Math.tan(fov * Math.PI / 360);
  return Math.max(profile.framing.distance, profile.framing.width / (2 * tan * ratio), profile.framing.height / (2 * tan)) * 1.04;
}
