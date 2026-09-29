// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro, in a pnpm workspace (addendum 27 §10).
 *
 * The app imports `@vcwriter/domain`, which is not a published package: it is
 * a symlink into `packages/domain`, and what is imported is its built `dist`.
 * Metro's defaults assume one `node_modules` under the project, so without
 * this the bundler watches only `apps/mobile` and a change in the domain is
 * invisible to it — and on a clean machine the import does not resolve at all.
 *
 * `disableHierarchicalLookup` is the part that is easy to leave out and is the
 * reason this file exists rather than two lines in `app.json`: pnpm's store
 * puts a package's own dependencies under `.pnpm/<name>@<version>/…`, so
 * walking up from a file to find `node_modules` finds the wrong copy of React.
 * The two directories below are the only two that may answer.
 */
const project = __dirname;
const workspace = path.resolve(project, '..', '..');

const config = getDefaultConfig(project);

config.watchFolders = [workspace];
config.resolver.nodeModulesPaths = [
  path.resolve(project, 'node_modules'),
  path.resolve(workspace, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
