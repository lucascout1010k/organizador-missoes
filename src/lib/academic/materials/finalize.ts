import "server-only";

import { createHash } from "node:crypto";

import { readId } from "../validation";
import type { getAuthenticatedMaterialsClient } from "./data";
import type { PdfObjectResult } from "./pdf-object";
import type { FinalizeMaterialUploadResult } from "./types";
import { MAX_MATERIAL_SIZE_BYTES } from "./validation";
import type { transitionMaterial, MaterialAuthorization } from "./validator";

type Context = Extract<Awaited<ReturnType<typeof getAuthenticatedMaterialsClient>>, { ok: true }>;
type Dependencies = {
  authenticate: typeof getAuthenticatedMaterialsClient;
  transition: typeof transitionMaterial;
  download: (path: string, token: string) => Promise<PdfObjectResult>;
};

const MESSAGES = {
  INVALID_INPUT: "Não foi possível identificar o material.",
  AUTH_REQUIRED: "Entre novamente para validar o material.",
  RESOURCE_UNAVAILABLE: "Material indisponível ou sem acesso.",
  IN_PROGRESS: "Este material já está em validação. Confira novamente em instantes.",
  UNCERTAIN: "Não foi possível confirmar a validação. O material permanece recuperável; não reenvie o arquivo.",
  INVALID_PDF: "O arquivo não passou na validação de PDF. A remoção foi confirmada.",
  MISSING: "O arquivo não foi encontrado. A falha de envio foi confirmada.",
} as const;

function fail(code: keyof typeof MESSAGES): FinalizeMaterialUploadResult {
  return { ok: false, code, message: MESSAGES[code] };
}

async function confirmAbsent(context: Context, authorization: MaterialAuthorization, path: string, state: "validating" | "deleting") {
  const current = await context.supabase.from("academic_materials")
    .select("id,user_id,storage_path,file_status,deleted_at")
    .eq("id", authorization.materialId).eq("user_id", context.userId).maybeSingle();
  if (current.error || !current.data || current.data.file_status !== state
    || current.data.storage_path !== path || current.data.deleted_at !== null) return false;
  // POST list queries Storage metadata rather than a potentially cached download.
  // Empty visibility is accepted only for the verified owner's current readable
  // lifecycle state and canonical folder under the approved Storage SELECT policy.
  const separator = path.lastIndexOf("/");
  const listed = await context.supabase.storage.from("academic-materials")
    .list(path.slice(0, separator), { limit: 100, search: path.slice(separator + 1) });
  return !listed.error && Array.isArray(listed.data)
    && listed.data.length < 100 && !listed.data.some((item) => item.name === path.slice(separator + 1));
}

async function removeAndConfirm(context: Context, authorization: MaterialAuthorization, path: string) {
  const removed = await context.supabase.storage.from("academic-materials").remove([path]);
  if (removed.error) return false;
  return confirmAbsent(context, authorization, path, "deleting");
}

export async function finalizeOwnedMaterial(
  input: unknown,
  dependencies: Dependencies,
): Promise<FinalizeMaterialUploadResult> {
  try {
    const materialId = readId(input)?.toLowerCase();
    if (!materialId || typeof input !== "string" || input !== materialId) return fail("INVALID_INPUT");
    const context = await dependencies.authenticate();
    if (!context.ok) return fail(context.reason === "auth_required" ? "AUTH_REQUIRED" : "UNCERTAIN");
    const { supabase, userId } = context;
    const found = await supabase.from("academic_materials")
      .select("id,user_id,subject_id,storage_path,mime_type,size_bytes,file_status,deleted_at")
      .eq("id", materialId).eq("user_id", userId).maybeSingle();
    if (found.error) return fail("UNCERTAIN");
    const material = found.data;
    if (!material || material.id !== materialId || material.user_id !== userId
      || !readId(material.subject_id) || material.deleted_at !== null
      || material.storage_path !== `${userId}/${material.subject_id}/${materialId}/source.pdf`
      || material.mime_type !== "application/pdf" || !Number.isSafeInteger(material.size_bytes)
      || material.size_bytes < 1 || material.size_bytes > MAX_MATERIAL_SIZE_BYTES
      || !["pending_upload", "upload_failed", "validating", "ready", "deleting"].includes(material.file_status)) {
      return fail("RESOURCE_UNAVAILABLE");
    }
    const issued = await supabase.rpc("issue_material_authorization", { p_material_id: materialId }).maybeSingle();
    if (issued.error || !issued.data) return fail("UNCERTAIN");
    const decision = issued.data as Record<string, unknown>;
    if (decision.result === "already_ready" && material.file_status === "ready" && decision.capability === null) {
      return { ok: true, fileStatus: "ready", message: "PDF validado e pronto." };
    }
    if (decision.result === "in_progress" && decision.capability === null) return fail("IN_PROGRESS");
    const generation = String(decision.generation);
    if (decision.result !== "issued" || typeof decision.attempt_id !== "string" || !readId(decision.attempt_id)
      || typeof decision.capability !== "string" || !/^[0-9a-f]{64}$/.test(decision.capability)
      || !/^[1-9][0-9]{0,18}$/.test(generation)
      || (typeof decision.generation === "number" && !Number.isSafeInteger(decision.generation))
      || typeof decision.expires_at !== "string" || !Number.isFinite(Date.parse(decision.expires_at)) || Date.parse(decision.expires_at) <= Date.now()
      || decision.purpose !== (material.file_status === "deleting" ? "deletion" : "validation")) return fail("UNCERTAIN");
    const authorization: MaterialAuthorization = {
      materialId, attemptId: decision.attempt_id, generation, capability: decision.capability,
    };
    const session = await supabase.auth.getSession();
    if (session.error || !session.data.session?.access_token || session.data.session.user.id !== userId) return fail("AUTH_REQUIRED");
    const token = session.data.session.access_token;
    if (decision.purpose === "deletion") {
      // Cleanup recovery never promotes a deleting material back to ready.
      await dependencies.transition("resume", authorization);
      if (!await removeAndConfirm(context, authorization, material.storage_path)) return fail("UNCERTAIN");
      await dependencies.transition("deleted", authorization);
      return fail("INVALID_PDF");
    }
    await dependencies.transition("begin", authorization);
    const object = await dependencies.download(material.storage_path, token);
    if (object.kind === "uncertain") return fail("UNCERTAIN");
    if (object.kind === "missing") {
      if (!await confirmAbsent(context, authorization, material.storage_path, "validating")) return fail("UNCERTAIN");
      await dependencies.transition("missing", authorization);
      return fail("MISSING");
    }
    let invalid: string | null = object.kind === "oversized" ? "size_limit_exceeded" : null;
    if (object.kind === "found") {
      if (object.bytes.byteLength > MAX_MATERIAL_SIZE_BYTES) invalid = "size_limit_exceeded";
      else if (object.bytes.byteLength < 1 || object.bytes.byteLength !== material.size_bytes) invalid = "size_mismatch";
      else if (object.mime && object.mime.split(";", 1)[0].trim().toLowerCase() !== "application/pdf") invalid = "mime_mismatch";
      else if (![0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => object.bytes[index] === byte)) invalid = "invalid_pdf_signature";
    }
    if (invalid) {
      await dependencies.transition("reject", authorization, [invalid]);
      if (!await removeAndConfirm(context, authorization, material.storage_path)) return fail("UNCERTAIN");
      await dependencies.transition("deleted", authorization);
      return fail("INVALID_PDF");
    }
    if (object.kind !== "found") return fail("UNCERTAIN");
    await dependencies.transition("complete", authorization, [
      object.bytes.byteLength, createHash("sha256").update(object.bytes).digest(), "pdf-signature-v1",
    ]);
    return { ok: true, fileStatus: "ready", message: "PDF validado e pronto." };
  } catch {
    // No capabilities, SQL, paths, session details or provider errors are returned.
    return fail("UNCERTAIN");
  }
}
