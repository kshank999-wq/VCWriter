import { describe, expect, it } from 'vitest';
import {
  castInPageOrder,
  castPageOf,
  castRoleLine,
  createProjectFile,
  hasCastPage,
  notedCast,
  printedPageCount,
  printsCastPage,
  projectSettingsSchema,
  renderPrintDocumentHtml,
  setCastPage,
  setCasting,
  updateBeat,
  updateCharacter,
  characterSchema,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * **The cast page** (addendum 38 §4): what addendum 37 named and did not
 * build — the Character Creator's record widened by a playing age, a vocal
 * range, a doubling and an *include in cast* tick, and a page that lists them.
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

/** A play whose cues make its cast, in the order written. */
const play = (...cues: string[]): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'stage_play' });
  const elements = cues.flatMap((cue) => [el('character', cue), el('dialogue', 'Well.')]);
  return notedCast(updateBeat(file, file.beats[0]!.id, { manuscript: { elements } }));
};

const idOf = (file: ProjectFile, name: string): CharacterId =>
  file.characters.find((person) => person.name === name)!.id;

describe('which formats have one', () => {
  it('is a play’s, and not a film’s or a book’s', () => {
    expect(hasCastPage('stage_play')).toBe(true);
    expect(hasCastPage('screenplay')).toBe(false);
    expect(hasCastPage('novel')).toBe(false);
  });

  it('reads a record written before it existed', () => {
    // A character and a project file from before addendum 38 carry neither.
    expect(projectSettingsSchema.parse({}).castPage.order).toBe('appearance');
    const old = characterSchema.parse({
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      name: 'SARAH',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(old.casting).toEqual({ include: true, description: '', playingAge: '', vocalRange: '', doubles: null });
  });
});

describe('the roles', () => {
  it('lists them in the order they first enter', () => {
    const file = play('TOM', 'SARAH', 'TOM', 'THE NURSE');
    expect(castPageOf(file).roles.map((role) => role.name)).toEqual(['TOM', 'SARAH', 'THE NURSE']);
  });

  it('follows a scene moved earlier, the order being the script’s and not stored', () => {
    const file = play('TOM', 'SARAH');
    const swapped = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [el('character', 'SARAH'), el('dialogue', 'Hello.'), el('character', 'TOM')] },
    });
    expect(castPageOf(swapped).roles.map((role) => role.name)).toEqual(['SARAH', 'TOM']);
  });

  it('puts somebody who never speaks after everybody who does', () => {
    const file = play('TOM');
    const withGhost = notedCast({
      ...file,
      characters: [
        ...file.characters,
        characterSchema.parse({
          id: crypto.randomUUID(),
          projectId: file.project.id,
          name: 'THE FATHER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ],
    });
    expect(castInPageOrder(withGhost).map((person) => person.name)).toEqual(['TOM', 'THE FATHER']);
  });

  it('leaves off a role taken off the page, and keeps everything typed for it', () => {
    let file = play('TOM', 'SARAH');
    file = setCasting(file, idOf(file, 'SARAH'), { description: 'his sister', include: false });
    expect(castPageOf(file).roles.map((role) => role.name)).toEqual(['TOM']);
    file = setCasting(file, idOf(file, 'SARAH'), { include: true });
    expect(castPageOf(file).roles[1]?.description).toBe('his sister');
  });

  it('leaves off an archived character', () => {
    let file = play('TOM', 'SARAH');
    file = updateCharacter(file, idOf(file, 'SARAH'), { archived: true });
    expect(castPageOf(file).roles.map((role) => role.name)).toEqual(['TOM']);
  });

  it('sets the line under a name with the age and the range in brackets', () => {
    expect(
      castRoleLine({ id: 'x', name: 'TOM', description: 'her brother', playingAge: '40s', vocalRange: 'Baritone' }),
    ).toBe('her brother (40s; Baritone)');
    expect(castRoleLine({ id: 'x', name: 'TOM', description: '', playingAge: '40s', vocalRange: '' })).toBe('(40s)');
    expect(castRoleLine({ id: 'x', name: 'TOM', description: '', playingAge: '', vocalRange: '' })).toBe('');
  });
});

describe('the doubling', () => {
  it('reads each link both ways, so three parts for one actor is one chain', () => {
    let file = play('TOM', 'SARAH', 'THE NURSE', 'THE DOCTOR');
    file = setCasting(file, idOf(file, 'THE NURSE'), { doubles: idOf(file, 'SARAH') });
    file = setCasting(file, idOf(file, 'THE DOCTOR'), { doubles: idOf(file, 'SARAH') });
    expect(castPageOf(file).doubling).toEqual([['SARAH', 'THE NURSE', 'THE DOCTOR']]);
  });

  it('drops a link to a role that is not on the page', () => {
    let file = play('TOM', 'SARAH');
    file = setCasting(file, idOf(file, 'TOM'), { doubles: idOf(file, 'SARAH') });
    file = setCasting(file, idOf(file, 'SARAH'), { include: false });
    expect(castPageOf(file).doubling).toEqual([]);
  });

  it('refuses a role doubled with itself or with nobody', () => {
    const file = play('TOM');
    expect(() => setCasting(file, idOf(file, 'TOM'), { doubles: idOf(file, 'TOM') })).toThrow();
    expect(() => setCasting(file, idOf(file, 'TOM'), { doubles: crypto.randomUUID() as CharacterId })).toThrow();
  });
});

describe('the page', () => {
  it('is headed Characters unless it says otherwise, and carries the time and place', () => {
    let file = play('TOM');
    expect(castPageOf(file).heading).toBe('Characters');
    file = setCastPage(file, { heading: 'The company', time: 'The present.', place: 'A kitchen in Duluth.' });
    expect(castPageOf(file)).toMatchObject({ heading: 'The company', time: 'The present.', place: 'A kitchen in Duluth.' });
  });

  it('lists by the cast panel’s headings when asked to', () => {
    let file = play('TOM', 'SARAH');
    file = setCastPage(file, { order: 'importance' });
    // Unfiled and alphabetical, the panel's own order for people not filed.
    expect(castPageOf(file).roles.map((role) => role.name)).toEqual(['SARAH', 'TOM']);
  });

  it('prints after the title page, and counts', () => {
    let file = play('TOM', 'SARAH');
    file = setCasting(file, idOf(file, 'TOM'), { description: 'a lighthouse keeper', playingAge: '60s' });
    file = setCastPage(file, { place: 'A lighthouse.' });
    const html = renderPrintDocumentHtml(file);
    const title = html.indexOf('title-page');
    const cast = html.indexOf('class="page cast-page"');
    expect(title).toBeGreaterThan(-1);
    expect(cast).toBeGreaterThan(title);
    expect(html).toContain('<span class="cast-name">TOM</span>, a lighthouse keeper (60s)');
    expect(html).toContain('<span class="cast-label">Place:</span> A lighthouse.');
    expect(printedPageCount(file)).toBe(printedPageCount(file, { includeCastPage: false }) + 1);
    expect(renderPrintDocumentHtml(file, { includeCastPage: false })).not.toContain('cast-page');
  });

  it('prints nothing for a play with nobody in it, or for a screenplay', () => {
    expect(printsCastPage(createProjectFile({ title: 'Empty', format: 'stage_play' }))).toBe(false);
    const film = createProjectFile({ title: 'Film', format: 'screenplay' });
    const cast = notedCast(
      updateBeat(film, film.beats[0]!.id, { manuscript: { elements: [el('character', 'TOM'), el('dialogue', 'Well.')] } }),
    );
    expect(cast.characters).toHaveLength(1);
    expect(printsCastPage(cast)).toBe(false);
  });
});
