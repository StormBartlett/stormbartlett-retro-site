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
