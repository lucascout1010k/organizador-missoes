import "server-only";

import postgres from "postgres";

import { getSupabaseEnvironment } from "@/lib/supabase/env";
import { SUPABASE_DATABASE_CA } from "@/lib/supabase/database-ca";

export type MaterialAuthorization = {
  materialId: string;
  attemptId: string;
  generation: string;
  capability: string;
};

const QUERIES = {
  begin: "select app_materials_private.begin_material_validation($1::uuid,$2::uuid,$3::bigint,$4::text)",
  complete: "select app_materials_private.complete_material_validation($1::uuid,$2::uuid,$3::bigint,$4::text,$5::bigint,$6::bytea,$7::text)",
  reject: "select app_materials_private.reject_material_validation($1::uuid,$2::uuid,$3::bigint,$4::text,$5::text)",
  missing: "select app_materials_private.mark_material_missing($1::uuid,$2::uuid,$3::bigint,$4::text)",
  resume: "select app_materials_private.resume_material_deletion($1::uuid,$2::uuid,$3::bigint,$4::text)",
  deleted: "select app_materials_private.complete_material_deletion($1::uuid,$2::uuid,$3::bigint,$4::text)",
} as const;

let database: ReturnType<typeof postgres> | undefined;

function getDatabase() {
  if (database) return database;
  const value = process.env.MATERIAL_VALIDATOR_DATABASE_URL;
  if (!value) throw new Error("Material validator unavailable");
  const connection = new URL(value);
  const project = new URL(getSupabaseEnvironment().url).hostname.split(".")[0];
  const username = decodeURIComponent(connection.username);
  const direct = connection.hostname === `db.${project}.supabase.co`;
  const pooled = connection.hostname.endsWith(".pooler.supabase.com");
  if (!["postgres:", "postgresql:"].includes(connection.protocol)
    || !connection.password || connection.pathname !== "/postgres"
    || (!direct && !pooled)
    || username !== (pooled ? `material_validator.${project}` : "material_validator")
    || (pooled && connection.port !== "6543")
    || (direct && connection.port !== "5432")) {
    throw new Error("Material validator unavailable");
  }
  database = postgres(value, {
    ssl: { rejectUnauthorized: true, ca: SUPABASE_DATABASE_CA }, prepare: false, max: 1,
    connect_timeout: 5, idle_timeout: 20, max_lifetime: 60,
    onnotice: () => {}, debug: false,
  });
  return database;
}

export async function transitionMaterial(
  operation: keyof typeof QUERIES,
  authorization: MaterialAuthorization,
  extra: (string | number | Buffer)[] = [],
) {
  // Only these six fixed statements exist. No generic SQL/status/owner API.
  const query = getDatabase().unsafe(QUERIES[operation], [
    authorization.materialId, authorization.attemptId,
    authorization.generation, authorization.capability, ...extra,
  ]);
  const timer = setTimeout(() => { try { query.cancel(); } catch { /* Return errors only through the action's sanitized result. */ } }, 8_000);
  try { await query; } finally { clearTimeout(timer); }
}

export type AnalysisAuthorization = { analysisId: string; completionToken: string };
export async function settleAcademicAnalysis(
  authorization: AnalysisAuthorization,
  outcome: { kind: "completed"; result: unknown; model: string } | { kind: "failed"; category: string },
) {
  // Only narrow completion/failure functions; no table access or generic SQL API.
  const statement = outcome.kind === "completed"
    ? "select app_materials_private.complete_material_analysis($1::uuid,$2::text,$3::jsonb,$4::text)"
    : "select app_materials_private.fail_material_analysis($1::uuid,$2::text,$3::text)";
  const parameters = outcome.kind === "completed"
    ? [authorization.analysisId, authorization.completionToken, getDatabase().json(outcome.result as postgres.JSONValue), outcome.model]
    : [authorization.analysisId, authorization.completionToken, outcome.category];
  const query = getDatabase().unsafe(statement, parameters);
  const timer = setTimeout(() => { try { query.cancel(); } catch { /* Sanitized by caller. */ } }, 8_000);
  try { await query; } finally { clearTimeout(timer); }
}

export async function settleSemanticIndex(materialId: string, generation: number, token: string, evidence?: { pageCount: number; chunks: unknown[] }) {
  const sql = evidence ? "select app_semantic_private.settle_index($1::uuid,$2::bigint,$3::text,$4::integer,$5::jsonb)"
    : "select app_semantic_private.fail_index($1::uuid,$2::bigint,$3::text)";
  const query = getDatabase().unsafe(sql, evidence ? [materialId, generation, token, evidence.pageCount, getDatabase().json(evidence.chunks as postgres.JSONValue)] : [materialId, generation, token]);
  const timer = setTimeout(() => { try { query.cancel(); } catch {} }, 8000);
  try { await query; } finally { clearTimeout(timer); }
}
export async function finishSemanticQuestion(subjectId: string, token: string) {
  const query = getDatabase().unsafe("select app_semantic_private.finish_question($1::uuid,$2::text)", [subjectId, token]);
  const timer = setTimeout(() => { try { query.cancel(); } catch {} }, 8000);
  try { await query; } finally { clearTimeout(timer); }
}
