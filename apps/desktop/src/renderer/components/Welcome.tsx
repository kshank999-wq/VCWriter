import { useEffect, useState } from 'react';
import type { ProjectFormat } from '@vcwriter/domain';

interface WelcomeProps {
  onCreate(input: { title: string; format: ProjectFormat; author?: string }): void;
  onOpen(): void;
  onOpenPath(path: string): void;
  error: string | null;
}

const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string; detail: string }> = [
  { value: 'screenplay', label: 'Screenplay', detail: 'Scenes and beats, industry formatting' },
  { value: 'novel', label: 'Novel', detail: 'Chapters and beats, manuscript formatting' },
  { value: 'stage_play', label: 'Stage play', detail: 'Scenes and beats' },
  { value: 'short_story', label: 'Short story', detail: 'Sections and beats' },
];

export function Welcome({ onCreate, onOpen, onOpenPath, error }: WelcomeProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    void window.vcwriter.recentProjects().then((result) => {
      if (result.ok && result.data) setRecents(result.data);
    });
  }, []);

  return (
    <div className="welcome">
      <header>
        <h1>VC Writer</h1>
        <p>Start a project, or pick up where you left off.</p>
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
