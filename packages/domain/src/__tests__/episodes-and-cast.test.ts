import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  addCharacterCategory,
  addEpisode,
  addMarker,
  addUnit,
  castByCategory,
  castForNewEpisode,
  castNamesForBeat,
  castOf,
  characterCategoriesInOrder,
  createProjectFile,
  defaultCharacterCategories,
  defaultEpisodeCarry,
  episodeOfBeat,
  episodeOfUnit,
  episodes,
  fromRows,
  moveCharacterCategory,
  removeCharacterCategory,
  setEpisodeTitlePage,
  setTitlePage,
  titlePageOf,
  toRows,
  updateBeat,
  updateCharacter,
  type CharacterCategoryId,
  type ProjectFile,
} from '../index.js';

/**
 * Episodes, and the headings the cast is filed under (addendum 02 §16, §17).
 */

const series = (): ProjectFile => createProjectFile({ title: 'The Lighthouse', format: 'series' });

/** File a new character under a heading, by the heading's name. */
const cast = (file: ProjectFile, name: string, heading: string): ProjectFile => {
  const category = characterCategoriesInOrder(file).find((entry) => entry.name === heading);
  const withPerson = addCharacter(file, { name });
  const person = withPerson.characters[withPerson.characters.length - 1]!;
  return updateCharacter(withPerson, person.id, { categoryId: category?.id ?? null });
};

/** Put a speech in a beat, so who spoke in an episode can be read back. */
const speaks = (file: ProjectFile, beatId: string, who: string): ProjectFile =>
  updateBeat(file, beatId as never, {
    manuscript: {
      elements: [
        { id: `${beatId}-c` as never, type: 'character', text: who, characterId: null, attributes: {} },
        { id: `${beatId}-d` as never, type: 'dialogue', text: 'Not tonight.', characterId: null, attributes: {} },
      ],
    },
  });

describe('the headings the cast is filed under', () => {
  it('gives a series a recurring heading that the other formats do not have', () => {
    expect(defaultCharacterCategories('series')).toEqual([
      'Main characters',
      'Recurring characters',
      'Minor characters',
    ]);
    expect(defaultCharacterCategories('screenplay')).toEqual(['Main characters', 'Minor characters']);
    expect(characterCategoriesInOrder(series()).map((entry) => entry.name)).toEqual(
      defaultCharacterCategories('series'),
    );
  });

  it('takes a heading of the writer’s own, and puts it where it was asked for', () => {
    const { file, category } = addCharacterCategory(series(), { name: 'The precinct' });
    expect(category.name).toBe('The precinct');
    expect(characterCategoriesInOrder(file).map((entry) => entry.name).at(-1)).toBe('The precinct');

    const moved = moveCharacterCategory(file, category.id, 0);
    expect(characterCategoriesInOrder(moved)[0]?.name).toBe('The precinct');
  });

  it('groups the cast under its headings, with the unfiled shown last', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = cast(file, 'DR HALE', 'Recurring characters');
    file = addCharacter(file, { name: 'PORTER' });

    const groups = castByCategory(file);
    expect(groups.map((group) => group.name)).toEqual([
      'Main characters',
      'Recurring characters',
      'Minor characters',
      'Not filed',
    ]);
    expect(groups[0]?.characters.map((person) => person.name)).toEqual(['MAEVE']);
    expect(groups.at(-1)?.characters.map((person) => person.name)).toEqual(['PORTER']);
  });

  it('unfiles the people under a heading it removes rather than losing them', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    const main = characterCategoriesInOrder(file)[0]!;
    file = removeCharacterCategory(file, main.id);

    expect(file.characters.map((person) => person.name)).toEqual(['MAEVE']);
    expect(file.characters[0]?.categoryId).toBeNull();
    expect(castByCategory(file).at(-1)?.name).toBe('Not filed');
  });

  it('refuses to file someone under a heading that does not exist', () => {
    const file = addCharacter(series(), { name: 'MAEVE' });
    const person = file.characters[0]!;
    expect(() => updateCharacter(file, person.id, { categoryId: 'nope' as CharacterCategoryId })).toThrow();
  });
});

describe('an episode', () => {
  it('is a run of the story order, from its marker to the next one', () => {
    let file = series();
    // The opening scene, plus two more, then a second episode after them.
    const lane = file.lanes[0]!.id;
    file = addUnit(file, { laneId: lane }).file;
    file = addUnit(file, { laneId: lane }).file;
    file = addEpisode(file, { title: 'Pilot' }).file;
    expect(episodes(file)).toHaveLength(1);
    // The pilot's marker is on the fourth scene, so it is the only one in it.
    expect(episodes(file)[0]?.units).toHaveLength(1);

    file = addEpisode(file, { title: 'The Wreck' }).file;
    const all = episodes(file);
    expect(all.map((episode) => episode.label)).toEqual(['EPISODE 1', 'EPISODE 2']);
    expect(all.map((episode) => episode.title)).toEqual(['Pilot', 'The Wreck']);
    expect(all[0]?.units).toHaveLength(1);
  });

  it('starts as a clear slate: its own scene, one empty beat, no text carried', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = speaks(file, file.beats[0]!.id, 'MAEVE');
    const before = file.beats.length;

    const { file: next, episode } = addEpisode(file, { title: 'Pilot' });
    expect(next.beats).toHaveLength(before + 1);
    expect(episode.beats).toHaveLength(1);
    expect(episode.beats[0]?.manuscript.elements).toEqual([]);
    expect(episode.words).toBe(0);
  });

  it('carries the cast the writer asked for, and leaves the guests behind', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = cast(file, 'DR HALE', 'Recurring characters');
    file = cast(file, 'THE FERRYMAN', 'Minor characters');

    const headings = characterCategoriesInOrder(file);
    const carry = {
      castFrom: [headings[0]!.id as string, headings[1]!.id as string],
      castWhoSpoke: false,
      lanes: 'series' as const,
      openSetups: false,
    };
    const { file: next, episode } = addEpisode(file, { title: 'Pilot', carry });
    expect(castOf(next, episode).map((person) => person.name)).toEqual(['MAEVE', 'DR HALE']);
  });

  it('can also carry whoever actually spoke in the episode before', () => {
    let file = cast(series(), 'THE FERRYMAN', 'Minor characters');
    file = addEpisode(file, { title: 'Pilot', carry: { castFrom: [], castWhoSpoke: false, lanes: 'series', openSetups: false } }).file;
    const pilot = episodes(file)[0]!;
    file = speaks(file, pilot.beats[0]!.id, 'THE FERRYMAN');

    // Nobody from the headings, but the ferryman spoke, so he comes along.
    const carry = { castFrom: [], castWhoSpoke: true, lanes: 'series' as const, openSetups: false };
    expect(castForNewEpisode(file, carry)).toHaveLength(1);
    const { file: next, episode } = addEpisode(file, { title: 'The Wreck', carry });
    expect(castOf(next, episode).map((person) => person.name)).toEqual(['THE FERRYMAN']);
  });

  it('plots on the series’ lanes, or starts a fresh one when asked', () => {
    const file = series();
    expect(addEpisode(file, { title: 'A', carry: { ...defaultEpisodeCarry(file), lanes: 'series' } }).file.lanes)
      .toHaveLength(file.lanes.length);

    const fresh = addEpisode(file, { title: 'A', carry: { ...defaultEpisodeCarry(file), lanes: 'fresh' } }).file;
    expect(fresh.lanes).toHaveLength(file.lanes.length + 1);
    expect(fresh.lanes.at(-1)?.name).toBe('A — A story');
  });

  it('remembers what was carried, so the next one does not ask again', () => {
    const file = series();
    const carry = { castFrom: [], castWhoSpoke: false, lanes: 'fresh' as const, openSetups: false };
    const next = addEpisode(file, { title: 'Pilot', carry }).file;
    expect(defaultEpisodeCarry(next)).toEqual(carry);
  });

  it('says which episode a scene and a beat are in', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    const second = episodes(file)[1]!;

    expect(episodeOfUnit(file, second.units[0]!.id)?.number).toBe(2);
    expect(episodeOfBeat(file, second.beats[0]!.id)?.title).toBe('The Wreck');
    // The scene the project was created with is ahead of the first marker.
    expect(episodeOfUnit(file, file.units[0]!.id)).toBeUndefined();
  });

  it('offers this episode’s cast first while a cue is being typed', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = cast(file, 'DR HALE', 'Recurring characters');
    file = cast(file, 'THE FERRYMAN', 'Minor characters');

    const headings = characterCategoriesInOrder(file);
    const carry = {
      castFrom: [headings[1]!.id as string],
      castWhoSpoke: false,
      lanes: 'series' as const,
      openSetups: false,
    };
    const { file: next, episode } = addEpisode(file, { title: 'Pilot', carry });

    // The episode's own cast leads; everyone else follows in heading order.
    expect(castNamesForBeat(next, episode.beats[0]!.id)).toEqual(['DR HALE', 'MAEVE', 'THE FERRYMAN']);
    // A beat outside any episode falls back to the headings' own order.
    expect(castNamesForBeat(next, next.beats[0]!.id)).toEqual(['MAEVE', 'DR HALE', 'THE FERRYMAN']);
  });
});

describe('an episode’s own title page', () => {
  it('starts knowing which episode it is, and nothing else', () => {
    const made = addEpisode(series(), { title: 'The Lamp' });
    const page = made.file.markers.find((marker) => marker.id === made.episode.marker.id)?.titlePage;
    expect(page?.episode).toBe('Episode 1');
    // Everything else is the series' until the writer says otherwise.
    expect(page?.author).toBe('');
    expect(page?.title).toBe('');
  });

  it('falls back to the series’ page field by field', () => {
    let file = setTitlePage(series(), { author: 'K. Shank', contact: 'VC Entertainment' });
    const made = addEpisode(file, { title: 'The Lamp' });
    file = setEpisodeTitlePage(made.file, made.episode.marker.id, { draftDate: '12 March 2026' });
    const marker = file.markers.find((candidate) => candidate.id === made.episode.marker.id);

    const page = titlePageOf(file.project, file.settings, marker?.titlePage);
    // Its own date and number, the series' name and contact.
    expect(page.draftDate).toBe('12 March 2026');
    expect(page.episode).toBe('Episode 1');
    expect(page.author).toBe('K. Shank');
    expect(page.contact).toBe('VC Entertainment');
  });

  it('takes the episode’s own answer over the series’ where it has one', () => {
    let file = setTitlePage(series(), { author: 'K. Shank' });
    const made = addEpisode(file, {});
    file = setEpisodeTitlePage(made.file, made.episode.marker.id, { author: 'A Guest Writer' });
    const marker = file.markers.find((candidate) => candidate.id === made.episode.marker.id);
    expect(titlePageOf(file.project, file.settings, marker?.titlePage).author).toBe('A Guest Writer');
  });

  it('can be given back to the series, and survives a sync', () => {
    const made = addEpisode(series(), {});
    const given = setEpisodeTitlePage(made.file, made.episode.marker.id, null);
    expect(given.markers.find((m) => m.id === made.episode.marker.id)?.titlePage).toBeNull();

    const kept = setEpisodeTitlePage(made.file, made.episode.marker.id, { revision: 'Blue pages' });
    const after = fromRows(toRows(kept)).markers.find((m) => m.id === made.episode.marker.id);
    expect(after?.titlePage?.revision).toBe('Blue pages');
    expect(after?.titlePage?.episode).toBe('Episode 1');
  });

  it('is not given to an act, which has no front page', () => {
    const file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
    const made = addMarker(file, { unitId: file.units[0]!.id, kind: 'act', title: 'One' });
    expect(made.marker.titlePage).toBeNull();
  });
});
