// Repoya alınan GERÇEK Firebase SDK ve jsPDF dosyalarının yüklenip çalıştığını ve sayfanın
// artık yabancı sunuculara (Google Fonts, CDN) istek atmadığını doğrular.
const { newContext } = require('./lib');
(async () => {
  const { browser, ctx } = await newContext({ realSdk: true });
  const page = await ctx.newPage();
  const external = [], pageErrors = [];
  page.on('request', r => { const h = new URL(r.url()).hostname; if(h !== 'localhost') external.push(h); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('http://localhost/index.html');
  await page.waitForTimeout(4000);
  const info = await page.evaluate(async () => ({
    sdk: typeof firebase !== 'undefined' && firebase.SDK_VERSION,
    firestore: typeof firebase.firestore === 'function' && typeof firebase.firestore.FieldPath === 'function' && typeof firebase.firestore.FieldValue.increment === 'function',
    auth: typeof firebase.auth === 'function', storage: typeof firebase.storage === 'function',
    tx: typeof db.runTransaction === 'function', snap: typeof db.collection('x').onSnapshot === 'function',
    jspdf: !!(window.jspdf && window.jspdf.jsPDF),
    fontsLoaded: await document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''))),
  }));
  const hosts = [...new Set(external)];
  const out = [
    ['real Firebase SDK 10.13.0 loaded from vendor/', info.sdk === '10.13.0', String(info.sdk)],
    ['firestore/auth/storage + FieldPath/FieldValue/transaction/onSnapshot available', info.firestore && info.auth && info.storage && info.tx && info.snap],
    ['jsPDF loaded from vendor/', info.jspdf],
    ['self-hosted fonts loaded', info.fontsLoaded.includes('Oswald') && info.fontsLoaded.includes('IBM Plex Sans'), [...new Set(info.fontsLoaded)].join(',')],
    ['no requests to Google Fonts / CDNs on page load', !hosts.some(h => /fonts\.g|gstatic|cdnjs|jsdelivr|storage\.googleapis/.test(h)), hosts.join(',')],
    ['only Firebase API hosts contacted', hosts.every(h => /(^|\.)googleapis\.com$/.test(h)), hosts.join(',')],
    ['no script errors', pageErrors.length === 0, pageErrors.join(' | ')],
  ];
  out.forEach(([n, ok, extra]) => console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')));
  await browser.close();
  if(out.some(o => !o[1])) process.exit(1);
})();
