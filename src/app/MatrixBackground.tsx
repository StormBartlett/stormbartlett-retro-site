"use client";

import { useEffect, useMemo, useRef } from "react";

export type MatrixBackgroundProps = {
  enabled?: boolean;
  /** overall opacity of the effect */
  opacity?: number; // 0..1
  /** canvas background color behind the green text */
  backgroundColor?: string; // CSS color
  /** pixel size of each glyph */
  fontSize?: number; // px
  /** spacing between columns as a multiple of fontSize */
  columnSpacing?: number; // e.g., 1 = contiguous, 1.25 = gaps
  /** base speed in px/frame for the rain */
  speed?: number;
  /** random speed variance (0..1) */
  speedVariance?: number;
  /** probability (0..1) a glyph swaps to a new char per frame */
  morphChance?: number;
  /** chance (0..1) a column resets to a new start position per frame */
  resetChance?: number;
  /** shadow blur for glow */
  glow?: number; // px
  /** color of glyphs */
  color?: string;
  /** color of trail fade (usually darker green/black) */
  backgroundFade?: string;
  /** length of trailing characters rendered per column */
  maxTrail?: number;
  /** optional override word lists */
  words?: string[];
  /** optional override glyphs */
  glyphs?: string[];
  /** render density multiplier for high-DPI clarity */
  devicePixelRatio?: number;
};

// Default glyph sets
const defaultKana = [
  "ｱ","ｲ","ｳ","ｴ","ｵ","ｶ","ｷ","ｸ","ｹ","ｺ","ｻ","ｼ","ｽ","ｾ","ｿ",
  "ﾀ","ﾁ","ﾂ","ﾃ","ﾄ","ﾅ","ﾆ","ﾇ","ﾈ","ﾉ","ﾊ","ﾋ","ﾌ","ﾍ","ﾎ",
  "ﾏ","ﾐ","ﾑ","ﾒ","ﾓ","ﾔ","ﾕ","ﾖ","ﾗ","ﾘ","ﾙ","ﾚ","ﾛ","ﾜ","ｦ","ﾝ",
];

const defaultProgrammerGlyphs = [
  "{","}","<","/","/>","=>",";","$","#","&","*","+","-","=",
  ":","::","|","||","&&","()","[]","{}","<>","~","^","%",
];

const defaultWords = [
  // frameworks & libs
  "react","next","typescript","three","node","vercel","vite","webpack",
  // // concepts
  // "hooks","state","props","jsx","ts","async","await","promise","fn",
  // // patterns / terms
  // "memo","context","reducer","event","render","commit","diff","fiber",
  // // easter eggs
  // "console.log","useEffect","useMemo","useRef","eslint","prettier",
];

export default function MatrixBackground(props: MatrixBackgroundProps) {
  const {
    enabled = true,
    opacity = 0.08,
    backgroundColor = "var(--matrix-bg-color, #0b0c0d)",
    fontSize = 16,
    columnSpacing = 1.15,
    speed = 1.25,
    speedVariance = 0.15,
    morphChance = 0.015,
    resetChance = 0.002,
    glow = 1,
    color = "#000000",
    backgroundFade = "rgba(0,0,0,0.12)",
    maxTrail = 12,
    words = defaultWords,
    glyphs = [...defaultKana, ...defaultProgrammerGlyphs],
    devicePixelRatio,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Build a mixed character pool with some full words inserted sparsely
  const characterPool = useMemo(() => {
    // Create a pool where words appear occasionally as multi-char bursts
    const pool: (string | string[])[] = [];
    const wordEvery = 18; // every N entries, inject a word
    let wordIndex = 0;
    for (let i = 0; i < glyphs.length * 5; i++) {
      if (i % wordEvery === 0 && words.length > 0) {
        pool.push(words[wordIndex % words.length]);
        wordIndex++;
      } else {
        pool.push(glyphs[i % glyphs.length]);
      }
    }
    return pool;
  }, [glyphs, words]);

  useEffect(() => {
    if (!enabled) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = devicePixelRatio || Math.min(2, globalThis.devicePixelRatio || 1);

    const doResize = (c: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
      const { innerWidth, innerHeight } = window;
      const cssW = innerWidth;
      const cssH = innerHeight;
      c.style.width = cssW + "px";
      c.style.height = cssH + "px";
      c.width = Math.floor(cssW * dpr);
      c.height = Math.floor(cssH * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const fillBase = () => {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasEl.width / dpr, canvasEl.height / dpr);
      ctx.restore();
    };

    const onResize = () => { doResize(canvasEl, ctx); fillBase(); };
    onResize();
    window.addEventListener("resize", onResize);

    // Column setup
    const columnWidth = fontSize * columnSpacing;
    const numColumns = Math.ceil(window.innerWidth / columnWidth);

    type Column = {
      x: number; // in px
      y: number; // current head y
      speed: number; // px per frame
      glyphs: (string | string[])[]; // buffer of characters/words for this column
    };

    const columns: Column[] = Array.from({ length: numColumns }, (_, i) => {
      const x = Math.floor(i * columnWidth);
      return {
        x,
        y: Math.random() * window.innerHeight * -1, // start above view
        speed: speed * (1 + (Math.random() - 0.5) * 2 * speedVariance),
        glyphs: characterPool,
      };
    });

    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = "top";
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;

    const lineHeight = fontSize * 1.05;

    const drawFrame = (c: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
      // trail fade
      context.fillStyle = backgroundFade;
      context.fillRect(0, 0, c.width / dpr, c.height / dpr);

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];

        // Randomly morph characters to keep things alive
        if (Math.random() < morphChance) {
          // no-op: we rely on drawing a different random glyph each time
        }

        // Draw head and trailing glyphs
        let y = col.y;
        let steps = 0;
        // limit trailing depth to keep subtle
        while (y > -lineHeight * maxTrail && steps < maxTrail) {
          const pick = col.glyphs[(Math.random() * col.glyphs.length) | 0];
          const isWord = typeof pick === "string" && (pick as string).length > 2 && /[a-z]/i.test(pick as string);
          const text = Array.isArray(pick) ? (pick as string[]).join("") : (pick as string);

          const brightness = Math.max(0, 1 - steps / maxTrail);
          // leading brighter, trailing dimmer
          const channel = Math.floor(80 + 175 * brightness);
          context.fillStyle = `rgba(0, ${channel}, 90, ${opacity * (0.4 + 0.6 * brightness)})`;

          context.fillText(text, col.x, y);

          // advance to next trail step
          y -= lineHeight * (isWord ? 1.2 : 1);
          steps++;
        }

        // move column
        col.y += col.speed;

        // reset if off screen
        if (col.y - lineHeight * maxTrail > window.innerHeight) {
          if (Math.random() < 0.6 || Math.random() < resetChance) {
            col.y = -Math.random() * 200 - lineHeight * (Math.random() * maxTrail);
          }
        }
      }

      rafRef.current = requestAnimationFrame(() => drawFrame(c, context));
    };

    rafRef.current = requestAnimationFrame(() => drawFrame(canvasEl, ctx));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled, opacity, backgroundColor, fontSize, columnSpacing, speed, speedVariance, morphChance, resetChance, glow, color, backgroundFade, maxTrail, characterPool, devicePixelRatio]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="matrix-bg-canvas"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: backgroundColor,
      }}
    />
  );
}

export const defaultMatrixConfig: Required<Pick<MatrixBackgroundProps,
  | "opacity"
  | "backgroundColor"
  | "fontSize"
  | "columnSpacing"
  | "speed"
  | "speedVariance"
  | "morphChance"
  | "resetChance"
  | "glow"
  | "color"
  | "backgroundFade"
>> & {
  words: string[];
  glyphs: string[];
} = {
  opacity: 0.1,
  backgroundColor: "var(--matrix-bg-color, #0b0c0d)",
  fontSize: 14,
  columnSpacing: 1.15,
  speed: 1.25,
  speedVariance: 0.35,
  morphChance: 0.035,
  resetChance: 0.002,
  glow: 8,
  color: "#1aff6b",
  backgroundFade: "rgba(0,0,0,0.08)",
  words: defaultWords,
  glyphs: [...defaultKana, ...defaultProgrammerGlyphs],
};

export const curatedWordSets = {
  minimal: ["react","next","hooks","state","ts","async","await"],
  concepts: ["closure","prototype","immutable","pure","side-effect","compose"],
  runtime: ["render","reconcile","commit","hydrate","suspense","transition"],
  easter: ["hello, world","useEffect","console.log","npx","pnpm","yarn"],
};

export const curatedGlyphSets = {
  kana: defaultKana,
  symbols: defaultProgrammerGlyphs,
  binary: ["0","1"],
  sparseSymbols: ["<","/",">","{","}","(",")","=","=>"],
};


