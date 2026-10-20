// Explicit remote integration runner. Requires controlled fixtures from the 2D.4
// validation procedure and a git-ignored .env.2d4-runtime.json. No admin key.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const f=JSON.parse(readFileSync(".env.2d4-runtime.json","utf8"));
if(process.env.SUGGESTION_RUNTIME_ANALYSIS_ID) {
 assert.match(process.env.SUGGESTION_RUNTIME_ANALYSIS_ID,/^2d400000-0000-4000-8000-\d{12}$/);
 f.analysis=process.env.SUGGESTION_RUNTIME_ANALYSIS_ID;
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname,"artaypnqyxwpzqrcfqvp.supabase.co","Unexpected project");
assert.ok(f.a.email.endsWith("@example.invalid")&&f.b.email.endsWith("@example.invalid"));
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=client(),b=client(),anon=client();let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log("PASS "+label);}
async function convert(c,index,fields,analysis=f.analysis,extra={}){return c.rpc("create_analysis_suggestion_mission",{p_analysis_id:analysis,p_suggestion_index:index,...(fields===undefined?{}:{p_fields:fields}),...extra}).maybeSingle();}
const fields={title:"  Estudar 1FN, 2FN e 3FN  ",description:"  Escolha explícita do usuário fictício  ",estimatedMinutes:35,priority:"high"};
try {
 for(const [c,user] of [[a,f.a],[b,f.b]]){const r=await c.auth.signInWithPassword({email:user.email,password:user.password});check(!r.error&&r.data.user.id===user.id,"real fixture login "+(user===f.a?"A":"B"));}
 const denied=await convert(b,0);check(!!denied.error,"B cannot convert A analysis");
 check(!!(await convert(a,0,undefined,f.bAnalysis)).error,"A cannot convert B analysis");
 const ownB=await convert(b,0,undefined,f.bAnalysis);check(!ownB.error&&ownB.data.result==="created","B can convert own completed analysis");
 check(!!(await convert(anon,0)).error,"anon cannot execute RPC");
 check(!!(await convert(a,0,undefined,"00000000-0000-4000-8000-000000000000")).error,"missing analysis denied");
 for(const analysis of [f.processing,f.failed,f.deletedAnalysis])check(!!(await convert(a,0,undefined,analysis)).error,"ineligible fixture analysis "+[f.processing,f.failed,f.deletedAnalysis].indexOf(analysis));
 for(const index of [-1,8,2147483647,null])check(!!(await convert(a,index)).error,"invalid index "+index);
 check(!!(await convert(a,0,undefined,"bad")).error,"invalid UUID denied");
 const invalid=[{...fields,title:" "},{...fields,title:"x".repeat(201)},{...fields,description:"x".repeat(20001)},{...fields,priority:"admin"},{...fields,estimatedMinutes:0},{...fields,estimatedMinutes:-5},{...fields,estimatedMinutes:1.5},{...fields,estimatedMinutes:2147483648},{...fields,estimatedMinutes:"20"},{...fields,user_id:f.b.id},{...fields,material_id:f.deletedMaterial},{...fields,origin:"manual"},{...fields,mission_id:f.analysis}];
 for(let i=0;i<invalid.length;i++)check(!!(await convert(a,7,invalid[i])).error,"invalid/forged fields "+i);
 for(const extra of [{p_user_id:f.b.id},{p_material_id:f.deletedMaterial},{p_origin:"manual"},{p_mission_id:f.analysis}])check(!!(await convert(a,7,fields,f.analysis,extra)).error,"extra RPC authority "+Object.keys(extra)[0]);
 const first=await convert(a,0,fields);check(!first.error&&first.data.result==="created","one suggestion creates mission");const mission=first.data.mission_id;
 const normal=await a.from("missions").select("*").eq("id",mission).single();check(!normal.error&&normal.data.title===fields.title.trim()&&normal.data.description===fields.description.trim()&&normal.data.priority==="high"&&normal.data.estimated_minutes===35,"normal missions query preserves edited fields");
 check(normal.data.user_id===f.a.id&&normal.data.origin_type==="ai"&&normal.data.origin_id===null&&normal.data.category==="academic"&&normal.data.status==="planned"&&normal.data.scheduled_for===null&&normal.data.due_at===null,"server controls owner/origin/category/state; no automatic dates");
 const retry=await convert(a,0,{...fields,title:"Changed identity cannot duplicate"});check(!retry.error&&retry.data.result==="already_created"&&retry.data.mission_id===mission,"retry/lost response/title edit return same mission");
 const concurrent=await Promise.all(Array.from({length:6},()=>convert(a,1)));check(concurrent.every(r=>!r.error)&&concurrent.filter(r=>r.data.result==="created").length===1&&new Set(concurrent.map(r=>r.data.mission_id)).size===1,"six concurrent tabs/double clicks create exactly one mission");
 const multiple=await convert(a,2);check(!multiple.error&&multiple.data.result==="created","multiple selected suggestions have independent identities");
 const hostile='<script>alert("fixture")</script><img src=x onerror=alert(1)>';
 const hostileResult=await convert(a,4,{...fields,title:hostile,description:hostile});check(!hostileResult.error,"hostile strings accepted as plain text");
 const text=await a.from("missions").select("title,description").eq("id",hostileResult.data.mission_id).single();check(text.data.title===hostile&&text.data.description===hostile,"hostile strings persisted only as text");
 const links=await a.from("academic_analysis_mission_links").select("*").eq("analysis_id",f.analysis);check(!links.error&&links.data.length===4&&links.data.every(l=>l.user_id===f.a.id&&l.material_id===f.material),"owner links contain correct analysis/material; no duplicate");
 const cross=await b.from("academic_analysis_mission_links").select("*").eq("analysis_id",f.analysis);check(!cross.error&&cross.data.length===0,"B cannot read A links");
 const hidden=await b.from("missions").select("id").eq("id",mission);check(!hidden.error&&hidden.data.length===0,"B cannot read A mission");
 for(const op of [()=>a.from("academic_analysis_mission_links").insert({user_id:f.a.id,analysis_id:f.analysis,material_id:f.material,mission_id:mission,suggestion_index:7}),()=>a.from("academic_analysis_mission_links").update({suggestion_index:7}).eq("analysis_id",f.analysis),()=>a.from("academic_analysis_mission_links").delete().eq("analysis_id",f.analysis)])check(!!(await op()).error,"client link CRUD denied");
 check(!!(await anon.from("academic_analysis_mission_links").select("id")).error,"anon link read denied");
 check(!!(await a.from("academic_material_analyses").update({result:{}}).eq("id",f.analysis)).error,"persisted AI identity cannot be edited by browser");
 const manual=await a.from("missions").insert({user_id:f.a.id,title:"Missão manual fictícia",category:"personal",origin_type:"manual"}).select("id").single();check(!manual.error,"manual mission creation preserved");
 check(!(await a.from("missions").delete().eq("id",manual.data.id)).error,"manual mission deletion preserved");
 check(!(await a.from("missions").delete().eq("id",multiple.data.mission_id)).error,"linked mission deletion remains supported");
 const tombstone=await convert(a,2);check(!tombstone.error&&tombstone.data.result==="already_created"&&tombstone.data.mission_id===null,"deleted mission tombstone prevents recreation");
 console.log(`REMOTE_RUNTIME_CHECKS=${checks}`);
} finally { await Promise.allSettled([a.auth.signOut({scope:"local"}),b.auth.signOut({scope:"local"})]); }
