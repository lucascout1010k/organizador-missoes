import type { MaterialUploadFailureCategory } from "./types";

export type MaterialUploadErrorClassification =
  | { kind: "confirmed"; category: MaterialUploadFailureCategory }
  | { kind: "uncertain" };

const CONFIRMED_FAILURES = new Map<string, {
  status: number;
  category: MaterialUploadFailureCategory;
}>([
  ["InvalidMimeType", { status: 400, category: "mime_rejected" }],
  ["EntityTooLarge", { status: 413, category: "size_rejected" }],
  ["AccessDenied", { status: 403, category: "access_denied" }],
  ["InvalidJWT", { status: 401, category: "access_denied" }],
  ["unauthorized", { status: 403, category: "access_denied" }],
  ["InvalidKey", { status: 400, category: "validation_rejected" }],
  ["InvalidBucketName", { status: 400, category: "validation_rejected" }],
]);

/** Only explicit, consistent Storage API rejection codes can mark an upload failed. */
export function classifyMaterialUploadError(error: unknown): MaterialUploadErrorClassification {
  try {
    if (typeof error !== "object" || error === null) return { kind: "uncertain" };
    const candidate = error as {
      name?: unknown;
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      error?: unknown;
    };
    if (candidate.name !== "StorageApiError") return { kind: "uncertain" };

    const status = candidate.status;
    const statusCode = candidate.statusCode;
    if (statusCode !== undefined && typeof statusCode !== "string") return { kind: "uncertain" };
    const legacyStatus = typeof statusCode === "string" && /^\d{3}$/.test(statusCode)
      ? Number(statusCode)
      : undefined;
    if (status !== undefined && (
      typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599
    )) return { kind: "uncertain" };

    const httpStatus = status ?? legacyStatus;
    if (typeof httpStatus !== "number") return { kind: "uncertain" };
    if (legacyStatus !== undefined && legacyStatus !== httpStatus) return { kind: "uncertain" };

    let explicitCode: string | undefined;
    for (const value of [candidate.code, candidate.error, legacyStatus === undefined ? statusCode : undefined]) {
      if (value === undefined) continue;
      if (
        typeof value !== "string" ||
        !CONFIRMED_FAILURES.has(value) ||
        (explicitCode !== undefined && explicitCode !== value)
      ) return { kind: "uncertain" };
      explicitCode = value;
    }

    const failure = explicitCode === undefined ? undefined : CONFIRMED_FAILURES.get(explicitCode);
    if (!failure || failure.status !== httpStatus) return { kind: "uncertain" };
    return { kind: "confirmed", category: failure.category };
  } catch {
    // Malformed errors and transport exceptions must never imply a confirmed rejection.
    return { kind: "uncertain" };
  }
}
