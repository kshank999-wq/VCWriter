import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import {
  extractCategorySchema,
  extractPaletteSchema,
  extractSchema,
  type Extract,
  type ExtractCategory,
  type ExtractPalette,
} from './entities/extract.js';
import { orderKeyBetween } from './ordering.js';
import type { ProjectFile } from './project-file.js';
import type { ExtractCategoryId, ExtractPaletteId, WpDocumentId } from './ids.js';

/**
 * **The portable bundle** (addendum 42 §11, WP spec §7.2): extracts with the
 * palettes and buttons they were captured with, as one versioned JSON file.
 * A writer carries it to another install, or keeps it, and *Import bundle*
 * puts it back into any document.
 *
 * The CSV is the other output §7.2 names: a flat list for reading or a
 * spreadsheet, **not** a way back in, since it has no palettes and no rich
 * text.
 */

export const EXTRACT_BUNDLE_FORMAT = 'vcwriter.extracts';
export const EXTRACT_BUNDLE_VERSION = 1;

export const extractBundleSchema = z.object({
  format: z.literal(EXTRACT_BUNDLE_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  source: z.object({
    projectId: z.string(),
    projectTitle: z.string().default(''),
    documentTitle: z.string().default(''),
  }),
  palettes: z.array(extractPaletteSchema),
  categories: z.array(extractCategorySchema),
  extracts: z.array(extractSchema),
});
export type ExtractBundle = z.infer<typeof extractBundleSchema>;

/** These extracts, or every one, with the palettes and buttons they sit in. */
export const buildExtractBundle = (file: ProjectFile, extractIds?: readonly string[]): ExtractBundle => {
  const wanted = extractIds ? new Set(extractIds) : null;
  const extracts = file.extracts.filter((extract) => !wanted || wanted.has(extract.id));
  const categoryIds = new Set(extracts.map((extract) => extract.categoryId as string));
  // The whole palette travels, not just the buttons in use: it is a tool.
  const paletteIds = new Set(
    file.extractCategories.filter((category) => categoryIds.has(category.id)).map((category) => category.paletteId as string),
  );
  const document = file.documents.find((one) => one.id === extracts[0]?.documentId) ?? file.documents[0];
  return {
    format: EXTRACT_BUNDLE_FORMAT,
    version: EXTRACT_BUNDLE_VERSION,
    exportedAt: nowIso(),
    source: { projectId: file.project.id, projectTitle: file.project.title, documentTitle: document?.title ?? '' },
    palettes: file.extractPalettes.filter((palette) => paletteIds.has(palette.id)),
    categories: file.extractCategories.filter((category) => paletteIds.has(category.paletteId)),
    extracts,
  };
};

export const serializeExtractBundle = (bundle: ExtractBundle): string => `${JSON.stringify(bundle, null, 2)}\n`;

export type BundleReading = { ok: true; bundle: ExtractBundle } | { ok: false; error: string };

/** A bundle read back, or why it is not one. A newer version than this build knows is refused, not guessed at. */
export const readExtractBundle = (text: string): BundleReading => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not a VC Writer extract bundle.' };
  }
  const version = (raw as { version?: unknown })?.version;
  if (typeof version === 'number' && version > EXTRACT_BUNDLE_VERSION) {
    return { ok: false, error: 'That bundle was made by a newer VC Writer. Update to import it.' };
  }
  const parsed = extractBundleSchema.safeParse(raw);
  return parsed.success ? { ok: true, bundle: parsed.data } : { ok: false, error: 'That file is not a VC Writer extract bundle.' };
};

const lastKey = (rows: readonly { orderKey: string }[]): string | null =>
  rows.reduce<string | null>((last, row) => (last === null || row.orderKey > last ? row.orderKey : last), null);

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface BundleImport {
  file: ProjectFile;
  added: number;
  /** Already here: imported before, so not made twice. */
  skipped: number;
}

/**
 * A bundle into a document. A palette of the same name is joined rather than
 * repeated, and a button of the same label in it is used rather than added,
 * so importing twice, or into a document that already has General Writing,
 * makes nothing twice. An extract already here, by id, is skipped.
 *
 * The extracts come in unmarked: their passages are in another document, so
 * each shows *Source removed* and keeps its words, receipts and tags.
 */
export const importExtractBundle = (file: ProjectFile, bundle: ExtractBundle, documentId: WpDocumentId): BundleImport => {
  const at = nowIso();
  let palettes = [...file.extractPalettes];
  let categories = [...file.extractCategories];
  const paletteFor = new Map<string, ExtractPaletteId>();
  const categoryFor = new Map<string, ExtractCategoryId>();

  for (const palette of bundle.palettes) {
    const match =
      palettes.find((one) => !one.archived && one.builtIn !== null && one.builtIn === palette.builtIn) ??
      palettes.find((one) => !one.archived && same(one.name, palette.name));
    if (match) {
      paletteFor.set(palette.id, match.id);
      continue;
    }
    const made: ExtractPalette = {
      ...palette,
      id: newId<ExtractPaletteId>(),
      projectId: file.project.id,
      builtIn: null,
      archived: false,
      orderKey: orderKeyBetween(lastKey(palettes), null),
      createdAt: at,
      updatedAt: at,
    };
    palettes = [...palettes, made];
    paletteFor.set(palette.id, made.id);
  }

  for (const category of bundle.categories) {
    const paletteId = paletteFor.get(category.paletteId);
    if (!paletteId) continue;
    const siblings = categories.filter((one) => one.paletteId === paletteId);
    const match = siblings.find((one) => same(one.label, category.label));
    if (match) {
      categoryFor.set(category.id, match.id);
      continue;
    }
    const made: ExtractCategory = {
      ...category,
      id: newId<ExtractCategoryId>(),
      paletteId,
      orderKey: orderKeyBetween(lastKey(siblings), null),
      createdAt: at,
      updatedAt: at,
    };
    categories = [...categories, made];
    categoryFor.set(category.id, made.id);
  }

  const here = new Set(file.extracts.map((extract) => extract.id as string));
  let added = 0;
  let skipped = 0;
  const extracts: Extract[] = [...file.extracts];
  for (const extract of bundle.extracts) {
    const categoryId = categoryFor.get(extract.categoryId);
    if (!categoryId) continue;
    if (here.has(extract.id)) {
      skipped += 1;
      continue;
    }
    const bin = extracts.filter((one) => one.categoryId === categoryId);
    extracts.push({ ...extract, documentId, categoryId, orderKey: orderKeyBetween(lastKey(bin), null), updatedAt: at });
    here.add(extract.id);
    added += 1;
  }

  return { file: { ...file, extractPalettes: palettes, extractCategories: categories, extracts }, added, skipped };
};

// ---------------------------------------------------------------- CSV

const cell = (value: string): string => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const EXTRACT_CSV_COLUMNS = ['Title', 'Category', 'Palette', 'Kind', 'Status', 'Tags', 'Sent to', 'Captured', 'Text'];

/** One row per extract, for review in a spreadsheet (WP spec §7.2). */
export const extractsCsv = (file: ProjectFile, extractIds?: readonly string[]): string => {
  const wanted = extractIds ? new Set(extractIds) : null;
  const rows = file.extracts
    .filter((extract) => !wanted || wanted.has(extract.id))
    .map((extract) => {
      const category = file.extractCategories.find((one) => one.id === extract.categoryId);
      const palette = file.extractPalettes.find((one) => one.id === category?.paletteId);
      return [
        extract.title,
        category?.label ?? '',
        palette?.name ?? '',
        category?.kind ?? '',
        extract.status,
        extract.tags.join('; '),
        extract.sentTo.map((receipt) => `${receipt.projectTitle} › ${receipt.areaName}`).join('; '),
        extract.createdAt,
        extract.textPlain,
      ];
    });
  return `${[EXTRACT_CSV_COLUMNS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
};
