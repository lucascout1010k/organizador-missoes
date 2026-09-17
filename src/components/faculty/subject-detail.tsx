import Link from "next/link";
import type { CSSProperties } from "react";

import { ClassSessionForm, ExamForm, SubjectForm } from "@/components/academic/academic-forms";
import { LocalDateTime } from "@/components/academic/local-date-time";
import { StatusBadge } from "@/components/academic/status-badge";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import type { AcademicPeriod, ClassSession, Exam, Subject } from "@/lib/academic/types";
import { eventStatusLabels, subjectStatusLabels } from "@/lib/academic/types";

import styles from "./subject-detail.module.css";

const FACULTY_TIME_ZONE = "America/Sao_Paulo";
const facultyDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: FACULTY_TIME_ZONE,
  year: "numeric",
});

function plural(value: number, singular: string, pluralValue: string) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function dateKey(date: Date) {
  const parts = facultyDateFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return Date.UTC(read("year"), read("month") - 1, read("day"));
}

function daysUntil(value: string, currentTime: string) {
  return Math.max(0, Math.ceil((dateKey(new Date(value)) - dateKey(new Date(currentTime))) / 86_400_000));
}

function SectionTitle({
  action,
  eyebrow,
  icon,
  title,
}: {
  action?: React.ReactNode;
  eyebrow: string;
  icon: AppIconName;
  title: string;
}) {
  return (
    <header className={styles.sectionTitle}>
      <div className={styles.sectionIdentity}>
        <span className={styles.sectionIcon}><AppIcon name={icon} size={17} /></span>
        <div><p>{eyebrow}</p><h2>{title}</h2></div>
      </div>
      {action}
    </header>
  );
}

function EmptyState({ children, icon, title }: { children: React.ReactNode; icon: AppIconName; title: string }) {
  return (
    <div className={styles.emptyState}>
      <span><AppIcon name={icon} size={21} /></span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

function SubjectHeader({
  courseName,
  period,
  subject,
}: {
  courseName: string;
  period: AcademicPeriod | null;
  subject: Subject;
}) {
  const periodDetails = period
    ? [
        period.period_number ? `${period.period_number}º período` : null,
        period.term,
        period.year,
      ].filter(Boolean)
    : [];

  return (
    <>
      <nav aria-label="Navegação estrutural" className={styles.breadcrumbs}>
        <Link href="/faculdade">Faculdade</Link>
        <AppIcon name="chevron" size={12} />
        {period ? <Link href={`/faculdade/periodos/${period.id}`}>{period.name}</Link> : <span>Período</span>}
        <AppIcon name="chevron" size={12} />
        <span aria-current="page">{subject.name}</span>
      </nav>

      <header className={styles.hero} id="visao-geral">
        <div className={styles.heroIdentity}>
          <span className={styles.heroIcon}><AppIcon name="college" size={29} /></span>
          <div className={styles.heroCopy}>
            <p className={styles.courseName}>{courseName}</p>
            <div className={styles.titleRow}>
              <h1>{subject.name}</h1>
              <StatusBadge label={subjectStatusLabels[subject.status]} status={subject.status} />
            </div>
            <p className={styles.subjectMeta}>
              <span>{subject.code ? `Código ${subject.code}` : "Sem código cadastrado"}</span>
              {period ? <span>{period.name}</span> : null}
              {periodDetails.length ? <span>{periodDetails.join(" · ")}</span> : null}
            </p>
          </div>
        </div>
        <div aria-hidden="true" className={styles.heroMessage}>
          <span>Estrutura hoje.</span>
          <strong>Possibilidades amanhã.</strong>
        </div>
      </header>
    </>
  );
}

function SubjectTabs({ classesCount, examsCount }: { classesCount: number; examsCount: number }) {
  return (
    <nav aria-label="Seções da matéria" className={styles.tabs}>
      <a className={styles.tabActive} href="#visao-geral"><AppIcon name="home" size={15} />Visão geral</a>
      <a href="#aulas"><AppIcon name="clock" size={15} />Aulas <small>{classesCount}</small></a>
      <a href="#provas"><AppIcon name="agenda" size={15} />Provas <small>{examsCount}</small></a>
      <span aria-disabled="true" className={styles.futureTab}>
        <AppIcon name="projects" size={15} />
        <span>Materiais</span>
        <small>Em breve</small>
      </span>
    </nav>
  );
}

function MetricCard({
  accent = "blue",
  children,
  icon,
  label,
  value,
}: {
  accent?: "blue" | "green" | "purple";
  children: React.ReactNode;
  icon: AppIconName;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <article className={`${styles.metricCard} ${styles[`metric${accent}`]}`}>
      <div className={styles.metricLabel}><span><AppIcon name={icon} size={16} /></span>{label}</div>
      <strong>{value}</strong>
      <p>{children}</p>
    </article>
  );
}

function SubjectSummary({
  classes,
  exams,
  nextClass,
}: {
  classes: ClassSession[];
  exams: Exam[];
  nextClass?: ClassSession;
}) {
  const completedClasses = classes.filter((classSession) => classSession.status === "completed").length;
  const plannedExams = exams.filter((exam) => exam.status === "planned").length;
  const completion = classes.length ? Math.round((completedClasses / classes.length) * 100) : 0;
  const completionStyle = { "--subject-completion": `${completion}%` } as CSSProperties;

  return (
    <section aria-label="Resumo da matéria" className={styles.summaryGrid}>
      <article className={`${styles.metricCard} ${styles.completionCard}`}>
        <div className={styles.completionRing} style={completionStyle}><span>{classes.length ? `${completion}%` : "—"}</span></div>
        <div>
          <span className={styles.completionLabel}>Conclusão das aulas</span>
          <strong>{classes.length ? `${completedClasses} de ${classes.length}` : "Sem aulas"}</strong>
          <p>Somente por status cadastrado</p>
        </div>
      </article>
      <MetricCard accent="green" icon="clock" label="Aulas cadastradas" value={classes.length}>
        {plural(completedClasses, "concluída", "concluídas")}
      </MetricCard>
      <MetricCard accent="purple" icon="agenda" label="Provas cadastradas" value={exams.length}>
        {plural(plannedExams, "planejada", "planejadas")}
      </MetricCard>
      <MetricCard icon="chevron" label="Próxima aula" value={nextClass ? <LocalDateTime value={nextClass.class_date} /> : "—"}>
        {nextClass?.title ?? "Nenhuma aula futura planejada"}
      </MetricCard>
    </section>
  );
}

function SubjectClasses({ classes, currentTime, nextClass }: { classes: ClassSession[]; currentTime: string; nextClass?: ClassSession }) {
  const nextTime = nextClass ? new Date(nextClass.class_date).getTime() : null;
  const currentTimestamp = new Date(currentTime).getTime();
  const orderedClasses = [...classes].sort((left, right) => {
    if (left.id === nextClass?.id) return -1;
    if (right.id === nextClass?.id) return 1;
    return new Date(right.class_date).getTime() - new Date(left.class_date).getTime();
  });

  return (
    <section className={`${styles.panel} ${styles.classesPanel}`} id="aulas">
      <SectionTitle
        action={<span className={styles.countBadge}>{plural(classes.length, "aula", "aulas")}</span>}
        eyebrow="Cronologia da matéria"
        icon="clock"
        title="Aulas"
      />
      {orderedClasses.length ? (
        <div className={styles.classList}>
          {orderedClasses.map((classSession) => {
            const classTime = new Date(classSession.class_date).getTime();
            const isNext = nextTime !== null && classTime === nextTime && classSession.id === nextClass?.id;
            const isPast = classTime < currentTimestamp;

            return (
              <article className={`${styles.classCard} ${isNext ? styles.nextClass : ""}`} key={classSession.id}>
                <span className={styles.timelineMark}>{isNext ? <AppIcon name="chevron" size={15} /> : <AppIcon name="check" size={14} />}</span>
                <div className={styles.classContent}>
                  <div className={styles.cardTopline}>
                    <p><LocalDateTime value={classSession.class_date} /></p>
                    <div className={styles.cardBadges}>
                      {isNext ? <span className={styles.nextBadge}>Próxima aula</span> : null}
                      {!isNext && isPast && classSession.status === "planned" ? <span className={styles.pastBadge}>Data passada</span> : null}
                      <StatusBadge label={eventStatusLabels[classSession.status]} status={classSession.status} />
                    </div>
                  </div>
                  <h3>{classSession.title}</h3>
                  {classSession.notes ? <p className={styles.notes}>{classSession.notes}</p> : <p className={styles.muted}>Sem notas cadastradas.</p>}
                  <div className={styles.futureMaterials}>
                    <span><AppIcon name="projects" size={14} />Materiais da aula</span>
                    <small>Disponível em uma etapa futura</small>
                  </div>
                  <details className={styles.inlineEdit}>
                    <summary>Editar aula <AppIcon name="chevron" size={13} /></summary>
                    <div className={styles.formArea}><ClassSessionForm classSession={classSession} subjectId={classSession.subject_id} /></div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="clock" title="Nenhuma aula cadastrada.">Use as ações acadêmicas para registrar a primeira aula.</EmptyState>
      )}
    </section>
  );
}

function ExamTopics({ topics }: { topics: string[] }) {
  if (!topics.length) return <p className={styles.muted}>Nenhum tópico definido.</p>;

  return <ul className={styles.topicList}>{topics.map((topic, index) => <li key={`${topic}-${index}`}>{topic}</li>)}</ul>;
}

function SubjectUpcomingExam({ currentTime, exam, subjectId }: { currentTime: string; exam?: Exam; subjectId: string }) {
  const remaining = exam ? daysUntil(exam.exam_date, currentTime) : null;

  return (
    <section className={`${styles.panel} ${styles.upcomingExam}`} id="provas">
      <SectionTitle eyebrow="Prioridade acadêmica" icon="agenda" title="Próxima prova" />
      {exam ? (
        <div className={styles.examSpotlight}>
          <div className={styles.examHeading}>
            <span className={styles.examIcon}><AppIcon name="agenda" size={19} /></span>
            <div><h3>{exam.title}</h3><p><LocalDateTime value={exam.exam_date} /></p></div>
            <StatusBadge label={eventStatusLabels[exam.status]} status={exam.status} />
          </div>
          <span className={styles.deadline}>{remaining === 0 ? "Hoje" : `Em ${plural(remaining ?? 0, "dia", "dias")}`}</span>
          <div className={styles.topicsBlock}><strong>Tópicos previstos</strong><ExamTopics topics={exam.topics} /></div>
          {exam.notes ? <p className={styles.examNotes}>{exam.notes}</p> : null}
          <details className={styles.inlineEdit}>
            <summary>Editar próxima prova <AppIcon name="chevron" size={13} /></summary>
            <div className={styles.formArea}><ExamForm exam={exam} subjectId={subjectId} /></div>
          </details>
        </div>
      ) : (
        <EmptyState icon="check" title="Nenhuma prova próxima.">Não há prova futura com status planejado.</EmptyState>
      )}
    </section>
  );
}

function SubjectExams({ exams, nextExam, subjectId }: { exams: Exam[]; nextExam?: Exam; subjectId: string }) {
  const additionalExams = exams.filter((exam) => exam.id !== nextExam?.id);

  return (
    <section className={`${styles.panel} ${styles.examsPanel}`}>
      <SectionTitle
        action={<span className={styles.countBadge}>{nextExam ? plural(additionalExams.length, "outra prova", "outras provas") : plural(exams.length, "prova", "provas")}</span>}
        eyebrow="Avaliações cadastradas"
        icon="agenda"
        title={nextExam ? "Outras provas" : "Provas"}
      />
      {additionalExams.length ? (
        <div className={styles.examGrid}>
          {additionalExams.map((exam) => (
            <article className={styles.examCard} key={exam.id}>
              <div className={styles.cardTopline}>
                <p><LocalDateTime value={exam.exam_date} /></p>
                <StatusBadge label={eventStatusLabels[exam.status]} status={exam.status} />
              </div>
              <h3>{exam.title}</h3>
              <ExamTopics topics={exam.topics} />
              {exam.notes ? <p className={styles.examNotes}>{exam.notes}</p> : null}
              <details className={styles.inlineEdit}>
                <summary>Editar prova <AppIcon name="chevron" size={13} /></summary>
                <div className={styles.formArea}><ExamForm exam={exam} subjectId={subjectId} /></div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="agenda" title={nextExam ? "Nenhuma outra prova cadastrada." : "Nenhuma prova cadastrada."}>
          {nextExam ? "A próxima prova está destacada acima." : "Use as ações acadêmicas para cadastrar a primeira prova."}
        </EmptyState>
      )}
    </section>
  );
}

function SubjectActions({ subject }: { subject: Subject }) {
  return (
    <section className={`${styles.panel} ${styles.actionsPanel}`}>
      <SectionTitle eyebrow="Gerenciamento" icon="sparkles" title="Ações acadêmicas" />
      <div className={styles.actionList}>
        <details className={styles.actionDetails}>
          <summary><span><AppIcon name="clock" size={17} /></span><strong>Adicionar aula</strong><AppIcon name="chevron" size={15} /></summary>
          <div className={styles.formArea}><ClassSessionForm subjectId={subject.id} /></div>
        </details>
        <details className={styles.actionDetails}>
          <summary><span><AppIcon name="agenda" size={17} /></span><strong>Adicionar prova</strong><AppIcon name="chevron" size={15} /></summary>
          <div className={styles.formArea}><ExamForm subjectId={subject.id} /></div>
        </details>
        <details className={styles.actionDetails}>
          <summary><span><AppIcon name="settings" size={17} /></span><strong>Editar matéria</strong><AppIcon name="chevron" size={15} /></summary>
          <div className={styles.formArea}><SubjectForm periodId={subject.period_id} subject={subject} /></div>
        </details>
      </div>
    </section>
  );
}

export function SubjectDetail({
  classes,
  courseName,
  currentTime,
  exams,
  period,
  subject,
}: {
  classes: ClassSession[];
  courseName: string;
  currentTime: string;
  exams: Exam[];
  period: AcademicPeriod | null;
  subject: Subject;
}) {
  const now = new Date(currentTime).getTime();
  const nextClass = classes.find((classSession) =>
    classSession.status === "planned" && new Date(classSession.class_date).getTime() >= now
  );
  const nextExam = exams.find((exam) =>
    exam.status === "planned" && new Date(exam.exam_date).getTime() >= now
  );

  return (
    <main className={styles.page}>
      <SubjectHeader courseName={courseName} period={period} subject={subject} />
      <SubjectTabs classesCount={classes.length} examsCount={exams.length} />
      <div className={styles.dashboardGrid}>
        <SubjectSummary classes={classes} exams={exams} nextClass={nextClass} />
        <SubjectClasses classes={classes} currentTime={currentTime} nextClass={nextClass} />
        <SubjectUpcomingExam currentTime={currentTime} exam={nextExam} subjectId={subject.id} />
        <SubjectActions subject={subject} />
        <SubjectExams exams={exams} nextExam={nextExam} subjectId={subject.id} />
      </div>
    </main>
  );
}
