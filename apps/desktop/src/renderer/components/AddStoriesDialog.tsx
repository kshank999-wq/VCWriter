import { useRef, useState } from 'react';
import { appendImportedEpisode, appendImportedStory, isCollection, type ImportedScript, type ProjectFile } from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { bareName, countOf, readProseFile, readScriptFile, shifted } from '../read-import';

/**
 * Adding to a collection or a series from documents (addendum 22 §4, §4a).
 *
 * Each file chosen becomes one story, or one episode, after the last one
 * already there: for a collection a Word document read by its headings
 * (which divide the story into sections and never make stories of their
 * own) or a plain-text file read as paragraphs; for a series a Final Draft
 * document, a Word document read by its indents, or a PDF. What was read is
 * listed before anything is added — the title each will carry, and how much
 * of it there is — and **the list is the order they go in**, so a season
 * chosen out of order is put right here rather than by moving scenes about
 * afterwards.
 */

interface AddStoriesDialogProps {
  open: boolean;
  file: ProjectFile;
  onClose(): void;
  onAdded(file: ProjectFile): void;
}

interface ReadPart {
  name: string;
  script: ImportedScript;
}

type Stage =
  | { kind: 'waiting' }
  | { kind: 'reading'; count: number }
  | { kind: 'read'; parts: ReadPart[]; failed: string[] };

/** The words for what is being added: a collection takes stories, a series episodes. */
const wordsFor = (collection: boolean) =>
  collection
    ? {
        title: 'Add stories to the collection',
        picker: 'Story files',
        one: 'story',
        many: 'stories',
        division: 'section',
        divisions: 'sections',
        accept: '.docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain',
        explain: (
          <>
            Word documents (<code>.docx</code>) or plain text, one story each, added after the last story in the
            collection. A document&rsquo;s own headings divide its story into sections; its title, or its file name,
            is what the story is called. Each story opens on a page of its own.
          </>
        ),
      }
    : {
        title: 'Add episodes to the series',
        picker: 'Episode files',
        one: 'episode',
        many: 'episodes',
        division: 'scene',
        divisions: 'scenes',
        accept: '.fdx,.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        explain: (
          <>
            Final Draft documents (<code>.fdx</code>), Word documents or PDFs, one episode each, added after the
            last episode in the series. Each opens on a title page of its own, numbered after the ones already
            there; its title, or its file name, is what the episode is called.
          </>
        ),
      };

export function AddStoriesDialog({ open, file, onClose, onAdded }: AddStoriesDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });
  const collection = isCollection(file.project.format);
  const words = wordsFor(collection);

  const read = async (chosen: FileList) => {
    const files = Array.from(chosen);
    setStage({ kind: 'reading', count: files.length });
    const parts: ReadPart[] = [];
    const failed: string[] = [];
    for (const one of files) {
      try {
        const script = collection ? await readProseFile(one) : await readScriptFile(one);
        if (countOf(script).divisions === 0) failed.push(`${one.name}: nothing in it to add.`);
        else parts.push({ name: one.name, script });
      } catch (error) {
        failed.push(error instanceof Error ? error.message : `${one.name} could not be read.`);
      }
    }
    setStage({ kind: 'read', parts, failed });
  };

  const move = (index: number, by: -1 | 1) => {
    if (stage.kind !== 'read') return;
    setStage({ ...stage, parts: shifted(stage.parts, index, by) });
  };

  const drop = (index: number) => {
    if (stage.kind !== 'read') return;
    setStage({ ...stage, parts: stage.parts.filter((_part, at) => at !== index) });
  };

  const finish = () => {
    if (stage.kind !== 'read') return;
    let next = file;
    for (const part of stage.parts) {
      const title = part.script.title || bareName(part.name);
      const added = collection ? appendImportedStory(next, part.script, { title }) : appendImportedEpisode(next, part.script, { title });
      if (added) next = added.file;
    }
    onAdded(next);
    setStage({ kind: 'waiting' });
    onClose();
  };

  const close = () => {
    setStage({ kind: 'waiting' });
    onClose();
  };

  const count = stage.kind === 'read' ? stage.parts.length : 0;

  return (
    <dialog ref={dialog} className="track-dialog import-dialog" aria-label={words.title} onClose={close}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">{words.title}</span>
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <input
              ref={picker}
              type="file"
              multiple
              accept={words.accept}
              aria-label={words.picker}
              className="import-picker"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) void read(event.target.files);
              }}
            />

            {stage.kind === 'waiting' ? <p className="muted">{words.explain}</p> : null}

            {stage.kind === 'reading' ? (
              <p className="muted">Reading {stage.count === 1 ? 'the document' : `${stage.count} documents`}…</p>
            ) : null}

            {stage.kind === 'read' ? (
              <>
                {stage.parts.length > 0 ? (
                  <>
                    <h4>{stage.parts.length === 1 ? `One ${words.one}` : `${stage.parts.length} ${words.many}`}</h4>
                    <ol className="import-list import-order" aria-label={`${words.many} in order`}>
                      {stage.parts.map((part, index) => {
                        const counted = countOf(part.script);
                        const title = part.script.title || bareName(part.name);
                        return (
                          <li key={`${part.name}-${index}`}>
                            <span className="import-order-title">
                              <span className="muted">{index + 1}.</span> {title}
                            </span>
                            <span className="muted">
                              {counted.divisions} {counted.divisions === 1 ? words.division : words.divisions} ·{' '}
                              {counted.words.toLocaleString('en-US')} {counted.words === 1 ? 'word' : 'words'}
                            </span>
                            {/* The order is the order they go in; a list of
                                more than one gets the arrows. */}
                            {stage.parts.length > 1 ? (
                              <span className="import-order-moves">
                                <button type="button" className="ghost small" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="ghost small"
                                  aria-label={`Move ${title} down`}
                                  disabled={index === stage.parts.length - 1}
                                  onClick={() => move(index, 1)}
                                >
                                  ↓
                                </button>
                              </span>
                            ) : null}
                            <button type="button" className="ghost small" aria-label={`Leave out ${title}`} onClick={() => drop(index)}>
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    {stage.parts.length > 1 ? (
                      <p className="muted small">They go in in this order, each on a page of its own.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">Nothing to add.</p>
                )}
                {stage.failed.length > 0 ? (
                  <>
                    <h4>Not read</h4>
                    <ul className="import-warnings">
                      {stage.failed.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="button" className="ghost" onClick={() => picker.current?.click()}>
              {stage.kind === 'read' ? 'Choose others…' : 'Choose files…'}
            </button>
            <button type="button" className="primary" disabled={count === 0} onClick={finish}>
              {count <= 1 ? `Add the ${words.one}` : `Add ${count} ${words.many}`}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
