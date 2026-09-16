"use client";

import { useEffect, useRef } from "react";

export function LocalDateTime({ value }: { value: string }) {
  const timeRef = useRef<HTMLTimeElement>(null);

  useEffect(() => {
    if (timeRef.current) {
      timeRef.current.textContent = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    }
  }, [value]);

  return <time dateTime={value} ref={timeRef}>Carregando horário…</time>;
}
