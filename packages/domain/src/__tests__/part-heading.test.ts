import { describe, expect, it } from 'vitest';
import {
  addPart,
  addReference,
  bookBlocks,
  bookContentsOf,
  bookRows,
  createProjectFile,
  ebookOf,
  partHeading,
  partsOf,
  setCitationSettings,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **A page's heading, where the writer typed none** (addendum 43 §16): asked
 * of what the page is. A reader extra prints its purpose's heading, as its
 * card has always said it would, and every place that prints or lists the
 * heading reads the same answer.
 */

const withExtra = (about: Record<string, unknown>): { file: ProjectFile; id: string } => {
  const file = createProjectFile({ title: 'The Sea', format: 'instructional', author: 'R. Jones' });
  const made = addPart(file, 'reader_extra', { about });
  return { file: made.file, id: made.partId! };
};

const pageOf = (file: ProjectFile, id: string) => partsOf(file).find((one) => one.id === id)!;

describe('a reader extra’s heading', () => {
  it('is its purpose’s, not the kind’s name', () => {
    const questions = withExtra({ kind: 'questions' });
    expect(partHeading(pageOf(questions.file, questions.id))).toBe('Questions for Discussion');
    const also = withExtra({ kind: 'also_by' });
    expect(partHeading(pageOf(also.file, also.id), also.file)).toBe('Also by R. Jones');
    // A book with no author yet says only that, with no space left hanging.
    const none = addPart(createProjectFile({ title: 'The Sea', format: 'instructional' }), 'reader_extra', { about: { kind: 'also_by' } });
    expect(partHeading(pageOf(none.file, none.partId!), none.file)).toBe('Also by');
  });

  it('prints on the page, in the contents and in the eBook', () => {
    const { file, id } = withExtra({ kind: 'questions', questions: [{ id: 'q1', text: 'Why twice a day?' }] });
    const blocks = bookBlocks(file);
    const opening = blocks.find((block) => block.partId === id && block.kind === 'part_opening')!;
    expect(opening.title).toBe('Questions for Discussion');
    expect(bookContentsOf(blocks, { pages: [], where: new Map(), roman: 0, arabic: 0 }).map((row) => row.title)).toContain('Questions for Discussion');
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    expect(pkg.sections.map((section) => section.title)).toContain('Questions for Discussion');
    expect(pkg.sections.map((section) => section.title)).not.toContain('Reader extras');
  });

  it('is named so on the rail too', () => {
    const { file, id } = withExtra({ kind: 'questions' });
    expect(bookRows(file).find((row) => row.id === id)?.title).toBe('Questions for Discussion');
  });

  it('follows the page when its purpose changes, and gives way to words the writer typed', () => {
    let { file, id } = withExtra({ kind: 'questions' });
    file = updatePart(file, id, { about: { kind: 'newsletter' } });
    expect(partHeading(pageOf(file, id), file)).not.toBe('Questions for Discussion');
    file = updatePart(file, id, { title: 'For Book Groups' });
    expect(partHeading(pageOf(file, id), file)).toBe('For Book Groups');
  });
});

describe('a bibliography’s heading', () => {
  it('is its style’s where it lists the library, the same answer as before', () => {
    let file = createProjectFile({ title: 'The Sea', format: 'instructional' });
    file = addReference(file, { title: 'On Tides' }).file;
    file = setCitationSettings(file, { bibliographyScope: 'all', style: 'mla' });
    const made = addPart(file, 'bibliography');
    expect(partHeading(pageOf(made.file, made.partId!), made.file)).toBe('Works Cited');
  });
});
