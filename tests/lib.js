const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');
const FAKE = fs.readFileSync(path.join(__dirname,'fake-firebase.js'),'utf8');
const JSPDF = fs.readFileSync(path.join(__dirname,'node_modules/jspdf/dist/jspdf.umd.min.js'),'utf8');
async function newContext(opts={}){
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, ...(opts.ctx||{}) });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if(u.hostname==='app.test'){
      const f = path.join(REPO, decodeURIComponent(u.pathname));
      if(fs.existsSync(f) && fs.statSync(f).isFile()){
        const ext = path.extname(f); const ct = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png'}[ext]||'application/octet-stream';
        return route.fulfill({ status:200, body: fs.readFileSync(f), contentType: ct });
      }
      return route.fulfill({ status:404, body:'not found' });
    }
    if(u.hostname==='www.gstatic.com'){
      return route.fulfill({ status:200, contentType:'application/javascript', body: u.pathname.includes('firebase-app-compat') ? FAKE : '' });
    }
    if(u.hostname==='cdnjs.cloudflare.com' && u.pathname.includes('jspdf')) return route.fulfill({status:200, contentType:'application/javascript', body:JSPDF});
    if(u.hostname==='cdn.jsdelivr.net') return route.fulfill({status:200, contentType:'application/javascript', body:'export const PoseLandmarker={createFromOptions:async()=>{throw new Error("offline")}};export const FilesetResolver={forVisionTasks:async()=>({})};'});
    return route.abort();
  });
  // seed: sahte veritabanının başlangıç içeriği ({ 'koleksiyon/belge': {...} })
  if(opts.rules) await ctx.addInitScript(r => localStorage.setItem('__fakeRules', r), opts.rules);
  if(opts.seed) await ctx.addInitScript(s => { if(!localStorage.getItem('__fakeStore')) localStorage.setItem('__fakeStore', s); }, JSON.stringify(opts.seed));
  return { browser, ctx };
}
// Aynı bağlamda yeni bir sayfa ("cihaz") açar. opts.time verilirse sayfanın saati o ana sabitlenir
// ve page.clock ile ileri alınabilir.
async function openPage(ctx, opts={}){
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  page.on('console', m => { if(m.type()==='error') errors.push('CONSOLE: '+m.text()); });
  page.on('dialog', async d => { (page.__dialogs ||= []).push(d.type()+': '+d.message()); if(d.type()==='prompt') await d.accept(page.__promptAnswer||''); else await d.accept(); });
  if(opts.time) await page.clock.install({ time: new Date(opts.time) });
  await page.goto('http://app.test/index.html');
  await page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none', null, {timeout:15000});
  return { page, errors };
}
async function open(opts={}){
  const { browser, ctx } = await newContext(opts);
  const { page, errors } = await openPage(ctx, opts);
  return { browser, ctx, page, errors };
}
async function login(page, user, pass){
  await page.fill('#loginPhoneInput', user); await page.fill('#loginPasswordInput', pass);
  try{ await page.evaluate(() => loginMember()); }catch(e){ console.log('LOGIN THROW', e.message.split('\n').slice(0,3).join(' | ')); }
  await page.waitForTimeout(400);
}
module.exports = { open, login, newContext, openPage };
