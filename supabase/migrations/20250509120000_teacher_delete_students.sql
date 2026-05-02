-- Teachers may remove learners from their classes (row deleted; learner must join again).
CREATE POLICY students_delete_teacher ON public.students FOR DELETE TO authenticated
  USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
