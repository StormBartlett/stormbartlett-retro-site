import {describe,expect,it} from "vitest";
import {copyFileItems,copyLabel,restoreDesktopFolders,type DesktopFolders} from "./desktopFiles";

describe("copy and paste",()=>{
  it("names copies uniquely without touching the original",()=>{
    expect(copyLabel("Notes",[])).toBe("Notes");
    expect(copyLabel("Notes",[{label:"notes"}])).toBe("Notes copy");
    expect(copyLabel("Notes",[{label:"Notes"},{label:"Notes copy"},{label:"Notes copy 2"}])).toBe("Notes copy 3");
    expect(copyLabel("Notes copy",[{label:"Notes"},{label:"Notes copy"}])).toBe("Notes copy 2");
  });

  it("deep-copies folders with fresh identities that survive a reload",()=>{
    const folders:DesktopFolders={
      "desk-folder-a":{label:"A",items:[{id:"skills",label:"Skills.txt",app:"skills",type:"file",x:20,y:20,windowId:"skills"},{id:"desk-folder-b",label:"B",app:"desk-folder-b",type:"folder",x:130,y:20,windowId:"desk-folder-b"}]},
      "desk-folder-b":{label:"B",items:[{id:"about",label:"About",app:"about-portfolio",type:"file",x:20,y:20,windowId:"about-portfolio"}]},
    };
    let n=0;const {folders:added,copies}=copyFileItems(folders,[{id:"desk-folder-a",label:"A",app:"desk-folder-a",type:"folder",x:0,y:0}],[{label:"A"}],()=>`id${++n}`);
    expect(copies).toHaveLength(1);expect(copies[0].label).toBe("A copy");
    expect(copies[0].id).toMatch(/^desk-folder-/);expect(copies[0].app).toBe(copies[0].id);
    const copy=added[copies[0].id];expect(copy.items.map(item=>item.label)).toEqual(["Skills.txt","B"]);
    const nested=copy.items[1];expect(nested.id).not.toBe("desk-folder-b");expect(added[nested.id].items[0].app).toBe("about-portfolio");
    // Originals are unchanged, and the copies pass the stored-layout validation.
    expect(folders["desk-folder-a"].items[1].id).toBe("desk-folder-b");
    const merged={...folders,...added};
    expect(restoreDesktopFolders(JSON.stringify(merged),merged,new Set(["skills","about-portfolio"]))).toEqual(merged);
  });
});
