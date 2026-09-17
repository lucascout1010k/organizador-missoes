import "server-only";

import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type {
  AcademicCourse,
  AcademicPeriod,
  ClassSession,
  Exam,
  Subject,
} from "./types";

export async function getAuthenticatedAcademicClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") redirect("/login");
  return { supabase, userId };
}

export async function getFacultyOverview() {
  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const now = new Date().toISOString();
  const [coursesResult, periodsResult, subjectsResult, examsResult] = await Promise.all([
    supabase
      .from("academic_courses")
      .select("id,name,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("academic_periods")
      .select("id,course_id,name,period_number,year,term,status,start_date,end_date,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("subjects")
      .select("id,period_id,name,code,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("exams")
      .select("id,subject_id,title,exam_date,topics,notes,status,created_at,updated_at")
      .eq("user_id", userId)
      .eq("status", "planned")
      .gte("exam_date", now)
      .order("exam_date")
      .limit(8),
  ]);

  if (coursesResult.error || periodsResult.error || subjectsResult.error || examsResult.error) {
    throw new Error("Não foi possível carregar a área acadêmica.");
  }

  return {
    courses: coursesResult.data as AcademicCourse[],
    periods: periodsResult.data as AcademicPeriod[],
    subjects: subjectsResult.data as Subject[],
    upcomingExams: examsResult.data as Exam[],
  };
}

const FACULTY_TIME_ZONE = "America/Sao_Paulo";

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FACULTY_TIME_ZONE,
    weekday: "short",
    year: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: Number(read("day")),
    month: Number(read("month")),
    weekday: read("weekday"),
    year: Number(read("year")),
  };
}

function saoPauloMidnightUtc(year: number, month: number, day: number) {
  const localNoon = new Date(Date.UTC(year, month - 1, day, 12));
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: FACULTY_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(localNoon).find((part) => part.type === "timeZoneName")?.value;
  const match = timeZoneName?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offsetMinutes = match
    ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
    : -180;

  return new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60_000);
}

function getFacultyDateRanges() {
  const now = new Date();
  const local = getSaoPauloDateParts(now);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(local.weekday);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = weekdayIndex < 0 ? 0 : (weekdayIndex + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  const weekStart = saoPauloMidnightUtc(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth() + 1,
    localDate.getUTCDate(),
  );
  const weekEndDate = new Date(localDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
  const weekEnd = saoPauloMidnightUtc(
    weekEndDate.getUTCFullYear(),
    weekEndDate.getUTCMonth() + 1,
    weekEndDate.getUTCDate(),
  );
  const examsEnd = new Date(now);
  examsEnd.setUTCDate(examsEnd.getUTCDate() + 30);

  return {
    examsEnd: examsEnd.toISOString(),
    now: now.toISOString(),
    weekEnd: weekEnd.toISOString(),
    weekStart: weekStart.toISOString(),
  };
}

export async function getFacultyHub() {
  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const { examsEnd, now, weekEnd, weekStart } = getFacultyDateRanges();
  const [coursesResult, periodsResult, subjectsResult, examsResult, classesResult] = await Promise.all([
    supabase
      .from("academic_courses")
      .select("id,name,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("academic_periods")
      .select("id,course_id,name,period_number,year,term,status,start_date,end_date,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("subjects")
      .select("id,period_id,name,code,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("exams")
      .select("id,subject_id,title,exam_date,topics,notes,status,created_at,updated_at")
      .eq("user_id", userId)
      .eq("status", "planned")
      .gte("exam_date", now)
      .lt("exam_date", examsEnd)
      .order("exam_date"),
    supabase
      .from("class_sessions")
      .select("id,subject_id,title,class_date,notes,status,created_at,updated_at")
      .eq("user_id", userId)
      .gte("class_date", weekStart)
      .lt("class_date", weekEnd)
      .order("class_date"),
  ]);

  if (
    coursesResult.error ||
    periodsResult.error ||
    subjectsResult.error ||
    examsResult.error ||
    classesResult.error
  ) {
    throw new Error("Não foi possível carregar a central acadêmica.");
  }

  return {
    classesThisWeek: classesResult.data as ClassSession[],
    courses: coursesResult.data as AcademicCourse[],
    periods: periodsResult.data as AcademicPeriod[],
    upcomingExams: examsResult.data as Exam[],
    subjects: subjectsResult.data as Subject[],
  };
}

export async function getPeriodPage(periodId: string) {
  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const [periodResult, subjectsResult] = await Promise.all([
    supabase
      .from("academic_periods")
      .select("id,course_id,name,period_number,year,term,status,start_date,end_date,created_at,updated_at,academic_courses(name)")
      .eq("user_id", userId)
      .eq("id", periodId)
      .maybeSingle(),
    supabase
      .from("subjects")
      .select("id,period_id,name,code,status,created_at,updated_at")
      .eq("user_id", userId)
      .eq("period_id", periodId)
      .order("name"),
  ]);

  if (periodResult.error || subjectsResult.error) {
    throw new Error("Não foi possível carregar o período.");
  }
  if (!periodResult.data) notFound();

  const raw = periodResult.data as AcademicPeriod & {
    academic_courses: { name: string } | { name: string }[] | null;
  };
  const course = Array.isArray(raw.academic_courses)
    ? raw.academic_courses[0]
    : raw.academic_courses;

  return {
    period: raw,
    courseName: course?.name ?? "Curso",
    subjects: subjectsResult.data as Subject[],
  };
}

export async function getSubjectPage(subjectId: string) {
  const { supabase, userId } = await getAuthenticatedAcademicClient();
  const [subjectResult, classesResult, examsResult] = await Promise.all([
    supabase
      .from("subjects")
      .select("id,period_id,name,code,status,created_at,updated_at,academic_periods(name,course_id,academic_courses(name))")
      .eq("user_id", userId)
      .eq("id", subjectId)
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id,subject_id,title,class_date,notes,status,created_at,updated_at")
      .eq("user_id", userId)
      .eq("subject_id", subjectId)
      .order("class_date"),
    supabase
      .from("exams")
      .select("id,subject_id,title,exam_date,topics,notes,status,created_at,updated_at")
      .eq("user_id", userId)
      .eq("subject_id", subjectId)
      .order("exam_date"),
  ]);

  if (subjectResult.error || classesResult.error || examsResult.error) {
    throw new Error("Não foi possível carregar a matéria.");
  }
  if (!subjectResult.data) notFound();

  const raw = subjectResult.data as Subject & {
    academic_periods:
      | { name: string; course_id: string; academic_courses: { name: string } | { name: string }[] | null }
      | { name: string; course_id: string; academic_courses: { name: string } | { name: string }[] | null }[]
      | null;
  };
  const period = Array.isArray(raw.academic_periods)
    ? raw.academic_periods[0]
    : raw.academic_periods;
  const course = Array.isArray(period?.academic_courses)
    ? period.academic_courses[0]
    : period?.academic_courses;

  return {
    subject: raw,
    period: period ? { id: raw.period_id, name: period.name } : null,
    courseName: course?.name ?? "Curso",
    classes: classesResult.data as ClassSession[],
    exams: examsResult.data as Exam[],
  };
}
