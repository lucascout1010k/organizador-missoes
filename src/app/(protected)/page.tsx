import Link from "next/link";

import { LocalDateTime } from "@/components/academic/local-date-time";
import { getFacultyOverview } from "@/lib/academic/data";

export default async function Home() {
  const { upcomingExams, subjects } = await getFacultyOverview();
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Seu espaço de foco</p>
          <h1>Hoje</h1>
          <p>Organize o que importa e acompanhe sua vida acadêmica.</p>
        </div>
      </header>

      <section className="hero-card">
        <div>
          <span className="hero-kicker">Faculdade</span>
          <h2>Seu semestre em uma visão clara.</h2>
          <p>Cursos, períodos, matérias, aulas e provas em um só lugar.</p>
        </div>
        <Link className="button button-primary" href="/faculdade">Abrir Faculdade</Link>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agenda acadêmica</p>
            <h2>Próximas provas</h2>
          </div>
        </div>
        {upcomingExams.length ? (
          <div className="card-grid">
            {upcomingExams.slice(0, 3).map((exam) => (
              <article className="data-card" key={exam.id}>
                <p className="card-meta">{subjectNames.get(exam.subject_id) ?? "Matéria"}</p>
                <h3>{exam.title}</h3>
                <p><LocalDateTime value={exam.exam_date} /></p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">Nenhuma prova futura cadastrada.</div>
        )}
      </section>
    </div>
  );
}
