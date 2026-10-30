import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import {
  DOCUMENT_CONTENT_CSS,
  countTextWords,
  docHeadings,
  docPlainText,
  docWordCount,
  docxToDocContent,
  documentPrintHtml,
  buildDocumentDocx,
  DOCX_MEDIA_TYPE,
  pageSize,
  readDocx,
  createExtract,
  deleteExtract,
  documentFromOutline,
  documentOutlineNumbers,
  ensureDocumentOutline,
  extractOfRow,
  findOutline,
  headingOfRow,
  linkExtractToOutline,
  outlineFromDocument,
  numberedPlainText,
  fillFields,
  hasHeaderFooter,
  pageNumberPresetOf,
  printedDate,
  setHeaderFooter,
  setPageNumbers,
  rowReceipts,
  setHeadingNumbering,
  HEADING_NUMBERINGS,
  type HeadingNumbering,
  type OutlineId,
  ensureExtractPalettes,
  isDuplicateExtract,
  newId,
  palettesOf,
  setDocumentContent,
  setDocumentPageSetup,
  textToDocContent,
  type DocNode,
  type Extract,
  type ExtractCategory,
  type ExtractId,
  type ExtractPaletteId,
  type ProjectFile,
  type WpDocument,
  DOCUMENT_CITATION_CSS,
  REFERENCE_STYLE_NAMES,
  bibliographyHtml,
  citationByKey,
  citationSettingsOf,
  citeDocumentHtml,
  withWriterNotes,
  addComment,
  commentListing,
  deleteComment,
  editComment,
  replyToComment,
  resolveComment,
  setTrackChanges,
  contentsDocumentHtml,
  DOCUMENT_CONTENTS_CSS,
  contentsEntries,
  contentsHtml,
  documentCitations,
  insertCitation,
  plainInline,
  updateCitation,
  notesIntoLibrary,
} from '@vcwriter/domain';
import { readDocxParts } from '../read-docx';
import { footNotedPrintHtml } from './foot-notes';
import { PageView, layOutPageView, pageViewKey } from './page-view';
import { DecorationSet } from '@tiptap/pm/view';
import { documentExtensions, extractRange, findMatches, headingPosition, type CitationStorage, type CommentStorage, type ContentsStorage, commentRange, type SearchState } from './extensions';
import { CitationDialog, type CitationChoice } from '../components/citations/CitationDialog';
import { ReferencesPanel } from '../components/citations/ReferencesPanel';
import { BringInSourcesDialog } from '../components/citations/BringInSourcesDialog';
import { OutlinerWindow } from '../components/OutlinerWindow';
import { SendExtractsDialog, type SendSubject } from './SendExtractsDialog';
import { CommentsPane } from './CommentsPane';
import { changesIn, type TrackChangesStorage } from './track-changes';
import { DocumentRail } from './DocumentRail';
import { HeaderFooterBar } from './HeaderFooterBar';
import { useDocumentSpeech } from './speech';
import { ExtractSidebar, type SourceDisplay } from './ExtractSidebar';
import { Ribbon, type RibbonTab, type ViewState } from './Ribbon';
import { documentCommands } from './document-commands';
import './document.css';

/**
 * **The word processor** (addendum 42): what a Document project shows instead
 * of the story workspace.
 *
 * The editor keeps its own document and its own undo, as Word does. What it
 * hands the project is the finished tree, a beat after each burst of typing,
 * through the same `onUpdate` every other edit uses, so saving, autosave,
 * recovery points and sync see a document exactly as they see a beat.
 */

/** The citations' keys in an editor, in order (addendum 43 §11). */
const citeKeysOf = (editor: Editor | null): string[] => {
  const keys: string[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'citation') keys.push(String(node.attrs['key'] ?? ''));
    return true;
  });
  return keys;
};

/** Two readings of the headings' pages that say the same thing, so a redraw is not asked for twice. */
const sameMap = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean =>
  a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);

interface DocumentWorkspaceProps {
  file: ProjectFile;
  document: WpDocument;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  saveState: string;
  onSave(): void;
  onSaveAs(): void;
  readOnly?: boolean;
  /** Where the open project is kept, so sending extracts does not offer it twice. */
  projectPath?: string | null;
  /** Research, opened from the right-hand menu (addendum 42 §16). */
  onOpenResearch?: () => void;
}

/** How long typing must pause before the tree is handed to the project. */
const SETTLE_MS = 300;
/** How long the page view waits after the words change before setting the pages again. */
const PAGE_VIEW_SETTLE_MS = 150;

const PX_PER_INCH = 96;

/** The project's save state, in the words Word's status bar would use. */
const SAVE_WORDS: Record<string, string> = {
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  idle: '',
  error: 'Not saved',
};

const download = async (name: string, bytes: Uint8Array, mediaType: string, kind: { name: string; extension: string }) =>
  window.vcwriter.saveFile({ name, bytes, mediaType, kind });

export function DocumentWorkspace({ file, document, onUpdate, saveState, onSave, onSaveAs, readOnly = false, projectPath = null, onOpenResearch }: DocumentWorkspaceProps) {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [view, setView] = useState<ViewState>({ layout: 'print', navigation: false, marks: false, spelling: true, zoom: 1, fit: 'none' });
  const [finding, setFinding] = useState<'off' | 'find' | 'replace'>('off');
  const [search, setSearch] = useState<SearchState>({ query: '', caseSensitive: false, wholeWord: false, current: -1 });
  const [replacement, setReplacement] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [painter, setPainter] = useState<readonly Mark[] | null>(null);
  const [pages, setPages] = useState(1);
  /** The page each heading stands on in the page view, for the table of contents (addendum 42 §19). */
  const [headingPages, setHeadingPages] = useState<ReadonlyMap<string, number>>(new Map());
  // Extract & Organize (addendum 42 §8).
  const [extracting, setExtracting] = useState(false);
  const [paletteId, setPaletteId] = useState<ExtractPaletteId | null>(null);
  const [display, setDisplay] = useState<SourceDisplay>('normal');
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  // The Outliner tab (addendum 42 §9), and extracts on their way to a project (§10).
  const [pane, setPane] = useState<'document' | 'outliner'>('document');
  const [sending, setSending] = useState<SendSubject | null>(null);
  // Headers, footers and page numbers (addendum 42 §15).
  const [headerFooterOpen, setHeaderFooterOpen] = useState(false);
  // Citations and the Reference Library (addendum 43 §11): the dialog for a
  // citation (its key, or null to insert one), the library, and bringing in.
  const [citing, setCiting] = useState<{ key: string | null } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [bringing, setBringing] = useState(false);

  const documentId = document.id;
  // What this editor last handed the project, so an echo of it is not taken
  // for a change made somewhere else.
  const pushed = useRef<DocNode | null>(document.content);
  const pushedJson = useRef<string>(JSON.stringify(document.content));
  const timer = useRef<number | null>(null);

  const flush = useCallback(
    (editor: Editor | null) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (!editor) return;
      const content = editor.getJSON() as DocNode;
      const json = JSON.stringify(content);
      if (json === pushedJson.current) return;
      pushed.current = content;
      pushedJson.current = json;
      if (readOnly) return;
      // The outline follows the headings (addendum 42 §9); with no outline yet this changes nothing.
      onUpdate((current) => outlineFromDocument(setDocumentContent(current, documentId, content), documentId));
    },
    [documentId, onUpdate, readOnly],
  );

  const editor = useEditor({
    extensions: [...documentExtensions(), PageView],
    content: document.content,
    editable: !readOnly,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'wp-doc', spellcheck: 'true', 'aria-label': 'Document' },
      // A picture pasted or dropped from another program comes in as a picture.
      handlePaste: (_view, event) => insertPictures(event.clipboardData?.files),
      handleDrop: (_view, event) => insertPictures((event as DragEvent).dataTransfer?.files),
      // Insert Citation, on the key the manuscript uses (addendum 43 §4).
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c' && !readOnly) {
          event.preventDefault();
          setCiting({ key: null });
          return true;
        }
        // Word's keys for a footnote and an endnote (addendum 42 §18). By
        // the key's place, since Option changes the letter on a Mac.
        // Word's key for Track Changes (addendum 42 §21).
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyE' && !readOnly) {
          event.preventDefault();
          toggleTrackRef.current();
          return true;
        }
        // Word's key for a new comment (addendum 42 §20).
        if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === 'KeyM' && !readOnly) {
          event.preventDefault();
          newCommentRef.current();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && event.altKey && (event.code === 'KeyF' || event.code === 'KeyD') && !readOnly) {
          event.preventDefault();
          setNoting({ id: null, kind: event.code === 'KeyD' ? 'end' : 'foot', text: '' });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(current), SETTLE_MS);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  /** New comment, as the key handler set up with the editor reaches it. */
  const newCommentRef = useRef<() => void>(() => undefined);
  const toggleTrackRef = useRef<() => void>(() => undefined);

  // Dictate and read aloud (addendum 42 §15).
  const speech = useDocumentSpeech(editor, setMessage);

  // ------------------------------------------------------- citations

  /**
   * The citations as the editor holds them now, in order (addendum 43 §11).
   * Read off the editor rather than the project, which takes the tree a
   * moment after typing settles — a marker drawn from that would be the
   * order of a moment ago.
   */
  const citeKeys: string[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'citation') citeKeys.push(String(node.attrs['key'] ?? ''));
    return node.isBlock || node.type.name === 'doc';
  });
  const citeOrder = citeKeys.join(' ');
  /**
   * The writer's own notes, with the citations, in the order they stand
   * (addendum 42 §18): what their numbers are worked out from, and so what
   * `cites` is read again on.
   */
  const noteParts: string[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'citation') noteParts.push(`c:${String(node.attrs['key'] ?? '')}`);
    else if (node.type.name === 'footnote') noteParts.push(`f:${String(node.attrs['kind'])}:${String(node.attrs['id'])}:${String(node.attrs['text'])}`);
    return node.isBlock || node.type.name === 'doc';
  });
  const noteOrder = noteParts.some((one) => one.startsWith('f:')) ? noteParts.join('\u0001') : '';
  /** The project with this document's citations in the editor's order: all the reading needs. */
  const withEditorOrder = useCallback(
    (current: ProjectFile, keys: readonly string[]): ProjectFile => ({
      ...current,
      documents: current.documents.map((one) =>
        one.id === documentId ? { ...one, content: { type: 'doc', content: keys.map((key) => ({ type: 'citation', attrs: { key } })) } } : one,
      ),
    }),
    [documentId],
  );
  const cites = useMemo(
    () => {
      const read = documentCitations(withEditorOrder(file, citeOrder ? citeOrder.split(' ') : []), documentId);
      return noteOrder ? withWriterNotes(read, (editor?.getJSON() as DocNode | undefined) ?? document.content) : read;
    },
    // The library, the citations, the style and the order are all it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [citeOrder, noteOrder, file.references, file.citations, file.settings.citations, documentId, withEditorOrder],
  );

  useEffect(() => {
    if (!editor) return;
    const markers = new Map<string, string>();
    for (const occurrence of cites.occurrences) {
      if (markers.has(occurrence.key)) continue;
      markers.set(occurrence.key, occurrence.citation && occurrence.reference ? plainInline(cites.inText.get(occurrence.key) ?? '') : '');
    }
    // The writer's notes are numbered beside the citations (addendum 42 §18).
    for (const note of [...cites.notes, ...cites.endnotes]) if (note.key.includes(':')) markers.set(note.key, note.marker);
    editor.commands.setCitationView({ markers, raised: cites.raised, bibliographyHtml: bibliographyHtml(cites) });
  }, [editor, cites]);

  /**
   * **The table of contents, drawn from the headings as they stand** (addendum
   * 42 §19), with each heading's page in the page view; none in web layout,
   * which has no pages.
   */
  const tocSignature: string[] = [];
  editor?.state.doc.forEach((node) => {
    if (node.type.name === 'heading') tocSignature.push(`${String(node.attrs['level'])}:${String(node.attrs['headingId'])}:${node.textContent}`);
    else if (node.type.name === 'tableOfContents') tocSignature.push('toc');
  });
  const tocKey = tocSignature.includes('toc') ? tocSignature.join('\u0001') : '';
  useEffect(() => {
    if (!editor || !tocKey) return;
    const storage = (editor.storage as unknown as { tableOfContents: ContentsStorage }).tableOfContents;
    const entries = contentsEntries({ content: editor.getJSON() as DocNode, headingNumbering: document.headingNumbering });
    storage.set(contentsHtml(entries, view.layout === 'print' ? headingPages : undefined));
  }, [editor, tocKey, headingPages, document.headingNumbering, view.layout]);

  useEffect(() => {
    if (!editor) return undefined;
    const storage = (editor.storage as unknown as { citation: CitationStorage }).citation;
    storage.onOpen = readOnly ? null : (key) => setCiting({ key });
    storage.onOpenNote = readOnly ? null : (id) => openNote(id);
    return () => {
      storage.onOpen = null;
      storage.onOpenNote = null;
    };
  }, [editor, readOnly]);

  // ------------------------------------------------------ comments

  /**
   * **Comments** (addendum 42 §20). The passage carries a `comment` mark; the
   * record is on the document. The pane opens by itself when there are any,
   * and New comment opens it on the comment being written.
   */
  const [commentsShown, setCommentsShown] = useState(document.comments.length > 0);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentAuthor, setCommentAuthor] = useState<string>(() => {
    try {
      return window.localStorage.getItem('vcwriter-comment-author') || file.project.author || '';
    } catch {
      return file.project.author || '';
    }
  });
  const nameAuthor = (name: string) => {
    setCommentAuthor(name);
    try {
      window.localStorage.setItem('vcwriter-comment-author', name);
    } catch {
      // A browser that keeps nothing still lets the name be used now.
    }
  };
  const commentContent = (editor?.getJSON() as DocNode | undefined) ?? document.content;
  const comments = commentListing({ content: commentContent, comments: document.comments });
  const selectComment = (commentId: string) => {
    setActiveComment(commentId);
    const range = editor ? commentRange(editor.state.doc, commentId) : null;
    if (range && editor) editor.chain().setTextSelection(range).scrollIntoView().run();
  };
  const newComment = () => {
    if (!editor || readOnly) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setMessage('Select the words the comment is about, then press New comment.');
      return;
    }
    const id = crypto.randomUUID();
    editor.chain().focus().setComment(id).run();
    onUpdate((current) => addComment(current, documentId, { id, author: commentAuthor || 'Me', text: '' }));
    setCommentsShown(true);
    setActiveComment(id);
    setEditingComment(id);
  };
  const removeComment = (commentId: string) => {
    editor?.chain().unsetComment(commentId).run();
    onUpdate((current) => deleteComment(current, documentId, commentId));
    if (activeComment === commentId) setActiveComment(null);
    if (editingComment === commentId) setEditingComment(null);
  };
  /** The comment beside the cursor's or before it, for Previous and Next. */
  const stepComment = (direction: 1 | -1) => {
    const order = comments.filter((one) => !one.orphan).map((one) => one.comment.id);
    if (order.length === 0) return;
    const at = activeComment ? order.indexOf(activeComment) : -1;
    const next = order[(at + direction + order.length) % order.length] as string;
    setCommentsShown(true);
    selectComment(next);
  };
  useEffect(() => {
    if (!editor) return undefined;
    const storage = (editor.storage as unknown as { comment: CommentStorage }).comment;
    storage.onSelect = (commentId) => {
      if (commentId) {
        setCommentsShown(true);
        setActiveComment(commentId);
      } else {
        setActiveComment(null);
      }
    };
    return () => {
      storage.onSelect = null;
    };
  }, [editor]);

  newCommentRef.current = newComment;

  // ------------------------------------------------ tracked changes

  /**
   * **Track changes** (addendum 42 §21): the switch is the document's, so it
   * travels with it; the changes are made under the same name the comments
   * are. The editor reads both from its storage on every edit.
   */
  useEffect(() => {
    if (!editor) return;
    const storage = (editor.storage as unknown as { trackChanges: TrackChangesStorage }).trackChanges;
    storage.enabled = document.trackChanges && !readOnly;
    storage.author = commentAuthor || 'Me';
  }, [editor, document.trackChanges, commentAuthor, readOnly]);
  const changeCount = editor ? changesIn(editor.state.doc).length : 0;
  const toggleTracking = () => {
    if (!readOnly) onUpdate((current) => setTrackChanges(current, documentId, !document.trackChanges));
  };
  toggleTrackRef.current = toggleTracking;

  // ------------------------------------------------ footnotes and endnotes

  /**
   * **The writer's own note being written** (addendum 42 §18): a new one (no
   * id yet) placed at the cursor on Save, or one clicked in the page.
   */
  const [noting, setNoting] = useState<{ id: string | null; kind: 'foot' | 'end'; text: string } | null>(null);
  const openNote = (id: string) => {
    let found: { kind: 'foot' | 'end'; text: string } | null = null;
    editorRef.current?.state.doc.descendants((node) => {
      if (node.type.name === 'footnote' && node.attrs['id'] === id) {
        found = { kind: node.attrs['kind'] === 'end' ? 'end' : 'foot', text: String(node.attrs['text'] ?? '') };
        return false;
      }
      return true;
    });
    if (found) setNoting({ id, ...(found as { kind: 'foot' | 'end'; text: string }) });
  };
  const saveNote = () => {
    if (!noting || !editor) return;
    const text = noting.text.trim();
    if (noting.id) {
      if (text.length === 0) editor.chain().focus().removeWriterNote(noting.id).run();
      else editor.chain().focus().updateWriterNote(noting.id, { kind: noting.kind, text }).run();
    } else if (text.length > 0) {
      editor.chain().focus().insertWriterNote({ id: crypto.randomUUID(), kind: noting.kind, text }).run();
    }
    setNoting(null);
  };

  /** The dialog's choice: a new citation at the cursor, or the one opened changed. */
  const placeCitation = (choice: CitationChoice) => {
    const opened = citing?.key ? citationByKey(file, citing.key) : null;
    if (opened) {
      onUpdate((current) => updateCitation(current, opened.id, choice));
    } else {
      const made = insertCitation(file, choice);
      // A citation whose record had gone takes the new record under its own
      // key, so the marker in the text stands where it stood.
      const record = citing?.key ? { ...made.citation, key: citing.key } : made.citation;
      onUpdate((current) => ({ ...current, citations: [...current.citations, record] }));
      if (!citing?.key) editor?.chain().focus().insertCitation(record.key).run();
    }
    setCiting(null);
  };

  function insertPictures(files: FileList | undefined | null): boolean {
    const pictures = Array.from(files ?? []).filter((one) => /^image\/(png|jpeg|gif)$/.test(one.type));
    if (!pictures.length) return false;
    pictures.forEach((picture) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') editorRef.current?.chain().focus().setImage({ src: reader.result, alt: picture.name }).run();
      };
      reader.readAsDataURL(picture);
    });
    return true;
  }

  // A change that did not come from this editor: an undo of the whole
  // project, a sync, a recovery point. The editor takes the project's version.
  useEffect(() => {
    if (!editor || document.content === pushed.current) return;
    const json = JSON.stringify(document.content);
    if (json === pushedJson.current) return;
    pushed.current = document.content;
    pushedJson.current = json;
    editor.commands.setContent(document.content, { emitUpdate: false });
  }, [editor, document.content]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Heading numbers are drawn on the page, never typed into it.
  useEffect(() => {
    editor?.commands.setHeadingNumbering(document.headingNumbering);
  }, [editor, document.headingNumbering]);

  // Whatever is still settling is handed over when the workspace closes.
  useEffect(() => () => flush(editorRef.current), [flush]);

  // ------------------------------------------------------------ find

  const matches = useMemo(
    () => (editor && search.query ? findMatches(editor.state.doc, search) : []),
    // The doc is read fresh on each render; this re-runs when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state.doc, search.query, search.caseSensitive, search.wholeWord],
  );

  useEffect(() => {
    editor?.commands.setSearch(finding === 'off' ? { ...search, query: '' } : search);
  }, [editor, search, finding]);

  const goTo = (index: number) => {
    if (!editor || !matches.length) return;
    const next = ((index % matches.length) + matches.length) % matches.length;
    const match = matches[next]!;
    setSearch((current) => ({ ...current, current: next }));
    editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
  };

  const replaceOne = () => {
    if (!editor || readOnly || !matches.length) return;
    const index = search.current >= 0 && search.current < matches.length ? search.current : 0;
    const match = matches[index]!;
    editor.chain().insertContentAt({ from: match.from, to: match.to }, replacement).run();
    setSearch((current) => ({ ...current, current: index }));
  };

  const replaceAll = () => {
    if (!editor || readOnly || !matches.length) return;
    const { tr } = editor.state;
    // From the end, so earlier positions stay where they were.
    [...matches].reverse().forEach((match) => tr.insertText(replacement, match.from, match.to));
    editor.view.dispatch(tr);
    setMessage(`Replaced ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.`);
  };

  // ----------------------------------------------------- format painter

  const startPainter = () => {
    if (!editor) return;
    if (painter) {
      setPainter(null);
      return;
    }
    const { $from } = editor.state.selection;
    setPainter(editor.state.storedMarks ?? $from.marks());
  };

  useEffect(() => {
    if (!editor || !painter) return;
    const paint = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      const { tr } = editor.state;
      tr.removeMark(from, to);
      painter.forEach((mark) => tr.addMark(from, to, mark));
      editor.view.dispatch(tr);
      setPainter(null);
    };
    // A selection made with the mouse is finished when the button comes up.
    const root = editor.view.dom;
    root.addEventListener('mouseup', paint);
    return () => root.removeEventListener('mouseup', paint);
  }, [editor, painter]);

  // ------------------------------------------------------ file actions

  const docOf = useCallback(() => {
    flush(editorRef.current);
    const content = (editorRef.current?.getJSON() as DocNode | undefined) ?? document.content;
    return { ...document, content };
  }, [document, flush]);

  /** This document's citations as print and Word set them, from the editor as it stands. */
  const citesNow = useCallback(
    () =>
      withWriterNotes(
        documentCitations(withEditorOrder(file, citeKeysOf(editorRef.current)), documentId),
        (editorRef.current?.getJSON() as DocNode | undefined) ?? document.content,
      ),
    [file, documentId, withEditorOrder, document.content],
  );

  /**
   * The page the printer and the PDF are made from. In a footnote style the
   * notes stand at the foot of the page they are cited on, the pages set
   * here first (addendum 43 §23); otherwise the browser sets the pages.
   */
  const printable = useCallback(async () => {
    const current = docOf();
    const cites = citesNow();
    const html = editorRef.current?.getHTML() ?? '';
    let paged: string | null = null;
    try {
      paged = await footNotedPrintHtml(current, cites, html);
    } catch {
      paged = null;
    }
    return {
      html: paged ?? documentPrintHtml(current, contentsDocumentHtml(current, citeDocumentHtml(cites, html))),
      paper: pageSize(current.pageSetup),
    };
  }, [docOf, citesNow]);

  const print = useCallback(async () => {
    const { html, paper } = await printable();
    const result = await window.vcwriter.print({ file, kind: 'document', html, paper });
    if (!result.ok) setMessage(result.error ?? 'The document could not be printed');
  }, [file, printable]);

  const exportPdf = useCallback(async () => {
    const { html, paper } = await printable();
    const result = await window.vcwriter.exportPdf({ file, kind: 'document', html, paper });
    if (!result.ok) setMessage(result.error ?? 'The PDF could not be created');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [file, printable]);

  const baseName = (document.title || file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';

  const exportDocx = useCallback(async () => {
    const bytes = await buildDocumentDocx(docOf(), { author: file.project.author ?? '', citations: citesNow() });
    const result = await download(`${baseName}.docx`, bytes, DOCX_MEDIA_TYPE, { name: 'Word document', extension: 'docx' });
    if (!result.ok) setMessage(result.error ?? 'The Word file could not be saved');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [docOf, file.project.author, baseName, citesNow]);

  const exportText = useCallback(async () => {
    // With the heading numbers in front, as the page shows them (addendum 42 §14).
    const text = numberedPlainText(docOf());
    const result = await download(`${baseName}.txt`, new TextEncoder().encode(text), 'text/plain', { name: 'Text', extension: 'txt' });
    if (!result.ok) setMessage(result.error ?? 'The text file could not be saved');
    else if (result.data?.path) setMessage(`Saved ${result.data.path}`);
  }, [docOf, baseName]);

  const insertFile = useCallback(async (chosen: File) => {
    const current = editorRef.current;
    if (!current || readOnly) return;
    try {
      if (/\.docx$/i.test(chosen.name)) {
        // A Word file's footnotes come in as citations, their sources into
        // the library or matched to ones it has (addendum 43 §22).
        const docx = readDocx(await readDocxParts(await chosen.arrayBuffer()));
        const brought = notesIntoLibrary(file, docx.notes ?? []);
        const references = brought.file.references.slice(file.references.length);
        const citations = brought.file.citations.slice(file.citations.length);
        if (citations.length > 0) onUpdate((now) => ({ ...now, references: [...now.references, ...references], citations: [...now.citations, ...citations] }));
        current.chain().focus().insertContent(docxToDocContent(docx, brought.keys).content ?? []).run();
        const notes = citations.length;
        setMessage(
          notes === 0
            ? `Inserted ${chosen.name}.`
            : `Inserted ${chosen.name}, with its ${notes === 1 ? 'footnote' : `${notes} footnotes`} as citations: ` +
                `${brought.added === 1 ? 'one new source' : `${brought.added} new sources`} in References` +
                (brought.reused > 0 ? `, ${brought.reused === 1 ? 'one' : brought.reused} already there.` : '.'),
        );
        return;
      }
      current.chain().focus().insertContent(textToDocContent(await chosen.text()).content ?? []).run();
      setMessage(`Inserted ${chosen.name}.`);
    } catch {
      setMessage(`${chosen.name} could not be read.`);
    }
  }, [readOnly, file, onUpdate]);

  // The app's menus and keys reach the document through this.
  useEffect(() => {
    documentCommands.current = {
      undo: () => editorRef.current?.chain().focus().undo().run(),
      redo: () => editorRef.current?.chain().focus().redo().run(),
      find: () => setFinding('find'),
      replace: () => setFinding('replace'),
      findNext: () => setFinding((current) => (current === 'off' ? 'find' : current)),
      pageSetup: () => setTab('layout'),
      print: () => void print(),
      exportPdf: () => void exportPdf(),
      exportDocx: () => void exportDocx(),
      flush: () => flush(editorRef.current),
    };
    return () => {
      documentCommands.current = null;
    };
  }, [print, exportPdf, exportDocx, flush]);

  // Ctrl+H is Word's replace; Ctrl+F is caught by the app's own menu.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setFinding('replace');
      } else if (event.key === 'Escape' && finding !== 'off') {
        setFinding('off');
        editorRef.current?.commands.focus();
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [finding]);

  // ------------------------------------------------------- layout

  const { width, height } = pageSize(document.pageSetup);
  const margins = document.pageSetup.margins;
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sheet.current;
    if (!node || view.layout !== 'print') return;
    // The words' own height and the margins, not the sheet's: the sheet is
    // drawn at a whole number of pages, so measuring it would never shrink.
    const measure = () => {
      const words = (node.querySelector('.ProseMirror') as HTMLElement | null)?.offsetHeight ?? node.scrollHeight;
      // A quarter inch over is the last paragraph's own space under it, which
      // stands in the bottom margin of a page the page view has filled (addendum
      // 43 §25), and is not a page of its own.
      const used = words + (margins.top + margins.bottom) * PX_PER_INCH - PX_PER_INCH / 4;
      setPages(Math.max(1, Math.ceil(used / (height * PX_PER_INCH) - 0.01)));
    };
    measure();
    // Absent where there is no layout to watch (a test's DOM).
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, view.layout, editor, margins.top, margins.bottom, editor?.state.doc]);

  /**
   * **The page view set into pages, each page's notes at its foot** (addendum
   * 43 §25). Worked out a moment after the words stop changing, and again
   * when the notes, the paper or the margins do; in web layout the gaps go.
   */
  const notesMeasure = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor) return undefined;
    if (view.layout !== 'print') {
      if (pageViewKey.getState(editor.state) !== DecorationSet.empty) {
        editor.view.dispatch(editor.state.tr.setMeta(pageViewKey, DecorationSet.empty).setMeta('addToHistory', false));
      }
      return undefined;
    }
    let timer: number | null = null;
    const run = () => {
      timer = null;
      const box = notesMeasure.current;
      if (!box || editor.isDestroyed) return;
      const laid = layOutPageView(editor, cites, { pageHeight: height, top: margins.top, bottom: margins.bottom }, box);
      setPages(laid.pages);
      setHeadingPages((was) => (sameMap(was, laid.headingPages) ? was : laid.headingPages));
    };
    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(run, PAGE_VIEW_SETTLE_MS);
    };
    schedule();
    editor.on('update', schedule);
    void window.document.fonts?.ready.then(schedule);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor, view.layout, cites, height, width, margins.top, margins.bottom, margins.left, margins.right]);

  // Zoom that follows the window: the whole page, or its width.
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || view.fit === 'none' || view.layout !== 'print') return;
    const fit = () => {
      // Measured on the canvas's parent, which is not zoomed: the canvas's own
      // size is in its zoomed pixels, so reading it would chase its own tail.
      const body = node.parentElement;
      if (!body) return;
      const beside = [...body.children].filter((child) => child !== node).reduce((sum, child) => sum + (child as HTMLElement).offsetWidth, 0);
      const room = { width: body.clientWidth - beside - 48, height: body.clientHeight - 48 };
      if (room.width <= 0 || room.height <= 0) return;
      const page = { width: width * PX_PER_INCH, height: height * PX_PER_INCH };
      const zoom = view.fit === 'page' ? Math.min(room.width / page.width, room.height / page.height) : room.width / page.width;
      const rounded = Math.max(0.25, Math.min(3, Math.round(zoom * 100) / 100));
      setView((current) => (current.zoom === rounded ? current : { ...current, zoom: rounded }));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => observer.disconnect();
  }, [view.fit, view.layout, width, height, view.navigation, extracting]);

  const words = useMemo(() => (editor ? docWordCount(editor.getJSON() as DocNode) : 0), [editor, editor?.state.doc]);
  const characters = useMemo(() => (editor ? docPlainText(editor.getJSON() as DocNode).replace(/\n/g, '').length : 0), [editor, editor?.state.doc]);
  const selectedWords = editor && !editor.state.selection.empty
    ? countTextWords(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '))
    : 0;
  const headings = useMemo(() => (editor ? docHeadings(editor.getJSON() as DocNode) : []), [editor, editor?.state.doc]);

  const jumpTo = (index: number) => {
    if (!editor) return;
    let pos = 0;
    for (let at = 0; at < index && at < editor.state.doc.childCount; at += 1) pos += editor.state.doc.child(at).nodeSize;
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  };

  // General Writing is there the first time the sidebar opens.
  useEffect(() => {
    if (extracting && !readOnly && !file.extractPalettes.some((palette) => palette.builtIn === 'general_writing')) {
      onUpdate(ensureExtractPalettes);
    }
  }, [extracting, readOnly, file.extractPalettes, onUpdate]);

  /**
   * One press, one extract (WP spec §5.1 step 4): the passage is marked in
   * the page and its copy goes into the bin in the **same** change to the
   * project, so the two cannot be saved apart.
   */
  const capture = (category: ExtractCategory) => {
    if (!editor || readOnly) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setExtractNotice('Select text first.');
      return;
    }
    const textPlain = editor.state.doc.textBetween(from, to, '\n', '\uFFFC').trim();
    if (!textPlain) {
      setExtractNotice('That selection has no words in it.');
      return;
    }
    if (isDuplicateExtract(file, { documentId, categoryId: category.id, textPlain })) {
      setExtractNotice(`That passage is already in ${category.label}.`);
      return;
    }
    const id = newId<ExtractId>();
    const textRich = editor.state.doc.slice(from, to).content.toJSON() as DocNode[];
    const mark = editor.schema.marks['extract']!.create({ id, color: category.color, label: category.label });
    // Not an edit to the writing, so not in its undo: Ctrl+Z after a capture
    // takes back the last thing typed, not the mark.
    editor.view.dispatch(editor.state.tr.addMark(from, to, mark).setMeta('addToHistory', false));
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const content = editor.getJSON() as DocNode;
    pushed.current = content;
    pushedJson.current = JSON.stringify(content);
    onUpdate((current) =>
      createExtract(setDocumentContent(current, documentId, content), {
        id,
        documentId,
        categoryId: category.id,
        textPlain,
        textRich,
        sourceRevision: document.revision + 1,
      }).file,
    );
    const count = file.extracts.filter((extract) => extract.categoryId === category.id).length + 1;
    setExtractNotice(`Added to ${category.label} (${count}).`);
  };

  /**
   * Take these extracts' marks off the page, and say what the page is now —
   * or null where none of them was marked. The words are untouched.
   */
  const stripMarks = (ids: ReadonlySet<string>): DocNode | null => {
    if (!editor || ids.size === 0) return null;
    const type = editor.schema.marks['extract']!;
    const { tr } = editor.state;
    editor.state.doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type === type && ids.has(String(mark.attrs['id']))) tr.removeMark(pos, pos + node.nodeSize, mark);
      });
      return true;
    });
    if (!tr.docChanged) return null;
    editor.view.dispatch(tr.setMeta('addToHistory', false));
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const content = editor.getJSON() as DocNode;
    pushed.current = content;
    pushedJson.current = JSON.stringify(content);
    return content;
  };

  /** The copy and its mark go; the words stay in the document. */
  const removeExtract = (extract: Extract) => {
    if (!editor || readOnly) return;
    const content = stripMarks(new Set([extract.id]));
    onUpdate((current) => deleteExtract(content ? setDocumentContent(current, documentId, content) : current, extract.id));
  };

  /** What the destination dialog sent, recorded here; a move also takes the marks off the page. */
  const finishSend = (apply: (current: ProjectFile) => ProjectFile, moved: string[], said: string) => {
    const content = stripMarks(new Set(moved));
    onUpdate((current) => apply(content ? setDocumentContent(current, documentId, content) : current));
    // Rows are sent from the Outliner, where the sidebar's notice is out of sight.
    if (sending?.kind === 'rows') setMessage(said);
    else setExtractNotice(said);
    setSending(null);
  };

  const addToOutline = (extract: Extract) => {
    if (readOnly) return;
    flush(editor);
    const done = linkExtractToOutline(file, documentId, extract.id);
    onUpdate((current) => linkExtractToOutline(current, documentId, extract.id).file);
    setExtractNotice(done.existed ? 'That extract is already in the outline.' : 'Added to the outline.');
  };

  // ------------------------------------------------------ the outliner

  const outlineId = document.outlineId && findOutline(file, document.outlineId as OutlineId) ? document.outlineId : null;

  const openOutliner = () => {
    flush(editor);
    if (!outlineId && !readOnly) onUpdate((current) => ensureDocumentOutline(current, documentId).file);
    setPane('outliner');
  };

  /** A change made in the Outliner, carried into the document's headings. */
  const updateFromOutline = useCallback(
    (mutate: (current: ProjectFile) => ProjectFile) => onUpdate((current) => documentFromOutline(mutate(current), documentId)),
    [onUpdate, documentId],
  );

  const outlineNumbers = useMemo(() => documentOutlineNumbers(document), [document]);

  /** A double-click on a row: to its heading, or to the passage it was extracted from. */
  const openRow = (itemId: string) => {
    if (!editor) return;
    const headingId = headingOfRow(document, itemId);
    const extractId = extractOfRow(document, itemId);
    const at = headingId ? headingPosition(editor.state.doc, headingId) : null;
    const range = extractId ? extractRange(editor.state.doc, extractId) : null;
    if (at === null && range === null) return;
    setPane('document');
    // After the page is shown again, so it can scroll.
    window.setTimeout(() => {
      if (at !== null) editor.chain().focus().setTextSelection(at).scrollIntoView().run();
      else if (range) editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    }, 0);
  };

  const reveal = (extract: Extract) => {
    if (!editor) return;
    const range = extractRange(editor.state.doc, extract.id);
    if (range) editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  };

  if (!editor) return null;

  const sheetStyle =
    view.layout === 'print'
      ? {
          width: `${width}in`,
          minHeight: `${height * pages}in`,
          position: 'relative' as const,
          padding: `${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in`,
          // A rule at the foot of every page, so the writer sees where the
          // pages fall. The words are set into pages when printed.
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${height}in - 1px), var(--wp-page-rule) calc(${height}in - 1px), var(--wp-page-rule) ${height}in)`,
        }
      : {};

  return (
    <div className={`wp-workspace${view.marks ? ' show-marks' : ''} extracts-${display}`}>
      <style>{DOCUMENT_CONTENT_CSS + DOCUMENT_CITATION_CSS + DOCUMENT_CONTENTS_CSS}</style>
      <Ribbon
        editor={editor}
        tab={tab}
        onTab={setTab}
        pageSetup={document.pageSetup}
        onPageSetup={(patch) => onUpdate((current) => setDocumentPageSetup(current, documentId, patch))}
        file={{ save: () => { flush(editor); onSave(); }, saveAs: () => { flush(editor); onSaveAs(); }, print: () => void print(), exportPdf: () => void exportPdf(), exportDocx: () => void exportDocx(), exportText: () => void exportText(), insertFile: (chosen) => void insertFile(chosen) }}
        view={view}
        onView={(patch) => setView((current) => ({ ...current, ...patch }))}
        onFind={setFinding}
        headerFooter={{
          open: headerFooterOpen,
          onToggle: () => setHeaderFooterOpen((current) => !current),
          pageNumbers: pageNumberPresetOf(document),
          onPageNumbers: (preset) => onUpdate((current) => setPageNumbers(current, documentId, preset)),
        }}
        speech={speech}
        changes={{
          tracking: document.trackChanges,
          count: changeCount,
          onTrack: toggleTracking,
          onAccept: () => !readOnly && editor?.chain().focus().acceptChange().goToChange(1).run(),
          onReject: () => !readOnly && editor?.chain().focus().rejectChange().goToChange(1).run(),
          onAcceptAll: () => !readOnly && editor?.chain().focus().acceptAllChanges().run(),
          onRejectAll: () => !readOnly && editor?.chain().focus().rejectAllChanges().run(),
          onPrevious: () => editor?.chain().focus().goToChange(-1).run(),
          onNext: () => editor?.chain().focus().goToChange(1).run(),
        }}
        comments={{
          count: comments.filter((one) => !one.comment.resolved).length,
          shown: commentsShown,
          onNew: newComment,
          onPrevious: () => stepComment(-1),
          onNext: () => stepComment(1),
          onShow: () => setCommentsShown((now) => !now),
        }}
        references={{
          style: REFERENCE_STYLE_NAMES[citationSettingsOf(file).style],
          cited: cites.occurrences.length,
          library: file.references.filter((one) => one.archivedAt === null).length,
          onCite: () => !readOnly && setCiting({ key: null }),
          onBibliography: () => !readOnly && editor?.chain().focus().insertBibliography().run(),
          onLibrary: () => setLibraryOpen(true),
          onContents: () => !readOnly && editor?.chain().focus().insertTableOfContents().run(),
          onFootnote: () => !readOnly && setNoting({ id: null, kind: 'foot', text: '' }),
          onEndnote: () => !readOnly && setNoting({ id: null, kind: 'end', text: '' }),
          onBringIn: () => !readOnly && setBringing(true),
        }}
        onSay={setMessage}
        painting={painter !== null}
        onPaint={startPainter}
        words={words}
        characters={characters}
      />

      {finding !== 'off' ? (
        <form
          className="wp-find"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            goTo(search.current + 1);
          }}
        >
          <input
            autoFocus
            aria-label="Find"
            placeholder="Find in document"
            value={search.query}
            onChange={(event) => setSearch((current) => ({ ...current, query: event.target.value, current: -1 }))}
          />
          <span className="wp-find-count" aria-live="polite">
            {search.query ? (matches.length ? `${search.current >= 0 ? search.current + 1 : 0} of ${matches.length}` : 'No matches') : ''}
          </span>
          <button type="button" onClick={() => goTo(search.current - 1)} disabled={!matches.length} aria-label="Previous match">
            ↑
          </button>
          <button type="submit" disabled={!matches.length} aria-label="Next match">
            ↓
          </button>
          <label>
            <input type="checkbox" checked={search.caseSensitive} onChange={(event) => setSearch((current) => ({ ...current, caseSensitive: event.target.checked, current: -1 }))} /> Match case
          </label>
          <label>
            <input type="checkbox" checked={search.wholeWord} onChange={(event) => setSearch((current) => ({ ...current, wholeWord: event.target.checked, current: -1 }))} /> Whole words
          </label>
          {finding === 'replace' ? (
            <>
              <input aria-label="Replace with" placeholder="Replace with" value={replacement} onChange={(event) => setReplacement(event.target.value)} />
              <button type="button" onClick={replaceOne} disabled={!matches.length || readOnly}>
                Replace
              </button>
              <button type="button" onClick={replaceAll} disabled={!matches.length || readOnly}>
                Replace all
              </button>
            </>
          ) : (
            <button type="button" className="ghost" onClick={() => setFinding('replace')}>
              Replace…
            </button>
          )}
          <button type="button" className="ghost" aria-label="Close find" onClick={() => setFinding('off')}>
            ×
          </button>
        </form>
      ) : null}

      {headerFooterOpen ? (
        <HeaderFooterBar
          value={document.headerFooter}
          readOnly={readOnly}
          onChange={(patch) => onUpdate((current) => setHeaderFooter(current, documentId, patch))}
          onClose={() => setHeaderFooterOpen(false)}
        />
      ) : null}

      <div className="wp-main">
        <div className="wp-stage">
          {message ? (
            <p className="notice banner" role="status">
              {message}
              <button type="button" className="ghost" onClick={() => setMessage(null)}>
                Dismiss
              </button>
            </p>
          ) : null}

          {pane === 'outliner' && outlineId ? (
            <div className="wp-outliner">
              <OutlinerWindow
                file={file}
                open
                page
                onClose={() => setPane('document')}
                onUpdate={updateFromOutline}
                outlineId={outlineId}
                promotion={false}
                numbers={outlineNumbers}
                onOpenRow={(item) => openRow(item.id as string)}
                rowDetail={(item) => {
                  const sent = rowReceipts(document, item.id as string);
                  return sent.length ? (
                    <ul className="wp-row-sent" aria-label="Sent to">
                      {sent.map((receipt) => (
                        <li key={`${receipt.projectId}-${receipt.resultId}-${receipt.at}`} title={receipt.path ?? undefined}>
                          Sent to {receipt.projectTitle || 'a project'} › {receipt.areaName}
                        </li>
                      ))}
                    </ul>
                  ) : null;
                }}
                onSendRows={
                  readOnly
                    ? undefined
                    : (items) => {
                        flush(editor);
                        setSending({
                          kind: 'rows',
                          documentId,
                          itemIds: items.map((item) => item.id as string),
                          titles: items.map((item) => item.title),
                        });
                      }
                }
                toolbar={
                  <label className="wp-numbering">
                    Numbering
                    <select
                      aria-label="Heading numbering"
                      value={document.headingNumbering}
                      disabled={readOnly}
                      onChange={(event) => onUpdate((current) => setHeadingNumbering(current, documentId, event.target.value as HeadingNumbering))}
                    >
                      {HEADING_NUMBERINGS.map((one) => (
                        <option key={one.value} value={one.value}>
                          {one.name}
                        </option>
                      ))}
                    </select>
                  </label>
                }
              />
            </div>
          ) : null}

          <div className="wp-body" hidden={pane === 'outliner'}>
            {view.navigation ? (
              <nav className="wp-nav" aria-label="Navigation">
                <h3>Headings</h3>
                {headings.length ? (
                  <ul>
                    {headings.map((heading) => (
                      <li key={`${heading.index}`} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                        <button type="button" className="ghost" onClick={() => jumpTo(heading.index)}>
                          {heading.text || '(empty heading)'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Headings you add appear here. Use the Styles box on the Home tab.</p>
                )}
              </nav>
            ) : null}
            <div ref={canvas} className={`wp-canvas ${view.layout}`} style={{ zoom: view.zoom } as React.CSSProperties} onMouseDown={(event) => {
              // A press on the grey around the page puts the cursor at the end.
              if (event.target === event.currentTarget) {
                event.preventDefault();
                editor.commands.focus('end');
              }
            }}>
              <div ref={sheet} className="wp-sheet" style={sheetStyle} spellCheck={view.spelling}>
                {view.layout === 'print' && hasHeaderFooter(document) ? (
                  <PageBands
                    document={document}
                    pages={pages}
                    pageHeight={height}
                    onOpen={() => setHeaderFooterOpen(true)}
                  />
                ) : null}
                <EditorContent editor={editor} />
                {view.layout === 'print' ? (
                  // Where the page view measures its notes: the words' width, never seen.
                  <div className="wp-doc wp-notes-measure" aria-hidden="true" style={{ width: `${width - margins.left - margins.right}in` }}>
                    <div ref={notesMeasure} className="wp-page-notes" />
                  </div>
                ) : null}
              </div>
            </div>
            {commentsShown && pane === 'document' ? (
          <CommentsPane
            listing={comments}
            active={activeComment}
            editing={editingComment}
            author={commentAuthor}
            readOnly={readOnly}
            onAuthor={nameAuthor}
            onSelect={selectComment}
            onEdit={(commentId, text) => {
              // A comment being posted takes the name in the box now (addendum 42 §20).
              const posting = editingComment === commentId;
              onUpdate((current) => editComment(current, documentId, commentId, text, posting ? commentAuthor || 'Me' : undefined));
              if (editingComment === commentId) setEditingComment(null);
            }}
            onCancelNew={removeComment}
            onReply={(commentId, text) =>
              onUpdate((current) => replyToComment(current, documentId, commentId, { id: crypto.randomUUID(), author: commentAuthor || 'Me', text }))
            }
            onResolve={(commentId, resolved) => onUpdate((current) => resolveComment(current, documentId, commentId, resolved))}
            onDelete={removeComment}
            onClose={() => setCommentsShown(false)}
          />
        ) : null}
        {extracting && palettesOf(file).length ? (
              <ExtractSidebar
                file={file}
                document={document}
                editor={editor}
                onUpdate={onUpdate}
                paletteId={paletteId}
                onPalette={(id) => {
                  setPaletteId(id);
                  setExtractNotice(null);
                }}
                onCapture={capture}
                onRemove={removeExtract}
                onReveal={reveal}
                onSend={(extracts) => {
                  flush(editor);
                  setSending({ kind: 'extracts', extracts });
                }}
                onAddToOutline={addToOutline}
                display={display}
                onDisplay={setDisplay}
                onClose={() => setExtracting(false)}
                readOnly={readOnly}
                notice={extractNotice}
              />
            ) : null}
          </div>
        </div>
        <DocumentRail
          state={{ pane, navigation: view.navigation, extracting, readOnly }}
          actions={{
            onDocument: () => setPane('document'),
            onOutliner: openOutliner,
            onNavigation: () => setView((current) => ({ ...current, navigation: !current.navigation })),
            ...(onOpenResearch
              ? {
                  onResearch: () => {
                    flush(editor);
                    onOpenResearch();
                  },
                }
              : {}),
            onExtracting: () => setExtracting((current) => !current),
            onSources: () => setLibraryOpen(true),
            onCite: () => !readOnly && setCiting({ key: null }),
            onFind: () => setFinding('find'),
          }}
        />
      </div>

      {citing ? (
        <CitationDialog
          file={withEditorOrder(file, citeKeys)}
          onUpdate={onUpdate}
          citation={citing.key ? citationByKey(file, citing.key) : null}
          missingKey={citing.key && !citationByKey(file, citing.key) ? citing.key : null}
          documentId={documentId}
          onDone={placeCitation}
          onRemove={
            citing.key
              ? () => {
                  editor?.commands.removeCitation(citing.key as string);
                  setCiting(null);
                }
              : undefined
          }
          onClose={() => setCiting(null)}
        />
      ) : null}
      {noting ? (
        <div className="cite-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNoting(null)}>
          <form
            className="cite-dialog wp-note-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={noting.kind === 'end' ? 'Endnote' : 'Footnote'}
            onSubmit={(event) => {
              event.preventDefault();
              saveNote();
            }}
          >
            <header>
              <h3>{noting.id ? 'Edit' : 'Insert'} {noting.kind === 'end' ? 'endnote' : 'footnote'}</h3>
              <button type="button" className="ghost" aria-label="Close" onClick={() => setNoting(null)}>
                ×
              </button>
            </header>
            <div className="wp-note-kind" role="radiogroup" aria-label="Where it goes">
              {(['foot', 'end'] as const).map((kind) => (
                <label key={kind}>
                  <input type="radio" name="wp-note-kind" checked={noting.kind === kind} onChange={() => setNoting({ ...noting, kind })} />{' '}
                  {kind === 'foot' ? 'Footnote — at the foot of the page' : 'Endnote — at the end of the document'}
                </label>
              ))}
            </div>
            <textarea
              aria-label="The note"
              autoFocus
              rows={5}
              value={noting.text}
              placeholder="The note’s words"
              onChange={(event) => setNoting({ ...noting, text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  saveNote();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setNoting(null);
                  editor?.commands.focus();
                }
              }}
            />
            <footer>
              {noting.id ? (
                <button
                  type="button"
                  className="ghost danger-text"
                  onClick={() => {
                    editor?.chain().focus().removeWriterNote(noting.id as string).run();
                    setNoting(null);
                  }}
                >
                  Remove the note
                </button>
              ) : null}
              <span className="wp-status-spacer" />
              <button type="button" className="ghost" onClick={() => setNoting(null)}>
                Cancel
              </button>
              <button type="submit" disabled={noting.text.trim().length === 0 && !noting.id}>
                {noting.id ? 'Save' : 'Insert'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
      {libraryOpen ? (
        <div className="cite-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLibraryOpen(false)}>
          <div className="cite-dialog refs-modal" role="dialog" aria-modal="true" aria-label="Sources and style">
            <header>
              <h2>Sources &amp; style</h2>
              <button type="button" className="ghost" aria-label="Close" onClick={() => setLibraryOpen(false)}>
                ×
              </button>
            </header>
            <ReferencesPanel file={withEditorOrder(file, citeKeys)} onUpdate={onUpdate} readOnly={readOnly} documentId={documentId} projectPath={projectPath} />
          </div>
        </div>
      ) : null}
      {bringing ? <BringInSourcesDialog file={file} projectPath={projectPath} onUpdate={onUpdate} onClose={() => setBringing(false)} /> : null}

      {sending ? (
        <SendExtractsDialog
          file={file}
          projectPath={projectPath}
          subject={sending}
          onClose={() => setSending(null)}
          onSent={finishSend}
        />
      ) : null}

      <footer className="wp-status" aria-label="Status">
        {view.layout === 'print' ? <span>{pages === 1 ? '1 page' : `${pages} pages`}</span> : null}
        <span>
          {selectedWords ? `${selectedWords.toLocaleString()} of ${words.toLocaleString()} words` : `${words.toLocaleString()} words`}
        </span>
        <span>{characters.toLocaleString()} characters</span>
        {painter ? <span className="wp-status-note">Format painter: select text to paint</span> : null}
        {readOnly ? <span className="wp-status-note">Read-only</span> : null}
        {document.trackChanges ? <span className="wp-status-note wp-tracking">Tracking changes</span> : null}
        {speech.dictating ? (
          <span className="wp-status-note wp-dictating" role="status">
            Dictating{speech.heard ? `: ${speech.heard}` : '…'}
          </span>
        ) : null}
        {speech.reading ? <span className="wp-status-note" role="status">Reading aloud</span> : null}
        <span className="wp-status-spacer" />
        <label className="wp-zoom">
          Zoom
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={Math.round(view.zoom * 100)}
            aria-label="Zoom"
            onChange={(event) => setView((current) => ({ ...current, zoom: Number(event.target.value) / 100, fit: 'none' }))}
          />
          <span>{Math.round(view.zoom * 100)}%</span>
        </label>
        <button
          type="button"
          className={`ghost small wp-fit${view.fit === 'page' ? ' on' : ''}`}
          title="One page: the whole page in the window"
          aria-pressed={view.fit === 'page'}
          onClick={() => setView((current) => ({ ...current, fit: 'page', layout: 'print' }))}
        >
          One page
        </button>
        <button
          type="button"
          className={`ghost small wp-fit${view.fit === 'width' ? ' on' : ''}`}
          title="Page width: the page as wide as the window"
          aria-pressed={view.fit === 'width'}
          onClick={() => setView((current) => ({ ...current, fit: 'width', layout: 'print' }))}
        >
          Page width
        </button>
        <span className="wp-save">{SAVE_WORDS[saveState] ?? saveState}</span>
      </footer>
    </div>
  );
}

/**
 * The header and footer on every page, in its margins, with the fields
 * filled in (addendum 42 §15). The page view is set into pages (addendum 43
 * §25), so each page's bands stand where that page's margins are, as the
 * print sets them. A double-click opens the bar to change them, as in Word.
 */
function PageBands({
  document,
  pages,
  pageHeight,
  onOpen,
}: {
  document: WpDocument;
  pages: number;
  pageHeight: number;
  onOpen(): void;
}) {
  const { header, footer, firstPage } = document.headerFooter;
  const values = { pages, title: document.title || '', date: printedDate() };
  const margins = document.pageSetup.margins;
  const band = (slots: typeof header, page: number) =>
    (['left', 'center', 'right'] as const).map((slot) => (
      <span key={slot} className={`wp-band-slot ${slot}`}>
        {fillFields(slots[slot], { ...values, page })}
      </span>
    ));
  const hasHeader = Object.values(header).some((text) => text.trim());
  const hasFooter = Object.values(footer).some((text) => text.trim());
  return (
    <>
      {Array.from({ length: pages }, (_, at) => {
        // The first page carries them only where the document says so.
        if (at === 0 && !firstPage) return null;
        return (
          <Fragment key={at}>
            {hasHeader ? (
              <div
                className="wp-band header"
                style={{ top: `${at * pageHeight + margins.top / 2}in`, left: `${margins.left}in`, right: `${margins.right}in` }}
                title="Header: double-click to change"
                onDoubleClick={onOpen}
                aria-label={at === 0 ? 'Header' : `Header, page ${at + 1}`}
              >
                {band(header, at + 1)}
              </div>
            ) : null}
            {hasFooter ? (
              <div
                className="wp-band footer"
                style={{ top: `${(at + 1) * pageHeight - margins.bottom / 2}in`, left: `${margins.left}in`, right: `${margins.right}in` }}
                title="Footer: double-click to change"
                onDoubleClick={onOpen}
                aria-label={at === 0 ? 'Footer' : `Footer, page ${at + 1}`}
              >
                {band(footer, at + 1)}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
