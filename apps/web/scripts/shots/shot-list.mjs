/**
 * The shot list (addendum 35 §8): every screenshot of VC Writer the site,
 * the help guides and the release notes use, what it must show, and how the
 * capture reaches it.
 *
 * Each shot opens one demo project (`demo-projects.mjs`, keyed by format) in
 * the browser preview, then runs its steps:
 *
 *   { page: 'Research' }   a button on the bottom bar (a page or a room)
 *   { click: 'Name' }      any button by its accessible name
 *   { select: 'Text' }     click the first thing showing that text
 *   { open: 'Text' }       double-click the first thing showing that text
 *   { label: 'Name' }      click the control with that aria-label
 *   { key: 'ArrowRight', times: 3 }   press a key
 *
 * `start: 'welcome'` leaves the project unopened, on the New project screen.
 *   { wait: 800 }          let something settle
 *
 * `out` is the folder under public/ it is saved to: `modules` for the
 * module pages, `help` for the guides. `uses` says where it appears, so a
 * shot nobody uses can be found and dropped.
 */
export const SHOTS = [
  // ---------------------------------------------------- the module pages
  { id: 'screenplay', project: 'screenplay', out: 'modules', shows: 'A screenplay on the Write page: script, plot tracks, timeline', uses: ['/write/screenplay'] },
  { id: 'series', project: 'series', out: 'modules', shows: 'A series: three episodes on the track', uses: ['/write/series'] },
  { id: 'novel', project: 'novel', out: 'modules', shows: 'A novel: chapters and passages beside the manuscript', uses: ['/write/novel'] },
  { id: 'instructional', project: 'instructional', out: 'modules', shows: 'An instructional book: sections, subsections, end-of-section aids', uses: ['/write/instructional'] },
  { id: 'stage-play', project: 'stage_play', out: 'modules', shows: 'A stage play page', uses: ['/write/stage-play'] },
  { id: 'short-stories', project: 'short_story', out: 'modules', shows: 'A collection: three stories as chapters', uses: ['/write/short-stories'] },
  { id: 'short-form', project: 'short_form', out: 'modules', shows: 'The AV sheet with timings', uses: ['/write/short-form'] },
  { id: 'document', project: 'document', out: 'modules', shows: 'The word processor with a formatted document', uses: ['/write/document'] },

  // ------------------------------------------------------- getting started
  { id: 'new-project', project: 'screenplay', start: 'welcome', out: 'help', shows: 'The New project screen: title, author, the module cards, recent projects', uses: ['help: getting started'] },
  { id: 'project-home', project: 'screenplay', out: 'help', steps: [{ page: 'Home' }], shows: 'A project\'s home page: logline, synopsis, where it stands', uses: ['help: getting started'] },

  // ---------------------------------------------------------------- rooms
  { id: 'research', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }], shows: 'Research: folders and notes', uses: ['help: research'] },
  { id: 'research-note', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { select: 'Plot Points' }, { select: 'Setup: the lantern' }, { click: 'Rewrite and place…' }], shows: 'A note opened to rewrite and place on the track', uses: ['help: research'] },
  { id: 'sculptor', project: 'screenplay', out: 'help', steps: [{ page: 'Sculptor' }, { wait: 1200 }], shows: 'The Story Sculptor: acts, plot points, scenes, cast and links', uses: ['help: story sculptor'] },
  { id: 'outliner', project: 'screenplay', out: 'help', steps: [{ page: 'Outliner' }], shows: 'The Outliner', uses: ['help: outliner'] },
  { id: 'preview', project: 'screenplay', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'Preview: the pages as they will print', uses: ['help: preview'] },
  { id: 'editors', project: 'novel', out: 'help', steps: [{ page: 'Editors' }], shows: 'The two editors', uses: ['help: editors'] },
  { id: 'read-back', project: 'screenplay', out: 'help', steps: [{ page: 'Read back' }], shows: 'Read back: voices per character', uses: ['help: read back'] },
  { id: 'focus', project: 'screenplay', out: 'help', steps: [{ page: 'Focus' }], shows: 'Focus mode: the page and nothing else', uses: ['help: writing'] },

  // ----------------------------------------------------- per-module rooms
  { id: 'novel-layout', project: 'novel', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { label: 'Next spread' }, { label: 'Next spread' }, { label: 'Next spread', wait: 1500 }], shows: 'Layout: the novel set as a book, at its first chapter', uses: ['help: layout'] },
  { id: 'novel-research', project: 'novel', out: 'help', steps: [{ page: 'Research' }], shows: 'Research in a novel', uses: ['help: research'] },
  { id: 'instructional-outliner', project: 'instructional', out: 'help', steps: [{ page: 'Outline' }], shows: 'The book outliner: chapters, sections, subsections', uses: ['help: instructional'] },
  { id: 'instructional-research', project: 'instructional', out: 'help', steps: [{ page: 'Research' }], shows: 'Research with the references library', uses: ['help: citations'] },
  { id: 'series-outliner', project: 'series', out: 'help', steps: [{ page: 'Outliner' }], shows: 'A season in the Outliner', uses: ['help: series'] },
  { id: 'short-stories-layout', project: 'short_story', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { label: 'Next spread' }, { label: 'Next spread' }, { label: 'Next spread', wait: 1500 }], shows: 'A collection set as a book', uses: ['help: short stories'] },
  { id: 'short-form-preview', project: 'short_form', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The AV sheet as it prints', uses: ['help: short form'] },
  { id: 'document-research', project: 'document', out: 'help', steps: [{ click: 'Research' }], shows: 'Research beside the document', uses: ['help: document'] },
  { id: 'document-place-on-page', project: 'document', out: 'help', steps: [{ click: 'Research' }, { select: 'Ideas' }, { select: 'Window history' }, { click: 'Rewrite and place…' }], shows: 'A note ready to Place on page', uses: ['help: document'] },
];
