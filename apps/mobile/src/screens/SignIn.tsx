import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { isConfigured, signIn } from '../host/session';
import { colour, styles } from '../theme';

/**
 * Signing in (addendum 27 §3).
 *
 * **A password and nothing else.** Addendum 09 §14 found that a magic link is
 * bound to the browser that asked for it, so a phone's mail app could not
 * finish one; an app has no browser to come back to at all. *Email me a link*
 * is therefore **absent rather than offered and broken** — this room's oldest
 * rule, and here it is the difference between a way in and a loop.
 *
 * Somebody with no password yet is sent to the website to set one, in a
 * sentence that says where and why, because the alternative is a screen that
 * refuses and does not say what would fix it.
 */
export function SignIn({ onIn }: { onIn(): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConfigured()) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <Text style={styles.heading}>Not set up</Text>
        <Text style={styles.muted}>
          This build was made without the address it signs in to. Set
          EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and build it again.
        </Text>
      </ScrollView>
    );
  }

  const go = async () => {
    setWorking(true);
    setError(null);
    const why = await signIn(email.trim(), password);
    setWorking(false);
    if (why) {
      setError(why);
      return;
    }
    onIn();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>VC Writer Notes</Text>
      <Text style={styles.muted}>Use the address you bought VC Writer with.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colour.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colour.muted}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={() => void go()}
        />
      </View>

      <Pressable style={styles.button} onPress={() => void go()} disabled={working}>
        <Text style={styles.buttonText}>{working ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Said under the form rather than over it: what somebody came to do goes
          first, and why it might not work goes after (addendum 09 §14). */}
      <Text style={styles.muted}>
        No password yet? Set one on your account page at{' '}
        <Text
          style={{ color: colour.gold }}
          onPress={() => void Linking.openURL('https://vc-writer.com/account')}
        >
          vc-writer.com
        </Text>
        , then sign in here. After that you are signed in for good — a notebook that asked for a
        password on a walk is one nobody carries.
      </Text>
    </ScrollView>
  );
}
