// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro, in a pnpm workspace (addendum 27 §10).
 *
 * Expo's own defaults handle the workspace: they watch the repository root
 * and resolve `@vcwriter/domain` through its symlink. This file used to turn
 * off Metro's hierarchical lookup and name two `node_modules` folders as the
 * only places a package could come from, to stop a second copy of React being
 * found. Under pnpm that is wrong. Each package's own dependencies live beside
 * it in `.pnpm/<name>@<version>/node_modules`, so React Native could not find
 * `invariant`, and the first iOS build failed at "Bundle JavaScript".
 * One React is now kept by pinning `react` once, in this package, at the
 * version Expo ships (checked against the bundle's source map: one copy).
 */
module.exports = getDefaultConfig(__dirname);
