/** Suppress only the pointer click belonging to a completed/cancelled drag. */
export function suppressDragClick(element:HTMLElement,pointerId:number,afterRelease=false):()=>void {
  let timer:ReturnType<typeof setTimeout>|undefined;
  const click=(event:MouseEvent)=>{if(event.detail){event.preventDefault();event.stopImmediatePropagation();}};
  const cleanup=()=>{
    clearTimeout(timer);element.removeEventListener("click",click,true);
    window.removeEventListener("pointerup",up,true);window.removeEventListener("pointercancel",cancel,true);
    window.removeEventListener("pointerdown",cleanup,true);window.removeEventListener("blur",cleanup);
  };
  const arm=()=>{cleanup();element.addEventListener("click",click,{capture:true,once:true});timer=setTimeout(cleanup,0);};
  const up=(event:PointerEvent)=>{if(event.pointerId===pointerId)arm();};
  const cancel=(event:PointerEvent)=>{if(event.pointerId===pointerId)cleanup();};
  if(afterRelease){
    window.addEventListener("pointerup",up,true);window.addEventListener("pointercancel",cancel,true);
    window.addEventListener("pointerdown",cleanup,true);window.addEventListener("blur",cleanup);
  }else arm();
  return cleanup;
}
