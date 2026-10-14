import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const userId = "11111111-1111-4111-8111-111111111111";
const subjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const materialId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const attemptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const capability = "a".repeat(64);
const pdf = new TextEncoder().encode("%PDF-1.7\n%%EOF");

function load(relative, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const runtimeModule = { exports: {} }; cache.set(filename, runtimeModule);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  function requireMock(specifier) {
    if (specifier === "server-only") return {};
    if (specifier === "node:crypto") return { createHash };
    if (specifier === "@/lib/supabase/env") return { getSupabaseEnvironment: () => ({ url: "https://example.supabase.co", publishableKey: "fixture-public-key" }) };
    if (specifier.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), specifier + ".ts")), cache);
    throw new Error("Unexpected dependency: " + specifier);
  }
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(requireMock, runtimeModule, runtimeModule.exports);
  return runtimeModule.exports;
}
const { finalizeOwnedMaterial } = load("src/lib/academic/materials/finalize.ts");
const { downloadPrivatePdf } = load("src/lib/academic/materials/pdf-object.ts");

function harness(options = {}) {
  const calls = [];
  const material = {
    id: materialId, user_id: userId, subject_id: subjectId,
    storage_path: `${userId}/${subjectId}/${materialId}/source.pdf`,
    mime_type: "application/pdf", size_bytes: pdf.length, file_status: "pending_upload", deleted_at: null,
    ...options.material,
  };
  const decision = {
    result: "issued", attempt_id: attemptId, generation: 1, capability,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    purpose: material.file_status === "deleting" ? "deletion" : "validation", ...options.decision,
  };
  let cleanup = false;
  let objectIndex = 0;
  const supabase = {
    from(table) {
      assert.equal(table, "academic_materials"); calls.push(["select"]);
      const builder = {
        select() { return builder; }, eq() { return builder; },
        async maybeSingle() { return { data: options.missingMaterial ? null : material, error: options.selectError ?? null }; },
      };
      return builder;
    },
    rpc(name, parameters) {
      assert.equal(name, "issue_material_authorization");
      assert.deepEqual(parameters, { p_material_id: materialId });
      calls.push(["issue"]);
      return { async maybeSingle() { return { data: decision, error: options.issueError ?? null }; } };
    },
    auth: { async getSession() {
      calls.push(["session"]);
      return { data: { session: options.noSession ? null : { access_token: "fixture-session-token", user: { id: options.sessionUser ?? userId } } }, error: null };
    } },
    storage: { from(bucket) {
      assert.equal(bucket, "academic-materials");
      return { async list() {
        calls.push(["list"]);
        return { data: options.listPresent ? [{ name: "source.pdf" }] : [], error: options.listError ?? null };
      }, async remove(paths) {
        assert.deepEqual(paths, [material.storage_path]); calls.push(["remove"]); cleanup = true;
        return { data: [], error: options.removeError ?? null };
      } };
    } },
  };
  const dependencies = {
    async authenticate() { calls.push(["auth"]); return options.authResult ?? { ok: true, supabase, userId }; },
    async transition(operation, authorization, extra) {
      assert.deepEqual(authorization, { materialId, attemptId, generation: String(decision.generation), capability });
      calls.push([operation, extra]);
      if (options.transitionError === operation) throw new Error("PRIVATE_SQL_CAPABILITY_CONNECTION");
      if (["begin", "resume"].includes(operation)) material.file_status = operation === "begin" ? "validating" : "deleting";
      if (operation === "reject") material.file_status = "deleting";
    },
    async download(path, token) {
      assert.equal(path, material.storage_path); assert.equal(token, "fixture-session-token"); calls.push(["download"]);
      return options.objects?.[objectIndex++] ?? (cleanup ? { kind: "missing" } : { kind: "found", bytes: pdf, mime: "application/pdf" });
    },
  };
  return { calls, async run(input = materialId) {
    const result = await finalizeOwnedMaterial(input, dependencies);
    assert.ok(!JSON.stringify(result).includes(capability));
    assert.ok(!JSON.stringify(result).includes(attemptId));
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    assert.deepEqual(Object.keys(result).sort(), result.ok ? ["fileStatus", "message", "ok"] : ["code", "message", "ok"]);
    return result;
  } };
}

test("finalize: PDF bytes produce exact SHA256 evidence before ready", async () => {
  const h = harness(); assert.equal((await h.run()).ok, true);
  assert.deepEqual(h.calls.map(([name]) => name), ["auth", "select", "issue", "session", "begin", "download", "complete"]);
  assert.deepEqual(h.calls.at(-1)[1], [pdf.length, createHash("sha256").update(pdf).digest(), "pdf-signature-v1"]);
});
for (const input of [null, {}, [], "invalid", " " + materialId, materialId.toUpperCase()]) {
  test("finalize: strict invalid input " + String(input), async () => {
    const h = harness(); assert.equal((await h.run(input)).code, "INVALID_INPUT"); assert.equal(h.calls.length, 0);
  });
}
for (const [label, material] of [
  ["foreign owner", { user_id: subjectId }], ["forged path", { storage_path: "../forged.pdf" }],
  ["deleted", { deleted_at: "2026-10-14", file_status: "deleted" }], ["invalid subject", { subject_id: "bad" }],
  ["wrong metadata MIME", { mime_type: "text/plain" }], ["zero metadata bytes", { size_bytes: 0 }],
  ["large metadata", { size_bytes: 6291457 }], ["noninteger bytes", { size_bytes: 1.2 }],
]) test("finalize: rejects " + label + " before capability", async () => {
  const h = harness({ material }); assert.equal((await h.run()).code, "RESOURCE_UNAVAILABLE");
  assert.ok(!h.calls.some(([name]) => name === "issue"));
});
for (const [label, options, code] of [
  ["absent auth", { authResult: { ok: false, reason: "auth_required" } }, "AUTH_REQUIRED"],
  ["auth transport", { authResult: { ok: false, reason: "unavailable" } }, "UNCERTAIN"],
  ["missing metadata", { missingMaterial: true }, "RESOURCE_UNAVAILABLE"],
  ["query error", { selectError: { message: "PRIVATE" } }, "UNCERTAIN"],
  ["RPC error", { issueError: { message: "PRIVATE" } }, "UNCERTAIN"],
  ["wrong session", { sessionUser: subjectId }, "AUTH_REQUIRED"],
  ["absent session", { noSession: true }, "AUTH_REQUIRED"],
  ["begin error", { transitionError: "begin" }, "UNCERTAIN"],
  ["complete lost response", { transitionError: "complete" }, "UNCERTAIN"],
]) test("finalize: " + label + " stays sanitized", async () => { assert.equal((await harness(options).run()).code, code); });

for (const [label, object, category] of [
  ["invalid signature", { kind: "found", bytes: new TextEncoder().encode("!PDF-1.7\n%%EOF"), mime: "application/pdf" }, "invalid_pdf_signature"],
  ["size mismatch", { kind: "found", bytes: pdf.slice(0, -1), mime: "application/pdf" }, "size_mismatch"],
  ["zero bytes", { kind: "found", bytes: new Uint8Array(), mime: "application/pdf" }, "size_mismatch"],
  ["MIME mismatch", { kind: "found", bytes: pdf, mime: "text/plain" }, "mime_mismatch"],
  ["oversized stream", { kind: "oversized" }, "size_limit_exceeded"],
]) test("finalize: " + label + " rejects then confirms cleanup", async () => {
  const h = harness({ objects: [object, { kind: "missing" }] });
  assert.equal((await h.run()).code, "INVALID_PDF");
  assert.deepEqual(h.calls.find(([name]) => name === "reject")[1], [category]);
  assert.deepEqual(h.calls.slice(-4).map(([name]) => name), ["remove", "select", "list", "deleted"]);
  assert.ok(!h.calls.some(([name]) => name === "complete"));
});
test("finalize: confirmed absence alone marks upload_failed", async () => {
  const h = harness({ objects: [{ kind: "missing" }] }); assert.equal((await h.run()).code, "MISSING");
  assert.deepEqual(h.calls.slice(-3).map(([name]) => name), ["select", "list", "missing"]);
});
test("finalize: transient download leaves validating recoverable", async () => {
  const h = harness({ objects: [{ kind: "uncertain" }] }); assert.equal((await h.run()).code, "UNCERTAIN");
  assert.ok(!h.calls.some(([name]) => ["missing", "reject", "complete", "deleted"].includes(name)));
});
test("finalize: deletion error cannot claim deleted", async () => {
  const h = harness({ objects: [{ kind: "oversized" }], removeError: { message: "PRIVATE" } });
  assert.equal((await h.run()).code, "UNCERTAIN"); assert.ok(!h.calls.some(([name]) => name === "deleted"));
});
test("finalize: ambiguous deletion probe cannot claim deleted", async () => {
  const h = harness({ objects: [{ kind: "oversized" }], listError: { message: "PRIVATE" } });
  assert.equal((await h.run()).code, "UNCERTAIN"); assert.ok(!h.calls.some(([name]) => name === "deleted"));
});
test("finalize: object still listed cannot become a tombstone", async () => {
  const h = harness({ objects: [{ kind: "oversized" }], listPresent: true });
  assert.equal((await h.run()).code, "UNCERTAIN"); assert.ok(!h.calls.some(([name]) => name === "deleted"));
});
test("finalize: NoSuchKey with failed permission/list confirmation remains uncertain", async () => {
  const h = harness({ objects: [{ kind: "missing" }], listError: { code: "AccessDenied" } });
  assert.equal((await h.run()).code, "UNCERTAIN"); assert.ok(!h.calls.some(([name]) => name === "missing"));
});
test("finalize: NoSuchKey with visible metadata object is ambiguous", async () => {
  const h = harness({ objects: [{ kind: "missing" }], listPresent: true });
  assert.equal((await h.run()).code, "UNCERTAIN"); assert.ok(!h.calls.some(([name]) => name === "missing"));
});
test("finalize: ready is idempotent only with trusted RPC decision", async () => {
  const h = harness({ material: { file_status: "ready" }, decision: { result: "already_ready", capability: null } });
  assert.equal((await h.run()).ok, true); assert.deepEqual(h.calls.map(([name]) => name), ["auth", "select", "issue"]);
});
test("finalize: concurrent caller never acquires existing capability", async () => {
  const h = harness({ decision: { result: "in_progress", capability: null } });
  assert.equal((await h.run()).code, "IN_PROGRESS"); assert.ok(!h.calls.some(([name]) => name === "begin"));
});
test("finalize: upload_failed with present PDF can be validated", async () => {
  assert.equal((await harness({ material: { file_status: "upload_failed" } }).run()).ok, true);
});
test("finalize: deleting resumes cleanup only", async () => {
  const h = harness({ material: { file_status: "deleting" } }); assert.equal((await h.run()).code, "INVALID_PDF");
  assert.deepEqual(h.calls.slice(-4).map(([name]) => name), ["remove", "select", "list", "deleted"]);
});
for (const decision of [
  { generation: 0 }, { generation: Number.MAX_SAFE_INTEGER + 1 }, { generation: "bad" },
  { capability: "bad" }, { attempt_id: "bad" }, { expires_at: "bad" },
  { expires_at: new Date(0).toISOString() }, { purpose: "deletion" },
]) test("finalize: invalid authorization shape " + JSON.stringify(decision), async () => {
  assert.equal((await harness({ decision }).run()).code, "UNCERTAIN");
});

for (const [label, response, kind] of [
  ["PDF", () => new Response(pdf, { headers: { "content-type": "application/pdf" } }), "found"],
  ["explicit NoSuchKey", () => new Response(JSON.stringify({ code: "NoSuchKey" }), { status: 404 }), "missing"],
  ["ambiguous 404", () => new Response("not found", { status: 404 }), "uncertain"],
  ["NoSuchBucket", () => new Response(JSON.stringify({ code: "NoSuchBucket" }), { status: 404 }), "uncertain"],
  ["permission error", () => new Response("denied", { status: 403 }), "uncertain"],
  ["session error", () => new Response("expired", { status: 401 }), "uncertain"],
  ["provider 5xx", () => new Response("unavailable", { status: 503 }), "uncertain"],
  ["oversized bytes", () => new Response(new Uint8Array(6291457)), "oversized"],
]) test("bounded server download: " + label, async () => {
  const result = await downloadPrivatePdf("owner/subject/material/source.pdf", "fixture-token", async (url, options) => {
    assert.ok(url.includes("/storage/v1/object/authenticated/academic-materials/"));
    assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal); return response();
  });
  assert.equal(result.kind, kind);
});
test("bounded server download: DNS/timeout never become absence", async () => {
  const result = await downloadPrivatePdf("x", "fixture-token", async () => { throw new Error("ENOTFOUND PRIVATE"); });
  assert.deepEqual(result, { kind: "uncertain" });
});
