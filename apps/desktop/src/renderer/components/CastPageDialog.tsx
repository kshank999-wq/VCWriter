import { useEffect, useMemo, useState } from 'react';
import {
  castInPageOrder,
  castPageOf,
  castPageSettingsOf,
  castingOf,
  scriptFormatOf,
  setCastPage,
  setCasting,
  type CastPageSettings,
  type Casting,
  type CharacterId,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { CastSheet } from './CastSheet';

interface CastPageDialogProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * **The cast page** (addendum 38 §4), from **File → Cast page…**.
 *
 * The title page's screen for the page after it: the fields on the left, the
 * page as it prints on the right, and nothing saved until **Update page** —
 * a cast page goes out with the play, and trying a line about somebody on
 * for size should not be the same act as changing it.
 *
 * The roles are the characters, in the order the page lists them, so there
 * is no name to type here: each row is the line under a name, a playing age,
 * a vocal range on a musical, who the role is doubled with, and the tick that
 * lists it. A role taken off keeps everything typed for it.
 */
export function CastPageDialog({ file, open, onClose, onUpdate }: CastPageDialogProps) {
  const dialog = useModal(open);
  const people = useMemo(() => castInPageOrder(file), [file]);
  const savedPage = castPageSettingsOf(file);

  const [page, setPage] = useState<CastPageSettings>(savedPage);
  const [castings, setCastings] = useState<Record<string, Casting>>({});
  useEffect(() => {
    if (!open) return;
    setPage(castPageSettingsOf(file));
    setCastings({});
    // Only when the screen opens: re-reading on every keystroke would undo it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const castingFor = (id: CharacterId): Casting =>
    castings[id as string] ?? castingOf(file.characters.find((one) => one.id === id) ?? {});
  const writeCasting = (id: CharacterId, patch: Partial<Casting>) =>
    setCastings((current) => ({ ...current, [id as string]: { ...castingFor(id), ...patch } }));
  const writePage = (patch: Partial<CastPageSettings>) => setPage((current) => ({ ...current, ...patch }));

  // The sheet is drawn from the draft, so it shows what Update page would do.
  const draft: ProjectFile = {
    ...file,
    settings: { ...file.settings, castPage: page },
    characters: file.characters.map((one) =>
      castings[one.id as string] ? { ...one, casting: castings[one.id as string] as Casting } : one,
    ),
  };
  const sheet = castPageOf(draft);
  // The range is a musical's; on a play without songs it is shown only where
  // somebody has already filled one in.
  const musical =
    scriptFormatOf(file.project.format, file.settings.scriptFormat) === 'stage_us_musical' ||
    people.some((one) => castingFor(one.id).vocalRange.trim().length > 0);

  const cancel = () => onClose();
  const commit = () => {
    onUpdate((current) =>
      Object.entries(castings).reduce(
        (next, [id, casting]) =>
          next.characters.some((one) => one.id === id) ? setCasting(next, id as CharacterId, casting) : next,
        setCastPage(current, page),
      ),
    );
    onClose();
  };

  return (
    <dialog ref={dialog} className="track-dialog title-page-dialog cast-page-dialog" aria-label="Cast page" onClose={cancel}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Cast page</span>
            <button type="button" className="ghost" aria-label="Close without saving" onClick={cancel}>
              ×
            </button>
          </header>

          <div className="title-page-layout">
            <div className="title-page-fields">
              <label className="field-row">
                <span>Heading</span>
                <div className="field-input">
                  <input
                    aria-label="Heading"
                    value={page.heading}
                    placeholder="Characters"
                    onChange={(event) => writePage({ heading: event.target.value })}
                  />
                </div>
              </label>
              <div className="field-row" role="radiogroup" aria-label="Order">
                <span>Order</span>
                <div className="field-input cast-order">
                  <label>
                    <input
                      type="radio"
                      name="cast-order"
                      checked={page.order === 'appearance'}
                      onChange={() => writePage({ order: 'appearance' })}
                    />{' '}
                    As they enter
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="cast-order"
                      checked={page.order === 'importance'}
                      onChange={() => writePage({ order: 'importance' })}
                    />{' '}
                    By the cast’s headings
                  </label>
                </div>
              </div>

              <div className="cast-roles-edit" aria-label="The roles">
                {people.length === 0 ? (
                  <p className="muted small">
                    Nobody yet. Everyone who speaks in the play joins the cast, and is listed here.
                  </p>
                ) : null}
                {people.map((person) => {
                  const casting = castingFor(person.id);
                  return (
                    <fieldset key={person.id} className={casting.include ? 'cast-role' : 'cast-role off'}>
                      <legend>
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`List ${person.name}`}
                            checked={casting.include}
                            onChange={(event) => writeCasting(person.id, { include: event.target.checked })}
                          />{' '}
                          {person.name.toUpperCase()}
                        </label>
                      </legend>
                      <input
                        aria-label={`${person.name}: the line under the name`}
                        value={casting.description}
                        placeholder="her brother, a schoolteacher"
                        onChange={(event) => writeCasting(person.id, { description: event.target.value })}
                      />
                      <div className="cast-role-facts">
                        <input
                          aria-label={`${person.name}: playing age`}
                          value={casting.playingAge}
                          placeholder="Playing age: 40s"
                          onChange={(event) => writeCasting(person.id, { playingAge: event.target.value })}
                        />
                        {musical ? (
                          <input
                            aria-label={`${person.name}: vocal range`}
                            value={casting.vocalRange}
                            placeholder="Range: mezzo-soprano"
                            onChange={(event) => writeCasting(person.id, { vocalRange: event.target.value })}
                          />
                        ) : null}
                        <select
                          aria-label={`${person.name}: doubled with`}
                          value={(casting.doubles as string | null) ?? ''}
                          onChange={(event) =>
                            writeCasting(person.id, {
                              doubles: event.target.value ? (event.target.value as CharacterId) : null,
                            })
                          }
                        >
                          <option value="">Not doubled</option>
                          {people
                            .filter((other) => other.id !== person.id)
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                Doubles {other.name.toUpperCase()}
                              </option>
                            ))}
                        </select>
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <label className="field-row">
                <span>Time</span>
                <div className="field-input">
                  <input
                    aria-label="Time"
                    value={page.time}
                    placeholder="The present. Late autumn."
                    onChange={(event) => writePage({ time: event.target.value })}
                  />
                </div>
              </label>
              <label className="field-row">
                <span>Place</span>
                <div className="field-input">
                  <input
                    aria-label="Place"
                    value={page.place}
                    placeholder="A kitchen in Duluth."
                    onChange={(event) => writePage({ place: event.target.value })}
                  />
                </div>
              </label>
              <label className="field-row">
                <span>Notes</span>
                <div className="field-input">
                  <textarea
                    rows={2}
                    aria-label="Notes"
                    value={page.notes}
                    placeholder="The play runs without an interval."
                    onChange={(event) => writePage({ notes: event.target.value })}
                  />
                </div>
              </label>
            </div>

            <div className="title-page-preview" aria-label="The cast page as it will print">
              <CastSheet page={sheet} />
            </div>
          </div>

          <footer className="track-dialog-foot">
            <p className="muted small">
              It prints after the title page when Print the cast page is ticked in File → Page setup.
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
