import { describe, expect, it } from 'vitest';
import { createProjectFile, paginateProject, paginateUnit, updateBeat, updateUnit, type ManuscriptElement } from '../index.js';

/**
 * The printed pages of a book carry its section and subsection headings, as
 * the Write page shows them (from Ken: *it just needs to look like the
 * manuscript*), in Title Case with the number, never in capitals.
 */
const text = (pages: ReturnType<typeof paginateProject>) => pages.flatMap((page) => page.lines.map((line) => line.text)).join('\n');
const para = (id: string, words: string): ManuscriptElement => ({ id: id as ManuscriptElement['id'], type: 'paragraph', text: words, characterId: null, attributes: {} });

describe('book headings on the printed page', () => {
  const book = () => {
    let file = createProjectFile({ title: 'Guide', format: 'instructional' });
    const unit = file.units[0]!;
    const beat = file.beats.find((one) => one.unitId === unit.id)!;
    file = updateUnit(file, unit.id, { title: 'why do you want to write?' });
    file = updateBeat(file, beat.id, { title: 'the first page', manuscript: { elements: [para('00000000-0000-4000-8000-000000000001', 'Begin anywhere.')] } });
    return { file, unit, beat };
  };

  it('prints the numbered section and subsection headings in Title Case before the writing', () => {
    const { file } = book();
    const printed = text(paginateProject(file));
    expect(printed).toContain('Why Do You Want to Write?');
    expect(printed).toContain('The First Page');
    expect(printed).not.toContain('WHY DO YOU WANT');
    expect(printed.indexOf('Why Do You Want to Write?')).toBeLessThan(printed.indexOf('Begin anywhere.'));
  });

  it('shows the same in the one-section preview, and leaves a heading out when it is switched off', () => {
    const { file, unit } = book();
    expect(text(paginateUnit(file, unit.id))).toContain('Why Do You Want to Write?');
    const off = updateUnit(file, unit.id, { headingShown: false });
    expect(text(paginateProject(off))).not.toContain('Why Do You Want to Write?');
  });

  it('adds nothing to a screenplay', () => {
    const file = createProjectFile({ title: 'Script', format: 'screenplay' });
    expect(text(paginateProject(file))).not.toContain('Opening Scene');
  });
});
