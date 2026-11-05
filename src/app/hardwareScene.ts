import * as THREE from "three";
import { deskObstacles, HARDWARE_PROFILES, type HardwareProfile } from "./hardwareProfiles";
import type { DeskBody } from "./deskPhysics";

// Every case is fitted around this one live screen; switching never resizes the OS.
export const FIXED_SCREEN = HARDWARE_PROFILES[0].screen;
export const FIXED_FRAMING = { target: [.4, -.15, .35] as [number, number, number], width: 5.8, height: 4.1, distance: 9.5 };
export const SWITCH_POSITION: [number, number, number] = [-1.65, -.04, .58];
export const TRANSITION_MS = 720;

export function rigAlignment(profile: HardwareProfile) {
  const scale = FIXED_SCREEN.height / profile.screen.height;
  const offset = new THREE.Vector3(...FIXED_SCREEN.position).addScaledVector(new THREE.Vector3(...profile.screen.position), -scale);
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...FIXED_SCREEN.rotation))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...profile.screen.rotation)).invert());
  // Level desk under the tilted laptop after its display has been straightened.
  const deskY = profile.id === "laptop" ? -1.94 : -1.54;
  return { scale, offset, rotation, deskY, worldDeskY: offset.y + deskY * scale };
}

export function switchObstacle(profile: HardwareProfile): DeskBody {
  const { scale, offset } = rigAlignment(profile);
  return { x: (SWITCH_POSITION[0] - offset.x) / scale, z: (SWITCH_POSITION[2] - offset.z) / scale, halfX: .34 / scale, halfZ: .23 / scale };
}

export function alignedDeskObstacles(profile: HardwareProfile): DeskBody[] {
  const {rotation}=rigAlignment(profile),pivot=new THREE.Vector3(...profile.screen.position);
  return deskObstacles(profile.id).map(body=>{
    const corners=[-1,1].flatMap(x=>[-1,1].map(z=>new THREE.Vector3(body.x+x*body.halfX,-1.54,body.z+z*body.halfZ).sub(pivot).applyQuaternion(rotation).add(pivot)));
    const box=new THREE.Box3().setFromPoints(corners);
    return {x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,halfX:(box.max.x-box.min.x)/2,halfZ:(box.max.z-box.min.z)/2};
  });
}

/** Move only blades onto a rotor. Housings, lights and parent fan orientation stay fixed. */
export function prepareFanRotors(scene: THREE.Object3D): THREE.Group[] {
  const blades = new Map<THREE.Object3D, THREE.Object3D[]>();
  scene.traverse(object => {
    if (/[ _]blade[ _]\d+$/.test(object.name) && object.parent) {
      const siblings = blades.get(object.parent) ?? [];
      siblings.push(object); blades.set(object.parent, siblings);
      if (object instanceof THREE.Mesh) object.castShadow = false;
    }
  });
  return Array.from(blades, ([parent, children]) => {
    const rotor = new THREE.Group(); rotor.name = `${parent.name}_rotor`;
    parent.add(rotor); children.forEach(child => rotor.add(child));
    return rotor;
  });
}

export function transitionAmount(now: number, start: number, reducedMotion: boolean) {
  if (reducedMotion) return 1;
  const t = THREE.MathUtils.clamp((now - start) / TRANSITION_MS, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Shared shader variant; no transparent sorting, postprocessing or extra render targets. */
export function addPixelDissolve(material: THREE.Material, reveal: {value:number;outgoing?:{value:number}}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.hardwareReveal = reveal;
    shader.uniforms.hardwareOutgoing = reveal.outgoing??{value:0};
    shader.fragmentShader = `uniform float hardwareReveal;\nuniform float hardwareOutgoing;\n${shader.fragmentShader}`.replace("#include <dithering_fragment>", `
      #include <dithering_fragment>
      vec2 cell = mod(floor(gl_FragCoord.xy / 2.0), 4.0);
      mat4 bayer = mat4(0.,12.,3.,15., 8.,4.,11.,7., 2.,14.,1.,13., 10.,6.,9.,5.);
      float threshold = (bayer[int(cell.x)][int(cell.y)] + .5) / 16.;
      float boundary = mix(hardwareReveal, 1. - hardwareReveal, hardwareOutgoing);
      if (hardwareOutgoing > .5 ? threshold <= boundary : threshold > boundary) discard;
      float edge = (1. - smoothstep(0., .13, abs(threshold - boundary))) * step(.001, hardwareReveal) * step(hardwareReveal, .999);
      gl_FragColor.rgb += vec3(.12,.48,.56) * edge;
    `);
  };
  material.customProgramCacheKey = () => "storm-pixel-dissolve-v2";
}
