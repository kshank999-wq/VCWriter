import { useMemo } from 'react';
import { parseInline } from '@vcwriter/domain';

/**
 * A style's output as the page sets it: the inline marks it is written in
 * (`*Title*`) as italics, and the rest as text (addendum 43).
 */
export function InlineText({ text }: { text: string }) {
  const spans = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {spans.map((span, index) => {
        let node: React.ReactNode = span.text;
        if (span.underline) node = <u>{node}</u>;
        if (span.italic) node = <i>{node}</i>;
        if (span.bold) node = <b>{node}</b>;
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}
