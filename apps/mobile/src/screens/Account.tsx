import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { deleteAccount } from '../host/api';
import { signOut, supabase } from '../host/session';
import { styles } from '../theme';

/**
 * The account, on the phone (addendum 27 §12).
 *
 * Three things a store requires an application to be able to do about an
 * account, and until now this app could do none of them: **see which one you
 * are signed into**, **sign out of it**, and **delete it**. They were on the
 * website, which is one device away from wherever somebody is standing when
 * they want any of the three.
 *
 * The deletion is the one that had to be here rather than behind a link.
 * Apple asks for it in the app, and the reason is the same one this project
 * gives everywhere else: **an application that will write your notes to a
 * server and cannot take them off it** is asking to be trusted on somebody
 * else's screen. It presses the same route the website presses.
 *
 * The privacy policy opens in the phone's browser rather than being repeated
 * here, for the reason a second copy is always wrong: one of them would be the
 * older one, and nothing on the screen would say which.
 */
const site = (): string => {
  const said = (Constants.expoConfig?.extra as { site?: string } | undefined)?.site;
  return (process.env['EXPO_PUBLIC_SITE'] ?? said ?? 'https://vc-writer.com').replace(/\/$/, '');
};

export function Account({ onBack }: { onBack(): void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase().auth.getSession();
      if (alive) setEmail(data.session?.user.email ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const remove = async () => {
    setError(null);
    setWorking(true);
    const said = await deleteAccount(typed);
    if (!said.ok) {
      setError(said.error);
      setWorking(false);
      return;
    }
    // The account is gone, so the token in this phone opens nothing; signing
    // out is what puts the app back where a stranger would find it.
    await signOut();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>Account</Text>
      <Text style={styles.text}>{email ?? 'Signed in'}</Text>

      <Pressable
        style={[styles.button, styles.secondary]}
        onPress={() => void Linking.openURL(`${site()}/privacy`)}
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>Privacy policy</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.secondary]} onPress={() => void signOut()}>
        <Text style={[styles.buttonText, styles.secondaryText]}>Sign out</Text>
      </Pressable>

      <View style={{ height: 8 }} />
      <Text style={styles.heading}>Delete this account</Text>
      {/* **What goes is said before the press and not after it**, on both
          sides: it is the only act in this product that cannot be undone. */}
      <Text style={styles.muted}>
        Permanent and immediate. It takes your projects, manuscripts, research, outlines and phone
        notes, along with your licence and your sign-in.
      </Text>
      <Text style={styles.muted}>
        Two things stay. The record that a purchase happened remains, with your name taken off it,
        because accounting law requires it. Anything you contributed to somebody else’s Writers Room
        stays in that room, with your name removed. Files on your own computer are not touched.
      </Text>

      {asking ? (
        <View style={styles.field}>
          <Text style={styles.label}>Type {email ?? 'your email address'} to confirm</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={email ?? 'you@example.com'}
            placeholderTextColor="#6a5f44"
          />
          <Pressable
            style={[styles.button, styles.danger]}
            onPress={() => void remove()}
            disabled={working}
          >
            <Text style={[styles.buttonText, styles.dangerText]}>
              {working ? 'Deleting…' : 'Delete my account'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => {
              setAsking(false);
              setTyped('');
              setError(null);
            }}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>Keep it</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.button, styles.secondary]} onPress={() => setAsking(true)}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Delete this account…</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, styles.secondary]} onPress={onBack}>
        <Text style={[styles.buttonText, styles.secondaryText]}>Back to projects</Text>
      </Pressable>
    </ScrollView>
  );
}
