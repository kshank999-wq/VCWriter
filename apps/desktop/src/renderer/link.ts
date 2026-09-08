import type { ProjectFile } from '@vcwriter/domain';

/**
 * One project, several windows (addendum 02 §8).
 *
 * A section moved to a second monitor is a second window onto the *same*
 * document: typing in the beat window must appear in the Script a moment
 * later, and moving a beat in the lanes must move its text in the beat
 * window. So exactly one window — the workspace — holds the document, and
 * every other window is a client of it.
 *
 * The rule that makes this safe is the ordinary one for optimistic editing:
 *
 *  - A client applies its own edit **immediately**, so typing never waits for
 *    a round trip, and proposes the result to the hub along with the version
 *    it was working from.
 *  - The hub accepts a proposal whose version is the one it holds, and
 *    publishes the result to everyone.
 *  - A proposal from an older version is refused; the client is handed the
 *    current document and **replays** the edits it has not had acknowledged
 *    on top of it. Nothing is dropped and nothing is silently overwritten.
 *
 * The transport is deliberately not named here: in the desktop application it
 * is the main process relaying between windows, in the browser preview it is
 * a `BroadcastChannel` between tabs. Both are the same three lines.
 */

export type LinkMessage =
  | { kind: 'hello'; from: string }
  /** The document as the hub holds it. `acks` records each client's last accepted proposal. */
  | { kind: 'doc'; version: number; file: ProjectFile; path: string | null; acks: Record<string, number> }
  | { kind: 'propose'; from: string; seq: number; baseVersion: number; file: ProjectFile }
  /** The hub is going away: its windows are on their own. */
  | { kind: 'closing' };

export interface LinkTransport {
  send(message: LinkMessage): void;
  subscribe(handler: (message: LinkMessage) => void): () => void;
}

/** A window's own name on the link, stable for as long as the window lives. */
export const linkId = (): string => `w${Math.random().toString(36).slice(2, 10)}`;

/**
 * The transport this window has. The desktop bridge relays through the main
 * process; a browser tab talks to its other tabs directly. A window with
 * neither is simply alone, which is the normal case in tests.
 */
export const createTransport = (): LinkTransport => {
  const bridge = typeof window === 'undefined' ? undefined : window.vcwriter?.link;
  if (bridge) {
    return {
      send: (message) => bridge.send(message as unknown as Record<string, unknown>),
      subscribe: (handler) => bridge.subscribe((message) => handler(message as unknown as LinkMessage)),
    };
  }

  if (typeof BroadcastChannel === 'function') {
    const channel = new BroadcastChannel('vcwriter-link');
    return {
      send: (message) => channel.postMessage(message),
      subscribe: (handler) => {
        const listener = (event: MessageEvent) => handler(event.data as LinkMessage);
        channel.addEventListener('message', listener);
        return () => channel.removeEventListener('message', listener);
      },
    };
  }

  return { send: () => undefined, subscribe: () => () => undefined };
};

// --------------------------------------------------------------------- hub

export interface DocumentHub {
  /** The document changed here. Publishes it, under a new version. */
  publish(file: ProjectFile, path: string | null): void;
  /** Tell the other windows this one is closing, and stop listening. */
  stop(): void;
}

export interface HubOptions {
  transport: LinkTransport;
  /** Adopt a document proposed by another window. */
  onProposal(file: ProjectFile): void;
  /** What the hub currently holds, for answering a window that just opened. */
  current(): { file: ProjectFile | null; path: string | null };
  /**
   * When to actually put a message on the wire. The default is at once, which
   * is what a test wants; the workspace coalesces, so that a held-down key
   * sends the document a few times a second rather than once per character.
   */
  schedule?: Scheduler;
}

/** Defers work, coalescing anything scheduled while a run is already pending. */
export type Scheduler = (run: () => void) => void;

const AT_ONCE: Scheduler = (run) => run();

/** A scheduler that runs at most once every `ms`, always with the latest state. */
export const everyFew = (ms: number): Scheduler => {
  let pending = false;
  return (run) => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      run();
    }, ms);
  };
};

/**
 * The workspace's side of the link. It answers `hello`, judges proposals
 * against the version it holds, and publishes whatever it ends up with.
 */
export const createHub = ({ transport, onProposal, current, schedule = AT_ONCE }: HubOptions): DocumentHub => {
  let version = 0;
  let published: ProjectFile | null = null;
  let path: string | null = null;
  const acks: Record<string, number> = {};

  // Always the document as it stands when the message goes out, not as it
  // stood when the broadcast was asked for.
  const broadcast = () =>
    schedule(() => {
      if (!published) return;
      transport.send({ kind: 'doc', version, file: published, path, acks: { ...acks } });
    });

  const publish: DocumentHub['publish'] = (file, nextPath) => {
    if (file === published && nextPath === path) return;
    published = file;
    path = nextPath;
    version += 1;
    broadcast();
  };

  const unsubscribe = transport.subscribe((message) => {
    if (message.kind === 'hello') {
      const state = current();
      // A window that opened before the project did gets nothing to show; it
      // will be told as soon as there is something.
      if (state.file) {
        published = state.file;
        path = state.path;
        broadcast();
      }
      return;
    }

    if (message.kind !== 'propose') return;

    if (message.baseVersion !== version) {
      // Written against a document that has since moved. Hand back what is
      // current; the proposer replays its edits on top of it.
      broadcast();
      return;
    }

    acks[message.from] = message.seq;
    // The workspace adopts it, and its own publish carries it to everyone —
    // including, with the acknowledgement, back to the window that sent it.
    onProposal(message.file);
  });

  return {
    publish,
    stop() {
      unsubscribe();
      transport.send({ kind: 'closing' });
    },
  };
};

// ------------------------------------------------------------------ client

export interface DocumentClient {
  /** Ask the hub for the document. Called once, when the window opens. */
  hello(): void;
  /**
   * Propose the result of an edit. `mutate` is kept until the hub
   * acknowledges it, so it can be replayed if the document moved underneath.
   */
  propose(file: ProjectFile, mutate: (current: ProjectFile) => ProjectFile): void;
  stop(): void;
}

export interface ClientOptions {
  transport: LinkTransport;
  /** This window's name on the link. */
  self: string;
  /** The document to show: the hub's, with anything unacknowledged replayed. */
  onDocument(next: { file: ProjectFile; path: string | null }): void;
  /** The workspace window closed; this window can no longer save. */
  onHubGone?(): void;
  /** As on the hub: how often a proposal actually goes out. */
  schedule?: Scheduler;
}

/**
 * A satellite window's side of the link: local edits first, the hub's word
 * last, and nothing lost in between.
 */
export const createClient = ({
  transport,
  self,
  onDocument,
  onHubGone,
  schedule = AT_ONCE,
}: ClientOptions): DocumentClient => {
  let version = 0;
  let seq = 0;
  /** Edits made here that the hub has not acknowledged, oldest first. */
  let pending: { seq: number; mutate: (current: ProjectFile) => ProjectFile }[] = [];
  /** The newest local document waiting to be proposed. */
  let queued: ProjectFile | null = null;

  const flush = () => {
    const file = queued;
    const last = pending[pending.length - 1];
    queued = null;
    // Everything proposed so far has been acknowledged: the edits it stood
    // for are in the hub's document already.
    if (!file || !last) return;
    transport.send({ kind: 'propose', from: self, seq: last.seq, baseVersion: version, file });
  };

  const unsubscribe = transport.subscribe((message) => {
    if (message.kind === 'closing') {
      onHubGone?.();
      return;
    }
    if (message.kind !== 'doc') return;
    // A document older than the one in hand is an answer to a question that
    // has since been overtaken — a refusal that crossed with the acceptance
    // of the very edit it refused. Acting on it would put back a document the
    // hub has already moved past.
    if (message.version < version) return;

    version = message.version;
    const acked = message.acks[self] ?? -1;
    pending = pending.filter((edit) => edit.seq > acked);

    // The hub's document is the truth; our own unacknowledged edits go back on
    // top of it, in the order they were made.
    let file = message.file;
    for (const edit of pending) file = edit.mutate(file);
    onDocument({ file, path: message.path });

    // Anything still pending was written against an older version, so it has
    // to be proposed again — now from where the document actually is.
    if (pending.length > 0) {
      queued = file;
      flush();
    }
  });

  return {
    hello: () => transport.send({ kind: 'hello', from: self }),
    propose(file, mutate) {
      seq += 1;
      pending.push({ seq, mutate });
      queued = file;
      schedule(flush);
    },
    stop: unsubscribe,
  };
};
