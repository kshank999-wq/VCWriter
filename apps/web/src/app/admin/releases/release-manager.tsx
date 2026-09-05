'use client';

import { useState } from 'react';
import type { Platform } from '@vcwriter/domain';

export interface ReleaseBuildRow {
  id: string;
  platform: Platform;
  version: string;
  channel: 'stable' | 'beta' | 'internal';
  minimum_os_version: string;
  release_notes: string;
  artifact_key: string;
  artifact_size_bytes: number;
  sha256: string;
  active: boolean;
  published_at: string | null;
  created_at: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: 'Windows 10 / 11',
  macos: 'macOS',
};

const formatBytes = (bytes: number): string =>
  bytes === 0 ? '—' : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function ReleaseManager({ initialBuilds }: { initialBuilds: ReleaseBuildRow[] }) {
  const [builds, setBuilds] = useState(initialBuilds);
  const [platform, setPlatform] = useState<Platform>('windows');
  const [version, setVersion] = useState('');
  const [channel, setChannel] = useState<'stable' | 'beta' | 'internal'>('internal');
  const [minimumOsVersion, setMinimumOsVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [sha256, setSha256] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const response = await fetch('/api/admin/releases');
    const payload = (await response.json()) as { builds?: ReleaseBuildRow[] };
    if (payload.builds) setBuilds(payload.builds);
  };

  /**
   * The installer goes straight from this page to storage with a signed URL:
   * a hundred-megabyte file cannot pass through a serverless request body, and
   * routing it through one would fail only for the largest builds — the ones
   * that matter.
   */
  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || version.trim().length === 0) return;

    setBusy('upload');
    setError(null);
    setMessage(null);

    try {
      const urlResponse = await fetch('/api/admin/releases', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform, version: version.trim(), fileName: file.name }),
      });
      const urlPayload = (await urlResponse.json()) as {
        artifactKey?: string;
        signedUrl?: string;
        error?: string;
      };
      if (!urlResponse.ok || !urlPayload.signedUrl || !urlPayload.artifactKey) {
        throw new Error(urlPayload.error ?? 'The upload could not be prepared');
      }

      const upload = await fetch(urlPayload.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!upload.ok) throw new Error(`The installer failed to upload (${upload.status})`);

      setBusy('record');
      const recordResponse = await fetch('/api/admin/releases', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platform,
          version: version.trim(),
          channel,
          minimumOsVersion,
          releaseNotes,
          artifactKey: urlPayload.artifactKey,
          artifactSizeBytes: file.size,
          sha256: sha256.trim(),
        }),
      });
      const recordPayload = (await recordResponse.json()) as { error?: string };
      if (!recordResponse.ok) throw new Error(recordPayload.error ?? 'The build could not be recorded');

      setMessage(`${PLATFORM_LABEL[platform]} ${version} uploaded. It is not live until you activate it.`);
      setFile(null);
      setVersion('');
      setSha256('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publishing failed');
    } finally {
      setBusy(null);
    }
  };

  const setActive = async (build: ReleaseBuildRow, active: boolean) => {
    setBusy(build.id);
    setError(null);
    const response = await fetch(`/api/admin/releases/${build.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setBusy(null);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? 'That build could not be changed');
      return;
    }
    setMessage(
      active
        ? `${PLATFORM_LABEL[build.platform]} ${build.version} is now the ${build.channel} build customers receive.`
        : `${PLATFORM_LABEL[build.platform]} ${build.version} retired.`,
    );
    await refresh();
  };

  const live = (target: Platform) =>
    builds.find((build) => build.platform === target && build.channel === 'stable' && build.active);

  return (
    <>
      <section>
        <h2>Serving now</h2>
        <div className="grid">
          {(['windows', 'macos'] as const).map((target) => {
            const current = live(target);
            return (
              <article key={target} className="card">
                <h3>{PLATFORM_LABEL[target]}</h3>
                <p>
                  {current ? (
                    <>
                      Version {current.version}
                      {current.minimum_os_version ? ` · requires ${current.minimum_os_version} or later` : ''}
                    </>
                  ) : (
                    'No stable build published yet.'
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Publish a build</h2>
        <form onSubmit={publish} className="release-form">
          <label className="field">
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
            </select>
          </label>

          <label className="field">
            <span>Version</span>
            <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.0" required />
          </label>

          <label className="field">
            <span>Channel</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}>
              <option value="internal">Internal</option>
              <option value="beta">Beta</option>
              <option value="stable">Stable</option>
            </select>
          </label>

          <label className="field">
            <span>Minimum OS</span>
            <input
              value={minimumOsVersion}
              onChange={(event) => setMinimumOsVersion(event.target.value)}
              placeholder={platform === 'macos' ? '11.0' : '10.0.19041'}
            />
          </label>

          <label className="field wide">
            <span>Installer</span>
            <input
              type="file"
              accept=".exe,.dmg,.zip,.msi"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>

          <label className="field wide">
            <span>SHA-256 (from the build workflow&rsquo;s output)</span>
            <input value={sha256} onChange={(event) => setSha256(event.target.value)} placeholder="optional" />
          </label>

          <label className="field wide">
            <span>Release notes</span>
            <textarea
              rows={5}
              value={releaseNotes}
              onChange={(event) => setReleaseNotes(event.target.value)}
              placeholder="What changed in this build"
            />
          </label>

          <button type="submit" className="button" disabled={busy !== null || !file}>
            {busy === 'upload' ? 'Uploading…' : busy === 'record' ? 'Recording…' : 'Upload build'}
          </button>
        </form>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="notice">{message}</p> : null}
      </section>

      <section>
        <h2>All builds</h2>
        {builds.length === 0 ? (
          <p className="lede">Nothing published yet.</p>
        ) : (
          <ul className="build-list">
            {builds.map((build) => (
              <li key={build.id} className="card">
                <div className="build-row">
                  <div>
                    <strong>
                      {PLATFORM_LABEL[build.platform]} {build.version}
                    </strong>
                    <p className="lede">
                      {build.channel}
                      {build.active ? ' · live' : ''}
                      {build.minimum_os_version ? ` · min ${build.minimum_os_version}` : ''} ·{' '}
                      {formatBytes(build.artifact_size_bytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={build.active ? 'button secondary' : 'button'}
                    disabled={busy !== null}
                    onClick={() => void setActive(build, !build.active)}
                  >
                    {build.active ? 'Retire' : 'Make live'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
