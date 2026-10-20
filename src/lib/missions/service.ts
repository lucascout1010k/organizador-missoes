import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildTodayDashboard, OPEN_MISSION_STATUSES, todayRange, type MissionRow } from "./today";

export async function authenticateMissions() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const identity = z.uuid().safeParse(data?.claims?.sub);
  if (error || !identity.success) return null;
  return { supabase, userId: identity.data };
}

type Auth = typeof authenticateMissions;
const columns = "id,title,description,category,status,priority,scheduled_for,due_at,estimated_minutes,origin_type,completed_at,created_at";

export async function readTodayMissions(authenticate: Auth = authenticateMissions, now = new Date()) {
  try {
    const auth = await authenticate();
    if (!auth) return { ok: false as const, reason: "auth_required" as const };
    const { supabase, userId } = auth;
    const { start, end } = todayRange(now);
    const rows: MissionRow[] = [];
    // One collection for every group/counter. Pages avoid PostgREST's default row cap.
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("missions").select(columns).eq("user_id", userId)
        .or(`and(status.in.(${OPEN_MISSION_STATUSES.join(",")}),or(scheduled_for.lt.${end},due_at.lt.${end})),and(status.eq.completed,completed_at.gte.${start},completed_at.lt.${end})`)
        .order("created_at").order("id").range(offset, offset + 499);
      if (result.error || !result.data) return { ok: false as const, reason: "unavailable" as const };
      rows.push(...result.data as MissionRow[]);
      if (result.data.length < 500) break;
    }
    return { ok: true as const, dashboard: buildTodayDashboard(rows, now) };
  } catch { return { ok: false as const, reason: "unavailable" as const }; }
}

const completionInput = z.strictObject({ missionId: z.uuid() });
export type CompletionResult = { ok: true } | { ok: false; message: string };
const failed: CompletionResult = { ok: false, message: "Não foi possível concluir agora." };

export async function completeOwnedMission(input: unknown, authenticate: Auth = authenticateMissions): Promise<CompletionResult> {
  const parsed = completionInput.safeParse(input);
  if (!parsed.success) return failed;
  try {
    const auth = await authenticate();
    if (!auth) return { ok: false, message: "Entre novamente para concluir a missão." };
    const { supabase, userId } = auth;
    const read = () => supabase.from("missions").select("status,completed_at")
      .eq("user_id", userId).eq("id", parsed.data.missionId).maybeSingle();
    const current = await read();
    if (current.error || !current.data) return failed;
    if (current.data.status === "completed") return { ok: true };
    if (!(OPEN_MISSION_STATUSES as readonly string[]).includes(current.data.status)) return failed;
    // Compare-and-set: a concurrent winner's completed_at is never overwritten.
    const updated = await supabase.from("missions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("user_id", userId).eq("id", parsed.data.missionId)
      .eq("status", current.data.status).is("completed_at", null).select("id").maybeSingle();
    if (updated.error) return failed;
    if (updated.data) return { ok: true };
    const winner = await read();
    return !winner.error && winner.data?.status === "completed" ? { ok: true } : failed;
  } catch { return failed; }
}
