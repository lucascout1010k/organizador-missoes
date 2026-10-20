import { z } from "zod";

// PostgreSQL char_length counts Unicode code points, rather than UTF-16 units.
const text = (max: number, required = false) => z.string().max(max * 2)
  .transform(value => value.normalize("NFC").trim())
  .refine(value => Array.from(value).length <= max && (!required || value.length > 0));
export const missionFieldsSchema = z.strictObject({
  title: text(200, true),
  description: text(20000),
  priority: z.enum(["low", "medium", "high"]),
  estimatedMinutes: z.number().int().min(1).max(2147483647),
});
export const suggestionBatchSchema = z.strictObject({
  analysisId: z.uuid(),
  suggestions: z.array(z.strictObject({
    suggestionIndex: z.number().int().min(0).max(7),
    fields: missionFieldsSchema.optional(),
  })).min(1).max(8).refine(items => new Set(items.map(item => item.suggestionIndex)).size === items.length),
});
export type MissionFields = z.infer<typeof missionFieldsSchema>;
export type SuggestionBatch = z.infer<typeof suggestionBatchSchema>;
export type SuggestionOutcome = { suggestionIndex: number } & (
  | { status: "created" | "already_created"; missionId: string | null }
  | { status: "failed"; message: string }
);
export type SuggestionBatchResult = { ok: true; items: SuggestionOutcome[] } | { ok: false; message: string };
