import { useEffect, useMemo, useState } from 'react';
import {
  applyTransfer,
  planTransfer,
  recordTransfer,
  type Extract,
  type ProjectEntry,
  type ProjectFile,
  type TransferAction,
} from '@vcwriter/domain';

/**
 * **Where extracts go** (addendum 42 §10, the WP spec's §7.1): this project
 * or any other the writer has, chosen from the list of their projects.
 *
 * The preview is the send done on a copy (`planTransfer`), so what it says
 * is what happens. Copy is the default; a Move takes the extracts out of the
 * bins and leaves every word of the document where it is. Another project is
 * written only if it has not changed since it was read, with a recovery
 * point of it taken first, and the receipts are recorded here only once that
 * write has succeeded — a failure leaves nothing half-sent (TR-03).
 */

const HERE = '';

interface SendExtractsDialogProps {
  file: ProjectFile;
  /** Where the open project is, so the list does not offer it twice. */
  projectPath: string | null;
  extracts: Extract[];
  onClose(): void;
  /**
   * Record what was sent. `apply` changes the open project (the extracts'
   * receipts, and for this project the new research and scenes too); `moved`
   * are the extracts whose marks should go from the page.
   */
  onSent(apply: (current: ProjectFile) => ProjectFile, moved: string[], message: string): void;
}

type Target = { path: string | null; file: ProjectFile; contentHash: string | null };

export function SendExtractsDialog({ file, projectPath, extracts, onClose, onSent }: SendExtractsDialogProps) {
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);
  const [choice, setChoice] = useState<string>(HERE);
  const [target, setTarget] = useState<Target | null>({ path: null, file, contentHash: null });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<TransferAction>('copy');
  const [again, setAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ids = useMemo(() => extracts.map((extract) => extract.id as string), [extracts]);

  useEffect(() => {
    let live = true;
    void window.vcwriter.listProjects().then((result) => {
      if (!live) return;
      setProjects(result.ok && result.data ? result.data.filter((entry) => entry.path !== projectPath && !entry.missing) : []);
    });
    return () => {
      live = false;
    };
  }, [projectPath]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [onClose]);

  const choose = async (path: string) => {
    setChoice(path);
    setError(null);
    setAgain(false);
    if (path === HERE) {
      setTarget({ path: null, file, contentHash: null });
      return;
    }
    setTarget(null);
    setLoading(true);
    const result = await window.vcwriter.readProject(path);
    setLoading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'That project could not be read.');
      return;
    }
    // The same project under another name on the list is this one.
    if (result.data.file.project.id === file.project.id) {
      setChoice(HERE);
      setTarget({ path: null, file, contentHash: null });
      return;
    }
    setTarget({ path, file: result.data.file, contentHash: result.data.contentHash });
  };

  const here = target?.path === null;
  const plan = useMemo(() => (target ? planTransfer(file, ids, here ? file : target.file) : null), [file, ids, target, here]);
  const already = plan?.steps.filter((step) => step.already !== null).length ?? 0;
  const going = plan ? (again ? plan.steps.length : plan.steps.length - already) : 0;
  const name = here ? 'this project' : (target?.file.project.title ?? '');

  const send = async () => {
    if (!target || !plan || going === 0) return;
    setSending(true);
    setError(null);
    const said = (count: number) =>
      `${action === 'move' ? 'Moved' : 'Sent'} ${count} ${count === 1 ? 'extract' : 'extracts'} to ${here ? 'this project' : target.file.project.title}.`;
    if (here) {
      const count = applyTransfer(file, ids, file, { again }).receipts.size;
      onSent(
        (current) => {
          const result = applyTransfer(current, ids, current, { again });
          return recordTransfer(result.target, result.receipts, action);
        },
        action === 'move' ? applyTransferIds(file, ids, again) : [],
        said(count),
      );
      return;
    }
    const result = applyTransfer(file, ids, target.file, { path: target.path, again });
    const written = await window.vcwriter.sendIntoProject({
      path: target.path!,
      file: result.target,
      expectedHash: target.contentHash!,
    });
    setSending(false);
    if (!written.ok) {
      setError(written.error ?? 'Nothing was sent: the project could not be written.');
      return;
    }
    onSent(
      (current) => recordTransfer(current, result.receipts, action),
      action === 'move' ? [...result.receipts.keys()] : [],
      said(result.receipts.size),
    );
  };

  return (
    <div className="wp-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="wp-dialog wp-send" role="dialog" aria-modal="true" aria-label="Send extracts">
        <header>
          <h2>
            Send {extracts.length === 1 ? `“${extracts[0]!.title || 'Untitled extract'}”` : `${extracts.length} extracts`}
          </h2>
          <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <label className="wp-send-field">
          <span>To</span>
          <select aria-label="Destination project" value={choice} onChange={(event) => void choose(event.target.value)}>
            <option value={HERE}>This project ({file.project.title || 'Untitled'})</option>
            {projects === null ? <option disabled>Finding your projects…</option> : null}
            {projects?.map((entry) => (
              <option key={entry.path} value={entry.path}>
                {entry.title || entry.path}
              </option>
            ))}
          </select>
        </label>
        {projects !== null && projects.length === 0 ? (
          <p className="muted small">No other projects yet. Extracts can go into this one.</p>
        ) : null}

        {loading ? <p className="muted small">Reading {choice}…</p> : null}
        {error ? (
          <p className="wp-send-error" role="alert">
            {error}
          </p>
        ) : null}

        {plan ? (
          <>
            <table className="wp-send-plan" aria-label="Where each goes">
              <thead>
                <tr>
                  <th>Extract</th>
                  <th>From</th>
                  <th>Into {name}</th>
                </tr>
              </thead>
              <tbody>
                {plan.steps.map((step) => (
                  <tr key={step.extractId} className={step.already && !again ? 'skipped' : undefined}>
                    <td>{step.title || 'Untitled extract'}</td>
                    <td>{step.categoryName}</td>
                    <td>
                      {step.already && !again ? (
                        <span>Already sent ({step.already.areaName}) — skipped</span>
                      ) : (
                        <>
                          {step.areaName}
                          {step.fallback ? <span className="muted small"> (no shelf of its own there)</span> : null}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {already > 0 ? (
              <label className="wp-send-check">
                <input type="checkbox" checked={again} onChange={(event) => setAgain(event.target.checked)} />
                Send the {already === 1 ? 'one' : already} already sent there again, as new copies
              </label>
            ) : null}
            <fieldset className="wp-send-action">
              <legend>Then</legend>
              <label>
                <input type="radio" name="send-action" checked={action === 'copy'} onChange={() => setAction('copy')} /> Copy: keep them in the bins
              </label>
              <label>
                <input type="radio" name="send-action" checked={action === 'move'} onChange={() => setAction('move')} /> Move: take them out of the bins
              </label>
              <p className="muted small">Either way, the passages stay in this document.</p>
            </fieldset>
          </>
        ) : null}

        <footer>
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={!plan || going === 0 || sending} onClick={() => void send()}>
            {sending ? 'Sending…' : going === 0 ? 'Nothing to send' : `${action === 'move' ? 'Move' : 'Send'} ${going}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Which of these a send to this project would take: those not sent here before, unless again. */
const applyTransferIds = (file: ProjectFile, ids: readonly string[], again: boolean): string[] =>
  [...applyTransfer(file, ids, file, { again }).receipts.keys()];
