import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = process.cwd();
const user = "11111111-1111-4111-8111-111111111111";
const subject = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function load(relative) {
  const runtimeModule = { exports: {} }, filename = path.join(root, relative);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const require = name => {
    if (name === "server-only") return {};
    if (name === "./data") return { getAuthenticatedMaterialsClient() { throw Error("Real auth forbidden"); } };
    if (name === "../validation") return load("src/lib/academic/validation.ts");
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
    if (name.includes("/materiais/actions")) return {};
    if (name.endsWith(".module.css")) return { default: {} };
    throw Error("Unexpected " + name);
  };
  runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(require, runtimeModule, runtimeModule.exports);
  return runtimeModule.exports;
}
const { listOwnedMaterials, accessOwnedMaterial, deleteOwnedMaterial, sanitizePdfFilename } = load("src/lib/academic/materials/management.ts");
const { MaterialList, formatMaterialSize } = load("src/components/academic/material-list.tsx");
function harness(options = {}) {
  const calls = [];
  const row = { id, user_id: user, subject_id: subject, storage_path: `${user}/${subject}/${id}/source.pdf`, file_status: "ready", deleted_at: null, original_filename: "fixture.pdf", title: "Fixture", size_bytes: 10, created_at: "2026-10-14T10:00:00Z", ...options.row };
  const client = {
    from(table) {
      assert.equal(table, "academic_materials");
      const filters = [], orders = [];
      const b = {
        select(value) { calls.push(["select", value]); return b; },
        eq(key,value) { filters.push([key,value]); return b; },
        is(key,value) { filters.push([key,value]); return b; },
        neq(key,value) { filters.push([key,"neq",value]); return b; },
        order(key,value) { orders.push([key,value]); return b; },
        async maybeSingle() { calls.push(["find", filters]); return { data: options.absent ? null : row, error: options.error }; },
        then(resolve) { calls.push(["list", filters, orders]); return Promise.resolve({ data: options.rows ?? [row], error: options.error }).then(resolve); },
      }; return b;
    },
    storage: { from(bucket) { assert.equal(bucket,"academic-materials"); return { async createSignedUrl(...args) { calls.push(["sign", ...args]); return { data: { signedUrl: "https://fixture.test/ephemeral" }, error: options.signError }; } }; } },
    rpc(name,args) { calls.push(["rpc", name, args]); return { async maybeSingle() { return { data: options.rpcAbsent ? null : { material_id: id, result: options.decision ?? "deleting" }, error: options.rpcError }; } }; },
  };
  return { calls, row, authenticate: async () => { calls.push(["auth"]); return options.auth ?? { ok: true, userId: user, supabase: client }; }, finalize: async value => { assert.equal(value,id); calls.push(["finalize"]); return options.finalized ?? { ok: false, code: "INVALID_PDF" }; } };
}
test("list: minimal DTO and owner/subject/deleted filters, descending stable order", async () => {
  const h=harness(), r=await listOwnedMaterials(subject,h.authenticate);
  assert.equal(r.unavailable,false);
  assert.deepEqual(Object.keys(r.items[0]).sort(),["createdAt","fileStatus","id","originalFilename","sizeBytes","title"]);
  const call=h.calls.find(c=>c[0]==="list");
  assert.deepEqual(call[1],[["user_id",user],["subject_id",subject],["deleted_at",null],["file_status","neq","deleted"]]);
  assert.deepEqual(call[2],[["created_at",{ascending:false}],["id",{ascending:false}]]);
});
test("list: ignores deleted even if provider includes it",async()=>{const h=harness({rows:[{file_status:"deleted"}]});assert.equal((await listOwnedMaterials(subject,h.authenticate)).items.length,0);});
test("list: errors are distinguishable from an empty list",async()=>{const h=harness({error:{message:"PRIVATE_SQL"}});assert.deepEqual(await listOwnedMaterials(subject,h.authenticate),{items:[],unavailable:true});});
for (const download of [false,true]) {
  test(`access: ready owner ${download ? "download" : "open"} signs exactly 60 seconds`,async()=>{
    const h=harness();assert.equal((await accessOwnedMaterial(id,download,h.authenticate)).ok,true);
    assert.deepEqual(h.calls.at(-1),["sign",h.row.storage_path,60,download?{download:"fixture.pdf"}:{}]);
  });
  for(const state of ["pending_upload","validating","upload_failed","deleting","deleted"]) test(`access ${download}: denies ${state}`,async()=>{
    const h=harness({row:{file_status:state}});assert.equal((await accessOwnedMaterial(id,download,h.authenticate)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="sign"));
  });
  for(const row of [{user_id:subject},{storage_path:"../bad"},{deleted_at:"2026-10-14"},{subject_id:"bad"}]) test(`access ${download}: rejects manipulated metadata ${Object.keys(row)}`,async()=>{
    const h=harness({row});assert.equal((await accessOwnedMaterial(id,download,h.authenticate)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="sign"));
  });
}
for(const input of [null,{},"bad",id.toUpperCase()," "+id]) test("access/delete invalid input "+String(input),async()=>{
  const h=harness();assert.equal((await accessOwnedMaterial(input,false,h.authenticate)).ok,false);assert.equal((await deleteOwnedMaterial(input,h.finalize,h.authenticate)).ok,false);assert.equal(h.calls.length,0);
});
test("access/delete: anonymous rejected",async()=>{const h=harness({auth:{ok:false,reason:"auth_required"}});assert.equal((await accessOwnedMaterial(id,false,h.authenticate)).ok,false);assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="sign"||c[0]==="rpc"));});
test("download: sanitizes path/control/header injection and enforces PDF suffix",()=>{for(const name of ["../../bad.pdf","\\folder\\bad.pdf","bad\r\nX: header.pdf","....","", "＜bad＞.pdf"]) {const clean=sanitizePdfFilename(name);assert.ok(!/[\x00-\x1f\x7f/\\<>:"]/.test(clean));assert.ok(!clean.includes(".."));assert.ok(clean.endsWith(".pdf"));}});
for(const state of ["ready","upload_failed","pending_upload","validating","deleting"]) test("delete: "+state+" uses only fixed RPC then existing cleanup",async()=>{
  const h=harness({row:{file_status:state}});assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,true);
  assert.deepEqual(h.calls.find(c=>c[0]==="rpc"),["rpc","request_material_deletion",{p_material_id:id}]);assert.equal(h.calls.at(-1)[0],"finalize");
});
test("delete: tombstone idempotent without issuing a capability",async()=>{const h=harness({row:{file_status:"deleted",deleted_at:"2026-10-14"}});assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,true);assert.ok(!h.calls.some(c=>c[0]==="rpc"));});
test("delete: concurrent RPC tombstone is also idempotent",async()=>{const h=harness({decision:"deleted"});assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,true);assert.ok(!h.calls.some(c=>c[0]==="finalize"));});
test("UI: exact size units for small and large PDFs",()=>{assert.equal(formatMaterialSize(328),"328 B");assert.equal(formatMaterialSize(1024),"1 KiB");assert.equal(formatMaterialSize(6291456),"6 MiB");});
test("delete: other user cannot request transition",async()=>{const h=harness({row:{user_id:subject}});assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="rpc"));});
test("delete: active lease never races validator",async()=>{const h=harness({decision:"in_progress"});assert.equal((await deleteOwnedMaterial(id,h.finalize,h.authenticate)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="finalize"));});
for(const code of ["UNCERTAIN","IN_PROGRESS","MISSING"]) test("delete: "+code+" never falsely claims deletion",async()=>{const h=harness({finalized:{ok:false,code,message:"PRIVATE_DETAIL"}});const r=await deleteOwnedMaterial(id,h.finalize,h.authenticate);assert.equal(r.ok,false);assert.ok(!r.message.includes("PRIVATE"));});
for(const state of ["ready","validating","upload_failed","pending_upload","deleting"]) test("UI: friendly status and actions "+state,()=>{
  const h=harness({row:{file_status:state}});const html=renderToStaticMarkup(React.createElement(MaterialList,{items:[{id,title:h.row.title,originalFilename:h.row.original_filename,sizeBytes:10,fileStatus:state,createdAt:h.row.created_at}],unavailable:false}));
  assert.equal(html.includes(">Abrir<"),state==="ready");assert.equal(html.includes(">Baixar<"),state==="ready");assert.equal(html.includes("Tentar novamente"),state!=="ready"&&state!=="deleting");assert.equal(html.includes("Concluir exclusão"),state==="deleting");assert.ok(!html.includes("storage_path"));
});
