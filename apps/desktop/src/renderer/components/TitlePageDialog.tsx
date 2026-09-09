import { useEffect, useRef, useState } from 'react';
import {
  MAX_TITLE_IMAGE_BYTES,
  setEpisodeTitlePage,
  setTitlePage,
  titlePageOf,
  titlePageSchema,
  type Episode,
  type ProjectFile,
  type TitlePage,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface TitlePageDialogProps {
  file: ProjectFile;
  open: boolean;
  /**
   * The episode this page belongs to, where it belongs to one. Absent, the
   * page is the project's; given, it is that episode's own, falling back to
   * the series' field by field (addendum 02 §17).
   */
  episode?: Episode | null;
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
 *
 * Unlike the rest of the application, this screen does **not** save as you
 * type. What is typed is a draft, drawn on the sheet as it goes; **Update
 * page** puts it in the document and **Cancel** throws it away. A title page
 * is the front of a thing that goes out to people, and trying a credit line
 * on for size should not be the same act as changing it.
 */
export function TitlePageDialog({ file, open, episode, onClose, onUpdate }: TitlePageDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // An episode's page, or the project's. An episode that has never been
  // filled in starts from the series' rather than from nothing.
  const saved = episode ? (episode.marker.titlePage ?? titlePageSchema.parse({})) : file.settings.titlePage;
  /**
   * What is being typed, which is not yet what the document says. Started
   * afresh each time the screen opens, so a cancelled edit is not waiting
   * there the next time it is opened.
   */
  const [stored, setStored] = useState<TitlePage>(saved);
  useEffect(() => {
    if (open) setStored(saved);
    // Only when the screen opens: re-reading it on every keystroke of the
    // draft would undo the typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const write = (patch: Partial<TitlePage>) => setStored((current) => ({ ...current, ...patch }));
  // The sheet is drawn from the draft, so it shows what Update page would do.
  const page = episode
    ? titlePageOf(file.project, file.settings, stored)
    : titlePageOf(file.project, { ...file.settings, titlePage: stored });

  const cancel = () => {
    setStored(saved);
    onClose();
  };

  const commit = () => {
    onUpdate((current) =>
      episode ? setEpisodeTitlePage(current, episode.marker.id, stored) : setTitlePage(current, stored),
    );
    onClose();
  };

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
    <dialog ref={dialog} className="lane-dialog title-page-dialog" aria-label="Title page" onClose={cancel}>
      {open ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">
              {episode ? `${episode.label} — title page` : 'Title page'}
            </span>
            {/* The × is Cancel: closing without saying "update" keeps the
                page the document already has. */}
            <button type="button" className="ghost" aria-label="Close without saving" onClick={cancel}>
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
              {/* The page sets the words "Written" and "by" above this, so
                  the field holds the name and nothing else. */}
              <Field
                label="Written by"
                value={stored.author}
                placeholder={page.author || 'Your name'}
                onChange={(author) => write({ author })}
              />
              <Field
                label="Source"
                value={stored.source}
                placeholder="based on the novel"
                onChange={(source) => write({ source })}
              />
              <Field
                label="Source author"
                value={stored.sourceAuthor}
                placeholder="Daniel Wallace"
                onChange={(sourceAuthor) => write({ sourceAuthor })}
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
                </div>
                <div className="sheet-credit-block">
                  {page.author ? (
                    <>
                      <p className="sheet-credit">Written</p>
                      <p className="sheet-by">by</p>
                      <p className="sheet-author">{page.author}</p>
                    </>
                  ) : null}
                  {page.source ? <p className="sheet-source">{page.source}</p> : null}
                  {page.sourceAuthor ? (
                    <>
                      <p className="sheet-by">by</p>
                      <p className="sheet-author">{page.sourceAuthor}</p>
                    </>
                  ) : null}
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
              {episode
                ? 'Anything left empty is the series’ own. The writing screen never shows this; it prints with the episode.'
                : 'The writing screen never shows this. It prints when Print the title page is ticked in File → Page setup.'}
            </p>
            <div className="dialog-buttons">
              <button type="button" className="ghost" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={commit}>
                Update page
              </button>
            </div>
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
