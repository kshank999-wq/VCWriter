import type { Metadata } from 'next';
import { PlatformChoice } from './platform-choice';

export const metadata: Metadata = {
  title: 'Buy & download',
  description: 'Buy VC Writer and download the Windows 10/11 or macOS installer.',
};

/**
 * Purchase-time platform choice (spec §3.2): the buyer must be able to pick
 * Windows or Mac without contacting support, and the choice is recorded with
 * the order.
 */
export default function DownloadPage() {
  return (
    <>
      <div className="hero">
        <h1>Buy VC Writer</h1>
        <p>Pick the platform you want to install on. Your license covers both, so you can switch later.</p>
      </div>
      <PlatformChoice />
    </>
  );
}
