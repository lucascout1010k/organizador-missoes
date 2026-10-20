import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const userId="11111111-1111-4111-8111-111111111111", analysisId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", materialId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", missionId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const source={title:"Revisar",description:"Conceitos do PDF",priority:"medium",estimatedMinutes:20};
const result=()=>({summary:"Resumo",topics:[],keywords:[],exercises:[],suggestedMissions:[{...source},{...source,title:"Praticar"}],limitations:[]});
function load(relative, cache=new Map()) {
  const filename=path.resolve(relative); if(cache.has(filename))return cache.get(filename).exports;
  const mod={exports:{}};cache.set(filename,mod);
  const code=ts.transpileModule(readFileSync(filename,"utf8"),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  function req(name) {
    if(name==="server-only")return {};
    if(name==="zod")return zod;
    if(name==="./data")return {getAuthenticatedMaterialsClient(){throw Error("Real auth forbidden");}};
    if(name==="react")return React;
    if(name==="react/jsx-runtime")return jsxRuntime;
    if(name==="next/navigation")return {useRouter:()=>({refresh(){}})};
    if(name.includes("/materiais/actions"))return {};
    if(name.endsWith(".module.css"))return {default:{}};
    if(name.startsWith("."))return load(path.resolve(path.dirname(filename),name+".ts"),cache);
    throw Error("Unexpected "+name);
  }
  runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(req,mod,mod.exports);return mod.exports;
}
const core=load("src/lib/academic/materials/suggestion-missions.ts"), contract=load("src/lib/academic/materials/suggestion-contract.ts");
function harness(options={}) {
  const calls=[], links=new Map();
  const supabase={from(table){const filters=[];const builder={select(){return builder;},eq(k,v){filters.push([k,v]);return builder;},async maybeSingle(){calls.push(["read",table,filters]);return {data:options.missing===table?null:table==="academic_material_analyses"?{id:analysisId,material_id:materialId,status:"completed",result:options.result??result(),schema_version:1,...options.analysis}:{id:materialId,file_status:"ready",deleted_at:null,...options.material},error:options.readError};}};return builder;},
    rpc(name,args){calls.push(["rpc",name,args]);return {async maybeSingle(){if(options.rpcThrow)throw Error("PRIVATE_SQL");if(options.rpcError || options.failIndex===args.p_suggestion_index)return {error:{message:"PRIVATE_SQL"}};const existing=links.has(args.p_suggestion_index);links.set(args.p_suggestion_index,missionId);return {data:options.dto??{result:existing?"already_created":"created",mission_id:missionId},error:null};}};}};
  const auth=async()=>{calls.push(["auth"]);return options.auth??{ok:true,userId,supabase};};
  return {calls,links,run:input=>core.createOwnedSuggestionMissions(input??{analysisId,suggestions:[{suggestionIndex:0}]},auth)};
}
test("suggestions: server reads own persisted result/material and returns only sanitized IDs",async()=>{const h=harness();const r=await h.run();assert.deepEqual(r,{ok:true,items:[{suggestionIndex:0,status:"created",missionId}]});const reads=h.calls.filter(c=>c[0]==="read");assert.equal(reads.length,2);for(const r of reads)assert.ok(r[2].some(([key,value])=>key==="user_id"&&value===userId));assert.deepEqual(h.calls.at(-1),["rpc","create_analysis_suggestion_mission",{p_analysis_id:analysisId,p_suggestion_index:0,p_fields:source}]);});
test("suggestions: edited fields trim/NFC and immutable identity",async()=>{const h=harness();await h.run({analysisId,suggestions:[{suggestionIndex:0,fields:{...source,title:"  Estudar 1FN  ",description:"  cafe\u0301  ",priority:"high",estimatedMinutes:300}}]});assert.deepEqual(h.calls.at(-1)[2],{p_analysis_id:analysisId,p_suggestion_index:0,p_fields:{title:"Estudar 1FN",description:"café",priority:"high",estimatedMinutes:300}});});
test("suggestions: batch exposes success/failure per item",async()=>{const h=harness({failIndex:1});const r=await h.run({analysisId,suggestions:[{suggestionIndex:0},{suggestionIndex:1}]});assert.deepEqual(r.items.map(i=>i.status),["created","failed"]);assert.ok(!JSON.stringify(r).includes("PRIVATE"));});
test("suggestions: retry/lost response/title edit retain same identity",async()=>{const h=harness();await h.run();const r=await h.run({analysisId,suggestions:[{suggestionIndex:0,fields:{...source,title:"Alterado"}}]});assert.equal(r.items[0].status,"already_created");assert.equal(h.links.size,1);});
for(const input of [null,[],{}, {analysisId:"bad",suggestions:[{suggestionIndex:0}]},{analysisId,suggestions:[]},{analysisId,suggestions:[{suggestionIndex:-1}]},{analysisId,suggestions:[{suggestionIndex:8}]},{analysisId,suggestions:[{suggestionIndex:0.5}]},{analysisId,suggestions:[{suggestionIndex:"0"}]},{analysisId,suggestions:[{suggestionIndex:0},{suggestionIndex:0}]}])test("suggestions: rejects invalid contract "+JSON.stringify(input),async()=>{const h=harness();assert.equal((await core.createOwnedSuggestionMissions(input,async()=>{assert.fail("Must reject before auth");})).ok,false);assert.equal(h.calls.length,0);});
for(const key of ["user_id","userId","material_id","materialId","origin","origin_id","mission_id","result","consent"])test("suggestions: rejects extra authority "+key,async()=>{const h=harness();assert.equal((await h.run({analysisId,suggestions:[{suggestionIndex:0}],[key]:userId})).ok,false);assert.equal(h.calls.length,0);});
for(const fields of [{...source,title:" "},{...source,title:"x".repeat(201)},{...source,description:"x".repeat(20001)},{...source,priority:"admin"},{...source,estimatedMinutes:0},{...source,estimatedMinutes:-1},{...source,estimatedMinutes:1.5},{...source,estimatedMinutes:NaN},{...source,estimatedMinutes:Infinity},{...source,estimatedMinutes:2147483648},{...source,estimatedMinutes:"20"},{...source,user_id:userId},{...source,mission_id:missionId}])test("suggestions: rejects invalid final fields "+JSON.stringify(fields).slice(0,95),async()=>{const h=harness();assert.equal((await h.run({analysisId,suggestions:[{suggestionIndex:0,fields}]})).ok,false);assert.equal(h.calls.length,0);});
for(const options of [{auth:{ok:false,reason:"auth_required"}},{missing:"academic_material_analyses"},{analysis:{status:"failed"}},{analysis:{status:"processing"}},{analysis:{schema_version:2}},{missing:"academic_materials"},{material:{file_status:"deleted",deleted_at:"2026-10-20"}},{material:{file_status:"deleting"}},{material:{file_status:"validating"}},{result:{bad:true}},{readError:{message:"PRIVATE"}}])test("suggestions: unavailable state denies creation "+JSON.stringify(options),async()=>{const h=harness(options);assert.equal((await h.run()).ok,false);assert.ok(!h.calls.some(c=>c[0]==="rpc"));});
test("suggestions: absent valid-range index fails per item",async()=>{const h=harness();const r=await h.run({analysisId,suggestions:[{suggestionIndex:7}]});assert.equal(r.items[0].status,"failed");assert.ok(!h.calls.some(c=>c[0]==="rpc"));});
for(const options of [{rpcThrow:true},{rpcError:true},{dto:{result:"created",mission_id:null}},{dto:{result:"created",mission_id:"bad"}},{dto:{result:"unexpected",mission_id:missionId}}])test("suggestions: transport/malformed DTO sanitized "+JSON.stringify(options),async()=>{const r=await harness(options).run();assert.equal(r.items[0].status,"failed");assert.ok(!JSON.stringify(r).includes("PRIVATE"));});
test("suggestions: tombstone is already_created and cannot be recreated",async()=>{const r=await harness({dto:{result:"already_created",mission_id:null}}).run();assert.equal(r.items[0].status,"already_created");assert.equal(r.items[0].missionId,null);});
test("mission fields: actual SQL Unicode bounds/positive int4/empty description",()=>{assert.equal(contract.missionFieldsSchema.parse({...source,title:"😀".repeat(200),description:"",estimatedMinutes:2147483647}).title.length,400);assert.equal(contract.missionFieldsSchema.safeParse({...source,title:"😀".repeat(201)}).success,false);});
const ui=load("src/components/academic/suggestion-missions.tsx");
test("suggestion UI: selection only, explicit review, no automatic creation, escaped hostile text",()=>{const html=renderToStaticMarkup(React.createElement(ui.SuggestionMissions,{analysisId,suggestions:[{...source,title:'<script>alert("x")</script>'}]}));assert.ok(html.includes('type="checkbox"'));assert.ok(html.includes("Revisar selecionadas"));assert.ok(html.includes("disabled"));assert.ok(!html.includes("<script>"));assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes('type="submit"'));});
test("suggestion UI: persisted conversion disables repeated creation after refresh",()=>{const html=renderToStaticMarkup(React.createElement(ui.SuggestionMissions,{analysisId,suggestions:[source],links:[{suggestionIndex:0,missionId}]}));assert.ok(html.includes("Adicionada às missões"));assert.ok(!html.includes('type="checkbox"'));assert.ok(!html.includes("Revisar selecionadas"));});
