import { useEffect, useState } from 'react';
import type { ProjectFormat } from '@vcwriter/domain';
// The stacked lockup (docs/brand.md), cut for this screen by
// brand/logo/derive.mjs. Bundled by Vite, so it ships inside the app and the
// renderer's `img-src 'self'` policy covers it.
import logo from '../assets/logo-stacked.webp';

interface WelcomeProps {
  onCreate(input: { title: string; format: ProjectFormat; author?: string }): void;
  onOpen(): void;
  /** Somebody else's script: Final Draft or a PDF (addendum 02 §18). */
  onImport(): void;
  /**
   * The project list, and deleting from it (spec §4).
   *
   * Offered here as well as in the File menu, because the menu belongs to a
   * window with a project open and this is the screen a writer is on when
   * they have decided they have too many of them.
   */
  onProjects(): void;
  /**
   * Bumped when the project list changes underneath this screen — a delete,
   * usually. The recents are read from the same store, and a list still
   * offering a project that has just been deleted is a list nobody trusts.
   */
  projectsChanged?: number;
  onOpenPath(path: string): void;
  /** Set when a project is already open, so this screen can be left again. */
  onCancel?(): void;
  /** What to go back to, named, so the way out says where it goes. */
  openTitle?: string;
  error: string | null;
}

const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string; detail: string }> = [
  { value: 'screenplay', label: 'Screenplay', detail: 'Scenes and beats, industry formatting' },
  { value: 'series', label: 'Series or episodic', detail: 'Episodes across a series, script formatting' },
  { value: 'novel', label: 'Novel', detail: 'Chapters and beats, manuscript formatting' },
  { value: 'stage_play', label: 'Stage play', detail: 'Scenes and beats' },
  { value: 'short_story', label: 'Short story', detail: 'Sections and beats' },
  { value: 'short_form', label: 'Short form', detail: 'Commercials, web video, social' },
];

export function Welcome({
  onCreate,
  onOpen,
  onImport,
  onProjects,
  projectsChanged = 0,
  onOpenPath,
  onCancel,
  openTitle,
  error,
}: WelcomeProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    void window.vcwriter.recentProjects().then((result) => {
      if (result.ok && result.data) setRecents(result.data);
    });
  }, [projectsChanged]);

  return (
    <div className="welcome">
      <header className="welcome-header">
        <img src={logo} alt="VC Writer" className="welcome-logo" width={720} height={563} />
        <p>Start a project, or pick up where you left off.</p>
        {onCancel ? (
          // Arrived here from the File menu with work already open. Nothing
          // has happened to it yet, and this is the way back to it.
          <button type="button" className="ghost welcome-back" onClick={onCancel}>
            ← Back to {openTitle || 'the project'}
          </button>
        ) : null}
      </header>

      <section className="panel">
        <h2>New project</h2>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" />
        </label>
        <label>
          Author
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Your name" />
        </label>
        <fieldset>
          <legend>Format</legend>
          <div className="format-options">
            {FORMATS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="format-option"
                aria-pressed={format === option.value}
                onClick={() => setFormat(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className="primary"
          disabled={title.trim().length === 0}
          onClick={() => onCreate({ title: title.trim(), format, author: author.trim() })}
        >
          Create project
        </button>
      </section>

      <section className="panel">
        <h2>Open</h2>
        <button type="button" onClick={onOpen}>
          Open a project file…
        </button>
        <button type="button" onClick={onImport}>
          Import a script — Final Draft or PDF…
        </button>
        <button type="button" onClick={onProjects}>
          Projects on this machine…
        </button>
        {recents.length > 0 ? (
          <ul className="recents">
            {recents.map((recent) => (
              <li key={recent}>
                <button type="button" className="link" onClick={() => onOpenPath(recent)}>
                  {recent.split(/[\\/]/).pop()}
                </button>
                <span className="path">{recent}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recent projects yet.</p>
        )}
      </section>

      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
