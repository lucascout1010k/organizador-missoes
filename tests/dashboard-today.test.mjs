import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const owner = "11111111-1111-4111-8111-111111111111", id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date("2026-10-20T18:00:00Z");
function load(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} }; cache.set(filename, mod);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const req = name => {
    if (name in overrides) return overrides[name];
    if (name === "server-only") return {};
    if (name === "zod") return zod;
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
    if (name.includes("mission-actions")) return {};
    if (name === "@/lib/supabase/server") return { createClient() { throw Error("Real client forbidden"); } };
    if (name.endsWith(".module.css")) return { default: {} };
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name + ".ts"), overrides, cache);
    throw Error("Unexpected import " + name);
  };
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(req, mod, mod.exports);
  return mod.exports;
}
const domain = load("src/lib/missions/today.ts"), service = load("src/lib/missions/service.ts");
const row = (fields = {}) => ({ id, title: "Missão fictícia", description: "Descrição", category: "academic", status: "planned", priority: "medium", scheduled_for: "2026-10-20T15:00:00Z", due_at: null, estimated_minutes: 25, origin_type: "ai", completed_at: null, created_at: "2026-10-01T10:00:00Z", ...fields });
const build = rows => domain.buildTodayDashboard(rows, now);

test("today: Sao Paulo midnight differs from UTC, exclusive end and year rollover", () => {
  assert.deepEqual(domain.todayRange(new Date("2026-10-21T02:59:59Z")), { start: "2026-10-20T03:00:00.000Z", end: "2026-10-21T03:00:00.000Z" });
  assert.equal(domain.todayRange(new Date("2027-01-01T01:00:00Z")).start, "2026-12-31T03:00:00.000Z");
});
for (const [date, group] of [["2026-10-20T02:59:59Z", "overdue"], ["2026-10-20T03:00:00Z", "today"], ["2026-10-21T02:59:59Z", "today"], ["2026-10-21T03:00:00Z", null]]) {
  test("today: schedule boundary " + date, () => assert.equal(build([row({ scheduled_for: date })]).missions[0]?.group ?? null, group));
  test("today: deadline boundary " + date, () => assert.equal(build([row({ scheduled_for: null, due_at: date })]).missions[0]?.group ?? null, group));
}
test("today: overdue deadline wins over future schedule", () => assert.equal(build([row({ scheduled_for: "2026-11-01T10:00:00Z", due_at: "2026-10-19T10:00:00Z" })]).overdue, 1));
test("today: dates identify schedule and deadline independently", () => {
  const mission = build([row({ due_at: "2026-10-19T10:00:00Z" })]).missions[0];
  assert.match(mission.dateLabel, /Agendada 20\/10/); assert.match(mission.dateLabel, /Prazo 19\/10/);
});
test("today: backlog, future and missed excluded", () => assert.equal(build([row({ scheduled_for: null }), row({ scheduled_for: "2026-11-01T10:00:00Z" }), row({ status: "missed" })]).total, 0));
test("today: completed today included regardless of original date; old completions excluded", () => {
  assert.equal(build([row({ status: "completed", scheduled_for: null, completed_at: now.toISOString() }), row({ status: "completed", completed_at: "2026-10-19T10:00:00Z" })]).completed, 1);
});
test("today: complete an overdue keeps denominator and advances progress", () => {
  const rows = [row({ scheduled_for: "2026-10-19T10:00:00Z" }), row({ id: owner })];
  assert.equal(build(rows).percent, 0);
  rows[0].status = "completed"; rows[0].completed_at = now.toISOString();
  assert.equal(build(rows).total, 2); assert.equal(build(rows).percent, 50);
});
test("today: ordering group, priority, time, created_at, ID", () => {
  const rows = [row({ id: "z", priority: "low" }), row({ id: "b", priority: "high" }), row({ id: "a", priority: "high" }), row({ id: "old", priority: "high", created_at: "2026-09-01T00:00:00Z" }), row({ id: "early", priority: "high", scheduled_for: "2026-10-20T10:00:00Z" }), row({ id: "overdue", scheduled_for: "2026-10-19T10:00:00Z", priority: "low" }), row({ id: "done", status: "completed", completed_at: now.toISOString() })];
  assert.deepEqual(build(rows).missions.map(m => m.id), ["overdue", "early", "old", "a", "b", "z", "done"]);
});
test("today: DTO only exposes display fields, truncates description and maps origin/category", () => {
  const dto = build([row({ user_id: owner, origin_id: id, description: "x".repeat(20000) })]).missions[0];
  assert.equal(dto.description.length, 240); assert.equal(dto.origin, "IA"); assert.equal(dto.category, "Faculdade");
  for (const field of ["user_id", "origin_id", "created_at", "analysis_id", "suggestionIndex"]) assert.ok(!(field in dto));
});

function harness(options = {}) {
  const calls = [], stored = new Map([[id, row({ user_id: owner, ...options.row })]]);
  let writes = 0;
  const supabase = { from(table) {
    assert.equal(table, "missions"); const filters = []; let payload;
    const query = { select(value) { calls.push(["select", value]); return query; }, eq(k, v) { filters.push([k, v]); return query; }, is(k, v) { filters.push([k, v]); return query; },
      update(value) { payload = value; calls.push(["update", value]); return query; },
      or(value) { calls.push(["or", value]); return query; }, order(value) { calls.push(["order", value]); return query; },
      async range(start, end) { calls.push(["range", start, end, filters]); if (options.queryError) return { error: {} }; return { data: options.pages?.[start / 500] ?? [] }; },
      async maybeSingle() {
        calls.push([payload ? "write" : "read", [...filters]]);
        if (options.throw) throw Error("PRIVATE_DB");
        if (options.error) return { error: { message: "PRIVATE_DB" } };
        const value = stored.get(id);
        if (!value || options.missing || !filters.every(([key, val]) => value[key] === val)) return { data: null };
        if (!payload) return { data: { ...value } };
        if (options.competingState) { value.status = options.competingState; return { data: null }; }
        writes++; Object.assign(value, payload); return { data: { id } };
      } };
    return query;
  } };
  return { calls, stored, get writes() { return writes; }, auth: async () => options.anon ? null : { supabase, userId: owner }, run: (input = { missionId: id }) => service.completeOwnedMission(input, async () => options.anon ? null : { supabase, userId: owner }) };
}
test("query: owner filter, date/status predicate, stable pagination; all counters share collection", async () => {
  const h = harness({ pages: [Array.from({ length: 500 }, (_, i) => row({ id: String(i) })), [row({ id: "last" })]] });
  const r = await service.readTodayMissions(h.auth, now);
  assert.equal(r.dashboard.total, 501);
  const pages = h.calls.filter(c => c[0] === "range"); assert.equal(pages.length, 2);
  for (const p of pages) assert.deepEqual(p[3], [["user_id", owner]]);
  const predicate = h.calls.find(c => c[0] === "or")[1];
  assert.match(predicate, /status.in.\(planned,in_progress,postponed\)/); assert.match(predicate, /completed_at.gte.2026-10-20T03/); assert.match(predicate, /completed_at.lt.2026-10-21T03/);
});
test("query: anon performs no reads", async () => { const h = harness({ anon: true }); assert.equal((await service.readTodayMissions(h.auth, now)).reason, "auth_required"); assert.equal(h.calls.length, 0); });
test("query: empty collection is successful, never confused with error", async () => { const h = harness(); assert.equal((await service.readTodayMissions(h.auth, now)).dashboard.total, 0); });
test("query: database failure sanitizes response", async () => { const h = harness({ queryError: true }); assert.deepEqual(await service.readTodayMissions(h.auth, now), { ok: false, reason: "unavailable" }); });
test("query: thrown transport/auth failure returns recoverable error", async () => {
  assert.deepEqual(await service.readTodayMissions(async () => { throw Error("PRIVATE_NETWORK"); }, now), { ok: false, reason: "unavailable" });
});
for (const input of [null, {}, [], { missionId: "bad" }, { missionId: id, user_id: owner }, { missionId: id, userId: owner }, { missionId: id, completed_at: now.toISOString() }, { missionId: id, status: "completed" }, { missionId: id, extra: true }]) {
  test("completion: rejects invalid/excess authority " + JSON.stringify(input), async () => { const h = harness(); assert.equal((await h.run(input)).ok, false); assert.equal(h.calls.length, 0); });
}
for (const status of ["planned", "in_progress", "postponed"]) test("completion: permitted " + status + " has fixed server timestamp and owner", async () => {
  const h = harness({ row: { status } }); const before = Date.now(); assert.equal((await h.run()).ok, true);
  const value = h.stored.get(id); assert.equal(value.status, "completed"); assert.ok(Date.parse(value.completed_at) >= before);
  for (const call of h.calls.filter(c => c[0] === "read" || c[0] === "write")) assert.ok(call[1].some(([k, v]) => k === "user_id" && v === owner));
  assert.deepEqual(Object.keys(h.calls.find(c => c[0] === "update")[1]), ["status", "completed_at"]);
});
for (const options of [{ anon: true }, { missing: true }, { row: { user_id: id } }, { row: { status: "missed" } }, { error: true }, { throw: true }, { competingState: "missed" }]) test("completion: safe rejection " + JSON.stringify(options), async () => { const h = harness(options); const result = await h.run(); assert.equal(result.ok, false); assert.ok(!JSON.stringify(result).includes("PRIVATE")); assert.equal(h.writes, 0); });
test("completion: retry/lost response preserves original timestamp", async () => { const h = harness(); await h.run(); const stamp = h.stored.get(id).completed_at; assert.equal((await h.run()).ok, true); assert.equal(h.writes, 1); assert.equal(h.stored.get(id).completed_at, stamp); });
test("completion: already completed returns success without a write", async () => { const h = harness({ row: { status: "completed", completed_at: now.toISOString() } }); assert.equal((await h.run()).ok, true); assert.equal(h.writes, 0); });
test("completion: concurrent double clicks/tabs produce one effective update", async () => { const h = harness(); const results = await Promise.all(Array.from({ length: 8 }, () => h.run())); assert.ok(results.every(r => r.ok)); assert.equal(h.writes, 1); });

for (const claims of [null, {}, { sub: "bad" }, { sub: owner }]) test("auth: getClaims identity " + JSON.stringify(claims), async () => {
  const auth = load("src/lib/missions/service.ts", { "@/lib/supabase/server": { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims } }) } }) } });
  assert.equal(!!(await auth.authenticateMissions()), claims?.sub === owner);
});
test("auth: claims error denies even if sub present", async () => {
  const auth = load("src/lib/missions/service.ts", { "@/lib/supabase/server": { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: owner } }, error: {} }) } }) } });
  assert.equal(await auth.authenticateMissions(), null);
});

const ui = load("src/components/dashboard/today-missions.tsx");
test("UI: honest empty state and zero progress", () => { const html = renderToStaticMarkup(React.createElement(ui.TodayMissions, { dashboard: build([]) })); assert.match(html, /Nenhuma missão para hoje/); assert.match(html, /0 de 0 concluídas/); assert.match(html, /<progress/); });
test("UI: read error offers retry, no fake zero", () => { const html = renderToStaticMarkup(React.createElement(ui.TodayMissions, { dashboard: null })); assert.match(html, /Tentar novamente/); assert.doesNotMatch(html, /Nenhuma missão para hoje/); });
test("UI: priorities, origins, escaped title and accessible completion", () => {
  const html = renderToStaticMarkup(React.createElement(ui.TodayMissions, { dashboard: build([row({ title: "<script>hostile</script>", priority: "high" }), row({ id: owner, status: "completed", completed_at: now.toISOString() })]) }));
  for (const text of ["Prioridade Alta", "Faculdade", "IA", "25 min", "Concluídas hoje", "1 de 2 concluídas · 50%", "aria-label=\"Concluir missão:", "&lt;script&gt;"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<script>/);
});
