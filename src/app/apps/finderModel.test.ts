import { describe, expect, it } from "vitest";
import { descendants, FINDER_APP_IDS, INITIAL_FILES, removeVisitorNode, restoreFiles, ROOT_ID, serializeFiles, uniqueName, type FinderNode } from "./finderModel";

const folder: FinderNode = { id: "visitor-folder", parentId: "notes-folder", name: "Ideas", kind: "folder" };
const note: FinderNode = { id: "visitor-note", parentId: folder.id, name: "Thought.txt", kind: "text", content: "A thought\nWith another line." };
const restore = (nodes: unknown[]) => restoreFiles(JSON.stringify({ version: 1, nodes }));

describe("Finder visitor filesystem", () => {
  it("seeds the five Games shortcuts with allowed app identifiers", () => {
    const games = INITIAL_FILES.find(node => node.id === "games-folder");
    expect(games).toMatchObject({ parentId: ROOT_ID, name: "Games", kind: "folder", protected: true });
    const shortcuts = INITIAL_FILES.filter(node => node.parentId === games?.id);
    expect(shortcuts.map(node => node.appId)).toEqual(["star-patrol", "balloon-bastion", "mossblade", "snake", "falling-sand"]);
    expect(shortcuts.every(node => node.kind === "app" && node.protected && FINDER_APP_IDS.includes(node.appId!))).toBe(true);
  });

  it("keeps an existing visitor Games folder and its descendants on version 1", () => {
    const restored = restore([{ ...folder, parentId: ROOT_ID, name: "Games" }, note, { ...folder, id: "visitor-other", parentId: ROOT_ID, name: "Games (visitor)" }]);
    expect(restored.recovered).toBe(false);
    expect(restored.nodes.find(node => node.id === folder.id)?.name).toBe("Games (visitor 2)");
    expect(restored.nodes.find(node => node.id === note.id)).toEqual(note);
    expect(restored.nodes.find(node => node.id === "games-folder")?.name).toBe("Games");
  });

  it("round-trips nested visitor notes without persisting or replacing portfolio content", () => {
    const serialized = serializeFiles([...INITIAL_FILES, folder, note]);
    expect(JSON.parse(serialized).nodes).toHaveLength(2);
    const restored = restoreFiles(serialized);
    expect(restored.recovered).toBe(false);
    expect(restored.nodes).toEqual([...INITIAL_FILES, folder, note]);
  });

  it("preserves only the allowed fields in visitor records", () => {
    const restored = restore([{ ...folder, protected: true, appId: "calculator" }, note]);
    expect(restored.recovered).toBe(false);
    expect(restored.nodes.find(node => node.id === folder.id)).toEqual(folder);
  });

  it.each([
    ["cyclic folder ancestry", [{ ...folder, parentId: "visitor-second" }, { ...folder, id: "visitor-second", parentId: folder.id, name: "Loop" }]],
    ["self parenting", [{ ...folder, parentId: folder.id }]],
    ["missing parent", [{ ...folder, parentId: "missing" }]],
    ["a document used as a folder", [{ ...folder, parentId: "about-file" }]],
    ["duplicate identifiers", [folder, { ...note, id: folder.id }]],
    ["a protected identifier", [{ ...note, id: "about-file", parentId: ROOT_ID }]],
    ["an injected app shortcut", [{ ...note, kind: "app", appId: "calculator" }]],
    ["a duplicate sibling name", [{ ...folder, parentId: ROOT_ID, name: "PROJECTS" }]],
    ["an invalid filename", [{ ...folder, name: "../Ideas" }]],
    ["an oversized document", [folder, { ...note, content: "x".repeat(30_001) }]],
  ])("rejects %s and restores the original portfolio", (_reason, nodes) => {
    const restored = restore(nodes);
    expect(restored.recovered).toBe(true);
    expect(restored.nodes).toEqual(INITIAL_FILES);
  });

  it("accepts a child stored before its parent", () => {
    expect(restore([note, folder]).recovered).toBe(false);
  });

  it("rejects malformed and unknown storage formats", () => {
    for (const raw of ["{bad json", "null", "[]", '{"version":2,"nodes":[]}', '{"version":1,"nodes":{}}']) {
      expect(restoreFiles(raw).recovered).toBe(true);
    }
    expect(restoreFiles(null).recovered).toBe(false);
  });

  it("recursively removes a visitor folder while protecting original content", () => {
    const nodes = [...INITIAL_FILES, folder, note];
    expect(descendants(nodes, folder.id)).toEqual([note]);
    expect(removeVisitorNode(nodes, folder.id)).toEqual(INITIAL_FILES);
    expect(removeVisitorNode(nodes, "notes-folder")).toBe(nodes);
  });

  it("chooses available names within the current folder, without case collisions", () => {
    const nodes = [...INITIAL_FILES, { ...note, parentId: "notes-folder", name: "UNTITLED.TXT" }];
    expect(uniqueName(nodes, "notes-folder", "text")).toBe("Untitled 2.txt");
    expect(uniqueName(nodes, ROOT_ID, "text")).toBe("Untitled.txt");
  });
});

describe("Finder drag moves",()=>{
  it("moves a folder with descendants without changing any file content",async()=>{
    const {moveFinderNode}=await import("./finderModel");const nodes=[...INITIAL_FILES,folder,note];
    const moved=moveFinderNode(nodes,folder.id,ROOT_ID);expect(moved.find(node=>node.id===folder.id)?.parentId).toBe(ROOT_ID);expect(moved.find(node=>node.id===note.id)).toEqual(note);
    expect(moveFinderNode(nodes,folder.id,folder.id)).toBe(nodes);
  });
  it("saves original file placements while keeping original content immutable",async()=>{
    const {moveFinderNode}=await import("./finderModel");const moved=moveFinderNode([...INITIAL_FILES,folder],"skills-file",folder.id);
    const restored=restoreFiles(serializeFiles(moved));expect(restored.recovered).toBe(false);expect(restored.nodes.find(node=>node.id==="skills-file")).toEqual({...INITIAL_FILES.find(node=>node.id==="skills-file"),parentId:folder.id});
    expect(removeVisitorNode(moved,folder.id)).toBe(moved);
  });
  const chain=(length:number)=>Array.from({length},(_,i):FinderNode=>({id:`visitor-deep${i}`,parentId:i?`visitor-deep${i-1}`:ROOT_ID,name:`Deep ${i}`,kind:"folder"}));
  it("keeps notes from an older save that nests deeper than five, across every reload",async()=>{
    const {finderMoveError,moveFinderNode}=await import("./finderModel");
    const deep=chain(7),buried:FinderNode={id:"visitor-buried",parentId:"visitor-deep6",name:"Buried.txt",kind:"text",content:"keep me"};
    const first=restore([...deep,buried]);expect(first.recovered).toBe(false);
    const second=restoreFiles(serializeFiles(first.nodes));expect(second.recovered).toBe(false);
    expect(second.nodes.find(node=>node.id===buried.id)?.content).toBe("keep me");
    expect(finderMoveError(second.nodes,"about-file","notes-folder")).toBeNull();
    expect(moveFinderNode(second.nodes,buried.id,ROOT_ID).find(node=>node.id===buried.id)?.parentId).toBe(ROOT_ID);
    expect(finderMoveError(second.nodes,"projects-folder","visitor-deep3")).toMatch(/5 levels/);
  });
  it("leaves a visitor Games folder alone once the original has been moved away",async()=>{
    const {moveFinderNode}=await import("./finderModel");
    const moved=moveFinderNode(INITIAL_FILES,"games-folder","notes-folder");
    const own:FinderNode={...folder,id:"visitor-own",parentId:ROOT_ID,name:"Games"};
    const restored=restoreFiles(serializeFiles([...moved,own]));
    expect(restored.recovered).toBe(false);expect(restored.nodes.find(node=>node.id===own.id)?.name).toBe("Games");
  });
  it("rejects cycles made from original folder placements and keeps stored data out of originals",()=>{
    const cycle=JSON.stringify({version:2,nodes:[],placements:[{id:"projects-folder",parentId:"noteception-folder"}]});
    expect(restoreFiles(cycle).recovered).toBe(true);
    const forged=JSON.stringify({version:2,nodes:[{id:"about-file",parentId:ROOT_ID,name:"About.txt",kind:"text",content:"forged"}],placements:[]});
    expect(restoreFiles(forged).nodes.find(node=>node.id==="about-file")?.content).not.toBe("forged");
  });
  it("checks the destination depth including the dragged subtree",async()=>{
    const {finderMoveError}=await import("./finderModel");const deep=Array.from({length:4},(_,i)=>({...folder,id:`visitor-depth${i}`,name:`Level ${i+1}`,parentId:i?`visitor-depth${i-1}`:"notes-folder"}));
    expect(finderMoveError([...INITIAL_FILES,folder,...deep],folder.id,"visitor-depth3")).toMatch(/5 levels/);
  });
});
