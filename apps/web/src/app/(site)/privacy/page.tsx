import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What VC Writer stores, what it never stores, who processes it, and how to take your work and your account away.',
};

/**
 * The privacy policy (addendum 27 §11).
 *
 * Written because the App Store and Google Play both refuse a submission
 * without a policy at a public URL, and there was none — but the reason it
 * reads the way it does is not the stores. **A writer's manuscript is the most
 * private thing this program will ever hold**, and the one question somebody
 * asks before dictating a novel into a phone is *who else can read it*. That
 * question is answered in the second section rather than in a paragraph
 * halfway down, and it is answered in a sentence rather than in a clause with
 * exceptions after it.
 *
 * Every claim here is checkable against the code, which is what makes it worth
 * publishing: the list of processors is the list of keys in `lib/env.ts`, the
 * error report's fields are the schema in `api/telemetry`, *we do not read
 * your work* is row level security plus the fact that no reading in this
 * application takes a manuscript anywhere, and the AI section describes the
 * three routes that exist rather than a general permission to send anything.
 * A policy that says more than the code does is the kind that has to be
 * rewritten the first time anybody checks.
 *
 * The date is the last substantive revision and is typed here rather than
 * rendered from the build, so redeploying the site does not silently claim
 * the policy changed today.
 */
const UPDATED = '30 September 2026';

export default function PrivacyPage() {
  return (
    <>
      <div className="hero hero-compact">
        <h1>Privacy</h1>
        <p>
          What VC Writer stores, what it never stores, who else touches it, and how to take all of it
          away. Last updated {UPDATED}.
        </p>
      </div>

      <div className="prose">
        <h2>What this covers</h2>
        <p>
          VC Writer — the desktop application for Windows and macOS, this website at vc-writer.com,
          the Writers Room, and <strong>VC Writer Notes</strong>, the phone app for iPhone and
          Android. One policy for all of them because they are one product with one account.
        </p>

        <h2>Your writing is yours</h2>
        <p>
          We do not read your manuscripts, research, notes or outlines. We do not sell them, share
          them, or use them to train any model. Nobody at VC Writer opens your project to look at
          it.
        </p>
        <p>
          Your work is stored under your account and readable only by you, and — where you have
          invited them to a Writers Room — by the people you invited, in the roles you gave them.
          That is enforced by the database itself rather than by application code remembering to
          check, which is the difference between a promise and a mechanism.
        </p>
        <p>
          On the desktop, your projects live on your own computer. They reach our servers only when
          you sign in and sync, or when you use the Writers Room, which exists to put your work in
          front of collaborators you chose.
        </p>

        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your account.</strong> Your email address, and a password if you set one.
            Passwords are stored hashed by our authentication provider; we never see one.
          </li>
          <li>
            <strong>Your purchase.</strong> What you bought, when, which platform you chose, and
            your licence key. <strong>We never see your card number.</strong> Payment details go
            straight to Stripe and are never sent to us or stored by us.
          </li>
          <li>
            <strong>Your Notes subscription, if you have one.</strong> Which plan, which shop sold
            it, when it next renews, and the receipt identifier that shop answers questions about it
            by. It is bought inside the app, so <strong>the payment is Apple&rsquo;s or
            Google&rsquo;s</strong> — we never see your card, and we ask them about the subscription
            rather than being told anything about you.
          </li>
          <li>
            <strong>Your work, if you sync it.</strong> Projects, scenes, beats, manuscript text,
            research, characters, outlines, boards, pictures you import, and the captures you
            dictate into the phone app.
          </li>
          <li>
            <strong>Which machines you have activated,</strong> so a licence can cover the number of
            computers it covers. A machine is identified by a value derived on that machine; we do
            not collect hardware serial numbers.
          </li>
          <li>
            <strong>That an email was sent to you,</strong> and which template it was, so support can
            answer <em>did I get the licence email</em>. The body is not stored.
          </li>
          <li>
            <strong>Crash reports, if you turn them on.</strong> Off by default in the desktop
            application. A report carries the application version, the operating system, and the
            error and its stack — with file paths and anything that looks like personal data
            stripped, on the way out and again on the way in. There is no field in it for your
            writing and no column in the table for one.
          </li>
          <li>
            <strong>What an AI feature cost,</strong> if you use one in a Writers Room: the number of
            tokens and the price, so a room can show its own spending. Not what was asked or
            answered.
          </li>
        </ul>

        <h2>What we do not collect</h2>
        <p>
          No advertising identifiers. No analytics or tracking scripts — this site loads none, on any
          page. No third-party trackers, no pixels, no cross-site profiles, no data brokers. No
          location. No contacts, calendar or photo library. Nothing is sold or shared for
          advertising, ever, by anyone.
        </p>

        <h2>VC Writer Notes, on your phone</h2>
        <p>
          The phone app is a voice notebook. It captures a thought; the desktop decides where it
          goes.
        </p>
        <ul>
          <li>
            <strong>The microphone</strong> is used only while you are dictating, and only after you
            press to start. It is never listening in the background.
          </li>
          <li>
            <strong>Speech becomes text on your device</strong> wherever your phone has a speech
            model installed — which is also why a walk without signal works. Where it does not, the
            phone falls back to its own operating system’s speech service (Apple’s or Google’s),
            which is a service of your phone rather than of ours and is governed by their privacy
            policies. Either way, <strong>no audio recording is ever sent to us or stored by us</strong>
            — audio is not saved anywhere, on the phone or off it.
          </li>
          <li>
            <strong>A note is written down on your phone before it is sent,</strong> so nothing is
            lost out of signal. It carries its words, when you said it, which project it is for, and
            the category and group you said. Nothing else.
          </li>
          <li>
            <strong>Which projects you show on that phone</strong> is remembered on that phone alone
            and never leaves it. Hiding a project hides it; it deletes nothing anywhere.
          </li>
          <li>The app collects no analytics and sends no crash reports.</li>
        </ul>

        <h2>AI features</h2>
        <p>
          Some features — a scene reading in the Final Editor, a suggested section summary, suggested
          category names in the Note Sorter — send text to Anthropic’s API to be read. They run only
          when you press the button that runs them.
        </p>
        <p>
          <strong>Only what that feature needs is sent</strong>, and nothing is sent by any feature
          you have not pressed. Anthropic does not train models on data sent through its API. No AI
          feature can rewrite your prose: the responses these features accept have no field that
          could carry replacement text, which is a property of the software rather than an
          undertaking.
        </p>
        <p>
          If you would rather nothing left your machine at all, do not use those features. Every
          other part of VC Writer works without them.
        </p>

        <h2>Who processes it</h2>
        <ul>
          <li>
            <strong>Supabase</strong> — the database, sign-in and file storage, hosted on Amazon Web
            Services.
          </li>
          <li>
            <strong>Vercel</strong> — hosting for this website and its API.
          </li>
          <li>
            <strong>Stripe</strong> — payments. Your card details go to Stripe and never to us.
          </li>
          <li>
            <strong>Resend</strong> — sending the transactional email (your licence, a room
            invitation, a mention addressed to you).
          </li>
          <li>
            <strong>Anthropic</strong> — the AI features above, and only when you use one.
          </li>
          <li>
            <strong>Apple</strong> and <strong>Google</strong> — app distribution, the Notes
            subscription and its billing, and their own speech recognition where your phone falls
            back to it.
          </li>
        </ul>
        <p>
          Each is a processor acting on our instructions. We do not sell or rent your data to anyone,
          and there is no other party it goes to.
        </p>

        <h2>Keeping it, and taking it away</h2>
        <p>
          We keep your account and your synced work for as long as you have an account. Crash reports
          and email delivery records are kept for a year. Order records are kept as long as tax and
          accounting law requires, which is the one thing here that outlives a deletion request.
        </p>
        <p>
          <strong>You can delete your account and everything under it</strong> from{' '}
          <Link href="/account">My account</Link>, from any device, including the phone. Deleting
          takes your projects, your notes, your research and your sign-in with it, permanently and
          without a waiting period. It does not touch the copies on your own computer — those are
          yours and we cannot reach them.
        </p>
        <p>
          You may also ask for a copy of what we hold, or for a correction, by writing to the address
          below. Wherever you live, you are welcome to make the requests the GDPR and the CCPA
          describe; we do not check which of them you are entitled to before answering.
        </p>

        <h2>Children</h2>
        <p>
          VC Writer is not directed at children under 13 and we do not knowingly collect anything
          from one. If you believe a child has an account, write to us and we will remove it.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes in a way that matters, the date at the top changes and anyone with
          an account is emailed. It will not change retroactively about data already collected.
        </p>

        <h2>Asking us something</h2>
        <p>
          Write to <a href="mailto:support@vc-writer.com">support@vc-writer.com</a>. A person reads
          it.
        </p>
      </div>
    </>
  );
}
