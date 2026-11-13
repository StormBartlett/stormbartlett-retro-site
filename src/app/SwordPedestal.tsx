"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addPixelDissolve, HARDWARE_FX, SWITCH_POSITION, transitionAmount, type TransitionMode } from "./hardwareScene";
import styles from "./HardwareGallery.module.css";

export type SwitchTransition = { from: string; to: string; start: number; mode: TransitionMode; duration: number };
/** Short sword reactions: a refusal rattle, a hint hum on the last machine, and the pull itself. */
export type SwordCue = { kind: "rattle" | "hum" | "pull"; start: number };

const STONE_TOP = .38;
/** Guard height above the desk; .55 of blade shows above the stone, .35 stays buried. */
const GUARD_Y = .93;
const PULL_LIFT = .58;
const PULL_RISE_MS = 300;
const CUE_MS = { rattle: 420, hum: 1300 };
/** Deterministic motes: same layout every visit, and pure for React. */
function seeded(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (t: number) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/** One sword lift/rattle model, shared by the pedestal, its light and the warp effects. */
export function swordPose(now: number, cue: SwordCue | null, change: SwitchTransition | null, reduced: boolean) {
  let lift = 0, shake = 0, hum = 0;
  if (cue?.kind === "pull") {
    lift = reduced ? PULL_LIFT : PULL_LIFT * smooth((now - cue.start) / PULL_RISE_MS);
    if (change?.mode === "warp") {
      const t = transitionAmount(now, change.start, reduced, change.duration);
      lift *= 1 - smooth((t - .72) / .28);
    }
  } else if (cue && !reduced) {
    const age = now - cue.start, span = CUE_MS[cue.kind];
    if (age < span) {
      const fade = 1 - age / span;
      shake = Math.sin(age / (cue.kind === "hum" ? 18 : 28)) * fade * (cue.kind === "hum" ? .018 : .055);
      lift = cue.kind === "rattle" ? Math.max(0, Math.sin(age / 60)) * .025 * fade : 0;
      hum = cue.kind === "hum" ? Math.sin(Math.PI * age / span) : 0;
    }
  }
  return { lift, shake, hum };
}

export function cueActive(now: number, cue: SwordCue | null) {
  return !!cue && (cue.kind === "pull" || now - cue.start < CUE_MS[cue.kind]);
}

function plaqueTexture(index: number, label: string) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1f26"; ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = "#b8924a"; ctx.lineWidth = 6; ctx.strokeRect(5, 5, 246, 86);
  ctx.fillStyle = "#f0cf86"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 34px Georgia, 'Times New Roman', serif"; ctx.fillText(["I", "II", "III"][index] ?? String(index + 1), 128, 34);
  ctx.font = "bold 21px monospace"; ctx.fillStyle = "#cfd6c0"; ctx.fillText(label.toUpperCase(), 128, 70);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Original sword geometry built once: tapered blade with a fuller, swept guard, wrapped grip. */
function useSwordParts() {
  const parts = React.useMemo(() => {
    const blade = new THREE.Shape();
    blade.moveTo(-.043, 0); blade.lineTo(-.037, -.72); blade.lineTo(0, -.9); blade.lineTo(.037, -.72); blade.lineTo(.043, 0); blade.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(blade, { depth: .012, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, steps: 1 });
    bladeGeometry.translate(0, 0, -.006);
    const guard = new THREE.Shape();
    guard.moveTo(-.2, .085); guard.quadraticCurveTo(-.1, .03, 0, .05); guard.quadraticCurveTo(.1, .03, .2, .085);
    guard.quadraticCurveTo(.215, .05, .19, .04); guard.quadraticCurveTo(.1, -.01, 0, -.012); guard.quadraticCurveTo(-.1, -.01, -.19, .04);
    guard.quadraticCurveTo(-.215, .05, -.2, .085);
    const guardGeometry = new THREE.ExtrudeGeometry(guard, { depth: .036, bevelEnabled: true, bevelThickness: .01, bevelSize: .008, bevelSegments: 2, steps: 1, curveSegments: 8 });
    guardGeometry.translate(0, 0, -.018);
    const wraps = mergeGeometries([0, 1, 2, 3, 4].map(i => new THREE.TorusGeometry(.0225, .005, 4, 14).rotateX(Math.PI / 2).translate(0, .075 + i * .04, 0)))!;
    const runes = mergeGeometries(Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI / 4 + Math.PI / 8;
      return new THREE.BoxGeometry(i % 2 ? .05 : .03, .022, .006).translate(0, 0, .231).rotateY(angle).translate(0, .25, 0);
    }))!;
    return { bladeGeometry, guardGeometry, wraps, runes };
  }, []);
  React.useEffect(() => () => Object.values(parts).forEach(geometry => geometry.dispose()), [parts]);
  return parts;
}

export function SwordPedestal({ index, label, isLast, busy, onForward, onPull, onWarm, deskY, oldDeskY, scale, oldScale, transition, cue, reduced, portalRef, reveal }: {
  index: number; label: string; isLast: boolean; busy: boolean; onForward: () => void; onPull: () => void; onWarm: () => void;
  deskY: number; oldDeskY: number; scale: number; oldScale: number; transition: React.RefObject<SwitchTransition | null>;
  cue: React.RefObject<SwordCue | null>; reduced: boolean; portalRef: React.RefObject<HTMLDivElement>;
  /** Shared intro reveal: the pedestal materialises with the first computer. */
  reveal?: { value: number; outgoing?: { value: number } };
}) {
  const invalidate = useThree(state => state.invalidate);
  const { bladeGeometry, guardGeometry, wraps, runes } = useSwordParts();
  const plaque = React.useMemo(() => plaqueTexture(index, label), [index, label]);
  React.useEffect(() => () => plaque.dispose(), [plaque]);
  const root = React.useRef<THREE.Group>(null!), sword = React.useRef<THREE.Group>(null!);
  const gem = React.useRef<THREE.MeshStandardMaterial>(null!), rune = React.useRef<THREE.MeshStandardMaterial>(null!), button = React.useRef<THREE.MeshStandardMaterial>(null!);
  const pressed = React.useRef(0);
  React.useLayoutEffect(() => {
    if (!reveal) return;
    root.current.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) { addPixelDissolve(material, reveal); material.needsUpdate = true; }
    });
  }, [reveal]);
  useFrame(() => {
    const now = performance.now(), change = transition.current;
    const t = change ? transitionAmount(now, change.start, reduced, change.duration) : 1;
    root.current.position.y = THREE.MathUtils.lerp(oldDeskY, deskY, t);
    root.current.scale.setScalar(THREE.MathUtils.lerp(oldScale, scale, t));
    const pose = swordPose(now, cue.current, change, reduced);
    sword.current.position.y = GUARD_Y + pose.lift;
    sword.current.rotation.z = pose.shake;
    sword.current.rotation.y = pose.lift * 1.6;
    // The last machine's gem glows faintly: the only visible hint that the sword does something.
    const idleHint = isLast && !busy ? .55 + .25 * Math.sin(now / 700) : .15;
    const power = Math.max(idleHint, pose.hum * 2.4, pose.lift * 4, HARDWARE_FX.glow.value * 4);
    gem.current.emissiveIntensity = power;
    rune.current.emissiveIntensity = Math.max(isLast ? .35 : .05, pose.hum * 1.8, HARDWARE_FX.glow.value * 3, pose.lift * 2);
    const press = Math.max(0, pressed.current - now) / 140;
    button.current.emissiveIntensity = busy ? .9 : .45 + press;
    // The hint pulse rides on frames that render anyway (the RTX fans); it never requests its own.
    if (cueActive(now, cue.current) || press > 0) invalidate();
  });
  const forward = () => { pressed.current = performance.now() + 140; onForward(); invalidate(); };
  const stop = (event: React.PointerEvent | React.MouseEvent) => event.stopPropagation();
  const drag = React.useRef<{ id: number; y: number; done: boolean } | null>(null);
  const pull = () => { onPull(); invalidate(); };
  const steel = "#e8eff4";
  return <group position={[SWITCH_POSITION[0], deskY, SWITCH_POSITION[2]]} ref={root}>
    {/* Stone: stepped octagonal plinth, body and cap; flat faces point at the camera. */}
    <group rotation={[0, Math.PI / 8, 0]}>
      <mesh position={[0, .06, 0]} castShadow receiveShadow><cylinderGeometry args={[.31, .34, .12, 8]} /><meshStandardMaterial color="#8d8f8a" roughness={.92} flatShading /></mesh>
      <mesh position={[0, .22, 0]} castShadow receiveShadow><cylinderGeometry args={[.225, .265, .2, 8]} /><meshStandardMaterial color="#9a9c95" roughness={.95} flatShading /></mesh>
      <mesh position={[0, .35, 0]} castShadow receiveShadow><cylinderGeometry args={[.255, .235, .06, 8]} /><meshStandardMaterial color="#a7a89f" roughness={.88} flatShading /></mesh>
      <mesh geometry={runes} rotation={[0, -Math.PI / 8, 0]}><meshStandardMaterial ref={rune} color="#1d3a4a" emissive="#57d6ff" emissiveIntensity={.05} roughness={.6} /></mesh>
    </group>
    {/* Slot in the cap where the blade enters. */}
    <mesh position={[0, STONE_TOP + .001, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.11, .035]} /><meshBasicMaterial color="#1c1d1b" /></mesh>
    {/* Plaque and the forward button, set into the base. */}
    <mesh position={[0, .225, .238]}><planeGeometry args={[.25, .094]} /><meshBasicMaterial map={plaque} toneMapped={false} /></mesh>
    <group position={[0, .062, .318]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.07, .075, .022, 20]} /><meshStandardMaterial color="#b58d45" metalness={.75} roughness={.32} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, .016]}><cylinderGeometry args={[.05, .052, .02, 20]} /><meshStandardMaterial ref={button} color="#a33d2a" emissive={busy ? "#ffb347" : "#ff6a3d"} emissiveIntensity={.45} roughness={.5} /></mesh>
    </group>
    <group ref={sword} position={[0, GUARD_Y, 0]}>
      <mesh geometry={bladeGeometry} castShadow><meshStandardMaterial color={steel} metalness={.6} roughness={.24} envMapIntensity={1.5} /></mesh>
      <mesh position={[0, -.36, .0125]}><boxGeometry args={[.011, .62, .002]} /><meshStandardMaterial color="#8fa2b0" metalness={.9} roughness={.3} /></mesh>
      <mesh position={[0, -.36, -.0125]}><boxGeometry args={[.011, .62, .002]} /><meshStandardMaterial color="#8fa2b0" metalness={.9} roughness={.3} /></mesh>
      <mesh geometry={guardGeometry} castShadow><meshStandardMaterial color="#284a86" metalness={.55} roughness={.3} /></mesh>
      {[-.205, .205].map(x => <mesh key={x} position={[x, .07, 0]}><sphereGeometry args={[.022, 10, 8]} /><meshStandardMaterial color="#caa24c" metalness={.8} roughness={.3} /></mesh>)}
      <mesh position={[0, .035, .03]}><icosahedronGeometry args={[.021, 1]} /><meshStandardMaterial ref={gem} color="#2b8fb0" emissive="#6ee6ff" emissiveIntensity={.2} roughness={.15} flatShading /></mesh>
      <mesh position={[0, .155, 0]} castShadow><cylinderGeometry args={[.019, .022, .2, 10]} /><meshStandardMaterial color="#1c2847" roughness={.85} /></mesh>
      <mesh geometry={wraps}><meshStandardMaterial color="#3a5aa0" roughness={.7} /></mesh>
      <mesh position={[0, .263, 0]}><cylinderGeometry args={[.03, .024, .016, 12]} /><meshStandardMaterial color="#caa24c" metalness={.8} roughness={.3} /></mesh>
      <mesh position={[0, .3, 0]} castShadow><sphereGeometry args={[.036, 14, 10]} /><meshStandardMaterial color="#caa24c" metalness={.82} roughness={.28} /></mesh>
      {/* Hidden handle target: drag up (or click/Enter) to pull the sword. */}
      <Html transform center wrapperClass={styles.htmlPortal} portal={portalRef} position={[0, .15, .05]} scale={.36} zIndexRange={[150, 101]}>
        <button type="button" className={styles.swordHit} aria-label="Pull the sword" title=""
          onPointerDown={event => { stop(event); drag.current = { id: event.pointerId, y: event.clientY, done: false }; try { event.currentTarget.setPointerCapture(event.pointerId); } catch {} }}
          onPointerMove={event => { const d = drag.current; if (d && d.id === event.pointerId && !d.done && d.y - event.clientY > 14) { d.done = true; pull(); } }}
          onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }} onPointerCancel={() => { drag.current = null; }}
          onClick={event => { stop(event); if (!drag.current?.done) pull(); }} />
      </Html>
    </group>
    <Html transform center wrapperClass={styles.htmlPortal} portal={portalRef} position={[0, .14, .34]} scale={.36} zIndexRange={[150, 101]}>
      <button type="button" className={styles.switchHit} aria-label={isLast ? `Next computer. Current: ${label}, the last one` : `Next computer. Current: ${label}`} title="Next computer"
        onFocus={onWarm} onPointerEnter={onWarm} onPointerDown={stop} onClick={event => { stop(event); forward(); }} />
    </Html>
  </group>;
}

/** Blue time-warp: rising motes, a light column from the sword and a ring across the desk. */
export function TimeWarpFX({ transition, cue, reduced, deskY: targetDeskY, oldDeskY }: { transition: React.RefObject<SwitchTransition | null>; cue: React.RefObject<SwordCue | null>; reduced: boolean; deskY: number; oldDeskY: number }) {
  const count = 320;
  const motes = React.useMemo(() => {
    const random = seeded(1986), geometry = new THREE.BufferGeometry(), seeds = new Float32Array(count * 4), position = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = .25 + Math.pow(random(), .7) * 3.4, angle = random() * Math.PI * 2;
      seeds.set([Math.cos(angle) * radius, Math.sin(angle) * radius, random(), .4 + random() * .9], i * 4);
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, glow: { value: 0 }, origin: { value: new THREE.Vector3() }, pixel: { value: 1 } },
      vertexShader: `attribute vec4 seed; uniform float time; uniform float glow; uniform vec3 origin; uniform float pixel; varying float vAlpha;
        void main(){ float h = fract(seed.z + time * .32 * seed.w); vec3 p = origin + vec3(seed.x * (1. + h * .25), h * 3.6 - .2, seed.y * (1. + h * .25));
          vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
          vAlpha = glow * smoothstep(0., .15, h) * (1. - smoothstep(.6, 1., h)) * (.55 + .45 * sin(time * 9. * seed.w + seed.z * 40.));
          gl_PointSize = pixel * (7. + 9. * seed.w) * glow * (6. / -mv.z); }`,
      fragmentShader: `varying float vAlpha; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); if (d > .5) discard;
          float core = smoothstep(.5, 0., d); gl_FragColor = vec4(mix(vec3(.35,.72,1.), vec3(1.), core * core), vAlpha * core); }`,
    });
    return { geometry, material };
  }, []);
  const beam = React.useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { glow: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float glow; uniform float time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float facing = pow(abs(dot(vN, vV)), 1.6); float fade = (1. - vUv.y) * smoothstep(0., .08, vUv.y);
        float ripple = .75 + .25 * sin(vUv.y * 40. - time * 14.); gl_FragColor = vec4(vec3(.45,.8,1.) * ripple, glow * facing * fade * .8); }`,
  }), []);
  const ring = React.useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { glow: { value: 0 }, phase: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float glow; uniform float phase; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.;
      float band = smoothstep(.12, 0., abs(r - phase)) + .35 * smoothstep(.08, 0., abs(r - phase * .62)); gl_FragColor = vec4(vec3(.4,.78,1.), band * glow * (1. - phase * .7)); }`,
  }), []);
  React.useEffect(() => () => { motes.geometry.dispose(); motes.material.dispose(); beam.dispose(); ring.dispose(); }, [motes, beam, ring]);
  const group = React.useRef<THREE.Group>(null!), column = React.useRef<THREE.Mesh>(null!), wave = React.useRef<THREE.Mesh>(null!), light = React.useRef<THREE.PointLight>(null!);
  const { gl } = useThree();
  useFrame(() => {
    const now = performance.now(), change = transition.current, warp = change?.mode === "warp" ? change : null;
    const t = warp ? transitionAmount(now, warp.start, reduced, warp.duration) : 0;
    const pose = swordPose(now, cue.current, change, reduced);
    const glow = reduced ? 0 : warp ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), .7) : pose.lift / PULL_LIFT * .35;
    HARDWARE_FX.glow.value = glow;
    group.current.visible = glow > .002;
    if (!group.current.visible) { light.current.intensity = 0; return; }
    const time = now / 1000, deskY = THREE.MathUtils.lerp(oldDeskY, targetDeskY, change ? transitionAmount(now, change.start, reduced, change.duration) : 1);
    motes.material.uniforms.time.value = time; motes.material.uniforms.glow.value = glow; motes.material.uniforms.pixel.value = gl.getPixelRatio();
    motes.material.uniforms.origin.value.set(.25, deskY, .2);
    beam.uniforms.glow.value = glow; beam.uniforms.time.value = time;
    column.current.position.set(SWITCH_POSITION[0], deskY + STONE_TOP + 2.6, SWITCH_POSITION[2]);
    column.current.scale.set(.6 + glow * 1.2, 1, .6 + glow * 1.2);
    ring.uniforms.glow.value = glow; ring.uniforms.phase.value = warp ? Math.min(1, t * 1.25) : 0;
    wave.current.position.set(SWITCH_POSITION[0], deskY + .012, SWITCH_POSITION[2]);
    light.current.position.set(SWITCH_POSITION[0], deskY + 1.2, SWITCH_POSITION[2] + .3);
    light.current.intensity = glow * 7;
  });
  return <>
    {/* Always present (at zero) so the scene's light count, and so its shaders, never change. */}
    <pointLight ref={light} color="#66c8ff" intensity={0} distance={7} decay={1.4} />
    <group ref={group} visible={false} name="time-warp-fx">
      <points geometry={motes.geometry} material={motes.material} frustumCulled={false} renderOrder={20} />
      <mesh ref={column} material={beam} renderOrder={21}><cylinderGeometry args={[.12, .12, 5.2, 24, 1, true]} /></mesh>
      <mesh ref={wave} material={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}><planeGeometry args={[9, 9]} /></mesh>
    </group>
  </>;
}
