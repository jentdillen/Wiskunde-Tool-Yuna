-- Hoe leerlingen de leerkracht aanspreken (meester / juf); gebruikt in find_classes en leerling-UI.

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS address_as text NOT NULL DEFAULT 'juf'
    CHECK (address_as IN ('meester', 'juf'));

COMMENT ON COLUMN public.teacher_profiles.address_as IS 'Aanspreekvorm voor leerlingen: meester of juf.';

CREATE OR REPLACE FUNCTION public.handle_new_teacher_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR length(trim(COALESCE(NEW.email, ''))) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.teacher_profiles (user_id, full_name, school_name, address_as)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'school_name', ''),
    CASE
      WHEN lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'address_as', ''))) = 'meester' THEN 'meester'::text
      ELSE 'juf'::text
    END
  );
  RETURN NEW;
END;
$$;

-- Nieuwe OUT-kolom: return type wijzigen gaat niet met CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.find_classes(text, text);

CREATE OR REPLACE FUNCTION public.find_classes(p_school text, p_label text)
RETURNS TABLE (
  class_id uuid,
  class_label text,
  school_name text,
  teacher_name text,
  teacher_address_as text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.label, tp.school_name, tp.full_name, tp.address_as
  FROM public.classes c
  JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
  WHERE lower(trim(regexp_replace(tp.school_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(p_school, '\s+', ' ', 'g')))
    AND regexp_replace(lower(trim(c.label)), '\s', '', 'g') = regexp_replace(lower(trim(p_label)), '\s', '', 'g');
$$;

GRANT EXECUTE ON FUNCTION public.find_classes(text, text) TO anon, authenticated;
