import { useRef } from 'react';
import { BAND_SLOTS, HEADER_FOOTER_FIELDS, type BandSlot, type DocumentHeaderFooter } from '@vcwriter/domain';

/**
 * **Header & footer** (addendum 42 §15): the bar under the ribbon where a
 * document's running heads are written, as Word's Header & Footer tab is.
 *
 * Three boxes a band, left, centre and right, which is where Word's default
 * header puts its tab stops. A field (page number, number of pages, title,
 * date) goes in at the cursor of the box last typed in, and is filled in on
 * each page as it prints.
 */

const SLOT_NAMES: Record<BandSlot, string> = { left: 'left', center: 'centre', right: 'right' };

interface HeaderFooterBarProps {
  value: DocumentHeaderFooter;
  readOnly: boolean;
  onChange(patch: { header?: Partial<DocumentHeaderFooter['header']>; footer?: Partial<DocumentHeaderFooter['footer']>; firstPage?: boolean }): void;
  onClose(): void;
}

export function HeaderFooterBar({ value, readOnly, onChange, onClose }: HeaderFooterBarProps) {
  // The box a field goes into, and where in it: the last one typed in.
  const last = useRef<{ band: 'header' | 'footer'; slot: BandSlot; input: HTMLInputElement } | null>(null);

  const insertField = (token: string) => {
    const target = last.current ?? null;
    const band = target?.band ?? 'footer';
    const slot = target?.slot ?? 'center';
    const current = value[band][slot];
    const at = target?.input.selectionStart ?? current.length;
    const end = target?.input.selectionEnd ?? at;
    const next = `${current.slice(0, at)}${token}${current.slice(end)}`;
    onChange({ [band]: { [slot]: next } });
    // Back to the box, after the field.
    requestAnimationFrame(() => {
      const input = target?.input;
      if (!input) return;
      input.focus();
      input.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <section className="wp-hf" aria-label="Header and footer">
      {(['header', 'footer'] as const).map((band) => (
        <div key={band} className="wp-hf-band">
          <span className="wp-hf-name">{band === 'header' ? 'Header' : 'Footer'}</span>
          {BAND_SLOTS.map((slot) => (
            <input
              key={slot}
              aria-label={`${band === 'header' ? 'Header' : 'Footer'}, ${SLOT_NAMES[slot]}`}
              placeholder={SLOT_NAMES[slot]}
              className={`wp-hf-slot ${slot}`}
              value={value[band][slot]}
              disabled={readOnly}
              onFocus={(event) => {
                last.current = { band, slot, input: event.currentTarget };
              }}
              onChange={(event) => onChange({ [band]: { [slot]: event.target.value } })}
            />
          ))}
        </div>
      ))}
      <div className="wp-hf-tools">
        <span className="muted small">Insert:</span>
        {HEADER_FOOTER_FIELDS.map((field) => (
          <button
            key={field.token}
            type="button"
            className="ghost small"
            disabled={readOnly}
            title={`Put ${field.token} where the cursor was: filled in on each page`}
            // Mouse-down, so the box keeps its cursor.
            onMouseDown={(event) => {
              event.preventDefault();
              insertField(field.token);
            }}
          >
            {field.name}
          </button>
        ))}
        <label className="wp-hf-first">
          <input
            type="checkbox"
            checked={value.firstPage}
            disabled={readOnly}
            onChange={(event) => onChange({ firstPage: event.target.checked })}
          />
          On the first page too
        </label>
        <span className="spacer" />
        <button type="button" className="ghost small" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
