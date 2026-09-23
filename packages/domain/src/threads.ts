import { newId } from './ids.js';
import { living, onlyLiving, restoreFromGraveyard, sendToGraveyard } from './graveyard.js';
import { nowIso } from './entities/common.js';
import { beatsForUnit, findUnit, unitsInStoryOrder } from './selectors.js';
import { pinUsage, unpinUsage } from './character-creator.js';
import { ref, refEquals, storyLinkSchema } from './entities/links.js';
import { storyThreadSchema } from './entities/threads.js';
import type { StoryThread, ThreadRelationship } from './entities/threads.js';
import type { StoryLink } from './entities/links.js';
import type { UsageLink } from './character-creator.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId, StoryLinkId, StoryThreadId, UsageLinkId } from './ids.js';

/**
 * Narrative threads (addendum 15, from Ken's Research Links spec).
 *
 * A thread says *these moments of the script belong together*: the key turns up
 * in scene four, the locked door in scene thirty-seven, the key opens it in
 * scene eighty-two. §4's example, and the module's whole job.
 *
 * **Only the thread is stored.** A moment is a `usageLink` with `ownerKind`
 * `thread`; a dependency between two moments is a `storyLink` with
 * `depends_on`; and the *sequence* between them is stored nowhere at all,
 * because it is the script's order and the script already holds it. §13 asks
 * that a node's position be derived from script position and never draggable,
 * which is the same sentence read from the other end: if position is derived
 * then order is derived, and a stored `sequence_order` — §16 lists one — would
 * be a second answer waiting to disagree the next time a scene moves.
 *
 * **Nothing infers a cause.** §5.2 is explicit and this module holds to it: a
 * thread set to `dependency` draws only the arrows the writer drew. Chronology
 * is not causality, and a fallback from one to the other would put a claim in
 * the writer's mouth.
 */

// ------------------------------------------------------------------ threads

export const addThread = (
  file: ProjectFile,
  input: { name: string; description?: string; relationship?: ThreadRelationship },
): { file: ProjectFile; thread: StoryThread } => {
  const at = nowIso();
  const thread = storyThreadSchema.parse({
    id: newId<StoryThreadId>(),
    projectId: file.project.id,
    name: input.name.trim(),
    description: input.description ?? '',
    relationship: input.relationship ?? 'sequence',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, threads: [...(file.threads ?? []), thread] }, thread };
};

export const updateThread = (
  file: ProjectFile,
  threadId: StoryThreadId,
  patch: Partial<Pick<StoryThread, 'name' | 'description' | 'relationship' | 'archived'>>,
): ProjectFile => ({
  ...file,
  threads: (file.threads ?? []).map((thread) =>
    thread.id === threadId
      ? storyThreadSchema.parse({ ...thread, ...patch, updatedAt: nowIso() })
      : thread,
  ),
});

/**
 * Remove a thread, its moments and its dependencies.
 *
 * The moments go because a moment belongs to its thread and to nothing else —
 * unlike a characterization item, which the writer wrote and which survives
 * being unfiled. The dependencies go because an edge between two moments that
 * no longer exist is not a relationship, it is a dangling pair of ids.
 */
export const removeThread = (file: ProjectFile, threadId: StoryThreadId): ProjectFile =>
  // To the graveyard (addendum 24), and its nodes and arrows stay: a thread
  // restored without the moments it was made of would be an empty name.
  sendToGraveyard(file, { kind: 'thread', id: threadId as string });

/** Gone for good, with its nodes and arrows. The graveyard's own act. */
export const destroyThread = (file: ProjectFile, threadId: StoryThreadId): ProjectFile => {
  const nodeIds = new Set(
    file.usageLinks
      .filter((link) => link.ownerKind === 'thread' && link.ownerId === (threadId as string))
      .map((link) => link.id as string),
  );
  return {
    ...file,
    threads: (file.threads ?? []).filter((thread) => thread.id !== threadId),
    usageLinks: file.usageLinks.filter((link) => !nodeIds.has(link.id as string)),
    links: file.links.filter((link) => !touchesNode(link, nodeIds)),
  };
};

/** Active threads, newest last — the order they were made, which is the order they happened. */
export const threadsInOrder = (file: ProjectFile, includeArchived = false): StoryThread[] =>
  onlyLiving(file.threads ?? []).filter((thread) => includeArchived || !thread.archived);

/**
 * A deleted thread already carrying this name (addendum 24 §5n).
 *
 * `buriedThematicNamed`'s twin (§5m), for the same reason and with the worse
 * consequence: a thread's **moments are kept when it is buried** (§2), so a
 * second thread of the same name starts empty beside one that holds the whole
 * history, and restoring gives two — one of which knows where the key was
 * seen and one of which does not.
 */
export const buriedThreadNamed = (file: ProjectFile, name: string): StoryThread | null => {
  const wanted = name.trim().toLowerCase();
  if (wanted.length === 0) return null;
  return (
    (file.threads ?? []).find((one) => !living(one) && one.name.trim().toLowerCase() === wanted) ?? null
  );
};

// ------------------------------------------------------------------ moments

/**
 * Add a moment of the script to a thread.
 *
 * The same `pinUsage` the Character Creator and Themes & Motifs use, which is
 * what makes the position, the orphan reading and the sync round trip work
 * without being written a third time.
 */
export const addMoment = (
  file: ProjectFile,
  threadId: StoryThreadId,
  input: { beatId: BeatId; elementId?: ManuscriptElementId | null; note?: string },
): { file: ProjectFile; node: UsageLink | null } => {
  const pinned = pinUsage(file, {
    ownerKind: 'thread',
    ownerId: threadId as string,
    beatId: input.beatId,
    elementId: input.elementId ?? null,
  });
  if (!pinned.link) return { file, node: null };
  if (!input.note) return { file: pinned.file, node: pinned.link };
  return {
    file: noteMoment(pinned.file, pinned.link.id as string, input.note),
    node: { ...pinned.link, note: input.note },
  };
};

/** What this moment contributes, in the writer's words (§16's node description). */
export const noteMoment = (file: ProjectFile, nodeId: string, note: string): ProjectFile => ({
  ...file,
  usageLinks: file.usageLinks.map((link) =>
    (link.id as string) === nodeId ? { ...link, note, updatedAt: nowIso() } : link,
  ),
});

/** Take a moment out of its thread, and every dependency that named it. */
export const removeMoment = (file: ProjectFile, nodeId: string): ProjectFile => {
  const only = new Set([nodeId]);
  const without = unpinUsage(file, nodeId as unknown as UsageLinkId);
  return { ...without, links: without.links.filter((link) => !touchesNode(link, only)) };
};

// ------------------------------------------------------------- dependencies

const touchesNode = (link: StoryLink, nodeIds: Set<string>): boolean =>
  (link.from.type === 'thread_node' && nodeIds.has(link.from.id)) ||
  (link.to.type === 'thread_node' && nodeIds.has(link.to.id));

/**
 * *This moment depends on that one* (§12).
 *
 * A story link, because that is what a story link is: two references and a
 * verb. `from` is the moment that relies, `to` is the moment relied upon —
 * `depends_on` read the way English reads it — and the arrow is drawn the other
 * way, from what came first to what needs it, because that is the direction
 * the story travels.
 */
export const dependOn = (
  file: ProjectFile,
  dependent: string,
  required: string,
): ProjectFile => {
  if (dependent === required) return file;
  const from = ref('thread_node', dependent);
  const to = ref('thread_node', required);
  const already = file.links.some(
    (link) => link.type === 'depends_on' && refEquals(link.from, from) && refEquals(link.to, to),
  );
  if (already) return file;

  const at = nowIso();
  return {
    ...file,
    links: [
      ...file.links,
      storyLinkSchema.parse({
        id: newId<StoryLinkId>(),
        projectId: file.project.id,
        from,
        to,
        type: 'depends_on',
        createdAt: at,
        updatedAt: at,
      }),
    ],
  };
};

export const undepend = (file: ProjectFile, dependent: string, required: string): ProjectFile => ({
  ...file,
  links: file.links.filter(
    (link) =>
      !(
        link.type === 'depends_on' &&
        link.from.type === 'thread_node' &&
        link.from.id === dependent &&
        link.to.type === 'thread_node' &&
        link.to.id === required
      ),
  ),
});

/** The declared dependencies inside one thread, as pairs of node ids. */
export const dependenciesIn = (
  file: ProjectFile,
  threadId: StoryThreadId,
): { dependent: string; required: string }[] => {
  const mine = new Set(
    file.usageLinks
      .filter((link) => link.ownerKind === 'thread' && link.ownerId === (threadId as string))
      .map((link) => link.id as string),
  );
  return file.links
    .filter(
      (link) =>
        link.type === 'depends_on' &&
        link.from.type === 'thread_node' &&
        link.to.type === 'thread_node' &&
        mine.has(link.from.id) &&
        mine.has(link.to.id),
    )
    .map((link) => ({ dependent: link.from.id, required: link.to.id }));
};

// -------------------------------------------------------------- the reading

/** A moment of a thread, placed in the script — or not, where the writing has gone. */
export interface ThreadMoment {
  node: UsageLink;
  /** Story index of the scene, or -1 for a moment whose writing was cut. */
  unitIndex: number;
  beatIndex: number;
  /** "Scene 4 · Beat 2 — The kitchen", or what is true instead. */
  where: string;
  /** The words as they were, for reading. */
  text: string;
  /** Whether it still points at writing that is there. */
  resolved: boolean;
}

/**
 * Every moment of a thread, in story order, orphans last.
 *
 * Orphans are kept and struck through rather than dropped, the same choice the
 * book index and Themes & Motifs make: a moment whose scene was cut is work the
 * writer still has and a decision only they can make.
 */
export const momentsOf = (file: ProjectFile, threadId: StoryThreadId): ThreadMoment[] => {
  const order = unitsInStoryOrder(file);
  const indexOf = new Map(order.map((unit, at) => [unit.id as string, at]));

  return file.usageLinks
    .filter((link) => link.ownerKind === 'thread' && link.ownerId === (threadId as string))
    .map((node): ThreadMoment => {
      const beat = file.beats.find((one) => one.id === node.beatId);
      if (!beat) {
        return { node, unitIndex: -1, beatIndex: -1, where: 'The writing it was on has gone', text: '', resolved: false };
      }
      const unitIndex = indexOf.get(beat.unitId as string) ?? -1;
      const beatIndex = beatsForUnit(file, beat.unitId).findIndex((one) => one.id === beat.id);
      const element = node.elementId
        ? beat.manuscript.elements.find((one) => (one.id as string) === (node.elementId as string))
        : undefined;
      // A moment on the whole beat lasts as long as the beat; one on a
      // paragraph wants that paragraph.
      const resolved = unitIndex >= 0 && (!node.elementId || element !== undefined);
      const unit = findUnit(file, beat.unitId);
      return {
        node,
        unitIndex,
        beatIndex,
        where: resolved
          ? `Scene ${unitIndex + 1} · Beat ${beatIndex + 1}${unit?.title ? ` — ${unit.title}` : ''}`
          : 'The writing it was on has gone',
        text: element?.text ?? node.quote,
        resolved,
      };
    })
    .sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? -1 : 1;
      return a.unitIndex === b.unitIndex ? a.beatIndex - b.beatIndex : a.unitIndex - b.unitIndex;
    });
};

/**
 * What a thread is short of, in a sentence — or an empty string when it is fine.
 *
 * §11 says a link may contain two or more nodes, and this is how that is held:
 * a thread of one is *said*, never refused. A writer who has marked the first
 * moment of a thread has done the right thing and is halfway through, and a
 * module that rejected the save would lose the half.
 */
export const describeThread = (file: ProjectFile, thread: StoryThread): string => {
  const moments = momentsOf(file, thread.id);
  const placed = moments.filter((one) => one.resolved);
  const lost = moments.length - placed.length;
  const parts: string[] = [];

  if (placed.length === 0) parts.push('No moments marked yet.');
  else if (placed.length === 1) parts.push('One moment. A thread wants two.');
  else parts.push(`${placed.length} moments, scenes ${placed[0]!.unitIndex + 1} to ${placed[placed.length - 1]!.unitIndex + 1}.`);

  if (lost > 0) parts.push(`${lost} ${lost === 1 ? 'points' : 'point'} at writing that has gone.`);

  if (thread.relationship === 'dependency') {
    const declared = dependenciesIn(file, thread.id).length;
    parts.push(
      declared === 0
        ? 'No dependency drawn yet — the order alone is not a cause, so nothing is joined until you say what relies on what.'
        : `${declared} ${declared === 1 ? 'dependency' : 'dependencies'} drawn.`,
    );
  }

  return parts.join(' ');
};

/** What the module owes, in one line. */
export const describeThreads = (file: ProjectFile): string => {
  const threads = threadsInOrder(file);
  if (threads.length === 0) return 'No threads yet.';
  const thin = threads.filter((thread) => momentsOf(file, thread.id).filter((one) => one.resolved).length < 2).length;
  if (thin === 0) return `${threads.length} ${threads.length === 1 ? 'thread' : 'threads'}.`;
  return `${threads.length} ${threads.length === 1 ? 'thread' : 'threads'} · ${thin} with fewer than two moments`;
};

// ------------------------------------------------- from the writing (§11)

/**
 * *Add to Research ▸ Links* from the manuscript.
 *
 * One call makes the thread if a name was given, marks the moment, and keeps
 * the writer's note — and **keeps nothing at all if the moment cannot be
 * marked**, the same refusal `captureFromScript` makes in the Character
 * Creator: a thread born empty in the beat the writer is looking at is the one
 * confusing outcome.
 */
export const captureToThread = (
  file: ProjectFile,
  input: {
    beatId: BeatId;
    elementId?: ManuscriptElementId | null;
    /** Add to this thread, or leave unset and give a name to make a new one. */
    threadId?: StoryThreadId | null;
    name?: string;
    note?: string;
    relationship?: ThreadRelationship;
  },
): { file: ProjectFile; thread: StoryThread | null; node: UsageLink | null } => {
  const existing = input.threadId
    ? ((file.threads ?? []).find((one) => one.id === input.threadId) ?? null)
    : null;
  if (input.threadId && !existing) return { file, thread: null, node: null };

  const name = (input.name ?? '').trim();
  if (!existing && name.length === 0) return { file, thread: null, node: null };

  // A thread of this name already in the graveyard comes **back** rather than
  // being made a second time (addendum 24 §5n). The check lives here rather
  // than in each screen because this is the one act that means *use this
  // thread, or make one by this name* — so no caller can forget it, which is
  // the difference from §5m, where the dialogs called `addTheme` directly.
  const buried = existing ? null : buriedThreadNamed(file, name);
  const made = existing
    ? { file, thread: existing }
    : buried
      ? { file: restoreFromGraveyard(file, { kind: 'thread', id: buried.id as string }), thread: buried }
      : addThread(file, { name, relationship: input.relationship ?? 'sequence' });

  const moment = addMoment(made.file, made.thread.id, {
    beatId: input.beatId,
    elementId: input.elementId ?? null,
    ...(input.note === undefined ? {} : { note: input.note }),
  });
  // Nothing is kept if the moment could not be marked.
  if (!moment.node) return { file, thread: null, node: null };

  return { file: moment.file, thread: made.thread, node: moment.node };
};

export { storyThreadSchema, THREAD_RELATIONSHIPS } from './entities/threads.js';
export type { StoryThread, ThreadRelationship } from './entities/threads.js';
