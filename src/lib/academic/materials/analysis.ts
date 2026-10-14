import "server-only";
import { readId } from "../validation";
import { getAuthenticatedMaterialsClient } from "./data";
import { downloadPrivatePdf } from "./pdf-object";
import { MAX_MATERIAL_SIZE_BYTES } from "./validation";
import { settleAcademicAnalysis, type AnalysisAuthorization } from "./validator";
import { AcademicProviderError, academicProviderConfiguration, analyzeAcademicPdf, categorizeAcademicProviderError } from "./analysis-provider";
import { parseAcademicAnalysis, type AnalysisActionResult, type AnalysisView } from "./analysis-schema";

type Context = Extract<Awaited<ReturnType<typeof getAuthenticatedMaterialsClient>>, { ok: true }>;
type Dependencies = {
  authenticate: typeof getAuthenticatedMaterialsClient;
  download: typeof downloadPrivatePdf;
  analyze: typeof analyzeAcademicPdf;
  settle: typeof settleAcademicAnalysis;
  configuration: typeof academicProviderConfiguration;
};
const defaults: Dependencies = { authenticate: getAuthenticatedMaterialsClient, download: downloadPrivatePdf, analyze: analyzeAcademicPdf, settle: settleAcademicAnalysis, configuration: academicProviderConfiguration };
const fail = (message = "Não foi possível analisar este material. Tente novamente em instantes."): AnalysisActionResult => ({ ok: false, message });

async function readyMaterial(context: Context, materialId: string) {
  const found = await context.supabase.from("academic_materials")
    .select("id,user_id,subject_id,storage_path,file_status,deleted_at,mime_type,size_bytes")
    .eq("id", materialId).eq("user_id", context.userId).maybeSingle();
  const m = found.data;
  if (found.error || !m || m.id !== materialId || m.user_id !== context.userId || !readId(m.subject_id)
    || m.file_status !== "ready" || m.deleted_at !== null || m.mime_type !== "application/pdf"
    || m.storage_path !== `${context.userId}/${m.subject_id}/${materialId}/source.pdf`
    || !Number.isSafeInteger(m.size_bytes) || m.size_bytes < 1 || m.size_bytes > MAX_MATERIAL_SIZE_BYTES) return null;
  return m;
}

export async function analyzeOwnedAcademicMaterial(input: unknown, dependencies: Dependencies = defaults): Promise<AnalysisActionResult> {
  let authorization: AnalysisAuthorization | null = null;
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) return fail("Confirme a análise deste PDF para continuar.");
    const entries = Object.getOwnPropertyDescriptors(input);
    if (Object.keys(entries).sort().join(",") !== "consent,materialId"
      || !entries.consent || !entries.materialId || !("value" in entries.materialId) || !("value" in entries.consent)
      || entries.consent.value !== true) return fail("Confirme a análise deste PDF para continuar.");
    const materialId = entries.materialId.value;
    if (typeof materialId !== "string" || readId(materialId)?.toLowerCase() !== materialId) return fail("Material indisponível ou sem acesso.");
    const context = await dependencies.authenticate();
    if (!context.ok) return fail("Entre novamente para analisar o material.");
    const material = await readyMaterial(context, materialId);
    if (!material) return fail("Material indisponível ou sem acesso.");
    const issued = await context.supabase.rpc("request_material_analysis", { p_material_id: materialId, p_consent: true }).maybeSingle();
    const decision = issued.data as { analysis_id?: unknown; completion_token?: unknown; expires_at?: unknown; decision?: unknown } | null;
    if (issued.error || !decision || typeof decision.analysis_id !== "string" || !readId(decision.analysis_id)) return fail();
    if (decision.decision === "analysis_in_progress" && decision.completion_token === null) {
      return { ok: true, analysis: { id: decision.analysis_id, status: "processing", result: null } };
    }
    if (decision.decision === "completed" && decision.completion_token === null) {
      const existing = await context.supabase.from("academic_material_analyses").select("id,status,result")
        .eq("id", decision.analysis_id).eq("user_id", context.userId).eq("material_id", materialId).eq("schema_version", 1).maybeSingle();
      if (existing.error || !existing.data || existing.data.status !== "completed") return fail();
      return { ok: true, analysis: { id: existing.data.id, status: "completed", result: parseAcademicAnalysis(existing.data.result) } };
    }
    if (decision.decision !== "issued" || typeof decision.completion_token !== "string" || !/^[0-9a-f]{64}$/.test(decision.completion_token)
      || typeof decision.expires_at !== "string" || !Number.isFinite(Date.parse(decision.expires_at)) || Date.parse(decision.expires_at) <= Date.now()) return fail();
    authorization = { analysisId: decision.analysis_id, completionToken: decision.completion_token };
    dependencies.configuration();
    const session = await context.supabase.auth.getSession();
    // Claims above are the authority; session is used only to transport its token.
    if (session.error || !session.data.session?.access_token || session.data.session.user.id !== context.userId) throw new AcademicProviderError("material_unavailable");
    const object = await dependencies.download(material.storage_path, session.data.session.access_token);
    if (object.kind !== "found" || object.bytes.byteLength < 1 || object.bytes.byteLength > MAX_MATERIAL_SIZE_BYTES
      || object.bytes.byteLength !== material.size_bytes || object.mime?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf"
      || ![0x25,0x50,0x44,0x46,0x2d].every((byte,index) => object.bytes[index] === byte)) throw new AcademicProviderError("material_unavailable");
    const current = await readyMaterial(context, materialId);
    if (!current || current.storage_path !== material.storage_path || current.size_bytes !== material.size_bytes) throw new AcademicProviderError("material_unavailable");
    const timeout = Math.min(60_000, Date.parse(decision.expires_at) - Date.now() - 5_000);
    if (timeout < 1) throw new AcademicProviderError("analysis_timeout");
    const controller = new AbortController();
    let rejectDeadline: ((reason: unknown) => void) | undefined;
    const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
    const timer = setTimeout(() => { controller.abort(); rejectDeadline?.(new AcademicProviderError("analysis_timeout")); }, timeout);
    let response: Awaited<ReturnType<typeof analyzeAcademicPdf>>;
    try {
      response = await Promise.race([dependencies.analyze({ bytes: object.bytes, mimeType: "application/pdf", signal: controller.signal }), deadline]);
    } finally { clearTimeout(timer); rejectDeadline = undefined; }
    let result;
    try { result = parseAcademicAnalysis(response.result); } catch { throw new AcademicProviderError("invalid_provider_response"); }
    await dependencies.settle(authorization, { kind: "completed", result, model: response.model });
    return { ok: true, analysis: { id: authorization.analysisId, status: "completed", result } };
  } catch (error) {
    const category = categorizeAcademicProviderError(error);
    if (authorization) {
      try { await dependencies.settle(authorization, { kind: "failed", category }); } catch { /* Lease recovers on a later explicit retry. */ }
    }
    return fail(category === "configuration_error" ? "A análise com IA está indisponível no momento."
      : category === "provider_rate_limited" ? "A análise está temporariamente ocupada. Tente novamente mais tarde." : undefined);
  }
}

export async function listAcademicAnalysisViews(materialIds: string[]): Promise<Record<string, AnalysisView>> {
  if (!materialIds.length) return {};
  try {
    const context = await getAuthenticatedMaterialsClient();
    if (!context.ok) return {};
    const found = await context.supabase.from("academic_material_analyses")
      .select("id,material_id,status,result").eq("user_id", context.userId).eq("schema_version", 1)
      .in("material_id", materialIds).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (found.error || !Array.isArray(found.data)) return {};
    const views: Record<string, AnalysisView> = {};
    for (const row of found.data) {
      if (views[row.material_id] || !["processing", "completed", "failed"].includes(row.status)) continue;
      views[row.material_id] = { id: row.id, status: row.status, result: row.status === "completed" ? parseAcademicAnalysis(row.result) : null };
    }
    return views;
  } catch { return {}; }
}
