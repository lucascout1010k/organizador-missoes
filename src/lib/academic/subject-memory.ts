import "server-only";

import { notFound } from "next/navigation";
import { getAuthenticatedAcademicClient, getSubjectPage } from "./data";
import { readId } from "./validation";
import { parseAcademicAnalysis, type AcademicAnalysis } from "./materials/analysis-schema";
import type { MaterialItem } from "./materials/management";
import type { AcademicPeriod, ClassSession, Exam, Subject } from "./types";

type MaterialRow = {
  id: string; title: string; original_filename: string; size_bytes: number;
  file_status: MaterialItem["fileStatus"]; created_at: string; class_session_id: string | null;
};
type AnalysisRow = { id: string; material_id: string; status: string; result: unknown; completed_at: string | null; created_at: string };
type MissionRow = { id: string; title: string; status: string; priority: string; due_at: string | null; origin_subject_id: string | null; origin_class_session_id?: string | null; origin_exam_id?: string | null };
type MissionLink = { analysis_id: string; material_id: string; mission_id: string | null };
export type MemoryMaterial = MaterialItem & {
  classSessionId: string | null; classTitle: string | null;
  analysisStatus: "completed" | "processing" | "failed" | "not_analyzed";
};

// Deliberately conservative: plural forms and accents remain distinct concepts.
export function uniqueAcademicTerms(values: string[]): string[] {
  const terms = new Map<string, string>();
  for (const value of values) {
    const label = value.normalize("NFC").trim().replace(/\s+/g, " ");
    const key = label.toLocaleLowerCase("pt-BR");
    if (label && !terms.has(key)) terms.set(key, label);
  }
  return [...terms.values()];
}

export function consolidateSubjectMemory(
  materials: MaterialRow[], analyses: AnalysisRow[], missions: MissionRow[], links: MissionLink[],
  classes: Awaited<ReturnType<typeof getSubjectPage>>["classes"], subjectId: string,
  exams: Awaited<ReturnType<typeof getSubjectPage>>["exams"] = [],
) {
  const visible = new Map(materials.filter(row => ["ready", "pending_upload", "validating", "upload_failed", "deleting"].includes(row.file_status)).map(row => [row.id, row]));
  const valid: { row: AnalysisRow; result: AcademicAnalysis }[] = [];
  const states = new Map<string, MemoryMaterial["analysisStatus"]>();
  const ordered = [...analyses].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  let invalidAnalyses = 0;
  for (const row of ordered) {
    if (visible.get(row.material_id)?.file_status !== "ready") continue;
    if (["processing", "failed", "completed"].includes(row.status) && !states.has(row.material_id)) {
      states.set(row.material_id, row.status as MemoryMaterial["analysisStatus"]);
    }
    if (row.status !== "completed") continue;
    try { valid.push({ row, result: parseAcademicAnalysis(row.result) }); }
    catch { invalidAnalyses++; states.set(row.material_id, "failed"); }
  }
  valid.sort((a, b) => (b.row.completed_at ?? b.row.created_at).localeCompare(a.row.completed_at ?? a.row.created_at) || b.row.id.localeCompare(a.row.id));
  const completedMaterials = new Set(valid.map(item => item.row.material_id));
  const validAnalysisMaterials = new Map(valid.map(item => [item.row.id, item.row.material_id]));
  const linkedMissionIds = new Set(links.filter(link => validAnalysisMaterials.get(link.analysis_id) === link.material_id).map(link => link.mission_id));
  const classById = new Map(classes.map(item => [item.id, item]));
  const examIds = new Set(exams.map(item => item.id));
  const related = missions.filter(mission => mission.origin_subject_id === subjectId || linkedMissionIds.has(mission.id)
    || (mission.origin_class_session_id && classById.has(mission.origin_class_session_id))
    || (mission.origin_exam_id && examIds.has(mission.origin_exam_id)));
  const pendingMissions = related.filter(mission => ["planned", "in_progress", "postponed", "missed"].includes(mission.status))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 3) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 3) || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || a.id.localeCompare(b.id))
    .map(({ id, title, status, priority, due_at }) => ({ id, title, status, priority, dueAt: due_at }));
  const studiedTopics = uniqueAcademicTerms(valid.flatMap(item => item.result.topics.map(topic => topic.title)));
  const keywords = uniqueAcademicTerms(valid.flatMap(item => item.result.keywords));
  const latest = valid[0];
  const items: MemoryMaterial[] = [...visible.values()].map(row => ({
    id: row.id, title: row.title, originalFilename: row.original_filename, sizeBytes: row.size_bytes,
    createdAt: row.created_at, fileStatus: row.file_status,
    classSessionId: row.class_session_id && classById.has(row.class_session_id) ? row.class_session_id : null,
    classTitle: row.class_session_id ? classById.get(row.class_session_id)?.title ?? null : null,
    analysisStatus: completedMaterials.has(row.id) ? "completed" : states.get(row.id) ?? "not_analyzed",
  }));
  return {
    stats: {
      materials: items.length, analyzed: completedMaterials.size,
      awaitingAnalysis: items.filter(item => item.fileStatus === "ready" && item.analysisStatus === "not_analyzed").length,
      studiedTopics: studiedTopics.length, pendingMissions: pendingMissions.length,
      completedMissions: related.filter(item => item.status === "completed").length,
      suggestedMissions: valid.reduce((count, item) => count + item.result.suggestedMissions.length, 0),
      createdMissions: new Set(related.map(item => item.id)).size,
    },
    studiedTopics, keywords, materials: items, pendingMissions,
    limitations: uniqueAcademicTerms(valid.flatMap(item => item.result.limitations)).slice(0, 6),
    invalidAnalyses,
    latestAnalyzedMaterial: latest ? {
      id: latest.row.material_id, title: visible.get(latest.row.material_id)!.title,
      completedAt: latest.row.completed_at ?? latest.row.created_at,
      summary: latest.result.summary.length > 420 ? latest.result.summary.slice(0, 417) + "…" : latest.result.summary,
      topics: latest.result.topics.slice(0, 5).map(topic => topic.title),
    } : null,
  };
}

export type SubjectAcademicMemory = {
  subject: Subject; period: AcademicPeriod | null; courseName: string; currentTime: string;
  stats: { materials: number; analyzed: number; awaitingAnalysis: number; studiedTopics: number;
    pendingMissions: number; completedMissions: number; suggestedMissions: number; createdMissions: number };
  studiedTopics: string[]; keywords: string[]; limitations: string[]; invalidAnalyses: number;
  latestAnalyzedMaterial: { id: string; title: string; completedAt: string; summary: string; topics: string[] } | null;
  materials: MemoryMaterial[];
  pendingMissions: { id: string; title: string; status: string; priority: string; dueAt: string | null }[];
  exams: Exam[]; classes: ClassSession[]; nextClass: ClassSession | null;
};

export async function getSubjectAcademicMemory(input: unknown, authenticate = getAuthenticatedAcademicClient): Promise<SubjectAcademicMemory> {
  const subjectId = readId(input)?.toLowerCase();
  if (!subjectId) notFound();
  const context = await authenticate();
  const page = await getSubjectPage(subjectId, context);
  const { supabase, userId } = context;
  const materialResult = await supabase.from("academic_materials")
    .select("id,title,original_filename,size_bytes,file_status,created_at,class_session_id")
    .eq("user_id", userId).eq("subject_id", subjectId).is("deleted_at", null)
    .neq("file_status", "deleted").order("created_at", { ascending: false }).order("id", { ascending: false });
  if (materialResult.error) throw new Error("Não foi possível carregar a memória acadêmica.");
  const materials = (materialResult.data ?? []) as MaterialRow[];
  const ids = materials.filter(item => item.file_status === "ready").map(item => item.id);
  const analysisResult = ids.length ? await supabase.from("academic_material_analyses")
    .select("id,material_id,status,result,completed_at,created_at").eq("user_id", userId)
    .eq("schema_version", 1).in("material_id", ids) : { data: [], error: null };
  if (analysisResult.error) throw new Error("Não foi possível carregar as análises persistidas.");
  const analyses = (analysisResult.data ?? []) as AnalysisRow[];
  const analysisIds = analyses.filter(item => item.status === "completed").map(item => item.id);
  const linkResult = analysisIds.length ? await supabase.from("academic_analysis_mission_links")
    .select("analysis_id,material_id,mission_id").eq("user_id", userId).in("analysis_id", analysisIds)
    : { data: [], error: null };
  if (linkResult.error) throw new Error("Não foi possível carregar os vínculos acadêmicos.");
  const links = (linkResult.data ?? []) as MissionLink[];
  const missionIds = links.flatMap(link => readId(link.mission_id) ? [link.mission_id!] : []);
  const missionQuery = supabase.from("missions").select("id,title,status,priority,due_at,origin_subject_id,origin_class_session_id,origin_exam_id").eq("user_id", userId);
  const origins = [`origin_subject_id.eq.${subjectId}`];
  if (missionIds.length) origins.push(`id.in.(${missionIds.join(",")})`);
  if (page.classes.length) origins.push(`origin_class_session_id.in.(${page.classes.map(item => item.id).join(",")})`);
  if (page.exams.length) origins.push(`origin_exam_id.in.(${page.exams.map(item => item.id).join(",")})`);
  const missionResult = await (origins.length > 1 ? missionQuery.or(origins.join(",")) : missionQuery.eq("origin_subject_id", subjectId));
  if (missionResult.error) throw new Error("Não foi possível carregar as missões da matéria.");
  const memory = consolidateSubjectMemory(materials, analyses, (missionResult.data ?? []) as MissionRow[], links, page.classes, subjectId, page.exams);
  // Whitelist the subject instead of forwarding the nested PostgREST record.
  const { id, period_id, name, code, status, created_at, updated_at } = page.subject;
  return { ...page, subject: { id, period_id, name, code, status, created_at, updated_at }, ...memory,
    nextClass: page.classes.find(item => item.status === "planned" && new Date(item.class_date).getTime() >= new Date(page.currentTime).getTime()) ?? null };
}
