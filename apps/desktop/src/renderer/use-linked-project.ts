import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFile } from '@vcwriter/domain';
import { createClient, createTransport, everyFew, linkId, type DocumentClient } from './link';

/**
 * A window that is not the workspace, editing the workspace's project
 * (addendum 02 §8).
 *
 * It has the same shape as `useProject` where it matters — a document and an
 * `update` that takes a mutation — so a section does not know or care which
 * kind of window it is drawn in. What it does not have is a path, a save
 * state or an autosave: the workspace owns the file, and saving it is the
 * workspace's job. That is the whole reason the sections can be scattered
 * across monitors without anything being written twice.
 */
export interface LinkedProject {
  file: ProjectFile | null;
  path: string | null;
  /** The workspace answered and this window has the document. */
  connected: boolean;
  /** The workspace window closed; there is nothing left to edit. */
  hubGone: boolean;
  update(mutate: (current: ProjectFile) => ProjectFile): void;
  /**
   * Ask the workspace to save the project somewhere else (addendum 29 §1).
   *
   * **A room does not write the file.** It holds the document but owns no
   * path, so writing one here would leave the two windows disagreeing about
   * where the project is — and a save-as would move the workspace's file
   * without the workspace knowing. The new path arrives as the ordinary `doc`
   * message, which has carried it since the link was built, so nothing had to
   * be added for a room to end up in the right place.
   */
  askToSave(kind: 'saveAs' | 'saveCopy'): void;
}

/** How often a window that is being typed in sends the document on. */
const PROPOSE_EVERY_MS = 60;

/**
 * `writable` is addendum 32 §8's read-only lapse, asked here as well as in the
 * workspace — and it has to be. A satellite applies a mutation **locally
 * first**, because typing must never wait for another window, so a room that
 * did not know would take a paragraph, draw it, and have it wiped by the next
 * document the hub sent: a writer watching their words vanish, which is worse
 * than being told they cannot type them. The standing is a fact about the
 * machine, so the window asks the machine rather than the hub.
 */
export const useLinkedProject = (writable = true): LinkedProject => {
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [hubGone, setHubGone] = useState(false);
  const fileRef = useRef<ProjectFile | null>(null);
  const client = useRef<DocumentClient | null>(null);

  useEffect(() => {
    const connection = createClient({
      transport: createTransport(),
      self: linkId(),
      schedule: everyFew(PROPOSE_EVERY_MS),
      onDocument: (next) => {
        fileRef.current = next.file;
        setFile(next.file);
        setPath(next.path);
        setHubGone(false);
      },
      onHubGone: () => setHubGone(true),
    });
    client.current = connection;
    connection.hello();

    // A window can be on screen before the workspace is listening for it, and
    // a `hello` into an empty room is simply lost. Ask again until answered.
    const asking = window.setInterval(() => {
      if (!fileRef.current) connection.hello();
    }, 400);

    return () => {
      window.clearInterval(asking);
      connection.stop();
      client.current = null;
    };
  }, []);

  const update = useCallback((mutate: (current: ProjectFile) => ProjectFile) => {
    const current = fileRef.current;
    if (!current) return;
    if (!writable) return;
    // Applied here first: typing must never wait for another window.
    const next = mutate(current);
    fileRef.current = next;
    setFile(next);
    client.current?.propose(next, mutate);
  }, [writable]);

  const askToSave = useCallback((kind: 'saveAs' | 'saveCopy') => {
    client.current?.ask(kind);
  }, []);

  return { file, path, connected: file !== null, hubGone, update, askToSave };
};
