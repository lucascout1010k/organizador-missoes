"use server";

import { randomUUID } from "node:crypto";
import { finalizeOwnedMaterial } from "@/lib/academic/materials/finalize";
import { downloadPrivatePdf } from "@/lib/academic/materials/pdf-object";
import { transitionMaterial } from "@/lib/academic/materials/validator";

import {
  findOwnedMaterialClassSession,
  findOwnedMaterialSubject,
  getAuthenticatedMaterialsClient,
  markOwnedPendingMaterialUploadFailed,
} from "@/lib/academic/materials/data";
import type {
  PrepareMaterialUploadErrorCode,
  PrepareMaterialUploadInput,
  PrepareMaterialUploadResult,
  ReportMaterialUploadFailureErrorCode,
  ReportMaterialUploadFailureInput,
  ReportMaterialUploadFailureResult,
} from "@/lib/academic/materials/types";
import {
  validatePrepareMaterialUploadInput,
  validateReportMaterialUploadFailureInput,
} from "@/lib/academic/materials/validation";

const PUBLIC_MESSAGES: Record<PrepareMaterialUploadErrorCode, string> = {
  INVALID_INPUT: "Revise os dados do PDF e tente novamente.",
  AUTH_REQUIRED: "Sua sessão não está disponível. Entre novamente.",
  RESOURCE_UNAVAILABLE: "Matéria ou aula não encontrada ou sem acesso.",
  PREPARE_FAILED: "Não foi possível confirmar a preparação do material. Não repita automaticamente.",
};

function fail(code: PrepareMaterialUploadErrorCode): PrepareMaterialUploadResult {
  return { ok: false, code, message: PUBLIC_MESSAGES[code] };
}

export async function prepareMaterialUpload(
  input: PrepareMaterialUploadInput,
): Promise<PrepareMaterialUploadResult> {
  try {
    const metadata = validatePrepareMaterialUploadInput(input);
    if (!metadata) return fail("INVALID_INPUT");

    const context = await getAuthenticatedMaterialsClient();
    if (!context.ok) {
      return fail(context.reason === "auth_required" ? "AUTH_REQUIRED" : "PREPARE_FAILED");
    }
    const { supabase, userId } = context;

    const subject = await findOwnedMaterialSubject(supabase, userId, metadata.subjectId);
    if (subject.error) return fail("PREPARE_FAILED");
    if (!subject.data) return fail("RESOURCE_UNAVAILABLE");

    if (metadata.classSessionId) {
      const classSession = await findOwnedMaterialClassSession(
        supabase,
        userId,
        metadata.subjectId,
        metadata.classSessionId,
      );
      if (classSession.error) return fail("PREPARE_FAILED");
      if (!classSession.data) return fail("RESOURCE_UNAVAILABLE");
    }

    const materialId = randomUUID();
    const storagePath = `${userId}/${metadata.subjectId}/${materialId}/source.pdf`;
    const { error } = await supabase.from("academic_materials").insert({
      id: materialId,
      subject_id: metadata.subjectId,
      class_session_id: metadata.classSessionId ?? null,
      title: metadata.title,
      original_filename: metadata.originalFilename,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: metadata.sizeBytes,
    });

    if (error) return fail("PREPARE_FAILED");
    return { ok: true, materialId, storagePath, fileStatus: "pending_upload" };
  } catch {
    // Never expose transport, database, session or personal metadata details.
    return fail("PREPARE_FAILED");
  }
}

const REPORT_PUBLIC_MESSAGES: Record<ReportMaterialUploadFailureErrorCode, string> = {
  INVALID_INPUT: "Não foi possível confirmar os dados da falha de envio.",
  AUTH_REQUIRED: "Sua sessão não está disponível. Entre novamente. A falha de envio não foi confirmada.",
  RESOURCE_UNAVAILABLE: "Material indisponível para registrar a falha de envio.",
  REPORT_FAILED: "Não foi possível confirmar o registro da falha de envio. Não repita automaticamente.",
};

function reportFail(code: ReportMaterialUploadFailureErrorCode): ReportMaterialUploadFailureResult {
  return { ok: false, code, message: REPORT_PUBLIC_MESSAGES[code] };
}

export async function finalizeMaterialUpload(materialId: string) {
  return finalizeOwnedMaterial(materialId, {
    authenticate: getAuthenticatedMaterialsClient,
    transition: transitionMaterial,
    download: downloadPrivatePdf,
  });
}

export async function reportMaterialUploadFailure(
  input: ReportMaterialUploadFailureInput,
): Promise<ReportMaterialUploadFailureResult> {
  try {
    const report = validateReportMaterialUploadFailureInput(input);
    if (!report) return reportFail("INVALID_INPUT");

    const context = await getAuthenticatedMaterialsClient();
    if (!context.ok) {
      return reportFail(context.reason === "auth_required" ? "AUTH_REQUIRED" : "REPORT_FAILED");
    }

    // The allowlisted browser category is a notification, not authoritative
    // proof of object absence. Never persist it or any raw Storage error.
    const { data, error } = await markOwnedPendingMaterialUploadFailed(
      context.supabase,
      report.materialId,
    );
    if (error) return reportFail("REPORT_FAILED");
    if (!data) return reportFail("RESOURCE_UNAVAILABLE");
    return { ok: true, fileStatus: "upload_failed" };
  } catch {
    return reportFail("REPORT_FAILED");
  }
}
