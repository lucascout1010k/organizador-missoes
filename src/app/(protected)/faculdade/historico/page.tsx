import Link from "next/link";

import { StatusBadge } from "@/components/academic/status-badge";
import { getFacultyOverview } from "@/lib/academic/data";
import { courseStatusLabels, periodStatusLabels } from "@/lib/academic/types";

export default async function AcademicHistoryPage() {
  const { courses, periods, subjects } = await getFacultyOverview();
  const courseNames = new Map(courses.map((course) => [course.id, course.name]));
  const subjectCounts = new Map<string, number>();
  subjects.forEach((subject) => subjectCounts.set(subject.period_id, (subjectCounts.get(subject.period_id) ?? 0) + 1));
  const historical = periods.filter((period) => ["completed", "archived"].includes(period.status));

  return (
    <div className="page-wrap">
      <nav className="breadcrumbs"><Link href="/faculdade">Faculdade</Link><span>/</span><span>Histórico</span></nav>
      <header className="page-header">
        <div><p className="eyebrow">Memória acadêmica</p><h1>Histórico acadêmico</h1><p>Períodos concluídos e arquivados permanecem disponíveis.</p></div>
      </header>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Períodos anteriores</p><h2>{historical.length} no histórico</h2></div></div>
        {historical.length ? (
          <div className="history-list">
            {historical.map((period) => (
              <Link className="history-row" href={`/faculdade/periodos/${period.id}`} key={period.id}>
                <span className="history-year">{period.year ?? "—"}</span>
                <span className="history-main"><small>{courseNames.get(period.course_id) ?? "Curso"}</small><strong>{period.name}</strong><small>{subjectCounts.get(period.id) ?? 0} matérias · {period.term || "Termo não informado"}</small></span>
                <StatusBadge label={periodStatusLabels[period.status]} status={period.status} />
              </Link>
            ))}
          </div>
        ) : <div className="empty-inline">Ainda não há períodos concluídos ou arquivados.</div>}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Cursos</p><h2>Todos os cursos</h2></div></div>
        <div className="card-grid">
          {courses.map((course) => (
            <article className="data-card" key={course.id}>
              <div className="card-row"><h3>{course.name}</h3><StatusBadge label={courseStatusLabels[course.status]} status={course.status} /></div>
              <p>{periods.filter((period) => period.course_id === course.id).length} períodos registrados</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
