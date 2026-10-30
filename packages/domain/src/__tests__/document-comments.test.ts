import { describe, expect, it } from 'vitest';
import {
  addComment,
  commentListing,
  createProjectFile,
  deleteComment,
  documentBodyXml,
  mainDocument,
  replyToComment,
  resolveComment,
  setDocumentContent,
  type DocNode,
  type WpDocument,
} from '../index.js';

/** Comments (addendum 42 §20, from Ken: *go ahead with comments and tracked changes*). */
const marked = (id: string) => [{ type: 'comment', attrs: { commentId: id } }];
const content: DocNode = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'The bridge ' },
        { type: 'text', text: 'is out', marks: marked('c2') },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'the river rose', marks: marked('c1') },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

const setUp = () => {
  let file = createProjectFile({ title: 'Letter', format: 'document' });
  const id = mainDocument(file)!.id;
  file = setDocumentContent(file, id, content);
  file = addComment(file, id, { id: 'c1', author: 'Ken Shank', text: 'When?' });
  file = addComment(file, id, { id: 'c2', author: 'Ken Shank', text: 'Which bridge?' });
  file = addComment(file, id, { id: 'gone', author: 'Ken Shank', text: 'About a deleted line.' });
  return { file, id };
};

describe('comments', () => {
  it('lists them in the order their passages stand, with the passage, and orphans last', () => {
    const { file } = setUp();
    const listed = commentListing(mainDocument(file)!);
    expect(listed.map((one) => [one.comment.id, one.passage, one.orphan])).toEqual([
      ['c2', 'is out', false],
      ['c1', 'the river rose', false],
      ['gone', '', true],
    ]);
  });

  it('takes answers, resolves, opens again and deletes', () => {
    let { file, id } = setUp();
    file = replyToComment(file, id, 'c1', { id: 'r1', author: 'Sam', text: 'In March.' });
    file = resolveComment(file, id, 'c1');
    let c1 = mainDocument(file)!.comments.find((one) => one.id === 'c1')!;
    expect(c1.replies.map((one) => one.text)).toEqual(['In March.']);
    expect(c1.resolved).toBe(true);
    file = resolveComment(file, id, 'c1', false);
    c1 = mainDocument(file)!.comments.find((one) => one.id === 'c1')!;
    expect(c1.resolved).toBe(false);
    file = deleteComment(file, id, 'c2');
    expect(mainDocument(file)!.comments.map((one) => one.id)).toEqual(['c1', 'gone']);
  });

  it('goes to Word as Word’s own comments, each range around its passage', () => {
    const { file } = setUp();
    const body = documentBodyXml(mainDocument(file) as WpDocument);
    expect(body.xml).toContain('<w:commentRangeStart w:id="0"/>');
    expect(body.xml).toContain('<w:commentReference w:id="1"/>');
    expect([...body.context.commentNumbers]).toEqual([['c2', 0], ['c1', 1]]);
    expect(body.context.commentsDone.size).toBe(2);
  });
});
