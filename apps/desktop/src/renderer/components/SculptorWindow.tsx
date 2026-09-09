import { useEffect, useRef, useState } from 'react';
import {
  addSceneToRegion,
  addStructurePoint,
  markerNoun,
  moveStructurePoint,
  removeMarker,
  sculptorSpine,
  structurePointKinds,
  updateMarker,
  type ProjectFile,
  type SculptorRegion,
  type StoryMarkerId,
  type StoryMarkerKind,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { usePreference } from '../use-split';

/**
 * Story Sculptor (addendum 03): the canvas a story is shaped on.
 *
 * Its own area over the whole workspace, like the research window — this is
 * not a panel in a corner. It is where the story is thought about, and it
 * wants the room.
 *
 * **The canvas runs down.** Story time is the vertical axis: Beginning at the
 * top, End at the bottom, and between them the regions the writer's structure
 * points cut the story into. Detail will run *across* it in later stages —
 * scenes in a second column, beats in a third — which is why the regions are
 * bands rather than a list.
 *
 * **A region takes its height from what is under it** (§4). Nothing here is
 * a stored size: the band is as tall as the manuscript in it, so a story
 * whose second act is thin looks thin, which is the whole point of shaping on
 * a canvas rather than in an outline.
 *
 * Beginning and End are drawn, not stored. A story has both whatever is in
 * it, and a writer who could delete the Beginning would be left with a story
 * that starts nowhere.
 */

interface SculptorWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Opening a scene takes the writer to it in the workspace. */
  onOpenUnit?(unitId: string): void;
}

/**
 * Pixels a canvas unit is worth, before the zoom. The domain says how many
 * units a node needs (`SCENE_UNITS`, `BEAT_UNITS`); this is the only place
 * that turns them into a height, so the shape is the story's and the size is
 * the screen's.
 */
const PIXELS_PER_UNIT = 14;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export function SculptorWindow({ file, open, onClose, onUpdate, onOpenUnit }: SculptorWindowProps) {
  const dialog = useModal(open);
  const spine = sculptorSpine(file);
  const kinds = structurePointKinds(file);

  // Per machine, and remembered: coming back to a canvas scrolled somewhere
  // else is coming back to somebody else's canvas (§12).
  const [zoom, setZoom] = usePreference('sculptorZoom', 1);
  const [scroll, setScroll] = usePreference('sculptorScroll', 0);
  const canvas = useRef<HTMLDivElement | null>(null);

  // Collapsed regions, remembered: a canvas folded down to its shape is a
  // way of looking at the story, not a thing to redo every morning (§12).
  const [shut, setShut] = usePreference<string[]>('sculptorCollapsed', []);
  const collapsed = new Set(shut);
  const fold = (key: string, closed: boolean) =>
    setShut(closed ? [...new Set([...shut, key])] : shut.filter((entry) => entry !== key));

  const [selected, setSelected] = useState<StoryMarkerId | null>(null);
  const [dragging, setDragging] = useState<StoryMarkerId | null>(null);
  const [naming, setNaming] = useState<StoryMarkerId | null>(null);

  // The remembered place, put back once the canvas is on screen.
  useEffect(() => {
    if (!open) return;
    const node = canvas.current;
    if (node) node.scrollTop = scroll;
    // Only on opening: following the preference afterwards would fight the
    // writer's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const marked = spine.regions.filter((region) => region.marker !== null);

  /** A point goes in after whatever is selected, or at the end of the story. */
  const addPoint = (kind: StoryMarkerKind) => {
    const after = marked.find((region) => region.marker?.id === selected);
    const index = after && after.toIndex >= 0 ? after.toIndex + 1 : undefined;
    onUpdate((current) => {
      const made = addStructurePoint(current, { kind, index });
      setSelected(made.marker.id);
      setNaming(made.marker.id);
      return made.file;
    });
  };

  const drop = (onto: SculptorRegion) => {
    const from = dragging;
    setDragging(null);
    if (!from || !onto.marker || from === onto.marker.id) return;
    const to = marked.findIndex((region) => region.marker?.id === onto.marker?.id);
    if (to < 0) return;
    onUpdate((current) => moveStructurePoint(current, from, to));
  };

  return (
    <dialog ref={dialog} className="sculptor-window" aria-label="Story Sculptor" onClose={onClose}>
      {open ? (
        <>
          <header className="sculptor-head">
            <span className="bar-title">Story Sculptor</span>
            <span className="muted small">
              {spine.units} {spine.units === 1 ? 'scene' : 'scenes'} · {marked.length}{' '}
              {marked.length === 1 ? 'structure point' : 'structure points'}
            </span>

            <div className="sculptor-tools">
              {kinds.map((kind) => (
                <button key={kind} type="button" className="ghost small" onClick={() => addPoint(kind)}>
                  + {markerNoun(kind) || 'Milestone'}
                </button>
              ))}
              {/* The macro shape in one click: everything folded to its heads
                  and back again (§17, "collapse to a readable macro shape"). */}
              <button
                type="button"
                className="ghost small"
                onClick={() =>
                  setShut(
                    collapsed.size > 0
                      ? []
                      : spine.regions.map((region) => (region.marker?.id as string) ?? 'opening'),
                  )
                }
              >
                {collapsed.size > 0 ? 'Open all' : 'Fold all'}
              </button>
            </div>

            <label className="sculptor-zoom">
              <span className="visually-hidden">Zoom</span>
              <input
                type="range"
                aria-label="Zoom"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>

            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div
            className="sculptor-canvas"
            ref={canvas}
            onScroll={(event) => setScroll((event.target as HTMLDivElement).scrollTop)}
          >
            <div className="sculptor-spine" style={{ '--zoom': zoom } as React.CSSProperties}>
              <Bookend label="Beginning" />

              {spine.regions.length === 0 ? (
                <p className="muted sculptor-empty">
                  Nothing between them yet. Put in the largest shapes first — the turn, the midpoint, the
                  ending — and fill the scenes in under them.
                </p>
              ) : null}

              {spine.regions.map((region) => (
                <RegionBand
                  key={region.marker?.id ?? 'opening'}
                  region={region}
                  zoom={zoom}
                  collapsed={collapsed.has((region.marker?.id as string) ?? 'opening')}
                  onFold={(closed) => fold((region.marker?.id as string) ?? 'opening', closed)}
                  selected={region.marker?.id === selected}
                  naming={region.marker?.id === naming}
                  dragging={dragging}
                  onSelect={() => setSelected(region.marker?.id ?? null)}
                  onName={(title) => {
                    const id = region.marker?.id;
                    setNaming(null);
                    if (id) onUpdate((current) => updateMarker(current, id, { title }));
                  }}
                  onRename={() => setNaming(region.marker?.id ?? null)}
                  onRemove={() => {
                    const id = region.marker?.id;
                    if (id) onUpdate((current) => removeMarker(current, id));
                  }}
                  onDragStart={() => setDragging(region.marker?.id ?? null)}
                  onDragEnd={() => setDragging(null)}
                  onDrop={() => drop(region)}
                  onAddScene={() =>
                    onUpdate((current) => addSceneToRegion(current, region.marker?.id ?? null).file)
                  }
                  onOpenUnit={onOpenUnit}
                />
              ))}

              <Bookend label="End" />
            </div>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/** Two labels that say the same thing, however they are capitalised. */
const sameWords = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** The ends of the story, drawn because they are true rather than stored. */
function Bookend({ label }: { label: string }) {
  return (
    <div className="sculptor-bookend" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

interface RegionBandProps {
  region: SculptorRegion;
  zoom: number;
  /** Folded to its head, its children compressed and their order kept (§4). */
  collapsed: boolean;
  onFold(closed: boolean): void;
  selected: boolean;
  naming: boolean;
  dragging: StoryMarkerId | null;
  onSelect(): void;
  onName(title: string): void;
  onRename(): void;
  onRemove(): void;
  onDragStart(): void;
  onDragEnd(): void;
  onDrop(): void;
  onAddScene(): void;
  onOpenUnit?(unitId: string): void;
}

/**
 * One region: its structure point at the head, and the room its material
 * takes under it. The opening — everything before the first structure point —
 * is drawn the same way but has no point to drag, rename or remove: it is
 * where the story is before it has been given a shape.
 */
function RegionBand({
  region,
  zoom,
  collapsed,
  onFold,
  selected,
  naming,
  dragging,
  onSelect,
  onName,
  onRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDrop,
  onAddScene,
  onOpenUnit,
}: RegionBandProps) {
  const own = region.marker !== null;
  // The room the domain says it needs — a sum of what is in it, not a size
  // anybody set — turned into pixels here and nowhere else.
  const height = collapsed ? 0 : region.extent * PIXELS_PER_UNIT * zoom;
  const target = own && dragging !== null && dragging !== region.marker?.id;

  return (
    <section
      className={[
        'sculptor-region',
        own ? '' : 'opening',
        collapsed ? 'folded' : '',
        selected ? 'selected' : '',
        target ? 'drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ minHeight: `${height}px` }}
      aria-label={region.label}
      onDragOver={(event) => {
        if (target) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!target) return;
        event.preventDefault();
        onDrop();
      }}
    >
      <header
        className="sculptor-point"
        draggable={own}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onSelect}
      >
        <button
          type="button"
          className="ghost sculptor-twisty"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Open ${region.label}` : `Fold ${region.label}`}
          onClick={(event) => {
            event.stopPropagation();
            onFold(!collapsed);
          }}
        >
          {collapsed ? '▸' : '▾'}
        </button>

        {naming && own ? (
          <input
            className="sculptor-name"
            aria-label={`Name ${region.label}`}
            autoFocus
            defaultValue={region.marker?.title ?? ''}
            placeholder="The arrival, the midpoint, what happens here"
            onBlur={(event) => onName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              if (event.key === 'Escape') onName(region.marker?.title ?? '');
            }}
          />
        ) : (
          <>
            <span className="sculptor-label">{region.label}</span>
            {/* The writer's own words beside the number — unless they are the
                number, which is what "Act I" titled "Act I" amounts to. */}
            {region.marker?.title && !sameWords(region.label, region.marker.title) ? (
              <span className="sculptor-said">{region.marker.title}</span>
            ) : null}
          </>
        )}

        <span className="sculptor-figures muted">
          {region.units.length} {region.units.length === 1 ? 'scene' : 'scenes'} · {region.beats}{' '}
          {region.beats === 1 ? 'beat' : 'beats'} · {region.pages.toFixed(1)}{' '}
          {region.pages === 1 ? 'page' : 'pages'}
        </span>

        {!naming ? (
          <span className="sculptor-actions">
            <button
              type="button"
              className="ghost small"
              aria-label={`Add a scene to ${region.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onAddScene();
              }}
            >
              + Scene
            </button>
            {own ? (
              <button type="button" className="ghost small" aria-label={`Rename ${region.label}`} onClick={onRename}>
                Name
              </button>
            ) : null}
            {own ? (
              <button type="button" className="ghost small" aria-label={`Remove ${region.label}`} onClick={onRemove}>
                ×
              </button>
            ) : null}
          </span>
        ) : null}
      </header>

      {collapsed ? null : (
        <div className="sculptor-scenes">
          {region.scenes.length === 0 ? (
            <p className="muted small sculptor-thin">Nothing under it yet.</p>
          ) : (
            region.scenes.map((scene) => (
              <button
                key={scene.unit.id}
                type="button"
                className="sculptor-scene"
                title={`Go to this scene · ${scene.beats} ${scene.beats === 1 ? 'beat' : 'beats'}`}
                // A scene is as tall as its beats, so putting one in pushes
                // what follows down — §4, seen rather than described.
                style={{ minHeight: `${scene.extent * PIXELS_PER_UNIT * zoom}px` }}
                onClick={() => onOpenUnit?.(scene.unit.id as string)}
              >
                <span className="sculptor-scene-name">{scene.unit.title || 'Untitled scene'}</span>
                <span className="sculptor-scene-figures muted">
                  {scene.beats} {scene.beats === 1 ? 'beat' : 'beats'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
