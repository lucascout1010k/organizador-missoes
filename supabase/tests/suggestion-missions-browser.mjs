// Production-app smoke test, controlled fictional data only. No Gemini calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH??"playwright");
process.loadEnvFile(".env.local");
const fixture=JSON.parse(readFileSync(".env.2d4-runtime.json","utf8"));
const base="http://localhost:3100", path=`/faculdade/materias/${fixture.subject}`;
const uiAnalysis="2d400000-0000-4000-8000-000000000034";
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let checks=0, actionId;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log("PASS "+label);};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??"chrome"});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
context.setDefaultTimeout(20000);
const errors=[];
context.on("page",page=>{page.on("pageerror",error=>errors.push(error.message));page.on("request",req=>{if(req.headers()["next-action"]&&req.postData()?.includes(uiAnalysis))actionId=req.headers()["next-action"];});});
const page=await context.newPage();
const panel=p=>p.locator("li").filter({has:p.getByRole("heading",{name:"PDF fictício UI 2D.4",exact:true})}).last();
async function links(){const r=await db.from("academic_analysis_mission_links").select("suggestion_index,mission_id").eq("analysis_id",uiAnalysis);assert.ok(!r.error);return r.data;}
async function login(p,user){await p.goto(base+"/login");await p.getByLabel("E-mail",{exact:true}).fill(user.email);await p.getByLabel("Senha",{exact:true}).fill(user.password);await p.getByRole("button",{name:"Entrar",exact:true}).click();await p.waitForURL(base+"/");}
try {
 const auth=await db.auth.signInWithPassword(fixture.a);assert.ok(!auth.error);
 await login(page,fixture.a);await page.goto(base+path);
 const area=panel(page);await area.getByRole("checkbox").first().waitFor();
 check((await links()).length===0,"page load creates no missions");
 await area.getByRole("checkbox",{name:"Selecionar sugestão 1",exact:true}).check();await area.getByRole("checkbox",{name:"Selecionar sugestão 2",exact:true}).check();
 check((await links()).length===0,"selection creates no missions");
 await area.getByRole("button",{name:"Revisar selecionadas (2)",exact:true}).click();
 check((await links()).length===0,"review creates no missions");
 const title="Escolha explícita fictícia "+"normalização ".repeat(10), script='<script>alert("fixture")</script>';
 const field=area.getByRole("group",{name:"Sugestão 1",exact:true});
 await field.getByLabel("Título",{exact:true}).fill(title);await field.getByLabel("Descrição",{exact:true}).fill(script);await field.getByLabel("Prioridade",{exact:true}).selectOption("high");await field.getByLabel("Duração estimada (minutos)",{exact:true}).fill("90");
 await area.getByRole("button",{name:"Adicionar selecionadas",exact:true}).click();
 await area.getByText("Missões adicionadas.",{exact:true}).waitFor();
 let rows=await links();check(rows.length===2,"explicit confirmation creates two missions");
 const stored=await db.from("missions").select("title,description,priority,estimated_minutes").eq("id",rows.find(r=>r.suggestion_index===0).mission_id).single();
 check(stored.data.title===title.trim()&&stored.data.description===script&&stored.data.priority==="high"&&stored.data.estimated_minutes===90,"browser edits persisted through Server Action");
 await page.reload();await panel(page).getByText("Adicionada às missões",{exact:true}).first().waitFor();
 check(await panel(page).getByText("Adicionada às missões",{exact:true}).count()===2,"refresh restores converted state");
 check(await panel(page).getByRole("checkbox").count()===6,"converted suggestions cannot be selected");
 check((await links()).length===2,"refresh creates no duplicates");
 check(await panel(page).getByText(script,{exact:true}).count()>0,"hostile suggestion renders as literal text");
 for(const width of [320,375,390,414,768,1440]){
  await page.setViewportSize({width,height:1000});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"no horizontal overflow "+width);
 }
 await page.setViewportSize({width:375,height:900});
 await panel(page).getByRole("checkbox",{name:"Selecionar sugestão 3",exact:true}).check();
 await panel(page).getByRole("button",{name:"Revisar selecionadas (1)",exact:true}).click();
 await panel(page).getByLabel("Título",{exact:true}).fill("Missão mobile fictícia");
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"mobile review fields do not overflow");
 await panel(page).getByRole("button",{name:"Adicionar como missão",exact:true}).click();await panel(page).getByText("Missão adicionada.",{exact:true}).waitFor();
 check((await links()).length===3,"mobile confirmation persists mission");
 const second=await context.newPage();await second.goto(base+path);
 for(const p of [page,second]){await panel(p).getByRole("checkbox",{name:"Selecionar sugestão 4",exact:true}).check();await panel(p).getByRole("button",{name:"Revisar selecionadas (1)",exact:true}).click();}
 await Promise.all([panel(page).getByRole("button",{name:"Adicionar como missão",exact:true}).click(),panel(second).getByRole("button",{name:"Adicionar como missão",exact:true}).click()]);
 await panel(page).getByRole("button",{name:"Revisar selecionadas (0)",exact:true}).waitFor();await panel(second).getByRole("button",{name:"Revisar selecionadas (0)",exact:true}).waitFor();
 rows=await links();check(rows.length===4&&rows.filter(r=>r.suggestion_index===3).length===1,"two browser tabs create exactly one mission for same suggestion");
 check(!!actionId,"captured actual Server Action reference for negative checks");
 const bad=await page.request.post(base+path,{headers:{"Next-Action":actionId,"Content-Type":"text/plain;charset=UTF-8",Origin:base},data:JSON.stringify([{analysisId:uiAnalysis,suggestions:[{suggestionIndex:5}],user_id:fixture.b.id}])});
 const badText=await bad.text();check(badText.includes("Revise as sugestões")&&!badText.includes("permission denied"),"Server Action rejects forged authority with public message");
 const bContext=await browser.newContext();const bPage=await bContext.newPage();await login(bPage,fixture.b);
 const crossed=await bContext.request.post(base+path,{headers:{"Next-Action":actionId,"Content-Type":"text/plain;charset=UTF-8",Origin:base},data:JSON.stringify([{analysisId:uiAnalysis,suggestions:[{suggestionIndex:5}]}])});
 check((await crossed.text()).includes("Esta análise não está disponível"),"B cannot invoke A conversion through Server Action");
 check((await links()).length===4,"negative actions create no missions");
 await bContext.close();
 await page.reload();await panel(page).getByText("Adicionada às missões",{exact:true}).first().waitFor();
 check(await panel(page).getByText("Adicionada às missões",{exact:true}).count()===4,"both-tab conversions remain after refresh");
 if(process.env.UI_SCREENSHOT_DIRECTORY){await page.screenshot({path:process.env.UI_SCREENSHOT_DIRECTORY+"/2d4-mobile.png",fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:process.env.UI_SCREENSHOT_DIRECTORY+"/2d4-desktop.png",fullPage:true});}
 check(errors.length===0,"no browser runtime errors");
 console.log(`BROWSER_CHECKS=${checks}`);
} finally {await browser.close();await db.auth.signOut({scope:"local"});}
