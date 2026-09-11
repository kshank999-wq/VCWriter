import { describe, expect, it } from 'vitest';
import {
  addItem,
  addResearchItem,
  addResearchRow,
  createOutline,
  createProjectFile,
  findOutline,
  foldAll,
  outlineAsText,
  promoteRow,
  renderOutlineDocumentHtml,
  setSceneGrid,
  suggestedOutlineFileName,
  suggestedOutlineTextName,
  updateItem,
  updateUnit,
  type Outline,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * The Outliner (addendum 06), stage 9: the outline printed and exported.
 *
 * Two documents over one tree, so most of what is worth testing is that both
 * of them say the whole tree — folding and searching are how a writer reads
 * an outline, not what it is.
 */

const live = (file: ProjectFile, outline: Outline): Outline => findOutline(file, outline.id) as Outline;

/** A scene, two beats, and two supporting rows under the first beat. */
const warehouse = (): { file: ProjectFile; outline: Outline; scene: OutlineItemId; enters: OutlineItemId } => {
  const made = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const id = made.outline.id;
  const scene = addItem(made.file, id, { kind: 'scene', title: 'Warehouse Confrontation' });
  const enters = addItem(scene.file, id, {
    parentId: scene.itemId,
    kind: 'beat',
    title: 'Mara enters believing the warehouse is empty.',
  });
  const finds = addItem(enters.file, id, {
    parentId: scene.itemId,
    kind: 'beat',
    title: 'She finds the missing case open on the workbench.',
  });
  const idea = addItem(finds.file, id, {
    parentId: enters.itemId,
    kind: 'idea',
    title: 'Keep the audience aware of movement upstairs.',
  });
  const setting = addItem(idea.file, id, {
    parentId: enters.itemId,
    kind: 'setting',
    title: 'Rain on the metal roof masks footsteps.',
  });

  return {
    file: setting.file,
    outline: made.outline,
    scene: scene.itemId as OutlineItemId,
    enters: enters.itemId as OutlineItemId,
  };
};

describe('the outline as indented text', () => {
  it('walks it depth-first, one step of indentation per level', () => {
    const { file, outline } = warehouse();
    expect(outlineAsText(file, live(file, outline)).split('\n')).toEqual([
      'Scene — Warehouse Confrontation',
      '    Beat — Mara enters believing the warehouse is empty.',
      '        Idea — Keep the audience aware of movement upstairs.',
      '        Setting — Rain on the metal roof masks footsteps.',
      '    Beat — She finds the missing case open on the workbench.',
    ]);
  });

  it('says the whole outline even where the writer has folded it', () => {
    const { file, outline } = warehouse();
    const shut = foldAll(file, outline.id, true);
    expect(outlineAsText(shut, live(shut, outline))).toBe(outlineAsText(file, live(file, outline)));
  });

  it('puts a row’s body one step further in, so it cannot read as a row', () => {
    const { file, outline, enters } = warehouse();
    const noted = updateItem(file, outline.id, enters, { body: 'She is wrong.\nShe will know in a moment.' });
    expect(outlineAsText(noted, live(noted, outline))).toContain(
      '    Beat — Mara enters believing the warehouse is empty.\n        She is wrong.\n        She will know in a moment.',
    );
  });

  it('names a row nobody has named rather than trailing an empty dash', () => {
    const made = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
    const row = addItem(made.file, made.outline.id, { kind: 'note' });
    expect(outlineAsText(row.file, live(row.file, made.outline))).toBe('Note (unnamed)');
  });

  it('takes a linked row’s name from the research it points at', () => {
    const { file, outline } = warehouse();
    const cast = file.researchCategories.find((category) => category.systemKey === 'characters')!;
    const shelf = addResearchItem(file, { categoryId: cast.id, title: 'Mara Quinn' });
    const mara = shelf.researchItems[shelf.researchItems.length - 1]!.id;
    const dropped = addResearchRow(shelf, outline.id, mara);
    expect(outlineAsText(dropped.file, live(dropped.file, outline))).toContain('Character — Mara Quinn');
  });

  it('carries the number the writer gave a scene in the script', () => {
    const { file, outline, scene } = warehouse();
    const sent = promoteRow(file, outline.id, scene);
    const numbered = updateUnit(sent.file, sent.unitId!, { sequenceLabel: 'Sc. 12' });
    expect(outlineAsText(numbered, live(numbered, outline)).split('\n')[0]).toBe(
      'Sc. 12 — Warehouse Confrontation',
    );
  });
});

describe('the outline as a document', () => {
  it('draws every row, with the weight falling away by depth', () => {
    const { file, outline } = warehouse();
    const html = renderOutlineDocumentHtml(file, outline.id);
    expect(html).toContain('Warehouse Confrontation');
    expect(html).toContain('Rain on the metal roof masks footsteps.');
    expect(html).toContain('out-scene');
    expect(html).toContain('out-beat');
    expect(html).toContain('out-under');
  });

  it('prints what is folded, because folding is how an outline is read', () => {
    const { file, outline } = warehouse();
    const shut = foldAll(file, outline.id, true);
    expect(renderOutlineDocumentHtml(shut, outline.id)).toContain('Rain on the metal roof masks footsteps.');
  });

  it('escapes what the writer typed rather than letting it become markup', () => {
    const { file, outline, enters } = warehouse();
    const sharp = updateItem(file, outline.id, enters, { title: '<script>alert(1)</script>' });
    const html = renderOutlineDocumentHtml(sharp, outline.id);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('says how many beats a scene has, and nothing it has not been told', () => {
    const { file, outline } = warehouse();
    const html = renderOutlineDocumentHtml(file, outline.id);
    expect(html).toContain('2 beats');
    // An unanswered field is not a gap to be nagged about (§7).
    expect(html).not.toContain('POV');
  });

  it('shows a scene’s own fields once it is in the script', () => {
    const { file, outline, scene } = warehouse();
    const sent = promoteRow(file, outline.id, scene);
    const numbered = updateUnit(sent.file, sent.unitId!, { sequenceLabel: 'Sc. 12' });
    const filled = setSceneGrid(numbered, sent.unitId!, { pov: 'Mara' });
    const html = renderOutlineDocumentHtml(filled, outline.id);
    expect(html).toContain('Sc. 12');
    expect(html).toContain('POV Mara');
  });

  it('reads a scene’s summary through to wherever it lives', () => {
    const { file, outline, scene } = warehouse();
    // A plan's summary is the row's own words.
    const planned = updateItem(file, outline.id, scene, { body: 'Mara learns Daniel lied to her.' });
    expect(renderOutlineDocumentHtml(planned, outline.id)).toContain('Mara learns Daniel lied to her.');

    // In the script it is the scene's, and the row's own words are not it.
    const sent = promoteRow(planned, outline.id, scene);
    const summarised = updateUnit(sent.file, sent.unitId!, { summary: 'She decides not to call him.' });
    const html = renderOutlineDocumentHtml(summarised, outline.id);
    expect(html).toContain('She decides not to call him.');
    expect(html).not.toContain('Mara learns Daniel lied to her.');
  });

  it('stands up to a project that has no outline at all', () => {
    const plain = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const html = renderOutlineDocumentHtml(plain);
    expect(html).toContain('This outline is empty.');
  });

  it('falls back to the only outline there is when none is named', () => {
    const { file, outline } = warehouse();
    expect(renderOutlineDocumentHtml(file)).toBe(renderOutlineDocumentHtml(file, outline.id));
  });

  it('leaves the title sheet out when it is not wanted', () => {
    const { file, outline } = warehouse();
    expect(renderOutlineDocumentHtml(file, outline.id, { includeTitlePage: false })).not.toContain('class="page"');
  });

  it('names the file after the project and the outline', () => {
    const { file, outline } = warehouse();
    expect(suggestedOutlineFileName(file, outline.id)).toBe('Blackout Outline.pdf');
    expect(suggestedOutlineTextName(file, live(file, outline))).toBe('Blackout — Outline.txt');
  });
});
