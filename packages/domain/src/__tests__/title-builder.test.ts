import { describe, expect, it } from 'vitest';
import {
  addMarker,
  addUnit,
  createProjectFile,
  defaultByline,
  renderTitleSheet,
  setTitlePage,
  splitByline,
  titleDescriptors,
  titlePageOf,
  type ProjectFile,
  type ScriptFormat,
} from '../index.js';

/**
 * **The title-page builder** (addendum 38 §5): what a play's front page says
 * that a screenplay's does not — what the work is, *by* rather than *Written
 * by*, and a musical's three writers.
 */

const play = (scriptFormat?: ScriptFormat): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format: 'stage_play' });
  return scriptFormat ? { ...file, settings: { ...file.settings, scriptFormat } } : file;
};

/** A play with an act marker on each of `acts` scenes. */
const inActs = (file: ProjectFile, acts: number): ProjectFile => {
  let next = file;
  for (let at = 0; at < acts; at += 1) {
    const made = addUnit(next, { trackId: next.tracks[0]!.id });
    next = addMarker(made.file, { unitId: made.unit.id, title: '', kind: 'act' }).file;
  }
  return next;
};

describe('what the work is', () => {
  it('offers the play’s own acts first', () => {
    expect(titleDescriptors(inActs(play(), 2))[0]).toBe('A Play in Two Acts');
    expect(titleDescriptors(inActs(play(), 3))[0]).toBe('A Play in Three Acts');
    // No act marked is a play without an interval.
    expect(titleDescriptors(play())[0]).toBe('A Play in One Act');
  });

  it('calls a play set as a musical a musical', () => {
    expect(titleDescriptors(inActs(play('stage_us_musical'), 2))[0]).toBe('A Musical in Two Acts');
  });

  it('never offers the same line twice', () => {
    const offered = titleDescriptors(inActs(play(), 2));
    expect(new Set(offered).size).toBe(offered.length);
  });
});

describe('the credit', () => {
  it('is “by” on a play and “Written by” on a screen script, unless typed', () => {
    expect(defaultByline('stage_play')).toBe('by');
    expect(defaultByline('screenplay')).toBe('Written by');
    expect(titlePageOf(play().project, play().settings).byline).toBe('by');
    const typed = setTitlePage(play(), { byline: 'Adapted by' });
    expect(titlePageOf(typed.project, typed.settings).byline).toBe('Adapted by');
  });

  it('sets the last “by” on a line of its own', () => {
    expect(splitByline('Written by')).toEqual({ lead: 'Written', by: 'by' });
    expect(splitByline('by')).toEqual({ lead: '', by: 'by' });
    expect(splitByline('Music and lyrics by')).toEqual({ lead: 'Music and lyrics', by: 'by' });
    expect(splitByline('Abby')).toEqual({ lead: 'Abby', by: '' });
  });

  it('prints a play’s page with what it is, the author, and a musical’s other writers', () => {
    const file = setTitlePage(play('stage_us_musical'), {
      author: 'Jane Doe',
      descriptor: 'A Musical in Two Acts',
      credits: [
        { role: 'Music by', name: 'John Roe' },
        { role: 'Lyrics by', name: '' },
      ],
    });
    const page = titlePageOf(file.project, file.settings);
    // A credit with no name is not printed.
    expect(page.credits).toEqual([{ role: 'Music by', name: 'John Roe' }]);
    const html = renderTitleSheet(page);
    expect(html).toContain('<p class="descriptor">A Musical in Two Acts</p>');
    expect(html).toContain('<p class="by">by</p><p class="author">Jane Doe</p>');
    expect(html).not.toContain('Written');
    expect(html).toContain('<p class="byline">Music</p><p class="by">by</p><p class="author">John Roe</p>');
  });

  it('leaves a screenplay’s page exactly as it printed', () => {
    const film = createProjectFile({ title: 'Film', format: 'screenplay' });
    const html = renderTitleSheet(titlePageOf(film.project, setTitlePage(film, { author: 'Jane' }).settings));
    expect(html).toContain('<p class="byline">Written</p><p class="by">by</p><p class="author">Jane</p>');
    expect(html).not.toContain('descriptor');
  });
});
