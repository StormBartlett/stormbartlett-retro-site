import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import arcade from "./Arcade.module.css";
import ArcadeMenu from "./ArcadeMenu";
import BalloonBastion from "./BalloonBastion";
import Mossblade from "./Mossblade";
import SnakeGarden from "./SnakeGarden";
import StarPatrol from "./StarPatrol";

const games = [["snake", SnakeGarden], ["star-patrol", StarPatrol], ["mossblade", Mossblade], ["balloon-bastion", BalloonBastion]] as const;
let host: HTMLDivElement, root: Root;
const frame = () => act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
const dialog = () => host.querySelector('[role="dialog"]');
const button = (text: string) => Array.from(host.querySelectorAll("button")).find(item => item.textContent?.includes(text));
const press = (key: string, code = key) => act(() => { document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true })); });
const focusApp = (id: string | null) => act(() => { window.dispatchEvent(new CustomEvent("storm-app-focus", { detail: { id } })); });

beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("arcade games", () => {
  it.each(games)("%s boots straight into play, with no splash and keyboard focus inside", async (_id, Game) => {
    await act(async () => { root.render(<Game />); });
    expect(dialog()).toBeNull();
    expect(host.firstElementChild?.contains(document.activeElement)).toBe(true);
    expect(host.textContent).not.toMatch(/INSERT CURIOSITY|POCKET ARCADE|One more round|Original pixels|village/i);
  });

  it.each(games)("%s offers the Esc menu when running, and Esc closes it again", async (id, Game) => {
    await act(async () => { root.render(<Game />); });
    press("Escape");
    expect(dialog()?.textContent).toContain("PAUSED");
    expect(button("Resume")).toBeTruthy();
    press("Escape");
    expect(dialog()).toBeNull();
    expect(id).toBeTruthy();
  });

  it.each(games.filter(([id]) => id !== "balloon-bastion"))("%s pauses when another app takes focus, but not for its own window", async (id, Game) => {
    await act(async () => { root.render(<Game />); });
    focusApp(id);
    expect(dialog()).toBeNull();
    focusApp("terminal");
    expect(dialog()?.textContent).toContain("PAUSED");
  });

  it("pauses Balloon Bastion when away, and Resume really restarts the wave", async () => {
    await act(async () => { root.render(<BalloonBastion />); });
    const canvas = host.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 480, height: 320 } as DOMRect);
    act(() => { canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 })); });
    act(() => { button("Start round 1")!.click(); });
    expect(button("Pause")).toBeTruthy();
    focusApp("terminal");
    expect(dialog()?.textContent).toContain("PAUSED");
    act(() => { button("Resume")!.click(); });
    expect(dialog()).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Resumed.");
    expect(Array.from(host.querySelectorAll("button")).some(item => item.textContent === "Pause")).toBe(true);
  });

  it("stops every game timer when the window closes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    await act(async () => { root.render(<SnakeGarden />); });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(host);
  });

  it("stops the snake timer while paused", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    await act(async () => { root.render(<SnakeGarden />); });
    focusApp("terminal");
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("arcade menu focus", () => {
  it("takes focus when opened from inside the game", async () => {
    act(() => root.render(<div className={arcade.shell}><button id="inside">inside</button><ArcadeMenu title="PAUSED" action={() => {}} /></div>));
    act(() => document.getElementById("inside")!.focus());
    await frame();
    expect(document.activeElement?.textContent).toBe("Resume");
  });

  it("does not pull focus back from another app", async () => {
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    act(() => root.render(<div className={arcade.shell}><ArcadeMenu title="PAUSED" action={() => {}} /></div>));
    await frame();
    expect(document.activeElement).toBe(other);
    other.remove();
  });
});
