import { useEffect, useState } from 'react';
import {
  builtElsewhere,
  describeProjectFolder,
  nounsFor,
  startsHere,
  type ProjectFormat,
  type ProjectFolder,
} from '@vcwriter/domain';
// The stacked lockup (docs/brand.md), cut for this screen by
// brand/logo/derive.mjs. Bundled by Vite, so it ships inside the app and the
// renderer's `img-src 'self'` policy covers it.
import logo from '../assets/logo-stacked.webp';

interface WelcomeProps {
  onCreate(input: { title: string; format: ProjectFormat; author?: string }): void;
  onOpen(): void;
  /** Somebody else's script: Final Draft, Word or a PDF (addendum 02 §18, 21). */
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

/**
 * What each format is, in a line.
 *
 * The **parts** half is read from `nounsFor` rather than typed here, so this
 * list cannot tell a writer a novel has "chapters and beats" while every screen
 * in the program calls them passages (addendum 16 §1). What stays written down
 * is the part a noun table cannot know: what the format is *for*.
 */
const FORMATS: ReadonlyArray<{ value: ProjectFormat; label: string; about: string }> = [
  { value: 'screenplay', label: 'Screenplay', about: 'industry formatting' },
  { value: 'series', label: 'Series or episodic', about: 'episodes across a series' },
  { value: 'novel', label: 'Novel', about: 'manuscript formatting' },
  { value: 'instructional', label: 'Instructional book', about: 'academic, reference and nonfiction' },
  // **Kept, and no longer a choice** (addendum 30): a game is built in VC Game
  // Studio, so this card is the door to it. It stays in its place rather than
  // coming off the grid, because a writer who comes here to write a game and
  // finds nothing concludes the answer is nothing — which is the fault
  // addendum 08 §8b names. What it says is read from `builtElsewhere`.
  { value: 'game', label: 'Video game', about: 'branching, choices and consequences' },
  { value: 'stage_play', label: 'Stage play', about: '' },
  // One story or many: each is a marker over its sections, and the Layout
  // room sets the collection as a book (addendum 22).
  { value: 'short_story', label: 'Short stories and collections', about: 'one story, or a collection set as a book' },
  { value: 'short_form', label: 'Short form', about: 'commercials, web video, social' },
];

const detailFor = (option: { value: ProjectFormat; about: string }): string => {
  const nouns = nounsFor(option.value);
  const parts = `${nouns.unitPlural} and ${nouns.subPlural.toLowerCase()}`;
  return option.about.length > 0 ? `${parts}, ${option.about}` : parts;
};

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
  /**
   * Where this project will be written (addendum 34).
   *
   * Asked of the host rather than composed here — a row drawn with a guessed
   * folder in it would be a second answer to the one question this is for.
   * Three states, and the third is the one that matters: `'asking'` while the
   * host is being asked, the answer once it comes, and **null where it cannot
   * answer at all**, which draws no row. A host that does not know where
   * projects go must not be made to say something about it, and **an effect
   * that throws takes the whole screen down** (addendum 25 §4g), so the ask is
   * guarded as well as the answer.
   */
  const [home, setHome] = useState<ProjectFolder | 'asking' | null>('asking');
  const [choosing, setChoosing] = useState(false);
  // The one format this program does not start, which is what the
  // advertisement at the foot of the panel is about. Null would take it off
  // the screen with nothing else to change.
  const studio = builtElsewhere('game');

  useEffect(() => {
    void window.vcwriter.recentProjects().then((result) => {
      if (result.ok && result.data) setRecents(result.data);
    });
  }, [projectsChanged]);

  useEffect(() => {
    const ask = window.vcwriter.projectsFolder?.();
    if (!ask) {
      setHome(null);
      return;
    }
    void ask.then((result) => setHome(result.ok && result.data ? result.data : null)).catch(() => setHome(null));
  }, []);

  const chooseFolder = async () => {
    setChoosing(true);
    try {
      const result = await window.vcwriter.chooseProjectsFolder();
      if (result.ok && result.data) setHome(result.data);
    } finally {
      setChoosing(false);
    }
  };

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
          {/* Every card is a choice, and the one format that is not a choice
              is not among them (§2a). A door standing in a row of toggles has
              to announce three times over that it is not one of them; outside
              the grid it needs to announce nothing, because nothing about it
              claims to be a format. */}
          <div className="format-options">
            {FORMATS.filter((option) => startsHere(option.value)).map((option) => (
              <button
                key={option.value}
                type="button"
                className="format-option"
                aria-pressed={format === option.value}
                onClick={() => setFormat(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{detailFor(option)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/*
          Where the file goes (addendum 34, Ken's own sentence).

          **Here rather than after the press.** The question was always asked —
          by a save dialog that appeared once Create was pressed, over a screen
          that had not mentioned it — so the folder could be set and never
          seen, and the one the program had picked was the only one it ever
          offered. This is §2a's rule read properly rather than broken: nothing
          that is *not part of making the project* may stand between the format
          and the button, and where the project is written is part of making
          it.
        */}
        {home === null ? null : (
        <fieldset className="project-home">
          <legend>Where it goes</legend>
          {home === 'asking' ? (
            <p className="path">Asking this machine…</p>
          ) : (
            <>
              <div className="project-home-row">
                <span className="path">{home.path ?? 'This browser’s own storage'}</span>
                {/* Absent rather than greyed where there is nowhere to choose:
                    a button that can only refuse is one a writer never trusts
                    again. */}
                {home.canChoose ? (
                  <button type="button" className="ghost" disabled={choosing} onClick={() => void chooseFolder()}>
                    {choosing ? 'Choosing…' : 'Change…'}
                  </button>
                ) : null}
              </div>
              <p className="muted project-home-note">{describeProjectFolder(home)}</p>
            </>
          )}
        </fieldset>
        )}

        <button
          type="button"
          className="primary"
          disabled={title.trim().length === 0}
          onClick={() => onCreate({ title: title.trim(), format, author: author.trim() })}
        >
          Create project
        </button>

        {/*
          The advertisement (§2a, Ken's own sentence).

          It is **at the foot of this panel rather than between the grid and
          the button**: a writer scanning the formats for *video game* looks
          around in the same glance, and nothing may stand between choosing a
          format and pressing Create project.

          `studio` is `builtElsewhere('game')`, so the program and the address
          are the domain's; the **words are this screen's own and are Ken's**,
          because an advertisement is copy rather than a reading, and this is
          the only surface that carries it.
        */}
        {studio ? (
          <aside className="elsewhere-ad">
            <p className="elsewhere-ask">Need to write a narrative interaction script?</p>
            <p className="elsewhere-note">
              Branching choices, consequences and a map of how a player reaches a scene are {studio.name}’s — a
              program of its own.
            </p>
            <a className="elsewhere-go" href={studio.url} target="_blank" rel="noreferrer">
              See {studio.name} <span aria-hidden>↗</span>
            </a>
            {/* An address is one word, hyphens and all: left to wrap it broke
                at its own hyphen, `vc-` over `gamestudio.com`, which a reader
                cannot tell from `vcgamestudio.com`. */}
            <p className="elsewhere-host">
              <span className="format-host">{studio.host}</span>
            </p>
          </aside>
        ) : null}
      </section>

      <section className="panel">
        <h2>Open</h2>
        <button type="button" onClick={onOpen}>
          Open a project file…
        </button>
        <button type="button" onClick={onImport}>
          Import — a script, a novel, a book or a collection…
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
