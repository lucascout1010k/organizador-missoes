import "server-only";

import { getSupabaseEnvironment } from "@/lib/supabase/env";

import { MAX_MATERIAL_SIZE_BYTES } from "./validation";

export type PdfObjectResult =
  | { kind: "found"; bytes: Uint8Array; mime: string | null }
  | { kind: "oversized" }
  | { kind: "missing" }
  | { kind: "uncertain" };

async function readBounded(response: Response, limit: number) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    reader.releaseLock();
  }
}

export async function downloadPrivatePdf(
  path: string,
  accessToken: string,
  request: typeof fetch = fetch,
): Promise<PdfObjectResult> {
  try {
    const { url, publishableKey } = getSupabaseEnvironment();
    const response = await request(
      `${url}/storage/v1/object/authenticated/academic-materials/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
      },
    );
    if (response.status === 200) {
      const bytes = await readBounded(response, MAX_MATERIAL_SIZE_BYTES);
      return bytes === null ? { kind: "oversized" } : {
        kind: "found", bytes, mime: response.headers.get("content-type"),
      };
    }
    // A generic 404, NoSuchBucket, permission/session error or transport failure
    // is not proof of absence. Require the Storage service's explicit key error.
    if (response.status === 404 || response.status === 400) {
      const bytes = await readBounded(response, 4096);
      if (bytes) {
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof body === "object" && body !== null && "code" in body
          && body.code === "NoSuchKey") return { kind: "missing" };
      }
    } else {
      await response.body?.cancel();
    }
    return { kind: "uncertain" };
  } catch {
    return { kind: "uncertain" };
  }
}
