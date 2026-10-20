import "server-only";
import { z } from "zod";

export const ANALYSIS_SCHEMA_VERSION = "academic-material-analysis-v1";
export const CONSENT_VERSION = "gemini-pdf-analysis-consent-v1";
export const ANALYSIS_JSON_LIMIT = 131072;
const text = (limit: number) => z.string().min(1).max(limit);
export const academicAnalysisSchema = z.strictObject({
  summary: text(4000),
  topics: z.array(z.strictObject({ title: text(120), explanation: text(800), importance: z.enum(["high", "medium", "low"]) })).max(12),
  keywords: z.array(text(80)).max(20),
  exercises: z.array(z.strictObject({ question: text(700), answer: text(1200), difficulty: z.enum(["easy", "medium", "hard"]), type: z.enum(["concept", "review", "practice"]) })).max(12),
  suggestedMissions: z.array(z.strictObject({ title: text(160), description: text(600), estimatedMinutes: z.number().int().min(5).max(240), priority: z.enum(["low", "medium", "high"]) })).max(8),
  limitations: z.array(text(800)).max(6),
});
export type AcademicAnalysis = z.infer<typeof academicAnalysisSchema>;
export type SuggestionLink = { suggestionIndex: number; missionId: string | null };
export type AnalysisView = { id: string; status: "processing" | "completed" | "failed"; result: AcademicAnalysis | null; suggestionLinks?: SuggestionLink[] };
export type AnalysisFailure = "provider_unavailable" | "provider_rate_limited" | "provider_auth_error" | "provider_refused" | "invalid_provider_response" | "analysis_timeout" | "material_unavailable" | "configuration_error" | "unknown";
export type AnalysisActionResult = { ok: true; analysis: AnalysisView } | { ok: false; message: string };

function normalize(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC").trim();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}
export function parseAcademicAnalysis(value: unknown): AcademicAnalysis {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof raw !== "string" || Buffer.byteLength(raw) > ANALYSIS_JSON_LIMIT) throw new Error("Invalid analysis result");
  const parsed = academicAnalysisSchema.parse(normalize(typeof value === "string" ? JSON.parse(value) : value));
  if (Buffer.byteLength(JSON.stringify(parsed)) > ANALYSIS_JSON_LIMIT) throw new Error("Invalid analysis result");
  return parsed;
}

export const academicAnalysisJsonSchema = z.toJSONSchema(academicAnalysisSchema, { target: "draft-7" });
