"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from "./ProjectTasks.module.css";

type ProjectTasksProps = { onOpenApp?: (id: string) => void };
type WorkFilter = "all" | "project" | "role";
type VisitorTask = { id: string; text: string; done: boolean };
type SaveState = "loading" | "saved" | "memory" | "invalid";

const STORAGE_KEY = "storm-portfolio-visitor-tasks-v1";
const MAX_TASKS = 16;
const MAX_TEXT_LENGTH = 160;

const CURRENT_WORK = [
  {
    id: "noteception",
    name: "Noteception",
    type: "project" as const,
    label: "Current project",
    description: "An active project in Storm’s current work. Explore Noteception on the web.",
    detail: "Visit the project to see what’s being built.",
    href: "https://noteception.com",
    linkLabel: "Visit Noteception",
  },
  {
    id: "unsw",
    name: "UNSW",
    type: "role" as const,
    label: "Software Developer",
    description: "Current software development role at the University of New South Wales.",
    detail: "Software Developer · UNSW",
  },
];

function readTasks(raw: string | null): VisitorTask[] | null {
  if (raw === null) return [];
  if (raw.length > 12_000) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("items" in value) || !Array.isArray(value.items) || value.items.length > MAX_TASKS) return null;

    const ids = new Set<string>();
    const items: VisitorTask[] = [];
    for (const item of value.items) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.text !== "string" || item.text.trim().length === 0 || item.text.length > MAX_TEXT_LENGTH || typeof item.done !== "boolean") return null;
      ids.add(item.id);
      items.push({ id: item.id, text: item.text.trim(), done: item.done });
    }
    return items;
  } catch {
    return null;
  }
}

function WorkIcon({ role = false }: { role?: boolean }) {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {role ? <path d="M3 9h18v12H3zM8 9V5h8v4M3 13h18M10 13v3h4v-3" /> : <><path d="M3 4h7l2 3h9v14H3z" /><path d="M7 12h10M7 16h7" /></>}
    </svg>
  );
}

export default function ProjectTasks({ onOpenApp }: ProjectTasksProps) {
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [expanded, setExpanded] = useState<string | null>("noteception");
  const [tasks, setTasks] = useState<VisitorTask[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceId = useId();

  useEffect(() => {
    try {
      const storedTasks = readTasks(window.localStorage.getItem(STORAGE_KEY));
      if (storedTasks === null) {
        setSaveState("invalid");
      } else {
        setTasks(storedTasks);
        setSaveState("saved");
      }
    } catch {
      setSaveState("memory");
    }
  }, []);

  function saveTasks(next: VisitorTask[]) {
    setTasks(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: next }));
      setSaveState("saved");
    } catch {
      setSaveState("memory");
    }
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || text.length > MAX_TEXT_LENGTH || tasks.length >= MAX_TASKS || saveState === "loading") return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    saveTasks([...tasks, { id, text, done: false }]);
    setDraft("");
    setNotice("Visitor task added.");
    inputRef.current?.focus();
  }

  function finishEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = editDraft.trim();
    if (!text || text.length > MAX_TEXT_LENGTH) return;
    saveTasks(tasks.map((task) => task.id === editing ? { ...task, text } : task));
    setEditing(null);
    setNotice("Visitor task updated.");
  }

  const visibleWork = CURRENT_WORK.filter((work) => filter === "all" || work.type === filter);
  const completed = tasks.filter((task) => task.done).length;
  const storageLabel = saveState === "loading" ? "Loading notes…" : saveState === "memory" ? "Browser storage unavailable. Notes last for this visit." : saveState === "invalid" ? "Saved notes could not be read. Add a task to start fresh." : "Saved in this browser.";

  return (
    <section className={styles.root} aria-label="Project Manager">
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <div>
            <div className={styles.eyebrow}>STORM’S WORKSPACE</div>
            <h2 className={styles.heading}>Current work<span className={styles.cursor} aria-hidden="true">_</span></h2>
          </div>
          <div className={styles.workCount} aria-label="2 current work items">02<span>ACTIVE</span></div>
        </div>
        <div className={styles.intro}>A project, a role, and room for your own to-dos.</div>
      </header>

      <div className={styles.scrollArea}>
        <div className={styles.workSection}>
          <div className={styles.toolbar}>
            <div className={styles.filters} role="group" aria-label="Filter current work">
              {([{ id: "all", label: "All", count: 2 }, { id: "project", label: "Projects", count: 1 }, { id: "role", label: "Roles", count: 1 }] as const).map((item) => (
                <button key={item.id} type="button" className={`${styles.filter} ${filter === item.id ? styles.selectedFilter : ""}`} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.count}</span></button>
              ))}
            </div>
            <span className={styles.viewLabel}>STATUS / CURRENT</span>
          </div>

          <div className={styles.workList}>
            {visibleWork.map((work) => {
              const isExpanded = expanded === work.id;
              const detailId = `${instanceId}-${work.id}`;
              return (
                <article className={styles.workItem} key={work.id}>
                  <button type="button" className={styles.workButton} aria-expanded={isExpanded} aria-controls={detailId} onClick={() => setExpanded(isExpanded ? null : work.id)}>
                    <span className={styles.workIcon}><WorkIcon role={work.type === "role"} /></span>
                    <span className={styles.workTitle}><strong>{work.name}</strong><span>{work.label}</span></span>
                    <span className={styles.status}><span aria-hidden="true" />Active</span>
                    <span className={styles.chevron} aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                  </button>
                  <div id={detailId} hidden={!isExpanded} className={styles.workDetail}>
                    <p>{work.description}</p>
                    <div className={styles.detailFooter}>
                      <span className={styles.typeLabel}>{work.type === "role" ? "CURRENT ROLE" : "CURRENT PROJECT"}</span>
                      {"href" in work ? <a href={work.href} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>{work.linkLabel}<span aria-hidden="true">↗</span></a> : onOpenApp ? <button type="button" className={styles.detailLink} onClick={() => onOpenApp("about")}>About Storm<span aria-hidden="true">↗</span></button> : <span className={styles.roleDetail}>{work.detail}</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className={styles.statusNote}><span aria-hidden="true">◇</span> Portfolio status · not live system activity</div>
        </div>

        <section className={styles.notesSection} aria-labelledby={`${instanceId}-notes`}>
          <div className={styles.notesHeading}>
            <h3 id={`${instanceId}-notes`}>Visitor notes</h3>
            <span>{completed}/{tasks.length} DONE</span>
          </div>
          <p className={styles.notesIntro}>Your own checklist while you look around.</p>
          <form className={styles.addForm} onSubmit={addTask}>
            <label className={styles.srOnly} htmlFor={`${instanceId}-new-task`}>New visitor task</label>
            <input ref={inputRef} id={`${instanceId}-new-task`} type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a reminder for yourself…" maxLength={MAX_TEXT_LENGTH} disabled={saveState === "loading" || tasks.length >= MAX_TASKS} autoComplete="off" />
            <button type="submit" className={styles.addButton} disabled={!draft.trim() || tasks.length >= MAX_TASKS || saveState === "loading"} aria-label="Add visitor task">+<span>Add</span></button>
          </form>
          {tasks.length === 0 ? <div className={styles.emptyState}><span aria-hidden="true">[ ]</span><div>No visitor tasks yet.<span>Add one above. Make yourself at home.</span></div></div> : (
            <ul className={styles.tasks} aria-label="Your visitor tasks">
              {tasks.map((task) => (
                <li className={styles.task} key={task.id}>
                  {editing === task.id ? (
                    <form className={styles.editForm} onSubmit={finishEdit}>
                      <label className={styles.srOnly} htmlFor={`${instanceId}-edit-task`}>Edit visitor task</label>
                      <input id={`${instanceId}-edit-task`} type="text" value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength={MAX_TEXT_LENGTH} autoFocus onKeyDown={(event) => { if (event.key === "Escape") setEditing(null); }} />
                      <div className={styles.editActions}><button type="submit" disabled={!editDraft.trim()}>Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
                    </form>
                  ) : <>
                    <label className={`${styles.taskLabel} ${task.done ? styles.taskDone : ""}`}><input type="checkbox" checked={task.done} onChange={() => { saveTasks(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item)); setNotice(task.done ? "Visitor task reopened." : "Visitor task completed."); }} /><span>{task.text}</span></label>
                    <div className={styles.taskActions}><button type="button" aria-label={`Edit ${task.text}`} onClick={() => { setEditing(task.id); setEditDraft(task.text); }}>Edit</button><button type="button" className={styles.removeButton} aria-label={`Delete ${task.text}`} onClick={() => { saveTasks(tasks.filter((item) => item.id !== task.id)); setNotice("Visitor task deleted."); }}>×</button></div>
                  </>}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.notesFooter} role="status">{tasks.length >= MAX_TASKS ? `${MAX_TASKS} task limit reached. Remove one to add another. ` : ""}{storageLabel}</div>
          <span className={styles.srOnly} aria-live="polite">{notice}</span>
        </section>
      </div>
      <footer className={styles.footer}><span className={styles.footerMark} aria-hidden="true">▦</span><span>PROJECT MANAGER</span><span>2 current items</span></footer>
    </section>
  );
}
