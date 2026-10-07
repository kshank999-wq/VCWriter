import type { ProjectFile } from './project-file.js';

/**
 * Save as, and save a copy (addendum 29 §1, from Ken: *the ability in every
 * single module to be able to save as, where you can save it as a location.
 * Save a copy should give you the ability to save a copy that gives a version
 * in that location. And it should save the location of that file so it can
 * re-find it.*).
 *
 * **What was there was one menu item that did neither.** `File ▸ Save a
 * copy…` has existed since the menus were built and called `project.saveNow()`
 * — an ordinary save, to the same file, with no dialog and nothing copied —
 * so the accelerator worked, the label read correctly, nothing errored, and
 * the act was the one it was named after's opposite: *save a copy* saved the
 * original. That is this project's own recurring fault in its plainest form
 * (addendum 20 §16b's menu command that predated the screen), and the lesson
 * holds a second time: **a menu item is the most durable route in the program
 * and the least likely to be revisited.**
 *
 * **The two acts differ in exactly one thing, and it is not the file they
 * write.** Both ask for a place and write the whole document there. What
 * differs is *which file you are working in afterwards* — save as moves you,
 * save a copy leaves you — which is why they are two items rather than a
 * checkbox, and why everything else about them is shared code here rather
 * than two implementations free to drift.
 *
 * **The location is remembered because the act writes it down**, not because
 * a screen remembers to: both go through the same recents list `File ▸ Open`
 * and the Projects screen already read, so *it can re-find it* needed no new
 * record at all.
 */

/** Which of the two acts. The only thing that differs is where you end up. */
export type SaveKind = 'as' | 'copy';

export const SAVE_KIND_WORDS: Record<SaveKind, string> = {
  as: 'Save as…',
  copy: 'Save a copy…',
};

/**
 * What a copy's title becomes.
 *
 * **A copy says it is one.** Ken's word for what this makes is a *version*,
 * and a version you cannot tell from the original is not one — on the desktop
 * the file name would carry it, but the Projects screen, the recents list, the
 * running heads and the eBook metadata all name the book by its **title**, so
 * a copy whose title was identical would be indistinguishable everywhere a
 * writer actually looks for it.
 *
 * It is the one thing either act changes about the document, and only on the
 * copy: the file you go on writing in is untouched by both.
 *
 * Already-copied titles do not stack — a copy of *Book copy* is *Book copy*
 * rather than *Book copy copy*, because the second word says nothing the first
 * did not and the writer renames it on the Home page if they want more.
 */
export const copyTitle = (title: string): string => {
  const trimmed = title.trim() || 'Untitled';
  return /\bcopy$/i.test(trimmed) ? trimmed : `${trimmed} copy`;
};

/**
 * What to put in the dialog, or to key the browser's own library by.
 *
 * Only the characters a file name cannot carry are replaced, and the extension
 * is the host's to add — this names the document and does not build a path.
 */
export const suggestedFileName = (title: string, kind: SaveKind): string => {
  const named = (kind === 'copy' ? copyTitle(title) : title).trim() || 'Untitled';
  return named.replace(/[^\w\-. ]+/g, '_').replace(/\s+/g, ' ').trim() || 'Untitled';
};

/** Whether the act may be asked for, what it would do, and what to call it. */
export interface SaveOffer {
  kind: SaveKind;
  /** The menu's or button's words. */
  label: string;
  /** What a press would do, in one sentence. Always set, refusal or not. */
  sentence: string;
  /** False when there is nothing to do, in which case `sentence` says why. */
  allowed: boolean;
  /** What to hand the host as the name to offer. Empty where refused. */
  suggestedName: string;
}

/**
 * What a press would do, said before it can be asked for — `trackRemoval`'s
 * shape, so the menu, the keys and anything later cannot disagree about what
 * either act means or promise something the act does not.
 *
 * The sentences are the whole of why there are two items. **Save as** names
 * what happens to the file left behind, because a writer who expects a *move*
 * and gets a copy has two files and believes they have one. **Save a copy**
 * names what happens to the one in hand, because the fear it answers is that
 * the copy becomes the thing you are editing.
 */
export const saveOffer = (file: ProjectFile | null, kind: SaveKind): SaveOffer => {
  const label = SAVE_KIND_WORDS[kind];
  if (!file) {
    return {
      kind,
      label,
      allowed: false,
      suggestedName: '',
      sentence: 'Nothing is open to save.',
    };
  }

  const title = file.project.title.trim() || 'Untitled';
  return {
    kind,
    label,
    allowed: true,
    suggestedName: suggestedFileName(title, kind),
    sentence:
      kind === 'as'
        ? `Choose where “${title}” goes from now on. You carry on writing in the new one, and the old one stays where it is, holding the work as it stands now.`
        : `Leave a copy of “${title}” somewhere, called “${copyTitle(title)}” so you can tell the two apart. You carry on writing in this one, which is not changed.`,
  };
};

/** Where a save-as or a copy landed, as the host reported it. */
export interface SavedTo {
  kind: SaveKind;
  /** The path on the desktop; the library's own key in the browser. */
  path: string;
  /**
   * Whether the writer is now working in that file.
   *
   * The host does not decide this — it follows from the kind — but it rides
   * back on the result because the sentence is read from one object rather
   * than from the kind in one place and the path in another.
   */
  working: boolean;
}

/**
 * What to say once it has happened.
 *
 * **It names the place rather than only the act**, which is the half a writer
 * needs: *Saved* says nothing about whether they will find it again, and the
 * whole of Ken's third sentence is about finding it again. The path is said as
 * the host gave it, never prettified — a shortened path is a path you cannot
 * search your own disk for.
 */
export const describeSavedTo = (saved: SavedTo): string =>
  saved.working
    ? `Saved. You are writing in ${saved.path} from now on, and it is on your recent list.`
    : `A copy is at ${saved.path}, and it is on your recent list. You are still writing in the one you were.`;

/* --------------------------------------------- where new projects go (§34) */

/**
 * Where a new project is written, and whether this host can be asked for
 * somewhere else (addendum 34, from Ken: *when creating your project, there
 * needs to be on that page the ability to set that file location and it'll
 * save it in a file or a cloud drive and remember where it is. So when you
 * open VC Writer, that it'll be able to find that location.*).
 *
 * **A cloud drive is a folder.** iCloud Drive, Dropbox, OneDrive and Google
 * Drive each appear on the machine as an ordinary directory, so saving into
 * one needs no account, no API and no second kind of location — which is
 * worth saying on the screen rather than implying the program integrates with
 * them, because what a writer is owed here is the truth about where their
 * book is.
 *
 * **`ProjectFolder` and not `ProjectHome`**, which addendum 17's project home
 * page has owned since it was built — the fifth name this project has had to
 * step around (`origin`→`found`, `Standing`→`Situation`, `code`→`discount`,
 * `LAPSE_PROMISE`), and the first caught by the compiler rather than by
 * running the thing: a clashing *type* is refused at the door where a clashing
 * *value* re-exported through a star compiled, passed 2,666 tests and returned
 * a 500 from one page.
 *
 * `path` is spelled exactly as the host spells it. The renderer composes no
 * paths and prettifies none: a shortened path is one you cannot search your
 * own disk for (`describeSavedTo`'s rule).
 */
export interface ProjectFolder {
  /** Where new projects land, or null where this host keeps no folders. */
  path: string | null;
  /** Whether a different one can be asked for here. */
  canChoose: boolean;
}

/**
 * What the New project panel says under the folder.
 *
 * Two states and no third: a host that keeps folders, and one that does not.
 * The browser's library is **said rather than hidden** — a panel that simply
 * omitted the row there would read as the feature not being there, which is
 * the fault this project keeps finding (addendum 09 §15).
 */
export const describeProjectFolder = (where: ProjectFolder): string =>
  where.canChoose
    ? 'Any folder will do, including one a cloud drive keeps in step — iCloud Drive, Dropbox, OneDrive. The file is named from the title, and nothing already in the folder is replaced.'
    : 'This browser keeps projects in its own storage rather than in folders. Choosing where they go is the desktop application’s.';

/**
 * A name nothing already there answers to.
 *
 * **Nothing is ever replaced**, which is the one rule about this that a writer
 * would not forgive being wrong once: the file in that folder is somebody's
 * book. The browser's library has numbered its own keys this way since it was
 * written, so this is that rule said once rather than a second copy on the
 * desktop free to differ from it.
 *
 * `taken` is the host's — a set of keys in the browser, the directory on the
 * desktop — because what already exists is a fact this cannot know.
 */
export const freeName = (stem: string, taken: (candidate: string) => boolean, suffix = ''): string => {
  let candidate = `${stem}${suffix}`;
  for (let n = 2; taken(candidate); n += 1) candidate = `${stem} ${n}${suffix}`;
  return candidate;
};
