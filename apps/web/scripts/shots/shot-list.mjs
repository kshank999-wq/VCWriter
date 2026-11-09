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
 *   { dblclickNth: ['.block-head', 3] }  double-click the nth match of a selector
 *   { button: /Outliner$/ } a button whose name matches (a pattern for names that change)
 *   { tab: /^Final/ }      a tab whose name matches
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
  { id: 'research-note', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { select: 'Plot Points' }, { select: 'Setup: the cellar' }, { click: 'Rewrite and place…' }], shows: 'A note opened to rewrite and place on the track', uses: ['help: research'] },
  { id: 'research-filed', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { button: /^Open The cemetery$/, wait: 1000 }], shows: 'A section opened from the outline: the notes dropped on it, to rewrite and add as beats', uses: ['/tools/research', 'help: research'] },
  { id: 'research-filed-rewrite', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { button: /^Open The cemetery$/, wait: 800 }, { button: /^Johnny has the car keys/, wait: 300 }, { button: /^Rewrite and add as/, wait: 1200 }], shows: 'The rewrite screen opened from a section, with Add as beat', uses: ['help: research'] },
  { id: 'scene-notes', project: 'screenplay', out: 'help', steps: [{ dblclickNth: ['.block-head', 3], wait: 1200 }], shows: 'A scene box with its notes down the right: red until used, used ones hidden', uses: ['help: research', '/tools/research'] },
  { id: 'writer-notes', project: 'screenplay', out: 'help', steps: [{ dblclickNth: ['.beat-row', 3], wait: 1500 }], shows: 'A beat’s writing screen with its notes down the right', uses: ['help: the workspace'] },
  { id: 'writer-place-text', project: 'screenplay', out: 'help', steps: [{ dblclickNth: ['.beat-row', 3], wait: 1500 }, { open: 'The table legs', wait: 1000 }], shows: 'A note opened from the writing screen, with Place text', uses: ['help: research'] },
  { id: 'sculptor', project: 'screenplay', out: 'help', steps: [{ page: 'Sculptor' }, { wait: 1200 }], shows: 'The Story Sculptor: acts, plot points, scenes, cast and links', uses: ['help: story sculptor'] },
  { id: 'sculptor-outliner', project: 'screenplay', out: 'help', steps: [{ page: 'Sculptor' }, { wait: 1200 }, { button: /Outliner$/, wait: 1200 }], shows: 'The Story Sculptor with the Outliner beside the map, to drag rows onto it', uses: ['/tools/story-sculptor', 'help: story sculptor'] },
  { id: 'character-creator', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { button: /^barbra$/i, wait: 1500 }], shows: 'The Character Creator with a character open', uses: ['/tools/character-creator', 'help: character creator'] },
  { id: 'setups-payoffs', project: 'screenplay', out: 'help', steps: [{ page: 'Research' }, { select: 'Setups & payoffs', wait: 1200 }], shows: 'Setups and payoffs, tracked', uses: ['/tools/research'] },
  { id: 'outliner', project: 'screenplay', out: 'help', steps: [{ page: 'Outliner' }], shows: 'The Outliner', uses: ['help: outliner'] },
  { id: 'preview', project: 'screenplay', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'Preview: the pages as they will print', uses: ['help: preview'] },
  { id: 'editors', project: 'novel', out: 'help', steps: [{ page: 'Editors' }], shows: 'The two editors', uses: ['help: editors'] },
  { id: 'editors-final', project: 'novel', out: 'help', steps: [{ page: 'Editors' }, { tab: /^Final/, wait: 1200 }], shows: 'The Final editor: a story editor reading each scene', uses: ['/tools/editors', 'help: editors'] },
  { id: 'polarity', project: 'screenplay', out: 'help', steps: [{ page: 'Editors' }, { tab: /^Polarity/, wait: 1200 }], shows: 'Polarity: each scene marked up or down, the flat one picked out', uses: ['/workflow/screenplay'] },
  { id: 'read-back', project: 'screenplay', out: 'help', steps: [{ page: 'Read back' }], shows: 'Read back: voices per character', uses: ['help: read back'] },
  { id: 'focus', project: 'screenplay', out: 'help', steps: [{ page: 'Focus' }], shows: 'Focus mode: the page and nothing else', uses: ['help: writing'] },

  // ----------------------------------------------------- per-module rooms
  { id: 'novel-layout', project: 'novel', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { label: 'Next spread' }, { label: 'Next spread' }, { label: 'Next spread', wait: 1500 }], shows: 'Layout: the novel set as a book, at its first chapter', uses: ['help: layout'] },
  { id: 'layout-book-settings', project: 'novel', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { click: 'Book settings…', wait: 1200 }], shows: 'Book settings: trim size, typeface, margins', uses: ['/layout', 'help: layout'] },
  { id: 'layout-chapter-openings', project: 'novel', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { click: 'Chapter openings…', wait: 1200 }], shows: 'Chapter openings: one style for every chapter', uses: ['/layout'] },
  { id: 'layout-ebook', project: 'novel', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { click: 'Export as eBook…', wait: 1500 }], shows: 'Export as eBook: the store presets and the preflight', uses: ['/layout'] },
  { id: 'novel-outliner', project: 'novel', out: 'help', steps: [{ page: 'Outliner', wait: 1200 }], shows: 'A novel in the Outliner: chapters and their passages', uses: ['/write/novel walkthrough'] },
  { id: 'novel-writer', project: 'novel', out: 'help', steps: [{ dblclickNth: ['.beat-row', 1], wait: 1500 }], shows: 'A passage of the novel open for writing', uses: ['/write/novel walkthrough'] },
  { id: 'novel-preview', project: 'novel', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The novel as manuscript pages: title page and contents', uses: ['/write/novel walkthrough'] },
  { id: 'novel-research', project: 'novel', out: 'help', steps: [{ page: 'Research' }], shows: 'Research in a novel', uses: ['help: research'] },
  { id: 'instructional-outliner', project: 'instructional', out: 'help', steps: [{ page: 'Outline' }], shows: 'The book outliner: chapters, sections, subsections', uses: ['help: instructional'] },
  { id: 'instructional-references', project: 'instructional', out: 'help', steps: [{ page: 'Research' }, { select: 'References', wait: 1200 }], shows: 'The references library: the book\'s sources', uses: ['/write/instructional walkthrough'] },
  { id: 'instructional-preview', project: 'instructional', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The instructional book as printed pages, with its contents', uses: ['/write/instructional walkthrough'] },
  { id: 'instructional-layout', project: 'instructional', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { label: 'Next spread' }, { label: 'Next spread' }, { label: 'Next spread', wait: 1500 }], shows: 'The instructional book set as a book', uses: ['/write/instructional walkthrough'] },
  { id: 'instructional-editors', project: 'instructional', out: 'help', steps: [{ page: 'Editors' }, { wait: 1200 }], shows: 'The Daily editor on the instructional book', uses: ['/write/instructional walkthrough'] },
  { id: 'instructional-research', project: 'instructional', out: 'help', steps: [{ page: 'Research' }], shows: 'Research with the references library', uses: ['help: citations'] },
  { id: 'series-writer', project: 'series', out: 'help', steps: [{ dblclickNth: ['.beat-row', 1], wait: 1500 }], shows: 'A scene of an episode open for writing', uses: ['/write/series walkthrough'] },
  { id: 'series-preview', project: 'series', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The season as screenplay pages', uses: ['/write/series walkthrough'] },
  { id: 'series-characters', project: 'series', out: 'help', steps: [{ page: 'Research' }, { button: /^holmes$/i, wait: 1500 }], shows: 'The Character Creator with Holmes open', uses: ['/write/series walkthrough'] },
  { id: 'series-editors', project: 'series', out: 'help', steps: [{ page: 'Editors' }, { wait: 1200 }], shows: 'The Daily editor across the season', uses: ['/write/series walkthrough'] },
  { id: 'series-outliner', project: 'series', out: 'help', steps: [{ page: 'Outliner' }], shows: 'A season in the Outliner', uses: ['help: series'] },
  { id: 'short-stories-layout', project: 'short_story', out: 'help', steps: [{ page: 'Layout' }, { wait: 2000 }, { label: 'Next spread' }, { label: 'Next spread' }, { label: 'Next spread', wait: 1500 }], shows: 'A collection set as a book', uses: ['help: short stories'] },
  { id: 'stage-outliner', project: 'stage_play', out: 'help', steps: [{ page: 'Outliner', wait: 1200 }], shows: 'A play in the Outliner: acts, scenes and beats', uses: ['/write/stage-play walkthrough'] },
  { id: 'stage-writer', project: 'stage_play', out: 'help', steps: [{ dblclickNth: ['.beat-row', 0], wait: 1500 }], shows: 'A scene of the play open for writing', uses: ['/write/stage-play walkthrough'] },
  { id: 'stage-house-style', project: 'stage_play', out: 'help', steps: [{ page: 'Preview' }, { click: 'Page setup…', wait: 1200 }], shows: 'Page setup: the seven stage house styles', uses: ['/write/stage-play walkthrough'] },
  { id: 'stage-cast-page', project: 'stage_play', out: 'help', steps: [{ click: 'File' }, { select: 'Cast page…', wait: 1200 }], shows: 'The cast page: who is in the play', uses: ['/write/stage-play walkthrough'] },
  { id: 'stage-preview', project: 'stage_play', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The play as printed pages', uses: ['/write/stage-play walkthrough'] },
  { id: 'short-stories-outliner', project: 'short_story', out: 'help', steps: [{ page: 'Outliner', wait: 1200 }], shows: 'A collection in the Outliner: three stories and their passages', uses: ['/write/short-stories walkthrough'] },
  { id: 'short-stories-writer', project: 'short_story', out: 'help', steps: [{ dblclickNth: ['.beat-row', 2], wait: 1500 }], shows: 'A passage of a story open for writing', uses: ['/write/short-stories walkthrough'] },
  { id: 'short-stories-editors', project: 'short_story', out: 'help', steps: [{ page: 'Editors' }, { wait: 1200 }], shows: 'The Daily editor on a collection', uses: ['/write/short-stories walkthrough'] },
  { id: 'import-collection', project: 'short_story', start: 'welcome', out: 'help', steps: [{ select: 'Import — a script, a novel, a book or a collection…', wait: 1500 }], shows: 'Import: bring in stories already written', uses: ['/write/short-stories walkthrough'] },
  { id: 'short-form-preview', project: 'short_form', out: 'help', steps: [{ page: 'Preview' }, { wait: 1500 }], shows: 'The AV sheet as it prints', uses: ['help: short form'] },
  { id: 'document-research', project: 'document', out: 'help', steps: [{ click: 'Research' }], shows: 'Research beside the document', uses: ['help: document'] },
  { id: 'document-place-on-page', project: 'document', out: 'help', steps: [{ click: 'Research' }, { select: 'Ideas' }, { select: 'Window history' }, { click: 'Rewrite and place…' }], shows: 'A note ready to Place on page', uses: ['help: document'] },
];
