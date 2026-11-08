import Link from 'next/link';
import { Emblem } from '../wordmark';
import { ModuleChooser } from './module-chooser';
import { ToolChooser } from './tool-chooser';

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

      {/* The companion app, at the top (from Ken: *capturing every idea when
          inspiration takes you, and organizing and loading it right into your
          writing software*). */}
      <section id="notes-app" className="notes-band">
        <img src="/notes-icon-512.png" width={512} height={512} alt="" className="notes-band-icon" />
        <div>
          <p className="eyebrow">The companion app</p>
          <h2>VC Writer Notes</h2>
          <p>
            Capture every idea the moment inspiration takes you. Speak it or type it on your phone, and it arrives in
            VC Writer titled, dated and filed where it belongs, ready to write into your story.
          </p>
        </div>
        <Link href="/notes" className="button secondary">
          VC Writer Notes
        </Link>
      </section>

      <section id="modules">
        <h2>What are you writing?</h2>
        <p className="lede">Choose a module to see what VC Writer does for that kind of work.</p>
        <ModuleChooser />
      </section>

      {/* Layout and publishing, under all the modules (from Ken): one line and
          a button to its own page. */}
      <section id="layout" className="publish-band">
        <div>
          <h2>Layout and publishing included</h2>
          <p>
            Format your book for print and publish it as an eBook for every major store, without a separate layout
            program. For novels, short-story collections and instructional books.
          </p>
        </div>
        <Link href="/layout" className="button">
          Layout
        </Link>
      </section>

      {/* The organizing tools together: work any way you want (from Ken). */}
      <section id="workflow" className="publish-band">
        <div>
          <h2>Work any way you want</h2>
          <p>
            Notes on your phone, Research, the Outliner and the Story Sculptor: several ways to organize the same
            story. Start with whichever suits you and switch whenever you like.
          </p>
        </div>
        <Link href="/workflow" className="button">
          Your workflow
        </Link>
      </section>

      {/* The rooms and tools, each with a page of its own (from Ken). */}
      <section id="tools">
        <h2>The rooms and tools</h2>
        <p className="lede">Research, plan, map, check, hear and finish — in every module.</p>
        <ToolChooser />
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
