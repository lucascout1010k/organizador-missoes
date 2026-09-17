import { AppIcon } from "@/components/ui/app-icon";
import type { Exam } from "@/lib/academic/types";

import styles from "./dashboard.module.css";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function WeekAgenda({ exams, subjectNames }: { exams: Exam[]; subjectNames: Map<string, string> }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() + index);
    return date;
  });

  return (
    <section className={`${styles.panel} ${styles.sectionPanel}`}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <span className={styles.panelHeadingIcon}><AppIcon name="agenda" size={17} /></span>
          <h2>Agenda da semana</h2>
        </div>
        <span className={styles.panelCount}>Próximos 7 dias</span>
      </header>
      <div className={styles.weekBody}>
        <div className={styles.weekGrid}>
          {days.map((day, index) => {
            const key = dateKey(day);
            const dayExams = exams.filter((exam) => exam.exam_date.slice(0, 10) === key);
            return (
              <div className={styles.dayColumn} key={key}>
                <div className={`${styles.dayHead} ${index === 0 ? styles.dayHeadToday : ""}`}>
                  <span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(day).replace(".", "")}</span>
                  <strong>{day.getUTCDate()}</strong>
                </div>
                <div className={styles.dayTrack}>
                  {dayExams.length ? dayExams.map((exam) => (
                    <div className={styles.calendarEvent} key={exam.id}>
                      {exam.title}
                      <small>{subjectNames.get(exam.subject_id) ?? "Matéria"}</small>
                    </div>
                  )) : index === 0 ? <span className={styles.calendarEmpty}>Livre</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
