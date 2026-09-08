/**
 * Build the desktop renderer for the browser and put it under public/preview,
 * so the site serves it at /preview/ (docs/deployment.md, "Browser preview").
 *
 * Runs before `next build` (package.json "prebuild"). It is deliberately a
 * separate step that can fail loudly: a site without the preview is still a
 * site, but a preview that silently went stale would defeat its purpose, so
 * a failed renderer build fails the deployment.
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const web = resolve(import.meta.dirname, '..');
const desktop = resolve(web, '..', 'desktop');
const built = resolve(desktop, 'out', 'preview');
const target = resolve(web, 'public', 'preview');

execSync('pnpm exec vite build --config vite.preview.config.ts', { cwd: desktop, stdio: 'inherit' });

if (!existsSync(resolve(built, 'preview.html'))) {
  throw new Error(`Preview build produced no preview.html in ${built}`);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(built, target, { recursive: true });
// The page is the directory's index; Vite named it after its source file.
renameSync(resolve(target, 'preview.html'), resolve(target, 'index.html'));
console.log(`Browser preview copied to ${target}`);
