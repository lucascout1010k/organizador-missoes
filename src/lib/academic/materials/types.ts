export type PrepareMaterialUploadInput = {
  subjectId: string;
  classSessionId?: string | null;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type PrepareMaterialUploadErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "RESOURCE_UNAVAILABLE"
  | "PREPARE_FAILED";

export type PrepareMaterialUploadResult =
  | {
      ok: true;
      materialId: string;
      storagePath: string;
      fileStatus: "pending_upload";
    }
  | {
      ok: false;
      code: PrepareMaterialUploadErrorCode;
      message: string;
    };

export type MaterialUploadFailureCategory =
  | "mime_rejected"
  | "size_rejected"
  | "access_denied"
  | "validation_rejected";

export type ReportMaterialUploadFailureInput = {
  materialId: string;
  failureCategory: MaterialUploadFailureCategory;
};

export type ReportMaterialUploadFailureErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "RESOURCE_UNAVAILABLE"
  | "REPORT_FAILED";

export type ReportMaterialUploadFailureResult =
  | { ok: true; fileStatus: "upload_failed" }
  | {
      ok: false;
      code: ReportMaterialUploadFailureErrorCode;
      message: string;
    };

export type FinalizeMaterialUploadResult =
  | { ok: true; fileStatus: "ready"; message: string }
  | { ok: false; code: "INVALID_INPUT" | "AUTH_REQUIRED" | "RESOURCE_UNAVAILABLE" | "IN_PROGRESS" | "UNCERTAIN" | "INVALID_PDF" | "MISSING"; message: string };
