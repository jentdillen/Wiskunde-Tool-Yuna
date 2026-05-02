-- Looser matching for student join: school ignores extra spaces; class label ignores spaces (3OH = 3 OH).

CREATE OR REPLACE FUNCTION public.find_classes(p_school text, p_label text)
RETURNS TABLE (
  class_id uuid,
  class_label text,
  school_name text,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.label, tp.school_name, tp.full_name
  FROM public.classes c
  JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
  WHERE lower(trim(regexp_replace(tp.school_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(p_school, '\s+', ' ', 'g')))
    AND regexp_replace(lower(trim(c.label)), '\s', '', 'g') = regexp_replace(lower(trim(p_label)), '\s', '', 'g');
$$;
