"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Html, useGLTF } from "@react-three/drei";
import * as React from "react";

// Tweak points
const MODEL_ROT_Y = 0; // rotate around Y (radians). e.g. Math.PI * 0.5 = 90°
const MODEL_SCALE = 3; // overall model size
const SCREEN_ROT_Y = 0; // independent screen rotation (Y)
const SCREEN_SCALE = .31 ; // independent screen size multiplier
const MODEL_POS: [number, number, number] = [0, 0, 0]; // move whole model in world space
const SCREEN_OFFSET: [number, number, number] = [-.3, 0.53, -0.05]; // screen relative to model origin
const CONTROLS_TARGET_OFFSET: [number, number, number] = [0, 0.0, 0.0]; // orbit focus relative to model

function MacGLBModel({ url, scale = 1, rotationY = 1 }: { url: string; scale?: number; rotationY?: number }) {
  const { scene } = useGLTF(url);
  return (
    <group position={[0, -0.25, 0]} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <primitive object={scene} />
    </group>
  );
}

export default function OldMac3D({ children }: { children?: React.ReactNode }) {
  // Estimate the GLB screen size (tune as needed to fit cutout)
  const SCREEN_POS: [number, number, number] = SCREEN_OFFSET;
  const SCREEN_W = 0.66 * 100;
  const SCREEN_H = 0.48 * 100;
  const UI_W = 900; // px
  const UI_H = 600; // px (4:3)
  const scaleX = (SCREEN_W * SCREEN_SCALE) / UI_W;
  const scaleY = (SCREEN_H * SCREEN_SCALE) / UI_H;
  return (
    <div className="r3f-wrap">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0.15, 0.18, 0.95], fov: 24 }}>
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
          <MacGLBModel url="/computer.glb" scale={MODEL_SCALE} rotationY={MODEL_ROT_Y} />

          {/* Mount the OS into the screen (relative to model) */}
          <group position={SCREEN_POS} rotation={[0, SCREEN_ROT_Y, 0]}>
            <Html transform scale={[scaleX, scaleY, 1]} style={{ pointerEvents: "auto" }}>
              <div className="embedded-screen" style={{ width: UI_W, height: UI_H }}>
                {children}
              </div>
            </Html>
          </group>
        </group>

        {/* Ground shadows */}
        <ContactShadows position={[0, -0.95, 0]} opacity={0.35} scale={8} blur={2.5} far={4} />

        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan
          enableZoom
          target={[
            MODEL_POS[0] + CONTROLS_TARGET_OFFSET[0],
            MODEL_POS[1] + CONTROLS_TARGET_OFFSET[1],
            MODEL_POS[2] + CONTROLS_TARGET_OFFSET[2],
          ]}
          minDistance={0.35}
          maxDistance={6}
          maxPolarAngle={Math.PI / 2.05}
          screenSpacePanning
        />
      </Canvas>
    </div>
  );
}


