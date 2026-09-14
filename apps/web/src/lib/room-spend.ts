import {
  aiUsageSchema,
  capStanding,
  monthStart,
  spentSince,
  type AiUsage,
  type CapStanding,
} from '@vcwriter/domain';
import { adminClient, serverClient } from './supabase';

/**
 * What the room's AI has cost (addendum 07 §14, stage 13).
 *
 * The rules are in `@vcwriter/domain/spending`; this is the only place they
 * meet Supabase rows, and it keeps the module's standing split.
 *
 * **Reading acts as the visitor, recording acts as the server.** Anybody in the
 * room may see what the room is spending — a cap you can hit without seeing it
 * coming is the failure this stage exists to fix — so the read goes through the
 * caller's own session and RLS decides. The *write* has no policy at all: a
 * meter a client may write is not a meter, so rows come only from the route
 * that actually made the call, with the token counts the model reported.
 *
 * **Recording a reading never fails the reading.** The answer is already back
 * and a person is waiting for it; losing a row to a database hiccup costs the
 * room a few cents of accuracy, and turning a successful reading into an error
 * would cost them the reading they have already paid for. The failure is logged
 * and the caller carries on — the same trade `email.ts` makes with a purchase.
 */

interface UsageRow {
  id: string;
  room_id: string;
  user_id: string | null;
  reading: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  created_at: string;
}

const fromRow = (row: UsageRow): AiUsage =>
  aiUsageSchema.parse({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    reading: row.reading,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costCents: row.cost_cents,
    at: row.created_at,
  });

/**
 * What this room has spent since the first of the month.
 *
 * Summed here rather than in Postgres, and that is a deliberate and bounded
 * choice: the domain owns what *counts as* a month's spend, and a `sum()` in
 * SQL would be a second implementation of that in a second language. A month of
 * readings is tens of rows, not millions, and the query is already narrowed by
 * the index to one room and one month.
 */
export const spentThisMonth = async (roomId: string): Promise<number> => {
  const since = monthStart();
  const { data } = await serverClient()
    .from('room_ai_usage')
    .select('*')
    .eq('room_id', roomId)
    .gte('created_at', since);

  return spentSince(((data ?? []) as UsageRow[]).map(fromRow), since);
};

/** Where the room stands against its cap, ready to show or to refuse on. */
export const standingFor = async (input: {
  roomId: string;
  capCents: number | null;
}): Promise<CapStanding> =>
  capStanding({ spentCents: await spentThisMonth(input.roomId), capCents: input.capCents });

/** The recent readings, newest first — the breakdown behind the number. */
export const recentSpend = async (roomId: string, most = 20): Promise<AiUsage[]> => {
  const { data } = await serverClient()
    .from('room_ai_usage')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(most);

  return ((data ?? []) as UsageRow[]).map(fromRow);
};

/**
 * Put a reading on the meter.
 *
 * Called for every reading that reached the model, including the ones that came
 * back refused, cut off or unreadable — those spent the room's money too, and a
 * meter that counted only the successes would read low in exactly the month
 * somebody goes looking at it.
 */
export const recordSpend = async (input: {
  roomId: string;
  userId: string | null;
  reading: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}): Promise<void> => {
  const { error } = await adminClient().from('room_ai_usage').insert({
    room_id: input.roomId,
    user_id: input.userId,
    reading: input.reading,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_cents: input.costCents,
  });
  // Never thrown on: see the note at the top. The reading is already back.
  if (error) console.error(`Could not record AI spend for room ${input.roomId}: ${error.message}`);
};

/**
 * Set the room's cap. The showrunner's, like the switch beside it.
 *
 * Through the service role after the caller's role has been checked, for the
 * same reason the seat changes are: `rooms` is written by whoever may write the
 * project, and this is a decision about the room rather than about the script.
 */
export const setRoomCap = async (roomId: string, capCents: number | null): Promise<void> => {
  const { error } = await adminClient()
    .from('rooms')
    .update({ ai_cap_cents: capCents })
    .eq('id', roomId);
  if (error) throw new Error(error.message);
};
