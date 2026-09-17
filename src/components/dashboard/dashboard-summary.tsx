import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

import styles from "./dashboard.module.css";

function SummaryCard({
  hint,
  icon,
  label,
  value,
}: {
  hint: string;
  icon: AppIconName;
  label: string;
  value: string;
}) {
  return (
    <article className={`${styles.panel} ${styles.summaryCard}`}>
      <div className={styles.summaryTop}>
        <span className={styles.summaryIcon}><AppIcon name={icon} size={15} /></span>
        <span>{label}</span>
      </div>
      <div className={styles.summaryValue}>{value}</div>
      <p className={styles.summaryHint}>{hint}</p>
    </article>
  );
}

export function DashboardSummary({
  activeSubjectCount,
  examCount,
}: {
  activeSubjectCount: number;
  examCount: number;
}) {
  return (
    <section aria-label="Resumo do dashboard" className={styles.summaryGrid}>
      <SummaryCard
        hint={examCount ? "Compromissos acadêmicos cadastrados" : "Nenhuma prova futura cadastrada"}
        icon="agenda"
        label="Próximas provas"
        value={examCount ? `${examCount} ${examCount === 1 ? "prova" : "provas"}` : "Agenda livre"}
      />
      <SummaryCard
        hint={activeSubjectCount ? "No período acadêmico atual" : "Cadastre matérias na Faculdade"}
        icon="college"
        label="Faculdade em foco"
        value={activeSubjectCount ? `${activeSubjectCount} ${activeSubjectCount === 1 ? "matéria" : "matérias"}` : "Sem matérias"}
      />
      <article className={`${styles.panel} ${styles.summaryCard} ${styles.quoteCard}`}>
        <blockquote>
          “Foco é escolher o que importa e dizer não para o resto.”
          <cite>— princípio de trabalho</cite>
        </blockquote>
      </article>
    </section>
  );
}
