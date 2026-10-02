import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const actionPath = "src/app/(protected)/faculdade/materias/[id]/materiais/actions.ts";
const validationPath = "src/lib/academic/materials/validation.ts";
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const subjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherSubjectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const classSessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const materialId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const validInput = {
  subjectId,
  title: "PDF fictício",
  originalFilename: "exemplo.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
};

// Compile the actual source in memory. Every external runtime dependency is
// replaced explicitly; the real SSR client, environment and network are never loaded.
function createHarness(options = {}) {
  const calls = { client: 0, claims: 0, queries: [], inserts: [], updates: [], uuid: 0 };
  const rows = {
    subjects: options.subjects ?? [{ id: subjectId, user_id: userId }],
    class_sessions: options.classes ?? [{ id: classSessionId, subject_id: subjectId, user_id: userId }],
    academic_materials: (options.materials ?? [{
      id: materialId, user_id: userId, file_status: "pending_upload", deleted_at: null,
    }]).map((row) => ({ ...row })),
  };
  const client = {
    auth: {
      async getClaims() {
        calls.claims++;
        if (options.claimsThrow) throw new Error("PRIVATE_SESSION_DETAIL");
        return options.claims ?? { data: { claims: { sub: userId } }, error: null };
      },
    },
    from(table) {
      if (table === "academic_materials") {
        return {
          async insert(row) {
            calls.inserts.push(row);
            if (options.insertThrow) throw new Error("PRIVATE_DATABASE_DETAIL");
            return { error: options.insertError ?? null };
          },
          update(changes) {
            const query = { changes, columns: null, filters: [], nullFilters: [] };
            calls.updates.push(query);
            const builder = {
              eq(column, value) { query.filters.push([column, value]); return builder; },
              is(column, value) { query.nullFilters.push([column, value]); return builder; },
              select(columns) { query.columns = columns; return builder; },
              async maybeSingle() {
                if (options.updateThrow) throw new Error("PRIVATE_UPDATE_DETAIL");
                if (options.updateError) return { data: null, error: options.updateError };
                if (options.stateBeforeUpdate) {
                  for (const row of rows.academic_materials) row.file_status = options.stateBeforeUpdate;
                }
                const data = rows.academic_materials.find((row) => (
                  [...query.filters, ...query.nullFilters].every(([key, value]) => row[key] === value)
                ));
                if (data) Object.assign(data, changes);
                return { data: data ? { id: data.id } : null, error: null };
              },
            };
            return builder;
          },
        };
      }
      assert.ok(table in rows, `Unexpected table: ${table}`);
      const query = { table, columns: null, filters: [] };
      calls.queries.push(query);
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        async maybeSingle() {
          if (options.queryThrow === table) throw new Error("PRIVATE_QUERY_DETAIL");
          if (options.queryError === table) return { data: null, error: { code: "42501", message: "PRIVATE_RLS_DETAIL" } };
          const data = rows[table].find((row) => query.filters.every(([key, value]) => row[key] === value));
          return { data: data ? { id: data.id } : null, error: null };
        },
      };
      return builder;
    },
  };
  const cache = new Map();
  function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    assert.ok(filename.startsWith(path.join(root, "src") + path.sep));
    if (cache.has(filename)) return cache.get(filename).exports;
    const runtimeModule = { exports: {} };
    cache.set(filename, runtimeModule);
    const source = readFileSync(filename, "utf8");
    const compiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    function requireMock(specifier) {
      if (specifier === "server-only") return {};
      if (specifier === "node:crypto") return { randomUUID() { calls.uuid++; return randomUUID(); } };
      if (specifier === "@/lib/supabase/server") return {
        async createClient() {
          calls.client++;
          if (options.clientThrow) throw new Error("PRIVATE_CONFIGURATION_DETAIL");
          return client;
        },
      };
      if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`);
      if (specifier.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)));
      throw new Error(`Unexpected runtime dependency: ${specifier}`);
    }
    const execute = runInThisContext(`(function(require, module, exports) {\n${compiled}\n})`, { filename });
    execute(requireMock, runtimeModule, runtimeModule.exports);
    return runtimeModule.exports;
  }
  return {
    calls,
    rows,
    prepare: load(actionPath).prepareMaterialUpload,
    report: load(actionPath).reportMaterialUploadFailure,
    validate: load(validationPath).validatePrepareMaterialUploadInput,
    validateReport: load(validationPath).validateReportMaterialUploadFailureInput,
  };
}

const validationCases = [
  ["valid metadata", {}, true],
  ["invalid subject UUID", { subjectId: "invalid" }, false],
  ["invalid optional class UUID", { classSessionId: "invalid" }, false],
  ["null optional class", { classSessionId: null }, true],
  ["valid optional class", { classSessionId }, true],
  ["empty title", { title: "   " }, false],
  ["title at 200 characters", { title: "x".repeat(200) }, true],
  ["title over 200 characters", { title: "x".repeat(201) }, false],
  ["Unicode title at 200 code points", { title: "📚".repeat(200) }, true],
  ["Unicode title over 200 code points", { title: "📚".repeat(201) }, false],
  ["empty filename", { originalFilename: "   " }, false],
  ["filename at 255 characters", { originalFilename: "x".repeat(251) + ".pdf" }, true],
  ["filename over 255 characters", { originalFilename: "x".repeat(252) + ".pdf" }, false],
  ["filename with slash", { originalFilename: "folder/file.pdf" }, false],
  ["filename with backslash", { originalFilename: "folder\\file.pdf" }, false],
  ["filename with control character", { originalFilename: "file\u0000.pdf" }, false],
  ["filename with Unicode control character", { originalFilename: "file\u0085.pdf" }, false],
  ["filename with surrounding newline", { originalFilename: "\nfile.pdf" }, false],
  ["non-PDF extension", { originalFilename: "file.txt" }, false],
  ["PDF extension is final", { originalFilename: "file.pdf.exe" }, false],
  ["uppercase PDF extension", { originalFilename: "file.PDF" }, true],
  ["wrong MIME", { mimeType: "text/plain" }, false],
  ["empty MIME", { mimeType: "" }, false],
  ["zero size", { sizeBytes: 0 }, false],
  ["one byte", { sizeBytes: 1 }, true],
  ["exactly 6 MiB", { sizeBytes: 6291456 }, true],
  ["over 6 MiB", { sizeBytes: 6291457 }, false],
  ["negative size", { sizeBytes: -1 }, false],
  ["decimal size", { sizeBytes: 1.5 }, false],
  ["NaN size", { sizeBytes: NaN }, false],
  ["infinite size", { sizeBytes: Infinity }, false],
  ["negative infinite size", { sizeBytes: -Infinity }, false],
  ["unsafe integer", { sizeBytes: Number.MAX_SAFE_INTEGER + 1 }, false],
  ["string size", { sizeBytes: "1024" }, false],
  ["unexpected field", { unexpected: "value" }, false],
  ["browser-supplied owner", { user_id: otherUserId }, false],
  ["browser-supplied path", { storagePath: "arbitrary/source.pdf" }, false],
  ["browser-supplied material UUID", { materialId: randomUUID() }, false],
  ["browser-supplied status", { file_status: "ready" }, false],
  ["browser-supplied bucket", { bucket: "other" }, false],
  ["nested title", { title: { text: "title" } }, false],
];
const validationHarness = createHarness();
for (const [name, changes, accepted] of validationCases) {
  test(`validation: ${name}`, () => {
    const result = validationHarness.validate({ ...validInput, ...changes });
    assert.equal(result !== null, accepted);
    if (result) assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  });
}

test("validation: trims display fields and normalizes UUIDs", () => {
  const result = validationHarness.validate({
    ...validInput, subjectId: subjectId.toUpperCase(), classSessionId: classSessionId.toUpperCase(),
    title: "  PDF fictício  ", originalFilename: "  exemplo.PDF  ",
  });
  assert.deepEqual(result, { ...validInput, classSessionId, title: "PDF fictício", originalFilename: "exemplo.PDF" });
});

test("validation: rejects non-record inputs", () => {
  for (const value of [null, undefined, [], "metadata", new Date(), new FormData()]) {
    assert.equal(validationHarness.validate(value), null);
  }
});

test("validation: rejects missing fields, symbols, inherited fields and accessors", () => {
  for (const key of ["subjectId", "title", "originalFilename", "mimeType", "sizeBytes"]) {
    const value = { ...validInput };
    delete value[key];
    assert.equal(validationHarness.validate(value), null);
  }
  assert.equal(validationHarness.validate({ ...validInput, [Symbol("extra")]: true }), null);
  assert.equal(validationHarness.validate(Object.create(validInput)), null);
  const value = { ...validInput };
  Object.defineProperty(value, "title", { get() { throw new Error("Accessor must not execute"); } });
  assert.equal(validationHarness.validate(value), null);
});

test("prepare: rejects invalid input before creating the SSR client", async () => {
  const harness = createHarness();
  const result = await harness.prepare({ ...validInput, user_id: otherUserId });
  assert.equal(result.code, "INVALID_INPUT");
  assert.equal(harness.calls.client, 0);
  assert.equal(harness.calls.inserts.length, 0);
});

test("prepare: server generates the canonical path and writes only pending metadata", async () => {
  const harness = createHarness();
  const result = await harness.prepare(validInput);
  assert.equal(result.ok, true);
  assert.match(result.materialId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(Object.keys(result).sort(), ["fileStatus", "materialId", "ok", "storagePath"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(harness.calls.inserts, [{
    id: result.materialId, user_id: userId, subject_id: subjectId, class_session_id: null,
    title: validInput.title, original_filename: validInput.originalFilename,
    storage_path: `${userId}/${subjectId}/${result.materialId}/source.pdf`,
    mime_type: "application/pdf", size_bytes: validInput.sizeBytes,
    file_status: "pending_upload", deleted_at: null,
  }]);
  assert.equal(result.storagePath, harness.calls.inserts[0].storage_path);
  assert.equal(result.fileStatus, "pending_upload");
  assert.equal(harness.calls.uuid, 1);
  assert.deepEqual(harness.calls.queries, [{ table: "subjects", columns: "id", filters: [["id", subjectId], ["user_id", userId]] }]);
});

test("prepare: optional class is scoped by owner and subject", async () => {
  const harness = createHarness();
  const result = await harness.prepare({ ...validInput, classSessionId });
  assert.equal(result.ok, true);
  assert.equal(harness.calls.inserts[0].class_session_id, classSessionId);
  assert.deepEqual(harness.calls.queries[1], {
    table: "class_sessions", columns: "id", filters: [["id", classSessionId], ["subject_id", subjectId], ["user_id", userId]],
  });
});

test("prepare: missing and foreign subjects have identical public failures", async () => {
  const missing = createHarness({ subjects: [] });
  const foreign = createHarness({ subjects: [{ id: subjectId, user_id: otherUserId }] });
  const missingResult = await missing.prepare(validInput);
  assert.deepEqual(await foreign.prepare(validInput), missingResult);
  assert.equal(missingResult.code, "RESOURCE_UNAVAILABLE");
  for (const harness of [missing, foreign]) {
    assert.equal(harness.calls.uuid, 0);
    assert.equal(harness.calls.inserts.length, 0);
  }
});

for (const [name, classes] of [
  ["missing class", []],
  ["foreign class", [{ id: classSessionId, subject_id: subjectId, user_id: otherUserId }]],
  ["class from another subject", [{ id: classSessionId, subject_id: otherSubjectId, user_id: userId }]],
]) {
  test(`prepare: denies ${name}`, async () => {
    const harness = createHarness({ classes });
    const result = await harness.prepare({ ...validInput, classSessionId });
    assert.equal(result.code, "RESOURCE_UNAVAILABLE");
    assert.equal(harness.calls.uuid, 0);
    assert.equal(harness.calls.inserts.length, 0);
  });
}

for (const [name, claims, code] of [
  ["absent claims without error", { data: null, error: null }, "AUTH_REQUIRED"],
  ["missing owner without error", { data: { claims: {} }, error: null }, "AUTH_REQUIRED"],
  ["invalid owner UUID without error", { data: { claims: { sub: "invalid" } }, error: null }, "AUTH_REQUIRED"],
  ["empty owner without error", { data: { claims: { sub: "" } }, error: null }, "AUTH_REQUIRED"],
  ["returned claims transport error", { data: null, error: { name: "AuthRetryableFetchError", status: 0, message: "PRIVATE_FETCH_DETAIL" } }, "PREPARE_FAILED"],
  ["returned Auth provider error", { data: null, error: { status: 503, code: "PRIVATE_PROVIDER_CODE", message: "PRIVATE_PROVIDER_DETAIL" } }, "PREPARE_FAILED"],
  ["error despite valid claims", { data: { claims: { sub: userId } }, error: { message: "PRIVATE_JWT_DETAIL" } }, "PREPARE_FAILED"],
]) {
  test(`prepare: fails closed for ${name}`, async () => {
    const harness = createHarness({ claims });
    const result = await harness.prepare(validInput);
    assert.deepEqual(result, {
      ok: false,
      code,
      message: code === "AUTH_REQUIRED"
        ? "Sua sessão não está disponível. Entre novamente."
        : "Não foi possível confirmar a preparação do material. Não repita automaticamente.",
    });
    assert.equal(harness.calls.claims, 1);
    assert.equal(harness.calls.uuid, 0);
    assert.equal(harness.calls.queries.length, 0);
    assert.equal(harness.calls.inserts.length, 0);
    assert.deepEqual(Object.keys(result).sort(), ["code", "message", "ok"]);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  });
}

for (const [name, options] of [
  ["client failure", { clientThrow: true }],
  ["claims transport failure", { claimsThrow: true }],
  ["subject query error", { queryError: "subjects" }],
  ["class query error", { queryError: "class_sessions" }],
  ["query transport failure", { queryThrow: "subjects" }],
  ["INSERT FK rejection", { insertError: { code: "23503", message: "PRIVATE_FK_DETAIL" } }],
  ["INSERT transport failure", { insertThrow: true }],
]) {
  test(`prepare: sanitizes ${name}`, async () => {
    const harness = createHarness(options);
    const result = await harness.prepare({ ...validInput, classSessionId });
    assert.equal(result.ok, false);
    assert.equal(result.code, "PREPARE_FAILED");
    assert.deepEqual(Object.keys(result).sort(), ["code", "message", "ok"]);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    assert.ok(!JSON.stringify(result).includes(validInput.originalFilename));
  });
}

test("prepare: repeated requests generate different IDs and never overwrite metadata", async () => {
  const harness = createHarness();
  const first = await harness.prepare(validInput);
  const second = await harness.prepare(validInput);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.materialId, second.materialId);
  assert.ok(harness.calls.inserts.every((row) => row.file_status === "pending_upload" && row.deleted_at === null));
});

const validReport = { materialId, failureCategory: "mime_rejected" };
for (const category of ["mime_rejected", "size_rejected", "access_denied", "validation_rejected"]) {
  test(`report validation: accepts only known category ${category}`, () => {
    assert.deepEqual(validationHarness.validateReport({ materialId, failureCategory: category }), {
      materialId, failureCategory: category,
    });
  });
}

for (const [name, changes] of [
  ["invalid UUID", { materialId: "invalid" }],
  ["missing UUID", { materialId: undefined }],
  ["unknown category", { failureCategory: "fetch_failed" }],
  ["missing category", { failureCategory: undefined }],
  ["numeric category", { failureCategory: 403 }],
  ["owner field", { user_id: otherUserId }],
  ["path field", { storagePath: "arbitrary/source.pdf" }],
  ["raw error field", { error: { message: "PRIVATE_STORAGE_ERROR" } }],
  ["status field", { file_status: "ready" }],
]) {
  test(`report validation: rejects ${name}`, () => {
    assert.equal(validationHarness.validateReport({ ...validReport, ...changes }), null);
  });
}

test("report validation: normalizes UUID and reconstructs only the allowed fields", () => {
  assert.deepEqual(validationHarness.validateReport({ ...validReport, materialId: materialId.toUpperCase() }), validReport);
  const value = Object.assign(Object.create(null), validReport);
  assert.deepEqual(validationHarness.validateReport(value), validReport);
});

test("report validation: rejects non-records, symbols, inherited properties and accessors", () => {
  for (const value of [null, undefined, [], "report", new Date(), new FormData(), Object.create(validReport)]) {
    assert.equal(validationHarness.validateReport(value), null);
  }
  assert.equal(validationHarness.validateReport({ ...validReport, [Symbol("extra")]: true }), null);
  const value = { ...validReport };
  Object.defineProperty(value, "failureCategory", { get() { throw new Error("Accessor must not execute"); } });
  assert.equal(validationHarness.validateReport(value), null);
});

test("report: rejects invalid input before authentication or any write", async () => {
  const harness = createHarness();
  const result = await harness.report({ ...validReport, user_id: otherUserId });
  assert.equal(result.code, "INVALID_INPUT");
  assert.equal(harness.calls.client, 0);
  assert.equal(harness.calls.updates.length, 0);
});

test("report: authenticates again and atomically changes only the owner's pending material", async () => {
  const harness = createHarness();
  const result = await harness.report(validReport);
  assert.deepEqual(result, { ok: true, fileStatus: "upload_failed" });
  assert.equal(harness.calls.client, 1);
  assert.equal(harness.calls.claims, 1);
  assert.equal(harness.calls.queries.length, 0);
  assert.equal(harness.calls.inserts.length, 0);
  assert.deepEqual(harness.calls.updates, [{
    changes: { file_status: "upload_failed" }, columns: "id",
    filters: [["id", materialId], ["user_id", userId], ["file_status", "pending_upload"]],
    nullFilters: [["deleted_at", null]],
  }]);
  assert.deepEqual(harness.rows.academic_materials, [{
    id: materialId, user_id: userId, file_status: "upload_failed", deleted_at: null,
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

for (const [name, materials] of [
  ["missing material", []],
  ["foreign material", [{ id: materialId, user_id: otherUserId, file_status: "pending_upload", deleted_at: null }]],
  ["another material", [{ id: randomUUID(), user_id: userId, file_status: "pending_upload", deleted_at: null }]],
  ["non-null deleted_at", [{ id: materialId, user_id: userId, file_status: "pending_upload", deleted_at: "2026-10-02T12:00:00Z" }]],
  ...["upload_failed", "validating", "ready", "deleting", "deleted"].map((state) => [
    `later state ${state}`, [{ id: materialId, user_id: userId, file_status: state, deleted_at: null }],
  ]),
]) {
  test(`report: denies ${name} without claiming success`, async () => {
    const harness = createHarness({ materials });
    const before = structuredClone(harness.rows.academic_materials);
    const result = await harness.report(validReport);
    assert.equal(result.ok, false);
    assert.equal(result.code, "RESOURCE_UNAVAILABLE");
    assert.deepEqual(harness.rows.academic_materials, before);
    assert.equal(harness.calls.updates.length, 1);
  });
}

test("report: late failure cannot overwrite a state that changed immediately before UPDATE", async () => {
  const harness = createHarness({ stateBeforeUpdate: "validating" });
  const result = await harness.report(validReport);
  assert.equal(result.code, "RESOURCE_UNAVAILABLE");
  assert.equal(harness.rows.academic_materials[0].file_status, "validating");
  assert.equal(harness.calls.queries.length, 0);
});

test("report: repeated report is not successful after the transition already happened", async () => {
  const harness = createHarness();
  assert.equal((await harness.report(validReport)).ok, true);
  assert.equal((await harness.report(validReport)).code, "RESOURCE_UNAVAILABLE");
  assert.equal(harness.rows.academic_materials[0].file_status, "upload_failed");
});

for (const [name, claims, code] of [
  ["absent claims", { data: null, error: null }, "AUTH_REQUIRED"],
  ["invalid claims", { data: { claims: { sub: "invalid" } }, error: null }, "AUTH_REQUIRED"],
  ["transport error", { data: null, error: { status: 0, message: "PRIVATE_FETCH_DETAIL" } }, "REPORT_FAILED"],
  ["provider error despite claims", { data: { claims: { sub: userId } }, error: { status: 503, message: "PRIVATE_PROVIDER_DETAIL" } }, "REPORT_FAILED"],
]) {
  test(`report: fails closed for ${name}`, async () => {
    const harness = createHarness({ claims });
    const result = await harness.report(validReport);
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.equal(harness.calls.updates.length, 0);
    assert.equal(harness.calls.queries.length, 0);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  });
}

for (const [name, options] of [
  ["client error", { clientThrow: true }],
  ["claims exception", { claimsThrow: true }],
  ["UPDATE database rejection", { updateError: { code: "42501", message: "PRIVATE_DATABASE_DETAIL", details: "PRIVATE_SQL_DETAIL", hint: "PRIVATE_HINT" } }],
  ["UPDATE transport exception", { updateThrow: true }],
]) {
  test(`report: sanitizes ${name}`, async () => {
    const harness = createHarness(options);
    const result = await harness.report(validReport);
    assert.deepEqual(result, {
      ok: false, code: "REPORT_FAILED",
      message: "Não foi possível confirmar o registro da falha de envio. Não repita automaticamente.",
    });
    assert.deepEqual(Object.keys(result).sort(), ["code", "message", "ok"]);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
    assert.ok(!JSON.stringify(result).includes("PRIVATE"));
    assert.ok(!JSON.stringify(result).includes(materialId));
  });
}
