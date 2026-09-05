import { Resend } from 'resend';
import type { Platform } from '@vcwriter/domain';
import { env, SITE_NAME } from './env';
import { adminClient } from './supabase';

/**
 * Transactional email (spec §12.3).
 *
 * Delivery outcomes are logged for support; message bodies are not stored.
 * A send failure must never fail the purchase — the license already exists and
 * the customer can always retrieve it from My Account.
 */

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: 'Windows 10 / 11',
  macos: 'macOS',
};

export interface PurchaseEmailInput {
  to: string;
  userId: string;
  serial: string;
  platform: Platform | null;
}

const purchaseEmailHtml = ({ serial, platform }: Pick<PurchaseEmailInput, 'serial' | 'platform'>): string => {
  const downloadUrl = `${env.siteUrl}/account`;
  const platformLine = platform
    ? `<p>Your download for <strong>${PLATFORM_LABEL[platform]}</strong> is ready.</p>`
    : '<p>Your downloads for Windows and macOS are ready.</p>';
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111">
      <h1 style="font-size:20px;margin:0 0 16px">Thank you for buying ${SITE_NAME}</h1>
      ${platformLine}
      <p style="margin:24px 0;padding:16px;background:#f4f4f5;border-radius:8px">
        <span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#52525b">Your license</span>
        <strong style="font-size:18px;letter-spacing:.06em">${serial}</strong>
      </p>
      <p><a href="${downloadUrl}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">Go to your downloads</a></p>
      <p style="color:#52525b;font-size:14px">
        You can sign in at any time to re-download the current Windows or macOS build.
      </p>
    </div>
  `;
};

export const sendPurchaseEmail = async (input: PurchaseEmailInput): Promise<void> => {
  const client = adminClient();
  const logRow = {
    user_id: input.userId,
    template: 'purchase_confirmation',
    status: 'queued' as string,
    provider_message_id: null as string | null,
    error: null as string | null,
  };

  try {
    const resend = new Resend(env.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: env.resendFrom,
      to: input.to,
      subject: `Your ${SITE_NAME} license and download`,
      html: purchaseEmailHtml(input),
    });
    if (error) throw new Error(error.message);
    logRow.status = 'sent';
    logRow.provider_message_id = data?.id ?? null;
  } catch (cause) {
    logRow.status = 'failed';
    logRow.error = cause instanceof Error ? cause.message : String(cause);
  }

  await client.from('email_events').insert(logRow);
};
