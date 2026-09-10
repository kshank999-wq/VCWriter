import { describe, expect, it } from 'vitest';
import {
  BBC_LAYOUT,
  BBC_TAPED_LAYOUT,
  SCREENPLAY_LAYOUT,
  US_MULTI_LAYOUT,
  layoutFor,
  layoutForFile,
  paginateElements,
  paginateProject,
  pageCount,
  wrapText,
  type Page,
} from '../pagination.js';
import { createProjectFile } from '../project-file.js';
import {
  addBeat,
  addMarker,
  addUnit,
  setActBreaks,
  setParagraphStyle,
  setScriptFormat,
  updateBeat,
} from '../mutations.js';
import { unitsInStoryOrder } from '../selectors.js';
import type { ProjectFile } from '../project-file.js';
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

describe('US multi-camera sitcom format', () => {
  const scene = [
    element('scene_heading', 'INT. GLASSELL PARK DINER - DAY'),
    element('action', 'The bell above the door rings. Mark steps inside.'),
    element('character', 'Sarah'),
    element('parenthetical', '(without looking up)'),
    element('dialogue', "You're always late, Mark. You have been late every single time."),
  ];

  it('sets everything that is not spoken in capitals', () => {
    const page = paginateElements(scene, US_MULTI_LAYOUT)[0] as Page;
    const lines = nonBlank(page);
    expect(lines).toContain('THE BELL ABOVE THE DOOR RINGS. MARK STEPS INSIDE.');
    expect(lines).toContain('(WITHOUT LOOKING UP)');
    // The speech is the one thing left alone: it is what somebody says.
    expect(lines.some((line) => line.startsWith("You're always late"))).toBe(true);
  });

  it('brings the cue in from the middle of the page', () => {
    const page = paginateElements(scene, US_MULTI_LAYOUT)[0] as Page;
    const at = (start: string) => page.lines.find((line) => line.text.startsWith(start))?.indent;
    expect(at('SARAH')).toBe(15); // 3.0", not 3.7"
    expect(at('(WITHOUT')).toBe(10);
    expect(at("You're always late")).toBe(10);
  });

  it('double spaces the speech, and nothing else', () => {
    const page = paginateElements(scene, US_MULTI_LAYOUT)[0] as Page;
    const lines = textOf(page);
    const first = lines.findIndex((line) => line.startsWith("You're always late"));
    // A blank line between every line of the speech, so it can be written on.
    expect(lines[first + 1]).toBe('');
    expect(lines[first + 2]).not.toBe('');
    // But the cue and its wryly still sit straight above it.
    expect(lines[lines.indexOf('(WITHOUT LOOKING UP)') - 1]).toBe('SARAH');
  });

  it('is chosen on the project, beside the other two houses', () => {
    expect(layoutFor('series', undefined, 'us_multi')).toBe(US_MULTI_LAYOUT);
    expect(layoutFor('screenplay', undefined, 'us')).toBe(SCREENPLAY_LAYOUT);
    const file = createProjectFile({ title: 'The Diner', format: 'series' });
    expect(layoutForFile(setScriptFormat(file, 'us_multi'))).toBe(US_MULTI_LAYOUT);
  });

  it('takes more pages for the same words, which is the point of it', () => {
    const many = Array.from({ length: 30 }, () => [
      element('character', 'Sarah'),
      element('dialogue', 'You are late again and I have been sitting here for a very long time.'),
    ]).flat();
    const single = paginateElements(many, SCREENPLAY_LAYOUT).length;
    const multi = paginateElements(many, US_MULTI_LAYOUT).length;
    expect(multi).toBeGreaterThan(single);
  });
});

describe('BBC taped format', () => {
  const scene = [
    element('scene_heading', 'INT. GLASSELL PARK DINER - DAY'),
    element('action', 'The bell above the door rings.'),
    element('character', 'Sarah'),
    element('parenthetical', '(Without looking up)'),
    element('dialogue', "You're always late, Mark. You have been late every single time we have met."),
    element('character', 'Mark'),
    element('dialogue', 'I know.'),
  ];

  it('writes the cue in the margin beside the line it introduces', () => {
    const page = paginateElements(scene, BBC_TAPED_LAYOUT)[0] as Page;
    const lines = nonBlank(page);
    // The cue is not a line of its own; it opens the speech's first line.
    expect(lines).not.toContain('SARAH');
    expect(lines.some((line) => line.startsWith('SARAH') && line.includes('(Without looking up)'))).toBe(true);
    expect(lines).toContain('MARK            I know.');
  });

  it('sets the rest of the speech in its own column, clear of the margin', () => {
    const page = paginateElements(scene, BBC_TAPED_LAYOUT)[0] as Page;
    const wrapped = page.lines.filter((line) => line.text.startsWith("You're always late") || line.indent === 16);
    // The speech's continuation lines are indented to the column, and the
    // right of the page is left clear for the crew.
    expect(wrapped.every((line) => line.indent === 16)).toBe(true);
    expect(BBC_TAPED_LAYOUT.width['dialogue']).toBe(41);
  });

  it('keeps the cue and its speech on one line, not two', () => {
    const page = paginateElements(scene, BBC_TAPED_LAYOUT)[0] as Page;
    const lines = textOf(page);
    const mark = lines.findIndex((line) => line.startsWith('MARK'));
    expect(lines[mark]).toBe('MARK            I know.');
    // One blank between the two speeches, and nothing inside either.
    expect(lines[mark - 1]).toBe('');
    expect(lines[mark - 2]).not.toBe('');
  });

  it('is the fourth choice, and the drama layout is untouched', () => {
    expect(layoutFor('series', undefined, 'bbc_taped')).toBe(BBC_TAPED_LAYOUT);
    expect(layoutFor('series', undefined, 'bbc')).toBe(BBC_LAYOUT);
    // The drama layout still puts the cue on a line above the speech.
    const drama = paginateElements(scene, BBC_LAYOUT)[0] as Page;
    expect(nonBlank(drama)).toContain('SARAH');
  });
});

describe('act breaks', () => {
  /** Six scenes with an act marker on the first, third and fifth. */
  const episode = (): ProjectFile => {
    let file = createProjectFile({ title: 'The Diner', format: 'series' });
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [element('action', 'The bell rings.')] },
    });
    for (const title of ['Two', 'Three', 'Four', 'Five', 'Six']) {
      const made = addUnit(file, { laneId: file.lanes[0]!.id, title });
      file = made.file;
      const beat = addBeat(file, { unitId: made.unit.id, title });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: { elements: [element('action', `${title} happens.`)] },
      });
    }
    const order = unitsInStoryOrder(file);
    for (const [index, name] of [[0, 'Setup'], [2, 'Turn'], [4, 'End']] as const) {
      file = addMarker(file, { unitId: order[index]!.id, title: name, kind: 'act' }).file;
    }
    // Named in words, so the acts read ACT ONE rather than ACT I.
    return { ...file, settings: { ...file.settings, markerNumbering: 'words' as const } };
  };

  it('does nothing at all until it is asked for', () => {
    const pages = paginateProject(episode());
    expect(pages).toHaveLength(1);
    expect(nonBlank(pages[0] as Page)).not.toContain('ACT ONE');
  });

  it('starts each act on a page of its own, named at the head', () => {
    const pages = paginateProject(setActBreaks(episode(), true));
    expect(pages).toHaveLength(3);
    expect((pages[0] as Page).lines[0]?.text).toBe('ACT ONE');
    expect((pages[1] as Page).lines[0]?.text).toBe('ACT TWO');
    expect((pages[2] as Page).lines[0]?.text).toBe('ACT THREE');
  });

  it('marks the end of each act under its last line', () => {
    const pages = paginateProject(setActBreaks(episode(), true));
    expect(nonBlank(pages[0] as Page).at(-1)).toBe('END OF ACT ONE');
    expect(nonBlank(pages[1] as Page).at(-1)).toBe('END OF ACT TWO');
    // Including the last one, which ends where the script does.
    expect(nonBlank(pages[2] as Page).at(-1)).toBe('END OF ACT THREE');
  });

  it('centres the heading and underlines it, as a script does', () => {
    const pages = paginateProject(setActBreaks(episode(), true));
    const head = (pages[0] as Page).lines[0]!;
    expect(head.type).toBe('act_head');
    expect(head.indent).toBe(Math.floor((60 - 'ACT ONE'.length) / 2));
    expect(head.spans[0]?.underline).toBe(true);
    expect((pages[0] as Page).lines.find((line) => line.type === 'act_end')?.spans[0]?.underline).toBe(true);
  });

  it('never pushes a line off the foot of the page to make room for a heading', () => {
    const pages = paginateProject(setActBreaks(episode(), true));
    expect(pages.every((page) => page.lines.length <= SCREENPLAY_LAYOUT.linesPerPage)).toBe(true);
  });
});
