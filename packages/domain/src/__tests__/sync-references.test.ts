import { describe, expect, it } from 'vitest';
import { SYNC_TABLES, addReference, createProjectFile, fromRows, insertCitation, setCitationSettings, toRows } from '../index.js';

/**
 * The Reference Library syncs (addendum 43): a citation token travels in the
 * manuscript, which syncs, so the sources and citations it names must too,
 * or another device would read citations of nothing.
 */
describe('syncing the Reference Library', () => {
  it('round-trips sources, citations and the settings, and pushes sources before their citations', () => {
    let file = createProjectFile({ title: 'Book', format: 'instructional' });
    const made = addReference(file, { type: 'journal', authors: ['Jones, Robert'], title: 'On Tides', doi: '10.1000/t', tags: ['sea'], shortCode: 'J1' });
    const cited = insertCitation(made.file, { referenceId: made.reference.id, locatorKind: 'pages', locator: '3-4', note: 'Compare.' });
    file = setCitationSettings(cited.file, { style: 'apa', markers: 'alpha' });

    const rows = toRows(file);
    expect(rows.references[0]).toMatchObject({ type: 'journal', short_code: 'J1', tags: ['sea'], metadata: expect.objectContaining({ title: 'On Tides', doi: '10.1000/t' }) });
    expect(rows.citations[0]).toMatchObject({ key: cited.citation.key, locator_kind: 'pages', locator: '3-4', note: 'Compare.' });

    const back = fromRows(rows);
    expect(back.references).toEqual(file.references);
    expect(back.citations).toEqual(file.citations);
    expect(back.settings.citations).toEqual(file.settings.citations);

    const order = Object.keys(SYNC_TABLES);
    expect(order.indexOf('references')).toBeLessThan(order.indexOf('citations'));
    expect(SYNC_TABLES.references).toBe('reference_sources');
  });
});
