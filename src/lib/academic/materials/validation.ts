import { readId } from "../validation";

import type {
  MaterialUploadFailureCategory,
  PrepareMaterialUploadInput,
  ReportMaterialUploadFailureInput,
} from "./types";

export const MAX_MATERIAL_SIZE_BYTES = 6291456;
export const MATERIAL_MIME_TYPE = "application/pdf";

const INPUT_KEYS = new Set([
  "subjectId",
  "classSessionId",
  "title",
  "originalFilename",
  "mimeType",
  "sizeBytes",
]);
const INVALID_FILENAME_CHARACTERS = /[\p{Cc}/\\]/u;

function readText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  // PostgreSQL char_length counts Unicode code points, rather than UTF-16 units.
  if (!text || text.length > max * 2 || [...text].length > max) return null;
  return text;
}

export function validatePrepareMaterialUploadInput(
  value: unknown,
): PrepareMaterialUploadInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;

  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !INPUT_KEYS.has(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) return null;

  const input: Record<string, unknown> = Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]),
  );
  const subjectId = readId(input.subjectId)?.toLowerCase();
  const classSessionId = input.classSessionId == null
    ? null
    : readId(input.classSessionId)?.toLowerCase();
  const title = readText(input.title, 200);
  const originalFilename = readText(input.originalFilename, 255);

  if (
    !subjectId ||
    classSessionId === undefined ||
    !title ||
    !originalFilename ||
    typeof input.originalFilename !== "string" ||
    INVALID_FILENAME_CHARACTERS.test(input.originalFilename) ||
    !/\.pdf$/i.test(originalFilename) ||
    input.mimeType !== MATERIAL_MIME_TYPE ||
    typeof input.sizeBytes !== "number" ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > MAX_MATERIAL_SIZE_BYTES
  ) return null;

  return {
    subjectId,
    classSessionId,
    title,
    originalFilename,
    mimeType: MATERIAL_MIME_TYPE,
    sizeBytes: input.sizeBytes,
  };
}

const FAILURE_INPUT_KEYS = new Set(["materialId", "failureCategory"]);
const FAILURE_CATEGORIES = new Set<MaterialUploadFailureCategory>([
  "mime_rejected",
  "size_rejected",
  "access_denied",
  "validation_rejected",
]);

export function validateReportMaterialUploadFailureInput(
  value: unknown,
): ReportMaterialUploadFailureInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;

  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !FAILURE_INPUT_KEYS.has(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some((descriptor) => !("value" in descriptor))) return null;

  const materialId = readId(descriptors.materialId?.value)?.toLowerCase();
  const failureCategory = descriptors.failureCategory?.value;
  if (
    !materialId ||
    typeof failureCategory !== "string" ||
    !FAILURE_CATEGORIES.has(failureCategory as MaterialUploadFailureCategory)
  ) return null;

  return { materialId, failureCategory: failureCategory as MaterialUploadFailureCategory };
}
