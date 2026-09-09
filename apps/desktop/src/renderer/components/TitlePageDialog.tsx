import { useRef, useState } from 'react';
import {
  MAX_TITLE_IMAGE_BYTES,
  setTitlePage,
  titlePageOf,
  type ProjectFile,
  type TitlePage,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface TitlePageDialogProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * The title page (spec §6.1), from **File → Title page**.
 *
 * It is a page of the document, not a heading over the work, which is the
 * whole point of it having a screen of its own: the writing screen never
 * shows it, and it prints only where Page setup asks for it.
 *
 * The page itself is drawn beside the fields, at the shape it will print. A
 * title page is a *layout* — where the title falls, what sits under it, what
 * is at the foot — and a column of labelled boxes tells you nothing about
 * whether it looks right.
 *
 * Left empty, the title and the name are the project's own, so a project made
 * five minutes ago already has a title page and nobody types their own name
 * twice.
 */
export function TitlePageDialog({ file, open, onClose, onUpdate }: TitlePageDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const stored = file.settings.titlePage;
  const page = titlePageOf(file.project, file.settings);
  const write = (patch: Partial<TitlePage>) => onUpdate((current) => setTitlePage(current, patch));

  /**
   * A logotype in place of the typed title. Held in the project as a data URI
   * so the page travels with the file: a title page that pointed at a folder
   * on one machine would print blank on the next.
   */
  const chooseImage = (list: FileList | null) => {
    const picked = list?.[0];
    if (!picked) return;
    if (picked.size > MAX_TITLE_IMAGE_BYTES) {
      setImageError(`That is ${(picked.size / (1024 * 1024)).toFixed(1)}MB. A title graphic holds up to 5MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageError(null);
      write({ titleImage: String(reader.result) });
    };
    reader.onerror = () => setImageError('That file could not be read.');
    reader.readAsDataURL(picked);
  };

  // Contact left, date right, the draft's note centred under both — the way
  // the reference page sets it.
  const centred = [page.revision, page.notes].filter((part) => part.length > 0);
  const hasFoot = page.contact.length > 0 || page.draftDate.length > 0 || centred.length > 0;

  return (
    <dialog ref={dialog} className="lane-dialog title-page-dialog" aria-label="Title page" onClose={onClose}>
      {open ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">Title page</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="title-page-layout">
            <div className="title-page-fields">
              <label className="field-row">
                <span>Title</span>
                <div className="title-art-picker">
                  {page.titleImage ? (
                    <div className="title-art-held">
                      <img src={page.titleImage} alt="The title graphic" />
                      <button
                        type="button"
                        className="ghost danger"
                        aria-label="Remove the title graphic"
                        title="Remove the graphic and go back to the typed title"
                        onClick={() => write({ titleImage: '' })}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <input
                      aria-label="Title"
                      value={stored.title}
                      placeholder={page.title}
                      onChange={(event) => write({ title: event.target.value })}
                    />
                  )}
                  <button type="button" className="ghost small" onClick={() => picker.current?.click()}>
                    {page.titleImage ? 'Replace graphic…' : 'Use a graphic…'}
                  </button>
                  <input
                    ref={picker}
                    type="file"
                    accept="image/*"
                    className="visually-hidden"
                    aria-label="Choose a title graphic"
                    onChange={(event) => {
                      chooseImage(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </div>
              </label>
              {imageError ? (
                <p className="error small" role="alert">
                  {imageError}
                </p>
              ) : null}
              {page.titleImage ? (
                <p className="muted small">
                  The graphic prints in place of the title — it <em>is</em> the title, so the words are not set under
                  it as well.
                </p>
              ) : null}

              <Field label="Episode" value={stored.episode} placeholder="Episode 4 — The Lamp" onChange={(episode) => write({ episode })} />
              <Field label="Credit" value={stored.credit} placeholder="written by" onChange={(credit) => write({ credit })} />
              <Field
                label="Author"
                value={stored.author}
                placeholder={page.author || 'Your name'}
                onChange={(author) => write({ author })}
              />
              <Field
                label="Source"
                value={stored.source}
                placeholder="based on the novel by…"
                onChange={(source) => write({ source })}
              />
              <Field
                label="Contact"
                value={stored.contact}
                placeholder="Agent, telephone, email"
                lines={4}
                onChange={(contact) => write({ contact })}
              />
              <Field
                label="Draft date"
                value={stored.draftDate}
                placeholder="12 March 2026"
                onChange={(draftDate) => write({ draftDate })}
                action={{
                  label: 'Today',
                  onPick: () =>
                    write({
                      draftDate: new Date().toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }),
                    }),
                }}
              />
              <Field label="Revision" value={stored.revision} placeholder="Second draft" onChange={(revision) => write({ revision })} />
              <Field
                label="Notes"
                value={stored.notes}
                placeholder="Final production draft"
                lines={3}
                onChange={(notes) => write({ notes })}
              />
            </div>

            {/* The page at the shape it prints, so the layout can be judged. */}
            <div className="title-page-preview" aria-label="The title page as it will print">
              <div className="title-page-sheet">
                <div className="sheet-block">
                  {page.titleImage ? (
                    <img className="sheet-art" src={page.titleImage} alt="" />
                  ) : (
                    <h1>{page.title || 'Untitled'}</h1>
                  )}
                  {page.episode ? <p className="sheet-episode">{page.episode}</p> : null}
                  {page.author ? (
                    <>
                      <p className="sheet-credit">{page.credit}</p>
                      <p className="sheet-author">{page.author}</p>
                    </>
                  ) : null}
                  {page.source ? <p className="sheet-source">{page.source}</p> : null}
                </div>
                {hasFoot ? (
                  <div className="sheet-foot">
                    <div className="sheet-foot-row">
                      <p>{lines(page.contact)}</p>
                      <p className="right">{lines(page.draftDate)}</p>
                    </div>
                    {centred.length > 0 ? <p className="sheet-note">{lines(centred.join('\n'))}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <footer className="lane-dialog-foot">
            <p className="muted small">
              The writing screen never shows this. It prints when <strong>Title page</strong> is ticked in File → Page
              setup.
            </p>
            <button type="button" className="primary" onClick={onClose}>
              Done
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}

/** Several lines in one field are several lines on the page. */
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => (
      <span key={`${index}-${line}`} className="sheet-line">
        {line}
      </span>
    ));

function Field({
  label,
  value,
  placeholder,
  onChange,
  lines: rows = 1,
  action,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange(next: string): void;
  lines?: number;
  /** A shortcut beside the box, where one obvious answer exists. */
  action?: { label: string; onPick(): void };
}) {
  return (
    <label className="field-row">
      <span>{label}</span>
      <div className="field-input">
        {rows > 1 ? (
          <textarea
            rows={rows}
            aria-label={label}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            aria-label={label}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        {action ? (
          <button type="button" className="ghost small" onClick={action.onPick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </label>
  );
}
