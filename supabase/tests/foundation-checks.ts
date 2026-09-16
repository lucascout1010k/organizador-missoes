import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Check = { test: string; passed: boolean; code?: string };
type Fixture = { table: string; id: string; payload: Record<string, unknown> };

/** Explicitly invoked integration test. Never use an administrative client. */
export async function verifyFoundation(client: SupabaseClient, anonymous: SupabaseClient) {
  const checks: Check[] = [];
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { passed: false, checks: [{ test: "authenticated", passed: false }] };
  const owner = auth.user.id;
  const otherOwner = randomUUID();
  const fixtures: Fixture[] = [];
  function fixture(table: string, payload: Record<string, unknown>) {
    const row = { table, id: randomUUID(), payload };
    fixtures.push(row);
    return row;
  }
  function check(test: string, passed: boolean, code?: string) {
    checks.push({ test, passed, ...(code && /^[A-Z0-9_]+$/.test(code) ? { code } : {}) });
    if (!passed) throw new Error("Verification stopped");
  }
  const course = fixture("academic_courses", { name: "Curso Teste" });
  const period = fixture("academic_periods", { name: "Periodo Teste", course_id: course.id, period_number: 1 });
  const subject = fixture("subjects", { name: "Materia Teste", period_id: period.id });
  const lesson = fixture("class_sessions", { title: "Aula Teste", subject_id: subject.id, class_date: "2030-01-10T12:00:00Z" });
  const exam = fixture("exams", { title: "Prova Teste", subject_id: subject.id, exam_date: "2030-01-20T12:00:00Z", topics: ["Topico ficticio"] });
  const mission = fixture("missions", { title: "Missao Teste", category: "academic", origin_type: "exam", origin_id: exam.id, estimated_minutes: 30 });
  const primary = [...fixtures];
  try {
    for (const row of primary) {
      const { data, error } = await client.from(row.table).insert({ ...row.payload, id: row.id }).select("id,user_id,created_at,updated_at").single();
      check(row.table + ": insert/default owner", !error && data?.id === row.id && data?.user_id === owner, error?.code);
      if (!data) throw new Error("Missing inserted fixture");
      const read = await client.from(row.table).select("id").eq("id", row.id).eq("user_id", owner).single();
      check(row.table + ": select own", !read.error && read.data?.id === row.id, read.error?.code);
      const update = await client.from(row.table).update({ status: "completed", ...(row.table === "missions" ? { completed_at: new Date().toISOString() } : {}), created_at: "2000-01-01T00:00:00Z", updated_at: "2000-01-01T00:00:00Z" }).eq("id", row.id).eq("user_id", owner).select("id,status,created_at,updated_at").single();
      check(row.table + ": update/trigger", !update.error && update.data?.status === "completed" && update.data?.created_at === data.created_at && Date.parse(update.data.updated_at) >= Date.parse(data.updated_at) && Date.parse(update.data.updated_at) > Date.parse("2000-01-01"), update.error?.code);
      const forbiddenInsert = fixture(row.table, { ...row.payload, user_id: otherOwner });
      const wrongInsert = await client.from(row.table).insert({ ...forbiddenInsert.payload, id: forbiddenInsert.id });
      check(row.table + ": RLS rejects foreign owner INSERT", wrongInsert.error?.code === "42501", wrongInsert.error?.code);
      const wrongUpdate = await client.from(row.table).update({ user_id: otherOwner }).eq("id", row.id);
      check(row.table + ": RLS rejects owner UPDATE", wrongUpdate.error?.code === "42501", wrongUpdate.error?.code);
      const anonRead = await anonymous.from(row.table).select("id").eq("id", row.id);
      check(row.table + ": anonymous SELECT denied", anonRead.error?.code === "42501", anonRead.error?.code);
      const anonRow = fixture(row.table, { ...row.payload, user_id: owner });
      const anonInsert = await anonymous.from(row.table).insert({ ...anonRow.payload, id: anonRow.id });
      check(row.table + ": anonymous INSERT denied", anonInsert.error?.code === "42501", anonInsert.error?.code);
      const anonUpdate = await anonymous.from(row.table).update({ updated_at: "2000-01-01T00:00:00Z" }).eq("id", row.id);
      check(row.table + ": anonymous UPDATE denied", anonUpdate.error?.code === "42501", anonUpdate.error?.code);
      const anonDelete = await anonymous.from(row.table).delete().eq("id", row.id);
      check(row.table + ": anonymous DELETE denied", anonDelete.error?.code === "42501", anonDelete.error?.code);
    }
    for (const parent of [course, period, subject, exam]) {
      const result = await client.from(parent.table).delete().eq("id", parent.id).eq("user_id", owner);
      check(parent.table + ": referenced parent delete blocked", result.error?.code === "23503", result.error?.code);
    }
    for (const [type, source, column] of [["subject", subject, "origin_subject_id"], ["class_session", lesson, "origin_class_session_id"], ["exam", exam, "origin_exam_id"]] as const) {
      const origin = await client.from("missions").update({ origin_type: type, origin_id: source.id }).eq("id", mission.id).eq("user_id", owner).select("origin_exam_id,origin_subject_id,origin_class_session_id").single();
      check("missions: generated " + type + " origin FK", !origin.error && origin.data?.[column] === source.id && Object.entries(origin.data).every(([key, value]) => key === column || value === null), origin.error?.code);
    }
    for (const [label, payload, code] of [
      ["invalid estimate", { estimated_minutes: 0 }, "23514"],
      ["invalid completion", { status: "completed", completed_at: null }, "23514"],
      ["unknown origin", { origin_type: "exam", origin_id: randomUUID() }, "23503"],
      ["reserved origin ID", { origin_type: "pdf", origin_id: randomUUID() }, "23514"],
      ["empty title", { title: " " }, "23514"],
    ] as const) {
      const row = fixture("missions", { title: "Missao Teste Negativo", category: "academic", ...payload });
      const result = await client.from(row.table).insert({ ...row.payload, id: row.id });
      check("missions: " + label, result.error?.code === code, result.error?.code);
    }
    const invalidPeriod = fixture("academic_periods", { name: "Periodo Teste Negativo", course_id: course.id, start_date: "2030-02-01", end_date: "2030-01-01" });
    const dateResult = await client.from(invalidPeriod.table).insert({ ...invalidPeriod.payload, id: invalidPeriod.id });
    check("academic_periods: invalid dates", dateResult.error?.code === "23514", dateResult.error?.code);
    for (const row of [period, subject]) {
      const archived = await client.from(row.table).update({ status: "archived" }).eq("id", row.id).eq("user_id", owner).select("status").single();
      check(row.table + ": archived history remains readable", !archived.error && archived.data?.status === "archived", archived.error?.code);
    }
  } catch {
    if (checks.every(item => item.passed)) checks.push({ test: "transport/runtime", passed: false });
  } finally {
    // Exact UUIDs generated by this invocation only; children before parents.
    const order = ["missions", "exams", "class_sessions", "subjects", "academic_periods", "academic_courses"];
    for (const table of order) {
      const ids = fixtures.filter(row => row.table === table).map(row => row.id);
      try {
        const removed = await client.from(table).delete().in("id", ids).eq("user_id", owner).select("id");
        const expected = primary.find(row => row.table === table)?.id;
        checks.push({ test: table + ": DELETE own", passed: !removed.error && !!removed.data?.some(row => row.id === expected), ...(removed.error ? { code: removed.error.code } : {}) });
        const remaining = await client.from(table).select("id").in("id", ids).eq("user_id", owner);
        checks.push({ test: table + ": cleanup verified", passed: !remaining.error && remaining.data?.length === 0 });
      } catch {
        checks.push({ test: table + ": cleanup transport failure", passed: false });
      }
    }
  }
  return { passed: checks.every(item => item.passed), checks };
}
