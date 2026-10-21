import { z } from "zod";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;
export const INDEX_VERSION = "subject-semantic-memory-v1";
export const SEMANTIC_CONSENT = "semantic-memory-consent-v1";
export const indexInputSchema = z.strictObject({ materialId: z.uuid(), consent: z.literal(true) });
export const questionInputSchema = z.strictObject({ subjectId: z.uuid(), question: z.string().trim().min(1).max(600) });
export const answerSchema = z.strictObject({
  status: z.enum(["answered", "partial", "not_found"]), answer: z.string().trim().min(1).max(6000),
  sources: z.array(z.strictObject({ sourceId: z.string().regex(/^S[1-6]$/) })).max(6),
  limitations: z.array(z.string().trim().min(1).max(600)).max(6),
});
export type SemanticStatus = { materialId: string; status: "not_indexed" | "indexing" | "ready" | "failed"; pageCount: number | null };
export type SemanticSource = { sourceId: string; materialId: string; title: string; pageStart: number; pageEnd: number };
export type SemanticAnswer = Omit<z.infer<typeof answerSchema>, "sources"> & { sources: SemanticSource[]; coverage: { indexed: number; total: number; consulted: number } };
export type SemanticFailure = "embedding_provider_unavailable" | "embedding_rate_limited" | "index_failed" | "retrieval_failed" | "answer_timeout" | "answer_provider_unavailable" | "invalid_answer" | "material_unavailable" | "configuration_error";
export type SemanticResult<T> = { ok: true; value: T } | { ok: false; code: SemanticFailure; message: string };

export function validateEmbedding(input: unknown): number[] {
  if (!Array.isArray(input) || input.length !== EMBEDDING_DIMENSIONS || !input.every(value => typeof value === "number" && Number.isFinite(value))) throw Error("Invalid embedding");
  const norm = Math.hypot(...input);
  if (!Number.isFinite(norm) || norm <= 0) throw Error("Invalid embedding");
  return input.map(value => value / norm);
}
export function validateAnswer(input: unknown, sources: SemanticSource[]) {
  const result = answerSchema.parse(typeof input === "string" ? JSON.parse(input) : input);
  const allowed = new Set(sources.map(item => item.sourceId));
  if (result.sources.some(item => !allowed.has(item.sourceId)) || new Set(result.sources.map(item => item.sourceId)).size !== result.sources.length
    || (result.status !== "not_found" && !result.sources.length) || (result.status === "not_found" && result.sources.length)) throw Error("Invalid grounding references");
  return { ...result, sources: result.sources.map(item => sources.find(source => source.sourceId === item.sourceId)!) };
}
