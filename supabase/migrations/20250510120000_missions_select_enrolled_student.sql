-- Learners sign in with Anonymous auth → PostgREST role is `authenticated`, not `anon`.
-- `missions_select_anon` only applies to the anon key without a JWT, so enrolled students
-- had no SELECT policy on missions and saw an empty list.
CREATE POLICY missions_select_enrolled_student ON public.missions FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT s.class_id FROM public.students s
      WHERE s.auth_user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
