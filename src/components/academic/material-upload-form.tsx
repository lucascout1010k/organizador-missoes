"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import type {
  PrepareMaterialUploadInput,
  PrepareMaterialUploadResult,
  ReportMaterialUploadFailureInput,
  ReportMaterialUploadFailureResult,
  FinalizeMaterialUploadResult,
} from "@/lib/academic/materials/types";
import {
  createMaterialUploadController,
  type MaterialUploadFeedback,
} from "@/lib/academic/materials/upload-client";
import { createClient } from "@/lib/supabase/client";

import styles from "./material-upload-form.module.css";

type MaterialUploadFormProps = {
  subjectId: string;
  classes?: { id: string; title: string }[];
  prepareAction: (input: PrepareMaterialUploadInput) => Promise<PrepareMaterialUploadResult>;
  reportFailureAction: (input: ReportMaterialUploadFailureInput) => Promise<ReportMaterialUploadFailureResult>;
  finalizeAction: (materialId: string) => Promise<FinalizeMaterialUploadResult>;
};

export function MaterialUploadForm({
  subjectId,
  classes = [],
  prepareAction,
  reportFailureAction,
  finalizeAction,
}: MaterialUploadFormProps) {
  const router = useRouter();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [classSessionId, setClassSessionId] = useState("");
  const [feedback, setFeedback] = useState<MaterialUploadFeedback>({
    state: "idle", message: "Selecione um PDF de até 6 MiB.", blocked: false,
  });
  const [transitionPending, startTransition] = useTransition();
  const controller = useRef<ReturnType<typeof createMaterialUploadController> | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const busy = transitionPending || feedback.state === "preparing" || feedback.state === "uploading" || feedback.state === "validating";
  const disabled = busy || feedback.blocked;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // No native form submission; the File is used only by the browser Storage SDK.
    event.preventDefault();
    if (!file || feedback.blocked) return;
    if (!controller.current) {
      controller.current = createMaterialUploadController({
        prepare: prepareAction,
        reportFailure: reportFailureAction,
        finalize: finalizeAction,
        createClient,
        onFeedback: setFeedback,
      });
    }
    const flow = controller.current;
    startTransition(async () => {
      await flow.submit({ subjectId, classSessionId: classSessionId || null, title, file });
      router.refresh();
    });
  }

  return (
    <form aria-label="Enviar PDF da matéria" aria-busy={busy} className={styles.form} onSubmit={handleSubmit} ref={form}>
      <p className={styles.notice} id={`${id}-notice`}>
        Após o envio, o servidor confere o tamanho e a assinatura do PDF antes de liberar o material.
      </p>
      <fieldset className={styles.fields} disabled={disabled}>
        <legend className={styles.legend}>Dados do PDF</legend>
        <label className={styles.field} htmlFor={`${id}-file`}>
          Um PDF, até 6 MiB
          <input
            accept=".pdf,application/pdf"
            aria-describedby={`${id}-notice`}
            id={`${id}-file`}
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0] ?? null;
              setFile(selected);
              if (selected && !title.trim()) setTitle([...selected.name.replace(/\.pdf$/i, "")].slice(0, 200).join(""));
              setFeedback({ state: selected ? "selected" : "idle", message: selected ? "PDF selecionado. Clique em enviar para continuar." : "Selecione um PDF de até 6 MiB.", blocked: false });
            }}
            type="file"
          />
        </label>
        <label className={styles.field} htmlFor={`${id}-title`}>
          Título
          <input id={`${id}-title`} maxLength={400} onChange={(event) => setTitle(event.currentTarget.value)} required type="text" value={title} />
        </label>
        {classes.length > 0 ? (
          <label className={styles.field} htmlFor={`${id}-class`}>
            Aula (opcional)
            <select id={`${id}-class`} onChange={(event) => setClassSessionId(event.currentTarget.value)} value={classSessionId}>
              <option value="">Sem aula específica</option>
              {classes.map((classSession) => <option key={classSession.id} value={classSession.id}>{classSession.title}</option>)}
            </select>
          </label>
        ) : null}
        <button className={styles.button} disabled={!file || disabled} type="submit">
          {feedback.state === "preparing" ? "Preparando…" : feedback.state === "uploading" ? "Enviando…" : feedback.state === "validating" ? "Validando…" : "Enviar PDF"}
        </button>
      </fieldset>
      {!busy && (feedback.state === "ready" || feedback.state === "confirmed_failure") ? <button className={styles.button} onClick={() => {
        form.current?.reset(); controller.current = null; setFile(null); setTitle(""); setClassSessionId("");
        setFeedback({ state: "idle", message: "Selecione um novo PDF de até 6 MiB.", blocked: false });
      }} type="button">Enviar outro PDF</button> : null}
      <div aria-atomic="true" aria-live="polite" className={styles.feedback} data-state={feedback.state} role="status">
        <p>{feedback.message}</p>
        {feedback.state === "auth_required" ? <Link href="/login">Entrar novamente</Link> : null}
      </div>
    </form>
  );
}
