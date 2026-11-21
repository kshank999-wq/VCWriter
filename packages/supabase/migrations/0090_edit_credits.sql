-- Edit credits for the AI deep check (addendum 47).
--
-- A ledger, not a balance column: every purchase, every check charged, every
-- refund is a row, and the balance is their sum. Counted in words (a credit is
-- 1,000). Rows are written only by the server (service role): a writer reads
-- their own and nothing else. Spending goes through `spend_edit_credits`, which
-- takes a per-writer lock so two checks started at once cannot both spend the
-- same words.

create table if not exists public.edit_credit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Positive for a purchase, grant or refund of a check; negative for a check or a reversed purchase.
  words integer not null,
  kind text not null check (kind in ('purchase', 'grant', 'check', 'refund', 'reversal')),
  pack text,
  amount_cents integer,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  -- What a check cost us, for the margin: the model's own token counts.
  input_tokens integer,
  output_tokens integer,
  cost_cents numeric(10, 4),
  note text not null default '',
  created_at timestamptz not null default now()
);

-- One purchase per checkout, however many times Stripe delivers it; one reversal per payment.
create unique index if not exists edit_credit_entries_checkout_once
  on public.edit_credit_entries (stripe_checkout_session_id) where kind = 'purchase';
create unique index if not exists edit_credit_entries_reversal_once
  on public.edit_credit_entries (stripe_payment_intent_id) where kind = 'reversal';
create index if not exists edit_credit_entries_user_idx on public.edit_credit_entries (user_id, created_at desc);

alter table public.edit_credit_entries enable row level security;

create policy edit_credit_entries_read on public.edit_credit_entries
  for select using (user_id = (select auth.uid()));

-- Spend `p_words` if the writer has them. Returns the new entry (null if the
-- balance was short) and the balance after.
create or replace function public.spend_edit_credits(p_user uuid, p_words integer, p_note text)
returns table (entry_id uuid, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  have integer;
begin
  if p_words <= 0 then
    raise exception 'A check spends a positive number of words.' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('edit-credits:' || p_user::text));
  select coalesce(sum(e.words), 0)::integer into have from public.edit_credit_entries e where e.user_id = p_user;
  if have < p_words then
    entry_id := null;
    balance := have;
    return next;
    return;
  end if;
  insert into public.edit_credit_entries (user_id, words, kind, note)
    values (p_user, -p_words, 'check', coalesce(p_note, ''))
    returning id into entry_id;
  balance := have - p_words;
  return next;
end;
$$;

revoke all on function public.spend_edit_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.spend_edit_credits(uuid, integer, text) to service_role;
