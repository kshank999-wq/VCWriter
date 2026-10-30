import { nowIso } from './entities/common.js';
import type { DocNode, DocumentComment, WpDocument } from './entities/document.js';
import type { ProjectFile } from './project-file.js';
import type { WpDocumentId } from './ids.js';

/**
 * **Comments on a document** (addendum 42 §20, from Ken: *go ahead with
 * comments and tracked changes*).
 *
 * A comment is two things kept apart, as Word keeps them: a `comment` mark on
 * the passage, naming the comment's id, and the record here — its words, who
 * wrote it, its answers and whether it is resolved. The mark moves, copies
 * and undoes with the words; the record travels with the document. A record
 * whose passage has been deleted is an *orphan*: it is still listed, and says
 * so, rather than vanishing with the words under it.
 */

const withDocument = (file: ProjectFile, id: WpDocumentId, change: (document: WpDocument) => WpDocument): ProjectFile => ({
  ...file,
  documents: file.documents.map((one) => (one.id === id ? change(one) : one)),
});

const touched = (document: WpDocument, comments: DocumentComment[]): WpDocument => ({ ...document, comments, updatedAt: nowIso() });

/** A new comment, made by the editor at the moment it marks the passage. */
export const addComment = (
  file: ProjectFile,
  documentId: WpDocumentId,
  input: { id: string; author: string; text: string; at?: string },
): ProjectFile =>
  withDocument(file, documentId, (document) =>
    touched(document, [
      ...document.comments,
      { id: input.id, author: input.author.trim(), text: input.text, createdAt: input.at ?? nowIso(), resolved: false, replies: [] },
    ]),
  );

/** A comment's words changed; a new one posted also takes the name it is posted under. */
export const editComment = (file: ProjectFile, documentId: WpDocumentId, commentId: string, text: string, author?: string): ProjectFile =>
  withDocument(file, documentId, (document) =>
    touched(
      document,
      document.comments.map((one) => (one.id === commentId ? { ...one, text, ...(author !== undefined ? { author: author.trim() } : {}) } : one)),
    ),
  );

export const replyToComment = (
  file: ProjectFile,
  documentId: WpDocumentId,
  commentId: string,
  input: { id: string; author: string; text: string; at?: string },
): ProjectFile =>
  withDocument(file, documentId, (document) =>
    touched(
      document,
      document.comments.map((one) =>
        one.id === commentId
          ? { ...one, replies: [...one.replies, { id: input.id, author: input.author.trim(), text: input.text, createdAt: input.at ?? nowIso() }] }
          : one,
      ),
    ),
  );

/** Resolved, or opened again: a resolved comment stays, greyed, until it is deleted. */
export const resolveComment = (file: ProjectFile, documentId: WpDocumentId, commentId: string, resolved = true): ProjectFile =>
  withDocument(file, documentId, (document) =>
    touched(
      document,
      document.comments.map((one) => (one.id === commentId ? { ...one, resolved } : one)),
    ),
  );

/** The record gone. The editor takes its mark off the passage in the same press. */
export const deleteComment = (file: ProjectFile, documentId: WpDocumentId, commentId: string): ProjectFile =>
  withDocument(file, documentId, (document) =>
    touched(
      document,
      document.comments.filter((one) => one.id !== commentId),
    ),
  );

/** The comment ids marked in a document's words, in the order their passages begin. */
export const commentIdsIn = (content: DocNode): string[] => {
  const seen: string[] = [];
  const walk = (node: DocNode) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'comment') {
        const id = String(mark.attrs?.['commentId'] ?? '');
        if (id && !seen.includes(id)) seen.push(id);
      }
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(content);
  return seen;
};

/** The passage a comment is on, as plain words, for the list beside the page. */
export const commentedText = (content: DocNode, commentId: string): string => {
  let text = '';
  const walk = (node: DocNode) => {
    if (node.type === 'text' && (node.marks ?? []).some((mark) => mark.type === 'comment' && mark.attrs?.['commentId'] === commentId)) {
      text += node.text ?? '';
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(content);
  return text;
};

export interface CommentListing {
  comment: DocumentComment;
  /** The passage it is on; empty for an orphan. */
  passage: string;
  /** Its passage has been deleted from the words. */
  orphan: boolean;
}

/**
 * The comments as the pane lists them: those on passages in the order the
 * passages stand, then any whose passage has gone.
 */
export const commentListing = (document: Pick<WpDocument, 'content' | 'comments'>): CommentListing[] => {
  const order = commentIdsIn(document.content);
  const byId = new Map(document.comments.map((one) => [one.id, one]));
  const placed = order.flatMap((id) => {
    const comment = byId.get(id);
    return comment ? [{ comment, passage: commentedText(document.content, id), orphan: false }] : [];
  });
  const orphans = document.comments.filter((one) => !order.includes(one.id)).map((comment) => ({ comment, passage: '', orphan: true }));
  return [...placed, ...orphans];
};

/** Tracking turned on or off (addendum 42 §21), kept with the document as Word keeps it. */
export const setTrackChanges = (file: ProjectFile, documentId: WpDocumentId, on: boolean): ProjectFile =>
  withDocument(file, documentId, (document) => ({ ...document, trackChanges: on, updatedAt: nowIso() }));
