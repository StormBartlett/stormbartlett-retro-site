import React,{act} from "react";
import {createRoot} from "react-dom/client";
import {describe,it,expect,vi} from "vitest";
import FinderApp from "./FinderApp";
import {FINDER_STORAGE_KEY} from "./finderModel";

describe("Finder pointer moves",()=>{
  const setup=()=>{
    localStorage.clear();const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
    act(()=>root.render(<FinderApp/>));
    const item=(label:string)=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
    const under=(element:Element|null)=>{document.elementsFromPoint=(()=>element?[element]:[]) as typeof document.elementsFromPoint;};
    const pointer=(type:string,x=0,y=0)=>act(()=>{window.dispatchEvent(new PointerEvent(type,{pointerId:1,clientX:x,clientY:y,bubbles:true,cancelable:true}));});
    return {host,item,under,pointer,done:()=>{act(()=>root.unmount());host.remove();localStorage.clear();vi.useRealTimers();}};
  };
  const down=(element:HTMLElement)=>act(()=>{element.dispatchEvent(new PointerEvent("pointerdown",{pointerId:1,button:0,clientX:0,clientY:0,bubbles:true}));});
  const placements=()=>JSON.parse(localStorage.getItem(FINDER_STORAGE_KEY)!).placements;

  it("spring-opens a hovered folder, then drops into it",()=>{
    const {host,item,under,pointer,done}=setup();
    try{
      vi.useFakeTimers();
      const file=item("Skills.txt, text document, read only");
      down(file);pointer("pointermove",40,40);
      under(item("Notes, folder, read only"));
      pointer("pointermove",60,60);act(()=>{vi.advanceTimersToNextFrame();});
      expect(item("Notes, folder, read only").className).toMatch(/dropTarget/);
      act(()=>{vi.advanceTimersByTime(700);});
      expect(host.querySelector('[aria-label="Start here.txt, text document, read only"]')).not.toBeNull();
      under(host.querySelector('[role="group"][data-finder-folder="notes-folder"]'));
      pointer("pointerup",60,60);
      expect(placements()).toContainEqual({id:"skills-file",parentId:"notes-folder"});
    }finally{done();}
  });

  it("leaves everything in place when a drag is cancelled, and stops the spring",()=>{
    const {host,item,under,pointer,done}=setup();
    try{
      vi.useFakeTimers();
      down(item("Skills.txt, text document, read only"));pointer("pointermove",40,40);
      under(item("Notes, folder, read only"));pointer("pointermove",60,60);act(()=>{vi.advanceTimersToNextFrame();});
      pointer("pointercancel",60,60);act(()=>{vi.advanceTimersByTime(700);});
      expect(item("Skills.txt, text document, read only")).not.toBeNull();
      expect(host.querySelector('[aria-label="Start here.txt, text document, read only"]')).toBeNull();
      expect(placements()).toEqual([]);
    }finally{done();}
  });

  it("ignores a cancel from another finger, and does not drop an item on itself",()=>{
    const {item,under,pointer,done}=setup();
    try{
      const folder=item("Notes, folder, read only");
      down(folder);pointer("pointermove",40,40);
      act(()=>{window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:2}));});
      under(folder);pointer("pointerup",40,40);
      expect(placements()).toEqual([]);
    }finally{done();}
  });

  it("still responds to the keyboard after a drag",()=>{
    const {item,under,pointer,done}=setup();
    try{
      const file=item("Skills.txt, text document, read only");
      down(file);pointer("pointermove",40,40);under(null);pointer("pointerup",40,40);
      act(()=>{file.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true}));});
      act(()=>{file.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1}));});
      expect(file.getAttribute("aria-pressed")).toBe("true");
    }finally{done();}
  });

  it("offers cut, paste and undo as buttons for touch screens",()=>{
    const {host,item,done}=setup();
    try{
      const button=(text:string)=>Array.from(host.querySelectorAll("button")).find(entry=>entry.textContent===text)!;
      expect(button("Paste").disabled).toBe(true);expect(button("Undo move").disabled).toBe(true);
      act(()=>item("Skills.txt, text document, read only").dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1})));
      act(()=>button("Cut").click());
      act(()=>host.querySelector<HTMLButtonElement>('aside [data-finder-folder="notes-folder"]')!.click());
      act(()=>button("Paste").click());
      expect(placements()).toContainEqual({id:"skills-file",parentId:"notes-folder"});
      act(()=>button("Undo move").click());
      expect(placements()).toEqual([]);
    }finally{done();}
  });
});

describe("Finder keyboard moves",()=>{
  it("cuts, pastes and undoes a protected document without changing its content",()=>{
    localStorage.clear();const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
    try{
      act(()=>root.render(<FinderApp/>));
      const file=host.querySelector<HTMLButtonElement>('[aria-label="Skills.txt, text document, read only"]')!;
      act(()=>file.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1})));
      act(()=>file.dispatchEvent(new KeyboardEvent("keydown",{key:"x",ctrlKey:true,bubbles:true,cancelable:true})));
      const notes=host.querySelector<HTMLButtonElement>('aside [data-finder-folder="notes-folder"]')!;
      act(()=>notes.click());
      const surface=host.querySelector<HTMLElement>('section[aria-label="Finder file browser"]')!;
      act(()=>surface.dispatchEvent(new KeyboardEvent("keydown",{key:"v",ctrlKey:true,bubbles:true,cancelable:true})));
      expect(host.querySelector('[aria-label="Skills.txt, text document, read only"]')).not.toBeNull();
      expect(JSON.parse(localStorage.getItem(FINDER_STORAGE_KEY)!).placements).toContainEqual({id:"skills-file",parentId:"notes-folder"});
      act(()=>surface.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true})));
      expect(host.querySelector('[aria-label="Skills.txt, text document, read only"]')).toBeNull();
      expect(JSON.parse(localStorage.getItem(FINDER_STORAGE_KEY)!).placements).toEqual([]);
    }finally{act(()=>root.unmount());host.remove();localStorage.clear();}
  });
});
