import { z } from 'zod';
import { countWords } from './entities/manuscript.js';
import { id, isoDateTime } from './entities/common.js';
import type { ProjectFile } from './project-file.js';
import { newId } from './ids.js';
import type { ProjectId, WritingSessionId } from './ids.js';

/**
 * What the writing actually cost (addendum 02 §15).
 *
 * A session is one sitting: the day it was, the hour it started and the hour
 * it ended, and how many words the manuscript gained or lost while it ran.
 * That is the whole record — no keystroke log, no idle tracking beyond the
 * gap that ends a sitting, nothing about *what* was written. A report that
 * needed the manuscript to say something useful would be a different and
 * much worse thing.
 *
 * The sessions live in the project file, so the record follows the work to
 * another machine and into the sync. A writer who never signs in still has
 * their own history.
 */

export const writingSessionSchema = z.object({
  id: id<WritingSessionId>(),
  projectId: id<ProjectId>(),
  startedAt: isoDateTime(),
  /** Moved forward as the writing continues; a sitting is closed when it stops. */
  endedAt: isoDateTime(),
  wordsAtStart: z.number().int().min(0).default(0),
  wordsAtEnd: z.number().int().min(0).default(0),
  /** Which machine, when there is more than one. Free text; never required. */
  device: z.string().default(''),
});
export type WritingSession = z.infer<typeof writingSessionSchema>;

/** A sitting is over when nothing has been written for this long. */
export const SESSION_IDLE_MS = 5 * 60 * 1000;

const ms = (iso: string): number => {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
};

export const sessionMinutes = (session: WritingSession): number =>
  Math.max(0, Math.round((ms(session.endedAt) - ms(session.startedAt)) / 60_000));

export const sessionWords = (session: WritingSession): number => session.wordsAtEnd - session.wordsAtStart;

/**
 * Record that writing is happening now.
 *
 * The last session continues if it was still running — which is what makes
 * a sitting a sitting rather than one row per keystroke — and a new one
 * starts when the gap since the last is longer than `SESSION_IDLE_MS`. The
 * word count is the project's, so a session that deleted more than it added
 * honestly reports a loss.
 */
export const recordWriting = (
  file: ProjectFile,
  at: string,
  options: { device?: string; idleMs?: number } = {},
): ProjectFile => {
  const words = projectWords(file);
  const idle = options.idleMs ?? SESSION_IDLE_MS;
  const sessions = file.sessions ?? [];
  const last = sessions[sessions.length - 1];

  if (last && ms(at) - ms(last.endedAt) <= idle && ms(at) >= ms(last.endedAt)) {
    const continued = { ...last, endedAt: at, wordsAtEnd: words };
    return { ...file, sessions: [...sessions.slice(0, -1), continued] };
  }

  const started = writingSessionSchema.parse({
    id: newId<WritingSessionId>(),
    projectId: file.project.id,
    startedAt: at,
    endedAt: at,
    wordsAtStart: words,
    wordsAtEnd: words,
    device: options.device ?? '',
  });
  return { ...file, sessions: [...sessions, started] };
};

/** Every word in the manuscript, which is what a session's counts are of. */
export const projectWords = (file: ProjectFile): number =>
  file.beats.reduce((total, beat) => total + countWords(beat.manuscript), 0);

// ------------------------------------------------------------------ reports

export interface DayOfWriting {
  /** `YYYY-MM-DD` in the writer's own time, not UTC: it is their day. */
  day: string;
  minutes: number;
  words: number;
  sessions: number;
}

/** The local calendar day an instant falls on. */
export const dayOf = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const sessionsInOrder = (file: ProjectFile): WritingSession[] =>
  [...(file.sessions ?? [])].sort((a, b) => ms(a.startedAt) - ms(b.startedAt));

/** One row per day the writer worked, newest first. */
export const daysOfWriting = (file: ProjectFile): DayOfWriting[] => {
  const days = new Map<string, DayOfWriting>();
  for (const session of sessionsInOrder(file)) {
    const day = dayOf(session.startedAt);
    const row = days.get(day) ?? { day, minutes: 0, words: 0, sessions: 0 };
    row.minutes += sessionMinutes(session);
    row.words += sessionWords(session);
    row.sessions += 1;
    days.set(day, row);
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
};

export interface WritingReport {
  sessions: number;
  minutes: number;
  /** Net: a day spent cutting is a negative number, and should be. */
  words: number;
  days: number;
  /** Words an hour over the time actually spent writing; 0 with no time. */
  wordsPerHour: number;
  /** Consecutive days ending today or yesterday — a streak that is still alive. */
  streak: number;
  longestStreak: number;
  firstDay: string;
  lastDay: string;
}

const dayBefore = (day: string): string => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return dayOf(date.toISOString());
};

/**
 * The figures. `today` is passed in rather than read from the clock so the
 * report is a pure function of the document and the day it is being read on.
 */
export const writingReport = (file: ProjectFile, today: string = dayOf(new Date().toISOString())): WritingReport => {
  const rows = daysOfWriting(file);
  const minutes = rows.reduce((total, row) => total + row.minutes, 0);
  const words = rows.reduce((total, row) => total + row.words, 0);
  const sessions = rows.reduce((total, row) => total + row.sessions, 0);

  // Rows are newest first, so walking them is walking backwards in time.
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const row of rows) {
    run = previous !== null && dayBefore(previous) === row.day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = row.day;
  }

  // A streak counts only if it reaches today or yesterday; one that ended a
  // week ago is history, not a streak.
  let streak = 0;
  const yesterday = dayBefore(today);
  if (rows[0] && (rows[0].day === today || rows[0].day === yesterday)) {
    streak = 1;
    for (let index = 1; index < rows.length; index += 1) {
      if (dayBefore(rows[index - 1]!.day) !== rows[index]!.day) break;
      streak += 1;
    }
  }

  return {
    sessions,
    minutes,
    words,
    days: rows.length,
    wordsPerHour: minutes > 0 ? Math.round((words / minutes) * 60) : 0,
    streak,
    longestStreak: longest,
    firstDay: rows[rows.length - 1]?.day ?? '',
    lastDay: rows[0]?.day ?? '',
  };
};

/** `2h 15m`, or `45m`. What a person says when asked how long they wrote. */
export const asDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/** `9:05 pm`, in the writer's own time. */
export const asClock = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
