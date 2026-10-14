import "server-only";

import { createClient } from "@/lib/supabase/server";

import { readId } from "../validation";

type MaterialsClient = Awaited<ReturnType<typeof createClient>>;

type AuthenticatedMaterialsClientResult =
  | { ok: true; supabase: MaterialsClient; userId: string }
  | { ok: false; reason: "auth_required" | "unavailable" };

export async function getAuthenticatedMaterialsClient(): Promise<AuthenticatedMaterialsClientResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return { ok: false, reason: "unavailable" };

  const userId = readId(data?.claims?.sub)?.toLowerCase();

  if (!userId) return { ok: false, reason: "auth_required" };
  return { ok: true, supabase, userId };
}

export async function findOwnedMaterialSubject(
  supabase: MaterialsClient,
  userId: string,
  subjectId: string,
) {
  return supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function findOwnedMaterialClassSession(
  supabase: MaterialsClient,
  userId: string,
  subjectId: string,
  classSessionId: string,
) {
  return supabase
    .from("class_sessions")
    .select("id")
    .eq("id", classSessionId)
    .eq("subject_id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function markOwnedPendingMaterialUploadFailed(
  supabase: MaterialsClient,
  materialId: string,
) {
  // The RPC derives ownership from verified PostgREST claims and accepts only pending.
  // No browser category, owner or destination status crosses this boundary.
  return supabase
    .rpc("report_material_upload_failure", { p_material_id: materialId })
    .maybeSingle();
}
