import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const f=JSON.parse(readFileSync('.env.2d4-runtime.json','utf8')),browser=await chromium.launch({channel:'chrome',headless:true});
let n=0;function check(v,label){if(!v)throw Error(label);n++;console.log('PASS '+label);}
try{const page=await browser.newPage({viewport:{width:375,height:850},reducedMotion:'reduce'});await page.goto('http://localhost:3100/login');await page.getByLabel('E-mail',{exact:true}).fill(f.a.email);await page.getByLabel('Senha',{exact:true}).fill(f.a.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('http://localhost:3100/');await page.goto('http://localhost:3100/faculdade/materias/'+f.subject);
const panel=page.locator('li').filter({has:page.getByRole('heading',{name:'PDF fictício UI 2D.4',exact:true})}).last();
const checkbox=panel.getByRole('checkbox',{name:'Selecionar sugestão 5',exact:true});await checkbox.focus();await page.keyboard.press('Space');check(await checkbox.isChecked(),'keyboard selection');await page.keyboard.press('Tab');
await panel.getByRole('button',{name:'Revisar selecionadas (1)',exact:true}).click();await page.getByRole('heading',{name:'Revisar missões selecionadas',exact:true}).waitFor();await page.waitForTimeout(100);
check(await page.getByRole('heading',{name:'Revisar missões selecionadas',exact:true}).evaluate(e=>e===document.activeElement),'focus enters review');
await panel.getByLabel('Título',{exact:true}).fill('Título fictício longo '+ 'normalização '.repeat(12));
check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'long editable title fits mobile');
if(process.env.UI_SCREENSHOT_DIRECTORY) await panel.locator('form').screenshot({path:process.env.UI_SCREENSHOT_DIRECTORY+'/2d4-review-mobile.png'});
await page.setViewportSize({width:1440,height:1000});
if(process.env.UI_SCREENSHOT_DIRECTORY) await panel.locator('form').screenshot({path:process.env.UI_SCREENSHOT_DIRECTORY+'/2d4-review-desktop.png'});
await panel.getByLabel('Título',{exact:true}).fill('');check(!(await panel.locator('form').evaluate(e=>e.checkValidity())),'empty title fails native validation');
await panel.getByRole('button',{name:'Voltar à seleção',exact:true}).click();await page.waitForTimeout(100);check(await panel.getByRole('button',{name:'Revisar selecionadas (1)',exact:true}).evaluate(e=>e===document.activeElement),'cancel restores focus');
check(await panel.getByRole('checkbox',{name:'Selecionar sugestão 5',exact:true}).isChecked(),'cancel preserves selection');
console.log('REVIEW_CHECKS='+n);
}finally{await browser.close();}
