import { describe, expect, it } from 'vitest';
import {
  ImportError,
  buildProjectFromImport,
  castByCategory,
  gatherCast,
  marginOf,
  namesInAction,
  readFinalDraft,
  charWidthOf,
  readLaidOutLines,
  readSlugline,
  type LaidOutLine,
} from '../index.js';

/**
 * Reading somebody else's script (addendum 02 §18): Final Draft, which says
 * what every line is, and a PDF, which only says where it sits.
 */

const fdx = (content: string, titlePage = '') => `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${content}
  </Content>
${titlePage}
</FinalDraft>`;

const paragraph = (type: string, text: string) =>
  `    <Paragraph Type="${type}"><Text>${text}</Text></Paragraph>`;

describe('Final Draft', () => {
  const script = fdx(
    [
      paragraph('Scene Heading', 'INT. SANCHEZ HOME - KITCHEN - MORNING'),
      paragraph('Action', 'He waits for the kettle.'),
      paragraph('Character', 'Maeve'),
      paragraph('Parenthetical', '(not looking up)'),
      paragraph('Dialogue', 'You were out.'),
      paragraph('Scene Heading', 'EXT. HARBOUR - NIGHT'),
      paragraph('Action', 'Rain on the water.'),
      paragraph('Character', 'MAEVE'),
      paragraph('Dialogue', 'Not tonight.'),
      paragraph('Character', 'THE FERRYMAN'),
      paragraph('Dialogue', 'Suit yourself.'),
      paragraph('Transition', 'CUT TO:'),
    ].join('\n'),
    `  <TitlePage><Content>
    <Paragraph><Text>THE LIGHTHOUSE</Text></Paragraph>
    <Paragraph><Text>by K. Shank</Text></Paragraph>
  </Content></TitlePage>`,
  );

  it('reads the title page, the scenes and every kind of line', () => {
    const read = readFinalDraft(script);
    expect(read.title).toBe('THE LIGHTHOUSE');
    expect(read.author).toBe('K. Shank');
    expect(read.scenes).toHaveLength(2);
    expect(read.scenes[0]?.heading).toBe('INT. SANCHEZ HOME - KITCHEN - MORNING');
    expect(read.scenes[0]?.elements.map((element) => element.type)).toEqual([
      'action',
      'character',
      'parenthetical',
      'dialogue',
    ]);
    // Nothing is guessed: the file said what each line was.
    expect(read.scenes.flatMap((scene) => scene.elements).some((element) => element.guessed)).toBe(false);
    expect(read.warnings).toEqual([]);
  });

  it('shouts a cue however it was typed, so the same person is one person', () => {
    const read = readFinalDraft(script);
    expect(read.characters.map((person) => person.name)).toEqual(['MAEVE', 'THE FERRYMAN']);
    expect(read.characters[0]?.speeches).toBe(2);
    expect(read.characters[0]?.scenes).toBe(2);
  });

  it('gathers the locations without the time of day', () => {
    const read = readFinalDraft(script);
    // A scene each, so they come back in name order.
    expect(read.locations.map((place) => place.name)).toEqual(['HARBOUR', 'SANCHEZ HOME - KITCHEN']);
    expect(read.locations.map((place) => place.where)).toEqual(['exterior', 'interior']);
  });

  it('keeps the emphasis Final Draft was carrying', () => {
    const read = readFinalDraft(
      fdx('    <Paragraph Type="Action"><Text>He waits. </Text><Text Style="Italic">Then he does not.</Text></Paragraph>'),
    );
    expect(read.scenes[0]?.elements[0]?.text).toBe('He waits. *Then he does not.*');
  });

  it('marks the second half of a dual pair, and not the first', () => {
    const read = readFinalDraft(
      fdx(`    <DualDialogue>
${paragraph('Character', 'MAEVE')}
${paragraph('Dialogue', 'You were out.')}
${paragraph('Character', 'JUAN')}
${paragraph('Dialogue', 'I was not.')}
    </DualDialogue>`),
    );
    const elements = read.scenes[0]?.elements ?? [];
    expect(elements.map((element) => [element.text, element.dual === true])).toEqual([
      ['MAEVE', false],
      ['You were out.', false],
      ['JUAN', true],
      ['I was not.', false],
    ]);
  });

  it('unescapes what XML escaped', () => {
    const read = readFinalDraft(fdx(paragraph('Action', 'Salt &amp; rope &#8212; and the &quot;good&quot; rope.')));
    expect(read.scenes[0]?.elements[0]?.text).toBe('Salt & rope — and the "good" rope.');
  });

  it('says so when a paragraph type has no equivalent here', () => {
    const read = readFinalDraft(fdx(paragraph('Cast List', 'MAEVE, JUAN')));
    expect(read.warnings.join(' ')).toContain('Cast List');
    // It still comes in, as action, rather than being dropped.
    expect(read.scenes[0]?.elements[0]?.type).toBe('action');
  });

  it('refuses a file that is not Final Draft', () => {
    expect(() => readFinalDraft('<html><body>not a script</body></html>')).toThrow(ImportError);
  });
});

describe('a PDF', () => {
  /** A page of screenplay at the real indents, 1.5in margin, 12pt Courier. */
  const M = 108; // 1.5in in points
  const CH = 7.2;
  const at = (indent: number, text: string, line: number, page = 1): LaidOutLine => ({
    text,
    x: M + indent * CH,
    y: 720 - line * 12,
    page,
  });

  const page: LaidOutLine[] = [
    at(0, 'INT. SANCHEZ HOME - KITCHEN - MORNING', 0),
    at(0, 'He waits for the kettle. Outside, the rain has', 2),
    at(0, 'not let up since Tuesday.', 3),
    at(22, 'MAEVE', 5),
    at(13, '(not looking up)', 6),
    at(10, 'You were out. I heard the door at', 7),
    at(10, 'four in the morning.', 8),
    at(0, 'He says nothing.', 10),
    at(22, 'MAEVE (CONT’D)', 12),
    at(10, 'Well?', 13),
    at(45, 'CUT TO:', 15),
    at(0, 'EXT. HARBOUR - NIGHT', 17),
    at(0, 'Rain on the water.', 19),
    { text: '2.', x: 500, y: 40, page: 1 },
  ];

  it('finds the margin from the page rather than assuming one', () => {
    expect(Math.round(marginOf(page))).toBe(M);
    // A script typed at an inch reads exactly the same way.
    const shifted = page.map((line) => ({ ...line, x: line.x - 36 }));
    expect(Math.round(marginOf(shifted))).toBe(M - 36);
  });

  it('reads each line from where it sits on the page', () => {
    const read = readLaidOutLines(page);
    const types = read.scenes.flatMap((scene) => [
      ...(scene.heading ? ['scene_heading'] : []),
      ...scene.elements.map((element) => element.type),
    ]);
    expect(types).toEqual([
      'scene_heading',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'action',
      'character',
      'dialogue',
      'transition',
      'scene_heading',
      'action',
    ]);
  });

  it('rejoins the lines a page break made of one paragraph', () => {
    const read = readLaidOutLines(page);
    expect(read.scenes[0]?.elements[0]?.text).toBe(
      'He waits for the kettle. Outside, the rain has not let up since Tuesday.',
    );
    expect(read.scenes[0]?.elements[3]?.text).toBe('You were out. I heard the door at four in the morning.');
  });

  it('leaves out what the page prints but nobody wrote', () => {
    const read = readLaidOutLines(page);
    const everything = read.scenes.flatMap((scene) => scene.elements.map((element) => element.text)).join(' ');
    expect(everything).not.toContain('2.');
  });

  it('counts the cast, with an extension folded into the name behind it', () => {
    const read = readLaidOutLines(page);
    expect(read.characters).toHaveLength(1);
    expect(read.characters[0]?.name).toBe('MAEVE');
    expect(read.characters[0]?.speeches).toBe(2);
  });

  it('takes the title page off the front rather than reading it as cast', () => {
    // Centred lines land in the cue band, so a title page left in would come
    // in as three characters who speak once each.
    const title: LaidOutLine[] = [
      { text: 'GOTTA HAVE FAITH', x: M + 20 * CH, y: 500, page: 1 },
      { text: 'Written by', x: M + 22 * CH, y: 460, page: 1 },
      { text: 'K. Shank', x: M + 22 * CH, y: 440, page: 1 },
    ];
    const read = readLaidOutLines([...title, ...page.map((line) => ({ ...line, page: 2 }))]);
    expect(read.title).toBe('GOTTA HAVE FAITH');
    expect(read.author).toBe('K. Shank');
    expect(read.characters.map((person) => person.name)).toEqual(['MAEVE']);
  });

  it('keeps page one when it is the script, not a title page', () => {
    const read = readLaidOutLines(page);
    expect(read.scenes[0]?.heading).toBe('INT. SANCHEZ HOME - KITCHEN - MORNING');
  });

  it('finds the margin in a talky script, where dialogue is the commonest edge', () => {
    // Six speeches and two action lines: the speech indent is now the edge
    // most lines sit at. Taking the *commonest* edge put the margin an inch
    // too far right, which dropped every cue below the cue band — the script
    // imported as one long action passage with no cast at all.
    const talky: LaidOutLine[] = [
      at(0, 'INT. LIGHTHOUSE - NIGHT', 0),
      at(0, 'Rain on the glass.', 2),
      at(22, 'MAEVE', 4),
      at(10, 'You were out.', 5),
      at(22, 'THE KEEPER', 7),
      at(10, 'I was.', 8),
      at(22, 'MAEVE (CONT’D)', 10),
      at(10, 'All night.', 11),
      at(22, 'THE KEEPER (CONT’D)', 13),
      at(10, 'All night.', 14),
      at(22, 'MAEVE (CONT’D)', 16),
      at(10, 'And the lamp?', 17),
      at(22, 'THE KEEPER (CONT’D)', 19),
      at(10, 'The lamp turned.', 20),
    ];
    expect(Math.round(marginOf(talky))).toBe(M);

    const read = readLaidOutLines(talky);
    expect(read.characters.map((person) => person.name)).toEqual(['MAEVE', 'THE KEEPER']);
    const types = read.scenes.flatMap((scene) => scene.elements.map((element) => element.type));
    expect(new Set(types)).toEqual(new Set(['action', 'character', 'dialogue']));
  });

  it('reads a script that indents with spaces instead of moving the pen', () => {
    // Plenty of PDFs draw the indent as spaces at the margin, so every line
    // has the same x. Read from x alone there are no cues and no speeches.
    const padded = (text: string, line: number): LaidOutLine => ({ text, x: M, y: 720 - line * 12, page: 1 });
    const read = readLaidOutLines([
      padded('INT. LIGHTHOUSE - NIGHT', 0),
      padded('Rain on the glass.', 2),
      padded('                      MAEVE', 4),
      padded('             (not looking up)', 5),
      padded('          You were out.', 6),
      padded('He says nothing.', 8),
    ]);

    expect(read.characters.map((person) => person.name)).toEqual(['MAEVE']);
    expect(read.scenes[0]?.elements.map((element) => element.type)).toEqual([
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'action',
    ]);
    // The padding is not part of what was written.
    expect(read.scenes[0]?.elements[3]?.text).toBe('You were out.');
  });

  it('says when it had to guess, and when there was nothing to read', () => {
    // A shout at the margin is very likely a slug the script wrote without
    // INT./EXT., but it is a guess and says so.
    const guessy = readLaidOutLines([at(0, 'LATER THAT NIGHT', 0), at(0, 'The kettle is cold.', 2)]);
    expect(guessy.scenes[0]?.heading).toBe('LATER THAT NIGHT');
    expect(guessy.warnings.join(' ')).toMatch(/worked out from their shape/);

    expect(readLaidOutLines([]).warnings.join(' ')).toContain('No text could be read');
  });
});

describe('what a slugline says', () => {
  it('takes the place out of it and leaves the time of day behind', () => {
    expect(readSlugline('INT. SANCHEZ HOME - KITCHEN - MORNING')).toEqual({
      name: 'SANCHEZ HOME - KITCHEN',
      where: 'interior',
    });
    expect(readSlugline('EXT. HARBOUR - NIGHT').where).toBe('exterior');
    expect(readSlugline('INT./EXT. CAR - CONTINUOUS')).toEqual({ name: 'CAR', where: 'both' });
    // A place whose own name is a time of day is not swallowed.
    expect(readSlugline('INT. DAY CENTRE').name).toBe('DAY CENTRE');
  });
});

describe('building the project', () => {
  const read = () =>
    readFinalDraft(
      fdx(
        [
          paragraph('Scene Heading', 'INT. SANCHEZ HOME - KITCHEN - MORNING'),
          paragraph('Action', 'He waits.'),
          ...Array.from({ length: 8 }, () =>
            [paragraph('Character', 'MAEVE'), paragraph('Dialogue', 'Again.')].join('\n'),
          ),
          paragraph('Scene Heading', 'EXT. HARBOUR - NIGHT'),
          paragraph('Character', 'THE FERRYMAN'),
          paragraph('Dialogue', 'Suit yourself.'),
        ].join('\n'),
      ),
    );

  it('arrives broken up: a scene per slugline, each with a beat to write in', () => {
    const built = buildProjectFromImport(read(), { title: 'The Lighthouse' });
    expect(built.scenes).toBe(2);
    expect(built.beats).toBe(2);
    expect(built.file.units.map((unit) => unit.title)).toEqual([
      'INT. SANCHEZ HOME - KITCHEN - MORNING',
      'EXT. HARBOUR - NIGHT',
    ]);
    expect(built.file.units.map((unit) => unit.sequenceLabel)).toEqual(['Sc. 1', 'Sc. 2']);
    // The slugline is the scene's first line as well as its title.
    expect(built.file.beats[0]?.manuscript.elements[0]?.type).toBe('scene_heading');
    // And no empty "Opening Scene" left over in front of page one.
    expect(built.file.units).toHaveLength(2);
  });

  it('files the cast by how much of the script they carry', () => {
    const built = buildProjectFromImport(read(), { title: 'The Lighthouse' });
    const groups = castByCategory(built.file);
    expect(groups.find((group) => group.name === 'Main characters')?.characters.map((p) => p.name)).toEqual(['MAEVE']);
    expect(groups.find((group) => group.name === 'Minor characters')?.characters.map((p) => p.name)).toEqual([
      'THE FERRYMAN',
    ]);
  });

  it('binds a speech to the character it belongs to, so read-back can voice it', () => {
    const built = buildProjectFromImport(read(), { title: 'The Lighthouse' });
    const cue = built.file.beats[0]?.manuscript.elements.find((element) => element.type === 'character');
    const maeve = built.file.characters.find((person) => person.name === 'MAEVE');
    expect(cue?.characterId).toBe(maeve?.id);
  });

  it('puts every location on the research shelf', () => {
    const built = buildProjectFromImport(read(), { title: 'The Lighthouse' });
    expect(built.locations).toBe(2);
    const titles = built.file.researchItems.map((item) => item.title);
    expect(titles).toContain('SANCHEZ HOME - KITCHEN');
    expect(titles).toContain('HARBOUR');
    expect(built.file.researchItems[0]?.origin).toBe('import');
  });

  it('says on the project where it came from', () => {
    const built = buildProjectFromImport(read(), { title: 'The Lighthouse' });
    expect(built.file.project.notes).toContain('Final Draft');
    expect(built.file.project.title).toBe('The Lighthouse');
  });

  it('can be told to leave the cast unfiled and the locations alone', () => {
    const built = buildProjectFromImport(read(), { fileCast: false, keepLocations: false });
    expect(built.file.characters.every((person) => person.categoryId === null)).toBe(true);
    expect(built.locations).toBe(0);
  });

  it('counts a cast from scenes without needing the whole reader', () => {
    expect(
      gatherCast([
        { heading: 'INT. A - DAY', elements: [{ type: 'character', text: 'MAEVE (O.S.)' }] },
        { heading: 'INT. B - DAY', elements: [{ type: 'character', text: 'MAEVE' }] },
      ]).map((person) => [person.name, person.speeches, person.scenes]),
    ).toEqual([['MAEVE', 2, 2]]);
  });
});

/**
 * A PDF that has been **scaled** (addendum 02 §18).
 *
 * Print a script "fit to page", or put Letter content on A4, and everything
 * lands at about 60% of where it should be. The margin still comes out right,
 * because it is measured — but a *character* was a constant, so every other
 * band came out proportionally short and shifted into the one below it. The
 * script imported with its cues as dialogue and its speeches as action, which
 * looks nearly right on the page and is the hardest way for it to be wrong.
 */
describe('a PDF that has been scaled', () => {
  const CH = 7.2;
  const MARGIN_IN = 1.5;

  /** The same page, printed at `scale` of its proper size. */
  const scaled = (scale: number): LaidOutLine[] => {
    const margin = MARGIN_IN * 72 * scale;
    const at = (indent: number, text: string, line: number): LaidOutLine => ({
      text,
      x: margin + indent * CH * scale,
      y: (720 - line * 12) * scale,
      page: 1,
    });
    return [
      at(0, 'EXT. RUSSIAN GEOLOGY CENTER - DAY', 0),
      at(0, 'A finger on a TV screen of the flyover video.', 2),
      at(22, 'RUVIN', 4),
      at(16, '(speaking to the room in Russian)', 5),
      at(10, '2000 meters in diameter.', 6),
      at(0, 'RUVIN MOROZOV, 45, tall, greasy hair.', 8),
      at(22, 'RUVIN (CONT’D)', 10),
      at(10, 'We need to survey the site.', 11),
      at(22, 'GREGOR', 13),
      at(10, 'The most excitement all year.', 14),
      at(45, 'CUT TO:', 16),
    ];
  };

  const typesOf = (lines: LaidOutLine[]): string[] => {
    const read = readLaidOutLines(lines);
    return read.scenes.flatMap((scene) => [
      ...(scene.heading ? ['scene_heading'] : []),
      ...scene.elements.map((element) => element.type),
    ]);
  };

  const RIGHT = [
    'scene_heading',
    'action',
    'character',
    'parenthetical',
    'dialogue',
    'action',
    'character',
    'dialogue',
    'character',
    'dialogue',
    'transition',
  ];

  it('measures the page rather than assuming twelve-point Courier', () => {
    expect(charWidthOf(scaled(1), marginOf(scaled(1)))).toBeCloseTo(7.2, 1);
    expect(charWidthOf(scaled(0.6), marginOf(scaled(0.6)))).toBeCloseTo(4.32, 1);
  });

  it('reads a full-size script exactly as it always did', () => {
    expect(typesOf(scaled(1))).toEqual(RIGHT);
  });

  it('reads a scaled one the same way, instead of shifting every band down', () => {
    // This is the one that used to come back with the cues as dialogue and the
    // speeches as action — a script that looked nearly right and was not.
    for (const scale of [0.85, 0.75, 0.65, 0.6, 0.55]) {
      expect(typesOf(scaled(scale))).toEqual(RIGHT);
    }
  });

  it('reads a script printed larger than life too', () => {
    expect(typesOf(scaled(1.3))).toEqual(RIGHT);
  });

  it('keeps the constant where the page has no cues to ask', () => {
    const noCues: LaidOutLine[] = [
      { text: 'INT. A ROOM - DAY', x: 108, y: 700, page: 1 },
      { text: 'Somebody waits.', x: 108, y: 676, page: 1 },
    ];
    expect(charWidthOf(noCues, marginOf(noCues))).toBe(7.2);
  });

  it('is not rescaled by one stray shout in the middle of the action', () => {
    const page = scaled(1);
    const strays = [
      ...page,
      { text: 'BANG', x: 108 + 30 * 7.2, y: 300, page: 1 },
      { text: 'CRASH', x: 108 + 30 * 7.2, y: 288, page: 1 },
    ];
    // Two of them at one edge is not three, so the cues still answer.
    expect(charWidthOf(strays, marginOf(strays))).toBeCloseTo(7.2, 1);
  });
});

/**
 * The cast a script has, rather than the list of who speaks (addendum 02 §18).
 *
 * Every screenplay capitalises a character where the action introduces them,
 * and the ones with no lines at all are exactly the people that convention
 * exists for. Read from the cues alone, a silent character is not in the
 * script as far as the project is concerned — which is what Ken hit: the list
 * came back short.
 *
 * The risk in reading the action is the other way round, so both halves are
 * tested: the people who are found, and the shouting that is not a person.
 */
describe('the people a script names in its action', () => {
  const scene = (heading: string, ...action: string[]) => ({
    heading,
    elements: action.map((text) => ({ type: 'action' as const, text })),
  });

  it('finds somebody who is named and never given a line', () => {
    const cast = gatherCast([scene('INT. WAREHOUSE - NIGHT', 'A guard, HOLLIS, watches from the mezzanine.')]);
    expect(cast.map((person) => [person.name, person.speeches])).toEqual([['HOLLIS', 0]]);
  });

  it('keeps the cue as the name and the full name as an alias', () => {
    const cast = gatherCast([
      {
        heading: 'INT. WAREHOUSE - NIGHT',
        elements: [
          { type: 'action', text: 'MARA OKONJO, forty, steps through the roller door.' },
          { type: 'character', text: 'MARA' },
          { type: 'dialogue', text: 'Put it down.' },
        ],
      },
    ]);
    // The name has to stay what the manuscript cues with, or cue completion
    // and read-back stop finding her.
    expect(cast[0]?.name).toBe('MARA');
    expect(cast[0]?.aliases).toEqual(['MARA OKONJO']);
    expect(cast).toHaveLength(1);
  });

  it('matches a full name to the part the script cues with, wherever it sits', () => {
    const cast = gatherCast([
      {
        heading: 'EXT. DOCKS - LATER',
        elements: [
          { type: 'action', text: 'DET. SGT. ANNE PARRISH gets out, coat over her head.' },
          { type: 'character', text: 'PARRISH (O.S.)' },
          { type: 'dialogue', text: 'Nobody move.' },
        ],
      },
    ]);
    expect(cast.map((person) => person.name)).toEqual(['PARRISH']);
    expect(cast[0]?.aliases).toEqual(['DET. SGT. ANNE PARRISH']);
  });

  it('does not take a dog that BARKS once for a member of the cast', () => {
    expect(
      namesInAction([scene('INT. YARD - NIGHT', 'A dog BARKS. Somewhere a SIREN winds up.')]),
    ).toEqual([]);
  });

  it('does not let the article make a name out of a noise', () => {
    // "A" is a capital letter, so "A SIREN" reads as a two-word run — and two
    // words is one of the things that makes a name believable. Caught on a
    // real PDF, where A SIREN came back as a member of the cast.
    expect(namesInAction([scene('EXT. DOCKS - NIGHT', 'A SIREN winds up and dies away.')])).toEqual([]);
  });

  it('leaves the camera and the cutting room out of the cast', () => {
    expect(
      namesInAction([
        scene('INT. ROOM - DAY', 'ANGLE ON the door. SMASH CUT TO:', 'SUPER: SIX MONTHS EARLIER'),
      ]).map((found) => found.name),
    ).toEqual([]);
  });

  it('believes a name the action uses in more than one scene', () => {
    const found = namesInAction([
      scene('INT. A - DAY', 'The lift doors open and WENDELL steps out.'),
      scene('INT. B - DAY', 'WENDELL is already waiting.'),
    ]);
    expect(found.map((one) => [one.name, one.scenes])).toEqual([['WENDELL', 2]]);
  });

  it('reads nothing out of an action line typed entirely in capitals', () => {
    // Nothing in it says which word is a name, so every word would be one.
    expect(namesInAction([scene('INT. A - DAY', 'THE TRAIN PULLS OUT AND THE PLATFORM EMPTIES.')])).toEqual([]);
  });

  it('puts the silent ones last, after everyone the script gives a line', () => {
    const cast = gatherCast([
      {
        heading: 'INT. WAREHOUSE - NIGHT',
        elements: [
          { type: 'action', text: 'A guard, HOLLIS, watches.' },
          { type: 'character', text: 'MARA' },
          { type: 'dialogue', text: 'Put it down.' },
        ],
      },
    ]);
    expect(cast.map((person) => person.name)).toEqual(['MARA', 'HOLLIS']);
  });

  it('files a silent character as a minor part, and says why', () => {
    const built = buildProjectFromImport({
      title: 'Blackout',
      author: '',
      source: 'pdf',
      warnings: [],
      locations: [],
      characters: gatherCast([
        {
          heading: 'INT. WAREHOUSE - NIGHT',
          elements: [
            { type: 'action', text: 'A guard, HOLLIS, watches.' },
            { type: 'character', text: 'MARA' },
            { type: 'dialogue', text: 'Put it down.' },
          ],
        },
      ]),
      scenes: [],
    });

    const hollis = built.file.characters.find((person) => person.name === 'HOLLIS');
    expect(hollis?.description).toContain('no lines');
    const minor = castByCategory(built.file).find((group) => group.name === 'Minor characters');
    expect(minor?.characters.map((person) => person.name)).toEqual(['HOLLIS']);
  });

  it('binds an extended cue to the person it names', () => {
    // MAEVE, MAEVE (V.O.) and MAEVE (CONT'D) are one person; binding on the
    // text as typed left every extended cue in the script attached to nobody.
    const built = buildProjectFromImport({
      title: 'The Lighthouse',
      author: '',
      source: 'pdf',
      warnings: [],
      locations: [],
      characters: [{ name: 'MAEVE', speeches: 2, scenes: 1 }],
      scenes: [
        {
          heading: 'INT. LAMP ROOM - NIGHT',
          elements: [
            { type: 'character', text: 'MAEVE (V.O.)' },
            { type: 'dialogue', text: 'The light goes out at four.' },
          ],
        },
      ],
    });

    const maeve = built.file.characters.find((person) => person.name === 'MAEVE');
    const cue = built.file.beats[0]?.manuscript.elements.find((element) => element.type === 'character');
    expect(cue?.characterId).toBe(maeve?.id);
  });
});
