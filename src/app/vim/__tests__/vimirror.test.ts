import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditor, setCursor, pressKey, cursorPos, docText, getMode } from './helpers';

describe('Vimirror sanity', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('starts in normal mode', () => {
    editor = createEditor('<p>Hello</p>');
    expect(getMode(editor)).toBe('normal');
  });

  it('h moves cursor left', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 3);
    pressKey(editor, 'h');
    expect(cursorPos(editor)).toBe(2);
  });

  it('l moves cursor right', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 1);
    pressKey(editor, 'l');
    expect(cursorPos(editor)).toBe(2);
  });
});

describe('Batch 1: j/k line movement', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  // Two lines: "Hello" (pos 1-6) and "World" (pos 8-13)
  it('j moves cursor to next line same column', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'j');
    expect(cursorPos(editor)).toBe(8); // on "W"
  });

  it('j preserves column offset', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 3); // on "l" (col 2)
    pressKey(editor, 'j');
    expect(cursorPos(editor)).toBe(10); // on "r" (col 2)
  });

  it('j clamps to end of shorter next line', () => {
    editor = createEditor('<p>Hello World</p><p>Hi</p>');
    // "Hello World" pos 1-12, "Hi" pos 14-16
    setCursor(editor, 10); // near end of "Hello World" (col 9)
    pressKey(editor, 'j');
    // Should clamp to end of "Hi" (pos 16 = end of "Hi")
    const pos = cursorPos(editor);
    const $pos = editor.state.doc.resolve(pos);
    expect(pos).toBeLessThanOrEqual($pos.end());
    expect(pos).toBeGreaterThanOrEqual($pos.start());
  });

  it('j at last line does nothing', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 8); // on "W" in last line
    pressKey(editor, 'j');
    expect(cursorPos(editor)).toBe(8);
  });

  it('k moves cursor to previous line same column', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 8); // on "W"
    pressKey(editor, 'k');
    expect(cursorPos(editor)).toBe(1); // on "H"
  });

  it('k preserves column offset', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 10); // on "r" (col 2)
    pressKey(editor, 'k');
    expect(cursorPos(editor)).toBe(3); // on "l" (col 2)
  });

  it('k at first line does nothing', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'k');
    expect(cursorPos(editor)).toBe(1);
  });

  it('j/k work across 3+ lines', () => {
    editor = createEditor('<p>AAA</p><p>BBB</p><p>CCC</p>');
    setCursor(editor, 1); // on first "A"
    pressKey(editor, 'j');
    pressKey(editor, 'j');
    // Should be on first "C"
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    const lineText = editor.state.doc.textBetween($pos.start(), $pos.end());
    expect(lineText).toBe('CCC');
  });

  it('dj deletes current and next line content', () => {
    editor = createEditor('<p>Hello</p><p>World</p><p>End</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'd');
    pressKey(editor, 'j');
    // "Hello" and "World" text should be deleted, "End" remains
    expect(docText(editor)).toContain('End');
    expect(docText(editor)).not.toContain('Hello');
    expect(docText(editor)).not.toContain('World');
  });

  it('dk deletes previous and current line content', () => {
    editor = createEditor('<p>Hello</p><p>World</p><p>End</p>');
    setCursor(editor, 8); // on "W"
    pressKey(editor, 'd');
    pressKey(editor, 'k');
    // "Hello" and "World" text should be deleted, "End" remains
    expect(docText(editor)).toContain('End');
    expect(docText(editor)).not.toContain('Hello');
    expect(docText(editor)).not.toContain('World');
  });
});

describe('Batch 2: a/A/I/o/O insert mode variants', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('a enters insert mode one position after cursor', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'a');
    expect(getMode(editor)).toBe('insert');
    expect(cursorPos(editor)).toBe(2); // after "H"
  });

  it('A enters insert mode at end of line', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'A');
    expect(getMode(editor)).toBe('insert');
    expect(cursorPos(editor)).toBe(6); // end of "Hello"
  });

  it('I enters insert mode at start of line', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 4); // on second "l"
    pressKey(editor, 'I');
    expect(getMode(editor)).toBe('insert');
    expect(cursorPos(editor)).toBe(1); // start of line
  });

  it('o opens new line below and enters insert mode', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'o');
    expect(getMode(editor)).toBe('insert');
    // New empty paragraph inserted between Hello and World
    // Cursor should be inside the new paragraph
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    const lineText = editor.state.doc.textBetween($pos.start(), $pos.end());
    expect(lineText).toBe(''); // new empty line
    // Doc should now have 3 paragraphs
    expect(editor.state.doc.childCount).toBe(3);
  });

  it('O opens new line above and enters insert mode', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 8); // on "W"
    pressKey(editor, 'O');
    expect(getMode(editor)).toBe('insert');
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    const lineText = editor.state.doc.textBetween($pos.start(), $pos.end());
    expect(lineText).toBe('');
    expect(editor.state.doc.childCount).toBe(3);
  });

  it('o at last line creates line at end', () => {
    editor = createEditor('<p>Only</p>');
    setCursor(editor, 1);
    pressKey(editor, 'o');
    expect(getMode(editor)).toBe('insert');
    expect(editor.state.doc.childCount).toBe(2);
    // Cursor is in second (new) paragraph
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    expect($pos.parent.textContent).toBe('');
  });

  it('O at first line creates line at top', () => {
    editor = createEditor('<p>Only</p>');
    setCursor(editor, 1);
    pressKey(editor, 'O');
    expect(getMode(editor)).toBe('insert');
    expect(editor.state.doc.childCount).toBe(2);
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    expect($pos.parent.textContent).toBe('');
    expect(editor.state.doc.child(1).textContent).toBe('Only');
  });
});

describe('Batch 3: standalone motions 0/$/^/e/G/gg', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('0 moves to start of line', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 6); // on space
    pressKey(editor, '0');
    expect(cursorPos(editor)).toBe(1); // start of line
  });

  it('$ moves to end of line', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, '$');
    expect(cursorPos(editor)).toBe(6); // end of "Hello"
  });

  it('^ moves to first non-whitespace character', () => {
    // Use non-breaking spaces (\u00a0) since HTML collapses regular spaces
    editor = createEditor('<p>\u00a0\u00a0\u00a0Hello</p>');
    setCursor(editor, 6); // somewhere in middle
    pressKey(editor, '^');
    expect(cursorPos(editor)).toBe(4); // on "H" (after 3 nbsp)
  });

  it('^ on line with no leading whitespace goes to start', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 3);
    pressKey(editor, '^');
    expect(cursorPos(editor)).toBe(1);
  });

  it('e moves to end of current/next word', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'e');
    // Should move to end of "Hello" (position 5, on "o")
    expect(cursorPos(editor)).toBeLessThanOrEqual(6);
    expect(cursorPos(editor)).toBeGreaterThanOrEqual(5);
  });

  it('G moves to start of last line', () => {
    editor = createEditor('<p>First</p><p>Second</p><p>Third</p>');
    setCursor(editor, 1); // on "F"
    pressKey(editor, 'G');
    const $pos = editor.state.doc.resolve(cursorPos(editor));
    const lineText = editor.state.doc.textBetween($pos.start(), $pos.end());
    expect(lineText).toBe('Third');
  });

  it('gg moves to start of document', () => {
    editor = createEditor('<p>First</p><p>Second</p><p>Third</p>');
    // Move to third line first
    setCursor(editor, 15); // somewhere in "Third"
    pressKey(editor, 'g');
    pressKey(editor, 'g');
    expect(cursorPos(editor)).toBe(1); // start of doc
  });

  it('gg from first line stays at start', () => {
    editor = createEditor('<p>Hello</p>');
    setCursor(editor, 3);
    pressKey(editor, 'g');
    pressKey(editor, 'g');
    expect(cursorPos(editor)).toBe(1);
  });

  it('dG deletes from current line to end of document', () => {
    editor = createEditor('<p>First</p><p>Second</p><p>Third</p>');
    setCursor(editor, 8); // on "S" in "Second"
    pressKey(editor, 'd');
    pressKey(editor, 'G');
    expect(docText(editor)).toContain('First');
    expect(docText(editor)).not.toContain('Second');
    expect(docText(editor)).not.toContain('Third');
  });

  it('dgg deletes from current line to start of document', () => {
    editor = createEditor('<p>First</p><p>Second</p><p>Third</p>');
    setCursor(editor, 8); // on "S" in "Second"
    pressKey(editor, 'd');
    pressKey(editor, 'g');
    pressKey(editor, 'g');
    expect(docText(editor)).not.toContain('First');
    expect(docText(editor)).not.toContain('Second');
    expect(docText(editor)).toContain('Third');
  });
});

describe('Batch 4: c operator (change)', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it('cw deletes word and enters insert mode', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'c');
    pressKey(editor, 'w');
    expect(getMode(editor)).toBe('insert');
    expect(docText(editor)).not.toContain('Hello');
    expect(docText(editor)).toContain('World');
  });

  it('cc deletes line content and enters insert mode', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'c');
    pressKey(editor, 'c');
    expect(getMode(editor)).toBe('insert');
    expect(docText(editor)).not.toContain('Hello');
    expect(docText(editor)).toContain('World');
  });

  it('c$ deletes to end of line and enters insert mode', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 6); // on space before "World"
    pressKey(editor, 'c');
    pressKey(editor, '$');
    expect(getMode(editor)).toBe('insert');
    expect(docText(editor)).toContain('Hello');
  });

  it('c0 deletes to start of line and enters insert mode', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 7); // on "W"
    pressKey(editor, 'c');
    pressKey(editor, '0');
    expect(getMode(editor)).toBe('insert');
    expect(docText(editor)).toContain('World');
  });

  it('ce deletes to end of word and enters insert mode', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'c');
    pressKey(editor, 'e');
    expect(getMode(editor)).toBe('insert');
    // "Hello" or most of it should be deleted
    expect(docText(editor)).toContain('World');
  });

  it('cb deletes backward to word start and enters insert mode', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 11); // on "d" in "World"
    pressKey(editor, 'c');
    pressKey(editor, 'b');
    expect(getMode(editor)).toBe('insert');
    expect(docText(editor)).toContain('Hello');
  });
});

describe('Bugfix: w/b standalone motions', () => {
  let editor: Editor;
  afterEach(() => { editor?.destroy(); });

  it('w jumps to start of next word', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'w');
    expect(cursorPos(editor)).toBe(7); // on "W"
  });

  it('w from middle of word jumps to next word', () => {
    editor = createEditor('<p>Hello World End</p>');
    setCursor(editor, 3); // on first "l"
    pressKey(editor, 'w');
    expect(cursorPos(editor)).toBe(7); // on "W"
  });

  it('w skips multiple spaces', () => {
    // Use non-breaking spaces since HTML collapses regular spaces
    editor = createEditor('<p>Hello\u00a0\u00a0\u00a0World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'w');
    expect(cursorPos(editor)).toBe(9); // on "W" (after "Hello" + 3 nbsps)
  });

  it('w at last word stays at end of line', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 7); // on "W"
    pressKey(editor, 'w');
    // Should go to end of line (no next word)
    expect(cursorPos(editor)).toBe(12);
  });

  it('b jumps to start of previous word', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 7); // on "W"
    pressKey(editor, 'b');
    expect(cursorPos(editor)).toBe(1); // on "H"
  });

  it('b from middle of word goes to start of that word', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 9); // on "r"
    pressKey(editor, 'b');
    expect(cursorPos(editor)).toBe(7); // on "W"
  });
});

describe('Bugfix: p/P paste', () => {
  let editor: Editor;
  afterEach(() => { editor?.destroy(); });

  it('p cursor lands on last char of pasted text', () => {
    editor = createEditor('<p>Hello World</p>');
    setCursor(editor, 1);
    // yank "Hello " with dw
    pressKey(editor, 'd');
    pressKey(editor, 'w');
    // doc is now "World", cursor at 1
    pressKey(editor, 'P'); // paste before cursor
    // "Hello World" restored, cursor on last char of "Hello " = space at pos 6
    const pos = cursorPos(editor);
    expect(pos).toBeLessThan(1 + 6 + 1); // not past the pasted text
  });

  it('dd + p pastes as new line below', () => {
    editor = createEditor('<p>First</p><p>Second</p><p>Third</p>');
    setCursor(editor, 1); // on "F"
    pressKey(editor, 'd');
    pressKey(editor, 'd'); // delete "First" line
    // Now 2 paragraphs: "Second", "Third"
    expect(editor.state.doc.childCount).toBe(2);
    pressKey(editor, 'p'); // paste below current line
    // Should restore to 3 paragraphs with "First" after "Second"
    expect(editor.state.doc.childCount).toBe(3);
    // "First" should be in the doc
    expect(docText(editor)).toContain('First');
  });

  it('yy + p pastes line below without deleting', () => {
    editor = createEditor('<p>Hello</p><p>World</p>');
    setCursor(editor, 1); // on "H"
    pressKey(editor, 'y');
    pressKey(editor, 'y'); // yank "Hello" line
    pressKey(editor, 'p'); // paste below
    expect(editor.state.doc.childCount).toBe(3);
    // First and third paragraphs should both be "Hello"
    expect(editor.state.doc.child(0).textContent).toBe('Hello');
    expect(editor.state.doc.child(1).textContent).toBe('Hello');
    expect(editor.state.doc.child(2).textContent).toBe('World');
  });
});
