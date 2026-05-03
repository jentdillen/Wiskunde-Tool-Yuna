-- Fix ambiguous class_id/mission_id in RLS (42702). Run if the table already exists but policies failed.
-- Safe to run multiple times.

DROP POLICY IF EXISTS student_help_insert_own ON public.student_help_requests;
DROP POLICY IF EXISTS student_help_select_own ON public.student_help_requests;
DROP POLICY IF EXISTS student_help_select_teacher ON public.student_help_requests;
DROP POLICY IF EXISTS student_help_update_teacher ON public.student_help_requests;

CREATE POLICY student_help_insert_own ON public.student_help_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      INNER JOIN public.missions m
        ON m.id = student_help_requests.mission_id
       AND m.class_id = s.class_id
      WHERE s.id = student_help_requests.student_id
        AND s.class_id = student_help_requests.class_id
        AND s.auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY student_help_select_own ON public.student_help_requests FOR SELECT TO authenticated
  USING (
    student_help_requests.student_id IN (
      SELECT s.id FROM public.students s WHERE s.auth_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY student_help_select_teacher ON public.student_help_requests FOR SELECT TO authenticated
  USING (
    student_help_requests.class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY student_help_update_teacher ON public.student_help_requests FOR UPDATE TO authenticated
  USING (
    student_help_requests.class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    student_help_requests.class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
