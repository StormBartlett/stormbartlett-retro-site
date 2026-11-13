"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { SKILLS, SKILLS_BY_NAME, type Skill } from "./skillsData";
import styles from "./SkillsApp.module.css";

type Peek = { skill: Skill; x: number; y: number; below: boolean };

/** A file tree of ~/.storm/skills: folders nest by path, each folder shows its own SKILL.md. */
function tree() {
  const items = SKILLS.map(skill => {
    const folders = skill.path.split("/").slice(0, -1);
    return { skill, depth: folders.length - 1, folder: folders[folders.length - 1], parent: folders.slice(0, -1).join("/"), last: false };
  }).sort((a, b) => a.skill.path.replace(/SKILL\.md$/, "").localeCompare(b.skill.path.replace(/SKILL\.md$/, "")));
  // The last child of each folder gets the └ connector; earlier siblings get ├.
  items.forEach((item, i) => { item.last = !items.slice(i + 1).some(next => next.depth === item.depth && next.parent === item.parent); });
  return items;
}

export default function SkillsApp() {
  const [current, setCurrent] = useState<Skill>(SKILLS[0]);
  const [peek, setPeek] = useState<Peek | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLElement>(null);
  const files = useMemo(() => tree(), []);

  const open = (skill: Skill) => { setCurrent(skill); setPeek(null); page.current?.scrollTo({ top: 0 }); };
  const show = (skill: Skill, target: HTMLElement) => {
    const box = root.current?.getBoundingClientRect(), link = target.getBoundingClientRect();
    if (!box) return;
    // Rects are in screen pixels; the app may be scaled (the 3D screen), so convert back to CSS pixels.
    const scale = box.width / (root.current!.offsetWidth || box.width);
    const x = (link.left - box.left) / scale, top = (link.top - box.top) / scale, bottom = (link.bottom - box.top) / scale;
    const below = top < root.current!.offsetHeight / 2;
    setPeek({ skill, x: Math.min(Math.max(8, x - 20), root.current!.offsetWidth - 268), y: below ? bottom + 6 : top - 6, below });
  };

  const link = (name: string, key: string): ReactNode => {
    const skill = SKILLS_BY_NAME.get(name);
    if (!skill) return <code key={key}>[[{name}]]</code>;
    return <button key={key} type="button" className={styles.link} aria-label={`Open the ${name} skill`}
      onPointerEnter={event => { if (event.pointerType === "mouse") show(skill, event.currentTarget); }}
      onPointerLeave={() => setPeek(null)} onFocus={event => show(skill, event.currentTarget)} onBlur={() => setPeek(null)}
      onClick={() => open(skill)}>{name}</button>;
  };
  const inline = (text: string, key: string) => text.split(/(\[\[[a-z0-9-]+\]\]|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("[[")) return link(part.slice(2, -2), `${key}-${i}`);
    if (part.startsWith("`")) return <code key={`${key}-${i}`}>{part.slice(1, -1)}</code>;
    return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
  });
  const body = (text: string) => {
    const blocks: ReactNode[] = [];
    let list: { ordered: boolean; items: ReactNode[] } | null = null;
    const flush = () => { if (list) { const List = list.ordered ? "ol" : "ul"; blocks.push(<List key={blocks.length}>{list.items}</List>); list = null; } };
    text.split("\n").forEach((line, i) => {
      const bullet = /^- (.*)/.exec(line), step = /^\d+\. (.*)/.exec(line);
      if (bullet || step) {
        const ordered = !!step;
        if (list && list.ordered !== ordered) flush();
        list ??= { ordered, items: [] };
        list.items.push(<li key={i}>{inline((bullet ?? step)![1], `l${i}`)}</li>);
        return;
      }
      flush();
      if (line.startsWith("## ")) blocks.push(<h3 key={i}>{line.slice(3)}</h3>);
      else if (line.startsWith("# ")) blocks.push(<h2 key={i}>{line.slice(2)}</h2>);
      else if (line.trim()) blocks.push(<p key={i}>{inline(line, `p${i}`)}</p>);
    });
    flush();
    return blocks;
  };

  return <div ref={root} className={styles.root}>
    <nav className={styles.tree} aria-label="Skills">
      <div className={styles.treeRoot}>~/.storm/skills</div>
      {files.map(({ skill, depth, folder, last }) => <button key={skill.path} type="button"
        className={`${depth ? styles.child : styles.parent} ${skill === current ? styles.active : ""}`} aria-current={skill === current ? "page" : undefined}
        title={`${skill.path}`} onClick={() => open(skill)}>
        {depth ? <span className={styles.branch} aria-hidden="true">{last ? "└─" : "├─"}</span> : <span className={styles.icon} aria-hidden="true" />}
        <span className={styles.folder}>{folder}</span>
      </button>)}
    </nav>
    <article ref={page} className={styles.page} onScroll={() => setPeek(null)}>
      <div className={styles.path}>~/.storm/skills/{current.path}</div>
      <pre className={styles.frontmatter} aria-label="Frontmatter">
        <span className={styles.rule}>---</span>{"\n"}
        <span className={styles.key}>name:</span> {current.name}{"\n"}
        <span className={styles.key}>description:</span> {inline(current.description, "d")}{"\n"}
        {current.allowedTools && <><span className={styles.key}>allowed-tools:</span> {current.allowedTools}{"\n"}</>}
        <span className={styles.rule}>---</span>
      </pre>
      <div className={styles.body}>{body(current.body)}</div>
    </article>
    {peek && <aside className={`${styles.peek} ${peek.below ? "" : styles.above}`} style={{ left: peek.x, top: peek.y }} role="tooltip">
      <div className={styles.peekTitle}><span>{peek.skill.path.replace(/\/SKILL\.md$/, "")}/SKILL.md</span></div>
      <div className={styles.peekBody}>
        <strong>{peek.skill.name}</strong>
        <p>{peek.skill.description.replace(/\[\[([a-z0-9-]+)\]\]/g, "$1")}</p>
        {peek.skill.allowedTools && <small>allowed-tools: {peek.skill.allowedTools}</small>}
        <em>Click to load skill</em>
      </div>
    </aside>}
  </div>;
}
