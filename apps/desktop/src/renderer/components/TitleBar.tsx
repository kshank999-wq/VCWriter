import { beatIdOf, paneTitle } from '../panes';
import { Wordmark } from './Brand';
import { avSheet, formatRt, nounsFor, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import type { AccountStatus } from '../../preload/index';

const SAVE_LABEL: Record<string, string> = {
  idle: '',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

interface TitleBarProps {
  /** The menu bar, drawn here so it sits with the project it acts on (§13). */
  menu?: React.ReactNode;
  file: ProjectFile;
  pages: number;
  beatCount: number;
  wordCount: number;
  /** The Write page; Focus only means something there. */
  writing: boolean;
  focusMode: boolean;
  onFocus(): void;
  /** Research is here rather than in the Script, so it survives the Script leaving. */
  onOpenResearch(): void;
  /** The Story Sculptor's canvas (addendum 03). */
  onOpenSculptor(): void;
  /**
   * A game's branching graph (addendum 18). **Undefined on every other
   * format**, which is how the button is absent rather than greyed: a
   * screenplay has no graph, and a disabled control says *not yet*.
   */
  onOpenNarrative?(): void;
  /** The Outliner's tree (addendum 06), the Sculptor's rigid sibling. */
  onOpenOutliner(): void;
  /**
   * The Layout room (addendum 20), where a book is set. **Undefined on every
   * format that is not prose**, for the narrative map's reason: a screenplay
   * is not set as a book, and the button is absent rather than greyed.
   */
  onOpenLayout?(): void;
  /** Sections in windows of their own, and the way to bring one back (§8). */
  away: readonly string[];
  onBringBack(pane: string): void;
  account: AccountStatus;
  syncing: boolean;
  onSync(): void;
  saveState: string;
  onSaveNow(): void;
  onPreferences(): void;
}

/**
 * The bar across the top of the workspace (addendum 02 §3).
 *
 * On the left, what the project is. On the right, what can be done to it —
 * and, since this revision, the two controls that must not depend on any
 * particular section being in the workspace: **Research**, which used to sit
 * inside the Script and disappeared with it, and the chips that bring back a
 * section that has gone to a window of its own.
 */
export function TitleBar({
  menu,
  file,
  pages,
  beatCount,
  wordCount,
  writing,
  focusMode,
  onFocus,
  onOpenResearch,
  onOpenSculptor,
  onOpenNarrative,
  onOpenOutliner,
  onOpenLayout,
  away,
  onBringBack,
  account,
  syncing,
  onSync,
  saveState,
  onSaveNow,
  onPreferences,
}: TitleBarProps) {
  // Beats are named by their own window's title, and there can be any number
  // of them; the chips here are for the sections and for research.
  const sections = away.filter((pane) => !beatIdOf(pane));
  const nouns = nounsFor(file.project.format);

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <Wordmark compact />
        {menu}
        <strong className="project-title" title={`${file.project.title} · ${file.project.format.replace(/_/g, ' ')}`}>
          {file.project.title}
        </strong>
      </div>
      <div className="titlebar-right">
        <span className="muted">
          {/* A commercial has no pages. It has a running time, and shots
              rather than beats (addendum 05 §1). */}
          {file.project.format === 'short_form' ? (
            <>
              {formatRt(avSheet(file).seconds)} · {beatCount} shots · {wordCount} words
            </>
          ) : (
            <>
              {pages} {pages === 1 ? 'page' : 'pages'} · {beatCount} {nouns.subPlural.toLowerCase()} · {wordCount} words
            </>
          )}
        </span>

        {sections.map((pane) => (
          <button
            key={pane}
            type="button"
            className="ghost away-chip"
            title={`${nameOf(pane, file.project.format)} is in a window of its own — bring it back here`}
            aria-label={`Bring ${nameOf(pane, file.project.format)} back`}
            onClick={() => onBringBack(pane)}
          >
            {nameOf(pane, file.project.format)} ⇤
          </button>
        ))}

        {writing ? (
          <button
            type="button"
            className="ghost"
            title={`Research: everything the ${nouns.manuscript.toLowerCase()} is made from`}
            onClick={onOpenResearch}
          >
            Research
          </button>
        ) : null}
        {writing && onOpenLayout ? (
          <button
            type="button"
            className="ghost"
            title={`Layout: set the ${nouns.manuscript.toLowerCase()} as a book — the trim, the type, the pages in front and behind`}
            onClick={onOpenLayout}
          >
            Layout
          </button>
        ) : null}
        {writing ? (
          <button
            type="button"
            className="ghost"
            title="Story Sculptor: log the major ideas, and keep refining them"
            onClick={onOpenSculptor}
          >
            Sculptor
          </button>
        ) : null}
        {writing && onOpenNarrative ? (
          <button
            type="button"
            className="ghost"
            title="Narrative map: the branching graph, laid out from the graph itself"
            onClick={onOpenNarrative}
          >
            Narrative
          </button>
        ) : null}
        {writing ? (
          <button
            type="button"
            className="ghost"
            title={`Outliner: arrange what you have into ${nouns.unitPlural.toLowerCase()} and ${nouns.subPlural.toLowerCase()}`}
            onClick={onOpenOutliner}
          >
            Outliner
          </button>
        ) : null}
        {writing ? (
          <button
            type="button"
            className={focusMode ? 'ghost active' : 'ghost'}
            title="Focus mode (Ctrl/Cmd+Shift+F)"
            aria-pressed={focusMode}
            onClick={onFocus}
          >
            Focus
          </button>
        ) : null}
        {account.configured ? (
          <button
            type="button"
            className="ghost"
            disabled={syncing}
            title={account.signedIn ? 'Sync this project' : 'Sign in to sync'}
            onClick={onSync}
          >
            {syncing ? 'Syncing…' : account.signedIn ? 'Sync' : 'Sign in'}
          </button>
        ) : null}
        <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
        <button type="button" className="ghost" onClick={onSaveNow}>
          Save now
        </button>
        <button
          type="button"
          className="ghost"
          title="Preferences"
          aria-label="Preferences"
          aria-haspopup="dialog"
          onClick={onPreferences}
        >
          ⚙
        </button>
      </div>
    </header>
  );
}

/**
 * What a chip calls the section it brings back.
 *
 * `paneTitle` is the one thing that answers this — it is what the window's own
 * title bar says, so the chip and the window agree by construction. A second
 * copy here had already gone stale once: it knew about research and nothing
 * else, so a new room would have been a chip wearing its own key.
 */
const nameOf = (pane: string, format: ProjectFormat | null): string => paneTitle(pane, format);
