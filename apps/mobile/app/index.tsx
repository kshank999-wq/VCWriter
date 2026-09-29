import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/host/session';
import { SignIn } from '../src/screens/SignIn';
import { Projects } from '../src/screens/Projects';
import { Capture } from '../src/screens/Capture';
import { Review } from '../src/screens/Review';
import type { ProjectSummary } from '../src/host/api';
import type { ProjectFormat } from '@vcwriter/domain';
import { styles } from '../src/theme';

/**
 * Where the app opens (addendum 27 §6).
 *
 * **The project list, always** — addendum 09 §2's *project first*, which is
 * the thing that stops a writer talking for a minute into whichever script was
 * open last. The screens are one stack rather than routes because there are
 * four of them and a walk must never be more than one press from stopping.
 */
type Where = 'projects' | 'capture' | 'review';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [where, setWhere] = useState<Where>('projects');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setReady(true);
    })();
    const { data: watch } = supabase().auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      alive = false;
      watch.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.body}>
          <Text style={styles.muted}>Opening…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <SignIn onIn={() => setSignedIn(true)} />
      </SafeAreaView>
    );
  }

  if (where === 'review' && project) {
    return (
      <SafeAreaView style={styles.screen}>
        <Review
          projectId={project.id}
          format={(project.format as ProjectFormat) ?? 'screenplay'}
          onBack={() => setWhere('capture')}
        />
      </SafeAreaView>
    );
  }

  if (where === 'capture' && project) {
    return (
      <SafeAreaView style={styles.screen}>
        <Capture
          project={project}
          onProjects={() => setWhere('projects')}
          onReview={() => setWhere('review')}
          onProjectMade={setProject}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Projects
        chosenId={project?.id ?? null}
        onChoose={(one) => {
          setProject(one);
          setWhere('capture');
        }}
      />
    </SafeAreaView>
  );
}
