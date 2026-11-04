export const MAX_FOLDER_DEPTH = 5;
export const NESTING_ERROR = `Folders can nest up to ${MAX_FOLDER_DEPTH} levels.`;
export type TreeEntry = { id: string; parentId: string | null; folder: boolean };

export function folderDepth(entries: readonly TreeEntry[], id: string): number {
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const seen=new Set<string>();let node=byId.get(id),depth=0;
  while(node?.parentId!==null){
    if(!node||!node.folder||seen.has(node.id))return Infinity;
    seen.add(node.id);depth++;node=byId.get(node.parentId!);
  }
  return node?.folder?depth:Infinity;
}

/**
 * Validate the whole moved subtree, not only its root. Root folders have depth zero.
 * Only the moved items count: an older saved tree that is already too deep keeps
 * working, while nothing new can be nested beyond the limit.
 */
export function reparentError(entries: readonly TreeEntry[], ids: readonly string[], targetId: string): string | null {
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  const target=byId.get(targetId);
  if(!target?.folder)return "Choose a folder.";
  const moving=new Set(ids);
  if(!ids.length||ids.some(id=>!byId.has(id)||byId.get(id)?.parentId===null))return "This item cannot be moved.";
  let ancestor:TreeEntry|undefined=target;const seen=new Set<string>();
  while(ancestor){
    if(moving.has(ancestor.id)||seen.has(ancestor.id))return "A folder cannot contain itself.";
    seen.add(ancestor.id);ancestor=ancestor.parentId?byId.get(ancestor.parentId):undefined;
  }
  const targetDepth=folderDepth(entries,targetId);
  const children=new Map<string,TreeEntry[]>();
  for(const entry of entries)if(entry.folder&&entry.parentId&&!moving.has(entry.id))children.set(entry.parentId,[...(children.get(entry.parentId)??[]),entry]);
  // Depth is counted from the target, so a cycle elsewhere in the tree cannot recurse forever.
  const height=(id:string,visited:Set<string>):number=>{
    if(visited.has(id))return 0;visited.add(id);
    return 1+Math.max(0,...(children.get(id)??[]).map(child=>height(child.id,visited)));
  };
  for(const id of ids)if(byId.get(id)?.folder&&targetDepth+height(id,new Set())>MAX_FOLDER_DEPTH)return NESTING_ERROR;
  return targetDepth===Infinity?NESTING_ERROR:null;
}
