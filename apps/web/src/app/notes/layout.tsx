import type { Metadata, Viewport } from 'next';
import { ServiceWorker } from './service-worker';

export const metadata: Metadata = {
  title: 'Notes',
  description: 'Capture ideas and scenes for VC Writer from your phone, online or off.',
  manifest: '/notes.webmanifest',
  appleWebApp: { capable: true, title: 'VC Writer Notes', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  // Installed to a home screen, the capture screen should behave like an app:
  // full height, no accidental zoom while dictating, safe areas respected.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b0d',
};

/**
 * No header, no footer, no nav.
 *
 * The phone app sits outside the `(site)` route group on purpose: installed to
 * a home screen it is the only thing on the screen, and the marketing chrome
 * cost half an iPhone's height — the Dictate button, which is what a voice
 * notebook is *for*, was below the fold before a writer had done anything.
 */
export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorker />
      <main>{children}</main>
    </>
  );
}
