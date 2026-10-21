import { notFound } from "next/navigation";

import { SubjectDetail } from "@/components/faculty/subject-detail";
import { getSubjectAcademicMemory } from "@/lib/academic/subject-memory";
import { readId } from "@/lib/academic/validation";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();

  const memory = await getSubjectAcademicMemory(id);
  return <SubjectDetail {...memory} memory={memory} materials={{ items: memory.materials, unavailable: false }} />;
}
