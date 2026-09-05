-- Records the destination the writer chose on the capture device.
--
-- `inference` holds what a classifier guessed; this holds what a person asked
-- for. Keeping them in separate columns is the point: the approval queue shows
-- a choice as a choice, and only ever presents a guess as a suggestion (§9).

alter table public.capture_items
  add column if not exists requested_routing jsonb;

comment on column public.capture_items.requested_routing is
  'Destination chosen by the writer when capturing: {kind, categoryKey}. Outranks inference.';
