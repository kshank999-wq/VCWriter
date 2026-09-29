import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  describePhoneShelf,
  describeShelf,
  emptyShelf,
  formatSpokenName,
  readShelf,
  setOnPhone,
  shelfRows,
  shownOnPhone,
  type PhoneShelf,
  type ProjectFormat,
} from '@vcwriter/domain';
import { listProjects, makeProject, type ProjectSummary } from '../host/api';
import { colour, styles } from '../theme';

/**
 * The project list (addendum 27 §6).
 *
 * **The app opens here, always** — addendum 09 §2's *project first*, which is
 * not an ordering but the thing that stops a writer dictating a minute into
 * whichever script was open last.
 *
 * Which projects show is `capture-shelf.ts`, the same reading the website
 * uses: only what is **off** is written down, so a project started tomorrow is
 * here without being asked, and the choice reaches this device and nothing
 * else because there is no copy of a project on a phone for anything to reach.
 */

/** Where this device remembers what it has been told not to show. */
const SHELF = 'vcwriter-notes-shelf';
const LAST = 'vcwriter-notes-project';

/** Every kind a project can be, in the words a writer hears them said in. */
const FORMATS: ProjectFormat[] = [
  'screenplay',
  'series',
  'novel',
  'short_story',
  'instructional',
  'stage_play',
  'short_form',
  'game',
];

export function Projects({
  chosenId,
  onChoose,
}: {
  chosenId: string | null;
  onChoose(project: ProjectSummary): void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [shelf, setShelf] = useState<PhoneShelf>(emptyShelf());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<ProjectFormat>('screenplay');
  const [making, setMaking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const said = await listProjects();
    setLoading(false);
    if (!said.ok) {
      setError(said.error);
      return;
    }
    setError(null);
    setProjects(said.data);
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        setShelf(readShelf(await AsyncStorage.getItem(SHELF)));
      } catch {
        // A device that cannot read its own storage shows everything, which is
        // the right failure.
      }
    })();
  }, [load]);

  const tick = (projectId: string, on: boolean) => {
    const after = setOnPhone(shelf, projectId, on);
    setShelf(after);
    void AsyncStorage.setItem(SHELF, JSON.stringify(after)).catch(() => undefined);
  };

  const start = async () => {
    const name = title.trim();
    if (name.length === 0 || making) return;
    setMaking(true);
    const said = await makeProject({ title: name, format });
    setMaking(false);
    if (!said.ok) {
      setError(said.error);
      return;
    }
    setNaming(false);
    setTitle('');
    void AsyncStorage.setItem(LAST, said.data.id).catch(() => undefined);
    // Straight into it: somebody who has just named a project wants to talk
    // into it.
    onChoose(said.data);
  };

  if (choosing) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <Text style={styles.heading}>On this phone</Text>
        {shelfRows(shelf, projects).map((row) => (
          <Pressable
            key={row.id}
            style={[styles.row, row.on ? styles.chosen : null]}
            onPress={() => tick(row.id, !row.on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: row.on }}
            accessibilityLabel={`${row.title || 'Untitled'}, ${row.on ? 'on' : 'off'} this phone`}
          >
            <Text style={styles.title}>
              {row.on ? '✓  ' : '     '}
              {row.title || 'Untitled'}
            </Text>
            <Text style={styles.muted}>{formatSpokenName(row.format as ProjectFormat)}</Text>
          </Pressable>
        ))}
        {/* The promise is the domain's, said once: two screens writing
            *nothing is deleted* for themselves is two answers to the one
            question a writer cannot check from a phone. */}
        <Text style={styles.muted}>{describePhoneShelf()}</Text>
        <Pressable style={styles.button} onPress={() => setChoosing(false)}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const showing = shownOnPhone(shelf, projects);
  const off = describeShelf(shelf, projects);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>Projects</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.muted}>Looking…</Text> : null}

      {!loading && projects.length === 0 ? (
        <Text style={styles.muted}>No projects yet. Start one and it will be on your desktop too.</Text>
      ) : null}

      {showing.map((project) => (
        <Pressable
          key={project.id}
          style={[styles.row, project.id === chosenId ? styles.chosen : null]}
          onPress={() => {
            void AsyncStorage.setItem(LAST, project.id).catch(() => undefined);
            onChoose(project);
          }}
        >
          <Text style={styles.title}>{project.title || 'Untitled'}</Text>
          <Text style={styles.muted}>
            {formatSpokenName(project.format as ProjectFormat)}
            {project.id === chosenId ? ' · last used' : ''}
          </Text>
        </Pressable>
      ))}

      {naming ? (
        <View style={[styles.row, { gap: 12 }]}>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Blackout"
              placeholderTextColor={colour.muted}
              autoFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Kind</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {FORMATS.map((one) => (
                <Pressable
                  key={one}
                  onPress={() => setFormat(one)}
                  style={[
                    styles.button,
                    styles.secondary,
                    { paddingVertical: 9, paddingHorizontal: 12 },
                    format === one ? { borderColor: colour.gold } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryText,
                      { fontSize: 12, letterSpacing: 0.4 },
                      format === one ? { color: colour.goldBright } : null,
                    ]}
                  >
                    {formatSpokenName(one)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable style={styles.button} onPress={() => void start()} disabled={making}>
            <Text style={styles.buttonText}>{making ? 'Starting…' : 'Start it'}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => setNaming(false)}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={[styles.button, styles.secondary, { flex: 1 }]} onPress={() => setNaming(true)}>
            <Text style={[styles.buttonText, styles.secondaryText]}>New project</Text>
          </Pressable>
          {projects.length > 0 ? (
            <Pressable
              style={[styles.button, styles.secondary, { flex: 1 }]}
              onPress={() => setChoosing(true)}
            >
              <Text style={[styles.buttonText, styles.secondaryText]}>Which projects</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {off ? <Text style={styles.muted}>{off}</Text> : null}
    </ScrollView>
  );
}
