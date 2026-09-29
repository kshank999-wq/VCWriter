'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { browserClient } from '@/lib/supabase-browser';
import {
  enqueue,
  markFailed,
  markSynced,
  newClientCaptureId,
  pendingCaptures,
  pruneSynced,
  type QueuedCapture,
} from '@/lib/capture-queue';
import {
  isDictationSupported,
  isReadBackSupported,
  readAloud,
  startDictation,
  type DictationSession,
} from '@/lib/dictation';
import { NotesReview } from './notes-review';
import { ProjectPage, type ProjectSummary } from './project-page';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  applyCorrection,
  captureKeyName,
  captureVocabulary,
  emptySitting,
  everything,
  formatSpokenName,
  hear,
  projectFailed,
  projectMade,
  projectNamed,
  readSpoken,
  sayBack,
  speakBack,
  spokenFormatNames,
  WAKE,
  type CaptureCategory,
  type ProjectFormat,
  type Sitting,
} from '@vcwriter/domain';
import { beep } from '@/lib/beep';

/**
 * VC Writer Notes — capture away from the desk (spec §11, addendum 09).
 *
 * The order of operations is the feature: type or dictate, and the note is in
 * IndexedDB before anything is sent. Sending is a retry that happens when there
 * is signal. Nothing here writes to the project — captures land in a queue the
 * writer reviews on the desktop, because AI or not, classification is a
 * proposal until a person confirms it (§9).
 *
 * **What this screen asks for is what kind of thought it is, never where it
 * goes** (addendum 09 §2). The destination picker that used to sit here is
 * gone: deciding *where* is the desktop's job, and asking it on a phone is how
 * a voice notebook grows a folder tree. Five categories, one optional name, and
 * the words.
 */

type Screen = 'projects' | 'capture' | 'review';

/**
 * The project they were last capturing into (addendum 09 §3.1).
 *
 * Remembered so the Project Page can *mark* it, never so the app can skip
 * asking: §2's **project first** means a writer sees which script they are
 * about to talk into, every time.
 */
const LAST_PROJECT = 'vcwriter-notes-project';

export default function CaptureApp() {
  const supabase = useRef(browserClient()).current;

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('projects');
  const [category, setCategory] = useState<CaptureCategory>('idea');
  const [subjectName, setSubjectName] = useState('');

  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [dictating, setDictating] = useState(false);
  const session = useRef<DictationSession | null>(null);
  /**
   * The wording a correction replaced, so putting it back is one press (§6).
   *
   * Null means nothing has been corrected. Cleared when the note is saved: a
   * note that has gone has nothing to undo.
   */
  const [beforeCorrection, setBeforeCorrection] = useState<string | null>(null);
  /** Whether the last utterance was heard as a command, for the line under it. */
  const [heard, setHeard] = useState<string | null>(null);

  /**
   * Hands-free (addendum 09 §10, from Ken).
   *
   * The sitting is the domain's, held in a **ref as well as state**: a
   * recogniser fires outside React, so each utterance has to fold into what
   * the one before it left rather than into whatever the last render captured.
   * The state copy is only so the screen can draw it.
   */
  const [handsFree, setHandsFree] = useState(false);
  const [sitting, setSitting] = useState<Sitting>(() => emptySitting());
  const walk = useRef<Sitting>(emptySitting());
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  /** Held in a ref for the recogniser's reason: it reads the live project. */
  const chosen = useRef<ProjectSummary | null>(null);

  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    chosen.current = project;
  }, [project]);

  /** The projects, for a spoken *dictate project Jinn*. */
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/notes/projects', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json()) as { projects?: ProjectSummary[] };
        setProjects(body.projects ?? []);
      } catch {
        // Offline is the ordinary case here; the picker still works.
      }
    })();
  }, []);

  const refreshQueue = useCallback(async () => {
    setQueue(await pendingCaptures());
  }, []);

  /** Push everything still waiting. Safe to call repeatedly. */
  const flushQueue = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const waiting = await pendingCaptures();
    if (waiting.length === 0) return;

    for (const capture of waiting) {
      const { error } = await supabase.from('capture_items').upsert(
        {
          user_id: user.id,
          project_id: capture.projectId,
          source: capture.source,
          captured_at: capture.capturedAt,
          raw_text: capture.rawText,
          requested_routing: capture.requestedRouting,
          category: capture.category,
          subject_name: capture.subjectName,
          subcategory: capture.subcategory ?? null,
          client_capture_id: capture.clientCaptureId,
          synced_at: new Date().toISOString(),
          status: 'pending',
        },
        // Retrying a send that actually worked must not duplicate the thought.
        { onConflict: 'user_id,client_capture_id', ignoreDuplicates: false },
      );

      if (error) await markFailed(capture.clientCaptureId, error.message);
      else await markSynced(capture.clientCaptureId);
    }

    await pruneSynced();
    await refreshQueue();
  }, [supabase, refreshQueue]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setEmail(user?.email ?? null);
      try {
        setLastProjectId(localStorage.getItem(LAST_PROJECT));
      } catch {
        // A locked-down browser is not a reason to fail to open.
      }

      await refreshQueue();
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, refreshQueue]);

  // Send whatever is waiting as soon as there is a connection again.
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flushQueue();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [flushQueue]);

  /**
   * One utterance, read for what it meant (his §5 and §6).
   *
   * `readSpoken` in the domain decides; this only does what it says. The three
   * outcomes are the three the spec names: a category was called, a correction
   * was called, or it was dictation — and in every one of them the words a
   * writer spoke end up on the screen where they can see them (§2's *visible
   * confirmation*).
   */
  const heardIt = (chunk: string) => {
    const command = readSpoken(chunk);

    if (command.kind === 'category') {
      setCategory(command.category);
      if (command.subjectName) setSubjectName(command.subjectName);
      setHeard(
        command.subjectName
          ? `${CAPTURE_CATEGORY_NAMES[command.category]} — ${command.subjectName}`
          : CAPTURE_CATEGORY_NAMES[command.category],
      );
      if (command.text.length > 0) append(command.text);
      return;
    }

    if (command.kind === 'correction') {
      // Replaces, and keeps what was there so a press puts it back (§6).
      setText((current) => {
        const after = applyCorrection(current, command.text);
        setBeforeCorrection(after.previous);
        return after.text;
      });
      setHeard('Correction');
      return;
    }

    append(command.text);
  };

  const append = (chunk: string) => {
    const words = chunk.trim();
    if (words.length === 0) return;
    setText((current) => `${current}${current.length > 0 && !current.endsWith(' ') ? ' ' : ''}${words}`);
  };

  /** Say the note back, so it can be checked without looking (his §5.7). */
  const sayItBack = () => {
    readAloud(sayBack({ category, subjectName: subjectName.trim() || null, text }), {
      onError: setStatus,
    });
  };

  const toggleDictation = () => {
    if (dictating) {
      session.current?.stop();
      return;
    }
    const started = startDictation({
      onFinal: (chunk) => heardIt(chunk),
      onInterim: setInterim,
      onError: (message) => {
        setStatus(message);
        setDictating(false);
      },
      onEnd: () => {
        setInterim('');
        setDictating(false);
      },
    });
    if (!started) {
      setStatus('Dictation is not available in this browser. Use your keyboard’s microphone key instead.');
      return;
    }
    session.current = started;
    setDictating(true);
  };

  // ------------------------------------------------------- hands free (§10)

  /**
   * What the chosen project calls things; a screenplay's words by default.
   *
   * Two readings of one fact, and the difference matters: the recogniser fires
   * outside React and must read the **ref**, which is current; the screen is
   * drawing and must read the **state**, because a ref set in an effect is one
   * render behind on the pass that follows a project change.
   */
  const format = (): ProjectFormat => (chosen.current?.format as ProjectFormat) ?? 'screenplay';
  const formatNow: ProjectFormat = (project?.format as ProjectFormat) ?? 'screenplay';

  /** One note out of the sitting, onto the device. */
  const fileOne = async (note: {
    key: string | null;
    subjectName: string | null;
    text: string;
    group?: string | null;
  }) => {
    const content = note.text.trim();
    if (content.length === 0 && !note.subjectName) return;
    await enqueue({
      clientCaptureId: newClientCaptureId(),
      projectId: chosen.current?.id ?? null,
      rawText: content,
      source: 'mobile_voice',
      capturedAt: new Date().toISOString(),
      requestedRouting: null,
      // The project's own vocabulary now (§10), which the column carries as
      // text since 0060.
      category: note.key as CaptureCategory | null,
      subjectName: note.subjectName,
      // The writer's own word, said once and carried by every note after it
      // (§12). Nothing is created by it here: the desktop makes the folder.
      subcategory: note.group ?? null,
      syncedAt: null,
      lastError: null,
      attempts: 0,
    });
  };

  /**
   * A project the writer confirmed out loud (§11).
   *
   * **`hear` says it was confirmed and this is what does it**, which is the
   * whole of why the domain half is pure: what the writer said is a fact worth
   * testing, and a network call is not one.
   *
   * It goes through the same route the picker's *Start it* uses, so a project
   * named into a phone in a pocket is the same document — the opening scene, the
   * research folders, the cast headings — as one named with a keyboard.
   */
  const makeProject = async (plan: { name: string; format: ProjectFormat }) => {
    /**
     * **Refused out loud rather than queued.** Every note on this screen is
     * queued offline and sent later, and a project is the one thing that cannot
     * be: the notes said into it would be addressed to an id that does not
     * exist yet, and the writer would find out a fortnight later.
     */
    if (!navigator.onLine) {
      const why = `No signal, so ${plan.name} cannot be started yet. Say ${WAKE} yes again when you have one.`;
      walk.current = projectFailed(walk.current, plan, why);
      setSitting(walk.current);
      readAloud(why, { onError: setStatus });
      return;
    }

    try {
      const response = await fetch('/api/notes/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: plan.name, format: plan.format }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        project?: ProjectSummary;
        error?: string;
      };
      if (!response.ok || !body.project) {
        const why = body.error ?? `${plan.name} could not be started.`;
        walk.current = projectFailed(walk.current, plan, why);
        setSitting(walk.current);
        readAloud(why, { onError: setStatus });
        return;
      }

      const made = body.project;
      // Straight into it, which is what somebody who just named a project
      // wants — and it is what makes the next spoken category the new
      // format's: `format()` reads this ref.
      chosen.current = made;
      setProject(made);
      setProjects((current) => [made, ...current.filter((one) => one.id !== made.id)]);
      try {
        localStorage.setItem(LAST_PROJECT, made.id);
        setLastProjectId(made.id);
      } catch {
        // Remembering is a convenience; not remembering is not a failure.
      }
      walk.current = projectMade(walk.current, plan);
      setSitting(walk.current);
      readAloud(`${made.title} is ready. Talking into it now.`, { onError: setStatus });
    } catch {
      const why = `${plan.name} could not be started. Say ${WAKE} yes again to try.`;
      walk.current = projectFailed(walk.current, plan, why);
      setSitting(walk.current);
      readAloud(why, { onError: setStatus });
    }
  };

  /**
   * One utterance, folded into the walk.
   *
   * **Nothing here decides what was meant**: `hear` does, in the domain, where
   * it is tested rather than demonstrated — which matters more on this screen
   * than anywhere, because the writer cannot see it.
   */
  const heardHandsFree = (chunk: string) => {
    const before = walk.current;
    const after = hear(before, chunk, format());
    walk.current = after;
    setSitting(after);

    // A note that just closed goes to the device at once: a walk that filed
    // everything at the end would lose the lot to a dropped connection or a
    // flat battery, and the queue exists precisely so it does not have to.
    if (after.filed.length > before.filed.length) {
      const done = after.filed[after.filed.length - 1];
      if (done) void fileOne(done).then(refreshQueue);
    }

    if (after.opened) beep('open');
    else if (after.open === null && before.open !== null) beep('close');

    // A project asked for by name, resolved against the list (§10).
    if (after.wants) {
      const found = projectNamed(after.wants, projects.map((one) => ({ ...one, name: one.title })));
      if (found) {
        const picked = projects.find((one) => one.id === found.id) ?? null;
        chosen.current = picked;
        setProject(picked);
        readAloud(`${picked?.title ?? after.wants}.`, { onError: setStatus });
      } else {
        readAloud(`No project called ${after.wants}.`, { onError: setStatus });
      }
      return;
    }

    const spoken = speakBack(before, after);
    if (spoken) readAloud(spoken, { onError: setStatus });

    // Said *after* the read-back, so *Making Blackout…* is heard before the
    // answer to it: two sentences the other way round would have the second
    // talking over the first.
    if (after.makes) void makeProject(after.makes);
  };

  const toggleHandsFree = () => {
    if (handsFree) {
      session.current?.stop();
      session.current = null;
      setHandsFree(false);
      setDictating(false);
      // Whatever was still open is kept: a notebook that only kept what you
      // remembered to close is one you stop trusting after the first walk.
      const left = everything(walk.current);
      const openOne = walk.current.open;
      if (openOne && left.includes(openOne)) void fileOne(openOne).then(refreshQueue);
      walk.current = emptySitting();
      setSitting(emptySitting());
      setStatus(left.length === 1 ? '1 note from that walk' : `${left.length} notes from that walk`);
      return;
    }

    const started = startDictation({
      onFinal: (chunk) => heardHandsFree(chunk),
      onInterim: setInterim,
      onError: (message) => {
        setStatus(message);
        setHandsFree(false);
        setDictating(false);
      },
      onEnd: () => {
        setHandsFree(false);
        setDictating(false);
      },
    });
    if (!started) {
      setStatus('No speech service in this browser — type the note instead.');
      return;
    }
    session.current = started;
    walk.current = emptySitting();
    setSitting(emptySitting());
    setHandsFree(true);
    setDictating(true);
    beep('open');
  };

  const save = async () => {
    const content = text.trim();
    if (content.length === 0) return;

    session.current?.stop();
    const capture: QueuedCapture = {
      clientCaptureId: newClientCaptureId(),
      projectId: project?.id ?? null,
      rawText: content,
      source: dictating ? 'mobile_voice' : 'mobile_text',
      capturedAt: new Date().toISOString(),
      requestedRouting: null,
      category,
      subjectName: subjectName.trim().length > 0 ? subjectName.trim() : null,
      // The typed screen has no group: §12's is said out loud, and a second
      // control for it here would be the folder picker §2 refuses.
      subcategory: null,
      syncedAt: null,
      lastError: null,
      attempts: 0,
    };

    // On the device first, sent second. This order is what makes a capture on a
    // train with no signal safe.
    await enqueue(capture);
    setText('');
    setInterim('');
    // The name goes with the note; the category stays, because a writer
    // catching three thoughts about the same person should say it once.
    setSubjectName('');
    setBeforeCorrection(null);
    setHeard(null);
    await refreshQueue();
    setStatus(navigator.onLine ? 'Saved' : 'Saved on this device — it will sync when you are back online');
    await flushQueue();
  };

  if (loading) {
    return (
      <div className="notes">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="notes">
        <h1>VC Writer Notes</h1>
        <p className="lede">Sign in with the address you use for VC Writer to capture notes to your projects.</p>
        <Link href="/signin?next=/notes" className="button">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="notes">
      <header className="notes-header">
        <h1>
          {screen === 'projects' ? 'Projects' : screen === 'capture' ? 'Capture' : 'Your notes'}
        </h1>
        <span className="muted">{email}</span>
      </header>

      {/* Which script this is, and the way back to the list. Always visible
          once one is chosen, because §2's project-first is a promise that the
          writer can always see what they are about to talk into. */}
      {screen !== 'projects' && project ? (
        <div className="notes-chosen">
          <button type="button" className="notes-back" onClick={() => setScreen('projects')}>
            ‹ Projects
          </button>
          <strong>{project.title || 'Untitled'}</strong>
        </div>
      ) : null}

      {screen === 'projects' ? (
        <ProjectPage
          chosenId={lastProjectId}
          onChoose={(chosen) => {
            setProject(chosen);
            setLastProjectId(chosen.id);
            try {
              localStorage.setItem(LAST_PROJECT, chosen.id);
            } catch {
              // Remembering is a convenience; not remembering is not a failure.
            }
            setScreen('capture');
          }}
        />
      ) : (
        <nav className="notes-tabs" aria-label="Notes">
          <button
            type="button"
            className={screen === 'capture' ? 'notes-tab selected' : 'notes-tab'}
            aria-current={screen === 'capture' ? 'page' : undefined}
            onClick={() => setScreen('capture')}
          >
            Capture
          </button>
          <button
            type="button"
            className={screen === 'review' ? 'notes-tab selected' : 'notes-tab'}
            aria-current={screen === 'review' ? 'page' : undefined}
            onClick={() => setScreen('review')}
          >
            Review
          </button>
        </nav>
      )}

      {screen === 'review' ? <NotesReview projectId={project?.id ?? null} /> : null}

      {screen === 'capture' && handsFree ? (
        /**
         * Hands free (§10, from Ken), and it takes the whole screen because it
         * is the whole of what the app is doing: one note at a time, out loud,
         * without a press between them.
         *
         * **Everything here is a reading of the sitting**, which is the
         * domain's — what is open, what has been filed, what was last heard.
         * The screen holds no idea of its own about what was said, so what it
         * draws and what is saved cannot disagree.
         */
        <section className="notes-handsfree">
          <p className="notes-spoken">
            {sitting.making
              ? 'New project'
              : sitting.open
                ? `${captureKeyName(sitting.open.key ?? 'idea', formatNow)}${
                    sitting.open.subjectName ? ` · ${sitting.open.subjectName}` : ''
                  }`
                : 'Listening'}
          </p>
          {/* The group, whenever there is one (§12). It changes where every
              note after it lands, so it stands above the note rather than in
              the line of what was last heard, which scrolls past. */}
          {sitting.group ? (
            <p className="notes-group">
              <span className="muted small">Group</span> {sitting.group}
            </p>
          ) : null}

          <p className="notes-heard muted small">{sitting.said || 'Say a category, or just start talking.'}</p>

          {/* While a project is being described the phone is **not taking
              notes** (§11), so the screen says what is being gathered rather
              than drawing it as the words of a note. */}
          {sitting.making ? (
            <p className="notes-open-text">
              {sitting.making.name || <span className="muted">Say what it is called…</span>}
              {sitting.making.format ? (
                <span className="muted"> · {formatSpokenName(sitting.making.format)}</span>
              ) : null}
            </p>
          ) : (
            <p className="notes-open-text">
              {sitting.open?.text || interim || <span className="muted">…</span>}
            </p>
          )}

          <div className="notes-actions">
            <button type="button" className="button recording" onClick={toggleHandsFree}>
              ● Stop
            </button>
          </div>

          {/* What is being asked for, where it is being asked: the kinds are
              read off the domain's own list, so a format added later is
              offered here without this screen being edited (§11). */}
          {sitting.making ? (
            <p className="muted small">
              Say the title, then the kind — {spokenFormatNames().join(', ')} — and{' '}
              <strong>{WAKE} yes</strong> to make it. <strong>{WAKE} cancel</strong> lets it go. Nothing is
              made until you say yes.
            </p>
          ) : (
            <p className="muted small">
              Say <strong>{WAKE} done</strong> to save it, <strong>{WAKE} new {(captureVocabulary(formatNow)[0]?.name ?? 'idea').toLowerCase()}</strong> to
              start the next, <strong>{WAKE} project</strong> and its name to move,{' '}
              <strong>{WAKE} new project</strong> and a title to start one.{' '}
              <strong>{WAKE} group</strong> and a word puts what follows under it, and{' '}
              <strong>{WAKE} no group</strong> comes back out. Every command begins with
              “{WAKE}”, so those words are still yours inside a note.
            </p>
          )}

          {sitting.filed.length > 0 ? (
            <ul className="notes-filed">
              {sitting.filed.map((one, index) => (
                <li key={index}>
                  <strong>{captureKeyName(one.key ?? 'idea', formatNow)}</strong>
                  {one.subjectName ? ` · ${one.subjectName}` : ''}
                  {one.group ? <span className="notes-filed-group">{one.group}</span> : null}
                  <span className="muted"> — {one.text.slice(0, 60)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {screen === 'capture' && !handsFree ? (
        <>
          {/* What the app currently thinks it is filing, in the largest type on
              the screen. A writer dictating hands-free glances rather than
              reads, and the two things they cannot otherwise check — the
              category and the name — are the two a recogniser most often gets
              wrong (his §5.7). */}
          <p className="notes-spoken">
            {CAPTURE_CATEGORY_NAMES[category]}
            {subjectName.trim().length > 0 ? (
              <span className="notes-spoken-who"> · {subjectName.trim()}</span>
            ) : null}
          </p>
          {heard ? <p className="notes-heard muted small">Heard: {heard}</p> : null}

          <div className="notes-pickers">
            <label className="field">
              <span>This is a</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as CaptureCategory)}>
                {CAPTURE_CATEGORIES.map((one) => (
                  <option key={one} value={one}>
                    {CAPTURE_CATEGORY_NAMES[one]}
                  </option>
                ))}
              </select>
            </label>

            {/* Optional for all five: a character's name for a Character or an
                Arc note, a short label for the rest. */}
            <label className="field">
              <span>{category === 'character' || category === 'arc' ? 'Who' : 'About'}</span>
              <input
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder={category === 'character' || category === 'arc' ? 'MARA' : 'Optional'}
                autoComplete="off"
              />
            </label>
          </div>

          <textarea
            className="notes-input"
            value={interim.length > 0 ? `${text}${text.length > 0 ? ' ' : ''}${interim}` : text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What just occurred to you?"
            rows={10}
            autoFocus
          />

          <div className="notes-actions">
            <button
              type="button"
              className={dictating ? 'button recording' : 'button secondary'}
              onClick={toggleDictation}
              disabled={!isDictationSupported()}
              title={isDictationSupported() ? 'Dictate' : 'Your browser does not offer dictation'}
            >
              {dictating ? '● Listening — tap to stop' : 'Dictate'}
            </button>
            {/* The one press a whole walk needs (§10). Absent rather than
                greyed where the browser cannot hear: a button that can only
                refuse is one nobody presses twice. */}
            {isDictationSupported() ? (
              <button type="button" className="button secondary" onClick={toggleHandsFree}>
                Hands free
              </button>
            ) : null}
            <button type="button" className="button" onClick={() => void save()} disabled={text.trim().length === 0}>
              Save note
            </button>
          </div>

          <div className="notes-actions">
            {isReadBackSupported() ? (
              <button
                type="button"
                className="button secondary"
                onClick={sayItBack}
                disabled={text.trim().length === 0}
              >
                Read it back
              </button>
            ) : null}
            {/* A correction replaces, so the wording it replaced is kept and
                putting it back is one press (§6) — never a second guess about
                what the writer meant. */}
            {beforeCorrection !== null ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setText(beforeCorrection);
                  setBeforeCorrection(null);
                  setHeard(null);
                }}
              >
                Undo correction
              </button>
            ) : null}
          </div>

          {isDictationSupported() ? (
            <p className="muted small">
              Say <strong>Character</strong>, <strong>Plot point</strong>, <strong>Idea</strong>,{' '}
              <strong>Theme</strong> or <strong>Arc</strong> to set what this is — “Character, Mara — she never
              lets anyone drive” names her too. Say <strong>Correction</strong> and the rest replaces the note.
            </p>
          ) : (
            <p className="muted small">
              This browser has no dictation API. On iPhone, use the microphone key on the keyboard.
            </p>
          )}

          {status ? <p className="notice">{status}</p> : null}

          <section className="notes-queue">
            <h2>
              {queue.length === 0
                ? online
                  ? 'Everything is synced'
                  : 'Offline — nothing waiting'
                : `${queue.length} waiting to sync`}
            </h2>
            {queue.length > 0 ? (
              <>
                <ul>
                  {queue.map((capture) => (
                    <li key={capture.clientCaptureId}>
                      <span className="queue-text">{capture.rawText.slice(0, 90)}</span>
                      {capture.lastError ? <span className="error small">{capture.lastError}</span> : null}
                    </li>
                  ))}
                </ul>
                <button type="button" className="button secondary" onClick={() => void flushQueue()} disabled={!online}>
                  Sync now
                </button>
              </>
            ) : null}
            <p className="muted small">
              Notes wait here until you review them in VC Writer on your desktop — nothing is added to a project
              automatically.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
