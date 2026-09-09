import { beatsForUnit, unitsInStoryOrder, unresolvedSetupsPayoffs, unusedResearch } from './selectors.js';
import { placedMarkers } from './markers.js';
import { sceneGridSchema } from './entities/structure.js';
import { paginateElements, layoutForFile } from './pagination.js';
import { countWords } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { CharacterId, StructuralUnitId } from './ids.js';
import type { SceneGrid, SceneRead } from './entities/structure.js';

/**
 * The Final Editor (spec §8.2).
 *
 * The structural pass a writer runs before submitting: is every scene doing
 * work, does anything repeat, is anything set up and never paid off, does a
 * character vanish for forty pages.
 *
 * What is here is what can be known from the manuscript itself — length,
 * shape, cast movement, obligations outstanding. It deliberately does not
 * pretend to judge whether a scene *turns*: that reading is what the AI pass
 * adds when it is configured, and inventing it from word counts would be worse
 * than admitting the gap. `SceneReview` is built so an AI verdict slots into
 * the same row the deterministic numbers already occupy.
 *
 * §8.2 is explicit that findings are presented as an interactive review and
 * nothing is silently rewritten. Nothing in this file mutates a project.
 */

export interface SceneReview {
  unitId: StructuralUnitId;
  label: string;
  /** Position in reading order, 1-based. */
  position: number;
  pages: number;
  words: number;
  beatCount: number;
  writtenBeatCount: number;
  /** Characters with a cue in this scene, in order of first appearance. */
  speakers: string[];
  dialogueLines: number;
  actionLines: number;
  /** Location taken from the scene heading, upper-cased. */
  location: string | null;
  /**
   * The AI pass's reading when one has been made; null otherwise, and shown
   * as unknown. A read the document is keeping carries the moment it was
   * made; one that has just come back and not been saved carries none.
   */
  aiVerdict: SceneRead | null;
  /** The writer's own reading, from the document. */
  grid: SceneGrid;
}

/**
 * What an AI structural pass returns for a scene. Never invented locally.
 *
 * The same shape the document keeps on the scene (`SceneRead`), minus the
 * timestamp the document adds when it stores one: what comes back over the
 * wire is the reading, not the record of it.
 */
export type SceneVerdict = Omit<SceneRead, 'readAt'>;

/**
 * A read turned into the grid patch the writer can accept (spec §8.2).
 *
 * Only the three questions the read actually answers: which way it moves,
 * where it turns, what it is for. What is at stake and what is being fought
 * over stay the writer's own — the read is not asked for them, and a patch
 * that overwrote them with silence would lose work.
 *
 * "None" becomes "flat", which is a claim, so accepting it is a deliberate
 * act: the button says take this reading as mine, and this is what that means.
 */
export const gridFromRead = (read: SceneVerdict): Partial<SceneGrid> => ({
  polarity:
    read.valueShift === 'positive'
      ? 'up'
      : read.valueShift === 'negative'
        ? 'down'
        : read.valueShift === 'mixed'
          ? 'mixed'
          : 'flat',
  turn: read.turn ?? '',
  purpose: read.purpose,
});

export type StoryFindingKind =
  | 'empty_scene'
  | 'outline_only'
  | 'very_short_scene'
  | 'very_long_scene'
  | 'repeated_location'
  | 'no_dialogue'
  | 'single_appearance_character'
  | 'character_absent'
  | 'unresolved_setup'
  | 'unused_research'
  | 'no_turn'
  // What the writer's own grid says (§8.2)
  | 'flat_scene'
  | 'one_note_run'
  | 'grid_unanswered'
  // Threads and arcs
  | 'thread_dropped'
  | 'thread_single_scene'
  | 'arc_gap'
  // The shape of the whole
  | 'act_out_of_proportion'
  | 'no_acts'
  | 'repetitive_scene';

export interface StoryFinding {
  id: string;
  kind: StoryFindingKind;
  severity: 'blocking' | 'question';
  message: string;
  unitId: StructuralUnitId | null;
  /** What the writer should look at, in their words. */
  detail: string;
}

const headingLocation = (text: string): string | null => {
  // "INT. LIGHTHOUSE - NIGHT" -> "LIGHTHOUSE"
  const withoutPrefix = text.replace(/^\s*(int\.?|ext\.?|int\/ext\.?|i\/e\.?)\s*/i, '');
  const location = withoutPrefix.split(/\s+[-–—]\s+/)[0];
  return location ? location.trim().toUpperCase() || null : null;
};

/** Per-scene numbers, computed from the manuscript at the real page geometry. */
export const reviewScenes = (file: ProjectFile): SceneReview[] => {
  const layout = layoutForFile(file);

  return unitsInStoryOrder(file).map((unit, index) => {
    const beats = beatsForUnit(file, unit.id);
    const elements = beats.flatMap((beat) => beat.manuscript.elements);
    const pages = paginateElements(elements, layout).length;

    const speakers: string[] = [];
    let dialogueLines = 0;
    let actionLines = 0;
    let location: string | null = null;

    for (const element of elements) {
      if (element.type === 'character') {
        const name = element.text.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
        if (name.length > 0 && !speakers.includes(name)) speakers.push(name);
      }
      if (element.type === 'dialogue') dialogueLines += 1;
      if (element.type === 'action' || element.type === 'paragraph') actionLines += 1;
      if (element.type === 'scene_heading' && location === null) location = headingLocation(element.text);
    }

    return {
      unitId: unit.id,
      label: `${unit.sequenceLabel || unit.kind} ${unit.title || 'Untitled'}`.trim(),
      position: index + 1,
      pages,
      words: beats.reduce((total, beat) => total + countWords(beat.manuscript), 0),
      beatCount: beats.length,
      writtenBeatCount: beats.filter((beat) => beat.status === 'written' || beat.status === 'revised').length,
      speakers,
      dialogueLines,
      actionLines,
      location,
      // The read the document is keeping, if one has ever been asked for.
      // `options.verdicts` overrides it for a read that has just come back
      // and not yet been saved.
      aiVerdict: unit.aiRead ?? null,
      // A document written before the grid existed has none. This is a
      // read-only pass over someone's manuscript; it must never be the thing
      // that takes the editor down.
      grid: sceneGridSchema.parse(unit.grid ?? {}),
    };
  });
};


// ---------------------------------------------------------------------------
// Arcs and threads: who is in the story, and what it is made of (§8.2)
// ---------------------------------------------------------------------------

export interface Appearance {
  unitId: StructuralUnitId;
  position: number;
  label: string;
  /** Speaks in it, as against merely being named in the action. */
  speaks: boolean;
}

export interface CharacterArc {
  characterId: CharacterId | null;
  name: string;
  appearances: Appearance[];
  first: number | null;
  last: number | null;
  /** The longest run of scenes between two appearances. */
  longestGap: number;
  /** Where that gap starts, so the writer can look at it. */
  gapAfter: number | null;
}

/**
 * Where each character is across the story.
 *
 * Not a judgement — a map. A character who leaves for forty pages may be
 * doing it on purpose, and the only useful thing to do is show the shape and
 * let the writer look at it.
 */
export const characterArcs = (file: ProjectFile): CharacterArc[] => {
  const scenes = reviewScenes(file);
  const byName = new Map<string, CharacterArc>();

  const seen = (name: string): CharacterArc => {
    const existing = byName.get(name);
    if (existing) return existing;
    const character = file.characters.find((candidate) => candidate.name.trim().toUpperCase() === name);
    const arc: CharacterArc = {
      characterId: character?.id ?? null,
      name,
      appearances: [],
      first: null,
      last: null,
      longestGap: 0,
      gapAfter: null,
    };
    byName.set(name, arc);
    return arc;
  };

  for (const scene of scenes) {
    for (const speaker of scene.speakers) {
      const arc = seen(speaker);
      arc.appearances.push({ unitId: scene.unitId, position: scene.position, label: scene.label, speaks: true });
    }
  }

  for (const arc of byName.values()) {
    if (arc.appearances.length === 0) continue;
    arc.first = arc.appearances[0]?.position ?? null;
    arc.last = arc.appearances[arc.appearances.length - 1]?.position ?? null;
    for (let index = 1; index < arc.appearances.length; index += 1) {
      const gap = (arc.appearances[index]?.position ?? 0) - (arc.appearances[index - 1]?.position ?? 0) - 1;
      if (gap > arc.longestGap) {
        arc.longestGap = gap;
        arc.gapAfter = arc.appearances[index - 1]?.position ?? null;
      }
    }
  }

  // The busiest first: the order a cast list is read in.
  return [...byName.values()].sort((a, b) => b.appearances.length - a.appearances.length);
};

export interface ThreadRun {
  laneId: string;
  name: string;
  scenes: number[];
  first: number | null;
  last: number | null;
}

/** Where each plot thread runs, in scene positions. */
export const threadRuns = (file: ProjectFile): ThreadRun[] => {
  const scenes = reviewScenes(file);
  const positions = new Map(scenes.map((scene) => [scene.unitId as string, scene.position]));

  return file.lanes.map((lane) => {
    const here = file.units
      .filter((unit) => unit.laneId === lane.id && unit.inScript)
      .map((unit) => positions.get(unit.id as string) ?? 0)
      .filter((position) => position > 0)
      .sort((a, b) => a - b);
    return {
      laneId: lane.id as string,
      name: lane.name,
      scenes: here,
      first: here[0] ?? null,
      last: here[here.length - 1] ?? null,
    };
  });
};

export interface ActShape {
  label: string;
  /** Scene position it starts at. */
  from: number;
  to: number;
  pages: number;
  /** Share of the whole, 0–1. */
  share: number;
}

/**
 * Where the act breaks actually fall, as a share of the finished pages.
 *
 * The most useful structural number a screenwriter looks at, and one nobody
 * can read off a page count by eye. Markers already say where the acts are
 * (addendum 02 §12); this measures what they enclose.
 */
export const actShape = (file: ProjectFile): ActShape[] => {
  const scenes = reviewScenes(file);
  if (scenes.length === 0) return [];
  const total = scenes.reduce((sum, scene) => sum + scene.pages, 0);
  if (total === 0) return [];

  const placed = placedMarkers(file).filter((marker) => marker.marker.kind === 'act');
  if (placed.length === 0) return [];

  const startAt = new Map(placed.map((marker) => [marker.marker.unitId as string, marker.label]));
  const acts: ActShape[] = [];
  let current: { label: string; from: number; pages: number } | null = null;

  for (const scene of scenes) {
    const opens = startAt.get(scene.unitId as string);
    if (opens !== undefined) {
      if (current) acts.push({ ...current, to: scene.position - 1, share: current.pages / total });
      current = { label: opens, from: scene.position, pages: 0 };
    }
    if (current) current.pages += scene.pages;
  }
  if (current) {
    acts.push({ ...current, to: scenes[scenes.length - 1]?.position ?? current.from, share: current.pages / total });
  }
  return acts;
};

export interface FinalEditorOptions {
  /** Scenes shorter than this many pages are queried. Eighths of a page. */
  shortScenePages?: number;
  longScenePages?: number;
  /** How many scenes a character may be absent for before it is worth a look. */
  absenceThreshold?: number;
  /** Verdicts from an AI pass, keyed by unit id, merged into the review. */
  verdicts?: Record<string, SceneVerdict>;
}

export interface FinalEditorReport {
  scenes: SceneReview[];
  findings: StoryFinding[];
  /** Where each character is across the story (§8.2). */
  arcs: CharacterArc[];
  /** Where each plot thread runs. */
  threads: ThreadRun[];
  /** What the acts enclose, as a share of the pages. */
  acts: ActShape[];
  totals: {
    scenes: number;
    pages: number;
    words: number;
    /** Scenes an AI pass has read, out of the total. */
    reviewed: number;
    /** Scenes the writer has answered the grid for. */
    gridded: number;
  };
}

/**
 * The full structural review. Every finding names the scene it is about and
 * says what to look at — a report the writer can work through, not a score.
 */
export const runFinalEditor = (file: ProjectFile, options: FinalEditorOptions = {}): FinalEditorReport => {
  const shortScenePages = options.shortScenePages ?? 0.25;
  const longScenePages = options.longScenePages ?? 6;
  const absenceThreshold = options.absenceThreshold ?? 12;

  const scenes = reviewScenes(file).map((scene) => {
    const override = options.verdicts?.[scene.unitId];
    // A read handed in has not been saved, so it has no moment yet.
    return override ? { ...scene, aiVerdict: { readAt: '', ...override } } : scene;
  });

  const findings: StoryFinding[] = [];
  let sequence = 0;
  const add = (finding: Omit<StoryFinding, 'id'>): void => {
    sequence += 1;
    findings.push({ ...finding, id: `story-${sequence}` });
  };

  for (const scene of scenes) {
    if (scene.beatCount === 0 || scene.words === 0) {
      add({
        kind: 'empty_scene',
        severity: 'blocking',
        message: `${scene.label} has nothing written in it.`,
        unitId: scene.unitId,
        detail: 'An empty scene in a finished draft is either a gap or a scene that should go.',
      });
      continue;
    }

    if (scene.writtenBeatCount === 0) {
      add({
        kind: 'outline_only',
        severity: 'question',
        message: `${scene.label} is still marked as outline.`,
        unitId: scene.unitId,
        detail: 'No beat in this scene is marked written or revised.',
      });
    }

    if (scene.pages > longScenePages) {
      add({
        kind: 'very_long_scene',
        severity: 'question',
        message: `${scene.label} runs ${scene.pages} pages.`,
        unitId: scene.unitId,
        detail: 'Long scenes usually carry more than one turn. Check whether it wants to be two.',
      });
    }

    if (scene.pages > 0 && scene.pages < shortScenePages) {
      add({
        kind: 'very_short_scene',
        severity: 'question',
        message: `${scene.label} is under a quarter page.`,
        unitId: scene.unitId,
        detail: 'Very short scenes earn their place or belong inside a neighbour.',
      });
    }

    if (scene.dialogueLines === 0 && scene.speakers.length > 0) {
      add({
        kind: 'no_dialogue',
        severity: 'question',
        message: `${scene.label} has character cues but no dialogue.`,
        unitId: scene.unitId,
        detail: 'A cue with nothing under it is usually an unfinished speech.',
      });
    }

    // The AI pass, when it has run, is where "does it turn" comes from.
    if (scene.aiVerdict && scene.aiVerdict.valueShift === 'none') {
      add({
        kind: 'no_turn',
        severity: 'question',
        message: `${scene.label} does not appear to turn.`,
        unitId: scene.unitId,
        detail: scene.aiVerdict.purpose || 'Nothing changes between the start and the end of the scene.',
      });
    }
  }

  // Consecutive scenes in the same place read as one scene interrupted.
  for (let index = 1; index < scenes.length; index += 1) {
    const previous = scenes[index - 1];
    const current = scenes[index];
    if (!previous || !current || !current.location) continue;
    if (previous.location === current.location) {
      add({
        kind: 'repeated_location',
        severity: 'question',
        message: `${current.label} is in the same location as the scene before it.`,
        unitId: current.unitId,
        detail: `Both are ${current.location}. Two scenes in one place often want to be one scene.`,
      });
    }
  }

  // Cast movement: who shows up once, and who disappears.
  const appearances = new Map<string, number[]>();
  for (const scene of scenes) {
    for (const speaker of scene.speakers) {
      appearances.set(speaker, [...(appearances.get(speaker) ?? []), scene.position]);
    }
  }

  for (const [name, positions] of appearances) {
    if (positions.length === 1 && scenes.length > 3) {
      add({
        kind: 'single_appearance_character',
        severity: 'question',
        message: `${name} speaks in one scene only.`,
        unitId: scenes.find((scene) => scene.position === positions[0])?.unitId ?? null,
        detail: 'A character with one scene either earns it or belongs to someone already in the story.',
      });
      continue;
    }

    for (let index = 1; index < positions.length; index += 1) {
      const gap = (positions[index] ?? 0) - (positions[index - 1] ?? 0);
      if (gap >= absenceThreshold) {
        add({
          kind: 'character_absent',
          severity: 'question',
          message: `${name} is absent for ${gap - 1} scenes.`,
          unitId: scenes.find((scene) => scene.position === positions[index])?.unitId ?? null,
          detail: `Between scene ${positions[index - 1]} and scene ${positions[index]}. Long absences need to be felt as absence.`,
        });
        break;
      }
    }
  }

  // Obligations the story still owes the reader (§7.3).
  for (const record of unresolvedSetupsPayoffs(file)) {
    add({
      kind: 'unresolved_setup',
      severity: record.setups.length > 0 ? 'blocking' : 'question',
      message: `"${record.title}" is set up but not paid off.`,
      unitId: null,
      detail:
        record.setups.length > 0
          ? `${record.setups.length} ${record.setups.length === 1 ? 'setup is' : 'setups are'} in the script with no payoff recorded.`
          : 'No setup written yet either — decide whether the story still wants this.',
    });
  }

  const unused = unusedResearch(file);
  if (unused.length > 0) {
    add({
      kind: 'unused_research',
      severity: 'question',
      message: `${unused.length} research ${unused.length === 1 ? 'note has' : 'notes have'} not been used.`,
      unitId: null,
      detail: unused
        .slice(0, 5)
        .map((item) => item.title)
        .join(' · '),
    });
  }


  // ---------------------------------------------------------- the grid
  const answered = scenes.filter((scene) => scene.grid.polarity !== '');

  for (const scene of scenes) {
    if (scene.grid.polarity === 'flat') {
      add({
        kind: 'flat_scene',
        severity: 'blocking',
        message: `${scene.label} does not move.`,
        unitId: scene.unitId,
        detail:
          scene.grid.value.length > 0
            ? `You marked "${scene.grid.value}" as ending where it started. A scene that changes nothing is a scene the reader can skip.`
            : 'You marked it as ending where it started. A scene that changes nothing is a scene the reader can skip.',
      });
    }
  }

  // Three scenes running the same way is a story with one gear. Only raised
  // where the writer has actually answered — an unanswered grid says nothing.
  let run: { polarity: string; scenes: SceneReview[] } = { polarity: '', scenes: [] };
  const flushRun = () => {
    if (run.scenes.length >= 3 && (run.polarity === 'up' || run.polarity === 'down')) {
      const first = run.scenes[0] as SceneReview;
      add({
        kind: 'one_note_run',
        severity: 'question',
        message: `${run.scenes.length} scenes running from ${first.label} all move the same way.`,
        unitId: first.unitId,
        detail: `Every one of them goes ${run.polarity}. A run this long with no relief reads as one long scene.`,
      });
    }
    run = { polarity: '', scenes: [] };
  };
  for (const scene of scenes) {
    if (scene.grid.polarity !== run.polarity) flushRun();
    run.polarity = scene.grid.polarity;
    run.scenes.push(scene);
  }
  flushRun();

  if (scenes.length >= 4 && answered.length === 0) {
    add({
      kind: 'grid_unanswered',
      severity: 'question',
      message: 'No scene has been read structurally yet.',
      unitId: null,
      detail:
        'The grid asks what is at stake in each scene and which way it moves. Nothing here can tell you whether a scene turns until you say — or the structural read does.',
    });
  }

  // --------------------------------------------------- threads and arcs
  const threads = threadRuns(file);
  const lastScene = scenes.length;
  for (const thread of threads) {
    if (thread.scenes.length === 0) continue;
    if (thread.scenes.length === 1) {
      add({
        kind: 'thread_single_scene',
        severity: 'question',
        message: `${thread.name} happens once, at scene ${thread.first}.`,
        unitId: null,
        detail: 'A thread with one scene is an idea rather than a thread. Either it needs more, or it belongs to another plot.',
      });
      continue;
    }
    // A thread that stops in the first two-thirds and never comes back.
    if (thread.last !== null && lastScene > 5 && thread.last < lastScene * 0.67) {
      add({
        kind: 'thread_dropped',
        severity: 'question',
        message: `${thread.name} stops at scene ${thread.last} of ${lastScene}.`,
        unitId: null,
        detail: 'It is not seen again. A thread that ends before the story does needs to have been resolved, or it will be missed.',
      });
    }
  }

  const arcs = characterArcs(file);
  for (const arc of arcs) {
    // Already covered by `character_absent` where that fires; this is the
    // arc's own shape, and it names where to look.
    if (arc.appearances.length >= 3 && arc.longestGap >= absenceThreshold) {
      add({
        kind: 'arc_gap',
        severity: 'question',
        message: `${arc.name} is gone for ${arc.longestGap} scenes after scene ${arc.gapAfter}.`,
        unitId: null,
        detail: `They speak in ${arc.appearances.length} scenes, from ${arc.first} to ${arc.last}. A gap this long needs a reason the reader can feel.`,
      });
    }
  }

  // ------------------------------------------------- the shape of the whole
  const acts = actShape(file);
  if (acts.length === 0 && scenes.length >= 8) {
    add({
      kind: 'no_acts',
      severity: 'question',
      message: 'No act markers in a script of this length.',
      unitId: null,
      detail: 'Where the acts break is the first thing a reader feels and the last thing that can be fixed cheaply.',
    });
  }
  for (const act of acts) {
    // A three-act shape is roughly a quarter, a half, a quarter. This is a
    // convention, not a law, so it asks rather than blocks — but an act that
    // is a tenth of the script, or over half of it, is worth looking at.
    if (acts.length >= 3 && (act.share < 0.12 || act.share > 0.55)) {
      add({
        kind: 'act_out_of_proportion',
        severity: 'question',
        message: `${act.label} is ${Math.round(act.share * 100)}% of the pages.`,
        unitId: null,
        detail:
          `${act.from === act.to ? `Scene ${act.from}` : `Scenes ${act.from}–${act.to}`}, ` +
          `${act.pages} ${act.pages === 1 ? 'page' : 'pages'}. ` +
          'A three-act shape usually runs about a quarter, a half, a quarter.',
      });
    }
  }

  // ------------------------------------------------------ repetitive scenes
  for (let index = 1; index < scenes.length; index += 1) {
    const here = scenes[index] as SceneReview;
    const before = scenes[index - 1] as SceneReview;
    const sameCast =
      here.speakers.length > 0 &&
      here.speakers.length === before.speakers.length &&
      here.speakers.every((name) => before.speakers.includes(name));
    if (sameCast && here.location !== null && here.location === before.location) {
      add({
        kind: 'repetitive_scene',
        severity: 'question',
        message: `${here.label} is the same people in the same place as the scene before it.`,
        unitId: here.unitId,
        detail: 'Two scenes running with the same cast in the same location are usually one scene, or want something between them.',
      });
    }
  }

  return {
    scenes,
    findings,
    arcs,
    threads,
    acts,
    totals: {
      scenes: scenes.length,
      pages: scenes.reduce((total, scene) => total + scene.pages, 0),
      words: scenes.reduce((total, scene) => total + scene.words, 0),
      reviewed: scenes.filter((scene) => scene.aiVerdict !== null).length,
      gridded: answered.length,
    },
  };
};

/**
 * The scene text an AI structural pass needs, and nothing else — no research,
 * no notes, no other scenes. Kept here so what leaves the machine is defined
 * in one visible place (§14: manuscript content is not logged or sent
 * unnecessarily).
 */
export const sceneTextForReview = (file: ProjectFile, unitId: StructuralUnitId): string => {
  const beats = beatsForUnit(file, unitId);
  return beats
    .flatMap((beat) => beat.manuscript.elements)
    .filter((element) => element.text.trim().length > 0)
    .map((element) => `${element.type.replace(/_/g, ' ').toUpperCase()}: ${element.text}`)
    .join('\n');
};
