"use client";

import { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Vimirror } from "./vim/Vimirror";

type TiptapEditorProps = {
  initialText?: string;
};

// Using Vimirror plugin for Vim keybindings

export default function TiptapEditor({ initialText = "Founder — NoteTime Pty Ltd" }: TiptapEditorProps) {
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

  return (
    <div className="pm-editor">
      <EditorContent editor={editor} />
    </div>
  );
}


