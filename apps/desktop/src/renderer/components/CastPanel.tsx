import { useState } from 'react';
import {
  addCharacter,
  addCharacterCategory,
  castByCategory,
  characterCategoriesInOrder,
  removeCharacter,
  removeCharacterCategory,
  renameCharacterCategory,
  updateCharacter,
  type Character,
  type CharacterCategoryId,
  type CharacterId,
  type ProjectFile,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';

/**
 * The cast, filed under its headings (addendum 02 §16).
 *
 * Main characters, minor ones, and — in a series — the recurring cast between
 * them. The headings are the writer's: rename them, reorder them, add "The
 * precinct" if that is how this story thinks.
 *
 * What it is *for* is not tidiness. The order here is the order names are
 * offered while a character cue is being typed, and in a series it is what
 * decides who carries over into the next episode. So filing someone under
 * "Main" is a working decision, not a label.
 *
 * Removing a heading unfiles the people under it; it never deletes them.
 */

interface CastPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Open somebody in the Character Creator (addendum 08 §5). */
  onOpenCreator?(characterId: CharacterId): void;
}

export function CastPanel({ file, onUpdate, onOpenCreator }: CastPanelProps) {
  const [adding, setAdding] = useState('');
  const [addingTo, setAddingTo] = useState<CharacterCategoryId | null>(null);
  const groups = castByCategory(file);
  const headings = characterCategoriesInOrder(file);

  const add = (categoryId: CharacterCategoryId | null) => {
    const name = adding.trim();
    if (name.length === 0) return;
    onUpdate((current) => addCharacter(current, { name, categoryId }));
    setAdding('');
    setAddingTo(null);
  };

  return (
    <div className="cast-panel">
      {groups.map((group) => (
        <section key={group.category?.id ?? 'unfiled'} className="cast-group">
          <header className="cast-group-head">
            {group.category ? (
              <InlineText
                value={group.category.name}
                ariaLabel="Heading"
                className="cast-group-name"
                onCommit={(name) =>
                  onUpdate((current) => renameCharacterCategory(current, group.category!.id, name))
                }
              />
            ) : (
              // Not a heading the writer made, so not one they can rename.
              <span className="cast-group-name muted">{group.name}</span>
            )}
            <span className="count muted">{group.characters.length}</span>
            {group.category ? (
              <>
                <button
                  type="button"
                  className="ghost small"
                  aria-label={`Add someone to ${group.name}`}
                  onClick={() => setAddingTo(group.category!.id)}
                >
                  + Character
                </button>
                <button
                  type="button"
                  className="ghost small"
                  aria-label={`Remove the heading ${group.name}`}
                  title="Removes the heading. The people under it are unfiled, not deleted."
                  onClick={() => onUpdate((current) => removeCharacterCategory(current, group.category!.id))}
                >
                  ×
                </button>
              </>
            ) : null}
          </header>

          {addingTo === (group.category?.id ?? null) && group.category ? (
            <form
              className="cast-add"
              onSubmit={(event) => {
                event.preventDefault();
                add(group.category!.id);
              }}
            >
              <input
                autoFocus
                aria-label="Name"
                placeholder="MAEVE"
                value={adding}
                onChange={(event) => setAdding(event.target.value)}
                onBlur={() => add(group.category!.id)}
              />
            </form>
          ) : null}

          {group.characters.length === 0 ? (
            <p className="muted small">Nobody under this heading yet.</p>
          ) : (
            <ul className="cast-list">
              {group.characters.map((person) => (
                <CastRow
                  key={person.id}
                  person={person}
                  headings={headings}
                  onUpdate={onUpdate}
                  {...(onOpenCreator ? { onOpenCreator } : {})}
                />
              ))}
            </ul>
          )}
        </section>
      ))}

      <form
        className="cast-add-heading"
        onSubmit={(event) => {
          event.preventDefault();
          const name = new FormData(event.currentTarget).get('heading');
          if (typeof name === 'string' && name.trim().length > 0) {
            onUpdate((current) => addCharacterCategory(current, { name: name.trim() }).file);
            event.currentTarget.reset();
          }
        }}
      >
        <input name="heading" aria-label="New heading" placeholder="Another heading — The precinct" />
        <button type="submit" className="ghost small">
          + Heading
        </button>
      </form>
    </div>
  );
}

function CastRow({
  person,
  headings,
  onUpdate,
  onOpenCreator,
}: {
  person: Character;
  headings: ReturnType<typeof characterCategoriesInOrder>;
  onUpdate: CastPanelProps['onUpdate'];
  onOpenCreator?(characterId: CharacterId): void;
}) {
  return (
    <li className="cast-row">
      <InlineText
        value={person.name}
        ariaLabel="Character name"
        className="cast-name"
        onCommit={(name) => onUpdate((current) => updateCharacter(current, person.id, { name }))}
      />
      <select
        aria-label={`Heading for ${person.name}`}
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
      <input
        aria-label={`What ${person.name} is`}
        className="cast-note"
        placeholder="Who they are, in a line"
        value={person.description}
        onChange={(event) =>
          onUpdate((current) => updateCharacter(current, person.id, { description: event.target.value }))
        }
      />
      {onOpenCreator ? (
        <button
          type="button"
          className="ghost small"
          aria-label={`Build ${person.name}`}
          title="Traits, how they show, and what is still on deck"
          onClick={() => onOpenCreator(person.id)}
        >
          Build
        </button>
      ) : null}
      <button
        type="button"
        className="ghost small"
        aria-label={`Remove ${person.name}`}
        onClick={() => onUpdate((current) => removeCharacter(current, person.id))}
      >
        ×
      </button>
    </li>
  );
}
