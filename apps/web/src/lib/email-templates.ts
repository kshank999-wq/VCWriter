import type { Platform } from '@vcwriter/domain';

/**
 * Transactional email templates (spec §12.3: "templates should be versioned
 * and managed separately from application code where practical").
 *
 * They live in their own module with an explicit version on each, so a change
 * to what customers receive is a visible, reviewable diff and the version that
 * sent any given message is recorded in `email_events`. Moving them into the
 * database would buy editing without a deploy at the cost of losing that
 * review — worth doing when someone other than an engineer needs to edit them,
 * and not before.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  template: string;
  version: number;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: 'Windows 10 / 11',
  macos: 'macOS',
};

const shell = (title: string, body: string): string => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:560px">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${body}
  </div>
`;

const serialBlock = (serial: string): string => `
  <p style="margin:24px 0;padding:16px;background:#f4f4f5;border-radius:8px">
    <span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#52525b">Your license</span>
    <strong style="font-size:18px;letter-spacing:.06em">${serial}</strong>
  </p>
`;

const primaryLink = (url: string, label: string): string => `
  <p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">${label}</a></p>
`;

export interface PurchaseEmailInput {
  serial: string;
  platform: Platform | null;
  accountUrl: string;
}

export const purchaseConfirmation = (input: PurchaseEmailInput): RenderedEmail => {
  const platformLine = input.platform
    ? `<p>Your download for <strong>${PLATFORM_LABEL[input.platform]}</strong> is ready.</p>`
    : '<p>Your downloads for Windows and macOS are ready.</p>';

  return {
    template: 'purchase_confirmation',
    version: 2,
    subject: 'Your VC Writer license and download',
    html: shell(
      'Thank you for buying VC Writer',
      `${platformLine}
       ${serialBlock(input.serial)}
       ${primaryLink(input.accountUrl, 'Go to your downloads')}
       <p style="color:#52525b;font-size:14px">
         You can sign in at any time to re-download the current Windows or macOS build.
       </p>`,
    ),
    text: [
      'Thank you for buying VC Writer.',
      '',
      input.platform
        ? `Your download for ${PLATFORM_LABEL[input.platform]} is ready.`
        : 'Your downloads for Windows and macOS are ready.',
      '',
      `License: ${input.serial}`,
      '',
      `Downloads: ${input.accountUrl}`,
      '',
      'You can sign in at any time to re-download the current build for either platform.',
    ].join('\n'),
  };
};

export interface LicenseReminderInput {
  serial: string;
  accountUrl: string;
}

/** Sent when a customer asks for their license again from My Account. */
export const licenseReminder = (input: LicenseReminderInput): RenderedEmail => ({
  template: 'license_reminder',
  version: 1,
  subject: 'Your VC Writer license',
  html: shell(
    'Here is your VC Writer license',
    `${serialBlock(input.serial)}
     ${primaryLink(input.accountUrl, 'Go to your downloads')}
     <p style="color:#52525b;font-size:14px">
       You asked for this from your account page. If that was not you, nothing has changed — this email only
       repeats a license you already own.
     </p>`,
  ),
  text: [
    'Here is your VC Writer license.',
    '',
    `License: ${input.serial}`,
    '',
    `Downloads: ${input.accountUrl}`,
    '',
    'You asked for this from your account page. If that was not you, nothing has changed.',
  ].join('\n'),
});
