import { contextBridge, ipcRenderer } from 'electron';
import type {
  Assignment,
  CaptureItem,
  Comment,
  DeskStanding,
  LearningAidKind,
  LearningSuggestion,
  MergeResult,
  PrintOptions,
  ProjectEntry,
  ProjectFile,
  ProjectFormat,
  RoomMaster,
  RoomRole,
  ProjectFolder,
  SaveKind,
  SceneVerdict,
  Seat,
  Standing,
  UpdateDecision,
} from '@vcwriter/domain';

/**
 * The only bridge between the renderer and the operating system.
 *
 * Each method is an explicit, typed channel. Nothing generic is exposed — no
 * `invoke(channel, ...)` escape hatch — so the renderer's reach is exactly this
 * list and no more.
 */

export interface DesktopApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface OpenResult {
  path: string;
  file: ProjectFile;
  contentHash: string;
}

export interface SnapshotSummary {
  id: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  /** Why the recovery point exists, so the writer can find the right one. */
  reason: 'autosave' | 'manual' | 'pre_migration' | 'pre_sync';
  /**
   * What this point is called, where it has a name.
   *
   * A local recovery point has none — it was taken by a timer and a date is
   * the only true thing to say about it. A Writers Room version does: *First
   * Draft*, *Room Pass*, *Network Notes* (addendum 07 §9), and the name is the
   * one thing a writer will actually look for in the list.
   */
  label?: string;
}

/**
 * The room this window is working in (addendum 07 §6).
 *
 * The seats are the whole of it: a record in the document names an author and
 * nothing else, and the colour, the name and the initials are read through
 * here every time they are drawn.
 */
export interface RoomIdentity {
  roomId: string;
  roomName: string;
  role: RoomRole | null;
  /** This writer's own seat — who is *reading*. */
  you: Seat | null;
  /**
   * Whose draft this window holds, which is not always the reader's.
   *
   * A page of Jo's draft is stamped JC whoever is looking at it (§6.1), so the
   * stamp and the bar read this and never `you`.
   */
  author: Seat | null;
  seats: Seat[];
  /** Whether this window holds the room's master or somebody's own draft. */
  showing: 'master' | 'contribution';
  /** A recorded version is read-only: it cannot be changed once it exists (§9). */
  readOnly: boolean;
  /** What this window is, in words — *Jo Calder — First pass* (§3.4). */
  label: string;
  /**
   * What the room has asked of whom (addendum 07 §8).
   *
   * Carried with the identity rather than fetched on its own, for the same
   * reason the seats are: a badge beside a scene needs the room's colours *and*
   * the room's asks to draw one thing, and two requests would draw it twice.
   *
   * **Never a lock.** Nothing in the renderer refuses an edit on the strength
   * of one; it is drawn, and that is all.
   */
  assignments: Assignment[];
  /**
   * What the room has said, and about what (addendum 07 §14).
   *
   * Carried with the identity for the third time and the same reason as the
   * seats and the assignments: a badge beside a scene needs all three to draw
   * one row, and three requests would draw it three times.
   */
  comments: Comment[];
}

export interface VcWriterApi {
  createProject(input: {
    title: string;
    format: ProjectFormat;
    author?: string;
    logline?: string;
    /**
     * A document to make the project **from**, rather than an empty one
     * (addendum 33 §10). An import is a project arriving, so it lands in a
     * file of its own; without this it was adopted into the open project's
     * file, which overwrote whatever was in it.
     */
    file?: ProjectFile;
  }): Promise<DesktopApiResult<OpenResult>>;
  openProject(): Promise<DesktopApiResult<OpenResult>>;
  openProjectAtPath(path: string): Promise<DesktopApiResult<OpenResult>>;
  saveProject(input: {
    path: string;
    file: ProjectFile;
    previousHash?: string;
    snapshot?: boolean;
  }): Promise<DesktopApiResult<{ contentHash: string; written: boolean }>>;
  /**
   * Write the whole document somewhere else (addendum 29 §1).
   *
   * **One method for both acts**, because they differ only in which file the
   * writer is in afterwards, and that is the renderer's to act on rather than
   * the host's to decide — so the host is asked the same question either way
   * and answers with where it landed. `kind` reaches the host only so a copy
   * can be titled as one and the dialog can suggest the right name.
   *
   * What *where* means is the host's own: a folder and a file name on the
   * desktop, the browser's own library in the preview. Neither is sniffed for
   * (`window.vcwriter` is deliberately identical in both), which is why the
   * result carries the `path` it used and the screen says it back rather than
   * composing a sentence about a place it assumed.
   */
  saveProjectAs(input: {
    kind: SaveKind;
    file: ProjectFile;
    suggestedName?: string;
  }): Promise<DesktopApiResult<OpenResult>>;
  /**
   * Where new projects go, and whether this host can be asked for somewhere
   * else (addendum 34).
   *
   * **What a place is, is the host's** (`saveProjectAs`'s own rule): a folder
   * on the desktop, nothing at all in the browser, which keeps projects in its
   * own storage. The renderer asks and says back what it is told rather than
   * sniffing which host it is in — `window.vcwriter` is deliberately identical
   * in both.
   */
  projectsFolder(): Promise<DesktopApiResult<ProjectFolder>>;
  /**
   * Ask for a different one. Dismissing the picker is not a failure: it comes
   * back with the folder unchanged, because the writer changed their mind and
   * nothing has moved.
   */
  chooseProjectsFolder(): Promise<DesktopApiResult<ProjectFolder>>;
  recentProjects(): Promise<DesktopApiResult<string[]>>;
  /**
   * Every project this machine has, with enough about each to choose between
   * them: the title, when it was last written, how big it is (spec §4).
   *
   * Not `recentProjects`, which is a list of paths and right for what it does.
   * A list somebody deletes from has to say what each one *is*.
   */
  listProjects(): Promise<DesktopApiResult<ProjectEntry[]>>;
  /**
   * Take one away. The only thing in the application that cannot be undone,
   * which is why the interface asks first and this does not.
   *
   * `recoverable` says what happened: on the desktop the file goes to the
   * platform's bin and can be put back, so the writer is told where to look.
   */
  deleteProject(path: string): Promise<DesktopApiResult<{ deleted: boolean; recoverable: boolean }>>;
  listSnapshots(path: string): Promise<DesktopApiResult<SnapshotSummary[]>>;
  restoreSnapshot(input: { path: string; snapshotId: string }): Promise<DesktopApiResult<OpenResult>>;
  /** Returns null when the writer cancelled the save dialog. */
  exportPdf(input: {
    file: ProjectFile;
    options?: PrintOptions;
    /**
     * Which document: the manuscript, the AV sheet, the board (addendum 05
     * §8), the Story Grid (addendum 04 §8) or an outline (addendum 06 §12).
     * Omitted means the script — and a short-form project prints its sheet
     * whatever is asked for, because it has no script to print instead.
     */
    kind?: 'script' | 'sheet' | 'board' | 'grid' | 'outline' | 'one-sheet' | 'narrative' | 'book';
    /** Which outline, when there is more than one. Left out, it is the first. */
    outlineId?: string;
    /**
     * The book, already drawn (addendum 20 §4). The one document whose markup
     * the renderer hands over rather than the main process building it: its
     * pages exist only where the type was measured, which is the renderer.
     * The window that prints it still runs with scripts off.
     */
    html?: string;
    /** The paper for the book: the trim, in inches. */
    paper?: { width: number; height: number };
    /**
     * Where the file went, and how many pages it came to. **`path` is null
     * where nothing has been written** — a browser cannot make a PDF itself,
     * so it opens the document in a window and saving it is the writer's
     * press (addendum 20 §9ah); null for the whole result still means the
     * writer cancelled. One reading says what either answer means
     * (`sayExport` in `printing.ts`), so no screen writes its own.
     */
  }): Promise<DesktopApiResult<{ path: string | null; pageCount: number } | null>>;
  /**
   * Write an export's files into a folder of their own (addendum 23 §7): the
   * writer picks where, the folder is made there, and every file goes in.
   * Null when the writer cancelled.
   */
  saveExport(input: {
    folderName: string;
    files: { name: string; bytes: Uint8Array; mediaType: string }[];
  }): Promise<DesktopApiResult<{ folder: string; paths: string[] } | null>>;
  print(input: {
    file: ProjectFile;
    options?: PrintOptions;
    kind?: 'script' | 'sheet' | 'board' | 'grid' | 'outline' | 'one-sheet' | 'narrative' | 'book';
    outlineId?: string;
    html?: string;
    paper?: { width: number; height: number };
  }): Promise<DesktopApiResult<boolean>>;
  appInfo(): Promise<DesktopApiResult<{ version: string; platform: string }>>;
  /**
   * Whether Amazon's Kindle Previewer is on this computer (addendum 23 §9),
   * and opening an exported EPUB in it. Absent in the browser, where there
   * is no computer to look on; the panel then says KDP recommends it.
   */
  kindlePreviewer?(): Promise<DesktopApiResult<{ installed: boolean; path: string | null }>>;
  openInKindlePreviewer?(epubPath: string): Promise<DesktopApiResult<boolean>>;

  /**
   * Whether this bridge has exactly one project and should open it on start.
   *
   * True in a Writers Room, where the project is decided before the page loads
   * and there is nothing to pick: opening the room *is* opening it (addendum
   * 07 §5). Absent on the desktop and in the plain preview, where a writer has
   * files and choosing between them is the first thing they do.
   */
  autoOpen?(): boolean;

  /**
   * Who is in this room, where this window is in one (addendum 07 §6).
   *
   * Absent on the desktop and in the plain preview, which is the honest answer
   * rather than an empty room: a script written alone has no contributors and
   * nothing to colour.
   */
  roomIdentity?(): Promise<DesktopApiResult<RoomIdentity>>;

  /**
   * This writer's name on the work they have just made (addendum 07 §6).
   *
   * Called on every edit, and absent everywhere but a room — a script written
   * alone has one author and nothing to attribute. Only records that were not
   * in the draft when it opened are touched, and a record that is already
   * signed is never re-signed.
   */
  signWork?(file: ProjectFile): ProjectFile;

  /**
   * Send this draft for review (addendum 07 §10).
   *
   * **One button, and what you are looking at decides where it goes**: the
   * Script to the review queue, research and ideas to the brainstorming room.
   * A point on the line is recorded and *that* is what goes — nothing is
   * copied out of the writer's draft, and their desk is untouched.
   *
   * Absent outside a room, where there is nobody to submit to.
   */
  submitWork?(input: {
    kind: 'script' | 'research';
    note: string;
  }): Promise<DesktopApiResult<{ label: string; at: string }>>;

  // Sync is optional: a writer who never signs in has a fully working desktop
  // application whose projects live in files.
  accountStatus(): Promise<DesktopApiResult<AccountStatus>>;
  requestSignInCode(email: string): Promise<DesktopApiResult<true>>;
  verifySignInCode(input: { email: string; code: string }): Promise<DesktopApiResult<AccountStatus>>;
  signOut(): Promise<DesktopApiResult<true>>;
  syncProject(input: { file: ProjectFile; path?: string }): Promise<DesktopApiResult<SyncOutcome>>;
  /**
   * The Writers Room, from the desktop (addendum 07 §14).
   *
   * **Three doors, and none of them is an overwrite.** `roomStanding` says
   * where this copy is against the room's master in §14's own four words;
   * `contributeToRoom` sends work up, where it arrives as a contribution the
   * showrunner curates rather than as the master; `fetchRoomMaster` brings the
   * agreed draft down and *returns* it, leaving what to do with it to the
   * writer, because a fetch that silently replaced the file on disk would be
   * the same overwrite in the other direction.
   */
  roomStanding(input: {
    roomId: string;
    file: ProjectFile;
  }): Promise<DesktopApiResult<{ standing: Standing; master: RoomMaster; advice: string }>>;
  contributeToRoom(input: {
    roomId: string;
    file: ProjectFile;
    note?: string;
  }): Promise<DesktopApiResult<{ label: string; at: string }>>;
  fetchRoomMaster(input: {
    roomId: string;
  }): Promise<DesktopApiResult<{ file: ProjectFile; versionId: string | null; label: string }>>;
  listCaptures(projectId: string | null): Promise<DesktopApiResult<CaptureItem[]>>;
  resolveCapture(capture: CaptureItem): Promise<DesktopApiResult<true>>;
  reviewScene(input: {
    sceneText: string;
    position?: string;
    format: 'screenplay' | 'prose';
  }): Promise<DesktopApiResult<SceneVerdict>>;
  /** Whether a read can be asked for, and if not, what to tell the writer. */
  sceneReviewStatus(): Promise<DesktopApiResult<{ available: boolean; reason: string | null }>>;
  /**
   * One end-of-section learning aid (addendum 16 §10).
   *
   * **The shape is the permission**: there is no field here for the author's
   * own words, so what comes back can only ever be recorded as a suggestion.
   */
  suggestLearningAid(input: {
    kind: LearningAidKind;
    sectionText: string;
    sectionTitle: string;
  }): Promise<DesktopApiResult<LearningSuggestion>>;
  /** Whether one can be asked for, so the button is absent rather than broken. */
  learningAidStatus(): Promise<DesktopApiResult<{ available: boolean; reason: string | null }>>;
  /**
   * Name the groupings in a sitting's unsorted notes (addendum 26 §14a).
   *
   * **The shape is the permission**: passages and category names go up, names
   * and sentences come back. There is no field here for a card, a range or a
   * category id, so nothing that crosses this boundary can file anything.
   */
  suggestNoteCategories(input: {
    passages: string[];
    categories: string[];
  }): Promise<DesktopApiResult<Array<{ name: string; because: string }>>>;
  noteCategoriesStatus(): Promise<DesktopApiResult<{ available: boolean; reason: string | null }>>;
  /**
   * Send the project's one-sheet to somebody (master spec §4).
   *
   * Carries the **fields**, never the rendered page: the server builds the
   * markup, so nothing from here can become HTML in a message sent over
   * vc-writer.com's own domain.
   */
  sendOneSheet(input: {
    to: string;
    message: string;
    sheet: Record<string, string>;
  }): Promise<DesktopApiResult<true>>;

  // Licensing and updates (§3.3).
  activateLicense(serial: string): Promise<DesktopApiResult<ActivationResult>>;
  /**
   * What this machine last heard about its licence (addendum 32 §8).
   *
   * The **record** and not a live reading, and null where nothing has been
   * heard — a fresh install, a copy that has not signed in, an account with no
   * licence, or a host that does not licence writing at all. What follows from
   * it is `writingStanding`'s in the domain, so the desktop and the browser
   * cannot disagree about what a lapse means.
   *
   * `recheck` is the button's: it waits on vc-writer.com, where the ordinary
   * call answers from the record and asks behind the answer. Either way a
   * failure to reach the site changes nothing.
   */
  licenseStanding(recheck?: boolean): Promise<DesktopApiResult<DeskStanding | null>>;
  checkForUpdate(): Promise<DesktopApiResult<UpdateStatus>>;
  downloadUpdate(input: {
    expectedSha256: string;
    version: string;
  }): Promise<DesktopApiResult<{ path: string; version: string; verified: boolean }>>;
  installUpdate(path: string): Promise<DesktopApiResult<true>>;
  /** Whether the writer has opted in to sending error reports. Off by default. */
  reportingSettings(): Promise<DesktopApiResult<{ enabled: boolean }>>;
  setReporting(enabled: boolean): Promise<DesktopApiResult<{ enabled: boolean }>>;
  reportError(input: { name: string; message: string; stack: string }): Promise<DesktopApiResult<boolean>>;

  /** Sections in windows of their own, and the link between them (§8). */
  panes: PaneApi;
  link: LinkApi;
  /** The native application menu (§13). */
  menu: MenuApi;
}

/**
 * The menus are described in the renderer and built natively here, so the
 * two can never say different things. `install` hands over that description
 * and which items are ticked; `onCommand` is how the choice comes back.
 */
export interface MenuApi {
  install(input: { menus: unknown; checked: string[] }): Promise<DesktopApiResult<true>>;
  onCommand(handler: (command: string) => void): () => void;
  /** True when the main process is drawing the real menu, so the in-app bar stands down. */
  native(): boolean;
}

/**
 * Moving a section of the workspace to a window of its own — and, from there,
 * to another monitor. A pane key is `script`, `research`, `viewer`, `tracks`,
 * or `beat:<id>`; beats key on their own id so two can be open at once.
 */
export interface PaneApi {
  open(pane: string): Promise<DesktopApiResult<true>>;
  close(pane: string): Promise<DesktopApiResult<true>>;
  list(): Promise<DesktopApiResult<string[]>>;
  /** Told whenever a section is taken out or put back. Returns an unsubscribe. */
  onChanged(handler: (panes: string[]) => void): () => void;
  /** Which section this window *is*, or null in the workspace itself. */
  self(): string | null;
}

/**
 * The document link. The main process relays these messages between windows
 * and never reads them; what they mean is agreed in the renderer (`link.ts`).
 */
export interface LinkApi {
  send(message: Record<string, unknown>): void;
  subscribe(handler: (message: Record<string, unknown>) => void): () => void;
}

export interface ActivationResult {
  activated: boolean;
  reason?: string;
  message?: string;
}

export interface UpdateStatus {
  decision: UpdateDecision;
  currentVersion: string;
}

export interface AccountStatus {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
}

export interface SyncOutcome {
  merged: ProjectFile;
  conflicts: MergeResult['conflicts'];
  summary: MergeResult['summary'];
  syncedAt: string;
}

const api: VcWriterApi = {
  createProject: (input) => ipcRenderer.invoke('project:create', input),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (path) => ipcRenderer.invoke('project:openPath', path),
  saveProject: (input) => ipcRenderer.invoke('project:save', input),
  saveProjectAs: (input) => ipcRenderer.invoke('project:saveAs', input),
  projectsFolder: () => ipcRenderer.invoke('project:home'),
  chooseProjectsFolder: () => ipcRenderer.invoke('project:chooseHome'),
  recentProjects: () => ipcRenderer.invoke('project:recents'),
  listProjects: () => ipcRenderer.invoke('project:list'),
  deleteProject: (path: string) => ipcRenderer.invoke('project:delete', path),
  listSnapshots: (path) => ipcRenderer.invoke('project:snapshots', path),
  restoreSnapshot: (input) => ipcRenderer.invoke('project:restoreSnapshot', input),
  exportPdf: (input) => ipcRenderer.invoke('project:exportPdf', input),
  saveExport: (input) => ipcRenderer.invoke('project:saveExport', input),
  print: (input) => ipcRenderer.invoke('project:print', input),
  appInfo: () => ipcRenderer.invoke('app:version'),
  kindlePreviewer: () => ipcRenderer.invoke('app:kindlePreviewer'),
  openInKindlePreviewer: (epubPath) => ipcRenderer.invoke('app:openInKindlePreviewer', epubPath),
  accountStatus: () => ipcRenderer.invoke('cloud:status'),
  requestSignInCode: (email) => ipcRenderer.invoke('cloud:requestCode', email),
  verifySignInCode: (input) => ipcRenderer.invoke('cloud:verifyCode', input),
  signOut: () => ipcRenderer.invoke('cloud:signOut'),
  syncProject: (input) => ipcRenderer.invoke('cloud:sync', input),
  roomStanding: (input) => ipcRenderer.invoke('room:standing', input),
  contributeToRoom: (input) => ipcRenderer.invoke('room:contribute', input),
  fetchRoomMaster: (input) => ipcRenderer.invoke('room:fetchMaster', input),
  listCaptures: (projectId) => ipcRenderer.invoke('cloud:captures', projectId),
  resolveCapture: (capture) => ipcRenderer.invoke('cloud:resolveCapture', capture),
  reviewScene: (input) => ipcRenderer.invoke('cloud:reviewScene', input),
  sceneReviewStatus: () => ipcRenderer.invoke('cloud:sceneReviewStatus'),
  suggestLearningAid: (input) => ipcRenderer.invoke('cloud:suggestLearningAid', input),
  learningAidStatus: () => ipcRenderer.invoke('cloud:learningAidStatus'),
  suggestNoteCategories: (input) => ipcRenderer.invoke('cloud:suggestNoteCategories', input),
  noteCategoriesStatus: () => ipcRenderer.invoke('cloud:noteCategoriesStatus'),
  sendOneSheet: (input) => ipcRenderer.invoke('cloud:sendOneSheet', input),
  activateLicense: (serial) => ipcRenderer.invoke('license:activate', serial),
  licenseStanding: (recheck) => ipcRenderer.invoke('license:standing', recheck === true),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (input) => ipcRenderer.invoke('update:download', input),
  installUpdate: (path) => ipcRenderer.invoke('update:install', path),
  reportingSettings: () => ipcRenderer.invoke('reporting:get'),
  setReporting: (enabled) => ipcRenderer.invoke('reporting:set', enabled),
  reportError: (input) => ipcRenderer.invoke('reporting:report', input),

  panes: {
    open: (pane) => ipcRenderer.invoke('panes:open', pane),
    close: (pane) => ipcRenderer.invoke('panes:close', pane),
    list: () => ipcRenderer.invoke('panes:list'),
    onChanged(handler) {
      const listener = (_event: unknown, panes: string[]) => handler(panes);
      ipcRenderer.on('panes:changed', listener);
      return () => ipcRenderer.off('panes:changed', listener);
    },
    // Which section this window is, from the URL the main process opened it
    // with. The workspace has no `pane`, so it gets null. The preload is
    // compiled against Node's types, hence the reach for the window's own.
    self: () => {
      const search = (globalThis as { location?: { search?: string } }).location?.search ?? '';
      return new URLSearchParams(search).get('pane');
    },
  },

  menu: {
    install: (input) => ipcRenderer.invoke('menu:install', input),
    onCommand(handler) {
      const listener = (_event: unknown, command: string) => handler(command);
      ipcRenderer.on('menu:command', listener);
      return () => ipcRenderer.off('menu:command', listener);
    },
    // Only a Mac keeps its menus outside the window; everywhere else the bar
    // in the window is the one the writer uses.
    native: () => process.platform === 'darwin',
  },

  link: {
    send: (message) => ipcRenderer.send('link:send', message),
    subscribe(handler) {
      const listener = (_event: unknown, message: Record<string, unknown>) => handler(message);
      ipcRenderer.on('link:message', listener);
      return () => ipcRenderer.off('link:message', listener);
    },
  },
};

contextBridge.exposeInMainWorld('vcwriter', api);
