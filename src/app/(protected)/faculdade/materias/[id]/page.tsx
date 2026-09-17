import { notFound } from "next/navigation";

import { SubjectDetail } from "@/components/faculty/subject-detail";
import { getSubjectPage } from "@/lib/academic/data";
import { readId } from "@/lib/academic/validation";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();

  const subjectPage = await getSubjectPage(id);

  return <SubjectDetail {...subjectPage} />;
}
