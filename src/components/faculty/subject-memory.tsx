import Link from "next/link";
import type { SubjectAcademicMemory } from "@/lib/academic/subject-memory";
import { LocalDateTime } from "@/components/academic/local-date-time";
import styles from "./subject-memory.module.css";

export function SubjectMemory({ memory }: { memory: SubjectAcademicMemory }) {
  const { stats, latestAnalyzedMaterial: latest } = memory;
  const materialUrl = (id: string) => `/faculdade/materias/${memory.subject.id}/materiais/${id}`;
  return <section aria-label="Memória acadêmica" className={styles.memory}>
    <header><p className={styles.eyebrow}>Seu percurso na disciplina</p><h2>Memória acadêmica</h2><p>O conhecimento das suas análises, reunido aqui a cada retorno.</p></header>
    <dl className={styles.metrics}>
      {[[stats.materials, "Materiais"], [stats.analyzed, "Analisados"], [stats.studiedTopics, "Tópicos vistos"], [stats.pendingMissions, "Missões pendentes"]].map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <div className={styles.grid}>
      <article className={styles.card}>
        <h3>O que você já viu</h3>
        <p>A memória cobre {stats.analyzed} de {stats.materials} materiais. Os tópicos indicam conteúdo analisado, sem presumir domínio.</p>
        {memory.studiedTopics.length ? <ul className={styles.terms}>{memory.studiedTopics.slice(0, 12).map(topic => <li key={topic}>{topic}</li>)}</ul> : <p>Analise um PDF para começar a reunir o conteúdo da matéria.</p>}
        {memory.studiedTopics.length > 12 ? <details><summary>Ver os demais tópicos ({memory.studiedTopics.length - 12})</summary><ul>{memory.studiedTopics.slice(12).map(topic => <li key={topic}>{topic}</li>)}</ul></details> : null}
        {memory.keywords.length ? <><h4>Palavras-chave recentes</h4><ul className={styles.terms}>{memory.keywords.slice(0, 16).map(word => <li key={word}>{word}</li>)}</ul></> : null}
      </article>
      <article className={styles.card}>
        <h3>Último conteúdo analisado</h3>
        {latest ? <><Link href={materialUrl(latest.id)}>{latest.title}</Link><p className={styles.date}><LocalDateTime value={latest.completedAt} /></p><p>{latest.summary}</p><ul>{latest.topics.map(topic => <li key={topic}>{topic}</li>)}</ul><Link href={materialUrl(latest.id)}>Continuar no material →</Link></> : <p>Nenhuma análise concluída disponível.</p>}
      </article>
      <article className={styles.card}>
        <h3>Pendências da matéria</h3><p>{stats.pendingMissions} pendentes · {stats.completedMissions} concluídas</p>
        {memory.pendingMissions.length ? <ul>{memory.pendingMissions.slice(0, 5).map(mission => <li key={mission.id}>{mission.title}</li>)}</ul> : <p>Nenhuma missão pendente relacionada.</p>}
        <p>{stats.suggestedMissions} sugestões nas análises · {stats.createdMissions} missões relacionadas</p>
        <Link href="/">Ver foco de hoje</Link>
      </article>
      <article className={styles.card}>
        <h3>O que falta processar</h3><p>{stats.awaitingAnalysis} {stats.awaitingAnalysis === 1 ? "material aguardando análise" : "materiais aguardando análise"}.</p>
        <p>Escolha um material para analisar quando quiser continuar.</p><a href="#materiais">Ir aos materiais →</a>
        {memory.invalidAnalyses ? <p role="status">Há resultados indisponíveis. Confira o detalhe dos materiais.</p> : null}
        {memory.limitations.length ? <details><summary>Limitações das análises</summary><ul>{memory.limitations.map(item => <li key={item}>{item}</li>)}</ul></details> : null}
      </article>
    </div>
  </section>;
}
