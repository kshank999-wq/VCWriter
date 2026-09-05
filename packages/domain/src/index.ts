/**
 * @vcwriter/domain — the shared domain model.
 *
 * Spec §14: Windows, macOS, the mobile companion and the web backend all build
 * on this one model rather than forking product logic per platform.
 */
export * from './ids.js';
export * from './ordering.js';
export * from './entities/common.js';
export * from './entities/manuscript.js';
export * from './entities/project.js';
export * from './entities/structure.js';
export * from './entities/research.js';
export * from './entities/character.js';
export * from './entities/links.js';
export * from './entities/setups.js';
export * from './entities/capture.js';
export * from './entities/revision.js';
export * from './entities/commerce.js';
export * from './project-file.js';
export * from './selectors.js';
export * from './mutations.js';
export * from './render.js';
export * from './editing.js';
export * from './pagination.js';
export * from './print-html.js';
