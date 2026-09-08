import type { Beat } from '@vcwriter/domain';

/**
 * One glyph per beat status, so the state reads at a glance in a row too
 * narrow for the word and without depending on colour alone (§15).
 */
export const STATUS_GLYPH: Record<Beat['status'], string> = {
  planned: '○',
  drafting: '◐',
  written: '●',
  revised: '◆',
  cut: '×',
};

export const BEAT_STATUSES: Beat['status'][] = ['planned', 'drafting', 'written', 'revised', 'cut'];
