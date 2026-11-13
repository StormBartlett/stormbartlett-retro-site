"use client";

import { useId, useState } from "react";
import styles from "./ProjectTasks.module.css";

type ProjectTasksProps = { onOpenApp?: (id: string) => void };
type WorkFilter = "all" | "project" | "role";

const CURRENT_WORK = [
  {
    id: "noteception",
    name: "Noteception",
    type: "project" as const,
    label: "Current project",
    description: "Explore Noteception on the web to see what’s being built.",
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
  const instanceId = useId();

  const visibleWork = CURRENT_WORK.filter((work) => filter === "all" || work.type === filter);

  return (
    <section className={styles.root} aria-label="Project Manager">
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h2 className={styles.heading}>Current work<span className={styles.cursor} aria-hidden="true">_</span></h2>
          <div className={styles.workCount} aria-label="2 current work items">02<span>ACTIVE</span></div>
        </div>
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
                      {"href" in work ? <a href={work.href} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>{work.linkLabel}<span aria-hidden="true">↗</span></a> : onOpenApp ? <button type="button" className={styles.detailLink} onClick={() => onOpenApp("about")}>About Storm<span aria-hidden="true">↗</span></button> : <span className={styles.roleDetail}>{work.detail}</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className={styles.statusNote}><span aria-hidden="true">◇</span> Portfolio status · not live system activity</div>
        </div>

      </div>
      <footer className={styles.footer}><span className={styles.footerMark} aria-hidden="true">▦</span><span>PROJECT MANAGER</span><span>2 current items</span></footer>
    </section>
  );
}
