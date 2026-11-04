"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./FinderApp.module.css";
import { createLocalCoordinateMetrics } from "../desktopCoordinates";
import { folderDepth, MAX_FOLDER_DEPTH } from "../folderTree";
import { finderMoveError, finderTree, moveFinderNode, descendants, FINDER_STORAGE_KEY, INITIAL_FILES, MAX_NOTES_LENGTH, MAX_VISITOR_ITEMS, removeVisitorNode, restoreFiles, ROOT_ID, serializeFiles, uniqueName, validName, type FinderNode } from "./finderModel";

type Props = { onOpenApp?: (id: string) => void };
type Filter = "all" | FinderNode["kind"];
type NameAction = { kind: "folder" | "text" | "rename"; name: string; error?: string };

function Glyph({ kind, small = false }: { kind: FinderNode["kind"] | "disk"; small?: boolean }) {
  return <svg className={small ? styles.smallGlyph : styles.glyph} viewBox="0 0 40 36" fill="none" aria-hidden="true">
    {kind === "folder" ? <><path d="M3 8h13l4 5h17v19H3z" fill="var(--finder-paper)" stroke="currentColor" strokeWidth="1.7" /><path d="M3 13h34M6 17h28" stroke="currentColor" strokeWidth="1.5" /></> : kind === "disk" ? <><rect x="6" y="3" width="28" height="30" rx="2" fill="var(--finder-paper)" stroke="currentColor" strokeWidth="1.7" /><rect x="10" y="7" width="20" height="15" stroke="currentColor" strokeWidth="1.4" /><path d="M10 27h20M13 30h1" stroke="currentColor" strokeWidth="1.7" /></> : kind === "app" ? <><rect x="4" y="5" width="32" height="27" fill="var(--finder-paper)" stroke="currentColor" strokeWidth="1.7" /><path d="M4 11h32M9 8h2m3 0h2M13 20l-4 4 4 4m14-8 4 4-4 4m-5-10-4 12" stroke="currentColor" strokeWidth="1.7" /></> : <><path d="M9 3h15l8 8v22H9z" fill="var(--finder-paper)" stroke="currentColor" strokeWidth="1.7" /><path d="M24 3v9h8M14 18h13m-13 5h13m-13 5h9" stroke="currentColor" strokeWidth="1.5" /></>}
  </svg>;
}

const favorites = [
  { id: ROOT_ID, label: "My Mac", kind: "disk" },
  { id: "projects-folder", label: "Projects", kind: "folder" },
  { id: "playground-folder", label: "Playground", kind: "folder" },
  { id: "notes-folder", label: "Notes", kind: "folder" },
] as const;

export default function FinderApp({ onOpenApp }: Props) {
  const [nodes, setNodes] = useState<FinderNode[]>(INITIAL_FILES);
  const [ready, setReady] = useState(false);
  const [storageState, setStorageState] = useState<"saved" | "session">("saved");
  const [navigation, setNavigation] = useState({ entries: [ROOT_ID], index: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"icons" | "list">("icons");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [nameAction, setNameAction] = useState<NameAction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const rootRef=useRef<HTMLElement>(null);
  const ghostRef=useRef<HTMLDivElement>(null);
  const dragCleanup=useRef<(()=>void)|null>(null);
  const suppressClick=useRef(false);
  const [drag,setDrag]=useState<{id:string;x:number;y:number}|null>(null);
  const [dropId,setDropId]=useState<string|null>(null);
  const [cutId,setCutId]=useState<string|null>(null);
  const [undoMoves,setUndoMoves]=useState<{id:string;from:string;to:string}[]>([]);
  const pointerType = useRef("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(()=>()=>dragCleanup.current?.(),[]);

  useEffect(() => {
    try {
      const restored = restoreFiles(localStorage.getItem(FINDER_STORAGE_KEY));
      setNodes(restored.nodes);
      if (restored.recovered) setNotice("Saved files couldn't be read. A fresh Mac is ready.");
    } catch {
      setStorageState("session");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(FINDER_STORAGE_KEY, serializeFiles(nodes));
      setStorageState("saved");
    } catch {
      setStorageState("session");
    }
  }, [nodes, ready]);

  const current = nodes.find(node => node.id === navigation.entries[navigation.index]) ?? nodes[0];
  const folder = current.kind === "folder" ? current : nodes.find(node => node.id === current.parentId)!;
  const selected = current.kind === "text" ? current : nodes.find(node => node.id === selectedId);
  const pendingDelete = nodes.find(node => node.id === deleteId);
  const path: FinderNode[] = [];
  let ancestor: FinderNode | undefined = current;
  while (ancestor && path.length <= nodes.length) {
    path.unshift(ancestor);
    ancestor = nodes.find(node => node.id === ancestor!.parentId);
  }

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const candidates = term ? descendants(nodes, folder.id) : nodes.filter(node => node.parentId === folder.id);
    const order = { folder: 0, app: 1, text: 2 };
    return candidates.filter(node => (filter === "all" || node.kind === filter) && (!term || `${node.name}\n${node.content ?? ""}`.toLowerCase().includes(term))).sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
  }, [nodes, folder.id, filter, query]);

  function clearTransient() {
    setQuery("");
    setFilter("all");
    setSelectedId(null);
    setNameAction(null);
    setDeleteId(null);
    setNotice("");
  }

  function open(node: FinderNode) {
    if (node.kind === "app") {
      if (onOpenApp && node.appId) onOpenApp(node.appId);
      else setNotice("This app opens from the desktop.");
      return;
    }
    if (node.id !== current.id) {
      setNavigation(previous => ({ entries: [...previous.entries.slice(0, previous.index + 1), node.id], index: previous.index + 1 }));
    }
    clearTransient();
  }

  function travel(direction: -1 | 1) {
    setNavigation(previous => ({ ...previous, index: Math.max(0, Math.min(previous.entries.length - 1, previous.index + direction)) }));
    clearTransient();
  }

  function moveFile(id:string,parentId:string) {
    const error=finderMoveError(nodes,id,parentId);
    if(error){setNotice(error);return;}
    const node=nodes.find(item=>item.id===id)!;
    if(node.parentId===parentId)return;
    setUndoMoves(previous=>[...previous.slice(-19),{id,from:node.parentId!,to:parentId}]);
    setNodes(previous=>moveFinderNode(previous,id,parentId));setSelectedId(id);setCutId(null);setNotice(`Moved ${node.name}.`);rootRef.current?.focus({preventScroll:true});
  }

  function cutSelected() {
    if(!selected||selected.id===ROOT_ID)return;
    setCutId(selected.id);setNotice(`Cut ${selected.name}.`);
  }

  function pasteCut() {
    if(cutId)moveFile(cutId,folder.id);
  }

  function undoMove() {
    const last=undoMoves.at(-1);if(!last)return;
    setUndoMoves(previous=>previous.slice(0,-1));
    if(nodes.find(node=>node.id===last.id)?.parentId!==last.to||finderMoveError(nodes,last.id,last.from)){setNotice("That move can't be undone.");return;}
    setNodes(previous=>moveFinderNode(previous,last.id,last.from));setSelectedId(last.id);setNotice("Move undone.");
  }

  function startDrag(event:ReactPointerEvent<HTMLButtonElement>,node:FinderNode) {
    pointerType.current=event.pointerType;suppressClick.current=false;
    if(event.button!==0||!rootRef.current)return;
    const element=event.currentTarget, pointer=event.pointerId, x=event.clientX,y=event.clientY;
    let metrics:ReturnType<typeof createLocalCoordinateMetrics>|null=null;
    let started=false,frame=0,lastX=x,lastY=y,spring:{id:string;timer:number}|null=null;
    const clearSpring=()=>{if(spring)clearTimeout(spring.timer);spring=null;};
    // Hovering a folder opens it, so a file can be carried down any number of levels.
    const armSpring=(id:string|null)=>{
      if(spring?.id===id)return;
      clearSpring();
      if(id)spring={id,timer:window.setTimeout(()=>{
        setQuery("");setFilter("all");
        setNavigation(previous=>previous.entries[previous.index]===id?previous:{entries:[...previous.entries.slice(0,previous.index+1),id],index:previous.index+1});
      },650)};
    };
    const targetAt=(cx:number,cy:number)=>{
      for(const raw of document.elementsFromPoint(cx,cy)){
        const element=raw.closest<HTMLElement>("[data-finder-folder]");
        if(element?.dataset.finderFolder===node.id)continue;
        if(element&&rootRef.current?.contains(element))return element.dataset.finderFolder??null;
        if(raw.closest(".window")&&!rootRef.current?.contains(raw))return null;
      }
      return null;
    };
    const paint=()=>{
      frame=0;if(!metrics)return;const local=metrics.clientToLocal(lastX,lastY);
      if(ghostRef.current)ghostRef.current.style.transform=`translate(${local.x-20}px,${local.y-22}px)`;
      const target=targetAt(lastX,lastY),valid=target&&!finderMoveError(nodes,node.id,target)?target:null;
      setDropId(valid!==node.parentId?valid:null);
      armSpring(valid);
    };
    const move=(e:globalThis.PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      if(!started){
        if(Math.hypot(e.clientX-x,e.clientY-y)<(e.pointerType==="touch"?9:5))return;
        if(!rootRef.current)return;
        started=true;suppressClick.current=true;setSelectedId(node.id);
        metrics=createLocalCoordinateMetrics(rootRef.current);
        const local=metrics.clientToLocal(e.clientX,e.clientY);setDrag({id:node.id,x:local.x-20,y:local.y-22});
        try{element.setPointerCapture(pointer);}catch{}
      }
      if(e.cancelable)e.preventDefault();lastX=e.clientX;lastY=e.clientY;
      if(!frame)frame=requestAnimationFrame(paint);
    };
    const cleanup=()=>{
      cancelAnimationFrame(frame);clearSpring();window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);window.removeEventListener("blur",blur);window.removeEventListener("keydown",escape);
      try{element.releasePointerCapture(pointer);}catch{}
      setDrag(null);setDropId(null);dragCleanup.current=null;
    };
    const up=(e:globalThis.PointerEvent)=>{if(e.pointerId!==pointer)return;const target=targetAt(e.clientX,e.clientY);cleanup();if(started&&target)moveFile(node.id,target);};
    const cancel=(e:globalThis.PointerEvent)=>{if(e.pointerId===pointer)cleanup();};
    const blur=()=>cleanup();
    const escape=(e:globalThis.KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();cleanup();}};
    dragCleanup.current?.();dragCleanup.current=cleanup;
    window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",up);window.addEventListener("pointercancel",cancel);window.addEventListener("blur",blur);window.addEventListener("keydown",escape);
  }

  function startCreate(kind: "folder" | "text") {
    if(kind==="folder"&&folderDepth(finderTree(nodes),folder.id)>=MAX_FOLDER_DEPTH){setNotice(`Folders can nest up to ${MAX_FOLDER_DEPTH} levels.`);return;}
    if (nodes.filter(node => !node.protected).length >= MAX_VISITOR_ITEMS) {
      setNotice(`This Mac holds up to ${MAX_VISITOR_ITEMS} visitor items. Delete an item to make room.`);
      return;
    }
    if (current.kind !== "folder") open(folder);
    setQuery("");
    setFilter("all");
    setDeleteId(null);
    setNameAction({ kind, name: uniqueName(nodes, folder.id, kind) });
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    if (!nameAction) return;
    const name = nameAction.name.trim();
    if (!validName(name)) {
      setNameAction({ ...nameAction, error: "Use 1–64 characters, without slashes." });
      return;
    }
    const targetParent = nameAction.kind === "rename" ? selected?.parentId : folder.id;
    if (nodes.some(node => node.parentId === targetParent && node.id !== (nameAction.kind === "rename" ? selected?.id : null) && node.name.toLowerCase() === name.toLowerCase())) {
      setNameAction({ ...nameAction, error: "An item here already has that name." });
      return;
    }
    if (nameAction.kind === "rename") {
      if (!selected || selected.protected) return;
      setNodes(previous => previous.map(node => node.id === selected.id ? { ...node, name } : node));
      setNotice(`Renamed to ${name}.`);
    } else {
      const id = `visitor-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const node: FinderNode = { id, parentId: folder.id, name, kind: nameAction.kind, ...(nameAction.kind === "text" ? { content: "" } : {}) };
      setNodes(previous => [...previous, node]);
      setSelectedId(id);
      if (node.kind === "text") {
        setNavigation(previous => ({ entries: [...previous.entries.slice(0, previous.index + 1), id], index: previous.index + 1 }));
      }
      setNotice(`${name} created.`);
    }
    setNameAction(null);
  }

  function confirmDelete() {
    if (!pendingDelete || pendingDelete.protected) return;
    const remaining = removeVisitorNode(nodes, pendingDelete.id);
    if(remaining===nodes){setNotice("Move the portfolio files out of this folder before deleting it.");setDeleteId(null);return;}
    const remainingIds = new Set(remaining.map(node => node.id));
    const target = remainingIds.has(current.id) ? current.id : pendingDelete.parentId ?? ROOT_ID;
    setNodes(remaining);
    setNavigation(previous => {
      const entries = previous.entries.filter(id => remainingIds.has(id));
      const index = entries.lastIndexOf(target);
      return index >= 0 ? { entries, index } : { entries: [...entries, target], index: entries.length };
    });
    setSelectedId(null);
    setNameAction(null);
    setDeleteId(null);
    if(cutId&&!remainingIds.has(cutId))setCutId(null);
    setNotice(`${pendingDelete.name} deleted.`);
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    suppressClick.current = false;
    const target = event.target as HTMLElement;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f" && current.kind === "folder") {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (target.closest("input, textarea, select")) return;
    if(event.metaKey||event.ctrlKey){
      const key=event.key.toLowerCase();
      if(key==="x"&&selected&&selected.id!==ROOT_ID){event.preventDefault();cutSelected();return;}
      if(key==="v"&&cutId){event.preventDefault();pasteCut();return;}
      if(key==="z"&&!event.shiftKey){event.preventDefault();undoMove();return;}
    }
    if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); travel(-1); }
    else if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); travel(1); }
    else if ((event.key === "Delete" || event.key === "Backspace") && selected && !selected.protected) {
      event.preventDefault();
      setNameAction(null);
      setDeleteId(selected.id);
    } else if (event.key === "Escape") {
      setNameAction(null);
      setDeleteId(null);
      setSelectedId(null);
      setCutId(null);
    }
  }

  return <section ref={rootRef} tabIndex={-1} className={styles.finder} aria-label="Finder file browser" onKeyDown={keyboard}>
    <div className={styles.toolbar}>
      <div className={styles.history}>
        <button type="button" title="Back (Alt + Left)" aria-label="Back" disabled={navigation.index === 0} onClick={() => travel(-1)}>←</button>
        <button type="button" title="Forward (Alt + Right)" aria-label="Forward" disabled={navigation.index === navigation.entries.length - 1} onClick={() => travel(1)}>→</button>
      </div>
      <span className={styles.folderTitle}><Glyph kind={current.id === ROOT_ID ? "disk" : current.kind} small />{current.name}</span>
      <div className={styles.views} aria-label="View options">
        <button type="button" title="Icon view" aria-label="Icon view" aria-pressed={view === "icons"} onClick={() => setView("icons")}>▦</button>
        <button type="button" title="List view" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}>☰</button>
      </div>
    </div>

    <nav className={styles.breadcrumbs} aria-label="File path">
      {path.map((node, index) => <span key={node.id}>
        {index > 0 && <span className={styles.pathSeparator} aria-hidden="true">›</span>}
        <button type="button" aria-current={node.id === current.id ? "page" : undefined} data-finder-folder={node.kind==="folder"?node.id:undefined} className={dropId===node.id?styles.dropTarget:undefined} onClick={() => open(node)}>{node.id === ROOT_ID ? "My Mac" : node.name}</button>
      </span>)}
    </nav>

    <div className={styles.body}>
      <aside className={styles.sidebar} aria-label="Favorites">
        <p>FAVORITES</p>
        {favorites.map(item => <button type="button" key={item.id} data-finder-folder={item.id} className={`${folder.id===item.id?styles.activeFavorite:""} ${dropId===item.id?styles.dropTarget:""}`} onClick={() => open(nodes.find(node => node.id === item.id)!)}><Glyph kind={item.kind} small />{item.label}</button>)}

      </aside>

      <main className={styles.main}>
        <div className={styles.actions}>
          <button type="button" disabled={!ready} onClick={() => startCreate("folder")}><span aria-hidden="true">＋</span> Folder</button>
          <button type="button" disabled={!ready} onClick={() => startCreate("text")}><span aria-hidden="true">＋</span> Note</button>
          <button type="button" disabled={!selected||selected.id===ROOT_ID} title="Cut (Ctrl or Cmd + X)" onClick={cutSelected}>Cut</button>
          <button type="button" disabled={!cutId} title="Paste (Ctrl or Cmd + V)" onClick={pasteCut}>Paste</button>
          <button type="button" disabled={!undoMoves.length} title="Undo move (Ctrl or Cmd + Z)" onClick={undoMove}>Undo move</button>
          <span className={styles.actionSpacer} />
          {selected && !selected.protected && <>
            <button type="button" onClick={() => { setDeleteId(null); setNameAction({ kind: "rename", name: selected.name }); }}>Rename</button>
            <button type="button" title="Delete selected item" aria-label={`Delete ${selected.name}`} onClick={() => { setNameAction(null); setDeleteId(selected.id); }}>⌫</button>
          </>}
        </div>

        {nameAction && <form className={styles.nameForm} onSubmit={submitName}>
          <label htmlFor="finder-item-name">{nameAction.kind === "rename" ? "Rename item" : nameAction.kind === "folder" ? "New folder" : "New text file"}</label>
          <div><input id="finder-item-name" autoFocus maxLength={64} value={nameAction.name} onFocus={event => event.target.select()} onChange={event => setNameAction({ ...nameAction, name: event.target.value })} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setNameAction(null); } }} aria-describedby={nameAction.error ? "finder-name-error" : undefined} /><button type="submit">{nameAction.kind === "rename" ? "Save" : "Create"}</button><button type="button" onClick={() => setNameAction(null)}>Cancel</button></div>
          {nameAction.error && <p id="finder-name-error" role="alert">{nameAction.error}</p>}
        </form>}

        {pendingDelete && <div className={styles.deletePrompt} role="alert">
          <p>Delete <strong>{pendingDelete.name}</strong>{pendingDelete.kind === "folder" ? ` and its ${descendants(nodes, pendingDelete.id).length} enclosed items` : ""}?</p>
          <div><button type="button" onClick={confirmDelete}>Delete</button><button type="button" onClick={() => setDeleteId(null)}>Keep it</button></div>
        </div>}

        {current.kind === "text" ? <article className={styles.reader}>
          <header><span>{current.protected ? "PORTFOLIO DOCUMENT" : "YOUR TEXT FILE"}</span><span>{current.protected ? "Read only" : storageState === "saved" ? "Autosaved" : "Session only"}</span></header>
          {current.protected ? <div className={styles.readOnlyText} tabIndex={0}>{current.content}</div> : <textarea aria-label={`Edit ${current.name}`} placeholder="" value={current.content ?? ""} maxLength={MAX_NOTES_LENGTH} spellCheck onChange={event => setNodes(previous => previous.map(node => node.id === current.id ? { ...node, content: event.target.value } : node))} />}
          <footer><span>{(current.content ?? "").length.toLocaleString()} characters</span><button type="button" onClick={() => open(folder)}>Show in folder ↗</button></footer>
        </article> : <>
          <div className={styles.searchRow}>
            <label className={styles.search}><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" aria-label={`Search ${folder.name}`} placeholder={`Search ${folder.id === ROOT_ID ? "this Mac" : folder.name}`} value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null); setNameAction(null); setDeleteId(null); }} /></label>
            <select aria-label="Filter file type" value={filter} onChange={event => { setFilter(event.target.value as Filter); setSelectedId(null); }}><option value="all">All items</option><option value="folder">Folders</option><option value="text">Documents</option><option value="app">Apps</option></select>
          </div>
          {query.trim() && <p className={styles.searchCaption}>Searching names & contents in {folder.id === ROOT_ID ? "this Mac" : folder.name}</p>}
          <div data-finder-folder={folder.id} className={`${styles.items} ${view === "icons" ? styles.iconGrid : styles.list} ${dropId===folder.id?styles.dropTarget:""}`} role="group" aria-label={`${folder.name} items`}>
            {view === "list" && items.length > 0 && <div className={styles.listHeader}><span>Name</span><span>Kind</span></div>}
            {items.map(node => <button type="button" key={node.id} data-finder-folder={node.kind==="folder"?node.id:undefined} className={`${styles.item} ${selectedId===node.id?styles.selected:""} ${dropId===node.id?styles.dropTarget:""} ${drag?.id===node.id||cutId===node.id?styles.dragSource:""}`} aria-label={`${node.name}, ${node.kind === "text" ? "text document" : node.kind}${node.protected ? ", read only" : ""}`} aria-pressed={selectedId === node.id} onPointerDown={event=>startDrag(event,node)} onClick={event => { if(suppressClick.current){suppressClick.current=false;return;}setSelectedId(node.id); setNameAction(null); setDeleteId(null); if (event.detail === 0 || pointerType.current === "touch" || pointerType.current === "pen") open(node); }} onDoubleClick={() => { if(suppressClick.current)return;if (pointerType.current !== "touch" && pointerType.current !== "pen") open(node); }}>
              <Glyph kind={node.kind} />
              <span className={styles.itemName}>{node.name}{query.trim() && <small>{nodes.find(parent => parent.id === node.parentId)?.name}</small>}</span>
              <span className={styles.itemKind}>{node.kind === "folder" ? "Folder" : node.kind === "app" ? "App ↗" : "Text"}</span>
            </button>)}
            {items.length === 0 && <div className={styles.empty}><Glyph kind="folder" /><strong>{query || filter !== "all" ? "No matching items" : "Empty folder"}</strong><p>{query || filter !== "all" ? "Try another search or file type." : "No items."}</p>{(query || filter !== "all") && <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</button>}</div>}
          </div>
          <div className={styles.selectionBar}><span>{selected ? selected.name : "Click to select · double-click to open"}</span>{selected && <button type="button" onClick={() => open(selected)}>Open ↗</button>}</div>
        </>}
      </main>
    </div>

    {drag&&<div ref={ghostRef} className={styles.dragGhost} style={{transform:`translate(${drag.x}px,${drag.y}px)`}} aria-hidden="true"><Glyph kind={nodes.find(node=>node.id===drag.id)!.kind}/><span>{nodes.find(node=>node.id===drag.id)!.name}</span></div>}
    <footer className={styles.statusBar}>
      <span>{current.kind === "text" ? "Text document" : `${items.length} ${items.length === 1 ? "item" : "items"}`}</span>
      <span className={styles.statusMessage} role="status" aria-live="polite">{notice || (storageState === "session" ? "Storage unavailable · session only" : "Visitor files stay in this browser")}</span>
    </footer>
  </section>;
}
