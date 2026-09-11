import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { licenseReminder, purchaseConfirmation, roomInvitation } from '../email-templates';

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
    // 4 and 3: the illustrated logo replaced the text wordmark in the header.
    expect(purchaseConfirmation({ ...inputs, platform: null }).version).toBe(4);
    expect(licenseReminder(inputs).version).toBe(3);
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

/**
 * The invitation into a Writers Room (addendum 07 §14).
 *
 * What it must say is what the person is being asked to *be*: role and title
 * are different things (§6), and an invitation naming only one of them asks
 * somebody to accept a job nobody described.
 */
describe('the room invitation', () => {
  const invite = {
    roomName: 'Blackout',
    from: 'Ken Shank',
    roleName: 'Writer',
    acceptUrl: 'https://vc-writer.com/rooms/join/abc',
    expiresIn: '14 days',
  };

  it('names the room, who asked, and the link, in both the HTML and the text', () => {
    const email = roomInvitation({ ...invite, title: 'Staff Writer' });
    for (const body of [email.html, email.text]) {
      expect(body).toContain('Blackout');
      expect(body).toContain('Ken Shank');
      expect(body).toContain(invite.acceptUrl);
      expect(body).toContain('14 days');
    }
    expect(email.subject).toBe('Ken Shank has invited you into Blackout');
  });

  it('says the title and the role together, because they are not one thing', () => {
    expect(roomInvitation({ ...invite, title: 'Staff Writer' }).text).toContain('Staff Writer (Writer)');
  });

  it('says the role alone where no title was given, rather than empty brackets', () => {
    const email = roomInvitation({ ...invite, title: '  ' });
    expect(email.text).toContain('as Writer.');
    expect(email.text).not.toContain('()');
  });

  it('promises the one thing a writer needs to hear before accepting', () => {
    // §7: a room where everyone can read everyone's unfinished draft is a room
    // where nobody drafts, so the invitation says so up front.
    expect(roomInvitation({ ...invite, title: '' }).text).toContain('nobody else in the room sees');
  });
});
