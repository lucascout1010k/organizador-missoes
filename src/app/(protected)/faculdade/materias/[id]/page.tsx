import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassSessionForm, ExamForm, SubjectForm } from "@/components/academic/academic-forms";
import { LocalDateTime } from "@/components/academic/local-date-time";
import { StatusBadge } from "@/components/academic/status-badge";
import { getSubjectPage } from "@/lib/academic/data";
import { eventStatusLabels, subjectStatusLabels } from "@/lib/academic/types";
import { readId } from "@/lib/academic/validation";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = readId(rawId);
  if (!id) notFound();
  const { classes, courseName, exams, period, subject } = await getSubjectPage(id);

  return (
    <div className="page-wrap">
      <nav className="breadcrumbs"><Link href="/faculdade">Faculdade</Link><span>/</span>{period ? <Link href={`/faculdade/periodos/${period.id}`}>{period.name}</Link> : null}<span>/</span><span>{subject.name}</span></nav>
      <header className="page-header page-header-actions">
        <div><p className="eyebrow">{courseName}</p><h1>{subject.name}</h1><p>{subject.code ? `Código ${subject.code}` : "Sem código cadastrado"}</p></div>
        <StatusBadge label={subjectStatusLabels[subject.status]} status={subject.status} />
      </header>

      <nav aria-label="Seções da matéria" className="tabs">
        <a href="#visao-geral">Visão geral</a><a href="#aulas">Aulas <span>{classes.length}</span></a><a href="#provas">Provas <span>{exams.length}</span></a>
      </nav>

      <section className="section-block" id="visao-geral">
        <div className="section-heading"><div><p className="eyebrow">Configuração</p><h2>Visão geral</h2></div></div>
        {period ? <div className="info-strip"><span><small>Período</small><strong>{period.name}</strong></span><span><small>Aulas</small><strong>{classes.length}</strong></span><span><small>Provas</small><strong>{exams.length}</strong></span></div> : null}
        <details className="edit-details panel"><summary>Editar matéria</summary><SubjectForm periodId={subject.period_id} subject={subject} /></details>
      </section>

      <section className="section-block anchor-section" id="aulas">
        <div className="section-heading"><div><p className="eyebrow">Cronologia</p><h2>Aulas</h2></div></div>
        {classes.length ? (
          <div className="timeline-list">
            {classes.map((classSession) => (
              <article className="timeline-card" key={classSession.id}>
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="card-row"><p className="card-meta"><LocalDateTime value={classSession.class_date} /></p><StatusBadge label={eventStatusLabels[classSession.status]} status={classSession.status} /></div>
                  <h3>{classSession.title}</h3>
                  {classSession.notes ? <p className="preserve-lines">{classSession.notes}</p> : <p className="muted">Sem notas.</p>}
                  <div className="future-materials"><small>Materiais da aula</small><span>Disponível em uma etapa futura</span></div>
                  <details className="edit-details"><summary>Editar aula</summary><ClassSessionForm classSession={classSession} subjectId={subject.id} /></details>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-inline">Nenhuma aula cadastrada.</div>}
        <details className="create-details panel"><summary>+ Cadastrar aula</summary><ClassSessionForm subjectId={subject.id} /></details>
      </section>

      <section className="section-block anchor-section" id="provas">
        <div className="section-heading"><div><p className="eyebrow">Avaliações</p><h2>Provas</h2></div></div>
        {exams.length ? (
          <div className="exam-cards">
            {exams.map((exam) => (
              <article className="exam-card" key={exam.id}>
                <div className="card-row"><p className="card-meta"><LocalDateTime value={exam.exam_date} /></p><StatusBadge label={eventStatusLabels[exam.status]} status={exam.status} /></div>
                <h3>{exam.title}</h3>
                <p className="topic-count">{exam.topics.length} {exam.topics.length === 1 ? "assunto" : "assuntos"}</p>
                {exam.topics.length ? <ul className="topic-list">{exam.topics.map((topic, index) => <li key={`${exam.id}-${index}`}>{topic}</li>)}</ul> : <p className="muted">Nenhum assunto definido.</p>}
                {exam.notes ? <p className="exam-notes preserve-lines">{exam.notes}</p> : null}
                <details className="edit-details"><summary>Editar prova</summary><ExamForm exam={exam} subjectId={subject.id} /></details>
              </article>
            ))}
          </div>
        ) : <div className="empty-inline">Nenhuma prova cadastrada.</div>}
        <details className="create-details panel"><summary>+ Cadastrar prova</summary><ExamForm subjectId={subject.id} /></details>
      </section>
    </div>
  );
}
