-- Fix: anon could not INSERT answers because WITH CHECK subquery read `students`
-- without SELECT permission. Use a security definer helper instead.

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

DROP POLICY IF EXISTS answers_insert_anon ON public.answers;
DROP POLICY IF EXISTS answers_insert_auth ON public.answers;

CREATE POLICY answers_insert_anon ON public.answers FOR INSERT TO anon
  WITH CHECK (public.can_student_answer_mission(mission_id, student_id));

CREATE POLICY answers_insert_auth ON public.answers FOR INSERT TO authenticated
  WITH CHECK (public.can_student_answer_mission(mission_id, student_id));
