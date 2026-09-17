import { CourseForm, PeriodForm } from "@/components/academic/academic-forms";
import {
  AcademicHistoryPreview,
  FacultyHeader,
  FacultySummary,
  FacultyUpcomingExams,
  SubjectOverviewList,
  WeeklyClasses,
} from "@/components/faculty/faculty-overview";
import styles from "@/components/faculty/faculty-overview.module.css";
import { getFacultyHub } from "@/lib/academic/data";

export default async function FacultyPage() {
  const { classesThisWeek, courses, periods, subjects, upcomingExams } = await getFacultyHub();
  const currentCourse = courses.find((course) => course.status === "active") ?? courses[0];

  if (!currentCourse) {
    return (
      <main className={styles.page}>
        <FacultyHeader />
        <FacultySummary classesCount={0} completedSubjects={0} examsCount={0} subjectsCount={0} />
        <div className={styles.contentGrid}>
          <SubjectOverviewList subjects={[]} />
          <div className={styles.rightRail}>
            <FacultyUpcomingExams exams={[]} subjectNames={new Map()} />
            <WeeklyClasses classes={[]} subjectNames={new Map()} />
          </div>
        </div>
        <AcademicHistoryPreview periods={[]} subjectCounts={new Map()} />
        <section className={`${styles.panel} ${styles.management}`} aria-labelledby="academic-management-title">
          <div className={styles.managementTitle}>
            <div>
              <h2 id="academic-management-title">Comece cadastrando seu curso</h2>
              <p>Ele será a base para seus períodos, matérias, aulas e provas.</p>
            </div>
          </div>
          <div className={styles.managementGrid}>
            <details open>
              <summary>+ Criar primeiro curso</summary>
              <CourseForm />
            </details>
          </div>
        </section>
      </main>
    );
  }

  const coursePeriods = periods.filter((period) => period.course_id === currentCourse.id);
  const activePeriod = coursePeriods.find((period) => period.status === "active") ??
    coursePeriods.find((period) => period.status === "planned");
  const activeSubjects = activePeriod
    ? subjects.filter((subject) => subject.period_id === activePeriod.id)
    : [];
  const activeSubjectIds = new Set(activeSubjects.map((subject) => subject.id));
  const periodExams = upcomingExams.filter((exam) => activeSubjectIds.has(exam.subject_id));
  const periodClasses = classesThisWeek.filter((classSession) => activeSubjectIds.has(classSession.subject_id));
  const subjectNames = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const subjectCounts = new Map<string, number>();
  subjects.forEach((subject) => {
    subjectCounts.set(subject.period_id, (subjectCounts.get(subject.period_id) ?? 0) + 1);
  });
  const completedSubjects = activeSubjects.filter((subject) => subject.status === "completed").length;
  const otherCourses = courses.filter((course) => course.id !== currentCourse.id);

  return (
    <main className={styles.page}>
      <FacultyHeader course={currentCourse} period={activePeriod} />
      <FacultySummary
        classesCount={periodClasses.length}
        completedSubjects={completedSubjects}
        examsCount={periodExams.length}
        subjectsCount={activeSubjects.length}
      />

      <div className={styles.contentGrid}>
        <SubjectOverviewList period={activePeriod} subjects={activeSubjects} />
        <div className={styles.rightRail}>
          <FacultyUpcomingExams exams={periodExams} subjectNames={subjectNames} />
          <WeeklyClasses classes={periodClasses} subjectNames={subjectNames} />
        </div>
      </div>

      <AcademicHistoryPreview periods={coursePeriods} subjectCounts={subjectCounts} />

      <section className={`${styles.panel} ${styles.management}`} aria-labelledby="academic-management-title">
        <div className={styles.managementTitle}>
          <div>
            <h2 id="academic-management-title">Organização acadêmica</h2>
            <p>Criação e edição permanecem disponíveis como ações secundárias.</p>
          </div>
        </div>
        <div className={styles.managementGrid}>
          <details>
            <summary>Editar curso atual</summary>
            <CourseForm course={currentCourse} />
          </details>
          <details>
            <summary>+ Novo período</summary>
            <PeriodForm courseId={currentCourse.id} />
          </details>
          <details>
            <summary>+ Cadastrar outro curso</summary>
            <CourseForm />
          </details>
          {otherCourses.length ? (
            <div className={styles.otherCourses}>
              {otherCourses.map((course) => (
                <details className={styles.otherCourse} key={course.id}>
                  <summary>Editar {course.name}</summary>
                  <CourseForm course={course} />
                </details>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
