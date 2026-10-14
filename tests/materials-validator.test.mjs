import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/academic/materials/validator.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(overrides = {}) {
  // A fresh generated fake credential is used only inside this offline mock;
  // no real environment is read and no network/driver is loaded.
  const connection = new URL("postgresql://material_validator.fixture-project@aws-0-sa-east-1.pooler.supabase.com:6543/postgres");
  connection.password = randomBytes(32).toString("hex");
  if (overrides.username) connection.username = overrides.username;
  if (overrides.host) connection.hostname = overrides.host;
  if (overrides.port) connection.port = overrides.port;
  const calls = { connections: [], queries: [], cancelled: 0, jsonValues: [] };
  const runtimeModule = { exports: {} };
  const database = { json(value) { calls.jsonValues.push(value); return { type: "jsonb", value }; }, unsafe(query, parameters) {
    calls.queries.push({ query, parameters });
    const pending = Promise.resolve([]);
    pending.cancel = () => { calls.cancelled++; };
    return pending;
  } };
  const requireMock = (name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/database-ca") return { SUPABASE_DATABASE_CA: "offline-mock-public-ca" };
    if (name === "@/lib/supabase/env") return { getSupabaseEnvironment: () => ({ url: "https://fixture-project.supabase.co" }) };
    if (name === "postgres") return { __esModule: true, default(_connection, options) { calls.connections.push(options); return database; } };
    throw new Error("Unexpected real dependency");
  };
  const fakeProcess = { env: { MATERIAL_VALIDATOR_DATABASE_URL: overrides.missing ? undefined : connection.toString() } };
  const timer = (callback, milliseconds) => { assert.equal(milliseconds, 8000); if (overrides.cancel) callback(); return 1; };
  runInThisContext(`(function(require,module,exports,process,setTimeout,clearTimeout){${compiled}\n})`)(
    requireMock, runtimeModule, runtimeModule.exports, fakeProcess, timer, () => {},
  );
  return { calls, transition: runtimeModule.exports.transitionMaterial, settle: runtimeModule.exports.settleAcademicAnalysis };
}
const authorization = {
  materialId: "11111111-1111-4111-8111-111111111111", attemptId: "22222222-2222-4222-8222-222222222222",
  generation: "1", capability: randomBytes(32).toString("hex"),
};
for (const operation of ["begin", "complete", "reject", "missing", "resume", "deleted"]) {
  test(`validator client: ${operation} is fixed, parameterized and has no DDL/TEMP`, async () => {
    const h = harness(); await h.transition(operation, authorization);
    assert.match(h.calls.queries[0].query, /^select app_materials_private\.[a-z_]+\(/);
    assert.ok(!h.calls.queries[0].query.includes(authorization.capability));
    assert.ok(!/\b(create|alter|drop|temp|temporary|set role)\b/i.test(h.calls.queries[0].query));
    assert.equal(h.calls.queries[0].parameters[3], authorization.capability);
    assert.equal(h.calls.connections[0].max, 1); assert.equal(h.calls.connections[0].prepare, false);
    assert.deepEqual(h.calls.connections[0].ssl, { rejectUnauthorized: true, ca: "offline-mock-public-ca" });
  });
}
for (const [label, options] of [
  ["missing credential", { missing: true }], ["admin credential", { username: "postgres.fixture-project" }],
  ["service role", { username: "service_role.fixture-project" }], ["untrusted host", { host: "example.invalid" }],
  ["session pooler port", { port: "5432" }],
]) test("validator client: rejects " + label + " before connecting", async () => {
  const h = harness(options); await assert.rejects(h.transition("begin", authorization), /Material validator unavailable/);
  assert.equal(h.calls.connections.length, 0); assert.equal(h.calls.queries.length, 0);
});
test("validator client: bounded SQL cancellation is enabled", async () => {
  const h = harness({ cancel: true }); await h.transition("begin", authorization); assert.equal(h.calls.cancelled, 1);
});
test("validator client: reuses one small pool rather than connecting per transition", async () => {
  const h = harness(); await h.transition("begin", authorization); await h.transition("missing", authorization);
  assert.equal(h.calls.connections.length, 1); assert.equal(h.calls.queries.length, 2);
});

test("analysis validator: uses JSON binding rather than double stringifying evidence", async () => {
  const h = harness(), result = { summary: "Fixture" };
  await h.settle({ analysisId: authorization.materialId, completionToken: authorization.capability }, { kind: "completed", result, model: "gemini-3.8-flash" });
  assert.deepEqual(h.calls.jsonValues, [result]);
  assert.deepEqual(h.calls.queries[0].parameters[2], { type: "jsonb", value: result });
  assert.equal(h.calls.queries[0].query, "select app_materials_private.complete_material_analysis($1::uuid,$2::text,$3::jsonb,$4::text)");
});
test("analysis validator: failure uses fixed function, only id/token/category bound", async () => {
  const h = harness();
  await h.settle({ analysisId: authorization.materialId, completionToken: authorization.capability }, { kind: "failed", category: "provider_unavailable" });
  assert.equal(h.calls.queries[0].query, "select app_materials_private.fail_material_analysis($1::uuid,$2::text,$3::text)");
  assert.equal(h.calls.queries[0].parameters.length, 3); assert.equal(h.calls.jsonValues.length, 0);
});
