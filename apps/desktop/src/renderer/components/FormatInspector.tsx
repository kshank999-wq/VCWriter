import { useMemo, useState } from 'react';
import {
  applyCustomTemplate,
  elementGeometry,
  formatOverridesOf,
  hasFormatOverrides,
  layoutForFile,
  libraryOf,
  manuscriptElementSchema,
  nameFormatOverrides,
  paginateElements,
  restoreFormatDefaults,
  savedIntoLibrary,
  scriptFormatOf,
  setElementOverride,
  templateFits,
  templateFromFile,
  type CustomTemplate,
  type ManuscriptElementType,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { usePreference } from '../use-split';
import { SCRIPT_FORMAT_WORDS } from './PageSetup';

interface FormatInspectorProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** What each element is called in the inspector. */
const ELEMENT_WORDS: Record<string, string> = {
  scene_heading: 'Scene heading',
  action: 'Stage direction / action',
  character: 'Character cue',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  song_title: 'Song title',
  lyric: 'Lyric',
  music_cue: 'Music cue',
  dance: 'Dance',
};

/**
 * A number typed into a box, or nothing: a box cleared on the way to a new
 * value is not a request for column 0, and a width below one is not a width.
 */
const whole = (value: number, least: number, then: (value: number) => void) => {
  if (Number.isFinite(value) && value >= least) then(Math.round(value));
};

/** A short page that has one of everything, set the way the project is set. */
const SAMPLE: [ManuscriptElementType, string][] = [
  ['scene_heading', 'Scene One'],
  ['action', 'A kitchen. The bell rings, and nobody moves.'],
  ['character', 'Sarah'],
  ['parenthetical', 'quietly'],
  ['dialogue', 'You came, and I did not think you would.'],
  // Only where the layout has a place for one: a play's.
  ['lyric', 'Out of the rain\nand into the light'],
  ['character', 'Tom'],
  ['dialogue', 'Somebody had to.'],
];

/**
 * **Customise the house style** (addendum 39, Ken's spec §1 and §7): the
 * per-element override inspector, *Restore defaults*, and *Save as custom
 * template*, from **Page setup ▸ Customise…**.
 *
 * Every change goes into the document as it is made — Page setup's own rule,
 * the script format beside it being a choice that applies at once — and is
 * undone like any other. A row the writer has changed says so, with what the
 * preset had beside it, so nothing about the page is a mystery a month later.
 *
 * The page is drawn beside the controls from the layout in force, which is
 * the one the print, the PDF and the Word export read.
 */
export function FormatInspector({ file, open, onClose, onUpdate }: FormatInspectorProps) {
  const dialog = useModal(open);
  const [stored, setStored] = usePreference<unknown>('formatTemplates', []);
  const library = useMemo(() => libraryOf(stored), [stored]);
  const [naming, setNaming] = useState('');
  const [said, setSaid] = useState<string | null>(null);

  const rows = elementGeometry(file);
  const overrides = formatOverridesOf(file);
  const base = scriptFormatOf(file.project.format, file.settings.scriptFormat);
  const changed = hasFormatOverrides(file);
  const layout = layoutForFile(file);

  const sample = useMemo(() => {
    const elements = SAMPLE.filter(([type]) => layout.indent[type] !== undefined).map(([type, text], at) =>
      manuscriptElementSchema.parse({ id: `00000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`, type, text }),
    );
    return paginateElements(elements, layout)[0]?.lines ?? [];
  }, [layout]);

  const set = (type: string, patch: Parameters<typeof setElementOverride>[2]) =>
    onUpdate((current) => setElementOverride(current, type, patch));

  const save = () => {
    const name = naming.trim();
    if (!name) return;
    const template = templateFromFile(file, name, crypto.randomUUID(), new Date().toISOString());
    const replacing = library.some((one) => one.name.trim().toLowerCase() === name.toLowerCase());
    setStored(savedIntoLibrary(library, template));
    onUpdate((current) => nameFormatOverrides(current, name));
    setNaming('');
    setSaid(replacing ? `Saved over ${name}.` : `Saved ${name} to your templates on this computer.`);
  };

  const apply = (template: CustomTemplate) => {
    onUpdate((current) => applyCustomTemplate(current, template));
    setSaid(`${template.name} applied.`);
  };

  const remove = (template: CustomTemplate) => {
    setStored(library.filter((one) => one.id !== template.id));
    setSaid(`${template.name} removed from your templates. Projects already set in it keep their page.`);
  };

  return (
    <dialog ref={dialog} className="track-dialog format-inspector" aria-label="Customise the script format" onClose={onClose}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">
              Customise — {overrides.templateName || SCRIPT_FORMAT_WORDS[base].label}
            </span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="format-inspector-body">
            <div className="format-inspector-controls">
              <p className="muted small">
                Built on <strong>{SCRIPT_FORMAT_WORDS[base].label}</strong>. Columns are characters of twelve-point
                Courier, ten to the inch, counted from the left margin.
              </p>
              <table className="format-rows">
                <thead>
                  <tr>
                    <th>Element</th>
                    <th>Indent</th>
                    <th>Width</th>
                    <th>Capitals</th>
                    <th>Centred</th>
                    <th aria-label="Put back" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const name = ELEMENT_WORDS[row.type] ?? row.type.replace(/_/g, ' ');
                    const differs = row.changed.length > 0;
                    return (
                      <tr key={row.type} className={differs ? 'changed' : ''}>
                        <th scope="row">{name}</th>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={layout.columns - 1}
                            aria-label={`${name} indent`}
                            value={row.indent}
                            title={`The preset's: ${row.preset.indent}`}
                            onChange={(event) => whole(event.target.valueAsNumber, 0, (indent) => set(row.type, { indent }))}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={layout.columns}
                            aria-label={`${name} width`}
                            value={row.width}
                            title={`The preset's: ${row.preset.width}`}
                            onChange={(event) => whole(event.target.valueAsNumber, 1, (width) => set(row.type, { width }))}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${name} in capitals`}
                            checked={row.uppercase}
                            onChange={(event) => set(row.type, { uppercase: event.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${name} centred`}
                            checked={row.centred}
                            onChange={(event) => set(row.type, { centred: event.target.checked })}
                          />
                        </td>
                        <td>
                          {differs ? (
                            <button
                              type="button"
                              className="ghost small"
                              aria-label={`Put ${name} back as the preset has it`}
                              title={`Put back: indent ${row.preset.indent}, width ${row.preset.width}`}
                              onClick={() =>
                                set(row.type, { indent: null, width: null, uppercase: null, centred: null })
                              }
                            >
                              ↺
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="format-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={!changed}
                  onClick={() => {
                    onUpdate((current) => restoreFormatDefaults(current));
                    setSaid(`Back to ${SCRIPT_FORMAT_WORDS[base].label} as bundled.`);
                  }}
                >
                  Restore defaults
                </button>
              </div>

              <h4>Save as custom template</h4>
              <div className="format-save">
                <input
                  aria-label="Template name"
                  value={naming}
                  placeholder={overrides.templateName || 'Lyric Theatre submissions'}
                  onChange={(event) => setNaming(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') save();
                  }}
                />
                <button type="button" className="primary" disabled={naming.trim().length === 0} onClick={save}>
                  Save template
                </button>
              </div>
              <p className="muted small">
                Templates are kept on this computer, for your next play. The page itself is kept in the project, so
                anyone opening it sees the same thing.
              </p>
              {said ? (
                <p className="small" role="status">
                  {said}
                </p>
              ) : null}

              {library.length > 0 ? (
                <ul className="format-library" aria-label="Your templates">
                  {library.map((template) => {
                    const fits = templateFits(file, template);
                    return (
                      <li key={template.id}>
                        <span className="format-library-name">{template.name}</span>
                        <span className="muted small">
                          {SCRIPT_FORMAT_WORDS[template.base]?.label ?? template.base} ·{' '}
                          {Object.keys(template.elements).length} changed
                        </span>
                        <button
                          type="button"
                          className="ghost small"
                          disabled={!fits}
                          title={fits ? 'Set this project in it' : 'Made for another kind of script'}
                          onClick={() => apply(template)}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="ghost small danger"
                          aria-label={`Remove ${template.name}`}
                          onClick={() => remove(template)}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="format-sample" aria-label="A sample page, set as the project is set">
              <div className={layout.paper === 'a4' ? 'format-sheet a4' : 'format-sheet'} style={{ width: `${layout.columns}ch` }}>
                {sample.map((line, at) => (
                  <div
                    key={at}
                    className="format-line"
                    style={
                      line.centred
                        ? { paddingLeft: `${line.indent}ch`, width: `${line.width}ch`, textAlign: 'center' }
                        : { paddingLeft: `${line.indent}ch` }
                    }
                  >
                    {line.text || ' '}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
