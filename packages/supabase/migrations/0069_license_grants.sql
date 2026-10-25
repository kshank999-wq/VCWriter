-- Licences given rather than bought (addendum 44).
--
-- Two kinds, issued from the admin console: an **academic** licence handed to
-- a school, a class or a student, and the **master** licence the owner runs on
-- every computer they have. Both are ordinary `licenses` rows behind a $0
-- order — which is how a licence issued by hand has always been kept — so
-- activation, downloads, the desk's read-only rule and the account page read
-- them as they read any other. What this adds is the one thing that differs:
-- how a licence came to be, which decides how many computers it covers (a
-- master licence, any number; `seatLimit` in the domain says so in one place).
--
-- `grant_kind` is text with a check rather than an enum, for 0060's reason: a
-- value a newer build writes should not be refused by the type at the door of
-- an older one. Only the service role writes it, as with every licence column.

alter table public.licenses
  add column if not exists grant_kind text not null default 'purchase',
  add column if not exists granted_to text not null default '',
  add column if not exists granted_by uuid references public.profiles (id) on delete set null;

alter table public.licenses
  drop constraint if exists licenses_grant_kind_check;
alter table public.licenses
  add constraint licenses_grant_kind_check check (grant_kind in ('purchase', 'academic', 'master'));

-- The admin console lists given licences; and the foreign key wants its index.
create index if not exists licenses_grant_kind_idx
  on public.licenses (grant_kind)
  where grant_kind <> 'purchase';
create index if not exists licenses_granted_by_idx
  on public.licenses (granted_by)
  where granted_by is not null;

comment on column public.licenses.grant_kind is
  'How the licence came to be (addendum 44): purchase (bought once or by subscription), academic (a giveaway with a set number of computers, which may end on a date) or master (the owner''s own: any number of computers, never ends). Written only by the service role.';
comment on column public.licenses.granted_to is
  'Who or what a given licence is for: the school and course, or the person. Empty on a bought licence.';
comment on column public.licenses.granted_by is
  'The administrator who issued a given licence. Null on a bought one, or once that administrator''s account is gone.';
