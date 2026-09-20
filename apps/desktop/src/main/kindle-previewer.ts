import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Kindle Previewer (addendum 23 §9): Amazon's own reader for checking a
 * book before it goes to KDP, which KDP recommends running. Ken's spec asks
 * for the handoff *where it is installed*, and otherwise a reminder — so
 * this looks in the places Amazon installs it and opens the EPUB there,
 * and says truthfully when it is not on this machine. Nothing is
 * downloaded and nothing is asked of Amazon.
 */

const candidates = (): string[] => {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
    return [
      join(local, 'Amazon', 'Kindle Previewer 3', 'Kindle Previewer 3.exe'),
      join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Amazon', 'Kindle Previewer 3', 'Kindle Previewer 3.exe'),
    ];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Kindle Previewer 3.app', join(homedir(), 'Applications', 'Kindle Previewer 3.app')];
  }
  return [];
};

export interface PreviewerStatus {
  installed: boolean;
  /** Where it was found, or null. */
  path: string | null;
}

export const kindlePreviewerStatus = async (): Promise<PreviewerStatus> => {
  for (const path of candidates()) {
    try {
      await access(path);
      return { installed: true, path };
    } catch {
      // Not there; the next place.
    }
  }
  return { installed: false, path: null };
};

/** Open an EPUB in Kindle Previewer. Resolves to what stopped it, or null. */
export const openInKindlePreviewer = async (epubPath: string): Promise<string | null> => {
  const status = await kindlePreviewerStatus();
  if (!status.installed || !status.path) return 'Kindle Previewer is not installed on this computer.';
  try {
    const child =
      process.platform === 'darwin'
        ? spawn('open', ['-a', status.path, epubPath], { detached: true, stdio: 'ignore' })
        : spawn(status.path, [epubPath], { detached: true, stdio: 'ignore' });
    child.unref();
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'Kindle Previewer could not be started.';
  }
};
