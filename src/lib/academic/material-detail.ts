import "server-only";
import { notFound } from "next/navigation";
import { getAuthenticatedAcademicClient } from "./data";
import { readId } from "./validation";
import { listAcademicAnalysisViews } from "./materials/analysis";
import type { MaterialItem } from "./materials/management";

export async function getAcademicMaterialDetail(subjectInput: unknown, materialInput: unknown, authenticate = getAuthenticatedAcademicClient) {
  const subjectId = readId(subjectInput)?.toLowerCase(), materialId = readId(materialInput)?.toLowerCase();
  if (!subjectId || !materialId) notFound();
  const { supabase, userId } = await authenticate();
  const [subjectResult, materialResult] = await Promise.all([
    supabase.from("subjects").select("id,name").eq("id", subjectId).eq("user_id", userId).maybeSingle(),
    supabase.from("academic_materials").select("id,title,original_filename,size_bytes,file_status,created_at,class_session_id")
      .eq("id", materialId).eq("subject_id", subjectId).eq("user_id", userId).is("deleted_at", null).neq("file_status", "deleted").maybeSingle(),
  ]);
  if (subjectResult.error || materialResult.error) throw new Error("Não foi possível carregar o material.");
  if (!subjectResult.data || !materialResult.data) notFound();
  const row = materialResult.data;
  const analyses = row.file_status === "ready" ? await listAcademicAnalysisViews([materialId], { throwOnError: true }) : {};
  const analysis = analyses[materialId];
  const missionIds = analysis?.suggestionLinks?.flatMap(link => link.missionId ? [link.missionId] : []) ?? [];
  const missionResult = missionIds.length ? await supabase.from("missions").select("id,title,status")
    .eq("user_id", userId).in("id", missionIds) : { data: [], error: null };
  if (missionResult.error) throw new Error("Não foi possível carregar as missões do material.");
  const classResult = row.class_session_id ? await supabase.from("class_sessions").select("id,title")
    .eq("id", row.class_session_id).eq("subject_id", subjectId).eq("user_id", userId).maybeSingle() : { data: null, error: null };
  if (classResult.error) throw new Error("Não foi possível carregar a aula relacionada.");
  const material: MaterialItem = { id: row.id, title: row.title, originalFilename: row.original_filename, sizeBytes: row.size_bytes, createdAt: row.created_at, fileStatus: row.file_status };
  return { subject: { id: subjectResult.data.id, name: subjectResult.data.name }, material, analyses, classSession: classResult.data, missions: missionResult.data ?? [] };
}
