import "server-only";
import { PDFDocument } from "pdf-lib";

export function pageWindows(pageCount: number) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 120) throw Error("Unsupported page count");
  const windows: { chunkIndex: number; pageStart: number; pageEnd: number }[] = [];
  for (let start = 1; start <= pageCount; start += 3) {
    const end = Math.min(start + 3, pageCount);
    windows.push({ chunkIndex: windows.length, pageStart: start, pageEnd: end });
    if (end === pageCount) break;
  }
  return windows;
}
export async function loadAcademicPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  pageWindows(doc.getPageCount());
  return doc;
}
export async function sliceAcademicPdf(doc: PDFDocument, pageStart: number, pageEnd: number) {
  if (!Number.isInteger(pageStart) || !Number.isInteger(pageEnd) || pageStart < 1 || pageEnd < pageStart || pageEnd > doc.getPageCount() || pageEnd - pageStart >= 12) throw Error("Invalid page range");
  const copy = await PDFDocument.create();
  const pages = await copy.copyPages(doc, Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i - 1));
  pages.forEach(page => copy.addPage(page));
  return copy.save({ useObjectStreams: true });
}
export type RetrievalHit = { material_id: string; title: string; chunk_index: number; page_start: number; page_end: number; similarity: number };
export function selectSourceRanges(hits: RetrievalHit[]) {
  const ranges: { materialId: string; title: string; pageStart: number; pageEnd: number }[] = [];
  let pages = 0;
  for (const hit of hits.slice(0, 6)) {
    if (!Number.isFinite(hit.similarity) || hit.similarity < 0.15 || hit.page_start < 1 || hit.page_end < hit.page_start || hit.page_end - hit.page_start > 3) continue;
    const overlap = ranges.filter(item => item.materialId === hit.material_id && hit.page_start <= item.pageEnd + 1 && hit.page_end >= item.pageStart - 1);
    const start = Math.min(hit.page_start, ...overlap.map(item => item.pageStart));
    const end = Math.max(hit.page_end, ...overlap.map(item => item.pageEnd));
    const extra = end - start + 1 - overlap.reduce((count, item) => count + item.pageEnd - item.pageStart + 1, 0);
    if (pages + extra > 12) continue;
    if (overlap.length) {
      overlap[0].pageStart = start; overlap[0].pageEnd = end;
      for (const duplicate of overlap.slice(1)) ranges.splice(ranges.indexOf(duplicate), 1);
    }
    else ranges.push({ materialId: hit.material_id, title: hit.title, pageStart: hit.page_start, pageEnd: hit.page_end });
    pages += extra;
  }
  return ranges.map((range, index) => ({ ...range, sourceId: `S${index + 1}` }));
}
