-- Spec §8.2: the writer's structural reading of a scene.
--
-- The Story Grid's question, asked of every scene: what is at stake, which
-- way does it move, where does it turn, why is the scene in the script, what
-- is being fought over. The AI pass proposes an answer; this column holds the
-- writer's, which is the one that counts and the one that works with no key
-- and no connection.
--
-- One jsonb column rather than five: it is five short strings, always read
-- and written whole with the scene, and nothing queries inside it.
alter table public.structural_units
  add column if not exists grid jsonb not null default '{}'::jsonb;
