import type { Metadata } from 'next';
import credits from '@/lib/credits.json';

export const metadata: Metadata = {
  title: 'Open-source credits',
  description: 'The free and open-source software VC Writer is built with, and the licence of each.',
};

interface Credit {
  name: string;
  version: string;
  licence: string;
  url: string;
  note?: string;
}

/**
 * The open-source credits (addendum 45 §4), opened from the desktop program's
 * Help menu. The list is written by apps/desktop/scripts/credits.mjs from the
 * packages the installer actually carries, and a desktop test fails when it
 * falls out of date. The licence texts themselves ship inside the installer,
 * in resources/licenses.
 */
export default function CreditsPage() {
  const all = credits as Credit[];
  const named = all.filter((one) => one.note);
  const packages = all.filter((one) => !one.note);
  return (
    <>
      <div className="hero hero-compact">
        <h1>Open-source credits</h1>
        <p>VC Writer is built with free and open-source software. Thank you to everyone who made it.</p>
      </div>

      <div className="prose">
        <h2>Voices, words and spelling</h2>
        {named.map((one) => (
          <div key={one.name}>
            <h3>{one.name}</h3>
            <p className="small muted">
              {one.version} · {one.licence} · <a href={one.url}>{one.url}</a>
            </p>
            <p>{one.note}</p>
          </div>
        ))}

        <h2>Software libraries</h2>
        <p>
          Each of these is used under the licence shown. The full licence texts are installed with the
          desktop program, in its <em>resources/licenses</em> folder (THIRD-PARTY-NOTICES.txt and
          GPL-3.0.txt).
        </p>
        <table className="credits-table">
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Version</th>
              <th scope="col">Licence</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((one) => (
              <tr key={`${one.name}@${one.version}`}>
                <td>
                  <a href={one.url}>{one.name}</a>
                </td>
                <td>{one.version}</td>
                <td>{one.licence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
