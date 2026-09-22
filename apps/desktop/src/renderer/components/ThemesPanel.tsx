import { useMemo, useState } from 'react';
import {
  MOTIF_TYPES,
  THEMATIC_STATES,
  addMotif,
  addTheme,
  countOf,
  motifsOfTheme,
  noteOccurrence,
  occurrencesOf,
  relateMotifToTheme,
  removeMotif,
  removeTheme,
  themesOfMotif,
  unrelateMotifFromTheme,
  untagPassage,
  updateMotif,
  updateTheme,
  type BeatId,
  type MotifType,
  type ProjectFile,
  type ResearchMotifId,
  type ResearchThemeId,
  type ThematicKind,
  type ThematicState,
} from '@vcwriter/domain';

/**
 * Themes & Motifs (addendum 12 §§3, 6, 7).
 *
 * **Two tabs, not one list with a filter.** The spec says so twice and it is
 * the decision the whole module rests on: a theme develops and a motif recurs,
 * and the screen that let them share a list would be the place the difference
 * started to go. Each tab shows its own kind's own fields — a theme's intended
 * arc, a motif's type — and neither field appears on the other.
 *
 * **The occurrence list is the point of the screen.** §6 and §7 ask for the same
 * thing of each kind: every tagged moment in story order, with its scene, its
 * beat, what the passage said and what the writer thought it contributed. It is
 * read off the usage links every time, so a scene reordered changes the order
 * here with nothing running, and a passage that has been cut says so instead of
 * disappearing.
 *
 * **Nothing here counts against a target.** §12 forbids prescriptive scoring,
 * and the counts are facts — *met 9 times, 1 of them gone* — with no opinion
 * attached about whether nine is enough.
 */
interface ThemesPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Go and look at a tagged passage. Absent in the popped-out window. */
  onGoTo?(beatId: BeatId): void;
}

const STATE_WORDS: Record<ThematicState, string> = {
  active: 'Working on it',
  resolved: 'Landed',
  set_aside: 'Set aside',
};

export function ThemesPanel({ file, onUpdate, onGoTo }: ThemesPanelProps) {
  const [kind, setKind] = useState<ThematicKind>('theme');
  const [themeId, setThemeId] = useState<ResearchThemeId | null>(null);
  const [motifId, setMotifId] = useState<ResearchMotifId | null>(null);
  const [draft, setDraft] = useState('');

  const themes = file.themes ?? [];
  const motifs = file.motifs ?? [];
  const theme = themes.find((one) => one.id === themeId) ?? themes[0] ?? null;
  const motif = motifs.find((one) => one.id === motifId) ?? motifs[0] ?? null;

  const ownerId = kind === 'theme' ? ((theme?.id ?? '') as string) : ((motif?.id ?? '') as string);
  const occurrences = useMemo(
    () => (ownerId ? occurrencesOf(file, kind, ownerId) : []),
    [file, kind, ownerId],
  );
  const count = ownerId ? countOf(file, kind, ownerId) : { total: 0, resolved: 0, orphans: 0 };

  const make = () => {
    const name = draft.trim();
    if (name.length === 0) return;
    onUpdate((current) => (kind === 'theme' ? addTheme(current, { name }).file : addMotif(current, { name }).file));
    setDraft('');
  };

  return (
    <div className="thematics">
      <aside className="thematics-list">
        <div className="panel-header">
          <div className="tabs" role="tablist" aria-label="Themes or motifs">
            {(['theme', 'motif'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={kind === option}
                className={kind === option ? 'tab selected' : 'tab'}
                onClick={() => setKind(option)}
              >
                {option === 'theme' ? `Themes (${themes.length})` : `Motifs (${motifs.length})`}
              </button>
            ))}
          </div>
        </div>

        <ul className="item-list">
          {(kind === 'theme' ? themes : motifs).map((one) => {
            const met = countOf(file, kind, one.id as string);
            const chosen = kind === 'theme' ? one.id === theme?.id : one.id === motif?.id;
            return (
              <li key={one.id}>
                <button
                  type="button"
                  className={chosen ? 'item selected' : 'item'}
                  onClick={() =>
                    kind === 'theme'
                      ? setThemeId(one.id as ResearchThemeId)
                      : setMotifId(one.id as ResearchMotifId)
                  }
                >
                  <span className="item-title">{one.name || 'Untitled'}</span>
                  {/* A fact, with no opinion about whether it is enough. */}
                  <span className="muted count">{met.total}</span>
                  {met.orphans > 0 ? <span className="thematic-lost">{met.orphans} lost</span> : null}
                </button>
              </li>
            );
          })}
        </ul>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            make();
          }}
        >
          <input
            aria-label={kind === 'theme' ? 'New theme' : 'New motif'}
            placeholder={kind === 'theme' ? 'What a town owes its dead' : 'the bell'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit">{kind === 'theme' ? 'Add theme' : 'Add motif'}</button>
        </form>
      </aside>

      <section className="thematics-detail">
        {kind === 'theme' && theme ? (
          <>
            <input
              className="detail-title"
              aria-label="Theme name"
              value={theme.name}
              onChange={(event) => onUpdate((current) => updateTheme(current, theme.id, { name: event.target.value }))}
            />
            <label className="field">
              <span>What it is</span>
              <textarea
                aria-label="Theme description"
                rows={2}
                placeholder="The idea, the question, the value at issue"
                value={theme.description}
                onChange={(event) =>
                  onUpdate((current) => updateTheme(current, theme.id, { description: event.target.value }))
                }
              />
            </label>
            {/* A theme's own field. A motif has nowhere for this to mean
                anything, which is why they are two kinds. */}
            <label className="field">
              <span>Where it is meant to go</span>
              <textarea
                aria-label="Intended arc"
                rows={2}
                placeholder="Introduced, complicated, contradicted, paid off"
                value={theme.arcNotes}
                onChange={(event) =>
                  onUpdate((current) => updateTheme(current, theme.id, { arcNotes: event.target.value }))
                }
              />
            </label>
            <StateRow
              state={theme.state}
              onChange={(state) => onUpdate((current) => updateTheme(current, theme.id, { state }))}
              onRemove={() => onUpdate((current) => removeTheme(current, theme.id))}
              removeLabel="Delete this theme"
            />

            {/* Its motifs, named as a relationship and never as a merge. */}
            <h3>Its motifs</h3>
            <ul className="thematic-related">
              {motifsOfTheme(file, theme.id).map((one) => (
                <li key={one.id}>
                  <span>
                    {one.name} <span className="muted small">{one.motifType}</span>
                  </span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => onUpdate((current) => unrelateMotifFromTheme(current, theme.id, one.id))}
                  >
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
            <select
              aria-label="Add a motif to this theme"
              value=""
              onChange={(event) => {
                const id = event.target.value as ResearchMotifId;
                if (!id) return;
                onUpdate((current) => relateMotifToTheme(current, theme.id, id));
              }}
            >
              <option value="">Link a motif…</option>
              {motifs.map((one) => (
                <option key={one.id} value={one.id as string}>
                  {one.name || 'Untitled motif'}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {kind === 'motif' && motif ? (
          <>
            <input
              className="detail-title"
              aria-label="Motif name"
              value={motif.name}
              onChange={(event) => onUpdate((current) => updateMotif(current, motif.id, { name: event.target.value }))}
            />
            <label className="field">
              <span>What recurs</span>
              <textarea
                aria-label="Motif description"
                rows={2}
                placeholder="The image, the object, the phrase, the sound"
                value={motif.description}
                onChange={(event) =>
                  onUpdate((current) => updateMotif(current, motif.id, { description: event.target.value }))
                }
              />
            </label>
            {/* A motif's own field, for the same reason. */}
            <label className="field">
              <span>What kind of thing</span>
              <select
                aria-label="Motif type"
                value={motif.motifType}
                onChange={(event) =>
                  onUpdate((current) =>
                    updateMotif(current, motif.id, { motifType: event.target.value as MotifType }),
                  )
                }
              >
                {MOTIF_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <StateRow
              state={motif.state}
              onChange={(state) => onUpdate((current) => updateMotif(current, motif.id, { state }))}
              onRemove={() => onUpdate((current) => removeMotif(current, motif.id))}
              removeLabel="Delete this motif"
            />

            <h3>Themes it belongs to</h3>
            <ul className="thematic-related">
              {themesOfMotif(file, motif.id).map((one) => (
                <li key={one.id}>
                  <span>{one.name}</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => onUpdate((current) => unrelateMotifFromTheme(current, one.id, motif.id))}
                  >
                    Unlink
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {ownerId ? (
          <>
            <h3>
              Where it appears ({count.total})
              {count.orphans > 0 ? <span className="thematic-lost"> · {count.orphans} lost</span> : null}
            </h3>
            <p className="muted small">
              In story order, read off the writing every time — reorder the scenes and this follows.
            </p>
            <ul className="thematic-occurrences">
              {occurrences.map((one) => (
                <li key={one.link.id} className={one.resolved ? '' : 'gone'}>
                  <span className="thematic-where">{one.where}</span>
                  <span className="thematic-text">{one.text || one.link.quote || '—'}</span>
                  <input
                    aria-label="What this moment does"
                    placeholder="What it contributes"
                    value={one.link.note}
                    onChange={(event) =>
                      onUpdate((current) => noteOccurrence(current, one.link.id, event.target.value))
                    }
                  />
                  {onGoTo && one.resolved ? (
                    <button type="button" className="ghost small" onClick={() => onGoTo(one.link.beatId)}>
                      Go to it
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost small"
                    title="Untag — the writing is untouched"
                    onClick={() => onUpdate((current) => untagPassage(current, one.link.id))}
                  >
                    Untag
                  </button>
                </li>
              ))}
            </ul>
            {occurrences.length === 0 ? (
              <p className="muted">
                Nowhere yet. Right-click a passage in the writing and choose <em>Tag a theme or a motif…</em>.
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted empty">
            {kind === 'theme' ? 'Name a theme to work on it.' : 'Name a motif to work on it.'}
          </p>
        )}
      </section>
    </div>
  );
}

/** The state and the way out, shared by both kinds — the one thing that is. */
function StateRow({
  state,
  onChange,
  onRemove,
  removeLabel,
}: {
  state: ThematicState;
  onChange(state: ThematicState): void;
  onRemove(): void;
  removeLabel: string;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="thematic-state">
      <label className="field">
        <span>How it is going</span>
        <select aria-label="State" value={state} onChange={(event) => onChange(event.target.value as ThematicState)}>
          {THEMATIC_STATES.map((one) => (
            <option key={one} value={one}>
              {STATE_WORDS[one]}
            </option>
          ))}
        </select>
      </label>
      {/* §3 asks that removal be confirmed and that it be clear what goes with
          it. What goes is the taggings; the writing is untouched. */}
      {asking ? (
        <div className="thematic-confirm">
          {/* It goes to the graveyard and its taggings go with it — kept, so
              restoring gives back what was there (addendum 24). Saying they
              were cut would be a promise the graveyard could not keep. */}
          <span className="muted small">
            It goes to the graveyard, with its taggings, and can be restored from there. The writing is untouched.
          </span>
          <button type="button" className="ghost small danger" onClick={onRemove}>
            Remove it
          </button>
          <button type="button" className="ghost small" onClick={() => setAsking(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className="ghost small danger" onClick={() => setAsking(true)}>
          {removeLabel}
        </button>
      )}
    </div>
  );
}
