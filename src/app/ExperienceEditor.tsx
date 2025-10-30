"use client";

import { useContext, useEffect, useRef } from "react";
import CodeMirror, { EditorView, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { vim } from "@replit/codemirror-vim";
import { CursorUpdateContext } from "./CursorContext";
import { history } from "@codemirror/commands";
import { myTheme } from "./CodeMirrorTheme";

export default function ExperienceEditor({
  initialText = "Founder — NoteTime Pty Ltd",
  onCursorUpdate: onCursorUpdateProp,
}: {
  initialText?: string;
  onCursorUpdate?: (
    data: {
      x: number;
      y: number;
      width: number;
      height: number;
      visible: boolean;
    } | null
  ) => void;
}) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const rafPending = useRef(false);
  const context = useContext(CursorUpdateContext);
  const onCursorUpdate = onCursorUpdateProp || context.onCursorUpdate;

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;

    const reposition = () => {
      if (!view) {
        if (onCursorUpdate) onCursorUpdate(null);
        return;
      }

      const viewEl: HTMLElement = view.dom;
      const hasFocus = view.hasFocus;
      const isNormalMode = viewEl.classList.contains("cm-fat-cursor");

      if (!isNormalMode || !hasFocus) {
        if (onCursorUpdate) {
          onCursorUpdate(null);
        }
        return;
      }

      const selectionBackground = viewEl.querySelector<HTMLElement>(
        ".cm-selectionBackground"
      );
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
          width:
            Number.isFinite(width) && width > 0
              ? width
              : view.defaultCharacterWidth,
          height:
            Number.isFinite(height) && height > 0
              ? height
              : view.defaultLineHeight,
          visible: true,
        });
      }
    };
    
    const observer = new MutationObserver(() => {
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        reposition();
      });
    });

    observer.observe(view.dom, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
    
    view.scrollDOM.addEventListener("scroll", reposition, { passive: true });
    window.addEventListener("resize", reposition);

    reposition(); // Initial position

    return () => {
      observer.disconnect();
      view.scrollDOM.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [onCursorUpdate]);

  return (
    <div className="pm-editor">
      <CodeMirror
        ref={editorRef}
        value={initialText}
        extensions={[vim(), history(), EditorView.lineWrapping]}
        theme={myTheme}
        autoFocus={true}
      />
    </div>
  );
}
