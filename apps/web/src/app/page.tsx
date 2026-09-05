import Link from 'next/link';

const FEATURES = [
  {
    title: 'Structure that holds together',
    body: 'Plot lanes hold scenes or chapters, and every beat lives inside one. Reorder anything and the writing, research and links move with it.',
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
      <div className="hero">
        <h1>Everything a script or a novel needs, in one place.</h1>
        <p>
          Research, outline, draft, edit and hear it read back without moving between five applications.
          VC Writer keeps characters, ideas, setups, payoffs, scenes and beats connected from first idea to
          final export.
        </p>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>
      </div>

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
