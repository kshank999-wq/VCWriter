import { describe, expect, it } from 'vitest';
import {
  BBC_LAYOUT,
  SCREENPLAY_LAYOUT,
  layoutFor,
  layoutForFile,
  paginateElements,
  paginateProject,
  pageCount,
  wrapText,
  type Page,
} from '../pagination.js';
import { createProjectFile } from '../project-file.js';
import { addBeat, setParagraphStyle, setScriptFormat, updateBeat } from '../mutations.js';
import type { ParagraphStyle } from '../entities/project.js';
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

/**
 * Spec §6.4: a novel and a short story are set as a manuscript, and the
 * writer chooses which of the two ways it marks a new paragraph.
 */
describe('the two ways a prose page sets its paragraphs', () => {
  const novel = (style?: ParagraphStyle) => {
    let file = createProjectFile({ title: 'The Keeper', format: 'novel' });
    if (style) file = setParagraphStyle(file, style);
    return updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          element('paragraph', 'The lamp turned and the sea answered, all that long night.'),
          element('paragraph', 'She did not move.'),
        ],
      },
    });
  };

  /** Every line of the manuscript, blanks included, in order. */
  const rows = (file: ReturnType<typeof novel>) => paginateProject(file).flatMap((page) => page.lines);

  it('indents the first line of each paragraph and runs them on, by default', () => {
    const file = novel();
    expect(file.settings.paragraphStyle).toBe('indented');

    const written = rows(file).filter((line) => line.text.length > 0);
    expect(written.map((line) => line.indent)).toEqual([5, 5]);

    // Nothing between them but the blank double spacing puts under every line.
    const between = rows(file);
    const second = between.findIndex((line) => line.text.startsWith('She did not'));
    expect(between.slice(0, second).filter((line) => line.type === 'blank')).toHaveLength(1);
  });

  it('indents nothing and puts a space between them when blocked', () => {
    const file = novel('blocked');
    const written = rows(file).filter((line) => line.text.length > 0);
    expect(written.map((line) => line.indent)).toEqual([0, 0]);

    const between = rows(file);
    const second = between.findIndex((line) => line.text.startsWith('She did not'));
    expect(between.slice(0, second).filter((line) => line.type === 'blank')).toHaveLength(2);
  });

  it('sets the indent on the opening line only, not on every line of the paragraph', () => {
    let file = createProjectFile({ title: 'The Keeper', format: 'novel' });
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [element('paragraph', 'The lamp turned and the sea answered. '.repeat(6))] },
    });

    const written = paginateProject(file)
      .flatMap((page) => page.lines)
      .filter((line) => line.text.length > 0);
    expect(written.length).toBeGreaterThan(1);
    expect(written[0]?.indent).toBe(5);
    expect(written.slice(1).every((line) => line.indent === 0)).toBe(true);
  });

  it('leaves a screenplay alone: its geometry is not a choice', () => {
    const file = setParagraphStyle(createProjectFile({ title: 'The Keeper', format: 'screenplay' }), 'blocked');
    expect(layoutFor(file.project.format, file.settings.paragraphStyle)).toBe(SCREENPLAY_LAYOUT);
  });
});

describe('a speech is one block on the page', () => {
  const speech = [
    element('scene_heading', 'INT. GLASSELL PARK DINER - DAY'),
    element('action', 'The bell above the door rings.'),
    element('character', 'Sarah'),
    element('parenthetical', '(whispering)'),
    element('dialogue', "I didn't think you'd show."),
    element('character', 'Mark'),
    element('dialogue', "I almost didn't."),
    element('action', 'Sarah looks down at her coffee.'),
  ];

  it('puts the cue, the wryly and the words on consecutive lines', () => {
    const page = paginateElements(speech, SCREENPLAY_LAYOUT)[0] as Page;
    expect(textOf(page).slice(0, 11)).toEqual([
      'INT. GLASSELL PARK DINER - DAY',
      '',
      'The bell above the door rings.',
      '',
      'SARAH',
      // No blank here, and none before the speech either: this is one block.
      '(whispering)',
      "I didn't think you'd show.",
      '',
      'MARK',
      "I almost didn't.",
      '',
    ]);
  });

  it('still takes one blank line between everything else, and never two', () => {
    const page = paginateElements(speech, SCREENPLAY_LAYOUT)[0] as Page;
    const runs = textOf(page)
      .join('\n')
      .split(/[^\n]+/)
      .map((run) => run.length)
      .filter((length) => length > 0);
    // A run of newlines longer than two means a double blank line somewhere.
    expect(Math.max(...runs)).toBeLessThanOrEqual(2);
  });

  it('sets the US column at Final Draft’s own indents', () => {
    const page = paginateElements(speech, SCREENPLAY_LAYOUT)[0] as Page;
    const at = (text: string) => page.lines.find((line) => line.text === text)?.indent;
    // Measured from the 1.5" left margin: 10 characters to the inch.
    expect(at('INT. GLASSELL PARK DINER - DAY')).toBe(0); // 1.5"
    expect(at('The bell above the door rings.')).toBe(0); // 1.5"
    expect(at('SARAH')).toBe(22); // 3.7"
    expect(at('(whispering)')).toBe(16); // 3.1"
    expect(at("I didn't think you'd show.")).toBe(10); // 2.5"
    expect(SCREENPLAY_LAYOUT.width['dialogue']).toBe(35); // wraps at 6.0"
    expect(SCREENPLAY_LAYOUT.linesPerPage).toBe(55);
  });
});

describe('BBC script format', () => {
  const scene = [
    element('scene_heading', 'INT. LOCK-UP - NIGHT'),
    element('action', 'A strip light stutters.'),
    element('character', 'Sarah'),
    element('dialogue', "I didn't think you'd show."),
    element('scene_heading', 'EXT. STREET - CONTINUOUS'),
    element('action', 'Rain.'),
  ];

  it('sets the cue close to the action, with the speech under it', () => {
    const page = paginateElements(scene, BBC_LAYOUT)[0] as Page;
    const at = (text: string) => page.lines.find((line) => line.text === text)?.indent;
    expect(at('SARAH')).toBe(10); // 2.5", not 3.7"
    expect(at("I didn't think you'd show.")).toBe(10); // directly under the name
    expect(BBC_LAYOUT.width['dialogue']).toBe(47); // a wide block, to the margin
  });

  it('blocks out a change of setting with a double blank line', () => {
    const page = paginateElements(scene, BBC_LAYOUT)[0] as Page;
    const lines = textOf(page);
    const heading = lines.indexOf('EXT. STREET - CONTINUOUS');
    expect(lines[heading - 1]).toBe('');
    expect(lines[heading - 2]).toBe('');
    expect(lines[heading - 3]).not.toBe('');
    // And nothing else gains a second blank.
    expect(lines[lines.indexOf('SARAH') - 1]).toBe('');
    expect(lines[lines.indexOf('SARAH') - 2]).not.toBe('');
  });

  it('is A4, so it holds more lines in a narrower column', () => {
    expect(BBC_LAYOUT.linesPerPage).toBe(58);
    expect(BBC_LAYOUT.columns).toBe(57);
  });

  it('is chosen on the project, and only by a script', () => {
    expect(layoutFor('screenplay', undefined, 'bbc')).toBe(BBC_LAYOUT);
    expect(layoutFor('series', undefined, 'bbc')).toBe(BBC_LAYOUT);
    expect(layoutFor('screenplay', undefined, 'us')).toBe(SCREENPLAY_LAYOUT);
    // Unsaid means US studio format, as it always has.
    expect(layoutFor('screenplay')).toBe(SCREENPLAY_LAYOUT);
    // A novel is set as a manuscript whatever a script setting says.
    expect(layoutFor('novel', 'indented', 'bbc')).not.toBe(BBC_LAYOUT);
  });

  it('follows the file’s own setting', () => {
    const file = createProjectFile({ title: 'The Lock-Up', format: 'screenplay' });
    expect(layoutForFile(file)).toBe(SCREENPLAY_LAYOUT);
    expect(layoutForFile(setScriptFormat(file, 'bbc'))).toBe(BBC_LAYOUT);
  });
});
