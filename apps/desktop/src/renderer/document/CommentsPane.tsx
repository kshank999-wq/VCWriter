import { useEffect, useRef, useState } from 'react';
import type { CommentListing } from '@vcwriter/domain';

/**
 * **The comments beside the page** (addendum 42 §20, from Ken: *go ahead with
 * comments and tracked changes*).
 *
 * A column down the right of the page, as Word's markup area: each comment in
 * the order its passage stands, with the passage quoted, who wrote it, its
 * answers, and Reply, Resolve and Delete. The one chosen — by a click on its
 * passage or on the card — is outlined, and its passage selected in the page.
 * A comment whose passage was deleted stays, marked so, until it is deleted.
 */
export interface CommentsPaneProps {
  listing: CommentListing[];
  active: string | null;
  /** The comment just made, whose words are being written. */
  editing: string | null;
  author: string;
  readOnly: boolean;
  onAuthor(name: string): void;
  onSelect(commentId: string): void;
  onEdit(commentId: string, text: string): void;
  onCancelNew(commentId: string): void;
  onReply(commentId: string, text: string): void;
  onResolve(commentId: string, resolved: boolean): void;
  onDelete(commentId: string): void;
  onClose(): void;
}

const when = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

function Card({
  item,
  active,
  editing,
  readOnly,
  onSelect,
  onEdit,
  onCancelNew,
  onReply,
  onResolve,
  onDelete,
}: {
  item: CommentListing;
  active: boolean;
  editing: boolean;
} & Pick<CommentsPaneProps, 'readOnly' | 'onSelect' | 'onEdit' | 'onCancelNew' | 'onReply' | 'onResolve' | 'onDelete'>) {
  const { comment } = item;
  const [draft, setDraft] = useState(comment.text);
  const [writing, setWriting] = useState(editing);
  const [reply, setReply] = useState('');
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active) card.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    if (editing) setWriting(true);
  }, [editing]);

  return (
    <article
      ref={card}
      className={`wp-comment-card${active ? ' active' : ''}${comment.resolved ? ' resolved' : ''}`}
      aria-label={`Comment by ${comment.author || 'someone'}`}
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).closest('textarea, button, input')) return;
        onSelect(comment.id);
      }}
    >
      <header>
        <strong>{comment.author || 'Someone'}</strong>
        <span className="muted small">{when(comment.createdAt)}</span>
      </header>
      {item.orphan ? (
        <p className="wp-comment-passage orphan">Its passage was deleted.</p>
      ) : (
        <p className="wp-comment-passage" title={item.passage}>
          “{item.passage.length > 80 ? `${item.passage.slice(0, 80)}…` : item.passage}”
        </p>
      )}
      {writing && !readOnly ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim().length === 0) return;
            onEdit(comment.id, draft.trim());
            setWriting(false);
          }}
        >
          <textarea
            aria-label="The comment"
            autoFocus
            rows={3}
            value={draft}
            placeholder="Your comment"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (draft.trim()) {
                  onEdit(comment.id, draft.trim());
                  setWriting(false);
                }
              } else if (event.key === 'Escape') {
                event.preventDefault();
                if (!comment.text) onCancelNew(comment.id);
                setDraft(comment.text);
                setWriting(false);
              }
            }}
          />
          <div className="wp-comment-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                if (!comment.text) onCancelNew(comment.id);
                setDraft(comment.text);
                setWriting(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="small" disabled={draft.trim().length === 0}>
              {comment.text ? 'Save' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <p className="wp-comment-text">{comment.text}</p>
      )}
      {comment.replies.map((one) => (
        <div key={one.id} className="wp-comment-reply">
          <header>
            <strong>{one.author || 'Someone'}</strong>
            <span className="muted small">{when(one.createdAt)}</span>
          </header>
          <p>{one.text}</p>
        </div>
      ))}
      {!readOnly && !writing && comment.text ? (
        <>
          {active ? (
            <form
              className="wp-comment-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!reply.trim()) return;
                onReply(comment.id, reply.trim());
                setReply('');
              }}
            >
              <input aria-label="Reply" placeholder="Reply…" value={reply} onChange={(event) => setReply(event.target.value)} />
            </form>
          ) : null}
          <div className="wp-comment-actions">
            <button type="button" className="ghost small" onClick={() => setWriting(true)}>
              Edit
            </button>
            <button type="button" className="ghost small" onClick={() => onResolve(comment.id, !comment.resolved)}>
              {comment.resolved ? 'Reopen' : 'Resolve'}
            </button>
            <button type="button" className="ghost small danger-text" onClick={() => onDelete(comment.id)}>
              Delete
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function CommentsPane(props: CommentsPaneProps) {
  const { listing, active, editing, author, readOnly, onAuthor, onClose } = props;
  const open = listing.filter((one) => !one.comment.resolved).length;
  return (
    <aside className="wp-comments" aria-label="Comments">
      <header className="wp-comments-head">
        <h3>
          Comments <span className="muted small">{open} open</span>
        </h3>
        <button type="button" className="ghost" aria-label="Hide comments" onClick={onClose}>
          ×
        </button>
      </header>
      {!readOnly ? (
        <label className="wp-comments-author small">
          Commenting as{' '}
          <input aria-label="Your name for comments" value={author} placeholder="Your name" onChange={(event) => onAuthor(event.target.value)} />
        </label>
      ) : null}
      {listing.length === 0 ? (
        <p className="muted small">Select some words and press New comment on the Review tab (Ctrl+Alt+M).</p>
      ) : (
        listing.map((item) => (
          <Card
            key={item.comment.id}
            item={item}
            active={active === item.comment.id}
            editing={editing === item.comment.id}
            readOnly={readOnly}
            onSelect={props.onSelect}
            onEdit={props.onEdit}
            onCancelNew={props.onCancelNew}
            onReply={props.onReply}
            onResolve={props.onResolve}
            onDelete={props.onDelete}
          />
        ))
      )}
    </aside>
  );
}
