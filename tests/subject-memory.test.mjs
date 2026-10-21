import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root = process.cwd();
const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const subject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", differentSubject = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const uuid = n => `eeeeeeee-eeee-4eee-8eee-${String(n).padStart(12, "0")}`;
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative), mod = { exports: {} };
  const require = name => {
    if (name in overrides) return overrides[name];
    if (name === "server-only") return {};
    if (name === "zod") return { z };
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "next/navigation") return { notFound() { throw Error("NOT_FOUND"); }, redirect() { throw Error("AUTH_REQUIRED"); }, useRouter: () => ({ refresh() {} }) };
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/lib/supabase/server") return { createClient() { throw Error("Real client forbidden"); } };
    if (name.endsWith(".module.css")) return { default: {} };
    if (name.includes("/materiais/actions")) return {};
    const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
    const source = [base + ".ts", base + ".tsx"].find(existsSync);
    if (source) return load(source, overrides);
    throw Error("Unexpected dependency " + name);
  };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(require, mod, mod.exports);
  return mod.exports;
}
const { consolidateSubjectMemory: consolidate, uniqueAcademicTerms, getSubjectAcademicMemory } = load("src/lib/academic/subject-memory.ts");
const result = (title = "Algoritmos") => ({ summary: "Resumo acadêmico ".repeat(100), topics: [{ title, explanation: "Explicação", importance: "high" }], keywords: [" Entrada ", "SAÍDA"], exercises: [], suggestedMissions: [{ title: "Revisar", description: "Praticar", estimatedMinutes: 10, priority: "low" }], limitations: ["Sem OCR"] });
const material = (n = 1, extra = {}) => ({ id: uuid(n), user_id: owner, subject_id: subject, title: `PDF fictício ${n}`, file_status: "ready", original_filename: "fixture.pdf", size_bytes: 120, created_at: "2026-10-20T12:00:00Z", deleted_at: null, class_session_id: null, storage_path: "PRIVATE_PATH", ...extra });
const analysis = (n = 1, extra = {}) => ({ id: uuid(n + 100), user_id: owner, material_id: uuid(n), status: "completed", schema_version: 1, result: result(), completed_at: "2026-10-21T13:00:00Z", created_at: "2026-10-20T12:00:00Z", ...extra });
const mission = (n = 1, extra = {}) => ({ id: uuid(n + 200), user_id: owner, title: "Missão fictícia", status: "planned", priority: "high", due_at: null, origin_subject_id: subject, ...extra });
const combine = (materials = [], analyses = [], missions = [], links = [], classes = []) => consolidate(materials, analyses, missions, links, classes, subject);

test("memory: empty and no analyses remain honest", () => {
  const empty = combine(); assert.equal(empty.stats.materials, 0); assert.equal(empty.latestAnalyzedMaterial, null);
  const waiting = combine([material(), material(2)]); assert.equal(waiting.stats.awaitingAnalysis, 2); assert.deepEqual(waiting.studiedTopics, []);
});
test("memory: one persisted analysis, bounded overview, full result excluded", () => {
  const memory = combine([material()], [analysis()]);
  assert.equal(memory.stats.analyzed, 1); assert.equal(memory.stats.awaitingAnalysis, 0);
  assert.ok(memory.latestAnalyzedMaterial.summary.length <= 420);
  assert.deepEqual(memory.studiedTopics, ["Algoritmos"]); assert.deepEqual(memory.keywords, ["Entrada", "SAÍDA"]);
  assert.equal(memory.stats.suggestedMissions, 1); assert.deepEqual(memory.limitations, ["Sem OCR"]);
  for (const forbidden of ["PRIVATE_PATH", "exercises", "explanation", "user_id", '"result"']) assert.ok(!JSON.stringify(memory).includes(forbidden));
});
test("memory: accumulated topics, conservative dedup, completion time selects latest", () => {
  const memory = combine([material(), material(2)], [analysis(1, { completed_at: "2026-10-22T12:00:00Z" }), analysis(2, { created_at: "2026-10-21T10:00:00Z", result: result(" Condicionais ") })]);
  assert.deepEqual(memory.studiedTopics, ["Algoritmos", "Condicionais"]); assert.equal(memory.stats.analyzed, 2); assert.equal(memory.latestAnalyzedMaterial.id, uuid(1));
  assert.deepEqual(uniqueAcademicTerms([" Algoritmos ", "ALGORITMOS", "Algoritmo", "Estrutura  de decisão", "estrutura de decisão"]), ["Algoritmos", "Algoritmo", "Estrutura de decisão"]);
});
for (const status of ["processing", "failed"]) test(`memory: ${status} is neither studied nor awaiting initial analysis`, () => {
  const memory = combine([material()], [analysis(1, { status, result: null })]);
  assert.equal(memory.stats.analyzed, 0); assert.equal(memory.stats.awaitingAnalysis, 0); assert.equal(memory.materials[0].analysisStatus, status);
});
test("memory: deleted/non-ready/orphan analyses and malformed output excluded", () => {
  const memory = combine([material(1, { file_status: "deleted" }), material(2, { file_status: "deleting" }), material(3)], [analysis(), analysis(2), analysis(3, { result: { summary: "bad" } }), analysis(4)]);
  assert.equal(memory.stats.materials, 2); assert.equal(memory.stats.analyzed, 0); assert.equal(memory.invalidAnalyses, 1); assert.equal(memory.materials[1].analysisStatus, "failed");
});
test("memory: real mission provenance, completed and pending; unrelated/tombstone ignored", () => {
  const linked = mission(2, { origin_subject_id: null });
  const links = [{ analysis_id: uuid(101), material_id: uuid(1), mission_id: linked.id }, { analysis_id: uuid(101), material_id: uuid(1), mission_id: null }];
  const memory = combine([material()], [analysis()], [mission(), linked, mission(3, { status: "completed" }), mission(4, { origin_subject_id: differentSubject })], links);
  assert.equal(memory.stats.pendingMissions, 2); assert.equal(memory.stats.completedMissions, 1); assert.equal(memory.stats.createdMissions, 3);
});
test("memory: optional compatible class, absent/mismatched class remains unlinked", () => {
  const classes = [{ id: uuid(500), title: "Aula cadastrada" }];
  const memory = combine([material(1, { class_session_id: uuid(500) }), material(2), material(3, { class_session_id: uuid(501) })], [], [], [], classes);
  assert.equal(memory.materials[0].classTitle, "Aula cadastrada"); assert.equal(memory.materials[1].classSessionId, null); assert.equal(memory.materials[2].classSessionId, null);
});
test("memory: class/exam origins are related by foreign keys, never titles", () => {
  const missions = [mission(1, { origin_subject_id: null, origin_class_session_id: uuid(500) }), mission(2, { origin_subject_id: null, origin_exam_id: uuid(600) }), mission(3, { origin_subject_id: null, title: "Disciplina fictícia" })];
  const memory = consolidate([], [], missions, [], [{ id: uuid(500) }], subject, [{ id: uuid(600) }]);
  assert.equal(memory.stats.pendingMissions, 2);
});
test("memory: repeated completed material counted once, invalid link pair rejected", () => {
  const missions = [mission(1, { origin_subject_id: null })];
  const memory = combine([material(), material(2)], [analysis(), analysis(1, { id: uuid(102) })], missions, [{ analysis_id: uuid(101), material_id: uuid(2), mission_id: missions[0].id }]);
  assert.equal(memory.stats.analyzed, 1); assert.equal(memory.stats.pendingMissions, 0);
});

function harness({ user = owner, errorTable, rows = {} } = {}) {
  const calls = [];
  const tables = {
    subjects: [{ id: subject, user_id: owner, period_id: uuid(900), name: "Disciplina fictícia", code: null, status: "active", created_at: "2026-10-20", updated_at: "2026-10-20", academic_periods: null }],
    class_sessions: [], exams: [], academic_materials: [material(), material(2), material(3, { deleted_at: "2026-10-21" })],
    academic_material_analyses: [analysis()], academic_analysis_mission_links: [], missions: [mission(), mission(2, { user_id: other })], ...rows,
  };
  const supabase = { from(table) {
    const filters = [], orders = []; let selection = "";
    const execute = single => {
      calls.push({ table, filters, orders, selection });
      const data = (tables[table] ?? []).filter(row => filters.every(([op, key, value]) => op === "eq" || op === "is" ? row[key] === value : op === "neq" ? row[key] !== value : op === "in" ? value.includes(row[key]) : true));
      return { data: single ? data[0] ?? null : data, error: table === errorTable ? { message: "PRIVATE_ERROR" } : null };
    };
    const query = {
      select(value) { selection = value; return query; },
      eq(key,value) { filters.push(["eq",key,value]); return query; }, is(key,value) { filters.push(["is",key,value]); return query; },
      neq(key,value) { filters.push(["neq",key,value]); return query; }, in(key,value) { filters.push(["in",key,value]); return query; },
      or(value) { filters.push(["or",value]); return query; }, order(...value) { orders.push(value); return query; },
      maybeSingle: async () => execute(true), then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
    }; return query;
  } };
  return { calls, authenticate: async () => ({ supabase, userId: user }) };
}
test("service: explicit scope for every query, hidden deleted, constant query count, safe DTO", async () => {
  const h = harness(); const memory = await getSubjectAcademicMemory(subject, h.authenticate);
  assert.equal(memory.stats.materials, 2); assert.equal(memory.stats.analyzed, 1); assert.equal(memory.pendingMissions.length, 1); assert.equal(memory.nextClass, null);
  assert.equal(h.calls.length, 7);
  for (const call of h.calls) { assert.ok(call.filters.some(([op,key,value]) => op === "eq" && key === "user_id" && value === owner)); assert.ok(!call.selection.includes("storage_path")); }
  assert.ok(!JSON.stringify(memory).includes("PRIVATE_PATH")); assert.ok(!JSON.stringify(memory).includes("academic_periods"));
});
for (const input of [null, {}, "bad", subject + ",id.eq.any"]) test("service: invalid manipulated input " + JSON.stringify(input), async () => {
  let authenticated = false; await assert.rejects(getSubjectAcademicMemory(input, async () => { authenticated = true; }), /NOT_FOUND/); assert.equal(authenticated, false);
});
test("service: other owner cannot read subject memory", async () => { const h = harness({ user: other }); await assert.rejects(getSubjectAcademicMemory(subject, h.authenticate), /NOT_FOUND/); assert.ok(!h.calls.some(call => call.table === "academic_materials")); });
test("service: no session denies before queries", async () => { await assert.rejects(getSubjectAcademicMemory(subject, async () => { throw Error("AUTH_REQUIRED"); }), /AUTH_REQUIRED/); });
for (const errorTable of ["subjects", "academic_materials", "academic_material_analyses", "academic_analysis_mission_links", "missions"]) test("service: fail closed on " + errorTable, async () => {
  const h = harness({ errorTable }); await assert.rejects(getSubjectAcademicMemory(subject, h.authenticate), error => !error.message.includes("PRIVATE_ERROR"));
});
test("service: real planned future classes only, no filename inference", async () => {
  const future = { id: uuid(500), user_id: owner, subject_id: subject, title: "Aula futura", class_date: "2099-10-21T13:00:00Z", status: "planned" };
  const h = harness({ rows: { class_sessions: [future] } }); const memory = await getSubjectAcademicMemory(subject, h.authenticate); assert.equal(memory.nextClass.id, future.id);
});
test("service: 30 materials keep query count constant", async () => {
  const h = harness({ rows: { academic_materials: Array.from({ length: 30 }, (_, i) => material(i + 1)) } }); const memory = await getSubjectAcademicMemory(subject, h.authenticate); assert.equal(memory.materials.length, 30); assert.equal(h.calls.length, 7);
});
test("UI: compact 18-material list never renders full analysis; overview limits badges", () => {
  const { MaterialList } = load("src/components/academic/material-list.tsx");
  const memory = combine(Array.from({ length: 18 }, (_, i) => material(i + 1)), [analysis()]);
  const markup = renderToStaticMarkup(React.createElement(MaterialList, { items: memory.materials, subjectId: subject, unavailable: false }));
  assert.equal((markup.match(/<li\b/g) ?? []).length, 18); assert.ok(markup.includes("Ver análise")); assert.ok(markup.includes("Não analisado")); assert.ok(!markup.includes("Resumo acadêmico"));
  const { SubjectMemory } = load("src/components/faculty/subject-memory.tsx");
  const overview = renderToStaticMarkup(React.createElement(SubjectMemory, { memory: { ...memory, subject: { id: subject }, keywords: Array.from({ length: 30 }, (_, i) => "Keyword" + i) } }));
  assert.ok(overview.includes("Keyword15")); assert.ok(!overview.includes("Keyword16")); assert.ok(!overview.includes("exercício")); assert.ok(!overview.includes("17%"));
});

const { getAcademicMaterialDetail } = load("src/lib/academic/material-detail.ts", { "./materials/analysis": { listAcademicAnalysisViews: async () => ({ [uuid(1)]: { id: uuid(101), status: "completed", result: result(), suggestionLinks: [] } }) } });
test("detail: owned subject+material, minimal metadata and persisted full analysis", async () => {
  const h = harness(); const detail = await getAcademicMaterialDetail(subject, uuid(1), h.authenticate);
  assert.equal(detail.material.id, uuid(1)); assert.ok(detail.analyses[uuid(1)].result.summary.length > 420);
  assert.ok(!JSON.stringify(detail).includes("PRIVATE_PATH"));
  assert.ok(h.calls.find(call => call.table === "academic_materials").filters.some(([op,key,value]) => op === "eq" && key === "subject_id" && value === subject));
});
for (const [label, s, m, options] of [
  ["invalid subject", "bad", uuid(1), {}], ["invalid material", subject, "bad", {}],
  ["mismatched subject", differentSubject, uuid(1), {}], ["other owner", subject, uuid(1), { user: other }],
  ["deleted", subject, uuid(3), {}],
]) test("detail: rejects " + label, async () => {
  const h = harness(options); await assert.rejects(getAcademicMaterialDetail(s,m,h.authenticate), /NOT_FOUND/);
});
test("detail: anon and database failure denied", async () => {
  await assert.rejects(getAcademicMaterialDetail(subject,uuid(1),async () => { throw Error("AUTH_REQUIRED"); }), /AUTH_REQUIRED/);
  const h = harness({ errorTable: "academic_materials" }); await assert.rejects(getAcademicMaterialDetail(subject,uuid(1),h.authenticate), error => !error.message.includes("PRIVATE_ERROR"));
});
