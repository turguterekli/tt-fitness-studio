// Güvenlik testi: bir saldırganın deneyeceği yollar. Sahte Firebase üzerinde çalışır.
// "KAPALI" = saldırı engellendi (test bunu doğrular). En sondaki "AÇIK" maddeler, yalnızca
// uygulama koduyla kapatılamayan, bilinen yapısal açıklardır (raporlanır, testi düşürmez).
const { newContext, openPage, login } = require('./lib');
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+extra:'')); };
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('__fakeStore')));
const wait = (page, ms) => page.waitForTimeout(ms);
const ready = page => page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none');
const clearDevice = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ttf_')).forEach(k => localStorage.removeItem(k)));
const XSS_DB = '"><img src=x onerror="window.__pwn=(window.__pwn||0)+1">';
const XSS = '"><img src=x onerror="window.__pwn=(window.__pwn||0)+1;window.__pwnTyped=1"><svg onload="window.__pwn=1;window.__pwnTyped=1">';
const memberDoc = (s, name) => Object.values(Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('members/')))).find(m => m.name === name);

(async () => {
  const { browser, ctx } = await newContext({});
  const { page } = await openPage(ctx, {});
  const reload = async () => { await page.reload(); await ready(page); await wait(page, 300); };

  // ================= 1) Şifre saklama =================
  await login(page, 'admin1', 'tt2026');
  await page.evaluate(() => { openAddMemberScreen(); });
  await page.fill('#newMemberName', 'Hedef Üye'); await page.fill('#newMemberPhone', '0531 000 00 01');
  await page.evaluate(() => adminCreateMember());
  const code = await page.evaluate(() => members.find(m => m.name === 'Hedef Üye').activationCode);
  await page.evaluate(() => flushAllAutosaves()); await wait(page, 1500);
  let s = await store(page);
  const adminDoc = memberDoc(s, 'Turgut Terekli');
  check('1.1 admin password no longer stored in plain text after login', !('password' in adminDoc) && adminDoc.pw && /^[0-9a-f]{64}$/.test(adminDoc.pw.h) && adminDoc.pw.i >= 100000, JSON.stringify(Object.keys(adminDoc.pw || {})));
  check('1.2 stored hash does not contain the password', !JSON.stringify(adminDoc).includes('tt2026'));
  await page.evaluate(() => logOut());

  // ================= 2) İlk girişte şifre belirleme =================
  await login(page, '05310000001', code, null);
  check('2.1 first login with admin-given code forces a new password', await page.isVisible('#forcedPasswordOverlay'));
  const tryForced = async pw => { await page.fill('#forcedPassword1', pw); await page.fill('#forcedPassword2', pw); await page.evaluate(() => saveForcedPassword()); await wait(page, 300); return page.isVisible('#forcedPasswordOverlay'); };
  check('2.2 short password (5 chars) rejected', await tryForced('abc12'));
  check('2.3 reusing the admin-given code as password rejected', await tryForced(code));
  await reload();
  check('2.4 closing the app does not skip the password step', !(await page.isVisible('#member-app')) || await page.isVisible('#forcedPasswordOverlay'));
  if (await page.isVisible('#logged-out-screen')) await login(page, '05310000001', code, null);
  check('2.5 strong password accepted', !(await tryForced('Guclu-Sifre-9')));
  await page.evaluate(() => flushAllAutosaves()); await wait(page, 1500);
  s = await store(page);
  const hedef = memberDoc(s, 'Hedef Üye');
  check('2.6 after setting: no plain password, no activation code left in cloud', !('password' in hedef) && !('activationCode' in hedef) && !('mustSetPassword' in hedef) && !!hedef.pw, Object.keys(hedef).join(','));
  check('2.7 member password not readable from cloud record', !JSON.stringify(hedef).includes('Guclu-Sifre-9'));
  await page.evaluate(() => logOut());
  await login(page, '05310000001', code, null);
  check('2.8 old activation code no longer works', await page.isVisible('#logged-out-screen'));
  await page.evaluate(() => { localStorage.removeItem('ttf_login_fail'); Object.keys(loginLocks).forEach(k => delete loginLocks[k]); });
  await login(page, '05310000001', 'Guclu-Sifre-9', null);
  check('2.9 new password works', await page.isVisible('#member-app'));

  // ================= 3) Oturum =================
  const goodSession = await page.evaluate(() => localStorage.getItem('ttf_session'));
  await reload();
  check('3.1 genuine saved session still logs in', await page.isVisible('#member-app'));
  await page.evaluate(() => localStorage.setItem('ttf_session', JSON.stringify({ phone: 'admin1' })));
  await reload();
  check('3.2 forged session (admin phone, no key) rejected', await page.isVisible('#logged-out-screen') && !(await page.evaluate(() => getComputedStyle(document.getElementById('admin-app')).display !== 'none')));
  await page.evaluate(g => localStorage.setItem('ttf_session', JSON.stringify({ phone: 'admin1', t: JSON.parse(g).t })), goodSession);
  await reload();
  check('3.3 another user\'s session key does not open admin', await page.isVisible('#logged-out-screen'));
  // şifre değişince eski cihazdaki oturum düşmeli
  await page.evaluate(g => localStorage.setItem('ttf_session', g), goodSession);
  await reload();
  await page.evaluate(() => openSettings());
  await page.fill('#currentPasswordInput', 'Guclu-Sifre-9'); await page.fill('#newPasswordInput', 'abc12'); await page.fill('#confirmPasswordInput', 'abc12');
  await page.evaluate(() => changePassword()); await wait(page, 500);
  check('3.4 weak new password rejected on change', (await page.textContent('#passwordChangeMsg')).includes('en az 6'));
  await page.fill('#newPasswordInput', 'Yepyeni-Sifre-1'); await page.fill('#confirmPasswordInput', 'Yepyeni-Sifre-1');
  await page.evaluate(() => changePassword()); await wait(page, 1500);
  await page.evaluate(g => localStorage.setItem('ttf_session', g), goodSession); // "çalınmış" eski oturum
  await reload();
  check('3.5 old/stolen session stops working after password change', await page.isVisible('#logged-out-screen'));

  // ================= 4) Deneme sınırı =================
  for (let i = 0; i < 5; i++) await login(page, '05310000001', 'yanlis-' + i, null);
  check('4.1 5 wrong passwords → locked', (await page.textContent('#loginError')).includes('Çok fazla hatalı deneme'));
  await clearDevice(page);
  await reload();
  await login(page, '05310000001', 'Yepyeni-Sifre-1', null);
  check('4.2 clearing device data does not lift the account lock', await page.isVisible('#logged-out-screen') && (await page.textContent('#loginError')).includes('kilitlendi'));
  const P2 = await openPage(ctx, {});
  await P2.page.evaluate(() => localStorage.removeItem('ttf_login_fail'));
  await login(P2.page, '05310000001', 'Yepyeni-Sifre-1', null);
  check('4.3 lock also applies from another device', await P2.page.isVisible('#logged-out-screen'));
  await login(P2.page, 'admin2', 'tt2026', null);
  check('4.4 other accounts are not locked', await P2.page.evaluate(() => getComputedStyle(document.getElementById('admin-app')).display !== 'none'));
  const t1 = await (async () => { await clearDevice(page); await login(page, '0599 999 99 99', 'x1', null); return page.textContent('#loginError'); })();
  await clearDevice(page);
  await login(page, '0542 249 32 27', 'yanlis', null);
  const t2 = await page.textContent('#loginError');
  check('4.5 same error for unknown phone and wrong password (no account guessing)', t1 === t2, `"${t1}" / "${t2}"`);

  // ================= 5) Yetki =================
  // P2'de kısıtlı yönetici (Seray) giriş yapmış durumda
  const beforeMembers = await P2.page.evaluate(() => members.length);
  await P2.page.evaluate(() => adminDeleteMember('Elif Kara')); await wait(P2.page, 300);
  check('5.1 restricted admin cannot delete members', await P2.page.evaluate(n => members.length === n, beforeMembers));
  const v0 = await P2.page.evaluate(() => CONTRACT_VERSION);
  await P2.page.evaluate(() => adminBumpContractVersion()); await wait(P2.page, 200);
  check('5.2 restricted admin cannot bump contract version', await P2.page.evaluate(v => CONTRACT_VERSION === v, v0));
  check('5.3 restricted admin does not see finance / login log', await P2.page.evaluate(() => { openAdminSettings(); const f = document.getElementById('financeDrawerBtn'); return document.getElementById('loginLogCard').style.display === 'none' && (!f || getComputedStyle(f).display === 'none'); }));
  // Seray kendi şifresini değiştirir → Turgut'un şifresi değişmemeli
  await P2.page.fill('#adminCurrentPasswordInput', 'tt2026'); await P2.page.fill('#adminNewPasswordInput', 'Seray-Yeni-1'); await P2.page.fill('#adminConfirmPasswordInput', 'Seray-Yeni-1');
  await P2.page.evaluate(() => changeAdminPassword()); await wait(P2.page, 1500);
  await P2.page.evaluate(() => { logOut(); localStorage.removeItem('ttf_login_fail'); });
  await login(P2.page, 'admin1', 'tt2026', null);
  check('5.4 second admin changing password does not change the first admin\'s', await P2.page.evaluate(() => getComputedStyle(document.getElementById('admin-app')).display !== 'none'));
  await P2.page.evaluate(() => logOut());
  await login(P2.page, 'admin2', 'Seray-Yeni-1', null);
  check('5.5 second admin logs in with own new password', await P2.page.evaluate(() => getComputedStyle(document.getElementById('admin-app')).display !== 'none'));
  await P2.page.evaluate(() => logOut());

  // ================= 6) Kod enjeksiyonu (XSS) =================
  // Giriş yapmadan: "şifremi unuttum" kutusuna zararlı içerik
  await clearDevice(page); await reload();
  await page.evaluate(x => { openForgotPassword(); document.getElementById('forgotPhoneInput').value = x; submitForgotPassword(); closeForgotPassword(); }, XSS);
  for (let i = 0; i < 80; i++) await page.evaluate(i => { document.getElementById('forgotPhoneInput').value = '05' + i; submitForgotPassword(); }, i);
  check('6.1 password-reset requests cannot be piled up without limit', await page.evaluate(() => passwordResetRequests.length <= 50), String(await page.evaluate(() => passwordResetRequests.length)));
  await page.evaluate(x => { passwordResetRequests.push({ phone: x, date: '2026-11-12', code: '111111' }); }, XSS_DB);
  // Üye olarak: gerçek yazı kutularına zararlı içerik YAZILIR (klavyeden girilmiş gibi)
  await login(page, '0542 249 32 27', '1234', null);
  await page.fill('#gateEmergencyName', XSS); await page.fill('#gateEmergencyPhone', XSS);
  await page.selectOption('#gateBirthDay', '5'); await page.selectOption('#gateBirthMonth', '3'); await page.selectOption('#gateBirthYear', '1995');
  await page.check('#healthDeclHas'); await page.fill('#healthDeclDetails', XSS); await page.check('#healthConsentCheckbox');
  await page.check('#contractAcceptCheckbox'); await page.check('#kvkkReadCheckbox');
  await page.click('#contractAcceptBtn');
  await page.evaluate(() => skipOnboarding());
  await page.fill('#goalInput', XSS); await page.evaluate(() => saveGoalNote());
  await page.evaluate(() => switchTab('nutrition'));
  await page.click('.meal-block >> nth=0 >> .meal-add'); await page.fill('#addName-0', XSS); await page.fill('#addCal-0', '10'); await page.click('#confirmAddMealBtn-0');
  await page.evaluate(() => openMemberSubScreen('messages'));
  await page.fill('#myMessageInput', XSS); await page.click('#view-messages button:has-text("Gönder")');
  await page.evaluate(() => openSettings());
  await page.fill('#settingsName', XSS); await page.fill('#settingsPhone', '0542 249 32 27'); await page.evaluate(() => saveProfile());
  // Ayrıca: doğrudan veritabanına yazılmış zararlı içerik (uygulamayı atlayan biri) → başka cihazda denenecek
  await page.evaluate(x => {
    const n = currentMemberName;
    pendingCreditRequests.push({ id: 1, member: n, type: 'classDecline', amount: 1, details: x, requestedBy: x, date: '2026-11-12' });
    parentalConsents[n] = { parentName: x, parentPhone: x };
    memberPayments[n] = [{ amount: 1, note: x, date: '2026-11-12' }];
    financeEntries.push({ date: '2026-11-12', type: 'income', category: 'Diğer Gelir', amount: 1, note: x });
    memberMeasurements[n] = [{ date: '2026-11-12', weight: x, waist: x }];
    memberPrograms[n][0].name = x; memberPrograms[n][0].room = x;
    members.find(m => m.name === n).group = x; getMemberProfile(n).gender = x;
  }, XSS_DB);
  for (const v of ['home','program','nutrition','membership','progress','trainers']) await page.evaluate(v => switchTab(v), v);
  for (const v of ['messages','contract','weighttrack','leaderboard','classhistory','notifications']) await page.evaluate(v => openMemberSubScreen(v), v);
  await page.evaluate(() => openSettings());
  await wait(page, 600);
  check('6.2 content typed by a member does not run on their own screens', !(await page.evaluate(() => window.__pwnTyped)) && (await page.evaluate(() => (memberMessages[currentMemberName] || []).length === 1)));
  await page.evaluate(() => { flushAllAutosaves(); }); await wait(page, 1500);
  await page.evaluate(() => { logOut(); window.__pwn = 0; });
  // Yönetici tüm ekranları ve tüm kartları açar
  await login(page, 'admin1', 'tt2026', null);
  await page.evaluate(() => {
    const n = 'Mert Aydın';
    ['home','consumption','classes','members','analytics','announce','finance'].forEach(v => switchAdminTab(v));
    ['consumptionmembers','attendancelog','assignprogram','editmember','availability','mealreminder','mealreview','progresstrack','contractdoc'].forEach(v => openAdminSubScreen(v));
    switchAdminTab('members'); toggleMemberCard(n);
    [toggleMemberPaymentsSection, toggleMemberCreditSection, toggleMemberDateRangeSection, toggleMemberProgramSection, toggleMemberWaterSection].forEach(f => { try { f(n); } catch (e) {} });
    switchAdminTab('announce'); switchCommTab('messages'); openAdminMessageThread(n);
    navigateToAdminScreen('mealreview'); toggleMealCard(n);
    goToMemberEdit(n);
    try { contractDocMember = n; openContractDocument && openContractDocument(n); } catch (e) {}
    openAdminSubScreen('progresstrack'); document.getElementById('progressAdminMember').value = n; renderMemberPostureAdmin();
    openAdminSearch(); document.getElementById('adminSearchGlobalInput').value = 'img'; renderAdminGlobalSearch();
    switchAdminTab('home'); openAdminSettings();
  });
  await wait(page, 800);
  check('6.3 injected content (typed or written straight to the database) runs on NO admin screen', !(await page.evaluate(() => window.__pwn)), 'pwn=' + (await page.evaluate(() => window.__pwn)));
  // Yönetici formundan zararlı bir üye adı girilirse temizlenmeli
  await page.evaluate(() => { window.__pwn = 0; openAddMemberScreen(); });
  await page.fill('#newMemberName', "Kötü'); alert(1); ('<img src=x onerror=\"window.__pwn=9\">");
  await page.fill('#newMemberPhone', '0500 000 00 77');
  await page.evaluate(() => adminCreateMember());
  const badName = await page.evaluate(() => (members.find(m => m.phone === '0500 000 00 77') || {}).name);
  await page.evaluate(() => { refreshAllViews(); ['home','consumption','classes','members','analytics','announce','finance'].forEach(v => switchAdminTab(v)); ['consumptionmembers','assignprogram','editmember','mealreminder','mealreview','progresstrack'].forEach(v => openAdminSubScreen(v)); switchAdminTab('members'); });
  await page.evaluate(n => { try { toggleMemberCard(n); } catch (e) {} }, badName);
  await wait(page, 800);
  check('6.4 a member name with HTML/quotes is cleaned and runs no code', !!badName && !/[<>"'`\\]/.test(badName) && !(await page.evaluate(() => window.__pwn)), String(badName));
  await page.evaluate(() => flushAllAutosaves()); await wait(page, 1500);
  const dump = JSON.stringify(await store(page));
  check('6.5 nothing in the cloud contains raw HTML tags', !/<img|<svg|onerror=\\?"/.test(dump));

  // ================= 7) Depo =================
  const fs = require('fs'), path = require('path');
  const root = path.resolve(__dirname, '..');
  const tracked = require('child_process').execSync('git ls-files', { cwd: root }).toString().split('\n').filter(Boolean);
  const secretFiles = tracked.filter(f => /\.(jks|keystore|p12|pem|key|mobileprovision)$|(^|\/)\.env|google-services\.json|GoogleService-Info\.plist|serviceAccount/i.test(f));
  check('7.1 no signing keys / secret files committed', secretFiles.length === 0, secretFiles.join(','));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check('7.2 no private key or service-account secret in the app code', !/-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key"|service_role/.test(html));
  check('7.3 app loads no third-party script at start', !/<script[^>]+src="https?:\/\//.test(html));

  // ================= Bilinen AÇIK maddeler (yapısal) =================
  const P3 = await openPage(ctx, {});
  await P3.page.evaluate(() => localStorage.removeItem('ttf_session'));
  const exposed = await P3.page.evaluate(() => ({ loggedIn: getComputedStyle(document.getElementById('logged-out-screen')).display === 'none', members: members.length, phones: members.filter(m => m.phone).length, health: Object.keys(healthDeclarations).length, hashes: members.filter(m => m.pw).length }));
  const open = [];
  if (exposed.members > 0) open.push(`AÇIK  A) Giriş yapmamış bir ziyaretçinin cihazına bile tüm üye verisi iniyor (${exposed.members} kişi, ${exposed.phones} telefon, ${exposed.health} sağlık beyanı). Veritabanı kuralları kişiye göre kısıtlamıyor.`);
  if (exposed.hashes > 0) open.push('AÇIK  B) Şifre özetleri de okunabiliyor: açık metin değil, ama kısa/tahmin edilebilir şifreler deneme-yanılma ile bulunabilir.');
  open.push('AÇIK  C) Giriş kontrolü ve deneme sınırı telefonda çalışıyor; veritabanına doğrudan bağlanan biri bunları atlar.');

  console.log(results.join('\n'));
  console.log('\n' + open.join('\n'));
  await browser.close();
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
