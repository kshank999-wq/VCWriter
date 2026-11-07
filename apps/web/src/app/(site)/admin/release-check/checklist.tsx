'use client';

import { useEffect, useMemo, useState } from 'react';

export interface CheckGuide {
  slug: string;
  title: string;
  steps: { id: string; section: string; text: string }[];
}

type Platform = 'windows' | 'macos';
const KEY = 'vcw-release-check';

/** Bold and italic markers out: this is a list to tick, not the guide. */
const plain = (text: string): string => text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');

/**
 * The ticks, per platform, kept in this browser only — the check is done on
 * the machine being checked, and nothing about it belongs on the server.
 */
export function ReleaseChecklist({ groups }: { groups: { id: string; title: string; guides: CheckGuide[] }[] }) {
  const [platform, setPlatform] = useState<Platform>('windows');
  const [done, setDone] = useState<Record<Platform, string[]>>({ windows: [], macos: [] });

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
      if (saved && Array.isArray(saved.windows) && Array.isArray(saved.macos)) setDone(saved);
    } catch {
      // A browser that keeps nothing still shows the list.
    }
  }, []);

  const ticked = useMemo(() => new Set(done[platform]), [done, platform]);
  const total = groups.reduce((sum, group) => sum + group.guides.reduce((n, guide) => n + guide.steps.length, 0), 0);

  const toggle = (id: string) => {
    setDone((current) => {
      const mine = new Set(current[platform]);
      if (mine.has(id)) mine.delete(id);
      else mine.add(id);
      const next = { ...current, [platform]: [...mine] };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not kept; still ticked on screen.
      }
      return next;
    });
  };

  const clear = () => {
    if (!window.confirm(`Clear every tick for ${platform === 'windows' ? 'Windows' : 'Mac'}?`)) return;
    toggleAll([]);
  };
  const toggleAll = (ids: string[]) => {
    setDone((current) => {
      const next = { ...current, [platform]: ids };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not kept.
      }
      return next;
    });
  };

  return (
    <div className="release-check">
      <div className="release-check-bar">
        <span role="group" aria-label="Platform">
          <button type="button" className={platform === 'windows' ? 'button' : 'button secondary'} onClick={() => setPlatform('windows')}>
            Windows
          </button>{' '}
          <button type="button" className={platform === 'macos' ? 'button' : 'button secondary'} onClick={() => setPlatform('macos')}>
            Mac
          </button>
        </span>
        <span className="release-check-count">
          {ticked.size} of {total} steps checked
        </span>
        <button type="button" className="button secondary" onClick={clear}>
          Clear
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.id}>
          <h2>{group.title}</h2>
          {group.guides.map((guide) => {
            const doneHere = guide.steps.filter((step) => ticked.has(step.id)).length;
            return (
              <details key={guide.slug} className="release-check-guide">
                <summary>
                  <strong>{guide.title}</strong>{' '}
                  <span className={doneHere === guide.steps.length ? 'release-check-ok' : 'release-check-count'}>
                    {doneHere}/{guide.steps.length}
                  </span>{' '}
                  <a href={`/help/${guide.slug}`} target="_blank" rel="noreferrer">
                    open guide
                  </a>
                </summary>
                <ul>
                  {guide.steps.map((step) => (
                    <li key={step.id}>
                      <label>
                        <input type="checkbox" checked={ticked.has(step.id)} onChange={() => toggle(step.id)} />{' '}
                        <span className="release-check-section">{step.section}:</span> {plain(step.text)}
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
      ))}
    </div>
  );
}
