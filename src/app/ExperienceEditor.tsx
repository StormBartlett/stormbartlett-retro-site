"use client";

import { useEffect, useRef, useContext } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { vim } from "@replit/codemirror-vim";
import { CursorUpdateContext } from "./CursorContext";

type CMView = {
  focus: () => void;
  destroy: () => void;
  dom: HTMLElement & { classList: DOMTokenList };
  state: { selection: { main: { head: number } } };
  coordsAtPos: (pos: number) => { left: number; right: number; top: number; bottom: number } | null;
  hasFocus: boolean;
  scrollDOM: HTMLElement;
  contentDOM: HTMLElement;
  defaultCharacterWidth: number;
  defaultLineHeight: number;
};

export default function ExperienceEditor({
  initialText = "Founder — NoteTime Pty Ltd",
  onCursorUpdate: onCursorUpdateProp
}: {
  initialText?: string;
  onCursorUpdate?: (data: { x: number; y: number; width: number; height: number; visible: boolean } | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CMView | null>(null);
  const rafPending = useRef(false);

  // Get cursor update callback from context (for 3D cursor) or prop
  const context = useContext(CursorUpdateContext);
  const onCursorUpdate = onCursorUpdateProp || context.onCursorUpdate;

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: String(initialText ?? ""),
      extensions: [
        vim(), // Starts in normal mode; Esc/i work out-of-the-box
        history(),
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorView.lineWrapping,
        // EditorView.theme({
        //   ".cm-editor": { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
        //   ".cm-content": { caretColor: "auto", fontVariantLigatures: "none" },
        //   // Stabilize default cursor layer (insert mode)
        //   ".cm-cursor": { transform: "translateZ(0)", backfaceVisibility: "hidden", willChange: "transform", contain: "paint" },
        //   "&.cm-fat-cursor .cm-content": { caretColor: "transparent !important" },
        //   "&.cm-fat-cursor .cm-cursor": { display: "none !important", opacity: "0 !important", visibility: "hidden !important" },
        //   "&.cm-fat-cursor .cm-selectionBackground": {
        //     background: "var(--text) !important",
        //     opacity: "1 !important",
        //   },
        //   "&.cm-fat-cursor .cm-selectionLayer": {
        //     mixBlendMode: "normal",
        //     willChange: "transform",
        //   },
        // }),
        // EditorView.baseTheme({
        //   ".cm-fat-cursor .cm-cursor": { display: "none !important", opacity: "0 !important", visibility: "hidden !important", animation: "none !important" },
        //   ".cm-fat-cursor .cm-cursorLayer": { display: "none !important" },
        //   ".cm-fat-cursor .cm-selectionBackground": {
        //     background: "var(--text)",
        //     opacity: 1,
        //     transform: "translateZ(0)",
        //     backfaceVisibility: "hidden",
        //   },
        // }),
        EditorView.updateListener.of(() => {
          if (rafPending.current) return;
          rafPending.current = true;
          requestAnimationFrame(() => {
            rafPending.current = false;
            reposition();
          });
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    // Note: rely on CSS/theme to hide fat-cursor; avoid DOM class churn

    // Helper to position overlay using contentDOM as reference
    const reposition = () => {
      const view = viewRef.current;
      if (!view) return;

      const viewEl: HTMLElement = view.dom;
      const hasFocus = (document.activeElement === viewEl) || viewEl.contains(document.activeElement);
      const isNormalMode = viewEl.classList.contains("cm-fat-cursor");

      if (!isNormalMode || !hasFocus) {
        if (onCursorUpdate) {
          onCursorUpdate(null);
        }
        return;
      }

      const selectionBackground = viewEl.querySelector<HTMLElement>(".cm-selectionBackground");
      if (!selectionBackground) {
        if (onCursorUpdate) {
          onCursorUpdate(null);
        }
        return;
      }

      const left = parseFloat(selectionBackground.style.left || "");
      const top = parseFloat(selectionBackground.style.top || "");
      const width = parseFloat(selectionBackground.style.width || "");
      const height = parseFloat(selectionBackground.style.height || "");

      if (!Number.isFinite(left) || !Number.isFinite(top)) {
        if (onCursorUpdate) {
          onCursorUpdate(null);
        }
        return;
      }

      if (onCursorUpdate) {
        onCursorUpdate({
          x: left,
          y: top,
          width: Number.isFinite(width) && width > 0 ? width : view.defaultCharacterWidth,
          height: Number.isFinite(height) && height > 0 ? height : view.defaultLineHeight,
          visible: true
        });
      }
    };

    // Focus so normal-mode keys work immediately (Esc, h/j/k/l)
    requestAnimationFrame(() => {
      viewRef.current?.focus();
      reposition();
    });

    const onScroll = () => { reposition(); };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    const onResize = () => { reposition(); };
    window.addEventListener("resize", onResize);

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
      window.removeEventListener("resize", onResize);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      // no observers to clean up
    };
  }, [initialText, onCursorUpdate]);

  return (
    <div className="pm-editor">
      <div ref={hostRef} />
    </div>
  );
}


