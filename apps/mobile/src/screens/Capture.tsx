import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  applyCorrection,
  captureKeyName,
  captureVocabulary,
  emptySitting,
  everything,
  hear,
  hearPause,
  startGuided,
  projectFailed,
  projectMade,
  projectNamed,
  readSpoken,
  sayBack,
  type CaptureKey,
  type ProjectFormat,
  type Sitting,
} from '@vcwriter/domain';
import { makeProject, type ProjectSummary } from '../host/api';
import { file as fileNote, newClientCaptureId, pendingCaptures } from '../host/queue';
import { canHear, mayHear, readyToSpeak, startDictation, type DictationSession } from '../host/listen';
import { beep, hush, readAloud } from '../host/say';
import { colour, styles } from '../theme';

/**
 * Catching a thought (addendum 27 §7).
 *
 * **Every rule on this screen is the domain's**, which is the whole reason a
 * native app was two days' work rather than two months'. `hear` folds an
 * utterance into the walk, `readSpoken` reads one for the typed screen,
 * `captureVocabulary` says what may be said at this project, `speakBack` says
 * what to answer aloud — the same functions, the same tests, the same
 * behaviour as vc-writer.com. This file hears, speaks, draws and files, and
 * decides nothing.
 *
 * Addendum 09 §13's lesson is kept structurally: **`file` writes the note down
 * and sends it**, so there is no way to do half of it here the way the web app
 * once did.
 */
export function Capture({
  project,
  onProjects,
  onReview,
  onProjectMade,
  onSubscribe,
}: {
  project: ProjectSummary;
  onProjects(): void;
  onReview(): void;
  onProjectMade(made: ProjectSummary): void;
  /**
   * Offered only where the subscription will not let a note be sent (addendum
   * 27 §14.6). **Capture is never blocked**: the note is written to this phone
   * whatever the subscription says, because a notebook that refuses a thought
   * loses it. What is said is that it is waiting rather than gone.
   */
  onSubscribe?: (() => void) | undefined;
}) {
  const format = (project.format as ProjectFormat) ?? 'screenplay';
  const vocabulary = captureVocabulary(format);

  /** Typed capture. */
  const [category, setCategory] = useState<CaptureKey>('idea');
  const [subjectName, setSubjectName] = useState('');
  const [text, setTextState] = useState('');
  /**
   * The words as they are **now**, for whatever runs after an await: a stop
   * commits the last dictated words through a callback, and Save and Read it
   * back read them in the same breath, before any render would hand them a
   * fresh `text`.
   */
  const textRef = useRef('');
  /** Set when typing took over a dictation: its last words are in the box already. */
  const typedOver = useRef(false);
  const setText = (next: string | ((current: string) => string)) => {
    textRef.current = typeof next === 'function' ? next(textRef.current) : next;
    setTextState(textRef.current);
  };
  const [interim, setInterim] = useState('');
  const [heard, setHeard] = useState<string | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /**
   * **Where the last Save got to**, drawn on the button itself (addendum 27
   * §18, from Ken: *it needs to change color or do something to let you know
   * it's saving. I'm not sure if it is saving or not*). The sentence used to
   * be at the foot of the screen, under the keyboard.
   */
  const [saving, setSaving] = useState<'idle' | 'saving' | 'sent' | 'waiting' | 'failed'>('idle');
  /** Notes on this phone that have not gone, and why the last one did not. */
  const [waiting, setWaiting] = useState<{ count: number; why: string | null }>({ count: 0, why: null });
  const countWaiting = async () => {
    try {
      const left = await pendingCaptures();
      setWaiting({ count: left.length, why: left.find((one) => one.lastError)?.lastError ?? null });
    } catch {
      // The count is a courtesy; a phone that cannot read its queue still saves.
    }
  };

  /** The walk. */
  const [handsFree, setHandsFree] = useState(false);
  const [listening, setListening] = useState(false);
  const [sitting, setSitting] = useState<Sitting>(emptySitting());
  const walk = useRef<Sitting>(emptySitting());
  const session = useRef<DictationSession | null>(null);
  const [hearable, setHearable] = useState<boolean | null>(null);

  /**
   * The project in hand, read from a **ref** wherever the recogniser reads it.
   *
   * A callback from the microphone runs outside a render, where the ref is the
   * one that is current and the closed-over state is whatever it was when the
   * sitting began — which on a walk is a project the writer may have changed
   * out loud since.
   */
  const chosen = useRef<ProjectSummary>(project);
  useEffect(() => {
    chosen.current = project;
  }, [project]);
  const formatNow = (): ProjectFormat => (chosen.current.format as ProjectFormat) ?? 'screenplay';

  useEffect(() => {
    void countWaiting();
    void canHear().then(setHearable);
    return () => {
      session.current?.stop();
      hush();
    };
  }, []);

  const picked = vocabulary.find((one) => one.key === category);
  const chosenKey: CaptureKey = picked?.key ?? 'idea';
  const takesName = picked?.takesName ?? false;

  // ------------------------------------------------------------- filing

  const put = async (note: {
    key: string | null;
    subjectName: string | null;
    text: string;
    group?: string | null;
    spoken: boolean;
  }): Promise<'sent' | 'waiting' | 'failed'> => {
    const words = note.text.trim();
    if (words.length === 0 && !note.subjectName) return 'failed';
    let why: string | null;
    try {
      why = await fileNote({
        clientCaptureId: newClientCaptureId(),
        projectId: chosen.current.id,
        rawText: words,
        source: note.spoken ? 'mobile_voice' : 'mobile_text',
        capturedAt: new Date().toISOString(),
        category: note.key,
        subjectName: note.subjectName,
        subcategory: note.group ?? null,
        syncedAt: null,
        lastError: null,
        attempts: 0,
      });
    } catch (error) {
      // Not even written to the phone: said, rather than a press that did nothing.
      setStatus(`Could not save on this phone: ${error instanceof Error ? error.message : String(error)}`);
      void countWaiting();
      return 'failed';
    }
    // **The reason, when it did not go** (addendum 27 §17). This said *it will
    // go when there is signal* whatever the reason was, and the reason on
    // Ken's phone was the server refusing a note — so *Save it* looked like it
    // worked and nothing ever arrived.
    setStatus(why ? `Saved on this phone, not sent yet: ${why}` : 'Saved and sent');
    void countWaiting();
    return why ? 'waiting' : 'sent';
  };

  /** Stop listening and wait for the last words to be committed. */
  const stopListening = async () => {
    const was = session.current;
    session.current = null;
    if (was) await was.stop();
    setListening(false);
  };

  const save = async () => {
    if (saving === 'saving') return;
    setSaving('saving');
    // **Stopped first**, so the dictated words are committed before they are
    // read: an iPhone holds them provisional until then, and Save used to
    // find the box empty and do nothing at all.
    await stopListening();
    const words = textRef.current.trim();
    if (words.length === 0 && !subjectName.trim()) {
      setStatus('Nothing to save yet. Dictate or type the note first.');
      setSaving('failed');
      return;
    }
    const went = await put({
      key: chosenKey,
      subjectName: subjectName.trim() || null,
      text: words,
      spoken: false,
    });
    setSaving(went);
    if (went === 'failed') return;
    setTimeout(() => setSaving((now) => (now === went ? 'idle' : now)), 4000);
    setText('');
    setInterim('');
    // The name goes with the note; the category stays, because somebody
    // catching three thoughts about one person should say it once.
    setSubjectName('');
    setUndone(null);
    setHeard(null);
  };

  /**
   * Read the note back: listening stopped and its words committed first, the
   * phone switched from recording to playback, and a sentence where there is
   * nothing yet rather than a press that does nothing.
   */
  const readBack = async () => {
    await stopListening();
    const words = textRef.current.trim();
    if (words.length === 0 && !subjectName.trim()) {
      setStatus('Nothing to read back yet. Dictate or type the note first.');
      return;
    }
    readyToSpeak();
    readAloud(sayBack({ category: chosenKey, subjectName: subjectName.trim() || null, text: words }, format), setStatus);
  };

  // ------------------------------------------------- one utterance, typed

  const heardTyped = (chunk: string) => {
    const command = readSpoken(chunk, formatNow());
    if (command.kind === 'category') {
      setCategory(command.category);
      if (command.subjectName) setSubjectName(command.subjectName);
      const said = captureKeyName(command.category, formatNow());
      setHeard(command.subjectName ? `${said} — ${command.subjectName}` : said);
      if (command.text.length > 0) append(command.text);
      return;
    }
    if (command.kind === 'correction') {
      const after = applyCorrection(textRef.current, command.text);
      setUndone(after.previous);
      setText(after.text);
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

  // ------------------------------------------------------ one turn of a walk

  /** The few seconds of quiet that ask *are you done* (addendum 27 §18). */
  const PAUSE_MS = 3500;
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const clearPause = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };

  /**
   * Answer out loud **without hearing the answer** (addendum 27 §17–18). The
   * phone's own questions came back as words in Ken's note, so listening is
   * paused outright while it speaks, and resumed a moment after.
   */
  const speakOnWalk = (words: string) => {
    clearPause();
    session.current?.pause();
    setSpeaking(true);
    readAloud(words, setStatus, () => {
      setTimeout(() => {
        setSpeaking(false);
        session.current?.resume();
      }, 350);
    });
  };

  /** Somebody is talking: the question waits until they stop for a few seconds. */
  const heardSomething = () => {
    clearPause();
    if (walk.current.ask !== 'body') return;
    pauseTimer.current = setTimeout(() => {
      const after = hearPause(walk.current);
      walk.current = after;
      setSitting(after);
      if (after.speak) speakOnWalk(after.speak);
    }, PAUSE_MS);
  };

  const heardHandsFree = (chunk: string) => {
    const before = walk.current;
    const after = hear(before, chunk, formatNow());
    walk.current = after;
    setSitting(after);

    // Every note this phrase closed goes to the phone **and is sent** at once
    // (addendum 09 §13).
    for (const done of after.filed.slice(before.filed.length)) void put({ ...done, key: done.key, spoken: true });

    if (after.opened) beep('open');

    if (after.wants) {
      const found = projectNamed(after.wants, [{ id: chosen.current.id, name: chosen.current.title }]);
      speakOnWalk(found ? `${chosen.current.title}.` : `No project called ${after.wants}.`);
      return;
    }
    if (after.speak) speakOnWalk(after.speak);
    else heardSomething();

    if (after.makes) void startProject(after.makes);
  };

  const startProject = async (plan: { name: string; format: ProjectFormat }) => {
    const said = await makeProject({ title: plan.name, format: plan.format });
    if (!said.ok) {
      // A failure **keeps the plan**, so a retry is one word.
      walk.current = projectFailed(walk.current, plan, said.error);
      setSitting(walk.current);
      speakOnWalk(said.error);
      return;
    }
    walk.current = projectMade(walk.current, plan);
    setSitting(walk.current);
    chosen.current = said.data;
    onProjectMade(said.data);
    speakOnWalk(`${said.data.title}. Ready.`);
  };

  const toggleWalk = async () => {
    if (handsFree) {
      clearPause();
      hush();
      // The last words heard are filed with the rest, not dropped at the stop.
      await stopListening();
      setHandsFree(false);
      setSpeaking(false);
      // Whatever was still open is kept: a notebook that only kept what you
      // remembered to close is one you stop trusting after the first walk.
      const left = everything(walk.current);
      for (const open of left.slice(walk.current.filed.length)) void put({ ...open, spoken: true });
      walk.current = emptySitting();
      setSitting(emptySitting());
      setStatus(left.length === 1 ? '1 note saved' : `${left.length} notes saved`);
      return;
    }

    if (!(await mayHear())) {
      setStatus('VC Writer Notes needs the microphone and speech to hear you.');
      return;
    }
    // **A walk that asks** (addendum 27 §18): the first question is the kind.
    walk.current = startGuided(formatNow());
    setSitting(walk.current);
    session.current = startDictation(
      {
        onFinal: (chunk) => {
          setInterim('');
          heardHandsFree(chunk);
        },
        onInterim: (guess) => {
          setInterim(guess);
          if (guess) heardSomething();
        },
        onError: (message) => {
          clearPause();
          setStatus(message);
          setHandsFree(false);
          setListening(false);
        },
        onEnd: () => {
          setInterim('');
          setListening(false);
        },
      },
      // A phrase that has stopped changing is what was said.
      { commitAfterMs: 1500 },
    );
    setHandsFree(true);
    setListening(true);
    setStatus(null);
    if (walk.current.speak) speakOnWalk(walk.current.speak);
  };

  const toggleDictation = async () => {
    if (listening) {
      await stopListening();
      return;
    }
    if (!(await mayHear())) {
      setStatus('VC Writer Notes needs the microphone and speech to hear you.');
      return;
    }
    typedOver.current = false;
    session.current = startDictation({
      onFinal: (chunk) => {
        setInterim('');
        if (typedOver.current) return;
        heardTyped(chunk);
      },
      onInterim: setInterim,
      onError: (message) => {
        setStatus(message);
        setListening(false);
      },
      onEnd: () => {
        setInterim('');
        setListening(false);
      },
    });
    setListening(true);
  };

  // ------------------------------------------------------------- the screen

  if (handsFree) {
    const open = sitting.open;
    const asking =
      sitting.ask === 'kind'
        ? 'What kind of note is it?'
        : sitting.ask === 'title'
          ? 'What is the title?'
          : sitting.ask === 'confirm'
            ? 'Are you done, or would you like to continue?'
            : 'What would you like to put in this note?';
    return (
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Text style={styles.muted} numberOfLines={1}>
            {project.title}
          </Text>
          <Text style={[styles.muted, { color: speaking ? colour.gold : listening ? colour.live : colour.muted }]}>
            {speaking ? '◆ Speaking' : listening ? '● Listening' : 'Paused'}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {/* The question in hand, large: it is what the walk is waiting for
              (addendum 27 §18). */}
          <Text style={[styles.title, { fontSize: 24, color: colour.goldBright }]}>{asking}</Text>
          {sitting.ask === 'kind' ? (
            <Text style={styles.muted}>{vocabulary.map((one) => one.name).join(' · ')} · or “just a note”</Text>
          ) : null}
          {sitting.ask === 'title' ? <Text style={styles.muted}>Or say “skip” for no title.</Text> : null}
          {sitting.ask === 'confirm' ? (
            <Text style={styles.muted}>Say “save”, “continue”, “read it back”, “start over” or “throw it away”.</Text>
          ) : null}

          {open ? (
            <View style={{ gap: 6, borderTopWidth: 1, borderColor: colour.border, paddingTop: 12 }}>
              <Text style={styles.label}>{open.key ? captureKeyName(open.key, formatNow()) : 'Note'}</Text>
              <Text style={[styles.title, { fontSize: 20 }]}>
                {open.subjectName ?? (sitting.ask === 'title' ? (interim || '…') : 'No title')}
              </Text>
              <Text style={styles.text}>
                {open.text}
                {interim && sitting.ask !== 'title' ? <Text style={{ color: colour.muted }}> {interim}</Text> : null}
              </Text>
            </View>
          ) : interim ? (
            <Text style={[styles.text, { color: colour.muted }]}>{interim}</Text>
          ) : null}

          {sitting.filed.length > 0 ? (
            <Text style={styles.muted}>
              {sitting.filed.length} note{sitting.filed.length === 1 ? '' : 's'} saved so far
            </Text>
          ) : null}
          {status ? <Text style={styles.muted}>{status}</Text> : null}
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Pressable style={[styles.button, { backgroundColor: colour.live }]} onPress={() => void toggleWalk()}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Stop the note</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable onPress={onProjects}>
          <Text style={{ color: colour.gold, fontSize: 15 }}>‹ Projects</Text>
        </Pressable>
        <Text style={styles.muted} numberOfLines={1}>
          {project.title}
        </Text>
        <Pressable onPress={onReview}>
          <Text style={{ color: colour.gold, fontSize: 15 }}>Review</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {onSubscribe ? (
          <Pressable onPress={onSubscribe} style={styles.row}>
            <Text style={[styles.muted, { flex: 1 }]}>
              Notes are being kept on this phone and not sent. Subscribe and they all go at once.
            </Text>
          </Pressable>
        ) : null}
        <Text style={[styles.heading, { fontSize: 22 }]}>
          {captureKeyName(chosenKey, format)}
          {subjectName.trim() ? ` · ${subjectName.trim()}` : ''}
        </Text>
        {heard ? <Text style={styles.muted}>Heard: {heard}</Text> : null}

        <View style={styles.field}>
          <Text style={styles.label}>This is a</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {vocabulary.map((one) => (
              <Pressable
                key={one.key}
                onPress={() => setCategory(one.key)}
                style={[
                  styles.button,
                  styles.secondary,
                  { paddingVertical: 9, paddingHorizontal: 12 },
                  chosenKey === one.key ? { borderColor: colour.gold } : null,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    styles.secondaryText,
                    { fontSize: 12, letterSpacing: 0.4 },
                    chosenKey === one.key ? { color: colour.goldBright } : null,
                  ]}
                >
                  {one.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{takesName ? 'Who' : 'About'}</Text>
          <TextInput
            style={styles.input}
            value={subjectName}
            onChangeText={setSubjectName}
            placeholder={takesName ? 'MARA' : 'Optional'}
            placeholderTextColor={colour.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <TextInput
          style={[styles.input, { minHeight: 180, textAlignVertical: 'top', paddingTop: 12 }]}
          value={interim.length > 0 ? `${text}${text.length > 0 ? ' ' : ''}${interim}` : text}
          onChangeText={(typed) => {
            // **Typing ends the dictation it is typed over**, and what is in
            // the box is what is kept — the guess included — once. The box used
            // to show the words plus the recogniser's guess, and every key
            // pressed wrote both back as the words with the guess drawn on the
            // end again: Ken's backspace that kept writing *erase all*.
            if (interim.length > 0 || listening) {
              typedOver.current = true;
              const was = session.current;
              session.current = null;
              setListening(false);
              setInterim('');
              void was?.stop();
            }
            setText(typed);
          }}
          placeholder="What just occurred to you?"
          placeholderTextColor={colour.muted}
          multiline
        />

        {undone ? (
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => {
              setText(undone);
              setUndone(null);
            }}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Put the old wording back</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.button,
            saving === 'saving' ? { opacity: 0.6 } : null,
            saving === 'sent' ? { backgroundColor: colour.sent, borderColor: colour.sent } : null,
            saving === 'waiting' || saving === 'failed' ? { backgroundColor: colour.red, borderColor: colour.red } : null,
          ]}
          onPress={() => void save()}
          disabled={saving === 'saving'}
          accessibilityState={{ busy: saving === 'saving' }}
        >
          <Text
            style={[
              styles.buttonText,
              saving === 'sent' || saving === 'waiting' || saving === 'failed' ? { color: '#fff' } : null,
            ]}
          >
            {saving === 'saving'
              ? 'Saving…'
              : saving === 'sent'
                ? '✓ Saved and sent'
                : saving === 'waiting'
                  ? 'Saved on this phone — not sent'
                  : saving === 'failed'
                    ? 'Not saved'
                    : 'Save it'}
          </Text>
        </Pressable>
        {/* Why, right under the button rather than at the foot of the screen. */}
        {status && saving !== 'idle' ? <Text style={styles.muted}>{status}</Text> : null}
        {waiting.count > 0 ? (
          <Text style={styles.muted}>
            {waiting.count} note{waiting.count === 1 ? '' : 's'} waiting on this phone
            {waiting.why ? ` — last try: ${waiting.why}` : ''}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* **Absent rather than greyed** where the phone cannot hear for
              itself: a disabled Dictate is a control that can only refuse
              (addendum 09 §8a). */}
          {hearable !== false ? (
            <Pressable
              style={[
                styles.button,
                styles.secondary,
                { flex: 1 },
                listening ? { borderColor: colour.live } : null,
              ]}
              onPress={() => void toggleDictation()}
              accessibilityRole="button"
              accessibilityState={{ selected: listening }}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.secondaryText,
                  listening ? { color: colour.live } : null,
                ]}
              >
                {listening ? '● Listening' : '🎙 Dictate'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.button, styles.secondary, { flex: 1 }]}
            onPress={() => void readBack()}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Read it back</Text>
          </Pressable>
        </View>

        {hearable !== false ? (
          <Pressable style={[styles.button, styles.secondary]} onPress={() => void toggleWalk()}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Hands free</Text>
          </Pressable>
        ) : null}

        {status ? <Text style={styles.muted}>{status}</Text> : null}
      </ScrollView>
    </View>
  );
}
