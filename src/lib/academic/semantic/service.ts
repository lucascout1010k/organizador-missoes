import "server-only";
import { getAuthenticatedMaterialsClient } from "../materials/data";
import { downloadPrivatePdf } from "../materials/pdf-object";
import { settleSemanticIndex, finishSemanticQuestion } from "../materials/validator";
import { getSubjectAcademicMemory } from "../subject-memory";
import { indexInputSchema, questionInputSchema, validateAnswer, validateEmbedding, type SemanticAnswer, type SemanticResult, type SemanticStatus, type SemanticFailure } from "./contracts";
import { loadAcademicPdf, pageWindows, sliceAcademicPdf, selectSourceRanges, type RetrievalHit } from "./pdf";
import { embedAcademicContent, answerAcademicQuestion, SemanticError } from "./provider";

const defaults = { authenticate: getAuthenticatedMaterialsClient, download: downloadPrivatePdf, settle: settleSemanticIndex, finish: finishSemanticQuestion, embed: embedAcademicContent, answer: answerAcademicQuestion, memory: getSubjectAcademicMemory };
type Dependencies = typeof defaults;
type Context = Extract<Awaited<ReturnType<typeof getAuthenticatedMaterialsClient>>, { ok: true }>;
const failure = (code: SemanticFailure, message = "Não foi possível concluir agora. Tente novamente em instantes.") => ({ ok: false as const, code, message });

export async function getSubjectSemanticStatus(subjectId: string, context?: Context): Promise<SemanticStatus[]> {
  const ctx = context ?? await getAuthenticatedMaterialsClient();
  if (!ctx.ok) throw new SemanticError("material_unavailable");
  const rows = await ctx.supabase.rpc("subject_semantic_status", { p_subject_id: subjectId });
  if (rows.error || !Array.isArray(rows.data)) throw new SemanticError("retrieval_failed");
  return rows.data.map(row => ({ materialId: row.material_id, status: row.status, pageCount: row.page_count }));
}
async function readyMaterial(ctx: Context, materialId: string, subjectId?: string) {
  let query = ctx.supabase.from("academic_materials").select("id,user_id,subject_id,storage_path,file_status,deleted_at,mime_type,size_bytes")
    .eq("id", materialId).eq("user_id", ctx.userId).eq("file_status", "ready").is("deleted_at", null);
  if (subjectId) query = query.eq("subject_id", subjectId);
  const result = await query.maybeSingle();
  const row = result.data;
  if (result.error || !row || row.storage_path !== `${ctx.userId}/${row.subject_id}/${row.id}/source.pdf`) throw new SemanticError("material_unavailable");
  return row;
}
async function pdfForMaterial(ctx: Context, materialId: string, download: Dependencies["download"], subjectId?: string) {
  const material = await readyMaterial(ctx, materialId, subjectId);
  const session = await ctx.supabase.auth.getSession();
  if (session.error || session.data.session?.user.id !== ctx.userId || !session.data.session?.access_token) throw new SemanticError("material_unavailable");
  const object = await download(material.storage_path, session.data.session.access_token);
  if (object.kind !== "found" || object.bytes.length !== material.size_bytes || object.bytes.length > 6291456 || object.bytes.length < 5
    || object.mime?.split(";", 1)[0].trim().toLowerCase() !== "application/pdf" || ![37,80,68,70,45].every((value, i) => object.bytes[i] === value)) throw new SemanticError("material_unavailable");
  await readyMaterial(ctx, materialId, subjectId);
  return loadAcademicPdf(object.bytes);
}

export async function indexOwnedAcademicMaterial(input: unknown, deps: Dependencies = defaults): Promise<SemanticResult<{ status: "ready" | "indexing" }>> {
  const parsed = indexInputSchema.safeParse(input);
  if (!parsed.success) return failure("material_unavailable", "Confirme a inclusão deste material na memória pesquisável.");
  const materialId = parsed.data.materialId.toLowerCase();
  let authorization: { generation: number; token: string } | undefined;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 540_000);
  try {
    const ctx = await deps.authenticate();
    if (!ctx.ok) return failure("material_unavailable", "Entre novamente para continuar.");
    await readyMaterial(ctx, materialId);
    const requested = await ctx.supabase.rpc("request_material_semantic_index", { p_material_id: materialId, p_consent: true }).maybeSingle();
    const decision = requested.data as { decision?: unknown; generation?: unknown; completion_token?: unknown } | null;
    if (requested.error || !decision) throw new SemanticError("index_failed");
    if (decision.decision === "ready" || decision.decision === "indexing") return { ok: true, value: { status: decision.decision } };
    if (decision.decision !== "issued" || typeof decision.generation !== "number" || !Number.isSafeInteger(decision.generation) || decision.generation < 1 || typeof decision.completion_token !== "string" || !/^[0-9a-f]{64}$/.test(decision.completion_token)) throw new SemanticError("index_failed");
    authorization = { generation: decision.generation, token: decision.completion_token };
    const pdf = await pdfForMaterial(ctx, materialId, deps.download);
    const chunks = [];
    for (const window of pageWindows(pdf.getPageCount())) {
      if (controller.signal.aborted) throw new SemanticError("index_failed");
      const bytes = await sliceAcademicPdf(pdf, window.pageStart, window.pageEnd);
      const embedding = validateEmbedding(await deps.embed({ pdf: bytes }, controller.signal));
      chunks.push({ ...window, embedding });
    }
    await readyMaterial(ctx, materialId);
    await deps.settle(materialId, authorization.generation, authorization.token, { pageCount: pdf.getPageCount(), chunks });
    return { ok: true, value: { status: "ready" } };
  } catch (error) {
    if (authorization) try { await deps.settle(materialId, authorization.generation, authorization.token); } catch { /* Lease expires for an explicit retry. */ }
    return failure(error instanceof SemanticError ? error.code : "index_failed");
  } finally { clearTimeout(timer); }
}

export async function askOwnedSubject(input: unknown, deps: Dependencies = defaults): Promise<SemanticResult<SemanticAnswer>> {
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) return failure("material_unavailable", "Escreva uma pergunta de até 600 caracteres.");
  const { question } = parsed.data, subjectId = parsed.data.subjectId.toLowerCase();
  let gate: string | undefined;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 100_000);
  try {
    const ctx = await deps.authenticate();
    if (!ctx.ok) return failure("material_unavailable", "Entre novamente para perguntar.");
    const subject = await ctx.supabase.from("subjects").select("id").eq("id", subjectId).eq("user_id", ctx.userId).maybeSingle();
    if (subject.error || !subject.data) throw new SemanticError("material_unavailable");
    const [statuses, memory] = await Promise.all([getSubjectSemanticStatus(subjectId, ctx), deps.memory(subjectId, async () => ctx)]);
    const indexed = statuses.filter(item => item.status === "ready");
    const coverage = { indexed: indexed.length, total: memory.stats.materials, consulted: 0 };
    const notFound = (): SemanticResult<SemanticAnswer> => ({ ok: true, value: { status: "not_found", answer: `Não encontrei esse assunto nos materiais que fazem parte da memória pesquisável de ${memory.subject.name}.`, sources: [], limitations: ["A resposta não determina se o tema foi abordado fora dos materiais pesquisáveis."], coverage } });
    if (!indexed.length) return notFound();
    const requested = await ctx.supabase.rpc("request_semantic_question", { p_subject_id: subjectId });
    if (requested.error || typeof requested.data !== "string" || !/^[0-9a-f]{64}$/.test(requested.data)) return failure("retrieval_failed", "Já há uma pergunta em andamento. Aguarde alguns instantes.");
    gate = requested.data;
    const embedding = validateEmbedding(await deps.embed({ question }, controller.signal));
    const matched = await ctx.supabase.rpc("match_subject_semantic_chunks", { p_subject_id: subjectId, p_query_embedding: JSON.stringify(embedding), p_match_count: 6 });
    if (matched.error || !Array.isArray(matched.data)) throw new SemanticError("retrieval_failed");
    const sources = selectSourceRanges(matched.data as RetrievalHit[]);
    if (!sources.length) return notFound();
    const documents = new Map<string, Awaited<ReturnType<typeof loadAcademicPdf>>>();
    const context = [];
    for (const source of sources) {
      if (controller.signal.aborted) throw new SemanticError("answer_timeout");
      if (!indexed.some(item => item.materialId === source.materialId)) throw new SemanticError("retrieval_failed");
      let pdf = documents.get(source.materialId);
      if (!pdf) { pdf = await pdfForMaterial(ctx, source.materialId, deps.download, subjectId); documents.set(source.materialId, pdf); }
      context.push({ ...source, bytes: await sliceAcademicPdf(pdf, source.pageStart, source.pageEnd) });
    }
    coverage.consulted = documents.size;
    const summary = JSON.stringify({ subject: memory.subject.name, analyzed: memory.stats.analyzed, materials: memory.stats.materials, topics: memory.studiedTopics.slice(0, 120), keywords: memory.keywords.slice(0, 40), summaries: memory.studiedSummaries, latest: memory.latestAnalyzedMaterial });
    if (controller.signal.aborted) throw new SemanticError("answer_timeout");
    const raw = await deps.answer(question, summary, context, controller.signal);
    let answer;
    try { answer = validateAnswer(raw, sources); } catch { throw new SemanticError("invalid_answer"); }
    const current = await getSubjectSemanticStatus(subjectId, ctx);
    if (sources.some(source => !current.some(item => item.materialId === source.materialId && item.status === "ready"))) throw new SemanticError("material_unavailable");
    return { ok: true, value: { ...answer, coverage } };
  } catch (error) { return failure(error instanceof SemanticError ? error.code : "retrieval_failed"); }
  finally { clearTimeout(timer); if (gate) try { await deps.finish(subjectId, gate); } catch { /* Bounded lease recovers without another provider call here. */ } }
}
