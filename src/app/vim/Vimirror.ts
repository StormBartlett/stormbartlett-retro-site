import { Extension } from "@tiptap/core";
import { Editor } from "@tiptap/core";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Node as PMNode } from "prosemirror-model";
import { keymap } from "prosemirror-keymap";

import { defaultKeymap, KeyType } from "./defaultKeymap";
import { Action, Actions, Motion, Motions, VimModes } from "./types";

const mappedDefaultKeyMap: Record<string, KeyType> = {};

for (const key of defaultKeymap) {
  mappedDefaultKeyMap[key.keys] = key;
}

const VimModesList = [
  VimModes.Normal,
  VimModes.Insert,
  VimModes.Visual,
  VimModes.Command,
  VimModes.Replace,
];

const wordSeparators = "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/? ";

enum TransactionMeta {
  ChangeModeTo = "changeModeTo",
  SetShowCursor = "setShowCursor",
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    vim: Record<string, never>;
    history: {
      undo: () => ReturnType;
      redo: () => ReturnType;
    };
  }
}

type MotionsInterface = {
  [key in Motions]: Motion;
};

const motions: MotionsInterface = {
  [Motions.MoveToRight]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc } = state;
    const { from, to } = state.selection;
    const [$from, $to] = [doc.resolve(from + 1), doc.resolve(to + 1)];
    const selection = new TextSelection($from, $to);
    dispatch(state.tr.setSelection(selection));
    return true;
  },
  [Motions.MoveToLeft]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc } = state;
    const { from, to } = state.selection;
    const [$from, $to] = [doc.resolve(from - 1), doc.resolve(to - 1)];
    const selection = new TextSelection($from, $to);
    dispatch(state.tr.setSelection(selection));
    return true;
  },
  [Motions.FocusStart]: ({ editor }) => {
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    return editor.commands.focus("start");
  },
  [Motions.FocusEnd]: ({ editor }) => {
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    return editor.commands.focus("end");
  },
  [Motions.WordJumpForward]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc, selection } = state;
    const { from, to } = selection;
    if (from !== to) return false;
    const nodeWithPos = {
      node: undefined,
      pos: 0,
      to: 0,
    } as { node?: PMNode; pos: number; to: number };
    doc.descendants((node, pos) => {
      if (!node.isBlock || nodeWithPos.node) return;
      const [nodeFrom, nodeTo] = [pos, pos + node.nodeSize];
      if (nodeFrom <= from && from <= nodeTo) {
        nodeWithPos.node = node;
        nodeWithPos.pos = pos;
        nodeWithPos.to = nodeTo;
      }
    });
    const content = nodeWithPos.node?.textContent;
    if (!content) return false;
    const inlineSelectionIndex = from - nodeWithPos.pos;
    let foundSeparator = false;
    let indexToJump: number | undefined = undefined;
    for (let i = inlineSelectionIndex; i < nodeWithPos.to; i += 1) {
      const currentChar = content[i];
      if (wordSeparators.includes(currentChar)) foundSeparator = true;
      if (foundSeparator) {
        indexToJump = i + 2;
        break;
      }
    }
    if (!indexToJump) return false;
    const newPos = doc.resolve(nodeWithPos.pos + indexToJump);
    const newSelection = new TextSelection(newPos, newPos);
    dispatch(state.tr.setSelection(newSelection));
    return true;
  },
  [Motions.WordJumpBackward]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc, selection } = state;
    const { from, to } = selection;
    if (from !== to) return false;
    const nodeWithPos = {
      node: undefined,
      pos: 0,
      to: 0,
    } as { node?: PMNode; pos: number; to: number };
    doc.descendants((node, pos) => {
      if (!node.isBlock || nodeWithPos.node) return;
      const [nodeFrom, nodeTo] = [pos, pos + node.nodeSize];
      if (nodeFrom <= from && from <= nodeTo) {
        nodeWithPos.node = node;
        nodeWithPos.pos = pos;
        nodeWithPos.to = nodeTo;
      }
    });
    const content = nodeWithPos.node?.textContent;
    if (!content) return false;
    const inlineSelectionIndex = from - nodeWithPos.pos;
    let indexToJump: number | undefined = undefined;
    for (let i = inlineSelectionIndex - 3; i > 0; i -= 1) {
      const currentChar = content[i];
      if (
        wordSeparators.includes(currentChar) &&
        !wordSeparators.includes(content[i + 1])
      ) {
        indexToJump = i + 1;
        break;
      }
    }
    if (!indexToJump) return false;
    const newPos = doc.resolve(nodeWithPos.pos + indexToJump + 1);
    const newSelection = new TextSelection(newPos, newPos);
    dispatch(state.tr.setSelection(newSelection));
    return true;
  },
};

type ActionsInterface = {
  [key in Actions]: Action;
};

const actions: ActionsInterface = {
  [Actions.EnterInsertMode]: ({
    editor: {
      state: { tr },
      view: { dispatch },
    },
  }) => {
    dispatch(tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert));
    return true;
  },
  [Actions.EnterNormalMode]: ({ editor }) => {
    const { state: { selection, doc, tr }, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    let { from, to } = selection;
    from = from - 1;
    to = to - 1;
    if (from <= 0 && to <= 0) {
      from = 1;
      to = 1;
    }
    const [$from, $to] = [doc.resolve(from), doc.resolve(to)];
    const newSelection = new TextSelection($from, $to);
    let next = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Normal);
    next = next.setMeta(TransactionMeta.SetShowCursor, false);
    if (storage.currentVimMode === VimModes.Insert) next = next.setSelection(newSelection);
    dispatch(next);
    return true;
  },
  [Actions.Undo]: ({ editor }) => {
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    return editor.commands.undo();
  },
  [Actions.Redo]: ({ editor }) => {
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    return editor.commands.redo();
  },
};

interface VimirrorOptions {
  updateValue: ({ mode }: { mode: string }) => void;
}

interface VimirrorStorage {
  editor: Editor;
  decorationSet: DecorationSet;
  prosemirror: HTMLDivElement;
  currentVimMode: VimModes;
  showCursor: boolean;
  cursorDecoration: Decoration;
  pendingOp: null | { type: 'd' | 'y'; from: number };
  yankText: string;
}

const Vimirror = Extension.create<VimirrorOptions, VimirrorStorage>({
  name: "vimirror",

  addOptions() {
    return {
      updateValue: () => {},
    };
  },

  addStorage() {
    return {
      editor: null as unknown as Editor,
      decorationSet: null as unknown as DecorationSet,
      prosemirror: null as unknown as HTMLDivElement,
      cursorDecoration: null as unknown as Decoration,
      currentVimMode: VimModes.Normal,
      showCursor: false,
      pendingOp: null,
      yankText: "",
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    const getStorage = () => this.storage;
    const vimPluginKey = new PluginKey("vimPlugin");

    const vimModesPlugin = new Plugin({
      key: vimPluginKey,
      props: {
        decorations(state) {
          const s = vimPluginKey.getState(state) as { decorationSet: DecorationSet } | undefined;
          return s?.decorationSet || null;
        },
        attributes() {
          const storage = getStorage();
          return {
            "vim-active": "true",
            mode: storage.currentVimMode,
            "show-cursor": storage.showCursor ? "true" : "false",
          } as Record<string, string>;
        },
        handleDOMEvents: {
          keypress: (view, event) => {
            if (getStorage().currentVimMode !== VimModes.Insert) {
              event.preventDefault();
            }
            return true;
          },
          keydown: (view, event) => {
            const storage = getStorage();
            if (storage.currentVimMode === VimModes.Insert) return false;

            const state = view.state;
            const getHead = () => state.selection.from;
            const getLineBounds = (pos: number) => {
              const $pos = state.doc.resolve(pos);
              return { start: $pos.start(), end: $pos.end() };
            };
            const wordForwardPos = (pos: number) => {
              const { end } = getLineBounds(pos);
              const text = state.doc.textBetween(pos, end, "\0", "\0");
              if (!text) return end;
              const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch);
              let i = 0;
              if (isWord(text[0])) {
                while (i < text.length && isWord(text[i])) i++;
                while (i < text.length && !isWord(text[i])) i++;
              } else {
                while (i < text.length && !isWord(text[i])) i++;
              }
              return Math.min(end, pos + i);
            };
            const wordBackwardPos = (pos: number) => {
              const { start } = getLineBounds(pos);
              const text = state.doc.textBetween(start, pos, "\0", "\0");
              if (!text) return start;
              let i = text.length - 1;
              const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch);
              if (isWord(text[i])) {
                while (i >= 0 && isWord(text[i])) i--;
                while (i >= 0 && !isWord(text[i])) i--;
                while (i >= 0 && isWord(text[i])) i--;
                return Math.max(start, start + i + 1);
              } else {
                while (i >= 0 && !isWord(text[i])) i--;
                while (i >= 0 && isWord(text[i])) i--;
                return Math.max(start, start + i + 1);
              }
            };
            const wordEndPos = (pos: number) => {
              const { end } = getLineBounds(pos);
              const text = state.doc.textBetween(pos, end, "\0", "\0");
              if (!text) return Math.max(pos, end - 1);
              let i = 0;
              const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch);
              if (!isWord(text[0])) {
                while (i < text.length && !isWord(text[i])) i++;
              }
              if (i < text.length) {
                while (i < text.length && isWord(text[i])) i++;
                return Math.min(end, pos + i - 1);
              }
              return Math.max(pos, end - 1);
            };

            // Complete pending delete operator
            if (storage.pendingOp) {
              const from = storage.pendingOp.from;
              const head = getHead();
              const { start: lineStart, end: lineEnd } = getLineBounds(head);
              switch (event.key) {
                case 'w': {
                  const to = wordForwardPos(head);
                  const lo = Math.min(from, to);
                  const hi = Math.max(from, to);
                  const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lo, hi));
                  if (storage.pendingOp.type === 'y') storage.yankText = deleted;
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'd': {
                  // dd: delete line content
                  const deleted = state.doc.textBetween(lineStart, lineEnd, "\n", "\n");
                  storage.yankText = deleted;
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lineStart, lineEnd));
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case '0': {
                  const lo = Math.min(from, lineStart);
                  const hi = Math.max(from, lineStart);
                  const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                  storage.yankText = deleted;
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lo, hi));
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case '$': {
                  const to = Math.max(lineStart, lineEnd - 1);
                  const lo = Math.min(from, to);
                  const hi = Math.max(from, to);
                  const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                  storage.yankText = deleted;
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lo, hi));
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'e': {
                  const to = wordEndPos(head);
                  const lo = Math.min(from, to + 1);
                  const hi = Math.max(from, to + 1);
                  const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                  storage.yankText = deleted;
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lo, hi));
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'b': {
                  const to = wordBackwardPos(head);
                  const lo = Math.min(from, to);
                  const hi = Math.max(from, to);
                  const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                  storage.yankText = deleted;
                  if (storage.pendingOp.type === 'd') view.dispatch(state.tr.delete(lo, hi));
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'y': { // yy -> yank line
                  const deleted = state.doc.textBetween(lineStart, lineEnd, "\n", "\n");
                  storage.yankText = deleted;
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                default: {
                  // cancel op if unknown
                  storage.pendingOp = null;
                  return false;
                }
              }
            }

            // Start delete operator
            if (event.key === 'd') {
              storage.pendingOp = { type: 'd', from: getHead() };
              event.preventDefault();
              return true;
            }

            // Start yank operator
            if (event.key === 'y') {
              storage.pendingOp = { type: 'y', from: getHead() };
              event.preventDefault();
              return true;
            }

            // Paste after/before
            if (event.key === 'p') {
              const insertAt = (() => {
                const pos = getHead();
                const hasNextChar = state.doc.textBetween(pos, pos + 1, '\\0', '\\0').length > 0;
                return hasNextChar ? Math.min(state.doc.content.size, pos + 1) : pos;
              })();
              if (storage.yankText && storage.yankText.length > 0) {
                let tr = state.tr.insertText(storage.yankText, insertAt);
                const newPos = Math.min(tr.doc.content.size, insertAt + storage.yankText.length);
                const $pos = tr.doc.resolve(newPos);
                tr = tr.setSelection(new TextSelection($pos, $pos));
                view.dispatch(tr);
              }
              event.preventDefault();
              return true;
            }
            if (event.key === 'P') {
              const insertAt = getHead();
              if (storage.yankText && storage.yankText.length > 0) {
                let tr = state.tr.insertText(storage.yankText, insertAt);
                const newPos = Math.min(tr.doc.content.size, insertAt + storage.yankText.length);
                const $pos = tr.doc.resolve(newPos);
                tr = tr.setSelection(new TextSelection($pos, $pos));
                view.dispatch(tr);
              }
              event.preventDefault();
              return true;
            }

            // x: delete character under cursor
            if (event.key === 'x') {
              const head = getHead();
              const to = Math.min(state.doc.content.size, head + 1);
              if (to > head) {
                storage.yankText = state.doc.textBetween(head, to, '\\n', '\\n');
                view.dispatch(state.tr.delete(head, to));
                event.preventDefault();
                return true;
              }
            }

            return false;
          }
        },
      },
      state: {
        init: (_, state) => {
          const storage = getStorage();
          const { from, to } = state.selection;
          const isCollapsed = from === to;
          const hasNextChar = state.doc.textBetween(from, from + 1, "\0", "\0").length > 0;
          if (storage.currentVimMode !== VimModes.Insert && isCollapsed && hasNextChar) {
            // Highlight the next character to mimic a block cursor on the char under the caret
            storage.cursorDecoration = Decoration.inline(from, from + 1, { class: 'vim-cursor' });
          } else if (storage.currentVimMode !== VimModes.Insert && isCollapsed && !hasNextChar) {
            // At EOL/empty line, use a widget so a block is visible
            const dom = document.createElement('span');
            dom.className = 'vim-cursor-widget';
            storage.cursorDecoration = Decoration.widget(from, dom, { side: 0 });
          } else if (!isCollapsed && storage.currentVimMode !== VimModes.Insert) {
            // For ranged selections, do not add a blinking block decoration
            storage.cursorDecoration = null as unknown as Decoration;
          } else {
            // Insert mode: no block cursor decoration
            storage.cursorDecoration = null as unknown as Decoration;
          }
          options.updateValue({ mode: storage.currentVimMode });
          storage.decorationSet = DecorationSet.create(state.doc, storage.cursorDecoration ? [storage.cursorDecoration] : []);
          return {
            mode: storage.currentVimMode,
            decorationSet: storage.decorationSet,
          } as { mode: VimModes; decorationSet: DecorationSet };
        },
        apply: (tr, _, __, newState) => {
          const storage = getStorage();
          const { from, to } = newState.selection;
          const isCollapsed = from === to;
          const hasNextChar = newState.doc.textBetween(from, from + 1, "\0", "\0").length > 0;
          if (storage.currentVimMode !== VimModes.Insert && isCollapsed && hasNextChar) {
            storage.cursorDecoration = Decoration.inline(from, from + 1, { class: 'vim-cursor' });
          } else if (storage.currentVimMode !== VimModes.Insert && isCollapsed && !hasNextChar) {
            const dom = document.createElement('span');
            dom.className = 'vim-cursor-widget';
            storage.cursorDecoration = Decoration.widget(from, dom, { side: 0 });
          } else if (!isCollapsed && storage.currentVimMode !== VimModes.Insert) {
            // Do not decorate multi-char selections (avoid blinking effect)
            storage.cursorDecoration = null as unknown as Decoration;
          } else {
            storage.cursorDecoration = null as unknown as Decoration;
          }
          const changeModeTo: VimModes = tr.getMeta(
            TransactionMeta.ChangeModeTo,
          );
          if (VimModesList.includes(changeModeTo)) {
            storage.currentVimMode = changeModeTo;
            options.updateValue({ mode: storage.currentVimMode });
          }
          const showCursorVal: boolean = tr.getMeta(
            TransactionMeta.SetShowCursor,
          );
          if ([true, false].includes(showCursorVal)) storage.showCursor = showCursorVal;
          storage.decorationSet = DecorationSet.create(newState.doc, storage.cursorDecoration ? [storage.cursorDecoration] : []);
          return {
            mode: storage.currentVimMode,
            decorationSet: storage.decorationSet,
          } as { mode: VimModes; decorationSet: DecorationSet };
        },
      },
    });

    const handleKey = ({ type, motion, mode, action }: KeyType): boolean => {
      const storage = getStorage();
      if (mode && mode !== storage.currentVimMode) return false;
      if (type === "motion" && motion && motions[motion]) return motions[motion]({ editor });
      if (type === "action" && action && actions[action]) return actions[action]({ editor });
      return false;
    };

    const baseVimKeyMap: Record<string, (state?: unknown, dispatch?: unknown, view?: unknown) => boolean> = {};
    for (const [keyString, key] of Object.entries(mappedDefaultKeyMap)) {
      baseVimKeyMap[keyString] = () => handleKey(key);
    }
    const vimKeyMap = keymap(baseVimKeyMap as unknown as Record<string, (state: unknown, dispatch?: unknown, view?: unknown) => boolean>);
    return [vimModesPlugin, vimKeyMap];
  },
});

export { Vimirror };


