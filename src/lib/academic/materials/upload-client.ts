import type {
  PrepareMaterialUploadInput,
  PrepareMaterialUploadResult,
  ReportMaterialUploadFailureInput,
  ReportMaterialUploadFailureResult,
} from "./types";
import { classifyMaterialUploadError } from "./upload-errors";
import {
  MATERIAL_MIME_TYPE,
  MAX_MATERIAL_SIZE_BYTES,
  validatePrepareMaterialUploadInput,
} from "./validation";

export type MaterialUploadUiState =
  | "idle"
  | "selected"
  | "preparing"
  | "uploading"
  | "uploaded_pending_validation"
  | "confirmed_failure"
  | "uncertain_result"
  | "auth_required";

export type MaterialUploadFeedback = {
  state: MaterialUploadUiState;
  message: string;
  blocked: boolean;
};

type UploadSelection = {
  subjectId: string;
  classSessionId: string | null;
  title: string;
  file: File | null;
};

type UploadDependencies = {
  prepare: (input: PrepareMaterialUploadInput) => Promise<PrepareMaterialUploadResult>;
  reportFailure: (input: ReportMaterialUploadFailureInput) => Promise<ReportMaterialUploadFailureResult>;
  createClient: () => {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          file: File,
          options: { upsert: false; contentType: "application/pdf" },
        ) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  onFeedback: (feedback: MaterialUploadFeedback) => void;
};

// These checks improve UX only. They cannot establish server-side validity.
export async function validateClientMaterialPdf(file: File): Promise<string | null> {
  if (!/\.pdf$/i.test(file.name)) return "Selecione um arquivo com extensão .pdf.";
  if (file.type !== MATERIAL_MIME_TYPE) return "O tipo do arquivo deve ser application/pdf.";
  if (file.size < 1 || file.size > MAX_MATERIAL_SIZE_BYTES) {
    return "O PDF deve ter entre 1 byte e 6 MiB (6291456 bytes).";
  }

  try {
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
    if (!signature.every((byte, index) => bytes[index] === byte)) {
      return "O arquivo não apresenta a assinatura inicial %PDF-.";
    }
  } catch {
    return "Não foi possível ler o PDF no navegador. Selecione o arquivo novamente.";
  }
  return null;
}

// Kept separate from React so the actual upload flow and synchronous lock can
// be exercised locally without cookies, credentials, an SDK client or network.
export function createMaterialUploadController(dependencies: UploadDependencies) {
  let active = false;
  let blocked = false;

  function feedback(state: MaterialUploadUiState, message: string) {
    dependencies.onFeedback({ state, message, blocked });
  }

  function uncertain(message: string) {
    blocked = true;
    feedback("uncertain_result", message);
  }

  return {
    async submit(selection: UploadSelection): Promise<void> {
      // Synchronous, before the first await: state updates alone do not stop double clicks.
      if (active || blocked) return;
      active = true;

      try {
        if (!selection.file) {
          feedback("idle", "Selecione um PDF antes de enviar.");
          return;
        }
        const file = selection.file;
        feedback("preparing", "Verificando o arquivo e preparando o envio…");
        const fileError = await validateClientMaterialPdf(file);
        if (fileError) {
          feedback("selected", fileError);
          return;
        }

        // Reconstruct ONLY small metadata. File/Blob/bytes never enter an action.
        const metadata = validatePrepareMaterialUploadInput({
          subjectId: selection.subjectId,
          classSessionId: selection.classSessionId,
          title: selection.title,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!metadata) {
          feedback("selected", "Revise o título, o nome do PDF e a aula selecionada.");
          return;
        }

        const prepared = await dependencies.prepare(metadata);
        if (!prepared.ok) {
          if (prepared.code === "PREPARE_FAILED") {
            // The INSERT may have committed even if its response was lost.
            uncertain(prepared.message);
          } else {
            feedback(prepared.code === "AUTH_REQUIRED" ? "auth_required" : "selected", prepared.message);
          }
          return;
        }

        // Once prepared, this controller never creates another material or retries.
        blocked = true;
        feedback("uploading", "Enviando diretamente para o Storage…");
        const supabase = dependencies.createClient();
        const { data, error } = await supabase.storage
          .from("academic-materials")
          .upload(prepared.storagePath, file, { upsert: false, contentType: "application/pdf" });

        if (error == null && data != null) {
          feedback("uploaded_pending_validation", "Arquivo enviado. Validação pendente.");
          return;
        }

        if (data != null) {
          // Contradictory success data plus an error is not proof of rejection.
          uncertain("Não foi possível confirmar o resultado do envio. Não reenvie este material: é necessária reconciliação futura.");
          return;
        }

        const failure = classifyMaterialUploadError(error);
        if (failure.kind === "uncertain") {
          uncertain("Não foi possível confirmar o resultado do envio. Não reenvie este material: é necessária reconciliação futura.");
          return;
        }

        const reported = await dependencies.reportFailure({
          materialId: prepared.materialId,
          failureCategory: failure.category,
        });
        if (reported.ok) {
          feedback("confirmed_failure", "O Storage recusou o arquivo. Falha de envio registrada.");
        } else if (reported.code === "AUTH_REQUIRED") {
          feedback("auth_required", "O Storage recusou o arquivo, mas a falha na metadata não foi confirmada. Entre novamente. Não reenvie este material.");
        } else {
          uncertain("O Storage recusou o arquivo, mas não foi possível confirmar o registro da falha. Não reenvie este material: é necessária reconciliação futura.");
        }
      } catch {
        // Thrown transport/SDK/action errors never prove that an object was not created.
        uncertain("Não foi possível confirmar o resultado do envio ou registrar a falha. Não reenvie este material: é necessária reconciliação futura.");
      } finally {
        active = false;
      }
    },
  };
}
