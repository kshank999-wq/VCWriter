-- An episode as something a task can be about (addendum 07 §36): in a series
-- room the showrunner can give out a whole episode, as well as an act, a
-- scene, a beat or a piece of research.

alter type public.assignment_target add value if not exists 'episode';
