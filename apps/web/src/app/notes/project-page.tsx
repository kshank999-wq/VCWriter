'use client';

import { useCallback, useEffect, useState } from 'react';

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
 */

export interface ProjectSummary {
  id: string;
  title: string;
  format: string;
  updated_at: string;
}

/** How a format reads to somebody who is not looking at a settings screen. */
const FORMAT_WORDS: Record<string, string> = {
  screenplay: 'Screenplay',
  series: 'Series',
  short_form: 'Short form',
  stage_play: 'Stage play',
  novel: 'Novel',
  short_story: 'Short story',
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
      ) : (
        <>
          {projects.length === 0 ? (
            <p className="muted">No projects yet. Start one and it will be on your desktop too.</p>
          ) : (
            <ul className="notes-project-list">
              {projects.map((project) => (
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
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  <option value="screenplay">Screenplay</option>
                  <option value="series">Series</option>
                  <option value="short_form">Short form</option>
                  <option value="stage_play">Stage play</option>
                  <option value="novel">Novel</option>
                  <option value="short_story">Short story</option>
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
            <button type="button" className="button secondary" onClick={() => setNaming(true)}>
              New project
            </button>
          )}
        </>
      )}
    </section>
  );
}
