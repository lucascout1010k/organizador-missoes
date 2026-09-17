import { AppIcon } from "@/components/ui/app-icon";

import styles from "./dashboard.module.css";

export function DashboardHeader() {
  const now = new Date();
  const timeZone = "America/Sao_Paulo";
  const hour = Number(new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(now));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone,
  }).format(now);

  return (
    <header className={styles.intro}>
      <div>
        <h1>{greeting}, guerreiro.</h1>
        <p>Pequenas ações, grandes resultados.</p>
      </div>
      <time className={styles.datePill} dateTime={now.toISOString()}>
        <AppIcon name="agenda" size={14} />
        <span>{date}</span>
      </time>
    </header>
  );
}
