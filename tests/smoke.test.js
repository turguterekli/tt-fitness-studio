const { open, login } = require('./lib');
const ROLE = process.argv[2] || 'member';
(async () => {
  const { browser, page, errors } = await open();
  page.__promptAnswer = '5';
  const creds = ROLE==='member' ? ['0542 249 32 27','1234'] : ROLE==='admin2' ? ['admin2','tt2026'] : ['admin1','tt2026'];
  const ensure = async () => {
    const ok = await page.evaluate(r => { const id = r==='member'?'member-app':'admin-app'; const e=document.getElementById(id); return e && getComputedStyle(e).display!=='none'; }, ROLE);
    if(!ok){ await login(page, ...creds); }
    if(ROLE==='member') await page.evaluate(()=>{ if(!contractAccepted[currentMemberName]){ contractAccepted[currentMemberName]=true; contractAcceptedVersion[currentMemberName]=CONTRACT_VERSION; getMemberProfile(currentMemberName).birthday='1990-01-01'; } document.getElementById('hamburgerBtn').style.visibility='visible'; document.getElementById('memberSearchBtn').style.visibility='visible'; skipOnboarding(); });
  };
  await ensure();
  const root = ROLE==='member' ? '#screen' : '#admin-screen';
  const views = await page.evaluate(r => [...document.querySelectorAll(r==='#screen' ? '#screen .view' : '#admin-screen .aview')].map(v=>v.id), root);
  const nav = id => ROLE==='member'
    ? `(['home','program','nutrition','membership','progress','trainers'].includes('${id.replace('view-','')}') ? switchTab('${id.replace('view-','')}') : ('${id}'==='view-search'? openMemberSearch() : '${id}'==='view-settings' ? openSettings() : '${id}'==='view-guide' ? openGuide() : openMemberSubScreen('${id.replace('view-','')}')))`
    : `(['home','consumption','classes','members','analytics','announce','finance'].includes('${id.replace('admin-view-','')}') ? switchAdminTab('${id.replace('admin-view-','')}') : navigateToAdminScreen('${id.replace('admin-view-','')}'))`;
  const issues = [];
  for (const v of views) {
    if (v==='view-contractgate') continue;
    await ensure();
    try { await page.evaluate(nav(v)); } catch(e){ issues.push(`[${v}] NAV: ${e.message.split('\n')[0]}`); continue; }
    const n = await page.evaluate(v => [...document.querySelectorAll('#'+v+' [onclick], #'+v+' button, #'+v+' [onchange], #'+v+' [oninput]')].length, v);
    for (let i=0;i<n;i++){
      await ensure();
      try { await page.evaluate(nav(v)); } catch(e){}
      const before = errors.length;
      const info = await page.evaluate(([v,i]) => {
        const els = [...document.querySelectorAll('#'+v+' [onclick], #'+v+' button, #'+v+' [onchange], #'+v+' [oninput]')];
        const el = els[i]; if(!el) return null;
        const r = el.getBoundingClientRect(); const vis = r.width>0 && r.height>0;
        const desc = (el.getAttribute('onclick')||el.getAttribute('onchange')||el.getAttribute('oninput')||'').slice(0,80)+' «'+(el.textContent||'').trim().slice(0,30)+'»';
        if(!vis) return {desc, skipped:true};
        document.querySelectorAll('#'+v+' input[type=text], #'+v+' input:not([type]), #'+v+' textarea').forEach(x=>{ if(!x.value) x.value='X<img src=x onerror="window.__xss=(window.__xss||[]);window.__xss.push(1)">'; });
        if(el.tagName==='INPUT' && (el.type==='text'||el.type==='number'||el.type==='tel'||!el.type)) { el.value = el.type==='number' ? '3' : 'X<img src=x onerror="window.__xss=(window.__xss||[]);window.__xss.push(1)">'; }
        try { if(el.getAttribute('onclick') || el.tagName==='BUTTON') el.click(); if(el.getAttribute('onchange')) el.dispatchEvent(new Event('change',{bubbles:true})); if(el.getAttribute('oninput')) el.dispatchEvent(new Event('input',{bubbles:true})); }
        catch(e){ return {desc, err:e.message}; }
        return {desc};
      }, [v,i]);
      await page.waitForTimeout(60);
      const xs = await page.evaluate(()=>{const n=(window.__xss||[]).length; window.__xss=[]; return n;});
      if(xs) issues.push(`[${v}] XSS fired after ${info && info.desc}`);
      if(info && info.err) issues.push(`[${v}] ${info.desc} -> ${info.err}`);
      const newErr = errors.slice(before).filter(e=>!/ERR_FAILED|Postür modeli/.test(e));
      if(newErr.length) issues.push(`[${v}] ${info && info.desc} -> ${newErr.map(e=>e.split('\n')[0]).join(' || ')}`);
    }
  }
  await page.waitForTimeout(1500);
  console.log(`${ROLE}: ${issues.length} issues, views ${views.length}`); console.log([...new Set(issues)].join('\n'));
  console.log('writes', (await page.evaluate(()=>window.__writes.length)));
  await browser.close();
})();
