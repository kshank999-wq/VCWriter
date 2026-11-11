import { isWordProcessor, type ProjectFormat } from '@vcwriter/domain';

/**
 * Help from inside the program (addendum 35 §9): **Help ▸ Guide for this
 * screen** opens the guide on vc-writer.com for whatever the writer is looking
 * at, and **Help ▸ All guides** opens the index.
 *
 * The slugs are the site's (`apps/web/src/lib/help`). A link opened with
 * `window.open` goes to the browser in the desktop app (the main window's
 * open handler) and to a new tab in the browser preview.
 */
export const HELP_BASE = 'https://vc-writer.com/help';

/** The module guide for each format a project can be. */
const MODULE_GUIDES: Partial<Record<ProjectFormat, string>> = {
  screenplay: 'screenplay',
  series: 'series',
  novel: 'novel',
  instructional: 'instructional',
  stage_play: 'stage-play',
  short_story: 'short-stories',
  short_form: 'short-form',
  document: 'document',
};

export interface HelpContext {
  /** The open project's format; null on the New project screen. */
  format: ProjectFormat | null;
  /** The page the bottom bar has chosen. */
  view: string;
  /** The rooms open over it, whichever is in front first. */
  research?: boolean;
  sculptor?: boolean;
  outliner?: boolean;
  layout?: boolean;
  readBack?: boolean;
  focus?: boolean;
}

/** The guide for what is on screen: a room in front wins, then the page, then the module. */
export const guideFor = (context: HelpContext): string => {
  if (context.format === null) return 'getting-started';
  if (context.layout) return 'layout';
  if (context.sculptor) return 'story-sculptor';
  if (context.outliner) return 'outliner';
  if (context.research) return 'research';
  if (context.readBack || context.view === 'readback') return 'read-back';
  if (context.focus) return 'focus';
  switch (context.view) {
    case 'home':
      return 'the-workspace';
    case 'outline':
      return 'outliner';
    case 'preview':
      return 'preview';
    case 'editor':
      return 'editors';
    case 'recovery':
      return 'saving-and-recovery';
    case 'account':
      return 'getting-started';
    default:
      // The Write page of a project is its module's own guide; a document
      // is the word processor whatever page it is on.
      if (isWordProcessor(context.format)) return 'document';
      return MODULE_GUIDES[context.format] ?? 'the-workspace';
  }
};

export const guideUrl = (slug: string | null): string => (slug ? `${HELP_BASE}/${slug}` : HELP_BASE);

/** Open a guide in the browser. */
export const openGuide = (slug: string | null): void => {
  window.open(guideUrl(slug), '_blank', 'noopener');
};

/**
 * The open-source credits (addendum 45 §4). The same list, with every licence
 * text, ships inside the installer as licenses/THIRD-PARTY-NOTICES.txt.
 */
export const CREDITS_URL = 'https://vc-writer.com/credits';

export const openCredits = (): void => {
  window.open(CREDITS_URL, '_blank', 'noopener');
};
