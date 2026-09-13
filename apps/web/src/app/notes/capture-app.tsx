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
import { isDictationSupported, startDictation, type DictationSession } from '@/lib/dictation';
import { NotesReview } from './notes-review';
import { ProjectPage, type ProjectSummary } from './project-page';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  type CaptureCategory,
} from '@vcwriter/domain';

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

  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

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

  const toggleDictation = () => {
    if (dictating) {
      session.current?.stop();
      return;
    }
    const started = startDictation({
      onFinal: (chunk) => setText((current) => `${current}${current.length > 0 && !current.endsWith(' ') ? ' ' : ''}${chunk.trim()}`),
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

      {screen === 'capture' ? (
        <>
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
  
          {/* Optional for all five: a character's name for a Character or an Arc
              note, a short label for the rest. */}
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
          <button type="button" className="button" onClick={() => void save()} disabled={text.trim().length === 0}>
            Save note
          </button>
        </div>
  
        {!isDictationSupported() ? (
          <p className="muted small">
            This browser has no dictation API. On iPhone, use the microphone key on the keyboard.
          </p>
        ) : null}
  
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
