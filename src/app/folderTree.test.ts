import {describe,expect,it} from "vitest";
import {folderDepth,reparentError,type TreeEntry} from "./folderTree";
import {desktopMoveError,purgeDesktopFolders,restoreDesktopFolders,restoreDesktopIcons,restoreDesktopTrash,type DesktopFolders} from "./desktopFiles";
const tree:TreeEntry[]=[{id:"root",parentId:null,folder:true},...Array.from({length:5},(_,i)=>({id:`f${i+1}`,parentId:i?`f${i}`:"root",folder:true})),{id:"other",parentId:"root",folder:true},{id:"note",parentId:"other",folder:false}];
describe("native folder moves",()=>{
 it("accepts five nested folders and files inside the fifth",()=>{expect(folderDepth(tree,"f5")).toBe(5);expect(reparentError(tree,["note"],"f5")).toBeNull();});
 it("rejects a sixth folder and a subtree that would exceed five",()=>{expect(reparentError(tree,["other"],"f5")).toMatch(/5 levels/);expect(reparentError(tree,["f1"],"other")).toMatch(/5 levels/);});
 it("rejects self parenting, descendant parenting and a missing folder",()=>{expect(reparentError(tree,["f1"],"f3")).toMatch(/itself/);expect(reparentError(tree,["f1"],"f1")).toMatch(/itself/);expect(reparentError(tree,["note"],"missing")).toMatch(/folder/);});
 it("allows pulling an intact subtree back to root",()=>{expect(reparentError(tree,["f3"],"root")).toBeNull();});
 const folders:DesktopFolders={projects:{label:"Projects",items:[]},games:{label:"Games",items:[{id:"game-one",label:"Star Patrol",app:"star-patrol",x:20,y:20} ]}};
 const apps=new Set(["star-patrol","projects","games"]);
 it("persists app identity in folders and rejects executable injection",()=>{const restored=restoreDesktopFolders(JSON.stringify(folders),folders,apps);expect(restored.games.items[0]).toMatchObject({id:"game-one",app:"star-patrol",type:undefined});const bad=structuredClone(folders);bad.games.items[0].app="injected";expect(restoreDesktopFolders(JSON.stringify(bad),folders,apps)).toBe(folders);});
 it("rejects cyclic stored layouts",()=>{const bad=structuredClone(folders);bad.projects.items.push({id:"games",label:"Games",app:"games",type:"folder",x:20,y:20});bad.games.items.push({id:"projects",label:"Projects",app:"projects",type:"folder",x:20,y:20});expect(restoreDesktopFolders(JSON.stringify(bad),folders,apps)).toBe(folders);});
 it("keeps app identity on an item moved out of a folder, across a reload",()=>{
  const app={id:"game-one",label:"Star Patrol",app:"star-patrol",x:20,y:20};const emptied={...folders,games:{...folders.games,items:[]}};
  expect(desktopMoveError(emptied,[app],[],[app.id],"desktop")).toBeNull();
  const icons=restoreDesktopIcons(JSON.stringify([{...app,x:300,y:200}]),[],[],emptied,[],apps);
  expect(icons).toEqual([{...app,x:300,y:200,type:undefined}]);
 });
 it("rejects duplicate target names",()=>{const app={id:"other",label:"Star Patrol",app:"star-patrol",x:20,y:20};expect(desktopMoveError(folders,[app],[],[app.id],"games")).toMatch(/already/);});
 it("counts nested folders in a moved subtree and a cycle only once",()=>{
  expect(reparentError(tree,["f1","f2"],"other")).toBeNull();
  const looped:TreeEntry[]=[...tree,{id:"a",parentId:"b",folder:true},{id:"b",parentId:"a",folder:true}];
  expect(reparentError(looped,["note"],"a")).toMatch(/itself/);expect(reparentError(looped,["a"],"other")).toBeNull();
 });
 it("still allows moves in a tree that is already too deep, but never deeper",()=>{
  const deep:TreeEntry[]=[...tree,{id:"f6",parentId:"f5",folder:true},{id:"f7",parentId:"f6",folder:true}];
  expect(folderDepth(deep,"f7")).toBe(7);expect(reparentError(deep,["note"],"f1")).toBeNull();
  expect(reparentError(deep,["f6"],"f2")).toBeNull();expect(reparentError(deep,["other"],"f6")).toMatch(/5 levels/);
 });
 const base=[{id:"about",label:"About",app:"star-patrol",x:32,y:44},{id:"projects",label:"Projects",app:"projects",type:"folder" as const,x:152,y:44}];
 it("does not bring back an item moved into a folder or the Trash",()=>{
  const inFolder={...folders,games:{...folders.games,items:[{id:"about",label:"About",app:"star-patrol",x:1,y:1}]}};
  const saved=JSON.stringify(base);
  expect(restoreDesktopIcons(saved,[],base,inFolder,[],apps).map(item=>item.id)).toEqual(["projects"]);
  expect(restoreDesktopIcons(saved,[],base,folders,[base[1]],apps).map(item=>item.id)).toEqual(["about"]);
  expect(restoreDesktopIcons(null,[JSON.stringify([{id:"game-one",label:"Star Patrol",app:"star-patrol",x:1,y:1}])],[],folders,[],apps)).toEqual([]);
 });
 it("shows a moved item on every screen layout and keeps saved positions",()=>{
  const moved={id:"cabinet-one",label:"One",app:"star-patrol",x:60,y:60};
  const icons=restoreDesktopIcons(JSON.stringify([{...base[0],x:400,y:500}]),[JSON.stringify([moved])],base,folders,[],apps);
  expect(icons.map(item=>item.id)).toEqual(["about","projects","cabinet-one"]);expect(icons[0]).toMatchObject({x:400,y:500});
 });
 it("restores custom folders from storage without losing or inventing them",()=>{
  const id="desk-folder-1";const withCustom:DesktopFolders={...folders,[id]:{label:"Mine",items:[{id:"nested",label:"Nested",app:"star-patrol",x:20,y:20}]}};
  const restored=restoreDesktopFolders(JSON.stringify(withCustom),folders,apps);
  expect(restored[id].items[0]).toMatchObject({id:"nested",app:"star-patrol"});
  const icon={id,label:"Mine",app:id,type:"folder",x:90,y:90};
  expect(restoreDesktopIcons(JSON.stringify([icon]),[],[],restored,[],apps)).toEqual([icon]);
  expect(restoreDesktopIcons(null,[],[],restored,[],apps).map(item=>item.id)).toEqual([id]);
  expect(restoreDesktopIcons(JSON.stringify([icon]),[],[],folders,[],apps)).toEqual([]);
 });
 it("rejects stored app shortcuts that are not real apps, on the desktop and in the Trash",()=>{
  const fake=[{id:"bad",label:"Bad",app:"injected",x:1,y:1},{id:"games",label:"Games",app:"star-patrol",x:1,y:1},{id:"ghost",label:"Ghost",app:"ghost",type:"folder",x:1,y:1},{id:"../x",label:"X",app:"star-patrol",x:1,y:1}];
  expect(restoreDesktopIcons(JSON.stringify(fake),[],[],folders,[],apps)).toEqual([]);
  expect(restoreDesktopTrash(JSON.stringify(fake),folders,apps)).toEqual([]);
  const shadow=structuredClone(folders);shadow.projects.items.push({id:"games",label:"Games",app:"star-patrol",x:1,y:1});
  expect(restoreDesktopFolders(JSON.stringify(shadow),folders,apps)).toBe(folders);
 });
 it("keeps one identity between Trash and folders, and survives bad Trash data",()=>{
  const trashed={id:"game-one",label:"Star Patrol",app:"star-patrol",x:20,y:20},other={id:"loose",label:"Loose",app:"star-patrol",x:20,y:20};
  expect(restoreDesktopTrash(JSON.stringify([trashed,other,other]),folders,apps).map(item=>item.id)).toEqual(["loose"]);
  expect(restoreDesktopTrash("{bad",folders,apps)).toEqual([]);expect(restoreDesktopTrash(null,folders,apps)).toEqual([]);
 });
 it("purges only custom folders and the custom folders inside them",()=>{
  const a="desk-folder-a",b="desk-folder-b",c="desk-folder-c";
  const all:DesktopFolders={...folders,[a]:{label:"A",items:[{id:b,label:"B",app:b,type:"folder",x:1,y:1}]},[b]:{label:"B",items:[]},[c]:{label:"C",items:[]}};
  expect(Object.keys(purgeDesktopFolders(all,[a,"projects"])).sort()).toEqual(["desk-folder-c","games","projects"]);
 });
});
