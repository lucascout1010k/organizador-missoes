import { notFound } from "next/navigation";

import { SubjectDetail } from "@/components/faculty/subject-detail";
import { getSubjectAcademicMemory } from "@/lib/academic/subject-memory";
import { getSubjectSemanticStatus } from "@/lib/academic/semantic/service";
import { readId } from "@/lib/academic/validation";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();

  const memory = await getSubjectAcademicMemory(id);
  const semantic = await getSubjectSemanticStatus(id).catch(() => null);
  return <SubjectDetail {...memory} memory={memory} semanticUnavailable={semantic === null} searchableMaterials={semantic?.filter(item => item.status === "ready").length ?? 0} materials={{ items: memory.materials, unavailable: false }} />;
}
