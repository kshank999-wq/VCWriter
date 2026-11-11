import { inTextField } from './TextMenu';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { RoomSave } from './RoomSave';
import { RoomFormat } from './RoomFormat';
import { ResearchShelf, type ShelfCarry } from './ResearchShelf';
import { usePhoneNotes } from '../phone-notes';
import { PopOutButton } from './PopOutButton';
import { sayExport } from '../printing';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  SCULPT_LEVEL_PRESETS,
  SCULPT_LINK_TYPES,
  SCULPT_TYPES,
  SCULPT_TYPE_INFO,
  addCharacter,
  addNode,
  addToTrack,
  ancestorsOf,
  applyView,
  approveCapture,
  autoLayout,
  bindKindOf,
  bindNode,
  bindableBeats,
  bindableUnits,
  boardsOf,
  boundOf,
  breadcrumbsOf,
  canChangeType,
  canReparent,
  carryRowToBoard,
  kindLabel,
  outlineRows,
  castForLibrary,
  childrenOf,
  collapseAll,
  collapseBranch,
  collapseToLevel,
  copyBranch,
  cornerDots,
  createBoard,
  drawnLinks,
  duplicatePlacement,
  enterNode,
  entitiesOf,
  entityTitle,
  explodeAll,
  explodeBranch,
  findBoard,
  findEntity,
  findNode,
  flipLink,
  followCanvas,
  isBound,
  linkNodes,
  linksTouching,
  makeReusable,
  mapPicture,
  miniMap,
  moveChangesContext,
  moveNode,
  moveNodeTo,
  needsAMap,
  nestedSummaries,
  nounsFor,
  outOfStep,
  outlinesOf,
  pasteBranch,
  pinNode,
  placeEntity,
  placeSource,
  placementsOfEntity,
  relabelLink,
  removalComfort,
  removalQuestion,
  removeEntity,
  removeNode,
  removeView,
  revealNode,
  saveView,
  sayNested,
  sayTrackOffer,
  sceneOf,
  actorOf,
  sculptLinkTypeName,
  sculptTypeInfo,
  sculptTypeName,
  searchBoard,
  sculptMapHtml,
  describeMapJson,
  importMapJson,
  nameBoard,
  parseMapJson,
  removeBoard,
  sayMapImport,
  type ImportedMap,
  sculptMapJsonText,
  sculptMapSvg,
  suggestedMapFileName,
  type MapExportScope,
  setFavorite,
  setHiddenLinkTypes,
  setLinkType,
  setNodeField,
  setNodeType,
  titleOf,
  toggleBranch,
  trackOffer,
  unbindNode,
  unlinkNodes,
  updateEntity,
  updateNode,
  upgradeBoards,
  viewStateOf,
  whatGoesWith,
  windowFromMap,
  type BeatId,
  type Board,
  type BoardWindow,
  type PlacedCard,
  type ProjectFile,
  type SaveKind,
  type SculptClip,
  type SculptorEntityId,
  type SculptorLevel,
  type SculptorLinkId,
  type SculptorNode,
  type SculptorNodeId,
  type SculptorSourceKind,
  type SculptorViewId,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * Story Sculptor 2.0 (addendum 03 v2): the one Sculptor.
 *
 * A nested, expandable story mind map. New cards come from the palette on
 * the left, existing characters, places and reusable items from the library
 * on the right, and the selected card's details from the inspector under it.
 * The toolbar explodes the whole hierarchy onto the canvas, folds it back to
 * its frames or to a level, and walks in and out of a card's own mini map.
 */

interface SculptorWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPopOut?(): void;
  onSaveAs?(kind: SaveKind): void;
  onUndo?(): void;
  onRedo?(): void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Leave for the script at this beat (*Open scene*, *Open beat*). */
  onGoToBeat?(beatId: BeatId): void;
  /** Open the research room, where the cast and the places are (*Open character*). */
  onOpenResearch?(): void;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;
/** Below this the cards are drawn simplified so the titles stay legible (v2 §11). */
const FAR = 0.55;
const MAP_BOX = { width: 180, height: 120 };
const DRAG_TYPE = 'application/x-vc-sculpt';

/** What can be dragged onto the canvas from the palette or the library. */
type Payload =
  | { kind: 'type'; type: string }
  | { kind: 'source'; source: { kind: SculptorSourceKind; id: string } }
  | { kind: 'entity'; id: string }
  | { kind: 'unit'; id: string }
  /** A row of the outline and everything under it (from Ken: *access to the outliner… drag pieces of that onto the board*). */
  | { kind: 'row'; outlineId: string; id: string };

type Camera = { zoom: number; pan: { x: number; y: number } };

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function SculptorWindow({
  file,
  open,
  onClose,
  onUpdate,
  onPopOut,
  onSaveAs,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onGoToBeat,
  onOpenResearch,
}: SculptorWindowProps) {
  const boards = boardsOf(file);
  const [boardId, setBoardId] = useState<string | null>(null);
  const board: Board | null = useMemo(() => {
    const chosen = boardId ? boards.find((one) => (one.id as string) === boardId) : undefined;
    return chosen ?? boards[0] ?? null;
  }, [boards, boardId]);

  // One Sculptor: a project with no map gets one, and a version-1 board is
  // upgraded the first time it is opened here (v2 §13).
  useEffect(() => {
    if (!open) return;
    if (boards.length === 0) onUpdate((current) => createBoard(current).file);
    else if (boards.some((one) => (one.schemaVersion ?? 1) < 2)) onUpdate((current) => upgradeBoards(current).file);
  }, [open, boards, onUpdate]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const cameras = useRef(new Map<string, Camera>());
  const [selected, setSelected] = useState<SculptorNodeId | null>(null);
  const [selectedLink, setSelectedLink] = useState<SculptorLinkId | null>(null);
  const [menu, setMenu] = useState<{ nodeId: SculptorNodeId; x: number; y: number } | null>(null);
  const [removing, setRemoving] = useState<SculptorNodeId | null>(null);
  const [removingEntity, setRemovingEntity] = useState<SculptorEntityId | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ nodeId: SculptorNodeId; parentId: SculptorNodeId | null; message: string } | null>(null);
  const [castPrompt, setCastPrompt] = useState<{ parentId: SculptorNodeId | null } | null>(null);
  const [connecting, setConnecting] = useState<SculptorNodeId | null>(null);
  const [portDrag, setPortDrag] = useState<{ from: SculptorNodeId; x: number; y: number } | null>(null);
  const [cardDrag, setCardDrag] = useState<{ id: SculptorNodeId; dx: number; dy: number; moved: boolean } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<SculptorNodeId | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [clip, setClip] = useState<SculptClip | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState<{ map: ImportedMap; into: boolean } | null>(null);
  const [removingMap, setRemovingMap] = useState(false);
  const [renamingMap, setRenamingMap] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement | null>(null);
  const searchBox = useRef<HTMLInputElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const spaceDown = useRef(false);
  const carrying = useRef<ShelfCarry | null>(null);
  const phone = usePhoneNotes(file.project.id as string);
  const nouns = nounsFor(file.project.format);

  const [frame, setFrame] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = canvas.current;
    if (!open || !element || typeof ResizeObserver !== 'function') return undefined;
    const measure = () => setFrame({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    return () => watcher.disconnect();
  }, [open, shelfOpen]);

  const picture = useMemo(() => (board ? mapPicture(board) : null), [board]);
  const summaries = useMemo(() => (board ? nestedSummaries(board) : new Map()), [board]);
  const links = useMemo(() => (board && picture ? drawnLinks(board, picture.visible) : { lines: [], inside: new Map<string, number>(), outside: new Map<string, number>() }), [board, picture]);
  const cardAt = useMemo(() => new Map((picture?.cards ?? []).map((card) => [card.node.id as string, card])), [picture]);
  const state = board ? viewStateOf(board) : null;
  const crumbs = board ? breadcrumbsOf(board) : [];
  const chosen = board && selected ? findNode(board, selected) : null;
  const hits = useMemo(() => (board && query.trim() ? searchBoard(file, board, query).slice(0, 30) : []), [file, board, query]);

  const write = useCallback(
    (mutate: (current: ProjectFile, id: Board['id']) => ProjectFile) => {
      if (!board) return;
      onUpdate((current) => mutate(current, board.id));
    },
    [board, onUpdate],
  );

  /** Where something dropped on empty canvas goes: under the card being shown, or the top. */
  const canvasParent = (): SculptorNodeId | null => (state?.rootId ? (state.rootId as SculptorNodeId) : null);

  // ------------------------------------------------------------ camera

  const centreOn = useCallback(
    (nodeId: string, at: number = zoom) => {
      const card = cardAt.get(nodeId);
      const element = canvas.current;
      if (!card || !element) return;
      setPan({
        x: element.clientWidth / 2 - (card.x + CARD_WIDTH / 2) * at,
        y: element.clientHeight / 2 - (card.y + CARD_HEIGHT / 2) * at,
      });
    },
    [cardAt, zoom],
  );

  const fitAll = useCallback(() => {
    const element = canvas.current;
    if (!picture || !element || picture.cards.length === 0) return;
    const scale = Math.max(MIN_ZOOM, Math.min(1.2, (element.clientWidth - 60) / picture.width, (element.clientHeight - 60) / picture.height));
    setZoom(scale);
    setPan({ x: (element.clientWidth - picture.width * scale) / 2, y: (element.clientHeight - picture.height * scale) / 2 });
  }, [picture]);

  /** Into a card's own map, or back out, remembering where the camera was on each (v2 §5). */
  const goTo = useCallback(
    (nodeId: SculptorNodeId | null) => {
      if (!board) return;
      const from = viewStateOf(board).rootId ?? '';
      cameras.current.set(from, { zoom, pan });
      write((current, id) => enterNode(current, id, nodeId));
      const back = cameras.current.get((nodeId as string | null) ?? '');
      if (back) {
        setZoom(back.zoom);
        setPan(back.pan);
      } else {
        setZoom(1);
        setPan({ x: 40, y: Math.max(40, frame.height / 2 - CARD_HEIGHT) });
      }
      if (nodeId) setSelected(nodeId);
    },
    [board, write, zoom, pan, frame.height],
  );

  const reveal = (nodeId: SculptorNodeId) => {
    write((current, id) => revealNode(current, id, nodeId));
    setSelected(nodeId);
    setSearchOpen(false);
    // Centred once the canvas has laid the revealed card out.
    window.setTimeout(() => centreOn(nodeId as string), 0);
  };

  // ------------------------------------------------------------ acts

  const addUnder = (parentId: SculptorNodeId | null, type: string) => {
    if (type === 'character') {
      setCastPrompt({ parentId });
      return;
    }
    let made: SculptorNodeId | null = null;
    write((current, id) => {
      const result = addNode(current, id, { parentId, kind: type });
      made = result.nodeId;
      return result.file;
    });
    window.setTimeout(() => {
      if (made) {
        setSelected(made);
        setRenaming(made);
      }
    }, 0);
  };

  const place = (payload: Payload, parentId: SculptorNodeId | null) => {
    if (payload.kind === 'type') return addUnder(parentId, payload.type);
    if (payload.kind === 'source') return write((current, id) => placeSource(current, id, payload.source, parentId).file);
    if (payload.kind === 'entity') return write((current, id) => placeEntity(current, id, payload.id as SculptorEntityId, parentId).file);
    if (payload.kind === 'row') {
      return write((current, id) => carryRowToBoard(current, payload.outlineId as never, payload.id as never, id, parentId).file);
    }
    // A scene already in the script: a scene card bound to it.
    write((current, id) => {
      const made = addNode(current, id, { parentId, kind: 'scene' });
      return made.nodeId ? bindNode(made.file, id, made.nodeId, { unitId: payload.id as unknown as StructuralUnitId }) : made.file;
    });
  };

  const askMove = (nodeId: SculptorNodeId, parentId: SculptorNodeId | null) => {
    if (!board || !canReparent(board, nodeId, parentId)) {
      setStatus('A card cannot go inside itself or anything under it.');
      return;
    }
    const message = moveChangesContext(board, nodeId, parentId);
    if (message) setConfirmMove({ nodeId, parentId, message });
    else write((current, id) => moveNodeTo(current, id, nodeId, { parentId }));
  };

  const putOnTrack = (nodeId: SculptorNodeId) => write((current, id) => addToTrack(current, id, nodeId).file);

  const dropShelf = (held: ShelfCarry, parentId: SculptorNodeId | null) => {
    if (held.kind === 'research') return write((current, id) => placeSource(current, id, { kind: 'research', id: held.id as string }, parentId).file);
    if (held.kind === 'note') {
      const note = phone.notes.find((one) => one.id === held.id);
      if (!note) return;
      write((current, id) => {
        try {
          const done = approveCapture(current, note, { kind: 'board', boardId: id, parentId });
          void phone.resolve(done.capture).then((why) => phone.setError(why));
          return done.file;
        } catch (cause) {
          phone.setError(cause instanceof Error ? cause.message : 'That note could not be placed');
          return current;
        }
      });
      return;
    }
    if (held.kind === 'row') {
      const outline = outlinesOf(file)[0];
      if (outline) write((current, id) => carryRowToBoard(current, outline.id, held.id, id, parentId).file);
    }
  };

  const onDrop = (event: DragEvent, parentId: SculptorNodeId | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropOn(null);
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (raw) {
      try {
        place(JSON.parse(raw) as Payload, parentId);
      } catch {
        // not ours
      }
      return;
    }
    const held = carrying.current;
    carrying.current = null;
    if (held) dropShelf(held, parentId);
  };

  // ------------------------------------------------------------ keys (v2 §11)

  useEffect(() => {
    if (!open || !board) return undefined;
    const keys = (event: KeyboardEvent) => {
      if (event.key === ' ' && !isTyping(event.target)) spaceDown.current = event.type === 'keydown';
      if (event.type !== 'keydown') return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchBox.current?.focus(), 0);
        return;
      }
      if (isTyping(event.target)) return;
      if (event.key === 'Escape') {
        if (menu || connecting || portDrag || castPrompt || removing || confirmMove) {
          setMenu(null);
          setConnecting(null);
          setPortDrag(null);
          return;
        }
        if (selected || selectedLink) {
          setSelected(null);
          setSelectedLink(null);
          return;
        }
        if (crumbs.length > 0) goTo((crumbs[crumbs.length - 2]?.id as SculptorNodeId | undefined) ?? null);
        return;
      }
      if (!chosen) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        goTo(chosen.id);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        setRemoving(chosen.id);
      } else if (event.key === 'F2') {
        event.preventDefault();
        setRenaming(chosen.id);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        addUnder(chosen.id, SCULPT_TYPE_INFO[chosenChildType(chosen)].type);
      } else if (mod && event.key.toLowerCase() === 'c') {
        setClip(copyBranch(board, chosen.id));
        setStatus('Copied. Select a card and press Ctrl+V to paste under it.');
      } else if (mod && event.key.toLowerCase() === 'v' && clip) {
        event.preventDefault();
        write((current, id) => pasteBranch(current, id, clip, chosen.id, { asNew: event.shiftKey }).file);
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        const next = neighbour(board, picture?.visible ?? new Set(), chosen, event.key);
        if (next) {
          setSelected(next.id);
          centreOn(next.id as string);
        }
      }
    };
    window.addEventListener('keydown', keys);
    window.addEventListener('keyup', keys);
    return () => {
      window.removeEventListener('keydown', keys);
      window.removeEventListener('keyup', keys);
    };
  });

  /**
   * PNG and PDF of the map (addendum 03 v2 §11): the same picture either way,
   * drawn by the domain from the layout the canvas uses. The PNG is drawn
   * here at twice the size, for a sharp image; the PDF goes to the print
   * window on a page the shape of the map.
   */
  const exportMap = async (format: 'png' | 'pdf' | 'json', scope: MapExportScope) => {
    if (!board || exporting) return;
    const api = window.vcwriter;
    setExporting(true);
    try {
      if (format === 'json') {
        const bytes = new TextEncoder().encode(sculptMapJsonText(file, board));
        const result = await api.saveFile({ name: suggestedMapFileName(file, 'json'), bytes, mediaType: 'application/json', kind: { name: 'JSON data', extension: 'json' } });
        if (!result.ok) setStatus(result.error ?? 'The map could not be saved');
        else if (result.data) setStatus(`Exported to ${result.data.path}`);
        return;
      }
      const map = sculptMapSvg(file, board, scope);
      if (format === 'pdf') {
        const { html, paper } = sculptMapHtml(file, map);
        const result = await api.exportPdf({ file, kind: 'map', html, paper });
        if (!result.ok) setStatus(result.error ?? 'The map could not be exported');
        else if (result.data) setStatus(sayExport(result.data));
        return;
      }
      const bytes = await svgToPng(map.svg, map.width, map.height);
      const result = await api.saveFile({ name: suggestedMapFileName(file, 'png'), bytes, mediaType: 'image/png', kind: { name: 'PNG image', extension: 'png' } });
      if (!result.ok) setStatus(result.error ?? 'The image could not be saved');
      else if (result.data) setStatus(`Exported to ${result.data.path}`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'The map could not be exported');
    } finally {
      setExporting(false);
    }
  };

  /** A story map JSON chosen from disk, checked before anything changes (addendum 03 v2 §8b). */
  const readImport = async (chosen: File | undefined) => {
    if (!chosen) return;
    try {
      const map = parseMapJson(await chosen.text());
      setImporting({ map, into: false });
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'That file could not be read');
    }
  };

  const runImport = () => {
    if (!importing || !board) return;
    const { map, into } = importing;
    const parentId = into ? (chosen?.id ?? canvasParent()) : null;
    let said = '';
    let made: string | null = null;
    onUpdate((current) => {
      const done = importMapJson(current, map, into ? { kind: 'into', boardId: board.id, parentId } : { kind: 'new' });
      said = sayMapImport(done.report);
      made = done.report.boardId as string | null;
      return done.file;
    });
    setImporting(null);
    window.setTimeout(() => {
      if (!into && made) setBoardId(made);
      setStatus(said);
    }, 0);
  };

  if (!open) return null;

  // ------------------------------------------------------------ canvas pointer

  const toCanvas = (clientX: number, clientY: number) => {
    const box = canvas.current?.getBoundingClientRect();
    return { x: (clientX - (box?.left ?? 0) - pan.x) / zoom, y: (clientY - (box?.top ?? 0) - pan.y) / zoom };
  };

  const cardUnder = (clientX: number, clientY: number, except?: Set<string>): PlacedCard | null => {
    const at = toCanvas(clientX, clientY);
    const found = (picture?.cards ?? []).filter(
      (card) => !except?.has(card.node.id as string) && at.x >= card.x && at.x <= card.x + CARD_WIDTH && at.y >= card.y && at.y <= card.y + CARD_HEIGHT,
    );
    return found[found.length - 1] ?? null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.sc-card, .sc-link-label, .sc-minimap')) return;
    setMenu(null);
    if (!spaceDown.current && event.button === 0) {
      setSelected(null);
      setSelectedLink(null);
    }
    panning.current = { x: event.clientX, y: event.clientY };
    capture(event.currentTarget, event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (portDrag) {
      const at = toCanvas(event.clientX, event.clientY);
      setPortDrag({ ...portDrag, x: at.x, y: at.y });
      return;
    }
    if (cardDrag) {
      const moved = cardDrag.moved || Math.abs(event.movementX) + Math.abs(event.movementY) > 0;
      setCardDrag({ ...cardDrag, dx: cardDrag.dx + event.movementX / zoom, dy: cardDrag.dy + event.movementY / zoom, moved });
      const over = cardUnder(event.clientX, event.clientY, new Set(board ? subtreeIds(board, cardDrag.id) : []));
      setDropOn((over?.node.id as string | undefined) ?? null);
      return;
    }
    const from = panning.current;
    if (!from) return;
    setPan((current) => ({ x: current.x + (event.clientX - from.x), y: current.y + (event.clientY - from.y) }));
    panning.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    panning.current = null;
    if (portDrag) {
      const target = cardUnder(event.clientX, event.clientY);
      if (target && target.node.id !== portDrag.from) {
        let made: SculptorLinkId | null = null;
        write((current, id) => {
          const result = linkNodes(current, id, portDrag.from, target.node.id);
          made = result.linkId;
          return result.file;
        });
        window.setTimeout(() => made && setSelectedLink(made), 0);
      }
      setPortDrag(null);
      return;
    }
    if (cardDrag) {
      const drag = cardDrag;
      setCardDrag(null);
      setDropOn(null);
      if (!drag.moved || !board) return;
      const over = cardUnder(event.clientX, event.clientY, new Set(subtreeIds(board, drag.id)));
      if (over) askMove(drag.id, over.node.id);
      else {
        const card = cardAt.get(drag.id as string);
        if (card) write((current, id) => pinNode(current, id, drag.id, { x: card.x + drag.dx, y: card.y + drag.dy }));
      }
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) {
      setPan((current) => ({ x: current.x - event.deltaX, y: current.y - event.deltaY }));
      return;
    }
    const box = canvas.current?.getBoundingClientRect();
    const mouse = { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
    setPan((current) => ({ x: mouse.x - ((mouse.x - current.x) / zoom) * next, y: mouse.y - ((mouse.y - current.y) / zoom) * next }));
    setZoom(next);
  };

  // ------------------------------------------------------------ drawing

  const boardWindow: BoardWindow = { left: -pan.x / zoom, top: -pan.y / zoom, width: frame.width / zoom, height: frame.height / zoom };
  const margin = 400;
  const many = (picture?.cards.length ?? 0) > 300;
  const onScreen = (card: PlacedCard) =>
    !many ||
    (card.x + CARD_WIDTH >= boardWindow.left - margin &&
      card.x <= boardWindow.left + boardWindow.width + margin &&
      card.y + CARD_HEIGHT >= boardWindow.top - margin &&
      card.y <= boardWindow.top + boardWindow.height + margin);

  const positionOf = (card: PlacedCard) =>
    cardDrag && board && subtreeIds(board, cardDrag.id).includes(card.node.id as string)
      ? { x: card.x + cardDrag.dx, y: card.y + cardDrag.dy }
      : { x: card.x, y: card.y };

  const map = picture && frame.width > 0 && needsAMap(picture, boardWindow) ? miniMap(picture, boardWindow, MAP_BOX) : null;
  const level = state?.level ?? { kind: 'all' };
  const levelValue = level.kind === 'all' ? 'all' : level.kind === 'depth' ? `depth:${level.depth}` : `type:${level.type}`;
  const maxDepth = picture ? Math.max(0, ...picture.cards.map((card) => card.depth)) : 0;
  const hiddenTypes = new Set(state?.hiddenLinkTypes ?? []);

  const menuNode = board && menu ? findNode(board, menu.nodeId) : null;

  return (
    <div className="sculptor sc2" role="dialog" aria-label="Story Sculptor">
      <header className="sculptor-bar sc-bar">
        <h2>Story Sculptor</h2>
        <RoomFormat format={file.project.format} />
        <nav className="sc-crumbs" aria-label="Where you are in the story">
          <button type="button" className={crumbs.length === 0 ? 'sc-crumb here' : 'sc-crumb'} onClick={() => goTo(null)}>
            Whole story
          </button>
          {crumbs.map((node, index) => (
            <span key={node.id as string}>
              <span className="sc-crumb-sep" aria-hidden>
                ›
              </span>
              <button
                type="button"
                className={index === crumbs.length - 1 ? 'sc-crumb here' : 'sc-crumb'}
                onClick={() => goTo(node.id)}
              >
                {(board && titleOf(file, board, node)) || sculptTypeName(node.kind, node.subtype)}
              </button>
            </span>
          ))}
        </nav>
        <span className="toolbar-spacer" />
        <div className="sc-search">
          <input
            ref={searchBox}
            type="search"
            placeholder="Search the map (Ctrl+F)"
            aria-label="Search the map"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && hits[0]) reveal(hits[0].node.id);
              if (event.key === 'Escape') setSearchOpen(false);
            }}
          />
          {searchOpen && query.trim() ? (
            <ul className="sc-hits" role="listbox" aria-label="Search results">
              {hits.length === 0 ? <li className="muted small">Nothing matches.</li> : null}
              {hits.map((hit) => (
                <li key={hit.node.id as string}>
                  <button type="button" onClick={() => reveal(hit.node.id)}>
                    <span className="sc-badge" style={{ background: sculptTypeInfo(hit.node.kind).colour }}>
                      {sculptTypeInfo(hit.node.kind).badge}
                    </span>
                    <span>
                      <strong>{hit.title || 'Untitled'}</strong>
                      <span className="muted small sc-hit-path">{hit.path.join(' › ') || 'Top of the story'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <span className="sc-save muted small" title="Saved with the project">
          ● Saved
        </span>
        {onPopOut ? <PopOutButton what="the Story Sculptor" onPopOut={onPopOut} /> : null}
        {onSaveAs ? <RoomSave file={file} onSaveAs={onSaveAs} /> : null}
        <button type="button" className="room-exit" onClick={onClose} aria-label="Close the Story Sculptor" title="Leave the Sculptor">
          Exit
        </button>
      </header>

      <div className="sc-toolbar" role="toolbar" aria-label="Map controls">
        <button type="button" className="tool" title="Show every card at once" onClick={() => write((current, id) => explodeAll(current, id))}>
          ✷ Explode all
        </button>
        <button type="button" className="tool" title="Fold back to the frames" onClick={() => write((current, id) => collapseAll(current, id))}>
          ▣ Collapse all
        </button>
        <label className="sc-level">
          <span className="muted small">Collapse to</span>
          <select
            aria-label="Collapse to level"
            value={levelValue}
            onChange={(event) => {
              const value = event.target.value;
              const next: SculptorLevel =
                value === 'all'
                  ? { kind: 'all' }
                  : value.startsWith('depth:')
                    ? { kind: 'depth', depth: Number(value.slice(6)) }
                    : { kind: 'type', type: value.slice(5) };
              write((current, id) => collapseToLevel(current, id, next));
            }}
          >
            {SCULPT_LEVEL_PRESETS.map((preset) => (
              <option key={preset.type} value={`type:${preset.type}`}>
                {preset.name}
              </option>
            ))}
            <option value="all">Full detail</option>
            <optgroup label="By depth">
              {Array.from({ length: Math.max(maxDepth + 2, 4) }, (_, depth) => (
                <option key={depth} value={`depth:${depth}`}>
                  Level {depth}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <span className="sc-sep" />
        <button
          type="button"
          className="tool"
          disabled={!chosen}
          title="Open everything under the selected card"
          onClick={() => chosen && write((current, id) => explodeBranch(current, id, chosen.id))}
        >
          Explode branch
        </button>
        <button
          type="button"
          className="tool"
          disabled={!chosen}
          title="Fold the selected card"
          onClick={() => chosen && write((current, id) => collapseBranch(current, id, chosen.id))}
        >
          Collapse branch
        </button>
        <button
          type="button"
          className="tool"
          disabled={!chosen || crumbs.length > 0}
          title="Open every card above the selected one"
          onClick={() => chosen && reveal(chosen.id)}
        >
          Show ancestors
        </button>
        <span className="sc-sep" />
        <button type="button" className="tool" title="Fit everything showing in the window" onClick={fitAll}>
          Fit view
        </button>
        <button type="button" className="tool" disabled={!chosen} title="Centre the selected card" onClick={() => chosen && centreOn(chosen.id as string)}>
          Focus selection
        </button>
        <button
          type="button"
          className="tool"
          title="Put every card back where the layout puts it. The story is not changed."
          onClick={() => write((current, id) => autoLayout(current, id))}
        >
          Auto layout
        </button>
        <span className="sc-sep" />
        <button
          type="button"
          className={connecting ? 'tool active' : 'tool'}
          disabled={!chosen && !connecting}
          aria-pressed={connecting !== null}
          title={connecting ? 'Now click the card it connects to' : 'Connect the selected card to another (or drag from a card’s ● port)'}
          onClick={() => setConnecting(connecting ? null : chosen?.id ?? null)}
        >
          {connecting ? 'Connecting…' : '⇄ Connect'}
        </button>
        <button type="button" className="tool" disabled={!onUndo || canUndo === false} onClick={onUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button type="button" className="tool" disabled={!onRedo || canRedo === false} onClick={onRedo} title="Redo (Shift+Ctrl+Z)" aria-label="Redo">
          ↷
        </button>
        <label className="zoom">
          <span className="muted small">Zoom</span>
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={5}
            value={Math.round(zoom * 100)}
            aria-label="Canvas zoom"
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
          />
        </label>
        <details className="sc-views">
          <summary className="tool">Views</summary>
          <div className="sc-views-pop">
            {(board?.views ?? []).length === 0 ? <p className="muted small">No saved views yet.</p> : null}
            {(board?.views ?? []).map((view) => (
              <div key={view.id as string} className="sc-view-row">
                <button type="button" className="ghost small" onClick={() => write((current, id) => applyView(current, id, view.id as SculptorViewId))}>
                  {view.name}
                </button>
                <button
                  type="button"
                  className="ghost small"
                  aria-label={`Remove the view ${view.name}`}
                  onClick={() => write((current, id) => removeView(current, id, view.id as SculptorViewId))}
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="sc-view-row">
              <input aria-label="New view name" placeholder="Name this view" value={viewName} onChange={(event) => setViewName(event.target.value)} />
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  write((current, id) => saveView(current, id, viewName).file);
                  setViewName('');
                }}
              >
                Keep this view
              </button>
            </div>
            <p className="muted small">Links shown</p>
            {SCULPT_LINK_TYPES.map((type) => (
              <label key={type.type} className="sc-check">
                <input
                  type="checkbox"
                  checked={!hiddenTypes.has(type.type)}
                  onChange={(event) => {
                    const next = new Set(hiddenTypes);
                    if (event.target.checked) next.delete(type.type);
                    else next.add(type.type);
                    write((current, id) => setHiddenLinkTypes(current, id, [...next]));
                  }}
                />
                {type.name}
              </label>
            ))}
          </div>
        </details>
        <details className="sc-views sc-export">
          <summary className="tool" aria-label="Export the map">
            {exporting ? 'Exporting…' : 'Export'}
          </summary>
          <div className="sc-views-pop" role="group" aria-label="Export formats">
            <p className="muted small">As shown on the canvas</p>
            <button type="button" className="ghost small" disabled={exporting} onClick={() => void exportMap('png', 'shown')}>
              PNG image
            </button>
            <button type="button" className="ghost small" disabled={exporting} onClick={() => void exportMap('pdf', 'shown')}>
              PDF
            </button>
            <p className="muted small">The whole story, every card open</p>
            <button type="button" className="ghost small" disabled={exporting} onClick={() => void exportMap('png', 'everything')}>
              PNG image, everything
            </button>
            <button type="button" className="ghost small" disabled={exporting} onClick={() => void exportMap('pdf', 'everything')}>
              PDF, everything
            </button>
            <p className="muted small">The map as data, for other tools</p>
            <button type="button" className="ghost small" disabled={exporting} onClick={() => void exportMap('json', 'everything')}>
              JSON data
            </button>
          </div>
        </details>
        <button type="button" className="tool" title="Import a story map saved as JSON" onClick={() => importInput.current?.click()}>
          Import…
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Story map JSON file"
          onChange={(event) => {
            void readImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className={shelfOpen ? 'tool on' : 'tool'}
          aria-pressed={shelfOpen}
          title="Research and phone notes, to drag onto cards"
          onClick={() => {
            setShelfOpen(!shelfOpen);
            setOutlineOpen(false);
          }}
        >
          {shelfOpen ? '◧ Notes' : '▤ Notes'}
        </button>
        <button
          type="button"
          className={outlineOpen ? 'tool on' : 'tool'}
          aria-pressed={outlineOpen}
          title="The Outliner's chapters, sections and notes, to drag onto the map"
          onClick={() => {
            setOutlineOpen(!outlineOpen);
            setShelfOpen(false);
          }}
        >
          {outlineOpen ? '◧ Outliner' : '☰ Outliner'}
        </button>
        {boards.length > 1 && board ? (
          <>
            <select aria-label="Which map" value={board.id as string} onChange={(event) => setBoardId(event.target.value)}>
              {boards.map((one) => (
                <option key={one.id as string} value={one.id as string}>
                  {one.name || 'Untitled map'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="tool"
              title="Rename this map"
              aria-label="Rename this map"
              onClick={() => setRenamingMap(board.name)}
            >
              ✎
            </button>
            <button type="button" className="tool" title="Remove this map" aria-label="Remove this map" onClick={() => setRemovingMap(true)}>
              ✕
            </button>
          </>
        ) : null}
      </div>

      <div className="sc-body">
        {shelfOpen ? (
          <ResearchShelf
            file={file}
            from="board"
            reveal={null}
            notes={phone.notes}
            notesError={phone.error}
            onCarry={(held) => {
              carrying.current = held;
            }}
          />
        ) : outlineOpen ? (
          <OutlinePanel
            file={file}
            hasSelection={chosen !== null}
            onPlace={(outlineId, rowId) => place({ kind: 'row', outlineId, id: rowId }, chosen?.id ?? canvasParent())}
          />
        ) : (
          <Palette onAdd={(type) => addUnder(chosen?.id ?? canvasParent(), type)} hasSelection={chosen !== null} />
        )}

        <div
          ref={canvas}
          className={`sc-canvas${portDrag || connecting ? ' linking' : ''}${dropOn === 'canvas' ? ' over' : ''}`}
          tabIndex={0}
          aria-label="Story map canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={(event) => {
            // A card keeps the pointer while it may be dragged, so its
            // double-click arrives here: find the card under it and open it.
            if ((event.target as HTMLElement).closest('input, .sc-dots, .sc-link-label, .sc-minimap')) return;
            const hit = cardUnder(event.clientX, event.clientY);
            if (hit) goTo(hit.node.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!(event.target as HTMLElement).closest('.sc-card')) setDropOn('canvas');
          }}
          onDragLeave={() => setDropOn(null)}
          onDrop={(event) => onDrop(event, canvasParent())}
        >
          {board && picture && picture.cards.length === 0 ? (
            <div className="sc-empty">
              <p>
                <strong>Start with a frame.</strong> A frame is a major movement or plot point of the story.
              </p>
              <button type="button" onClick={() => addUnder(canvasParent(), 'frame')}>
                + Add a frame
              </button>
              <p className="muted small">Or drag any type from the palette on the left onto the canvas.</p>
            </div>
          ) : null}

          <div className="sc-sheet" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg className="sc-wires" width={(picture?.width ?? 0) + 2000} height={(picture?.height ?? 0) + 2000}>
              <defs>
                <marker id="sc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {(picture?.edges ?? []).map((edge) => {
                const from = cardAt.get(edge.fromId);
                const to = cardAt.get(edge.toId);
                if (!from || !to || (!onScreen(from) && !onScreen(to))) return null;
                const a = positionOf(from);
                const b = positionOf(to);
                const x0 = a.x + CARD_WIDTH;
                const y0 = a.y + CARD_HEIGHT / 2;
                const x1 = b.x;
                const y1 = b.y + CARD_HEIGHT / 2;
                const mid = (x0 + x1) / 2;
                return (
                  <path
                    key={`${edge.fromId}-${edge.toId}`}
                    className="sc-wire"
                    d={`M ${x0} ${y0} C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`}
                    stroke={sculptTypeInfo(to.node.kind).colour}
                  />
                );
              })}
              {links.lines.map((line) => {
                const from = cardAt.get(line.fromId);
                const to = cardAt.get(line.toId);
                if (!from || !to) return null;
                const a = positionOf(from);
                const b = positionOf(to);
                const curve = linkCurve(a, b);
                const first = line.links[0]!;
                const chosenLine = line.links.some((one) => one.id === selectedLink);
                return (
                  <g key={`${line.fromId}>${line.toId}`} className={`sc-link type-${first.type}${chosenLine ? ' selected' : ''}${line.aggregated ? ' aggregated' : ''}`}>
                    <path
                      d={curve.d}
                      markerEnd={line.links.some((one) => one.directed) ? 'url(#sc-arrow)' : undefined}
                      onClick={() => setSelectedLink(first.id)}
                    />
                  </g>
                );
              })}
              {portDrag
                ? (() => {
                    const from = cardAt.get(portDrag.from as string);
                    if (!from) return null;
                    return (
                      <line
                        className="sc-link-draft"
                        x1={from.x + CARD_WIDTH}
                        y1={from.y + CARD_HEIGHT / 2}
                        x2={portDrag.x}
                        y2={portDrag.y}
                      />
                    );
                  })()
                : null}
            </svg>

            {links.lines.map((line) => {
              const from = cardAt.get(line.fromId);
              const to = cardAt.get(line.toId);
              if (!from || !to) return null;
              const curve = linkCurve(positionOf(from), positionOf(to));
              const first = line.links[0]!;
              const text = `${first.label.trim() || sculptLinkTypeName(first.type)}${line.links.length > 1 ? ` ×${line.links.length}` : ''}${line.aggregated ? ' (inside)' : ''}`;
              return (
                <button
                  key={`label-${line.fromId}>${line.toId}`}
                  type="button"
                  className={`sc-link-label type-${first.type}${line.links.some((one) => one.id === selectedLink) ? ' selected' : ''}`}
                  style={{ left: curve.midX, top: curve.midY }}
                  title={line.links.map((one) => `${sculptLinkTypeName(one.type)}${one.label ? `: ${one.label}` : ''}`).join('\n')}
                  onClick={() => {
                    setSelectedLink(first.id);
                    setSelected(null);
                  }}
                >
                  {text}
                </button>
              );
            })}

            {board &&
              (picture?.cards ?? []).filter(onScreen).map((card) => {
                const at = positionOf(card);
                return (
                  <Card
                    key={card.node.id as string}
                    file={file}
                    board={board}
                    card={card}
                    x={at.x}
                    y={at.y}
                    far={zoom < FAR}
                    selected={selected === card.node.id}
                    dropping={dropOn === (card.node.id as string)}
                    renaming={renaming === card.node.id}
                    linksInside={links.inside.get(card.node.id as string) ?? 0}
                    linksOutside={links.outside.get(card.node.id as string) ?? 0}
                    summary={summaries.get(card.node.id as string) ?? { total: 0, byType: [] }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      if (connecting) {
                        if (connecting !== card.node.id) write((current, id) => linkNodes(current, id, connecting, card.node.id).file);
                        setConnecting(null);
                        return;
                      }
                      setSelected(card.node.id);
                      setSelectedLink(null);
                      setMenu(null);
                      setCardDrag({ id: card.node.id, dx: 0, dy: 0, moved: false });
                      capture(canvas.current, event.pointerId);
                    }}
                    onPort={(event) => {
                      event.stopPropagation();
                      const start = toCanvas(event.clientX, event.clientY);
                      setPortDrag({ from: card.node.id, x: start.x, y: start.y });
                      capture(canvas.current, event.pointerId);
                    }}
                    onOpen={() => goTo(card.node.id)}
                    onToggle={() => write((current, id) => toggleBranch(current, id, card.node.id))}
                    onMenu={(x, y) => {
                      setSelected(card.node.id);
                      setMenu({ nodeId: card.node.id, x, y });
                    }}
                    onRename={(title) => {
                      write((current, id) => updateNode(current, id, card.node.id, { title }));
                      setRenaming(null);
                    }}
                    onCancelRename={() => setRenaming(null)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDropOn(card.node.id as string);
                    }}
                    onDrop={(event) => onDrop(event, card.node.id)}
                  />
                );
              })}
          </div>

          {map ? (
            <div
              className="sc-minimap"
              style={{ width: map.width, height: map.height }}
              aria-label="Minimap: press to move there"
              onPointerDown={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const moved = windowFromMap(map, boardWindow, { x: event.clientX - box.left, y: event.clientY - box.top });
                setPan({ x: -moved.left * zoom, y: -moved.top * zoom });
              }}
            >
              <svg width={map.width} height={map.height}>
                {map.cards.map((card) => (
                  <rect key={card.id} x={card.x} y={card.y} width={card.width} height={card.height} fill={sculptTypeInfo(card.kind).colour} />
                ))}
                <rect className="sc-map-window" x={map.frame.x} y={map.frame.y} width={map.frame.width} height={map.frame.height} />
              </svg>
            </div>
          ) : null}
          {status ? (
            <p className="sc-status" role="status" onClick={() => setStatus(null)}>
              {status}
            </p>
          ) : null}
        </div>

        {board ? (
          <aside className="sc-side">
            {selectedLink ? (
              <LinkInspector file={file} board={board} linkId={selectedLink} onWrite={write} onClose={() => setSelectedLink(null)} />
            ) : chosen ? (
              <Inspector
                file={file}
                board={board}
                node={chosen}
                onWrite={write}
                onOpen={() => goTo(chosen.id)}
                onAskRemove={() => setRemoving(chosen.id)}
                onConnect={() => setConnecting(chosen.id)}
                onTrack={putOnTrack}
                onSelect={(id) => setSelected(id)}
                onSelectLink={(id) => setSelectedLink(id)}
                {...(onGoToBeat ? { onGoToBeat } : {})}
                {...(onOpenResearch ? { onOpenResearch } : {})}
              />
            ) : (
              <p className="muted small sc-inspector-empty">
                Select a card to see its details. Double-click a card, or press Enter, to open it as its own map.
              </p>
            )}
            <Library
              file={file}
              board={board}
              onPlace={(payload) => place(payload, chosen?.id ?? canvasParent())}
              onNewCharacter={() => setCastPrompt({ parentId: chosen?.id ?? canvasParent() })}
              onWrite={write}
              onAskRemoveEntity={(id) => setRemovingEntity(id)}
              hasSelection={chosen !== null}
            />
          </aside>
        ) : null}
      </div>

      {menu && menuNode && board ? (
        <CardMenu
          file={file}
          board={board}
          node={menuNode}
          x={menu.x}
          y={menu.y}
          clip={clip}
          onClose={() => setMenu(null)}
          onOpen={() => goTo(menuNode.id)}
          onAdd={(type) => addUnder(menuNode.id, type)}
          onRename={() => setRenaming(menuNode.id)}
          onDuplicate={() => write((current, id) => duplicatePlacement(current, id, menuNode.id).file)}
          onCopy={() => {
            setClip(copyBranch(board, menuNode.id));
            setStatus('Copied.');
          }}
          onPaste={(asNew) => clip && write((current, id) => pasteBranch(current, id, clip, menuNode.id, { asNew }).file)}
          onReusable={() => write((current, id) => makeReusable(current, id, menuNode.id).file)}
          onExplode={() => write((current, id) => explodeBranch(current, id, menuNode.id))}
          onCollapse={() => write((current, id) => collapseBranch(current, id, menuNode.id))}
          onAncestors={() => reveal(menuNode.id)}
          onConnect={() => setConnecting(menuNode.id)}
          onMoveTop={() => askMove(menuNode.id, null)}
          onNudge={(direction) => write((current, id) => moveNode(current, id, menuNode.id, direction))}
          onTrack={() => putOnTrack(menuNode.id)}
          onRemove={() => setRemoving(menuNode.id)}
        />
      ) : null}

      {removing && board ? (
        <RemoveDialog
          question={removalQuestion(whatGoesWith(file, board.id, removing), titleOf(file, board, findNode(board, removing) as SculptorNode))}
          comfort={removalComfort(whatGoesWith(file, board.id, removing))}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const id = removing;
            write((current, boardKey) => removeNode(current, boardKey, id));
            setRemoving(null);
            setSelected(null);
          }}
        />
      ) : null}

      {removingEntity && board ? (
        <RemoveDialog
          question={`Delete “${(() => {
            const entity = findEntity(board, removingEntity);
            return entity ? entityTitle(file, entity) || 'this item' : 'this item';
          })()}” from the map everywhere?`}
          comfort={`Its ${placementsOfEntity(board, removingEntity).length} placement(s) and what is under them go. Anything it stands for in the project, such as a character in the cast, stays.`}
          onCancel={() => setRemovingEntity(null)}
          onConfirm={() => {
            const id = removingEntity;
            write((current, boardKey) => removeEntity(current, boardKey, id));
            setRemovingEntity(null);
          }}
        />
      ) : null}

      {confirmMove ? (
        <div className="sc-modal" role="dialog" aria-label="Move this card?">
          <div className="sc-modal-box">
            <p>{confirmMove.message}</p>
            <div className="sc-modal-actions">
              <button type="button" className="ghost" onClick={() => setConfirmMove(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const move = confirmMove;
                  write((current, id) => moveNodeTo(current, id, move.nodeId, { parentId: move.parentId }));
                  setConfirmMove(null);
                }}
              >
                Move it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {castPrompt && board ? (
        <CastPrompt
          file={file}
          onCancel={() => setCastPrompt(null)}
          onPick={(characterId) => {
            const parentId = castPrompt.parentId;
            write((current, id) => placeSource(current, id, { kind: 'character', id: characterId }, parentId).file);
            setCastPrompt(null);
          }}
          onCreate={(name) => {
            const parentId = castPrompt.parentId;
            write((current, id) => {
              const withCast = addCharacter(current, { name });
              const made = withCast.characters[withCast.characters.length - 1];
              return made ? placeSource(withCast, id, { kind: 'character', id: made.id as string }, parentId).file : withCast;
            });
            setCastPrompt(null);
          }}
        />
      ) : null}
      {importing ? (
        <div className="sc-modal" role="dialog" aria-label="Import a story map">
          <div className="sc-modal-box">
            <h3>Import “{describeMapJson(importing.map).title}”</h3>
            <p className="muted small">
              {describeMapJson(importing.map).cards} cards, {describeMapJson(importing.map).definitions} reusable items,{' '}
              {describeMapJson(importing.map).connections} connections. Nothing already here is changed.
            </p>
            <label className="sc-check">
              <input type="radio" name="sc-import-where" checked={!importing.into} onChange={() => setImporting({ ...importing, into: false })} />
              As a new map in this project
            </label>
            <label className="sc-check">
              <input type="radio" name="sc-import-where" checked={importing.into} onChange={() => setImporting({ ...importing, into: true })} />
              Into this map,{' '}
              {chosen && board ? `under “${titleOf(file, board, chosen) || 'the selected card'}”` : state?.rootId ? 'under the card shown' : 'at the top'}
            </label>
            <p className="muted small">
              Characters are matched to your cast by name, and anyone missing is added. Places and notes link if they are here. Scene links are
              kept only where that scene is in this project and not already on a map.
            </p>
            <div className="sc-modal-actions">
              <button type="button" className="ghost" onClick={() => setImporting(null)}>
                Cancel
              </button>
              <button type="button" onClick={runImport}>
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renamingMap !== null && board ? (
        <div className="sc-modal" role="dialog" aria-label="Rename this map">
          <div className="sc-modal-box">
            <h3>Name this map</h3>
            <input
              autoFocus
              aria-label="Map name"
              value={renamingMap}
              onChange={(event) => setRenamingMap(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const name = renamingMap.trim();
                  if (name) write((current, id) => nameBoard(current, id, name));
                  setRenamingMap(null);
                }
                if (event.key === 'Escape') setRenamingMap(null);
              }}
            />
            <div className="sc-modal-actions">
              <button type="button" className="ghost" onClick={() => setRenamingMap(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = renamingMap.trim();
                  if (name) write((current, id) => nameBoard(current, id, name));
                  setRenamingMap(null);
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removingMap && board ? (
        <RemoveDialog
          question={`Remove the map “${board.name || 'Untitled map'}”?`}
          comfort="Its cards and connections go. The script, the cast and the research are not touched. Undo brings it back."
          onCancel={() => setRemovingMap(false)}
          onConfirm={() => {
            const id = board.id;
            onUpdate((current) => removeBoard(current, id));
            setBoardId(null);
            setRemovingMap(false);
          }}
        />
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------- helpers

/**
 * An SVG drawn onto a canvas at twice its size and encoded as PNG. The
 * longest side is held under 16,000 pixels, the browser's canvas ceiling.
 */
const svgToPng = async (svg: string, width: number, height: number): Promise<Uint8Array> => {
  const scale = Math.min(2, 16000 / Math.max(width, height));
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The map could not be drawn'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The map could not be drawn');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The image could not be made');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Keep the pointer while dragging; a browser that refuses (or a test DOM without it) just doesn't. */
const capture = (element: Element | null, pointerId: number) => {
  try {
    element?.setPointerCapture?.(pointerId);
  } catch {
    // nothing to keep
  }
};

const subtreeIds = (board: Board, nodeId: SculptorNodeId): string[] => {
  const found: string[] = [];
  const walk = (id: string) => {
    found.push(id);
    for (const child of childrenOf(board, id)) walk(child.id as string);
  };
  walk(nodeId as string);
  return found;
};

const chosenChildType = (node: SculptorNode): keyof typeof SCULPT_TYPE_INFO =>
  node.kind === 'frame' || node.kind === 'plot_point' ? 'scene' : node.kind === 'scene' ? 'character' : node.kind === 'character' ? 'action' : 'note';

/** Arrow keys walk the visible tree: up and down among siblings, left to the parent, right to the first child. */
const neighbour = (board: Board, visible: ReadonlySet<string>, node: SculptorNode, key: string): SculptorNode | null => {
  if (key === 'ArrowLeft') return node.parentId && visible.has(node.parentId as string) ? findNode(board, node.parentId) : null;
  if (key === 'ArrowRight') return childrenOf(board, node.id).find((child) => visible.has(child.id as string)) ?? null;
  const siblings = childrenOf(board, node.parentId).filter((one) => visible.has(one.id as string));
  const at = siblings.findIndex((one) => one.id === node.id);
  return siblings[at + (key === 'ArrowUp' ? -1 : 1)] ?? null;
};

const linkCurve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const forwards = b.x > a.x + CARD_WIDTH / 2;
  const x0 = a.x + (forwards ? CARD_WIDTH : CARD_WIDTH / 2);
  const y0 = a.y + (forwards ? CARD_HEIGHT / 2 : 0);
  const x1 = b.x + (forwards ? 0 : CARD_WIDTH / 2);
  const y1 = b.y + (forwards ? CARD_HEIGHT / 2 : 0);
  const lift = forwards ? 0 : -60 - Math.abs(y1 - y0) * 0.15;
  const cx0 = forwards ? (x0 + x1) / 2 : x0;
  const cx1 = forwards ? (x0 + x1) / 2 : x1;
  const cy0 = y0 + lift;
  const cy1 = y1 + lift;
  return {
    d: `M ${x0} ${y0} C ${cx0} ${cy0}, ${cx1} ${cy1}, ${x1} ${y1}`,
    midX: (x0 + 3 * cx0 + 3 * cx1 + x1) / 8,
    midY: (y0 + 3 * cy0 + 3 * cy1 + y1) / 8,
  };
};

const dragPayload = (event: DragEvent, payload: Payload) => {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'copy';
};

// -------------------------------------------------------------- the palette

function Palette({ onAdd, hasSelection }: { onAdd(type: string): void; hasSelection: boolean }) {
  return (
    <aside className="sc-palette" aria-label="New cards">
      <h3>New</h3>
      <p className="muted small">Drag onto a card to put it inside, or onto the canvas. Click to add {hasSelection ? 'under the selected card' : 'at the top'}.</p>
      <ul>
        {SCULPT_TYPES.map((type) => {
          const info = SCULPT_TYPE_INFO[type];
          return (
            <li key={type}>
              <button
                type="button"
                className="sc-palette-item"
                draggable
                onDragStart={(event) => dragPayload(event, { kind: 'type', type })}
                onClick={() => onAdd(type)}
                aria-label={`Add a ${info.name.toLowerCase()}`}
              >
                <span className="sc-badge" style={{ background: info.colour }}>
                  {info.badge}
                </span>
                {info.name}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// -------------------------------------------------------------- the outliner

/**
 * The Outliner beside the map (from Ken: *in the story sculptor, there needs
 * to be access to the outliner… you can drag pieces of that onto the board and
 * put them in categories*). The outline as its tree, folded here without
 * touching the Outliner's own folds. A row and everything under it goes onto
 * the map as typed cards: dropped on a card it goes inside it, on the canvas it
 * goes at the top; a click places it under the selected card. It is a copy:
 * the outline is not changed.
 */
function OutlinePanel({
  file,
  hasSelection,
  onPlace,
}: {
  file: ProjectFile;
  hasSelection: boolean;
  onPlace(outlineId: string, rowId: string): void;
}) {
  const outlines = outlinesOf(file);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const outline = outlines.find((one) => (one.id as string) === outlineId) ?? outlines[0] ?? null;
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const rows = useMemo(() => (outline ? outlineRows(outline, new Set(outline.items.map((item) => item.id as string))) : []), [outline]);
  const shown: typeof rows = [];
  let hideDeeper: number | null = null;
  for (const row of rows) {
    if (hideDeeper !== null && row.depth > hideDeeper) continue;
    hideDeeper = closed.has(row.item.id as string) ? row.depth : null;
    shown.push(row);
  }
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <aside className="sc-palette sc-outline" aria-label="Outliner">
      <h3>Outliner</h3>
      {outlines.length > 1 && outline ? (
        <select aria-label="Which outline" value={outline.id as string} onChange={(event) => setOutlineId(event.target.value)}>
          {outlines.map((one) => (
            <option key={one.id as string} value={one.id as string}>
              {one.name || 'Outline'}
            </option>
          ))}
        </select>
      ) : null}
      {rows.length === 0 ? (
        <p className="muted small">The outline is empty. Add chapters and sections in the Outliner and they show here.</p>
      ) : (
        <>
          <p className="muted small">
            Drag a row onto a card to put it inside, or onto the canvas. Click to place it {hasSelection ? 'under the selected card' : 'at the top'}. Everything under it comes too.
          </p>
          <div className="sc-outline-folding">
            <button type="button" className="ghost small" onClick={() => setClosed(new Set(rows.filter((row) => row.childCount > 0).map((row) => row.item.id as string)))}>
              Collapse all
            </button>
            <button type="button" className="ghost small" onClick={() => setClosed(new Set())}>
              Expand all
            </button>
          </div>
          <ul className="sc-outline-list">
            {shown.map((row) => {
              const id = row.item.id as string;
              const open = !closed.has(id);
              const title = row.item.title.trim() || `Untitled ${kindLabel(row.item.kind).toLowerCase()}`;
              return (
                <li key={id} style={{ paddingLeft: row.depth * 12 }}>
                  {row.childCount > 0 ? (
                    <button
                      type="button"
                      className="sc-outline-fold"
                      aria-expanded={open}
                      aria-label={`${open ? 'Fold' : 'Unfold'} ${title}`}
                      onClick={() => toggle(id)}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span className="sc-outline-fold" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    className="sc-outline-row"
                    draggable
                    onDragStart={(event) => dragPayload(event, { kind: 'row', outlineId: outline!.id as string, id })}
                    onClick={() => onPlace(outline!.id as string, id)}
                    title={`Place “${title}”${row.childCount > 0 ? ' and everything under it' : ''} on the map`}
                  >
                    <span className="sc-outline-kind">{kindLabel(row.item.kind)}</span>
                    <span className="sc-outline-title">{title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}

// -------------------------------------------------------------- a card

function Card({
  file,
  board,
  card,
  x,
  y,
  far,
  selected,
  dropping,
  renaming,
  linksInside,
  linksOutside,
  summary,
  onPointerDown,
  onPort,
  onOpen,
  onToggle,
  onMenu,
  onRename,
  onCancelRename,
  onDragOver,
  onDrop,
}: {
  file: ProjectFile;
  board: Board;
  card: PlacedCard;
  x: number;
  y: number;
  far: boolean;
  selected: boolean;
  dropping: boolean;
  renaming: boolean;
  linksInside: number;
  linksOutside: number;
  summary: { total: number; byType: { type: string; count: number }[] };
  onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void;
  onPort(event: ReactPointerEvent<HTMLSpanElement>): void;
  onOpen(): void;
  onToggle(): void;
  onMenu(x: number, y: number): void;
  onRename(title: string): void;
  onCancelRename(): void;
  onDragOver(event: DragEvent): void;
  onDrop(event: DragEvent): void;
}) {
  const { node } = card;
  const info = sculptTypeInfo(node.kind);
  const title = titleOf(file, board, node);
  const typeName = sculptTypeName(node.kind, node.subtype);
  const dots = cornerDots(summary);
  const entity = findEntity(board, node.entityId);
  const shared = entity ? placementsOfEntity(board, entity.id).length : 0;
  const context = node.kind === 'action' ? actorOf(board, node.id) : null;
  return (
    <div
      className={`sc-card type-${info.type}${selected ? ' selected' : ''}${dropping ? ' dropping' : ''}${far ? ' far' : ''}${isBound(node) ? ' bound' : ''}`}
      data-node-id={node.id as string}
      style={{ left: x, top: y, width: CARD_WIDTH, height: CARD_HEIGHT, ['--type' as string]: info.colour }}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={summary.total > 0 ? !card.folded : undefined}
      aria-label={`${typeName}: ${title || 'Untitled'}`}
      onPointerDown={onPointerDown}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if ((event.target as HTMLElement).closest('input')) return;
        onOpen();
      }}
      onContextMenu={(event) => {
        // Writing in it (editing a note, renaming a card): the spelling menu's.
        if (inTextField(event.target)) return;
        event.preventDefault();
        onMenu(event.clientX, event.clientY);
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="sc-badge" title={typeName}>
        {info.badge}
      </span>
      {renaming ? (
        <input
          className="sc-card-rename"
          autoFocus
          defaultValue={title}
          aria-label="Card title"
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onRename((event.target as HTMLInputElement).value);
            if (event.key === 'Escape') onCancelRename();
          }}
        />
      ) : (
        <span className={title ? 'sc-card-title' : 'sc-card-title untitled'}>{title || `Untitled ${typeName.toLowerCase()}`}</span>
      )}
      {!far ? (
        <span className="sc-card-sub muted">
          {typeName}
          {context ? ` · ${titleOf(file, board, context) || 'its character'}` : ''}
          {shared > 1 ? ` · in ${shared} places` : ''}
          {isBound(node) ? ' · in the script' : ''}
        </span>
      ) : null}
      {summary.total > 0 ? (
        <button
          type="button"
          className="sc-dots"
          title={`${card.folded ? 'Folded: ' : ''}${sayNested(summary)}. Click to ${card.folded ? 'open' : 'fold'}; double-click to open as its own map.`}
          aria-label={`${card.folded ? 'Open' : 'Fold'} ${title || 'this card'}: ${sayNested(summary)}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {dots.types.map((type) => (
            <span key={type} className="sc-dot" style={{ background: sculptTypeInfo(type).colour }} />
          ))}
          {dots.more > 0 ? <span className="sc-dot-more">+{dots.more}</span> : null}
          {card.folded ? <span className="sc-dot-count">{summary.total}</span> : null}
        </button>
      ) : null}
      {linksInside > 0 ? (
        <span className="sc-inside" title={`${linksInside} connection(s) between cards folded inside this one`}>
          ⇄{linksInside}
        </span>
      ) : null}
      {linksOutside > 0 ? (
        <span className="sc-outside" title={`${linksOutside} connection(s) to cards outside this map`}>
          ↗{linksOutside}
        </span>
      ) : null}
      <span className="sc-port" title="Drag to another card to connect them" onPointerDown={onPort} />
    </div>
  );
}

// -------------------------------------------------------------- the menu

function CardMenu({
  file,
  board,
  node,
  x,
  y,
  clip,
  onClose,
  onOpen,
  onAdd,
  onRename,
  onDuplicate,
  onCopy,
  onPaste,
  onReusable,
  onExplode,
  onCollapse,
  onAncestors,
  onConnect,
  onMoveTop,
  onNudge,
  onTrack,
  onRemove,
}: {
  file: ProjectFile;
  board: Board;
  node: SculptorNode;
  x: number;
  y: number;
  clip: SculptClip | null;
  onClose(): void;
  onOpen(): void;
  onAdd(type: string): void;
  onRename(): void;
  onDuplicate(): void;
  onCopy(): void;
  onPaste(asNew: boolean): void;
  onReusable(): void;
  onExplode(): void;
  onCollapse(): void;
  onAncestors(): void;
  onConnect(): void;
  onMoveTop(): void;
  onNudge(direction: -1 | 1): void;
  onTrack(): void;
  onRemove(): void;
}) {
  const offer = trackOffer(file, board, node.id);
  const nouns = nounsFor(file.project.format);
  const act = (run: () => void) => () => {
    run();
    onClose();
  };
  return (
    <div className="sc-menu" role="menu" style={{ left: x, top: y }} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" role="menuitem" onClick={act(onOpen)}>
        Open as its own map
      </button>
      <div className="sc-menu-group">
        <span className="muted small">Add inside</span>
        <div className="sc-menu-types">
          {SCULPT_TYPES.map((type) => (
            <button key={type} type="button" role="menuitem" title={SCULPT_TYPE_INFO[type].name} onClick={act(() => onAdd(type))}>
              <span className="sc-badge" style={{ background: SCULPT_TYPE_INFO[type].colour }}>
                {SCULPT_TYPE_INFO[type].badge}
              </span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" role="menuitem" onClick={act(onRename)}>
        Rename
      </button>
      <button type="button" role="menuitem" onClick={act(onDuplicate)}>
        Duplicate placement
      </button>
      <button type="button" role="menuitem" onClick={act(onCopy)}>
        Copy branch
      </button>
      <button type="button" role="menuitem" disabled={!clip} onClick={act(() => onPaste(false))}>
        Paste inside
      </button>
      <button type="button" role="menuitem" disabled={!clip} onClick={act(() => onPaste(true))}>
        Paste inside as new items
      </button>
      {!node.entityId ? (
        <button type="button" role="menuitem" onClick={act(onReusable)}>
          Make reusable (add to the library)
        </button>
      ) : null}
      <hr />
      <button type="button" role="menuitem" onClick={act(onExplode)}>
        Explode branch
      </button>
      <button type="button" role="menuitem" onClick={act(onCollapse)}>
        Collapse branch
      </button>
      <button type="button" role="menuitem" onClick={act(onAncestors)}>
        Show ancestors
      </button>
      <button type="button" role="menuitem" onClick={act(onConnect)}>
        Connect to…
      </button>
      <button type="button" role="menuitem" onClick={act(() => onNudge(-1))}>
        Move up
      </button>
      <button type="button" role="menuitem" onClick={act(() => onNudge(1))}>
        Move down
      </button>
      {node.parentId ? (
        <button type="button" role="menuitem" onClick={act(onMoveTop)}>
          Move to the top level
        </button>
      ) : null}
      {offer.refusal === null ? (
        <button type="button" role="menuitem" onClick={act(onTrack)}>
          {sayTrackOffer(offer, node, nouns)}
        </button>
      ) : null}
      <hr />
      <button type="button" role="menuitem" className="danger" onClick={act(onRemove)}>
        Delete…
      </button>
    </div>
  );
}

// -------------------------------------------------------------- the inspector

function Inspector({
  file,
  board,
  node,
  onWrite,
  onOpen,
  onAskRemove,
  onConnect,
  onTrack,
  onSelect,
  onSelectLink,
  onGoToBeat,
  onOpenResearch,
}: {
  file: ProjectFile;
  board: Board;
  node: SculptorNode;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
  onOpen(): void;
  onAskRemove(): void;
  onConnect(): void;
  onTrack(nodeId: SculptorNodeId): void;
  onSelect(id: SculptorNodeId): void;
  onSelectLink(id: SculptorLinkId): void;
  onGoToBeat?(beatId: BeatId): void;
  onOpenResearch?(): void;
}) {
  const info = sculptTypeInfo(node.kind);
  const entity = findEntity(board, node.entityId);
  const title = titleOf(file, board, node);
  const placements = entity ? placementsOfEntity(board, entity.id) : [];
  const scene = sceneOf(board, node.id);
  const actor = node.kind === 'action' ? actorOf(board, node.id) : null;
  const fieldNames = [...new Set([...info.fields, ...Object.keys(node.fields ?? {})])];
  const touching = linksTouching(board, node.id);
  const path = ancestorsOf(board, node.id);
  return (
    <section className="sc-inspector" aria-label="Card details">
      <header className="sc-inspector-head" style={{ ['--type' as string]: info.colour }}>
        <span className="sc-badge">{info.badge}</span>
        <span className="muted small">{path.map((one) => titleOf(file, board, one) || sculptTypeName(one.kind, one.subtype)).join(' › ') || 'Top of the story'}</span>
      </header>
      <label className="field">
        <span>Title</span>
        <input
          key={`${node.id as string}-title`}
          defaultValue={title}
          aria-label="Title"
          onBlur={(event) => {
            if (event.target.value !== title) onWrite((current, id) => updateNode(current, id, node.id, { title: event.target.value }));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
        />
      </label>
      {entity ? (
        <p className="muted small">
          {entity.sourceKind === 'character'
            ? 'A character in the cast. Renaming it here renames it everywhere.'
            : entity.sourceKind
              ? `Stands for a ${entity.sourceKind} in the project.`
              : 'A reusable item.'}{' '}
          {placements.length > 1 ? `Placed in ${placements.length} places.` : ''}
        </p>
      ) : null}
      <div className="sc-row">
        <label className="field">
          <span>Type</span>
          <select
            aria-label="Type"
            value={node.kind}
            onChange={(event) => {
              const kind = event.target.value;
              onWrite((current, id) => setNodeType(current, id, node.id, kind));
            }}
          >
            {SCULPT_TYPES.map((type) => (
              <option key={type} value={type} disabled={!canChangeType(board, node.id, type)}>
                {SCULPT_TYPE_INFO[type].name}
              </option>
            ))}
          </select>
        </label>
        {node.kind === 'custom' || node.kind === 'note' ? (
          <label className="field">
            <span>Kind of {node.kind === 'custom' ? 'item' : 'note'}</span>
            <input
              key={`${node.id as string}-sub`}
              defaultValue={node.subtype}
              placeholder={node.kind === 'custom' ? 'Location, Reveal…' : 'Optional'}
              onBlur={(event) => onWrite((current, id) => updateNode(current, id, node.id, { subtype: event.target.value }))}
            />
          </label>
        ) : null}
      </div>
      {scene && node.kind !== 'scene' ? (
        <p className="muted small">
          In the scene <button type="button" className="link-button" onClick={() => onSelect(scene.id)}>{titleOf(file, board, scene) || 'Untitled'}</button>
          {actor ? (
            <>
              {' '}· done by <button type="button" className="link-button" onClick={() => onSelect(actor.id)}>{titleOf(file, board, actor) || 'its character'}</button>
            </>
          ) : null}
        </p>
      ) : null}
      <label className="field">
        <span>{entity && !entity.sourceKind ? 'Description (shared)' : 'Description'}</span>
        <textarea
          key={`${node.id as string}-note`}
          rows={3}
          defaultValue={entity && !entity.sourceKind ? entity.description : node.note}
          onBlur={(event) => {
            const value = event.target.value;
            if (entity && !entity.sourceKind) onWrite((current, id) => updateEntity(current, id, entity.id, { description: value }));
            else onWrite((current, id) => updateNode(current, id, node.id, { note: value }));
          }}
        />
      </label>
      {fieldNames.length > 0 ? (
        <div className="sc-fields">
          {fieldNames.map((name) => (
            <label key={name} className="field">
              <span>{name}</span>
              <input
                key={`${node.id as string}-${name}`}
                defaultValue={node.fields?.[name] ?? ''}
                onBlur={(event) => {
                  if (event.target.value !== (node.fields?.[name] ?? '')) onWrite((current, id) => setNodeField(current, id, node.id, name, event.target.value));
                }}
              />
            </label>
          ))}
        </div>
      ) : null}
      {bindKindOf(node) ? <Binding file={file} board={board} node={node} onWrite={onWrite} onTrack={onTrack} {...(onGoToBeat ? { onGoToBeat } : {})} /> : null}
      {entity?.sourceKind === 'character' || entity?.sourceKind === 'research' || entity?.sourceKind === 'location' ? (
        onOpenResearch ? (
          <button type="button" className="ghost small" onClick={onOpenResearch}>
            Open {entity.sourceKind === 'character' ? 'character' : entity.sourceKind} in Research
          </button>
        ) : null
      ) : null}
      <div className="sc-relations">
        <h4>Connections</h4>
        {touching.length === 0 ? <p className="muted small">None. Drag from the ● on the card, or press Connect.</p> : null}
        <ul>
          {touching.map((link) => {
            const otherId = link.fromId === node.id ? link.toId : link.fromId;
            const other = findNode(board, otherId);
            const outgoing = link.fromId === node.id;
            return (
              <li key={link.id as string}>
                <button type="button" className="link-button" onClick={() => onSelectLink(link.id)}>
                  {outgoing || !link.directed ? '' : '← '}
                  {sculptLinkTypeName(link.type)}
                  {outgoing && link.directed ? ' →' : ''} {other ? titleOf(file, board, other) || 'Untitled' : '?'}
                  {link.label ? ` (${link.label})` : ''}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sc-inspector-actions">
        <button type="button" onClick={onOpen}>
          Open as map
        </button>
        <button type="button" className="ghost" onClick={onConnect}>
          Connect
        </button>
        {!entity ? (
          <button type="button" className="ghost" onClick={() => onWrite((current, id) => makeReusable(current, id, node.id).file)}>
            Make reusable
          </button>
        ) : null}
        <button type="button" className="ghost danger" onClick={onAskRemove}>
          Delete
        </button>
      </div>
    </section>
  );
}

function Binding({
  file,
  board,
  node,
  onWrite,
  onTrack,
  onGoToBeat,
}: {
  file: ProjectFile;
  board: Board;
  node: SculptorNode;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
  onTrack(nodeId: SculptorNodeId): void;
  onGoToBeat?(beatId: BeatId): void;
}) {
  const nouns = nounsFor(file.project.format);
  const kind = bindKindOf(node);
  const bound = boundOf(file, node);
  const step = useMemo(() => (isBound(node) ? outOfStep(file, board, node.id) : null), [file, board, node]);
  const offer = trackOffer(file, board, node.id);
  const what = kind === 'unit' ? nouns.unit.toLowerCase() : nouns.sub.toLowerCase();

  if (bound) {
    const name = bound.kind === 'unit' ? `${bound.unit.sequenceLabel || ''} ${bound.unit.title || 'Untitled'}`.trim() : bound.beat.title.trim() || 'Untitled';
    const firstBeat =
      bound.kind === 'beat' ? bound.beat.id : file.beats.filter((beat) => beat.unitId === bound.unit.id).sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))[0]?.id;
    return (
      <section className="sc-binding bound">
        <p className="small">
          <span className="sculpt-real">●</span> In the script as the {what} <em>{name}</em>. Renaming one renames both.
        </p>
        {step ? (
          <p className="small">
            Here it comes {step.canvasFirst ? 'before' : 'after'} {step.otherTitle}; in the script, {step.canvasFirst ? 'after' : 'before'}.{' '}
            <button type="button" className="ghost small" onClick={() => onWrite((current, id) => followCanvas(current, id, node.id))}>
              Move the {what} to match
            </button>
          </p>
        ) : null}
        <div className="sc-row">
          {onGoToBeat && firstBeat ? (
            <button type="button" className="ghost small" onClick={() => onGoToBeat(firstBeat)}>
              Open {what}
            </button>
          ) : null}
          {offer.refusal === null ? (
            <button type="button" className="ghost small" onClick={() => onTrack(node.id)}>
              {sayTrackOffer(offer, node, nouns)}
            </button>
          ) : null}
          <button type="button" className="ghost small" onClick={() => onWrite((current, id) => unbindNode(current, id, node.id))}>
            Unbind
          </button>
        </div>
      </section>
    );
  }

  const candidates =
    kind === 'unit'
      ? bindableUnits(file, node.id).map((unit) => ({ id: unit.id as string, label: `${unit.sequenceLabel || unit.kind} ${unit.title || 'Untitled'}`.trim() }))
      : bindableBeats(file, board, node.id).map((beat) => ({ id: beat.id as string, label: beat.title || `Untitled ${nouns.sub.toLowerCase()}` }));

  return (
    <section className="sc-binding">
      <p className="muted small">Only on the map so far. Nothing in the script changes until you say so.</p>
      {offer.refusal === null ? (
        <button type="button" className="ghost small" onClick={() => onTrack(node.id)}>
          {sayTrackOffer(offer, node, nouns)} (create in VC Writer)
        </button>
      ) : (
        <p className="muted small">{offer.refusal}.</p>
      )}
      {candidates.length > 0 ? (
        <label className="field">
          <span>or link an existing {what}</span>
          <select
            aria-label={`Link this card to an existing ${what}`}
            value=""
            onChange={(event) => {
              const picked = event.target.value;
              if (!picked) return;
              onWrite((current, id) =>
                bindNode(current, id, node.id, kind === 'unit' ? { unitId: picked as unknown as StructuralUnitId } : { beatId: picked as unknown as BeatId }),
              );
            }}
          >
            <option value="">Choose…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}

function LinkInspector({
  file,
  board,
  linkId,
  onWrite,
  onClose,
}: {
  file: ProjectFile;
  board: Board;
  linkId: SculptorLinkId;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
  onClose(): void;
}) {
  const link = (board.links ?? []).find((one) => one.id === linkId);
  if (!link) return null;
  const from = findNode(board, link.fromId);
  const to = findNode(board, link.toId);
  return (
    <section className="sc-inspector" aria-label="Connection details">
      <header className="sc-inspector-head">
        <strong>Connection</strong>
      </header>
      <p className="small">
        {from ? titleOf(file, board, from) || 'Untitled' : '?'} {link.directed ? '→' : '—'} {to ? titleOf(file, board, to) || 'Untitled' : '?'}
      </p>
      <label className="field">
        <span>Kind</span>
        <select
          aria-label="Kind of connection"
          value={link.type}
          onChange={(event) => {
            const type = SCULPT_LINK_TYPES.find((one) => one.type === event.target.value);
            if (type) onWrite((current, id) => setLinkType(current, id, link.id, { type: type.type, directed: type.directed }));
          }}
        >
          {SCULPT_LINK_TYPES.map((type) => (
            <option key={type.type} value={type.type}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Label</span>
        <input
          key={`${link.id as string}-label`}
          defaultValue={link.label}
          placeholder="Why they are connected"
          onBlur={(event) => onWrite((current, id) => relabelLink(current, id, link.id, event.target.value))}
        />
      </label>
      <label className="sc-check">
        <input
          type="checkbox"
          checked={link.directed}
          onChange={(event) => onWrite((current, id) => setLinkType(current, id, link.id, { directed: event.target.checked }))}
        />
        Has a direction
      </label>
      <div className="sc-inspector-actions">
        <button type="button" className="ghost" onClick={() => onWrite((current, id) => flipLink(current, id, link.id))}>
          Reverse
        </button>
        <button
          type="button"
          className="ghost danger"
          onClick={() => {
            onWrite((current, id) => unlinkNodes(current, id, link.id));
            onClose();
          }}
        >
          Delete
        </button>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- the library

type LibraryFilter = 'all' | 'favorites' | 'characters' | 'locations' | 'story' | 'scenes' | 'research';

function Library({
  file,
  board,
  onPlace,
  onNewCharacter,
  onWrite,
  onAskRemoveEntity,
  hasSelection,
}: {
  file: ProjectFile;
  board: Board;
  onPlace(payload: Payload): void;
  onNewCharacter(): void;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
  onAskRemoveEntity(id: SculptorEntityId): void;
  hasSelection: boolean;
}) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [find, setFind] = useState('');
  const entities = entitiesOf(board);
  const favouriteOf = (kind: SculptorSourceKind, id: string) => entities.find((one) => one.sourceKind === kind && one.sourceId === id)?.favorite ?? false;
  const countOf = (kind: SculptorSourceKind, id: string) => {
    const entity = entities.find((one) => one.sourceKind === kind && one.sourceId === id);
    return entity ? placementsOfEntity(board, entity.id).length : 0;
  };
  const claimed = new Set(board.nodes.map((node) => node.boundUnitId as string | null).filter(Boolean));

  type Row = { key: string; group: LibraryFilter; name: string; type: string; payload: Payload; favourite: boolean; count: number; star(next: boolean): void; remove?(): void };
  const rows: Row[] = [
    ...castForLibrary(file).map((one) => ({
      key: `c:${one.id as string}`,
      group: 'characters' as const,
      name: one.name || 'Unnamed',
      type: 'character',
      payload: { kind: 'source', source: { kind: 'character', id: one.id as string } } as Payload,
      favourite: favouriteOf('character', one.id as string),
      count: countOf('character', one.id as string),
      star: (next: boolean) => onWrite((current, id) => setFavorite(current, id, { kind: 'character', id: one.id as string }, next)),
    })),
    ...(file.locations ?? [])
      .filter((one) => !(one as { deletedAt?: string | null }).deletedAt && !(one as { archived?: boolean }).archived)
      .map((one) => ({
        key: `l:${one.id as string}`,
        group: 'locations' as const,
        name: one.name || 'Unnamed place',
        type: 'custom',
        payload: { kind: 'source', source: { kind: 'location', id: one.id as string } } as Payload,
        favourite: favouriteOf('location', one.id as string),
        count: countOf('location', one.id as string),
        star: (next: boolean) => onWrite((current, id) => setFavorite(current, id, { kind: 'location', id: one.id as string }, next)),
      })),
    ...entities
      .filter((one) => !one.sourceKind)
      .map((one) => ({
        key: `e:${one.id as string}`,
        group: 'story' as const,
        name: one.title || `Untitled ${sculptTypeName(one.type, one.subtype).toLowerCase()}`,
        type: one.type,
        payload: { kind: 'entity', id: one.id as string } as Payload,
        favourite: one.favorite,
        count: placementsOfEntity(board, one.id).length,
        star: (next: boolean) => onWrite((current, id) => setFavorite(current, id, { entityId: one.id }, next)),
        remove: () => onAskRemoveEntity(one.id),
      })),
    ...file.units
      .filter((unit) => !claimed.has(unit.id as string) && !(unit as { deletedAt?: string | null }).deletedAt)
      .map((unit) => ({
        key: `u:${unit.id as string}`,
        group: 'scenes' as const,
        name: `${unit.sequenceLabel ? `${unit.sequenceLabel} ` : ''}${unit.title || 'Untitled'}`,
        type: 'scene',
        payload: { kind: 'unit', id: unit.id as string } as Payload,
        favourite: false,
        count: 0,
        star: () => undefined,
      })),
    ...file.researchItems
      .filter((item) => !(item as { deletedAt?: string | null }).deletedAt && !(item as { archived?: boolean }).archived)
      .slice(0, 400)
      .map((item) => ({
        key: `r:${item.id as string}`,
        group: 'research' as const,
        name: item.title || 'Untitled note',
        type: 'note',
        payload: { kind: 'source', source: { kind: 'research', id: item.id as string } } as Payload,
        favourite: favouriteOf('research', item.id as string),
        count: countOf('research', item.id as string),
        star: (next: boolean) => onWrite((current, id) => setFavorite(current, id, { kind: 'research', id: item.id as string }, next)),
      })),
  ];
  const wanted = find.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (filter === 'all' ? row.group !== 'research' || wanted.length > 0 : filter === 'favorites' ? row.favourite : row.group === filter) &&
      (!wanted || row.name.toLowerCase().includes(wanted)),
  );
  const FILTERS: { key: LibraryFilter; name: string }[] = [
    { key: 'all', name: 'All' },
    { key: 'favorites', name: '★' },
    { key: 'characters', name: 'Characters' },
    { key: 'locations', name: 'Places' },
    { key: 'story', name: 'Plot & scenes' },
    { key: 'scenes', name: 'In the script' },
    { key: 'research', name: 'Research' },
  ];
  return (
    <section className="sc-library" aria-label="Library">
      <header>
        <h3>Library</h3>
        <button type="button" className="ghost small" onClick={onNewCharacter}>
          + Character
        </button>
      </header>
      <input type="search" placeholder="Find in the library" aria-label="Find in the library" value={find} onChange={(event) => setFind(event.target.value)} />
      <div className="sc-filters" role="tablist" aria-label="Library filters">
        {FILTERS.map((one) => (
          <button key={one.key} type="button" role="tab" aria-selected={filter === one.key} className={filter === one.key ? 'on' : ''} onClick={() => setFilter(one.key)}>
            {one.name}
          </button>
        ))}
      </div>
      <p className="muted small">Drag onto a card, or click to place {hasSelection ? 'under the selected card' : 'at the top'}. The same item placed twice stays one item.</p>
      <ul className="sc-library-list">
        {shown.length === 0 ? <li className="muted small">Nothing here yet.</li> : null}
        {shown.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              className="sc-library-item"
              draggable
              onDragStart={(event) => dragPayload(event, row.payload)}
              onClick={() => onPlace(row.payload)}
              title={`Place ${row.name}`}
            >
              <span className="sc-badge" style={{ background: sculptTypeInfo(row.type).colour }}>
                {sculptTypeInfo(row.type).badge}
              </span>
              <span className="sc-library-name">{row.name}</span>
              {row.count > 0 ? <span className="muted small">×{row.count}</span> : null}
            </button>
            {row.group !== 'scenes' ? (
              <button
                type="button"
                className={row.favourite ? 'sc-star on' : 'sc-star'}
                aria-label={row.favourite ? `Unstar ${row.name}` : `Star ${row.name}`}
                aria-pressed={row.favourite}
                onClick={() => row.star(!row.favourite)}
              >
                ★
              </button>
            ) : null}
            {row.remove ? (
              <button type="button" className="sc-star" aria-label={`Delete ${row.name} everywhere`} onClick={row.remove}>
                ✕
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// -------------------------------------------------------------- dialogs

function RemoveDialog({ question, comfort, onCancel, onConfirm }: { question: string; comfort: string; onCancel(): void; onConfirm(): void }) {
  return (
    <div className="sc-modal" role="alertdialog" aria-label={question}>
      <div className="sc-modal-box">
        <p>
          <strong>{question}</strong>
        </p>
        {comfort ? <p className="muted small">{comfort}</p> : null}
        <div className="sc-modal-actions">
          <button type="button" className="ghost" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CastPrompt({ file, onCancel, onPick, onCreate }: { file: ProjectFile; onCancel(): void; onPick(id: string): void; onCreate(name: string): void }) {
  const [name, setName] = useState('');
  const cast = castForLibrary(file);
  const wanted = name.trim().toLowerCase();
  const matches = cast.filter((one) => !wanted || one.name.toLowerCase().includes(wanted));
  const exact = cast.some((one) => one.name.trim().toLowerCase() === wanted);
  return (
    <div className="sc-modal" role="dialog" aria-label="Which character?">
      <div className="sc-modal-box">
        <h3>Which character?</h3>
        <input
          autoFocus
          placeholder="Type a name"
          aria-label="Character name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && wanted) {
              const match = cast.find((one) => one.name.trim().toLowerCase() === wanted);
              if (match) onPick(match.id as string);
              else onCreate(name.trim());
            }
            if (event.key === 'Escape') onCancel();
          }}
        />
        <ul className="sc-cast-list">
          {matches.slice(0, 40).map((one) => (
            <li key={one.id as string}>
              <button type="button" className="ghost" onClick={() => onPick(one.id as string)}>
                {one.name || 'Unnamed'}
              </button>
            </li>
          ))}
        </ul>
        <div className="sc-modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          {wanted && !exact ? (
            <button type="button" onClick={() => onCreate(name.trim())}>
              Add “{name.trim()}” to the cast
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
