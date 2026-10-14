"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAcademicMaterial, downloadAcademicMaterial, finalizeMaterialUpload, openAcademicMaterial } from "@/app/(protected)/faculdade/materias/[id]/materiais/actions";
import type { MaterialItem } from "@/lib/academic/materials/management";
import type { AnalysisView } from "@/lib/academic/materials/analysis-schema";
import { MaterialAnalysis } from "./material-analysis";
import styles from "./material-list.module.css";

export const materialStatusLabels = {
  pending_upload: "Envio pendente", validating: "Validando PDF...", ready: "Pronto",
  upload_failed: "Falha no envio", deleting: "Excluindo...",
};

export function formatMaterialSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1048576 ? "KiB" : "MiB";
  return `${(bytes / (unit === "KiB" ? 1024 : 1048576)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;
}

function MaterialRow({ item, analysis }: { item: MaterialItem; analysis?: AnalysisView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const ready = item.fileStatus === "ready";
  const deleting = item.fileStatus === "deleting";

  function act(operation: "open" | "download" | "delete" | "retry") {
    if (lock.current) return;
    lock.current = true;
    // Reserve a tab during the user gesture; async actions otherwise trigger popup blockers.
    const tab = operation === "open" || operation === "download" ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    startTransition(async () => {
      try {
        if ((operation === "open" || operation === "download") && !tab) {
          setMessage("Permita abrir uma nova aba e tente novamente."); return;
        }
        const result = operation === "open" ? await openAcademicMaterial(item.id)
          : operation === "download" ? await downloadAcademicMaterial(item.id)
          : operation === "delete" ? await deleteAcademicMaterial(item.id)
          : await finalizeMaterialUpload(item.id);
        setMessage(result.message);
        if (tab) {
          if (result.ok && "url" in result && result.url) tab.location.replace(result.url);
          else tab.close();
        }
        if (operation === "delete" || operation === "retry") router.refresh();
        setConfirmation(false);
      } catch {
        tab?.close(); setMessage("Não foi possível concluir agora. Tente novamente.");
      } finally { lock.current = false; }
    });
  }

  function cancel() {
    setConfirmation(false);
    requestAnimationFrame(() => deleteButton.current?.focus());
  }

  return <li aria-busy={pending} className={styles.row}>
    <div aria-hidden="true" className={styles.pdf}>PDF</div>
    <div className={styles.details}>
      <h3>{item.title}</h3>
      <p className={styles.filename}>{item.originalFilename}</p>
      <p className={styles.meta}>{formatMaterialSize(item.sizeBytes)} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p>
      <span className={styles.badge} data-state={item.fileStatus}>{materialStatusLabels[item.fileStatus]}</span>
      {item.fileStatus === "upload_failed" ? <p className={styles.hint}>Confira o envio novamente. Se o arquivo não for encontrado, envie um novo PDF.</p> : null}
      {deleting ? <p className={styles.hint}>A remoção está pendente de confirmação.</p> : null}
      <div className={styles.actions}>
        {ready ? <><button disabled={pending} onClick={() => act("open")} type="button">Abrir</button><button disabled={pending} onClick={() => act("download")} type="button">Baixar</button></> : null}
        {!ready && !deleting ? <button disabled={pending} onClick={() => act("retry")} type="button">Tentar novamente</button> : null}
        {deleting ? <button disabled={pending} onClick={() => act("delete")} type="button">Concluir exclusão</button> : <button className={styles.delete} disabled={pending || confirmation} ref={deleteButton} onClick={() => { setConfirmation(true); requestAnimationFrame(() => cancelButton.current?.focus()); }} type="button">Excluir</button>}
      </div>
      {confirmation ? <div aria-label="Excluir material?" className={styles.confirmation} onKeyDown={event => { if (event.key === "Escape" && !pending) cancel(); }} role="group">
        <strong>Excluir material?</strong><p>Este PDF será removido dos seus materiais.</p>
        <div className={styles.actions}><button disabled={pending} onClick={cancel} ref={cancelButton} type="button">Cancelar</button><button className={styles.delete} disabled={pending} onClick={() => act("delete")} type="button">{pending ? "Excluindo…" : "Confirmar exclusão"}</button></div>
      </div> : null}
      <p aria-live="polite" className={styles.feedback} role="status">{pending ? "Aguarde…" : message}</p>
      {ready ? <MaterialAnalysis analysis={analysis} materialId={item.id} /> : null}
    </div>
  </li>;
}

export function MaterialList({ items, unavailable, analyses = {} }: { items: MaterialItem[]; unavailable: boolean; analyses?: Record<string, AnalysisView> }) {
  return <div className={styles.container}>
    <h2>Seus materiais <span className={styles.count}>{items.length}</span></h2>
    {unavailable ? <p role="status">Não foi possível carregar os materiais. Tente novamente em instantes.</p>
      : items.length === 0 ? <p className={styles.empty}>Seus PDFs aparecerão aqui após o envio. Apenas arquivos validados podem ser abertos.</p>
      : <ul aria-label="Materiais da matéria" className={styles.list}>{items.map(item => <MaterialRow analysis={analyses[item.id]} item={item} key={item.id} />)}</ul>}
  </div>;
}
