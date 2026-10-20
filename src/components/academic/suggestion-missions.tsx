"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMissionsFromAnalysisSuggestions } from "@/app/(protected)/faculdade/materias/[id]/materiais/actions";
import type { AcademicAnalysis, SuggestionLink } from "@/lib/academic/materials/analysis-schema";
import type { MissionFields } from "@/lib/academic/materials/suggestion-contract";
import styles from "./material-analysis.module.css";

const priorities = { high: "Alta", medium: "Média", low: "Baixa" };
export function SuggestionMissions({ analysisId, suggestions, links = [] }: {
  analysisId: string; suggestions: AcademicAnalysis["suggestedMissions"]; links?: SuggestionLink[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [review, setReview] = useState(false);
  const [drafts, setDrafts] = useState<MissionFields[]>(() => suggestions.map(item => ({ ...item })));
  const [added, setAdded] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const lock = useRef(false), reviewTitle = useRef<HTMLHeadingElement>(null), selectButton = useRef<HTMLButtonElement>(null), status = useRef<HTMLParagraphElement>(null);
  const converted = new Set([...links.map(link => link.suggestionIndex), ...added]);
  const remaining = selected.filter(index => !converted.has(index));
  function edit(index: number, patch: Partial<MissionFields>) {
    setDrafts(current => current.map((draft, i) => i === index ? { ...draft, ...patch } : draft));
  }
  function confirm() {
    if (lock.current || !remaining.length) return;
    lock.current = true;
    setErrors({});
    startTransition(async () => {
      try {
        const response = await createMissionsFromAnalysisSuggestions({ analysisId,
          suggestions: remaining.map(suggestionIndex => ({ suggestionIndex, fields: drafts[suggestionIndex] })) });
        if (!response.ok) { setFeedback(response.message); return; }
        const successes = response.items.filter(item => item.status !== "failed").map(item => item.suggestionIndex);
        const failures = response.items.filter(item => item.status === "failed");
        setAdded(current => [...new Set([...current, ...successes])]);
        setSelected(current => current.filter(index => !successes.includes(index)));
        setErrors(Object.fromEntries(failures.map(item => [item.suggestionIndex, item.message])));
        setFeedback(failures.length ? `${successes.length} adicionada(s); ${failures.length} não confirmada(s). Revise os itens indicados e tente novamente.`
          : response.items.every(item => item.status === "already_created") ? "Esta sugestão já foi adicionada." : successes.length === 1 ? "Missão adicionada." : "Missões adicionadas.");
        if (!failures.length) setReview(false);
        router.refresh();
      } catch { setFeedback("Não foi possível confirmar a criação. Tente novamente: sugestões já adicionadas não serão duplicadas."); }
      finally { lock.current = false; requestAnimationFrame(() => status.current?.focus()); }
    });
  }
  return <div aria-busy={pending}>
    <div className={styles.grid}>{suggestions.map((suggestion, index) => <article className={styles.card} key={index}>
      <strong>{suggestion.title}</strong><small>{suggestion.estimatedMinutes} min · Prioridade {priorities[suggestion.priority].toLowerCase()}</small><p>{suggestion.description}</p>
      {converted.has(index) ? <p>Adicionada às missões{links.some(link => link.suggestionIndex === index && link.missionId === null) ? " · Missão removida posteriormente." : ""}</p>
        : <label className={styles.selection}><input type="checkbox" checked={selected.includes(index)} disabled={pending || review}
          onChange={event => setSelected(current => event.target.checked ? [...current, index] : current.filter(item => item !== index))} />Selecionar sugestão {index + 1}</label>}
      {errors[index] ? <p role="alert">{errors[index]}</p> : null}
    </article>)}</div>
    {!suggestions.length ? <p>Nenhuma sugestão nesta análise.</p> : null}
    {!review && suggestions.some((_, index) => !converted.has(index)) ? <button className={styles.reviewButton} disabled={pending || !remaining.length} ref={selectButton} type="button"
      onClick={() => { setReview(true); setFeedback(""); requestAnimationFrame(() => reviewTitle.current?.focus()); }}>Revisar selecionadas ({remaining.length})</button> : null}
    {review ? <form className={styles.confirm} onSubmit={event => { event.preventDefault(); confirm(); }}>
      <h5 ref={reviewTitle} tabIndex={-1}>Revisar missões selecionadas</h5>
      <p>Confira os campos. As missões só serão criadas ao confirmar abaixo, sem data automática.</p>
      {remaining.map(index => <fieldset className={styles.editor} disabled={pending} key={index}>
        <legend>Sugestão {index + 1}</legend>
        <div><label htmlFor={`${analysisId}-${index}-title`}>Título</label><input id={`${analysisId}-${index}-title`} required maxLength={200} value={drafts[index].title} onChange={event => edit(index, { title: event.target.value })} /></div>
        <div><label htmlFor={`${analysisId}-${index}-description`}>Descrição</label><textarea id={`${analysisId}-${index}-description`} rows={4} maxLength={20000} value={drafts[index].description} onChange={event => edit(index, { description: event.target.value })} /></div>
        <div><label htmlFor={`${analysisId}-${index}-priority`}>Prioridade</label><select id={`${analysisId}-${index}-priority`} value={drafts[index].priority} onChange={event => edit(index, { priority: event.target.value as MissionFields["priority"] })}>
          <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div>
        <div><label htmlFor={`${analysisId}-${index}-minutes`}>Duração estimada (minutos)</label><input id={`${analysisId}-${index}-minutes`} type="number" required min={1} max={2147483647} step={1} value={Number.isNaN(drafts[index].estimatedMinutes) ? "" : drafts[index].estimatedMinutes}
          onChange={event => edit(index, { estimatedMinutes: event.target.valueAsNumber })} /></div>
        {errors[index] ? <p role="alert">{errors[index]}</p> : null}
      </fieldset>)}
      <div className={styles.buttons}><button type="button" disabled={pending} onClick={() => { setReview(false); requestAnimationFrame(() => selectButton.current?.focus()); }}>Voltar à seleção</button>
        <button type="submit" disabled={pending || !remaining.length}>{pending ? "Adicionando..." : remaining.length === 1 ? "Adicionar como missão" : "Adicionar selecionadas"}</button></div>
    </form> : null}
    <p aria-live="polite" role="status" ref={status} tabIndex={-1}>{feedback}</p>
  </div>;
}
