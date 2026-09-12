import { useMemo, useState } from 'react';
import {
  PROMINENCE_WORDS,
  TRAIT_TONES,
  TRAIT_TONE_WORDS,
  USAGE_STANDING_WORDS,
  USAGE_WORDS,
  addCharacterization,
  addTrait,
  characterBoard,
  characterCategoriesInOrder,
  characterStanding,
  fileCharacterization,
  pinUsage,
  placesToPin,
  quotableLines,
  removeCharacterization,
  removeTrait,
  unpinUsage,
  updateCharacter,
  updateCharacterization,
  updateTrait,
  whereItAppears,
  type BeatId,
  type CharacterCategoryId,
  type CharacterId,
  type CharacterTrait,
  type CharacterTraitId,
  type CharacterizationItemId,
  type CharacterizationRow,
  type ManuscriptElementId,
  type ProjectFile,
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
  /** Back to the cast list this was opened from. */
  onBack(): void;
}

type Tab = 'overview' | 'traits';

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
  onUpdate,
  onBack,
}: CharacterCreatorProps) {
  const person = file.characters.find((one) => one.id === characterId) ?? null;
  const [tab, setTab] = useState<Tab>('overview');
  const [shelf, setShelf] = useState<Shelf | null>(null);

  const board = useMemo(
    () => characterBoard({ characterId: characterId as string, file }),
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
          ‹ Cast
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

      {tab === 'overview' ? (
        <Overview file={file} characterId={characterId} onUpdate={onUpdate} />
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
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
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
  onUpdate,
}: {
  file: ProjectFile;
  characterId: CharacterId;
  trait: CharacterTrait | null;
  unfiled: boolean;
  rows: CharacterizationRow[];
  currentBeatId: BeatId | null;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const [adding, setAdding] = useState('');
  /** Which row has its *where* open. One at a time: this is a detour, not a column. */
  const [open, setOpen] = useState<CharacterizationItemId | null>(null);
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
                  itemId={row.item.id}
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
 * Where one piece of characterization appears, and how to say where it landed
 * (addendum 08 §6, stage 3 — plan → story).
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
  itemId,
  currentBeatId,
  onUpdate,
}: {
  file: ProjectFile;
  itemId: CharacterizationItemId;
  currentBeatId: BeatId | null;
  onUpdate: CharacterCreatorProps['onUpdate'];
}) {
  const places = useMemo(() => placesToPin(file), [file]);
  const seen = useMemo(
    () => whereItAppears({ owner: { kind: 'characterization', id: itemId as string }, file }),
    [file, itemId],
  );

  const [beatId, setBeatId] = useState<BeatId | ''>('');
  const [lineId, setLineId] = useState<string>('');
  const lines = beatId === '' ? [] : quotableLines(file, beatId);

  const pin = (toBeat: BeatId, toLine: ManuscriptElementId | null) => {
    onUpdate((current) =>
      pinUsage(current, {
        ownerKind: 'characterization',
        ownerId: itemId as string,
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
