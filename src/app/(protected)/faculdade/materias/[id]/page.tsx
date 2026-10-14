import { notFound } from "next/navigation";

import { SubjectDetail } from "@/components/faculty/subject-detail";
import { getSubjectPage } from "@/lib/academic/data";
import { listOwnedMaterials } from "@/lib/academic/materials/management";
import { readId } from "@/lib/academic/validation";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();

  const [subjectPage, materials] = await Promise.all([getSubjectPage(id), listOwnedMaterials(id)]);

  return <SubjectDetail {...subjectPage} materials={materials} />;
}
