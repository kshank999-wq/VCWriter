import { useEffect, useMemo, useRef, useState } from 'react';
import { PREVIEW_DEVICES, PREVIEW_SIZES, previewDocument, previewSections, type EbookPackage, type PreviewDevice } from '@vcwriter/domain';

/**
 * The device preview (addendum 23 §9): the package's own files in a frame
 * the size of a screen a reader holds, with the reader's type size in the
 * reader's hand and the sections turned one screen at a time.
 *
 * The frame shows the *file* the store will receive — `previewDocument`
 * inlines the stylesheet and puts the pictures back, and nothing else — so
 * a fault in the markup is seen here rather than on a customer's Kindle.
 * The screens are counted from the frame: a reflowable section is set in
 * columns the width of the device and the flow's scroll width says how
 * many there are. That is what a reading system does and not what any one
 * of them does exactly, and the foot of the panel says so.
 */

interface EbookPreviewProps {
  pkg: EbookPackage;
}

const FRAME_HEIGHT = 520;
const FRAME_WIDTH = 560;

export function EbookPreview({ pkg }: EbookPreviewProps) {
  const sections = useMemo(() => previewSections(pkg), [pkg]);
  const [deviceId, setDeviceId] = useState<string>(PREVIEW_DEVICES[0]!.id);
  const [size, setSize] = useState<number>(1);
  const [at, setAt] = useState(0);
  const [screen, setScreen] = useState(0);
  const [screens, setScreens] = useState(1);
  const frame = useRef<HTMLIFrameElement>(null);

  const device: PreviewDevice = PREVIEW_DEVICES.find((one) => one.id === deviceId) ?? PREVIEW_DEVICES[0]!;
  const section = sections[Math.min(at, Math.max(0, sections.length - 1))] ?? null;
  const html = useMemo(() => (section ? previewDocument(pkg, section.href, device, size) : null), [pkg, section, device, size]);
  const scale = Math.min(1, FRAME_HEIGHT / device.height, FRAME_WIDTH / device.width);

  // A new section or size starts at its first screen.
  useEffect(() => {
    setScreen(0);
  }, [html]);

  // The flow is turned by scrolling it a screen at a time; the count is its width.
  const measure = () => {
    const flow = frame.current?.contentDocument?.getElementById('flow');
    if (!flow) {
      setScreens(1);
      return;
    }
    setScreens(Math.max(1, Math.ceil(flow.scrollWidth / device.width - 0.01)));
  };
  useEffect(() => {
    const flow = frame.current?.contentDocument?.getElementById('flow');
    if (flow) flow.scrollLeft = screen * device.width;
  }, [screen, device.width, html]);

  const turn = (direction: -1 | 1) => {
    const next = screen + direction;
    if (next >= 0 && next < screens) {
      setScreen(next);
      return;
    }
    const nextSection = at + direction;
    if (nextSection >= 0 && nextSection < sections.length) setAt(nextSection);
  };

  return (
    <div className="ebook-preview">
      <div className="ebook-preview-bar">
        <label className="field">
          Device
          <select aria-label="Preview device" value={device.id} onChange={(event) => setDeviceId(event.target.value)}>
            {PREVIEW_DEVICES.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Section
          <select aria-label="Preview section" value={at} onChange={(event) => setAt(Number(event.target.value))}>
            {sections.map((one, index) => (
              <option key={one.href} value={index}>
                {one.title}
              </option>
            ))}
          </select>
        </label>
        {pkg.layout === 'reflowable' ? (
          <span className="ebook-preview-size" role="group" aria-label="Type size">
            <button type="button" className="tool" aria-label="Smaller type" disabled={PREVIEW_SIZES.indexOf(size) <= 0} onClick={() => setSize(PREVIEW_SIZES[PREVIEW_SIZES.indexOf(size) - 1] ?? size)}>
              A−
            </button>
            <span className="muted small">{Math.round(size * 100)}%</span>
            <button
              type="button"
              className="tool"
              aria-label="Larger type"
              disabled={PREVIEW_SIZES.indexOf(size) >= PREVIEW_SIZES.length - 1}
              onClick={() => setSize(PREVIEW_SIZES[PREVIEW_SIZES.indexOf(size) + 1] ?? size)}
            >
              A+
            </button>
          </span>
        ) : null}
        <span className="toolbar-spacer" />
        <button type="button" className="tool" aria-label="Previous screen" onClick={() => turn(-1)} disabled={screen === 0 && at === 0}>
          ‹
        </button>
        <span className="muted small ebook-preview-count">
          {pkg.layout === 'fixed' ? `Page ${at + 1} of ${sections.length}` : `Screen ${screen + 1} of ${screens}`}
        </span>
        <button
          type="button"
          className="tool"
          aria-label="Next screen"
          onClick={() => turn(1)}
          disabled={screen >= screens - 1 && at >= sections.length - 1}
        >
          ›
        </button>
      </div>
      <div className="ebook-preview-stage" style={{ height: Math.round(device.height * scale) + 24 }}>
        <div className="ebook-preview-device" style={{ width: device.width, height: device.height, transform: `scale(${scale})` }}>
          {html ? (
            <iframe
              ref={frame}
              title={`${device.name} preview`}
              sandbox="allow-same-origin"
              srcDoc={html}
              width={device.width}
              height={device.height}
              onLoad={measure}
            />
          ) : (
            <p className="muted small">Nothing to show.</p>
          )}
        </div>
      </div>
      <p className="muted small">
        {device.note}. {device.width} × {device.height} pixels as a reading app lays them out; a reader’s own pagination and face will differ, and this is
        the file the store receives rather than any one store’s rendering of it.
      </p>
    </div>
  );
}
