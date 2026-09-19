import { useRef, useState } from 'react';
import {
  appendImportedStory,
  docxToProse,
  readDocx,
  summarise,
  type ImportedScript,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * Adding stories to a collection (addendum 22 §4).
 *
 * Each file chosen becomes one story, after the last one already there: a
 * Word document read by its headings (which divide the story into sections
 * and never make stories of their own), or a plain-text file read as
 * paragraphs. What was read is listed before anything is added — the title
 * each story will carry, and how much of it there is — so a document that
 * came in under the wrong name is caught here rather than in the contents
 * page.
 */

interface AddStoriesDialogProps {
  open: boolean;
  file: ProjectFile;
  onClose(): void;
  onAdded(file: ProjectFile): void;
}

interface ReadStory {
  name: string;
  script: ImportedScript;
}

type Stage =
  | { kind: 'waiting' }
  | { kind: 'reading'; count: number }
  | { kind: 'read'; stories: ReadStory[]; failed: string[] };

const bareName = (name: string): string => name.replace(/\.[^.]+$/, '');

/** A plain-text file as one story: its paragraphs, divided by blank lines. */
const plainStory = (name: string, text: string): ImportedScript =>
  summarise({
    title: bareName(name),
    author: '',
    scenes: [
      {
        heading: '',
        elements: text
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
          .filter((paragraph) => paragraph.length > 0)
          .map((paragraph) => ({ type: 'paragraph' as const, text: paragraph })),
      },
    ],
    warnings: [],
    source: 'text',
  });

const readStory = async (chosen: File): Promise<ReadStory> => {
  if (/\.docx$/i.test(chosen.name)) {
    const { readDocxParts } = await import('../read-docx');
    const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
    return { name: chosen.name, script: docxToProse(doc, { title: bareName(chosen.name) }) };
  }
  if (/\.(txt|md|markdown|text)$/i.test(chosen.name)) {
    return { name: chosen.name, script: plainStory(chosen.name, await chosen.text()) };
  }
  throw new Error(`${chosen.name} is not a Word document or a text file.`);
};

const countOf = (script: ImportedScript): { sections: number; words: number } => {
  const scenes = script.scenes.filter((scene) => scene.heading.trim().length > 0 || scene.elements.length > 0);
  const words = scenes.reduce(
    (total, scene) => total + scene.elements.reduce((sum, element) => sum + element.text.trim().split(/\s+/).filter(Boolean).length, 0),
    0,
  );
  return { sections: scenes.length, words };
};

export function AddStoriesDialog({ open, file, onClose, onAdded }: AddStoriesDialogProps) {
  const dialog = useModal(open);
  const picker = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'waiting' });

  const read = async (chosen: FileList) => {
    const files = Array.from(chosen);
    setStage({ kind: 'reading', count: files.length });
    const stories: ReadStory[] = [];
    const failed: string[] = [];
    for (const one of files) {
      try {
        const story = await readStory(one);
        if (countOf(story.script).sections === 0) failed.push(`${one.name}: nothing in it to add.`);
        else stories.push(story);
      } catch (error) {
        failed.push(error instanceof Error ? error.message : `${one.name} could not be read.`);
      }
    }
    setStage({ kind: 'read', stories, failed });
  };

  const finish = () => {
    if (stage.kind !== 'read') return;
    let next = file;
    for (const story of stage.stories) {
      const added = appendImportedStory(next, story.script, { title: story.script.title || bareName(story.name) });
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

  const count = stage.kind === 'read' ? stage.stories.length : 0;

  return (
    <dialog ref={dialog} className="track-dialog import-dialog" aria-label="Add stories to the collection" onClose={close}>
      {open ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Add stories to the collection</span>
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <input
              ref={picker}
              type="file"
              multiple
              accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              aria-label="Story files"
              className="import-picker"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) void read(event.target.files);
              }}
            />

            {stage.kind === 'waiting' ? (
              <p className="muted">
                Word documents (<code>.docx</code>) or plain text, one story each, added after the last story in
                the collection. A document&rsquo;s own headings divide its story into sections; its title, or its
                file name, is what the story is called.
              </p>
            ) : null}

            {stage.kind === 'reading' ? (
              <p className="muted">Reading {stage.count === 1 ? 'the document' : `${stage.count} documents`}…</p>
            ) : null}

            {stage.kind === 'read' ? (
              <>
                {stage.stories.length > 0 ? (
                  <>
                    <h4>{stage.stories.length === 1 ? 'One story' : `${stage.stories.length} stories`}</h4>
                    <ul className="import-list">
                      {stage.stories.map((story) => {
                        const counted = countOf(story.script);
                        return (
                          <li key={story.name}>
                            <span>{story.script.title || bareName(story.name)}</span>
                            <span className="muted">
                              {counted.sections} {counted.sections === 1 ? 'section' : 'sections'} · {counted.words.toLocaleString('en-US')}{' '}
                              {counted.words === 1 ? 'word' : 'words'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
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
              {count <= 1 ? 'Add the story' : `Add ${count} stories`}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
