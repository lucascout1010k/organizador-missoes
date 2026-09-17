import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { FacultySummaryCard, PlannedModuleCard } from "@/components/dashboard/ecosystem-cards";
import styles from "@/components/dashboard/dashboard.module.css";
import { UpcomingExams } from "@/components/dashboard/upcoming-exams";
import { WeekAgenda } from "@/components/dashboard/week-agenda";
import { getFacultyOverview } from "@/lib/academic/data";

export default async function Home() {
  const { courses, periods, subjects, upcomingExams } = await getFacultyOverview();
  const currentCourse = courses.find((course) => course.status === "active") ?? courses[0];
  const coursePeriods = currentCourse
    ? periods.filter((period) => period.course_id === currentCourse.id)
    : [];
  const activePeriod = coursePeriods.find((period) => period.status === "active") ??
    coursePeriods.find((period) => period.status === "planned");
  const activeSubjects = activePeriod
    ? subjects.filter((subject) => subject.period_id === activePeriod.id && subject.status === "active")
    : [];
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <div className={styles.page}>
      <DashboardHeader />

      <DashboardSummary activeSubjectCount={activeSubjects.length} examCount={upcomingExams.length} />

      <div className={styles.mainGrid}>
        <UpcomingExams exams={upcomingExams} subjectNames={subjectNames} />
        <WeekAgenda exams={upcomingExams} subjectNames={subjectNames} />
      </div>

      <section aria-label="Seu ecossistema pessoal" className={styles.ecosystemGrid}>
        <PlannedModuleCard
          description="Treinos, hábitos e frequência serão conectados quando o módulo Academia for autorizado."
          icon="academy"
          title="Academia"
        />
        <FacultySummaryCard
          courseName={currentCourse?.name ?? "Estrutura acadêmica"}
          examCount={upcomingExams.length}
          periodName={activePeriod?.name ?? "Nenhum período"}
          subjectCount={activeSubjects.length}
        />
        <PlannedModuleCard
          description="Projetos, etapas e próximas ações ganharão vida em uma etapa futura."
          icon="projects"
          title="Projetos"
        />
      </section>

      <aside className={`${styles.panel} ${styles.mobileQuote}`}>
        <blockquote>“Disciplina é o que transforma intenção em resultado.”</blockquote>
      </aside>
    </div>
  );
}
