import { useEffect, useMemo, useState } from 'react';
import {
  ARC_LINK_VERBS,
  ARC_LINK_VERB_NAMES,
  ARC_POINT_KINDS,
  ARC_POINT_NAMES,
  ARC_SHAPE_WORDS,
  PROMINENCE_WORDS,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_KIND_NAMES,
  TRAIT_TONES,
  TRAIT_TONE_WORDS,
  USAGE_STANDING_WORDS,
  USAGE_WORDS,
  addArcPoint,
  addCharacterization,
  addTrait,
  arcEffectsOf,
  answerRelationship,
  arcBoard,
  beginArc,
  characterBoard,
  characterRail,
  railStanding,
  characterCategoriesInOrder,
  characterStanding,
  fileCharacterization,
  isArcVerb,
  isDecisive,
  linkEntities,
  moveArcPoint,
  otherArcPoints,
  pinUsage,
  placesToPin,
  quotableLines,
  ref,
  relate,
  relationshipsOf,
  removeArc,
  removeArcPoint,
  removeCharacterization,
  removeRelationship,
  removeTrait,
  unlink,
  unpinUsage,
  updateArc,
  updateArcPoint,
  updateCharacter,
  updateCharacterization,
  updateRelationship,
  updateTrait,
  whereItAppears,
  workingCast,
  type ArcLinkVerb,
  type ArcPoint,
  type ArcPointId,
  type ArcPointKind,
  type BeatId,
  type CharacterCategoryId,
  type CharacterId,
  type CharacterTrait,
  type CharacterRelationshipId,
  type CharacterTraitId,
  type CharacterizationItemId,
  type CharacterizationRow,
  type ManuscriptElementId,
  type ProjectFile,
  type RailBlock,
  type RailRow,
  type RelationshipKind,
  type RelationshipRow,
  type StoryLinkId,
  type TraitTone,
  type UsageColour,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';

/**
 * The Character Creator (addendum 08 §5, stage 2).
 *
 * **A trait is a folder and the characterization is the work**, so the screen
 * is arranged to say it: traits down the side, and the middle of the screen is
 * the ways one of them gets shown. A layout that put the traits in the middle
 * would be a screen about adjectives.
 *
 * **Red is the ordinary state.** Every piece of characterization starts on deck
 * and most of them stay there for a long time, so the colour is a statement of
 * where things are and never a scolding — §7 is explicit that nothing in this
 * module interrupts writing to say a character is underdeveloped. The legend
 * says so in words, because a red dot with no explanation reads as an error.
 *
 * Nothing here decides what is used: `characterBoard` reads it off the usage
 * links every time (§2), so this component cannot get the colour wrong — it can
 * only draw it.
 */

interface CharacterCreatorProps {
  file: ProjectFile;
  characterId: CharacterId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /**
   * The beat being written, when there is one — the same fact the research
   * shelf uses to mark material used where it landed. It makes the common pin
   * one click, since most of the time somebody is pinning what they just wrote.
   */
  currentBeatId: BeatId | null;
  /** What to call the way out — the cast list, or the map it was opened from. */
  backLabel?: string;
  /**
   * Which tab is open, held by whoever owns the Creator.
   *
   * Controlled rather than kept in here because this component is unmounted
   * every time the writer glances at a folder; keeping it would mean coming
   * back to somebody always landing on Overview, however deep into their arc
   * the work had got.
   */
  tab?: CreatorTab;
  onTab?(tab: CreatorTab): void;
  /** Back to wherever this was opened from. */
  onBack(): void;
}

export type CreatorTab = 'overview' | 'traits' | 'arc' | 'relationships';
type Tab = CreatorTab;

/** Which trait's characterization is being looked at. */
type Shelf = { kind: 'trait'; id: CharacterTraitId } | { kind: 'unfiled' };

const DOT_CLASS: Record<UsageColour, string> = {
  green: 'is-in',
  red: 'is-deck',
  grey: 'is-aside',
};

export function CharacterCreator({
  file,
  characterId,
  currentBeatId,
  backLabel = 'Cast',
  tab: tabFromOwner,
  onTab,
  onUpdate,
  onBack,
}: CharacterCreatorProps) {
  const person = file.characters.find((one) => one.id === characterId) ?? null;
  // Uncontrolled is still allowed, for a caller with nowhere to keep it.
  const [ownTab, setOwnTab] = useState<Tab>('overview');
  const tab = tabFromOwner ?? ownTab;
  const setTab = (next: Tab) => {
    setOwnTab(next);
    onTab?.(next);
  };
  const [shelf, setShelf] = useState<Shelf | null>(null);

  /**
   * What the rail asked to open, and the whole of why clicking a red row is
   * the same act as marking it used: it takes the writer to that piece of work
   * with the **Where** panel already open, so saying where it landed is the
   * next thing they see rather than something to go and find.
   */
  const [reveal, setReveal] = useState<{ kind: 'characterization' | 'arc_point'; id: string } | null>(
    null,
  );

  const board = useMemo(
    () => characterBoard({ characterId: characterId as string, file }),
    [characterId, file],
  );
  const rail = useMemo(
    () => characterRail({ characterId: characterId as string, file }),
    [characterId, file],
  );

  if (!person) {
    return (
      <div className="creator">
        <p className="muted empty-state">That character is not in the project any more.</p>
      </div>
    );
  }

  // What is on the shelf now: the chosen trait, the unfiled pile, or — first
  // time in — whatever there is to look at.
  const chosen: Shelf =
    shelf ??
    (board.traits[0] ? { kind: 'trait', id: board.traits[0].trait.id } : { kind: 'unfiled' });
  const openTrait = chosen.kind === 'trait' ? board.traits.find((entry) => entry.trait.id === chosen.id) : null;
  const rows: CharacterizationRow[] = openTrait ? openTrait.items : chosen.kind === 'unfiled' ? board.unfiled : [];

  return (
    <div className="creator">
      <header className="creator-head">
        <button type="button" className="ghost small" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <InlineText
          value={person.name}
          ariaLabel="Character name"
          className="creator-name"
          onCommit={(name) => onUpdate((current) => updateCharacter(current, person.id, { name }))}
        />
        <span className="muted small creator-standing">{characterStanding(board)}</span>
      </header>

      <nav className="creator-tabs" aria-label="Character">
        {(
          [
            ['overview', 'Overview'],
            ['traits', 'Traits'],
            ['arc', 'Arc'],
            ['relationships', 'Relationships'],
          ] as ReadonlyArray<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'creator-tab selected' : 'creator-tab'}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="creator-body">
        <div className="creator-main">
          {tab === 'overview' ? (
            <Overview file={file} characterId={characterId} onUpdate={onUpdate} />
          ) : tab === 'relationships' ? (
            <Relationships file={file} characterId={characterId} onUpdate={onUpdate} />
          ) : tab === 'arc' ? (
            <Arc
              file={file}
              characterId={characterId}
              currentBeatId={currentBeatId}
              reveal={reveal?.kind === 'arc_point' ? (reveal.id as ArcPointId) : null}
              onRevealed={() => setReveal(null)}
              onUpdate={onUpdate}
            />
          ) : (
            <div className="creator-traits">
              <Traits
                file={file}
                characterId={characterId}
                board={board}
                chosen={chosen}
                onChoose={setShelf}
                onUpdate={onUpdate}
              />
              <Shown
                file={file}
                characterId={characterId}
                trait={openTrait?.trait ?? null}
                unfiled={chosen.kind === 'unfiled'}
                rows={rows}
                currentBeatId={currentBeatId}
                reveal={
                  reveal?.kind === 'characterization' ? (reveal.id as CharacterizationItemId) : null
                }
                onRevealed={() => setReveal(null)}
                onUpdate={onUpdate}
              />
            </div>
          )}
        </div>

        <Rail
          blocks={rail}
          onOpen={(row) => {
            if (!row.owner) return;
            if (row.owner.kind === 'arc_point') {
              setTab('arc');
              setReveal({ kind: 'arc_point', id: row.owner.id });
              return;
            }
            // Put the right trait on the shelf first, or the item would be
            // opened on a tab that is not showing it.
            const item = file.characterizationItems.find((one) => (one.id as string) === row.owner!.id);
            setShelf(
              item?.traitId ? { kind: 'trait', id: item.traitId } : { kind: 'unfiled' },
            );
            setTab('traits');
            setReveal({ kind: 'characterization', id: row.owner.id });
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the rail

/**
 * Everything this character has, down the side, each row red or green
 * (addendum 08 §12).
 *
 * The Creator answers *what is this person like* one tab at a time. The rail
 * answers the other question a writer has — **what have I made for them, and
 * what is still owed** — without making them look in three places for it.
 *
 * There is no "mark as used" here, and that is the module's oldest rule rather
 * than an omission (§2): green means the manuscript contains it, read off the
 * usage links every time, so cutting the scene turns a row red by itself. What
 * a click does instead is open the work with **Where** already showing, which
 * is the same gesture and one press — and leaves the colour meaning something.
 */
function Rail({
  blocks,
  onOpen,
}: {
  blocks: RailBlock[];
  onOpen(row: RailRow): void;
}) {
  return (
    <aside className="creator-rail" aria-label="Everything for this character">
      <header className="creator-rail-head">
        <h4>Made for them</h4>
        <span className="muted small">{railStanding(blocks)}</span>
      </header>

      {blocks.length === 0 ? (
        <p className="muted small creator-rail-empty">
          Nothing yet. A trait, an arc point or a note will turn up here.
        </p>
      ) : null}

      {blocks.map((block) => (
        <section key={block.key} className="creator-rail-block">
          <h5>
            <span>{block.title}</span>
            {/* What it owes, not how much is in it: a count of rows says
                nothing a writer is short of. */}
            {block.onDeck > 0 ? (
              <span className="creator-rail-owed" title="Still on deck">
                {block.onDeck}
              </span>
            ) : null}
          </h5>

          {block.empty ? (
            <p className="muted small">Nothing shows it yet.</p>
          ) : (
            <ul>
              {block.rows.map((row, position) => {
                const label = row.label.length > 0 ? row.label : 'Untitled';
                if (!row.owner) {
                  // A note: listed because it is theirs, and not a button
                  // because there is nowhere in the Creator for it to go.
                  return (
                    <li key={`${block.key}:note:${row.noteId ?? position}`} className="creator-rail-note">
                      <span className="creator-rail-label">{label}</span>
                    </li>
                  );
                }
                return (
                  <li key={row.owner.id}>
                    <button
                      type="button"
                      className="creator-rail-row"
                      // The colour is the whole information here, so it is in
                      // the name as well as in the dot — a dot alone says
                      // nothing to somebody not looking at it.
                      aria-label={`${label} — ${USAGE_WORDS[row.colour ?? 'red']}`}
                      title={
                        row.colour === 'green'
                          ? 'In the writing — open it to see where'
                          : 'On deck — open it and say where it landed'
                      }
                      onClick={() => onOpen(row)}
                    >
                      <span
                        className={`creator-dot ${DOT_CLASS[row.colour ?? 'red']}`}
                        aria-hidden="true"
                      />
                      <span className="creator-rail-label">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </aside>
  );
}

// ------------------------------------------------------------------ overview

function Overview({
  file,
  characterId,
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const person = file.characters.find((one) => one.id === characterId)!;
  const headings = characterCategoriesInOrder(file);
  const [tag, setTag] = useState('');

  const addTag = () => {
    const word = tag.trim();
    if (word.length === 0 || person.tags.includes(word)) {
      setTag('');
      return;
    }
    onUpdate((current) => updateCharacter(current, person.id, { tags: [...person.tags, word] }));
    setTag('');
  };

  return (
    <div className="creator-overview">
      <label className="field">
        <span>Also called</span>
        <input
          aria-label="Aliases"
          placeholder="Separated by commas — MAE, Detective Rourke"
          value={person.aliases.join(', ')}
          onChange={(event) =>
            onUpdate((current) =>
              updateCharacter(current, person.id, {
                aliases: event.target.value
                  .split(',')
                  .map((alias) => alias.trim())
                  .filter((alias) => alias.length > 0),
              }),
            )
          }
        />
      </label>

      <label className="field">
        <span>How much of the story</span>
        <select
          aria-label="Heading"
          value={(person.categoryId as string) ?? ''}
          onChange={(event) =>
            onUpdate((current) =>
              updateCharacter(current, person.id, {
                categoryId: event.target.value === '' ? null : (event.target.value as CharacterCategoryId),
              }),
            )
          }
        >
          <option value="">Not filed</option>
          {headings.map((heading) => (
            <option key={heading.id} value={heading.id}>
              {heading.name}
            </option>
          ))}
        </select>
      </label>

      {/* Tags are what the writer calls somebody, which is a different question
          from the heading above (how much of the story they are in) and from a
          trait below (what they are like). */}
      <div className="field">
        <span>Who they are to the story</span>
        <div className="creator-tags">
          {person.tags.map((word) => (
            <span key={word} className="creator-tag">
              {word}
              <button
                type="button"
                className="ghost small"
                aria-label={`Remove the tag ${word}`}
                onClick={() =>
                  onUpdate((current) =>
                    updateCharacter(current, person.id, {
                      tags: person.tags.filter((one) => one !== word),
                    }),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input
              aria-label="Add a tag"
              placeholder="antagonist, the one who knows"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              onBlur={addTag}
            />
          </form>
        </div>
      </div>

      <label className="field">
        <span>Who they are, in a line</span>
        <input
          aria-label="Description"
          value={person.description}
          onChange={(event) =>
            onUpdate((current) => updateCharacter(current, person.id, { description: event.target.value }))
          }
        />
      </label>

      {/* §4: `arcNotes` stays and is not replaced by the structured arc. It is
          where somebody writes about a character before deciding to build one,
          and taking it away would remove the thing people actually start with. */}
      <label className="field">
        <span>Notes on their journey</span>
        <textarea
          aria-label="Notes on their journey"
          rows={6}
          placeholder="Anything about where they start and where this goes."
          value={person.arcNotes}
          onChange={(event) =>
            onUpdate((current) => updateCharacter(current, person.id, { arcNotes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

// -------------------------------------------------------------------- traits

function Traits({
  file,
  characterId,
  board,
  chosen,
  onChoose,
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  board: ReturnType<typeof characterBoard>;
  chosen: Shelf;
  onChoose(shelf: Shelf): void;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const [adding, setAdding] = useState('');

  const add = () => {
    const name = adding.trim();
    if (name.length === 0) return;
    onUpdate((current) => {
      const next = addTrait(current, { characterId, name });
      if (next.trait) onChoose({ kind: 'trait', id: next.trait.id });
      return next.file;
    });
    setAdding('');
  };

  return (
    <nav className="creator-side" aria-label="Traits">
      <h4>Traits</h4>
      {board.traits.length === 0 ? (
        <p className="muted small">
          A trait is a folder — <em>greedy</em>, <em>never asks for help</em>. What goes in it is how you show
          it.
        </p>
      ) : (
        <ul className="creator-trait-list">
          {board.traits.map((entry) => {
            const selected = chosen.kind === 'trait' && chosen.id === entry.trait.id;
            return (
              <li key={entry.trait.id}>
                <button
                  type="button"
                  className={selected ? 'folder-row selected' : 'folder-row'}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onChoose({ kind: 'trait', id: entry.trait.id })}
                >
                  <span className="folder-name">{entry.trait.name}</span>
                  {/* An empty trait is an unfinished thought, not an error, so
                      it says so quietly rather than wearing a zero. */}
                  <span className="count muted">{entry.unshown ? '—' : entry.items.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="creator-add"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          aria-label="New trait"
          placeholder="Another trait"
          value={adding}
          onChange={(event) => setAdding(event.target.value)}
        />
        <button type="submit" className="ghost small">
          + Trait
        </button>
      </form>

      <h4>Not filed</h4>
      <ul className="creator-trait-list">
        <li>
          <button
            type="button"
            className={chosen.kind === 'unfiled' ? 'folder-row selected' : 'folder-row'}
            aria-current={chosen.kind === 'unfiled' ? 'true' : undefined}
            onClick={() => onChoose({ kind: 'unfiled' })}
          >
            <span className="folder-name">Noticed, not filed</span>
            <span className="count muted">{board.unfiled.length}</span>
          </button>
        </li>
      </ul>

      <div className="creator-legend">
        {(['green', 'red', 'grey'] as const).map((colour) => (
          <span key={colour} className="creator-legend-row">
            <i className={`creator-dot ${DOT_CLASS[colour]}`} aria-hidden="true" />
            {USAGE_WORDS[colour]}
          </span>
        ))}
        <p className="muted small">
          On deck is the ordinary state — most of this waits for the right scene, and nothing here is a
          reproach.
        </p>
      </div>
    </nav>
  );
}

// ------------------------------------------------------- what shows the trait

function Shown({
  file,
  characterId,
  trait,
  unfiled,
  rows,
  currentBeatId,
  reveal,
  onRevealed,
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  trait: CharacterTrait | null;
  unfiled: boolean;
  rows: CharacterizationRow[];
  currentBeatId: BeatId | null;
  /** Opened from the rail: show this one's *where* on arrival. */
  reveal: CharacterizationItemId | null;
  onRevealed(): void;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const [adding, setAdding] = useState('');
  /** Which row has its *where* open. One at a time: this is a detour, not a column. */
  const [open, setOpen] = useState<CharacterizationItemId | null>(null);

  // The rail asked for one. Cleared as soon as it is honoured, so closing the
  // panel by hand does not fight a prop that keeps re-opening it.
  useEffect(() => {
    if (!reveal) return;
    setOpen(reveal);
    onRevealed();
  }, [reveal, onRevealed]);
  const traits = file.characterTraits.filter(
    (one) => (one.characterId as string) === (characterId as string) && !one.archived,
  );

  const add = () => {
    const text = adding.trim();
    if (text.length === 0) return;
    onUpdate((current) =>
      addCharacterization(current, { characterId, traitId: trait?.id ?? null, text }).file,
    );
    setAdding('');
  };

  if (!trait && !unfiled) {
    return (
      <section className="creator-shown">
        <p className="muted empty-state">Add a trait, and this is where you say how it shows.</p>
      </section>
    );
  }

  return (
    <section className="creator-shown" aria-label={trait ? trait.name : 'Noticed, not filed'}>
      {trait ? (
        <header className="creator-trait-head">
          <InlineText
            value={trait.name}
            ariaLabel="Trait"
            className="creator-trait-name"
            onCommit={(name) => onUpdate((current) => updateTrait(current, trait.id, { name }))}
          />
          <label className="creator-inline-field">
            <span className="muted small">When</span>
            <input
              aria-label="When this shows"
              placeholder="Under pressure, at home"
              value={trait.kind}
              onChange={(event) =>
                onUpdate((current) => updateTrait(current, trait.id, { kind: event.target.value }))
              }
            />
          </label>
          <label className="creator-inline-field">
            <span className="muted small">How much of them</span>
            <select
              aria-label="How much of them this is"
              value={trait.prominence}
              onChange={(event) =>
                onUpdate((current) =>
                  updateTrait(current, trait.id, { prominence: Number(event.target.value) }),
                )
              }
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {PROMINENCE_WORDS[level]}
                </option>
              ))}
            </select>
          </label>
          {/* §4: the reading of a trait stays optional, and "Not saying" is the
              default, so the software never has an opinion about a character. */}
          <label className="creator-inline-field">
            <span className="muted small">Read as</span>
            <select
              aria-label="Read as"
              value={trait.tone}
              onChange={(event) =>
                onUpdate((current) => updateTrait(current, trait.id, { tone: event.target.value as TraitTone }))
              }
            >
              {TRAIT_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {TRAIT_TONE_WORDS[tone]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost small"
            aria-label={`Remove the trait ${trait.name}`}
            title="Removes the trait. What you wrote under it is unfiled, not deleted."
            onClick={() => onUpdate((current) => removeTrait(current, trait.id))}
          >
            ×
          </button>
        </header>
      ) : (
        <header className="creator-trait-head">
          <span className="creator-trait-name">Noticed, not filed</span>
          <span className="muted small">
            Caught while writing, before anybody decided what it was an example of.
          </span>
        </header>
      )}

      {trait ? (
        <input
          className="creator-why"
          aria-label="Why it matters"
          placeholder="Why it matters — the thing that makes it worth dramatising"
          value={trait.notes}
          onChange={(event) => onUpdate((current) => updateTrait(current, trait.id, { notes: event.target.value }))}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="muted empty-state">
          {trait ? 'Nothing shows this yet.' : 'Nothing unfiled.'}
        </p>
      ) : (
        <ul className="creator-items">
          {rows.map((row) => (
            <li key={row.item.id} className={`creator-item ${DOT_CLASS[row.colour]}`}>
              <div className="creator-item-row">
              <i className={`creator-dot ${DOT_CLASS[row.colour]}`} title={USAGE_WORDS[row.colour]} />
              <InlineText
                value={row.item.text}
                ariaLabel="How it shows"
                className="creator-item-text"
                onCommit={(text) =>
                  onUpdate((current) => updateCharacterization(current, row.item.id, { text }))
                }
              />
              {/* The state is the way in to where it landed: the question a
                  colour raises is *where*, so the colour answers it. */}
              <button
                type="button"
                className={open === row.item.id ? 'creator-item-state open' : 'creator-item-state'}
                aria-expanded={open === row.item.id}
                title="Where it turns up in the script"
                onClick={() => setOpen(open === row.item.id ? null : row.item.id)}
              >
                {USAGE_WORDS[row.colour]}
              </button>
              <select
                aria-label={`File ${row.item.text}`}
                value={(row.item.traitId as string) ?? ''}
                onChange={(event) =>
                  onUpdate((current) =>
                    fileCharacterization(
                      current,
                      row.item.id,
                      event.target.value === '' ? null : (event.target.value as CharacterTraitId),
                    ),
                  )
                }
              >
                <option value="">Not filed</option>
                {traits.map((one) => (
                  <option key={one.id} value={one.id}>
                    {one.name}
                  </option>
                ))}
              </select>
              {/* Setting aside is a decision and keeps the idea; × is for
                  something typed by mistake (§17). */}
              <button
                type="button"
                className="ghost small"
                aria-label={row.item.retired ? 'Put it back on deck' : 'Set it aside'}
                title={
                  row.item.retired
                    ? 'Back on deck — still to place.'
                    : 'Set aside: kept, but no longer counted as work outstanding.'
                }
                onClick={() =>
                  onUpdate((current) =>
                    updateCharacterization(current, row.item.id, { retired: !row.item.retired }),
                  )
                }
              >
                {row.item.retired ? '↩' : '⌄'}
              </button>
              <button
                type="button"
                className="ghost small"
                aria-label={`Delete ${row.item.text}`}
                title="Delete it outright."
                onClick={() => onUpdate((current) => removeCharacterization(current, row.item.id))}
              >
                ×
              </button>
              </div>

              {open === row.item.id ? (
                <Where
                  file={file}
                  owner={{ kind: 'characterization', id: row.item.id as string }}
                  currentBeatId={currentBeatId}
                  onUpdate={onUpdate}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="creator-add wide"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          aria-label="How it shows"
          placeholder="Another way it shows — an action, a habit, a choice, a prop"
          value={adding}
          onChange={(event) => setAdding(event.target.value)}
        />
        <button type="submit" className="ghost small">
          + How it shows
        </button>
      </form>
    </section>
  );
}

// ------------------------------------------------------- where it turned up

/**
 * Where one piece of character work appears, and how to say where it landed
 * (addendum 08 §6, stage 3 — plan → story).
 *
 * It takes an *owner* rather than an item, so an arc point is placed by exactly
 * the same panel as a characterization: they are the same act, and two versions
 * of it would eventually disagree about what pinning means.
 *
 * **Pinning is the act that turns something green**, and the colour is only
 * honest because this is the only way to do it: there is no "mark as used"
 * anywhere in the module, because a flag somebody sets is a flag somebody sets
 * wrongly. You say *where*, and the colour follows from the manuscript.
 *
 * A pin to writing that has since gone keeps its row rather than vanishing. The
 * item has already gone red by itself; a writer looking at that wants to know
 * why, and "that writing is no longer there" is the answer plus the tidy-up.
 */
function Where({
  file,
  owner,
  currentBeatId,
  onUpdate,
}: {
  file: ProjectFile;
  /** What is being placed: a piece of characterization, or an arc point. */
  owner: { kind: 'characterization' | 'arc_point'; id: string };
  currentBeatId: BeatId | null;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const places = useMemo(() => placesToPin(file), [file]);
  const seen = useMemo(() => whereItAppears({ owner, file }), [file, owner]);

  const [beatId, setBeatId] = useState<BeatId | ''>('');
  const [lineId, setLineId] = useState<string>('');
  const lines = beatId === '' ? [] : quotableLines(file, beatId);

  const pin = (toBeat: BeatId, toLine: ManuscriptElementId | null) => {
    onUpdate((current) =>
      pinUsage(current, {
        ownerKind: owner.kind,
        ownerId: owner.id,
        beatId: toBeat,
        elementId: toLine,
      }).file,
    );
    // The picker goes back to empty: leaving a place selected that is now
    // already pinned invites pressing Pin it again and wondering why nothing
    // happened.
    setBeatId('');
    setLineId('');
  };

  // The beat being written, when there is one. The fast path: most of the time
  // a writer is pinning what they have just put on the page.
  const writingNow = currentBeatId
    ? (file.beats.find((beat) => beat.id === currentBeatId) ?? null)
    : null;

  return (
    <div className="creator-where">
      {seen.length === 0 ? (
        <p className="muted small">Not in the writing yet. Say where it lands and it turns green.</p>
      ) : (
        <ul className="creator-where-list">
          {seen.map((one) => (
            <li key={one.link.id} className={one.standing === 'gone' ? 'is-gone' : ''}>
              <span className="creator-where-place">
                {one.unitTitle}
                {one.beatTitle ? ` · ${one.beatTitle}` : ''}
              </span>
              <span className="muted small">{USAGE_STANDING_WORDS[one.standing]}</span>
              {one.quote ? <span className="creator-where-quote muted">“{one.quote}”</span> : null}
              <button
                type="button"
                className="ghost small"
                aria-label="Unpin it from here"
                title="Takes the pin. The writing itself is not touched."
                onClick={() => onUpdate((current) => unpinUsage(current, one.link.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="creator-pin">
        {writingNow ? (
          <button
            type="button"
            className="ghost small"
            onClick={() => pin(writingNow.id, null)}
          >
            + Pin to the beat I am writing
          </button>
        ) : null}

        <select
          aria-label="Scene and beat"
          value={beatId as string}
          onChange={(event) => {
            setBeatId(event.target.value as BeatId | '');
            setLineId('');
          }}
        >
          <option value="">Where does it land…</option>
          {places.map((place) => (
            <optgroup
              key={place.unit.id}
              label={`${place.unit.sequenceLabel} ${place.unit.title || 'Untitled scene'}`.trim()}
            >
              {place.beats.map((beat) => (
                <option key={beat.id} value={beat.id}>
                  {beat.title || 'Untitled beat'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Pointing at a line is optional and always has been: the whole beat is
            a perfectly good answer, and the line is for when somebody wants the
            row to read without opening the scene (§3.2). */}
        {lines.length > 0 ? (
          <select aria-label="A line, or the whole beat" value={lineId} onChange={(event) => setLineId(event.target.value)}>
            <option value="">The whole beat</option>
            {lines.map((one) => (
              <option key={one.id} value={one.id}>
                {one.text.length > 70 ? `${one.text.slice(0, 70)}…` : one.text}
              </option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          className="ghost small"
          disabled={beatId === ''}
          onClick={() => {
            if (beatId === '') return;
            pin(beatId, lineId === '' ? null : (lineId as ManuscriptElementId));
          }}
        >
          Pin it
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- arc

/**
 * The Arc Builder (addendum 08 §8, §9 — stage 5).
 *
 * **A spine, read top to bottom**: who they are, what they need, what happens,
 * who they become. §8 asks the view to show progression from beginning to end,
 * and the way to do that is to put it in that order and get out of the way.
 *
 * **It does not assume anybody improves.** A chance to change, a refusal and a
 * doubling-down are kinds of point in the same list as a discovery, so a
 * Scrooge and an antagonist are built with one tool — and the shape at the top
 * is *read back* from the points rather than declared in advance, because asking
 * a writer to label an arc positive before writing it is asking them to decide
 * the ending first.
 *
 * **What is written sits where the story puts it.** The points split into what
 * is in the manuscript, in the manuscript's order, and what is still on deck, in
 * the writer's — and the arrows are only on the second group, because an arrow
 * on a placed point would be a control that lies.
 */
function Arc({
  file,
  characterId,
  currentBeatId,
  reveal,
  onRevealed,
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  currentBeatId: BeatId | null;
  /** Opened from the rail: show this point's *where* on arrival. */
  reveal: ArcPointId | null;
  onRevealed(): void;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const board = useMemo(() => arcBoard({ characterId: characterId as string, file }), [characterId, file]);
  const [adding, setAdding] = useState('');
  const [addingKind, setAddingKind] = useState<ArcPointKind>('movement');
  const [open, setOpen] = useState<ArcPointId | null>(null);

  useEffect(() => {
    if (!reveal) return;
    setOpen(reveal);
    onRevealed();
  }, [reveal, onRevealed]);
  /** Which point has its cross-arc links open (§13). */
  const [affects, setAffects] = useState<ArcPointId | null>(null);

  // How many other arcs each point moves, counted once for the whole tab
  // rather than per row as it is drawn.
  const moves = useMemo(() => {
    const counted = new Map<string, number>();
    for (const link of file.links) {
      if (!isArcVerb(link.type)) continue;
      for (const end of [link.from, link.to]) {
        if (end.type !== 'arc_point') continue;
        counted.set(end.id, (counted.get(end.id) ?? 0) + 1);
      }
    }
    return counted;
  }, [file.links]);
  const movesCount = (id: ArcPointId): number => moves.get(id as string) ?? 0;

  if (!board.arc) {
    return (
      <div className="creator-arc empty">
        {/* §9: never require an arc. Most characters in most scripts do not
            have one, and saying so is kinder than an empty form. */}
        <p className="muted">
          No arc for them yet. Most characters do not need one — an arc is for somebody the story
          changes, or offers a change and watches refuse it.
        </p>
        <button
          type="button"
          className="ghost small"
          onClick={() => onUpdate((current) => beginArc(current, characterId).file)}
        >
          Start an arc
        </button>
      </div>
    );
  }

  const arc = board.arc;

  const add = () => {
    const text = adding.trim();
    if (text.length === 0) return;
    onUpdate((current) => addArcPoint(current, { arcId: arc.id, kind: addingKind, text }).file);
    setAdding('');
  };

  const pointRow = (row: (typeof board.placed)[number], movable: boolean) => (
    <li key={row.point.id} className={`arc-point ${DOT_CLASS[row.colour]}${isDecisive(row.point.kind) ? ' decisive' : ''}`}>
      <div className="arc-point-row">
        <i className={`creator-dot ${DOT_CLASS[row.colour]}`} title={USAGE_WORDS[row.colour]} />
        <select
          aria-label="What kind of moment"
          className="arc-kind"
          value={row.point.kind}
          onChange={(event) =>
            onUpdate((current) =>
              updateArcPoint(current, row.point.id, { kind: event.target.value as ArcPointKind }),
            )
          }
        >
          {ARC_POINT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ARC_POINT_NAMES[kind]}
            </option>
          ))}
        </select>
        <InlineText
          value={row.point.text}
          ariaLabel="What happens"
          className="arc-point-text"
          onCommit={(text) => onUpdate((current) => updateArcPoint(current, row.point.id, { text }))}
        />
        {row.unitTitle ? <span className="arc-where muted small">{row.unitTitle}</span> : null}
        <button
          type="button"
          className={open === row.point.id ? 'creator-item-state open' : 'creator-item-state'}
          aria-expanded={open === row.point.id}
          title="Where it turns up in the script"
          onClick={() => setOpen(open === row.point.id ? null : row.point.id)}
        >
          {USAGE_WORDS[row.colour]}
        </button>
        {/* §13: what this moment does to somebody else's journey. */}
        <button
          type="button"
          className={affects === row.point.id ? 'creator-item-state open' : 'creator-item-state'}
          aria-expanded={affects === row.point.id}
          aria-label={`Arcs moved by: ${row.point.text}`}
          title="Whose arcs this moment moves, and whose move it"
          onClick={() => setAffects(affects === row.point.id ? null : row.point.id)}
        >
          Moves{movesCount(row.point.id) > 0 ? ` ${movesCount(row.point.id)}` : ''}
        </button>
        {movable ? (
          <>
            <button
              type="button"
              className="ghost small"
              aria-label="Move it earlier"
              onClick={() => onUpdate((current) => moveArcPoint(current, row.point.id, 'up'))}
            >
              ↑
            </button>
            <button
              type="button"
              className="ghost small"
              aria-label="Move it later"
              onClick={() => onUpdate((current) => moveArcPoint(current, row.point.id, 'down'))}
            >
              ↓
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="ghost small"
          aria-label={row.point.retired ? 'Put it back on deck' : 'Set it aside'}
          title={
            row.point.retired
              ? 'Back on deck — still to place.'
              : 'Set aside: kept, but no longer counted as work outstanding.'
          }
          onClick={() =>
            onUpdate((current) => updateArcPoint(current, row.point.id, { retired: !row.point.retired }))
          }
        >
          {row.point.retired ? '↩' : '⌄'}
        </button>
        <button
          type="button"
          className="ghost small"
          aria-label="Delete this point"
          onClick={() => onUpdate((current) => removeArcPoint(current, row.point.id))}
        >
          ×
        </button>
      </div>

      {open === row.point.id ? (
        <Where
          file={file}
          owner={{ kind: 'arc_point', id: row.point.id as string }}
          currentBeatId={currentBeatId}
          onUpdate={onUpdate}
        />
      ) : null}

      {affects === row.point.id ? (
        <Affects file={file} point={row.point} characterId={characterId} onUpdate={onUpdate} />
      ) : null}
    </li>
  );

  return (
    <div className="creator-arc">
      <header className="arc-head">
        <span className="arc-shape">{ARC_SHAPE_WORDS[board.shape]}</span>
        {/* §9: whether they were ever really given the chance is the question
            that separates a tragedy from somebody who was simply never asked.
            Said only when the shape has not already said it. */}
        {board.shape === 'refused' ? null : (
          <span className="muted small">
            {board.offered ? 'Offered the change.' : 'Never offered the change.'}
          </span>
        )}
        <button
          type="button"
          className="ghost small arc-drop"
          aria-label="Remove the arc"
          title="Removes the arc and its points. The writing is not touched."
          onClick={() => onUpdate((current) => removeArc(current, arc.id))}
        >
          ×
        </button>
      </header>

      <label className="field">
        <span>Who they are at the start</span>
        <textarea
          aria-label="Beginning"
          rows={2}
          placeholder="Keeps score. Money is the only measure she trusts."
          value={arc.beginning}
          onChange={(event) => onUpdate((current) => updateArc(current, arc.id, { beginning: event.target.value }))}
        />
      </label>

      <label className="field">
        <span>What they need to learn, confront, accept, reject or become</span>
        <textarea
          aria-label="Need"
          rows={2}
          placeholder="To stop counting."
          value={arc.need}
          onChange={(event) => onUpdate((current) => updateArc(current, arc.id, { need: event.target.value }))}
        />
      </label>

      <section className="arc-spine">
        <h4>In the writing</h4>
        {board.placed.length === 0 ? (
          <p className="muted small">Nothing of the arc is on the page yet.</p>
        ) : (
          <ul className="arc-points">{board.placed.map((row) => pointRow(row, false))}</ul>
        )}

        <h4>Still to place</h4>
        {board.onDeck.length === 0 ? (
          <p className="muted small">Nothing waiting.</p>
        ) : (
          <ul className="arc-points">{board.onDeck.map((row) => pointRow(row, true))}</ul>
        )}

        <form
          className="creator-add wide"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <select
            aria-label="Kind of the new point"
            className="arc-kind"
            value={addingKind}
            onChange={(event) => setAddingKind(event.target.value as ArcPointKind)}
          >
            {ARC_POINT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ARC_POINT_NAMES[kind]}
              </option>
            ))}
          </select>
          <input
            aria-label="What happens"
            placeholder="She is offered the money back"
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
          />
          <button type="submit" className="ghost small">
            + Point
          </button>
        </form>
      </section>

      <label className="field">
        <span>Who they have become — or refused to become</span>
        <textarea
          aria-label="Ending"
          rows={2}
          placeholder="Counts faster."
          value={arc.ending}
          onChange={(event) => onUpdate((current) => updateArc(current, arc.id, { ending: event.target.value }))}
        />
      </label>
    </div>
  );
}

// ----------------------------------------------------------- relationships

/**
 * How somebody stands towards other people (addendum 08 §11, stage 7).
 *
 * **Two lists, because the two directions are allowed to disagree.** *She trusts
 * him* and *he is working her* are both true and they are different records —
 * a screen that merged them into one row per pair would have to choose which
 * sentence to keep, and the drama is the difference between them. So: what they
 * think of other people, and what other people think of them, one above the
 * other.
 *
 * When a reading has not been answered the row offers to open the other one —
 * **empty, never copied**, since putting the first person's words in the second
 * person's mouth is exactly the mistake the two records exist to avoid. It is an
 * offer and never a warning: plenty of relationships are only worth writing down
 * from one side.
 */
function Relationships({
  file,
  characterId,
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const rows = useMemo(
    () => relationshipsOf({ characterId: characterId as string, file }),
    [characterId, file],
  );
  const others = workingCast(file).filter((person) => (person.id as string) !== (characterId as string));

  const [toId, setToId] = useState<CharacterId | ''>('');
  const [kind, setKind] = useState<RelationshipKind>('friend');
  const [open, setOpen] = useState<CharacterRelationshipId | null>(null);

  const add = () => {
    if (toId === '') return;
    onUpdate((current) => relate(current, { fromCharacterId: characterId, toCharacterId: toId, kind }).file);
    setToId('');
  };

  if (others.length === 0) {
    return (
      <div className="creator-relationships">
        <p className="muted empty-state">
          Nobody else in the cast yet. A relationship links two character records, never a name typed
          twice.
        </p>
      </div>
    );
  }

  const row = (entry: RelationshipRow, outward: boolean) => {
    const rel = entry.relationship;
    return (
      <li key={rel.id} className="rel">
        <div className="rel-row">
          <span className="rel-arrow muted" aria-hidden="true">
            {outward ? '→' : '←'}
          </span>
          <span className="rel-who">{entry.otherName}</span>
          <select
            aria-label="What kind"
            className="rel-kind"
            value={rel.kind}
            onChange={(event) =>
              onUpdate((current) =>
                updateRelationship(current, rel.id, { kind: event.target.value as RelationshipKind }),
              )
            }
          >
            {RELATIONSHIP_KINDS.map((one) => (
              <option key={one} value={one}>
                {RELATIONSHIP_KIND_NAMES[one]}
              </option>
            ))}
          </select>
          <input
            className="rel-label"
            aria-label="What you call it"
            placeholder={RELATIONSHIP_KIND_NAMES[rel.kind]}
            value={rel.label}
            onChange={(event) =>
              onUpdate((current) => updateRelationship(current, rel.id, { label: event.target.value }))
            }
          />
          <button
            type="button"
            className={open === rel.id ? 'creator-item-state open' : 'creator-item-state'}
            aria-expanded={open === rel.id}
            title="The history, where it stands, and how it changes"
            onClick={() => setOpen(open === rel.id ? null : rel.id)}
          >
            {rel.state.trim().length > 0 ? 'Has a state' : 'Say more'}
          </button>
          {outward && !entry.answered ? (
            <button
              type="button"
              className="ghost small"
              title="Opens an empty reading the other way round. It is not a copy of this one."
              onClick={() => onUpdate((current) => answerRelationship(current, rel.id).file)}
            >
              + The other way
            </button>
          ) : null}
          <button
            type="button"
            className="ghost small"
            aria-label={`Remove how ${outward ? 'they see' : 'they are seen by'} ${entry.otherName}`}
            title="Removes this reading only. The other direction is untouched."
            onClick={() => onUpdate((current) => removeRelationship(current, rel.id))}
          >
            ×
          </button>
        </div>

        {open === rel.id ? (
          <div className="rel-more">
            <label className="field">
              <span>History</span>
              <textarea
                aria-label="History"
                rows={2}
                placeholder="They came up together on the night shift."
                value={rel.description}
                onChange={(event) =>
                  onUpdate((current) => updateRelationship(current, rel.id, { description: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Where it stands now</span>
              <textarea
                aria-label="Where it stands now"
                rows={2}
                placeholder="Cold since the audit."
                value={rel.state}
                onChange={(event) =>
                  onUpdate((current) => updateRelationship(current, rel.id, { state: event.target.value }))
                }
              />
            </label>
            {/* §11 calls the evolution optional, and it stays optional: most
                relationships in most scripts do not move. */}
            <label className="field">
              <span>How it changes across the story — if it does</span>
              <textarea
                aria-label="How it changes"
                rows={2}
                value={rel.evolution}
                onChange={(event) =>
                  onUpdate((current) => updateRelationship(current, rel.id, { evolution: event.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="creator-relationships">
      <section>
        <h4>How they see other people</h4>
        {rows.outward.length === 0 ? (
          <p className="muted small">Nothing written down yet.</p>
        ) : (
          <ul className="rel-list">{rows.outward.map((entry) => row(entry, true))}</ul>
        )}

        <form
          className="creator-add wide"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <select
            aria-label="Who"
            value={toId as string}
            onChange={(event) => setToId(event.target.value as CharacterId)}
          >
            <option value="">Towards whom…</option>
            {others.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Kind"
            className="rel-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as RelationshipKind)}
          >
            {RELATIONSHIP_KINDS.map((one) => (
              <option key={one} value={one}>
                {RELATIONSHIP_KIND_NAMES[one]}
              </option>
            ))}
          </select>
          <button type="submit" className="ghost small" disabled={toId === ''}>
            + Relationship
          </button>
        </form>
      </section>

      {/* The other half of §11: what everybody else makes of them, which is
          not the same thing and is not derived from it. */}
      <section>
        <h4>How other people see them</h4>
        {rows.inward.length === 0 ? (
          <p className="muted small">Nobody has a reading of them yet.</p>
        ) : (
          <ul className="rel-list">{rows.inward.map((entry) => row(entry, false))}</ul>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------- arcs that move arcs

/**
 * What one arc point does to somebody else's (addendum 08 §13, stage 9).
 *
 * **Nothing new is stored for this.** A cross-character arc link is exactly a
 * story link — two references, a verb and a note — which §3.1 decided before any
 * of it was built, so this panel writes through `linkEntities` like the Related
 * Elements box and the link turns up there too without that box being told arcs
 * exist.
 *
 * Read in both directions, because being moved by somebody is as much a fact
 * about a journey as moving them: a writer looking at a refusal wants to see
 * what it set off *and* what set it off.
 */
function Affects({
  file,
  point,
  characterId,
  onUpdate,
}: {
  file: ProjectFile;
  point: ArcPoint;
  characterId: CharacterId;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const effects = useMemo(() => arcEffectsOf(file, point.id), [file, point.id]);
  const offers = useMemo(() => otherArcPoints(file, characterId), [file, characterId]);
  const [toId, setToId] = useState('');
  const [verb, setVerb] = useState<ArcLinkVerb>('causes');

  const join = () => {
    if (toId === '') return;
    onUpdate((current) =>
      linkEntities(current, {
        from: ref('arc_point', point.id as string),
        to: ref('arc_point', toId),
        type: verb,
      }),
    );
    setToId('');
  };

  return (
    <div className="arc-affects">
      {effects.length === 0 ? (
        <p className="muted small">This moment moves nobody else’s arc yet.</p>
      ) : (
        <ul className="arc-effects">
          {effects.map((effect) => (
            <li key={effect.linkId}>
              <span className="arc-effect-verb muted">
                {effect.outward ? '' : '← '}
                {ARC_LINK_VERB_NAMES[effect.verb]}
              </span>
              <span className="work-who">{effect.otherCharacterName}</span>
              <span className="arc-effect-what">{effect.otherPoint.text}</span>
              <button
                type="button"
                className="ghost small"
                aria-label="Unlink it"
                title="Removes the link. Both arcs are untouched."
                onClick={() => onUpdate((current) => unlink(current, effect.linkId as StoryLinkId))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {offers.length === 0 ? (
        <p className="muted small">Nobody else has an arc to join this to yet.</p>
      ) : (
        <div className="creator-pin">
          <select
            aria-label="What it does"
            className="arc-kind"
            value={verb}
            onChange={(event) => setVerb(event.target.value as ArcLinkVerb)}
          >
            {ARC_LINK_VERBS.map((one) => (
              <option key={one} value={one}>
                {ARC_LINK_VERB_NAMES[one]}
              </option>
            ))}
          </select>
          {/* Grouped by person, and this character's own points are not on the
              list: an arc cannot move itself, and offering that would fill §13's
              reading with people affecting only themselves. */}
          <select aria-label="Whose moment" value={toId} onChange={(event) => setToId(event.target.value)}>
            <option value="">Whose moment…</option>
            {offers.map((group) => (
              <optgroup key={group.characterId} label={group.characterName}>
                {group.points.map((one) => (
                  <option key={one.id} value={one.id as string}>
                    {ARC_POINT_NAMES[one.kind]}: {one.text}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="ghost small" disabled={toId === ''} onClick={join}>
            Join
          </button>
        </div>
      )}
    </div>
  );
}
