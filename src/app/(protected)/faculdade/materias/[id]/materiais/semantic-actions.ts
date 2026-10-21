"use server";
import { revalidatePath } from "next/cache";
import { indexOwnedAcademicMaterial, askOwnedSubject } from "@/lib/academic/semantic/service";
export async function addMaterialToSemanticMemory(input: unknown) {
  const result = await indexOwnedAcademicMaterial(input);
  if (result.ok) revalidatePath("/faculdade/materias/[id]", "layout");
  return result;
}
export async function askSubjectMemory(input: unknown) { return askOwnedSubject(input); }
