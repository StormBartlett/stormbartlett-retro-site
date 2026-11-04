import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/dynamic", () => ({ default: () => () => null }));
import { AppLauncher, Games, portfolioApps, appComponents } from "./PortfolioApps";

let host: HTMLDivElement, root: Root;
beforeEach(() => { host=document.createElement("div");document.body.appendChild(host);root=createRoot(host); });
afterEach(() => { act(()=>root.unmount());host.remove();vi.restoreAllMocks(); });

function clickText(text: string) { const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent?.includes(text));expect(button).toBeTruthy();act(()=>button!.click()); }
function key(value: string, extra: KeyboardEventInit = {}) { act(()=>document.activeElement?.dispatchEvent(new KeyboardEvent("keydown",{key:value,bubbles:true,cancelable:true,...extra}))); }

describe("desktop app integration",()=>{
  it("has a loadable component for every advertised app",()=>{for(const app of portfolioApps) expect(appComponents[app.id],app.id).toBeDefined();expect(new Set(portfolioApps.map(a=>a.id)).size).toBe(portfolioApps.length);});
  it("opens every new game from the Games folder",()=>{const open=vi.fn();act(()=>root.render(<Games onOpenApp={open}/>));for(const name of ["Star Patrol","Balloon Bastion","Mossblade","Snake Garden","Falling Sand"]) clickText(name);expect(open.mock.calls.map(c=>c[0])).toEqual(["star-patrol","balloon-bastion","mossblade","snake","falling-sand"]);});
  it("keeps Games free of promotional headings",()=>{act(()=>root.render(<Games/>));expect(host.querySelector("h1,h2,p")).toBeNull();expect(host.textContent).not.toMatch(/INSERT CURIOSITY|One more round|Original pixels/);});
  it("focuses app search, launches filtered match with Enter, closes",()=>{const open=vi.fn(),close=vi.fn();act(()=>root.render(<AppLauncher onOpenApp={open} onClose={close} initialQuery="pixel"/>));expect(document.activeElement).toBe(host.querySelector("input"));key("Enter");expect(open).toHaveBeenCalledWith("pixel-studio");expect(close).toHaveBeenCalledOnce();});
  it("supports arrows, Escape, and tab containment",()=>{const open=vi.fn(),close=vi.fn();act(()=>root.render(<AppLauncher onOpenApp={open} onClose={close}/>));key("ArrowDown");key("Enter");expect(open).toHaveBeenCalledWith("playground");key("Escape");expect(close).toHaveBeenCalledTimes(2);host.querySelector("input")!.focus();key("Tab",{shiftKey:true});expect(document.activeElement).toBe(Array.from(host.querySelectorAll("button")).at(-1));});
});
