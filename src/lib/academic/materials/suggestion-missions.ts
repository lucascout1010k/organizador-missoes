import "server-only";
import { getAuthenticatedMaterialsClient } from "./data";
import { parseAcademicAnalysis } from "./analysis-schema";
import { missionFieldsSchema, suggestionBatchSchema, type SuggestionBatchResult, type SuggestionOutcome } from "./suggestion-contract";
import { readId } from "../validation";

const unavailable = "Esta análise não está disponível. Confira se o material continua disponível.";
const failed = "Não foi possível criar esta missão. Tente novamente para confirmar o resultado.";

export async function createOwnedSuggestionMissions(
  input: unknown,
  authenticate = getAuthenticatedMaterialsClient,
): Promise<SuggestionBatchResult> {
  try {
    const parsed = suggestionBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Revise as sugestões e os campos informados." };
    const context = await authenticate();
    if (!context.ok) return { ok: false, message: "Entre novamente para adicionar missões." };
    const { supabase, userId } = context;
    const { analysisId, suggestions } = parsed.data;
    const analysis = await supabase.from("academic_material_analyses").select("id,material_id,status,result,schema_version")
      .eq("id", analysisId).eq("user_id", userId).maybeSingle();
    if (analysis.error || !analysis.data || analysis.data.status !== "completed" || analysis.data.schema_version !== 1) {
      return { ok: false, message: unavailable };
    }
    const original = parseAcademicAnalysis(analysis.data.result);
    const material = await supabase.from("academic_materials").select("id,file_status,deleted_at")
      .eq("id", analysis.data.material_id).eq("user_id", userId).maybeSingle();
    if (material.error || !material.data || material.data.file_status !== "ready" || material.data.deleted_at !== null) {
      return { ok: false, message: unavailable };
    }
    const items: SuggestionOutcome[] = [];
    // Each RPC commits one mission+link atomically. Never hide partial batch success.
    for (const item of suggestions) {
      const source = original.suggestedMissions[item.suggestionIndex];
      const fields = missionFieldsSchema.safeParse(item.fields ?? source);
      if (!source || !fields.success) {
        items.push({ suggestionIndex: item.suggestionIndex, status: "failed", message: "Esta sugestão não está disponível ou contém campos inválidos." });
        continue;
      }
      try {
        const response = await supabase.rpc("create_analysis_suggestion_mission", {
          p_analysis_id: analysisId, p_suggestion_index: item.suggestionIndex, p_fields: fields.data,
        }).maybeSingle();
        const row = response.data as { result?: unknown; mission_id?: unknown } | null;
        if (response.error || !row || (row.result !== "created" && row.result !== "already_created")
          || (row.mission_id !== null && (typeof row.mission_id !== "string" || !readId(row.mission_id))) || (row.result === "created" && row.mission_id === null)) {
          items.push({ suggestionIndex: item.suggestionIndex, status: "failed", message: failed });
        } else {
          items.push({ suggestionIndex: item.suggestionIndex, status: row.result, missionId: row.mission_id as string | null });
        }
      } catch { items.push({ suggestionIndex: item.suggestionIndex, status: "failed", message: failed }); }
    }
    return { ok: true, items };
  } catch { return { ok: false, message: unavailable }; }
}
