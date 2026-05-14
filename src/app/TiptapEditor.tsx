"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Vimirror } from "./vim/Vimirror";

type TiptapEditorProps = {
  initialText?: string;
};

const SCROLLBAR_BUTTON_HEIGHT = 18;
const SCROLLBAR_THUMB_EDGE_INSET = 3;

// Using Vimirror plugin for Vim keybindings

export default function TiptapEditor({ initialText = "Founder — NoteTime Pty Ltd" }: TiptapEditorProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollbar, setScrollbar] = useState({ visible: false, top: SCROLLBAR_THUMB_EDGE_INSET, height: 34 });
  const content = useMemo(() => {
    // Convert plain text with newlines to simple paragraphs
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = initialText.split(/\n/);
    if (lines.length === 0) return "<p><br/></p>";
    return lines.map((l) => `<p>${escape(l) || "<br/>"}</p>`).join("");
  }, [initialText]);

  const editor = useEditor({
    extensions: [StarterKit, Vimirror],
    content,
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
    autofocus: true,
    immediatelyRender: false,
  });

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const updateScrollbar = () => {
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 1) {
        setScrollbar({ visible: false, top: SCROLLBAR_THUMB_EDGE_INSET, height: 34 });
        return;
      }

      const trackHeight = Math.max(1, scroller.clientHeight - SCROLLBAR_BUTTON_HEIGHT * 2);
      const height = Math.max(34, Math.round((scroller.clientHeight / scroller.scrollHeight) * trackHeight));
      const travel = Math.max(1, trackHeight - height - SCROLLBAR_THUMB_EDGE_INSET * 2);
      const top = SCROLLBAR_THUMB_EDGE_INSET + Math.round((scroller.scrollTop / maxScroll) * travel);
      setScrollbar({ visible: true, top, height });
    };

    updateScrollbar();
    scroller.addEventListener("scroll", updateScrollbar, { passive: true });
    window.addEventListener("resize", updateScrollbar);
    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", updateScrollbar);
      window.removeEventListener("resize", updateScrollbar);
      resizeObserver.disconnect();
    };
  }, [editor]);

  const scrollBy = (delta: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop += delta;
  };

  const startThumbDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    event.preventDefault();

    const startY = event.clientY;
    const startScrollTop = scroller.scrollTop;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const trackHeight = Math.max(1, scroller.clientHeight - SCROLLBAR_BUTTON_HEIGHT * 2);
    const travel = Math.max(1, trackHeight - scrollbar.height - SCROLLBAR_THUMB_EDGE_INSET * 2);

    const move = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      scroller.scrollTop = startScrollTop + (deltaY / travel) * maxScroll;
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="pm-editor-shell">
      <div className="pm-editor" ref={scrollRef}>
        <EditorContent editor={editor} />
      </div>
      <div className={`retro-scrollbar ${scrollbar.visible ? "is-visible" : ""}`} aria-hidden="true">
        <button className="retro-scrollbar-button retro-scrollbar-button-up" type="button" tabIndex={-1} onClick={() => scrollBy(-48)} />
        <div className="retro-scrollbar-track">
          {scrollbar.visible && (
            <div
              className="retro-scrollbar-thumb"
              style={{ top: scrollbar.top, height: scrollbar.height }}
              onPointerDown={startThumbDrag}
            />
          )}
        </div>
        <button className="retro-scrollbar-button retro-scrollbar-button-down" type="button" tabIndex={-1} onClick={() => scrollBy(48)} />
      </div>
    </div>
  );
}
