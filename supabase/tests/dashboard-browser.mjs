// Production build UI smoke, fictional accounts only. No PDF/provider requests.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");
process.loadEnvFile(".env.local");
const f = JSON.parse(readFileSync(".env.3a-runtime.json", "utf8"));
assert.equal(f.a.id, "3a000000-0000-4000-8000-000000000001");
assert.ok(f.a.email.endsWith("@example.invalid"));
const base = "http://localhost:3100";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
context.setDefaultTimeout(20000);
let checks = 0, actionId;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log("PASS " + label); };
const errors = [], requests = [];
context.on("page", page => {
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.headers()["next-action"] && request.postData()?.includes(f.missions.ui)) { actionId = request.headers()["next-action"]; requests.push(request.postData()); }
  });
});
const page = await context.newPage();
const panel = p => p.getByRole("region", { name: "Missões de hoje", exact: true });
const item = (p, title) => panel(p).getByRole("listitem").filter({ has: p.getByRole("heading", { name: title, exact: true }) });
const title = "Missão fictícia hoje " + "título longo ".repeat(12);
async function login(p, user) {
  await p.goto(base + "/login");
  await p.getByLabel("E-mail", { exact: true }).fill(user.email);
  await p.getByLabel("Senha", { exact: true }).fill(user.password);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(base + "/");
  await panel(p).waitFor();
}
const stored = async id => (await db.from("missions").select("status,completed_at,user_id").eq("id", id).single()).data;
const shotDir = process.env.UI_SCREENSHOT_DIRECTORY;
try {
  const auth = await db.auth.signInWithPassword({ email: f.a.email, password: f.a.password }); assert.ok(!auth.error);
  await page.goto(base + "/"); await page.waitForURL(base + "/login");
  check(await page.getByRole("heading", { name: "Entrar", exact: false }).count() > 0 || page.url().endsWith("/login"), "anonymous private home redirects to login");
  await login(page, f.a);
  check(await panel(page).getByText("3 de 7 concluídas · 43%", { exact: true }).count() === 1, "real initial progress");
  for (const group of ["Atrasadas", "Hoje", "Concluídas hoje"]) check(await panel(page).getByRole("region", { name: group, exact: true }).count() === 1, "visible group " + group);
  check(await item(page, title).getByText("Prioridade Alta", { exact: true }).count() === 1 && await item(page, title).getByText("IA", { exact: true }).count() === 1, "priority and origin are textual");
  check(await item(page, title).getByText('<script>alert("fixture")</script>', { exact: true }).count() === 1, "hostile description rendered as text");
  check(!(await panel(page).innerText()).includes("Missão privada fictícia B"), "A cannot see B UI");
  check(!(await panel(page).innerText()).includes("Missão fictícia futura") && !(await panel(page).innerText()).includes("Missão fictícia sem data"), "future and backlog excluded from UI");
  const second = await context.newPage(); await second.goto(base + "/"); await panel(second).waitFor();
  for (const width of [320, 375, 390, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal overflow " + width);
    const button = item(page, title).getByRole("button");
    check((await button.boundingBox()).height >= 44, "touch target " + width);
    await page.keyboard.press("Tab");
    await button.focus();
    check(await button.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).outlineStyle !== "none"), "keyboard focus visible " + width);
    if (shotDir && [390, 1440].includes(width)) { mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: `${shotDir}/dashboard-${width}-pending.png`, fullPage: true }); }
  }
  // Delay the real action to inspect loading, then allow its normal server request.
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route(base + "/", async route => {
    if (route.request().headers()["next-action"] && route.request().postData()?.includes(f.missions.ui)) { await gate; await route.continue(); }
    else await route.continue();
  });
  const complete = item(page, title).getByRole("button");
  await complete.focus(); await page.keyboard.press("Enter");
  await item(page, title).getByRole("button", { name: /Concluir missão/ }).getByText("Concluindo…", { exact: true }).waitFor();
  check(await complete.isDisabled(), "loading disables real button");
  check(await panel(page).getByText("3 de 7 concluídas · 43%", { exact: true }).count() === 1, "no false progress before server response");
  release();
  await panel(page).getByText("4 de 7 concluídas · 57%", { exact: true }).waitFor();
  await page.unroute(base + "/");
  check(await panel(page).getByRole("status").innerText() === "Missão concluída.", "completion feedback without F5");
  check(await panel(page).getByRole("region", { name: "Concluídas hoje", exact: true }).getByRole("heading", { name: title, exact: true }).count() === 1, "completion moves mission into completed group");
  const first = await stored(f.missions.ui);
  check(first.status === "completed" && first.completed_at, "UI completion persisted in database");
  check(requests.length === 1 && requests[0] === JSON.stringify([{ missionId: f.missions.ui }]), "browser sends missionId only");
  await item(second, title).getByRole("button").click();
  await panel(second).getByText("4 de 7 concluídas · 57%", { exact: true }).waitFor();
  check((await stored(f.missions.ui)).completed_at === first.completed_at, "stale second tab completion is idempotent");
  await page.reload(); await panel(page).getByText("4 de 7 concluídas · 57%", { exact: true }).waitFor();
  check((await stored(f.missions.ui)).completed_at === first.completed_at, "refresh preserves server state");
  const post = async (p, payload) => p.evaluate(async ({ base, actionId, payload }) => {
    const response = await fetch(base + "/", { method: "POST", headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify([payload]) });
    return response.text();
  }, { base, actionId, payload });
  for (const payload of [{ missionId: "bad" }, { missionId: f.bMission }, { missionId: "3a000000-0000-4000-8000-000000000999" }, ...["user_id", "completed_at", "status", "extra"].map(key => ({ missionId: f.missions.error, [key]: "forged" }))]) {
    check((await post(page, payload)).includes('"ok":false'), "forged/cross-owner direct Server Action rejected");
  }
  check((await stored(f.missions.error)).status === "planned", "forged payloads preserve pending mission");
  // Controlled network failure: no database mutation; previous UI must survive.
  await page.route(base + "/", route => route.request().headers()["next-action"] ? route.abort("failed") : route.continue());
  await item(page, "Missão fictícia erro UI").getByRole("button").click();
  await item(page, "Missão fictícia erro UI").getByRole("alert").waitFor();
  check(await panel(page).getByText("4 de 7 concluídas · 57%", { exact: true }).count() === 1 && (await stored(f.missions.error)).status === "planned", "transport error preserves list and progress");
  await page.unroute(base + "/");
  await item(page, "Missão fictícia erro UI").getByRole("button").click();
  await panel(page).getByText("5 de 7 concluídas · 71%", { exact: true }).waitFor();
  check((await stored(f.missions.error)).status === "completed", "explicit retry recovers UI error");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => { window.scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "completed layout no horizontal overflow " + width);
    if (shotDir && width === 390) await page.screenshot({ path: `${shotDir}/dashboard-390-completed.png`, fullPage: false });
  }
  const bContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const bPage = await bContext.newPage(); await login(bPage, f.b);
  check((await panel(bPage).innerText()).includes("Missão privada fictícia B") && !(await panel(bPage).innerText()).includes("Missão fictícia hoje"), "B UI contains only B mission");
  check((await post(bPage, { missionId: f.missions.postponed })).includes('"ok":false'), "B action cannot complete A");
  await bContext.close(); await second.close();
  // Empty state on A: remove only this runner's known fictional missions, never real rows.
  const removed = await db.from("missions").delete().eq("user_id", f.a.id).in("id", Object.values(f.missions));
  check(!removed.error, "known A fixtures removed through own session");
  await page.reload(); await panel(page).getByText("Nenhuma missão para hoje.", { exact: true }).waitFor();
  check(await panel(page).getByText("0 de 0 concluídas · 0%", { exact: true }).count() === 1, "real empty state and zero progress");
  check(errors.length === 0, "no browser page errors");
  console.log(`BROWSER_DASHBOARD_CHECKS=${checks}`);
} finally { await db.auth.signOut({ scope: "local" }); await browser.close(); }
