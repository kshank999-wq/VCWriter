import Link from 'next/link';
import { TOOL_PAGES } from '@/lib/tools';

/**
 * The rooms and tools as cards (addendum 35 §11), each a link to its page —
 * and the two that have pages of their own elsewhere: Layout and the phone
 * app.
 */
export function ToolChooser({ current }: { current?: string }) {
  return (
    <div className="module-options">
      {TOOL_PAGES.map((tool) => (
        <Link
          key={tool.slug}
          href={`/tools/${tool.slug}`}
          className="module-option"
          aria-current={current === tool.slug ? 'page' : undefined}
        >
          <strong>{tool.name}</strong>
          <span>{tool.card}</span>
        </Link>
      ))}
      <Link href="/layout" className="module-option">
        <strong>Layout and publishing</strong>
        <span>Set the finished book for print and publish the eBook.</span>
      </Link>
      <Link href="/notes" className="module-option">
        <strong>VC Writer Notes</strong>
        <span>Dictate ideas on your phone; they arrive filed in Research.</span>
      </Link>
    </div>
  );
}
