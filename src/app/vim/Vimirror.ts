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
  [Motions.MoveDown]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc } = state;
    const from = state.selection.from;
    const $pos = doc.resolve(from);
    const offset = from - $pos.start();
    try {
      const after = $pos.after($pos.depth);
      if (after >= doc.content.size) return false;
      const $next = doc.resolve(after + 1);
      const target = Math.min($next.start() + offset, $next.end());
      dispatch(state.tr.setSelection(new TextSelection(doc.resolve(target), doc.resolve(target))));
      return true;
    } catch { return false; }
  },
  [Motions.MoveUp]: ({ editor }) => {
    const { state, view: { dispatch } } = editor as Editor;
    const storage = (editor.storage as unknown as { vimirror: VimirrorStorage }).vimirror;
    if (storage.currentVimMode === VimModes.Insert) return false;
    const { doc } = state;
    const from = state.selection.from;
    const $pos = doc.resolve(from);
    const offset = from - $pos.start();
    try {
      const before = $pos.before($pos.depth);
      if (before <= 0) return false;
      const $prev = doc.resolve(before - 1);
      const target = Math.min($prev.start() + offset, $prev.end());
      dispatch(state.tr.setSelection(new TextSelection(doc.resolve(target), doc.resolve(target))));
      return true;
    } catch { return false; }
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
  pendingOp: null | { type: 'd' | 'y' | 'c'; from: number };
  pendingKey: string | null;
  pendingReplace: boolean;
  yankText: string;
  yankIsLinewise: boolean;
  lastAction: null | { keys: string[] };
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
      pendingKey: null,
      pendingReplace: false,
      yankText: "",
      yankIsLinewise: false,
      lastAction: null,
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

            // Handle pending replace (r + next char)
            if (storage.pendingReplace) {
              storage.pendingReplace = false;
              if (event.key.length === 1) {
                const head = state.selection.from;
                const to = Math.min(state.doc.content.size, head + 1);
                if (to > head) {
                  let tr = state.tr.delete(head, to);
                  tr = tr.insertText(event.key, head);
                  view.dispatch(tr);
                  storage.lastAction = { keys: ['r', event.key] };
                }
              }
              event.preventDefault();
              return true;
            }
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
                // Inside a word: skip to its start
                while (i >= 0 && isWord(text[i])) i--;
                return Math.max(start, start + i + 1);
              } else {
                // On whitespace/separator: skip non-word, then skip the word before it
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

            // Handle pending key (e.g. gg, dgg) — must be before pendingOp handler
            if (storage.pendingKey === 'g') {
              storage.pendingKey = null;
              if (event.key === 'g') {
                if (storage.pendingOp) {
                  // dgg/ygg/cgg: operate from cursor to start of document
                  const head = getHead();
                  const { end: lineEnd } = getLineBounds(head);
                  const firstStart = state.doc.resolve(1).start();
                  const deleted = state.doc.textBetween(firstStart, lineEnd, "\n", "\n");
                  storage.yankText = deleted;
                  let tr = state.tr;
                  if (storage.pendingOp.type === 'd' || storage.pendingOp.type === 'c') tr = tr.delete(firstStart, lineEnd);
                  if (storage.pendingOp.type === 'c') tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
                  view.dispatch(tr);
                  storage.pendingOp = null;
                } else {
                  // gg: go to start of document
                  const target = 1;
                  view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(target), state.doc.resolve(target))));
                }
                event.preventDefault();
                return true;
              }
              // Unknown g-combo, cancel pending
              if (storage.pendingOp) { storage.pendingOp = null; }
            }

            // Complete pending operator (d/y/c + motion)
            if (storage.pendingOp) {
              const opType = storage.pendingOp.type;
              const from = storage.pendingOp.from;
              const head = getHead();
              const { start: lineStart, end: lineEnd } = getLineBounds(head);

              // Helper: execute the operator on a range
              const execOp = (lo: number, hi: number, linewise = false) => {
                if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
                const deleted = state.doc.textBetween(lo, hi, "\n", "\n");
                storage.yankText = deleted;
                storage.yankIsLinewise = linewise;
                let tr = state.tr;
                if (opType === 'd' || opType === 'c') tr = tr.delete(lo, hi);
                if (opType === 'c') tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
                view.dispatch(tr);
                storage.pendingOp = null;
                event.preventDefault();
              };

              switch (event.key) {
                case 'w': {
                  execOp(Math.min(from, wordForwardPos(head)), Math.max(from, wordForwardPos(head)));
                  return true;
                }
                case 'd': case 'c': {
                  // dd/cc: operate on whole line
                  const $h = state.doc.resolve(head);
                  const nodeStart = $h.before($h.depth);
                  const nodeEnd = $h.after($h.depth);
                  const deleted = state.doc.textBetween(lineStart, lineEnd, "\n", "\n");
                  storage.yankText = deleted;
                  storage.yankIsLinewise = true;
                  let tr = state.tr;
                  if (opType === 'd') {
                    // Delete whole paragraph node if more than one exists, otherwise clear content
                    if (state.doc.childCount > 1) {
                      tr = tr.delete(nodeStart, nodeEnd);
                    } else {
                      tr = tr.delete(lineStart, lineEnd);
                    }
                  } else {
                    // cc: clear content but keep the paragraph, enter insert
                    tr = tr.delete(lineStart, lineEnd);
                    tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
                  }
                  view.dispatch(tr);
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case '0': {
                  execOp(Math.min(from, lineStart), Math.max(from, lineStart));
                  return true;
                }
                case '$': {
                  const to = Math.max(lineStart, lineEnd - 1);
                  execOp(Math.min(from, to), Math.max(from, to));
                  return true;
                }
                case 'e': {
                  const to = wordEndPos(head);
                  execOp(Math.min(from, to + 1), Math.max(from, to + 1));
                  return true;
                }
                case 'b': {
                  execOp(Math.min(from, wordBackwardPos(head)), Math.max(from, wordBackwardPos(head)));
                  return true;
                }
                case 'j': {
                  const $h = state.doc.resolve(head);
                  try {
                    const after = $h.after($h.depth);
                    if (after < state.doc.content.size) {
                      const $next = state.doc.resolve(after + 1);
                      execOp(lineStart, $next.end(), true);
                    }
                  } catch { /* at last line */ }
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'k': {
                  const $h = state.doc.resolve(head);
                  try {
                    const before = $h.before($h.depth);
                    if (before > 0) {
                      const $prev = state.doc.resolve(before - 1);
                      execOp($prev.start(), lineEnd, true);
                    }
                  } catch { /* at first line */ }
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                case 'G': {
                  const lastEnd = state.doc.resolve(state.doc.content.size - 1).end();
                  execOp(lineStart, lastEnd, true);
                  return true;
                }
                case 'g': {
                  // dg/cg -> wait for second g
                  storage.pendingKey = 'g';
                  event.preventDefault();
                  return true;
                }
                case 'y': {
                  // yy: yank line
                  const deleted = state.doc.textBetween(lineStart, lineEnd, "\n", "\n");
                  storage.yankText = deleted;
                  storage.yankIsLinewise = true;
                  storage.pendingOp = null;
                  event.preventDefault();
                  return true;
                }
                default: {
                  storage.pendingOp = null;
                  return false;
                }
              }
            }

            // 0: move to start of line
            if (event.key === '0' && !storage.pendingOp) {
              const head = getHead();
              const { start } = getLineBounds(head);
              view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(start), state.doc.resolve(start))));
              event.preventDefault();
              return true;
            }

            // $: move to end of line
            if (event.key === '$' && !storage.pendingOp) {
              const head = getHead();
              const { end } = getLineBounds(head);
              view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(end), state.doc.resolve(end))));
              event.preventDefault();
              return true;
            }

            // ^: move to first non-whitespace character
            if (event.key === '^' && !storage.pendingOp) {
              const head = getHead();
              const { start, end } = getLineBounds(head);
              const text = state.doc.textBetween(start, end, "\0", "\0");
              let offset = 0;
              while (offset < text.length && /\s/.test(text[offset])) offset++;
              const target = start + offset;
              view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(target), state.doc.resolve(target))));
              event.preventDefault();
              return true;
            }

            // e: move to end of word
            if (event.key === 'e' && !storage.pendingOp) {
              const head = getHead();
              // Move at least one character forward before finding word end
              const startPos = Math.min(head + 1, state.doc.content.size);
              const target = wordEndPos(startPos);
              view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(target), state.doc.resolve(target))));
              event.preventDefault();
              return true;
            }

            // G: go to end of document
            if (event.key === 'G' && !storage.pendingOp) {
              const lastChild = state.doc.lastChild;
              if (lastChild) {
                const target = state.doc.content.size - 1; // inside last paragraph
                const $target = state.doc.resolve(target);
                view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve($target.start()), state.doc.resolve($target.start()))));
              }
              event.preventDefault();
              return true;
            }

            // w: jump to start of next word (using wordForwardPos)
            if (event.key === 'w' && !storage.pendingOp) {
              const head = getHead();
              const target = wordForwardPos(head);
              if (target !== head) {
                view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(target), state.doc.resolve(target))));
              }
              event.preventDefault();
              return true;
            }

            // b: jump to start of previous word (using wordBackwardPos)
            if (event.key === 'b' && !storage.pendingOp) {
              const head = getHead();
              const target = wordBackwardPos(head);
              if (target !== head) {
                view.dispatch(state.tr.setSelection(new TextSelection(state.doc.resolve(target), state.doc.resolve(target))));
              }
              event.preventDefault();
              return true;
            }

            // g: start pending key for gg
            if (event.key === 'g' && !storage.pendingOp) {
              storage.pendingKey = 'g';
              event.preventDefault();
              return true;
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

            // Start change operator
            if (event.key === 'c') {
              storage.pendingOp = { type: 'c', from: getHead() };
              event.preventDefault();
              return true;
            }

            // Paste after/before
            if (event.key === 'p') {
              if (storage.yankText && storage.yankText.length > 0) {
                if (storage.yankIsLinewise) {
                  // Line-wise paste: insert new paragraph below current line
                  const head = getHead();
                  const $pos = state.doc.resolve(head);
                  const after = $pos.after($pos.depth);
                  let tr = state.tr.insert(after, state.schema.nodes.paragraph.create(null, storage.yankText ? state.schema.text(storage.yankText) : null));
                  const newPos = after + 1; // start of new paragraph
                  tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
                  view.dispatch(tr);
                } else {
                  // Char-wise paste: insert after cursor, cursor on last pasted char
                  const head = getHead();
                  const hasNextChar = state.doc.textBetween(head, Math.min(head + 1, state.doc.content.size), '\0', '\0').length > 0;
                  const insertAt = hasNextChar ? Math.min(state.doc.content.size, head + 1) : head;
                  let tr = state.tr.insertText(storage.yankText, insertAt);
                  const newPos = Math.min(tr.doc.content.size - 1, insertAt + storage.yankText.length - 1);
                  tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
                  view.dispatch(tr);
                }
              }
              event.preventDefault();
              return true;
            }
            if (event.key === 'P') {
              if (storage.yankText && storage.yankText.length > 0) {
                if (storage.yankIsLinewise) {
                  // Line-wise paste: insert new paragraph above current line
                  const head = getHead();
                  const $pos = state.doc.resolve(head);
                  const before = $pos.before($pos.depth);
                  let tr = state.tr.insert(before, state.schema.nodes.paragraph.create(null, storage.yankText ? state.schema.text(storage.yankText) : null));
                  const newPos = before + 1; // start of new paragraph
                  tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
                  view.dispatch(tr);
                } else {
                  // Char-wise paste: insert before cursor, cursor on last pasted char
                  const insertAt = getHead();
                  let tr = state.tr.insertText(storage.yankText, insertAt);
                  const newPos = Math.min(tr.doc.content.size - 1, insertAt + storage.yankText.length - 1);
                  tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
                  view.dispatch(tr);
                }
              }
              event.preventDefault();
              return true;
            }

            // a: append after cursor
            if (event.key === 'a') {
              const head = getHead();
              const { end } = getLineBounds(head);
              const newPos = Math.min(head + 1, end);
              let tr = state.tr.setSelection(new TextSelection(state.doc.resolve(newPos), state.doc.resolve(newPos)));
              tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // A: append at end of line
            if (event.key === 'A') {
              const head = getHead();
              const { end } = getLineBounds(head);
              let tr = state.tr.setSelection(new TextSelection(state.doc.resolve(end), state.doc.resolve(end)));
              tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // I: insert at start of line
            if (event.key === 'I') {
              const head = getHead();
              const { start } = getLineBounds(head);
              let tr = state.tr.setSelection(new TextSelection(state.doc.resolve(start), state.doc.resolve(start)));
              tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // o: open line below
            if (event.key === 'o') {
              const head = getHead();
              const { end } = getLineBounds(head);
              const $end = state.doc.resolve(end);
              const after = $end.after($end.depth);
              let tr = state.tr.insert(after, state.schema.nodes.paragraph.create());
              const newPos = after + 1; // inside the new empty paragraph
              tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
              tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // O: open line above
            if (event.key === 'O') {
              const head = getHead();
              const $pos = state.doc.resolve(head);
              const before = $pos.before($pos.depth);
              let tr = state.tr.insert(before, state.schema.nodes.paragraph.create());
              const newPos = before + 1; // inside the new empty paragraph
              tr = tr.setSelection(new TextSelection(tr.doc.resolve(newPos), tr.doc.resolve(newPos)));
              tr = tr.setMeta(TransactionMeta.ChangeModeTo, VimModes.Insert);
              view.dispatch(tr);
              event.preventDefault();
              return true;
            }

            // x: delete character under cursor
            if (event.key === 'x') {
              const head = getHead();
              const to = Math.min(state.doc.content.size, head + 1);
              if (to > head) {
                storage.yankText = state.doc.textBetween(head, to, '\\n', '\\n');
                storage.yankIsLinewise = false;
                view.dispatch(state.tr.delete(head, to));
                storage.lastAction = { keys: ['x'] };
                event.preventDefault();
                return true;
              }
            }

            // r: replace character under cursor (waits for next key)
            if (event.key === 'r') {
              storage.pendingReplace = true;
              event.preventDefault();
              return true;
            }

            // J: join current line with next line
            if (event.key === 'J') {
              const head = getHead();
              const $pos = state.doc.resolve(head);
              try {
                const after = $pos.after($pos.depth);
                if (after < state.doc.content.size) {
                  const $next = state.doc.resolve(after + 1);
                  const nextText = state.doc.textBetween($next.start(), $next.end(), "\0", "\0");
                  const { end: curEnd } = getLineBounds(head);
                  // Delete the next paragraph and append its text to current line with a space
                  let tr = state.tr;
                  // Remove the next paragraph node
                  tr = tr.delete($next.before($next.depth), $next.after($next.depth));
                  // Insert the text at the end of the current line
                  if (nextText.length > 0) {
                    tr = tr.insertText(' ' + nextText, curEnd);
                  }
                  view.dispatch(tr);
                  storage.lastAction = { keys: ['J'] };
                }
              } catch { /* at last line */ }
              event.preventDefault();
              return true;
            }

            // .: repeat last action
            if (event.key === '.') {
              if (storage.lastAction) {
                for (const key of storage.lastAction.keys) {
                  // Re-simulate the key sequence
                  const fakeEvent = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                  let handled = false;
                  for (const plugin of view.state.plugins) {
                    const handler = (plugin.props.handleDOMEvents as Record<string, any>)?.keydown;
                    if (handler) {
                      const result = handler(view, fakeEvent);
                      if (result) { handled = true; break; }
                    }
                  }
                  if (!handled) {
                    for (const plugin of view.state.plugins) {
                      if (plugin.props.handleKeyDown) {
                        const result = plugin.props.handleKeyDown(view, fakeEvent);
                        if (result) break;
                      }
                    }
                  }
                }
              }
              event.preventDefault();
              return true;
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


