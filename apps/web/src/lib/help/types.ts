/**
 * The help guides at vc-writer.com/help (addendum 35 §9).
 *
 * A guide is data, not a page: short sections of numbered steps and plain
 * paragraphs, with the program's own screenshots (public/help, public/modules,
 * taken by scripts/shots). The page that draws them is
 * `app/(site)/help/[slug]/page.tsx`.
 */
export type GuideGroup = 'start' | 'modules' | 'rooms';

/** A screenshot under public/, without the extension: 'help/research', 'modules/novel'. */
export type ShotPath = `help/${string}` | `modules/${string}`;

export interface GuideSection {
  readonly heading: string;
  /** Paragraphs, in order. Plain text; **bold** (what to press) and *italic* (the program's own words) are allowed. */
  readonly body?: ReadonlyArray<string>;
  /** Numbered steps, each one action. Button and menu names exactly as the program shows them. */
  readonly steps?: ReadonlyArray<string>;
  /** One short tip shown after the steps. */
  readonly tip?: string;
  readonly shot?: ShotPath;
  readonly shotAlt?: string;
}

export interface Guide {
  readonly slug: string;
  readonly group: GuideGroup;
  readonly title: string;
  /** One sentence for the index and the page description. */
  readonly summary: string;
  /** The picture at the top of the guide. */
  readonly shot?: ShotPath;
  readonly shotAlt?: string;
  readonly sections: ReadonlyArray<GuideSection>;
  /** Slugs of other guides worth reading next. */
  readonly related?: ReadonlyArray<string>;
}
