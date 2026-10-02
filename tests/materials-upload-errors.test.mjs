import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

// The classifier source is compiled in memory. No SDK, environment or network is loaded.
const filename = fileURLToPath(new URL("../src/lib/academic/materials/upload-errors.ts", import.meta.url));
const runtimeModule = { exports: {} };
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const execute = runInThisContext(`(function(require, module, exports) {\n${compiled}\n})`, { filename });
execute((specifier) => { throw new Error(`Unexpected runtime dependency: ${specifier}`); }, runtimeModule, runtimeModule.exports);
const { classifyMaterialUploadError } = runtimeModule.exports;

const knownFailures = [
  ["InvalidMimeType", 400, "mime_rejected"],
  ["EntityTooLarge", 413, "size_rejected"],
  ["AccessDenied", 403, "access_denied"],
  ["InvalidJWT", 401, "access_denied"],
  ["unauthorized", 403, "access_denied"],
  ["InvalidKey", 400, "validation_rejected"],
  ["InvalidBucketName", 400, "validation_rejected"],
];

for (const [code, status, category] of knownFailures) {
  for (const [shape, fields] of [
    ["modern code", { status, code, statusCode: code }],
    ["legacy error", { status, error: code, statusCode: String(status) }],
    ["code statusCode", { status, statusCode: code }],
    ["numeric statusCode fallback", { code, statusCode: String(status) }],
    ["all agreeing code fields", { status, code, error: code, statusCode: code }],
  ]) {
    test(`upload classification: confirms ${code} with ${shape}`, () => {
      const result = classifyMaterialUploadError({ name: "StorageApiError", ...fields, message: "PRIVATE_RAW_DETAIL" });
      assert.deepEqual(result, { kind: "confirmed", category });
      assert.deepEqual(Object.keys(result).sort(), ["category", "kind"]);
      assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    });
  }
}

const uncertainCases = [
  ["null", null],
  ["undefined", undefined],
  ["string", "InvalidMimeType"],
  ["number", 400],
  ["generic Error", new Error("InvalidMimeType")],
  ["fetch TypeError", new TypeError("Failed to fetch")],
  ["StorageUnknownError", { name: "StorageUnknownError", status: 400, code: "InvalidMimeType" }],
  ["AbortError", { name: "AbortError", status: 400, code: "InvalidMimeType" }],
  ["TimeoutError", { name: "TimeoutError", status: 400, code: "InvalidMimeType" }],
  ["missing name", { status: 400, code: "InvalidMimeType" }],
  ["missing HTTP status", { name: "StorageApiError", code: "InvalidMimeType" }],
  ["code statusCode without HTTP status", { name: "StorageApiError", statusCode: "InvalidMimeType" }],
  ["missing explicit code", { name: "StorageApiError", status: 400, statusCode: "400" }],
  ["message alone is never proof", { name: "StorageApiError", status: 400, message: "InvalidMimeType" }],
  ["unknown code", { name: "StorageApiError", status: 400, code: "UnknownCode" }],
  ["duplicate code", { name: "StorageApiError", status: 409, code: "AlreadyExists" }],
  ["wrong status for MIME code", { name: "StorageApiError", status: 403, code: "InvalidMimeType" }],
  ["wrong status for size code", { name: "StorageApiError", status: 400, code: "EntityTooLarge" }],
  ["wrong status for JWT code", { name: "StorageApiError", status: 403, code: "InvalidJWT" }],
  ["wrong status for access code", { name: "StorageApiError", status: 401, code: "AccessDenied" }],
  ["wrong status for legacy unauthorized", { name: "StorageApiError", status: 401, error: "unauthorized" }],
  ["conflicting code and legacy error", { name: "StorageApiError", status: 400, code: "InvalidMimeType", error: "InvalidKey" }],
  ["conflicting code and code statusCode", { name: "StorageApiError", status: 400, code: "InvalidMimeType", statusCode: "InvalidKey" }],
  ["conflicting HTTP status fields", { name: "StorageApiError", status: 400, code: "InvalidMimeType", statusCode: "413" }],
  ["unknown legacy error despite known code", { name: "StorageApiError", status: 400, code: "InvalidMimeType", error: "Other" }],
  ["unknown statusCode despite known code", { name: "StorageApiError", status: 400, code: "InvalidMimeType", statusCode: "Other" }],
  ["empty explicit code", { name: "StorageApiError", status: 400, code: "", statusCode: "InvalidMimeType" }],
  ["null explicit code", { name: "StorageApiError", status: 400, code: null, statusCode: "InvalidMimeType" }],
  ["numeric explicit code", { name: "StorageApiError", status: 400, code: 400, statusCode: "InvalidMimeType" }],
  ["numeric-string explicit code", { name: "StorageApiError", status: 400, code: "400" }],
  ["object legacy error", { name: "StorageApiError", status: 400, error: { code: "InvalidMimeType" } }],
  ["null status", { name: "StorageApiError", status: null, code: "InvalidMimeType", statusCode: "400" }],
  ["string status", { name: "StorageApiError", status: "400", code: "InvalidMimeType", statusCode: "400" }],
  ["fractional status", { name: "StorageApiError", status: 400.5, code: "InvalidMimeType", statusCode: "400" }],
  ["NaN status", { name: "StorageApiError", status: NaN, code: "InvalidMimeType", statusCode: "400" }],
  ["infinite status", { name: "StorageApiError", status: Infinity, code: "InvalidMimeType", statusCode: "400" }],
  ["boolean status", { name: "StorageApiError", status: true, code: "InvalidMimeType", statusCode: "400" }],
  ["numeric statusCode", { name: "StorageApiError", status: 400, code: "InvalidMimeType", statusCode: 400 }],
  ["null statusCode", { name: "StorageApiError", status: 400, code: "InvalidMimeType", statusCode: null }],
  ["padded statusCode", { name: "StorageApiError", code: "InvalidMimeType", statusCode: "0400" }],
  ["whitespace statusCode", { name: "StorageApiError", code: "InvalidMimeType", statusCode: "400 " }],
  ["short statusCode", { name: "StorageApiError", code: "InvalidMimeType", statusCode: "40" }],
  ["decimal statusCode", { name: "StorageApiError", code: "InvalidMimeType", statusCode: "400.0" }],
  ["lowercase unknown code", { name: "StorageApiError", status: 400, code: "invalidmimetype" }],
  ["blank legacy error despite known code", { name: "StorageApiError", status: 400, code: "InvalidMimeType", error: "" }],
];

for (const status of [0, -1, 99, 200, 408, 409, 429, 500, 503, 599, 600]) {
  uncertainCases.push([`uncertain HTTP status ${status}`, { name: "StorageApiError", status, code: "InvalidMimeType" }]);
}

for (const [name, error] of uncertainCases) {
  test(`upload classification: ${name} stays uncertain`, () => {
    assert.deepEqual(classifyMaterialUploadError(error), { kind: "uncertain" });
  });
}

test("upload classification: never accesses the raw message", () => {
  const error = { name: "StorageApiError", status: 400, code: "InvalidMimeType" };
  Object.defineProperty(error, "message", { get() { throw new Error("Raw message must not be read"); } });
  assert.deepEqual(classifyMaterialUploadError(error), { kind: "confirmed", category: "mime_rejected" });
});

test("upload classification: throwing structured fields remain uncertain", () => {
  for (const field of ["name", "status", "statusCode", "code", "error"]) {
    const error = { name: "StorageApiError", status: 400, code: "InvalidMimeType" };
    Object.defineProperty(error, field, { get() { throw new Error("PRIVATE_GETTER_DETAIL"); } });
    assert.deepEqual(classifyMaterialUploadError(error), { kind: "uncertain" });
  }
});

test("upload classification: revoked proxies remain uncertain", () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.deepEqual(classifyMaterialUploadError(proxy), { kind: "uncertain" });
});
