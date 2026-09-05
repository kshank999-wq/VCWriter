import { beatsForUnit, unitsInStoryOrder, unresolvedSetupsPayoffs, unusedResearch } from './selectors.js';
import { paginateElements, layoutFor } from './pagination.js';
import { countWords } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

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
  /** Filled by the AI pass when one has run; null otherwise, and shown as unknown. */
  aiVerdict: SceneVerdict | null;
}

/** What an AI structural pass returns for a scene. Never invented locally. */
export interface SceneVerdict {
  /** What is true when the scene opens. */
  opening: string;
  /** What has changed by the end. */
  change: string;
  /** Where the scene turns, if it does. */
  turn: string | null;
  /** Whether the scene's value moves, and in which direction. */
  valueShift: 'positive' | 'negative' | 'mixed' | 'none';
  purpose: string;
  concerns: string[];
  model: string;
}

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
  | 'no_turn';

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
  const layout = layoutFor(file.project.format);

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
      aiVerdict: null,
    };
  });
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
  totals: {
    scenes: number;
    pages: number;
    words: number;
    /** Scenes an AI pass has read, out of the total. */
    reviewed: number;
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

  const scenes = reviewScenes(file).map((scene) =>
    options.verdicts?.[scene.unitId] ? { ...scene, aiVerdict: options.verdicts[scene.unitId] ?? null } : scene,
  );

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

  return {
    scenes,
    findings,
    totals: {
      scenes: scenes.length,
      pages: scenes.reduce((total, scene) => total + scene.pages, 0),
      words: scenes.reduce((total, scene) => total + scene.words, 0),
      reviewed: scenes.filter((scene) => scene.aiVerdict !== null).length,
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
