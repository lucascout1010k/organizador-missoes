import Link from "next/link";

import { LocalDateTime } from "@/components/academic/local-date-time";
import { AppIcon } from "@/components/ui/app-icon";
import type { Exam } from "@/lib/academic/types";

import styles from "./dashboard.module.css";

export function UpcomingExams({
  exams,
  subjectNames,
}: {
  exams: Exam[];
  subjectNames: Map<string, string>;
}) {
  return (
    <section className={`${styles.panel} ${styles.sectionPanel}`}>
      <header className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <span className={styles.panelHeadingIcon}><AppIcon name="check" size={17} /></span>
          <h2>Próximos compromissos</h2>
        </div>
        <span className={styles.panelCount}>{exams.length ? `${exams.length} agendados` : "Tudo em ordem"}</span>
      </header>

      {exams.length ? (
        <div className={styles.examList}>
          {exams.slice(0, 4).map((exam) => (
            <Link className={styles.examItem} href={`/faculdade/materias/${exam.subject_id}#provas`} key={exam.id}>
              <span className={styles.examStatus}><AppIcon name="college" size={13} /></span>
              <span className={styles.examCopy}>
                <strong>{exam.title}</strong>
                <small>Faculdade · {subjectNames.get(exam.subject_id) ?? "Matéria"}</small>
              </span>
              <span className={styles.examTime}><LocalDateTime value={exam.exam_date} /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span><AppIcon name="check" size={20} /></span>
          <strong>Nenhum compromisso próximo.</strong>
          <p>Quando uma prova for cadastrada na Faculdade, ela aparecerá aqui automaticamente.</p>
        </div>
      )}
    </section>
  );
}
