"use client";

import { Canvas, useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, Html } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as React from "react";
import * as THREE from "three";

// Tweak points
// const MODEL_ROT_Y = 0; // rotate around Y (radians). e.g. Math.PI * 0.5 = 90°
// const MODEL_SCALE = .3; // overall model size
// const SCREEN_ROT_Y = 0; // independent screen rotation (Y)
// const SCREEN_SCALE = .31 ; // independent screen size multiplier
// const MODEL_POS: [number, number, number] = [0, 0, 0]; // move whole model in world space
// const SCREEN_OFFSET: [number, number, number] = [-.3, 0.53, -0.05]; // screen relative to model origin
// const CONTROLS_TARGET_OFFSET: [number, number, number] = [0, 0.0, 0.0]; // orbit focus relative to model


//custom model values
// const MODEL_ROT_Y = 0; // rotate around Y (radians). e.g. Math.PI * 0.5 = 90° - now set directly in MacGLBModel component
const MODEL_SCALE = 1; // overall model size
const MODEL_OFFSET_X = -.92; // move model left(-)/right(+) relative to screen (in model's rotated space)
const MODEL_OFFSET_Y = -.0; // move model down(-)/up(+) relative to screen
const MODEL_OFFSET_Z = 0; // move model back(-)/forward(+) relative to screen (in model's rotated space)
const SCREEN_ROT_Y = 0; //Math.PI/2; // independent screen rotation (Y) - rotate screen to face user (0 = forward when parent is rotated -90°)
const SCREEN_ROT_X = -Math.PI/30; // independent screen rotation (X tilt) - tilt screen up/down
const SCREEN_ROT_Z = 0; // independent screen rotation (Z roll)
const SCREEN_SCALE = 1 ; // independent screen size multiplier
const MODEL_POS: [number, number, number] = [0, 0, 0]; // move whole model+screen assembly in world space
const SCREEN_OFFSET: [number, number, number] = [0, 0, 0]; // Keep at [0,0,0] to avoid rotation issues! Use MODEL_POS to move everything.
const CONTROLS_TARGET_OFFSET: [number, number, number] = [0, 0.0, 0.0]; // orbit focus relative to model

// Fine-tune screen position within the model WITHOUT breaking rotation
// These are NO LONGER USED - use MODEL_OFFSET_X/Y/Z to move the model instead!

//Camera + Controls tweak variables
const CAMERA_START_POS: [number, number, number] = [-1.96, 23.17, 17.02];
const CAMERA_START_FOV = 24;
const CAMERA_START_TARGET: [number, number, number] = [
  MODEL_POS[0] + CONTROLS_TARGET_OFFSET[0],
  MODEL_POS[1] + CONTROLS_TARGET_OFFSET[1],
  MODEL_POS[2] + CONTROLS_TARGET_OFFSET[2],
];

// Smooth reset animation duration
const VIEW_RESET_MS = 900; // ms

// Fit behavior tweak variables (for the reset-to-screen)
type ViewFitMode = "height" | "width" | "max" | "min";
const VIEW_FIT_MODE: ViewFitMode = "max"; // choose how to fit: height, width, max, or min
const VIEW_FIT_MARGIN = .04; // multiplier margin around the fitted view
const VIEW_FIT_MARGIN_MOBILE = .03; // slightly more margin on mobile (if needed)
const VIEW_FIT_EXTRA_SCALE = 1.0; // additional multiplier after fit calculation
const VIEW_FIT_OFFSET = 0.4; // additive world-units along screen normal after fit
const VIEW_FIT_CLAMP: [number, number] = [0.28, 2.2]; // clamp min/max distance along normal
// Vertical offset to raise the camera target when viewing the screen
const VIEW_TARGET_Y_OFFSET = 0.25;

// Platform compensation removed - now use SCREEN_LOCAL_X/Y/Z for fine positioning

// Rotation limits (left/right and up/down)
// Azimuth (left/right) limits relative to target
const ORBIT_AZIMUTH_MIN = -Math.PI / 10; // rotate left limit
const ORBIT_AZIMUTH_MAX = Math.PI / 10;  // rotate right limit
// Polar (vertical) limits to avoid top/bottom extremes
const ORBIT_POLAR_MIN = Math.PI / 4.2;   // how far up from below
const ORBIT_POLAR_MAX = Math.PI / 2.15;  // slightly under top-down

// Zoom limits (distance from target)
const ZOOM_MIN_DISTANCE = 3; // How close you can zoom in
const ZOOM_MAX_DISTANCE = 14;   // How far you can zoom out

// Approximate screen plane size in local units (tweak to fit cutout)
const SCREEN_PLANE_W = 2.6;
const SCREEN_PLANE_H = 3.0;
const SCREEN_CSS_WIDTH = 800;
const SCREEN_CSS_HEIGHT = 600;
const SCREEN_HTML_SCALE = 0.0763;
const SCREEN_HTML_SCALE_MOBILE = 0.0685;
const SCREEN_CSS_POSITION: [number, number, number] = [-0.04, 0.24, 0];
const SCREEN_CSS_POSITION_MOBILE: [number, number, number] = [-0.035, 0.26, 0];

type ScreenTuning = {
  x: number;
  y: number;
  z: number;
  scale: number;
};

type CalibrationTarget = "desktop" | "mobile";

type ScreenDiagnostics = {
  screen?: { left: number; top: number; width: number; height: number; right: number; bottom: number };
  canvas?: { left: number; top: number; width: number; height: number; right: number; bottom: number };
  viewport: {
    innerWidth: number;
    innerHeight: number;
    visualWidth?: number;
    visualHeight?: number;
    visualOffsetTop?: number;
    visualOffsetLeft?: number;
    dpr: number;
  };
  browser: {
    isInstagram: boolean;
    isCriOS: boolean;
    isFxiOS: boolean;
    isBrave: boolean;
    userAgent: string;
  };
  target: CalibrationTarget;
  tuning: ScreenTuning;
};

const DEFAULT_DESKTOP_SCREEN_TUNING: ScreenTuning = {
  x: SCREEN_CSS_POSITION[0],
  y: SCREEN_CSS_POSITION[1],
  z: SCREEN_CSS_POSITION[2],
  scale: SCREEN_HTML_SCALE,
};

const DEFAULT_MOBILE_SCREEN_TUNING: ScreenTuning = {
  x: SCREEN_CSS_POSITION_MOBILE[0],
  y: SCREEN_CSS_POSITION_MOBILE[1],
  z: SCREEN_CSS_POSITION_MOBILE[2],
  scale: SCREEN_HTML_SCALE_MOBILE,
};

function getDefaultScreenTuning(target: CalibrationTarget) {
  return target === "desktop" ? DEFAULT_DESKTOP_SCREEN_TUNING : DEFAULT_MOBILE_SCREEN_TUNING;
}

function getScreenTuningStorageKey(target: CalibrationTarget) {
  return `oldmac-screen-${target}-tuning`;
}

function isScreenTuning(value: unknown): value is ScreenTuning {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScreenTuning>;
  return ["x", "y", "z", "scale"].every((key) => {
    const numericValue = candidate[key as keyof ScreenTuning];
    return typeof numericValue === "number" && Number.isFinite(numericValue);
  });
}

type CameraAnim = {
  startMs: number;
  durationMs: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
};

function CameraAnimator({
  controlsRef,
  animRef,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  animRef: React.MutableRefObject<CameraAnim | null>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;
    const now = performance.now();
    const tRaw = (now - anim.startMs) / anim.durationMs;
    const t = Math.min(1, Math.max(0, tRaw));
    // easeInOutQuad
    const k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    const target = new THREE.Vector3().lerpVectors(anim.fromTarget, anim.toTarget, k);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    } else {
      camera.lookAt(target);
    }
    if (t >= 1) {
      animRef.current = null;
    }
  });
  return null;
}

function Mouse3D({
  controlsRef,
  cursorUV,
  setCursorUV,
  canvasContainerRef,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  cursorUV: { u: number; v: number };
  setCursorUV: (uv: { u: number; v: number }) => void;
  canvasContainerRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const { camera } = useThree();
  const groupRef = React.useRef<THREE.Group | null>(null);
  const draggingRef = React.useRef(false);
  const plane = React.useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.9)); // y = -0.9 desk (negated in Plane)
  const raycaster = React.useRef(new THREE.Raycaster());
  const tmpVec2 = React.useRef(new THREE.Vector2());
  const bounds = React.useRef({ minX: -0.15, maxX: 1.45, minZ: -0.3, maxZ: 0.6 });

  React.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(1.35, -0.9, 0.3);
      // Face away from user, but keep upright
      groupRef.current.rotation.set(0, Math.PI, 0);
    }
  }, []);

  const projectToDesk = (clientX: number, clientY: number): THREE.Vector3 | null => {
    if (!canvasContainerRef.current) return null;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    tmpVec2.current.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    raycaster.current.setFromCamera(tmpVec2.current, camera);
    const hit = new THREE.Vector3();
    const ok = raycaster.current.ray.intersectPlane(plane.current, hit);
    return ok ? hit : null;
  };

  React.useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current || !groupRef.current) return;
      const p = projectToDesk(ev.clientX, ev.clientY);
      if (!p) return;
      // clamp to bounds
      p.x = Math.min(bounds.current.maxX, Math.max(bounds.current.minX, p.x));
      p.z = Math.min(bounds.current.maxZ, Math.max(bounds.current.minZ, p.z));
      p.y = -0.9;
      groupRef.current.position.copy(p);
      // Map to UV (roughly) across bounds
      const u = (p.x - bounds.current.minX) / (bounds.current.maxX - bounds.current.minX);
      const v = (p.z - bounds.current.minZ) / (bounds.current.maxZ - bounds.current.minZ);
      setCursorUV({ u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) });
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        if (controlsRef.current) controlsRef.current.enableRotate = true;
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [camera, controlsRef, setCursorUV, canvasContainerRef]);

  return (
    <group ref={groupRef}>
      {/* Base cube */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.3, 0.1, 0.2]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      {/* Drag the mouse body on the desk */}
      <mesh
        position={[0, 0.051, 0]}
        onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = true; if (controlsRef.current) controlsRef.current.enableRotate = false; }}
        onPointerUp={(e) => { e.stopPropagation(); draggingRef.current = false; if (controlsRef.current) controlsRef.current.enableRotate = true; }}
      >
        <boxGeometry args={[0.31, 0.012, 0.21]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {/* Left button */}
      <mesh
        position={[-0.09, 0.075, 0.07]}
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
          e.stopPropagation();
          const x = window.innerWidth * cursorUV.u;
          const y = window.innerHeight * (1 - cursorUV.v);
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          if (el) el.click();
        }}
      >
        <boxGeometry args={[0.07, 0.03, 0.06]} />
        <meshStandardMaterial color="#bbb" />
      </mesh>
      {/* Right button */}
      <mesh
        position={[0.09, 0.075, 0.07]}
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => {
          e.stopPropagation();
          const x = window.innerWidth * cursorUV.u;
          const y = window.innerHeight * (1 - cursorUV.v);
          const el = document.elementFromPoint(x, y) as HTMLElement | null;
          if (el) el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        }}
      >
        <boxGeometry args={[0.07, 0.03, 0.06]} />
        <meshStandardMaterial color="#bbb" />
      </mesh>
    </group>
  );
}


function MacGLBModel({ url, scale = 1, rotationY = 1, ...props }: { url: string; scale?: number; rotationY?: number } & ThreeElements["group"]) {
  const { scene } = useGLTF(url);
  return (
    <group position={[0, -0.25, 0]} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]} {...props}>
      <primitive object={scene} />
    </group>
  );
}

function CameraStateCapture({
  controlsRef,
  camPosRef,
  camTargetRef,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  camPosRef: React.MutableRefObject<THREE.Vector3>;
  camTargetRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    camPosRef.current.copy(camera.position);
    const tgt = controlsRef.current ? controlsRef.current.target : new THREE.Vector3(...CAMERA_START_TARGET);
    camTargetRef.current.copy(tgt);
  });
  return null;
}

// ScreenTexturePlane reverted

export default function OldMac3D({ children }: { children?: React.ReactNode }) {
  const SCREEN_W = .86 * 67;
  const SCREEN_H = 0.5 * 67;
  
  const modelRef = React.useRef<THREE.Group | null>(null);
  const screenRef = React.useRef<THREE.Group | null>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const animRef = React.useRef<CameraAnim | null>(null);
  const camPosRef = React.useRef(new THREE.Vector3(...CAMERA_START_POS));
  const camTargetRef = React.useRef(new THREE.Vector3(...CAMERA_START_TARGET));
  const viewportRef = React.useRef<{ aspect: number; fovDeg: number }>({ aspect: 1, fovDeg: CAMERA_START_FOV });
  const [hoveringMac, setHoveringMac] = React.useState(false);
  const [tooltipHover, setTooltipHover] = React.useState(false);
  const [mouse, setMouse] = React.useState<{ x: number; y: number } | null>(null);
  // Cursor state in UV (0..1, 0..1) on the screen
  const [cursorUV, setCursorUV] = React.useState<{u:number; v:number}>({ u: 0.5, v: 0.5 });
  // Dragging pad state
  const draggingPadRef = React.useRef(false);
  const isMobileRef = React.useRef(false);
  const [isMobileScene, setIsMobileScene] = React.useState(false);
  const [isCalibratingScreen, setIsCalibratingScreen] = React.useState(false);
  const [calibrationTarget, setCalibrationTarget] = React.useState<CalibrationTarget>("desktop");
  const [screenTuning, setScreenTuning] = React.useState<ScreenTuning>(DEFAULT_DESKTOP_SCREEN_TUNING);
  const [screenDiagnostics, setScreenDiagnostics] = React.useState<ScreenDiagnostics | null>(null);
  const canvasContainerRef = React.useRef<HTMLDivElement>(null);
  const clickDataRef = React.useRef<{ down: boolean; x: number; y: number; t: number }>({ down: false, x: 0, y: 0, t: 0 });

  // Cursor texture (SVG)
  // const cursorTexture = useLoader(TextureLoader, '/cursor-light.svg');
  const startResetAnimation = React.useCallback(() => {
    // Kick off camera + target interpolation
    const fromPos = camPosRef.current.clone();
    const fromTarget = camTargetRef.current.clone();
    // Compute screen world position and normal from the actual group
    const toTarget = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    if (screenRef.current) {
      screenRef.current.getWorldPosition(toTarget);
      screenRef.current.getWorldQuaternion(worldQuat);
    } else {
      toTarget.set(
        MODEL_POS[0] + SCREEN_OFFSET[0],
        MODEL_POS[1] + SCREEN_OFFSET[1],
        MODEL_POS[2] + SCREEN_OFFSET[2]
      );
      worldQuat.setFromEuler(new THREE.Euler(SCREEN_ROT_X, SCREEN_ROT_Y, SCREEN_ROT_Z, "XYZ"));
    }
    // Raise target slightly upward in screen's local up direction
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuat).normalize();
    toTarget.add(up.multiplyScalar(VIEW_TARGET_Y_OFFSET));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat).normalize();
    // Compute world size of the screen plane (include model scale)
    const screenWidthWorld = SCREEN_W * SCREEN_SCALE * MODEL_SCALE;
    const screenHeightWorld = SCREEN_H * SCREEN_SCALE * MODEL_SCALE;
    // Fit distance based on camera FOV and aspectZOOM_MIN_DISTANCE
    const aspect = viewportRef.current.aspect || 1;
    const fovRad = (viewportRef.current.fovDeg || CAMERA_START_FOV) * Math.PI / 180;
    const h = screenHeightWorld;
    const w = screenWidthWorld;
    const distV = (h / 2) / Math.tan(fovRad / 2);
    const fovHRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
    const distH = (w / 2) / Math.tan(fovHRad / 2);
    let base;
    switch (VIEW_FIT_MODE) {
      case "height": base = distV; break;
      case "width": base = distH; break;
      case "min": base = Math.min(distV, distH); break;
      case "max": default: base = Math.max(distV, distH); break;
    }
    const isMobile = typeof window !== "undefined" && (window.innerWidth <= 820 || matchMedia("(pointer: coarse)").matches);
    const margin = (isMobile ? VIEW_FIT_MARGIN_MOBILE : VIEW_FIT_MARGIN) * VIEW_FIT_EXTRA_SCALE;
    let fitDistance = base * margin + VIEW_FIT_OFFSET;
    fitDistance = Math.min(Math.max(fitDistance, VIEW_FIT_CLAMP[0]), VIEW_FIT_CLAMP[1]);
    const toPos = new THREE.Vector3().copy(toTarget).add(new THREE.Vector3().copy(normal).multiplyScalar(fitDistance));
    animRef.current = {
      startMs: performance.now(),
      durationMs: VIEW_RESET_MS,
      fromPos,
      toPos,
      fromTarget,
      toTarget,
    };
  }, [SCREEN_W, SCREEN_H]);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calibrationParam = params.get("calibrateScreen");
    const calibrationEnabled = calibrationParam === "1" || calibrationParam === "desktop" || calibrationParam === "mobile";
    setIsCalibratingScreen(calibrationEnabled);
    if (!calibrationEnabled) return;

    const target: CalibrationTarget =
      calibrationParam === "desktop" || calibrationParam === "mobile"
        ? calibrationParam
        : window.innerWidth <= 820 || matchMedia("(pointer: coarse)").matches
          ? "mobile"
          : "desktop";
    setCalibrationTarget(target);

    const stored = window.localStorage.getItem(getScreenTuningStorageKey(target));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setScreenTuning(isScreenTuning(parsed) ? parsed : getDefaultScreenTuning(target));
      } catch {
        setScreenTuning(getDefaultScreenTuning(target));
      }
    } else {
      setScreenTuning(getDefaultScreenTuning(target));
    }
  }, []);

  React.useEffect(() => {
    if (!isCalibratingScreen) return;
    window.localStorage.setItem(getScreenTuningStorageKey(calibrationTarget), JSON.stringify(screenTuning));
    (window as typeof window & { __oldMacScreenTuning?: ScreenTuning }).__oldMacScreenTuning = screenTuning;
  }, [calibrationTarget, isCalibratingScreen, screenTuning]);

  React.useEffect(() => {
    if (!isCalibratingScreen) return;

    const toRect = (element: Element | null) => {
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };

    const collectDiagnostics = () => {
      const userAgent = navigator.userAgent;
      setScreenDiagnostics({
        screen: toRect(document.querySelector(".model-screen-html")),
        canvas: toRect(document.querySelector("canvas")),
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          visualWidth: window.visualViewport?.width,
          visualHeight: window.visualViewport?.height,
          visualOffsetTop: window.visualViewport?.offsetTop,
          visualOffsetLeft: window.visualViewport?.offsetLeft,
          dpr: window.devicePixelRatio || 1,
        },
        browser: {
          isInstagram: /Instagram/i.test(userAgent),
          isCriOS: /CriOS/i.test(userAgent),
          isFxiOS: /FxiOS/i.test(userAgent),
          isBrave: (navigator as Navigator & { brave?: unknown }).brave !== undefined || /Brave/i.test(userAgent),
          userAgent,
        },
        target: calibrationTarget,
        tuning: screenTuning,
      });
    };

    collectDiagnostics();
    const frame = window.setInterval(collectDiagnostics, 500);
    window.addEventListener("resize", collectDiagnostics);
    window.visualViewport?.addEventListener("resize", collectDiagnostics);
    window.visualViewport?.addEventListener("scroll", collectDiagnostics);

    return () => {
      window.clearInterval(frame);
      window.removeEventListener("resize", collectDiagnostics);
      window.visualViewport?.removeEventListener("resize", collectDiagnostics);
      window.visualViewport?.removeEventListener("scroll", collectDiagnostics);
    };
  }, [calibrationTarget, isCalibratingScreen, screenTuning]);

  React.useEffect(() => {
    const updateMobileScene = () => {
      const mobile = typeof window !== "undefined" && (
        window.innerWidth <= 820 ||
        matchMedia("(pointer: coarse)").matches ||
        (window.devicePixelRatio || 1) >= 2
      );
      isMobileRef.current = mobile;
      setIsMobileScene(mobile);
    };

    updateMobileScene();
    window.addEventListener("resize", updateMobileScene);
    window.addEventListener("orientationchange", updateMobileScene);

    return () => {
      window.removeEventListener("resize", updateMobileScene);
      window.removeEventListener("orientationchange", updateMobileScene);
    };
  }, []);

  const normalScreenTuning = isMobileScene ? DEFAULT_MOBILE_SCREEN_TUNING : DEFAULT_DESKTOP_SCREEN_TUNING;
  const activeScreenTuning = isCalibratingScreen ? screenTuning : normalScreenTuning;
  const screenPosition = [activeScreenTuning.x, activeScreenTuning.y, activeScreenTuning.z] as [number, number, number];
  const screenScale = activeScreenTuning.scale;
  return (
    <div className="r3f-wrap" ref={canvasContainerRef} onPointerMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_START_POS, fov: CAMERA_START_FOV }}
        onCreated={({ camera, size }) => {
          viewportRef.current = { aspect: size.width / size.height, fovDeg: (camera as THREE.PerspectiveCamera).fov };
        }}
      >
        {/* Lights */}
        <hemisphereLight intensity={0.5} groundColor="#b6b2a9" />
        <directionalLight
          castShadow
          position={[4, 6, 4]}
          intensity={1.15}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        {/* Model + Screen grouped for relative positioning */}
        <group position={MODEL_POS}>
          {/* Model with its rotation and offset from screen */}
          <group 
            ref={modelRef}
            position={(() => {
              // Convert model offset from model's local space to world space
              const offset = new THREE.Vector3(MODEL_OFFSET_X, MODEL_OFFSET_Y, MODEL_OFFSET_Z);
              const rotationMatrix = new THREE.Matrix4().makeRotationY(-Math.PI/2);
              offset.applyMatrix4(rotationMatrix);
              return [offset.x, offset.y, offset.z] as [number, number, number];
            })()}
            rotation={[0, -Math.PI/2, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHoveringMac(true); }}
            onPointerOut={() => { setHoveringMac(false); }}
            onPointerMove={(e) => { setMouse({ x: e.clientX, y: e.clientY }); }}
            onPointerDown={(e) => {
              const btn = (e as unknown as PointerEvent).button;
              if (typeof btn === 'number' && btn !== 0) return; // left click only
              clickDataRef.current = { down: true, x: e.clientX, y: e.clientY, t: performance.now() };
            }}
            onPointerUp={(e) => {
              if (!clickDataRef.current.down) return;
              const dx = e.clientX - clickDataRef.current.x;
              const dy = e.clientY - clickDataRef.current.y;
              const dt = performance.now() - clickDataRef.current.t;
              clickDataRef.current.down = false;
              const moved = Math.hypot(dx, dy);
              if (moved < 6 && dt < 300) {
                e.stopPropagation();
                setHoveringMac(false);
                startResetAnimation();
              }
            }}
          >
            <MacGLBModel url="/comp2.glb" scale={MODEL_SCALE} rotationY={0} />
          </group>

          {/* Screen marker - just tracks 3D position, no Html component */}
          <group 
            ref={screenRef} 
            position={[0, 0, 0]}
            rotation={[SCREEN_ROT_X, SCREEN_ROT_Y, SCREEN_ROT_Z]}
          >
            {/* Invisible marker at screen center */}
            <mesh visible={false}>
              <boxGeometry args={[0.01, 0.01, 0.01]} />
            </mesh>

            <Html
              transform
              center
              position={screenPosition}
              scale={screenScale}
              zIndexRange={[100, 0]}
            >
              <div
                className="model-screen-html"
                style={{
                  width: `${SCREEN_CSS_WIDTH}px`,
                  height: `${SCREEN_CSS_HEIGHT}px`,
                  pointerEvents: "auto",
                }}
              >
                <div
                  className="embedded-screen model-screen"
                  style={{ width: `${SCREEN_CSS_WIDTH}px`, height: `${SCREEN_CSS_HEIGHT}px`, position: "relative" }}
                >
                  {children}
                </div>
              </div>
            </Html>
          </group>
        </group>

        {/* Ground shadows */}
        <ContactShadows position={[0, -0.95, 0]} opacity={0.35} scale={8} blur={2.5} far={4} />

        {/* Controls */}
        <OrbitControls
          makeDefault
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          enableZoom
          // prevent screen from tearing by limiting rotation closely
          rotateSpeed={0.8}
          target={[
            MODEL_POS[0] + CONTROLS_TARGET_OFFSET[0],
            MODEL_POS[1] + CONTROLS_TARGET_OFFSET[1],
            MODEL_POS[2] + CONTROLS_TARGET_OFFSET[2],
          ]}
          minDistance={ZOOM_MIN_DISTANCE}
          maxDistance={ZOOM_MAX_DISTANCE}
          minAzimuthAngle={ORBIT_AZIMUTH_MIN}
          maxAzimuthAngle={ORBIT_AZIMUTH_MAX}
          minPolarAngle={ORBIT_POLAR_MIN}
          maxPolarAngle={ORBIT_POLAR_MAX}
          screenSpacePanning={false}
        />

        {/* Retro 3D mouse - disabled */}
        {/**
         * <Mouse3D
         *   controlsRef={controlsRef}
         *   cursorUV={cursorUV}
         *   setCursorUV={setCursorUV}
         *   canvasContainerRef={canvasContainerRef}
         * />
         */}

        {/* Camera animation driver */}
        <CameraAnimator controlsRef={controlsRef} animRef={animRef} />
        <CameraStateCapture 
          controlsRef={controlsRef} 
          camPosRef={camPosRef} 
          camTargetRef={camTargetRef} 
        />
        
      </Canvas>

      {/* Retro mouse controller - disabled */}
      {/**
       * {uiMounted && (
       *   <div
       *     style={{
       *       position: 'absolute',
       *       right: matchMedia('(pointer: coarse)').matches ? '50%' : '16px',
       *       bottom: matchMedia('(pointer: coarse)').matches ? '8%' : '16px',
       *       transform: matchMedia('(pointer: coarse)').matches ? 'translateX(50%)' : 'none',
       *       display: 'flex', gap: 12, alignItems: 'center', zIndex: 20,
       *       pointerEvents: 'auto',
       *       userSelect: 'none',
       *     }}
       *   >
       *     <button type="button"
       *       onPointerDown={(e)=>{e.preventDefault();}}
       *       onClick={()=>{
       *         const el = document.elementFromPoint(window.innerWidth*cursorUV.u, window.innerHeight*(1-cursorUV.v)) as HTMLElement | null;
       *         if (el) el.click();
       *       }}
       *     >L</button>
       *     <div
       *       onPointerDown={(e)=>{ draggingPadRef.current = true; controlsRef.current && (controlsRef.current.enableRotate = false); }}
       *       onPointerUp={(e)=>{ draggingPadRef.current = false; controlsRef.current && (controlsRef.current.enableRotate = true); }}
       *       onPointerMove={(e)=>{
       *         if (!draggingPadRef.current) return;
       *         const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
       *         const u = Math.min(1, Math.max(0, (e.clientX - rect.left)/rect.width));
       *         const v = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top)/rect.height));
       *         setCursorUV({ u, v });
       *       }}
       *       style={{ width: 200, height: 140, background: '#222', border: '2px solid #555' }}
       *     />
       *     <button type="button"
       *       onPointerDown={(e)=>{e.preventDefault();}}
       *       onClick={()=>{
       *         const el = document.elementFromPoint(window.innerWidth*cursorUV.u, window.innerHeight*(1-cursorUV.v)) as HTMLElement | null;
       *         if (el) el.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true }));
       *       }}
       *     >R</button>
       *   </div>
       * )}
       */}

      {/* CRT cursor overlay removed */}

      {isCalibratingScreen && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: 10000,
            width: "min(360px, calc(100vw - 24px))",
            padding: 12,
            background: "rgba(8, 8, 10, 0.92)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,.35)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            pointerEvents: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <strong>Screen calibration</strong>
            <button
              type="button"
              onClick={() => setScreenTuning(DEFAULT_MOBILE_SCREEN_TUNING)}
              style={{ font: "inherit", color: "#fff", background: "transparent", border: "1px solid #777" }}
            >
              reset
            </button>
          </div>
          {([
            ["x", -0.16, 0.08, 0.005],
            ["y", 0.24, 0.56, 0.005],
            ["scale", 0.064, 0.078, 0.0005],
          ] as const).map(([key, min, max, step]) => (
            <label key={key} style={{ display: "grid", gridTemplateColumns: "52px 1fr 64px", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span>{key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={screenTuning[key]}
                onInput={(event) => {
                  const value = Number(event.currentTarget.value);
                  setScreenTuning((current) => ({ ...current, [key]: value }));
                }}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  setScreenTuning((current) => ({ ...current, [key]: value }));
                }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={screenTuning[key]}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isFinite(value)) setScreenTuning((current) => ({ ...current, [key]: value }));
                }}
                style={{ width: "100%", font: "inherit" }}
              />
            </label>
          ))}
          <div style={{ marginTop: 10, opacity: 0.8 }}>
            {`position=[${screenTuning.x.toFixed(3)}, ${screenTuning.y.toFixed(3)}, ${screenTuning.z.toFixed(3)}] scale=${screenTuning.scale.toFixed(4)}`}
          </div>
          <div style={{ marginTop: 6, opacity: 0.65 }}>
            Mobile values only. Desktop uses its separate constants outside calibration mode.
          </div>
          {screenDiagnostics && (
            <textarea
              readOnly
              value={JSON.stringify(screenDiagnostics, null, 2)}
              style={{
                width: "100%",
                height: 92,
                marginTop: 8,
                padding: 6,
                resize: "vertical",
                font: "inherit",
                color: "#fff",
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.28)",
              }}
            />
          )}
        </div>
      )}

      {/* Tooltip overlay */}
      {(hoveringMac || tooltipHover) && mouse && (
        <button
          type="button"
          className="view-tooltip"
          onClick={() => {
            setHoveringMac(false);
            startResetAnimation();
          }}
          onMouseEnter={() => setTooltipHover(true)}
          onMouseLeave={() => setTooltipHover(false)}
          style={{ left: mouse.x, top: mouse.y }}
        >
          View Screen
        </button>
      )}
    </div>
  );
}
