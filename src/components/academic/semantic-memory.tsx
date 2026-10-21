"use client";
import { useRef, useState, useTransition, type Ref } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMaterialToSemanticMemory, askSubjectMemory } from "@/app/(protected)/faculdade/materias/[id]/materiais/semantic-actions";
import type { SemanticAnswer, SemanticStatus } from "@/lib/academic/semantic/contracts";
import styles from "./material-analysis.module.css";
import semanticStyles from "./semantic-memory.module.css";

export function SemanticIndexControl({ materialId, status }: { materialId: string; status?: SemanticStatus["status"] }) {
  const router = useRouter(), lock = useRef(false), trigger = useRef<HTMLButtonElement>(null), cancelButton = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false), [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function cancel() { setConfirm(false); requestAnimationFrame(() => trigger.current?.focus()); }
  function index() {
    if (lock.current) return;
    lock.current = true; setConfirm(false);
    startTransition(async () => {
      try {
        const result = await addMaterialToSemanticMemory({ materialId, consent: true });
        setMessage(result.ok ? result.value.status === "ready" ? "Material adicionado à memória pesquisável." : "A indexação já está em andamento. Confira novamente em instantes." : result.message);
        router.refresh();
      } catch { setMessage("Não foi possível confirmar a indexação. Confira novamente antes de tentar."); }
      finally { lock.current = false; requestAnimationFrame(() => trigger.current?.focus()); }
    });
  }
  return <section aria-label="Memória pesquisável do material" aria-busy={pending} className={`${styles.analysis} ${semanticStyles.panel}`}>
    <h2>Memória pesquisável</h2>
    {status === "ready" ? <p>Este material já pode ser consultado nas perguntas da matéria.</p> : <>
      <p>{status === "indexing" ? "Indexação em andamento." : status === "failed" ? "A indexação anterior não foi concluída." : "Este PDF ainda não faz parte da memória pesquisável."}</p>
      <button ref={trigger} type="button" disabled={pending || confirm} onClick={() => { setConfirm(true); requestAnimationFrame(() => cancelButton.current?.focus()); }}>{status === "indexing" ? "Verificar indexação" : "Adicionar à memória pesquisável"}</button>
    </>}
    {confirm ? <div className={styles.confirm} role="group" aria-label="Adicionar este material à memória pesquisável?" onKeyDown={event => { if (event.key === "Escape" && !pending) cancel(); }}>
      <strong>Adicionar este material à memória pesquisável?</strong>
      <p>Para permitir perguntas futuras sobre a matéria, páginas deste PDF serão enviadas ao Google Gemini para gerar representações semânticas (embeddings). O PDF continuará armazenado no seu Supabase.</p>
      <p>Este fluxo aceita PDFs de até 120 páginas. A análise existente será preservada. Esta ação pode gerar custo no provedor.</p>
      <div className={styles.buttons}><button ref={cancelButton} type="button" onClick={cancel}>Cancelar</button><button type="button" onClick={index}>Adicionar à memória</button></div>
    </div> : null}
    <p role="status" aria-live="polite">{pending ? "Adicionando páginas à memória…" : message}</p>
  </section>;
}

export function AskSubjectMemory({ subjectId, indexed, total, unavailable = false }: { subjectId: string; indexed: number; total: number; unavailable?: boolean }) {
  const [question, setQuestion] = useState(""), [answer, setAnswer] = useState<SemanticAnswer | null>(null), [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition(), lock = useRef(false), resultTitle = useRef<HTMLHeadingElement>(null);
  return <section aria-label="Perguntar à matéria" className={`${styles.analysis} ${semanticStyles.panel}`}>
    <h2>Perguntar à matéria</h2>{unavailable ? <p role="status">A memória pesquisável está indisponível no momento. Tente novamente mais tarde.</p> : <p>Memória pesquisável: {indexed} de {total} materiais.</p>}
    <p>Ao perguntar, sua pergunta, um resumo da memória e páginas relevantes serão enviados ao Google Gemini. Perguntas e respostas não ficam salvas.</p>
    <form onSubmit={event => {
      event.preventDefault(); if (lock.current || !question.trim() || !indexed || unavailable) return;
      lock.current = true; setMessage(""); setAnswer(null);
      startTransition(async () => {
        try { const result = await askSubjectMemory({ subjectId, question }); if (result.ok) setAnswer(result.value); else setMessage(result.message); }
        catch { setMessage("Não foi possível responder agora. Tente novamente em instantes."); }
        finally { lock.current = false; requestAnimationFrame(() => resultTitle.current?.focus()); }
      });
    }} className={styles.confirm}>
      <label htmlFor={`question-${subjectId}`}>Sua pergunta</label>
      <textarea className={semanticStyles.question} id={`question-${subjectId}`} maxLength={600} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Pergunte algo sobre o que você já estudou..." disabled={pending} required />
      <button type="submit" disabled={pending || !question.trim() || !indexed || unavailable}>{pending ? "Pesquisando…" : "Perguntar"}</button>
    </form>
    {!indexed && !unavailable ? <p>Abra um material e escolha “Adicionar à memória pesquisável” para começar.</p> : null}
    <p aria-live="polite" role="status">{message}</p>
    {answer ? <SemanticAnswerView answer={answer} subjectId={subjectId} titleRef={resultTitle} /> : null}
  </section>;
}

export function SemanticAnswerView({ answer, subjectId, titleRef }: { answer: SemanticAnswer; subjectId: string; titleRef?: Ref<HTMLHeadingElement> }) {
  return <article className={`${styles.card} ${semanticStyles.answer}`}>
      <h3 ref={titleRef} tabIndex={-1}>{answer.status === "not_found" ? "Não encontrado nas fontes" : answer.status === "partial" ? "Resposta parcial" : "Resposta"}</h3>
      <p className={semanticStyles.answerText}>{answer.answer}</p>
      <p>Memória pesquisável: {answer.coverage.indexed} de {answer.coverage.total} materiais. Páginas consultadas de {answer.coverage.consulted} {answer.coverage.consulted === 1 ? "material" : "materiais"} nesta resposta.</p>
      {answer.sources.length ? <><h4>Fontes</h4><ul>{answer.sources.map(source => <li key={source.sourceId}><Link href={`/faculdade/materias/${subjectId}/materiais/${source.materialId}`}>{source.title} · {source.pageStart === source.pageEnd ? `página ${source.pageStart}` : `páginas ${source.pageStart}–${source.pageEnd}`}</Link></li>)}</ul></> : null}
      {answer.limitations.length ? <><h4>Limitações</h4><ul>{answer.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></> : null}
      <p>Confira a resposta com as fontes. A IA pode cometer erros.</p>
    </article>;
}
