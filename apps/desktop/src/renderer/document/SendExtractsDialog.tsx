import { useEffect, useMemo, useState } from 'react';
import {
  applyRowTransfer,
  applyTransfer,
  choiceFromKey,
  destinationOptions,
  itemsOnShelf,
  planRowTransfer,
  planTransfer,
  recordRowTransfer,
  recordTransfer,
  rowDestinationOptions,
  type DestinationChoice,
  type DestinationOption,
  type Extract,
  type ExtractReceipt,
  type ProjectEntry,
  type ProjectFile,
  type TransferAction,
  type TransferPlan,
  type TransferResult,
  type WpDocumentId,
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

/**
 * What is being sent: extracts from the bins, or rows of the document's
 * outline (addendum 42 §13). The dialog is the same for both; only the
 * engine underneath and a few words differ.
 */
export type SendSubject =
  | { kind: 'extracts'; extracts: Extract[] }
  | { kind: 'rows'; documentId: WpDocumentId; itemIds: string[]; titles: string[] };

type Options = { path?: string | null; again?: boolean; choices?: Readonly<Record<string, DestinationChoice>> };

interface Engine {
  ids: string[];
  noun: [string, string];
  plan(source: ProjectFile, target: ProjectFile, choices: Readonly<Record<string, DestinationChoice>>): TransferPlan;
  apply(source: ProjectFile, target: ProjectFile, options: Options): TransferResult;
  record(source: ProjectFile, receipts: ReadonlyMap<string, ExtractReceipt>, action: TransferAction): ProjectFile;
  options(target: ProjectFile): DestinationOption[];
  /** Whether Move means anything: an extract leaves its bin, a row stays in the outline. */
  movable: boolean;
  heading: string;
}

const engineFor = (subject: SendSubject): Engine => {
  if (subject.kind === 'extracts') {
    const ids = subject.extracts.map((extract) => extract.id as string);
    return {
      ids,
      noun: ['extract', 'extracts'],
      plan: (source, target, choices) => planTransfer(source, ids, target, choices),
      apply: (source, target, options) => applyTransfer(source, ids, target, options),
      record: (source, receipts, action) => recordTransfer(source, receipts, action),
      options: destinationOptions,
      movable: true,
      heading:
        subject.extracts.length === 1
          ? `Send “${subject.extracts[0]!.title || 'Untitled extract'}”`
          : `Send ${subject.extracts.length} extracts`,
    };
  }
  const { documentId, itemIds, titles } = subject;
  return {
    ids: itemIds,
    noun: ['row', 'rows'],
    plan: (source, target, choices) => planRowTransfer(source, documentId, itemIds, target, choices),
    apply: (source, target, options) => applyRowTransfer(source, documentId, itemIds, target, options),
    record: (source, receipts) => recordRowTransfer(source, documentId, receipts),
    options: rowDestinationOptions,
    movable: false,
    heading: itemIds.length === 1 ? `Send “${titles[0] || 'Untitled row'}”` : `Send ${itemIds.length} rows`,
  };
};

interface SendExtractsDialogProps {
  file: ProjectFile;
  /** Where the open project is, so the list does not offer it twice. */
  projectPath: string | null;
  subject: SendSubject;
  onClose(): void;
  /**
   * Record what was sent. `apply` changes the open project (the extracts'
   * receipts, and for this project the new research and scenes too); `moved`
   * are the extracts whose marks should go from the page.
   */
  onSent(apply: (current: ProjectFile) => ProjectFile, moved: string[], message: string): void;
}

type Target = { path: string | null; file: ProjectFile; contentHash: string | null };

export function SendExtractsDialog({ file, projectPath, subject, onClose, onSent }: SendExtractsDialogProps) {
  const engine = useMemo(() => engineFor(subject), [subject]);
  const [one, many] = engine.noun;
  const [projects, setProjects] = useState<ProjectEntry[] | null>(null);
  const [choice, setChoice] = useState<string>(HERE);
  const [target, setTarget] = useState<Target | null>({ path: null, file, contentHash: null });
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<TransferAction>('copy');
  const [again, setAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Where the writer has said each goes, by extract (addendum 42 §11).
  const [choices, setChoices] = useState<Record<string, DestinationChoice>>({});
  const [confirmed, setConfirmed] = useState(false);

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
    setChoices({});
    setConfirmed(false);
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

  /** A project anywhere on the computer, added to the list and chosen. */
  const browse = async () => {
    const picked = await window.vcwriter.pickProject();
    if (!picked.ok) {
      setError(picked.error ?? 'That project could not be chosen.');
      return;
    }
    if (!picked.data) return;
    const path = picked.data.path;
    if (path === projectPath) {
      void choose(HERE);
      return;
    }
    const read = await window.vcwriter.readProject(path);
    if (read.ok && read.data && !projects?.some((entry) => entry.path === path)) {
      const title = read.data.file.project.title;
      setProjects((current) => [...(current ?? []), { path, title, savedAt: null, sizeBytes: null, missing: false }]);
    }
    void choose(path);
  };

  const here = target?.path === null;
  const targetFile = target ? (here ? file : target.file) : null;
  const plan = useMemo(
    () => (targetFile ? engine.plan(file, targetFile, choices) : null),
    [engine, file, targetFile, choices],
  );
  const options = useMemo(() => (targetFile ? engine.options(targetFile) : []), [engine, targetFile]);
  const replacing = Object.values(choices).filter(
    (one) => one.area === 'research' && 'shelfId' in one && one.into?.mode === 'replace',
  ).length;
  const already = plan?.steps.filter((step) => step.already !== null).length ?? 0;
  const going = plan ? (again ? plan.steps.length : plan.steps.length - already) : 0;
  const name = here ? 'this project' : (target?.file.project.title ?? '');

  const send = async () => {
    if (!target || !plan || going === 0 || (replacing > 0 && !confirmed)) return;
    setSending(true);
    setError(null);
    const said = (count: number) =>
      `${action === 'move' ? 'Moved' : 'Sent'} ${count} ${count === 1 ? one : many} to ${here ? 'this project' : target.file.project.title}.`;
    if (here) {
      const trial = engine.apply(file, file, { again, choices });
      onSent(
        (current) => {
          const result = engine.apply(current, current, { again, choices });
          return engine.record(result.target, result.receipts, action);
        },
        action === 'move' ? [...trial.receipts.keys()] : [],
        said(trial.receipts.size),
      );
      return;
    }
    const result = engine.apply(file, target.file, { path: target.path, again, choices });
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
      (current) => engine.record(current, result.receipts, action),
      action === 'move' ? [...result.receipts.keys()] : [],
      said(result.receipts.size),
    );
  };

  return (
    <div className="wp-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="wp-dialog wp-send" role="dialog" aria-modal="true" aria-label={`Send ${many}`}>
        <header>
          <h2>{engine.heading}</h2>
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
          <button type="button" className="ghost small" onClick={() => void browse()} title="Choose a project file anywhere">
            Browse…
          </button>
        </label>
        {projects !== null && projects.length === 0 ? (
          <p className="muted small">No other projects yet. {many[0]!.toUpperCase() + many.slice(1)} can go into this one.</p>
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
                  <th>{one[0]!.toUpperCase() + one.slice(1)}</th>
                  <th>From</th>
                  <th>Into {name}</th>
                </tr>
              </thead>
              <tbody>
                {plan.steps.map((step) => (
                  <tr key={step.extractId} className={step.already && !again ? 'skipped' : undefined}>
                    <td>{step.title || `Untitled ${one}`}</td>
                    <td>{step.categoryName}</td>
                    <td>
                      {step.already && !again ? (
                        <span>Already sent ({step.already.areaName}) — skipped</span>
                      ) : (
                        <Into
                          step={step}
                          options={options}
                          choice={choices[step.extractId] ?? null}
                          target={targetFile!}
                          onChoose={(next) =>
                            setChoices((current) => {
                              const copy = { ...current };
                              if (next) copy[step.extractId] = next;
                              else delete copy[step.extractId];
                              return copy;
                            })
                          }
                        />
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
            {replacing > 0 ? (
              <label className="wp-send-check wp-send-warn">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                Replace the words of {replacing === 1 ? 'one item' : `${replacing} items`} in {name}.{' '}
                {here ? 'Undo brings the old words back.' : 'A recovery point of the project is taken first.'}
              </label>
            ) : null}
            {engine.movable ? (
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
            ) : (
              <p className="muted small">A copy goes. The rows stay in this outline, and the document keeps every word.</p>
            )}
          </>
        ) : null}

        <footer>
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={!plan || going === 0 || sending || (replacing > 0 && !confirmed)} onClick={() => void send()}>
            {sending ? 'Sending…' : going === 0 ? 'Nothing to send' : `${action === 'move' ? 'Move' : 'Send'} ${going}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * One row's destination: the place, and for a research shelf already there,
 * whether to make a new item or add to one (WP spec §7.1, §9: *Create New /
 * Append to Existing / Replace*).
 */
function Into({
  step,
  options,
  choice,
  target,
  onChoose,
}: {
  step: { extractId: string; key: string; areaName: string; fallback: boolean; title: string };
  options: { key: string; label: string }[];
  choice: DestinationChoice | null;
  target: ProjectFile;
  onChoose(choice: DestinationChoice | null): void;
}) {
  // Where it goes now may be a shelf the send will make: offered as itself.
  const list = options.some((option) => option.key === step.key) ? options : [...options, { key: step.key, label: step.areaName }];
  const shelfId = step.key.startsWith('shelf:') ? step.key.slice(6) : null;
  const items = shelfId ? itemsOnShelf(target, shelfId) : [];
  const into = choice && choice.area === 'research' && 'shelfId' in choice ? choice.into ?? null : null;
  const asValue = into ? `${into.mode}:${into.itemId}` : 'new';
  return (
    <div className="wp-send-into">
      <select
        aria-label={`Where ${step.title || 'this one'} goes`}
        value={step.key}
        onChange={(event) => onChoose(choiceFromKey(event.target.value))}
      >
        {list.map((option) => (
          <option key={option.key} value={option.key}>
            {option.key.startsWith('new-shelf:') ? `${option.label.replace(/ ›.*$/, '')} › ${option.key.slice(10)} (new shelf)` : option.label}
          </option>
        ))}
      </select>
      {shelfId && items.length > 0 ? (
        <select
          aria-label={`As what, for ${step.title || 'this one'}`}
          value={asValue}
          onChange={(event) => {
            const [mode, itemId] = event.target.value.split(/:(.*)/s) as [string, string | undefined];
            onChoose({
              area: 'research',
              shelfId,
              into: mode === 'append' || mode === 'replace' ? { mode, itemId: itemId! } : null,
            });
          }}
        >
          <option value="new">A new item</option>
          <optgroup label="Add to">
            {items.map((item) => (
              <option key={`a${item.id}`} value={`append:${item.id}`}>
                Add to “{item.title || 'Untitled'}”
              </option>
            ))}
          </optgroup>
          <optgroup label="Replace">
            {items.map((item) => (
              <option key={`r${item.id}`} value={`replace:${item.id}`}>
                Replace “{item.title || 'Untitled'}”
              </option>
            ))}
          </optgroup>
        </select>
      ) : null}
      {step.fallback && !choice ? <span className="muted small">No shelf of its own there, so Notes.</span> : null}
    </div>
  );
}
