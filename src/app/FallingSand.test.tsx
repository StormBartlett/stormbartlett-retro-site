import React,{act} from "react";
import {createRoot,type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import FallingSand from "./FallingSand";
let host:HTMLDivElement,root:Root,resize:()=>void;
const fillRect=vi.fn();
beforeEach(()=>{
  vi.useFakeTimers({toFake:["performance","Date","requestAnimationFrame","cancelAnimationFrame","setTimeout","clearTimeout"]});
  vi.stubGlobal("ResizeObserver",class{constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
  fillRect.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect} as unknown as CanvasRenderingContext2D);
  const rect={left:0,top:0,right:64,bottom:64,width:64,height:64,x:0,y:0,toJSON:()=>({})};
  vi.spyOn(HTMLCanvasElement.prototype,"getBoundingClientRect").mockReturnValue(rect);
  vi.spyOn(HTMLDivElement.prototype,"getBoundingClientRect").mockReturnValue(rect);
  host=document.createElement("div");document.body.appendChild(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe("Falling Sand idle work",()=>{
  it("uses one drawing canvas and cancels its frame loop while away",()=>{
    act(()=>root.render(<FallingSand/>));
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(()=>window.dispatchEvent(new CustomEvent("storm-app-focus",{detail:{id:"terminal"}})));
    act(()=>vi.advanceTimersByTime(30));
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("PAUSED");
    expect(vi.getTimerCount()).toBe(0);
    const resume=Array.from(host.querySelectorAll("button")).find(button=>button.textContent==="Resume")!;
    act(()=>resume.click());expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
  it("does no frame work when the visitor chooses zero FPS",()=>{
    act(()=>root.render(<FallingSand/>));
    const slider=host.querySelector<HTMLInputElement>('[aria-label="Simulation frame rate"]')!;
    act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(slider,"0");slider.dispatchEvent(new Event("input",{bubbles:true}));});
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps a 45 FPS target near 45 on a 60 Hz display",()=>{
    act(()=>root.render(<FallingSand/>));
    const slider=host.querySelector<HTMLInputElement>('[aria-label="Simulation frame rate"]')!;
    act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(slider,"45");slider.dispatchEvent(new Event("input",{bubbles:true}));});
    fillRect.mockClear();act(()=>vi.advanceTimersByTime(1000));
    const frames=fillRect.mock.calls.filter(call=>call[2]===64&&call[3]===64).length;
    expect(frames).toBeGreaterThanOrEqual(40);expect(frames).toBeLessThanOrEqual(47);
  });
  it("shows a resumable pause menu when mounted in a hidden tab",()=>{
    vi.spyOn(document,"hidden","get").mockReturnValue(true);
    act(()=>root.render(<FallingSand/>));act(()=>vi.advanceTimersByTime(30));
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("PAUSED");expect(vi.getTimerCount()).toBe(0);
  });
  it("redraws a resized canvas at zero FPS without restarting physics",()=>{
    act(()=>root.render(<FallingSand/>));
    const slider=host.querySelector<HTMLInputElement>('[aria-label="Simulation frame rate"]')!;
    act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(slider,"0");slider.dispatchEvent(new Event("input",{bubbles:true}));});
    fillRect.mockClear();act(()=>resize());
    expect(fillRect.mock.calls.some(call=>call[2]===64&&call[3]===64)).toBe(true);expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up every timer on close",()=>{
    act(()=>root.render(<FallingSand/>));act(()=>root.unmount());expect(vi.getTimerCount()).toBe(0);root=createRoot(host);
  });
});
