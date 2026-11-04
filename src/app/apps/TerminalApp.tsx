"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import styles from "./TerminalApp.module.css";

type TerminalAppProps = { onOpenApp?: (id: string) => void };
type VirtualFile = { kind: "file"; text: string; appId?: string };
type VirtualDirectory = { kind: "directory"; children: Record<string, VirtualNode> };
type VirtualNode = VirtualFile | VirtualDirectory;
type Entry = { id: number; command?: string; path?: string; output: string; tone?: "error" | "success" | "matrix" };

const HOME = "/home/storm";
const COMMANDS = ["help", "ls", "pwd", "cd", "cat", "open", "clear", "history", "whoami", "date", "echo", "matrix"];
const APPS: Record<string, string> = {
  "pixel-studio": "Make a little pixel art",
  "project-tasks": "Plan the next thing",
  finder: "Browse the desktop files",
  "focus-timer": "Make time for one thing",
  "sound-lab": "Explore a few sounds",
  snake: "A tiny arcade detour",
  postcards: "Leave a note on this device",
  games: "Browse the games folder",
  "star-patrol": "Play Star Patrol",
  "balloon-bastion": "Play Balloon Bastion",
  mossblade: "Explore the sleeping grove",
  preferences: "Make the desktop your own",
  playground: "Explore the interactive playground",
  about: "Read About.txt",
  skills: "Read Skills.txt",
  projects: "Explore the projects folder",
  calculator: "Crunch a few numbers",
  "falling-sand": "Play with falling sand",
  activity: "Inspect the desktop activity",
  todo: "Open the desktop to-do list",
};
const APP_ALIASES: Record<string, string> = {
  paint: "pixel-studio", tasks: "project-tasks", files: "finder", timer: "focus-timer",
  sounds: "sound-lab", settings: "preferences",
  guestbook: "postcards",
};
const file = (text: string): VirtualFile => ({ kind: "file", text });
const directory = (children: Record<string, VirtualNode>): VirtualDirectory => ({ kind: "directory", children });
const FILESYSTEM = directory({
  home: directory({
    storm: directory({
      "about.txt": file("Hi, I'm Storm Bartlett, a front-end-focused software engineer who builds interfaces for technical systems and works across the full stack when the problem needs it.\n\nI turn complex workflows into usable software: React/Next.js product architecture at NoteTime, visualisation layers for simulation and data-heavy tooling, and AI/search-backed interfaces.\n\nI care about clear component boundaries, fast UI, reliable data flow, tests, documentation, and understanding the system beyond the front end."),
      "skills.txt": file("FRONT END\nReact · Next.js · TypeScript · JavaScript · HTML · CSS/Sass · Tailwind\nResponsive and accessible UI, component architecture, dashboards, search-backed interfaces, Chrome extensions.\n\nAI & PRODUCT\nAI service integration, transcript/note workflows, indexed search, evaluation harnesses, regression suites.\n\nBACK END & DATA\nNode.js/Express · Python/Flask/Django · REST · WebSockets · JWT/OAuth\nPostgreSQL · MongoDB · SQL · Firebase Firestore · ETL · IoT telemetry\n\nSIMULATION & ENGINEERING\nJava · Rust/WGPU · Three.js · Matplotlib · scikit-learn\nGit/GitHub · GitHub Actions · Docker · Linux · CI/CD · automated testing"),
      "projects.txt": file("NoteTime\nReact/Next.js product architecture and transcript/note workflows.\nhttps://notetime.ai\n\nFalling Sand Game (working title)\nAn in-development Rust simulation crossed with a mining game. GPU compute shaders update the pixel world in parallel.\n\nExplore: cd projects, then ls.\nTry the browser simulation: open falling-sand"),
      "contact.txt": file("Email: stormbartlett@icloud.com\nGitHub: https://github.com/stormbartlett\nLinkedIn: https://www.linkedin.com/in/stormbartlett/\nYouTube: https://www.youtube.com/@stormbartlett64\n\nThese are the contact links listed on the desktop."),
      "readme.txt": file("Welcome to Storm's tiny terminal.\n\nThis is a simulated, read-only filesystem in your browser. It never runs a shell, accesses your computer's files, or sends commands over the network.\n\nTry: cat about\nExplore: cd projects\nLaunch: open pixel-studio\nDiscover: ls -a\n\nTab completes commands, paths and app names. Up/down recall your commands. Ctrl+L clears the screen."),
      projects: directory({
        "notetime.txt": file("NOTETIME\n\nStorm's work includes React/Next.js product architecture, AI service integration, and transcript/note workflows.\n\nTry it at https://notetime.ai."),
        "falling-sand.txt": file("FALLING SAND GAME · WORKING TITLE\nStatus: In development, not yet announced.\n\nA falling-sand simulation crossed with a mining game, written in Rust. Sand piles, water flows, lava ignites wood, and steam rises when water and lava meet.\n\nGPU compute shaders update millions of cells in parallel. Tunnels collapse, fluids drain into what you dig, and ore veins react to heat and pressure.\n\nThe desktop also has a browser sand toy: open falling-sand"),
        portfolio: directory({
          "stack.txt": file("THIS LITTLE DESKTOP\n\nNext.js · React · TypeScript · Three.js\nTipTap/ProseMirror editor with custom Vim behaviour.\nInteractive falling-sand simulation.\nAnd now, a terminal inside a desktop inside a browser.\n\nNo shell required. Just curiosity."),
        }),
      }),
      apps: directory(Object.fromEntries(Object.entries(APPS).map(([id, description]) => [
        `${id}.app`, { kind: "file", text: `${id}\n${description}\n\nLaunch with: open ${id}`, appId: id } satisfies VirtualFile,
      ]))),
      ".secrets.txt": file("A FEW UNDOCUMENTED FEATURES\n\nwhoami\nmatrix\nsudo make me a sandwich\n\nKeep exploring. The best interfaces leave room for play."),
    }),
  }),
});
const WELCOME: Entry = {
  id: 0,
  output: "STORM OS / TERMINAL\nA small window into a curious mind.\n\nType help to begin. Tab to complete. ↑/↓ for history.\nLocal simulation · no real shell or network commands.",
};

function resolvePath(value: string, cwd: string): string {
  const expanded = value === "~" || value.startsWith("~/") ? HOME + value.slice(1) : value;
  const segments = (expanded.startsWith("/") ? expanded : `${cwd}/${expanded}`).split("/");
  const path: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") path.pop();
    else path.push(segment);
  }
  return `/${path.join("/")}`;
}

function getNode(path: string): VirtualNode | undefined {
  let node: VirtualNode = FILESYSTEM;
  for (const segment of path.split("/").filter(Boolean)) {
    if (node.kind !== "directory") return;
    const child: VirtualNode | undefined = Object.prototype.hasOwnProperty.call(node.children, segment) ? node.children[segment] : undefined;
    if (!child) return;
    node = child;
  }
  return node;
}

function shortPath(path: string) {
  return path === HOME ? "~" : path.startsWith(`${HOME}/`) ? `~${path.slice(HOME.length)}` : path;
}

function tokenize(value: string): string[] | null {
  const parts: string[] = [];
  let token = "";
  let quote = "";
  let started = false;
  for (const character of value) {
    if (quote) {
      if (character === quote) quote = "";
      else token += character;
      started = true;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (/\s/.test(character)) {
      if (started) parts.push(token);
      token = "";
      started = false;
    } else {
      token += character;
      started = true;
    }
  }
  if (quote) return null;
  if (started) parts.push(token);
  return parts;
}

function completionCandidates(command: string, cwd: string) {
  const matches = /^(.*?)([^\s]*)$/.exec(command);
  if (!matches) return { prefix: "", candidates: [] as string[] };
  const [, prefix, fragment] = matches;
  if (!prefix) return { prefix, candidates: COMMANDS.filter((item) => item.startsWith(fragment)) };
  const verb = command.trimStart().split(/\s+/)[0];
  if (verb === "open" && !fragment.includes("/")) {
    return { prefix, candidates: Object.keys(APPS).filter((item) => item.startsWith(fragment)) };
  }
  if (verb !== "ls" && verb !== "cd" && verb !== "cat" && verb !== "open") return { prefix, candidates: [] };
  const slash = fragment.lastIndexOf("/");
  const folder = slash >= 0 ? fragment.slice(0, slash + 1) : "";
  const partial = fragment.slice(slash + 1);
  const node = getNode(resolvePath(folder || ".", cwd));
  if (!node || node.kind !== "directory") return { prefix, candidates: [] };
  return {
    prefix,
    candidates: Object.entries(node.children)
      .filter(([name, child]) => name.startsWith(partial) && (!name.startsWith(".") || partial.startsWith(".")) && (verb !== "cd" || child.kind === "directory"))
      .map(([name, child]) => `${folder}${name}${child.kind === "directory" ? "/" : ""}`),
  };
}

export default function TerminalApp({ onOpenApp }: TerminalAppProps) {
  const inputId = useId();
  const hintId = useId();
  const [entries, setEntries] = useState<Entry[]>([WELCOME]);
  const [command, setCommand] = useState("");
  const [cwd, setCwd] = useState(HOME);
  const [previousCwd, setPreviousCwd] = useState(HOME);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [completionHint, setCompletionHint] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [entries]);

  const execute = (raw: string) => {
    if (!raw.trim()) return;
    const words = tokenize(raw);
    const invocation = raw.trim();
    let output = "";
    let tone: Entry["tone"];
    setHistory((items) => [...items.slice(-99), invocation]);
    setHistoryIndex(null);
    setDraft("");
    setCommand("");
    setCompletionHint("");

    const fail = (message: string) => { output = message; tone = "error"; };
    if (!words) fail("Unclosed quote. Close it and try again.");
    else {
      const [verb, ...args] = words;
      switch (verb) {
        case "help":
          output = "A LITTLE FIELD GUIDE\n\nhelp              You are here\nls [path]         List files (-a shows secrets)\npwd               Show your virtual location\ncd [folder]       Explore (.. / ~ / - work)\ncat <file>        Read about, skills or projects\nopen [app]        Launch a desktop app\nhistory           Revisit your commands\nclear             Fresh screen\nwhoami            Meet the person behind the pixels\ndate / echo       Small familiar comforts\n\nTab completes. ↑/↓ recall. Ctrl+L clears.\nTry: cd projects/portfolio → cat stack.txt\n\nEverything here is simulated locally. No shell execution.";
          break;
        case "pwd": output = cwd; break;
        case "ls": {
          const showHidden = args.includes("-a");
          const paths = args.filter((arg) => arg !== "-a");
          if (paths.length > 1) { fail("Usage: ls [-a] [path]"); break; }
          const path = resolvePath(paths[0] || ".", cwd);
          const node = getNode(path);
          if (!node) fail(`ls: no such file or folder: ${paths[0]}`);
          else if (node.kind === "file") output = path.split("/").pop() || path;
          else output = Object.entries(node.children)
            .filter(([name]) => showHidden || !name.startsWith("."))
            .map(([name, child]) => `${child.kind === "directory" ? "▸ " : "  "}${name}${child.kind === "directory" ? "/" : ""}`)
            .join("\n") || "(empty folder)";
          break;
        }
        case "cd": {
          if (args.length > 1) { fail("Usage: cd [folder]"); break; }
          const path = args[0] === "-" ? previousCwd : resolvePath(args[0] || "~", cwd);
          const node = getNode(path);
          if (!node) fail(`cd: no such folder: ${args[0]}`);
          else if (node.kind !== "directory") fail(`cd: not a folder: ${args[0]}`);
          else { setPreviousCwd(cwd); setCwd(path); output = shortPath(path); }
          break;
        }
        case "cat": {
          if (!args.length) { fail("Usage: cat <file> · try cat about"); break; }
          const results = args.map((name) => {
            const path = resolvePath(name, cwd);
            let node = getNode(path);
            const textAlias = getNode(`${path}.txt`);
            if ((!node || node.kind === "directory") && textAlias?.kind === "file") node = textAlias;
            if (!node) { tone = "error"; return `cat: no such file: ${name}`; }
            if (node.kind === "directory") { tone = "error"; return `cat: ${name} is a folder. Try ls ${name}`; }
            return node.text;
          });
          output = results.join("\n\n");
          break;
        }
        case "open": {
          if (!args.length) {
            output = `DESKTOP APPLICATIONS\n\n${Object.entries(APPS).map(([id, description]) => `${id}\n  ${description}`).join("\n")}\n\nUsage: open <app> · Tab completes app names.`;
            break;
          }
          if (args.length > 1) { fail("Usage: open <app>"); break; }
          const node = getNode(resolvePath(args[0], cwd));
          const app = node?.kind === "file" && node.appId ? node.appId : APP_ALIASES[args[0]] || args[0];
          if (!Object.prototype.hasOwnProperty.call(APPS, app)) fail(`open: unknown app: ${args[0]}\nType open to list the available apps.`);
          else if (!onOpenApp) fail("The desktop launcher is unavailable in this preview. Your command stayed local.");
          else {
            try { onOpenApp(app); output = `Opening ${app}…`; tone = "success"; }
            catch { fail(`Could not open ${app}. Try its desktop icon.`); }
          }
          break;
        }
        case "clear": setEntries([]); return;
        case "history": output = [...history, invocation].map((item, index) => `${String(index + 1).padStart(3, " ")}  ${item}`).join("\n"); break;
        case "whoami": output = "storm\n\nSoftware engineer. Interface tinkerer.\nTurns complex workflows into things people can use.\n\nYou are visiting as guest. Curiosity privileges: unlimited."; break;
        case "date": output = new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }); break;
        case "echo": output = args.join(" "); break;
        case "matrix":
          output = "01  10   01  11   00  10\n  11  00   10  01  10\n10   01  11   00  01  11\n  01  10   01  11  00\n\nWake up, visitor.\nThe desktop has you.\n\nFollow the white cursor. ▌";
          tone = "matrix";
          break;
        case "sudo":
          if (args.join(" ").toLowerCase() === "make me a sandwich") {
            output = "    ___________\n   /___________\\\n   | lettuce   |\n   |  cheese   |\n   \\___________/\n\nOkay. One virtual sandwich.\nRoot privileges taste like cheddar.";
            tone = "success";
          } else fail("sudo: no elevated privileges in this simulated terminal.\nHint: a sandwich might change its mind.");
          break;
        case "exit": output = "You can close this window with its title-bar button.\nYour curiosity session has no timeout."; break;
        default: fail(`${verb}: command not found.\nType help for the local commands.`);
      }
    }
    const entry: Entry = { id: nextId.current++, command: invocation, path: shortPath(cwd), output, tone };
    setEntries((items) => [...items.slice(-149), entry]);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    execute(command);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (!history.length) return;
      event.preventDefault();
      setCompletionHint("");
      if (event.key === "ArrowUp") {
        if (historyIndex === null) setDraft(command);
        const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(index);
        setCommand(history[index]);
      } else if (historyIndex !== null) {
        const index = historyIndex + 1;
        setHistoryIndex(index >= history.length ? null : index);
        setCommand(index >= history.length ? draft : history[index]);
      }
    } else if (event.key === "Tab" && !event.shiftKey) {
      const { prefix, candidates } = completionCandidates(command, cwd);
      if (!candidates.length) { setCompletionHint("No completions. Shift+Tab moves out of the command field."); return; }
      event.preventDefault();
      const common = candidates.reduce((result, item) => {
        let index = 0;
        while (index < result.length && result[index] === item[index]) index++;
        return result.slice(0, index);
      });
      setCommand(prefix + common + (candidates.length === 1 && !common.endsWith("/") ? " " : ""));
      setCompletionHint(candidates.length > 1 ? candidates.join("   ") : "");
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setEntries([]);
      setCompletionHint("");
    } else if (event.key === "Escape") {
      setCommand("");
      setCompletionHint("");
      setHistoryIndex(null);
    }
  };

  return (
    <section className={styles.terminal} aria-label="Simulated terminal">
      <div className={styles.statusBar}>
        <span className={styles.connection}><span className={styles.statusDot} aria-hidden="true" />LOCAL SESSION</span>
        <span className={styles.sessionInfo}>guest @ storm-os</span>
      </div>
      <div className={styles.output} ref={outputRef} role="log" aria-label="Terminal output" aria-live="polite" aria-relevant="additions" tabIndex={0}>
        {entries.map((entry) => (
          <div className={styles.entry} key={entry.id}>
            {entry.command !== undefined && (
              <div className={styles.previousCommand}><span className={styles.path}>{entry.path}</span><span className={styles.prompt} aria-hidden="true">$</span><span>{entry.command}</span></div>
            )}
            {entry.output && <pre className={`${styles.result} ${entry.tone ? styles[entry.tone] : ""}`}>{entry.output}</pre>}
          </div>
        ))}
        {!entries.length && <p className={styles.empty}>Clean slate. Same curiosity.</p>}
      </div>
      <div className={styles.inputArea}>
        <div className={styles.currentPath}>{shortPath(cwd)}<span>read-only virtual files</span></div>
        <form className={styles.commandForm} onSubmit={submit}>
          <label className={styles.prompt} htmlFor={inputId}>$<span className={styles.srOnly}>Terminal command</span></label>
          <input
            ref={inputRef}
            id={inputId}
            className={styles.commandInput}
            value={command}
            onChange={(event) => { setCommand(event.target.value); setHistoryIndex(null); setCompletionHint(""); }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-describedby={hintId}
            placeholder="Type a command…"
          />
          <button className={styles.runButton} type="submit" aria-label="Run local command">↵</button>
        </form>
        <div id={hintId} className={styles.hint} aria-live="polite">{completionHint || "help · Tab completes · ↑↓ history"}</div>
        <div className={styles.shortcuts} aria-label="Try a terminal command">
          {["help", "ls", "cat about", "open finder"].map((item) => (
            <button type="button" key={item} onClick={() => { execute(item); }}>{item}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
