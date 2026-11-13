import {reparentError,type TreeEntry} from "./folderTree";
export type FileItem={id:string;label:string;app:string;type?:"file"|"folder";x:number;y:number};
export type FolderItem=FileItem&{windowId?:string};
export type DesktopFolder={label:string;items:FolderItem[]};
export type DesktopFolders=Record<string,DesktopFolder>;
export const FOLDER_STORAGE_KEY="nx-folders-v1";
const ITEM_ID=/^[a-zA-Z0-9-]{1,100}$/;
const CUSTOM_FOLDER="desk-folder-";

export function desktopTree(folders:DesktopFolders,desktop:FileItem[],trash:FileItem[]):TreeEntry[]{
  const entries=new Map<string,TreeEntry>([["desktop",{id:"desktop",parentId:null,folder:true}]]);
  for(const id of Object.keys(folders))entries.set(id,{id,parentId:"desktop",folder:true});
  for(const item of [...desktop,...trash])entries.set(item.id,{id:item.id,parentId:"desktop",folder:item.type==="folder"});
  for(const [parentId,folder] of Object.entries(folders))for(const item of folder.items)entries.set(item.id,{id:item.id,parentId,folder:item.type==="folder"});
  return [...entries.values()];
}
export function desktopMoveError(folders:DesktopFolders,desktop:FileItem[],trash:FileItem[],ids:string[],target:string):string|null{
  const invalid=reparentError(desktopTree(folders,desktop,trash),ids,target);if(invalid)return invalid;
  const source=[...desktop,...trash,...Object.values(folders).flatMap(folder=>folder.items)];
  const targetItems=target==="desktop"?desktop:folders[target]?.items??[];
  if(ids.some(id=>{const item=source.find(node=>node.id===id);return item&&targetItems.some(other=>other.id!==id&&!ids.includes(other.id)&&other.label.toLowerCase()===item.label.toLowerCase());}))return "An item here already has that name.";
  return null;
}

/** A stored item keeps only known fields, and may only name a real app or a real folder. */
function storedItem(value:unknown,folderIds:ReadonlySet<string>,apps:ReadonlySet<string>):FileItem|null{
  if(!value||typeof value!=="object")return null;
  const item=value as Record<string,unknown>;
  if(typeof item.id!=="string"||!ITEM_ID.test(item.id)||typeof item.label!=="string"||!item.label.trim()||item.label.length>64||typeof item.app!=="string"||!Number.isFinite(item.x)||!Number.isFinite(item.y))return null;
  if(item.type==="folder"?!folderIds.has(item.id)||item.app!==item.id:folderIds.has(item.id)||!apps.has(item.app))return null;
  return {id:item.id,label:item.label,app:item.app,type:item.type==="folder"?"folder":item.type==="file"?"file":undefined,x:Math.max(8,Math.min(2000,item.x as number)),y:Math.max(8,Math.min(2000,item.y as number))};
}
function storedList(raw:string|null):unknown[]{
  try{const data:unknown=raw?JSON.parse(raw):[];return Array.isArray(data)?data:[];}catch{return [];}
}

/** Restore layout only; stored data cannot introduce executable apps or cyclic folders. */
export function restoreDesktopFolders(raw:string|null,defaults:DesktopFolders,apps:ReadonlySet<string>):DesktopFolders{
  if(!raw||raw.length>500_000)return defaults;
  try{
    const data:unknown=JSON.parse(raw);
    if(!data||typeof data!=="object"||Array.isArray(data))return defaults;
    const pairs=Object.entries(data);if(pairs.length>200||Object.keys(defaults).some(id=>!Object.hasOwn(data,id)))return defaults;
    const ids=new Set(pairs.map(([id])=>id)),used=new Set<string>();
    const result:DesktopFolders={};
    for(const [id,value] of pairs){
      if(!ITEM_ID.test(id)||!value||typeof value!=="object")return defaults;
      const folder=value as DesktopFolder;
      if(typeof folder.label!=="string"||!folder.label.trim()||folder.label.length>64||!Array.isArray(folder.items)||folder.items.length>200)return defaults;
      const items:FolderItem[]=[];
      for(const entry of folder.items){
        const item=storedItem(entry,ids,apps);
        if(!item||used.has(item.id))return defaults;
        used.add(item.id);items.push({...item,windowId:item.app});
      }
      result[id]={label:folder.label,items};
    }
    const tree=desktopTree(result,[],[]);
    for(const entry of tree)if(entry.parentId&&reparentError(tree,[entry.id],entry.parentId))return defaults;
    return result;
  }catch{return defaults;}
}

/** Trash holds each identity once; a copy that is also inside a folder stays in the folder. */
export function restoreDesktopTrash(raw:string|null,folders:DesktopFolders,apps:ReadonlySet<string>):FileItem[]{
  const folderIds=new Set(Object.keys(folders));
  const seen=new Set(Object.values(folders).flatMap(folder=>folder.items.map(item=>item.id)));
  const items:FileItem[]=[];
  for(const value of storedList(raw).slice(0,500)){
    const item=storedItem(value,folderIds,apps);
    if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}
  }
  return items;
}

/**
 * Rebuild the desktop from one position list per screen layout. Folders and Trash decide where
 * an item lives, so nothing moved into them comes back. Items moved out to the desktop survive
 * a reload and a change of layout, and a custom folder is never left without an icon.
 */
export function restoreDesktopIcons(raw:string|null,otherLayouts:readonly (string|null)[],base:readonly FileItem[],folders:DesktopFolders,trash:readonly FileItem[],apps:ReadonlySet<string>):FileItem[]{
  const folderIds=new Set(Object.keys(folders));
  const placed=new Set([...trash.map(item=>item.id),...Object.values(folders).flatMap(folder=>folder.items.map(item=>item.id))]);
  const baseIds=new Set(base.map(item=>item.id));
  const saved=storedList(raw);
  const positions=new Map<string,{x:number;y:number}>();
  for(const value of saved){
    const item=value as {id?:unknown;x?:unknown;y?:unknown}|null;
    if(typeof item?.id==="string"&&Number.isFinite(item.x)&&Number.isFinite(item.y))positions.set(item.id,{x:item.x as number,y:item.y as number});
  }
  const icons:FileItem[]=base.filter(item=>!placed.has(item.id)).map(item=>({...item,...positions.get(item.id)}));
  for(const value of [...saved,...otherLayouts.flatMap(storedList)]){
    const item=storedItem(value,folderIds,apps);
    if(item&&!baseIds.has(item.id)&&!placed.has(item.id)){placed.add(item.id);icons.push(item);}
  }
  for(const id of folderIds)if(id.startsWith(CUSTOM_FOLDER)&&!placed.has(id)&&!icons.some(item=>item.id===id)){
    icons.push({id,label:folders[id].label,app:id,type:"folder",x:40+icons.length%5*104,y:60+Math.floor(icons.length/5)*104});
  }
  return icons;
}

/** Permanently deleting a custom folder also deletes the custom folders inside it. */
export function purgeDesktopFolders(folders:DesktopFolders,ids:readonly string[]):DesktopFolders{
  const next={...folders};
  const remove=(id:string)=>{
    const folder=next[id];
    if(!folder||!id.startsWith(CUSTOM_FOLDER))return;
    delete next[id];
    for(const item of folder.items)if(item.type==="folder")remove(item.id);
  };
  ids.forEach(remove);
  return next;
}

/** "Name", "Name copy", "Name copy 2"… unique (case-insensitive) among the target's items. */
export function copyLabel(label:string,taken:readonly {label:string}[]){
  const used=new Set(taken.map(item=>item.label.toLowerCase()));
  if(!used.has(label.toLowerCase()))return label;
  // Copies of copies count up ("copy 2") instead of stacking "copy copy".
  const base=`${label.replace(/\s+copy(?:\s+\d+)?$/i,"").slice(0,55)} copy`;
  if(!used.has(base.toLowerCase()))return base;
  for(let n=2;;n++){const next=`${base} ${n}`;if(!used.has(next.toLowerCase()))return next;}
}

/**
 * Deep copies for Paste. Files get new identities pointing at the same app; folders get new
 * custom folders with copied contents. Only the top-level copies are renamed to stay unique.
 */
export function copyFileItems(folders:DesktopFolders,items:readonly FileItem[],targetItems:readonly {label:string}[],newId:()=>string){
  const added:DesktopFolders={};const taken=[...targetItems];
  const copyFolder=(sourceId:string,label:string):string=>{
    const id=`${CUSTOM_FOLDER}${newId()}`;
    const children=(folders[sourceId]?.items??[]).map(child=>{
      const copy:FolderItem=child.type==="folder"?{...child,id:"",app:""}:{...child,id:`copy-${newId()}`};
      if(child.type==="folder"){copy.id=copyFolder(child.id,child.label);copy.app=copy.id;}
      copy.windowId=copy.type==="folder"?copy.id:child.windowId??child.app;
      return copy;
    });
    added[id]={label,items:children};
    return id;
  };
  const copies=items.map(item=>{
    const label=copyLabel(item.label,taken);taken.push({label});
    if(item.type==="folder"){const id=copyFolder(item.id,label);return {...item,id,app:id,label};}
    return {...item,id:`copy-${newId()}`,label};
  });
  return {folders:added,copies};
}
