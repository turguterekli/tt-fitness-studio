// 50 üyelik yük testi: yönetici 50 üye ekler, program/paket atar; her üye giriş yapıp sözleşmeyi
// onaylar, öğün ekler, mesaj yazar; sonra yönetici tarafı ve 8 gün sonrası (yoklama) kontrol edilir.
const { newContext, openPage, login } = require('./lib');
const N = 50;
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+extra:'')); };
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('__fakeStore')));
const wait = (page, ms) => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms).catch(()=>{});
const ready = page => page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none');
const clean = errs => errs.filter(e=>!/ERR_FAILED|Postür modeli|status of 404/.test(e));
const names = Array.from({length:N}, (_,i) => `Üye ${String(i+1).padStart(2,'0')} Test`);
const phones = Array.from({length:N}, (_,i) => `0530 ${String(100+i)} ${String(10+i%90)} ${String(10+(i*7)%90)}`);
const times = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
const daysOf = i => [i % 7, (i + 2) % 7, (i + 4) % 7];

(async () => {
  const { browser, ctx } = await newContext({});
  const T0 = '2026-11-11T09:00:00'; // Çarşamba sabahı
  const A = await openPage(ctx, { time: T0 });
  const admin = A.page;
  await login(admin, 'admin1', 'tt2026');

  // ---- 1) Yönetici 50 üye ekler (form üzerinden) ----
  let t = Date.now();
  for (let i = 0; i < N; i++) {
    await admin.evaluate(() => openAddMemberScreen());
    await admin.fill('#newMemberName', names[i]);
    await admin.fill('#newMemberPhone', phones[i]);
    await admin.evaluate(() => adminCreateMember());
  }
  const codes = await admin.evaluate(ns => ns.map(n => (members.find(m => m.name === n) || {}).activationCode), names);
  check(`admin created ${N} members`, codes.every(Boolean) && codes.length === N, `${Date.now()-t} ms`);
  await admin.evaluate(() => { openAddMemberScreen(); });
  await admin.fill('#newMemberName', names[0]); await admin.fill('#newMemberPhone', '0599 000 00 00');
  await admin.evaluate(() => adminCreateMember());
  check('duplicate member name rejected', (admin.__dialogs || []).some(d => d.includes('zaten var')));

  // ---- 2) Her üyeye program + 12 derslik paket (program atama formu) ----
  t = Date.now();
  for (let i = 0; i < N; i++) {
    await admin.evaluate(({ name, ds, time }) => {
      openAdminSubScreen('assignprogram'); switchAssignMode('single');
      document.getElementById('ptProgMember').value = name;
      document.querySelectorAll('.progDayBox').forEach(b => { b.checked = ds.includes(parseInt(b.value, 10)); });
      ds.forEach(d => onProgDayToggle(d));
      ds.forEach(d => { document.getElementById('progTime-' + d).value = time; });
      document.getElementById('progPackageSize').value = 12;
      adminAssignProgram();
      if (document.getElementById('customConfirmOverlay').style.display === 'flex') closeCustomConfirm(true); // çakışma uyarısı
    }, { name: names[i], ds: daysOf(i), time: times[i % times.length] });
  }
  const assigned = await admin.evaluate(ns => ns.filter(n => (memberPrograms[n] || []).length === 3 && memberPackages[n] && memberPackages[n].size === 12).length, names);
  check('program + package assigned to all', assigned === N, `${assigned}/${N}, ${Date.now()-t} ms`);

  // ---- 3) Diğer yönetici işlemleri ----
  await admin.evaluate(() => { switchAdminTab('announce'); switchCommTab('announce'); document.getElementById('announceTarget').value = 'all'; document.getElementById('announceMessage').value = 'Cuma günü salon 18:00\'de kapanacaktır.'; sendAnnouncement(); });
  check('announcement sent', await admin.evaluate(() => announcements.length === 1));
  await admin.evaluate(n => { openAdminSubScreen('progresstrack'); document.getElementById('progressAdminMember').value = n; document.getElementById('measWaist').value = '88'; adminAddMeasurement(); }, names[0]);
  check('measurement added for a member', await admin.evaluate(n => (memberMeasurements[n] || []).length === 1, names[0]));
  await admin.evaluate(() => { switchAdminTab('finance'); setFinanceType('income'); document.getElementById('financeAmount').value = '1500'; addFinanceEntry(); });
  check('finance entry added', await admin.evaluate(() => financeEntries.length === 1));
  for (const i of [0, 7, 23, 49]) await admin.evaluate(n => { adjustConsumptionByName(n, 'water', 1); addCreditsByName && 0; }, names[i]);
  check('water consumption adjusted', await admin.evaluate(n => members.find(m => m.name === n).water === 1, names[49]));
  // üye kartından ödeme ekleme (5 üye)
  let paid = 0;
  for (const i of [0, 12, 24, 36, 49]) {
    paid += await admin.evaluate(n => {
      switchAdminTab('members'); memberTrainerFilter = 'Turgut Terekli'; if (!expandedMembers.has(n)) toggleMemberCard(n);
      if (!expandedMemberPayments.has(n)) toggleMemberPaymentsSection(n);
      const inp = [...document.querySelectorAll('[id^="paymentAmount-"]')].find(el => el.offsetParent !== null);
      if (!inp) return 0;
      const mi = inp.id.split('-')[1]; inp.value = '2500'; adminAddPayment(n, parseInt(mi, 10)); toggleMemberCard(n);
      return (memberPayments[n] || []).length ? 1 : 0;
    }, names[i]).catch(() => 0);
  }
  check('payments recorded from member cards', paid === 5, `${paid}/5`);
  await wait(admin, 2500);

  // ---- 4) Her üye: aktivasyon, sözleşme, öğün, mesaj, hedef (ikinci cihaz) ----
  const B = await openPage(ctx, { time: T0 });
  const mp = B.page;
  let ok = { login: 0, gate: 0, home: 0, pkg: 0, meal: 0, msg: 0, notif: 0, next: 0 };
  t = Date.now();
  for (let i = 0; i < N; i++) {
    if (!(await mp.isVisible('#logged-out-screen'))) await mp.evaluate(() => logOut());
    await login(mp, phones[i].replace(/\s/g, ''), codes[i]);
    if (await mp.isVisible('#member-app')) ok.login++; else continue;
    if (await mp.isVisible('#view-contractgate')) {
      ok.gate++;
      await mp.selectOption('#gateBirthDay', String(1 + i % 28)); await mp.selectOption('#gateBirthMonth', String(1 + i % 12)); await mp.selectOption('#gateBirthYear', String(1975 + i % 25));
      await mp.check('#contractAcceptCheckbox'); await mp.check('#kvkkReadCheckbox');
      if (i % 5 === 0) { await mp.check('#healthDeclHas'); await mp.fill('#healthDeclDetails', 'bel fıtığı'); await mp.check('#healthConsentCheckbox'); }
      if (i % 3 === 0) await mp.check('#photoConsentCheckbox');
      await mp.click('#contractAcceptBtn');
    }
    await mp.evaluate(() => skipOnboarding());
    if (await mp.isVisible('#view-home')) ok.home++;
    if ((await mp.textContent('#nextClassBody')).includes('Antrenman') || (await mp.textContent('#nextClassBody')).includes('Ders')) ok.next++;
    if ((await mp.textContent('#notificationCenterList')).includes('18:00')) ok.notif++;
    await mp.evaluate(() => switchTab('membership'));
    if (await mp.evaluate(() => sessionsTotal === 12)) ok.pkg++;
    await mp.evaluate(() => switchTab('nutrition'));
    await mp.click('.meal-block >> nth=' + (i % 4) + ' >> .meal-add');
    await mp.fill('#addName-' + (i % 4), 'Tavuk göğsü'); await mp.fill('#addCal-' + (i % 4), '250');
    await mp.click('#confirmAddMealBtn-' + (i % 4));
    await wait(mp, 150);
    if (await mp.evaluate(() => Object.values(getMemberMeals(currentMemberName)).flat().length === 1)) ok.meal++;
    await mp.evaluate(() => openMemberSubScreen('messages'));
    await mp.fill('#myMessageInput', 'Merhaba, ben ' + names[i]); await mp.click('#view-messages button:has-text("Gönder")');
    if (await mp.evaluate(() => (memberMessages[currentMemberName] || []).length === 1)) ok.msg++;
    await mp.evaluate(() => { switchTab('home'); document.getElementById('goalInput').value = 'Hedefim'; saveGoalNote(); });
    await mp.evaluate(() => flushAllAutosaves());
  }
  const perMember = Math.round((Date.now() - t) / N);
  check(`all ${N} members activated with their code`, ok.login === N, `${ok.login}/${N}`);
  check('all saw the contract screen on first login', ok.gate === N, `${ok.gate}/${N}`);
  check('all reached home after accepting', ok.home === N, `${ok.home}/${N}`);
  check('all see their next class', ok.next === N, `${ok.next}/${N}`);
  check('all see the announcement', ok.notif === N, `${ok.notif}/${N}`);
  check('all see their 12-session package', ok.pkg === N, `${ok.pkg}/${N}`);
  check('all added a meal', ok.meal === N, `${ok.meal}/${N}`);
  check('all sent a message', ok.msg === N, `${ok.msg}/${N} (${perMember} ms/üye)`);
  await mp.evaluate(() => logOut());
  await wait(mp, 3000);

  // ---- 5) Yönetici cihazı (hiç yenilenmeden) her şeyi canlı görmeli ----
  const live = await admin.evaluate(ns => ({
    active: ns.filter(n => (members.find(m => m.name === n) || {}).status === 'active').length,
    msgs: ns.filter(n => (memberMessages[n] || []).length === 1).length,
    unread: ns.filter(n => adminMessageUnread[n]).length,
    meals: ns.filter(n => Object.values(memberMeals[n] || {}).flat().length === 1).length,
    contracts: ns.filter(n => contractAccepted[n]).length,
    consents: ns.filter(n => consentRecords[n] && consentRecords[n].kvkkRead).length,
    health: ns.filter(n => healthDeclarations[n] && healthDeclarations[n].hasCondition).length,
    goals: ns.filter(n => goalNotes[n] === 'Hedefim').length,
    programs: ns.filter(n => (memberPrograms[n] || []).length === 3).length,
    payments: ns.filter(n => (memberPayments[n] || []).length === 1).length,
  }), names);
  check('admin device sees everything live (no reload)', live.active === N && live.msgs === N && live.unread === N && live.meals === N && live.contracts === N && live.consents === N && live.goals === N, JSON.stringify(live));
  check('admin data not overwritten by member devices', live.programs === N && live.payments === 5 && live.health === N / 5, JSON.stringify({ programs: live.programs, payments: live.payments, health: live.health }));

  // ---- 6) Yönetici ekranları 50 üyeyle ----
  const views = ['home','consumption','classes','members','analytics','announce','finance'];
  const subs = ['consumptionmembers','attendancelog','assignprogram','editmember','availability','mealreminder','mealreview','progresstrack','contractdoc'];
  const timings = {};
  for (const v of views) timings[v] = await admin.evaluate(v => { const s = performance.now(); switchAdminTab(v); return Math.round(performance.now() - s); }, v);
  for (const v of subs) timings[v] = await admin.evaluate(v => { const s = performance.now(); openAdminSubScreen(v); return Math.round(performance.now() - s); }, v);
  timings.refreshAll = await admin.evaluate(() => { const s = performance.now(); refreshAllViews(); return Math.round(performance.now() - s); });
  const slow = Object.entries(timings).filter(([, ms]) => ms > 1000);
  check('every admin screen opens with 50 members', true, Object.entries(timings).map(([k, v]) => k + ':' + v).join(' '));
  check('no admin screen slower than 1 s', slow.length === 0, slow.map(([k, v]) => k + ':' + v + 'ms').join(' '));
  await admin.evaluate(() => { switchAdminTab('members'); });
  const listed = await admin.evaluate(ns => { let c = 0; ['Turgut Terekli', 'Seray Atagan'].forEach(tr => { switchMemberTrainerTab(tr); c += ns.filter(n => document.getElementById('memberProfileList').textContent.includes(n)).length; }); return c; }, names);
  check('all 50 members listed on Members screen', listed === N, `${listed}/${N}`);
  await admin.evaluate(() => openAdminSearch());
  await admin.fill('#adminSearchGlobalInput', 'Üye 37');
  check('admin search finds a member', (await admin.textContent('#adminGlobalSearchResults')).includes('Üye 37 Test'));
  await admin.evaluate(() => { switchAdminTab('announce'); switchCommTab('messages'); });
  check('admin message list shows 50 threads', await admin.evaluate(ns => ns.filter(n => document.getElementById('adminMessagesList') ? document.getElementById('adminMessagesList').textContent.includes(n) : document.getElementById('commSection-messages').textContent.includes(n)).length, names) === N);
  await admin.evaluate(n => { openAdminMessageThread(n); document.getElementById('adminMessageInput').value = 'Hoş geldin!'; sendAdminMessage(); }, names[10]);
  await admin.evaluate(n => { navigateToAdminScreen('mealreview'); toggleMealCard(n); }, names[20]);
  check('admin sees a member\'s meal', (await admin.textContent('#adminMealList')).includes('Tavuk göğsü'));
  await admin.evaluate(n => { navigateToAdminScreen('contractdoc'); }, names[5]);
  const exportsOk = await admin.evaluate(() => { try { exportMembersCSV(); exportFinanceCSV(); downloadSummaryReportPDF(); return true; } catch (e) { return String(e); } });
  check('CSV / PDF exports run', exportsOk === true, String(exportsOk));
  await wait(admin, 2500);

  // ---- 7) Bulut kayıtları ----
  let s = await store(admin);
  const sizes = Object.entries(s).map(([k, v]) => [k, JSON.stringify(v).length]).sort((a, b) => b[1] - a[1]);
  check('member docs in cloud', Object.keys(s).filter(k => k.startsWith('members/')).length === N + 5, String(Object.keys(s).filter(k => k.startsWith('members/')).length));
  check('largest cloud doc well under 1 MB limit', sizes[0][1] < 300000, sizes.slice(0, 3).map(([k, v]) => k.split('/')[1] + ':' + Math.round(v / 1024) + 'KB').join(' '));
  check('no JS errors so far', clean(A.errors).length === 0 && clean(B.errors).length === 0, [...clean(A.errors), ...clean(B.errors)].slice(0, 3).join(' | '));
  await admin.close(); await mp.close();

  // ---- 8) 8 gün sonra: yoklama ve ders hakları ----
  const T1 = '2026-11-19T12:00:00'; // sonraki haftanın Perşembesi
  const C = await openPage(ctx, { time: T1 });
  await wait(C.page, 6000);
  s = await store(C.page);
  const start = new Date('2026-11-11T00:00:00'), end = new Date(T1);
  const expected = i => { let c = 0; for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { const di = (d.getDay() + 6) % 7; if (!daysOf(i).includes(di)) continue; const [h] = times[i % times.length].split(':').map(Number); const occ = new Date(d); occ.setHours(h, 0, 0, 0); if (occ <= end) c++; } return c; };
  const wrong = [];
  for (let i = 0; i < N; i++) { const used = (s['app_data/memberPackages'][names[i]] || {}).used || 0; if (used !== expected(i)) wrong.push(`${names[i]}: ${used}≠${expected(i)}`); }
  const totalExp = names.reduce((a, _, i) => a + expected(i), 0);
  const logCount = Object.keys(s['app_data/state_attendanceLog'] || {}).filter(k => k.startsWith('Üye ')).length;
  check('after 8 days: every member\'s used sessions are exactly right', wrong.length === 0, wrong.slice(0, 4).join('; ') || `toplam ${totalExp} ders`);
  check('attendance log has one entry per class held', logCount === totalExp, `${logCount}/${totalExp}`);
  await login(C.page, 'admin1', 'tt2026');
  await C.page.evaluate(() => openAdminSubScreen('attendancelog'));
  check('admin attendance screen lists members', (await C.page.textContent('#attendanceLogList')).includes('Üye 01 Test'));
  await C.page.evaluate(() => logOut());
  await login(C.page, phones[3].replace(/\s/g, ''), codes[3]);
  await C.page.evaluate(() => skipOnboarding());
  check('member sees remaining sessions after a week', await C.page.evaluate(n => sessionsUsed === memberPackages[n].used && sessionsUsed > 0, names[3]));
  check('member login with activation code still works as password', await C.page.isVisible('#member-app'));
  check('no JS errors (later session)', clean(C.errors).length === 0, clean(C.errors).slice(0, 3).join(' | '));

  console.log(results.join('\n'));
  await browser.close();
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
