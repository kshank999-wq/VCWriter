import { approveCapture, suggestRouting } from './capture-approval.js';
import { WAITING_STATUSES, type CaptureItem, type CaptureStatus } from './entities/capture.js';
import { addResearchCategory } from './mutations.js';
import { researchCategoriesInOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { ResearchCategoryId } from './ids.js';

/**
 * **Bringing the phone's notes over by hand** (addendum 27 §25, from Ken: *it
 * will show you the notes available on the phone, because if the projects
 * don't match perfectly, it's not going to really work automatically
 * transferring. So you'll be able to see which note groups are on the phone.
 * You can select the project and it will sync and transfer those. Once they're
 * transferred, those notes need to go into an archive*).
 *
 * A note is sent under the project the phone had open, and the desk's inbox
 * lists a project's own notes. When the desk's project is not the phone's —
 * a project kept on this computer only, or a second copy — the notes never
 * met it. So the desk lists every note still waiting, **grouped by the phone
 * project it was said in**, and one press files a group into the project that
 * is open.
 */

/** The phone projects a note can have been said in, as the desk names them. */
export interface PhoneProjectName {
  id: string;
  title: string;
}

export interface PhoneNoteGroup {
  /** The phone project, or null for notes said before one was chosen. */
  projectId: string | null;
  title: string;
  notes: CaptureItem[];
}

const waiting = (note: CaptureItem): boolean => WAITING_STATUSES.includes(note.status);

/**
 * Every note still waiting, grouped by the phone project it was said in,
 * largest group first and then by name. The open project's own notes are left
 * out — they are in its inbox already — and so is anything already filed.
 */
export const phoneNoteGroups = (
  notes: readonly CaptureItem[],
  projects: readonly PhoneProjectName[],
  openProjectId: string | null,
): PhoneNoteGroup[] => {
  const byId = new Map(projects.map((one) => [one.id, one.title]));
  const groups = new Map<string, PhoneNoteGroup>();
  for (const note of notes) {
    if (!waiting(note)) continue;
    const id = (note.projectId as string | null) ?? null;
    if (id !== null && id === openProjectId) continue;
    const key = id ?? '';
    const group =
      groups.get(key) ??
      { projectId: id, title: id === null ? 'No project chosen' : (byId.get(id) ?? 'A project no longer on your account'), notes: [] };
    group.notes.push(note);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.notes.length - a.notes.length || a.title.localeCompare(b.title));
};

/** The folder a transferred note goes to when nothing better is suggested. */
export const FROM_THE_PHONE = 'From the phone';

export interface PhoneTransfer {
  file: ProjectFile;
  /** Each note as it now stands — filed — for the host to write back. */
  filed: CaptureItem[];
}

/**
 * **File a group of the phone's notes into the open project.** Each goes where
 * its suggestion says — the folder for its kind, the person it names — which
 * is what pressing a note's own button does in the inbox; one with no
 * suggestion (a scene, a section, a segment: the parts are placed by hand)
 * goes to a *From the phone* folder, made the first time it is needed, so
 * nothing in the group is left behind. The file is threaded through, so every
 * note is filed against the document as the one before left it.
 */
export const transferNotes = (file: ProjectFile, notes: readonly CaptureItem[]): PhoneTransfer => {
  let next = file;
  const filed: CaptureItem[] = [];
  let fallback: ResearchCategoryId | null =
    researchCategoriesInOrder(next).find((one) => one.name === FROM_THE_PHONE && one.parentId === null)?.id ?? null;

  for (const note of notes) {
    if (!waiting(note)) continue;
    let decision = suggestRouting(next, note).decision;
    if (!decision) {
      if (!fallback) {
        const made = addResearchCategory(next, { name: FROM_THE_PHONE });
        next = made.file;
        fallback = made.category.id;
      }
      decision = { kind: 'research', categoryId: fallback };
    }
    const result = approveCapture(next, note, decision);
    next = result.file;
    filed.push(result.capture);
  }
  return { file: next, filed };
};

/**
 * **The archive** (§25): what the desk has filed or set aside. Kept on the
 * account until the writer deletes it — from the desk, or from the phone once
 * it shows the note arrived.
 */
export const ARCHIVED_STATUSES: ReadonlyArray<CaptureStatus> = ['approved', 'rejected'];

export const isArchived = (note: CaptureItem): boolean => ARCHIVED_STATUSES.includes(note.status);

/** One folder of the archive: a day's filing into one project (§29). */
export interface ArchiveFolder {
  key: string;
  /** The day it was filed, `YYYY-MM-DD`, or null where it never was. */
  day: string | null;
  /** The project it went into, or what stands for one. */
  title: string;
  notes: CaptureItem[];
}

/**
 * **The archive in folders** (addendum 27 §29, from Ken: *put it in a single
 * folder… by date and by title of that project… and then you can delete it by
 * the folder*). One folder per day and project, newest first; a note set
 * aside rather than filed has no project, and one filed before projects were
 * recorded is *Earlier*.
 */
export const archiveFolders = (notes: readonly CaptureItem[]): ArchiveFolder[] => {
  const folders = new Map<string, ArchiveFolder>();
  for (const note of notes) {
    if (!isArchived(note)) continue;
    const day = note.reviewedAt ? note.reviewedAt.slice(0, 10) : null;
    const title = note.status === 'rejected' ? 'Set aside' : (note.filedInto?.trim() || 'Earlier');
    const key = `${day ?? ''}|${title}`;
    const folder = folders.get(key) ?? { key, day, title, notes: [] };
    folder.notes.push(note);
    folders.set(key, folder);
  }
  return [...folders.values()].sort((a, b) => (b.day ?? '').localeCompare(a.day ?? '') || a.title.localeCompare(b.title));
};
