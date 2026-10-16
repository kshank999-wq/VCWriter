import { z } from 'zod';
import {
  elementOverrideSchema,
  formatOverridesSchema,
  scriptFormatSchema,
  type ElementOverride,
  type FormatOverrides,
  type ProjectFormat,
  type ScriptFormat,
} from './entities/project.js';
import { elementTypesFor } from './editing.js';
import { isProseFormat } from './formats.js';
import { layoutFor, layoutForFile, scriptFormatOf, scriptFormatsFor } from './pagination.js';
import type { ProjectFile } from './project-file.js';

/**
 * **Custom templates** (addendum 39, Ken's *Stage Play Formatting Engine*
 * spec §1 and §7): *Save as Custom Template*, *Restore Defaults*, and the
 * per-element override inspector that makes a template worth saving.
 *
 * Two records, and the line between them is addendum 37 §5's:
 *
 * - **The project's changes** (`settings.formatOverrides`) belong to the
 *   project. They change the geometry and so the page count, and two people
 *   opening one play must see one page — so the play carries its own page
 *   whatever machine it is opened on.
 * - **The library** of saved templates belongs to the **writer**, on their
 *   machine: a house style a writer has built is something they reach for
 *   in the next play, and a template kept inside one project could not be.
 *   Applying one copies it into the project, so nothing printed ever depends
 *   on the library still holding it.
 *
 * The bundled presets stay immutable — the spec's own §9 test — because a
 * template is the preset's *name* and the writer's *changes*, never an edited
 * copy of the preset's record.
 */

export const customTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** The house style it changes: a template is always one preset, changed. */
  base: scriptFormatSchema,
  elements: z.record(z.string(), elementOverrideSchema).default({}),
  savedAt: z.string().default(''),
});
export type CustomTemplate = z.infer<typeof customTemplateSchema>;

/** The project's changes, with the defaults filled in. */
export const formatOverridesOf = (file: ProjectFile): FormatOverrides =>
  formatOverridesSchema.parse(file.settings.formatOverrides ?? {});

/** Whether the project departs from its preset at all. */
export const hasFormatOverrides = (file: ProjectFile): boolean =>
  Object.values(formatOverridesOf(file).elements).some((one) => Object.keys(one).length > 0);

/** Whether the inspector is offered: a script, never a book. */
export const customisesFormat = (format: ProjectFormat): boolean => !isProseFormat(format);

/** One line of the inspector: what is in force, what the preset says, and whether they differ. */
export interface ElementGeometry {
  type: string;
  indent: number;
  width: number;
  uppercase: boolean;
  centred: boolean;
  preset: { indent: number; width: number; uppercase: boolean; centred: boolean };
  /** Which of the four the writer changed. */
  changed: (keyof ElementOverride)[];
}

/**
 * The inspector's rows: every element this format writes, read from the
 * layout in force and from the bare preset, so each row can say what it is
 * and what *Restore defaults* would put back.
 */
export const elementGeometry = (file: ProjectFile): ElementGeometry[] => {
  const live = layoutForFile(file);
  const preset = layoutFor(file.project.format, file.settings.paragraphStyle, file.settings.scriptFormat);
  const own = formatOverridesOf(file).elements;
  const read = (layout: typeof live, type: string) => ({
    indent: layout.indent[type] ?? 0,
    width: layout.width[type] ?? layout.columns,
    uppercase: layout.uppercase.has(type),
    centred: layout.centred?.has(type) ?? false,
  });
  return elementTypesFor(file.project.format)
    .filter((type) => type !== 'figure')
    .map((type) => ({
      type,
      ...read(live, type),
      preset: read(preset, type),
      changed: (Object.keys(own[type] ?? {}) as (keyof ElementOverride)[]).filter(
        (key) => own[type]?.[key] !== undefined,
      ),
    }));
};

/**
 * A change to one element. A value equal to the preset's is **not** a
 * change, and is stored as nothing — so setting a cue back to where the
 * preset had it leaves no override behind, and the row stops saying it was
 * changed.
 */
export const withElementOverride = (
  file: ProjectFile,
  type: string,
  patch: Partial<Record<keyof ElementOverride, number | boolean | null>>,
): FormatOverrides => {
  const current = formatOverridesOf(file);
  const preset = elementGeometry({ ...file, settings: { ...file.settings, formatOverrides: { templateName: '', elements: {} } } }).find(
    (row) => row.type === type,
  );
  const next: Record<string, unknown> = { ...(current.elements[type] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    const same = preset && value === preset[key as keyof ElementOverride];
    if (value === null || same) delete next[key];
    else next[key] = value;
  }
  const elements = { ...current.elements };
  if (Object.keys(next).length === 0) delete elements[type];
  else elements[type] = elementOverrideSchema.parse(next);
  return { ...current, elements };
};

/** The project's page as a template, under the name the writer gives it. */
export const templateFromFile = (file: ProjectFile, name: string, id: string, now: string): CustomTemplate =>
  customTemplateSchema.parse({
    id,
    name: name.trim(),
    base: scriptFormatOf(file.project.format, file.settings.scriptFormat),
    elements: formatOverridesOf(file).elements,
    savedAt: now,
  });

/**
 * Whether a template can be used on this project: its preset has to be one
 * this format is offered (`scriptFormatsFor`) — a play's template on a
 * screenplay would be the play's house style on a film page.
 */
export const templateFits = (file: ProjectFile, template: CustomTemplate): boolean =>
  scriptFormatsFor(file.project.format).includes(template.base as ScriptFormat);

/**
 * The library, with a template saved into it: a new name is added, and an
 * existing one — matched without regard to case — is **replaced**, which is
 * what saving over a template one has already made means.
 */
export const savedIntoLibrary = (library: readonly CustomTemplate[], template: CustomTemplate): CustomTemplate[] => {
  const key = template.name.trim().toLowerCase();
  const at = library.findIndex((one) => one.name.trim().toLowerCase() === key);
  if (at === -1) return [...library, template];
  return library.map((one, index) => (index === at ? { ...template, id: one.id } : one));
};

/** A library read from storage, with anything unreadable left out rather than thrown. */
export const libraryOf = (raw: unknown): CustomTemplate[] =>
  Array.isArray(raw)
    ? raw.flatMap((one) => {
        const parsed = customTemplateSchema.safeParse(one);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
