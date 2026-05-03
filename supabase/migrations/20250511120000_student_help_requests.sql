-- Leerling vraagt hulp na vast te zitten op een som; leerkracht bevestigt via dashboard (realtime naar leerling).

CREATE TABLE public.student_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  question_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'on_way', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE INDEX student_help_requests_class_pending_idx
  ON public.student_help_requests (class_id, status, created_at DESC);

CREATE INDEX student_help_requests_student_idx ON public.student_help_requests (student_id);

ALTER TABLE public.student_help_requests ENABLE ROW LEVEL SECURITY;

-- Leerling mag eigen hulpvragen aanmaken (mission hoort bij klas van leerling).
CREATE POLICY student_help_insert_own ON public.student_help_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      INNER JOIN public.missions m ON m.id = mission_id AND m.class_id = s.class_id
      WHERE s.id = student_id
        AND s.class_id = class_id
        AND s.auth_user_id = (SELECT auth.uid())
    )
  );

-- Leerling mag eigen rijen lezen (realtime status).
CREATE POLICY student_help_select_own ON public.student_help_requests FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s WHERE s.auth_user_id = (SELECT auth.uid())
    )
  );

-- Leerkracht: alle hulpvragen voor eigen klassen.
CREATE POLICY student_help_select_teacher ON public.student_help_requests FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      JOIN public.teacher_profiles tp ON tp.id = c.teacher_id
      WHERE tp.user_id = (SELECT auth.uid())
    )
  );

-- Alleen leerkracht mag status zetten (o.a. on_way).
CREATE POLICY student_help_update_teacher ON public.student_help_requests FOR UPDATE TO authenticated
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.student_help_requests;

NOTIFY pgrst, 'reload schema';
