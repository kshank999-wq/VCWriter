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
  episodeNumberClash,
  episodes,
  fromRows,
  moveCharacterCategory,
  paginateProject,
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

/**
 * An episode is a script that goes out on its own, so its front page prints
 * at the head of its own run rather than once at the front of the stack
 * (addendum 02 §17).
 */
describe('printing an episode with its own front page', () => {
  /** A series of `count` episodes, each with a scene of prose in it. */
  const seriesOf = (count: number): ProjectFile => {
    let file = series();
    for (let n = 1; n <= count; n += 1) {
      const made = addEpisode(file, { title: `Episode ${n}` });
      file = updateBeat(made.file, made.episode.beats[0]!.id, {
        manuscript: {
          elements: [
            {
              id: `${made.episode.marker.id}-a` as never,
              type: 'action',
              text: 'The lamp turns.',
              characterId: null,
              attributes: {},
            },
          ],
        },
      });
    }
    return file;
  };

  it('opens each episode with its own page, in story order', () => {
    const file = seriesOf(3);
    const fronts = paginateProject(file).filter((page) => page.titlePage);
    expect(fronts).toHaveLength(3);
    expect(fronts.map((page) => page.titlePage?.episode)).toEqual(['Episode 1', 'Episode 2', 'Episode 3']);
    // The series' title and credit are on each of them, filled in from above.
    expect(fronts.every((page) => page.titlePage?.title === 'The Lighthouse')).toBe(true);
  });

  it('gives a front page no number, and starts the episode after it at one', () => {
    const file = seriesOf(2);
    const pages = paginateProject(file);
    expect(pages.filter((page) => page.titlePage).every((page) => page.number === 0)).toBe(true);

    // A series is a stack of scripts: the contents at the front, then each
    // episode behind its cover, numbering from its own page one.
    expect(pages.map((page) => page.number)).toEqual([0, 0, 1, 0, 1]);
  });

  it('numbers a long episode through to its end, then starts the next at one', () => {
    let file = seriesOf(2);
    // Enough in the first episode to run past one page.
    const [first] = episodes(file);
    file = updateBeat(file, first!.beats[0]!.id, {
      manuscript: {
        elements: Array.from({ length: 80 }, (_, index) => ({
          id: `x${index}` as never,
          type: 'action' as const,
          text: `Line ${index} of the thing that goes on and on and on.`,
          characterId: null,
          attributes: {},
        })),
      },
    });

    const pages = paginateProject(file);
    expect(pages.map((page) => page.number)).toEqual([0, 0, 1, 2, 3, 0, 1]);
  });

  it('breaks the run, so an episode never starts halfway down a page', () => {
    const file = seriesOf(2);
    const pages = paginateProject(file);
    const second = pages.findIndex((page) => page.titlePage?.episode === 'Episode 2');
    // The page after episode two's front page is the first page of its script.
    expect(pages[second + 1]?.lines.some((line) => line.text.length > 0)).toBe(true);
  });

  it('prints none of them when the writer asks for no title page', () => {
    const file = seriesOf(2);
    expect(paginateProject(file, { includeTitlePage: false }).some((page) => page.titlePage)).toBe(false);
  });

  it('leaves an episode given back to the series without a page of its own', () => {
    let file = seriesOf(2);
    const [first] = episodes(file);
    file = setEpisodeTitlePage(file, first!.marker.id, null);
    const fronts = paginateProject(file).filter((page) => page.titlePage);
    expect(fronts.map((page) => page.titlePage?.episode)).toEqual(['Episode 2']);
  });

  it('gives a screenplay no front pages at all: it has no episodes', () => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
    file = addMarker(file, { unitId: file.units[0]!.id, kind: 'act', title: 'One' }).file;
    expect(paginateProject(file).some((page) => page.titlePage)).toBe(false);
  });
});

/**
 * An episode is numbered on its own front page (addendum 02 §17), and two
 * scripts cannot carry the same number.
 */
describe('numbering the episodes', () => {
  it('numbers a new one from the lowest number nobody has claimed', () => {
    let file = series();
    file = addEpisode(file, { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    expect(episodes(file).map((episode) => episode.number)).toEqual([1, 2]);
    expect(episodes(file).map((episode) => episode.marker.titlePage?.episode)).toEqual([
      'Episode 1',
      'Episode 2',
    ]);
  });

  it('takes the number the writer typed on the page, not the running order', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    const [first] = episodes(file);
    // A pilot that is going out as episode seven is episode seven.
    file = setEpisodeTitlePage(file, first!.marker.id, { episode: 'Episode 7 — The Lamp' });
    expect(episodes(file)[0]?.number).toBe(7);
    expect(episodes(file)[0]?.label).toBe('EPISODE 7');

    // And the next one made takes the lowest free number, not eight.
    const made = addEpisode(file, { title: 'The Wreck' });
    expect(made.episode.number).toBe(1);
  });

  it('refuses a number another episode already carries', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    const [first, second] = episodes(file);

    expect(episodeNumberClash(file, second!.marker.id, 'Episode 1')?.label).toBe('EPISODE 1');
    expect(() => setEpisodeTitlePage(file, second!.marker.id, { episode: 'Episode 1' })).toThrow(
      /already carries that number/,
    );

    // Its own number is not a clash with itself, and a free one is fine.
    expect(episodeNumberClash(file, first!.marker.id, 'Episode 1')).toBeNull();
    expect(episodes(setEpisodeTitlePage(file, second!.marker.id, { episode: 'Episode 9' }))[1]?.number).toBe(9);
  });

  it('lets a page name no number at all, and fills one in underneath', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    const [first, second] = episodes(file);
    file = setEpisodeTitlePage(file, second!.marker.id, { episode: 'Episode 5' });
    file = setEpisodeTitlePage(file, first!.marker.id, { episode: 'The Pilot' });

    // Five is claimed, so the unnumbered one takes one — the lowest free.
    expect(episodes(file).map((episode) => episode.number)).toEqual([1, 5]);
  });

  it('settles a clash that arrives from a sync rather than showing it twice', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    const ids = episodes(file).map((episode) => episode.marker.id);

    // Two machines each numbered their episode 3; the file arrives with both.
    file = {
      ...file,
      markers: file.markers.map((marker) =>
        ids.includes(marker.id)
          ? { ...marker, titlePage: { ...marker.titlePage!, episode: 'Episode 3' } }
          : marker,
      ),
    };
    // The earlier in the story keeps the claim; the later takes a free number.
    expect(episodes(file).map((episode) => episode.number)).toEqual([3, 1]);
  });
});
