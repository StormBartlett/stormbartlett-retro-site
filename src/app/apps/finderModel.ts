export const FINDER_APP_IDS = ["falling-sand", "calculator", "activity", "todo", "star-patrol", "balloon-bastion", "mossblade", "snake"] as const;
export type FinderAppId = typeof FINDER_APP_IDS[number];

export type FinderNode = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "folder" | "text" | "app";
  content?: string;
  appId?: FinderAppId;
  protected?: boolean;
};

export const FINDER_STORAGE_KEY = "storm-finder-v1";
export const ROOT_ID = "disk";
export const MAX_NOTES_LENGTH = 30_000;
export const MAX_VISITOR_ITEMS = 150;

const core = (node: FinderNode): FinderNode => ({ ...node, protected: true });

export const INITIAL_FILES: FinderNode[] = [
  core({ id: ROOT_ID, parentId: null, name: "Storm's Mac", kind: "folder" }),
  core({ id: "about-file", parentId: ROOT_ID, name: "About.txt", kind: "text", content: "STORM BARTLETT\nSoftware Developer · UNSW\n\nI'm a front-end-focused software engineer who builds interfaces for technical systems and works across the full stack when the problem needs it.\n\nMy work includes React/Next.js product architecture at Noteception, visualisation for simulation and data-heavy tooling, and AI/search-backed interfaces.\n\nI care about clear component boundaries, fast interfaces, reliable data flow, tests, and documentation.\n\nABOUT THIS MAC\nA personal portfolio built with Next.js, React, TypeScript and Three.js. Open Projects to explore my work, or Playground to try the apps.\n\nYou can also make folders and write notes here. Your creations stay in this browser." }),
  core({ id: "skills-file", parentId: ROOT_ID, name: "Skills.txt", kind: "text", content: "FRONT END\nReact · Next.js · TypeScript · JavaScript · HTML · CSS/Sass · Tailwind\nComponent architecture, accessible interfaces, performance profiling, dashboards, search-backed UI and Chrome extensions.\n\nAI & PRODUCT SYSTEMS\nAI service integration, transcript and note workflows, indexed search, evaluation harnesses and regression suites.\n\nBACK END & DATA\nNode.js/Express · Python/Flask/Django · REST · WebSockets · JWT/OAuth\nPostgreSQL · MongoDB · SQL · Firebase Firestore · ETL/data pipelines\n\nSIMULATION & VISUALISATION\nJava parallel genetic algorithms, clustering optimisation, Rust/WGPU physics simulation, Three.js, Matplotlib and scikit-learn.\n\nENGINEERING\nGit/GitHub · GitHub Actions · Docker · Linux · CI/CD\nAutomated testing, code review, ADRs and documentation." }),
  core({ id: "projects-folder", parentId: ROOT_ID, name: "Projects", kind: "folder" }),
  core({ id: "noteception-folder", parentId: "projects-folder", name: "Noteception", kind: "folder" }),
  core({ id: "noteception-readme", parentId: "noteception-folder", name: "Read me.txt", kind: "text", content: "NOTECEPTION\n\nReact/Next.js product architecture, AI-backed transcript and note workflows, and search-backed interfaces.\n\nThe engineering thread: turn complex workflows into software that stays understandable under real use, with reliable data flow and clear component boundaries." }),
  core({ id: "sand-project-folder", parentId: "projects-folder", name: "Falling Sand Game", kind: "folder" }),
  core({ id: "sand-readme", parentId: "sand-project-folder", name: "Read me.txt", kind: "text", content: "FALLING SAND GAME\nWorking title · In development\n\nA falling-sand simulation crossed with a mining game, written in Rust. Every pixel is a cell: sand piles, water flows, lava ignites wood and steam rises when water and lava meet.\n\nThe simulation runs on the GPU via compute shaders. The mining layer sits on top of the simulation: tunnels collapse and fluids drain into what you dig.\n\nThe Playground folder includes a separate browser-based falling-sand experiment you can try here." }),
  core({ id: "portfolio-project-folder", parentId: "projects-folder", name: "This Portfolio", kind: "folder" }),
  core({ id: "portfolio-readme", parentId: "portfolio-project-folder", name: "Read me.txt", kind: "text", content: "A MAC INSIDE YOUR BROWSER\n\nNext.js · React · TypeScript · Three.js\n\nA retro desktop with a 3D computer, windowed apps, a TipTap/ProseMirror editor with custom Vim behaviour, and an interactive falling-sand simulation.\n\nFinder is its own tiny filesystem. Open folders, search, and make text files. Visitor files are stored locally in your browser." }),
  core({ id: "playground-folder", parentId: ROOT_ID, name: "Playground", kind: "folder" }),
  core({ id: "sand-app", parentId: "playground-folder", name: "Falling Sand", kind: "app", appId: "falling-sand" }),
  core({ id: "calculator-app", parentId: "playground-folder", name: "Calculator", kind: "app", appId: "calculator" }),
  core({ id: "activity-app", parentId: "playground-folder", name: "Activity Monitor", kind: "app", appId: "activity" }),
  core({ id: "todo-app", parentId: "playground-folder", name: "Notes & To-dos", kind: "app", appId: "todo" }),
  core({ id: "games-folder", parentId: ROOT_ID, name: "Games", kind: "folder" }),
  core({ id: "star-patrol-app", parentId: "games-folder", name: "Star Patrol", kind: "app", appId: "star-patrol" }),
  core({ id: "balloon-bastion-app", parentId: "games-folder", name: "Balloon Bastion", kind: "app", appId: "balloon-bastion" }),
  core({ id: "mossblade-app", parentId: "games-folder", name: "Mossblade", kind: "app", appId: "mossblade" }),
  core({ id: "snake-game-app", parentId: "games-folder", name: "Snake", kind: "app", appId: "snake" }),
  core({ id: "sand-game-app", parentId: "games-folder", name: "Falling Sand", kind: "app", appId: "falling-sand" }),
  core({ id: "notes-folder", parentId: ROOT_ID, name: "Notes", kind: "folder" }),
  core({ id: "notes-welcome", parentId: "notes-folder", name: "Start here.txt", kind: "text", content: "YOUR LITTLE CORNER\n\nMake a note, invent a folder, leave yourself a thought. Use + Note or + Folder to start.\n\nClick an item to select it. Double-click to open; on a touch screen, just tap. Enter opens the selected item, and Delete removes visitor-created items.\n\nYour notes save automatically in this browser. They are private to this browser profile and aren't sent anywhere. Clearing site data removes them.\n\nThe original portfolio files are read-only so there is always a way back home." }),
];

export function validName(name: string): boolean {
  return name.length > 0 && name.length <= 64 && name === name.trim() && !/[\\/\u0000-\u001f\u007f]/.test(name) && name !== "." && name !== "..";
}

export function descendants(nodes: FinderNode[], parentId: string): FinderNode[] {
  const result: FinderNode[] = [];
  const parents = new Set([parentId]);
  for (let round = 0; round < nodes.length; round++) {
    let changed = false;
    for (const node of nodes) {
      if (node.parentId && parents.has(node.parentId) && !parents.has(node.id)) {
        parents.add(node.id);
        result.push(node);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

/** Persist only visitor content; a stored payload can never replace portfolio files. */
export function restoreFiles(raw: string | null): { nodes: FinderNode[]; recovered: boolean } {
  const fallback = { nodes: [...INITIAL_FILES], recovered: raw !== null };
  if (raw === null) return fallback;
  try {
    if (raw.length > 4_700_000) return fallback;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("nodes" in data) || !Array.isArray(data.nodes) || data.nodes.length > MAX_VISITOR_ITEMS) return fallback;
    const visitors: FinderNode[] = [];
    const usedIds = new Set(INITIAL_FILES.map(node => node.id));
    for (const item of data.nodes as unknown[]) {
      if (!item || typeof item !== "object") return fallback;
      const node = item as Record<string, unknown>;
      if (typeof node.id !== "string" || !/^visitor-[a-zA-Z0-9-]{1,90}$/.test(node.id) || usedIds.has(node.id) || typeof node.parentId !== "string" || typeof node.name !== "string" || !validName(node.name) || (node.kind !== "folder" && node.kind !== "text")) return fallback;
      if (node.kind === "text" && (typeof node.content !== "string" || node.content.length > MAX_NOTES_LENGTH)) return fallback;
      usedIds.add(node.id);
      visitors.push({ id: node.id, parentId: node.parentId, name: node.name, kind: node.kind, ...(node.kind === "text" ? { content: node.content as string } : {}) });
    }
    // The Games folder was added to version 1. Keep a visitor's older folder
    // (and all its children) if they already used that name on the root disk.
    const oldGames = visitors.find(node => node.parentId === ROOT_ID && node.name.toLowerCase() === "games");
    if (oldGames) {
      const rootNames = new Set([...INITIAL_FILES, ...visitors].filter(node => node.parentId === ROOT_ID).map(node => node.name.toLowerCase()));
      let name = "Games (visitor)";
      for (let suffix = 2; rootNames.has(name.toLowerCase()); suffix++) name = `Games (visitor ${suffix})`;
      oldGames.name = name;
    }
    const all = [...INITIAL_FILES, ...visitors];
    const byId = new Map(all.map(node => [node.id, node]));
    const names = new Set<string>();
    for (const node of all) {
      const nameKey = `${node.parentId}\0${node.name.toLowerCase()}`;
      if (names.has(nameKey)) return fallback;
      names.add(nameKey);
    }
    for (const node of visitors) {
      let parent = byId.get(node.parentId!);
      const seen = new Set([node.id]);
      while (parent && parent.id !== ROOT_ID) {
        if (parent.kind !== "folder" || seen.has(parent.id)) return fallback;
        seen.add(parent.id);
        parent = byId.get(parent.parentId!);
      }
      if (!parent) return fallback;
    }
    return { nodes: all, recovered: false };
  } catch {
    return fallback;
  }
}

export function serializeFiles(nodes: FinderNode[]): string {
  return JSON.stringify({ version: 1, nodes: nodes.filter(node => !node.protected) });
}

export function uniqueName(nodes: FinderNode[], parentId: string, kind: "folder" | "text"): string {
  const base = kind === "folder" ? "Untitled folder" : "Untitled";
  const extension = kind === "text" ? ".txt" : "";
  const names = new Set(nodes.filter(node => node.parentId === parentId).map(node => node.name.toLowerCase()));
  for (let count = 1; ; count++) {
    const name = `${base}${count === 1 ? "" : ` ${count}`}${extension}`;
    if (!names.has(name.toLowerCase())) return name;
  }
}

export function removeVisitorNode(nodes: FinderNode[], id: string): FinderNode[] {
  const node = nodes.find(item => item.id === id);
  if (!node || node.protected) return nodes;
  const removed = new Set([id, ...descendants(nodes, id).map(item => item.id)]);
  return nodes.filter(item => !removed.has(item.id));
}
