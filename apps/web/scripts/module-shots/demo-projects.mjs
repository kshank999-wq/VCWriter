/**
 * The demo projects the module screenshots are taken from (addendum 35 §7).
 *
 * One small, original project per module, built with the domain's own
 * importers and mutations so each opens in the program exactly as a writer's
 * would. All the writing here is made up for the purpose.
 */
import {
  addResearchItem,
  addRow,
  appendImportedEpisode,
  buildProjectFromImport,
  createProjectFile,
  mainDocument,
  readFinalDraft,
  setDocumentContent,
  setRowAudio,
  setRowVisual,
  setRowDialogue,
  textToDocContent,
  textToProse,
  beatsForUnit,
  unitsInStoryOrder,
  updateBeat,
  updateUnit,
} from '@vcwriter/domain';

/** Titles for the beats, in story order, so no card reads *Untitled*. */
const titled = (file, beatTitles, unitTitles = []) => {
  let next = file;
  const units = unitsInStoryOrder(next);
  units.forEach((unit, index) => {
    if (unitTitles[index]) next = updateUnit(next, unit.id, { title: unitTitles[index] });
  });
  const beats = units.flatMap((unit) => beatsForUnit(next, unit.id));
  beats.forEach((beat, index) => {
    if (beatTitles[index]) next = updateBeat(next, beat.id, { title: beatTitles[index] });
  });
  return next;
};

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lines as [type, text] pairs, written out as Final Draft XML. */
const fdx = (lines) =>
  `<?xml version="1.0" encoding="UTF-8"?><FinalDraft DocumentType="Script" Version="5"><Content>${lines
    .map(([type, text]) => `<Paragraph Type="${type}"><Text>${escape(text)}</Text></Paragraph>`)
    .join('')}</Content></FinalDraft>`;

/** Notes on the research shelf, filed under the project's first folders. */
const withNotes = (file, notes) => {
  let next = file;
  notes.forEach(([title, body], index) => {
    const folders = next.researchCategories;
    const folder = folders[index % Math.max(1, Math.min(3, folders.length))] ?? folders[0];
    if (folder) next = addResearchItem(next, { categoryId: folder.id, title, body });
  });
  return next;
};

const SCREENPLAY = [
  ['Scene Heading', 'EXT. LIGHTHOUSE POINT - NIGHT'],
  ['Action', 'Rain hammers the gallery rail. MARA OKONJO (40s), keeper\'s coat over a nightdress, fights the door open against the wind.'],
  ['Action', 'Far out, a single green light blinks where no ship should be.'],
  ['Character', 'MARA'],
  ['Dialogue', 'That is not a boat.'],
  ['Scene Heading', 'INT. LAMP ROOM - CONTINUOUS'],
  ['Action', 'The great lens turns. Mara grabs the logbook and runs a finger down thirty years of her father\'s handwriting.'],
  ['Character', 'TEO (V.O.)'],
  ['Parenthetical', '(over the radio, crackling)'],
  ['Dialogue', 'Point station, this is the harbour. You seeing what I\'m seeing?'],
  ['Character', 'MARA'],
  ['Dialogue', 'Every night since Tuesday, Teo. And it\'s getting closer.'],
  ['Scene Heading', 'EXT. HARBOUR WALL - DAWN'],
  ['Action', 'TEO BRANDT (30s), harbourmaster, lowers his binoculars. The green light is gone. On the shingle below, something has washed up.'],
  ['Character', 'TEO'],
  ['Dialogue', 'Mara. You need to come down here.'],
  ['Transition', 'CUT TO:'],
  ['Scene Heading', 'INT. KEEPER\'S COTTAGE - KITCHEN - DAY'],
  ['Action', 'A brass ship\'s lantern sits on the table between them, still warm, its glass painted green.'],
  ['Character', 'MARA'],
  ['Dialogue', 'This came off the Ariadne. She went down in 1962.'],
];

const STAGE_PLAY = [
  ['Scene Heading', 'ACT ONE, SCENE ONE'],
  ['Action', 'A railway waiting room, after the last train. One bench, one clock that has stopped at ten past nine. JUNE sits with a suitcase on her knees.'],
  ['Character', 'JUNE'],
  ['Dialogue', 'They said there would be one more. They always say there\'s one more.'],
  ['Action', 'Enter ALBIE, a porter, carrying a lamp.'],
  ['Character', 'ALBIE'],
  ['Dialogue', 'Nothing more tonight, miss. Not on this line.'],
  ['Character', 'JUNE'],
  ['Dialogue', 'Then I\'ll wait for the morning.'],
  ['Character', 'ALBIE'],
  ['Parenthetical', '(setting the lamp down)'],
  ['Dialogue', 'It\'s a long night to spend with a clock that won\'t move.'],
  ['Character', 'JUNE'],
  ['Dialogue', 'I\'ve spent longer with less.'],
  ['Action', 'He sits at the far end of the bench. Neither looks at the other. Lights narrow to the lamp.'],
];

const episode = (number, title, lines) => ({ number, title, xml: fdx(lines) });

const SERIES = [
  episode(1, 'Pilot', [
    ['Scene Heading', 'INT. NIGHT DESK, CITY RECORD - NIGHT'],
    ['Action', 'Three desks, one working lamp. DEV ASHBY (20s) types with the phone wedged under his ear.'],
    ['Character', 'DEV'],
    ['Dialogue', 'No, I understand it\'s two in the morning. That\'s why I\'m calling you.'],
    ['Action', 'RUTH CALDER (50s), night editor, drops a folder on his keyboard.'],
    ['Character', 'RUTH'],
    ['Dialogue', 'Forget the council. The river\'s gone red at the weir.'],
  ]),
  episode(2, 'The Weir', [
    ['Scene Heading', 'EXT. RIVERSIDE WEIR - DAWN'],
    ['Action', 'Dev and Ruth stand on the footbridge. Below them the water runs the colour of rust.'],
    ['Character', 'RUTH'],
    ['Dialogue', 'Whoever did this wanted it seen.'],
  ]),
  episode(3, 'Upstream', [
    ['Scene Heading', 'INT. DYE WORKS - DAY'],
    ['Action', 'Abandoned vats. Fresh footprints in the dust lead to a door that should be locked.'],
    ['Character', 'DEV'],
    ['Dialogue', 'Somebody\'s been here this week.'],
  ]),
];

const NOVEL = `Chapter One

The letter arrived on the first warm day of April, which Nell would later decide was the only sign the universe ever gave her.

It was addressed to her grandmother, who had been dead for eleven years, and it had been posted in a town Nell had never heard of. The stamp showed a heron standing in reeds. The handwriting was careful, old-fashioned, the kind taught with a ruler across the knuckles.

She did not open it at the door. She carried it through the house the way you might carry a bird that had flown into a window, not sure yet whether it would live.

Chapter Two

Marsh End was three streets, a church with no spire, and a pub that had changed its name so many times the locals simply called it the Pub.

Nell parked by the war memorial and sat for a while with the engine ticking. The letter lay on the passenger seat. She had read it six times on the drive and it still said the same thing: Your grandmother left something with me in 1974. It is time someone came for it.

Chapter Three

The woman who answered the door was older than anyone Nell had ever met, and she looked at Nell as though she had been expecting someone else entirely.`;

const INSTRUCTIONAL = `Chapter 1: Writing Clear Sentences

Every sentence makes a promise to the reader: follow me and you will understand one thing more than you did. This chapter is about keeping that promise.

1.1 One idea per sentence

A sentence that carries two ideas asks the reader to hold both at once. Split it, and each idea gets the reader's full attention.

Compare: The committee met on Tuesday and decided, after reviewing the budget, which had grown, to delay the project. With: The committee met on Tuesday. After reviewing the budget, it decided to delay the project.

1.2 Put the action in the verb

Weak sentences hide their action in nouns. Make a decision becomes decide; conduct an investigation becomes investigate. The sentence gets shorter and stronger at once.

1.3 Adverbs and the verbs they prop up

If you use an adverb, make it earn its place. Ran quickly is usually sprinted; said loudly is usually shouted. Choose the verb that already means what the adverb was trying to add.

Chapter 2: Building Paragraphs

A paragraph is a unit of thought. It opens with a claim, supports it, and hands the reader on to the next.`;

const STORIES = `Chapter 1: The Glassblower's Daughter

Every morning her father lit the furnace before the sun came up, and every morning Ilse watched the orange light climb the workshop wall like a second, smaller dawn.

He made bottles for the apothecary and windows for the church. But once a year, on the night of the first frost, he made something for no one at all.

Chapter 2: Salt and Iron

The fishing boats came back at four, and by five the harbour smelled of diesel and gutted mackerel and the particular cold that lives in wet rope.

Tomas had been coming down to watch them for forty years. His wife said he was waiting for something. He said he was only counting.

Chapter 3: The Last Bus to Kettering

The driver did not take her money. He looked at her once in the mirror, the way you look at a word you are sure you have spelled wrong, and pulled away from the stop.`;

const DOCUMENT = `Marsh End Heritage Trust

Proposal: Restoring the Heron Window

Summary

The Heron Window in St Bride's has stood in the north aisle since 1891. Water damage over the last decade has loosened the lead and cracked four panels. This proposal sets out the work needed, its cost, and a timetable that completes the restoration before the church's 150th anniversary.

Background

The window was made by a local glassblower and shows a heron standing in reeds, the emblem the town has used on its seal ever since. It is the only surviving work of its maker and is listed in the county's record of historic glass.

The work

A specialist conservator will remove the window in sections, clean and re-lead each panel, replace the four cracked pieces with matched glass, and fit protective outer glazing.

Timetable and cost

Removal and survey in May; conservation through the summer; reinstallation in September. The total estimated cost is £18,400, of which the Trust has already raised £11,000.`;

export function demoProjects() {
  const projects = {};

  projects.screenplay = withNotes(
    titled(
      buildProjectFromImport(readFinalDraft(fdx(SCREENPLAY)), { format: 'screenplay', title: 'The Green Light', author: 'A. Writer', fileCast: true, keepLocations: true }).file,
      ['The light returns', 'Teo on the radio', 'Something washed up', 'The Ariadne\'s lantern'],
    ),
    [
      ['The Ariadne', 'Cargo ship lost off the point in 1962. Twelve crew. The inquiry never found the cause.'],
      ['Mara wants', 'To prove her father was right about the light, without becoming him.'],
      ['Setup: the lantern', 'Painted green glass. Pays off when Mara finds the matching pane in the lamp room.'],
    ],
  );

  projects.stage_play = titled(
    buildProjectFromImport(readFinalDraft(fdx(STAGE_PLAY)), { format: 'stage_play', title: 'Ten Past Nine', author: 'A. Writer', fileCast: true }).file,
    ['June waits; Albie closes up'],
  );

  {
    const [first, ...rest] = SERIES;
    let file = buildProjectFromImport(readFinalDraft(first.xml), { format: 'series', title: 'Night Desk', author: 'A. Writer', fileCast: true }).file;
    for (const next of rest) {
      const added = appendImportedEpisode(file, readFinalDraft(next.xml), { title: next.title });
      if (added) file = added.file;
    }
    projects.series = withNotes(titled(file, ['The river story lands', 'Red water at the weir', 'Footprints in the dye works']), [
      ['Season arc', 'Who poisoned the river, and why the paper\'s owner wants it left alone.'],
      ['Ruth', 'Thirty years on the night desk. Has never once taken a day off.'],
    ]);
  }

  projects.novel = withNotes(
    titled(
      buildProjectFromImport(textToProse(NOVEL), { format: 'novel', title: 'The Heron Letter', author: 'A. Writer' }).file,
      ['The letter arrives', 'Marsh End', 'The woman at the door'],
      ['The Letter', 'Marsh End', 'Mrs Fenwick'],
    ),
    [
      ['Marsh End', 'Three streets, a church with no spire, and the Pub.'],
      ['Nell', 'Thirty-four. Archivist. Collects other people\'s letters for a living and has never written one.'],
      ['The heron stamp', 'Appears on the letter, the church window and the town seal.'],
    ],
  );

  projects.instructional = withNotes(
    titled(
      buildProjectFromImport(textToProse(INSTRUCTIONAL), { format: 'instructional', title: 'Plain and Clear', author: 'A. Writer' }).file,
      ['One idea, one sentence', 'What a paragraph does'],
      ['Writing Clear Sentences', 'Building Paragraphs'],
    ),
    [
      ['Constructing sentences with adverbs', 'If you use an adverb, make it fight the verb.'],
      ['Readability studies', 'Average sentence length and reader recall: sources for chapter 1.'],
    ],
  );

  projects.short_story = buildProjectFromImport(
    textToProse(STORIES),
    { format: 'short_story', title: 'Salt and Iron: Stories', author: 'A. Writer', stories: 'many' },
  ).file;

  {
    let file = createProjectFile({ title: 'Harbour Bakery — 30s Spot', format: 'short_form', author: 'A. Writer' });
    const unit = unitsInStoryOrder(file)[0];
    const rows = [
      ['SFX: Gulls. A shop bell.', 'Dawn. A small bakery on the harbour front, lights on, steam on the window.', 4],
      ['BAKER (V.O.): We start before the boats go out.', 'Hands fold dough on a floured board.', 6],
      ['MUSIC: Warm acoustic guitar comes in.', 'Trays slide into a brick oven. Close on crust browning.', 6],
      ['BAKER (V.O.): Same flour, same oven, same harbour since 1958.', 'A fisherman in oilskins takes a paper bag across the counter, nods.', 8],
      ['VO: Harbour Bakery. Open at five, every day.', 'Logo over the shopfront as the sun comes up.', 6],
    ];
    if (unit) {
      let after = beatsForUnit(file, unit.id)[0]?.id;
      rows.forEach(([audio, visual, seconds], index) => {
        // The sheet starts with one empty row: the first line goes in it.
        const made = index === 0 && after ? { file, beatId: after } : addRow(file, { unitId: unit.id, ...(after ? { afterBeatId: after } : {}) });
        file = setRowDialogue(setRowVisual(setRowAudio(made.file, made.beatId, audio), made.beatId, visual), made.beatId, seconds);
        after = made.beatId;
      });
      file = updateUnit(file, unit.id, { title: 'Dawn at the bakery' });
    }
    projects.short_form = file;
  }

  {
    let file = createProjectFile({ title: 'Heron Window Proposal', format: 'document', author: 'A. Writer' });
    const doc = mainDocument(file);
    if (doc) {
      // Headings as a writer would set them: the title, then the sections.
      const HEADINGS = { 'Marsh End Heritage Trust': 1, 'Proposal: Restoring the Heron Window': 2 };
      const SECTIONS = new Set(['Summary', 'Background', 'The work', 'Timetable and cost']);
      const content = (textToDocContent(DOCUMENT).content ?? []).map((node) => {
        const text = (node.content ?? []).map((piece) => piece.text ?? '').join('');
        const level = HEADINGS[text] ?? (SECTIONS.has(text) ? 3 : 0);
        return level ? { ...node, type: 'heading', attrs: { level } } : node;
      });
      file = setDocumentContent(file, doc.id, { type: 'doc', content });
    }
    projects.document = withNotes(file, [
      ['Conservator quote', 'Three quotes received; the lowest is £16,900 plus scaffolding.'],
      ['Window history', 'Made 1891 by the town glassblower. Listed in the county record of historic glass.'],
    ]);
  }

  return projects;
}
