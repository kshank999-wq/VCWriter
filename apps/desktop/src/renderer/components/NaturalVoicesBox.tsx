import type { NaturalVoicesState } from '../natural-voices';

/**
 * The natural voices, offered wherever VC Writer reads aloud (addendum 45 §8):
 * Read back, the Document workspace and the board player. They are the only
 * voices it reads in, so until they are downloaded this box is how reading
 * starts; once they are here it says so, with **Remove**.
 */
export function NaturalVoicesBox({ natural, compact = false }: { natural: NaturalVoicesState; compact?: boolean }) {
  if (!natural.available) {
    return (
      <p className="natural-voices muted small">
        Reading aloud uses VC Writer’s natural voices, which run in the desktop app. Download them once there.
      </p>
    );
  }
  return (
    <div className={`natural-voices${compact ? ' compact' : ''}`}>
      {natural.installed ? (
        compact ? null : (
          <p>
            <strong>Natural voices are installed.</strong>{' '}
            <span className="muted">
              Fourteen voices that sound like people, on this computer. They work offline and nothing you write is sent
              anywhere.
            </span>{' '}
            <button type="button" className="ghost small" onClick={() => void natural.remove()}>
              Remove
            </button>
          </p>
        )
      ) : natural.progress !== null ? (
        <p>
          Downloading natural voices… {Math.round(natural.progress * 100)}%
          <progress value={natural.progress} max={1} aria-label="Download progress" />
        </p>
      ) : (
        <p>
          <strong>Reading aloud needs the natural voices.</strong>{' '}
          <span className="muted">
            Download them once (about 100 MB, free). They run on this computer, work offline, and nothing you write is
            sent anywhere.
          </span>{' '}
          <button type="button" className="primary small" onClick={() => void natural.install()}>
            Get natural voices
          </button>
        </p>
      )}
      {natural.error ? <p className="notice">{natural.error}</p> : null}
    </div>
  );
}
