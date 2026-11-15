"use client";

import { useEffect, useRef } from "react";
import { deskOutline } from "./deskView";
import { readStoredSetting } from "./FullscreenContext";
import { HARDWARE_STORAGE_KEY, hardwareProfile } from "./hardwareProfiles";

/** Screen pixels per cell, close to the 3D warp's cells on a 2x display. */
const CELL = 4;
/** A cached scene is up within this time, so the placeholder never flashes on a fast load. */
const DELAY_MS = 280;
const RAMP_MS = 900;
/** The desk as the studio lights render it, for each finish. */
const LIT = { classic: [227, 220, 205], laptop: [227, 220, 205], rgb: [90, 92, 98] } as const;
const BLUE = [92, 189, 255];

/**
 * The desk half-forming out of blue cells, drawn in 2D while the 3D code and the first model
 * are still downloading. It stands exactly where the real desk will (same camera maths), so
 * the WebGL scene takes over the same shimmer and carries it through to the warp-in.
 * Reduced motion draws nothing: the scene then simply appears.
 */
export default function FormingDesk() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceEffects === "true") return;
    const lit = LIT[hardwareProfile(readStoredSetting(HARDWARE_STORAGE_KEY)).id];
    let cols = 0, rows = 0, mask = new Float32Array(0), image: ImageData | null = null;
    const layout = () => {
      const width = window.innerWidth, height = window.innerHeight, quad = deskOutline(width, height);
      cols = Math.ceil(width / CELL); rows = Math.ceil(height / CELL);
      canvas.width = cols; canvas.height = rows;
      image = context.createImageData(cols, rows);
      // Per cell: a fixed random threshold inside the desk's outline, -1 outside it.
      mask = new Float32Array(cols * rows).fill(-1);
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const x = (col + .5) * CELL, y = (row + .5) * CELL;
        const inside = quad.every(([ax, ay], i) => { const [bx, by] = quad[(i + 1) % 4]; return (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0; });
        if (inside) { const hash = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453; mask[row * cols + col] = hash - Math.floor(hash); }
      }
    };
    const started = performance.now();
    const draw = () => {
      const now = performance.now(), age = now - started - DELAY_MS;
      if (age <= 0 || !image) return;
      // Tells the scene to pick up fully formed instead of starting its own ramp.
      document.documentElement.dataset.deskForming = "1";
      const ramp = Math.min(1, age / RAMP_MS), progress = ramp * ramp * (3 - 2 * ramp) * (.4 + .05 * Math.sin(now / 380)), data = image.data;
      for (let i = 0; i < mask.length; i++) {
        const threshold = mask[i], shown = threshold >= 0 && threshold <= progress, edge = shown ? Math.max(0, 1 - (progress - threshold) / .1) : 0;
        for (let channel = 0; channel < 3; channel++) data[i * 4 + channel] = Math.min(255, lit[channel] * .68 + BLUE[channel] * (.32 + edge));
        data[i * 4 + 3] = shown ? 255 : 0;
      }
      context.putImageData(image, 0, 0);
    };
    layout();
    const timer = window.setInterval(draw, 50);
    window.addEventListener("resize", layout);
    return () => { window.clearInterval(timer); window.removeEventListener("resize", layout); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated", pointerEvents: "none" }} />;
}
