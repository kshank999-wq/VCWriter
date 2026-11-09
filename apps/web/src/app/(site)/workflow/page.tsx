import type { Metadata } from 'next';
import Link from 'next/link';
import { WalkthroughButton } from '../walkthrough';
import { walkthroughBySlug } from '@/lib/walkthroughs';

export const metadata: Metadata = {
  title: 'Work your way',
  description:
    'Capture ideas on your phone, gather them in Research, plan in the Outliner, map in the Story Sculptor — or start writing on the page. Several organizing tools in one program, all working on the same story.',
  alternates: { canonical: '/workflow' },
  openGraph: {
    title: 'Work any way you want — VC Writer',
    description: 'A flexible workflow: several organizing tools to use as you like, all on the same story.',
    url: '/workflow',
    images: [{ url: '/help/sculptor-outliner.jpg', width: 2880, height: 1800 }],
  },
};

/**
 * The organizing tools, promoted together (from Ken: *a promotional page for
 * the outliner, the sculptor, the notes, that promotes that you can work any
 * way you want … a flexible workflow, and organize yourself with multiple
 * tools at your disposal*). Each tool has its own page under /tools; this one
 * sells the fact that they are several ways into one story. Every claim is
 * one the tools' guides make, and every picture is the program's own, from
 * scripts/shots.
 */

/** The short text boxes: each tool in a line, with a link to its own page. */
const TOOLS = [
  {
    name: 'VC Writer Notes',
    href: '/notes',
    line: 'Speak or type an idea on your phone. It arrives at your desk titled, dated and filed.',
  },
  {
    name: 'Research',
    href: '/tools/research',
    line: 'Folders of notes, characters and places that know which scenes use them.',
  },
  {
    name: 'Outliner',
    href: '/tools/outliner',
    line: 'Plan in rows you indent and reorder as fast as you think, then send them to the track.',
  },
  {
    name: 'Story Sculptor',
    href: '/tools/story-sculptor',
    line: 'Map acts, plot points, scenes and the cast as cards, with links that say what causes what.',
  },
  {
    name: 'Character Creator',
    href: '/tools/character-creator',
    line: 'Who each person is, what they want, and where they appear.',
  },
  {
    name: 'The page',
    href: '/write/screenplay',
    line: 'Or skip the planning and write. The plot tracks and timeline fill in as you go.',
  },
];

/** The ways in: the same story, started from wherever the writer likes to start. */
const STARTS = [
  {
    title: 'Start with a pile of ideas',
    body: 'Dictate on a walk, clip from the web, jot in Research. Sort the notes into folders, then drop them on the part of the story where they belong.',
  },
  {
    title: 'Start with an outline',
    body: 'Type the story as rows: acts, scenes, beats. Tab tucks one under another; drag to move them. Add a row to the track when it is ready to write.',
  },
  {
    title: 'Start with a map',
    body: 'Lay out the shape on the Story Sculptor: frames for acts, cards for turns, your cast where they matter, and a link for every cause.',
  },
  {
    title: 'Start on the page',
    body: 'Open a new project and write. Scenes and beats you write appear on the track, and you can come back to plan later.',
  },
];

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <figure className="feature-band-shot">
    <img src={src} width={2880} height={1800} alt={alt} loading="lazy" />
  </figure>
);

export default function WorkflowPage() {
  return (
    <>
      <div className="hero module-hero">
        <p className="eyebrow">A flexible workflow</p>
        <h1>Work any way you want.</h1>
        <p>
          Some writers start with a stack of notes, some with an outline, some with a map of the story on the wall, and
          some just start writing. VC Writer gives you all of those tools in one program, working on the same story, so
          you organize yourself your way and switch whenever the story asks for it.
        </p>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>{' '}
        <a href="#tools" className="button secondary">
          See the tools
        </a>
      </div>

      <Shot src="/help/sculptor-outliner.jpg" alt="The Story Sculptor with the Outliner open beside it, on the same story" />

      <section id="tools">
        <h2>Tools at your disposal</h2>
        <p className="lede">Use one, use them all. Each one is a different view of the same story.</p>
        <div className="workflow-boxes">
          {TOOLS.map((tool) => (
            <Link key={tool.name} href={tool.href} className="workflow-box">
              <strong>{tool.name}</strong>
              <span>{tool.line}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="publish-band">
        <div>
          <h2>See it step by step</h2>
          <p>
            Plan it, write it, and watch it become a screenplay, a series, a play, a novel, a collection, a nonfiction book or a commercial. A few short steps each, no jargon.
          </p>
        </div>
        <span className="band-buttons">
          <WalkthroughButton walkthrough={walkthroughBySlug('screenplay')!} />
          <WalkthroughButton walkthrough={walkthroughBySlug('novel')!} className="button secondary" />
          <WalkthroughButton walkthrough={walkthroughBySlug('short-stories')!} className="button secondary" />
          <WalkthroughButton walkthrough={walkthroughBySlug('series')!} className="button secondary" />
          <WalkthroughButton walkthrough={walkthroughBySlug('stage-play')!} className="button secondary" />
          <WalkthroughButton walkthrough={walkthroughBySlug('instructional')!} className="button secondary" />
          <WalkthroughButton walkthrough={walkthroughBySlug('short-form')!} className="button secondary" />
        </span>
      </section>

      <section>
        <h2>Start wherever you start</h2>
        <p className="lede">There is no right order. Pick up any tool and the rest are waiting when you need them.</p>
        <div className="grid two-up">
          {STARTS.map((start) => (
            <article key={start.title} className="card">
              <h3>{start.title}</h3>
              <p>{start.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Catch it, then sort it</h2>
        <p className="lede">Ideas from your phone and your research go where they belong in the story.</p>
        <div className="layout-split">
          <div>
            <p>
              Notes you dictate into VC Writer Notes arrive in Research, ready to file. Drag a note onto a chapter,
              scene or section in the outline and it waits there for you.
            </p>
            <p>
              Open that part of the story and its notes are listed down the side, marked red until you use them.
              Double-click one to rewrite it and add it as a beat. Once used it turns green and moves out of the way.
            </p>
            <p>
              <Link href="/notes">VC Writer Notes</Link> · <Link href="/tools/research">Research</Link>
            </p>
          </div>
          <Shot src="/help/research-filed.jpg" alt="A section opened in Research, with the notes dropped on it listed beside it" />
        </div>
      </section>

      <section>
        <h2>Plan in rows</h2>
        <p className="lede">The Outliner, for writers who think in lists.</p>
        <div className="layout-split">
          <Shot src="/help/outliner.jpg" alt="The Outliner: acts, scenes and beats in coloured rows" />
          <div>
            <p>
              Each level has a colour of its own, so acts, scenes and beats are easy to tell apart. Press Return for the
              next row and Tab to tuck it under the one above. Fold a branch away when you do not need to see it.
            </p>
            <p>
              Drag a row onto another to put it inside, or between two to move it. Shift-click to pick several and move
              them together. When the plan is ready, Add all to track and every scene lands in the script.
            </p>
            <p>
              <Link href="/tools/outliner">More about the Outliner</Link>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Map the shape</h2>
        <p className="lede">The Story Sculptor, for writers who think in pictures.</p>
        <div className="layout-split">
          <div>
            <p>
              Frames for acts, cards for plot points, scenes and beats, and your cast placed where they matter. Link two
              cards and say how: one causes the other, sets it up, is in conflict with it.
            </p>
            <p>
              Open the Outliner beside the map and drag rows onto the board, so your plan and your picture of the story
              are the same story. Save the map as a PDF or picture to print or share.
            </p>
            <p>
              <Link href="/tools/story-sculptor">More about the Story Sculptor</Link>
            </p>
          </div>
          <Shot src="/help/sculptor.jpg" alt="The Story Sculptor: acts, plot points, scenes and the cast, linked" />
        </div>
      </section>

      <section>
        <h2>Your notes, beside the writing</h2>
        <p className="lede">When you sit down to write a beat, everything you gathered for it is right there.</p>
        <div className="layout-split">
          <Shot src="/help/writer-notes.jpg" alt="A beat's writing screen with its notes listed down the right" />
          <div>
            <p>
              The beat&rsquo;s writing screen lists its notes down the right, and the parts of the outline beneath it.
              Open a note, rewrite it, and place its text straight into the beat.
            </p>
            <p>
              Hide the notes you have used, or bring them back. Fold the panel away when you want only the page.
            </p>
          </div>
        </div>
      </section>

      <section className="publish-band">
        <div>
          <h2>All of it, in every module</h2>
          <p>
            Screenplays, series, novels, stage plays, short stories and instructional books. One program, one purchase,
            organized your way.
          </p>
        </div>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>
      </section>
    </>
  );
}
