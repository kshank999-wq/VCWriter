import { beatsForUnit, beatsInStoryOrder, findUnit, unitsInStoryOrder } from './selectors.js';
import type { ManuscriptElement, ManuscriptSegment } from './entities/manuscript.js';
import type { VoiceAssignment } from './entities/project.js';
import type { Beat } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { CharacterId, StructuralUnitId } from './ids.js';

/**
 * Rendering the manuscript out of the platform-neutral element list.
 *
 * The one rule that must never be violated (spec §5.3, §6, §19): a beat's
 * internal title is authoring metadata. It is only emitted when the caller
 * explicitly opts in, which is what `includeBeatTitles` is for — a reference
 * printout, never the delivered manuscript.
 */

export interface RenderOptions {
  /** Defaults to false. Setting it true produces an annotated reference copy. */
  includeBeatTitles?: boolean;
  /** Column layout for screenplay elements; disable for prose formats. */
  screenplayLayout?: boolean;
}

const INDENT: Record<string, number> = {
  scene_heading: 0,
  action: 0,
  shot: 0,
  general: 0,
  transition: 45,
  character: 22,
  parenthetical: 16,
  dialogue: 10,
};

const UPPERCASE_TYPES = new Set(['scene_heading', 'character', 'transition', 'shot']);

const renderElement = (element: ManuscriptElement, screenplayLayout: boolean): string => {
  const text = UPPERCASE_TYPES.has(element.type) ? element.text.toUpperCase() : element.text;
  if (!screenplayLayout) return text;
  const indent = ' '.repeat(INDENT[element.type] ?? 0);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? indent + line : line))
    .join('\n');
};

export const renderManuscript = (segment: ManuscriptSegment, options: RenderOptions = {}): string =>
  segment.elements
    .map((element) => renderElement(element, options.screenplayLayout ?? true))
    .join('\n\n');

export const renderBeat = (beat: Beat, options: RenderOptions = {}): string => {
  const body = renderManuscript(beat.manuscript, options);
  if (!options.includeBeatTitles || beat.title.length === 0) return body;
  return `[${beat.title}]\n\n${body}`;
};

export const renderUnit = (file: ProjectFile, unitId: StructuralUnitId, options: RenderOptions = {}): string => {
  const unit = findUnit(file, unitId);
  if (!unit) return '';
  const heading = unit.title.length > 0 ? `${unit.sequenceLabel} ${unit.title}`.trim() : unit.sequenceLabel;
  const body = beatsForUnit(file, unitId)
    .map((beat) => renderBeat(beat, options))
    .filter((text) => text.length > 0)
    .join('\n\n');
  return heading.length > 0 ? `${heading}\n\n${body}` : body;
};

export const renderProject = (file: ProjectFile, options: RenderOptions = {}): string => {
  const screenplayLayout = options.screenplayLayout ?? file.project.format !== 'novel';
  return unitsInStoryOrder(file)
    .map((unit) => renderUnit(file, unit.id, { ...options, screenplayLayout }))
    .filter((text) => text.length > 0)
    .join('\n\n\n');
};

/**
 * Read-back segments for text-to-speech (§10).
 *
 * Dialogue carries the speaking character's persistent voice; everything else
 * is narration and uses the project narrator voice. The provider is resolved by
 * the TTS adapter, not here, so the vendor can change without touching data.
 */
export interface SpeechSegment {
  kind: 'narration' | 'dialogue';
  text: string;
  characterId: CharacterId | null;
  voice: VoiceAssignment | null;
}

const SPOKEN_AS_NARRATION = new Set(['action', 'scene_heading', 'shot', 'general', 'paragraph', 'heading', 'blockquote']);

export const speechSegmentsForUnit = (file: ProjectFile, unitId: StructuralUnitId): SpeechSegment[] => {
  const voiceFor = (characterId: CharacterId | null): VoiceAssignment | null =>
    characterId ? file.characters.find((character) => character.id === characterId)?.voice ?? null : null;

  const segments: SpeechSegment[] = [];
  let pendingCharacterId: CharacterId | null = null;

  for (const beat of beatsForUnit(file, unitId)) {
    for (const element of beat.manuscript.elements) {
      if (element.type === 'character') {
        // A character cue names the speaker for the dialogue that follows.
        pendingCharacterId = element.characterId ?? null;
        continue;
      }
      if (element.type === 'dialogue' || element.type === 'parenthetical') {
        const characterId = element.characterId ?? pendingCharacterId;
        segments.push({
          kind: 'dialogue',
          text: element.text,
          characterId,
          voice: voiceFor(characterId),
        });
        continue;
      }
      if (SPOKEN_AS_NARRATION.has(element.type) && element.text.trim().length > 0) {
        pendingCharacterId = null;
        segments.push({
          kind: 'narration',
          text: element.text,
          characterId: null,
          voice: file.settings.narratorVoice,
        });
      }
    }
  }
  return segments;
};

export const speechSegmentsForProject = (file: ProjectFile): SpeechSegment[] =>
  unitsInStoryOrder(file).flatMap((unit) => speechSegmentsForUnit(file, unit.id));

/** Rough page count for screenplays: the industry convention of ~55 lines per page. */
export const estimatedPageCount = (file: ProjectFile): number => {
  const lines = beatsInStoryOrder(file).reduce(
    (total, beat) => total + renderBeat(beat).split('\n').length + 1,
    0,
  );
  return Math.max(0, Math.round((lines / 55) * 10) / 10);
};
