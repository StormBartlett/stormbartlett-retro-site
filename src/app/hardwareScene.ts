import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { deskObstacles, HARDWARE_PROFILES, type HardwareId, type HardwareProfile } from "./hardwareProfiles";
import type { DeskBody } from "./deskPhysics";

/** The Mac's glass defines the desktop's pixel layout: 600 CSS px tall at 1.2 world units. */
export const FIXED_SCREEN = HARDWARE_PROFILES[0].screen;
/** World units per CSS pixel for the Mac; bigger panels scale the same layout up. */
export const SCREEN_SCALE = FIXED_SCREEN.height * 40 / FIXED_SCREEN.cssHeight;
/** One level desk for every computer; the camera never moves. */
export const DESK_Y = -1.54;
/** Real-world sizing on that desk: newer machines are bigger, with bigger panels. */
export const RIG_SCALE: Record<HardwareId, number> = { classic: 1, laptop: .7, rgb: .84 };
const SCREEN_Z = FIXED_SCREEN.position[2];

/**
 * Where the live desktop sits for a rig. Height stays 600 CSS px, so its layout never
 * reflows vertically; width follows the panel's aspect (no black side bars).
 */
export function screenFor(profile: HardwareProfile) {
  const { scale, offset } = rigAlignment(profile), [x, y, z] = profile.screen.position;
  const aspect = profile.screen.width / profile.screen.height, height = profile.screen.height * scale;
  return {
    position: [offset.x + scale * x, offset.y + scale * y, offset.z + scale * z] as [number, number, number],
    rotation: FIXED_SCREEN.rotation,
    width: height * aspect,
    height,
    /** Size relative to the Mac's glass; applied to the CSS3D anchor. */
    zoom: height / FIXED_SCREEN.height,
    cssHeight: FIXED_SCREEN.cssHeight,
    cssWidth: Math.round(FIXED_SCREEN.cssHeight * aspect),
    // The CRT's glass corners are rounder than its 3D aperture rect; tighter radii poke past the bezel.
    radius: profile.id === "classic" ? 40 : Math.round(profile.screen.radius * FIXED_SCREEN.cssHeight / profile.screen.cssHeight),
  };
}
export const FIXED_FRAMING = { target: [.45, -.15, .35] as [number, number, number], width: 6.2, height: 4.1, distance: 9.5 };
/** Sword pedestal, left of the widest monitor, on the shared desk. */
export const SWITCH_POSITION: [number, number, number] = [-1.95, DESK_Y, .55];
export const PEDESTAL_RADIUS = .34;
/** Forward scan between computers. */
export const TRANSITION_MS = 760;
/** Pulling the sword: blue time-warp back to the first computer. */
export const WARP_MS = 1500;
export type TransitionMode = "scan" | "warp";

/** Uniforms shared by every dissolving material; updated once per frame. */
export const HARDWARE_FX = {
  mode: { value: 0 },
  viewport: { value: new THREE.Vector2(1, 1) },
  glow: { value: 0 },
  time: { value: 0 },
};

/** Desk finish per computer; the shared desk blends between them. */
export const DESK_COLORS: Record<HardwareId, string> = { classic: "#aaa18d", laptop: "#aaa18d", rgb: "#292f38" };

export function rigAlignment(profile: HardwareProfile) {
  const scale = RIG_SCALE[profile.id], [x, , z] = profile.screen.position;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...FIXED_SCREEN.rotation))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...profile.screen.rotation)).invert());
  // Level desk under the tilted laptop after its display has been straightened.
  const deskY = profile.id === "laptop" ? -1.94 : -1.54;
  // Screens centered left-right at one depth; every rig's base on the same desk.
  const offset = new THREE.Vector3(-scale * x, DESK_Y - deskY * scale, SCREEN_Z - scale * z);
  return { scale, offset, rotation, deskY, worldDeskY: DESK_Y };
}

export function switchObstacle(profile: HardwareProfile): DeskBody {
  const { scale, offset } = rigAlignment(profile);
  const half = PEDESTAL_RADIUS / scale;
  return { x: (SWITCH_POSITION[0] - offset.x) / scale, z: (SWITCH_POSITION[2] - offset.z) / scale, halfX: half, halfZ: half };
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
    mergeMeshes(rotor, children.filter(isMergeable), "blade");
    return rotor;
  });
}

const isMergeable = (object: THREE.Object3D): object is THREE.Mesh =>
  object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh) && !(object instanceof THREE.SkinnedMesh) &&
  !Array.isArray(object.material) && object.visible && Object.keys(object.geometry.morphAttributes).length === 0;

/** Bakes meshes into `space` and replaces each material group with one draw. Returns draws saved. */
function mergeMeshes(space: THREE.Object3D, meshes: THREE.Mesh[], label: string) {
  space.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(space.matrixWorld).invert(), groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    // Mirrored transforms would flip triangle winding once baked.
    if (mesh.matrixWorld.determinant() <= 0) continue;
    const geometry = mesh.geometry, material = mesh.material as THREE.Material;
    const key = `${material.uuid}|${Object.keys(geometry.attributes).sort().join(",")}|${geometry.index ? 1 : 0}|${mesh.castShadow}${mesh.receiveShadow}`;
    groups.set(key, [...(groups.get(key) ?? []), mesh]);
  }
  let saved = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const parts = group.map(mesh => mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
    const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, group[0].material);
    merged.name = `merged ${label} ${group[0].name}`; merged.castShadow = group[0].castShadow; merged.receiveShadow = group[0].receiveShadow;
    merged.userData.ownedGeometry = true;
    space.add(merged); group.forEach(mesh => mesh.removeFromParent()); saved += group.length - 1;
  }
  return saved;
}

/** Static case geometry becomes one draw per material; keys, controls and fan rotors stay separate. */
export function mergeStaticMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => {
    if (!isMergeable(object)) return;
    for (let node: THREE.Object3D | null = object; node && node !== root; node = node.parent) {
      if (node.userData.key || node.userData.control || node.name.endsWith("_rotor") || /[ _]blade[ _]\d+$/.test(node.name)) return;
    }
    meshes.push(object);
  });
  return mergeMeshes(root, meshes, "static");
}

/** Corner radius of a rounded rectangle, read from the vertex nearest its bounding-box corner. */
function cornerRadius(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, position = geometry.getAttribute("position");
  let nearest = Infinity;
  for (let i = 0; i < position.count; i++) nearest = Math.min(nearest, Math.hypot(box.max.x - position.getX(i), box.max.y - position.getY(i)));
  return nearest / (Math.SQRT2 - 1);
}

export function roundedRect(path: THREE.Path, halfX: number, halfY: number, radius: number, clockwise = false) {
  const r = Math.min(radius, halfX, halfY), corners: [number, number, number][] = [[halfX - r, halfY - r, 0], [-halfX + r, halfY - r, Math.PI / 2], [-halfX + r, -halfY + r, Math.PI], [halfX - r, -halfY + r, Math.PI * 1.5]];
  const ordered = clockwise ? [...corners].reverse() : corners;
  ordered.forEach(([x, y, start], i) => {
    const from = clockwise ? start + Math.PI / 2 : start, to = clockwise ? start : start + Math.PI / 2;
    if (i === 0) path.moveTo(x + r * Math.cos(from), y + r * Math.sin(from));
    path.absarc(x, y, r, from, to, clockwise);
  });
  path.closePath();
  return path;
}

/**
 * The Mac's bezel ring had square inner corners around a rounded black glass seal, so the
 * case pocket showed at the corners. Rebuild the ring at load with an ivory finish and an
 * aperture that follows the seal's rounded corners. GLB assets stay unchanged.
 */
export function seamlessCrtBezel(root: THREE.Object3D) {
  let bezel: THREE.Mesh | undefined, seal: THREE.Mesh | undefined, ivory: THREE.Material | undefined;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    if (/deep.crt.bezel/i.test(object.name)) bezel = object;
    else if (/black.glass.seal/i.test(object.name)) seal = object;
    else if (!ivory && /ivory/i.test(object.material.name)) ivory = object.material;
  });
  if (!bezel || !seal) return false;
  if (ivory) bezel.material = ivory;
  const outer = bezel.geometry, sealBox = (seal.geometry.computeBoundingBox(), seal.geometry.boundingBox!);
  outer.computeBoundingBox();
  const box = outer.boundingBox!, depth = box.max.z - box.min.z;
  // The aperture sits just inside the seal's outline, so the seal always covers its edge.
  const holeX = sealBox.max.x - .01, holeY = sealBox.max.y - .01, holeRadius = cornerRadius(seal.geometry);
  const shape = roundedRect(new THREE.Shape(), box.max.x, box.max.y, cornerRadius(outer)) as THREE.Shape;
  shape.holes.push(roundedRect(new THREE.Path(), holeX, holeY, holeRadius, true));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geometry.translate(0, 0, box.min.z);
  bezel.geometry = geometry; bezel.userData.ownedGeometry = true;
  return true;
}

/** Box-projected UVs so tiling textures keep one world scale on any face. */
export function boxProjectUVs(geometry: THREE.BufferGeometry, tilesPerUnit = 7) {
  const position = geometry.getAttribute("position");
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal"), uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    const [u, v] = nx >= ny && nx >= nz ? [position.getZ(i), position.getY(i)] : ny >= nz ? [position.getX(i), position.getZ(i)] : [position.getX(i), position.getY(i)];
    uv[i * 2] = u * tilesPerUnit; uv[i * 2 + 1] = v * tilesPerUnit;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** The Mac's moulded-plastic finish, shared by its case, keyboard and mouse. */
export function applyPlasticFinish(material: THREE.MeshStandardMaterial) {
  material.normalMap = plasticNormalMap(); material.normalScale.set(.2, .2);
  material.roughness = Math.min(1, Math.max(material.roughness, .62)); material.needsUpdate = true;
  return material;
}

let plasticNormal: THREE.DataTexture | undefined;
/** Tileable fine "orange-peel" stipple, generated once (128², ~64 KB); no download. */
export function plasticNormalMap() {
  if (plasticNormal) return plasticNormal;
  const size = 128, height = new Float32Array(size * size);
  let seed = 1984;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Periodic value noise: lattices that divide the tile, so it repeats without seams.
  for (const [cells, weight] of [[32, .55], [64, .3], [16, .15]] as const) {
    const lattice = Float32Array.from({ length: cells * cells }, random), step = size / cells;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const at = (i: number, j: number) => lattice[((j % cells) * cells) + (i % cells)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      height[y * size + x] += (top + (bottom - top) * sy) * weight;
    }
  }
  const data = new Uint8Array(size * size * 4), h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2, dy = (h(x, y + 1) - h(x, y - 1)) * 2.2, len = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    data[i] = (-dx / len * .5 + .5) * 255; data[i + 1] = (-dy / len * .5 + .5) * 255; data[i + 2] = (1 / len * .5 + .5) * 255; data[i + 3] = 255;
  }
  plasticNormal = new THREE.DataTexture(data, size, size);
  plasticNormal.wrapS = plasticNormal.wrapT = THREE.RepeatWrapping;
  plasticNormal.magFilter = THREE.LinearFilter; plasticNormal.minFilter = THREE.LinearMipmapLinearFilter;
  plasticNormal.generateMipmaps = true; plasticNormal.anisotropy = 4; plasticNormal.needsUpdate = true;
  return plasticNormal;
}

/** Textured moulded plastic for one material: box-projected UVs on cloned geometry, shared normal map. */
export function addMouldedPlastic(root: THREE.Object3D, materialName: RegExp, tilesPerUnit = 7) {
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh && !Array.isArray(object.material) && materialName.test(object.material.name)) meshes.push(object); });
  for (const mesh of meshes) {
    const previous = mesh.geometry, geometry = boxProjectUVs(previous.clone(), tilesPerUnit);
    if (mesh.userData.ownedGeometry) previous.dispose();
    mesh.geometry = geometry; mesh.userData.ownedGeometry = true;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.isMeshStandardMaterial && material.normalMap !== plasticNormalMap()) applyPlasticFinish(material);
  }
  return meshes.length;
}

/** Frees geometry created by merging; glTF cache geometry is never touched. */
export function disposeMergedGeometry(root: THREE.Object3D) {
  root.traverse(object => { if (object instanceof THREE.Mesh && object.userData.ownedGeometry) object.geometry.dispose(); });
}

export function transitionAmount(now: number, start: number, reducedMotion: boolean, duration = TRANSITION_MS) {
  if (reducedMotion) return 1;
  const t = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Shared shader variant; no transparent sorting, postprocessing or extra render targets.
 * Mode 0 sweeps a dithered scanline up the screen. Mode 1 is the time-warp: chunky blue
 * cells, a cyan wash and bright cell edges. Incoming and outgoing rigs use complementary masks.
 */
export function addPixelDissolve(material: THREE.Material, reveal: {value:number;outgoing?:{value:number}}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.hardwareReveal = reveal;
    shader.uniforms.hardwareOutgoing = reveal.outgoing??{value:0};
    shader.uniforms.hardwareMode = HARDWARE_FX.mode;
    shader.uniforms.hardwareViewport = HARDWARE_FX.viewport;
    shader.uniforms.hardwareGlow = HARDWARE_FX.glow;
    shader.fragmentShader = `uniform float hardwareReveal;\nuniform float hardwareOutgoing;\nuniform float hardwareMode;\nuniform vec2 hardwareViewport;\nuniform float hardwareGlow;\n${shader.fragmentShader}`.replace("#include <dithering_fragment>", `
      #include <dithering_fragment>
      vec2 cell = mod(floor(gl_FragCoord.xy / 2.0), 4.0);
      mat4 bayer = mat4(0.,12.,3.,15., 8.,4.,11.,7., 2.,14.,1.,13., 10.,6.,9.,5.);
      float threshold = (bayer[int(cell.x)][int(cell.y)] + .5) / 16.;
      float progress = mix(hardwareReveal, 1. - hardwareReveal, hardwareOutgoing);
      float liveEdge = step(.001, progress) * step(progress, .999);
      if (hardwareMode < .5) {
        float y = gl_FragCoord.y / max(hardwareViewport.y, 1.);
        float line = mix(-.08, 1.08, progress);
        float d = y - line + (threshold - .5) * .07;
        if (hardwareOutgoing > .5 ? d < 0. : d >= 0.) discard;
        float edge = (1. - smoothstep(0., .045, abs(y - line))) * liveEdge;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1., .78, .46), edge * .55) + vec3(.55, .28, .08) * edge * edge;
      } else {
        vec2 block = floor(gl_FragCoord.xy / 7.);
        float noise = fract(sin(dot(block, vec2(12.9898, 78.233))) * 43758.5453);
        float th = mix(threshold, noise, .7);
        if (hardwareOutgoing > .5 ? th <= progress : th > progress) discard;
        float edge = (1. - smoothstep(0., .1, abs(th - progress))) * liveEdge;
        vec3 blue = vec3(.36, .74, 1.);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * .35 + blue * .75, hardwareGlow * .6) + blue * edge * 1.3;
      }
    `);
  };
  material.customProgramCacheKey = () => "storm-pixel-dissolve-v3";
}