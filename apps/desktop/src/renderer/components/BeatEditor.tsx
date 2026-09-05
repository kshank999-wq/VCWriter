import {
  countWords,
  findUnit,
  newId,
  screenplayElementTypeSchema,
  proseElementTypeSchema,
  updateBeat,
  type Beat,
  type ManuscriptElement,
  type ManuscriptElementId,
  type ManuscriptElementType,
  type ProjectFile,
} from '@vcwriter/domain';

interface BeatEditorProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * Writing workspace for one beat (spec §6).
 *
 * Manuscript content is edited as the typed elements the domain model stores,
 * so what the writer sees maps one-to-one onto what gets exported. The beat's
 * internal title sits in the header as a labelled reference and is never part
 * of the manuscript body.
 *
 * Phase 3 replaces this with the full screenplay/novel editor — element
 * cycling on Tab/Enter, real page layout, print preview and PDF export. The
 * data it reads and writes does not change.
 */
export function BeatEditor({ file, beat, onUpdate }: BeatEditorProps) {
  const unit = findUnit(file, beat.unitId);
  const isProse = file.project.format === 'novel' || file.project.format === 'short_story';
  const elementTypes: ManuscriptElementType[] = isProse
    ? [...proseElementTypeSchema.options]
    : [...screenplayElementTypeSchema.options];

  const setElements = (elements: ManuscriptElement[]) => {
    onUpdate((current) => updateBeat(current, beat.id, { manuscript: { elements } }));
  };

  const updateElement = (id: ManuscriptElementId, patch: Partial<ManuscriptElement>) => {
    setElements(beat.manuscript.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)));
  };

  const addElement = () => {
    const element: ManuscriptElement = {
      id: newId<ManuscriptElementId>(),
      type: isProse ? 'paragraph' : 'action',
      text: '',
      characterId: null,
      attributes: {},
    };
    setElements([...beat.manuscript.elements, element]);
  };

  const removeElement = (id: ManuscriptElementId) => {
    setElements(beat.manuscript.elements.filter((element) => element.id !== id));
  };

  return (
    <div className="editor">
      <header className="editor-header">
        <div>
          <span className="crumb">
            {unit ? `${unit.sequenceLabel || unit.kind} · ${unit.title || 'Untitled'}` : 'Unattached'}
          </span>
          <label className="beat-title-field">
            <span>Beat (internal reference — not printed)</span>
            <input
              value={beat.title}
              placeholder="What happens in this beat"
              onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
            />
          </label>
        </div>
        <div className="editor-meta">
          <select
            value={beat.status}
            aria-label="Beat status"
            onChange={(event) =>
              onUpdate((current) =>
                updateBeat(current, beat.id, { status: event.target.value as Beat['status'] }),
              )
            }
          >
            {['planned', 'drafting', 'written', 'revised', 'cut'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <span className="muted">{countWords(beat.manuscript)} words</span>
        </div>
      </header>

      <div className="elements">
        {beat.manuscript.elements.map((element) => (
          <div key={element.id} className={`element element-${element.type}`}>
            <select
              value={element.type}
              aria-label="Element type"
              onChange={(event) =>
                updateElement(element.id, { type: event.target.value as ManuscriptElementType })
              }
            >
              {elementTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <textarea
              value={element.text}
              rows={Math.max(1, element.text.split('\n').length)}
              placeholder={element.type.replace(/_/g, ' ')}
              onChange={(event) => updateElement(element.id, { text: event.target.value })}
            />
            <button type="button" className="ghost" title="Remove" onClick={() => removeElement(element.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="ghost add-element" onClick={addElement}>
        + Add {isProse ? 'paragraph' : 'element'}
      </button>
    </div>
  );
}
