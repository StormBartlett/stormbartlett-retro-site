"use client";

import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as React from "react";
import * as THREE from "three";
import { RetroKeyboard, RetroMouse } from "./RetroHardware";
import { useIsMobileViewport } from "./FullscreenContext";

const MODEL_POSITION: [number, number, number] = [0, 0, -0.92];
const MODEL_ROTATION: [number, number, number] = [0, -Math.PI / 2, 0];

const CAMERA_START_POS: [number, number, number] = [0, 1, 7];
const CAMERA_START_TARGET: [number, number, number] = [0.3, -0.2, 0.4];
const CAMERA_FOV = 24;
const VIEW_RESET_MS = 900;
const VIEW_FIT_MARGIN = 1.08; // breathing room around the screen in "View Screen"

// Orbit limits relative to the target. The polar range still looks down onto the keyboard.
const ORBIT_AZIMUTH_LIMIT = Math.PI / 10;
const ORBIT_POLAR_MIN = Math.PI / 4.2;
const ORBIT_POLAR_MAX = Math.PI / 2.1;
const ZOOM_MIN_DISTANCE = 2;
const ZOOM_MAX_DISTANCE = 30;

// The one screen placement, shared by every browser and device. Tune here.
const SCREEN_ROTATION: [number, number, number] = [-Math.PI / 30, 0, 0];
const SCREEN_POSITION: [number, number, number] = [-0.035, 0.26, 0];
const SCREEN_HTML_SCALE = 0.0685;
const SCREEN_CSS_WIDTH = 800;
const SCREEN_CSS_HEIGHT = 600;
// drei's <Html transform> maps 40 CSS px to one world unit at scale 1 (default distanceFactor).
const SCREEN_WORLD_WIDTH = (SCREEN_CSS_WIDTH * SCREEN_HTML_SCALE) / 40;
const SCREEN_WORLD_HEIGHT = (SCREEN_CSS_HEIGHT * SCREEN_HTML_SCALE) / 40;

type CameraAnim = {
  startMs: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
};

function CameraAnimator({
  controlsRef,
  animRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  animRef: React.RefObject<CameraAnim | null>;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const target = React.useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const anim = animRef.current;
    if (!anim) return;
    const t = Math.min(1, Math.max(0, (performance.now() - anim.startMs) / VIEW_RESET_MS));
    const k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad

    camera.position.lerpVectors(anim.fromPos, anim.toPos, k);
    target.lerpVectors(anim.fromTarget, anim.toTarget, k);
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    } else {
      camera.lookAt(target);
    }
    if (t >= 1) animRef.current = null;
    // The canvas only renders on demand, so each animated frame requests the next.
    invalidate();
  });
  return null;
}

function MacGLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const invalidate = useThree((state) => state.invalidate);
  React.useEffect(() => {
    scene.traverse(object => { if(object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
    invalidate();
  }, [invalidate, scene]);
  return (
    <group position={[0, -0.25, 0]}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Empty DOM target for the desktop host owned by page.tsx. The host is a child
 * of the page's React tree, so its events reach React through the document and
 * none of this nested Html root's React handlers ever see them.
 */
function ScreenSlot({
  onSlot,
  onMounted,
  tapRef,
}: {
  onSlot: (slot: HTMLElement) => void;
  onMounted: () => void;
  tapRef: React.RefObject<(() => void) | undefined>;
}) {
  const slotRef = React.useRef<HTMLDivElement>(null!);

  React.useLayoutEffect(() => {
    onSlot(slotRef.current);
    // drei's first frame can run before this root commits. In demand mode it
    // would then never get another chance to apply the CSS transform.
    onMounted();
  }, [onSlot, onMounted]);

  React.useEffect(() => {
    const slot = slotRef.current;
    const onClick = (event: MouseEvent) => {
      const tap = tapRef.current;
      if (!tap) return;
      // Capture phase: the tap changes view and must not also activate what is beneath it.
      event.preventDefault();
      event.stopPropagation();
      tap();
    };
    slot.addEventListener("click", onClick, true);
    return () => slot.removeEventListener("click", onClick, true);
  }, [tapRef]);

  return (
    <div
      className="model-screen-html"
      style={{ width: SCREEN_CSS_WIDTH, height: SCREEN_CSS_HEIGHT, position: "relative", pointerEvents: "auto" }}
    >
      <div
        ref={slotRef}
        className="embedded-screen model-screen"
        style={{ width: SCREEN_CSS_WIDTH, height: SCREEN_CSS_HEIGHT, position: "relative" }}
      />
    </div>
  );
}

function ScreenAnchor({
  groupRef,
  portalRef,
  onSlot,
  tapRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  portalRef: React.RefObject<HTMLDivElement>;
  onSlot: (slot: HTMLElement) => void;
  tapRef: React.RefObject<(() => void) | undefined>;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const requestFrame = React.useCallback(() => invalidate(), [invalidate]);

  return (
    <group ref={groupRef} rotation={SCREEN_ROTATION}>
      <Html transform center portal={portalRef} position={SCREEN_POSITION} scale={SCREEN_HTML_SCALE} zIndexRange={[100, 0]}>
        <ScreenSlot onSlot={onSlot} onMounted={requestFrame} tapRef={tapRef} />
      </Html>
    </group>
  );
}

export default function OldMac3D({
  onScreenSlot,
  onScreenTap,
}: {
  /** Receives the DOM element on the 3D screen that the desktop host should be placed in. */
  onScreenSlot: (slot: HTMLElement) => void;
  /** When set, a tap on the screen calls this instead of reaching the screen's content. */
  onScreenTap?: () => void;
}) {
  const isMobile = useIsMobileViewport();
  const screenRef = React.useRef<THREE.Group | null>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const animRef = React.useRef<CameraAnim | null>(null);
  const getStateRef = React.useRef<(() => RootState) | null>(null);
  const clickRef = React.useRef({ down: false, x: 0, y: 0, t: 0 });
  const tooltipRef = React.useRef<HTMLButtonElement | null>(null);
  // Orbit and R3F listen only on the event source. The screen overlay is its
  // sibling, so pointer events on the screen never reach them and need no stopping.
  const eventSourceRef = React.useRef<HTMLDivElement>(null!);
  const screenOverlayRef = React.useRef<HTMLDivElement>(null!);
  const tapRef = React.useRef(onScreenTap);
  const [deskVersion, setDeskVersion] = React.useState(0);
  const hardwareInteraction = React.useCallback((active: boolean) => {
    animRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = !active;
  }, []);
  const [hoveringMac, setHoveringMac] = React.useState(false);
  const [tooltipHover, setTooltipHover] = React.useState(false);
  const [tooltipPoint, setTooltipPoint] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    tapRef.current = onScreenTap;
  }, [onScreenTap]);

  const startResetAnimation = React.useCallback(() => {
    const getState = getStateRef.current;
    const screen = screenRef.current;
    if (!getState || !screen) return;
    const { camera, size, invalidate } = getState();

    screen.updateWorldMatrix(true, false);
    const toTarget = screen.localToWorld(new THREE.Vector3(...SCREEN_POSITION));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));

    // Distance at which the whole screen fits the current viewport, portrait included.
    const tanHalfFov = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    const fitHeight = SCREEN_WORLD_HEIGHT / 2 / tanHalfFov;
    const fitWidth = SCREEN_WORLD_WIDTH / 2 / (tanHalfFov * (size.width / size.height));
    const distance = THREE.MathUtils.clamp(
      Math.max(fitHeight, fitWidth) * VIEW_FIT_MARGIN,
      ZOOM_MIN_DISTANCE,
      ZOOM_MAX_DISTANCE
    );

    animRef.current = {
      startMs: performance.now(),
      fromPos: camera.position.clone(),
      toPos: toTarget.clone().addScaledVector(normal, distance),
      fromTarget: controlsRef.current?.target.clone() ?? new THREE.Vector3(...CAMERA_START_TARGET),
      toTarget,
    };
    invalidate();
  }, []);

  return (
    <div className="r3f-wrap">
      <div ref={eventSourceRef} style={{ position: "absolute", inset: 0 }}>
        <Canvas
          frameloop="demand"
          shadows
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          eventSource={eventSourceRef}
          camera={{ position: CAMERA_START_POS, fov: CAMERA_FOV }}
          onCreated={(state) => {
            getStateRef.current = state.get;
          }}
        >
          <hemisphereLight intensity={0.5} groundColor="#b6b2a9" />
          <directionalLight castShadow position={[4, 6, 4]} intensity={1.15} shadow-mapSize={[1024,1024]} shadow-bias={-0.0003} />

          {/* One boundary: the shadow's single baked frame must include the model. */}
          <React.Suspense fallback={null}>
            <group
              position={MODEL_POSITION}
              rotation={MODEL_ROTATION}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (isMobile || e.buttons !== 0) return;
                setTooltipPoint({ x: e.clientX, y: e.clientY });
                setHoveringMac(true);
              }}
              onPointerOut={() => setHoveringMac(false)}
              onPointerMove={(e) => {
                // Moved directly: a state update per pointer move would re-render the whole scene.
                if (!tooltipRef.current) return;
                tooltipRef.current.style.left = `${e.clientX}px`;
                tooltipRef.current.style.top = `${e.clientY}px`;
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                clickRef.current = { down: true, x: e.clientX, y: e.clientY, t: performance.now() };
              }}
              onPointerUp={(e) => {
                const click = clickRef.current;
                if (!click.down) return;
                click.down = false;
                if (Math.hypot(e.clientX - click.x, e.clientY - click.y) < 6 && performance.now() - click.t < 300) {
                  e.stopPropagation();
                  setHoveringMac(false);
                  startResetAnimation();
                }
              }}
            >
              <MacGLBModel url="/comp2.glb" />
            </group>

          </React.Suspense>

          <mesh receiveShadow position={[0.4, -1.53, 0.2]}>
            <boxGeometry args={[6.6, 0.1, 5.2]}/>
            <meshStandardMaterial color="#b6ad98" roughness={0.92}/>
          </mesh>
          <RetroKeyboard key={`keyboard-${deskVersion}`} position={[-0.1,-1.47,1.4]} onInteractionChange={hardwareInteraction}/>
          <RetroMouse key={`mouse-${deskVersion}`} position={[1.75,-1.47,1.7]} onInteractionChange={hardwareInteraction}/>

          {/* Outside Suspense: the desktop is usable before the GLB has finished loading. */}
          <ScreenAnchor groupRef={screenRef} portalRef={screenOverlayRef} onSlot={onScreenSlot} tapRef={tapRef} />

          <OrbitControls
            makeDefault
            ref={controlsRef}
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            enableZoom
            rotateSpeed={0.8}
            target={CAMERA_START_TARGET}
            minDistance={ZOOM_MIN_DISTANCE}
            maxDistance={ZOOM_MAX_DISTANCE}
            minAzimuthAngle={-ORBIT_AZIMUTH_LIMIT}
            maxAzimuthAngle={ORBIT_AZIMUTH_LIMIT}
            minPolarAngle={ORBIT_POLAR_MIN}
            maxPolarAngle={ORBIT_POLAR_MAX}
            onStart={() => {
              animRef.current = null;
            }}
          />

          <SceneFraming controlsRef={controlsRef}/>
          <CameraAnimator controlsRef={controlsRef} animRef={animRef} />
        </Canvas>
      </div>

      <div ref={screenOverlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div className="hardware-hint"><span>Drag or throw the hardware. The mouse controls the screen; keys really type.</span><button onClick={() => setDeskVersion(v => v + 1)}>Reset desk</button></div>

      {!isMobile && (hoveringMac || tooltipHover) && (
        <button
          ref={tooltipRef}
          type="button"
          className="view-tooltip"
          onClick={() => {
            setHoveringMac(false);
            startResetAnimation();
          }}
          onMouseEnter={() => setTooltipHover(true)}
          onMouseLeave={() => setTooltipHover(false)}
          style={{ left: tooltipPoint.x, top: tooltipPoint.y }}
        >
          View Screen
        </button>
      )}
    </div>
  );
}

/** Fit the whole workstation at phone aspect ratios without device-specific screen calibration. */
function SceneFraming({controlsRef}: {controlsRef: React.RefObject<OrbitControlsImpl | null>}) {
  const {camera, size, invalidate} = useThree();
  React.useEffect(() => {
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
    const distance = Math.max(8.5, 4.8 / (2 * tanHalfFov * (size.width / size.height)));
    camera.position.set(CAMERA_START_TARGET[0], CAMERA_START_TARGET[1] + distance * 0.19, CAMERA_START_TARGET[2] + distance);
    controlsRef.current?.target.set(...CAMERA_START_TARGET);
    controlsRef.current?.update();
    camera.lookAt(...CAMERA_START_TARGET);
    invalidate();
  }, [camera, size.width, size.height, controlsRef, invalidate]);
  return null;
}
