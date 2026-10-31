import { outlineChildren, rowSource, rowTitle } from './outline.js';
import type { OutlineItem } from './entities/outline.js';
import type { ResearchItem } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, OutlineId } from './ids.js';

/**
 * **What was planned for a beat, beside its writing** (from Ken: *when you
 * click onto a beat and there's notes and character and that type of thing,
 * there needs to be a button where you can open that in a side menu where
 * you have a split screen, so you have all your notes and everything
 * available while you're writing that beat*).
 *
 * The beat's own Outliner row — the one bound to it — with its words, and
 * every row under it in reading order: the notes, the characters, the
 * settings, the ideas, each with its words and, where it was dragged in from
 * the research shelf, that note. A reading; nothing is copied.
 */
export interface BeatPlanLine {
  depth: number;
  kind: string;
  title: string;
  body: string;
  /** The research note the row reads, where it came off the shelf. */
  research: ResearchItem | null;
}

export interface BeatPlan {
  outlineId: OutlineId | null;
  /** The row the beat is, or null where no row is bound to it. */
  row: OutlineItem | null;
  lines: BeatPlanLine[];
}

export const beatPlan = (file: ProjectFile, beatId: BeatId): BeatPlan => {
  for (const outline of file.outlines ?? []) {
    const row = outline.items.find((one) => one.boundBeatId === beatId);
    if (!row) continue;
    const lines: BeatPlanLine[] = [];
    const walk = (parent: OutlineItem, depth: number): void => {
      for (const child of outlineChildren(outline, parent.id)) {
        lines.push({ depth, kind: child.kind, title: rowTitle(file, child), body: child.body, research: rowSource(file, child) });
        walk(child, depth + 1);
      }
    };
    walk(row, 0);
    return { outlineId: outline.id, row, lines };
  }
  return { outlineId: null, row: null, lines: [] };
};
