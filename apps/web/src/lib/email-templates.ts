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
 *
 * The look follows docs/brand.md within what email clients allow, which is
 * less than a browser: tables for layout, every style inline, solid colours
 * rather than gradients, no web fonts, no background images. A gold hairline
 * and letter-spaced capitals survive all of that; a sunburst does not.
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

// Brand tokens (docs/brand.md), as literals because email has no CSS variables.
const INK = '#070604';
const PANEL = '#100e09';
const BORDER = '#3a3018';
const GOLD = '#c9a45c';
const GOLD_DEEP = '#8a6f2f';
const RED = '#8b1c1c';
const TEXT = '#f1e7cf';
const MUTED = '#a3946f';

const DISPLAY = "Futura, 'Avenir Next', 'Century Gothic', 'Segoe UI', Helvetica, Arial, sans-serif";
const BODY = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const SITE = 'https://vc-writer.com';

/** Uppercase, letter-spaced, gold — the brand's heading voice, inline. */
const caps = (text: string, size: number, color: string = GOLD): string =>
  `<span style="font-family:${DISPLAY};font-size:${size}px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${color}">${text}</span>`;

/** The deco rule: gold over deeper gold, drawn as two table rows. */
const rule = (width: string = '100%'): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}" style="margin:0 auto">
    <tr><td style="height:1px;background:${GOLD};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="height:3px;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="height:1px;background:${GOLD_DEEP};font-size:0;line-height:0">&nbsp;</td></tr>
  </table>`;

/**
 * The outer document. A dark card on a dark page, so a client's dark mode
 * changes nothing: there is no light version to invert.
 */
const shell = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${INK}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${INK}">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding:8px 0 20px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- The hairline is a div, not a cell background: a cell
                       stretches to the row's height and the line would too. -->
                  <td style="width:28px;vertical-align:middle"><div style="height:1px;background:${GOLD};font-size:1px;line-height:1px">&nbsp;</div></td>
                  <td style="padding:0 14px;white-space:nowrap">${caps('VC Writer', 15)}</td>
                  <td style="width:28px;vertical-align:middle"><div style="height:1px;background:${GOLD};font-size:1px;line-height:1px">&nbsp;</div></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${PANEL};border:1px solid ${BORDER};border-top:2px solid ${GOLD};padding:36px 36px 32px">
              <h1 style="margin:0 0 22px;font-family:${DISPLAY};font-size:22px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;line-height:1.3;color:${GOLD}">${title}</h1>
              <div style="font-family:${BODY};font-size:16px;line-height:1.6;color:${TEXT}">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:26px 12px 8px">
              ${rule('72px')}
              <p style="margin:18px 0 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED}">
                VC Writer &middot; Windows 10, Windows 11 and macOS<br>
                <a href="${SITE}" style="color:${GOLD};text-decoration:none">vc-writer.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** The serial, in the framed marquee from the poster. */
const serialBlock = (serial: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0">
    <tr>
      <td style="background:${INK};border:1px solid ${GOLD_DEEP};padding:6px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="border:1px solid ${GOLD};padding:18px 16px">
              ${caps('Your license', 11, MUTED)}<br>
              <span style="display:inline-block;margin-top:8px;font-family:${DISPLAY};font-size:22px;font-weight:600;letter-spacing:0.12em;color:${TEXT}">${serial}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

/** A gold button. Bulletproof-enough: a table cell with a background, not a div. */
const primaryLink = (url: string, label: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px">
    <tr>
      <td style="background:${GOLD};border:1px solid ${GOLD_DEEP}">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:${DISPLAY};font-size:13px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${INK};text-decoration:none">${label}</a>
      </td>
    </tr>
  </table>`;

const note = (text: string): string =>
  `<p style="margin:0;font-family:${BODY};font-size:14px;line-height:1.6;color:${MUTED}">${text}</p>`;

/** The one red element per screen: a diamond before an aside. */
const diamond = `<span style="display:inline-block;width:8px;height:8px;background:${RED};border:1px solid ${GOLD};transform:rotate(45deg);margin:0 10px 1px 2px"></span>`;

export interface PurchaseEmailInput {
  serial: string;
  platform: Platform | null;
  accountUrl: string;
}

export const purchaseConfirmation = (input: PurchaseEmailInput): RenderedEmail => {
  const platformLine = input.platform
    ? `<p style="margin:0 0 8px">Your download for <strong style="color:${GOLD}">${PLATFORM_LABEL[input.platform]}</strong> is ready.</p>`
    : '<p style="margin:0 0 8px">Your downloads for Windows and macOS are ready.</p>';

  return {
    template: 'purchase_confirmation',
    version: 3,
    subject: 'Your VC Writer license and download',
    html: shell(
      'Thank you for buying VC Writer',
      `${platformLine}
       ${serialBlock(input.serial)}
       ${primaryLink(input.accountUrl, 'Go to your downloads')}
       ${note(`${diamond}Your license covers both platforms. Sign in at any time to re-download the current Windows or macOS build.`)}`,
    ),
    text: [
      'VC WRITER',
      '',
      'Thank you for buying VC Writer.',
      '',
      input.platform
        ? `Your download for ${PLATFORM_LABEL[input.platform]} is ready.`
        : 'Your downloads for Windows and macOS are ready.',
      '',
      `Your license: ${input.serial}`,
      '',
      `Downloads: ${input.accountUrl}`,
      '',
      'Your license covers both platforms. Sign in at any time to re-download the current build for either.',
      '',
      'vc-writer.com',
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
  version: 2,
  subject: 'Your VC Writer license',
  html: shell(
    'Here is your VC Writer license',
    `${serialBlock(input.serial)}
     ${primaryLink(input.accountUrl, 'Go to your downloads')}
     ${note(
       `${diamond}You asked for this from your account page. If that was not you, nothing has changed — this email only repeats a license you already own.`,
     )}`,
  ),
  text: [
    'VC WRITER',
    '',
    'Here is your VC Writer license.',
    '',
    `Your license: ${input.serial}`,
    '',
    `Downloads: ${input.accountUrl}`,
    '',
    'You asked for this from your account page. If that was not you, nothing has changed.',
    '',
    'vc-writer.com',
  ].join('\n'),
});
