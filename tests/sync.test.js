// Çok cihazlı eşitleme, eski veriden aktarım ve tarih ilerlemesi testleri.
const { newContext, openPage, login } = require('./lib');
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+extra:'')); };
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('__fakeStore')));
const wait = (page, ms) => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms).catch(()=>{});

const AYSE = 'Ayşe Yılmaz';
const seed = {
  'members/adm': { name:'Turgut Terekli', phone:'admin1', password:'tt2026', role:'admin', adminScope:'full', trainerScope:null, status:'active' },
  'members/m1': { name:AYSE, phone:'0500 111 22 33', password:'abcd', role:'member', status:'active', joinDate:'2026-09-01' },
  'members/m2': { name:'Ali Veli', phone:'0500 111 22 44', password:'abcd', role:'member', status:'active', joinDate:'2026-09-01' },
  // ESKİ düzen: her şey tek belgede
  'app_data/appState': {
    memberMessages: { [AYSE]: [{ from:'member', text:'eski mesaj', date:'2026-11-01', time:'10:00' }] },
    contractAccepted: { [AYSE]: true, 'Ali Veli': true }, contractAcceptedVersion: { [AYSE]: 1, 'Ali Veli': 1 },
    memberProfiles: { [AYSE]: { name:AYSE, birthday:'1990-05-05', theme:'dark' }, 'Ali Veli': { name:'Ali Veli', birthday:'1991-01-01', theme:'dark' } },
    memberPrograms: { [AYSE]: [{ day:0, time:'10:00', name:'Antrenman', trainer:'Turgut Terekli', room:'TT Fitness' }] },
    announcements: [{ id: 77, target:'all', message:'Hoş geldiniz', date:'2026-11-10' }],
    notificationCenterItems: [{ id:'x', icon:'x', text:'herkese görünen eski ortak bildirim' }],
  },
  'app_data/memberPackages': { [AYSE]: { size:12, used:2, start:'2026-10-01', end:'2026-12-31' } },
};
const legacyJson = JSON.stringify(seed['app_data/appState']);

(async () => {
  const { browser, ctx } = await newContext({ seed });
  const T0 = '2026-11-11T12:00:00'; // Çarşamba
  const A = await openPage(ctx, { time: T0 }); // yönetici cihazı
  const B = await openPage(ctx, { time: T0 }); // üye cihazı
  const errors = () => [...A.errors, ...B.errors].filter(e=>!/ERR_FAILED|Postür modeli|status of 404/.test(e));

  await login(A.page, 'admin1', 'tt2026');
  await login(B.page, '0500 111 22 33', 'abcd');
  await B.page.evaluate(() => skipOnboarding());
  await wait(B.page, 2500);

  // ---- Eski veriden aktarım ----
  let s = await store(A.page);
  check('legacy data loaded (message)', await B.page.evaluate(n => (memberMessages[n]||[]).length === 1, AYSE));
  check('migrated to per-field docs', !!s['app_data/state_memberMessages'] && !!s['app_data/state_memberPrograms'] && Array.isArray(s['app_data/state_announcements'].items));
  check('legacy appState left untouched as backup', JSON.stringify(s['app_data/appState']) === legacyJson);
  check('no contract gate for already-accepted member', !(await B.page.isVisible('#view-contractgate')));
  check('old shared notification not shown', !(await B.page.textContent('#notificationCenterList')).includes('ortak bildirim'));

  // ---- Tarihler ----
  await B.page.evaluate(() => switchTab('program'));
  const chips = await B.page.$$eval('#dayRow .day-chip .n', els => els.map(e => e.textContent));
  check('day chips show real dates of this week', chips.join(',') === '9,10,11,12,13,14,15', chips.join(','));
  check('today (Wed) is selected', await B.page.$eval('#dayRow .day-chip.active .d', e => e.textContent) === 'ÇAR');

  // ---- Otomatik yoklama: Pazartesi 10:00 dersi geçmiş, iki cihaz açık → sadece 1 kez düşmeli ----
  s = await store(A.page);
  const logKeys = Object.keys(s['app_data/state_attendanceLog'] || {});
  check('attendance logged once for Mon class', logKeys.length === 1 && logKeys[0] === `${AYSE}|0|10:00|2026-11-09`, logKeys.join(';'));
  check('session deducted exactly once (2 -> 3)', s['app_data/memberPackages'][AYSE].used === 3, 'used=' + s['app_data/memberPackages'][AYSE].used);
  check('member device shows updated usage', await B.page.evaluate(() => sessionsUsed) === 3);
  check('attendanceCheckedUntil stored', s['app_data/state_appMeta'].attendanceCheckedUntil === '2026-11-11');

  // ---- İki cihaz aynı anda: birbirinin kaydını ezmemeli ----
  await B.page.evaluate(() => { getMemberMeals(currentMemberName)['Öğle'].push({ name:'Tavuk', cal:300, portion:1, photo:null, date: toLocalDateStr(getNow()) }); });
  await A.page.evaluate(() => { memberNotes['Ali Veli'] = 'dizine dikkat'; financeEntries.push({ date:'2026-11-11', type:'income', category:'Diğer Gelir', amount:100, note:'' }); });
  await wait(A.page, 2500);
  await A.page.evaluate(n => { memberMessages[n].push({ from:'admin', text:'yönetimden cevap', date:'2026-11-11', time:'12:01' }); }, AYSE);
  await B.page.evaluate(() => { goalNotes[currentMemberName] = '5 kilo'; });
  await wait(A.page, 2500);
  s = await store(A.page);
  check('member meal survived admin writes', (s['app_data/state_memberMeals'][AYSE]['Öğle']||[]).length === 1);
  check('admin note saved', s['app_data/state_memberNotes']['Ali Veli'] === 'dizine dikkat');
  check('admin message + old message both kept', s['app_data/state_memberMessages'][AYSE].length === 2);
  check('member goal saved', s['app_data/state_goalNotes'][AYSE] === '5 kilo');
  check('admin device received member meal live', await A.page.evaluate(n => getMemberMeals(n)['Öğle'].length === 1, AYSE));
  check('member device received admin message live', await B.page.evaluate(n => memberMessages[n].length === 2, AYSE));
  await B.page.evaluate(() => openMemberSubScreen('messages'));
  check('member screen shows admin message without reload', (await B.page.textContent('#myMessageThread')).includes('yönetimden cevap'));

  // Yönetici yeni üye ekler → üye cihazına da düşer; üye şifresini değiştirir → yönetici verisi ezilmez
  await A.page.evaluate(() => { members.push({ name:'Yeni Kişi', water:0, coffee:0, waterCredits:0, coffeeCredits:0, status:'pending', phone:'0500 999 88 77', activationCode:'123456', password:'123456', role:'member', group:null, joinDate:'2026-11-11' }); const m = members.find(x => x.name === 'Ali Veli'); m.waterCredits = 5; });
  await wait(A.page, 2500);
  await B.page.evaluate(() => { members.find(m => m.name === currentMemberName).password = 'yeni1'; });
  await wait(B.page, 2500);
  s = await store(A.page);
  const mdocs = Object.keys(s).filter(k => k.startsWith('members/')).map(k => s[k]);
  check('new member doc created', mdocs.some(m => m.name === 'Yeni Kişi'));
  check('admin credit change not reverted by member device', mdocs.find(m => m.name === 'Ali Veli').waterCredits === 5);
  check('member password change saved', s['members/m1'].password === 'yeni1');
  check('member device knows new member', await B.page.evaluate(() => members.some(m => m.name === 'Yeni Kişi')));

  // ---- Duyuru bildirimi: kapatınca yenilemeden sonra geri gelmemeli ----
  check('announcement shown as notification', (await B.page.textContent('#notificationCenterList')).includes('Hoş geldiniz'));
  await B.page.evaluate(() => dismissNotificationCenterItem('announce-77'));
  // ---- Sözleşme sürümü kalıcı olmalı ----
  await A.page.evaluate(() => { CONTRACT_VERSION++; appMeta.contractVersion = CONTRACT_VERSION; });
  await wait(A.page, 2500);

  // ---- Gün dönümü: uygulama açıkken ertesi güne geçilirse tarihler ilerlemeli ----
  await B.page.evaluate(() => switchTab('program'));
  await B.page.clock.fastForward('24:00:00');
  await wait(B.page, 500);
  check('after midnight: Thursday selected', await B.page.$eval('#dayRow .day-chip.active .d', e => e.textContent) === 'PER');

  await B.page.reload(); await B.page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none');
  check('contract gate shown after admin bumped version', await B.page.isVisible('#view-contractgate'));
  check('dismissed announcement stays dismissed after reload', !(await B.page.textContent('#notificationCenterList')).includes('Hoş geldiniz'));
  check('onboarding not repeated after reload', !(await B.page.isVisible('#onboardingOverlay')));
  check('contract version persisted', (await store(A.page))['app_data/state_appMeta'].contractVersion === 2);
  check('no JS errors (two devices)', errors().length === 0, errors().join(' | '));
  await A.page.close(); await B.page.close();

  // ---- Haftalarca kapalı kaldıktan sonra açılış: kaçırılan haftalar + yeni ay ----
  const C = await openPage(ctx, { time: '2026-12-02T12:00:00' }); // 3 hafta sonra, Çarşamba
  await wait(C.page, 2500);
  s = await store(C.page);
  const keys2 = Object.keys(s['app_data/state_attendanceLog']).sort();
  check('missed weeks caught up (Nov 16, 23, 30)', ['2026-11-16','2026-11-23','2026-11-30'].every(d => keys2.includes(`${AYSE}|0|10:00|${d}`)) && keys2.length === 4, keys2.join(';'));
  check('sessions deducted for each missed week (3 -> 6)', s['app_data/memberPackages'][AYSE].used === 6, 'used=' + s['app_data/memberPackages'][AYSE].used);
  if(!(await C.page.isVisible('#member-app'))) await login(C.page, '0500 111 22 33', 'yeni1');
  await C.page.evaluate(() => { if(document.getElementById('view-contractgate').classList.contains('active')){ contractAcceptedVersion[currentMemberName] = CONTRACT_VERSION; } });
  await wait(C.page, 2500);
  s = await store(C.page);
  check('new month: last month meals cleared', (s['app_data/state_memberMeals'][AYSE]['Öğle']||[]).length === 0);
  check('meal reset month stored', s['app_data/state_mealResetMonth'][AYSE] === '2026-12');
  const chips2 = await C.page.$$eval('#dayRow .day-chip .n', els => els.map(e => e.textContent));
  check('day chips advanced to December week', chips2.join(',') === '30,1,2,3,4,5,6', chips2.join(','));
  // aynı gün tekrar açılırsa tekrar düşmemeli
  await C.page.reload(); await C.page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none');
  await wait(C.page, 2500);
  check('no double deduction on reopen', (await store(C.page))['app_data/memberPackages'][AYSE].used === 6);
  const cerr = C.errors.filter(e=>!/ERR_FAILED|Postür modeli|status of 404/.test(e));
  check('no JS errors (later session)', cerr.length === 0, cerr.join(' | '));

  console.log(results.join('\n'));
  await browser.close();
  if(results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0,5).join('\n')); process.exit(1); });
