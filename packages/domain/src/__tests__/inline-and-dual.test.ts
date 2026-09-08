import { describe, expect, it } from 'vitest';
import { parseInline, parseInlineMarks, plainInline, toggleInline } from '../entities/inline.js';
import { groupManuscript, isDual } from '../editing.js';
import { paginateElements, SCREENPLAY_LAYOUT } from '../pagination.js';
import { createProjectFile } from '../project-file.js';
import { setDualDialogue, updateBeat } from '../mutations.js';
import { renderProject } from '../render.js';
import { renderPrintDocumentHtml } from '../print-html.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { ManuscriptElementId } from '../ids.js';

const element = (type: ManuscriptElementType, text: string, attributes: Record<string, boolean> = {}): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes,
});

describe('emphasis inside a line', () => {
  it('reads the marks the screenplay world already uses', () => {
    expect(parseInline('He is **not** joking.')).toEqual([
      { text: 'He is ' },
      { text: 'not', bold: true },
      { text: ' joking.' },
    ]);
    expect(parseInline('*Quietly*, then _louder_.')).toEqual([
      { text: 'Quietly', italic: true },
      { text: ', then ' },
      { text: 'louder', underline: true },
      { text: '.' },
    ]);
    expect(parseInline('***Both***')).toEqual([{ text: 'Both', bold: true, italic: true }]);
    // Nested, and a mark inside a word.
    expect(parseInline('**a *b* c**')).toEqual([
      { text: 'a ', bold: true },
      { text: 'b', bold: true, italic: true },
      { text: ' c', bold: true },
    ]);
  });

  it('leaves an unclosed mark, and an escaped one, as the characters they are', () => {
    expect(plainInline('5 * 3 = 15')).toBe('5 * 3 = 15');
    expect(parseInline('5 * 3')).toEqual([{ text: '5 * 3' }]);
    expect(plainInline('a_b_c')).toBe('abc');
    expect(plainInline('two \\*stars\\* here')).toBe('two *stars* here');
    expect(plainInline('**bold**')).toBe('bold');
  });

  it('covers every character when the marks are kept, so an editor can draw over them', () => {
    const written = 'He is **not** joking.';
    const spans = parseInlineMarks(written);
    expect(spans.map((span) => span.text).join('')).toBe(written);
    expect(spans.filter((span) => span.marker).map((span) => span.text)).toEqual(['**', '**']);
    expect(spans.find((span) => span.text === 'not')?.bold).toBe(true);
  });

  it('puts emphasis on a selection and takes it off again', () => {
    const on = toggleInline('He is not joking.', 6, 9, 'bold');
    expect(on.text).toBe('He is **not** joking.');
    expect([on.selectionStart, on.selectionEnd]).toEqual([8, 11]);

    const off = toggleInline(on.text, on.selectionStart, on.selectionEnd, 'bold');
    expect(off.text).toBe('He is not joking.');
    expect([off.selectionStart, off.selectionEnd]).toEqual([6, 9]);

    // With nothing selected the pair is opened for typing.
    const empty = toggleInline('He is ', 6, 6, 'italic');
    expect(empty.text).toBe('He is **');
    expect(empty.selectionStart).toBe(7);
  });
});

describe('emphasis on the page', () => {
  const script = () =>
    paginateElements(
      [element('action', 'He is **not** joking.'), element('character', 'mike'), element('dialogue', 'I *mean* it.')],
      SCREENPLAY_LAYOUT,
    );

  it('prints without the marks, and carries the styling to the renderer', () => {
    const [page] = script();
    const lines = page!.lines.filter((line) => line.text.length > 0);
    expect(lines[0]!.text).toBe('He is not joking.');
    expect(lines[0]!.spans).toEqual([{ text: 'He is ' }, { text: 'not', bold: true }, { text: ' joking.' }]);
    // The cue is still capitalised, and styling survives it.
    expect(lines[1]!.text).toBe('MIKE');
    expect(lines[2]!.spans.find((span) => span.italic)?.text).toBe('mean');
  });

  it('wraps on the printed text, not on the marks', () => {
    const long = `**${'word '.repeat(20).trim()}**`;
    const [page] = paginateElements([element('action', long)], SCREENPLAY_LAYOUT);
    for (const line of page!.lines) {
      expect(line.text.length).toBeLessThanOrEqual(60);
      // Every character of every line kept its emphasis.
      if (line.text.length > 0) expect(line.spans.every((span) => span.bold)).toBe(true);
    }
  });

  it('reaches the printed document and the plain text export', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [element('action', 'He is **not** joking.')] } });
    expect(renderPrintDocumentHtml(file)).toContain('He is <b>not</b> joking.');
    expect(renderProject(file)).toContain('He is not joking.');
    expect(renderProject(file)).not.toContain('**');
  });
});

describe('dual dialogue', () => {
  const twoSpeeches = () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const elements = [
      element('character', 'MIKE'),
      element('dialogue', 'Now don’t take this the wrong way.'),
      element('character', 'CELESTE'),
      element('dialogue', 'No way!'),
    ];
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements } });
    return { file, elements };
  };

  it('marks the second speech and pairs it with the one above', () => {
    const { file, elements } = twoSpeeches();
    const marked = setDualDialogue(file, file.beats[0]!.id, elements[2]!.id, true);
    const written = marked.beats[0]!.manuscript.elements;
    expect(isDual(written[2]!)).toBe(true);

    const items = groupManuscript(written);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe('dual');
    if (items[0]!.kind === 'dual') {
      expect(items[0]!.left.map((member) => member.text)).toEqual(['MIKE', 'Now don’t take this the wrong way.']);
      expect(items[0]!.right.map((member) => member.text)).toEqual(['CELESTE', 'No way!']);
      expect(items[0]!.indexes).toEqual([0, 1, 2, 3]);
    }

    // And taking the mark off puts them back in sequence.
    const undone = setDualDialogue(marked, file.beats[0]!.id, elements[2]!.id, false);
    expect(groupManuscript(undone.beats[0]!.manuscript.elements)).toHaveLength(4);
  });

  it('prints the two speeches side by side, in two columns', () => {
    const { file, elements } = twoSpeeches();
    const marked = setDualDialogue(file, file.beats[0]!.id, elements[2]!.id, true);
    const [page] = paginateElements(marked.beats[0]!.manuscript.elements, SCREENPLAY_LAYOUT);
    const lines = page!.lines.filter((line) => line.text.trim().length > 0);

    // The cues share a line, each over its own column.
    expect(lines[0]!.text).toContain('MIKE');
    expect(lines[0]!.text).toContain('CELESTE');
    expect(lines[0]!.text.indexOf('CELESTE')).toBeGreaterThan(lines[0]!.text.indexOf('MIKE'));
    // Both columns stay inside the 60-character body.
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(60);
    // The speeches are beside each other, not one after the other.
    expect(lines[1]!.text).toMatch(/Now don’t take/);
    expect(lines[1]!.text).toMatch(/No way!/);
  });

  it('is an ordinary speech when there is nothing to sit beside', () => {
    const file = createProjectFile({ title: 'T', format: 'screenplay' });
    const elements = [element('action', 'Rain.'), element('character', 'MIKE', { dual: true }), element('dialogue', 'Hello.')];
    const items = groupManuscript(elements);
    expect(items.every((item) => item.kind === 'element')).toBe(true);
    const [page] = paginateElements(elements, SCREENPLAY_LAYOUT);
    expect(page!.lines.filter((line) => line.text.trim().length > 0).map((line) => line.text)).toEqual([
      'Rain.',
      'MIKE',
      'Hello.',
    ]);
    expect(file.beats).toHaveLength(1);
  });
});
