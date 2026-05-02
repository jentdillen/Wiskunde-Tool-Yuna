-- Teacher accounts, classes, missions, students — replaces session-code MVP.
-- Destructive: drops sessions / participants / old answers. Run on dev or after backup.

DROP TABLE IF EXISTS public.answers CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  school_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles (id) ON DELETE CASCADE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, label)
);

CREATE INDEX classes_teacher_idx ON public.classes (teacher_id);

CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  title text NOT NULL,
  max_number integer NOT NULL CHECK (max_number IN (10, 20, 100)),
  operation_mode text NOT NULL DEFAULT 'both',
  target_correct integer NOT NULL DEFAULT 20 CHECK (target_correct > 0 AND target_correct <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX missions_class_idx ON public.missions (class_id);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX students_class_first_lower ON public.students (class_id, lower(trim(first_name)));

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  a integer NOT NULL,
  b integer NOT NULL,
  op text NOT NULL,
  user_answer integer NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX answers_mission_idx ON public.answers (mission_id);
CREATE INDEX answers_student_idx ON public.answers (student_id);
CREATE INDEX answers_attempt_idx ON public.answers (attempt_id);

-- ---------------------------------------------------------------------------
-- Auth: profile row for each new user (metadata from signUp)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_teacher_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teacher_profiles (user_id, full_name, school_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'school_name', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_teacher ON auth.users;
CREATE TRIGGER on_auth_user_created_teacher
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_teacher_user();

-- ---------------------------------------------------------------------------
-- RPC: student join (school + class name) and ensure student row
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.ensure_student(p_class_id uuid, p_first_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
  v_name text := trim(p_first_name);
BEGIN
  IF p_class_id IS NULL OR length(v_name) < 1 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;

  SELECT s.id INTO sid
  FROM public.students s
  WHERE s.class_id = p_class_id
    AND lower(trim(s.first_name)) = lower(v_name);

  IF sid IS NOT NULL THEN
    RETURN sid;
  END IF;

  INSERT INTO public.students (class_id, first_name)
  VALUES (p_class_id, v_name)
  RETURNING id INTO sid;

  RETURN sid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_classes(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_student(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_student_answer_mission(p_mission uuid, p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    JOIN public.students s ON s.id = p_student
    WHERE m.id = p_mission AND s.class_id = m.class_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_student_answer_mission(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_mission_answer(
  p_mission_id uuid,
  p_student_id uuid,
  p_attempt_id uuid,
  p_a integer,
  p_b integer,
  p_op text,
  p_user_answer integer,
  p_is_correct boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.missions m
    JOIN public.students s ON s.id = p_student_id
    WHERE m.id = p_mission_id AND s.class_id = m.class_id
  ) THEN
    RAISE EXCEPTION 'Invalid mission or student' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.answers (
    mission_id, student_id, attempt_id, a, b, op, user_answer, is_correct
  ) VALUES (
    p_mission_id, p_student_id, p_attempt_id, p_a, p_b, p_op, p_user_answer, p_is_correct
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_mission_answer(
  uuid, uuid, uuid, integer, integer, text, integer, boolean
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tp_select ON public.teacher_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY tp_insert ON public.teacher_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY tp_update ON public.teacher_profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Teachers manage their classes
CREATE POLICY classes_all ON public.classes FOR ALL TO authenticated
  USING (
    teacher_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = (SELECT auth.uid()))
  );

-- Missions: teachers full access for their classes; anyone can read (UUID not guessable in practice)
CREATE POLICY missions_teacher_all ON public.missions FOR ALL TO authenticated
  USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY missions_select_anon ON public.missions FOR SELECT TO anon
  USING (true);

-- Students: teachers read their class students; anon insert only for existing class
CREATE POLICY students_select_teacher ON public.students FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY students_insert_anon ON public.students FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id));

CREATE POLICY students_insert_auth ON public.students FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id));

-- Answers: teachers read their missions; anon insert when student belongs to mission's class
CREATE POLICY answers_select_teacher ON public.answers FOR SELECT TO authenticated
  USING (
    mission_id IN (
      SELECT m.id FROM public.missions m
      JOIN public.classes c ON c.id = m.class_id
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY answers_insert_anon ON public.answers FOR INSERT TO anon
  WITH CHECK (public.can_student_answer_mission(mission_id, student_id));

CREATE POLICY answers_insert_auth ON public.answers FOR INSERT TO authenticated
  WITH CHECK (public.can_student_answer_mission(mission_id, student_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
