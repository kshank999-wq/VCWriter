import type { Metadata } from 'next';
import Link from 'next/link';
import { NOTES_PRICE_WORDS } from '@vcwriter/domain';

export const metadata: Metadata = {
  title: 'VC Writer Notes',
  description:
    'A voice notebook for the walk, the train and the queue. Dictate a thought, say what kind it is, and find it waiting at your desk — divided, attributed and ready to file.',
};

/**
 * What Notes is, and where to get it (addendum 27 §14.5).
 *
 * `/notes` was the capture app itself. It is the **page of the website** now —
 * Ken's *an advertising and referral site where you can see the feature value* —
 * and the app has moved to `/notes/app`, which is where the manifest, the
 * service worker and every home-screen copy now point.
 *
 * Two decisions shape it. **A page of the site rather than a state of the app**:
 * the nav has linked *Notes* since the app was built and dropped a visitor into
 * a chrome-less screen with no way back, so this wears the header and the footer
 * and has a hero, a description and somewhere to go — which is also what makes
 * it indexable, a referral page nobody can find being no referral at all. And
 * **a store link that does not exist is absent rather than dead**: the apps are
 * not submitted yet, so the badges appear when `NEXT_PUBLIC_APP_STORE_URL` and
 * `NEXT_PUBLIC_PLAY_STORE_URL` are set and until then the page says so plainly.
 * A link to a store page that 404s is worse than a sentence.
 */

const WHAT_IT_DOES = [
  {
    title: 'Hands free, on a walk',
    body: 'Say “Project Jinn, character, Tom” and it beeps and starts a note. Say “dictate done” and it files itself and waits for the next one. Every command is prefixed, so a note can contain the words done, idea, character and project freely.',
  },
  {
    title: 'It knows what kind of thought it was',
    body: 'Character, plot point, idea, theme, arc, dialogue, a scene, a chapter — the words follow the project’s own format, so a screenplay hears Scene and Beat where a textbook hears Section and Subsection.',
  },
  {
    title: 'A walk arrives already divided',
    body: 'Say a group once — “dictate group casting” — and it sticks until you change it. Six thoughts under one heading, and the desk opens on them grouped rather than in one pile.',
  },
  {
    title: 'Nothing is lost when the signal goes',
    body: 'Every note is written to the phone before it is sent, and sent one at a time as it closes. Out of range, they wait — written down, visible, and gone the moment there is a bar of signal.',
  },
  {
    title: 'The desk places, the phone captures',
    body: 'Nothing is filed into your manuscript by a phone. At the desk each note is a card you drag into a folder, a character, the Outliner or the Story Sculptor — or correct on the way past.',
  },
  {
    title: 'It reads back what it heard',
    body: 'Two tones told apart by direction, not pitch, because a walk is not a quiet room — and Read it back speaks the note exactly as it stands before you let it go.',
  },
];

export default function NotesPage() {
  const appStore = process.env['NEXT_PUBLIC_APP_STORE_URL'] ?? '';
  const playStore = process.env['NEXT_PUBLIC_PLAY_STORE_URL'] ?? '';
  const shipped = appStore.length > 0 || playStore.length > 0;

  return (
    <>
      <div className="hero hero-compact">
        <h1>
          VC Writer Notes — <em>catch it before it goes.</em>
        </h1>
        <p>
          A voice notebook for the walk, the train and the queue. Dictate a thought, say what kind it is, and
          find it waiting at your desk — divided, attributed and ready to file into the project it belongs to.
        </p>
        <p className="lede">
          {NOTES_PRICE_WORDS.yearly} or {NOTES_PRICE_WORDS.monthly}, on iPhone and Android. It includes syncing
          your notes to VC Writer on your desktop.
        </p>
        {shipped ? (
          <p style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {appStore ? (
              <a href={appStore} className="button">
                Get it on the App Store
              </a>
            ) : null}
            {playStore ? (
              <a href={playStore} className={appStore ? 'button secondary' : 'button'}>
                Get it on Google Play
              </a>
            ) : null}
          </p>
        ) : (
          <p className="notice">
            Notes is in review with Apple and Google. The moment it is on both stores the links appear here — and
            if you already subscribe, it runs in this browser today.
          </p>
        )}
      </div>

      <section>
        <h2>What it does</h2>
        <p className="lede">Built for the half hour when you are nowhere near the desk.</p>
        <div className="grid">
          {WHAT_IT_DOES.map((one) => (
            <article key={one.title} className="card">
              <h3>{one.title}</h3>
              <p>{one.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>What the subscription covers</h2>
        <p className="lede">
          The app on every phone you own, and the syncing that carries a note from the pavement to the project.
        </p>
        <p>
          It is bought in the app, through the App Store or Google Play, and managed there — {' '}
          {NOTES_PRICE_WORDS.yearly} or {NOTES_PRICE_WORDS.monthly}.{' '}
          <strong>VC Writer itself is a separate, one-off purchase</strong> and is not affected by this: the
          desktop application keeps working offline, with or without a Notes subscription.
        </p>
        <p>
          And if a subscription ever ends, <strong>nothing you have already captured is touched</strong>. Every
          note you have sent stays readable, and anything already filed into a project is part of the project.
          What stops is sending new ones.
        </p>
        {/* Which of these is the filled button depends on whether the app has
            shipped: until it has, opening it in a browser is the only thing a
            reader can actually do today, and a page whose every button is
            outlined offers nobody a way in. Once the badges are up there, they
            are the way in and this steps back. */}
        <p style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/notes/app" className={shipped ? 'button secondary' : 'button'}>
            Open Notes in this browser
          </Link>
          <Link href="/download" className="button secondary">
            About VC Writer
          </Link>
        </p>
      </section>
    </>
  );
}
