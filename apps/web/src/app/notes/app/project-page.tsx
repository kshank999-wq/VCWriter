'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  describePhoneShelf,
  describeShelf,
  emptyShelf,
  phoneShelfOffer,
  readShelf,
  setOnPhone,
  shelfRows,
  shownOnPhone,
  startsHere,
  type PhoneShelf,
  type ProjectFormat,
} from '@vcwriter/domain';

/**
 * The Project Page (addendum 09 §3.1, stage 5).
 *
 * **The app opens here, always.** Ken's §2 puts *project first* at the top of
 * the UX principles, and it is not just an ordering: every captured note
 * belongs to a project, so choosing one is not a setting tucked above the
 * microphone — it is the first thing the app asks and the thing it comes back
 * to. A picker at the top of the capture screen let a writer dictate for a
 * minute into whatever was selected last, which is how a note ends up in the
 * wrong script.
 *
 * **A new project is made whole.** The button posts to a route that runs the
 * same `createProjectFile` the desktop does, so what comes back has its opening
 * scene, its research folders and its cast headings — not a title with nothing
 * behind it.
 *
 * **And which of them are on this phone is the writer's** (§13, from Ken): the
 * list is everything the account has, which on a desk with eleven scripts on it
 * is ten too many to scroll past in a pocket. `capture-shelf.ts` holds the
 * rules — chiefly that only what is *off* is written down, so a project started
 * tomorrow is here without being asked — and the tick reaches this device and
 * nothing else, there being no copy of a project on a phone for anything to
 * reach.
 */

/** Where this device remembers what it has been told not to show. */
export const NOTES_SHELF = 'vcwriter-notes-shelf';

export interface ProjectSummary {
  id: string;
  title: string;
  format: string;
  updated_at: string;
}

/**
 * How a format reads to somebody who is not looking at a settings screen.
 *
 * **All eight of them**, which is the same list `SPOKEN_FORMATS` offers out
 * loud (addendum 09 §11): this table had six, so an educational book — the one
 * Ken named by name — could be made on the phone by voice and not by hand, and
 * a game made on the desktop drew its raw column value in this list. A picker
 * shorter than what the program can make is a question with answers missing.
 */
const FORMAT_WORDS: Record<string, string> = {
  screenplay: 'Screenplay',
  series: 'Series',
  short_form: 'Short form',
  stage_play: 'Stage play',
  novel: 'Novel',
  short_story: 'Short stories and collections',
  instructional: 'Educational book',
  game: 'Game',
};

export function ProjectPage({
  chosenId,
  onChoose,
}: {
  /** The one they were last capturing into, marked so it is obvious. */
  chosenId: string | null;
  onChoose(project: ProjectSummary): void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('screenplay');
  const [making, setMaking] = useState(false);
  /** Which projects this phone shows, and whether the writer is choosing. */
  const [shelf, setShelf] = useState<PhoneShelf>(emptyShelf());
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    try {
      setShelf(readShelf(localStorage.getItem(NOTES_SHELF)));
    } catch {
      // A locked-down browser shows everything, which is the right failure.
    }
  }, []);

  const tick = (projectId: string, on: boolean) => {
    const after = setOnPhone(shelf, projectId, on);
    setShelf(after);
    try {
      localStorage.setItem(NOTES_SHELF, JSON.stringify(after));
    } catch {
      // It holds for this sitting either way; nothing is lost but the memory.
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/notes/projects', { cache: 'no-store' });
    const body = (await response.json().catch(() => ({}))) as {
      projects?: ProjectSummary[];
      error?: string;
    };
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? 'Your projects could not be read.');
      return;
    }
    setProjects(body.projects ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const make = async () => {
    const name = title.trim();
    if (name.length === 0 || making) return;
    setMaking(true);
    const response = await fetch('/api/notes/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: name, format }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      project?: ProjectSummary;
      error?: string;
    };
    setMaking(false);
    if (!response.ok || !body.project) {
      setError(body.error ?? 'That project could not be started.');
      return;
    }
    setNaming(false);
    setTitle('');
    // Straight into it: somebody who just named a project wants to talk into it.
    onChoose(body.project);
  };

  return (
    <section className="notes-projects">
      {error ? <p className="error small">{error}</p> : null}

      {loading ? (
        <p className="muted">Looking…</p>
      ) : choosing ? (
        <>
          {/* The heading says which screen this is: the page's own is
              *Projects*, and arriving at a second list under the same word is
              how somebody presses Done without knowing what they just did. */}
          <h2 className="notes-shelf-head">On this phone</h2>
          <ul className="notes-shelf-list">
            {shelfRows(shelf, projects).map((row) => {
              const offer = phoneShelfOffer(shelf, row);
              return (
                <li key={row.id}>
                  <label className="notes-shelf-row">
                    <input
                      type="checkbox"
                      checked={row.on}
                      onChange={(event) => tick(row.id, event.target.checked)}
                      aria-label={offer.act}
                    />
                    <span>
                      <span className="notes-project-title">{row.title || 'Untitled'}</span>
                      <span className="muted small">{FORMAT_WORDS[row.format] ?? row.format}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {/* **The promise is the domain's**, said once: two screens writing
              *nothing is deleted* for themselves is two answers to the one
              question a writer cannot check from a phone. It goes **under** the
              ticks — what somebody came to do stands first, and on a desk with
              eleven scripts on it a paragraph at the top is the list pushed off
              the screen. */}
          <p className="muted small">{describePhoneShelf()}</p>
          <button type="button" className="button" onClick={() => setChoosing(false)}>
            Done
          </button>
        </>
      ) : (
        <>
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Start one and it will be on your desktop too.</p>
          ) : (
            <ul className="notes-project-list">
              {shownOnPhone(shelf, projects).map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className={project.id === chosenId ? 'notes-project chosen' : 'notes-project'}
                    aria-current={project.id === chosenId ? 'true' : undefined}
                    onClick={() => onChoose(project)}
                  >
                    <span className="notes-project-title">{project.title || 'Untitled'}</span>
                    <span className="muted small">
                      {FORMAT_WORDS[project.format] ?? project.format}
                      {project.id === chosenId ? ' · last used' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {naming ? (
            <form
              className="notes-new-project"
              onSubmit={(event) => {
                event.preventDefault();
                void make();
              }}
            >
              <label className="field">
                <span>Title</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Blackout"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Format</span>
                {/* The same table the list reads, rather than a second copy of
                    it: two lists of formats is how one of them came to be
                    missing two. */}
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  {Object.entries(FORMAT_WORDS)
                    // What may be **started** here, which is not the same list
                    // as what may be named: a game is built in VC Game Studio
                    // (addendum 30), and the rows above still read *Game* off
                    // this same table for a project made before that.
                    .filter(([value]) => startsHere(value as ProjectFormat))
                    .map(([value, words]) => (
                      <option key={value} value={value}>
                        {words}
                      </option>
                    ))}
                </select>
              </label>
              <div className="notes-item-actions">
                <button type="submit" className="button" disabled={title.trim().length === 0 || making}>
                  {making ? 'Starting…' : 'Start it'}
                </button>
                <button type="button" className="button secondary" onClick={() => setNaming(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="notes-item-actions">
              <button type="button" className="button secondary" onClick={() => setNaming(true)}>
                New project
              </button>
              {/* **Always here, never only when something is off**: a writer who
                  unticks the last project would otherwise be looking at an empty
                  list with no way back to the ticks that emptied it. */}
              {projects.length > 0 ? (
                <button type="button" className="button secondary" onClick={() => setChoosing(true)}>
                  Which projects
                </button>
              ) : null}
            </div>
          )}

          {/* What is not being shown, said where it went missing. Absent where
              nothing is off, a line reading *0 are off* being a fact about
              nothing. */}
          {describeShelf(shelf, projects) ? (
            <p className="muted small">{describeShelf(shelf, projects)}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
