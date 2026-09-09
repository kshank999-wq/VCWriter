import { createBrowserBridge } from './browser-bridge';

/**
 * Entry point for the browser preview. Installs the browser bridge where the
 * preload script would have put the real one, adds a strip naming the build
 * and offering the current project as a .vcw download, then starts the same
 * application the desktop runs.
 */
const bridge = createBrowserBridge();
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
  strip.innerHTML = `<span>Preview build ${__PREVIEW_BUILD__}</span>`;
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
.preview-strip { position: fixed; left: 10px; bottom: 9px; z-index: 50; display: flex; align-items: center; gap: 8px;
  font: 10.5px ui-sans-serif, system-ui, sans-serif; color: #a3946f; letter-spacing: 0.04em; }
.preview-strip button { font: inherit; color: #c9a45c; background: transparent; border: 1px solid #3a3018; border-radius: 2px; padding: 2px 8px; cursor: pointer; }
.preview-strip button:hover { border-color: #8a6f2f; }
`;
document.head.append(style);

void import('./main');
