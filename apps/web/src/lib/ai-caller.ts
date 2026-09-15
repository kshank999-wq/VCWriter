import { adminClient, currentUser } from '@/lib/supabase';

/**
 * Who is asking an AI endpoint, and whether they may.
 *
 * Lifted out of `api/ai/scene-review` when the learning-aid endpoint needed
 * exactly the same three questions. **A copied predicate is a decision made
 * twice**, and the copy nobody updates is the one that lets an unlicensed
 * caller through six months from now — the same reasoning that collapsed
 * twelve inline format checks into `isProseFormat`.
 *
 * Authenticated two ways because three clients call it: a browser session
 * cookie for the website and the admin-gated preview, a bearer token from the
 * desktop application. Either way the caller must hold an active license —
 * every request costs real money, so entitlement is checked here rather than
 * trusted from the client (spec §12.1).
 */
export interface Caller {
  userId: string;
  entitled: boolean;
  /** The license question could not be put to the database at all. */
  unchecked?: true;
}

/**
 * An administrator is entitled without a license row: the people who build and
 * support VC Writer have no order behind them, and a feature they cannot try is
 * a feature nobody checks.
 */
export const resolveCaller = async (request: Request): Promise<Caller | null> => {
  const userId = await resolveUserId(request);
  if (!userId) return null;

  const client = adminClient();

  const { data: profile } = await client.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
  if (profile?.is_admin) return { userId, entitled: true };

  const { data: licenses, error } = await client
    .from('licenses')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1);
  // A database that cannot answer is not permission to spend; it is a no,
  // and it says which kind of no it is.
  if (error) return { userId, entitled: false, unchecked: true };

  return { userId, entitled: (licenses?.length ?? 0) > 0 };
};

const resolveUserId = async (request: Request): Promise<string | null> => {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    const { data } = await adminClient().auth.getUser(token);
    return data.user?.id ?? null;
  }
  const user = await currentUser();
  return user?.id ?? null;
};
