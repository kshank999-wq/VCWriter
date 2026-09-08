import { newId } from './ids.js';
import { beatsForUnit } from './selectors.js';
import { updateBeat } from './mutations.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { ManuscriptElementId, StructuralUnitId } from './ids.js';

/**
 * The scene's slugline as three fields (addendum 02 §4).
 *
 * The scene dialog shows INT/EXT, the place and the time the way a script
 * does, but it does not keep them anywhere of its own: the fields are read
 * from, and written back to, the scene's first scene-heading element. The
 * script stays the single source of truth, and a heading typed in the
 * script shows up in the dialog with nothing to reconcile.
 */

export const SETTINGS = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'] as const;
export const TIMES = ['DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER', 'SAME'] as const;

export interface SceneHeading {
  setting: string;
  place: string;
  time: string;
}

/** "INT. OFFICE - DAY" → { setting: 'INT.', place: 'OFFICE', time: 'DAY' }; tolerant of what writers type. */
export const parseSceneHeading = (text: string): SceneHeading => {
  const line = text.trim().toUpperCase();
  const settingMatch = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*/.exec(line);
  const rawSetting = settingMatch?.[1] ?? '';
  const setting = rawSetting.length === 0 ? '' : normaliseSetting(rawSetting);
  const rest = line.slice(settingMatch?.[0].length ?? 0).trim();
  const dash = rest.lastIndexOf(' - ');
  const dashAlt = dash === -1 ? rest.lastIndexOf(' – ') : dash;
  if (dashAlt === -1) return { setting, place: rest, time: '' };
  return { setting, place: rest.slice(0, dashAlt).trim(), time: rest.slice(dashAlt + 3).trim() };
};

const normaliseSetting = (raw: string): string => {
  const bare = raw.replace(/\./g, '');
  if (bare === 'I/E' || bare === 'INT/EXT') return 'INT./EXT.';
  if (bare === 'EXT/INT') return 'EXT./INT.';
  return `${bare}.`;
};

export const formatSceneHeading = ({ setting, place, time }: SceneHeading): string => {
  const head = [setting.trim(), place.trim().toUpperCase()].filter((part) => part.length > 0).join(' ');
  return time.trim().length > 0 ? `${head} - ${time.trim().toUpperCase()}` : head;
};

/** The heading a scene carries, from its first scene-heading element, if any. */
export const sceneHeadingOf = (file: ProjectFile, unitId: StructuralUnitId): SceneHeading | null => {
  for (const beat of beatsForUnit(file, unitId)) {
    const heading = beat.manuscript.elements.find((element) => element.type === 'scene_heading');
    if (heading) return parseSceneHeading(heading.text);
  }
  return null;
};

/**
 * Write a heading into the scene: replace the first scene-heading element,
 * or put one at the top of the first beat when there is none. A scene with
 * no beats cannot hold a heading and is left alone.
 */
export const setSceneHeading = (file: ProjectFile, unitId: StructuralUnitId, heading: SceneHeading): ProjectFile => {
  const text = formatSceneHeading(heading);
  const beats = beatsForUnit(file, unitId);
  for (const beat of beats) {
    const index = beat.manuscript.elements.findIndex((element) => element.type === 'scene_heading');
    if (index === -1) continue;
    const elements = beat.manuscript.elements.map((element, position) =>
      position === index ? { ...element, text } : element,
    );
    return updateBeat(file, beat.id, { manuscript: { elements } });
  }
  const first = beats[0];
  if (!first) return file;
  const element: ManuscriptElement = {
    id: newId<ManuscriptElementId>(),
    type: 'scene_heading',
    text,
    characterId: null,
    attributes: {},
  };
  return updateBeat(file, first.id, { manuscript: { elements: [element, ...first.manuscript.elements] } });
};
