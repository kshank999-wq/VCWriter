import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { licenseReminder, purchaseConfirmation } from '../email-templates';

/**
 * What a customer receives is a contract: the serial, the link, and a version
 * number that changes whenever the words or the look do, because that number
 * is what `email_events` records.
 *
 * Set EMAIL_PREVIEW_DIR to also write the rendered HTML out, for opening in a
 * browser — the only honest way to check an email template.
 */

const inputs = {
  serial: 'VCW-7Q2M4-K9RT3-X1PLD-A8N6C',
  accountUrl: 'https://vc-writer.com/account',
};

describe('email templates', () => {
  it('put the serial and the download link in both the HTML and the text', () => {
    for (const email of [
      purchaseConfirmation({ ...inputs, platform: 'windows' }),
      purchaseConfirmation({ ...inputs, platform: null }),
      licenseReminder(inputs),
    ]) {
      expect(email.html).toContain(inputs.serial);
      expect(email.html).toContain(inputs.accountUrl);
      expect(email.text).toContain(inputs.serial);
      expect(email.text).toContain(inputs.accountUrl);
    }
  });

  it('name the platform that was bought', () => {
    expect(purchaseConfirmation({ ...inputs, platform: 'macos' }).html).toContain('macOS');
    expect(purchaseConfirmation({ ...inputs, platform: 'windows' }).text).toContain('Windows 10 / 11');
  });

  it('carry the version the branded templates were introduced at', () => {
    // Bumped with the redesign so email_events can tell old sends from new.
    expect(purchaseConfirmation({ ...inputs, platform: null }).version).toBe(3);
    expect(licenseReminder(inputs).version).toBe(2);
  });

  it('use only inline styles, because email clients strip everything else', () => {
    const html = purchaseConfirmation({ ...inputs, platform: 'windows' }).html;
    expect(html).not.toContain('<style');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('class=');
  });

  it('write previews when asked', () => {
    const dir = process.env['EMAIL_PREVIEW_DIR'];
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/purchase-confirmation.html`, purchaseConfirmation({ ...inputs, platform: 'windows' }).html);
    writeFileSync(`${dir}/license-reminder.html`, licenseReminder(inputs).html);
  });
});
