"use server";

import { revalidatePath } from "next/cache";
import { completeOwnedMission } from "@/lib/missions/service";

export async function completeMission(input: unknown) {
  const result = await completeOwnedMission(input);
  if (result.ok) revalidatePath("/");
  return result;
}
