import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { LocalDateTime } from "@/components/academic/local-date-time";
import { StatusBadge } from "@/components/academic/status-badge";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import type {
  AcademicCourse,
  AcademicPeriod,
  ClassSession,
  Exam,
  Subject,
} from "@/lib/academic/types";
import {
  periodStatusLabels,
  subjectStatusLabels,
} from "@/lib/academic/types";

import styles from "./faculty-overview.module.css";

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

function daysUntil(value: string) {
  const dateKey = (date: Date) => {
    const parts = facultyDateFormatter.formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return Date.UTC(read("year"), read("month") - 1, read("day"));
  };
  return Math.max(0, Math.ceil((dateKey(new Date(value)) - dateKey(new Date())) / 86_400_000));
}

function SectionHeader({
  action,
  eyebrow,
  icon,
  title,
}: {
  action?: ReactNode;
  eyebrow: string;
  icon: AppIconName;
  title: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <div className={styles.sectionIdentity}>
        <span className={styles.sectionIcon}><AppIcon name={icon} size={17} /></span>
        <div><p>{eyebrow}</p><h2>{title}</h2></div>
      </div>
      {action}
    </header>
  );
}

export function FacultyHeader({
  course,
  period,
}: {
  course?: AcademicCourse;
  period?: AcademicPeriod;
}) {
  const periodDetails = period
    ? [period.term, period.year].filter(Boolean).join(" · ")
    : "Nenhum período atual";

  return (
    <>
      <header className={styles.hero} id="visao-geral">
        <div className={styles.heroIdentity}>
          <span className={styles.heroIcon}><AppIcon name="college" size={31} /></span>
          <div>
            <p className={styles.kicker}>Central acadêmica</p>
            <h1>Faculdade</h1>
            <p className={styles.heroDescription}>Organize seus estudos e acompanhe o período sem perder o foco.</p>
          </div>
        </div>
        <div className={styles.contextGroup} aria-label="Contexto acadêmico atual">
          <div className={styles.contextCard}>
            <small>Curso atual</small>
            <strong>{course?.name ?? "Nenhum curso cadastrado"}</strong>
          </div>
          <div className={styles.contextCard}>
            <small>Período atual</small>
            <strong>{period?.name ?? "Não definido"}</strong>
            <span>{periodDetails || "Sem ano ou termo informado"}</span>
          </div>
        </div>
      </header>

      <nav aria-label="Seções da Faculdade" className={styles.tabs}>
        <a className={styles.tabActive} href="#visao-geral"><AppIcon name="home" size={14} />Visão geral</a>
        <a href="#materias"><AppIcon name="college" size={14} />Matérias</a>
        <a href="#provas"><AppIcon name="agenda" size={14} />Provas</a>
        <Link href="/faculdade/historico"><AppIcon name="clock" size={14} />Histórico</Link>
      </nav>
    </>
  );
}

function MetricCard({
  accent = "blue",
  hint,
  icon,
  label,
  value,
}: {
  accent?: "blue" | "green" | "purple";
  hint: string;
  icon: AppIconName;
  label: string;
  value: string;
}) {
  const accentClass = accent === "green"
    ? styles.metricgreen
    : accent === "purple"
      ? styles.metricpurple
      : "";

  return (
    <article className={`${styles.metricCard} ${accentClass}`}>
      <div className={styles.metricTop}>
        <span className={styles.metricIcon}><AppIcon name={icon} size={17} /></span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

export function FacultySummary({
  classesCount,
  completedSubjects,
  examsCount,
  subjectsCount,
}: {
  classesCount: number;
  completedSubjects: number;
  examsCount: number;
  subjectsCount: number;
}) {
  const completion = subjectsCount ? Math.round((completedSubjects / subjectsCount) * 100) : 0;
  const completionStyle = { "--completion": `${completion}%` } as CSSProperties;

  return (
    <section aria-label="Resumo do período" className={styles.metricsGrid}>
      <MetricCard
        accent="green"
        hint={subjectsCount ? "no período atual" : "Cadastre matérias no período"}
        icon="college"
        label="Matérias do período"
        value={String(subjectsCount)}
      />
      <MetricCard
        accent="purple"
        hint="nos próximos 30 dias"
        icon="agenda"
        label="Próximas provas"
        value={String(examsCount)}
      />
      <MetricCard
        hint="na semana atual"
        icon="clock"
        label="Aulas da semana"
        value={String(classesCount)}
      />
      <article className={`${styles.metricCard} ${styles.completionCard}`}>
        <div className={styles.completionRing} style={completionStyle}>
          <span>{subjectsCount ? `${completion}%` : "—"}</span>
        </div>
        <div>
          <span className={styles.completionLabel}>Matérias concluídas</span>
          <strong>{subjectsCount ? `${completedSubjects}/${subjectsCount}` : "Sem dados"}</strong>
          <p>Conclusão por status da matéria</p>
        </div>
      </article>
    </section>
  );
}

export function SubjectOverviewList({
  period,
  subjects,
}: {
  period?: AcademicPeriod;
  subjects: Subject[];
}) {
  return (
    <section className={styles.panel} id="materias">
      <SectionHeader
        action={period ? <Link className={styles.headerLink} href={`/faculdade/periodos/${period.id}`}>Gerenciar período <AppIcon name="chevron" size={13} /></Link> : undefined}
        eyebrow="Grade atual"
        icon="college"
        title="Matérias do período"
      />
      {subjects.length ? (
        <div className={styles.subjectList}>
          {subjects.map((subject, index) => (
            <Link className={styles.subjectRow} href={`/faculdade/materias/${subject.id}`} key={subject.id}>
              <span className={`${styles.subjectMark} ${styles[`subjectTone${index % 4}`]}`}>{subject.name.slice(0, 1).toUpperCase()}</span>
              <span className={styles.subjectCopy}>
                <strong>{subject.name}</strong>
                <small>{subject.code || "Sem código cadastrado"}</small>
              </span>
              <StatusBadge label={subjectStatusLabels[subject.status]} status={subject.status} />
              <span className={styles.rowChevron}><AppIcon name="chevron" size={17} /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyPanel}>
          <span><AppIcon name="college" size={22} /></span>
          <strong>Nenhuma matéria no período atual.</strong>
          <p>Abra o período para cadastrar a primeira matéria.</p>
        </div>
      )}
    </section>
  );
}

export function FacultyUpcomingExams({
  exams,
  subjectNames,
}: {
  exams: Exam[];
  subjectNames: Map<string, string>;
}) {
  return (
    <section className={styles.panel} id="provas">
      <SectionHeader
        action={<span className={styles.countBadge}>{plural(exams.length, "prova", "provas")}</span>}
        eyebrow="Próximos 30 dias"
        icon="agenda"
        title="Próximas provas"
      />
      {exams.length ? (
        <div className={styles.eventList}>
          {exams.slice(0, 5).map((exam) => {
            const remaining = daysUntil(exam.exam_date);
            return (
              <Link className={styles.eventRow} href={`/faculdade/materias/${exam.subject_id}#provas`} key={exam.id}>
                <span className={`${styles.eventIcon} ${styles.examIcon}`}><AppIcon name="agenda" size={16} /></span>
                <span className={styles.eventCopy}>
                  <strong>{exam.title}</strong>
                  <small>{subjectNames.get(exam.subject_id) ?? "Matéria"}</small>
                  <span><LocalDateTime value={exam.exam_date} /></span>
                </span>
                <span className={styles.deadline}>{remaining === 0 ? "Hoje" : `Em ${plural(remaining, "dia", "dias")}`}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyPanelCompact}>
          <span><AppIcon name="check" size={19} /></span>
          <div><strong>Nenhuma prova próxima.</strong><p>Sua agenda dos próximos 30 dias está livre.</p></div>
        </div>
      )}
    </section>
  );
}

export function WeeklyClasses({
  classes,
  subjectNames,
}: {
  classes: ClassSession[];
  subjectNames: Map<string, string>;
}) {
  return (
    <section className={styles.panel} id="aulas">
      <SectionHeader
        action={<span className={styles.countBadge}>{plural(classes.length, "aula", "aulas")}</span>}
        eyebrow="Semana atual"
        icon="clock"
        title="Aulas da semana"
      />
      {classes.length ? (
        <div className={styles.classList}>
          {classes.map((classSession) => (
            <Link className={styles.classRow} href={`/faculdade/materias/${classSession.subject_id}#aulas`} key={classSession.id}>
              <span className={`${styles.eventIcon} ${styles.classIcon}`}><AppIcon name="clock" size={15} /></span>
              <span className={styles.eventCopy}>
                <strong>{classSession.title}</strong>
                <small>{subjectNames.get(classSession.subject_id) ?? "Matéria"}</small>
                <span><LocalDateTime value={classSession.class_date} /></span>
              </span>
              <span className={`${styles.eventStatus} ${styles[`eventStatus${classSession.status}`]}`}>
                {classSession.status === "completed" ? "Concluída" : classSession.status === "cancelled" ? "Cancelada" : "Planejada"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyPanelCompact}>
          <span><AppIcon name="clock" size={19} /></span>
          <div><strong>Nenhuma aula nesta semana.</strong><p>As aulas cadastradas aparecerão aqui.</p></div>
        </div>
      )}
    </section>
  );
}

export function AcademicHistoryPreview({
  periods,
  subjectCounts,
}: {
  periods: AcademicPeriod[];
  subjectCounts: Map<string, number>;
}) {
  return (
    <section className={`${styles.panel} ${styles.historyPanel}`} id="historico">
      <SectionHeader
        action={<Link className={styles.headerLink} href="/faculdade/historico">Ver histórico completo <AppIcon name="chevron" size={13} /></Link>}
        eyebrow="Linha acadêmica"
        icon="clock"
        title="Períodos e histórico"
      />
      {periods.length ? (
        <div className={styles.historyGrid}>
          {periods.slice(0, 6).map((period) => (
            <Link className={styles.historyCard} href={`/faculdade/periodos/${period.id}`} key={period.id}>
              <div className={styles.historyTop}>
                <span>{period.year ?? "—"}</span>
                <StatusBadge label={periodStatusLabels[period.status]} status={period.status} />
              </div>
              <strong>{period.name}</strong>
              <p>{[period.term, plural(subjectCounts.get(period.id) ?? 0, "matéria", "matérias")].filter(Boolean).join(" · ")}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyPanelCompact}>
          <span><AppIcon name="clock" size={19} /></span>
          <div><strong>Nenhum período cadastrado.</strong><p>Crie um período para começar sua linha acadêmica.</p></div>
        </div>
      )}
    </section>
  );
}
