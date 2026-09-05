import { useState } from 'react';
import {
  linkEntities,
  relatedEntities,
  storyLinkTypeSchema,
  unlink,
  type ProjectFile,
  type StoryEntityRef,
  type StoryLinkType,
} from '@vcwriter/domain';

interface RelatedPanelProps {
  file: ProjectFile;
  target: StoryEntityRef;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

const LINK_TYPES = storyLinkTypeSchema.options;

/**
 * The related-elements panel (spec §7.4).
 *
 * It is collapsible because §7.4 asks for that explicitly — relationships are
 * useful when you are planning and a distraction when you are writing. Rows
 * resolve their labels from the linked entity at render time, so a rename
 * anywhere shows up here without the link being touched.
 */
export function RelatedPanel({ file, target, onUpdate }: RelatedPanelProps) {
  const [open, setOpen] = useState(true);
  const [linkType, setLinkType] = useState<StoryLinkType>('relates_to');
  const [choice, setChoice] = useState('');

  const related = relatedEntities(file, target);

  const options = [
    {
      label: 'Research',
      entries: file.researchItems
        .filter((item) => !item.archived)
        .map((item) => ({ value: `research_item:${item.id}`, label: item.title })),
    },
    {
      label: 'Characters',
      entries: file.characters.map((character) => ({
        value: `character:${character.id}`,
        label: character.name,
      })),
    },
    {
      label: 'Setups & payoffs',
      entries: file.setupsPayoffs
        .filter((record) => !record.archived)
        .map((record) => ({ value: `setup_payoff:${record.id}`, label: record.title })),
    },
    {
      label: 'Scenes & chapters',
      entries: file.units.map((unit) => ({
        value: `unit:${unit.id}`,
        label: `${unit.sequenceLabel || unit.kind} ${unit.title || 'Untitled'}`.trim(),
      })),
    },
  ].filter((group) => group.entries.length > 0);

  const addLink = () => {
    if (choice.length === 0) return;
    const [type, id] = choice.split(':');
    if (!type || !id) return;
    onUpdate((current) =>
      linkEntities(current, {
        from: target,
        to: { type: type as StoryEntityRef['type'], id },
        type: linkType,
      }),
    );
    setChoice('');
  };

  return (
    <section className={open ? 'related open' : 'related'}>
      <header>
        <button
          type="button"
          className="ghost twisty"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? '▾' : '▸'}
        </button>
        <h3>Related elements</h3>
        <span className="count muted">{related.length}</span>
      </header>

      {open ? (
        <>
          {related.length > 0 ? (
            <ul>
              {related.map(({ link, other, outgoing }) => (
                <li key={link.id} className={other.exists ? '' : 'missing'}>
                  <span className="link-verb muted">
                    {outgoing ? '' : '← '}
                    {link.type.replace(/_/g, ' ')}
                  </span>
                  <span className="link-label">{other.label}</span>
                  <span className="link-detail muted">{other.detail}</span>
                  <button
                    type="button"
                    className="ghost danger"
                    title="Remove link"
                    onClick={() => onUpdate((current) => unlink(current, link.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted empty">Nothing linked yet.</p>
          )}

          {options.length > 0 ? (
            <div className="link-form">
              <select
                aria-label="Relationship"
                value={linkType}
                onChange={(event) => setLinkType(event.target.value as StoryLinkType)}
              >
                {LINK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <select aria-label="Element" value={choice} onChange={(event) => setChoice(event.target.value)}>
                <option value="">Choose an element…</option>
                {options.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.entries.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" disabled={choice.length === 0} onClick={addLink}>
                Link
              </button>
            </div>
          ) : (
            <p className="muted empty">Add research, characters or payoffs to link them here.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
