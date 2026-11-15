"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { stoneGeometry, STONE_TOP, swordBladeGeometry } from "./peripheralGeometry";
import { addPixelDissolve, HARDWARE_FX, SWITCH_POSITION, transitionAmount, type TransitionMode } from "./hardwareScene";
import styles from "./HardwareGallery.module.css";

export type SwitchTransition = { from: string; to: string; start: number; mode: TransitionMode; duration: number };
/** Short sword reactions: a refusal rattle, a hint hum on the last machine, and the pull itself. */
export type SwordCue = { kind: "rattle" | "hum" | "pull"; start: number };

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

/** Brass plate with the machine's number engraved; the name lives in the accessible label. */
function plaqueTexture(index: number) {
  const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#b8924a"; ctx.fillRect(0, 0, 192, 96);
  ctx.fillStyle = "#14181d"; ctx.fillRect(7, 7, 178, 82);
  ctx.strokeStyle = "#6f5526"; ctx.lineWidth = 2; ctx.strokeRect(8, 8, 176, 80);
  ctx.fillStyle = "#f0cf86"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 58px Georgia, 'Times New Roman', serif"; ctx.fillText(["I", "II", "III"][index] ?? String(index + 1), 96, 51);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Stone face: centre height, distance from the axis and backward lean of the body tier's flats. */
const FACE = { y: .22, apothem: .248 * Math.cos(Math.PI / 8), tilt: -Math.atan(.04 * Math.cos(Math.PI / 8) / .19) };
/** Three carved marks, each a few strokes as [x, y, length, angle]. */
const RUNES: [number, number, number, number][][] = [
  [[0, 0, .07, 0], [.012, .014, .034, -.8], [.012, -.012, .034, .8]],
  [[-.012, 0, .07, 0], [.012, 0, .07, 0], [0, 0, .04, -.75]],
  [[0, 0, .07, 0], [0, .012, .04, .9], [0, -.012, .04, .9]],
];

/** Original sword geometry built once: faceted blade, winged guard, wrapped grip, brass fittings. */
function useSwordParts() {
  const parts = React.useMemo(() => {
    const guard = new THREE.Shape();
    guard.moveTo(0, .052); guard.quadraticCurveTo(.11, .03, .215, .105); guard.quadraticCurveTo(.2, .03, .1, 0);
    guard.lineTo(.05, -.012); guard.lineTo(0, -.07); guard.lineTo(-.05, -.012); guard.lineTo(-.1, 0);
    guard.quadraticCurveTo(-.2, .03, -.215, .105); guard.quadraticCurveTo(-.11, .03, 0, .052);
    const guardGeometry = new THREE.ExtrudeGeometry(guard, { depth: .03, bevelEnabled: true, bevelThickness: .009, bevelSize: .007, bevelSegments: 2, steps: 1, curveSegments: 10 });
    guardGeometry.translate(0, 0, -.015);
    const lathe = (points: [number, number][], segments = 16) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
    const brass = mergeGeometries([
      lathe([[0, .046], [.031, .046], [.031, .064], [.022, .07]]),
      lathe([[.02, .25], [.03, .254], [.03, .266], [.021, .272], [.036, .288], [.041, .304], [.035, .322], [.019, .333], [0, .336]]),
    ])!;
    const grip = lathe([[.02, .066], [.0235, .12], [.0235, .19], [.02, .252]], 12);
    const wraps = mergeGeometries([0, 1, 2, 3, 4, 5, 6].map(i => new THREE.TorusGeometry(.0235, .0034, 4, 14).rotateX(Math.PI / 2).translate(0, .09 + i * .023, 0)))!;
    const gems = mergeGeometries([1, -1].map(side => new THREE.OctahedronGeometry(.024).scale(1, 1.25, .55).translate(0, .012, side * .026)))!;
    const runes = mergeGeometries(Array.from({ length: 7 }, (_, face) => RUNES[face % RUNES.length].map(([x, y, length, angle]) =>
      new THREE.BoxGeometry(.008, length, .004).rotateZ(angle).translate(x, y, 0).rotateX(FACE.tilt).translate(0, FACE.y, FACE.apothem + .001).rotateY((face + 1) * Math.PI / 4))).flat())!;
    // Flat faces, not corners, point at the camera.
    const stone = stoneGeometry().rotateY(Math.PI / 8);
    return { bladeGeometry: swordBladeGeometry(), guardGeometry, brass, grip, wraps, gems, runes, stone };
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
  const { bladeGeometry, guardGeometry, brass, grip, wraps, gems, runes, stone } = useSwordParts();
  const plaque = React.useMemo(() => plaqueTexture(index), [index]);
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
  const gold = <meshStandardMaterial color="#c9a24d" metalness={.85} roughness={.3} envMapIntensity={1.3} />;
  return <group position={[SWITCH_POSITION[0], deskY, SWITCH_POSITION[2]]} ref={root}>
    {/* Stone: one stepped octagonal plinth with carved marks on every face but the plaque's. */}
    <mesh geometry={stone} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.96} /></mesh>
    <mesh geometry={runes}><meshStandardMaterial ref={rune} color="#1d3a4a" emissive="#57d6ff" emissiveIntensity={.05} roughness={.6} /></mesh>
    {/* Slot in the cap where the blade enters. */}
    <mesh position={[0, STONE_TOP + .001, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.12, .036]} /><meshBasicMaterial color="#151614" /></mesh>
    {/* Plaque and the forward button, set into the front faces. */}
    <mesh position={[0, FACE.y, FACE.apothem + .002]} rotation={[FACE.tilt, 0, 0]}><planeGeometry args={[.15, .075]} /><meshBasicMaterial map={plaque} toneMapped={false} /></mesh>
    <group position={[0, .058, .312]} rotation={[-.14, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.066, .074, .024, 24]} />{gold}</mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, .008]} scale={[1, .55, 1]}><sphereGeometry args={[.052, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial ref={button} color="#b23a26" emissive={busy ? "#ffb347" : "#ff6a3d"} emissiveIntensity={.45} roughness={.35} /></mesh>
    </group>
    <group ref={sword} position={[0, GUARD_Y, 0]}>
      <mesh geometry={bladeGeometry} castShadow><meshStandardMaterial vertexColors metalness={.82} roughness={.2} envMapIntensity={1.6} /></mesh>
      <mesh geometry={guardGeometry} castShadow><meshStandardMaterial color="#27488a" metalness={.6} roughness={.28} envMapIntensity={1.2} /></mesh>
      <mesh geometry={gems}><meshStandardMaterial ref={gem} color="#2b8fb0" emissive="#6ee6ff" emissiveIntensity={.2} roughness={.12} flatShading /></mesh>
      <mesh geometry={grip} castShadow><meshStandardMaterial color="#1a2542" roughness={.88} /></mesh>
      <mesh geometry={wraps}><meshStandardMaterial color="#3d5ea6" roughness={.7} /></mesh>
      <mesh geometry={brass} castShadow>{gold}</mesh>
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
export function TimeWarpFX({ transition, cue, reduced, deskY: targetDeskY, oldDeskY, forming = false }: {
  transition: React.RefObject<SwitchTransition | null>; cue: React.RefObject<SwordCue | null>; reduced: boolean; deskY: number; oldDeskY: number;
  /** First load, model still arriving: hold a soft version of the warp (motes, column, slow rings) until it lands. */
  forming?: boolean;
}) {
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
  const idle = React.useRef(0);
  useFrame((_, delta) => {
    const now = performance.now(), change = transition.current, warp = change?.mode === "warp" ? change : null;
    const t = warp ? transitionAmount(now, warp.start, reduced, warp.duration) : 0;
    const pose = swordPose(now, cue.current, change, reduced);
    // Eases in while forming and back out under the warp-in, so the two never step.
    idle.current = THREE.MathUtils.damp(idle.current, forming && !reduced ? .42 : 0, 5, Math.min(delta, .05));
    if (!forming && idle.current < .004) idle.current = 0;
    const glow = reduced ? 0 : Math.max(idle.current * (.88 + .12 * Math.sin(now / 300)), warp ? Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), .7) : pose.lift / PULL_LIFT * .35);
    HARDWARE_FX.glow.value = glow;
    group.current.visible = glow > .002;
    if (!group.current.visible) { light.current.intensity = 0; return; }
    const time = now / 1000, deskY = THREE.MathUtils.lerp(oldDeskY, targetDeskY, change ? transitionAmount(now, change.start, reduced, change.duration) : 1);
    motes.material.uniforms.time.value = time; motes.material.uniforms.glow.value = glow; motes.material.uniforms.pixel.value = gl.getPixelRatio();
    motes.material.uniforms.origin.value.set(.25, deskY, .2);
    beam.uniforms.glow.value = glow; beam.uniforms.time.value = time;
    column.current.position.set(SWITCH_POSITION[0], deskY + STONE_TOP + 2.6, SWITCH_POSITION[2]);
    column.current.scale.set(.6 + glow * 1.2, 1, .6 + glow * 1.2);
    ring.uniforms.glow.value = glow; ring.uniforms.phase.value = warp ? Math.min(1, t * 1.25) : idle.current ? (time * .4) % 1 : 0;
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
