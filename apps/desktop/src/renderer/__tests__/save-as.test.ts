import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createProjectFile } from '@vcwriter/domain';
import { createBrowserBridge } from '../browser-bridge';
import { createClient, createHub, type LinkMessage, type LinkTransport } from '../link';

/**
 * Save as, and save a copy (addendum 29 §1).
 *
 * The fault being fixed is a menu item that did neither — labelled *Save a
 * copy…* and running an ordinary save — so what these pin is the pair of
 * things that would let it happen again: **that the two acts write two files
 * rather than one**, and **that a room can reach them at all**, a room having
 * no menu bar and so no other way.
 */

describe('the preview can save somewhere else', () => {
  /**
   * In the browser rather than only on the desktop, because this is the build
   * Ken actually uses — a feature that works everywhere but here reads as
   * unbuilt (addendum 09 §15).
   */
  it('leaves a copy behind and keeps the original where it was', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Lamp', format: 'novel' });
    const { path, file } = created.data!;

    const copied = await bridge.saveProjectAs({ kind: 'copy', file });
    expect(copied.ok).toBe(true);
    // A second file, not the one in hand.
    expect(copied.data!.path).not.toBe(path);
    // And it says it is a copy, or the library lists two rows that look alike.
    expect(copied.data!.file.project.title).toBe('Lamp copy');

    // The original is untouched: same path, same title, still openable.
    const original = await bridge.openProjectAtPath(path);
    expect(original.data!.file.project.title).toBe('Lamp');
  });

  it('a save-as writes the same book elsewhere and does not rename it', async () => {
    const bridge = createBrowserBridge();
    const created = await bridge.createProject({ title: 'Tongs', format: 'novel' });
    const moved = await bridge.saveProjectAs({ kind: 'as', file: created.data!.file });

    expect(moved.data!.path).not.toBe(created.data!.path);
    expect(moved.data!.file.project.title).toBe('Tongs');
  });

  /** Two copies do not collide, which is `pathFor`'s job and is relied on here. */
  it('never writes over a file already there', async () => {
    const bridge = createBrowserBridge();
    const file = createProjectFile({ title: 'Twice', format: 'novel' });
    const first = await bridge.saveProjectAs({ kind: 'copy', file });
    const second = await bridge.saveProjectAs({ kind: 'copy', file });
    expect(first.data!.path).not.toBe(second.data!.path);
  });
});

/** A transport that delivers to everybody but the sender, as the relay does. */
const wire = () => {
  const handlers: ((message: LinkMessage) => void)[] = [];
  const open = (): LinkTransport => {
    const mine: (message: LinkMessage) => void = () => undefined;
    const slot = { fn: mine };
    return {
      send: (message) => handlers.filter((h) => h !== slot.fn).forEach((h) => h(message)),
      subscribe: (handler) => {
        slot.fn = handler;
        handlers.push(handler);
        return () => handlers.splice(handlers.indexOf(handler), 1);
      },
    };
  };
  return { open };
};

describe('a room can ask for it', () => {
  /**
   * **A room does not write the file.** It holds the document and owns no
   * path, so the ask is relayed and the workspace acts — which is also the
   * only way the two windows cannot come to disagree about where the project
   * is. A room having no menu bar, this is the whole of its reach.
   */
  it('relays the ask to the workspace, which is what acts', () => {
    const { open } = wire();
    const file = createProjectFile({ title: 'Relayed', format: 'novel' });
    const onCommand = vi.fn();

    createHub({
      transport: open(),
      onProposal: () => undefined,
      current: () => ({ file, path: '/w/Relayed.vcw' }),
      onCommand,
    });

    const room = createClient({ transport: open(), self: 'r1', onDocument: () => undefined });
    room.ask('saveAs');
    expect(onCommand).toHaveBeenCalledWith('saveAs');

    room.ask('saveCopy');
    expect(onCommand).toHaveBeenLastCalledWith('saveCopy');
  });

  /**
   * It carries a name and never a document, so a command cannot become a
   * second way to change the writing — and a hub built without a handler
   * ignores one rather than failing.
   */
  it('changes nothing about the document, and is survivable unhandled', () => {
    const { open } = wire();
    const file = createProjectFile({ title: 'Untouched', format: 'novel' });
    const onProposal = vi.fn();

    createHub({ transport: open(), onProposal, current: () => ({ file, path: null }) });
    const room = createClient({ transport: open(), self: 'r1', onDocument: () => undefined });

    expect(() => room.ask('saveCopy')).not.toThrow();
    expect(onProposal).not.toHaveBeenCalled();
  });
});
