import { describe, expect, it, vi } from 'vitest';
import { addBeat, createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { createClient, createHub, everyFew, type LinkMessage, type LinkTransport } from '../link';

/**
 * The document link (addendum 02 §8): what a reviewer cannot check by reading —
 * that a window opened later is given the project, that an edit made in one
 * window arrives in the others, and above all that two windows editing at once
 * do not lose either edit.
 */

/**
 * A wire between windows. Sending delivers to every other endpoint and never
 * to the sender, which is what both real transports do; an endpoint can be
 * held so a message can be *in flight* while something else happens.
 */
interface Endpoint {
  transport: LinkTransport;
  /** Stop delivering to this endpoint; the returned call lets the queue through. */
  hold(): () => void;
}

const wire = () => {
  const endpoints: { handler: ((message: LinkMessage) => void) | null; held: LinkMessage[] | null }[] = [];

  const endpoint = (): Endpoint => {
    const self = { handler: null as ((message: LinkMessage) => void) | null, held: null as LinkMessage[] | null };
    endpoints.push(self);
    return {
      transport: {
        send(message) {
          // Structured-clone the way a real transport does, so nothing is
          // shared by reference between "windows".
          const copy = JSON.parse(JSON.stringify(message)) as LinkMessage;
          for (const other of endpoints) {
            if (other === self || !other.handler) continue;
            if (other.held) other.held.push(copy);
            else other.handler(copy);
          }
        },
        subscribe(handler) {
          self.handler = handler;
          return () => {
            self.handler = null;
          };
        },
      },
      hold() {
        self.held = [];
        return () => {
          const queued = self.held ?? [];
          self.held = null;
          for (const message of queued) self.handler?.(message);
        };
      },
    };
  };

  return { endpoint };
};

const project = (): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return addBeat(file, { unitId: file.units[0]!.id }).file;
};

/** A window that holds the document: the workspace's half of the link. */
const workspace = (transport: LinkTransport, initial: ProjectFile) => {
  const state = { file: initial };
  const hub = createHub({
    transport,
    onProposal: (next) => {
      state.file = next;
      hub.publish(next, '/tmp/lighthouse.vcw');
    },
    current: () => ({ file: state.file, path: '/tmp/lighthouse.vcw' }),
  });
  hub.publish(initial, '/tmp/lighthouse.vcw');
  return { state, hub };
};

describe('the document link', () => {
  it('gives a window that opens later the project the workspace is holding', () => {
    const bus = wire();
    const initial = project();
    workspace(bus.endpoint().transport, initial);

    const seen: ProjectFile[] = [];
    const client = createClient({
      transport: bus.endpoint().transport,
      self: 'beat-window',
      onDocument: ({ file }) => seen.push(file),
    });
    client.hello();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.project.title).toBe('Lighthouse');
  });

  it('carries an edit made in one window to the workspace and on to another', () => {
    const bus = wire();
    const initial = project();
    const hub = workspace(bus.endpoint().transport, initial);
    const beatId = initial.beats[0]!.id;

    let mine: ProjectFile | null = null;
    const writer = createClient({
      transport: bus.endpoint().transport,
      self: 'beat-window',
      onDocument: ({ file }) => {
        mine = file;
      },
    });
    writer.hello();

    let theirs: ProjectFile | null = null;
    const reader = createClient({
      transport: bus.endpoint().transport,
      self: 'script-window',
      onDocument: ({ file }) => {
        theirs = file;
      },
    });
    reader.hello();

    const rename = (current: ProjectFile) => updateBeat(current, beatId, { title: 'She arrives' });
    writer.propose(rename(mine as unknown as ProjectFile), rename);

    // The workspace holds it, and the window that is only reading has it too.
    expect(hub.state.file.beats[0]?.title).toBe('She arrives');
    expect((theirs as unknown as ProjectFile).beats[0]?.title).toBe('She arrives');
  });

  it('keeps both edits when a window and the workspace write at the same moment', () => {
    const bus = wire();
    const initial = project();
    const hub = workspace(bus.endpoint().transport, initial);
    const beatId = initial.beats[0]!.id;

    const beatWindow = bus.endpoint();
    let mine: ProjectFile | null = null;
    const writer = createClient({
      transport: beatWindow.transport,
      self: 'beat-window',
      onDocument: ({ file }) => {
        mine = file;
      },
    });
    writer.hello();
    const base = mine as unknown as ProjectFile;

    // Nothing reaches the beat window from here: its edit is written against
    // the document as it was, which is the case the guard exists for.
    const deliver = beatWindow.hold();

    // The workspace renames the beat…
    const renamed = updateBeat(hub.state.file, beatId, { title: 'She arrives' });
    hub.state.file = renamed;
    hub.hub.publish(renamed, '/tmp/lighthouse.vcw');

    // …while the beat window, which cannot know that, takes it out of the script.
    const pull = (current: ProjectFile) => updateBeat(current, beatId, { inScript: false });
    writer.propose(pull(base), pull);

    // The proposal was refused as written against an older version. Once the
    // window catches up it replays its own edit on top of the newer document
    // and proposes again — so the workspace ends up with both.
    deliver();

    expect(hub.state.file.beats[0]?.title).toBe('She arrives');
    expect(hub.state.file.beats[0]?.inScript).toBe(false);
    expect((mine as unknown as ProjectFile).beats[0]?.title).toBe('She arrives');
    expect((mine as unknown as ProjectFile).beats[0]?.inScript).toBe(false);
  });

  it('tells the other windows when the workspace closes', () => {
    const bus = wire();
    const hub = workspace(bus.endpoint().transport, project());
    const gone = vi.fn();
    const client = createClient({
      transport: bus.endpoint().transport,
      self: 'beat-window',
      onDocument: () => undefined,
      onHubGone: gone,
    });
    client.hello();

    hub.hub.stop();
    expect(gone).toHaveBeenCalled();
  });

  it('sends one document rather than one per keystroke', async () => {
    const sent: LinkMessage[] = [];
    const transport: LinkTransport = { send: (message) => sent.push(message), subscribe: () => () => undefined };
    const client = createClient({
      transport,
      self: 'beat-window',
      onDocument: () => undefined,
      schedule: everyFew(5),
    });

    const file = project();
    for (let n = 0; n < 10; n += 1) {
      const type = (current: ProjectFile) => updateBeat(current, file.beats[0]!.id, { title: 'x'.repeat(n) });
      client.propose(type(file), type);
    }
    expect(sent).toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toHaveLength(1);
    // The one that goes out is the newest, and it stands for all ten.
    expect((sent[0] as { seq: number }).seq).toBe(10);
  });
});
