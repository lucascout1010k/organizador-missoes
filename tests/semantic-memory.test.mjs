import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as pdfLib from "pdf-lib";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const root=process.cwd(), user="11111111-1111-4111-8111-111111111111", subject="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", material="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", token="a".repeat(64);
function load(file,overrides={}) {
  const filename=path.resolve(root,file),mod={exports:{}};
  function require(name) {
    if(name in overrides)return overrides[name];
    if(name==="server-only")return {};
    if(name==="zod")return {z};
    if(name==="pdf-lib")return pdfLib;
    if(name==="postgres")return {__esModule:true,default(){throw Error("Real database forbidden");}};
    if(name==="@google/genai")return {GoogleGenAI:class {constructor(){throw Error("Real provider forbidden");}}};
    if(name==="react")return React;
    if(name==="react/jsx-runtime")return jsx;
    if(name==="next/link")return {__esModule:true,default:({children,...props})=>React.createElement("a",props,children)};
    if(name==="next/navigation")return {useRouter:()=>({refresh(){}}),notFound(){throw Error("NOT_FOUND");},redirect(){throw Error("AUTH_REQUIRED");}};
    if(name.includes("/materiais/semantic-actions"))return {};
    if(name==="@/lib/supabase/server")return {createClient(){throw Error("Real auth forbidden");}};
    if(name.endsWith(".module.css"))return {__esModule:true,default:{}};
    const base=name.startsWith("@/")?path.join(root,"src",name.slice(2)):path.resolve(path.dirname(filename),name);
    const source=[base+".ts",base+".tsx"].find(existsSync);
    if(source)return load(source,overrides);
    throw Error("Unexpected "+name);
  }
  const code=ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(require,mod,mod.exports);return mod.exports;
}
const contracts=load("src/lib/academic/semantic/contracts.ts"), pdf=load("src/lib/academic/semantic/pdf.ts"), service=load("src/lib/academic/semantic/service.ts");
const vector=()=>[1,...Array(767).fill(0)];
async function fixture(pages=7){const doc=await pdfLib.PDFDocument.create();for(let i=0;i<pages;i++)doc.addPage().drawText(`Academic fixture page ${i+1}. While repeats while a condition is true.`);return doc.save();}

for(const [count,expected] of [[1,[[1,1]]],[3,[[1,3]]],[4,[[1,4]]],[5,[[1,4],[4,5]]],[7,[[1,4],[4,7]]],[8,[[1,4],[4,7],[7,8]]]])test(`PDF windows ${count}`,()=>assert.deepEqual(pdf.pageWindows(count).map(x=>[x.pageStart,x.pageEnd]),expected));
for(const value of [0,-1,121,NaN,1.5])test("invalid PDF page count "+value,()=>assert.throws(()=>pdf.pageWindows(value)));
test("PDF real first/last pages and overlap; input bytes unchanged",async()=>{
 const bytes=await fixture(8),before=Buffer.from(bytes),doc=await pdf.loadAcademicPdf(bytes);
 const windows=pdf.pageWindows(doc.getPageCount());
 for(const window of windows){const slice=await pdf.sliceAcademicPdf(doc,window.pageStart,window.pageEnd);assert.equal((await pdfLib.PDFDocument.load(slice)).getPageCount(),window.pageEnd-window.pageStart+1);}
 assert.equal(windows[0].pageEnd,windows[1].pageStart);assert.equal(windows.at(-1).pageEnd,8);assert.deepEqual(Buffer.from(bytes),before);
 await assert.rejects(pdf.sliceAcademicPdf(doc,0,1));await assert.rejects(pdf.loadAcademicPdf(new Uint8Array([1,2])));
});
test("overlap preserves a concept across pages 4 and 5 in one retrievable PDF",async()=>{
 const doc=await pdfLib.PDFDocument.create();
 for(let page=1;page<=8;page++)doc.addPage().drawText(page===4?"Accumulator begins at 7.":page===5?"Each pass adds 3.":"Unrelated academic content.");
 async function textIn(bytes){
  const copy=await pdfLib.PDFDocument.load(bytes);const texts=[];
  for(const page of copy.getPages()){
   const contents=page.node.Contents();if(!contents)continue;
   const refs=contents instanceof pdfLib.PDFArray?contents.asArray():[contents];
   for(const ref of refs){const stream=copy.context.lookup(ref);const operators=Buffer.from(pdfLib.decodePDFRawStream(stream).decode()).toString("latin1");for(const match of operators.matchAll(/<([0-9a-f]+)>/gi))texts.push(Buffer.from(match[1],"hex").toString("latin1"));}
  }
  return texts.join(" ");
 }
 const first=await textIn(await pdf.sliceAcademicPdf(doc,1,4));
 const overlap=await textIn(await pdf.sliceAcademicPdf(doc,4,7));
 const disjoint=await textIn(await pdf.sliceAcademicPdf(doc,5,8));
 assert.ok(first.includes("Accumulator begins at 7.")&&!first.includes("Each pass adds 3."));
 assert.ok(disjoint.includes("Each pass adds 3.")&&!disjoint.includes("Accumulator begins at 7."));
 assert.ok(overlap.includes("Accumulator begins at 7.")&&overlap.includes("Each pass adds 3."));
 const sources=pdf.selectSourceRanges([{material_id:material,title:"Boundary concept",chunk_index:1,page_start:4,page_end:7,similarity:.8}]);
 assert.equal(sources[0].pageStart,4);assert.equal(sources[0].pageEnd,7);
});
for(const value of [[],Array(767).fill(1),Array(769).fill(1),Array(768).fill(0),Array(768).fill(NaN),Array(768).fill(Infinity),Array(768).fill("1")])test("embedding rejects malformed vector "+String(value.length)+" "+String(value[0]),()=>assert.throws(()=>contracts.validateEmbedding(value)));
test("embedding normalized and model/version fixed",()=>{assert.equal(Math.hypot(...contracts.validateEmbedding(Array(768).fill(1))).toFixed(5),"1.00000");assert.equal(contracts.EMBEDDING_MODEL,"gemini-embedding-2");assert.equal(contracts.INDEX_VERSION,"subject-semantic-memory-v1");});
test("retrieval merges overlap and caps page budget",()=>{
 const hits=[{material_id:material,title:"Fixture",chunk_index:0,page_start:1,page_end:4,similarity:.8},{material_id:material,title:"Fixture",chunk_index:1,page_start:4,page_end:7,similarity:.7},{material_id:material,title:"Fixture",chunk_index:2,page_start:7,page_end:10,similarity:.6},{material_id:subject,title:"Other",chunk_index:0,page_start:1,page_end:4,similarity:.5}];
 assert.deepEqual(pdf.selectSourceRanges(hits),[{sourceId:"S1",materialId:material,title:"Fixture",pageStart:1,pageEnd:10}]);assert.deepEqual(pdf.selectSourceRanges([{...hits[0],similarity:.01}]),[]);
});
test("answer sources are controlled IDs; unsupported claims cannot cite fabricated sources",()=>{
 const sources=[{sourceId:"S1",materialId:material,title:"Fixture",pageStart:1,pageEnd:4}];
 const answered={status:"answered",answer:"Supported",sources:[{sourceId:"S1"}],limitations:[]};
 assert.equal(contracts.validateAnswer(answered,sources).sources[0].materialId,material);
 for(const patch of [{sources:[{sourceId:"S2"}]},{sources:[]},{sources:[{sourceId:"S1",materialId:subject}]},{sources:[{sourceId:"S1"},{sourceId:"S1"}]},{status:"not_found"}])assert.throws(()=>contracts.validateAnswer({...answered,...patch},sources));
 assert.equal(contracts.validateAnswer({...answered,status:"not_found",sources:[]},sources).status,"not_found");
});
for(const extra of [{user_id:user},{pageStart:1},{model:"other"},{index_version:"other"}])test("strict browser payload rejects "+Object.keys(extra),()=>assert.equal(contracts.indexInputSchema.safeParse({materialId:material,consent:true,...extra}).success,false));
for(const question of [""," ","x".repeat(601)])test("question length "+question.length,()=>assert.equal(contracts.questionInputSchema.safeParse({subjectId:subject,question}).success,false));

async function harness(options={}) {
 const bytes=await fixture(options.pages??7),calls=[];let state=options.state??"not_indexed",gateBusy=false;
 const row={id:material,user_id:user,subject_id:subject,storage_path:`${user}/${subject}/${material}/source.pdf`,size_bytes:bytes.length,mime_type:"application/pdf",file_status:"ready",deleted_at:null,...options.row};
 const ctx={ok:true,userId:user,supabase:{auth:{getSession:async()=>({data:{session:{user:{id:user},access_token:"fixture-token"}},error:null})},from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},is(k,v){filters.push([k,v]);return q;},async maybeSingle(){calls.push(["read",table,filters]);if(options.absent)return {data:null};return {data:table==="subjects"?{id:subject}:filters.every(([k,v])=>row[k]===v)?row:null};}};return q;},rpc(name,args){calls.push(["rpc",name,args]);
  if(name==="request_material_semantic_index"){let data=state==="ready"||state==="indexing"?{decision:state,generation:1,completion_token:null}:{decision:"issued",generation:1,completion_token:token};state="indexing";return {maybeSingle:async()=>({data})};}
  if(name==="subject_semantic_status")return Promise.resolve({data:[{material_id:material,status:state,page_count:7}]});
  if(name==="request_semantic_question"){const data=gateBusy?null:token;gateBusy=true;return Promise.resolve({data});}
  if(name==="match_subject_semantic_chunks")return Promise.resolve({data:options.hits??[{material_id:material,title:"While fixture",page_start:1,page_end:4,chunk_index:0,similarity:.8},{material_id:material,title:"While fixture",page_start:4,page_end:7,chunk_index:1,similarity:.7}],error:options.retrievalError});
  throw Error("Unexpected RPC");
 }}};
 const deps={authenticate:async()=>options.anon?{ok:false,reason:"auth_required"}:ctx,
 download:async()=>{calls.push(["download"]);return {kind:"found",bytes,mime:"application/pdf"};},
 settle:async(id,generation,capability,evidence)=>{calls.push(["settle",id,generation,capability,evidence]);if(options.settleFailure&&evidence)throw Error("PRIVATE_DB");state=evidence?"ready":"failed";},
 finish:async()=>{calls.push(["finish"]);gateBusy=false;},
 embed:async(content)=>{calls.push(["embed",content]);if(options.wait)await options.wait;if(options.embeddingFailure)throw Error("PRIVATE_PROVIDER");return options.vector??vector();},
 answer:async(q,memory,sources)=>{calls.push(["answer",q,memory,sources]);if(options.deleteDuringAnswer)state="failed";return options.answer??{status:"answered",answer:"While repeats while the condition is true.",sources:[{sourceId:"S1"}],limitations:[]};},
 memory:async()=>({subject:{id:subject,name:"Fixture"},stats:{materials:3,analyzed:1},studiedTopics:["Loops"],keywords:["while"],latestAnalyzedMaterial:null}),
 };return {calls,deps,row};
}
test("index once: all PDF windows embedded, single atomic settlement, no browser vectors",async()=>{const h=await harness(),r=await service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps);assert.deepEqual(r,{ok:true,value:{status:"ready"}});assert.equal(h.calls.filter(c=>c[0]==="embed").length,2);const settled=h.calls.find(c=>c[0]==="settle");assert.equal(settled[4].chunks.length,2);assert.equal(settled[4].chunks[1].pageStart,4);assert.ok(!JSON.stringify(r).includes(token));});
for(const state of ["ready","indexing"])test("index reuse "+state+" does not call provider",async()=>{const h=await harness({state});assert.equal((await service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps)).value.status,state);assert.ok(!h.calls.some(c=>c[0]==="embed"||c[0]==="download"));});
for(const options of [{anon:true},{absent:true},{row:{user_id:subject}},{row:{file_status:"deleted"}},{row:{storage_path:"forged"}}])test("index denies invalid ownership/state "+JSON.stringify(options),async()=>{const h=await harness(options);assert.equal((await service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps)).ok,false);assert.ok(!h.calls.some(c=>c[0]==="embed"));});
for(const options of [{embeddingFailure:true},{vector:[1]},{settleFailure:true}])test("failed index has no partial commit "+JSON.stringify(options),async()=>{const h=await harness(options);const r=await service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps);assert.equal(r.ok,false);assert.equal(h.calls.at(-1)[0],"settle");assert.equal(h.calls.at(-1)[4],undefined);assert.ok(!JSON.stringify(r).includes("PRIVATE"));});
test("index double click receives existing lease",async()=>{let release;const wait=new Promise(r=>release=r),h=await harness({wait});const first=service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps);while(!h.calls.some(c=>c[0]==="embed"))await new Promise(r=>setTimeout(r,1));const second=await service.indexOwnedAcademicMaterial({materialId:material,consent:true},h.deps);assert.equal(second.value.status,"indexing");release();await first;assert.equal(h.calls.filter(c=>c[0]==="download").length,1);});
test("question: one vector match, one download per material, merged cited ranges",async()=>{const h=await harness({state:"ready"});const r=await service.askOwnedSubject({subjectId:subject,question:" How does while work? "},h.deps);assert.equal(r.ok,true);assert.equal(r.value.sources[0].pageEnd,7);assert.equal(r.value.coverage.indexed,1);assert.equal(r.value.coverage.total,3);assert.equal(r.value.coverage.consulted,1);assert.equal(h.calls.filter(c=>c[0]==="download").length,1);assert.equal(h.calls.filter(c=>c[0]==="embed").length,1);assert.equal(h.calls.filter(c=>c[0]==="answer").length,1);assert.equal(h.calls.at(-1)[0],"finish");assert.ok(!JSON.stringify(r).includes("embedding"));});
test("question without indexed PDFs incurs zero provider cost",async()=>{const h=await harness();const r=await service.askOwnedSubject({subjectId:subject,question:"AVL?"},h.deps);assert.equal(r.value.status,"not_found");assert.ok(!h.calls.some(c=>c[0]==="embed"||c[0]==="answer"));});
for(const options of [{retrievalError:true},{answer:{status:"answered",answer:"fabrication",sources:[{sourceId:"S6"}],limitations:[]}},{deleteDuringAnswer:true}])test("question failure sanitized "+JSON.stringify(options),async()=>{const h=await harness({state:"ready",...options}),r=await service.askOwnedSubject({subjectId:subject,question:"while?"},h.deps);assert.equal(r.ok,false);assert.equal(h.calls.at(-1)[0],"finish");});
test("question out of scope returns provider not_found with coverage",async()=>{const h=await harness({state:"ready",answer:{status:"not_found",answer:"Not found in the sources.",sources:[],limitations:[]}});const r=await service.askOwnedSubject({subjectId:subject,question:"Neural networks?"},h.deps);assert.equal(r.value.status,"not_found");assert.deepEqual(r.value.sources,[]);});
test("provider: official SDK fixed embedding model/dim, no taskType, no tools, store false",async()=>{
 const requests=[];class GoogleGenAI{constructor(config){requests.push(config);}models={embedContent:async input=>{requests.push(input);return {embeddings:[{values:vector()}]};}};interactions={create:async(...args)=>{requests.push(args);return {status:"completed",output_text:'{"status":"not_found","answer":"No evidence","sources":[],"limitations":[]}'};}};}
 const p=load("src/lib/academic/semantic/provider.ts",{"@google/genai":{GoogleGenAI},"../materials/analysis-provider":{academicProviderConfiguration:()=>({apiKey:"fixture",model:"gemini-3.8-flash"})}});
 await p.embedAcademicContent({question:"while"},new AbortController().signal);const embed=requests.find(r=>r.model==="gemini-embedding-2");assert.equal(embed.config.outputDimensionality,768);assert.equal(embed.config.taskType,undefined);
 await p.answerAcademicQuestion("while","memory",[{sourceId:"S1",title:"Fixture",pageStart:1,pageEnd:1,bytes:new Uint8Array([1])}],new AbortController().signal);
 const [request,options]=requests.find(Array.isArray);assert.equal(request.store,false);assert.equal(request.tools,undefined);assert.equal(options.maxRetries,0);assert.ok(p.GROUNDING_INSTRUCTION.includes("DADOS NÃO CONFIÁVEIS"));
 const missing=load("src/lib/academic/semantic/provider.ts",{"../materials/analysis-provider":{academicProviderConfiguration(){throw Error("PRIVATE_CONFIGURATION");}}});await assert.rejects(missing.embedAcademicContent({question:"test"},new AbortController().signal),error=>error.code==="configuration_error"&&!error.message.includes("PRIVATE"));
});
test("UI: initial render has no automatic request, zero coverage, explicit consent",()=>{
 const ui=load("src/components/academic/semantic-memory.tsx");const markup=renderToStaticMarkup(React.createElement(ui.AskSubjectMemory,{subjectId:subject,indexed:0,total:6}));assert.ok(markup.includes("0 de 6"));assert.ok(markup.includes('maxLength="600"')||markup.includes('maxlength="600"'));assert.ok(markup.includes('disabled=""'));const control=renderToStaticMarkup(React.createElement(ui.SemanticIndexControl,{materialId:material,status:"not_indexed"}));assert.ok(control.includes("Adicionar à memória pesquisável"));assert.ok(!control.includes('type="checkbox"'));
 const unavailable=renderToStaticMarkup(React.createElement(ui.AskSubjectMemory,{subjectId:subject,indexed:1,total:6,unavailable:true}));assert.ok(unavailable.includes("indisponível"));assert.ok(!unavailable.includes("1 de 6"));assert.ok(unavailable.includes('disabled=""'));
});
