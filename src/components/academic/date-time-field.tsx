"use client";

import { useEffect, useRef } from "react";

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function DateTimeField({
  id,
  initialIso = "",
  label,
  name,
}: {
  id: string;
  initialIso?: string;
  label: string;
  name: string;
}) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const isoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nextLocal = initialIso ? toLocalInputValue(initialIso) : "";
    if (localInputRef.current) localInputRef.current.value = nextLocal;
    if (isoInputRef.current) isoInputRef.current.value = nextLocal ? toIso(nextLocal) : "";
  }, [initialIso]);

  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        onInput={(event) => {
          if (isoInputRef.current) isoInputRef.current.value = toIso(event.currentTarget.value);
        }}
        ref={localInputRef}
        required
        type="datetime-local"
      />
      <input name={name} ref={isoInputRef} required type="hidden" />
    </label>
  );
}
