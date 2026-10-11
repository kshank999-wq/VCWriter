import { memo, useMemo } from 'react';
import { renderBookPage, type BookBlock, type BookPage, type BookRenderContext } from '@vcwriter/domain';

/**
 * **A laid page's markup, built once per laying rather than once per render**
 * (addendum 20 §9am).
 *
 * `renderBookPage` is the one builder the export reads too, and on a page of
 * art it returns the picture's data URL inline: **measured, 6 MB of markup
 * for one illustration**. It was called in the render body of four surfaces —
 * the spread, the part's preview, the designed page's and the back matter's —
 * so every state change in the room, and in a slide every pointer move,
 * allocated those six megabytes again for React to compare against the six it
 * already had and throw away. The last three are dialogs that **save as you
 * type**, because a look is tuned against the sheet beside it, so there it was
 * once a keystroke.
 *
 * It is §9ai's rule pointed at the screen: *the measure box is given only what
 * it is asked about*, and a render that changes nothing about the page is not
 * asking for anything.
 *
 * Memoised on the page, the blocks and the context, which is exactly what the
 * markup is a function of — all three change when the book is laid again and
 * at no other time — with `memo` so a render of the room does not reach the
 * builder at all. **Nothing about what is drawn changes**: React compares
 * `__html` by value, so the DOM was never being rewritten and no picture was
 * ever re-decoded; what is saved is the allocation.
 *
 * **One component rather than four copies**, which is the usual reason: the
 * next surface that draws a laid page gets this without being told, and four
 * hand-written `dangerouslySetInnerHTML`s are four places for the next such
 * fault to come back.
 */
export const SheetInk = memo(function SheetInk({
  page,
  blocks,
  context,
  className,
}: {
  page: BookPage;
  blocks: ReadonlyMap<string, BookBlock>;
  context: BookRenderContext;
  className: string;
}) {
  // Every string in it was escaped by the builder.
  const html = useMemo(() => renderBookPage(page, blocks, context), [page, blocks, context]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
