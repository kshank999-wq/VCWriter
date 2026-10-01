import { createBrowserBridge } from './browser-bridge';
import { createCloudBridge, roomFromLocation, versionFromLocation } from './cloud-bridge';

/**
 * Entry point for the browser preview. Installs a bridge where the preload
 * script would have put the real one, adds a strip naming the build and
 * offering the current project as a .vcw download, then starts the same
 * application the desktop runs.
 *
 * **Which bridge depends on the URL.** `?room=<id>` is a Writers Room, and the
 * project lives in the cloud on this writer's own branch (addendum 07 §3.1);
 * without it the project lives in this browser, which is what the preview has
 * always been. The application above does not know the difference, and that is
 * the entire point of the interface.
 */
const room = roomFromLocation(window.location.search);
const version = versionFromLocation(window.location.search);
const bridge = room ? createCloudBridge(room, version) : createBrowserBridge();
window.vcwriter = bridge;

declare const __PREVIEW_BUILD__: string;

/**
 * The strip belongs to the workspace, not to a section pushed onto a second
 * monitor. A satellite window (`?pane=`) is the section and almost nothing
 * else, and the strip sat on top of that section's own toolbar.
 */
if (!new URLSearchParams(window.location.search).get('pane')) {
  const strip = document.createElement('div');
  strip.className = 'preview-strip';
  strip.innerHTML = `<span>${room ? (version ? 'Writers Room · a recorded version' : 'Writers Room') : 'Preview build'} ${__PREVIEW_BUILD__}</span>`;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Download .vcw';
  button.title = 'Save the open project as a file the desktop application opens';
  button.addEventListener('click', () => {
    if (!bridge.downloadCurrent()) window.alert('Open or create a project first.');
  });
  strip.append(button);
  document.body.append(strip);
}

const style = document.createElement('style');
style.textContent = `
/* The tokens rather than the Gold scheme's values, which is what these were:
   #a3946f, #c9a45c, #3a3018 and #8a6f2f are literally Gold's muted, gold,
   border and gold-deep, so the strip read correctly under one scheme and
   stayed gold under every other — grey-on-white once a light scheme was
   chosen. A surface that keeps its own copy of a colour is this project's
   oldest fault, and this one could only be seen by looking (addendum 02
   §23a). */
.preview-strip { position: fixed; left: 10px; bottom: 9px; z-index: 50; display: flex; align-items: center; gap: 8px;
  font: 10.5px ui-sans-serif, system-ui, sans-serif; color: var(--muted); letter-spacing: 0.04em; }
.preview-strip button { font: inherit; color: var(--gold); background: transparent; border: 1px solid var(--border); border-radius: 2px; padding: 2px 8px; cursor: pointer; }
.preview-strip button:hover { border-color: var(--gold-deep); }
`;
document.head.append(style);

void import('./main');
