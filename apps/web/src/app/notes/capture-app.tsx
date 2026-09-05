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

/**
 * VC Writer Notes — capture away from the desk (spec §11).
 *
 * The order of operations is the feature: type or dictate, and the note is in
 * IndexedDB before anything is sent. Sending is a retry that happens when there
 * is signal. Nothing here writes to the project — captures land in a queue the
 * writer reviews on the desktop, because AI or not, classification is a
 * proposal until a person confirms it (§9).
 */

interface ProjectSummary {
  id: string;
  title: string;
}

interface CategorySummary {
  id: string;
  name: string;
  system_key: string | null;
}

type Destination = { kind: 'research'; categoryKey: string | null } | { kind: 'character' } | { kind: 'beat' };

export default function CaptureApp() {
  const supabase = useRef(browserClient()).current;

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [destination, setDestination] = useState<Destination>({ kind: 'research', categoryKey: 'ideas' });

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

      if (user) {
        const { data } = await supabase.from('projects').select('id, title').order('updated_at', {
          ascending: false,
        });
        if (!active) return;
        const rows = (data ?? []) as ProjectSummary[];
        setProjects(rows);
        setProjectId((current) => current ?? rows[0]?.id ?? null);
      }

      await refreshQueue();
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, refreshQueue]);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const { data } = await supabase
        .from('research_categories')
        .select('id, name, system_key')
        .eq('project_id', projectId)
        .eq('archived', false)
        .order('order_key');
      setCategories((data ?? []) as CategorySummary[]);
    })();
  }, [supabase, projectId]);

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
      projectId,
      rawText: content,
      source: dictating ? 'mobile_voice' : 'mobile_text',
      capturedAt: new Date().toISOString(),
      requestedRouting:
        destination.kind === 'research'
          ? { kind: 'research', categoryKey: destination.categoryKey }
          : { kind: destination.kind, categoryKey: null },
      syncedAt: null,
      lastError: null,
      attempts: 0,
    };

    // On the device first, sent second. This order is what makes a capture on a
    // train with no signal safe.
    await enqueue(capture);
    setText('');
    setInterim('');
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
        <h1>Capture</h1>
        <span className="muted">{email}</span>
      </header>

      <div className="notes-pickers">
        <label className="field">
          <span>Project</span>
          <select value={projectId ?? ''} onChange={(event) => setProjectId(event.target.value || null)}>
            <option value="">Unassigned — decide later</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Goes to</span>
          <select
            value={destination.kind === 'research' ? `research:${destination.categoryKey ?? ''}` : destination.kind}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'character') setDestination({ kind: 'character' });
              else if (value === 'beat') setDestination({ kind: 'beat' });
              else setDestination({ kind: 'research', categoryKey: value.split(':')[1] || null });
            }}
          >
            {categories.map((category) => (
              <option key={category.id} value={`research:${category.system_key ?? ''}`}>
                {category.name}
              </option>
            ))}
            <option value="character">A character</option>
            <option value="beat">A scene or beat</option>
          </select>
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
    </div>
  );
}
