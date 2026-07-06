"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Full-bleed vertical "matrix rain" background.
 * Designed to sit BEHIND the 3D Mac in model view (z-index < 0, transparent
 * R3F canvas on top). Performant: single fillRect trail fade, capped DPR,
 * pauses when the tab is hidden.
 *
 * Defaults below are the settings tuned in the standalone studio:
 *   rainbow · mixed charset · speed 0.15 · font 14 · density 1 · trail 0.025
 *   opacity 0.8 · variance 0.5 · flicker 0.02 · glow 8 · vertical gradient on
 */

export type MatrixColorMode = "green" | "rainbow" | "custom";

export type MatrixBackgroundProps = {
  enabled?: boolean;
  /** "green" | "rainbow" | "custom" */
  colorMode?: MatrixColorMode;
  /** base hue (0..360) when colorMode === "custom" */
  hue?: number;
  /** named glyph set, or pass `glyphs` for a custom pool */
  charset?: "katakana" | "katakanaDigits" | "binary" | "digits" | "latin" | "mixed";
  /** override glyph pool entirely */
  glyphs?: string[];
  /** rows advanced per frame (global multiplier) */
  speed?: number;
  /** glyph size in px (also sets column width) */
  fontSize?: number;
  /** fraction of columns that are active (0..1) */
  density?: number;
  /** fade alpha per frame — lower = longer trails */
  trail?: number;
  /** overall canvas opacity (subtlety dial) */
  opacity?: number;
  /** per-column speed variance (0 = uniform, 1 = very varied) */
  speedVariance?: number;
  /** chance per frame of an extra bright sparkle cell */
  flicker?: number;
  /** soft glow on the bright head glyph */
  glow?: boolean;
  /** glow blur radius in px */
  glowAmount?: number;
  /** rainbow/custom: shift hue down each column's trail */
  rainbowVert?: boolean;
  /** hue spread across screen width (rainbow) */
  rainbowSpread?: number;
  /** hue cycle speed over time (rainbow) */
  rainbowCycle?: number;
  /** color saturation % */
  saturation?: number;
  /** canvas backdrop color */
  background?: string;
  /** stacking order — defaults to -1 so it sits behind page content */
  zIndex?: number;
};

export const MATRIX_DEFAULTS: Required<Omit<MatrixBackgroundProps, "glyphs" | "zIndex">> = {
  enabled: true,
  colorMode: "rainbow",
  hue: 120,
  charset: "mixed",
  speed: 0.15,
  fontSize: 14,
  density: 1,
  trail: 0.025,
  opacity: 0.8,
  speedVariance: 0.5,
  flicker: 0.02,
  glow: true,
  glowAmount: 8,
  rainbowVert: true,
  rainbowSpread: 0.6,
  rainbowCycle: 6,
  saturation: 100,
  background: "#000000",
};

const CHARSETS: Record<NonNullable<MatrixBackgroundProps["charset"]>, string> = {
  katakana: "ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
  katakanaDigits: "ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789",
  binary: "01",
  digits: "0123456789",
  latin: "ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*+=<>?/\\|",
  mixed: "ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾆﾇﾈﾉﾊﾋ0123456789ABCDEF@#$%<>=*+:.",
};

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function MatrixBackground(props: MatrixBackgroundProps) {
  const cfg = { ...MATRIX_DEFAULTS, ...props };
  const {
    enabled, colorMode, hue, charset, glyphs, speed, fontSize, density, trail,
    opacity, speedVariance, flicker, glow, glowAmount, rainbowVert,
    rainbowSpread, rainbowCycle, saturation, background,
  } = cfg;
  const zIndex = props.zIndex ?? -1;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const chars = useMemo(
    () => (glyphs && glyphs.length ? glyphs : Array.from(CHARSETS[charset] || CHARSETS.mixed)),
    [glyphs, charset]
  );

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0, cols = 0, dpr = 1;
    type Col = { y: number; acc: number; speed: number; active: boolean };
    let columns: Col[] = [];

    const buildColumns = () => {
      cols = Math.ceil(W / fontSize);
      const next: Col[] = [];
      for (let i = 0; i < cols; i++) {
        const p = columns[i];
        next[i] = {
          y: p ? p.y : Math.floor((Math.random() * -H) / fontSize),
          acc: p ? p.acc : Math.random(),
          speed: 1 - speedVariance / 2 + Math.random() * speedVariance,
          active: Math.random() < density,
        };
      }
      columns = next;
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "top";
      buildColumns();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, W, H);
    };

    const hueFor = (i: number, depth: number, t: number) => {
      let h: number;
      if (colorMode === "rainbow") {
        h = (i / cols) * 360 * rainbowSpread + t * rainbowCycle + (rainbowVert ? depth * 6 : 0);
      } else {
        h = hue + (rainbowVert ? depth * 4 : 0);
      }
      return ((h % 360) + 360) % 360;
    };

    const bg = hexToRgb(background);
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${trail})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

      for (let i = 0; i < cols; i++) {
        const c = columns[i];
        if (!c.active) continue;
        c.acc += speed * c.speed;
        if (c.acc < 1) continue;
        const steps = c.acc | 0;
        c.acc -= steps;

        for (let s = 0; s < steps; s++) {
          c.y++;
          const x = i * fontSize;
          const y = c.y * fontSize;
          const ch = chars[(Math.random() * chars.length) | 0];

          if (colorMode === "green") ctx.fillStyle = "#cfffe0";
          else ctx.fillStyle = `hsl(${hueFor(i, c.y, t)}, ${saturation}%, 75%)`;

          if (glow && glowAmount > 0) {
            ctx.shadowColor =
              colorMode === "green" ? "#3dff88" : `hsl(${hueFor(i, c.y, t)}, ${saturation}%, 55%)`;
            ctx.shadowBlur = glowAmount;
          }
          ctx.fillText(ch, x, y);
          ctx.shadowBlur = 0;

          // dimmer second glyph so the head reads as a comet
          if (colorMode === "green") ctx.fillStyle = "#37d978";
          else ctx.fillStyle = `hsl(${hueFor(i, c.y, t)}, ${saturation}%, 50%)`;
          ctx.fillText(chars[(Math.random() * chars.length) | 0], x, y - fontSize);

          if (y > H && Math.random() > 0.975) {
            c.y = Math.floor(Math.random() * -20);
            c.active = Math.random() < density;
          }
        }
      }

      if (flicker > 0) {
        const n = ((W * H * flicker) / 90000) | 0;
        for (let k = 0; k < n; k++) {
          const i = (Math.random() * cols) | 0;
          const x = i * fontSize;
          const y = ((Math.random() * (H / fontSize)) | 0) * fontSize;
          ctx.fillStyle =
            colorMode === "green"
              ? "#eafff2"
              : `hsl(${hueFor(i, (y / fontSize) | 0, t)}, ${saturation}%, 85%)`;
          ctx.fillText(chars[(Math.random() * chars.length) | 0], x, y);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    enabled, colorMode, hue, chars, speed, fontSize, density, trail, speedVariance,
    flicker, glow, glowAmount, rainbowVert, rainbowSpread, rainbowCycle, saturation, background,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="matrix-bg-canvas"
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        pointerEvents: "none",
        opacity,
        background,
      }}
    />
  );
}
