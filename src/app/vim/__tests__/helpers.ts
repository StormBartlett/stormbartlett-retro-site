import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from 'prosemirror-state';
import { Vimirror } from '../Vimirror';
import { VimModes } from '../types';

export function createEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit, Vimirror],
    content,
  });
}

export function setCursor(editor: Editor, pos: number) {
  const $pos = editor.state.doc.resolve(pos);
  editor.view.dispatch(
    editor.state.tr.setSelection(new TextSelection($pos, $pos))
  );
}

export function pressKey(editor: Editor, key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });

  // Run through handleDOMEvents.keydown first
  let handled = false;
  for (const plugin of editor.state.plugins) {
    const handler = (plugin.props.handleDOMEvents as Record<string, any>)?.keydown;
    if (handler) {
      const result = handler(editor.view, event);
      if (result) { handled = true; break; }
    }
  }

  // Then run through handleKeyDown (prosemirror-keymap)
  if (!handled) {
    for (const plugin of editor.state.plugins) {
      if (plugin.props.handleKeyDown) {
        const result = plugin.props.handleKeyDown(editor.view, event);
        if (result) break;
      }
    }
  }
}

export function cursorPos(editor: Editor): number {
  return editor.state.selection.from;
}

export function docText(editor: Editor): string {
  return editor.state.doc.textContent;
}

export function getMode(editor: Editor): VimModes {
  return (editor.storage as any).vimirror.currentVimMode;
}
