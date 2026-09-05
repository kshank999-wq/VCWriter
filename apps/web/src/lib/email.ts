import { Resend } from 'resend';
import type { Platform } from '@vcwriter/domain';
import { env } from './env';
import { adminClient } from './supabase';
import { licenseReminder, purchaseConfirmation, type RenderedEmail } from './email-templates';

/**
 * Transactional email (spec §12.3).
 *
 * Delivery outcomes are logged for support, with the template and its version,
 * so "which email did this customer actually get" is answerable. Message
 * bodies are not stored.
 *
 * A send failure must never fail the purchase: the license already exists and
 * the customer can always retrieve it from My Account, so the failure is
 * recorded and the caller carries on.
 */

interface SendResult {
  sent: boolean;
  error: string | null;
}

const deliver = async (input: {
  to: string;
  userId: string | null;
  email: RenderedEmail;
}): Promise<SendResult> => {
  const log = {
    user_id: input.userId,
    template: `${input.email.template}@${input.email.version}`,
    status: 'queued' as string,
    provider_message_id: null as string | null,
    error: null as string | null,
  };

  try {
    const resend = new Resend(env.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: env.resendFrom,
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
    });
    if (error) throw new Error(error.message);
    log.status = 'sent';
    log.provider_message_id = data?.id ?? null;
  } catch (cause) {
    log.status = 'failed';
    log.error = cause instanceof Error ? cause.message : String(cause);
  }

  await adminClient().from('email_events').insert(log);
  return { sent: log.status === 'sent', error: log.error };
};

export interface PurchaseEmailInput {
  to: string;
  userId: string;
  serial: string;
  platform: Platform | null;
}

export const sendPurchaseEmail = async (input: PurchaseEmailInput): Promise<SendResult> =>
  deliver({
    to: input.to,
    userId: input.userId,
    email: purchaseConfirmation({
      serial: input.serial,
      platform: input.platform,
      accountUrl: `${env.siteUrl}/account`,
    }),
  });

export const sendLicenseReminder = async (input: {
  to: string;
  userId: string;
  serial: string;
}): Promise<SendResult> =>
  deliver({
    to: input.to,
    userId: input.userId,
    email: licenseReminder({ serial: input.serial, accountUrl: `${env.siteUrl}/account` }),
  });
