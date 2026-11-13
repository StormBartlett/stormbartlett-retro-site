"use client";

/* R3F owns these mutable scene resources; frame updates deliberately bypass React rendering. */

import * as React from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { moveOnDesk, rotatedFootprint, type DeskBody, type DeskWorld } from "./deskPhysics";
import { applyPlasticFinish, boxProjectUVs } from "./hardwareScene";

export type DeskBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type RetroHardwareProps = {
  /** The bottom of the hardware rests at this height. Coordinates are local to its parent. */
  position?: [number, number, number];
  tone?: "classic" | "modern";
  /** Mouse only: "box" is the one-button desk mouse, "ergo" a sculpted wireless mouse. */
  shape?: "box" | "ergo";
  physics?: DeskWorld;
  rotationY?: number;
  bounds?: DeskBounds;
  onInteractionChange?: (active: boolean) => void;
};

const KEYBOARD_POSITION: [number, number, number] = [0, -0.94, 1.45];
const MOUSE_POSITION: [number, number, number] = [1.7, -0.94, 1.42];
const KEYBOARD_BOUNDS: DeskBounds = { minX: -0.75, maxX: 0.65, minZ: 0.85, maxZ: 2.3 };
const MOUSE_BOUNDS: DeskBounds = { minX: 0.85, maxX: 2.65, minZ: 0.7, maxZ: 2.35 };
const NO_RAYCAST = () => null;
const KEY_Y = 0.143;
const KEY_LABEL_Y = KEY_Y + 0.0445;
const KEY_TRAVEL = 0.024;

type InteractionCallback = (active: boolean) => void;
// Shared callbacks stay locked until every active touch has released its hardware.
const interactionCounts = new Map<InteractionCallback, number>();
export function reportInteraction(callback: InteractionCallback | undefined, active: boolean) {
  if (!callback) return;
  const count = interactionCounts.get(callback) ?? 0;
  if (active) {
    interactionCounts.set(callback, count + 1);
    if (count === 0) callback(true);
  } else if (count <= 1) {
    interactionCounts.delete(callback);
    callback(false);
  } else interactionCounts.set(callback, count - 1);
}

type GestureActions = { onTap?: () => void; onEnd?: () => void; onDragStart?: () => void };
type PointerCaptureTarget = {
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
};

/** Pointer capture plus window fallbacks also covers a release outside the canvas. */
function useDeskDrag(bounds: DeskBounds, footprint: { width: number; depth: number; angle: number }, physics?: DeskWorld, onInteractionChange?: (active: boolean) => void) {
  const group = React.useRef<THREE.Group>(null);
  const bodyId = React.useId();
  const body = React.useRef<DeskBody>({ x: 0, z: 0, ...rotatedFootprint(footprint.width, footprint.depth, footprint.angle) });
  React.useLayoutEffect(() => {
    if (!group.current || !physics) return;
    Object.assign(body.current, { x: group.current.position.x, z: group.current.position.z }, rotatedFootprint(footprint.width, footprint.depth, footprint.angle));
    physics.set(bodyId, body.current);
    return () => { physics.delete(bodyId); };
  }, [physics, bodyId, footprint.width, footprint.depth, footprint.angle]);
  const { camera, gl, invalidate } = useThree();
  const latest = React.useRef({ bounds, onInteractionChange });
  React.useLayoutEffect(() => { latest.current = { bounds, onInteractionChange }; }, [bounds, onInteractionChange]);
  const state = React.useRef({
    pointer: -1,
    downX: 0,
    downY: 0,
    offsetX: 0,
    offsetZ: 0,
    lastX: 0,
    lastZ: 0,
    lastTime: 0,
    moved: false,
    velocityX: 0,
    velocityZ: 0,
    capture: null as PointerCaptureTarget | null,
    actions: null as GestureActions | null,
    interactionCallback: undefined as InteractionCallback | undefined,
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0)),
    hit: new THREE.Vector3(),
    world: new THREE.Vector3(),
    ndc: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
  });

  const finish = React.useCallback((cancelled: boolean) => {
    const s = state.current;
    if (s.pointer === -1) return;
    const pointer = s.pointer;
    const actions = s.actions;
    const wasTap = !s.moved && !cancelled;
    s.pointer = -1;
    s.actions = null;
    if (cancelled || performance.now() - s.lastTime > 90) s.velocityX = s.velocityZ = 0;
    try { s.capture?.releasePointerCapture(pointer); } catch { /* Capture can already be lost. */ }
    s.capture = null;
    gl.domElement.style.cursor = "grab";
    reportInteraction(s.interactionCallback, false);
    s.interactionCallback = undefined;
    actions?.onEnd?.();
    if (wasTap) actions?.onTap?.();
    invalidate();
  }, [gl, invalidate]);

  React.useEffect(() => {
    const move = (event: PointerEvent) => {
      const s = state.current;
      const root = group.current;
      if (event.pointerId !== s.pointer || !root) return;
      if (event.cancelable) event.preventDefault();
      if (!s.moved) {
        const threshold = event.pointerType === "touch" ? 7 : 4;
        if (Math.hypot(event.clientX - s.downX, event.clientY - s.downY) < threshold) return;
        s.moved = true;
        s.actions?.onDragStart?.();
      }
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      s.ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      s.raycaster.setFromCamera(s.ndc, camera);
      if (!s.raycaster.ray.intersectPlane(s.plane, s.hit)) return;
      root.parent?.worldToLocal(s.hit);
      const b = latest.current.bounds;
      const x = THREE.MathUtils.clamp(s.hit.x + s.offsetX, b.minX, b.maxX);
      const z = THREE.MathUtils.clamp(s.hit.z + s.offsetZ, b.minZ, b.maxZ);
      const resolved = physics ? moveOnDesk(body.current, x, z, physics.values()) : { x, z };
      const now = performance.now();
      const dt = Math.max((now - s.lastTime) / 1000, 0.008);
      s.velocityX = THREE.MathUtils.clamp((resolved.x - s.lastX) / dt * 0.65 + s.velocityX * 0.35, -5, 5);
      s.velocityZ = THREE.MathUtils.clamp((resolved.z - s.lastZ) / dt * 0.65 + s.velocityZ * 0.35, -5, 5);
      s.lastX = root.position.x = resolved.x;
      s.lastZ = root.position.z = resolved.z;
      s.lastTime = now;
      gl.shadowMap.needsUpdate = true;
      invalidate();
    };
    const up = (event: PointerEvent) => { if (event.pointerId === state.current.pointer) finish(false); };
    const cancel = (event: PointerEvent) => { if (event.pointerId === state.current.pointer) finish(true); };
    const blur = () => {state.current.velocityX=state.current.velocityZ=0;finish(true);};
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    window.addEventListener("storm-hardware-cancel", blur);
    gl.domElement.addEventListener("lostpointercapture", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
      window.removeEventListener("storm-hardware-cancel", blur);
      gl.domElement.removeEventListener("lostpointercapture", cancel);
      finish(true);
      gl.domElement.style.cursor = "";
    };
  }, [camera, finish, gl, invalidate, physics]);

  useFrame((_, delta) => {
    const s = state.current;
    const root = group.current;
    if (!root || s.pointer !== -1 || (s.velocityX === 0 && s.velocityZ === 0)) return;
    const dt = Math.min(delta, 0.04);
    const b = latest.current.bounds;
    const nextX = root.position.x + s.velocityX * dt;
    const nextZ = root.position.z + s.velocityZ * dt;
    const x = THREE.MathUtils.clamp(nextX, b.minX, b.maxX);
    const z = THREE.MathUtils.clamp(nextZ, b.minZ, b.maxZ);
    const resolved = physics ? moveOnDesk(body.current, x, z, physics.values()) : { x, z, hitX: false, hitZ: false };
    root.position.x = resolved.x; root.position.z = resolved.z;
    gl.shadowMap.needsUpdate = true;
    // A little energy is returned at the desk boundary; friction settles the object quickly.
    const friction = Math.exp(-6.8 * dt);
    s.velocityX *= !resolved.hitX && nextX === root.position.x ? friction : -0.16;
    s.velocityZ *= !resolved.hitZ && nextZ === root.position.z ? friction : -0.16;
    if (Math.abs(s.velocityX) < 0.008) s.velocityX = 0;
    if (Math.abs(s.velocityZ) < 0.008) s.velocityZ = 0;
    invalidate();
  });

  const begin = (event: ThreeEvent<PointerEvent>, actions: GestureActions = {}) => {
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    const s = state.current;
    const root = group.current;
    if (!root || s.pointer !== -1 || (event.pointerType === "mouse" && event.button !== 0)) return false;
    root.getWorldPosition(s.world);
    s.plane.constant = -s.world.y;
    if (!event.ray.intersectPlane(s.plane, s.hit)) return false;
    root.parent?.worldToLocal(s.hit);
    s.offsetX = root.position.x - s.hit.x;
    s.offsetZ = root.position.z - s.hit.z;
    s.downX = event.clientX;
    s.downY = event.clientY;
    s.lastX = root.position.x;
    s.lastZ = root.position.z;
    s.lastTime = performance.now();
    s.velocityX = s.velocityZ = 0;
    s.moved = false;
    s.actions = actions;
    s.pointer = event.pointerId;
    s.capture = event.target as unknown as PointerCaptureTarget;
    try { s.capture.setPointerCapture(event.pointerId); } catch { /* Window listeners remain a fallback. */ }
    gl.domElement.style.cursor = "grabbing";
    s.interactionCallback = latest.current.onInteractionChange;
    reportInteraction(s.interactionCallback, true);
    invalidate();
    return true;
  };

  return {
    groupRef: group,
    begin,
    hover: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      if (state.current.pointer === -1) gl.domElement.style.cursor = "grab";
    },
    leave: () => { if (state.current.pointer === -1) gl.domElement.style.cursor = ""; },
  };
}

function roundedSlab(width: number, depth: number, height: number, radius: number, bevel = 0.008) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const z = -depth / 2;
  shape.moveTo(x + radius, z);
  shape.lineTo(x + width - radius, z);
  shape.quadraticCurveTo(x + width, z, x + width, z + radius);
  shape.lineTo(x + width, z + depth - radius);
  shape.quadraticCurveTo(x + width, z + depth, x + width - radius, z + depth);
  shape.lineTo(x + radius, z + depth);
  shape.quadraticCurveTo(x, z + depth, x, z + depth - radius);
  shape.lineTo(x, z + radius);
  shape.quadraticCurveTo(x, z, x + radius, z);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelSegments: 1, steps: 1,
    bevelSize: bevel, bevelThickness: bevel, curveSegments: 2,
  });
  geometry.rotateX(-Math.PI / 2);
  // World-scaled UVs so the classic set shares the Mac case's moulded-plastic grain.
  return boxProjectUVs(geometry);
}

function useHardwareResources(tone: "classic" | "modern" = "classic") {
  const resources = React.useMemo(() => {
    const cream = new THREE.MeshStandardMaterial({ color: "#d8cfb5", roughness: 0.64 });
    const light = new THREE.MeshStandardMaterial({ color: "#e8dfc7", roughness: 0.6 });
    const side = new THREE.MeshStandardMaterial({ color: "#b9ae91", roughness: 0.76 });
    const dark = new THREE.MeshStandardMaterial({ color: "#817966", roughness: 0.84 });
    const cord = new THREE.MeshStandardMaterial({ color: "#aca28a", roughness: 0.77 });
    const keys = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.64 });
    if(tone === "modern") {
      cream.color.set("#303845");light.color.set("#495464");side.color.set("#151c24");dark.color.set("#0a1018");cord.color.set("#242b35");keys.color.set("#ffffff");keys.emissive.set("#333333");keys.emissiveIntensity=.25;
    }
    // Classic keyboard and mouse match the Mac's ivory plastic texture.
    if(tone === "classic") [cream, light, side, keys].forEach(applyPlasticFinish);
    return { cream, light, side, dark, cord, keys };
  }, [tone]);
  React.useEffect(() => () => Object.values(resources).forEach((material) => material.dispose()), [resources]);
  return resources;
}

/** A small dynamic tube keeps its far end plugged in while the hardware moves. */
function HardwareCable({
  body, position, rotationY, offset, anchor, material,
}: {
  body: React.RefObject<THREE.Group | null>;
  position: [number, number, number];
  rotationY: number;
  offset: [number, number, number];
  anchor: [number, number, number];
  material: THREE.Material;
}) {
  const geometry = React.useMemo(() => {
    const rings = 36;
    const sides = 7;
    const positions = new Float32Array((rings + 1) * sides * 3);
    const indices: number[] = [];
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + (j + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    result.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(positions.length), 3).setUsage(THREE.DynamicDrawUsage));
    result.setIndex(indices);
    return result;
  }, []);
  const previous = React.useRef({ x: Infinity, z: Infinity });
  useFrame(() => {
    const root = body.current;
    if (!root || (root.position.x === previous.current.x && root.position.z === previous.current.z)) return;
    previous.current.x = root.position.x;
    previous.current.z = root.position.z;
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const startX = root.position.x + offset[0] * cos + offset[2] * sin;
    const startZ = root.position.z - offset[0] * sin + offset[2] * cos;
    const startY = position[1] + offset[1];
    const controlX = startX - sin * 0.42;
    const controlZ = startZ - cos * 0.42;
    const endX = anchor[0];
    const endY = anchor[1];
    const endZ = anchor[2];
    const control2X = endX + 0.25;
    const control2Z = endZ + 0.35;
    const attribute = geometry.attributes.position as THREE.BufferAttribute;
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const u = 1 - t;
      const x = u * u * u * startX + 3 * u * u * t * controlX + 3 * u * t * t * control2X + t * t * t * endX;
      const z = u * u * u * startZ + 3 * u * u * t * controlZ + 3 * u * t * t * control2Z + t * t * t * endZ;
      const y = startY * u + endY * t - Math.sin(Math.PI * t) * 0.025;
      const dx = 3 * u * u * (controlX - startX) + 6 * u * t * (control2X - controlX) + 3 * t * t * (endX - control2X);
      const dz = 3 * u * u * (controlZ - startZ) + 6 * u * t * (control2Z - controlZ) + 3 * t * t * (endZ - control2Z);
      const length = Math.hypot(dx, dz) || 1;
      for (let j = 0; j < 7; j++) {
        const angle = j / 7 * Math.PI * 2;
        const radial = Math.sin(angle) * 0.009;
        attribute.setXYZ(i * 7 + j, x - dz / length * radial, y + Math.cos(angle) * 0.009, z + dx / length * radial);
        normals.setXYZ(i * 7 + j, -dz / length * Math.sin(angle), Math.cos(angle), dx / length * Math.sin(angle));
      }
    }
    attribute.needsUpdate = true;
    normals.needsUpdate = true;
  });
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} raycast={NO_RAYCAST} frustumCulled={false} castShadow />;
}

type HardwareKey = { label: string; key: string; units: number; x: number; z: number; width: number };
function keyboardLayout(): HardwareKey[] {
  const regular = (labels: string[]) => labels.map((label) => [label, label === "−" ? "-" : label.toLowerCase(), 1] as const);
  const rows: (readonly [string, string, number])[][] = [
    [["esc", "Escape", 1], ...regular(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "−", "="]), ["delete", "Backspace", 2]],
    [["tab", "Tab", 1.5], ...regular(["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"]), ["\\", "\\", 1.5]],
    [["caps lock", "CapsLock", 1.75], ...regular(["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"]), ["return", "Enter", 2.25]],
    [["shift", "Shift", 2.25], ...regular(["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"]), ["shift", "Shift", 2.75]],
    [["ctrl", "Control", 1.25], ["option", "Alt", 1.25], ["⌘", "Meta", 1.5], ["", " ", 7], ["⌘", "Meta", 1.5], ["option", "Alt", 1.25], ["ctrl", "Control", 1.25]],
  ];
  const keys: HardwareKey[] = [];
  rows.forEach((row, rowIndex) => {
    let cursor = -1.125;
    row.forEach(([label, key, units]) => {
      const width = units * 0.15 - 0.014;
      keys.push({ label, key, units, width, x: cursor + units * 0.075, z: (rowIndex - 2) * 0.151 });
      cursor += units * 0.15;
    });
  });
  return keys;
}
const KEYS = keyboardLayout();

function makeLegends() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#514e42";
    context.textAlign = "center";
    context.textBaseline = "middle";
    KEYS.forEach((key, index) => {
      context.font = `${key.label.length > 1 ? 26 : 43}px Arial, sans-serif`;
      context.fillText(key.label, index % 8 * 128 + 64, Math.floor(index / 8) * 128 + 65, 116);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const positions = new Float32Array(KEYS.length * 12);
  const uvs = new Float32Array(KEYS.length * 8);
  const indices: number[] = [];
  KEYS.forEach((key, index) => {
    const width = Math.min(key.width * 0.9, 0.25);
    const depth = 0.097;
    const vertex = index * 4;
    positions.set([
      key.x - width / 2, KEY_LABEL_Y, key.z + depth / 2,
      key.x + width / 2, KEY_LABEL_Y, key.z + depth / 2,
      key.x - width / 2, KEY_LABEL_Y, key.z - depth / 2,
      key.x + width / 2, KEY_LABEL_Y, key.z - depth / 2,
    ], index * 12);
    const u = index % 8 / 8;
    const v = 1 - (Math.floor(index / 8) + 1) / 8;
    uvs.set([u, v, u + 0.125, v, u, v + 0.125, u + 0.125, v + 0.125], index * 8);
    indices.push(vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  return { geometry, texture, material };
}

/** Compact 1980s keyboard. Tap a key; drag any part; release with a little momentum. */
export function RetroKeyboard({
  position = KEYBOARD_POSITION, rotationY = -0.025, bounds = KEYBOARD_BOUNDS, onInteractionChange, tone = "classic", physics,
}: RetroHardwareProps) {
  const { groupRef, begin, hover, leave } = useDeskDrag(bounds, { width: 2.48, depth: 1.01, angle: rotationY }, physics, onInteractionChange);
  const materials = useHardwareResources(tone);
  const { invalidate } = useThree();
  const caps = React.useRef<THREE.InstancedMesh>(null);
  const animation = React.useRef({ held: -1, pulse: -1, until: 0, depths: new Float32Array(KEYS.length), matrix: new THREE.Object3D() });
  const geometries = React.useMemo(() => ({
    base: roundedSlab(2.43, 0.91, 0.085, 0.008, 0.007),
    deck: roundedSlab(2.38, 0.87, 0.026, 0.006, 0.004),
    recess: roundedSlab(2.29, 0.772, 0.012, 0.004, 0.003),
    key: roundedSlab(0.126, 0.126, 0.035, 0.002, 0.003),
  }), []);
  const legends = React.useMemo(() => typeof document === "undefined" ? null : makeLegends(), []);
  React.useLayoutEffect(() => {
    if (!caps.current) return;
    const matrix = animation.current.matrix;
    KEYS.forEach((key, index) => {
      matrix.position.set(key.x, KEY_Y, key.z);
      matrix.scale.set(key.width / 0.142, 1, 1);
      matrix.updateMatrix();
      caps.current!.setMatrixAt(index, matrix.matrix);
      caps.current!.setColorAt(index, tone === "modern" ? new THREE.Color().setHSL((key.x / 2.5 + .5 + key.z * .16) % 1, .9, .64) : new THREE.Color(key.units > 1 && key.key !== " " ? "#d5cbb2" : "#e9dfc7"));
    });
    caps.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    caps.current.instanceMatrix.needsUpdate = true;
    if (caps.current.instanceColor) caps.current.instanceColor.needsUpdate = true;
    caps.current.computeBoundingSphere();
    invalidate();
  }, [invalidate, tone]);
  React.useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose());
    legends?.geometry.dispose();
    legends?.texture.dispose();
    legends?.material.dispose();
  }, [geometries, legends]);

  useFrame((_, delta) => {
    if (!caps.current) return;
    const a = animation.current;
    const now = performance.now();
    let changed = false;
    let moving = a.pulse !== -1 && now < a.until;
    const vertices = legends?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    for (let index = 0; index < KEYS.length; index++) {
      const target = index === a.held || (index === a.pulse && now < a.until) ? KEY_TRAVEL : 0;
      const previous = a.depths[index];
      if (previous === target) continue;
      let depth = THREE.MathUtils.damp(previous, target, 42, Math.min(delta, 0.04));
      if (Math.abs(depth - target) < 0.0002) depth = target;
      else moving = true;
      a.depths[index] = depth;
      const key = KEYS[index];
      a.matrix.position.set(key.x, KEY_Y - depth, key.z);
      a.matrix.scale.set(key.width / 0.142, 1, 1);
      a.matrix.updateMatrix();
      caps.current.setMatrixAt(index, a.matrix.matrix);
      for (let vertex = index * 4; vertex < index * 4 + 4; vertex++) vertices?.setY(vertex, KEY_LABEL_Y - depth);
      changed = true;
    }
    if (changed) {
      caps.current.instanceMatrix.needsUpdate = true;
      if (vertices) vertices.needsUpdate = true;
    }
    if (moving) invalidate();
  });

  const release = () => { animation.current.held = -1; invalidate(); };
  return (
    <>
      <HardwareCable body={groupRef} position={position} rotationY={rotationY} offset={[0.82, 0.068, -0.46]} anchor={[0.63, position[1] + 0.035, -0.42]} material={materials.cord} />
      <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} onPointerOver={hover} onPointerOut={leave} onPointerDown={(event) => begin(event)}>
        {tone === "modern" && Array.from({length: 12}, (_, i) => <mesh key={i} position={[-1.1 + i * .2, .05, .456]} raycast={NO_RAYCAST}><boxGeometry args={[.19, .025, .018]}/><meshBasicMaterial color={new THREE.Color().setHSL(i / 12, 1, .6)}/></mesh>)}
        <mesh geometry={geometries.base} material={materials.side} position={[0, 0.022, 0]} castShadow receiveShadow />
        <group rotation={[0.065, 0, 0]}>
          <mesh geometry={geometries.deck} material={materials.cream} position={[0, 0.095, 0]} castShadow receiveShadow />
          <mesh geometry={geometries.recess} material={materials.dark} position={[0, 0.12, 0]} receiveShadow />
          <instancedMesh
            ref={caps} args={[geometries.key, materials.keys, KEYS.length]} castShadow receiveShadow
            onPointerDown={(event) => {
              const index = event.instanceId;
              if (index === undefined) return;
              const accepted = begin(event, {
                onTap: () => window.dispatchEvent(new CustomEvent("storm-hardware-key", { detail: { key: KEYS[index].key } })),
                onEnd: release,
                onDragStart: () => { animation.current.until = 0; release(); },
              });
              if (accepted) {
                animation.current.held = animation.current.pulse = index;
                animation.current.until = performance.now() + 85;
                invalidate();
              }
            }}
          />
          {legends && <mesh geometry={legends.geometry} material={legends.material} raycast={NO_RAYCAST} />}
          <mesh position={[1.035, 0.141, -0.405]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
            <circleGeometry args={[0.009, 10]} />
            <meshStandardMaterial color="#618a4c" emissive="#364922" emissiveIntensity={0.3} />
          </mesh>
        </group>
        <mesh position={[0.82, 0.067, -0.466]} rotation={[Math.PI / 2, 0, 0]} material={materials.side} castShadow>
          <cylinderGeometry args={[0.018, 0.019, 0.075, 10]} />
        </mesh>
        {[-0.028, -0.012, 0.004].map((z) => <mesh key={z} position={[0.82, 0.067, -0.485 + z]} material={materials.dark} raycast={NO_RAYCAST}><torusGeometry args={[0.019, 0.002, 5, 10]} /></mesh>)}
      </group>
    </>
  );
}

/** A single-button desktop mouse. Clicks emit a scoped event rather than clicking page elements. */
export function RetroMouse({
  position = MOUSE_POSITION, rotationY = -0.11, bounds = MOUSE_BOUNDS, onInteractionChange, tone = "classic", shape = "box", physics,
}: RetroHardwareProps) {
  const { groupRef, begin, hover, leave } = useDeskDrag(bounds, { width: .444, depth: .636, angle: rotationY }, physics, onInteractionChange);
  const materials = useHardwareResources(tone);
  const { invalidate } = useThree();
  const button = React.useRef<THREE.Group>(null);
  const press = React.useRef({ held: false, until: 0 });
  const lastPointer = React.useRef({x: NaN,z: NaN});
  useFrame(() => {
    const body = groupRef.current;
    if (!body || (body.position.x === lastPointer.current.x && body.position.z === lastPointer.current.z)) return;
    lastPointer.current.x = body.position.x; lastPointer.current.z = body.position.z;
    window.dispatchEvent(new CustomEvent("storm-hardware-pointer", {detail:{
      u: THREE.MathUtils.clamp((body.position.x - bounds.minX)/(bounds.maxX-bounds.minX),0,1),
      v: THREE.MathUtils.clamp((body.position.z - bounds.minZ)/(bounds.maxZ-bounds.minZ),0,1),
    }}));
  });
  const geometries = React.useMemo(() => ({
    sole: roundedSlab(0.414, 0.606, 0.027, 0.008, 0.004),
    shell: roundedSlab(0.41, 0.6, 0.095, 0.009, 0.006),
    button: roundedSlab(0.364, 0.27, 0.028, 0.003, 0.004),
  }), []);
  React.useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  // Sculpted wireless mouse: right-leaning palm shell, thumb shelf, metal wheels.
  const ergo = React.useMemo(() => shape !== "ergo" ? null : {
    sphere: new THREE.SphereGeometry(1, 40, 24),
    wheel: new THREE.CylinderGeometry(1, 1, 1, 28),
    sole: roundedSlab(0.33, 0.58, 0.02, 0.01, 0.004),
    shell: new THREE.MeshStandardMaterial({ color: "#2d3036", roughness: 0.52, metalness: 0.18 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#1b1d22", roughness: 0.86 }),
    metal: new THREE.MeshStandardMaterial({ color: "#a3a9b1", roughness: 0.28, metalness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ color: "#7df3df", toneMapped: false }),
  }, [shape]);
  React.useEffect(() => () => { if (ergo) Object.values(ergo).forEach((item) => item.dispose()); }, [ergo]);
  useFrame((_, delta) => {
    if (!button.current) return;
    const pulse = performance.now() < press.current.until;
    const active = press.current.held || pulse;
    const target = active ? -0.013 : 0;
    const current = button.current.position.y;
    if (current === target) {
      if (!press.current.held && pulse) invalidate();
      return;
    }
    let y = THREE.MathUtils.damp(current, target, 40, Math.min(delta, 0.04));
    if (Math.abs(y - target) < 0.00015) y = target;
    button.current.position.y = y;
    if (y !== target || (!press.current.held && pulse)) invalidate();
  });
  const release = () => { press.current.held = false; invalidate(); };
  return (
    <>
      {!ergo && <HardwareCable body={groupRef} position={position} rotationY={rotationY} offset={[0, 0.07, -0.32]} anchor={[0.91, position[1] + 0.035, -0.19]} material={materials.cord} />}
      <group
        ref={groupRef} position={position} rotation={[0, rotationY, 0]} onPointerOver={hover} onPointerOut={leave}
        onPointerDown={(event) => {
          const accepted = begin(event, {
            onTap: () => window.dispatchEvent(new CustomEvent("storm-hardware-click")),
            onEnd: release,
            onDragStart: () => { press.current.until = 0; release(); },
          });
          if (accepted) {
            press.current.held = true;
            press.current.until = performance.now() + 85;
          }
        }}
      >
        {ergo ? <>
          <mesh geometry={ergo.sole} material={ergo.rubber} position={[0.01, 0.012, 0.01]} receiveShadow />
          {/* Palm shell, leaning right, highest toward the back like the hand rests on it. */}
          <mesh geometry={ergo.sphere} material={ergo.shell} position={[0.025, 0.07, 0.03]} rotation={[0.1, 0, -0.2]} scale={[0.16, 0.115, 0.3]} castShadow receiveShadow />
          <mesh geometry={ergo.sphere} material={ergo.shell} position={[0.06, 0.06, -0.12]} rotation={[0, 0.1, -0.12]} scale={[0.12, 0.085, 0.18]} castShadow />
          {/* Thumb shelf on the left, with its side wheel and buttons. */}
          <mesh geometry={ergo.sphere} material={ergo.rubber} position={[-0.135, 0.04, 0.05]} rotation={[0, 0.18, 0.1]} scale={[0.075, 0.032, 0.21]} castShadow />
          <mesh geometry={ergo.wheel} material={ergo.metal} position={[-0.125, 0.105, -0.03]} rotation={[0, 0, 0.35]} scale={[0.028, 0.016, 0.028]} raycast={NO_RAYCAST} />
          {[0.04, 0.085].map((z) => <mesh key={z} geometry={ergo.sphere} material={ergo.rubber} position={[-0.14, 0.098, z]} scale={[0.012, 0.012, 0.02]} raycast={NO_RAYCAST} />)}
          <mesh geometry={ergo.wheel} material={ergo.glow} position={[0.02, 0.183, 0.04]} rotation={[0.1, 0, -0.2]} scale={[0.008, 0.002, 0.008]} raycast={NO_RAYCAST} />
        </> : <>
          <mesh geometry={geometries.sole} material={materials.dark} position={[0, 0.016, 0]} castShadow receiveShadow />
          <mesh geometry={geometries.shell} material={materials.cream} position={[0, 0.045, 0]} castShadow receiveShadow />
        </>}
        <group ref={button}>
          {ergo ? <>
            {/* Metal scroll wheel in the split between the two buttons. */}
            <mesh geometry={ergo.wheel} material={ergo.metal} position={[0.03, 0.15, -0.16]} rotation={[0, 0, Math.PI / 2 - 0.2]} scale={[0.04, 0.03, 0.04]} castShadow />
            <mesh material={ergo.rubber} position={[0.035, 0.155, -0.23]} rotation={[0.35, 0, -0.2]} raycast={NO_RAYCAST}><boxGeometry args={[0.006, 0.012, 0.11]} /></mesh>
          </> : <mesh geometry={geometries.button} material={materials.light} position={[0, 0.13, -0.133]} castShadow receiveShadow />}
        </group>
        {!ergo && <><mesh position={[0, 0.07, -0.326]} rotation={[Math.PI / 2, 0, 0]} material={materials.side} castShadow><cylinderGeometry args={[0.016, 0.02, 0.06, 10]} /></mesh>
        {[-0.018, 0, 0.018].map((z) => <mesh key={z} position={[0, 0.07, -0.347 + z]} material={materials.dark} raycast={NO_RAYCAST}><torusGeometry args={[0.018, 0.002, 5, 10]} /></mesh>)}
        <group position={[-0.067, 0.151, 0.17]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
          {["#809054", "#c2a455", "#bf805c", "#a76e6e", "#81718c", "#678d99"].map((color, index) => <mesh key={color} position={[0, (index - 2.5) * 0.007, 0]}><planeGeometry args={[0.027, 0.005]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>)}
        </group></>}
      </group>
    </>
  );
}

export default function RetroHardware({ onInteractionChange }: Pick<RetroHardwareProps, "onInteractionChange">) {
  return <><RetroKeyboard onInteractionChange={onInteractionChange} /><RetroMouse onInteractionChange={onInteractionChange} /></>;
}
