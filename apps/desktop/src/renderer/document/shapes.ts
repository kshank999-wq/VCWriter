import type { Editor } from '@tiptap/core';

/**
 * **Shapes** (addendum 42 §15): Word's basic shapes, inserted at the cursor.
 *
 * A shape is drawn as SVG in the colours chosen and set into the document as a
 * **picture**, a PNG at twice its size so it stays sharp on paper. A picture is
 * what every way out already carries: the printed page, the PDF and the Word
 * file all take it as they take a photograph, with nothing new to break.
 * Changing a shape's colour is inserting it again in the new one; the picture
 * keeps the shape's name as its description, so a screen reader says what it
 * is.
 */

export type ShapeId =
  | 'rectangle'
  | 'rounded'
  | 'oval'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'star'
  | 'arrow'
  | 'line'
  | 'callout';

export const SHAPES: { id: ShapeId; name: string; width: number; height: number }[] = [
  { id: 'rectangle', name: 'Rectangle', width: 192, height: 120 },
  { id: 'rounded', name: 'Rounded rectangle', width: 192, height: 120 },
  { id: 'oval', name: 'Oval', width: 168, height: 120 },
  { id: 'triangle', name: 'Triangle', width: 144, height: 128 },
  { id: 'diamond', name: 'Diamond', width: 144, height: 144 },
  { id: 'pentagon', name: 'Pentagon', width: 144, height: 138 },
  { id: 'star', name: 'Star', width: 144, height: 138 },
  { id: 'arrow', name: 'Right arrow', width: 192, height: 96 },
  { id: 'line', name: 'Line', width: 240, height: 12 },
  { id: 'callout', name: 'Speech bubble', width: 192, height: 132 },
];

/** Word's default shape: blue fill, darker blue outline. */
export const SHAPE_FILLS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#ffffff', '#000000'];
export const NO_FILL = 'none';

const darker = (hex: string): string => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#2f528f';
  const value = parseInt(match[1]!, 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 0xff) * 0.7);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
};

const star = (cx: number, cy: number, outer: number, inner: number): string =>
  Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

/** The shape as an SVG document, at its own size in CSS pixels. */
export const shapeSvg = (id: ShapeId, fill: string, outline?: string): string => {
  const shape = SHAPES.find((one) => one.id === id)!;
  const { width: w, height: h } = shape;
  const line = outline ?? (fill === NO_FILL || fill === '#ffffff' ? '#404040' : darker(fill));
  const paint = `fill="${fill === NO_FILL ? 'none' : fill}" stroke="${line}" stroke-width="2"`;
  const inset = 2;
  const body: Record<ShapeId, string> = {
    rectangle: `<rect x="${inset}" y="${inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" ${paint}/>`,
    rounded: `<rect x="${inset}" y="${inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="18" ${paint}/>`,
    oval: `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - inset}" ry="${h / 2 - inset}" ${paint}/>`,
    triangle: `<polygon points="${w / 2},${inset} ${w - inset},${h - inset} ${inset},${h - inset}" ${paint}/>`,
    diamond: `<polygon points="${w / 2},${inset} ${w - inset},${h / 2} ${w / 2},${h - inset} ${inset},${h / 2}" ${paint}/>`,
    pentagon: `<polygon points="${w / 2},${inset} ${w - inset},${h * 0.38} ${w * 0.81},${h - inset} ${w * 0.19},${h - inset} ${inset},${h * 0.38}" ${paint}/>`,
    star: `<polygon points="${star(w / 2, h / 2 + 4, w / 2 - inset, w / 5)}" ${paint}/>`,
    arrow: `<polygon points="${inset},${h * 0.3} ${w * 0.62},${h * 0.3} ${w * 0.62},${inset} ${w - inset},${h / 2} ${w * 0.62},${h - inset} ${w * 0.62},${h * 0.7} ${inset},${h * 0.7}" ${paint}/>`,
    line: `<line x1="${inset}" y1="${h / 2}" x2="${w - inset}" y2="${h / 2}" stroke="${fill === NO_FILL || fill === '#ffffff' ? line : fill}" stroke-width="3"/>`,
    callout: `<path d="M ${inset + 12} ${inset} H ${w - inset - 12} Q ${w - inset} ${inset} ${w - inset} ${inset + 12} V ${h * 0.68} Q ${w - inset} ${h * 0.8} ${w - inset - 12} ${h * 0.8} H ${w * 0.42} L ${w * 0.22} ${h - inset} L ${w * 0.28} ${h * 0.8} H ${inset + 12} Q ${inset} ${h * 0.8} ${inset} ${h * 0.68} V ${inset + 12} Q ${inset} ${inset} ${inset + 12} ${inset} Z" ${paint}/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body[id]}</svg>`;
};

const svgDataUrl = (svg: string): string => `data:image/svg+xml;base64,${btoa(svg)}`;

/**
 * The shape as a PNG data URL at twice its size, or the SVG itself where this
 * machine cannot draw one (a test's DOM). A PNG is what the Word file and
 * every printer take.
 */
export const shapeDataUrl = async (id: ShapeId, fill: string): Promise<string> => {
  const shape = SHAPES.find((one) => one.id === id)!;
  const svg = svgDataUrl(shapeSvg(id, fill));
  try {
    const image = new Image();
    image.src = svg;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = shape.width * 2;
    canvas.height = shape.height * 2;
    const context = canvas.getContext('2d');
    if (!context) return svg;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    return png.startsWith('data:image/png') ? png : svg;
  } catch {
    return svg;
  }
};

/** Insert a shape at the cursor, at its own size. */
export const insertShape = async (editor: Editor, id: ShapeId, fill: string): Promise<void> => {
  const shape = SHAPES.find((one) => one.id === id)!;
  const src = await shapeDataUrl(id, fill);
  editor.chain().focus().setImage({ src, alt: shape.name, title: shape.name, width: shape.width }).run();
};
