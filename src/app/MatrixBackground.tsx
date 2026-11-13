"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/**
 * Full-bleed vertical "matrix rain" background.
 * Designed to sit BEHIND the 3D Mac in model view (z-index < 0, transparent
 * R3F canvas on top). Performant: single fillRect trail fade, capped DPR and
 * frame rate, pauses when the tab is hidden. Reduced motion (OS setting or the
 * Control Panel's data-reduce-effects) draws one still frame instead.
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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Rain advances in whole glyph rows, so 20fps looks the same as 30 while compositing a third less.
const FRAME_INTERVAL_MS = 1000 / 20;
// `speed` and `trail` are per-frame values tuned at 60fps; scale them to keep the same look when capped.
const TUNED_FRAME_MS = 1000 / 60;
const MAX_FRAME_GAP_MS = 100;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-effects"] });
  return () => {
    query.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches || document.documentElement.dataset.reduceEffects === "true";
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
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

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
      // A soft, glowing backdrop does not need Retina pixels; DPR 1 cuts fill and blur work by up to 4x.
      dpr = 1;
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

    // Glyphs are rasterized once per hue bucket, then copied. fillText plus shadowBlur per glyph
    // was the dominant idle cost (about 280 text draws per frame).
    const HUE_BUCKETS = 18;
    const pad = glow && glowAmount > 0 ? Math.ceil(glowAmount * 1.5) : 0;
    type Kind = { cell: number; pad: number; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; ready: Uint8Array; light: number; glow: boolean; green: string };
    const makeKind = (light: number, withGlow: boolean, green: string): Kind | null => {
      const p = withGlow ? pad : 1, cell = fontSize + 2 * p + 2;
      const c = document.createElement("canvas");
      c.width = chars.length * cell; c.height = (colorMode === "green" ? 1 : HUE_BUCKETS) * cell;
      const x = c.getContext("2d");
      if (!x) return null;
      x.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`; x.textBaseline = "top";
      return { cell, pad: p, canvas: c, ctx: x, ready: new Uint8Array(c.width / cell * (c.height / cell)), light: withGlow ? 75 : light, glow: withGlow, green };
    };
    const kinds = { head: makeKind(75, pad > 0, "#cfffe0"), trail: makeKind(50, false, "#37d978"), flick: makeKind(85, false, "#eafff2") };
    const sprite = (kind: Kind | null, glyph: number, hueDeg: number, x: number, y: number) => {
      if (!kind) return;
      const bucket = colorMode === "green" ? 0 : Math.round(hueDeg / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
      const index = bucket * chars.length + glyph, sx = glyph * kind.cell, sy = bucket * kind.cell;
      if (!kind.ready[index]) {
        const hueValue = bucket * (360 / HUE_BUCKETS), k = kind.ctx;
        k.fillStyle = colorMode === "green" ? kind.green : `hsl(${hueValue}, ${saturation}%, ${kind.light}%)`;
        if (kind.glow) { k.shadowColor = colorMode === "green" ? "#3dff88" : `hsl(${hueValue}, ${saturation}%, 55%)`; k.shadowBlur = glowAmount; }
        k.fillText(chars[glyph], sx + kind.pad + 1, sy + kind.pad + 1);
        kind.ready[index] = 1;
      }
      ctx.drawImage(kind.canvas, sx, sy, kind.cell, kind.cell, x - kind.pad - 1, y - kind.pad - 1, kind.cell, kind.cell);
    };
    const pick = () => (Math.random() * chars.length) | 0;

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

    const drawStill = () => {
      const rows = Math.ceil(H / fontSize);
      for (let i = 0; i < cols; i++) {
        if (!columns[i].active) continue;
        const head = (Math.random() * rows) | 0;
        for (let d = 0; d < 10; d++) {
          ctx.globalAlpha = 0.6 * (1 - d / 10);
          sprite(kinds.trail, pick(), hueFor(i, head - d, 0), i * fontSize, (head - d) * fontSize);
        }
      }
      ctx.globalAlpha = 1;
    };

    const draw = (now: number, frameScale: number) => {
      const t = (now - start) / 1000;
      ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${Math.min(1, trail * frameScale)})`;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < cols; i++) {
        const c = columns[i];
        if (!c.active) continue;
        c.acc += speed * c.speed * frameScale;
        if (c.acc < 1) continue;
        const steps = c.acc | 0;
        c.acc -= steps;

        for (let s = 0; s < steps; s++) {
          c.y++;
          const x = i * fontSize;
          const y = c.y * fontSize;
          const hueValue = hueFor(i, c.y, t);
          sprite(kinds.head, pick(), hueValue, x, y);
          // dimmer second glyph so the head reads as a comet
          sprite(kinds.trail, pick(), hueValue, x, y - fontSize);

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
          sprite(kinds.flick, pick(), hueFor(i, (y / fontSize) | 0, t), x, y);
        }
      }
    };

    if (reducedMotion) {
      const resizeStill = () => {
        resize();
        drawStill();
      };
      resizeStill();
      window.addEventListener("resize", resizeStill);
      return () => window.removeEventListener("resize", resizeStill);
    }

    let lastFrame = 0;
    let wake: ReturnType<typeof setTimeout> | undefined;
    // A timer wakes the page only for frames that draw, instead of every display refresh.
    const schedule = () => {
      wake = setTimeout(() => { wake = undefined; rafRef.current = requestAnimationFrame(tick); }, Math.max(0, FRAME_INTERVAL_MS - 4));
    };
    const tick = (now: number) => {
      rafRef.current = null;
      const elapsed = lastFrame ? now - lastFrame : FRAME_INTERVAL_MS;
      lastFrame = now;
      draw(now, Math.min(elapsed, MAX_FRAME_GAP_MS) / TUNED_FRAME_MS);
      schedule();
    };
    const stop = () => {
      clearTimeout(wake); wake = undefined;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (rafRef.current == null && wake === undefined) {
        lastFrame = 0;
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) rafRef.current = requestAnimationFrame(tick);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    enabled, reducedMotion, colorMode, hue, chars, speed, fontSize, density, trail, speedVariance,
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
