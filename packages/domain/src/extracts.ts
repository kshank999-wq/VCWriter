import { newId } from './ids.js';
import type { ExtractCategoryId, ExtractId, ExtractPaletteId, WpDocumentId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import { nowIso } from './entities/common.js';
import { orderKeyBetween } from './ordering.js';
import type { DocNode } from './entities/document.js';
import type {
  Extract,
  ExtractCategory,
  ExtractKind,
  ExtractPalette,
  ExtractStatus,
} from './entities/extract.js';

/**
 * Extract & Organize (addendum 42 §8). Pure, like every mutation: the
 * sidebar asks, these answer, and the project saves the result.
 *
 * **Nothing here ever deletes a word of the document.** An extract is a copy
 * held in a bin; the passage it came from stays where it was. Taking an
 * extract away removes the copy and the mark that pointed at it.
 */

/** The WP spec's §5.3 palette, in its order, each with the type it stands for. */
export const GENERAL_WRITING: ReadonlyArray<{ label: string; kind: ExtractKind; color: string }> = [
  { label: 'Scene', kind: 'scene', color: '#8FA8C4' },
  { label: 'Beat', kind: 'beat', color: '#A3B8D9' },
  { label: 'Character', kind: 'character', color: '#E39B7B' },
  { label: 'Characterization', kind: 'characterization', color: '#E7B58F' },
  { label: 'Dialogue', kind: 'dialogue', color: '#9CCFB0' },
  { label: 'Description', kind: 'description', color: '#B9D88E' },
  { label: 'Location', kind: 'location', color: '#7FC3C9' },
  { label: 'Object', kind: 'object', color: '#C9B07F' },
  { label: 'Plot Point', kind: 'plot_point', color: '#D98E8E' },
  { label: 'Note', kind: 'note', color: '#C4C4C4' },
  { label: 'Idea', kind: 'idea', color: '#F2D16B' },
  { label: 'Setup', kind: 'setup', color: '#B79CD9' },
  { label: 'Payoff', kind: 'payoff', color: '#9C8FD9' },
  { label: 'Research', kind: 'research', color: '#8FC4A8' },
  { label: 'Other', kind: 'other', color: '#A8A8A8' },
];

/** Swatches handed to new categories in turn, so neighbours differ. */
export const CATEGORY_COLOURS = GENERAL_WRITING.map((one) => one.color);

const byOrder = <T extends { orderKey: string }>(a: T, b: T): number =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0;

const lastKey = <T extends { orderKey: string }>(items: readonly T[]): string | null =>
  items.length ? [...items].sort(byOrder)[items.length - 1]!.orderKey : null;

// ---------------------------------------------------------------- palettes

/**
 * The project with General Writing in it. A project that has it already
 * comes back unchanged, so this is safe to call whenever the sidebar opens.
 */
export const ensureExtractPalettes = (file: ProjectFile): ProjectFile => {
  if (file.extractPalettes.some((palette) => palette.builtIn === 'general_writing')) return file;
  const at = nowIso();
  const palette: ExtractPalette = {
    id: newId<ExtractPaletteId>(),
    projectId: file.project.id,
    name: 'General Writing',
    builtIn: 'general_writing',
    orderKey: orderKeyBetween(null, file.extractPalettes.length ? [...file.extractPalettes].sort(byOrder)[0]!.orderKey : null),
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
  let key: string | null = null;
  const categories: ExtractCategory[] = GENERAL_WRITING.map((seed) => {
    key = orderKeyBetween(key, null);
    return {
      id: newId<ExtractCategoryId>(),
      paletteId: palette.id,
      label: seed.label,
      kind: seed.kind,
      color: seed.color,
      orderKey: key,
      enabled: true,
      createdAt: at,
      updatedAt: at,
    };
  });
  return {
    ...file,
    extractPalettes: [...file.extractPalettes, palette],
    extractCategories: [...file.extractCategories, ...categories],
  };
};

/** The palettes a writer chooses between, in order; archived ones left out. */
export const palettesOf = (file: ProjectFile): ExtractPalette[] =>
  file.extractPalettes.filter((palette) => !palette.archived).sort(byOrder);

/** A palette's buttons, in order. */
export const categoriesOf = (file: ProjectFile, paletteId: ExtractPaletteId): ExtractCategory[] =>
  file.extractCategories.filter((category) => category.paletteId === paletteId).sort(byOrder);

export const addPalette = (file: ProjectFile, name: string): { file: ProjectFile; palette: ExtractPalette } => {
  const at = nowIso();
  const palette: ExtractPalette = {
    id: newId<ExtractPaletteId>(),
    projectId: file.project.id,
    name: name.trim().slice(0, 80) || 'New palette',
    builtIn: null,
    orderKey: orderKeyBetween(lastKey(file.extractPalettes), null),
    archived: false,
    createdAt: at,
    updatedAt: at,
  };
  return { file: { ...file, extractPalettes: [...file.extractPalettes, palette] }, palette };
};

export const renamePalette = (file: ProjectFile, id: ExtractPaletteId, name: string): ProjectFile => {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return file;
  return {
    ...file,
    extractPalettes: file.extractPalettes.map((palette) =>
      palette.id === id ? { ...palette, name: trimmed, updatedAt: nowIso() } : palette,
    ),
  };
};

/** A copy of a palette's buttons under a new name: the start of a variation. */
export const duplicatePalette = (
  file: ProjectFile,
  id: ExtractPaletteId,
  name: string,
): { file: ProjectFile; palette: ExtractPalette } => {
  const made = addPalette(file, name);
  const at = nowIso();
  const copies = categoriesOf(file, id).map((category) => ({
    ...category,
    id: newId<ExtractCategoryId>(),
    paletteId: made.palette.id,
    createdAt: at,
    updatedAt: at,
  }));
  return { file: { ...made.file, extractCategories: [...made.file.extractCategories, ...copies] }, palette: made.palette };
};

/** How many extracts sit in a palette's bins. */
export const extractsInPalette = (file: ProjectFile, id: ExtractPaletteId): number => {
  const categories = new Set(categoriesOf(file, id).map((category) => category.id));
  return file.extracts.filter((extract) => categories.has(extract.categoryId)).length;
};

/**
 * Take a palette away. **A palette with extracts in its bins is archived
 * rather than deleted**: the buttons go, and every extract stays where it
 * is, reachable from All categories. An empty one is deleted outright. The
 * WP spec's rule is that extracts are never silently discarded.
 */
export const removePalette = (file: ProjectFile, id: ExtractPaletteId): { file: ProjectFile; archived: boolean } => {
  const palette = file.extractPalettes.find((one) => one.id === id);
  if (!palette || palette.builtIn) return { file, archived: false };
  if (extractsInPalette(file, id) > 0) {
    return {
      file: {
        ...file,
        extractPalettes: file.extractPalettes.map((one) =>
          one.id === id ? { ...one, archived: true, updatedAt: nowIso() } : one,
        ),
      },
      archived: true,
    };
  }
  return {
    file: {
      ...file,
      extractPalettes: file.extractPalettes.filter((one) => one.id !== id),
      extractCategories: file.extractCategories.filter((category) => category.paletteId !== id),
    },
    archived: false,
  };
};

// -------------------------------------------------------------- categories

export const addCategory = (
  file: ProjectFile,
  paletteId: ExtractPaletteId,
  label: string,
  options: { kind?: ExtractKind; color?: string } = {},
): { file: ProjectFile; category: ExtractCategory } => {
  const siblings = categoriesOf(file, paletteId);
  const at = nowIso();
  const category: ExtractCategory = {
    id: newId<ExtractCategoryId>(),
    paletteId,
    label: label.trim().slice(0, 60) || 'Category',
    kind: options.kind ?? 'other',
    color: options.color ?? (CATEGORY_COLOURS[siblings.length % CATEGORY_COLOURS.length] as string),
    orderKey: orderKeyBetween(lastKey(siblings), null),
    enabled: true,
    createdAt: at,
    updatedAt: at,
  };
  return { file: { ...file, extractCategories: [...file.extractCategories, category] }, category };
};

export const updateCategory = (
  file: ProjectFile,
  id: ExtractCategoryId,
  patch: Partial<Pick<ExtractCategory, 'label' | 'kind' | 'color' | 'enabled'>>,
): ProjectFile => ({
  ...file,
  extractCategories: file.extractCategories.map((category) => {
    if (category.id !== id) return category;
    const label = patch.label === undefined ? category.label : patch.label.trim().slice(0, 60) || category.label;
    return { ...category, ...patch, label, updatedAt: nowIso() };
  }),
});

/** One step up or down the palette. */
export const moveCategory = (file: ProjectFile, id: ExtractCategoryId, direction: -1 | 1): ProjectFile => {
  const category = file.extractCategories.find((one) => one.id === id);
  if (!category) return file;
  const siblings = categoriesOf(file, category.paletteId);
  const index = siblings.findIndex((one) => one.id === id);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return file;
  // With this one lifted out, it goes in at `target`: between the neighbours
  // either side of that slot, whichever way it is moving.
  const others = siblings.filter((one) => one.id !== id);
  const key = orderKeyBetween(others[target - 1]?.orderKey ?? null, others[target]?.orderKey ?? null);
  return {
    ...file,
    extractCategories: file.extractCategories.map((one) => (one.id === id ? { ...one, orderKey: key, updatedAt: nowIso() } : one)),
  };
};

/** How many extracts a category's bin holds. */
export const extractsInCategory = (file: ProjectFile, id: ExtractCategoryId): number =>
  file.extracts.filter((extract) => extract.categoryId === id).length;

/**
 * Take a button away. A button whose bin holds extracts is **turned off**
 * rather than deleted: it leaves the palette and its bin stays. An empty one
 * is deleted.
 */
export const removeCategory = (file: ProjectFile, id: ExtractCategoryId): { file: ProjectFile; disabled: boolean } => {
  if (extractsInCategory(file, id) > 0) return { file: updateCategory(file, id, { enabled: false }), disabled: true };
  return { file: { ...file, extractCategories: file.extractCategories.filter((one) => one.id !== id) }, disabled: false };
};

// ---------------------------------------------------------------- extracts

export interface ExtractInput {
  /** Chosen by the editor, which marks the passage with it at the same moment. */
  id: ExtractId;
  documentId: WpDocumentId;
  categoryId: ExtractCategoryId;
  textPlain: string;
  textRich?: DocNode[];
  sourceRevision?: number;
}

/**
 * Whether this passage already sits in this bin. The sidebar warns rather
 * than making a second copy (WP spec §5.4). The same words in a different
 * bin are not a duplicate: overlapping captures are allowed (§5.2).
 */
export const isDuplicateExtract = (
  file: ProjectFile,
  input: Pick<ExtractInput, 'documentId' | 'categoryId' | 'textPlain'>,
): boolean =>
  file.extracts.some(
    (extract) =>
      extract.documentId === input.documentId &&
      extract.categoryId === input.categoryId &&
      extract.textPlain.trim() === input.textPlain.trim(),
  );

/** A short name for an extract: its first words. */
export const defaultExtractTitle = (text: string): string => {
  const words = text.replace(/\s+/g, ' ').trim();
  return words.length > 60 ? `${words.slice(0, 57).replace(/\s+\S*$/, '')}…` : words;
};

/** Capture a passage into a bin, at its end (WP spec §5.1 step 4). */
export const createExtract = (file: ProjectFile, input: ExtractInput): { file: ProjectFile; extract: Extract } => {
  const at = nowIso();
  const bin = file.extracts.filter((extract) => extract.categoryId === input.categoryId);
  const extract: Extract = {
    id: input.id,
    documentId: input.documentId,
    categoryId: input.categoryId,
    textPlain: input.textPlain.slice(0, 200_000),
    textRich: input.textRich ?? [],
    sourceRevision: input.sourceRevision ?? 0,
    title: defaultExtractTitle(input.textPlain),
    tags: [],
    status: 'unassigned',
    orderKey: orderKeyBetween(lastKey(bin), null),
    createdAt: at,
    updatedAt: at,
  };
  return { file: { ...file, extracts: [...file.extracts, extract] }, extract };
};

export const updateExtract = (
  file: ProjectFile,
  id: ExtractId,
  patch: Partial<Pick<Extract, 'title' | 'tags' | 'status' | 'textPlain' | 'textRich' | 'sourceRevision'>>,
): ProjectFile => ({
  ...file,
  extracts: file.extracts.map((extract) =>
    extract.id === id
      ? {
          ...extract,
          ...patch,
          ...(patch.title !== undefined ? { title: patch.title.slice(0, 200) } : {}),
          updatedAt: nowIso(),
        }
      : extract,
  ),
});

/** Into another bin, at its end. The source passage is untouched. */
export const moveExtract = (file: ProjectFile, id: ExtractId, categoryId: ExtractCategoryId): ProjectFile => {
  const bin = file.extracts.filter((extract) => extract.categoryId === categoryId && extract.id !== id);
  return {
    ...file,
    extracts: file.extracts.map((extract) =>
      extract.id === id
        ? { ...extract, categoryId, orderKey: orderKeyBetween(lastKey(bin), null), updatedAt: nowIso() }
        : extract,
    ),
  };
};

/** Within its bin, one step up or down. */
export const nudgeExtract = (file: ProjectFile, id: ExtractId, direction: -1 | 1): ProjectFile => {
  const extract = file.extracts.find((one) => one.id === id);
  if (!extract) return file;
  const bin = file.extracts.filter((one) => one.categoryId === extract.categoryId).sort(byOrder);
  const index = bin.findIndex((one) => one.id === id);
  const target = index + direction;
  if (target < 0 || target >= bin.length) return file;
  const others = bin.filter((one) => one.id !== id);
  const key = orderKeyBetween(others[target - 1]?.orderKey ?? null, others[target]?.orderKey ?? null);
  return {
    ...file,
    extracts: file.extracts.map((one) => (one.id === id ? { ...one, orderKey: key, updatedAt: nowIso() } : one)),
  };
};

/** The copy goes; the passage it came from stays in the document. */
export const deleteExtract = (file: ProjectFile, id: ExtractId): ProjectFile => ({
  ...file,
  extracts: file.extracts.filter((extract) => extract.id !== id),
});

export interface Bin {
  category: ExtractCategory;
  extracts: Extract[];
}

/**
 * The bins, one per category, each in its own order. With a palette, that
 * palette's categories; with none, every category in the project that has
 * something in it or is a live button (WP spec §5.3: *Current Palette or All
 * Categories*).
 */
export const binsOf = (file: ProjectFile, paletteId: ExtractPaletteId | null): Bin[] => {
  const categories = paletteId
    ? categoriesOf(file, paletteId)
    : [...file.extractCategories].sort((a, b) => {
        const pa = file.extractPalettes.find((one) => one.id === a.paletteId)?.orderKey ?? '';
        const pb = file.extractPalettes.find((one) => one.id === b.paletteId)?.orderKey ?? '';
        return pa === pb ? byOrder(a, b) : pa < pb ? -1 : 1;
      });
  return categories
    .map((category) => ({
      category,
      extracts: file.extracts.filter((extract) => extract.categoryId === category.id).sort(byOrder),
    }))
    .filter((bin) => bin.category.enabled || bin.extracts.length > 0);
};

/** The extracts matching a search: title, words and tags, any case. */
export const matchesExtract = (extract: Extract, query: string, status: ExtractStatus | 'all' = 'all'): boolean => {
  if (status !== 'all' && extract.status !== status) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    extract.title.toLowerCase().includes(needle) ||
    extract.textPlain.toLowerCase().includes(needle) ||
    extract.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
};
