import {afterEach,describe,it,expect,vi} from "vitest";
import {suppressDragClick} from "./dragClicks";
afterEach(()=>vi.useRealTimers());
describe("cancelled file drag clicks",()=>{
 it("suppresses the held pointer release, but leaves keyboard activation available",()=>{
  vi.useFakeTimers();const button=document.createElement("button"),clicked=vi.fn();document.body.appendChild(button);button.addEventListener("click",clicked);
  const cleanup=suppressDragClick(button,7,true);
  window.dispatchEvent(new PointerEvent("pointerup",{pointerId:8}));
  window.dispatchEvent(new PointerEvent("pointerup",{pointerId:7}));
  button.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,detail:1}));expect(clicked).not.toHaveBeenCalled();
  vi.runOnlyPendingTimers();button.click();expect(clicked).toHaveBeenCalledOnce();cleanup();button.remove();expect(vi.getTimerCount()).toBe(0);
 });
 it("does not swallow the next gesture after a cancellation or lost focus",()=>{
  vi.useFakeTimers();const button=document.createElement("button"),clicked=vi.fn();document.body.appendChild(button);button.addEventListener("click",clicked);
  const cleanup=suppressDragClick(button,7,true);window.dispatchEvent(new Event("blur"));
  button.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1}));expect(clicked).toHaveBeenCalledOnce();cleanup();button.remove();
 });
});
