import { useMemo, useState } from 'react';
import {
  asClock,
  asDuration,
  dayOf,
  daysOfWriting,
  projectStats,
  paginateProject,
  placedMarkers,
  sessionMinutes,
  sessionsInOrder,
  sessionWords,
  writingReport,
  type ProjectFile,
  type ManuscriptOptions,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * Reports (addendum 02 §15).
 *
 * Two of them. The **writing log** is the record the clock keeps: what days
 * were worked, from what hour to what hour, and how many words the manuscript
 * gained or lost in each sitting. The **story statistics** are what the
 * document itself says — how long it is, how much of it is written.
 *
 * Both are read-only, and deliberately so. A report that could be edited
 * would be a claim rather than a record.
 */

export type ReportTab = 'writing' | 'story';

interface ReportsProps {
  file: ProjectFile;
  open: ReportTab | null;
  onClose(): void;
  onTab(tab: ReportTab): void;
  printOptions: ManuscriptOptions;
}

/** "Mon 8 Sep" — a day as a person reads it, from a `YYYY-MM-DD`. */
const asDay = (day: string): string => {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const signed = (words: number): string => (words > 0 ? `+${words}` : String(words));

export function Reports({ file, open, onClose, onTab, printOptions }: ReportsProps) {
  const dialog = useModal(open !== null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const report = useMemo(() => writingReport(file), [file]);
  const days = useMemo(() => daysOfWriting(file), [file]);
  const sessions = useMemo(() => sessionsInOrder(file), [file]);
  const stats = useMemo(() => projectStats(file), [file]);
  const pages = useMemo(() => paginateProject(file, printOptions).length, [file, printOptions]);
  const markers = useMemo(() => placedMarkers(file), [file]);

  /** The sittings that belong to a day, by the writer's own clock. */
  const sittingsOn = (day: string) => sessions.filter((session) => dayOf(session.startedAt) === day);

  return (
    <dialog ref={dialog} className="lane-dialog reports" aria-label="Reports" onClose={onClose}>
      {open !== null ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">Reports</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <nav className="report-tabs" aria-label="Which report">
            <button
              type="button"
              className="report-tab"
              aria-pressed={open === 'writing'}
              onClick={() => onTab('writing')}
            >
              Writing log
            </button>
            <button
              type="button"
              className="report-tab"
              aria-pressed={open === 'story'}
              onClick={() => onTab('story')}
            >
              Story statistics
            </button>
          </nav>

          {open === 'writing' ? (
            <div className="report-body">
              <div className="report-figures">
                <Figure label="Days written" value={String(report.days)} />
                <Figure label="Time at it" value={asDuration(report.minutes)} />
                <Figure label="Words" value={signed(report.words)} />
                <Figure label="Words an hour" value={String(report.wordsPerHour)} />
                <Figure label="Streak" value={report.streak > 0 ? `${report.streak} days` : '—'} />
                <Figure
                  label="Longest streak"
                  value={report.longestStreak > 0 ? `${report.longestStreak} days` : '—'}
                />
              </div>

              {days.length === 0 ? (
                <p className="muted">
                  Nothing written yet. The log starts itself the moment you begin typing — it counts the time you
                  spend writing, not the time the app is open.
                </p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">Sittings</th>
                      <th scope="col">Time</th>
                      <th scope="col">Words</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((row) => {
                      const showing = expanded === row.day;
                      return [
                        <tr key={row.day}>
                          <th scope="row">
                            <button
                              type="button"
                              className="ghost report-day"
                              aria-expanded={showing}
                              onClick={() => setExpanded(showing ? null : row.day)}
                            >
                              {asDay(row.day)}
                            </button>
                          </th>
                          <td>{row.sessions}</td>
                          <td>{asDuration(row.minutes)}</td>
                          <td className={row.words < 0 ? 'report-loss' : undefined}>{signed(row.words)}</td>
                        </tr>,
                        showing ? (
                          <tr key={`${row.day}-sittings`} className="report-sittings">
                            <td colSpan={4}>
                              <ul>
                                {sittingsOn(row.day).map((session) => (
                                  <li key={session.id}>
                                    <span>
                                      {asClock(session.startedAt)} – {asClock(session.endedAt)}
                                    </span>
                                    <span className="muted">{asDuration(sessionMinutes(session))}</span>
                                    <span className={sessionWords(session) < 0 ? 'report-loss' : undefined}>
                                      {signed(sessionWords(session))} words
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="report-body">
              <div className="report-figures">
                <Figure label="Words" value={stats.wordCount.toLocaleString()} />
                <Figure label="Pages" value={String(pages)} />
                <Figure label="Scenes" value={String(stats.unitCount)} />
                <Figure label="Beats" value={String(stats.beatCount)} />
                <Figure label="Written" value={`${stats.writtenBeatCount} of ${stats.beatCount}`} />
                <Figure label="Markers" value={String(markers.length)} />
                <Figure label="Plot lanes" value={String(stats.laneCount)} />
                <Figure label="Research not used" value={String(stats.unusedResearchCount)} />
                <Figure label="Setups unpaid" value={String(stats.unresolvedSetupCount)} />
              </div>
              <p className="muted">
                Pages are the pages this would print, with the page setup as it stands. A page is a minute of screen
                time, which is why the two numbers agree.
              </p>
            </div>
          )}
        </>
      ) : null}
    </dialog>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-figure">
      <span className="report-figure-value">{value}</span>
      <span className="report-figure-label">{label}</span>
    </div>
  );
}
