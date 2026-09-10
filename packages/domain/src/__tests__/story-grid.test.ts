import { describe, expect, it } from 'vitest';
import {
  GENRE_VALUES,
  actCommandments,
  addGridPromise,
  addMarker,
  addUnit,
  answeredCount,
  createProjectFile,
  findUnit,
  parseProjectFile,
  promisesForGenre,
  removeGridPromise,
  removeMarker,
  sceneCommandments,
  setActCommandments,
  setSceneGrid,
  setSceneHeading,
  setSceneRead,
  storyGridRows,
  viewGridRows,
  setSceneCommandment,
  setStoryCommandments,
  setStoryGrid,
  storyGridOf,
  storyGridStatus,
  unitsInStoryOrder,
  updateGridPromise,
  updateUnit,
  type ProjectFile,
} from '../index.js';

/**
 * The Story Grid's global layer (addendum 04 §3): what the story is, and
 * what that obliges it to deliver.
 */

const script = (): ProjectFile => createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });

/** A scene at the end of the story, so a promise has something to point at. */
const scene = (file: ProjectFile, title: string): ProjectFile =>
  addUnit(file, { laneId: file.lanes[0]!.id, title }).file;

describe('saying what the story is', () => {
  it('starts saying nothing, and assumes nothing from the format', () => {
    const grid = storyGridOf(script());
    expect(grid.genre).toBe('');
    expect(grid.value).toBe('');
    expect(grid.promises).toEqual([]);
  });

  it('seeds what the genre owes the first time one is chosen', () => {
    const file = setStoryGrid(script(), { genre: 'thriller' });
    const grid = storyGridOf(file);

    expect(grid.genre).toBe('thriller');
    // And the value the genre moves, offered as the obvious answer.
    expect(grid.value).toBe(GENRE_VALUES.thriller);
    expect(grid.promises.filter((promise) => promise.kind === 'obligatory').length).toBeGreaterThan(0);
    expect(grid.promises.filter((promise) => promise.kind === 'convention').length).toBeGreaterThan(0);
    expect(grid.promises.map((promise) => promise.text)).toContain('The hero at the mercy of the villain');
    // Every promise starts unanswered. That is the state worth looking at.
    expect(grid.promises.every((promise) => promise.unitId === null)).toBe(true);
  });

  it('keeps the writer’s own value once they have given one', () => {
    let file = setStoryGrid(script(), { value: 'The lamp / the dark' });
    file = setStoryGrid(file, { genre: 'horror' });
    expect(storyGridOf(file).value).toBe('The lamp / the dark');
  });

  it('does not throw the list away when the genre changes', () => {
    let file = setStoryGrid(script(), { genre: 'crime' });
    const mine = addGridPromise(file, { text: 'The dog that did not bark' });
    file = mine.file;

    // By now the list has the writer's edits and their scenes against it.
    // Replacing it with a fresh template would be the tool overruling them.
    file = setStoryGrid(file, { genre: 'thriller' });
    expect(storyGridOf(file).genre).toBe('thriller');
    expect(storyGridOf(file).promises.map((promise) => promise.text)).toContain('The dog that did not bark');
  });

  it('replaces it when the writer explicitly asks', () => {
    let file = setStoryGrid(script(), { genre: 'crime' });
    file = addGridPromise(file, { text: 'The dog that did not bark' }).file;

    file = setStoryGrid(file, { genre: 'love' }, { reseed: true });
    const texts = storyGridOf(file).promises.map((promise) => promise.text);
    expect(texts).not.toContain('The dog that did not bark');
    expect(texts).toEqual(promisesForGenre('love').map((promise) => promise.text));
  });

  it('starts the list again for the genre already chosen', () => {
    let file = setStoryGrid(script(), { genre: 'crime' });
    file = addGridPromise(file, { text: 'The dog that did not bark' }).file;

    file = setStoryGrid(file, { genre: 'crime' }, { reseed: true });
    expect(storyGridOf(file).promises.map((promise) => promise.text)).toEqual(
      promisesForGenre('crime').map((promise) => promise.text),
    );
  });

  it('takes a sub-genre and a controlling idea in the writer’s own words', () => {
    const file = setStoryGrid(script(), {
      subGenre: 'Heist',
      controllingIdea: 'Loyalty survives when everything it was built on is gone.',
    });
    expect(storyGridOf(file).subGenre).toBe('Heist');
    expect(storyGridOf(file).controllingIdea).toContain('Loyalty survives');
  });
});

describe('the promises, and the scenes that keep them', () => {
  const owed = (): ProjectFile => setStoryGrid(script(), { genre: 'thriller' });

  it('reads back every promise, unanswered until a scene is named', () => {
    const status = storyGridStatus(owed());
    expect(status.promises.every((entry) => entry.scene === null)).toBe(true);
    expect(status.keptObligatory).toBe(0);
    expect(status.obligatory).toBeGreaterThan(0);
  });

  it('names the scene that keeps one, and counts it', () => {
    let file = scene(owed(), 'The harbour');
    const promise = storyGridOf(file).promises[0]!;
    const unit = unitsInStoryOrder(file).at(-1)!;
    file = updateGridPromise(file, promise.id, { unitId: unit.id as string });

    const status = storyGridStatus(file);
    const kept = status.promises.find((entry) => entry.promise.id === promise.id);
    expect(kept?.scene?.label).toBe('The harbour');
    expect(kept?.scene?.position).toBe(unitsInStoryOrder(file).length);
    expect(status.keptObligatory).toBe(1);
  });

  it('counts a promise unanswered again when its scene is cut', () => {
    let file = scene(owed(), 'The harbour');
    const promise = storyGridOf(file).promises[0]!;
    const unit = unitsInStoryOrder(file).at(-1)!;
    file = updateGridPromise(file, promise.id, { unitId: unit.id as string });
    expect(storyGridStatus(file).keptObligatory).toBe(1);

    // The scene goes. Cutting a scene un-keeps a promise, which is exactly
    // the thing the list is for saying — not a reason to throw.
    file = { ...file, units: file.units.filter((candidate) => candidate.id !== unit.id) };
    const status = storyGridStatus(file);
    expect(status.keptObligatory).toBe(0);
    expect(status.promises.find((entry) => entry.promise.id === promise.id)?.scene).toBeNull();
  });

  it('falls back to the scene’s marker, and then to its position, for a name', () => {
    let file = scene(owed(), '');
    const promise = storyGridOf(file).promises[0]!;
    const unit = unitsInStoryOrder(file).at(-1)!;
    file = updateGridPromise(file, promise.id, { unitId: unit.id as string });
    const position = unitsInStoryOrder(file).length;
    expect(storyGridStatus(file).promises[0]?.scene?.label).toBe(`Scene ${position}`);

    file = updateUnit(file, unit.id, { title: 'The wreck' });
    expect(storyGridStatus(file).promises[0]?.scene?.label).toBe('The wreck');
  });

  it('takes a promise of the writer’s own, and lets one go', () => {
    const made = addGridPromise(owed(), { kind: 'convention', text: 'A lighthouse that never works' });
    expect(storyGridOf(made.file).promises.at(-1)?.text).toBe('A lighthouse that never works');
    expect(storyGridStatus(made.file).conventions).toBeGreaterThan(1);

    const gone = removeGridPromise(made.file, made.promise.id);
    expect(storyGridOf(gone).promises.map((promise) => promise.id)).not.toContain(made.promise.id);
  });

  it('rewords one without disturbing what it points at', () => {
    let file = scene(owed(), 'The harbour');
    const promise = storyGridOf(file).promises[0]!;
    const unit = unitsInStoryOrder(file).at(-1)!;
    file = updateGridPromise(file, promise.id, { unitId: unit.id as string });
    file = updateGridPromise(file, promise.id, { text: 'She cannot go to the police' });

    const entry = storyGridStatus(file).promises.find((candidate) => candidate.promise.id === promise.id);
    expect(entry?.promise.text).toBe('She cannot go to the police');
    expect(entry?.scene?.label).toBe('The harbour');
  });

  it('survives a save and a re-open', () => {
    const file = setStoryGrid(script(), { genre: 'love', controllingIdea: 'Love costs what it is worth.' });
    const parsed = JSON.parse(JSON.stringify(file)) as ProjectFile;
    expect(storyGridOf(parsed).controllingIdea).toBe('Love costs what it is worth.');
    expect(storyGridOf(parsed).promises.length).toBe(promisesForGenre('love').length);
  });
});

describe('the five commandments', () => {
  /** Six scenes, with act markers on the first, third and fifth. */
  const acted = (): ProjectFile => {
    let file = script();
    for (const title of ['Two', 'Three', 'Four', 'Five', 'Six']) file = scene(file, title);
    const order = unitsInStoryOrder(file);
    for (const [index, name] of [[0, 'Setup'], [2, 'Confrontation'], [4, 'Resolution']] as const) {
      file = addMarker(file, { unitId: order[index]!.id, title: name, kind: 'act' }).file;
    }
    return file;
  };

  it('starts with all five unanswered at every scale', () => {
    const file = acted();
    expect(answeredCount(storyGridOf(file).story)).toBe(0);
    expect(actCommandments(file).map((act) => answeredCount(act.commandments))).toEqual([0, 0, 0]);
    expect(sceneCommandments(file).every((entry) => answeredCount(entry.commandments) === 0)).toBe(true);
  });

  it('takes the whole story’s five, and counts what has been answered', () => {
    let file = setStoryCommandments(script(), { inciting: 'The lamp fails' });
    file = setStoryCommandments(file, { climax: 'He climbs anyway' });
    const story = storyGridOf(file).story;
    expect(story.inciting).toBe('The lamp fails');
    expect(story.climax).toBe('He climbs anyway');
    expect(answeredCount(story)).toBe(2);
  });

  it('divides the work by the coarsest marker the writer has used', () => {
    const acts = actCommandments(acted());
    expect(acts.map((act) => act.label)).toEqual(['ACT I', 'ACT II', 'ACT III']);
    // Each region runs from its marker to the scene before the next.
    expect(acts.map((act) => [act.from, act.to])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('keeps each act’s five against the marker that opens it', () => {
    let file = acted();
    const second = actCommandments(file)[1]!;
    file = setActCommandments(file, second.markerId, { crisis: 'Stay, or go down for her' });

    const after = actCommandments(file);
    expect(after[1]?.commandments.crisis).toBe('Stay, or go down for her');
    expect(after[0]?.commandments.crisis).toBe('');
  });

  it('says which act a scene falls in', () => {
    const scenes = sceneCommandments(acted());
    expect(scenes.map((entry) => entry.act)).toEqual([
      'ACT I',
      'ACT I',
      'ACT II',
      'ACT II',
      'ACT III',
      'ACT III',
    ]);
  });

  it('does not divide a story whose regions have not been marked', () => {
    expect(actCommandments(scene(script(), 'Two'))).toEqual([]);
    // Every scene is still asked the five; none of them is in an act.
    expect(sceneCommandments(scene(script(), 'Two')).map((entry) => entry.act)).toEqual(['', '']);
  });

  it('asks a scene that predates the grid, rather than falling over it', () => {
    // A project saved before any of this existed has units with no `grid` at
    // all. Every question is simply unanswered, which is where they all start.
    const file = script();
    const bare = { ...file, units: file.units.map(({ grid, ...rest }) => rest) } as unknown as ProjectFile;
    const scenes = sceneCommandments(bare);
    expect(scenes).toHaveLength(file.units.length);
    expect(answeredCount(scenes[0]!.commandments)).toBe(0);
  });

  it('writes a scene’s five to the scene, and the complication is the turn', () => {
    let file = script();
    const unitId = unitsInStoryOrder(file)[0]!.id;
    file = setSceneCommandment(file, unitId, 'complication', 'She reads the log');
    file = setSceneCommandment(file, unitId, 'resolution', 'The door stays shut');

    // The Final Editor has always asked for the turn; this is the same field.
    expect(findUnit(file, unitId)?.grid.turn).toBe('She reads the log');
    expect(findUnit(file, unitId)?.grid.resolution).toBe('The door stays shut');

    const first = sceneCommandments(file)[0]!;
    expect(first.commandments.complication).toBe('She reads the log');
    expect(answeredCount(first.commandments)).toBe(2);
  });

  it('survives a round trip through the file, and an older file has none', () => {
    let file = setStoryCommandments(acted(), { resolution: 'The light comes back on' });
    const acts = actCommandments(file);
    file = setActCommandments(file, acts[0]!.markerId, { inciting: 'The keeper does not come' });

    const back = parseProjectFile(JSON.parse(JSON.stringify(file)));
    expect(storyGridOf(back).story.resolution).toBe('The light comes back on');
    expect(actCommandments(back)[0]?.commandments.inciting).toBe('The keeper does not come');

    // A project saved before any of this existed opens with the five empty.
    const older = parseProjectFile({
      ...JSON.parse(JSON.stringify(script())),
      settings: { ...script().settings, storyGrid: undefined },
    });
    expect(answeredCount(storyGridOf(older).story)).toBe(0);
    expect(actCommandments(older)).toEqual([]);
  });

  it('drops an act whose marker has gone, and keeps what was said about it', () => {
    let file = acted();
    const first = actCommandments(file)[0]!;
    file = setActCommandments(file, first.markerId, { climax: 'He lights it by hand' });
    file = removeMarker(file, first.markerId);

    // Two acts left, renumbered, and neither of them wearing the first's answers.
    const after = actCommandments(file);
    expect(after.map((act) => act.label)).toEqual(['ACT I', 'ACT II']);
    expect(after.every((act) => act.commandments.climax === '')).toBe(true);
    // What was said about the act that went is still in the record, for a
    // marker put back where it was.
    expect(storyGridOf(file).acts[first.markerId as string]?.climax).toBe('He lights it by hand');
  });
});

describe('the grid itself', () => {
  /** Six scenes with acts on the first, third and fifth. */
  const gridded = (): ProjectFile => {
    let file = script();
    for (const title of ['Two', 'Three', 'Four', 'Five', 'Six']) file = scene(file, title);
    const order = unitsInStoryOrder(file);
    for (const [index, name] of [[0, 'Setup'], [2, 'Confrontation'], [4, 'Resolution']] as const) {
      file = addMarker(file, { unitId: order[index]!.id, title: name, kind: 'act' }).file;
    }
    return file;
  };

  it('is one row per scene, in reading order, with what can be measured', () => {
    const rows = storyGridRows(gridded());
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.map((row) => row.act)).toEqual(['ACT I', 'ACT I', 'ACT II', 'ACT II', 'ACT III', 'ACT III']);
    // Nothing is claimed about a scene nobody has written or read.
    expect(rows.every((row) => row.event === '' && row.value === '' && row.polarity === '')).toBe(true);
    expect(rows.every((row) => row.suggestedEvent === '')).toBe(true);
  });

  it('takes the scene heading’s place and time, and who speaks', () => {
    let file = script();
    const unit = unitsInStoryOrder(file)[0]!;
    file = setSceneHeading(file, unit.id, { setting: 'INT.', place: 'Lighthouse', time: 'Night' });

    const row = storyGridRows(file)[0]!;
    expect(row.setting).toBe('INT. LIGHTHOUSE');
    expect(row.time).toBe('NIGHT');
  });

  it('offers the read’s change as the story event, without writing it', () => {
    let file = script();
    const unitId = unitsInStoryOrder(file)[0]!.id;
    file = setSceneRead(file, unitId, {
      opening: 'The lamp is lit',
      change: 'The lamp goes out and she is alone',
      turn: null,
      valueShift: 'negative',
      purpose: 'Sets the isolation',
      concerns: [],
      model: 'test',
    });

    const row = storyGridRows(file)[0]!;
    expect(row.event).toBe('');
    expect(row.suggestedEvent).toBe('The lamp goes out and she is alone');

    // The writer's own answer wins once given.
    file = setSceneGrid(file, unitId, { event: 'She loses the light' });
    expect(storyGridRows(file)[0]?.event).toBe('She loses the light');
  });

  it('shows the scenes that do not turn', () => {
    let file = gridded();
    const order = unitsInStoryOrder(file);
    file = setSceneCommandment(file, order[0]!.id, 'complication', 'She reads the log');
    file = setSceneCommandment(file, order[3]!.id, 'complication', 'The boat leaves');

    const rows = viewGridRows(storyGridRows(file), { show: 'no_turn' });
    expect(rows.map((row) => row.position)).toEqual([2, 3, 5, 6]);
  });

  it('shows everything in one act, and the negative ones', () => {
    let file = gridded();
    const order = unitsInStoryOrder(file);
    file = setSceneGrid(file, order[2]!.id, { polarity: 'down' });
    file = setSceneGrid(file, order[5]!.id, { polarity: 'down' });
    const rows = storyGridRows(file);

    expect(viewGridRows(rows, { act: 'ACT II' }).map((row) => row.position)).toEqual([3, 4]);
    expect(viewGridRows(rows, { show: 'negative' }).map((row) => row.position)).toEqual([3, 6]);
    // The two together: the negative ones inside one act.
    expect(viewGridRows(rows, { show: 'negative', act: 'ACT II' }).map((row) => row.position)).toEqual([3]);
  });

  it('sorts by length without losing reading order as the tie-break', () => {
    const rows = storyGridRows(gridded());
    expect(viewGridRows(rows, { sort: 'longest' }).map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(viewGridRows(rows, { sort: 'shortest' }).map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6]);
    // And it never changes the manuscript.
    expect(storyGridRows(gridded()).map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('shows the scenes nobody has said anything about at all', () => {
    let file = gridded();
    const order = unitsInStoryOrder(file);
    file = setSceneGrid(file, order[1]!.id, { value: 'faith / doubt' });
    file = setSceneCommandment(file, order[4]!.id, 'crisis', 'Stay or go');

    const rows = viewGridRows(storyGridRows(file), { show: 'unasked' });
    expect(rows.map((row) => row.position)).toEqual([1, 3, 4, 6]);
  });
});
