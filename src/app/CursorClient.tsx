"use client";
import { useEffect } from "react";

export default function CursorClient() {
  useEffect(() => {
    function buildCursor(fillColor: string, outlineColor: string, size = 32, hotspotX = 1, hotspotY = 1) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return { css: "auto", url: "" };
      canvas.width = canvas.height = size;

      const grid = 24; // base grid the points are designed for
      const scale = size / grid;
      const drawPixel = (x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x * scale), Math.floor(y * scale), Math.ceil(scale), Math.ceil(scale));
      };

      // Outline path (approximated classic Mac arrow outline)
      const outline: Array<{ x: number; y: number }> = [
        { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: 4 }, { x: 0, y: 5 }, { x: 0, y: 6 }, { x: 0, y: 7 }, { x: 0, y: 8 }, { x: 0, y: 9 }, { x: 0, y: 10 }, { x: 0, y: 11 }, { x: 0, y: 12 }, { x: 0, y: 13 }, { x: 0, y: 14 },
        { x: 1, y: 15 }, { x: 2, y: 14 }, { x: 3, y: 13 }, { x: 4, y: 12 }, { x: 5, y: 17 }, { x: 6, y: 18 }, { x: 7, y: 17 },
        { x: 8, y: 16 }, { x: 8, y: 15 }, { x: 7, y: 14 }, { x: 6, y: 13 }, { x: 6, y: 12 }, { x: 6, y: 11 }, { x: 7, y: 10 }, { x: 8, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 },
        { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 4 }, { x: 6, y: 5 }, { x: 7, y: 6 }, { x: 8, y: 7 }, { x: 9, y: 8 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 12, y: 9 }, { x: 13, y: 9 }, { x: 14, y: 9 },
      ];

      // Fill path
      const fill: Array<{ x: number; y: number }> = [
        { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }, { x: 1, y: 6 }, { x: 1, y: 7 }, { x: 1, y: 8 }, { x: 1, y: 9 }, { x: 1, y: 10 }, { x: 1, y: 11 }, { x: 1, y: 12 }, { x: 1, y: 13 },
        { x: 2, y: 13 }, { x: 3, y: 12 }, { x: 4, y: 11 }, { x: 5, y: 16 }, { x: 6, y: 17 }, { x: 7, y: 16 },
        { x: 7, y: 15 }, { x: 6, y: 14 }, { x: 5, y: 13 }, { x: 5, y: 12 }, { x: 5, y: 11 }, { x: 7, y: 9 }, { x: 8, y: 9 }, { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 12, y: 9 },
        { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }, { x: 7, y: 7 }, { x: 8, y: 8 }, { x: 9, y: 8 },
      ];

      // Draw outline first for a crisp border, then fill
      outline.forEach(p => drawPixel(p.x, p.y, outlineColor));
      fill.forEach(p => drawPixel(p.x, p.y, fillColor));

      const url = canvas.toDataURL("image/png");
      const css = `url("${url}") ${hotspotX} ${hotspotY}, auto`;
      return { css, url };
    }

    function applyForCurrentMode() {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark-mode");
      const { css, url } = buildCursor(isDark ? "#ffffff" : "#101010", isDark ? "#000000" : "#ffffff");
      root.style.cursor = css;
      // @ts-expect-error - attach helper for debugging
      window.LisaCursor = {
        apply() { root.style.cursor = css; },
        remove() { root.style.cursor = "auto"; },
        url,
      };
    }

    applyForCurrentMode();

    // Observe class changes on <html> to react to dark-mode toggles
    const observer = new MutationObserver(() => applyForCurrentMode());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Also respond to storage changes in case theme toggled in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nx-dark-mode") applyForCurrentMode();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
