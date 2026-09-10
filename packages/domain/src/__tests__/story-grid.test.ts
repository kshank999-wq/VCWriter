import { describe, expect, it } from 'vitest';
import {
  GENRE_VALUES,
  addGridPromise,
  addUnit,
  createProjectFile,
  promisesForGenre,
  removeGridPromise,
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
