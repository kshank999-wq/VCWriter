import type { ReactNode } from 'react';

/**
 * **The document's right-hand menu** (addendum 42 §16, from Ken: *it'll have
 * the functions that we talked about in a right-hand vertical menu along the
 * right-hand side*).
 *
 * The ribbon is Word's and holds what Word's holds. What a writer's word
 * processor adds — the Outliner, Research, Extract & Organize, the sources and
 * citations — stands in one column down the right edge, where it is always in
 * reach and never crowds the ribbon. Dictate and Read aloud stay on the ribbon,
 * where Word keeps Dictate. The Document and Outliner pair are tabs, as they
 * were above the page; everything else is a button, pressed in while its panel
 * is open.
 */

export interface RailState {
  pane: 'document' | 'outliner';
  navigation: boolean;
  extracting: boolean;
  readOnly: boolean;
}

export interface RailActions {
  onDocument(): void;
  onOutliner(): void;
  onNavigation(): void;
  onResearch?: () => void;
  onExtracting(): void;
  onSources(): void;
  onCite(): void;
  onFind(): void;
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const ICONS = {
  document: icon(
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 15h6M9 18h4" />
    </>,
  ),
  outliner: icon(<path d="M4 6h2M9 6h11M7 11h2M12 11h8M7 16h2M12 16h8M4 6v10" />),
  navigation: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M9 4v16M5.5 8h2M5.5 11h2M5.5 14h2" />
    </>,
  ),
  research: icon(
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>,
  ),
  extract: icon(
    <>
      <path d="M4 7h10M4 12h7M4 17h10" />
      <path d="M16 9l4 3-4 3" />
    </>,
  ),
  sources: icon(
    <>
      <path d="M5 4h4v16H5zM10 4h4v16h-4z" />
      <path d="M15.5 5l3.5-.8 2.5 15.6-3.5.8z" />
    </>,
  ),
  cite: icon(<path d="M7 9h3v4c0 2-1 3-3 4M14 9h3v4c0 2-1 3-3 4" />),
  find: icon(
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M14 14l6 6M8 10h4" />
    </>,
  ),
};

interface ItemProps {
  label: string;
  name?: string;
  glyph: ReactNode;
  on?: boolean;
  disabled?: boolean;
  /** Mouse-down, so the editor keeps its selection (as the ribbon does). */
  keepSelection?: boolean;
  onPress(): void;
}

function Item({ label, name, glyph, on, disabled, keepSelection, onPress }: ItemProps) {
  return (
    <button
      type="button"
      className={`wp-rail-item${on ? ' on' : ''}`}
      aria-label={name ?? label}
      aria-pressed={on === undefined ? undefined : on}
      title={name ?? label}
      disabled={disabled}
      tabIndex={keepSelection ? -1 : undefined}
      onMouseDown={
        keepSelection
          ? (event) => {
              event.preventDefault();
              onPress();
            }
          : undefined
      }
      onClick={keepSelection ? undefined : onPress}
    >
      {glyph}
      <span>{label}</span>
    </button>
  );
}

export function DocumentRail({ state, actions }: { state: RailState; actions: RailActions }) {
  const inDocument = state.pane === 'document';
  return (
    <nav className="wp-rail" aria-label="Writer’s tools">
      <div role="tablist" aria-label="View" aria-orientation="vertical" className="wp-rail-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={inDocument}
          className={`wp-rail-item${inDocument ? ' on' : ''}`}
          title="The document"
          onClick={actions.onDocument}
        >
          {ICONS.document}
          <span>Document</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!inDocument}
          className={`wp-rail-item${!inDocument ? ' on' : ''}`}
          title="The document's headings as an outline"
          onClick={actions.onOutliner}
        >
          {ICONS.outliner}
          <span>Outliner</span>
        </button>
      </div>
      <hr />
      <Item label="Navigate" name="Navigation pane" glyph={ICONS.navigation} on={state.navigation} disabled={!inDocument} onPress={actions.onNavigation} />
      {actions.onResearch ? <Item label="Research" glyph={ICONS.research} onPress={actions.onResearch} /> : null}
      <Item label="Extract" name="Extract & Organize" glyph={ICONS.extract} on={state.extracting} disabled={!inDocument} keepSelection onPress={actions.onExtracting} />
      <hr />
      <Item label="Sources" name="Sources and style" glyph={ICONS.sources} onPress={actions.onSources} />
      <Item label="Cite" name="Insert a citation" glyph={ICONS.cite} disabled={!inDocument || state.readOnly} keepSelection onPress={actions.onCite} />
      <Item label="Find" name="Find in document" glyph={ICONS.find} disabled={!inDocument} onPress={actions.onFind} />
    </nav>
  );
}
