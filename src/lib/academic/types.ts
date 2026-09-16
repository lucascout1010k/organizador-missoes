export type CourseStatus = "active" | "completed" | "archived";
export type PeriodStatus = "planned" | "active" | "completed" | "archived";
export type SubjectStatus = "active" | "completed" | "archived";
export type EventStatus = "planned" | "completed" | "cancelled";

export type AcademicCourse = {
  id: string;
  name: string;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
};

export type AcademicPeriod = {
  id: string;
  course_id: string;
  name: string;
  period_number: number | null;
  year: number | null;
  term: string | null;
  status: PeriodStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  period_id: string;
  name: string;
  code: string | null;
  status: SubjectStatus;
  created_at: string;
  updated_at: string;
};

export type ClassSession = {
  id: string;
  subject_id: string;
  title: string;
  class_date: string;
  notes: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  topics: string[];
  notes: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
};

export type ActionState = {
  error: string | null;
  success: string | null;
};

export const INITIAL_ACTION_STATE: ActionState = { error: null, success: null };

export const courseStatusLabels: Record<CourseStatus, string> = {
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado",
};

export const periodStatusLabels: Record<PeriodStatus, string> = {
  planned: "Planejado",
  active: "Ativo",
  completed: "Concluído",
  archived: "Arquivado",
};

export const subjectStatusLabels: Record<SubjectStatus, string> = {
  active: "Ativa",
  completed: "Concluída",
  archived: "Arquivada",
};

export const eventStatusLabels: Record<EventStatus, string> = {
  planned: "Planejada",
  completed: "Concluída",
  cancelled: "Cancelada",
};
