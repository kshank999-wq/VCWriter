import { describe, expect, it } from 'vitest';
import {
  createExtract,
  createProjectFile,
  ensureExtractPalettes,
  fromRows,
  mainDocument,
  palettesOf,
  categoriesOf,
  setDocumentContent,
  textToDocContent,
  toRows,
  mergeProjects,
} from '../index.js';
import { newId, type ExtractId } from '../ids.js';

/**
 * **A Document project's words travel** (addendum 42 §17, from Ken: *opening
 * in one computer or another, the file comes out blank… let's fix that first
 * so I can start working in the program on different computers*). The
 * document, its palettes, buttons and extracts were never in the sync tables,
 * so a project brought down from the cloud arrived with none of them.
 */
const written = () => {
  let file = createProjectFile({ title: 'Letter', format: 'document' });
  const doc = mainDocument(file)!;
  file = setDocumentContent(file, doc.id, textToDocContent('Dear Sam,\n\nThe bridge is out.'));
  file = ensureExtractPalettes(file);
  const palette = palettesOf(file)[0]!;
  const category = categoriesOf(file, palette.id)[0]!;
  file = createExtract(file, { id: newId<ExtractId>(), documentId: doc.id, categoryId: category.id, textPlain: 'The bridge is out.' }).file;
  return file;
};

describe('a Document project through the cloud', () => {
  it('comes back from its rows with its document, palettes, buttons and extracts', () => {
    const file = written();
    const back = fromRows(toRows(file));
    expect(back.documents).toEqual(file.documents);
    expect(back.extractPalettes).toEqual(file.extractPalettes);
    expect(back.extractCategories).toEqual(file.extractCategories);
    expect(back.extracts).toEqual(file.extracts);
  });

  it('keeps the record whole in the row, with the project beside it', () => {
    const file = written();
    const row = toRows(file).documents[0]!;
    expect(row['project_id']).toBe(file.project.id);
    expect((row['data'] as Record<string, unknown>)['content']).toEqual(file.documents[0]!.content);
    expect((row['data'] as Record<string, unknown>)['projectId']).toBeUndefined();
  });

  it('arrives on a second computer with its words, and merges like any other record', () => {
    const file = written();
    const cloud = fromRows(toRows(file));
    const merged = mergeProjects(cloud, cloud, { lastSyncedAt: null }).merged;
    expect(mainDocument(merged)?.content).toEqual(mainDocument(file)?.content);
  });
});
