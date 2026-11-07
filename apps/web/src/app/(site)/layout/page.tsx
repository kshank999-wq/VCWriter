import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Layout and publishing',
  description:
    'Format your book for print and publish it as an eBook, inside VC Writer — trim sizes, chapter openings, front and back matter, a print-ready PDF and an EPUB checked for every major store. No separate layout software.',
  alternates: { canonical: '/layout' },
  openGraph: {
    title: 'Layout and publishing, included — VC Writer',
    description: 'Format and publish your book without a separate layout program.',
    url: '/layout',
    images: [{ url: '/help/novel-layout.jpg', width: 2880, height: 1800 }],
  },
};

const TRIMS = [
  '5 × 8 in',
  '5¼ × 8 in',
  '5½ × 8½ in',
  '6 × 9 in',
  'Royal 6.14 × 9.21 in',
  'B format 5.06 × 7.81 in',
  'A5',
  '7 × 10 in',
  '8½ × 11 in',
];

const STORES = [
  'Amazon Kindle (KDP)',
  'Apple Books',
  'Barnes & Noble Press',
  'Kobo Writing Life',
  'Google Play Books',
  'Draft2Digital',
  'IngramSpark',
];

const Shot = ({ src, alt }: { src: string; alt: string }) => (
  <figure className="feature-band-shot">
    <img src={src} width={2880} height={1800} alt={alt} loading="lazy" />
  </figure>
);

/**
 * Layout and publishing, promoted on a page of its own (from Ken: *most people
 * use a separate layout program, but this is included in the package. It's a
 * major feature … formatting and publishing your book without a separate
 * software*). Every claim here is something the Layout room does (addenda 20,
 * 23, 36); the pictures are its own, from scripts/shots.
 */
export default function LayoutPage() {
  return (
    <>
      <div className="hero module-hero">
        <p className="eyebrow">Layout and publishing included</p>
        <h1>Format and publish your book. No separate software.</h1>
        <p>
          Most writers finish a manuscript and then buy a second program to turn it into a book, and a third service to
          make the eBook. In VC Writer the layout room is part of the package: the book you wrote becomes the book you
          print and the eBook you publish, in the same place.
        </p>
        <Link href="/download" className="button">
          Buy &amp; download
        </Link>{' '}
        <Link href="/help/layout" className="button secondary">
          Read the Layout guide
        </Link>
      </div>

      <Shot src="/help/novel-layout.jpg" alt="The Layout room with a novel set as a book, open at chapter one" />

      <section>
        <h2>Set the page</h2>
        <p className="lede">Choose a trim size and the book is laid out for it.</p>
        <div className="layout-split">
          <div>
            <p>
              The margins, the running heads, the page numbers and the gutter are worked out from the trim and the
              length of the book, and the spreads are balanced so facing pages end together. Change the trim and
              everything is set again; your words do not move.
            </p>
            <ul className="trim-list" aria-label="Trim sizes">
              {TRIMS.map((trim) => (
                <li key={trim}>{trim}</li>
              ))}
            </ul>
            <p className="muted-note">Or type any size your printer asks for.</p>
          </div>
          <Shot src="/help/layout-book-settings.jpg" alt="Book settings: title, author, trim size and margins" />
        </div>
      </section>

      <section>
        <h2>Chapters that open like a published book</h2>
        <p className="lede">One style, applied to every chapter, previewed as you choose it.</p>
        <div className="layout-split">
          <Shot src="/help/layout-chapter-openings.jpg" alt="Chapter opening layout with its live preview" />
          <div>
            <p>
              Pick an opening — classic sink, a graphic above or between, a bleeding header, an epigraph, a numeral
              alone, a full page of art — and how the number is written. Start the first line with a drop cap or small
              caps. Set it for one chapter, or for every chapter at once.
            </p>
            <p>
              Front matter and back matter are pages of the book, not afterthoughts: half title, title page,
              copyright, contents built from your chapters, about the author, and any page of your own. Pictures go in
              the text or on a page of their own.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Publish the eBook</h2>
        <p className="lede">One EPUB 3, checked against the store before it is written.</p>
        <div className="layout-split">
          <div>
            <p>
              Choose where it is going and VC Writer checks the book against that store&rsquo;s rules — cover,
              metadata, images, contents — and tells you what to fix before it writes a single file. Reflowable for a
              novel, fixed layout for an illustrated book, and the print page numbers marked so readers can cite your
              pages.
            </p>
            <ul className="trim-list" aria-label="Stores">
              {STORES.map((store) => (
                <li key={store}>{store}</li>
              ))}
            </ul>
          </div>
          <Shot src="/help/layout-ebook.jpg" alt="Export as an eBook: choosing the store and the book's details" />
        </div>
      </section>

      <section>
        <h2>Print it, or hand it on</h2>
        <div className="grid two-up">
          <article className="card">
            <h3>Print-ready PDF</h3>
            <p>The laid-out book, page for page, for a printer or a print-on-demand service.</p>
          </article>
          <article className="card">
            <h3>Word</h3>
            <p>The same book as a Word document, for an editor or a publisher who asks for one.</p>
          </article>
        </div>
      </section>

      <section>
        <h2>For the books you write</h2>
        <p className="lede">Layout opens on these three modules.</p>
        <div className="module-options">
          <Link href="/write/novel" className="module-option">
            <strong>Novel</strong>
            <span>Chapters set as a book, ready for print and eBook.</span>
          </Link>
          <Link href="/write/short-stories" className="module-option">
            <strong>Short stories and collections</strong>
            <span>Each story opens like a chapter, with a contents page listing them.</span>
          </Link>
          <Link href="/write/instructional" className="module-option">
            <strong>Instructional book</strong>
            <span>Sections, figures, index and contents, laid out at textbook sizes.</span>
          </Link>
        </div>
        <p style={{ marginTop: 24 }}>
          <Link href="/download" className="button">
            Buy &amp; download
          </Link>
        </p>
      </section>
    </>
  );
}
