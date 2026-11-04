import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/image", () => ({ default: () => null }));
import DesktopOS from "./DesktopOS";
import { FullscreenProvider } from "./FullscreenContext";
import { FOLDER_STORAGE_KEY, type DesktopFolders } from "./desktopFiles";

let host: HTMLDivElement, root: Root;
const mount = async (variant?: "portrait" | "landscape") => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => { root.render(<FullscreenProvider><DesktopOS mobileVariant={variant} /></FullscreenProvider>); });
};
const unmount = () => { act(() => root.unmount()); host.remove(); };
const icon = (id: string) => host.querySelector(`.desktop-icon[data-id="${id}"]`);
const folders = () => JSON.parse(localStorage.getItem(FOLDER_STORAGE_KEY)!) as DesktopFolders;
/** Stores the state left by dragging one Games item out onto the desktop, then reloads. */
const moveGameToDesktop = () => {
  const stored = folders(), item = stored.games.items.find(entry => entry.id === "game-star-patrol")!;
  stored.games.items = stored.games.items.filter(entry => entry.id !== item.id);
  localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(stored));
  const icons = JSON.parse(localStorage.getItem("nx-icons")!);
  localStorage.setItem("nx-icons", JSON.stringify([...icons, { id: item.id, label: item.label, app: item.app, x: 300, y: 300 }]));
};

beforeEach(() => { localStorage.clear(); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }); });
afterEach(() => { unmount(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("desktop file persistence", () => {
  it("keeps an item moved out of a folder through a reload, with the same artwork", async () => {
    await mount();
    moveGameToDesktop();
    unmount(); await mount();
    expect(icon("game-star-patrol")?.textContent).toContain("Star Patrol");
    expect(icon("game-star-patrol")?.querySelector("svg")?.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(folders().games.items.some(entry => entry.id === "game-star-patrol")).toBe(false);
  });

  it("shows that item on a phone layout too", async () => {
    await mount();
    moveGameToDesktop();
    unmount(); await mount("portrait");
    expect(icon("game-star-patrol")).not.toBeNull();
    expect(icon("calculator")).toBeNull();
  });

  it("does not bring back an icon that was moved into a folder", async () => {
    await mount();
    const stored = folders();
    stored.projects.items.push({ id: "pixel-studio", label: "Pixel Studio", app: "pixel-studio", x: 20, y: 120 });
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(stored));
    unmount(); await mount();
    expect(icon("pixel-studio")).toBeNull();
  });

  it("keeps a custom folder and its contents when a saved layout has lost its icon", async () => {
    await mount();
    const stored = folders();
    stored["desk-folder-1"] = { label: "Mine", items: [{ id: "game-star-patrol", label: "Star Patrol", app: "star-patrol", x: 20, y: 20 }] };
    stored.games.items = stored.games.items.filter(entry => entry.id !== "game-star-patrol");
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(stored));
    unmount(); await mount();
    expect(icon("desk-folder-1")?.textContent).toContain("Mine");
    expect(icon("game-star-patrol")).toBeNull();
  });

  it("resets icon positions without deleting custom folders, contents or Trash",async()=>{
    await mount();const stored=folders();
    stored["desk-folder-reset"]={label:"Keep",items:[{id:"game-star-patrol",label:"Star Patrol",app:"star-patrol",x:20,y:20}]};
    stored.games.items=stored.games.items.filter(item=>item.id!=="game-star-patrol");
    localStorage.setItem(FOLDER_STORAGE_KEY,JSON.stringify(stored));
    localStorage.setItem("nx-trash",JSON.stringify([{id:"calculator",label:"Calculator",app:"calculator",x:20,y:20}]));
    unmount();await mount();
    const view=Array.from(host.querySelectorAll<HTMLButtonElement>(".menu-trigger")).find(button=>button.textContent==="View")!;
    act(()=>view.click());
    const reset=Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(button=>button.textContent==="Reset Desktop Icons")!;
    act(()=>reset.click());
    expect(folders()["desk-folder-reset"].items[0].app).toBe("star-patrol");
    expect(JSON.parse(localStorage.getItem("nx-trash")!)).toHaveLength(1);
    expect(icon("calculator")).toBeNull();expect(icon("desk-folder-reset")).not.toBeNull();
    unmount();await mount();expect(folders()["desk-folder-reset"]).toBeDefined();
  });
  it("ignores a stored desktop shortcut to something that is not an app", async () => {
    await mount();
    localStorage.setItem("nx-icons", JSON.stringify([{ id: "evil", label: "Evil", app: "injected", x: 20, y: 20 }]));
    unmount(); await mount();
    expect(icon("evil")).toBeNull();
    expect(icon("about")).not.toBeNull();
  });
});
