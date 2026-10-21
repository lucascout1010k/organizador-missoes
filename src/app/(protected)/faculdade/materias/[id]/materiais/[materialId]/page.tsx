import Link from "next/link";
import { MaterialList } from "@/components/academic/material-list";
import { getAcademicMaterialDetail } from "@/lib/academic/material-detail";
import styles from "@/components/faculty/subject-memory.module.css";

const missionStatuses: Record<string, string> = { planned: "Planejada", in_progress: "Em andamento", completed: "Concluída", postponed: "Adiada", missed: "Não realizada" };

export default async function MaterialPage({ params }: { params: Promise<{ id: string; materialId: string }> }) {
  const { id, materialId } = await params;
  const detail = await getAcademicMaterialDetail(id, materialId);
  return <main className={`${styles.memory} ${styles.detail}`}>
    <Link href={`/faculdade/materias/${detail.subject.id}`}>← {detail.subject.name}</Link>
    <h1>{detail.material.title}</h1>
    <p>{detail.classSession ? `Aula relacionada: ${detail.classSession.title}` : "Material da matéria · sem aula vinculada"}</p>
    <MaterialList heading="Material e análise" items={[detail.material]} unavailable={false} analyses={detail.analyses} />
    <section className={styles.card}><h2>Missões criadas a partir desta análise</h2>
      {detail.missions.length ? <ul>{detail.missions.map(mission => <li key={mission.id}>{mission.title} · {missionStatuses[mission.status] ?? mission.status}</li>)}</ul> : <p>Nenhuma missão criada disponível. Revise as sugestões na análise para adicionar uma missão.</p>}
    </section>
  </main>;
}
