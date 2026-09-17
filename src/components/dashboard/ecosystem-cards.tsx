import Link from "next/link";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

import styles from "./dashboard.module.css";

function ModuleHeader({
  caption,
  icon,
  title,
  tone = "blue",
}: {
  caption: string;
  icon: AppIconName;
  title: string;
  tone?: "blue" | "green";
}) {
  return (
    <div className={styles.moduleIdentity}>
      <span className={`${styles.moduleIcon} ${tone === "green" ? styles.moduleIconGreen : ""}`}><AppIcon name={icon} size={18} /></span>
      <div><h2>{title}</h2><p>{caption}</p></div>
    </div>
  );
}

export function PlannedModuleCard({
  description,
  icon,
  title,
}: {
  description: string;
  icon: AppIconName;
  title: string;
}) {
  return (
    <article className={`${styles.panel} ${styles.moduleCard}`}>
      <div className={styles.moduleTop}>
        <ModuleHeader caption="Módulo em preparação" icon={icon} title={title} tone="green" />
        <span className={styles.moduleBadge}>Em breve</span>
      </div>
      <div className={styles.moduleBody}>
        <p className={styles.moduleBodyLabel}>Próxima evolução</p>
        <div aria-hidden="true" className={styles.plannedPreview}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.plannedMessage}>
          <strong>Em breve</strong>
          <p>{description}</p>
        </div>
      </div>
    </article>
  );
}

export function FacultySummaryCard({
  courseName,
  examCount,
  periodName,
  subjectCount,
}: {
  courseName: string;
  examCount: number;
  periodName: string;
  subjectCount: number;
}) {
  return (
    <article className={`${styles.panel} ${styles.moduleCard}`}>
      <div className={styles.moduleTop}>
        <ModuleHeader caption="Conhecimento constrói liberdade" icon="college" title="Faculdade" />
        <span className={styles.moduleBadge}>Ativo</span>
      </div>
      <div className={styles.moduleBody}>
        <p className={styles.moduleBodyLabel}>{courseName}</p>
        <div className={styles.facultyStats}>
          <div><strong>{periodName === "Nenhum período" ? "—" : "1"}</strong><span>período atual</span></div>
          <div><strong>{subjectCount}</strong><span>matérias</span></div>
          <div><strong>{examCount}</strong><span>provas futuras</span></div>
        </div>
        <Link className={styles.facultyLink} href="/faculdade">Ver Faculdade <AppIcon name="chevron" size={12} /></Link>
      </div>
    </article>
  );
}
