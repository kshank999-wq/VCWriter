import { describe, expect, it } from 'vitest';
import {
  addMarker,
  addResearchItem,
  createProjectFile,
  nameProject,
  projectUntouched,
  suggestedFileName,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **What a project is called** (addendum 33 §10a, from Ken: *I named the
 * project Dylan's Tales, but in the save it's calling it the name of the first
 * script… it's not maintaining the name that I give it when I create the
 * project*).
 */

const collection = (title = 'Dylan’s Tales'): ProjectFile =>
  createProjectFile({ title, format: 'short_story', author: 'K. Shank' });

const para = (id: string) => ({ id: id as never, type: 'paragraph' as const, text: 'One.', characterId: null, attributes: {} });

describe('naming a project', () => {
  it('reaches the file on disk, which is the whole of the report', () => {
    const named = nameProject(collection('IN_FOR_A_POUND_STAGE_final'), 'Dylan’s Tales');
    expect(named.project.title).toBe('Dylan’s Tales');
    expect(suggestedFileName(named.project.title, 'as')).toContain('Dylan');
  });

  it('names the project and nothing in it', () => {
    // A collection is not its first story, which is the distinction his
    // report rests on.
    const made = collection();
    const withStory = addMarker(made, { unitId: made.units[0]!.id, kind: 'chapter', title: 'In For A Pound' }).file;
    const named = nameProject(withStory, 'Dylan’s Tales');
    expect(named.markers.map((one) => one.title)).toEqual(['In For A Pound']);
    expect(named.units.map((one) => one.title)).toEqual(withStory.units.map((one) => one.title));
  });

  it('does nothing at all with nothing typed, so an import is unchanged', () => {
    const made = collection('In For A Pound');
    expect(nameProject(made, '   ')).toBe(made);
    expect(nameProject(made, 'In For A Pound')).toBe(made);
  });
});

describe('a project nobody has been in yet', () => {
  it('is the one a writer has just made and named', () => {
    expect(projectUntouched(collection())).toBe(true);
  });

  it('is not one with a word written in it', () => {
    const made = collection();
    expect(projectUntouched(updateBeat(made, made.beats[0]!.id, { manuscript: { elements: [para('p1')] } as never }))).toBe(false);
  });

  it('is not one with a story on it', () => {
    const made = collection();
    expect(projectUntouched(addMarker(made, { unitId: made.units[0]!.id, kind: 'chapter', title: 'One' }).file)).toBe(false);
  });

  it('is not one with a note filed in it', () => {
    const made = collection();
    const folder = made.researchCategories[0]!;
    expect(projectUntouched(addResearchItem(made, { categoryId: folder.id, title: 'A thought' }))).toBe(false);
  });
});
