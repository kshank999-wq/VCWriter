import { useEffect, useRef, useSyncExternalStore } from 'react';
import { mayInstallUnasked } from '@vcwriter/domain';

/**
 * **Updates, as VC Composer has them** (addendum 48; from Ken, 23 November:
 * *VC Composer … has an updating software in it that allows you to install,
 * and it searches for updates. I want to have that same exact feature in VC
 * Writer*).
 *
 *  - **Help → Check for Updates…** opens a window: the version this is,
 *    whether vc-writer.com has a newer one and what changed, a progress bar,
 *    *Install and Restart*, *Check Again*, *Later*, and *Install updates
 *    automatically*.
 *  - **A little after start-up** (and after signing in) VC Writer looks by
 *    itself. Signed in, it downloads the update in the background, checked
 *    against the published checksum, and a bar at the top says how far it has
 *    got. With *Install updates automatically* on (the default) it goes in at
 *    once if everything is saved and the writer is away from the keys — else
 *    by itself at the next start; off, the bar offers *Install and Restart*.
 *  - **The start after an install** says it went in — or that it did not, why,
 *    and offers the installer to run by hand.
 *
 * One store, so the window, the bar and the Account page say the same thing.
 */

export type UpdatePhase =
  | 'unavailable'
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error';

export interface UpdatesSnapshot {
  phase: UpdatePhase;
  currentVersion: string | null;
  /** The version offered, downloading, or downloaded. */
  version: string | null;
  notes: string;
  progress: number;
  message: string | null;
  automatic: boolean;
  /** What the bar at the top says, or null for no bar. */
  banner: { text: string; tone: 'news' | 'warning'; acts: ('install' | 'open' | 'byHand' | 'log' | 'signIn')[] } | null;
  /** The last install failed and left a log to look at. */
  log: boolean;
  dialogOpen: boolean;
  signedIn: boolean;
}

interface Host {
  signedIn: () => boolean;
  saved: () => boolean;
  saveNow: () => Promise<unknown>;
  signIn: () => void;
}

const bridge = () => (typeof window === 'undefined' ? undefined : window.vcwriter);
const supported = () => typeof bridge()?.updateState === 'function';

let snapshot: UpdatesSnapshot = {
  phase: supported() ? 'idle' : 'unavailable',
  currentVersion: null,
  version: null,
  notes: '',
  progress: 0,
  message: null,
  automatic: true,
  banner: null,
  log: false,
  dialogOpen: false,
  signedIn: false,
};
let sha256: string | null = null;
let host: Host = { signedIn: () => false, saved: () => true, saveNow: async () => undefined, signIn: () => undefined };
let lastInput = Date.now();
let started = false;
/** Start-up has looked at what was left from last time (a quiet look waits for it). */
let looked = false;
const listeners = new Set<() => void>();

const set = (next: Partial<UpdatesSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
};

/** The state now (not as narrowed before an await). */
const current = (): UpdatesSnapshot => snapshot;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Reading aloud or dictating: an update never cuts a voice off. */
const busy = (): boolean => {
  const registry = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
  return Boolean(registry?.has('vcw-reading')) || document.querySelector('.dictate-toggle.on, .av-dictate-go.on, .wp-dictating') !== null;
};

export const updates = {
  /** Ask vc-writer.com. */
  async check(): Promise<void> {
    const api = bridge();
    if (!supported() || !api) return;
    if (snapshot.phase === 'downloading' || snapshot.phase === 'installing') return;
    const downloaded = snapshot.phase === 'ready' ? snapshot.version : null;
    set({ phase: 'checking', message: 'Asking vc-writer.com…' });
    const result = await api.checkForUpdate();
    if (!result.ok || !result.data) {
      // Offline, the download already in hand still installs.
      if (downloaded) set({ phase: 'ready', message: `VC Writer ${downloaded} is downloaded and checked, ready to install.` });
      else set({ phase: 'error', message: result.error ?? 'vc-writer.com could not be asked about updates.' });
      return;
    }
    const { decision, currentVersion } = result.data;
    set({ currentVersion });
    if (decision.action === 'update') {
      sha256 = decision.sha256;
      const ready = downloaded === decision.version;
      set({
        phase: ready ? 'ready' : 'available',
        version: decision.version,
        notes: decision.releaseNotes,
        message: ready
          ? `VC Writer ${decision.version} is downloaded and checked, ready to install.`
          : `VC Writer ${decision.version} is available. You have ${currentVersion}.`,
      });
    } else if (decision.action === 'unsupported_os') {
      set({
        phase: 'current',
        version: null,
        notes: '',
        message: `VC Writer ${decision.version} needs ${decision.requires} or later, so it is not offered on this computer. The version you have keeps working.`,
      });
    } else if (decision.action === 'no_build') {
      set({ phase: 'current', version: null, notes: '', message: 'No build has been published for this computer yet.' });
    } else {
      set({ phase: 'current', version: null, notes: '', message: `VC Writer ${currentVersion} is up to date.` });
    }
  },

  /** Download and check the offered build; with `thenInstall`, install it and restart. */
  async download(thenInstall: boolean): Promise<void> {
    const api = bridge();
    if (!api || !snapshot.version || !sha256) return;
    if (!host.signedIn()) {
      set({ message: 'Updates download through your account: sign in, then press Install again.' });
      host.signIn();
      return;
    }
    const version = snapshot.version;
    set({
      phase: 'downloading',
      progress: 0,
      message: `Downloading VC Writer ${version}…`,
      banner: { text: `Downloading VC Writer ${version}…`, tone: 'news', acts: [] },
    });
    const stop = api.onUpdateProgress?.((fraction) =>
      set({
        progress: fraction,
        banner: { text: `Downloading VC Writer ${version}: ${Math.floor(fraction * 100)}%`, tone: 'news', acts: [] },
      }),
    );
    const result = await api.downloadUpdate({ expectedSha256: sha256, version });
    stop?.();
    if (!result.ok || !result.data) {
      set({
        phase: 'error',
        message: result.error ?? 'The update could not be downloaded.',
        banner: {
          text: `The update to ${version} did not download (${result.error ?? 'no answer'}). Help → Check for Updates tries again.`,
          tone: 'warning',
          acts: ['open'],
        },
      });
      return;
    }
    set({ phase: 'ready', progress: 1, message: `VC Writer ${version} is downloaded and checked, ready to install.` });
    if (thenInstall) {
      await updates.install();
      return;
    }
    // Found by itself: never in the writer's way.
    if (
      mayInstallUnasked({ automatic: snapshot.automatic, saved: host.saved(), busy: busy(), idleMs: Date.now() - lastInput })
    ) {
      await updates.install();
      return;
    }
    set({
      banner: snapshot.automatic
        ? {
            text: `VC Writer ${version} is downloaded: it installs by itself the next time VC Writer starts.`,
            tone: 'news',
            acts: ['install'],
          }
        : { text: `VC Writer ${version} is downloaded and ready to install.`, tone: 'news', acts: ['install'] },
    });
  },

  /** Save everything, then install and restart. */
  async install(): Promise<void> {
    const api = bridge();
    if (!api) return;
    const version = snapshot.version ?? '';
    set({ phase: 'installing', message: `Saving, then installing VC Writer ${version}…`, banner: { text: `Installing VC Writer ${version}…`, tone: 'news', acts: [] } });
    try {
      await host.saveNow();
    } catch {
      set({ phase: 'ready', message: 'Your work could not be saved, so the update waits. Save, then try again.', banner: null });
      return;
    }
    const result = await api.installUpdate();
    if (!result.ok) {
      set({
        phase: 'ready',
        message: result.error ?? 'The update could not start.',
        banner: { text: result.error ?? 'The update could not start.', tone: 'warning', acts: [] },
      });
    }
    // On success VC Writer quits for the installer and opens again, updated.
  },

  async setAutomatic(on: boolean): Promise<void> {
    set({ automatic: on });
    await bridge()?.setAutomaticUpdates?.(on);
  },

  openDialog(): void {
    set({ dialogOpen: true });
    if (snapshot.phase !== 'downloading' && snapshot.phase !== 'installing') void updates.check();
  },
  closeDialog(): void {
    set({ dialogOpen: false });
  },
  dismissBanner(): void {
    set({ banner: null });
  },
  openInstaller(): void {
    void bridge()?.openUpdateInstaller?.();
  },
  showLog(): void {
    void bridge()?.showUpdateLog?.();
  },

  /** The quiet look by itself: signed in, it downloads what it finds. */
  async lookQuietly(): Promise<void> {
    if (!supported() || !looked) return;
    if (snapshot.phase !== 'idle' && snapshot.phase !== 'current' && snapshot.phase !== 'error') return;
    await updates.check();
    const found = current();
    if (found.phase !== 'available' || !found.version) {
      if (found.phase === 'error') set({ phase: 'idle', message: null });
      return;
    }
    if (host.signedIn()) {
      await updates.download(false);
    } else {
      set({
        banner: { text: `VC Writer ${found.version} is available. Sign in to download it.`, tone: 'news', acts: ['signIn', 'open'] },
      });
    }
  },

  /** At start: how the last install went, an update waiting, then a look. */
  async start(): Promise<void> {
    const api = bridge();
    if (started || !supported() || !api?.updateState) return;
    started = true;
    const result = await api.updateState();
    if (!result.ok || !result.data) return;
    const { currentVersion, automatic, ready, report } = result.data;
    set({ currentVersion, automatic });
    if (report?.outcome === 'installed') {
      set({ banner: { text: `VC Writer is updated to ${currentVersion}.`, tone: 'news', acts: [] } });
    } else if (report?.outcome === 'failed') {
      set({
        log: report.log !== null,
        banner: {
          text: `The update to VC Writer ${report.version} did not install${report.reason ? ` (${report.reason})` : ''}. You can run its installer by hand.`,
          tone: 'warning',
          acts: ['byHand', ...(report.log ? (['log'] as const) : [])],
        },
      });
    }
    if (ready) {
      set({ phase: 'ready', version: ready, message: `VC Writer ${ready} is downloaded and checked, ready to install.` });
      if (automatic) {
        // Downloaded last time and left for the start: nothing is open yet to interrupt.
        await updates.install();
        return;
      }
      set({ banner: { text: `VC Writer ${ready} is downloaded and ready to install.`, tone: 'news', acts: ['install'] } });
      // Its checksum is needed again only if it has to be fetched again.
      return;
    }
    looked = true;
    window.setTimeout(() => void updates.lookQuietly(), 8000);
  },

  /** What the app tells the updater about itself, each render. */
  configure(next: Host): void {
    host = next;
  },
};

/** The update state, for any component. */
export const useUpdates = (): UpdatesSnapshot => useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

/**
 * Wires the updater to the app: start-up, the quiet look after signing in,
 * and when the writer last touched the keys.
 */
export const useUpdater = (input: Host & { signedInNow: boolean }) => {
  updates.configure(input);
  useEffect(() => {
    void updates.start();
    const touched = () => {
      lastInput = Date.now();
    };
    window.addEventListener('keydown', touched, true);
    window.addEventListener('pointerdown', touched, true);
    return () => {
      window.removeEventListener('keydown', touched, true);
      window.removeEventListener('pointerdown', touched, true);
    };
  }, []);
  // Right after signing in, as Composer does: a look, and the download.
  const wasSignedIn = useRef(input.signedInNow);
  useEffect(() => {
    set({ signedIn: input.signedInNow });
    if (input.signedInNow && !wasSignedIn.current) {
      if (snapshot.phase === 'available') void updates.download(false);
      else void updates.lookQuietly();
    }
    wasSignedIn.current = input.signedInNow;
  }, [input.signedInNow]);
};

/** The bar at the top: downloading, ready, installed, or did not install. */
export function UpdateNotice() {
  const state = useUpdates();
  const banner = state.banner;
  if (!banner) return null;
  return (
    <p className={banner.tone === 'warning' ? 'notice banner update-notice warning' : 'notice banner update-notice'} role="status">
      <span>{banner.text}</span>
      <span className="notice-acts">
        {banner.acts.includes('install') ? (
          <button type="button" className="primary" onClick={() => void updates.install()}>
            Install and Restart
          </button>
        ) : null}
        {banner.acts.includes('signIn') ? (
          <button type="button" className="ghost" onClick={() => host.signIn()}>
            Sign in
          </button>
        ) : null}
        {banner.acts.includes('open') ? (
          <button type="button" className="ghost" onClick={() => updates.openDialog()}>
            Check for Updates…
          </button>
        ) : null}
        {banner.acts.includes('byHand') ? (
          <button type="button" className="ghost" onClick={() => updates.openInstaller()}>
            Run the installer
          </button>
        ) : null}
        {banner.acts.includes('log') ? (
          <button type="button" className="ghost" onClick={() => updates.showLog()}>
            Show what happened
          </button>
        ) : null}
        {state.phase === 'downloading' || state.phase === 'installing' ? null : (
          <button type="button" className="ghost" onClick={() => updates.dismissBanner()}>
            {banner.acts.includes('install') ? 'Later' : 'Dismiss'}
          </button>
        )}
      </span>
    </p>
  );
}

/** What the window and the Account page both show. */
export function UpdatePanel({ onLater }: { onLater?: () => void }) {
  const state = useUpdates();
  if (state.phase === 'unavailable') {
    return <p className="muted">VC Writer updates itself in the desktop app.</p>;
  }
  const working = state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing';
  const offered = state.phase === 'available' || state.phase === 'ready' || (state.phase === 'error' && state.version !== null);
  return (
    <div className="update-panel">
      <p>This is VC Writer {state.currentVersion ?? '…'}.</p>
      <p className={state.phase === 'error' ? 'error' : 'update-status'} role="status">
        {state.message ?? ' '}
      </p>
      {state.phase === 'downloading' ? (
        <progress className="update-progress" value={state.progress} max={1} aria-label="Download progress" />
      ) : null}
      {offered && state.notes ? (
        <p className="update-notes">
          <strong>What’s new: </strong>
          {state.notes}
        </p>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          checked={state.automatic}
          onChange={(event) => void updates.setAutomatic(event.target.checked)}
        />
        Install updates automatically (when everything is saved and you are away from the keys, else at the next start)
      </label>
      <div className="update-buttons">
        <button
          type="button"
          className="primary"
          disabled={working || !offered}
          onClick={() => (state.phase === 'ready' ? void updates.install() : void updates.download(true))}
        >
          {offered && !(state.signedIn || host.signedIn()) && state.phase !== 'ready' ? 'Sign In to Install…' : 'Install and Restart'}
        </button>
        <button type="button" className="ghost" disabled={working} onClick={() => void updates.check()}>
          Check Again
        </button>
        {onLater ? (
          <button type="button" className="ghost update-later" onClick={onLater}>
            Later
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Help → Check for Updates…: the window. */
export function UpdateDialog() {
  const state = useUpdates();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (state.dialogOpen && !element.open) element.showModal?.();
    if (!state.dialogOpen && element.open) element.close();
  }, [state.dialogOpen]);
  return (
    <dialog ref={dialog} className="update-dialog" aria-label="Check for Updates" onClose={() => updates.closeDialog()}>
      {state.dialogOpen ? (
        <>
          <h2>VC Writer updates</h2>
          <UpdatePanel onLater={() => updates.closeDialog()} />
        </>
      ) : null}
    </dialog>
  );
}
