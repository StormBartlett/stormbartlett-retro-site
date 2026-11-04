import React, { act, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("./MatrixBackground", () => ({ default: () => null }));
vi.mock("./DesktopOS", () => ({ default: function Desktop({ onViewModeChange, viewMode }: { onViewModeChange: (mode: string) => void; viewMode: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => { lifecycle.mounts++;return () => {lifecycle.unmounts++;}; }, []);
  return <div data-testid="persistent-desktop"><button onClick={() => setCount(n => n+1)}>Work {count}</button><button onClick={() => onViewModeChange(viewMode === "desktop" ? "model" : "desktop")}>Switch view</button></div>;
} }));
vi.mock("next/dynamic", () => ({ default: () => function Model({ onScreenSlot }: { onScreenSlot: (element: HTMLElement) => void }) {
  const slot=useRef<HTMLDivElement>(null);
  useEffect(() => { if(slot.current) onScreenSlot(slot.current); },[onScreenSlot]);
  return <div data-testid="model-slot" ref={slot}/>;
} }));
import Home from "./page";
import { readStoredSetting, writeStoredSetting, MOBILE_MEDIA_QUERY } from "./FullscreenContext";

beforeEach(() => { lifecycle.mounts=0;lifecycle.unmounts=0;localStorage.clear();localStorage.setItem("nx-fullscreen","1");vi.stubGlobal("matchMedia",vi.fn((query:string)=>({matches:false,media:query,addEventListener:vi.fn(),removeEventListener:vi.fn()}))); });
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

it("keeps one desktop and its in-memory app state across repeated model switches",()=>{
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  act(()=>root.render(<Home/>));
  const desktop=host.querySelector('[data-testid="persistent-desktop"]');
  act(()=>host.querySelector("button")!.click());
  for(let i=0;i<3;i++){
    act(()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Switch view")!.click());
    expect(host.querySelector('[data-testid="model-slot"]')?.contains(desktop)).toBe(true);
    expect(host.textContent).toContain("Work 1");
    act(()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Enter Desktop")!.click());
    expect(host.querySelector('[data-testid="model-slot"]')).toBeNull();
    expect(host.querySelector('[data-testid="persistent-desktop"]')).toBe(desktop);
    expect(host.textContent).toContain("Work 1");
  }
  expect(lifecycle.mounts).toBe(1);expect(lifecycle.unmounts).toBe(0);
  act(()=>root.unmount());host.remove();
});

it("keeps settings usable when browser storage is blocked",()=>{
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("blocked");});
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("blocked");});
  expect(readStoredSetting("test")).toBeNull();expect(()=>writeStoredSetting("test","value")).not.toThrow();
  expect(MOBILE_MEDIA_QUERY).toBe("(max-width: 900px), (pointer: coarse)");
});
