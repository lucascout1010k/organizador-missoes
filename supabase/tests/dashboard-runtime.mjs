// Explicit remote runner; controlled fictional accounts only, never real user data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const fixturePath = ".env.3a-runtime.json";
const f = JSON.parse(readFileSync(fixturePath, "utf8"));
assert.equal(f.a.id, "3a000000-0000-4000-8000-000000000001");
assert.equal(f.b.id, "3a000000-0000-4000-8000-000000000002");
assert.ok(Object.values(f).slice(0, 2).every(u => u.email.endsWith("@example.invalid")));
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, "artaypnqyxwpzqrcfqvp.supabase.co");
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const a = client(), b = client(), anon = client();
let active = a;
function load(relative, cache = new Map()) {
  const filename = path.resolve(relative); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} }; cache.set(filename, mod);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const req = name => {
    if (name === "server-only") return {};
    if (name === "zod") return zod;
    if (name === "@/lib/supabase/server") return { createClient: async () => active };
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), name + ".ts"), cache);
    throw Error("Unexpected import");
  };
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(req, mod, mod.exports);
  return mod.exports;
}
const service = load("src/lib/missions/service.ts"), { todayRange } = load("src/lib/missions/today.ts");
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log("PASS " + label); };
try {
  for (const [db, user] of [[a, f.a], [b, f.b]]) {
    const result = await db.auth.signInWithPassword({ email: user.email, password: user.password });
    check(!result.error && result.data.user.id === user.id, "fictional session authenticated");
  }
  const { start } = todayRange(); const time = Date.parse(start);
  const at = delta => new Date(time + delta * 3600000).toISOString();
  const specs = [
    ["ui", { title: "Missão fictícia hoje " + "título longo ".repeat(12), priority: "high", origin_type: "ai", description: '<script>alert("fixture")</script>' }],
    ["overdue", { title: "Missão fictícia atrasada", scheduled_for: at(-24), priority: "low" }],
    ["future", { title: "Missão fictícia futura", scheduled_for: at(48) }],
    ["done", { title: "Missão fictícia concluída", status: "completed", completed_at: at(1) }],
    ["backlog", { title: "Missão fictícia sem data", scheduled_for: null }],
    ["oldDone", { title: "Missão fictícia concluída ontem", status: "completed", completed_at: at(-24) }],
    ["postponed", { title: "Missão fictícia adiada", status: "postponed" }],
    ["missed", { title: "Missão fictícia não realizada", status: "missed" }],
    ["complete", { title: "Missão fictícia conclusão runtime" }],
    ["race", { title: "Missão fictícia concorrência" }],
    ["error", { title: "Missão fictícia erro UI" }],
  ];
  f.missions = {};
  // Stable namespace + explicit INSERT; reruns never overwrite an existing fixture.
  for (let i = 0; i < specs.length; i++) {
    const [key, fields] = specs[i]; const id = `3a000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
    const result = await a.from("missions").insert({ id, user_id: f.a.id, category: "academic", origin_type: "manual", scheduled_for: at(12), estimated_minutes: 25, ...fields });
    check(!result.error, "fixture inserted " + key); f.missions[key] = id;
  }
  f.bMission = "3a000000-0000-4000-8000-000000000200";
  check(!(await b.from("missions").insert({ id: f.bMission, user_id: f.b.id, title: "Missão privada fictícia B", category: "personal", scheduled_for: at(12) })).error, "B owns a separate private mission");
  writeFileSync(fixturePath, JSON.stringify(f));
  let result = await service.readTodayMissions();
  check(result.ok && result.dashboard.total === 7 && result.dashboard.completed === 1 && result.dashboard.overdue === 1, "real query counts relevant missions once");
  const list = result.dashboard.missions;
  check(list[0].id === f.missions.overdue && list[1].id === f.missions.ui, "overdue then priority order");
  for (const key of ["future", "backlog", "oldDone", "missed"]) check(!list.some(m => m.id === f.missions[key]), "excluded " + key);
  check(!list.some(m => m.id === f.bMission), "A dashboard cannot see B");
  check((await a.from("missions").select("id").eq("id", f.bMission)).data.length === 0, "RLS hides B from direct A read");
  check(!(await service.completeOwnedMission({ missionId: f.bMission })).ok, "A cannot complete B through service");
  check((await a.from("missions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", f.bMission).select("id")).data.length === 0, "RLS prevents direct cross-owner update");
  for (const payload of [{ missionId: "bad" }, { missionId: "3a000000-0000-4000-8000-000000000999" }, ...["user_id", "status", "completed_at", "extra"].map(key => ({ missionId: f.missions.complete, [key]: "forged" }))]) check(!(await service.completeOwnedMission(payload)).ok, "invalid/nonexistent/forged payload denied");
  check((await service.completeOwnedMission({ missionId: f.missions.complete })).ok, "pending mission completed by owner");
  const stored = async id => (await a.from("missions").select("status,completed_at,user_id").eq("id", id).single()).data;
  const first = await stored(f.missions.complete);
  check(first.status === "completed" && first.completed_at && first.user_id === f.a.id, "completion timestamp stored by server");
  check((await service.completeOwnedMission({ missionId: f.missions.complete })).ok, "lost response/retry is idempotent");
  check((await stored(f.missions.complete)).completed_at === first.completed_at, "retry preserves first timestamp");
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => service.completeOwnedMission({ missionId: f.missions.race })));
  check(concurrent.every(r => r.ok), "eight concurrent completions succeed idempotently");
  const race = await stored(f.missions.race);
  await service.completeOwnedMission({ missionId: f.missions.race });
  check((await stored(f.missions.race)).completed_at === race.completed_at, "concurrent winner timestamp preserved");
  result = await service.readTodayMissions();
  check(result.dashboard.total === 7 && result.dashboard.completed === 3 && result.dashboard.percent === 43, "progress reflects persisted completions");
  active = b;
  result = await service.readTodayMissions();
  check(result.ok && result.dashboard.total === 1 && result.dashboard.missions[0].id === f.bMission, "B sees only B");
  check(!(await service.completeOwnedMission({ missionId: f.missions.ui })).ok, "B cannot complete A");
  active = anon;
  check(!(await service.readTodayMissions()).ok, "anon denied dashboard service");
  check(!(await service.completeOwnedMission({ missionId: f.missions.ui })).ok, "anon denied completion");
  check(!!(await anon.from("missions").select("id")).error, "anon denied database read");
  console.log(`REMOTE_DASHBOARD_CHECKS=${checks}`);
} finally { await Promise.allSettled([a.auth.signOut({ scope: "local" }), b.auth.signOut({ scope: "local" })]); }
