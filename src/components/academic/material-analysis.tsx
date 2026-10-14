"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analyzeAcademicMaterial } from "@/app/(protected)/faculdade/materias/[id]/materiais/actions";
import type { AnalysisView, AcademicAnalysis } from "@/lib/academic/materials/analysis-schema";
import styles from "./material-analysis.module.css";

const priorities = { high: "Alta", medium: "Média", low: "Baixa" };
const difficulties = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const exerciseTypes = { concept: "Conceito", review: "Revisão", practice: "Prática" };

export function resolveAnalysisView(analysis?: AnalysisView, local?: AnalysisView) {
  // A confirmed completion must appear immediately, even before router.refresh
  // delivers new props. For the same nonterminal attempt, fresh server state wins.
  if (!local) return analysis;
  if (!analysis || local.id !== analysis.id || local.status === "completed") return local;
  return analysis;
}

function Exercise({ exercise }: { exercise: AcademicAnalysis["exercises"][number] }) {
  const [visible, setVisible] = useState(false);
  return <article className={styles.card}><p>{exercise.question}</p><small>{difficulties[exercise.difficulty]} · {exerciseTypes[exercise.type]}</small>
    <button aria-expanded={visible} onClick={() => setVisible(value => !value)} type="button">{visible ? "Ocultar resposta" : "Ver resposta"}</button>
    {visible ? <p className={styles.answer}>{exercise.answer}</p> : null}
  </article>;
}

export function AcademicAnalysisResult({ result }: { result: AcademicAnalysis }) {
  return <section aria-label="Análise com IA" className={styles.result}>
    <h4>Análise com IA</h4><p className={styles.notice}>Confira o resultado com o PDF. A IA pode cometer erros; sugestões não criam missões.</p>
    <h5>Resumo</h5><p>{result.summary}</p>
    <h5>Principais tópicos</h5><div className={styles.grid}>{result.topics.map((topic,index) => <article className={styles.card} key={index}><strong>{topic.title}</strong><small>Importância {priorities[topic.importance].toLowerCase()}</small><p>{topic.explanation}</p></article>)}</div>
    <h5>Palavras-chave</h5><ul className={styles.keywords}>{result.keywords.map((keyword,index) => <li key={index}>{keyword}</li>)}</ul>
    <h5>Exercícios para praticar</h5><div className={styles.grid}>{result.exercises.map((exercise,index) => <Exercise exercise={exercise} key={index} />)}</div>
    <h5>Sugestões de estudo</h5><div className={styles.grid}>{result.suggestedMissions.map((suggestion,index) => <article className={styles.card} key={index}><strong>{suggestion.title}</strong><small>{suggestion.estimatedMinutes} min · Prioridade {priorities[suggestion.priority].toLowerCase()}</small><p>{suggestion.description}</p></article>)}</div>
    {result.limitations.length ? <><h5>Limitações</h5><ul>{result.limitations.map((item,index) => <li key={index}>{item}</li>)}</ul></> : null}
  </section>;
}

export function MaterialAnalysis({ materialId, analysis }: { materialId: string; analysis?: AnalysisView }) {
  const router = useRouter();
  const [pending,startTransition] = useTransition();
  const [confirm,setConfirm] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [local,setLocal] = useState<AnalysisView | undefined>();
  const lock = useRef(false), trigger = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const current = resolveAnalysisView(analysis, local);
  function cancel() { setConfirm(false); requestAnimationFrame(() => trigger.current?.focus()); }
  function analyze() {
    if (lock.current) return;
    lock.current = true;
    setConfirm(false);
    startTransition(async () => {
      try {
        const result = await analyzeAcademicMaterial({ materialId, consent: true });
        if (result.ok) { setLocal(result.analysis); setFeedback(""); }
        else setFeedback(result.message);
        router.refresh();
      } catch { setFeedback("Não foi possível analisar este material. Tente novamente em instantes."); }
      finally { lock.current = false; requestAnimationFrame(() => trigger.current?.focus()); }
    });
  }
  return <div aria-busy={pending} className={styles.analysis}>
    {current?.status === "completed" && current.result ? <AcademicAnalysisResult result={current.result} /> : <>
      <p aria-live="polite" role="status">{pending || current?.status === "processing" ? "Analisando material..." : current?.status === "failed" ? "Não foi possível analisar este material." : "Este material ainda não foi analisado."}</p>
      <button disabled={pending || confirm} onClick={() => { setConfirm(true); requestAnimationFrame(() => cancelButton.current?.focus()); }} ref={trigger} type="button">{current?.status === "processing" ? "Verificar análise" : current?.status === "failed" ? "Tentar novamente" : "Analisar com IA"}</button>
      {current?.status === "processing" ? <p className={styles.notice}>Uma análise em andamento será reutilizada. Se a tentativa ficou interrompida, uma nova chamada só ocorrerá após expirar e com sua confirmação.</p> : null}
    </>}
    {confirm ? <div aria-label="Analisar este PDF com IA?" className={styles.confirm} onKeyDown={event => { if (event.key === "Escape" && !pending) cancel(); }} role="group">
      <strong>Analisar este PDF com IA?</strong><p>O conteúdo deste arquivo será enviado ao Google Gemini para gerar resumo, tópicos, exercícios e sugestões de estudo.</p>
      <div className={styles.buttons}><button disabled={pending} onClick={cancel} ref={cancelButton} type="button">Cancelar</button><button disabled={pending} onClick={analyze} type="button">Analisar PDF</button></div>
    </div> : null}
    {feedback ? <p aria-live="polite" className={styles.notice} role="status">{feedback}</p> : null}
  </div>;
}
