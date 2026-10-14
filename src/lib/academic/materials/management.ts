import "server-only";

import { readId } from "../validation";
import { getAuthenticatedMaterialsClient } from "./data";
import type { FinalizeMaterialUploadResult } from "./types";

export type MaterialStatus = "pending_upload" | "validating" | "ready" | "upload_failed" | "deleting";
export type MaterialItem = { id: string; title: string; originalFilename: string; sizeBytes: number; fileStatus: MaterialStatus; createdAt: string };
export type MaterialOperationResult = { ok: true; message: string; url?: string } | { ok: false; message: string };
type Authenticate = typeof getAuthenticatedMaterialsClient;
const statuses: MaterialStatus[] = ["pending_upload", "validating", "ready", "upload_failed", "deleting"];
const strictId = (input: unknown) => typeof input === "string" && readId(input)?.toLowerCase() === input ? input : null;
const unavailable = (): MaterialOperationResult => ({ ok: false, message: "Material indisponível ou sem acesso." });

export function sanitizePdfFilename(input: string): string {
  const clean = input.normalize("NFKC").replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g, "_").replace(/\.{2,}/g, "_").replace(/^\.+|[. ]+$/g, "");
  return (clean.slice(0, 150).replace(/\.pdf$/i, "") || "material") + ".pdf";
}

export async function listOwnedMaterials(input: unknown, authenticate: Authenticate = getAuthenticatedMaterialsClient): Promise<{ items: MaterialItem[]; unavailable: boolean }> {
  try {
    const subjectId = strictId(input);
    const context = subjectId ? await authenticate() : null;
    if (!context?.ok) return { items: [], unavailable: true };
    const result = await context.supabase.from("academic_materials")
      .select("id,title,original_filename,size_bytes,file_status,created_at")
      .eq("user_id", context.userId).eq("subject_id", subjectId).is("deleted_at", null)
      .neq("file_status", "deleted").order("created_at", { ascending: false }).order("id", { ascending: false });
    if (result.error || !Array.isArray(result.data)) return { items: [], unavailable: true };
    return { unavailable: false, items: result.data.filter(row => statuses.includes(row.file_status)).map(row => ({
      id: row.id, title: row.title, originalFilename: row.original_filename,
      sizeBytes: row.size_bytes, fileStatus: row.file_status as MaterialStatus, createdAt: row.created_at,
    })) };
  } catch { return { items: [], unavailable: true }; }
}

async function ownedMaterial(input: unknown, authenticate: Authenticate) {
  const id = strictId(input);
  if (!id) return null;
  const context = await authenticate();
  if (!context.ok) return null;
  const result = await context.supabase.from("academic_materials")
    .select("id,user_id,subject_id,storage_path,file_status,deleted_at,original_filename")
    .eq("id", id).eq("user_id", context.userId).maybeSingle();
  const row = result.data;
  if (result.error || !row || row.id !== id || row.user_id !== context.userId || !readId(row.subject_id)
    || row.storage_path !== `${context.userId}/${row.subject_id}/${id}/source.pdf`) return null;
  return { context, row, id };
}

export async function accessOwnedMaterial(input: unknown, download: boolean, authenticate: Authenticate = getAuthenticatedMaterialsClient): Promise<MaterialOperationResult> {
  try {
    const owned = await ownedMaterial(input, authenticate);
    if (!owned || owned.row.file_status !== "ready" || owned.row.deleted_at !== null) return unavailable();
    const signed = await owned.context.supabase.storage.from("academic-materials").createSignedUrl(owned.row.storage_path, 60,
      download ? { download: sanitizePdfFilename(owned.row.original_filename) } : {});
    if (signed.error || !signed.data?.signedUrl) return unavailable();
    // Return only the intentionally short-lived read capability, never raw metadata.
    return { ok: true, url: signed.data.signedUrl, message: download ? "Download disponível." : "PDF disponível." };
  } catch { return unavailable(); }
}

export async function deleteOwnedMaterial(input: unknown, finalize: (id: string) => Promise<FinalizeMaterialUploadResult>, authenticate: Authenticate = getAuthenticatedMaterialsClient): Promise<MaterialOperationResult> {
  try {
    const owned = await ownedMaterial(input, authenticate);
    if (!owned) return unavailable();
    if (owned.row.file_status === "deleted" && owned.row.deleted_at !== null) return { ok: true, message: "Material excluído." };
    if (owned.row.deleted_at !== null || !statuses.includes(owned.row.file_status)) return unavailable();
    const requested = await owned.context.supabase.rpc("request_material_deletion", { p_material_id: owned.id }).maybeSingle();
    const decision = requested.data as { material_id?: unknown; result?: unknown } | null;
    if (requested.error || !decision || decision.material_id !== owned.id) return unavailable();
    if (decision.result === "deleted") return { ok: true, message: "Material excluído." };
    if (decision.result === "in_progress") return { ok: false, message: "Há uma operação em andamento. Tente excluir novamente em instantes." };
    if (decision.result !== "deleting") return unavailable();
    const result = await finalize(owned.id);
    if (!result.ok && result.code === "INVALID_PDF") return { ok: true, message: "Material excluído." };
    return { ok: false, message: "A exclusão está pendente. Confira novamente em instantes para concluir." };
  } catch { return { ok: false, message: "Não foi possível excluir agora." }; }
}
