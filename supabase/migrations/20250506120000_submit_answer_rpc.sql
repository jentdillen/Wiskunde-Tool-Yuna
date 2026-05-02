-- Reliable answer insert for anonymous students: SECURITY DEFINER bypasses RLS on `answers`
-- while still verifying mission ↔ student class match.

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
    RAISE EXCEPTION 'Ongeldige missie of leerling' USING ERRCODE = '42501';
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

-- Refresh PostgREST schema cache (Supabase API ziet de functie daarna)
NOTIFY pgrst, 'reload schema';
