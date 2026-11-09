/**
 * The demo projects the module screenshots are taken from (addendum 35 §7).
 *
 * One small project per module, built with the domain's own importers and
 * mutations so each opens in the program exactly as a writer's would.
 *
 * **The story modules use public-domain classics** (from Ken; addendum 35
 * §10): Night of the Living Dead (screenplay), Sherlock Holmes (series),
 * Great Expectations (novel), Poe's tales (short stories) and Hamlet (stage
 * play). Their texts are in ./classics. The instructional book, the short-form
 * spot and the document are original, written for the purpose.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NIGHT_OF_THE_LIVING_DEAD, SHERLOCK_EPISODES } from './classics/adaptations.mjs';
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
  addItem,
  fileNoteUnder,
  markResearchUsed,
  addSetupPayoff,
  addSetupPoint,
  addNode,
  createOutline,
  beatsForUnit,
  createBoard,
  linkNodes,
  placeSource,
  unitsInStoryOrder,
  updateBeat,
  updateUnit,
  setSceneGrid,
  addUnit,
  addBeat,
} from '@vcwriter/domain';

const classic = (name) => readFileSync(resolve(import.meta.dirname, 'classics', name), 'utf8');

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

const episode = (number, title, lines) => ({ number, title, xml: fdx(lines) });

const HAMLET = JSON.parse(classic('hamlet-act-one-scene-one.json'));
const SERIES = SHERLOCK_EPISODES.map((one, index) => episode(index + 1, one.title, one.lines));

const NOVEL = classic('great-expectations.txt');

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

const STORIES = classic('poe-tales.txt');

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

/** An outline: [kind, title, children] rows, as a writer plans before (and while) writing. */
const withOutline = (file, rows) => {
  const made = createOutline(file, { name: 'Outline' });
  let next = made.file;
  const add = (row, parentId) => {
    const [kind, title, children = []] = row;
    const added = addItem(next, made.outline.id, { parentId, kind, title });
    next = added.file;
    for (const child of children) add(child, added.itemId);
  };
  for (const row of rows) add(row, null);
  return next;
};

/**
 * Notes dropped on a part of the outline (Research's outline column), so the
 * list of what is filed there has something in it.
 */
const fileUnderRow = (file, rowTitle, notes) => {
  let next = file;
  const outline = next.outlines?.[0];
  const row = outline?.items.find((item) => item.title === rowTitle);
  if (!row) return next;
  for (const [title, body] of notes) {
    const folder = next.researchCategories[1] ?? next.researchCategories[0];
    next = addResearchItem(next, { categoryId: folder.id, title, body });
    const note = next.researchItems[next.researchItems.length - 1];
    next = fileNoteUnder(next, note.id, { kind: 'plan', itemId: row.id });
  }
  return next;
};

/**
 * Notes filed to a scene on the track (the scene box and the writing screen
 * list them), one of them already used, so both colours show.
 */
const fileUnderScene = (file, sceneIndex, notes, usedCount = 0) => {
  let next = file;
  const unit = unitsInStoryOrder(next)[sceneIndex];
  if (!unit) return next;
  const beat = beatsForUnit(next, unit.id)[0];
  notes.forEach(([title, body], index) => {
    const folder = next.researchCategories[0];
    next = addResearchItem(next, { categoryId: folder.id, title, body });
    const note = next.researchItems[next.researchItems.length - 1];
    next = fileNoteUnder(next, note.id, { kind: 'section', unitId: unit.id });
    if (index < usedCount && beat) next = markResearchUsed(next, { itemId: note.id, beatId: beat.id });
  });
  return next;
};

/**
 * Where each scene starts and ends, for the Polarity graph and the Story
 * Grid: what is at stake, which way it turns, and the moment it turns. The
 * first scene is left flat on purpose, which is what the graph is for.
 */
const withPolarity = (file) => {
  let next = file;
  const scenes = unitsInStoryOrder(next).filter((unit) => unit.inScript);
  const marks = [
    ['Safety', 'neutral', 'neutral', 'flat', ''],
    ['Safety / danger', 'positive', 'double_negative', 'down', 'The man in the cemetery attacks'],
    ['Danger / refuge', 'negative', 'neutral', 'up', 'Barbra gets inside the farmhouse'],
    ['Helpless / in control', 'negative', 'positive', 'up', 'Ben takes charge and boards up the house'],
    ['Hope / despair', 'positive', 'double_negative', 'down', 'The radio: the dead are walking'],
    ['Despair / hope', 'negative', 'positive', 'up', 'They can be stopped'],
    ['Trust / conflict', 'positive', 'negative', 'down', 'Harry has been hiding in the cellar all along'],
  ];
  scenes.forEach((unit, index) => {
    const mark = marks[index];
    if (!mark) return;
    const [value, polarityStart, polarityEnd, polarity, turn] = mark;
    next = setSceneGrid(next, unit.id, { value, polarityStart, polarityEnd, polarity, turn });
  });
  return next;
};

/**
 * The rest of Act One, planned and not yet written: each scene titled and
 * given its beats, so the track and the Outliner show a play rather than one
 * scene of it. Only the first scene has words, which is the truth about the
 * demo.
 */
const withPlannedScenes = (file, scenes) => {
  let next = file;
  const track = next.tracks[0]?.id;
  if (!track) return next;
  for (const [title, beats] of scenes) {
    const made = addUnit(next, { trackId: track, title });
    next = made.file;
    for (const beat of beats) next = addBeat(next, { unitId: made.unit.id, title: beat }).file;
  }
  return next;
};

/** Hamlet's cast page: who each of them is, and where and when the play is set. */
const withCastPage = (file) => {
  const roles = {
    BARNARDO: ['an officer of the guard', '30s'],
    FRANCISCO: ['a soldier', '20s'],
    HORATIO: ['friend to Hamlet', '20s'],
    MARCELLUS: ['an officer of the guard', '30s'],
  };
  return {
    ...file,
    characters: file.characters.map((one) => {
      const role = roles[one.name.toUpperCase()];
      return role ? { ...one, casting: { ...(one.casting ?? {}), description: role[0], playingAge: role[1] } } : one;
    }),
    settings: { ...file.settings, castPage: { ...(file.settings.castPage ?? {}), time: 'The Middle Ages. Winter.', place: 'Elsinore, the royal castle of Denmark.', notes: 'The play is in five acts.' } },
  };
};

/** Setups and payoffs for the screenplay, placed on its beats. */
const withSetups = (file) => {
  let next = file;
  const beats = unitsInStoryOrder(next).flatMap((unit) => beatsForUnit(next, unit.id));
  const at = (index) => (beats[index] ? { type: 'beat', id: beats[index].id } : null);
  const plant = (title, description, points) => {
    next = addSetupPayoff(next, { title, description });
    const record = next.setupsPayoffs[next.setupsPayoffs.length - 1];
    for (const [index, words, strength] of points) {
      next = addSetupPoint(next, { setupPayoffId: record.id, description: words, location: at(index), strength });
    }
  };
  plant('The cellar', 'Harry is sure the cellar is the safest place in the house.', [
    [3, 'Ben boards up the ground floor and ignores the cellar door', 'written'],
    [6, 'Harry Cooper climbs up from the cellar: "the safest place"', 'written'],
  ]);
  plant('"They\'re coming to get you, Barbra"', 'Johnny\'s joke in the cemetery, said again when it is no longer a joke.', [
    [1, 'Johnny teases Barbra among the graves', 'written'],
  ]);
  return next;
};

/** A story map for the screenplay: two acts, their turning points, the cast and what causes what. */
const withMap = (file) => {
  const made = createBoard(file, { name: 'Night of the Living Dead' });
  let next = made.file;
  const board = made.board.id;
  const node = (input) => {
    const added = addNode(next, board, input);
    next = added.file;
    return added.nodeId;
  };
  const actOne = node({ kind: 'frame', title: 'Act One: The cemetery' });
  const attack = node({ parentId: actOne, kind: 'plot_point', title: 'Johnny is attacked' });
  node({ parentId: attack, kind: 'scene', title: 'The drive out' });
  node({ parentId: attack, kind: 'scene', title: 'At their father\'s grave' });
  const refuge = node({ parentId: actOne, kind: 'plot_point', title: 'Barbra finds the farmhouse' });
  node({ parentId: refuge, kind: 'scene', title: 'Ben boards up the house' });
  const actTwo = node({ kind: 'frame', title: 'Act Two: Under siege' });
  const radio = node({ parentId: actTwo, kind: 'plot_point', title: 'The radio: the dead are walking' });
  node({ parentId: radio, kind: 'scene', title: 'Beat \'em or burn \'em' });
  node({ parentId: actTwo, kind: 'plot_point', title: 'The Coopers come up from the cellar' });
  const cast = node({ kind: 'frame', title: 'Cast' });
  for (const person of next.characters.slice(0, 4)) {
    const placed = placeSource(next, board, { kind: 'character', id: person.id }, cast);
    next = placed.file;
  }
  const theme = node({ kind: 'note', title: 'The danger is inside the house too' });
  if (attack && refuge) next = linkNodes(next, board, attack, refuge, { type: 'causes' }).file;
  if (refuge && radio) next = linkNodes(next, board, refuge, radio, { type: 'causes' }).file;
  if (theme && radio) next = linkNodes(next, board, theme, radio).file;
  return next;
};

export function demoProjects() {
  const projects = {};

  projects.screenplay = withPolarity(fileUnderScene(fileUnderRow(withOutline(withSetups(withMap(withNotes(
    titled(
      buildProjectFromImport(readFinalDraft(fdx(NIGHT_OF_THE_LIVING_DEAD)), {
        format: 'screenplay',
        title: 'Night of the Living Dead',
        author: 'George A. Romero & John A. Russo',
        fileCast: true,
        keepLocations: true,
      }).file,
      [
        'The drive out',
        'They\'re coming to get you, Barbra',
        'Barbra reaches the farmhouse',
        'Ben boards up the house',
        'The radio reports',
        'Beat \'em or burn \'em',
        'The Coopers come up from the cellar',
      ],
    ),
    [
      ['The farmhouse', 'One house, one night. Everything happens inside it or at its windows.'],
      ['Ben', 'Takes charge and boards up the house. Clashes with Harry over upstairs or the cellar.'],
      ['Setup: the cellar', 'Harry insists the cellar is the safest place. Pays off at dawn.'],
    ],
  ))), [
    ['scene', 'Country road, dusk', [['beat', 'Johnny complains about the drive']]],
    ['scene', 'The cemetery', [['beat', '"They\'re coming to get you, Barbra."'], ['beat', 'The man among the graves attacks']]],
    ['scene', 'The farmhouse', [['beat', 'Barbra hides inside'], ['beat', 'Ben arrives in the truck']]],
    ['scene', 'Boarding up', [['beat', 'Ben tears up the table for the windows']]],
    ['scene', 'The radio and the television', [['beat', 'Killings across the eastern states'], ['beat', 'The sheriff: "Beat \'em or burn \'em"']]],
    ['note', 'Act Two: the house under siege'],
    ['scene', 'The cellar door', [['beat', 'Harry Cooper and the others come up'], ['beat', 'Upstairs or the cellar?']]],
  ]), 'The cemetery', [
    ['Johnny has the car keys', 'They are in his pocket when he falls. Barbra cannot drive away.'],
    ['The man among the graves', 'Slow, but he never stops coming. Keep him in the back of the frame first.'],
  ]), 3, [
    ['The radio on the mantel', 'Ben finds it while boarding up. It is how the house learns what is happening outside.'],
    ['The table legs', 'Ben breaks up the dining table for boards. Keep one leg in reach: it becomes a club later.'],
    ['Barbra in shock', 'She barely speaks once she is inside. Let her silence carry the scene.'],
  ], 1));

  projects.stage_play = withCastPage(withOutline(withPlannedScenes(withNotes(
    titled(
      buildProjectFromImport(readFinalDraft(fdx(HAMLET)), { format: 'stage_play', title: 'Hamlet', author: 'William Shakespeare', fileCast: true }).file,
      ['The Ghost on the battlements'],
    ),
    [
      ['Elsinore', 'A platform before the castle, at midnight. Bitter cold.'],
      ['The Ghost', 'Appears in the armour of the dead King. Will not speak to Horatio.'],
    ],
  ), [
    ['A room of state in the castle', ['The new King speaks of his brother\'s death', 'Hamlet in black, alone', 'Horatio tells Hamlet of the Ghost']],
    ['Polonius\' house', ['Laertes warns Ophelia', 'Polonius\'s precepts']],
    ['The platform', ['The Ghost beckons Hamlet away']],
    ['Another part of the platform', ['The Ghost tells of the murder', 'Swear on my sword']],
  ]), [
    ['note', 'Act One'],
    ['scene', 'The battlements, midnight', [['beat', 'Who\'s there?'], ['beat', 'The Ghost appears, and will not speak']]],
    ['scene', 'A room of state', [['beat', 'Claudius and Gertrude'], ['beat', 'O, that this too too solid flesh would melt']]],
    ['scene', 'Polonius\' house', [['beat', 'Laertes and Ophelia'], ['beat', 'To thine own self be true']]],
    ['scene', 'The platform', [['beat', 'The Ghost beckons']]],
    ['scene', 'Another part of the platform', [['beat', 'Murder most foul'], ['beat', 'Swear']]],
    ['note', 'Act Two'],
    ['scene', 'Polonius sends Reynaldo'],
  ]));

  {
    const [first, ...rest] = SERIES;
    let file = buildProjectFromImport(readFinalDraft(first.xml), { format: 'series', title: 'Sherlock Holmes', author: 'after Arthur Conan Doyle', fileCast: true }).file;
    for (const next of rest) {
      const added = appendImportedEpisode(file, readFinalDraft(next.xml), { title: next.title });
      if (added) file = added.file;
    }
    projects.series = withOutline(withNotes(titled(file, ['Seen but not observed', 'Jabez Wilson, read at a glance', 'A three pipe problem', 'Helen Stoner\'s terror', 'The speckled band']), [
      ['Holmes', 'Sees and observes. Smokes over a problem and will not be spoken to.'],
      ['Watson', 'Friend and chronicler. Sees, but does not observe.'],
    ]), [
      ['note', 'Episode 1: A Scandal in Bohemia'],
      ['scene', 'Baker Street, night', [['beat', 'Seventeen steps'], ['beat', 'A royal visitor on the stair']]],
      ['note', 'Episode 2: The Red-Headed League'],
      ['scene', 'Baker Street, day', [['beat', 'Jabez Wilson, read at a glance'], ['beat', 'A three pipe problem']]],
      ['note', 'Episode 3: The Speckled Band'],
      ['scene', 'Baker Street, early morning', [['beat', '"It is fear, Mr. Holmes."']]],
      ['scene', 'Stoke Moran, night', [['beat', 'The low, clear whistle'], ['beat', 'The band! the speckled band!']]],
    ]);
  }

  projects.novel = withOutline(withNotes(
    titled(
      buildProjectFromImport(textToProse(NOVEL), { format: 'novel', title: 'Great Expectations', author: 'Charles Dickens' }).file,
      ['Pip meets the convict in the churchyard', 'The file and the pork pie', 'The second convict in the mist'],
      ['Pip meets the convict', 'Christmas Eve at the forge', 'The convict in the mist'],
    ),
    [
      ['The marshes', 'Ours was the marsh country, down by the river, within, as the river wound, twenty miles of the sea.'],
      ['Pip', 'Philip Pirrip, an orphan, brought up by hand by his sister, Mrs. Joe Gargery.'],
      ['Setup: the file and the wittles', 'What the convict demands of Pip in the churchyard. Pays off at the forge on Christmas Day.'],
    ],
   ), [
    ['chapter', 'Pip meets the convict', [
      ['scene', 'The churchyard at dusk', [['beat', 'Pip reads his parents\' names on the stones'], ['beat', 'The convict seizes him']]],
      ['scene', 'File and wittles', [['beat', 'The convict\'s demand, and the young man who will tear out his heart']]],
    ]],
    ['chapter', 'Christmas Eve at the forge', [
      ['scene', 'Mrs. Joe and the Tickler', [['beat', 'Brought up by hand']]],
      ['scene', 'Stealing the pie', [['beat', 'The guns from the hulks'], ['beat', 'The file from Joe\'s bench']]],
    ]],
    ['chapter', 'The convict in the mist', [
      ['scene', 'Out on the marshes before dawn', [['beat', 'The second convict, and the bruised face']]],
      ['scene', 'The pie, eaten like a dog'],
    ]],
  ]);

  projects.instructional = withOutline(withNotes(
    titled(
      buildProjectFromImport(textToProse(INSTRUCTIONAL), { format: 'instructional', title: 'Plain and Clear', author: 'A. Writer' }).file,
      ['One idea, one sentence', 'What a paragraph does'],
      ['Writing Clear Sentences', 'Building Paragraphs'],
    ),
    [
      ['Constructing sentences with adverbs', 'If you use an adverb, make it fight the verb.'],
      ['Readability studies', 'Average sentence length and reader recall: sources for chapter 1.'],
    ],
  ), [
    ['chapter', 'Writing Clear Sentences', [
      ['scene', 'One idea per sentence', [['beat', 'Why two ideas tire the reader'], ['beat', 'Splitting a long sentence']]],
      ['scene', 'Put the action in the verb', [['beat', 'Nouns that hide verbs']]],
      ['scene', 'Adverbs and the verbs they prop up', [['beat', 'Choosing the stronger verb']]],
    ]],
    ['chapter', 'Building Paragraphs', [
      ['scene', 'The paragraph as a unit of thought', [['beat', 'Claim, support, hand-off']]],
      ['scene', 'Transitions that carry the reader'],
    ]],
    ['chapter', 'Revising for Clarity', [['scene', 'Reading aloud'], ['scene', 'Cutting by a third']]],
  ]);

  projects.short_story = withOutline(withNotes(
    buildProjectFromImport(textToProse(STORIES), { format: 'short_story', title: 'Tales of Mystery', author: 'Edgar Allan Poe', stories: 'many' }).file,
    [
      ['The narrator', 'Insists he is not mad. The more calmly he says it, the less we believe him.'],
      ['Montresor', 'Never says what Fortunato\'s insult was.'],
    ],
  ), [
    ['chapter', 'The Tell-Tale Heart', [
      ['scene', 'Not mad', [['beat', 'The eye of a vulture']]],
      ['scene', 'Eight nights at the door', [['beat', 'The lantern, the single ray']]],
      ['scene', 'Beneath the floorboards', [['beat', 'The officers sit and chat'], ['beat', 'The beating of the hideous heart']]],
    ]],
    ['chapter', 'The Cask of Amontillado', [
      ['scene', 'A thousand injuries', [['beat', 'Carnival, and Fortunato in motley']]],
      ['scene', 'Into the vaults', [['beat', 'The nitre, and the cough'], ['beat', 'The last tier of stone']]],
    ]],
    ['chapter', 'The Masque of the Red Death', [['scene', 'The abbey sealed'], ['scene', 'Seven rooms'], ['scene', 'The masked figure']]],
  ]);

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
