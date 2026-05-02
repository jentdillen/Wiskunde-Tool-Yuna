-- Student anonymous auth binding + class capacity. Enable "Anonymous sign-ins" in Supabase Dashboard (Authentication → Providers).

-- ---------------------------------------------------------------------------
-- Teachers only: skip profile row for users without email (anonymous kids)
-- ---------------------------------------------------------------------------

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

  INSERT INTO public.teacher_profiles (user_id, full_name, school_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'school_name', '')
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Class capacity
-- ---------------------------------------------------------------------------

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS max_students integer NOT NULL DEFAULT 30
    CHECK (max_students >= 1 AND max_students <= 500);

COMMENT ON COLUMN public.classes.max_students IS 'Max number of student accounts (rows) for this class.';

-- ---------------------------------------------------------------------------
-- Link students to Supabase Auth (anonymous or future providers)
-- ---------------------------------------------------------------------------

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS students_auth_user_idx ON public.students (auth_user_id);

COMMENT ON COLUMN public.students.auth_user_id IS 'Set when the learner signs in; one auth user per student row.';

-- ---------------------------------------------------------------------------
-- Join: authenticated user only; enforces max_students and name binding
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.student_join_bound(p_class_id uuid, p_first_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  sid uuid;
  cap int;
  cnt int;
  v_name text := trim(p_first_name);
  existing_auth uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_class_id IS NULL OR length(v_name) < 1 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT c.max_students INTO cap FROM public.classes c WHERE c.id = p_class_id;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  SELECT s.id, s.auth_user_id INTO sid, existing_auth
  FROM public.students s
  WHERE s.class_id = p_class_id AND lower(trim(s.first_name)) = lower(v_name);

  IF sid IS NOT NULL THEN
    IF existing_auth IS NULL THEN
      UPDATE public.students SET auth_user_id = uid WHERE id = sid AND auth_user_id IS NULL;
      IF NOT FOUND THEN
        SELECT s.auth_user_id INTO existing_auth FROM public.students s WHERE s.id = sid;
        IF existing_auth IS NOT NULL AND existing_auth <> uid THEN
          RAISE EXCEPTION 'name_already_linked';
        END IF;
      END IF;
      RETURN sid;
    ELSIF existing_auth = uid THEN
      RETURN sid;
    ELSE
      RAISE EXCEPTION 'name_already_linked';
    END IF;
  END IF;

  SELECT count(*)::int INTO cnt FROM public.students WHERE class_id = p_class_id;
  IF cnt >= cap THEN
    RAISE EXCEPTION 'class_full';
  END IF;

  INSERT INTO public.students (class_id, first_name, auth_user_id)
  VALUES (p_class_id, v_name, uid)
  RETURNING id INTO sid;

  RETURN sid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_join_bound(uuid, text) TO authenticated;

-- Old path bypassed class cap — remove public access
DROP FUNCTION IF EXISTS public.ensure_student(uuid, text);

-- Only SECURITY DEFINER RPC may insert students now
DROP POLICY IF EXISTS students_insert_anon ON public.students;
DROP POLICY IF EXISTS students_insert_auth ON public.students;

-- Learners can read their own row (e.g. session checks)
CREATE POLICY students_select_own ON public.students FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
