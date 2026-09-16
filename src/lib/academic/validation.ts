import type {
  CourseStatus,
  EventStatus,
  PeriodStatus,
  SubjectStatus,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function readId(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export function readRequiredText(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

export function readOptionalText(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length === 0 ? undefined : text.length <= max ? text : null;
}

export function readOptionalInteger(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

export function readOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value === "") return undefined;
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export function readIsoDateTime(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function readEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

export const courseStatuses = ["active", "completed", "archived"] as const satisfies readonly CourseStatus[];
export const periodStatuses = ["planned", "active", "completed", "archived"] as const satisfies readonly PeriodStatus[];
export const subjectStatuses = ["active", "completed", "archived"] as const satisfies readonly SubjectStatus[];
export const eventStatuses = ["planned", "completed", "cancelled"] as const satisfies readonly EventStatus[];

export function readTopics(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 25000) return null;
  const topics = value
    .split(/\r?\n/)
    .map((topic) => topic.trim())
    .filter(Boolean);

  if (topics.length > 100 || topics.join("").length > 20000) return null;
  return topics;
}
