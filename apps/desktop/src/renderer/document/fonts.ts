import { useCallback, useEffect, useState } from 'react';

/**
 * **The font library** (addendum 42 §15): the faces Word users reach for,
 * grouped as Word's own font list groups them, and every font on this
 * computer on request.
 *
 * A face that is not installed is left out of the list rather than offered
 * and silently drawn in something else: which ones are here is measured, by
 * setting a line in the face and in its fallback and comparing the widths.
 * The whole of this machine's fonts come from the browser's Local Font Access
 * (`queryLocalFonts`), which asks the writer once in a browser and is allowed
 * in the app.
 */

export const FONT_GROUPS: { label: string; fonts: string[] }[] = [
  {
    label: 'Serif',
    fonts: ['Cambria', 'Times New Roman', 'Georgia', 'Garamond', 'Book Antiqua', 'Palatino', 'Palatino Linotype', 'Baskerville', 'Bookman Old Style', 'Century Schoolbook', 'Constantia', 'Didot', 'Hoefler Text', 'Rockwell', 'Sitka Text'],
  },
  {
    label: 'Sans serif',
    fonts: ['Calibri', 'Arial', 'Aptos', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Candara', 'Corbel', 'Gill Sans', 'Franklin Gothic Medium', 'Futura', 'Avenir', 'Optima', 'Century Gothic', 'Lucida Sans', 'Arial Narrow', 'Open Sans', 'Roboto', 'Lato'],
  },
  {
    label: 'Monospace',
    fonts: ['Courier New', 'Consolas', 'Menlo', 'Monaco', 'Lucida Console', 'Cascadia Code', 'Courier'],
  },
  {
    label: 'Script and display',
    fonts: ['Brush Script MT', 'Segoe Script', 'Lucida Handwriting', 'Comic Sans MS', 'Impact', 'Papyrus', 'Copperplate', 'Bradley Hand', 'Snell Roundhand', 'Chalkboard', 'Marker Felt', 'Arial Black'],
  },
];

export const ALL_LISTED_FONTS = FONT_GROUPS.flatMap((group) => group.fonts);

const SAMPLE = 'mmmmmmmmmmlli WQ@#0123456789';

/**
 * Whether a face is installed: the sample set in it measures differently from
 * the sample set in each generic fallback. Where nothing can be measured (a
 * test's DOM), every face counts as installed, so nothing is hidden by a lack
 * of evidence.
 */
export const fontInstalled = (() => {
  let context: CanvasRenderingContext2D | null | undefined;
  const cache = new Map<string, boolean>();
  return (font: string): boolean => {
    if (cache.has(font)) return cache.get(font)!;
    if (context === undefined) {
      try {
        context = document.createElement('canvas').getContext('2d');
      } catch {
        context = null;
      }
    }
    if (!context) return true;
    const width = (family: string) => {
      context!.font = `72px ${family}`;
      return context!.measureText(SAMPLE).width;
    };
    const installed = ['monospace', 'serif', 'sans-serif'].some((fallback) => width(`"${font}", ${fallback}`) !== width(fallback));
    cache.set(font, installed);
    return installed;
  };
})();

interface LocalFontData {
  family: string;
}

/** The fonts the writer has, grouped, and the whole of this computer's once asked for. */
export function useFontLibrary(): {
  groups: { label: string; fonts: string[] }[];
  local: string[] | null;
  canAskLocal: boolean;
  askLocal(): Promise<string | null>;
} {
  const [local, setLocal] = useState<string[] | null>(null);
  const [groups, setGroups] = useState(FONT_GROUPS);

  // Measured after the first paint, so opening the document is not held up.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setGroups(FONT_GROUPS.map((group) => ({ ...group, fonts: group.fonts.filter(fontInstalled) })).filter((group) => group.fonts.length > 0));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const query = (window as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> }).queryLocalFonts;

  const askLocal = useCallback(async (): Promise<string | null> => {
    if (!query) return 'This browser cannot list the fonts on this computer.';
    try {
      const fonts = await query();
      const families = [...new Set(fonts.map((font) => font.family))].sort((a, b) => a.localeCompare(b));
      setLocal(families);
      return families.length ? null : 'No fonts were listed. Allow access to fonts and try again.';
    } catch {
      return 'Access to the fonts on this computer was not allowed.';
    }
  }, [query]);

  return { groups, local, canAskLocal: Boolean(query), askLocal };
}
