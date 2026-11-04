"use client";

import { useEffect, useId, useMemo, useState } from "react";
import styles from "./Postcards.module.css";

type Scene = "coast" | "alpine" | "moon";
type Stamp = "flower" | "star" | "snail";
type Paper = "cream" | "rose" | "mint";
type Card = {
  scene: Scene;
  stamp: Stamp;
  paper: Paper;
  dither: boolean;
  message: string;
  recipient: string;
};
type Draft = Card & { id: string; savedAt: string };

const STORAGE_KEY = "storm-postcards-v1";
const MAX_DRAFTS = 6;
const DEFAULT_CARD: Card = {
  scene: "coast",
  stamp: "flower",
  paper: "cream",
  dither: true,
  message: "Wish you were here.\nTaking the scenic route.",
  recipient: "a friend",
};
const SCENES: { id: Scene; name: string; glyph: string; caption: string }[] = [
  { id: "coast", name: "Coast", glyph: "≈", caption: "THE SCENIC ROUTE" },
  { id: "alpine", name: "Alpine", glyph: "△", caption: "A LITTLE FRESH AIR" },
  { id: "moon", name: "Moon", glyph: "☾", caption: "SOMEWHERE QUIET" },
];
const PAPERS: { id: Paper; name: string; color: string }[] = [
  { id: "cream", name: "Butter", color: "#fff6d8" },
  { id: "rose", name: "Petal", color: "#f7dce4" },
  { id: "mint", name: "Mint", color: "#def0dc" },
];
const STAMPS: { id: Stamp; name: string }[] = [
  { id: "flower", name: "Flower" },
  { id: "star", name: "Star" },
  { id: "snail", name: "Snail" },
];

// User text only enters the SVG as XML-escaped text nodes.
function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[char]!);
}

function cleanText(value: string, limit: number) {
  return Array.from(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")).slice(0, limit).join("");
}

function messageLines(message: string) {
  const lines: string[] = [];
  for (const paragraph of message.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      for (const part of word.match(/.{1,20}/gu) ?? []) {
        if (line && Array.from(`${line} ${part}`).length > 20) {
          lines.push(line);
          line = part;
        } else {
          line = line ? `${line} ${part}` : part;
        }
      }
    }
    lines.push(line);
  }
  if (lines.length > 6) return [...lines.slice(0, 5), `${Array.from(lines[5]).slice(0, 19).join("")}…`];
  return lines;
}

function stampArt(stamp: Stamp) {
  if (stamp === "flower") return `<path fill="#da8095" d="M12 2h8v6h6v8h-6v6h-8v-6H6V8h6z"/><path fill="#fff4a9" d="M12 8h8v8h-8z"/><path fill="#55896a" d="M14 22h4v12h-4zM6 24h8v4H6zM18 27h8v4h-8z"/>`;
  if (stamp === "star") return `<path fill="#f4cb67" stroke="#302d34" stroke-width="1.5" d="M16 2l4 10h11l-9 7 4 12-10-7-10 7 4-12-9-7h11z"/><path d="M11 15h2m7 0h2M14 20h4" stroke="#302d34" stroke-width="2"/>`;
  return `<path fill="#de9eb3" d="M9 11h17v17H9z"/><path d="M14 15h8v9h-8v-5h4" stroke="#302d34" fill="none" stroke-width="2"/><path fill="#c1d0a0" d="M3 25h25v7H3zM3 17h6v12H3z"/><path d="M4 17v-5m4 5v-5" stroke="#302d34" stroke-width="2"/><path d="M2 33h29" stroke="#302d34" stroke-width="2"/>`;
}

function sceneryArt(scene: Scene) {
  if (scene === "coast") return `<rect width="224" height="216" fill="#bce1d9"/><path fill="#e8adc1" d="M140 28h40v8h12v40h-12v8h-40v-8h-12V36h12z"/><path fill="#fff6d8" d="M20 40h32v8h12v8H8v-8h12zm66-14h24v8h12v8H74v-8h12z"/><path fill="#7eb7c5" d="M0 100h224v116H0z"/><path fill="#476e8b" d="M0 116h72v4H0zm110 14h114v4H110zM20 150h80v4H20zm112 23h68v4h-68z"/><path fill="#f4d5a8" d="M0 172h24v-12h32v-12h24v12h24v20h24v20h32v16H0z"/><path fill="#647d61" d="M0 148h20v-16h20v12h16v28H0z"/><path fill="#fff6d8" d="M153 97v-36l-27 36zm5 0V73l20 24z"/><path fill="#383c51" d="M122 101h62l-12 10h-38zM153 57h4v46h-4z"/>`;
  if (scene === "alpine") return `<rect width="224" height="216" fill="#d9d9ef"/><path fill="#f2c5a1" d="M153 23h32v8h8v32h-8v8h-32v-8h-8V31h8z"/><path fill="#fff8e8" d="M16 40h32v8h16v8H8v-8h8z"/><path fill="#9eabc0" d="M-12 150L68 40l80 110z"/><path fill="#f5f4e8" d="M40 79l28-39 28 39-16-5-12 10-12-10z"/><path fill="#7885a3" d="M80 172l81-111 80 111z"/><path fill="#fff6e6" d="M136 95l25-34 25 34-15-3-10 9-11-9z"/><path fill="#7b9e84" d="M0 147h224v69H0z"/><path fill="#e9c99e" d="M95 216l32-65h12l-17 65z"/><path fill="#3f6a5b" d="M17 120h8v12h8v12h8v12H1v-12h8v-12h8zm169 16h8v12h8v12h8v12h-40v-12h8v-12h8z"/><path fill="#594d54" d="M17 156h8v20h-8zm169 16h8v20h-8z"/>`;
  return `<rect width="224" height="216" fill="#45445e"/><path fill="#fff2bc" d="M147 24h40v8h8v40h-8v8h-40v-8h-8V32h8z"/><path fill="#45445e" d="M167 24h20v8h8v24h-28v-8h-8V32h8z"/><path fill="#efc6dc" d="M25 25h4v12h-4zM21 29h12v4H21zm74 30h4v12h-4zM91 63h12v4H91zm95 43h4v12h-4zM182 110h12v4h-12zM51 90h4v4h-4zm73-73h4v4h-4zM20 128h4v4h-4zm115-26h4v4h-4z"/><path fill="#9994b5" d="M0 164h32v-16h40v12h40v-16h48v12h40v12h24v48H0z"/><path fill="#b9afc7" d="M0 190h56v-12h48v12h48v-12h48v12h24v26H0z"/><path fill="#77728f" d="M24 203h40v4H24zm114-5h32v4h-32z"/><path fill="#f5e7dc" d="M91 128h24v24H91zm4 24h16v20H95zm-4 20h8v16h-8zm16 0h8v16h-8zM83 153h12v8H83zm28 0h12v8h-12z"/><path fill="#647b8e" d="M95 132h16v12H95z"/><path d="M123 159q18-10 12 24" fill="none" stroke="#e8c5ce" stroke-width="3"/>`;
}

function postcardSvg(card: Card, patternId: string) {
  const paper = PAPERS.find((item) => item.id === card.paper)!.color;
  const caption = SCENES.find((item) => item.id === card.scene)!.caption;
  const lines = messageLines(card.message);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="352" viewBox="0 0 560 352"><defs><pattern id="${patternId}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#24232c" opacity=".14"/></pattern></defs><rect x="1" y="1" width="558" height="350" rx="2" fill="${paper}" stroke="#24232c" stroke-width="2"/><g transform="translate(20 20)" shape-rendering="crispEdges">${sceneryArt(card.scene)}${card.dither ? `<rect width="224" height="216" fill="url(#${patternId})"/>` : ""}<rect x=".5" y=".5" width="223" height="215" fill="none" stroke="#24232c"/></g><g font-family="monospace" fill="#24232c"><text x="132" y="262" font-size="12" text-anchor="middle" letter-spacing="1">${caption}</text><text x="132" y="287" font-size="10" text-anchor="middle">a small hello from somewhere</text><path d="M56 307h151m-102-4 4 4-4 4m31-8 4 4-4 4" fill="none" stroke="#24232c"/><path d="M266 24v304" stroke="#24232c" stroke-dasharray="3 5"/><text x="286" y="43" font-size="15" letter-spacing="2">POSTCARD</text><text x="287" y="63" font-size="9" letter-spacing="1">LITTLE POST OFFICE</text><g transform="translate(474 21)"><rect x="0" y="0" width="62" height="76" fill="#fffdf3" stroke="#24232c" stroke-dasharray="2 3"/><rect x="6" y="6" width="50" height="64" fill="${card.paper === "rose" ? "#e5e8c3" : "#edcbdb"}" stroke="#24232c"/><g transform="translate(15 14)">${stampArt(card.stamp)}</g><text x="31" y="62" font-size="8" text-anchor="middle">25 HELLOS</text></g><path d="M419 77q18-9 36 0t36 0m-72 5q18-9 36 0t36 0m-72 5q18-9 36 0t36 0" stroke="#24232c" fill="none" opacity=".5"/><text x="287" y="128" font-size="11">DEAR ${escapeXml(card.recipient.trim() || "FRIEND")},</text>${lines.map((line, index) => `<text x="287" y="${155 + index * 22}" font-size="12">${escapeXml(line)}</text>`).join("")}<path d="M287 292h247m-247 24h247" stroke="#24232c" opacity=".3"/><text x="287" y="339" font-size="8" letter-spacing="1">MADE WITH A LITTLE EXTRA CARE ♡</text></g></svg>`;
}

function readDrafts(): Draft[] {
  const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Draft => item !== null && typeof item === "object"
    && typeof item.id === "string" && typeof item.savedAt === "string"
    && SCENES.some((scene) => scene.id === item.scene)
    && STAMPS.some((stamp) => stamp.id === item.stamp)
    && PAPERS.some((paper) => paper.id === item.paper)
    && typeof item.dither === "boolean" && typeof item.message === "string"
    && typeof item.recipient === "string")
    .slice(0, MAX_DRAFTS)
    .map((draft) => ({ ...draft, message: cleanText(draft.message, 110), recipient: cleanText(draft.recipient, 24) }));
}

export default function Postcards() {
  const [card, setCard] = useState<Card>(DEFAULT_CARD);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("A tiny souvenir. A very big hello.");
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svg = useMemo(() => postcardSvg(card, `paper${id}`), [card, id]);

  useEffect(() => {
    try {
      setDrafts(readDrafts());
      setStorageReady(true);
    } catch {
      setNotice("Device storage is unavailable. You can still download your card.");
    }
  }, []);

  function update<K extends keyof Card>(key: K, value: Card[K]) {
    setCard((previous) => ({ ...previous, [key]: value }));
  }

  function saveDraft() {
    const draft: Draft = { ...card, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, savedAt: new Date().toISOString() };
    const next = [draft, ...drafts].slice(0, MAX_DRAFTS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDrafts(next);
      setNotice(drafts.length >= MAX_DRAFTS ? "Saved on this device. Oldest draft replaced." : "Saved on this device. A little keepsake!");
    } catch {
      setNotice("Couldn't save on this device. Try downloading instead.");
    }
  }

  function removeDraft(draftId: string) {
    const next = drafts.filter((draft) => draft.id !== draftId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDrafts(next);
      setNotice("Draft removed from this device.");
    } catch {
      setNotice("Couldn't remove this draft. Device storage is unavailable.");
    }
  }

  function download() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `little-postcard-${card.scene}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your postcard is ready to keep. Thanks for stopping by!");
  }

  return (
    <section className={styles.app} aria-label="Post Office">
      <header className={styles.header}>
        <div><span className={styles.eyebrow}></span><h2>Post Office</h2></div>
        <span className={styles.seal} aria-hidden="true">♡<small>25¢</small></span>
      </header>

      <div className={styles.preview} role="img" aria-label={`Postcard preview: ${card.scene} scenery, ${card.stamp} stamp. Dear ${card.recipient || "friend"}. ${card.message}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={styles.previewLabel}><span>PREVIEW</span><span>01 / 01</span></div>

      <fieldset className={styles.fieldset}>
        <legend><span>01</span> Pick a place</legend>
        <div className={styles.options}>
          {SCENES.map((scene) => <button type="button" key={scene.id} className={`${styles.choice} ${card.scene === scene.id ? styles.selected : ""}`} aria-pressed={card.scene === scene.id} onClick={() => update("scene", scene.id)}><span className={styles.sceneGlyph} aria-hidden="true">{scene.glyph}</span>{scene.name}</button>)}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend><span>02</span> Make it yours</legend>
        <div className={styles.formRow}><label htmlFor={`to-${id}`}>Dear</label><input id={`to-${id}`} value={card.recipient} maxLength={24} placeholder="a friend" onChange={(event) => update("recipient", cleanText(event.target.value, 24))} autoComplete="off" /></div>
        <label className={styles.messageLabel} htmlFor={`message-${id}`}>A small hello <span>{Array.from(card.message).length}/110</span></label>
        <textarea id={`message-${id}`} value={card.message} maxLength={110} rows={3} onChange={(event) => update("message", cleanText(event.target.value, 110))} placeholder="Wish you were here…" />
        <p className={styles.hint}>Keep it short. Your card fits six little lines.</p>
        <div className={styles.stamps} aria-label="Choose a stamp">
          {STAMPS.map((stamp) => <button key={stamp.id} type="button" className={`${styles.stampChoice} ${card.stamp === stamp.id ? styles.selected : ""}`} aria-label={`${stamp.name} stamp`} aria-pressed={card.stamp === stamp.id} onClick={() => update("stamp", stamp.id)}><svg viewBox="0 0 32 36" aria-hidden="true" dangerouslySetInnerHTML={{ __html: stampArt(stamp.id) }} /><span>{stamp.name}</span></button>)}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend><span>03</span> The finishing touches</legend>
        <div className={styles.paperOptions}>
          {PAPERS.map((paper) => <button key={paper.id} type="button" aria-pressed={card.paper === paper.id} className={`${styles.paperChoice} ${card.paper === paper.id ? styles.selected : ""}`} onClick={() => update("paper", paper.id)}><span style={{ background: paper.color }} aria-hidden="true">{card.paper === paper.id ? "✓" : ""}</span>{paper.name}</button>)}
        </div>
        <label className={styles.dither}><input type="checkbox" checked={card.dither} onChange={(event) => update("dither", event.target.checked)} /><span>Old-school dither</span><span className={styles.texture} aria-hidden="true" /></label>
      </fieldset>

      <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={download}>↓ Download SVG</button><button type="button" className={styles.secondaryButton} onClick={saveDraft} disabled={!storageReady}>Save draft</button></div>
      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>

      <div className={styles.drafts}>
        <div className={styles.draftHeading}><h3>The keepsake drawer</h3><span>{drafts.length}/{MAX_DRAFTS}</span></div>
        <p className={styles.deviceNote}>Drafts saved on this device only.</p>
        {drafts.length === 0 ? <p className={styles.empty}>Nothing tucked away. Yet.</p> : <ul>{drafts.map((draft) => <li key={draft.id}><button type="button" className={styles.loadDraft} onClick={() => { const { id: _draftId, savedAt: _savedAt, ...savedCard } = draft; void _draftId; void _savedAt; setCard(savedCard); setNotice("Draft opened. Add another little thought."); }}><span className={styles.draftGlyph} aria-hidden="true">{SCENES.find((scene) => scene.id === draft.scene)?.glyph}</span><span><strong>For {draft.recipient.trim() || "a friend"}</strong><small>{draft.message.replace(/\s+/g, " ") || "A blank little hello"}</small></span><span aria-hidden="true">↗</span></button><button type="button" className={styles.deleteDraft} aria-label={`Delete draft for ${draft.recipient || "a friend"}`} onClick={() => removeDraft(draft.id)}>×</button></li>)}</ul>}
      </div>
      <footer className={styles.footer}></footer>
    </section>
  );
}
