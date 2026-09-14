import { Resend } from 'resend';
import { WHY_THIS_ARRIVED, type Notice, type Platform } from '@vcwriter/domain';
import { env } from './env';
import { adminClient } from './supabase';
import {
  licenseReminder,
  purchaseConfirmation,
  roomInvitation,
  roomNotice,
  type RenderedEmail,
} from './email-templates';

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

/**
 * An invitation into a Writers Room (addendum 07 §14).
 *
 * Recorded like every other send, and a failure never fails the invitation:
 * the seat already exists and the showrunner can send the link again, so a
 * Resend outage costs a resend rather than the room.
 */
export const sendRoomInvitation = async (input: {
  to: string;
  roomName: string;
  from: string;
  title: string;
  roleName: string;
  acceptUrl: string;
  expiresIn: string;
}): Promise<SendResult> =>
  deliver({
    to: input.to,
    // Nobody has an account behind this address yet — that is what accepting is.
    userId: null,
    email: roomInvitation({
      roomName: input.roomName,
      from: input.from,
      title: input.title,
      roleName: input.roleName,
      acceptUrl: input.acceptUrl,
      expiresIn: input.expiresIn,
    }),
  });

/**
 * Tell somebody the room addressed them (addendum 07 §14, stage 14).
 *
 * **Who and what are `notify.ts`'s** — whether this seat may be written to, and
 * the sentence. This only posts it, so the rules stay testable and there is one
 * place that decides them.
 *
 * **A send failure never fails the act.** The comment is said, the assignment
 * is made, the submission is decided; the room already shows all three, and
 * turning a database write into an error because Resend was down would lose the
 * work to protect the notification. Same trade as a purchase, for the same
 * reason, and the failure is recorded in `email_events` either way.
 */
export const sendRoomNotice = async (notice: Notice): Promise<SendResult> =>
  deliver({
    to: notice.to.email,
    userId: notice.to.userId,
    email: roomNotice({
      roomName: notice.subject,
      subject: notice.subject,
      line: notice.line,
      said: notice.said,
      roomUrl: `${env.siteUrl}${notice.path}`,
      why: WHY_THIS_ARRIVED,
    }),
  });

/**
 * Post a batch of them without letting one failure stop the rest.
 *
 * A comment naming four people must not tell three of them because the fourth
 * address bounced.
 */
export const sendRoomNotices = async (notices: readonly Notice[]): Promise<void> => {
  await Promise.allSettled(notices.map((notice) => sendRoomNotice(notice)));
};
