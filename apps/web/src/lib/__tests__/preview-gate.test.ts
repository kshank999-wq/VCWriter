import { describe, expect, it } from 'vitest';
import { previewContentSecurityPolicy, previewRoute, previewSignIn } from '../preview-gate';

describe('the browser preview route', () => {
  it('sends the bare path to the slash form so relative assets resolve', () => {
    expect(previewRoute('/preview')).toEqual({ kind: 'redirect', to: '/preview/' });
  });

  it('serves the directory as its index page', () => {
    expect(previewRoute('/preview/')).toEqual({ kind: 'rewrite', to: '/preview/index.html' });
    expect(previewRoute('/preview/index.html')).toEqual({ kind: 'rewrite', to: '/preview/index.html' });
  });

  it('treats everything under it as an asset and nothing else as its business', () => {
    expect(previewRoute('/preview/assets/index-abc.js')).toEqual({ kind: 'asset' });
    expect(previewRoute('/previews')).toBeNull();
    expect(previewRoute('/')).toBeNull();
    expect(previewRoute('/admin')).toBeNull();
  });

  it('sends outsiders to sign in and back', () => {
    expect(previewSignIn).toBe('/signin?next=%2Fpreview%2F');
  });

  it('gives the bundle a self-only policy with no inline script', () => {
    expect(previewContentSecurityPolicy).toContain("script-src 'self'");
    expect(previewContentSecurityPolicy).not.toMatch(/script-src[^;]*(unsafe-inline|nonce)/);
    expect(previewContentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
