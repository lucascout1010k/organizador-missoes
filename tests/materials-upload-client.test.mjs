import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const subjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const materialId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const classSessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const storagePath = `11111111-1111-4111-8111-111111111111/${subjectId}/${materialId}/source.pdf`;
const prepared = { ok: true, materialId, storagePath, fileStatus: "pending_upload" };
const createPdf = (name = "ficticio.pdf", type = "application/pdf") => new File(["%PDF-1.7\n%%EOF"], name, { type });

// Execute the real source in memory, with no SSR/browser SDK, env or network.
const cache = new Map();
function load(relativePath) {
  const filename = path.resolve(root, relativePath);
  assert.ok(filename.startsWith(path.join(root, "src") + path.sep));
  if (cache.has(filename)) return cache.get(filename).exports;
  const runtimeModule = { exports: {} };
  cache.set(filename, runtimeModule);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  function requireMock(specifier) {
    if (specifier === "react") return React;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "next/link") return { default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (specifier.endsWith(".module.css")) return { default: {} };
    if (specifier === "@/lib/supabase/client") return { createClient() { throw new Error("Unexpected real browser client"); } };
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`);
    if (specifier.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)));
    throw new Error(`Unexpected runtime dependency: ${specifier}`);
  }
  const execute = runInThisContext(`(function(require, module, exports) {\n${compiled}\n})`, { filename });
  execute(requireMock, runtimeModule, runtimeModule.exports);
  return runtimeModule.exports;
}
const { createMaterialUploadController, validateClientMaterialPdf } = load("src/lib/academic/materials/upload-client.ts");

function createHarness(options = {}) {
  const calls = { prepare: [], client: 0, bucket: [], uploads: [], reports: [], feedback: [] };
  const controller = createMaterialUploadController({
    async prepare(input) {
      calls.prepare.push(input);
      if (options.prepareThrow) throw new Error("PRIVATE_PREPARE_DETAIL");
      if (options.prepareWait) return options.prepareWait;
      return options.prepareResult ?? prepared;
    },
    createClient() {
      calls.client++;
      if (options.clientThrow) throw new Error("PRIVATE_CLIENT_DETAIL");
      return { storage: { from(bucket) {
        calls.bucket.push(bucket);
        return { async upload(path, file, uploadOptions) {
          calls.uploads.push({ path, file, options: uploadOptions });
          if (options.uploadThrow) throw options.uploadThrow;
          if (options.uploadWait) return options.uploadWait;
          return options.uploadResult ?? { data: { path: storagePath }, error: null };
        } };
      } } };
    },
    async reportFailure(input) {
      calls.reports.push(input);
      if (options.reportThrow) throw new Error("PRIVATE_REPORT_DETAIL");
      return options.reportResult ?? { ok: true, fileStatus: "upload_failed" };
    },
    onFeedback(value) { calls.feedback.push(value); },
  });
  return {
    calls, controller,
    selection: { subjectId, classSessionId: null, title: "PDF fictício", file: createPdf() },
    last() { return calls.feedback.at(-1); },
  };
}

for (const [name, file, valid] of [
  ["valid PDF", createPdf(), true],
  ["uppercase extension", createPdf("ficticio.PDF"), true],
  ["empty file", new File([], "ficticio.pdf", { type: "application/pdf" }), false],
  ["wrong MIME", createPdf("ficticio.pdf", "text/plain"), false],
  ["empty MIME", createPdf("ficticio.pdf", ""), false],
  ["wrong extension", createPdf("ficticio.txt"), false],
  ["double extension", createPdf("ficticio.pdf.exe"), false],
  ["invalid signature", new File(["not a PDF"], "ficticio.pdf", { type: "application/pdf" }), false],
  ["short signature", new File(["%PDF"], "ficticio.pdf", { type: "application/pdf" }), false],
]) {
  test(`browser PDF UX: ${name}`, async () => {
    assert.equal((await validateClientMaterialPdf(file)) === null, valid);
  });
}

for (const size of [6291456, 6291457]) {
  test(`browser PDF UX: ${size} bytes`, async () => {
    const bytes = new Uint8Array(size);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const file = new File([bytes], "ficticio.pdf", { type: "application/pdf" });
    assert.equal((await validateClientMaterialPdf(file)) === null, size === 6291456);
  });
}

test("browser PDF UX: read failure stays sanitized", async () => {
  const file = createPdf();
  file.slice = () => { throw new Error("PRIVATE_FILE_DETAIL"); };
  const message = await validateClientMaterialPdf(file);
  assert.match(message, /Não foi possível ler/);
  assert.ok(!message.includes("PRIVATE"));
});

test("upload: no File selected causes no action or Storage call", async () => {
  const harness = createHarness();
  await harness.controller.submit({ ...harness.selection, file: null });
  assert.equal(harness.last().state, "idle");
  assert.equal(harness.calls.prepare.length, 0);
  assert.equal(harness.calls.client, 0);
});

for (const [name, changes] of [
  ["invalid PDF", { file: createPdf("ficticio.txt") }],
  ["invalid title", { title: " " }],
  ["invalid subject", { subjectId: "invalid" }],
  ["invalid class", { classSessionId: "invalid" }],
  ["filename traversal", { file: createPdf("folder/ficticio.pdf") }],
]) {
  test(`upload: ${name} stops before prepare`, async () => {
    const harness = createHarness();
    await harness.controller.submit({ ...harness.selection, ...changes });
    assert.equal(harness.last().state, "selected");
    assert.equal(harness.calls.prepare.length, 0);
    assert.equal(harness.calls.client, 0);
    assert.equal(harness.last().blocked, false);
  });
}

for (const [code, state, blocked] of [
  ["INVALID_INPUT", "selected", false],
  ["RESOURCE_UNAVAILABLE", "selected", false],
  ["AUTH_REQUIRED", "auth_required", false],
  ["PREPARE_FAILED", "uncertain_result", true],
]) {
  test(`upload: prepare ${code} does not upload and shows public message`, async () => {
    const harness = createHarness({ prepareResult: { ok: false, code, message: "Mensagem pública sanitizada." } });
    await harness.controller.submit(harness.selection);
    assert.deepEqual(harness.last(), { state, blocked, message: "Mensagem pública sanitizada." });
    assert.equal(harness.calls.prepare.length, 1);
    assert.equal(harness.calls.client, 0);
    assert.equal(harness.calls.reports.length, 0);
  });
}

test("upload: exact metadata only enters prepare, while File goes directly to fixed Storage", async () => {
  const harness = createHarness();
  await harness.controller.submit({ ...harness.selection, classSessionId });
  assert.deepEqual(harness.calls.prepare, [{
    subjectId, classSessionId, title: "PDF fictício", originalFilename: "ficticio.pdf",
    mimeType: "application/pdf", sizeBytes: harness.selection.file.size,
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls.prepare[0])), harness.calls.prepare[0]);
  assert.ok(Object.values(harness.calls.prepare[0]).every((value) => value === null || ["string", "number"].includes(typeof value)));
  assert.deepEqual(harness.calls.bucket, ["academic-materials"]);
  assert.deepEqual(harness.calls.uploads, [{ path: storagePath, file: harness.selection.file, options: { upsert: false, contentType: "application/pdf" } }]);
  assert.equal(harness.calls.uploads[0].file, harness.selection.file);
  assert.deepEqual(harness.calls.feedback.map(({ state }) => state), ["preparing", "uploading", "uploaded_pending_validation"]);
  assert.equal(harness.last().message, "Arquivo enviado. Validação pendente.");
  assert.equal(harness.last().blocked, true);
  assert.equal(harness.calls.reports.length, 0);
});

test("upload: synchronous lock prevents double click before the first await", async () => {
  let resolvePrepare;
  const prepareWait = new Promise((resolve) => { resolvePrepare = resolve; });
  const harness = createHarness({ prepareWait });
  const first = harness.controller.submit(harness.selection);
  const second = harness.controller.submit(harness.selection);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.prepare.length, 1);
  resolvePrepare(prepared);
  await Promise.all([first, second]);
  assert.equal(harness.calls.uploads.length, 1);
});

test("upload: completing upload never prepares/uploads the same material again", async () => {
  const harness = createHarness();
  await harness.controller.submit(harness.selection);
  await harness.controller.submit(harness.selection);
  assert.equal(harness.calls.prepare.length, 1);
  assert.equal(harness.calls.uploads.length, 1);
});

for (const [code, status, category] of [
  ["InvalidMimeType", 400, "mime_rejected"],
  ["EntityTooLarge", 413, "size_rejected"],
  ["AccessDenied", 403, "access_denied"],
  ["InvalidJWT", 401, "access_denied"],
  ["InvalidKey", 400, "validation_rejected"],
]) {
  test(`upload: explicit ${code} reports only safe category`, async () => {
    const error = { name: "StorageApiError", status, statusCode: String(status), code, message: "PRIVATE_STORAGE_DETAIL" };
    const harness = createHarness({ uploadResult: { data: null, error } });
    await harness.controller.submit(harness.selection);
    assert.deepEqual(harness.calls.reports, [{ materialId, failureCategory: category }]);
    assert.equal(harness.last().state, "confirmed_failure");
    assert.equal(harness.last().blocked, true);
    assert.ok(!JSON.stringify(harness.calls.reports).includes("PRIVATE"));
    assert.ok(!JSON.stringify(harness.calls.feedback).includes("PRIVATE"));
  });
}

for (const [name, error] of [
  ["status zero", { name: "StorageApiError", status: 0, code: "AccessDenied" }],
  ["HTTP timeout", { name: "StorageApiError", status: 408, code: "RequestTimeout" }],
  ["HTTP 500", { name: "StorageApiError", status: 500, code: "InvalidMimeType" }],
  ["HTTP 503", { name: "StorageApiError", status: 503, code: "SlowDown" }],
  ["AlreadyExists", { name: "StorageApiError", status: 400, code: "ObjectAlreadyExists" }],
  ["conflict", { name: "StorageApiError", status: 409, code: "ResourceAlreadyExists" }],
  ["unknown code", { name: "StorageApiError", status: 400, code: "Unknown" }],
  ["missing code", { name: "StorageApiError", status: 403, message: "PRIVATE_STORAGE_DETAIL" }],
]) {
  test(`upload: ${name} stays pending, never reports or retries`, async () => {
    const harness = createHarness({ uploadResult: { data: null, error } });
    await harness.controller.submit(harness.selection);
    await harness.controller.submit(harness.selection);
    assert.equal(harness.calls.reports.length, 0);
    assert.equal(harness.calls.prepare.length, 1);
    assert.equal(harness.calls.uploads.length, 1);
    assert.equal(harness.last().state, "uncertain_result");
    assert.equal(harness.last().blocked, true);
    assert.ok(!JSON.stringify(harness.calls.feedback).includes("PRIVATE"));
  });
}

test("upload: empty or contradictory SDK responses never report or retry", async () => {
  for (const uploadResult of [
    { data: null, error: null },
    { data: { path: storagePath }, error: { name: "StorageApiError", status: 400, code: "InvalidMimeType" } },
  ]) {
    const harness = createHarness({ uploadResult });
    await harness.controller.submit(harness.selection);
    await harness.controller.submit(harness.selection);
    assert.equal(harness.calls.reports.length, 0);
    assert.equal(harness.calls.prepare.length, 1);
    assert.equal(harness.calls.uploads.length, 1);
    assert.equal(harness.last().state, "uncertain_result");
    assert.equal(harness.last().blocked, true);
  }
});

for (const name of ["TypeError", "TimeoutError", "AbortError"]) {
  test(`upload: thrown ${name} never reports failure`, async () => {
    const error = new Error("PRIVATE_NETWORK_DETAIL");
    error.name = name;
    const harness = createHarness({ uploadThrow: error });
    await harness.controller.submit(harness.selection);
    assert.equal(harness.calls.reports.length, 0);
    assert.equal(harness.last().state, "uncertain_result");
    assert.ok(!JSON.stringify(harness.calls.feedback).includes("PRIVATE"));
  });
}

for (const [name, options] of [
  ["prepare response lost", { prepareThrow: true }],
  ["client creation failure after prepare", { clientThrow: true }],
  ["report response lost", { reportThrow: true }],
]) {
  test(`upload: ${name} is uncertain and sanitized`, async () => {
    const harness = createHarness({
      uploadResult: { data: null, error: { name: "StorageApiError", status: 400, code: "InvalidMimeType" } },
      ...options,
    });
    await harness.controller.submit(harness.selection);
    await harness.controller.submit(harness.selection);
    assert.equal(harness.last().state, "uncertain_result");
    assert.equal(harness.last().blocked, true);
    assert.equal(harness.calls.prepare.length, 1);
    assert.ok(!JSON.stringify(harness.calls.feedback).includes("PRIVATE"));
  });
}

for (const [code, state] of [["AUTH_REQUIRED", "auth_required"], ["REPORT_FAILED", "uncertain_result"], ["RESOURCE_UNAVAILABLE", "uncertain_result"]]) {
  test(`upload: report ${code} does not claim that metadata changed`, async () => {
    const harness = createHarness({
      uploadResult: { data: null, error: { name: "StorageApiError", status: 403, code: "AccessDenied" } },
      reportResult: { ok: false, code, message: "Mensagem pública." },
    });
    await harness.controller.submit(harness.selection);
    assert.equal(harness.calls.reports.length, 1);
    assert.equal(harness.last().state, state);
    assert.match(harness.last().message, /não foi confirmada|não foi possível confirmar/);
    assert.equal(harness.last().blocked, true);
  });
}

test("form: local server render has one file input, no native upload action and live feedback", () => {
  const { MaterialUploadForm } = load("src/components/academic/material-upload-form.tsx");
  const markup = renderToStaticMarkup(React.createElement(MaterialUploadForm, {
    subjectId, classes: [{ id: classSessionId, title: "Aula fictícia" }],
    prepareAction: async () => prepared,
    reportFailureAction: async () => ({ ok: true, fileStatus: "upload_failed" }),
  }));
  assert.equal((markup.match(/type="file"/g) ?? []).length, 1);
  assert.ok(markup.includes('accept=".pdf,application/pdf"'));
  assert.ok(markup.includes('aria-live="polite"'));
  assert.ok(markup.includes('role="status"'));
  assert.ok(markup.includes('data-state="idle"'));
  const submitButton = markup.match(/<button\b[^>]*>/)?.[0];
  assert.ok(submitButton?.includes('type="submit"'));
  assert.ok(submitButton?.includes('disabled=""'));
  assert.ok(markup.includes("Aula fictícia"));
  assert.ok(!markup.includes("multiple="));
  assert.ok(!markup.includes("action="));
  assert.ok(!markup.includes("enctype="));
});
