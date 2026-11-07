import Link from 'next/link';
import { Emblem } from '../wordmark';
import { ModuleChooser } from './module-chooser';

const FEATURES = [
  {
    title: 'Structure that holds together',
    body: 'Plot tracks hold scenes or chapters, and every beat lives inside one. Reorder anything and the writing, research and links move with it.',
  },
  {
    title: 'Research that stays connected',
    body: 'Characters, ideas, plot points and your own categories link to the scenes and beats that use them. Nothing is a copied-out note.',
  },
  {
    title: 'Setups and payoffs, tracked',
    body: 'A payoff can have as many setups as the story needs. Anything unresolved stays on the active list until you deliver it.',
  },
  {
    title: 'Used and unused, never lost',
    body: 'Material you have worked in moves to Used; the rest stays as a working inventory. Every move is reversible.',
  },
  {
    title: 'Two editors',
    body: 'A daily pass for grammar, mechanics and readability. A final pass that reads each scene as a mini-story and asks what a story editor would.',
  },
  {
    title: 'Hear it read back',
    body: 'Assign a voice per character and let a scene play as a conversation, with a separate narrator voice for action and prose.',
  },
  {
    title: 'Capture away from the desk',
    body: 'VC Writer Notes takes dictated ideas and scenes on mobile, routes them to the right category, and waits for you to confirm.',
  },
  {
    title: 'Windows and macOS',
    body: 'Both platforms ship together, and a project written on one opens on the other with structure, links and metadata intact.',
  },
];

/** What the Layout room does, for its band on the front page. */
const LAYOUT_FEATURES = [
  {
    title: 'Pick a trim size',
    body: 'The margins, headers, footers and page numbers set themselves from it, with the spreads balanced.',
  },
  {
    title: 'Chapter openings',
    body: 'Styled once for the whole book: drop caps, small caps, ornaments, chapters opening on the right.',
  },
  {
    title: 'Front and back matter',
    body: 'Half title, title page, copyright, contents, about the author, and pages of your own.',
  },
  {
    title: 'Pictures',
    body: 'Illustrations placed in the text or given a page of their own.',
  },
  {
    title: 'Print and Word',
    body: 'A print-ready PDF for your printer, and a Word file for an editor.',
  },
  {
    title: 'eBooks for every store',
    body: 'One EPUB, checked before it is written against Amazon Kindle, Apple Books, Barnes & Noble, Kobo, Google Play Books, Draft2Digital and IngramSpark.',
  },
];

export default function HomePage() {
  return (
    <>
      <div className="hero hero-split">
        <div>
          <h1>
            Everything a writer needs — <em>in one place.</em>
          </h1>
          <p>
            Research, outline, draft, edit and hear it read back without moving between five applications.
            VC Writer keeps characters, ideas, setups, payoffs, scenes and beats connected from first idea to
            final export.
          </p>
          <Link href="/download" className="button">
            Buy &amp; download
          </Link>
        </div>
        {/* VC Software's line, under the big mark (from Ken). */}
        <figure className="emblem-block">
          <Emblem />
          <figcaption className="tagline">Organizing creative minds</figcaption>
        </figure>
      </div>

      <section id="modules">
        <h2>What are you writing?</h2>
        <p className="lede">Choose a module to see what VC Writer does for that kind of work.</p>
        <ModuleChooser />
      </section>

      {/* Layout, promoted on its own (from Ken: *most people use a separate
          layout program, but this is included in the package. It's a major
          feature.*). Novels, short stories and instructional books. */}
      <section id="layout" className="feature-band">
        <p className="eyebrow">Included — no separate layout program</p>
        <h2>Layout: the finished book, set where you wrote it</h2>
        <p className="lede">
          Most writers finish a manuscript and then buy a second program to turn it into a book. VC Writer has the
          layout room built in, for novels, short-story collections and instructional books.
        </p>
        <figure className="feature-band-shot">
          <img
            src="/help/novel-layout.jpg"
            width={2880}
            height={1800}
            alt="The Layout room with a novel set as a book, open at chapter one"
            loading="lazy"
          />
        </figure>
        <div className="feature-grid">
          {LAYOUT_FEATURES.map((feature) => (
            <div key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
        <p>
          <Link href="/help/layout" className="button secondary">
            See how Layout works
          </Link>
        </p>
      </section>

      <section id="features">
        <h2>What it does</h2>
        <p className="lede">Built around how stories are actually developed.</p>
        <div className="grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>One purchase, both platforms</h2>
        <p className="lede">
          Choose Windows or Mac at checkout and download immediately. Sign in later to re-download the current
          build for either platform.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/download" className="button">
            See platforms
          </Link>
        </p>
      </section>
    </>
  );
}
