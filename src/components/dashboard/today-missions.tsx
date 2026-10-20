"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeMission } from "@/app/(protected)/mission-actions";
import type { TodayDashboard, TodayMission } from "@/lib/missions/today";
import styles from "./today-missions.module.css";

const priorities = { high: "Alta", medium: "Média", low: "Baixa" };

function MissionItem({ mission, onFeedback }: { mission: TodayMission; onFeedback: (message: string) => void }) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const completed = mission.group === "completed";

  function complete() {
    if (lock.current) return;
    lock.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await completeMission({ missionId: mission.id });
        if (!result.ok) { setError(result.message); return; }
        onFeedback("Missão concluída.");
        router.refresh();
      } catch { setError("Não foi possível concluir agora. Tente novamente."); }
      finally { lock.current = false; }
    });
  }

  return (
    <li className={`${styles.item} ${completed ? styles.completed : ""}`}>
      <div className={styles.copy}>
        <h4>{mission.title}</h4>
        {mission.description ? <p>{mission.description}</p> : null}
        <div className={styles.badges}>
          <span data-priority={mission.priority}>Prioridade {priorities[mission.priority]}</span>
          <span>{mission.category}</span>
          {mission.origin ? <span>{mission.origin}</span> : null}
          {mission.estimatedMinutes ? <span>{mission.estimatedMinutes} min</span> : null}
          <span>{mission.state}</span>
          {mission.dateLabel ? <span>{mission.dateLabel}</span> : null}
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </div>
      {completed ? <span className={styles.done}>✓ Concluída</span> : (
        <button type="button" disabled={pending} aria-label={`Concluir missão: ${mission.title}`} onClick={complete}>
          {pending ? "Concluindo…" : "Concluir"}
        </button>
      )}
    </li>
  );
}

export function TodayMissions({ dashboard }: { dashboard: TodayDashboard | null }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  return (
    <section className={styles.panel} aria-labelledby="today-missions-heading">
      <header className={styles.header}>
        <div><h2 id="today-missions-heading">Missões de hoje</h2><p>Seu foco no horário de Brasília</p></div>
        {dashboard ? <strong>{dashboard.completed} de {dashboard.total} concluídas · {dashboard.percent}%</strong> : null}
      </header>
      {dashboard ? <>
        <progress className={styles.progress} aria-label="Progresso das missões do dia" value={dashboard.completed} max={dashboard.total || 1} />
        <p className={styles.hint}>O total inclui pendentes de hoje, atrasadas e conclusões de hoje.</p>
        <p role="status" className={styles.feedback}>{feedback}</p>
        {dashboard.total === 0 ? <div className={styles.empty}><h3>Nenhuma missão para hoje.</h3><p>Você está em dia. Missões sem data não entram no foco do dia.</p></div> : null}
        {([ ["overdue", "Atrasadas"], ["today", "Hoje"], ["completed", "Concluídas hoje"] ] as const).map(([group, title]) => {
          const missions = dashboard.missions.filter((mission) => mission.group === group);
          return missions.length ? <section key={group} className={styles.group} data-group={group} aria-label={title}>
            <h3>{title} <span>{missions.length}</span></h3>
            <ul>{missions.map((mission) => <MissionItem key={mission.id} mission={mission} onFeedback={setFeedback} />)}</ul>
          </section> : null;
        })}
      </> : <div className={styles.empty}><p role="alert">Não foi possível carregar as missões agora.</p><button type="button" onClick={() => router.refresh()}>Tentar novamente</button></div>}
    </section>
  );
}
