import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Check = { test: string; passed: boolean; code?: string };
type Fixture = { table: string; id: string };

/**
 * Integration checks for Etapa 2D.1.
 * Invoke explicitly only after the migration is applied and with an authenticated
 * publishable-key client plus an anonymous client from the same project.
 * This helper never uploads or deletes Storage objects.
 */
export async function verifyMaterialsFoundation(
  client: SupabaseClient,
  anonymous: SupabaseClient,
) {
  const checks: Check[] = [];
  const fixtures: Fixture[] = [];
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    return { passed: false, checks: [{ test: "authenticated", passed: false }] };
  }

  const owner = auth.user.id;
  const otherOwner = randomUUID();
  const remember = (table: string, id = randomUUID()) => {
    fixtures.push({ table, id });
    return id;
  };
  const check = (test: string, passed: boolean, code?: string) => {
    checks.push({ test, passed, ...(code && /^[A-Z0-9_]+$/.test(code) ? { code } : {}) });
    if (!passed) throw new Error("Verification stopped");
  };
  const expectCode = (test: string, actual: string | undefined, expected: string) =>
    check(test, actual === expected, actual);
  const materialPath = (subjectId: string, materialId: string) =>
    `${owner}/${subjectId}/${materialId}/source.pdf`;

  const courseId = remember("academic_courses");
  const periodId = remember("academic_periods");
  const subjectAId = remember("subjects");
  const subjectBId = remember("subjects");
  const classAId = remember("class_sessions");
  const classBId = remember("class_sessions");
  const materialWithClassId = remember("academic_materials");
  const materialWithoutClassId = remember("academic_materials");
  const processingAnalysisId = remember("academic_material_analyses");
  const completedAnalysisId = remember("academic_material_analyses");
  const secondCompletedAnalysisId = remember("academic_material_analyses");
  const otherMaterialProcessingId = remember("academic_material_analyses");

  try {
    const course = await client.from("academic_courses").insert({
      id: courseId,
      name: "Curso Teste Materiais",
    });
    check("setup: course", !course.error, course.error?.code);

    const period = await client.from("academic_periods").insert({
      course_id: courseId,
      id: periodId,
      name: "Periodo Teste Materiais",
    });
    check("setup: period", !period.error, period.error?.code);

    const subjects = await client.from("subjects").insert([
      { id: subjectAId, name: "Materia A Teste", period_id: periodId },
      { id: subjectBId, name: "Materia B Teste", period_id: periodId },
    ]);
    check("setup: subjects", !subjects.error, subjects.error?.code);

    const classes = await client.from("class_sessions").insert([
      {
        class_date: "2030-01-10T12:00:00Z",
        id: classAId,
        subject_id: subjectAId,
        title: "Aula A Teste",
      },
      {
        class_date: "2030-01-11T12:00:00Z",
        id: classBId,
        subject_id: subjectBId,
        title: "Aula B Teste",
      },
    ]);
    check("setup: classes", !classes.error, classes.error?.code);

    const materialWithClass = await client
      .from("academic_materials")
      .insert({
        class_session_id: classAId,
        id: materialWithClassId,
        mime_type: "application/pdf",
        original_filename: "material-a.pdf",
        size_bytes: 1024,
        storage_path: materialPath(subjectAId, materialWithClassId),
        subject_id: subjectAId,
        title: "Material com aula",
      })
      .select("id,user_id,class_session_id,file_status")
      .single();
    check(
      "academic_materials: own subject and matching class",
      !materialWithClass.error &&
        materialWithClass.data?.user_id === owner &&
        materialWithClass.data?.class_session_id === classAId &&
        materialWithClass.data?.file_status === "pending_upload",
      materialWithClass.error?.code,
    );

    const materialWithoutClass = await client
      .from("academic_materials")
      .insert({
        id: materialWithoutClassId,
        mime_type: "application/pdf",
        original_filename: "material-sem-aula.pdf",
        size_bytes: 2048,
        storage_path: materialPath(subjectAId, materialWithoutClassId),
        subject_id: subjectAId,
        title: "Material sem aula",
      })
      .select("id,class_session_id")
      .single();
    check(
      "academic_materials: optional class omitted",
      !materialWithoutClass.error && materialWithoutClass.data?.class_session_id === null,
      materialWithoutClass.error?.code,
    );

    const wrongOwnerMaterialId = remember("academic_materials");
    const wrongOwnerMaterial = await client.from("academic_materials").insert({
      id: wrongOwnerMaterialId,
      mime_type: "application/pdf",
      original_filename: "outro-usuario.pdf",
      size_bytes: 100,
      storage_path: `${otherOwner}/${subjectAId}/${wrongOwnerMaterialId}/source.pdf`,
      subject_id: subjectAId,
      title: "Proprietario divergente",
      user_id: otherOwner,
    });
    expectCode(
      "academic_materials: foreign owner rejected by RLS",
      wrongOwnerMaterial.error?.code,
      "42501",
    );

    const mismatchedClassId = remember("academic_materials");
    const mismatchedClass = await client.from("academic_materials").insert({
      class_session_id: classBId,
      id: mismatchedClassId,
      mime_type: "application/pdf",
      original_filename: "aula-incorreta.pdf",
      size_bytes: 100,
      storage_path: materialPath(subjectAId, mismatchedClassId),
      subject_id: subjectAId,
      title: "Aula de outra materia",
    });
    expectCode(
      "academic_materials: class from another subject rejected",
      mismatchedClass.error?.code,
      "23503",
    );

    for (const [label, overrides] of [
      ["size zero", { size_bytes: 0 }],
      ["size above 6 MiB", { size_bytes: 6291457 }],
      ["non-PDF MIME", { mime_type: "text/plain" }],
      ["invalid status", { file_status: "unknown" }],
    ] as const) {
      const id = remember("academic_materials");
      const result = await client.from("academic_materials").insert({
        id,
        mime_type: "application/pdf",
        original_filename: "invalido.pdf",
        size_bytes: 100,
        storage_path: materialPath(subjectAId, id),
        subject_id: subjectAId,
        title: "Material invalido",
        ...overrides,
      });
      expectCode(`academic_materials: ${label}`, result.error?.code, "23514");
    }

    const duplicatePath = await client
      .from("academic_materials")
      .update({ storage_path: materialPath(subjectAId, materialWithClassId) })
      .eq("id", materialWithoutClassId)
      .eq("user_id", owner);
    expectCode(
      "academic_materials: duplicate/noncanonical path rejected",
      duplicatePath.error?.code,
      "23514",
    );

    const prematureHardDelete = await client
      .from("academic_materials")
      .delete()
      .eq("id", materialWithoutClassId)
      .eq("user_id", owner)
      .select("id");
    check(
      "academic_materials: hard delete denied before deleted state",
      !prematureHardDelete.error && prematureHardDelete.data?.length === 0,
      prematureHardDelete.error?.code,
    );

    const processing = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:00Z",
      id: processingAnalysisId,
      material_id: materialWithClassId,
      model: "model-test",
      provider: "provider-test",
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
    });
    check("academic_material_analyses: own material", !processing.error, processing.error?.code);

    const concurrentAnalysisId = remember("academic_material_analyses");
    const concurrent = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:00Z",
      id: concurrentAnalysisId,
      material_id: materialWithClassId,
      model: "model-test",
      provider: "provider-test",
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
    });
    expectCode(
      "academic_material_analyses: concurrent processing rejected",
      concurrent.error?.code,
      "23505",
    );

    const failed = await client
      .from("academic_material_analyses")
      .update({ completed_at: "2030-01-12T12:01:00Z", error_code: "PROVIDER_ERROR", status: "failed" })
      .eq("id", processingAnalysisId)
      .eq("user_id", owner);
    check("academic_material_analyses: processing may become failed", !failed.error, failed.error?.code);

    for (const [id, completedAt] of [
      [completedAnalysisId, "2030-01-12T12:02:00Z"],
      [secondCompletedAnalysisId, "2030-01-12T12:03:00Z"],
    ] as const) {
      const historical = await client.from("academic_material_analyses").insert({
        completed_at: completedAt,
        consent_version: "v1",
        consented_at: "2030-01-12T12:00:00Z",
        id,
        material_id: materialWithClassId,
        model: "model-test",
        provider: "provider-test",
        result: { summary: "Resultado ficticio" },
        schema_version: 1,
        started_at: "2030-01-12T12:01:00Z",
        status: "completed",
      });
      check("academic_material_analyses: historical completed attempt", !historical.error, historical.error?.code);
    }

    const otherMaterialProcessing = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:00Z",
      id: otherMaterialProcessingId,
      material_id: materialWithoutClassId,
      model: "model-test",
      provider: "provider-test",
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
    });
    check(
      "academic_material_analyses: processing allowed for another material",
      !otherMaterialProcessing.error,
      otherMaterialProcessing.error?.code,
    );

    const mismatchedResultId = remember("academic_material_analyses");
    const mismatchedResult = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:00Z",
      id: mismatchedResultId,
      material_id: materialWithClassId,
      model: "model-test",
      provider: "provider-test",
      result: { invalid: true },
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
    });
    expectCode(
      "academic_material_analyses: result incompatible with processing",
      mismatchedResult.error?.code,
      "23514",
    );

    const invalidConsentTimelineId = remember("academic_material_analyses");
    const invalidConsentTimeline = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:02Z",
      id: invalidConsentTimelineId,
      material_id: materialWithClassId,
      model: "model-test",
      provider: "provider-test",
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
    });
    expectCode(
      "academic_material_analyses: consent after start rejected",
      invalidConsentTimeline.error?.code,
      "23514",
    );

    const foreignAnalysisId = remember("academic_material_analyses");
    const foreignAnalysis = await client.from("academic_material_analyses").insert({
      consent_version: "v1",
      consented_at: "2030-01-12T12:00:00Z",
      id: foreignAnalysisId,
      material_id: materialWithClassId,
      model: "model-test",
      provider: "provider-test",
      schema_version: 1,
      started_at: "2030-01-12T12:00:01Z",
      status: "processing",
      user_id: otherOwner,
    });
    expectCode(
      "academic_material_analyses: foreign owner rejected by RLS",
      foreignAnalysis.error?.code,
      "42501",
    );

    for (const table of ["academic_materials", "academic_material_analyses"] as const) {
      const anonSelect = await anonymous.from(table).select("id").limit(1);
      expectCode(`${table}: anonymous SELECT denied`, anonSelect.error?.code, "42501");
      const anonDelete = await anonymous.from(table).delete().eq("id", randomUUID());
      expectCode(`${table}: anonymous DELETE denied`, anonDelete.error?.code, "42501");
    }
  } catch {
    if (checks.every((item) => item.passed)) {
      checks.push({ test: "transport/runtime", passed: false });
    }
  } finally {
    const cleanupOrder = [
      "academic_material_analyses",
      "academic_materials",
      "class_sessions",
      "subjects",
      "academic_periods",
      "academic_courses",
    ];

    for (const table of cleanupOrder) {
      const ids = fixtures.filter((fixture) => fixture.table === table).map((fixture) => fixture.id);
      if (ids.length === 0) continue;
      try {
        if (table === "academic_materials") {
          const deletedAt = new Date().toISOString();
          const transitioned = await client
            .from(table)
            .update({ deleted_at: deletedAt, file_status: "deleted" })
            .in("id", ids)
            .eq("user_id", owner)
            .select("id");
          const transitionedIds = new Set(transitioned.data?.map((row) => row.id) ?? []);
          checks.push({
            test: `${table}: cleanup transition to deleted`,
            passed:
              !transitioned.error &&
              transitionedIds.has(materialWithClassId) &&
              transitionedIds.has(materialWithoutClassId),
            ...(transitioned.error?.code ? { code: transitioned.error.code } : {}),
          });
        }

        const removed = await client
          .from(table)
          .delete()
          .in("id", ids)
          .eq("user_id", owner)
          .select("id");
        checks.push({
          test: `${table}: cleanup`,
          passed: !removed.error,
          ...(removed.error?.code ? { code: removed.error.code } : {}),
        });
      } catch {
        checks.push({ test: `${table}: cleanup transport failure`, passed: false });
      }
    }
  }

  return { passed: checks.every((item) => item.passed), checks };
}
