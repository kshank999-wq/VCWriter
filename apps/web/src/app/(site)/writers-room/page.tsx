import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Writers Room',
  description:
    'Write together without losing anyone’s work. Each writer works privately and submits what they choose; the showrunner compares, curates and assembles the master script, with every contribution attributed.',
  alternates: { canonical: '/writers-room' },
};

/**
 * The Writers Room, promoted (addendum 35 §14.12). Every claim is one the
 * Writers Room addendum (07) records as built. The room is still being
 * finished and seat billing is not live, so the page says so rather than
 * selling it: there is no price and no buy button for the room here.
 */

const RULES = [
  {
    title: 'Nobody’s work is ever destroyed',
    body: 'Each writer works on a private branch and submits what they choose. Combining work makes a new version of the master; it never rewrites the contribution it came from. Rejected and unused material stays recoverable.',
  },
  {
    title: 'Every writer gets the whole program',
    body: 'Not a comment box or a cut-down editor: the script, the plot tracks, Research, the Story Sculptor and the Outliner, on a project that lives in the cloud. The difference is where the project lives, and a Submit button.',
  },
  {
    title: 'Everyone has a colour',
    body: 'Each seat has a name, a title and a colour. Submissions, ideas and pages carry their author’s colour, so the room can see whose idea is whose at a glance. The master script prints clean.',
  },
];

const ROLES = [
  ['Showrunner', 'Reviews everything, curates, publishes the master draft, and invites and removes seats.'],
  ['Writer', 'A private branch of their own, and the contributions they choose to submit.'],
  ['Editor or producer', 'Comments, compares and proposes changes, never a destructive edit.'],
  ['Viewer', 'Reads the approved material and the room views they are given.'],
];

const STEPS = [
  {
    title: 'Start a room over a project',
    body: 'A room is attached to a project you already have. The project stays yours; the room is who else is allowed near it. Invite people by email and give each a role.',
  },
  {
    title: 'Hand out the work',
    body: 'Assign a scene, a beat, an act or a research question to a writer, with a note and a due date if you like. An assignment says who is expected to write it; it never stops anyone else having a go.',
  },
  {
    title: 'Write, then submit',
    body: 'Writers work privately. Nobody sees a draft until it is submitted. Submit from the script and it goes to the review queue; submit from Research, the Sculptor or the Outliner and it goes to the brainstorming room.',
  },
  {
    title: 'Argue about the story',
    body: 'In the brainstorming room every submitted idea sits in its author’s colour. Talk it over in threaded comments with @mentions, then file it into the project’s research or hold it for later.',
  },
  {
    title: 'Curate and assemble',
    body: 'Compare alternate versions of a scene, take a whole contribution or just the lines you want into the Curation Tray, preview the result, and commit it as the next master version, with a record naming every source.',
  },
  {
    title: 'Keep the history',
    body: 'Every version is kept, with who made it and when. Name the milestones (First Draft, Room Pass, Network Notes) and open two versions side by side to compare them.',
  },
];

export default function WritersRoomPage() {
  return (
    <>
      <div className="hero module-hero">
        <p className="eyebrow">Writers Room</p>
        <h1>Write together. Lose nothing.</h1>
        <p>
          A room for a television staff, a writing team, a pair of co-writers or an editor and a writer. Everyone works
          in VC Writer on the same story; each writer drafts privately and submits what they choose; the showrunner
          compares, curates and assembles the master script, with every contribution attributed.
        </p>
        <p className="notice">
          The Writers Room is being finished and is not on sale yet. If you have been invited to a room, sign in and it is
          waiting for you.
        </p>
        <Link href="/rooms" className="button">
          Go to your rooms
        </Link>{' '}
        <Link href="/download" className="button secondary">
          Get VC Writer
        </Link>
      </div>

      <section>
        <h2>Three rules the room is built on</h2>
        <div className="grid">
          {RULES.map((rule) => (
            <article key={rule.title} className="card">
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>How a room works</h2>
        <p className="lede">From an empty room to a master draft.</p>
        <div className="grid two-up">
          {STEPS.map((step, index) => (
            <article key={step.title} className="card">
              <h3>
                {index + 1}. {step.title}
              </h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Who does what</h2>
        <p className="lede">Four roles. Signing in opens the room, and each person sees their own part in it.</p>
        <div className="grid two-up">
          {ROLES.map(([role, what]) => (
            <article key={role} className="card">
              <h3>{role}</h3>
              <p>{what}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="publish-band">
        <div>
          <h2>Your writing stays yours</h2>
          <p>
            Removing someone from a room removes their access, never their authorship. And the desktop program keeps
            working on its own, with or without a room.
          </p>
        </div>
        <Link href="/download" className="button">
          Buy &amp; download VC Writer
        </Link>
      </section>
    </>
  );
}
