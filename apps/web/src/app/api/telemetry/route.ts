import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sanitiseErrorReport, type ErrorReport } from '@vcwriter/domain';
import { adminClient, currentUser } from '@/lib/supabase';
import { RULES, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Error reports from the desktop application and the website (spec §14).
 *
 * The schema below is the whole contract: there is no field for project
 * content, and the table has no column for one. Everything that does arrive is
 * redacted again here — the sender is the least trusted half, and an older
 * build with a weaker redactor must not be able to write a file path into the
 * database.
 *
 * Reporting is opt-in in the desktop application and off by default.
 */
const bodySchema = z.object({
  appVersion: z.string().max(200).default(''),
  platform: z.string().max(200).default(''),
  osVersion: z.string().max(200).default(''),
  errorName: z.string().max(500).default('Error'),
  errorMessage: z.string().max(20_000).default(''),
  stack: z.string().max(50_000).default(''),
  surface: z.enum(['main', 'renderer', 'web']).default('main'),
});

export async function POST(request: Request): Promise<Response> {
  // Unauthenticated by design, so this is the one guard against a flood.
  const limited = await rateLimit(request, RULES.telemetry);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A report is required' }, { status: 400 });
  }

  const report: ErrorReport = sanitiseErrorReport(parsed.data);

  // A crash that happens before sign-in is still worth knowing about, so the
  // report is accepted without a user. Attribution is best-effort: whoever the
  // caller turns out to be, never who they claim to be.
  const userId = await resolveUserId(request);

  const { error } = await adminClient().from('error_reports').insert({
    user_id: userId,
    app_version: report.appVersion,
    platform: report.platform,
    os_version: report.osVersion,
    error_name: report.errorName,
    error_message: report.errorMessage,
    stack: report.stack,
    surface: report.surface,
  });

  if (error) {
    // Nothing the reporter can do about it, and a retry loop on a crash path
    // is worse than a lost report.
    return NextResponse.json({ received: false }, { status: 202 });
  }

  return NextResponse.json({ received: true }, { status: 202 });
}

const resolveUserId = async (request: Request): Promise<string | null> => {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    const { data } = await adminClient().auth.getUser(token);
    return data.user?.id ?? null;
  }
  try {
    const user = await currentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
};
