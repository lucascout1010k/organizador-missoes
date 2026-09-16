import Link from "next/link";
import { notFound } from "next/navigation";

import { PeriodForm, SubjectForm } from "@/components/academic/academic-forms";
import { StatusBadge } from "@/components/academic/status-badge";
import { getPeriodPage } from "@/lib/academic/data";
import { periodStatusLabels, subjectStatusLabels } from "@/lib/academic/types";
import { readId } from "@/lib/academic/validation";

function formatDate(value: string | null) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();
  const { courseName, period, subjects } = await getPeriodPage(id);

  return (
    <div className="page-wrap">
      <nav className="breadcrumbs"><Link href="/faculdade">Faculdade</Link><span>/</span><span>{courseName}</span><span>/</span><span>{period.name}</span></nav>
      <header className="page-header page-header-actions">
        <div><p className="eyebrow">Período</p><h1>{period.name}</h1><p>{courseName}</p></div>
        <StatusBadge label={periodStatusLabels[period.status]} status={period.status} />
      </header>

      <section className="metrics-grid">
        <article><small>Matérias</small><strong>{subjects.length}</strong></article>
        <article><small>Número</small><strong>{period.period_number ?? "—"}</strong></article>
        <article><small>Ano</small><strong>{period.year ?? "—"}</strong></article>
        <article><small>Datas</small><strong className="metric-date">{formatDate(period.start_date)} — {formatDate(period.end_date)}</strong></article>
      </section>

      <details className="edit-details panel">
        <summary>Editar informações do período</summary>
        <PeriodForm courseId={period.course_id} period={period} />
      </details>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Grade</p><h2>Matérias</h2></div></div>
        {subjects.length ? (
          <div className="card-grid">
            {subjects.map((subject) => (
              <article className="data-card" key={subject.id}>
                <Link className="card-link" href={`/faculdade/materias/${subject.id}`}>
                  <div className="card-row"><span className="card-icon">{subject.name.slice(0, 1).toUpperCase()}</span><StatusBadge label={subjectStatusLabels[subject.status]} status={subject.status} /></div>
                  <h3>{subject.name}</h3><p>{subject.code || "Sem código"}</p>
                </Link>
                <details className="edit-details"><summary>Editar matéria</summary><SubjectForm periodId={period.id} subject={subject} /></details>
              </article>
            ))}
          </div>
        ) : <div className="empty-inline">Nenhuma matéria cadastrada neste período.</div>}

        <details className="create-details panel">
          <summary>+ Nova matéria</summary>
          <SubjectForm periodId={period.id} />
        </details>
      </section>
    </div>
  );
}
