import { useMemo, useRef, useState } from 'react';
import {
  PROJECT_STATUSES,
  asDuration,
  clearPoster,
  describeGaps,
  oneSheet,
  projectHome,
  setPoster,
  setProjectDetails,
  statusName,
  type BeatId,
  type ProjectFile,
  type ProjectStatus,
} from '@vcwriter/domain';
import { PICTURE_ACCEPT, pictureRefusal } from '../read-picture';

/**
 * The project home (master spec §4, addendum 17).
 *
 * Two halves of one page. On the left, **what the writer has said about the
 * work** — the seven fields that have been in the schema since the beginning
 * and have never had anywhere to be typed. On the right, **what the document
 * says about itself**: every figure counted when the page is drawn, none of it
 * stored.
 *
 * The figures are deliberately not framed as targets. *Nineteen of forty
 * written* is a fact; *48% complete* with a bar creeping toward a goal is the
 * software having an opinion about somebody's morning.
 */
interface ProjectHomePanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Go back to the writing, at the beat the reading points to. */
  onGoToBeat?(beatId: BeatId): void;
  /** Go and look at the research nothing points at (§4's unresolved items). */
  onShowUnusedResearch?(): void;
  /** Go and look at the setups with no payoff. */
  onShowSetups?(): void;
  /** Print the one-sheet, and save it as a PDF (§4). */
  onPrintOneSheet?(): void;
  onExportOneSheet?(): void;
  /** True while a document is being made, so the buttons say so. */
  busy?: boolean;
  /** What went wrong, where something did. */
  message?: string | null;
}

/** Reads a chosen picture into a data URI and its own dimensions. */
const readPicture = (file: File): Promise<{ data: string; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const data = String(reader.result ?? '');
      const image = new Image();
      image.onload = () => resolve({ data, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ data, width: 0, height: 0 });
      image.src = data;
    };
    reader.readAsDataURL(file);
  });

export function ProjectHomePanel({
  file,
  onUpdate,
  onGoToBeat,
  onShowUnusedResearch,
  onShowSetups,
  onPrintOneSheet,
  onExportOneSheet,
  busy = false,
  message = null,
}: ProjectHomePanelProps) {
  const home = useMemo(() => projectHome(file), [file]);
  const gaps = useMemo(() => describeGaps(file), [file]);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const write = (patch: Parameters<typeof setProjectDetails>[1]) =>
    onUpdate((current) => setProjectDetails(current, patch));

  const takePoster = async (chosen: FileList | null) => {
    const one = chosen?.[0];
    if (!one || pictureRefusal(one)) return;
    try {
      const read = await readPicture(one);
      onUpdate((current) => setPoster(current, { name: one.name, ...read }).file);
    } catch {
      // A picture that will not read leaves the poster as it was.
    }
  };

  return (
    <div className="home">
      <section className="home-details">
        <div className="panel-header">
          <h3>The project</h3>
          <span className="muted small">Everything here is yours to write. Nothing reads it but the one-sheet.</span>
        </div>

        <label className="field">
          <span>Title</span>
          <input
            aria-label="Project title"
            value={home.details.title}
            onChange={(event) => write({ title: event.target.value })}
          />
        </label>

        <div className="home-pair">
          <label className="field">
            <span>Author</span>
            <input
              aria-label="Author"
              placeholder="Whose work this is"
              value={home.details.author}
              onChange={(event) => write({ author: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Genre</span>
            <input
              aria-label="Genre"
              placeholder="Thriller, memoir, textbook…"
              value={home.details.genre}
              onChange={(event) => write({ genre: event.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>Logline</span>
          <textarea
            aria-label="Logline"
            rows={2}
            placeholder="The whole story in a sentence"
            value={home.details.logline}
            onChange={(event) => write({ logline: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Elevator pitch</span>
          <textarea
            aria-label="Elevator pitch"
            rows={3}
            placeholder="What you would say in the time it takes to go up four floors"
            value={home.details.elevatorPitch}
            onChange={(event) => write({ elevatorPitch: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Synopsis</span>
          <textarea
            aria-label="Synopsis"
            rows={6}
            placeholder="What happens, in as much as somebody needs"
            value={home.details.synopsis}
            onChange={(event) => write({ synopsis: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            aria-label="Project notes"
            rows={3}
            placeholder="Anything about the project rather than the story"
            value={home.details.notes}
            onChange={(event) => write({ notes: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Status</span>
          <select
            aria-label="Project status"
            value={home.details.status}
            onChange={(event) => write({ status: event.target.value as ProjectStatus })}
          >
            {PROJECT_STATUSES.map((one) => (
              <option key={one} value={one}>
                {statusName(one)}
              </option>
            ))}
          </select>
        </label>
        {/* Said plainly, because the control invites the opposite assumption. */}
        <p className="muted small">
          Nothing in the application reads the status. It is here so you can say where you are, not so the
          software can decide what you may do.
        </p>
      </section>

      <section className="home-side">
        {/* ------------------------------------------------ the key art */}
        <div
          className={dragging ? 'home-poster over' : 'home-poster'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void takePoster(event.dataTransfer.files);
          }}
        >
          {home.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={home.poster.data} alt={`Key art for ${home.details.title}`} />
          ) : (
            <p className="muted small">Drop key art here</p>
          )}
          <div className="home-poster-actions">
            <button type="button" className="ghost small" onClick={() => picker.current?.click()}>
              {home.poster ? 'Replace…' : 'Choose a picture…'}
            </button>
            {home.poster ? (
              <button
                type="button"
                className="ghost small"
                // Forgetting the poster is not deleting the picture (§4).
                title="The picture stays with the project"
                onClick={() => onUpdate((current) => clearPoster(current))}
              >
                Remove
              </button>
            ) : null}
            <input
              ref={picker}
              type="file"
              accept={PICTURE_ACCEPT}
              aria-label="Choose key art"
              style={{ display: 'none' }}
              onChange={(event) => {
                void takePoster(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        </div>

        {/* ------------------------------------------------ where you are */}
        <div className="home-card">
          <h4>Where you left off</h4>
          {home.where ? (
            <>
              <p className="home-where">{home.where.says}</p>
              <p className="muted small">{home.where.beatTitle}</p>
              {onGoToBeat ? (
                <button type="button" className="ghost small" onClick={() => onGoToBeat(home.where!.beatId)}>
                  Go back to it
                </button>
              ) : null}
            </>
          ) : (
            <p className="muted small">
              Nothing written yet. This says where the writing last happened, so it will fill itself in.
            </p>
          )}
        </div>

        {/* -------------------------------------------------- the figures */}
        <div className="home-card">
          <h4>Where it stands</h4>
          <dl className="home-figures">
            <dt>{home.nouns.unitPlural}</dt>
            <dd>{home.progress.units}</dd>
            <dt>{home.nouns.subPlural}</dt>
            <dd>
              {home.progress.written} of {home.progress.subs} written
            </dd>
            <dt>Words</dt>
            <dd>{home.progress.words.toLocaleString()}</dd>
            <dt>Assets</dt>
            <dd>{home.assets}</dd>
          </dl>
        </div>

        {/* ---------------------------------------------- what is waiting */}
        <div className="home-card">
          <h4>Still open</h4>
          {home.unresolved.research === 0 && home.unresolved.setups === 0 ? (
            <p className="muted small">Nothing is waiting.</p>
          ) : (
            <ul className="home-open">
              {home.unresolved.research > 0 ? (
                <li>
                  <span>
                    {home.unresolved.research} research{' '}
                    {home.unresolved.research === 1 ? 'note nothing' : 'notes nothing'} points at
                  </span>
                  {onShowUnusedResearch ? (
                    <button type="button" className="ghost small" onClick={onShowUnusedResearch}>
                      Look
                    </button>
                  ) : null}
                </li>
              ) : null}
              {home.unresolved.setups > 0 ? (
                <li>
                  <span>
                    {home.unresolved.setups} {home.unresolved.setups === 1 ? 'setup' : 'setups'} without a payoff
                  </span>
                  {onShowSetups ? (
                    <button type="button" className="ghost small" onClick={onShowSetups}>
                      Look
                    </button>
                  ) : null}
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {/* ------------------------------------------------- recent work */}
        <div className="home-card">
          <h4>Recent work</h4>
          {home.recent.days === 0 ? (
            <p className="muted small">No sittings recorded yet.</p>
          ) : (
            <>
              <dl className="home-figures">
                <dt>Days</dt>
                <dd>{home.recent.days}</dd>
                <dt>Time</dt>
                <dd>{asDuration(home.recent.minutes)}</dd>
                <dt>Streak</dt>
                <dd>{home.recent.streak > 0 ? `${home.recent.streak} days` : 'Not today'}</dd>
              </dl>
              {/* Bars against the busiest day rather than against a target:
                  a goal nobody set is a goal nobody agreed to. */}
              <ul className="home-days" aria-label="Words written on recent days">
                {home.days.map((one) => {
                  const most = Math.max(...home.days.map((day) => Math.abs(day.words)), 1);
                  return (
                    <li key={one.day} title={`${one.day}: ${one.words} words in ${asDuration(one.minutes)}`}>
                      <span
                        className={one.words < 0 ? 'home-bar cut' : 'home-bar'}
                        style={{ height: `${Math.round((Math.abs(one.words) / most) * 100)}%` }}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* ---------------------------------------------- the one-sheet */}
        {onPrintOneSheet || onExportOneSheet ? (
          <div className="home-card">
            <h4>One-sheet</h4>
            <p className="muted small">
              One page, made from what is above. Nothing is kept — it is built again each time, so it
              can never be out of date with the fields.
            </p>
            <div className="home-sheet-actions">
              {onPrintOneSheet ? (
                <button type="button" className="ghost small" disabled={busy} onClick={onPrintOneSheet}>
                  {busy ? 'Working…' : 'Print'}
                </button>
              ) : null}
              {onExportOneSheet ? (
                <button type="button" className="ghost small" disabled={busy} onClick={onExportOneSheet}>
                  Save as PDF…
                </button>
              ) : null}
              <button type="button" className="ghost small" onClick={() => setSending((one) => !one)}>
                {sending ? 'Not now' : 'Email it…'}
              </button>
            </div>

            {sending ? <SendOneSheet file={file} onDone={() => setSending(false)} /> : null}
            {/* A fact about the sheet, never a grade about the writer (§3). */}
            {gaps ? <p className="muted small home-gaps">{gaps}</p> : null}
            {message ? (
              <p className="error small" role="alert">
                {message}
              </p>
            ) : null}
          </div>
        ) : gaps ? (
          <p className="muted small home-gaps">{gaps}</p>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Sending the one-sheet to somebody (master spec §4's last bullet).
 *
 * **The fields go, not the page.** The server renders and escapes the markup,
 * so nothing typed here can become HTML in a message sent over vc-writer.com's
 * own domain — and the poster does not travel at all, a few hundred kilobytes
 * of data URI being most of a message-size limit spent on something half the
 * clients refuse to show.
 *
 * A failure is **said**, unlike a room notice that can fail quietly because the
 * work it accompanies is already saved. This has no other half: the writer
 * pressed send and either it went or it did not.
 */
function SendOneSheet({ file, onDone }: { file: ProjectFile; onDone(): void }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    setProblem(null);
    const sheet = oneSheet(file);
    const result = await window.vcwriter.sendOneSheet({
      to: to.trim(),
      message,
      sheet: {
        title: sheet.title,
        author: sheet.author,
        standfirst: sheet.standfirst,
        logline: sheet.logline,
        elevatorPitch: sheet.elevatorPitch,
        synopsis: sheet.synopsis,
        notes: sheet.notes,
        status: sheet.status,
        figures: sheet.figures,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setProblem(result.error ?? 'The one-sheet could not be sent.');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="home-send">
        <p className="muted small">Sent to {to.trim()}.</p>
        <button type="button" className="ghost small" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="home-send">
      <label className="field">
        <span>To</span>
        <input
          autoFocus
          type="email"
          aria-label="Send the one-sheet to"
          placeholder="somebody@example.com"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <label className="field">
        <span>A line with it</span>
        <textarea
          aria-label="A line with it"
          rows={2}
          placeholder="Optional"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {/* Said before they press it rather than discovered afterwards. */}
      <p className="muted small">The sheet goes in the body of the email. The key art does not travel.</p>
      {problem ? (
        <p className="error small" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="home-sheet-actions">
        <button
          type="button"
          className="ghost small"
          disabled={busy || !/.+@.+\..+/.test(to.trim())}
          onClick={() => void send()}
        >
          {busy ? 'Sending…' : 'Send it'}
        </button>
        <button type="button" className="ghost small" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
