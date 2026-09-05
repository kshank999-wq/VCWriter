import { useState } from 'react';
import {
  addResearchCategory,
  addResearchItem,
  linkEntities,
  markResearchUsed,
  moveResearchCategory,
  moveResearchItem,
  ref,
  researchCategoriesInOrder,
  researchItemsForCategory,
  restoreResearchItem,
  setResearchArchived,
  setResearchCategoryArchived,
  updateResearchCategory,
  updateResearchItem,
  type BeatId,
  type ProjectFile,
  type ResearchCategoryId,
  type ResearchItemId,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';

interface ResearchPanelProps {
  file: ProjectFile;
  /** The beat open in the writing workspace, so material can be linked or marked used there. */
  currentBeatId: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

type UsageFilter = 'unused' | 'used' | 'all';

/**
 * The research browser (spec §7.1, §7.2).
 *
 * Two things the interface has to make obvious, because they are what the
 * feature is for: what has *not* been used yet is a working inventory, not a
 * junk drawer; and moving something to Used never destroys it — the Used tab
 * and the Restore button are always one click apart.
 */
export function ResearchPanel({ file, currentBeatId, onUpdate }: ResearchPanelProps) {
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [filter, setFilter] = useState<UsageFilter>('unused');
  const [selectedCategoryId, setSelectedCategoryId] = useState<ResearchCategoryId | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<ResearchItemId | null>(null);

  const categories = researchCategoriesInOrder(file, showArchivedCategories);
  const activeCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null;

  const items = activeCategory
    ? researchItemsForCategory(file, activeCategory.id, {
        ...(filter === 'all' ? {} : { usage: filter }),
        includeArchived: filter === 'all',
      })
    : [];
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  const counts = activeCategory
    ? {
        unused: researchItemsForCategory(file, activeCategory.id, { usage: 'unused' }).length,
        used: researchItemsForCategory(file, activeCategory.id, { usage: 'used' }).length,
      }
    : { unused: 0, used: 0 };

  return (
    <div className="research">
      <aside className="research-categories">
        <div className="panel-header">
          <h2>Categories</h2>
          <button
            type="button"
            className="ghost"
            title="Add category"
            onClick={() => {
              const created = addResearchCategory(file, { name: 'New category' });
              setSelectedCategoryId(created.category.id);
              onUpdate(() => created.file);
            }}
          >
            +
          </button>
        </div>

        <ul>
          {categories.map((category, index) => (
            <li
              key={category.id}
              className={activeCategory?.id === category.id ? 'selected' : ''}
              onClick={() => setSelectedCategoryId(category.id)}
            >
              <InlineText
                value={category.name}
                ariaLabel="Category name"
                className="category-name"
                onCommit={(name) => onUpdate((current) => updateResearchCategory(current, category.id, { name }))}
              />
              <span className="count muted">
                {researchItemsForCategory(file, category.id, { usage: 'unused' }).length}
              </span>
              <span className="row-actions">
                <button
                  type="button"
                  className="ghost"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => onUpdate((current) => moveResearchCategory(current, category.id, index - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  title="Move down"
                  disabled={index === categories.length - 1}
                  onClick={() => onUpdate((current) => moveResearchCategory(current, category.id, index + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost"
                  title={category.archived ? 'Restore category' : 'Archive category'}
                  onClick={() =>
                    onUpdate((current) => setResearchCategoryArchived(current, category.id, !category.archived))
                  }
                >
                  {category.archived ? '⟲' : '⌫'}
                </button>
              </span>
            </li>
          ))}
        </ul>

        <label className="toggle">
          <input
            type="checkbox"
            checked={showArchivedCategories}
            onChange={(event) => setShowArchivedCategories(event.target.checked)}
          />
          Show archived
        </label>
      </aside>

      <section className="research-items">
        <div className="panel-header">
          <div className="tabs" role="tablist" aria-label="Usage filter">
            {(['unused', 'used', 'all'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={filter === option}
                className={filter === option ? 'tab selected' : 'tab'}
                onClick={() => setFilter(option)}
              >
                {option === 'unused' ? `Unused (${counts.unused})` : option === 'used' ? `Used (${counts.used})` : 'All'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ghost"
            disabled={!activeCategory}
            onClick={() => {
              if (!activeCategory) return;
              onUpdate((current) => addResearchItem(current, { categoryId: activeCategory.id, title: 'New note' }));
            }}
          >
            + Note
          </button>
        </div>

        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={selectedItem?.id === item.id ? 'item selected' : 'item'}
                onClick={() => setSelectedItemId(item.id)}
              >
                <span className="item-title">{item.title}</span>
                {item.usage === 'used' ? (
                  <span className={item.usedConfirmed ? 'chip used' : 'chip suggested'}>
                    {item.usedConfirmed ? 'used' : 'used?'}
                  </span>
                ) : null}
                {item.archived ? <span className="chip">archived</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 ? (
          <p className="muted empty">
            {filter === 'unused'
              ? 'Nothing waiting to be used in this category.'
              : filter === 'used'
                ? 'Nothing from this category has been worked in yet.'
                : 'No notes in this category.'}
          </p>
        ) : null}
      </section>

      <section className="research-detail">
        {selectedItem ? (
          <>
            <input
              className="detail-title"
              aria-label="Note title"
              value={selectedItem.title}
              onChange={(event) =>
                onUpdate((current) => updateResearchItem(current, selectedItem.id, { title: event.target.value }))
              }
            />
            <textarea
              className="detail-body"
              aria-label="Note body"
              rows={12}
              placeholder="What is this, and what does the story owe it?"
              value={selectedItem.body}
              onChange={(event) =>
                onUpdate((current) => updateResearchItem(current, selectedItem.id, { body: event.target.value }))
              }
            />

            <label className="field">
              <span>Tags (comma separated)</span>
              <input
                value={selectedItem.tags.join(', ')}
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResearchItem(current, selectedItem.id, {
                      tags: event.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter((tag) => tag.length > 0),
                    }),
                  )
                }
              />
            </label>

            <label className="field">
              <span>Category</span>
              <select
                value={selectedItem.categoryId}
                onChange={(event) =>
                  onUpdate((current) =>
                    moveResearchItem(current, {
                      itemId: selectedItem.id,
                      toCategoryId: event.target.value as ResearchCategoryId,
                      index: 0,
                    }),
                  )
                }
              >
                {researchCategoriesInOrder(file, true).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="detail-actions">
              {selectedItem.usage === 'unused' ? (
                <button
                  type="button"
                  className="primary"
                  title={currentBeatId ? 'Record it as used in the beat you have open' : 'Mark it used'}
                  onClick={() =>
                    onUpdate((current) =>
                      markResearchUsed(current, {
                        itemId: selectedItem.id,
                        ...(currentBeatId ? { beatId: currentBeatId } : {}),
                      }),
                    )
                  }
                >
                  Mark used{currentBeatId ? ' here' : ''}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdate((current) => restoreResearchItem(current, selectedItem.id))}
                >
                  Restore to unused
                </button>
              )}

              <button
                type="button"
                disabled={!currentBeatId}
                title={currentBeatId ? 'Link to the beat you have open' : 'Open a beat to link it'}
                onClick={() => {
                  if (!currentBeatId) return;
                  onUpdate((current) =>
                    linkEntities(current, {
                      from: ref('beat', currentBeatId),
                      to: ref('research_item', selectedItem.id),
                      type: 'relates_to',
                    }),
                  );
                }}
              >
                Link to current beat
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdate((current) => setResearchArchived(current, selectedItem.id, !selectedItem.archived))
                }
              >
                {selectedItem.archived ? 'Unarchive' : 'Archive'}
              </button>
            </div>

            {selectedItem.usage === 'used' && !selectedItem.usedConfirmed ? (
              <p className="notice">
                Marked used automatically. Confirm it, or restore it to unused if that was wrong.
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted empty">Select a note to edit it.</p>
        )}
      </section>
    </div>
  );
}
