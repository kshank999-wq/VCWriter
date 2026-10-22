import { useEffect, useMemo, useState } from 'react';
import {
  REFERENCE_TYPE_NAMES,
  addReference,
  occurrencesIn,
  citationSettingsOf,
  formatNote,
  locatorKindSchema,
  noteFormOf,
  referenceCreator,
  referencesOf,
  updateReference,
  usesFootnotes,
  formatInText,
  type Citation,
  type LocatorKind,
  type ProjectFile,
  type ReferenceId,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';
import { ReferenceForm } from './ReferenceForm';

/**
 * **Insert Citation**, and the same dialog for a citation already in the text
 * (addendum 43, spec §2 and §4).
 *
 * Search the library and pick a source, or make a new one here without
 * leaving the line; add the pinpoint (a page, a section, a time) and any note
 * of your own; see the note as it will print. For a citation already placed,
 * the same dialog changes its source, pinpoint or note, opens the source to
 * edit (every citation of it changes with it), or takes the citation out.
 */

const LOCATOR_NAMES: Record<LocatorKind, string> = {
  page: 'Page',
  pages: 'Pages',
  section: 'Section',
  chapter: 'Chapter',
  paragraph: 'Paragraph',
  timestamp: 'Time',
  other: 'Other',
};

export interface CitationChoice {
  referenceId: ReferenceId;
  locatorKind: LocatorKind;
  locator: string;
  note: string;
}

interface CitationDialogProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** A citation already in the text, to change; absent when inserting. */
  citation?: Citation | null;
  /** Its key, when the citation's record is missing: the token is shown as needing a source. */
  missingKey?: string | null;
  /** The word-processor document being cited in (addendum 43 §11); absent in the story. */
  documentId?: string | null;
  onDone(choice: CitationChoice): void;
  onRemove?(): void;
  onClose(): void;
}

export function CitationDialog({ file, onUpdate, citation = null, missingKey = null, documentId = null, onDone, onRemove, onClose }: CitationDialogProps) {
  const [query, setQuery] = useState('');
  const [referenceId, setReferenceId] = useState<ReferenceId | null>((citation?.referenceId as ReferenceId | undefined) ?? null);
  const [locatorKind, setLocatorKind] = useState<LocatorKind>(citation?.locatorKind ?? 'page');
  const [locator, setLocator] = useState(citation?.locator ?? '');
  const [note, setNote] = useState(citation?.note ?? '');
  const [editing, setEditing] = useState<ReferenceId | null>(null);

  const found = useMemo(() => referencesOf(file, { query }), [file, query]);
  const chosen = file.references.find((reference) => reference.id === referenceId) ?? null;
  const settings = citationSettingsOf(file);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [onClose]);

  /** The note as it will print, for the source chosen: a first note in full where this is its first citation. */
  const preview = useMemo(() => {
    if (!chosen) return null;
    const pin = { locatorKind, locator, note };
    if (!usesFootnotes(settings)) return formatInText(chosen, pin, settings.style === 'apa' ? 'apa' : 'mla');
    // A document counts its notes on its own, so only its own citations come earlier.
    const earlier = occurrencesIn(file, documentId).some((occurrence) => occurrence.reference?.id === chosen.id && occurrence.citation?.id !== citation?.id);
    return formatNote(chosen, pin, noteFormOf(settings), !earlier);
  }, [chosen, locatorKind, locator, note, settings, file, citation, documentId]);

  const newSource = () => {
    // Made here, so it can be chosen at once; the same record goes into the project.
    const made = addReference(file, { title: query.trim() }).reference;
    onUpdate((current) => ({ ...current, references: [...current.references, made] }));
    setReferenceId(made.id);
    setEditing(made.id);
  };

  const editingReference = editing ? file.references.find((reference) => reference.id === editing) ?? null : null;

  return (
    <div className="cite-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cite-dialog" role="dialog" aria-modal="true" aria-label={citation || missingKey ? 'Citation' : 'Insert citation'}>
        <header>
          <h2>{citation || missingKey ? 'Citation' : 'Insert citation'}</h2>
          <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        {missingKey && !citation ? (
          <p className="cite-warning" role="alert">
            This citation’s record is missing. Choose its source again, or take it out.
          </p>
        ) : null}

        {editingReference ? (
          <section className="cite-edit-source" aria-label="Edit source">
            <p className="muted small">Every citation of this source changes with it.</p>
            <ReferenceForm reference={editingReference} onChange={(patch) => onUpdate((current) => updateReference(current, editingReference.id, patch))} />
            <div className="cite-actions">
              <button type="button" onClick={() => setEditing(null)}>
                Done with the source
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="cite-search">
              <input
                autoFocus
                type="search"
                aria-label="Search the library"
                placeholder="Search by author, title, short code or tag"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" onClick={newSource} title="A new source in the library, named by what you typed">
                New source…
              </button>
            </div>
            <ul className="cite-results" role="listbox" aria-label="Sources">
              {found.length === 0 ? (
                <li className="muted small">{file.references.length === 0 ? 'The library is empty. Make the first source with New source…' : 'Nothing matches.'}</li>
              ) : null}
              {found.map((reference) => (
                <li key={reference.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={reference.id === referenceId}
                    className={reference.id === referenceId ? 'chosen' : ''}
                    onClick={() => setReferenceId(reference.id)}
                    onDoubleClick={() => {
                      setReferenceId(reference.id);
                      onDone({ referenceId: reference.id, locatorKind, locator, note });
                    }}
                  >
                    <span className="cite-who">{referenceCreator(reference) || '—'}</span>
                    <span className="cite-title">{reference.title || 'Untitled source'}</span>
                    <span className="cite-meta muted small">
                      {[REFERENCE_TYPE_NAMES[reference.type], reference.date.slice(0, 4), reference.shortCode].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="cite-pin">
              <span className="cite-pin-name" aria-hidden="true">
                Pinpoint
              </span>
              <span>
                <select aria-label="Pinpoint kind" value={locatorKind} onChange={(event) => setLocatorKind(event.target.value as LocatorKind)}>
                  {locatorKindSchema.options.map((kind) => (
                    <option key={kind} value={kind}>
                      {LOCATOR_NAMES[kind]}
                    </option>
                  ))}
                </select>
              </span>
              <input aria-label="Pinpoint" placeholder={locatorKind === 'timestamp' ? '12:30' : locatorKind === 'pages' ? '12-15' : '12'} value={locator} onChange={(event) => setLocator(event.target.value)} />
            </div>
            <label className="cite-note">
              <span>Your note</span>
              <textarea aria-label="Your note" rows={2} placeholder="Words of your own after the source (optional)" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>

            {preview ? (
              <p className="cite-preview" aria-label="As it will print">
                <span className="muted small">{usesFootnotes(settings) ? 'The note: ' : 'In the text: '}</span>
                <InlineText text={preview} />
              </p>
            ) : null}

            <footer>
              {onRemove ? (
                <button type="button" className="ghost danger" onClick={onRemove} title="Take the citation out of the text. The source stays in the library.">
                  Remove citation
                </button>
              ) : null}
              {chosen ? (
                <button type="button" className="ghost" onClick={() => setEditing(chosen.id)}>
                  Edit source…
                </button>
              ) : null}
              <span className="spacer" />
              <button type="button" className="ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!referenceId}
                onClick={() => referenceId && onDone({ referenceId, locatorKind, locator, note })}
              >
                {citation || missingKey ? 'Save' : 'Insert'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
