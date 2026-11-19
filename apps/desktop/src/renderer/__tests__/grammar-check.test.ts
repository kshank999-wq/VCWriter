import { describe, expect, it } from 'vitest';
import { createProjectFile, editReviewOf, runEditCheck, setEditorProfile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { grammarHits } from '../grammar-check';

/**
 * Harper's spelling and grammar, as Edit Check findings (editor spec §4):
 * narrow fixes for mechanical slips, and a character's grammar left alone.
 */
const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const book = (lines: string[], dictionary: string[] = []): ProjectFile => {
  let file = createProjectFile({ title: 'Book', format: 'novel' });
  file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: lines.map((text, k) => para(`00000000-0000-4000-8000-00000000000${k}`, text)) } });
  return setEditorProfile(file, { dictionary });
};

describe('spelling and grammar from Harper', () => {
  it('finds slips with narrow fixes, and leaves speech’s grammar alone', async () => {
    const file = book(['She buyed some bread and went too the the market tomorow. “Me and him goes there,” Zorbel said.'], ['Zorbel']);
    const hits = await grammarHits(file, { kind: 'all' });
    const quote = (h: { start: number; end: number }) => file.beats[0]!.manuscript.elements[0]!.text.slice(h.start, h.end);
    const said = hits.map((h) => `${h.category}:${quote(h)}>${h.fix ?? ''}`);
    expect(said).toContain('grammar:buyed>bought');
    expect(said.some((one) => one.startsWith('spelling:tomorow>tomorrow'))).toBe(true);
    expect(said.some((one) => one.startsWith('grammar:the the'))).toBe(true);
    // A character's grammar in quotes is theirs; a project word is right.
    expect(said.some((one) => one.includes('goes'))).toBe(false);
    expect(said.some((one) => one.includes('Zorbel'))).toBe(false);

    const review = editReviewOf(runEditCheck(file, { outside: hits }));
    expect(review.findings.some((one) => one.source === 'grammar' && one.fix === 'bought')).toBe(true);
  }, 60000);
});
