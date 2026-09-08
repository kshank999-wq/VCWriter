import { useMemo } from 'react';
import { SETTINGS, TIMES, type ProjectFile } from '@vcwriter/domain';

/**
 * SmartType for sluglines: the headings already in the script, plus every
 * location it knows crossed with INT./EXT. and the times of day, so the
 * second scene in a location is a few keystrokes. Character cues are not
 * here — they are offered per beat, in the order most likely to be wanted
 * (`BeatBody`).
 */
export function ManuscriptDataLists({ file }: { file: ProjectFile }) {
  const slugs = useMemo(() => {
    const headings = new Set<string>();
    const places = new Set<string>();
    for (const beat of file.beats) {
      for (const element of beat.manuscript.elements) {
        if (element.type !== 'scene_heading') continue;
        const text = element.text.trim().toUpperCase();
        if (text.length === 0) continue;
        headings.add(text);
        const place = text.replace(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)\s*/, '').split(' - ')[0];
        if (place && place.length > 0) places.add(place);
      }
    }
    for (const place of places) {
      for (const setting of SETTINGS) {
        for (const time of TIMES) headings.add(`${setting} ${place} - ${time}`);
      }
    }
    return [...headings].sort();
  }, [file.beats]);

  return (
    <datalist id="vcwriter-slugs">
      {slugs.map((slug) => (
        <option key={slug} value={slug} />
      ))}
    </datalist>
  );
}
