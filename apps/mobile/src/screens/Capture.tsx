import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  applyCorrection,
  captureKeyName,
  captureVocabulary,
  emptySitting,
  everything,
  hear,
  projectFailed,
  projectMade,
  projectNamed,
  readSpoken,
  sayBack,
  speakBack,
  WAKE,
  type CaptureKey,
  type ProjectFormat,
  type Sitting,
} from '@vcwriter/domain';
import { makeProject, type ProjectSummary } from '../host/api';
import { file as fileNote, newClientCaptureId } from '../host/queue';
import { canHear, mayHear, startDictation, type DictationSession } from '../host/listen';
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
}: {
  project: ProjectSummary;
  onProjects(): void;
  onReview(): void;
  onProjectMade(made: ProjectSummary): void;
}) {
  const format = (project.format as ProjectFormat) ?? 'screenplay';
  const vocabulary = captureVocabulary(format);

  /** Typed capture. */
  const [category, setCategory] = useState<CaptureKey>('idea');
  const [subjectName, setSubjectName] = useState('');
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [heard, setHeard] = useState<string | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
  }) => {
    const words = note.text.trim();
    if (words.length === 0 && !note.subjectName) return;
    const why = await fileNote({
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
    setStatus(why ? `Saved on this phone — it will go when there is signal` : 'Saved');
  };

  const save = async () => {
    const words = text.trim();
    if (words.length === 0) return;
    session.current?.stop();
    await put({
      key: chosenKey,
      subjectName: subjectName.trim() || null,
      text: words,
      spoken: false,
    });
    setText('');
    setInterim('');
    // The name goes with the note; the category stays, because somebody
    // catching three thoughts about one person should say it once.
    setSubjectName('');
    setUndone(null);
    setHeard(null);
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
      setText((current) => {
        const after = applyCorrection(current, command.text);
        setUndone(after.previous);
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

  // ------------------------------------------------------ one turn of a walk

  const heardHandsFree = (chunk: string) => {
    const before = walk.current;
    const after = hear(before, chunk, formatNow());
    walk.current = after;
    setSitting(after);

    // A note that just closed goes to the device **and is sent** at once: a
    // walk that pushed everything at the end would lose the lot to a dropped
    // connection (addendum 09 §13).
    if (after.filed.length > before.filed.length) {
      const done = after.filed[after.filed.length - 1];
      if (done) void put({ ...done, key: done.key, spoken: true });
    }

    if (after.opened) beep('open');
    else if (after.open === null && before.open !== null) beep('close');

    if (after.wants) {
      const found = projectNamed(after.wants, [{ id: chosen.current.id, name: chosen.current.title }]);
      readAloud(found ? `${chosen.current.title}.` : `No project called ${after.wants}.`, setStatus);
      return;
    }

    const spoken = speakBack(before, after);
    if (spoken) readAloud(spoken, setStatus);

    // Said *after* the read-back, so *Making Blackout…* is heard before the
    // answer to it.
    if (after.makes) void startProject(after.makes);
  };

  const startProject = async (plan: { name: string; format: ProjectFormat }) => {
    const said = await makeProject({ title: plan.name, format: plan.format });
    if (!said.ok) {
      // A failure **keeps the plan**, so a retry is one word.
      walk.current = projectFailed(walk.current, plan, said.error);
      setSitting(walk.current);
      readAloud(said.error, setStatus);
      return;
    }
    walk.current = projectMade(walk.current, plan);
    setSitting(walk.current);
    chosen.current = said.data;
    onProjectMade(said.data);
    readAloud(`${said.data.title}. Ready.`, setStatus);
  };

  const toggleWalk = async () => {
    if (handsFree) {
      session.current?.stop();
      session.current = null;
      setHandsFree(false);
      setListening(false);
      // Whatever was still open is kept: a notebook that only kept what you
      // remembered to close is one you stop trusting after the first walk.
      const left = everything(walk.current);
      const open = walk.current.open;
      if (open && left.includes(open)) void put({ ...open, spoken: true });
      walk.current = emptySitting();
      setSitting(emptySitting());
      setStatus(left.length === 1 ? '1 note from that walk' : `${left.length} notes from that walk`);
      return;
    }

    if (!(await mayHear())) {
      setStatus('VC Writer Notes needs the microphone and speech to hear you.');
      return;
    }
    session.current = startDictation({
      onFinal: heardHandsFree,
      onInterim: setInterim,
      onError: (message) => {
        setStatus(message);
        setHandsFree(false);
        setListening(false);
      },
      onEnd: () => {
        setInterim('');
        setListening(false);
      },
    });
    setHandsFree(true);
    setListening(true);
    setStatus(null);
  };

  const toggleDictation = async () => {
    if (listening) {
      session.current?.stop();
      session.current = null;
      setListening(false);
      return;
    }
    if (!(await mayHear())) {
      setStatus('VC Writer Notes needs the microphone and speech to hear you.');
      return;
    }
    session.current = startDictation({
      onFinal: heardTyped,
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
    return (
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Text style={styles.muted}>{project.title}</Text>
          {sitting.group ? <Text style={styles.muted}>Group: {sitting.group}</Text> : null}
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.heading, listening ? { color: colour.live } : null]}>
            {listening ? '● Listening' : 'Paused'}
          </Text>

          <Text style={[styles.title, { fontSize: 22 }]}>
            {open ? captureKeyName(open.key ?? 'idea', formatNow()) : 'Between notes'}
            {open?.subjectName ? ` · ${open.subjectName}` : ''}
          </Text>

          {/* The writing, large, because it is the one thing a glance has to
              confirm. */}
          <Text style={styles.text}>
            {open?.text ?? ''}
            {interim ? <Text style={{ color: colour.muted }}> {interim}</Text> : null}
          </Text>

          {sitting.said ? <Text style={styles.muted}>{sitting.said}</Text> : null}

          {everything(sitting).length > 0 ? (
            <Text style={styles.muted}>
              {everything(sitting).length} note{everything(sitting).length === 1 ? '' : 's'} so far
            </Text>
          ) : null}

          <Text style={styles.muted}>
            Say “{WAKE} done” to close a note, “{WAKE} group …” to put the next ones together, or a
            kind — {vocabulary.slice(0, 4).map((one) => one.name.toLowerCase()).join(', ')} — to start
            one.
          </Text>
        </ScrollView>

        <View style={{ padding: 20 }}>
          <Pressable
            style={[styles.button, { backgroundColor: colour.live }]}
            onPress={() => void toggleWalk()}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>Stop the walk</Text>
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
          onChangeText={setText}
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

        <Pressable style={styles.button} onPress={() => void save()}>
          <Text style={styles.buttonText}>Save it</Text>
        </Pressable>

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
            onPress={() =>
              readAloud(
                sayBack({ category: chosenKey, subjectName: subjectName.trim() || null, text }, format),
                setStatus,
              )
            }
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
