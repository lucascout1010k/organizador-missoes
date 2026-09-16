"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedAcademicClient } from "@/lib/academic/data";
import type { ActionState } from "@/lib/academic/types";
import {
  courseStatuses,
  eventStatuses,
  periodStatuses,
  readEnum,
  readId,
  readIsoDateTime,
  readOptionalDate,
  readOptionalInteger,
  readOptionalText,
  readRequiredText,
  readTopics,
  subjectStatuses,
} from "@/lib/academic/validation";

const INVALID_FIELDS = "Revise os campos destacados e tente novamente.";
const SAVE_ERROR = "Não foi possível salvar. Tente novamente.";

function ok(message: string): ActionState {
  return { error: null, success: message };
}

function fail(message = INVALID_FIELDS): ActionState {
  return { error: message, success: null };
}

function refreshAcademic(...paths: string[]) {
  revalidatePath("/");
  revalidatePath("/faculdade");
  revalidatePath("/faculdade/historico");
  paths.forEach((path) => revalidatePath(path));
}

export async function createCourse(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = readRequiredText(formData.get("name"), 200);
  const status = readEnum(formData.get("status"), courseStatuses);
  if (!name || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { error } = await supabase
    .from("academic_courses")
    .insert({ name, status, user_id: userId });

  if (error) return fail(SAVE_ERROR);
  refreshAcademic();
  return ok("Curso criado com sucesso.");
}

export async function updateCourse(
  courseIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = readId(courseIdValue);
  const name = readRequiredText(formData.get("name"), 200);
  const status = readEnum(formData.get("status"), courseStatuses);
  if (!courseId || !name || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { data, error } = await supabase
    .from("academic_courses")
    .update({ name, status })
    .eq("id", courseId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return fail(SAVE_ERROR);
  if (!data) return fail("Curso não encontrado ou sem acesso.");
  refreshAcademic();
  return ok("Curso atualizado.");
}

export async function createPeriod(
  courseIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = readId(courseIdValue);
  const name = readRequiredText(formData.get("name"), 200);
  const periodNumber = readOptionalInteger(formData.get("period_number"), 1, 32767);
  const year = readOptionalInteger(formData.get("year"), 1, 9999);
  const term = readOptionalText(formData.get("term"), 100);
  const status = readEnum(formData.get("status"), periodStatuses);
  const startDate = readOptionalDate(formData.get("start_date"));
  const endDate = readOptionalDate(formData.get("end_date"));

  if (
    !courseId ||
    !name ||
    periodNumber === null ||
    year === null ||
    term === null ||
    !status ||
    startDate === null ||
    endDate === null ||
    (startDate && endDate && endDate < startDate)
  ) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { error } = await supabase.from("academic_periods").insert({
    course_id: courseId,
    end_date: endDate ?? null,
    name,
    period_number: periodNumber ?? null,
    start_date: startDate ?? null,
    status,
    term: term ?? null,
    user_id: userId,
    year: year ?? null,
  });

  if (error) return fail(SAVE_ERROR);
  refreshAcademic();
  return ok("Período criado com sucesso.");
}

export async function updatePeriod(
  periodIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const periodId = readId(periodIdValue);
  const name = readRequiredText(formData.get("name"), 200);
  const periodNumber = readOptionalInteger(formData.get("period_number"), 1, 32767);
  const year = readOptionalInteger(formData.get("year"), 1, 9999);
  const term = readOptionalText(formData.get("term"), 100);
  const status = readEnum(formData.get("status"), periodStatuses);
  const startDate = readOptionalDate(formData.get("start_date"));
  const endDate = readOptionalDate(formData.get("end_date"));

  if (
    !periodId ||
    !name ||
    periodNumber === null ||
    year === null ||
    term === null ||
    !status ||
    startDate === null ||
    endDate === null ||
    (startDate && endDate && endDate < startDate)
  ) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { data, error } = await supabase
    .from("academic_periods")
    .update({
      end_date: endDate ?? null,
      name,
      period_number: periodNumber ?? null,
      start_date: startDate ?? null,
      status,
      term: term ?? null,
      year: year ?? null,
    })
    .eq("id", periodId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return fail(SAVE_ERROR);
  if (!data) return fail("Período não encontrado ou sem acesso.");
  refreshAcademic(`/faculdade/periodos/${periodId}`);
  return ok("Período atualizado.");
}

export async function createSubject(
  periodIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const periodId = readId(periodIdValue);
  const name = readRequiredText(formData.get("name"), 200);
  const code = readOptionalText(formData.get("code"), 50);
  const status = readEnum(formData.get("status"), subjectStatuses);
  if (!periodId || !name || code === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { error } = await supabase.from("subjects").insert({
    code: code ?? null,
    name,
    period_id: periodId,
    status,
    user_id: userId,
  });

  if (error) return fail(SAVE_ERROR);
  refreshAcademic(`/faculdade/periodos/${periodId}`);
  return ok("Matéria criada com sucesso.");
}

export async function updateSubject(
  subjectIdValue: string,
  periodIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subjectId = readId(subjectIdValue);
  const periodId = readId(periodIdValue);
  const name = readRequiredText(formData.get("name"), 200);
  const code = readOptionalText(formData.get("code"), 50);
  const status = readEnum(formData.get("status"), subjectStatuses);
  if (!subjectId || !periodId || !name || code === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { data, error } = await supabase
    .from("subjects")
    .update({ code: code ?? null, name, status })
    .eq("id", subjectId)
    .eq("period_id", periodId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return fail(SAVE_ERROR);
  if (!data) return fail("Matéria não encontrada ou sem acesso.");
  refreshAcademic(`/faculdade/periodos/${periodId}`, `/faculdade/materias/${subjectId}`);
  return ok("Matéria atualizada.");
}

export async function createClassSession(
  subjectIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subjectId = readId(subjectIdValue);
  const title = readRequiredText(formData.get("title"), 200);
  const classDate = readIsoDateTime(formData.get("class_date"));
  const notes = readOptionalText(formData.get("notes"), 20000);
  const status = readEnum(formData.get("status"), eventStatuses);
  if (!subjectId || !title || !classDate || notes === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { error } = await supabase.from("class_sessions").insert({
    class_date: classDate,
    notes: notes ?? null,
    status,
    subject_id: subjectId,
    title,
    user_id: userId,
  });

  if (error) return fail(SAVE_ERROR);
  refreshAcademic(`/faculdade/materias/${subjectId}`);
  return ok("Aula cadastrada.");
}

export async function updateClassSession(
  classIdValue: string,
  subjectIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const classId = readId(classIdValue);
  const subjectId = readId(subjectIdValue);
  const title = readRequiredText(formData.get("title"), 200);
  const classDate = readIsoDateTime(formData.get("class_date"));
  const notes = readOptionalText(formData.get("notes"), 20000);
  const status = readEnum(formData.get("status"), eventStatuses);
  if (!classId || !subjectId || !title || !classDate || notes === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({ class_date: classDate, notes: notes ?? null, status, title })
    .eq("id", classId)
    .eq("subject_id", subjectId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return fail(SAVE_ERROR);
  if (!data) return fail("Aula não encontrada ou sem acesso.");
  refreshAcademic(`/faculdade/materias/${subjectId}`);
  return ok("Aula atualizada.");
}

export async function createExam(
  subjectIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subjectId = readId(subjectIdValue);
  const title = readRequiredText(formData.get("title"), 200);
  const examDate = readIsoDateTime(formData.get("exam_date"));
  const topics = readTopics(formData.get("topics"));
  const notes = readOptionalText(formData.get("notes"), 20000);
  const status = readEnum(formData.get("status"), eventStatuses);
  if (!subjectId || !title || !examDate || !topics || notes === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { error } = await supabase.from("exams").insert({
    exam_date: examDate,
    notes: notes ?? null,
    status,
    subject_id: subjectId,
    title,
    topics,
    user_id: userId,
  });

  if (error) return fail(SAVE_ERROR);
  refreshAcademic(`/faculdade/materias/${subjectId}`);
  return ok("Prova cadastrada.");
}

export async function updateExam(
  examIdValue: string,
  subjectIdValue: string,
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const examId = readId(examIdValue);
  const subjectId = readId(subjectIdValue);
  const title = readRequiredText(formData.get("title"), 200);
  const examDate = readIsoDateTime(formData.get("exam_date"));
  const topics = readTopics(formData.get("topics"));
  const notes = readOptionalText(formData.get("notes"), 20000);
  const status = readEnum(formData.get("status"), eventStatuses);
  if (!examId || !subjectId || !title || !examDate || !topics || notes === null || !status) return fail();

  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { data, error } = await supabase
    .from("exams")
    .update({ exam_date: examDate, notes: notes ?? null, status, title, topics })
    .eq("id", examId)
    .eq("subject_id", subjectId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return fail(SAVE_ERROR);
  if (!data) return fail("Prova não encontrada ou sem acesso.");
  refreshAcademic(`/faculdade/materias/${subjectId}`);
  return ok("Prova atualizada.");
}
