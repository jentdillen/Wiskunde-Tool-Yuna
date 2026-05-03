import type { OperationMode } from "@/lib/math";

export type TeacherProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  school_name: string;
  /** Aanspreekvorm voor leerlingen (DB: meester | juf). */
  address_as?: "meester" | "juf";
  created_at: string;
};

export type ClassRow = {
  id: string;
  teacher_id: string;
  label: string;
  /** Max learner accounts per class; default 30 if not yet migrated. */
  max_students?: number;
  created_at: string;
};

export type MissionRow = {
  id: string;
  class_id: string;
  title: string;
  max_number: 10 | 20 | 100;
  operation_mode: OperationMode;
  target_correct: number;
  created_at: string;
};

export type StudentRow = {
  id: string;
  class_id: string;
  first_name: string;
  auth_user_id: string | null;
  created_at: string;
};

export type AnswerRow = {
  id: string;
  mission_id: string;
  student_id: string;
  attempt_id: string;
  a: number;
  b: number;
  op: string;
  user_answer: number;
  is_correct: boolean;
  created_at: string;
};

export type ClassLookupRow = {
  class_id: string;
  class_label: string;
  school_name: string;
  teacher_name: string;
  /** Ontbreekt bij oude API; na migratie altijd aanwezig. */
  teacher_address_as?: "meester" | "juf";
};

export type StudentHelpRequestRow = {
  id: string;
  student_id: string;
  class_id: string;
  mission_id: string;
  attempt_id: string;
  question_key: string;
  status: "pending" | "on_way" | "dismissed";
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
};
