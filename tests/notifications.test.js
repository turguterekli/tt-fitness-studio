// Bildirim testi: su, motivasyon, ödeme, ders, öğün, mesaj/duyuru hatırlatmaları; ayarlar; izin akışı;
// mağaza uygulamasında önceden kurulan hatırlatmalar. Sahte Firebase + sahte saat + sahte bildirim API'si.
const { newContext, openPage, login } = require('./lib');
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+String(extra).slice(0,240):'')); };
const wait = (page, ms) => page.waitForTimeout(ms);
const CONSENT = n => `consentRecords[${n}] = { contract: true, kvkkRead: true, abroad: true, health: true, textVersion: LEGAL_TEXT_VERSION }; contractAccepted[${n}] = true; contractAcceptedVersion[${n}] = CONTRACT_VERSION; getMemberProfile(${n}).birthday = '1990-01-01';`;

// Tarayıcının bildirim API'sini taklit eder; gösterilen her bildirimi window.__notifs'e yazar
const fakeWebNotifications = (perm) => {
  window.__notifs = []; window.__permAsked = 0;
  class FakeNotification { constructor(title, opts){ window.__notifs.push((opts && opts.body) || title); } }
  FakeNotification.permission = perm;
  FakeNotification.requestPermission = async () => { window.__permAsked++; FakeNotification.permission = 'granted'; return 'granted'; };
  Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true, writable: true });
};
// Mağaza uygulamasını (Capacitor + yerel bildirim eklentisi) taklit eder
const fakeNativeApp = () => {
  const pending = new Map(); window.__lnLog = [];
  window.__lnPerm = 'prompt';
  window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: {
    checkPermissions: async () => ({ display: window.__lnPerm }),
    requestPermissions: async () => { window.__lnPerm = 'granted'; return { display: 'granted' }; },
    schedule: async ({ notifications }) => { notifications.forEach(n => { pending.set(n.id, n); window.__lnLog.push(n); }); return { notifications: notifications.map(n => ({ id: n.id })) }; },
    getPending: async () => ({ notifications: [...pending.values()] }),
    cancel: async ({ notifications }) => { notifications.forEach(n => pending.delete(n.id)); },
  } } };
  window.__lnPending = () => [...pending.values()];
};

(async () => {
  // ================= A) Web: izin verilmiş =================
  {
    const { browser, ctx } = await newContext({});
    await ctx.addInitScript(fakeWebNotifications, 'granted');
    const { page } = await openPage(ctx, { time: '2026-11-25T10:30:00' }); // Çarşamba
    const notifs = () => page.evaluate(() => window.__notifs.slice());
    const bell = () => page.evaluate(() => notificationCenterItems.map(n => n.id).join(','));
    await login(page, '0542 249 32 27', '1234');
    await page.evaluate(new Function(CONSENT("currentMemberName") + " skipOnboarding(); refreshAllViews();"));
    await page.evaluate(() => {
      const n = currentMemberName;
      memberPrograms[n] = [{ day: 2, time: '13:00', name: 'Antrenman', trainer: 'Turgut Terekli', room: 'TT' }];
      memberPackages[n] = { size: 12, used: 3, start: '2026-11-01', end: '2026-11-27' };
      mealReminders[n] = ['14:00'];
      sessionsTotal = 12; sessionsUsed = 3; renderMembership(); runTimeChecks();
    });
    await wait(page, 300);
    let n = await notifs();
    check('A1 10:30 → water reminder shown on the phone', n.some(x => x.includes('Su içmeyi')), n.join(' | '));
    const snapshotA1 = n.slice();
    check('A1b no false "0 sessions left" warning for a member without a package', !snapshotA1.some(x => x.includes('0 ders hakkın')));
    check('A2 payment reminder (package ends in 2 days) shown', n.some(x => x.includes('Ödeme Hatırlatması') && x.includes('2 gün sonra')));
    check('A3 motivation NOT shown before 12:00', !n.some(x => x.includes('💪')) && !(await bell()).includes('motivation'));
    check('A4 water + payment also in the in-app bell', /water-/.test(await bell()) && (await bell()).includes('expiry'), await bell());
    await page.clock.fastForward('01:35:00'); // 12:05
    await page.evaluate(() => runTimeChecks()); await wait(page, 200);
    n = await notifs();
    check('A5 12:05 → class reminder (class at 13:00) shown', n.some(x => x.includes('dersin') && x.includes('13:00')), n.slice(-3).join(' | '));
    check('A6 12:05 → motivation message shown once', n.filter(x => x.startsWith('💪') || /bugün|alışkanlık|hareket|teşekkür/i.test(x) && !x.includes('Su')).length >= 1 && (await bell()).includes('motivation-2026-11-25'));
    const before = (await notifs()).length;
    await page.evaluate(() => { runTimeChecks(); runTimeChecks(); }); await wait(page, 200);
    check('A7 no duplicates on repeated checks', (await notifs()).length === before, `${before} → ${(await notifs()).length}`);
    // Ayarlar: su hatırlatmasını kapat
    await page.evaluate(() => openSettings()); await wait(page, 300);
    check('A8 settings list all 6 reminder types with switches', await page.evaluate(() => ['water','motivation','payment','classes','meals','messages'].every(k => document.getElementById('notifPref-' + k) && document.getElementById('notifPref-' + k).checked)));
    check('A9 settings show "notifications on" status, no permission button', (await page.textContent('#notifPermStatus')).includes('açık') && !(await page.isVisible('#notifPermBtn')));
    await page.uncheck('#notifPref-water');
    check('A10 preference saved to the member profile', await page.evaluate(() => getMemberProfile(currentMemberName).notif.water === false));
    await page.clock.fastForward('01:00:00'); // 13:05
    await page.evaluate(() => runTimeChecks()); await wait(page, 200);
    n = await notifs();
    check('A11 water reminder turned off → no water notification at 13:05', !n.slice(before).some(x => x.includes('Su içmeyi')), n.slice(before).join(' | '));
    check('A12 …but it still shows in the in-app bell', (await bell()).includes('water-2026-11-25-13'));
    await page.clock.fastForward('01:15:00'); // 14:20 — öğün hatırlatması 14:00'teydi
    await page.evaluate(() => runTimeChecks()); await wait(page, 200);
    check('A13 meal reminder (14:00) shown when app opened at 14:20', (await notifs()).some(x => x.includes('Öğün eklemeyi')));
    // Yönetici mesaj yazar ve duyuru gönderir (aynı tarayıcıda ikinci "cihaz")
    const B = await openPage(ctx, { time: '2026-11-25T14:20:00' });
    await B.page.evaluate(() => logOut()); // aynı tarayıcıda üye oturumu açık; yönetici olarak gir
    await login(B.page, 'admin1', 'tt2026');
    await B.page.evaluate(() => { memberMessages['Mert Aydın'] = (memberMessages['Mert Aydın'] || []).concat([{ from: 'admin', text: 'Yarın ders 1 saat erken', date: '2026-11-25', time: '14:21' }]);
      announcements.push({ id: 99, target: 'all', message: 'Cuma salon kapalı', date: '2026-11-25' }); });
    await B.page.evaluate(() => flushAllAutosaves()); await wait(B.page, 2500);
    await page.evaluate(() => runTimeChecks()); await wait(page, 1500);
    n = await notifs();
    check('A14 new message from management → notification', n.some(x => x.includes('yeni bir mesajın var')), n.slice(-3).join(' | '));
    check('A15 new announcement → notification', n.some(x => x.includes('Cuma salon kapalı')));
    // Yenilemeden sonra aynı bildirimler tekrar gelmemeli
    const count = (await notifs()).length;
    await page.reload(); await page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display === 'none'); await wait(page, 1500);
    await page.evaluate(() => logOut()); await login(page, '0542 249 32 27', '1234'); await page.evaluate(() => skipOnboarding());
    await page.evaluate(() => runTimeChecks()); await wait(page, 500);
    const after = await page.evaluate(() => window.__notifs.slice());
    check('A16 after reload: no repeat of today\'s notifications', !after.some(x => x.includes('yeni bir mesajın var') || x.includes('Cuma salon') || x.startsWith('💪')), after.join(' | '));
    await browser.close();
  }

  // ================= B) Web: izin henüz verilmemiş =================
  {
    const { browser, ctx } = await newContext({});
    await ctx.addInitScript(fakeWebNotifications, 'default');
    const { page } = await openPage(ctx, { time: '2026-11-25T10:30:00' });
    await login(page, '0542 249 32 27', '1234');
    await page.evaluate(new Function(CONSENT("currentMemberName") + " skipOnboarding(); switchTab('home'); runTimeChecks(); renderNotifPromptCard();"));
    await wait(page, 400);
    check('B1 without permission: no system notification and NO automatic permission prompt', await page.evaluate(() => window.__notifs.length === 0 && window.__permAsked === 0));
    check('B2 home screen shows the "turn on reminders" card', await page.isVisible('#notifPromptCard'));
    await page.click('#notifPromptCard button:has-text("İzin ver")'); await wait(page, 300);
    check('B3 tapping "İzin ver" asks for permission and hides the card', await page.evaluate(() => window.__permAsked === 1) && !(await page.isVisible('#notifPromptCard')));
    await page.clock.fastForward('03:00:00'); // 13:30 → su (13) bildirimi
    await page.evaluate(() => runTimeChecks()); await wait(page, 300);
    check('B4 after permission: reminders arrive on the phone', await page.evaluate(() => window.__notifs.some(x => x.includes('Su içmeyi'))));
    await browser.close();
  }

  // ================= D) Aynı metinli hatırlatmalar gün içinde tekrar ulaşmalı =================
  {
    const { browser, ctx } = await newContext({});
    await ctx.addInitScript(fakeWebNotifications, 'granted');
    const { page } = await openPage(ctx, { time: '2026-11-25T10:05:00' });
    await login(page, '0542 249 32 27', '1234');
    await page.evaluate(new Function(CONSENT("currentMemberName") + " skipOnboarding(); runTimeChecks();"));
    await wait(page, 300);
    const water = () => page.evaluate(() => window.__notifs.filter(x => x.includes('Su içmeyi')).length);
    check('D1 10:05 → first water reminder', await water() === 1);
    for (const hm of ['13:05', '16:05', '19:05']) { await page.clock.fastForward('03:00:00'); await page.evaluate(() => runTimeChecks()); await wait(page, 200); }
    check('D2 13:05, 16:05, 19:05 → each water reminder reaches the phone (4 in total)', await water() === 4, String(await water()));
    await browser.close();
  }

  // ================= C) Mağaza uygulaması: önceden kurulan hatırlatmalar =================
  {
    const { browser, ctx } = await newContext({});
    await ctx.addInitScript(fakeNativeApp);
    const { page, errors } = await openPage(ctx, { time: '2026-11-25T10:30:00' });
    await login(page, '0542 249 32 27', '1234');
    await page.evaluate(new Function(CONSENT("currentMemberName") + " skipOnboarding();"));
    await page.evaluate(() => { const n = currentMemberName;
      memberPrograms[n] = [{ day: 0, time: '20:00', name: 'Antrenman', trainer: 'Turgut Terekli', room: 'TT' }, { day: 2, time: '20:00', name: 'Antrenman', trainer: 'Turgut Terekli', room: 'TT' }];
      memberPackages[n] = { size: 12, used: 3, start: '2026-11-01', end: '2026-12-05' }; mealReminders[n] = ['08:30', '13:00']; });
    check('C1 nothing scheduled before permission', await page.evaluate(() => window.__lnPending().length === 0));
    await page.evaluate(() => requestNotificationPermission()); await wait(page, 1500);
    const plan = await page.evaluate(() => window.__lnPending().map(n => ({ id: n.id, body: n.body, on: n.schedule.on, at: n.schedule.at ? new Date(n.schedule.at).toISOString() : null })));
    const ids = plan.map(p => p.id);
    check('C2 water: 4 daily repeating reminders (10/13/16/19)', plan.filter(p => p.body.includes('Su içmeyi') && p.on).map(p => p.on.hour).join(',') === '10,13,16,19');
    check('C3 meals: daily reminders at the trainer\'s times', plan.filter(p => p.body.includes('Öğün') && p.on).map(p => p.on.hour + ':' + p.on.minute).join(',') === '8:30,13:0');
    check('C4 motivation: one per day for the next 14 days, different messages', plan.filter(p => p.id >= 2001 && p.id <= 2014).length === 14 && new Set(plan.filter(p => p.id >= 2001 && p.id <= 2014).map(p => p.body)).size > 1);
    const cls = plan.filter(p => p.id >= 3001 && p.id <= 3060);
    check('C5 classes: 1 hour before each class, next 2 weeks (Mon+Wed → 4)', cls.length === 4 && cls.every(p => new Date(p.at).getHours() === 19), cls.map(p => p.at).join(','));
    check('C6 payment: 3 days before, on the day, 1 day after the package ends', plan.filter(p => p.id >= 4001 && p.id <= 4003).length === 3);
    check('C7 within the phone\'s limit (iPhone: 64 pending)', plan.length <= 64 && ids.every(i => i >= 1000 && i <= 4999), String(plan.length));
    await page.evaluate(() => { openSettings(); }); await wait(page, 300);
    check('C8 settings: native status says reminders arrive even when the app is closed', (await page.textContent('#notifPermStatus')).includes('kapalıyken'));
    await page.uncheck('#notifPref-water'); await wait(page, 1500);
    check('C9 turning water off removes those 4 reminders from the phone', await page.evaluate(() => !window.__lnPending().some(n => n.body.includes('Su içmeyi'))));
    await page.evaluate(() => { memberPrograms[currentMemberName].push({ day: 4, time: '18:00', name: 'Antrenman', trainer: 'Turgut Terekli', room: 'TT' }); refreshAllViews(); }); await wait(page, 1500);
    check('C10 program change (admin adds a Friday class) → reminders updated', await page.evaluate(() => window.__lnPending().filter(n => n.id >= 3001 && n.id <= 3060).length === 6));
    check('C11 no double notifications: scheduled reminders are not also shown instantly', await page.evaluate(() => !window.__lnLog.some(n => n.id >= 900000 && /Su içmeyi|💪|Öğün/.test(n.body))));
    await page.evaluate(() => logOut()); await wait(page, 800);
    check('C12 logout removes all reminders from the device', await page.evaluate(() => window.__lnPending().filter(n => n.id >= 1000 && n.id <= 4999).length === 0));
    const errs = errors.filter(e => !/ERR_FAILED|Postür|404/.test(e));
    check('C13 no JS errors', errs.length === 0, errs.join(' | '));
    await browser.close();
  }

  console.log(results.join('\n'));
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
