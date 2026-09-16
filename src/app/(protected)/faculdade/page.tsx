import Link from "next/link";

import { CourseForm, PeriodForm } from "@/components/academic/academic-forms";
import { LocalDateTime } from "@/components/academic/local-date-time";
import { StatusBadge } from "@/components/academic/status-badge";
import { getFacultyOverview } from "@/lib/academic/data";
import {
  courseStatusLabels,
  periodStatusLabels,
  subjectStatusLabels,
} from "@/lib/academic/types";

export default async function FacultyPage() {
  const { courses, periods, subjects, upcomingExams } = await getFacultyOverview();
  const currentCourse = courses.find((course) => course.status === "active") ?? courses[0];
  const coursePeriods = currentCourse
    ? periods.filter((period) => period.course_id === currentCourse.id)
    : [];
  const activePeriod = coursePeriods.find((period) => period.status === "active") ??
    coursePeriods.find((period) => period.status === "planned");
  const activeSubjects = activePeriod
    ? subjects.filter((subject) => subject.period_id === activePeriod.id)
    : [];
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));

  if (!currentCourse) {
    return (
      <div className="page-wrap">
        <header className="page-header">
          <div><p className="eyebrow">Faculdade</p><h1>Visão acadêmica</h1></div>
        </header>
        <section className="empty-state">
          <span className="empty-mark">F</span>
          <h2>Comece cadastrando seu curso.</h2>
          <p>Crie a base da sua organização acadêmica. Você poderá adicionar períodos e matérias em seguida.</p>
          <div className="panel form-panel"><CourseForm /></div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Faculdade</p>
          <h1>Visão acadêmica</h1>
          <p>Seu curso, período atual e próximos compromissos.</p>
        </div>
        <Link className="button button-secondary" href="/faculdade/historico">Histórico acadêmico</Link>
      </header>

      <section className="spotlight-grid">
        <article className="spotlight-card">
          <div className="card-row"><p className="card-meta">Curso atual</p><StatusBadge label={courseStatusLabels[currentCourse.status]} status={currentCourse.status} /></div>
          <h2>{currentCourse.name}</h2>
          <details className="edit-details">
            <summary>Editar curso</summary>
            <CourseForm course={currentCourse} />
          </details>
        </article>
        <article className="spotlight-card accent-card">
          <div className="card-row"><p className="card-meta">Período atual</p>{activePeriod ? <StatusBadge label={periodStatusLabels[activePeriod.status]} status={activePeriod.status} /> : null}</div>
          {activePeriod ? (
            <>
              <h2>{activePeriod.name}</h2>
              <p>{activeSubjects.length} {activeSubjects.length === 1 ? "matéria" : "matérias"}</p>
              <Link className="text-link" href={`/faculdade/periodos/${activePeriod.id}`}>Abrir período →</Link>
            </>
          ) : (
            <><h2>Nenhum período atual</h2><p>Crie um período planejado ou ativo para continuar.</p></>
          )}
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Período atual</p><h2>Matérias</h2></div>
          {activePeriod ? <Link className="text-link" href={`/faculdade/periodos/${activePeriod.id}`}>Gerenciar período</Link> : null}
        </div>
        {activeSubjects.length ? (
          <div className="card-grid">
            {activeSubjects.map((subject) => (
              <Link className="data-card interactive-card" href={`/faculdade/materias/${subject.id}`} key={subject.id}>
                <div className="card-row"><span className="card-icon">{subject.name.slice(0, 1).toUpperCase()}</span><StatusBadge label={subjectStatusLabels[subject.status]} status={subject.status} /></div>
                <h3>{subject.name}</h3>
                <p>{subject.code || "Sem código"}</p>
              </Link>
            ))}
          </div>
        ) : <div className="empty-inline">Nenhuma matéria cadastrada no período atual.</div>}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Agenda</p><h2>Próximas provas</h2></div></div>
        {upcomingExams.length ? (
          <div className="exam-list">
            {upcomingExams.map((exam) => (
              <Link className="exam-row" href={`/faculdade/materias/${exam.subject_id}#provas`} key={exam.id}>
                <span className="date-chip"><LocalDateTime value={exam.exam_date} /></span>
                <span><strong>{exam.title}</strong><small>{subjectNames.get(exam.subject_id) ?? "Matéria"} · {exam.topics.length} {exam.topics.length === 1 ? "assunto" : "assuntos"}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : <div className="empty-inline">Nenhuma prova futura cadastrada.</div>}
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Organização</p><h2>Períodos</h2></div></div>
        <div className="period-list">
          {coursePeriods.map((period) => (
            <Link className="period-row" href={`/faculdade/periodos/${period.id}`} key={period.id}>
              <span><strong>{period.name}</strong><small>{[period.term, period.year].filter(Boolean).join(" · ") || "Sem detalhes"}</small></span>
              <StatusBadge label={periodStatusLabels[period.status]} status={period.status} />
            </Link>
          ))}
        </div>
        <details className="create-details panel">
          <summary>+ Novo período</summary>
          <PeriodForm courseId={currentCourse.id} />
        </details>
      </section>

      {courses.length > 1 ? (
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Cursos</p><h2>Outros cursos</h2></div></div>
          <div className="card-grid">
            {courses.filter((course) => course.id !== currentCourse.id).map((course) => (
              <article className="data-card" key={course.id}>
                <div className="card-row"><h3>{course.name}</h3><StatusBadge label={courseStatusLabels[course.status]} status={course.status} /></div>
                <details className="edit-details"><summary>Editar curso</summary><CourseForm course={course} /></details>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <details className="create-details panel">
        <summary>+ Cadastrar outro curso</summary>
        <CourseForm />
      </details>

    </div>
  );
}
