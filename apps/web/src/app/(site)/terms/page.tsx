import type { Metadata } from 'next';
import Link from 'next/link';
import { DESKTOP_LAPSE_PROMISE, NOTES_PRICE_WORDS, NOTES_PROMISE } from '@vcwriter/domain';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'What you may do with VC Writer, what we undertake, what a licence covers, and what happens to your work if you stop paying.',
};

/**
 * The terms of use (addendum 27 §15).
 *
 * Written because **Apple's guideline 3.1.2 asks a purchase screen to carry a
 * functional link to the terms**, and there was no such page — the privacy
 * policy existed and this did not, which is the straightforward half.
 *
 * The half worth keeping is what a terms page is *for* here. Everything this
 * document is about — what a licence covers, what a lapse reaches, what
 * happens to notes already sent, who may read work in somebody else's room —
 * is a **rule the program already enforces**, written down in the domain and
 * tested. So the page is the same kind of thing the privacy policy is: not an
 * undertaking somebody at VC Writer has to remember, but a description of a
 * mechanism, which is why every clause can be checked against the code.
 *
 * Three of its sentences are therefore **read rather than typed** —
 * `DESKTOP_LAPSE_PROMISE`, `NOTES_PROMISE` and `NOTES_PRICE_WORDS` — for this
 * project's oldest reason: a copy here would be the older one the first time
 * any of them changed, and a terms page is the worst place in the product for
 * a sentence that has stopped being true. Everything the page does **not**
 * name is the same rule from the other end: the desktop price is Stripe's and
 * appears nowhere in this repository, and how many computers a licence covers
 * is stored on the licence, so both are pointed at rather than quoted.
 *
 * The date is the last substantive revision and is typed rather than rendered
 * from the build, so redeploying does not claim the terms changed today.
 */
const UPDATED = '5 October 2026';

export default function TermsPage() {
  return (
    <>
      <div className="hero hero-compact">
        <h1>Terms of Use</h1>
        <p>
          What you may do with VC Writer, what we undertake, and what happens to your work if you
          stop paying. Last updated {UPDATED}.
        </p>
      </div>

      <div className="prose">
        <h2>What this covers</h2>
        <p>
          These terms apply to VC Writer — the desktop application for Windows and macOS, this
          website at vc-writer.com, the Writers Room, and <strong>VC Writer Notes</strong>, the phone
          app for iPhone and Android. One agreement for all of them, because they are one product
          with one account. Using any of them means accepting these terms.
        </p>
        <p>
          How your information is handled is a separate document and the one most people want
          first: <Link href="/privacy">the privacy policy</Link>.
        </p>

        <h2>Your writing is yours</h2>
        <p>
          <strong>You own everything you write.</strong> Your manuscripts, research, outlines,
          characters, boards and notes are yours; we claim no ownership of them and no licence to
          use them. We do not publish them, sell them, share them, or use them to train any model.
          Nothing in these terms gives us a right to your work.
        </p>
        <p>
          What we do is store it where you ask us to, so that it reaches your other machines and the
          collaborators you invited — and nothing else. That is enforced by the database rather than
          by anybody here remembering, which is the difference between a promise and a mechanism.
        </p>

        <h2>The desktop application</h2>
        <p>
          Buying VC Writer gives you a licence to use it. The licence is yours personally, or your
          organisation&rsquo;s where an organisation bought it, and it covers a set number of
          computers — your <Link href="/account">account page</Link> lists the machines it is on and
          lets you free a seat from a computer you no longer have, without asking us.
        </p>
        <p>
          The price and the plan are shown at the checkout before you pay, in your own currency.
          A subscription renews itself at the end of each period until you cancel it.
        </p>
        <p>
          <strong>If a subscription lapses, your work is not taken away.</strong>{' '}
          {DESKTOP_LAPSE_PROMISE} A copy whose subscription has ended goes on opening, printing and
          exporting every project on the machine, indefinitely, with no time limit and no further
          payment. Subscribing again makes it writable straight away.
        </p>
        <p>
          Please do not share your licence key, rent the application out, take it apart to republish
          it, or work round the activation. If a purchase is refunded or charged back, the licence it
          paid for ends — which the software does by itself, the moment the payment processor says
          so.
        </p>

        <h2>VC Writer Notes, on your phone</h2>
        <p>
          Notes is a subscription —{' '}
          <strong>
            {NOTES_PRICE_WORDS.yearly} or {NOTES_PRICE_WORDS.monthly}
          </strong>{' '}
          — bought inside the app because both app stores require it to be. The price you are shown
          in the app is the one your store will charge, in your currency.
        </p>
        <ul>
          <li>
            <strong>It renews itself</strong> at the end of each period unless cancelled at least
            twenty-four hours before. Your store account charges the renewal.
          </li>
          <li>
            <strong>You cancel it there too</strong> — in your Apple ID or Google Play subscription
            settings. We cannot cancel it for you, and the app cannot either.
          </li>
          <li>
            <strong>What the subscription covers</strong> is sending notes from the phone and
            keeping them synced to your account. Reading what you have already sent is never part of
            it.
          </li>
          <li>
            <strong>If it lapses</strong>, what stops is sending new notes, and nothing else.{' '}
            {NOTES_PROMISE}
          </li>
        </ul>
        <p>
          VC Writer for Windows and macOS is a separate purchase. It has carried syncing for your own
          projects since before Notes existed and goes on doing so — a Notes subscription adds to
          what you have and takes nothing away from it.
        </p>

        <h2>Refunds</h2>
        <p>
          <strong>A purchase made in the phone app is Apple&rsquo;s or Google&rsquo;s to refund</strong>,
          not ours — they take the payment and we never see your card, so a refund has to be asked
          for where the money went. Apple&rsquo;s is requested at reportaproblem.apple.com and
          Google&rsquo;s in the Play Store.
        </p>
        <p>
          For anything bought on this website, write to{' '}
          <a href="mailto:support@vc-writer.com">support@vc-writer.com</a> and say what happened. A
          person reads it, and where you are entitled to a refund under the law where you live, you
          will get one.
        </p>

        <h2>The Writers Room</h2>
        <p>
          A room is somebody&rsquo;s project with other people invited into it. If you invite
          collaborators, you are responsible for who you invite and for what they may do with what
          they see. If you are invited, what you contribute stays in that room — including after
          you leave or delete your account, with your name removed, because it is part of somebody
          else&rsquo;s work by then.
        </p>
        <p>
          <strong>One writer&rsquo;s work is never destroyed by another&rsquo;s.</strong> A merge
          adds a version beside the one before it rather than overwriting anything, which is a
          property of the software and not a rule anybody has to follow.
        </p>

        <h2>The AI features</h2>
        <p>
          A few features send text to be read by a model — a scene reading, a suggested summary,
          suggested category names. They run only when you press the button that runs them, only the
          text that feature needs is sent, and <strong>none of them can rewrite your prose</strong>:
          what comes back has no field that could carry replacement text. Nothing suggested is
          applied until you accept it, and what a model suggests is a suggestion rather than a
          statement of fact. If you would rather nothing left your machine, do not use them; the
          rest of the application works without them.
        </p>

        <h2>Using it properly</h2>
        <p>
          Do not use VC Writer to break the law, to infringe somebody else&rsquo;s copyright, or to
          store or distribute material that is illegal where you are. Do not attack the service, try
          to reach another customer&rsquo;s account, or scrape or load the site in a way that
          degrades it for other people. We may suspend an account that does any of these, and we
          will say why.
        </p>

        <h2>What we do not promise</h2>
        <p>
          The software is provided as it is. We work hard on it and we do not promise it is free of
          faults, that the website and sync will never be down, or that it will suit a particular
          purpose you have in mind.
        </p>
        <p>
          <strong>Keep your own backups.</strong> On the desktop your projects are files on your own
          computer and you can copy them anywhere — <em>File ▸ Save a copy…</em> is there for
          exactly this. Sync is a convenience, not an archive, and no software should be the only
          place a manuscript exists.
        </p>
        <p>
          Where something does go wrong, what we owe you is limited to what you have paid us in the
          twelve months before it happened. Nothing here limits anything that cannot be limited
          under the law where you live — including, in many places, liability for death, injury or
          fraud.
        </p>

        <h2>Ending it</h2>
        <p>
          You can stop whenever you like: cancel a subscription in your store or{' '}
          <Link href="/account">account</Link>, and delete the account itself from the same place,
          from any device, including the phone. Deleting is immediate and permanent, and it does not
          touch the copies on your own computer — those are yours and we cannot reach them.
        </p>
        <p>
          We would only end your access for one of the things under <em>Using it properly</em>, or
          if we stopped selling the product — in which case anyone with a licence would be told, and
          a desktop copy already activated would go on opening your work.
        </p>

        <h2>If you got the app from the App Store</h2>
        <p>
          Apple&rsquo;s{' '}
          <a
            href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            rel="noreferrer"
            target="_blank"
          >
            Licensed Application End User License Agreement
          </a>{' '}
          also applies to VC Writer Notes obtained from the App Store, and where it says something
          different from this page about that app, Apple&rsquo;s wording governs. Apple is not a
          party to this agreement and has no obligation to support the app; anything you need is
          ours to answer, at the address below.
        </p>

        <h2>Changes</h2>
        <p>
          If these terms change in a way that matters, the date at the top changes and anyone with an
          account is emailed. A change does not apply retroactively to a purchase already made.
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
