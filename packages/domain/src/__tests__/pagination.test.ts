import { describe, expect, it } from 'vitest';
import {
  SCREENPLAY_LAYOUT,
  paginateElements,
  paginateProject,
  pageCount,
  wrapText,
  type Page,
} from '../pagination.js';
import { createProjectFile } from '../project-file.js';
import { addBeat, updateBeat } from '../mutations.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { ManuscriptElementId } from '../ids.js';

const element = (type: ManuscriptElementType, text: string): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes: {},
});

const textOf = (page: Page): string[] => page.lines.map((line) => line.text);
const nonBlank = (page: Page): string[] => textOf(page).filter((line) => line.length > 0);

describe('line wrapping', () => {
  it('wraps on word boundaries at the column width', () => {
    const lines = wrapText('The lighthouse keeper walks the length of the gallery once more', 20);
    expect(lines.every((line) => line.length <= 20)).toBe(true);
    expect(lines.join(' ')).toBe('The lighthouse keeper walks the length of the gallery once more');
  });

  it('breaks a word that cannot fit rather than overflowing the column', () => {
    const lines = wrapText('antidisestablishmentarianism', 10);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
    expect(lines.join('')).toBe('antidisestablishmentarianism');
  });

  it('keeps explicit line breaks', () => {
    expect(wrapText('one\ntwo', 40)).toEqual(['one', 'two']);
  });
});

describe('screenplay page geometry', () => {
  it('lays action out at the full 60-character column and dialogue at 35', () => {
    const pages = paginateElements(
      [
        element('action', 'A'.repeat(80)),
        element('character', 'Marisol'),
        element('dialogue', 'B'.repeat(80)),
      ],
      SCREENPLAY_LAYOUT,
    );

    const lines = pages[0]!.lines.filter((line) => line.text.length > 0);
    const action = lines.filter((line) => line.type === 'action');
    const dialogue = lines.filter((line) => line.type === 'dialogue');

    expect(action[0]?.text).toHaveLength(60);
    expect(action[0]?.indent).toBe(0);
    expect(dialogue[0]?.text).toHaveLength(35);
    expect(dialogue[0]?.indent).toBe(10);
    expect(lines.find((line) => line.type === 'character')?.indent).toBe(22);
  });

  it('uppercases scene headings and character cues', () => {
    const pages = paginateElements(
      [element('scene_heading', 'int. lighthouse - night'), element('character', 'marisol')],
      SCREENPLAY_LAYOUT,
    );
    expect(nonBlank(pages[0]!)).toContain('INT. LIGHTHOUSE - NIGHT');
    expect(nonBlank(pages[0]!)).toContain('MARISOL');
  });

  it('never puts more than 55 lines on a page', () => {
    const elements = Array.from({ length: 40 }, (_, index) => element('action', `Beat of action number ${index}.`));
    const pages = paginateElements(elements, SCREENPLAY_LAYOUT);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.lines.length).toBeLessThanOrEqual(55);
  });
});

describe('page break rules', () => {
  it('splits long dialogue with (MORE) and resumes under NAME (CONT\'D)', () => {
    // Fill most of the page, then start a speech too long to finish on it.
    const filler = Array.from({ length: 22 }, (_, index) => element('action', `Filler line ${index}.`));
    const speech = 'She talks and keeps talking about the light and the water and the years. '.repeat(6);
    const pages = paginateElements(
      [...filler, element('character', 'Marisol'), element('dialogue', speech)],
      SCREENPLAY_LAYOUT,
    );

    expect(pages.length).toBeGreaterThan(1);
    const first = textOf(pages[0]!);
    const second = textOf(pages[1]!);
    expect(first.at(-1)).toBe('(MORE)');
    expect(second[0]).toBe("MARISOL (CONT'D)");
    expect(second.filter((line) => line.length > 0).length).toBeGreaterThan(1);
  });

  it('moves a scene heading down rather than leaving it stranded at the foot of a page', () => {
    // 27 single-line actions with a blank between them fill 53 of the 55 lines,
    // leaving room for the heading but not for what it introduces.
    const filler = Array.from({ length: 27 }, (_, index) => element('action', `Filler ${index}.`));
    const pages = paginateElements(
      [...filler, element('scene_heading', 'INT. GALLERY - LATER'), element('action', 'The lamp turns.')],
      SCREENPLAY_LAYOUT,
    );

    const first = nonBlank(pages[0]!);
    expect(first.at(-1)).not.toBe('INT. GALLERY - LATER');
    // The heading and what it introduces stay together.
    const second = nonBlank(pages[1] ?? { number: 2, lines: [] });
    expect(second[0]).toBe('INT. GALLERY - LATER');
    expect(second[1]).toBe('The lamp turns.');
  });

  it('keeps a character cue with its dialogue across a page boundary', () => {
    const filler = Array.from({ length: 26 }, (_, index) => element('action', `Filler ${index}.`));
    const pages = paginateElements(
      [...filler, element('character', 'Marisol'), element('dialogue', 'You should not have come back.')],
      SCREENPLAY_LAYOUT,
    );

    expect(nonBlank(pages[0]!).at(-1)).not.toBe('MARISOL');
    if (pages[1]) expect(nonBlank(pages[1]).slice(0, 2)).toEqual(['MARISOL', 'You should not have come back.']);
  });
});

describe('project pagination', () => {
  const scriptWithScene = () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, {
      title: 'She confronts him',
      manuscript: {
        elements: [
          element('scene_heading', 'INT. LIGHTHOUSE - NIGHT'),
          element('action', 'Rain hammers the glass.'),
        ],
      },
    });
    return file;
  };

  it('reports a page count for a short scene', () => {
    const file = scriptWithScene();
    expect(pageCount(file)).toBe(1);
  });

  it('leaves internal beat titles out of the pages by default', () => {
    const file = scriptWithScene();
    const lines = paginateProject(file).flatMap(textOf);
    expect(lines).toContain('INT. LIGHTHOUSE - NIGHT');
    expect(lines.some((line) => line.includes('She confronts him'))).toBe(false);
  });

  it('includes them only when the annotated copy is asked for', () => {
    const file = scriptWithScene();
    const lines = paginateProject(file, { includeBeatTitles: true }).flatMap(textOf);
    expect(lines.some((line) => line.includes('[She confronts him]'))).toBe(true);
  });

  it('paginates a novel on the prose layout', () => {
    let file = createProjectFile({ title: 'The Keeper', format: 'novel' });
    const unitId = file.units[0]!.id;
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [element('paragraph', 'The lamp turned all night. '.repeat(40))] },
    });
    file = addBeat(file, { unitId }).file;

    const pages = paginateProject(file);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    // Prose is double spaced, so every second line is blank.
    const first = pages[0]!;
    expect(first.lines.filter((line) => line.type === 'blank').length).toBeGreaterThan(0);
    expect(first.lines.length).toBeLessThanOrEqual(25);
  });
});
