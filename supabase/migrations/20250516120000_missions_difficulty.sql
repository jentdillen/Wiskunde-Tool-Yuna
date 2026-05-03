-- Moeilijkheidsgraad per missie: volgorde mini → grote → reuze planeet; leerling ontgrendelt per tier (>50% op vorige tier).

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy'
    CHECK (difficulty IN ('easy', 'medium', 'hard'));

COMMENT ON COLUMN public.missions.difficulty IS 'easy = mini planeet, medium = grote planeet, hard = reuze planeet.';

NOTIFY pgrst, 'reload schema';
