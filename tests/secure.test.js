// GÜVENLİ MOD testi — gerçek Firebase SDK + yerel Firebase emülatörü + gerçek firestore.rules.
// Önce emülatörü başlat:  npx firebase emulators:start --only auth,firestore,storage --project demo-ttfitness
// Her "cihaz" ayrı bir tarayıcı bağlamıdır (ayrı oturum, ayrı bellek).
const fs = require('fs'), path = require('path');
const { newContext, openPage, login, resetEmulator, setEmulatorRules } = require('./lib');
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+String(extra).slice(0,260):'')); };
const REAL_RULES = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
const OPEN_RULES = `rules_version = '2'; service cloud.firestore { match /databases/{d}/documents { match /{doc=**} { allow read, write: if request.auth != null; } } }`;
const ready = page => page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display === 'none', null, { timeout: 30000 });
const wait = (page, ms) => page.waitForTimeout(ms);
const device = async () => { const c = await newContext({ emulator: true }); const p = await openPage(c.ctx, {}); return { ...c, ...p }; };
const adminVisible = page => page.evaluate(() => getComputedStyle(document.getElementById('admin-app')).display !== 'none');
// Tarayıcıdaki oturumla doğrudan veritabanına bir işlem dener; 'ok' ya da hata kodunu döndürür
const probe = (page, fnSrc, arg) => page.evaluate(async ([src, a]) => {
  try { const r = await (new Function('db', 'a', 'return (' + src + ')(db, a)'))(db, a); return r === undefined ? 'ok' : r; }
  catch (e) { return e.code || String(e.message).slice(0, 80); }
}, [fnSrc.toString(), arg]);
const denied = r => r === 'permission-denied';
const forcePw = async (page, pw) => { await page.fill('#forcedPassword1', pw); await page.fill('#forcedPassword2', pw); await page.evaluate(() => saveForcedPassword()); await wait(page, 1200); };
const secureLoginUI = async (page, user, pass) => { await page.fill('#loginPhoneInput', user); await page.fill('#loginPasswordInput', pass); await page.evaluate(() => loginMember()); await wait(page, 2500); };
const logoutAndWait = async page => { await page.evaluate(() => logOut()); await wait(page, 1500); await ready(page); };
const clean = e => e.filter(x => !/ERR_FAILED|Postür|404|favicon|permission|Missing or insufficient|Canlı eşitleme|WebChannel|400 \(|auth\/|Failed to load resource/i.test(x));

(async () => {
  await resetEmulator();
  await setEmulatorRules(OPEN_RULES);

  // ============ 1) Eski düzende veri hazırla ============
  const A = await device(); const a = A.page;
  await login(a, 'admin1', 'tt2026', null);
  await a.evaluate(() => {
    const mon = toLocalDateStr(new Date(getWeekMonday(toLocalDateStr(getNow()))));
    Object.keys(attendanceLog).forEach(k => delete attendanceLog[k]); // paket atanmadan önce işlenen dersleri sil; paketle birlikte yeniden işlenecek
    memberPackages['Mert Aydın'] = { size: 12, used: 0, start: '2026-01-01', end: '2027-12-31' };
    memberNotes['Elif Kara'] = 'GIZLI-YONETIM-NOTU'; memberNotes['Mert Aydın'] = 'MERT-HAKKINDA-GIZLI-NOT';
    healthDeclarations['Elif Kara'] = { hasCondition: true, details: 'ELIF-SAGLIK-BILGISI' };
    healthDeclarations['Mert Aydın'] = { hasCondition: true, details: 'mert-saglik' };
    contractAccepted['Mert Aydın'] = true; contractAcceptedVersion['Mert Aydın'] = CONTRACT_VERSION; getMemberProfile('Mert Aydın').birthday = '1990-01-01';
    memberPayments['Elif Kara'] = [{ amount: 9999, note: 'ELIF-ODEME', date: '2026-11-01' }];
    memberPayments['Mert Aydın'] = [{ amount: 1500, note: 'mert-odeme', date: '2026-11-01' }];
    getMemberMeals('Elif Kara')['Öğle'].push({ name: 'ELIF-OGUN', cal: 1, portion: 1, photo: null, date: '2026-11-10' });
    memberMessages['Elif Kara'] = [{ from: 'member', text: 'ELIF-MESAJ', date: '2026-11-10', time: '10:00' }];
    announcements.push({ id: 1, target: 'all', message: 'HERKESE-DUYURU', date: '2026-11-10' });
    announcements.push({ id: 2, target: 'member:Elif Kara', message: 'ELIFE-OZEL-DUYURU', date: '2026-11-10' });
    financeEntries.push({ date: '2026-11-10', type: 'income', category: 'Diğer Gelir', amount: 777, note: 'GIZLI-FINANS' });
  });
  await a.evaluate(() => flushAllAutosaves()); await wait(a, 3000);
  check('1.1 starts in old (open) mode', await a.evaluate(() => secureMode === false));

  // ============ 2) Güvenli moda geçiş ============
  const wrong = await a.evaluate(() => migrateToSecureMode('yanlis-sifre').then(() => 'ok').catch(e => e.message));
  check('2.1 migration refuses a wrong admin password', /hatalı/.test(wrong), wrong);
  const codes = await a.evaluate(() => migrateToSecureMode('tt2026').catch(e => 'ERR ' + e.message));
  check('2.2 migration completes and issues a temporary password to everyone else', Array.isArray(codes) && codes.length === 4 && codes.every(c => /^[A-Z2-9]{8}$/.test(c.code)), JSON.stringify(codes).slice(0, 200));
  const codeOf = n => (codes.find(c => c.name === n) || {}).code;
  const ids = await a.evaluate(() => Object.fromEntries(members.map(m => [m.name, { id: m._id, uid: m.uid }])));
  check('2.3 no password or hash left on member records', await a.evaluate(() => members.every(m => !('password' in m) && !('pw' in m))));
  await setEmulatorRules(REAL_RULES); // === gerçek kurallar yayınlandı ===
  await a.reload(); await ready(a); await wait(a, 1500);
  check('2.4 admin still signed in after reload (secure session)', await adminVisible(a) && await a.evaluate(() => secureMode === true));
  const adminData = await a.evaluate(() => ({ members: members.length, note: memberNotes['Elif Kara'], pay: (memberPayments['Elif Kara'] || []).length, meal: getMemberMeals('Elif Kara')['Öğle'].length,
    prog: (memberPrograms['Mert Aydın'] || []).length, fin: financeEntries.length, ann: announcements.length, health: (healthDeclarations['Elif Kara'] || {}).details }));
  check('2.5 admin sees all migrated data', adminData.members === 5 && adminData.note === 'GIZLI-YONETIM-NOTU' && adminData.pay === 1 && adminData.meal === 1 && adminData.prog === 3 && adminData.fin === 1 && adminData.ann === 2 && adminData.health === 'ELIF-SAGLIK-BILGISI', JSON.stringify(adminData));

  // ============ 3) Giriş yapmamış ziyaretçi ============
  const C = await device(); const c = C.page;
  check('3.1 visitor: login screen only, NO member data on the device', await c.isVisible('#logged-out-screen') && await c.evaluate(() => members.length === 0 && Object.keys(healthDeclarations).length === 0 && Object.keys(memberMessages).length === 0));
  check('3.2 visitor cannot list members', denied(await probe(c, db => db.collection('members').get().then(s => 'read ' + s.size))));
  check('3.3 visitor cannot read a member record / health data', denied(await probe(c, (db, id) => db.collection('member_self').doc(id).get().then(s => 'read'), ids['Elif Kara'].id)) && denied(await probe(c, (db, id) => db.collection('members').doc(id).get().then(s => 'read'), ids['Elif Kara'].id)));
  check('3.4 visitor cannot read finance / settings data', denied(await probe(c, db => db.collection('app_data').doc('state_financeEntries').get().then(() => 'read'))) && denied(await probe(c, db => db.collection('app_data').get().then(() => 'read'))));
  check('3.5 visitor cannot write anything', denied(await probe(c, db => db.collection('members').doc('x').set({ name: 'hack', role: 'admin' }))) && denied(await probe(c, db => db.collection('config').doc('public').set({ secure: false }))));
  check('3.6 visitor cannot list the login index', denied(await probe(c, db => db.collection('login_index').get().then(() => 'read'))));
  const anon = await c.evaluate(async () => { try { await firebase.auth().signInAnonymously(); const r = await db.collection('members').get().then(s => 'read ' + s.size).catch(e => e.code); await firebase.auth().signOut(); return r; } catch (e) { return e.code; } });
  check('3.7 anonymous sign-in gives no access', denied(anon), anon);
  const selfReg = await c.evaluate(async () => {
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword('saldirgan@example.com', 'Saldirgan-1');
      const out = [];
      out.push(await db.collection('members').get().then(() => 'read').catch(e => e.code));
      out.push(await db.collection('users').doc(cred.user.uid).set({ role: 'admin', memberId: 'x' }).then(() => 'wrote').catch(e => e.code));
      out.push(await db.collection('app_data').doc('state_priceSettings').get().then(() => 'read').catch(e => e.code));
      await firebase.auth().signOut(); return out.join(',');
    } catch (e) { return 'ERR ' + e.code; }
  });
  check('3.8 self-registered stranger: no read, cannot make himself admin', selfReg === 'permission-denied,permission-denied,permission-denied', selfReg);
  check('3.9 visitor CAN leave a password-reset request (valid shape only)', (await probe(c, db => db.collection('reset_requests').add({ phone: '0542 249 32 27', date: '2026-11-15', code: '123456', ts: 1 }).then(() => 'ok'))) === 'ok'
    && denied(await probe(c, db => db.collection('reset_requests').add({ phone: 'x', date: '2026-11-15', code: '123456', ts: 1, extra: '<script>' }).then(() => 'ok')))
    && denied(await probe(c, db => db.collection('reset_requests').get().then(() => 'read'))));

  // ============ 4) Üye (Mert) ============
  const B = await device(); const b = B.page;
  await secureLoginUI(b, '0542 249 32 27', 'tt2026');
  check('4.1 old password no longer works', await b.isVisible('#logged-out-screen'));
  await secureLoginUI(b, '0542 249 32 27', codeOf('Mert Aydın'));
  check('4.2 member logs in with temporary password and must choose a new one', await b.isVisible('#member-app') && await b.isVisible('#forcedPasswordOverlay'));
  await forcePw(b, 'Mert-Yeni-Sifre-1');
  await b.evaluate(() => skipOnboarding()); await wait(b, 1500);
  check('4.3 new password saved, app opens', !(await b.isVisible('#forcedPasswordOverlay')) && await b.isVisible('#member-app'));
  const dump = await b.evaluate(() => {
    const all = JSON.stringify([members, memberNotes, healthDeclarations, memberPayments, memberMeals, memberMessages, announcements, financeEntries, memberProfiles, memberPrograms, memberPackages, attendanceLog, memberAnnouncements, consentRecords, emergencyContacts, memberMeasurements]);
    return { members: members.length, len: all.length, leaks: ['GIZLI-YONETIM-NOTU', 'MERT-HAKKINDA-GIZLI-NOT', 'ELIF-SAGLIK-BILGISI', 'ELIF-ODEME', 'ELIF-OGUN', 'ELIF-MESAJ', 'ELIFE-OZEL-DUYURU', 'GIZLI-FINANS', 'Elif Kara', 'Can Doğan', '0532 111 22 33'].filter(x => all.includes(x)),
      own: all.includes('mert-odeme') && all.includes('mert-saglik') && all.includes('HERKESE-DUYURU'), prog: (memberPrograms['Mert Aydın'] || []).length };
  });
  check('4.4 member device holds ONLY the member\'s own data', dump.members === 1 && dump.leaks.length === 0, 'leaks: ' + dump.leaks.join(',') + ' members=' + dump.members);
  check('4.5 member sees own program, payment, health record and the public announcement', dump.own && dump.prog === 3);
  await b.evaluate(() => { switchTab('progress'); openMemberSubScreen('leaderboard'); });
  const lb = await b.textContent('#leaderboardList');
  check('4.6 leaderboard shows other members only as masked names', lb.includes('Elif K.') && !lb.includes('Elif Kara') && lb.includes('(Sen)'), lb.replace(/\s+/g, ' ').slice(0, 120));
  // Kural denemeleri: Mert başkasının verisine ulaşmaya çalışır
  const E = ids['Elif Kara'], M = ids['Mert Aydın'], ADM = ids['Turgut Terekli'];
  const tries = {
    'list all members': await probe(b, db => db.collection('members').get().then(() => 'read')),
    'read another member record': await probe(b, (db, id) => db.collection('members').doc(id).get().then(() => 'read'), E.id),
    'read another member\'s own data (health, meals, messages)': await probe(b, (db, id) => db.collection('member_self').doc(id).get().then(() => 'read'), E.id),
    'read another member\'s payments/program': await probe(b, (db, id) => db.collection('member_admin').doc(id).get().then(() => 'read'), E.id),
    'list all member data': await probe(b, db => db.collection('member_self').get().then(() => 'read')),
    'read management notes about himself': await probe(b, (db, id) => db.collection('member_private').doc(id).get().then(() => 'read'), M.id),
    'read finance': await probe(b, db => db.collection('app_data').doc('state_financeEntries').get().then(() => 'read')),
    'read full announcement list': await probe(b, db => db.collection('app_data').doc('state_announcements').get().then(() => 'read')),
    'read password-reset requests': await probe(b, db => db.collection('reset_requests').get().then(() => 'read')),
    'read login log': await probe(b, db => db.collection('login_log').get().then(() => 'read')),
    'read admin\'s permission record': await probe(b, (db, uid) => db.collection('users').doc(uid).get().then(() => 'read'), ADM.uid),
    'make himself admin (users)': await probe(b, (db, uid) => db.collection('users').doc(uid).set({ role: 'admin', memberId: 'x' }, { merge: true }), M.uid),
    'make himself admin (member record)': await probe(b, (db, id) => db.collection('members').doc(id).update({ role: 'admin' }), M.id),
    'reset own water/coffee debt': await probe(b, (db, id) => db.collection('members').doc(id).update({ water: 0 }), M.id),
    'give himself sessions (package)': await probe(b, (db, id) => db.collection('member_admin').doc(id).set({ memberPackages: { size: 999, used: 0 } }, { merge: true }), M.id),
    'erase own payments record': await probe(b, (db, id) => db.collection('member_admin').doc(id).update({ memberPayments: [] }), M.id),
    'write another member\'s data': await probe(b, (db, id) => db.collection('member_self').doc(id).set({ goalNotes: 'hack' }, { merge: true }), E.id),
    'delete another member': await probe(b, (db, id) => db.collection('members').doc(id).delete(), E.id),
    'change prices': await probe(b, db => db.collection('app_data').doc('state_priceSettings').set({ suFiyat: 0 })),
    'turn secure mode off': await probe(b, db => db.collection('config').doc('public').set({ secure: false })),
    'edit trainers': await probe(b, db => db.collection('trainers').doc('x').set({ name: 'hack' })),
  };
  const notDenied = Object.entries(tries).filter(([, r]) => !denied(r)).map(([k, r]) => k + '=' + r);
  check(`4.7 member is blocked from ${Object.keys(tries).length} attempts to reach others' data or raise own rights`, notDenied.length === 0, notDenied.join('; '));
  check('4.8 member CAN read/write own data (control)', (await probe(b, (db, id) => db.collection('member_self').doc(id).get().then(s => s.exists ? 'ok' : 'missing'), M.id)) === 'ok' && (await probe(b, (db, id) => db.collection('member_admin').doc(id).get().then(s => s.exists ? 'ok' : 'missing'), M.id)) === 'ok');

  // ============ 5) Çalışma: üye ↔ yönetici canlı ============
  await b.evaluate(() => switchTab('nutrition'));
  await b.click('.meal-block >> nth=0 >> .meal-add'); await b.fill('#addName-0', 'Yulaf'); await b.fill('#addCal-0', '300'); await b.click('#confirmAddMealBtn-0');
  await b.evaluate(() => openMemberSubScreen('messages'));
  await b.fill('#myMessageInput', 'Merhaba hocam'); await b.click('#view-messages button:has-text("Gönder")');
  await a.evaluate(() => { memberTrainerNotes['Mert Aydın'] = 'Proteini artır'; memberPayments['Mert Aydın'].push({ amount: 2000, note: 'aralık', date: '2026-11-15' }); });
  await wait(a, 5000);
  check('5.1 admin device receives member\'s meal and message live', await a.evaluate(() => getMemberMeals('Mert Aydın')['Kahvaltı'].some(m => m.name === 'Yulaf') && (memberMessages['Mert Aydın'] || []).some(m => m.text === 'Merhaba hocam') && adminMessageUnread['Mert Aydın'] === true));
  check('5.2 member device receives admin\'s note and payment live', await b.evaluate(() => memberTrainerNotes['Mert Aydın'] === 'Proteini artır' && memberPayments['Mert Aydın'].length === 2));
  const att = await a.evaluate(() => ({ used: memberPackages['Mert Aydın'].used, logs: Object.keys(attendanceLog).filter(k => k.startsWith('Mert Aydın|')).length }));
  await wait(b, 1500);
  check('5.3 attendance processed by admin device; member sees used sessions', att.used === att.logs && att.logs >= 1 && await b.evaluate(u => memberPackages['Mert Aydın'].used === u && sessionsUsed === u, att.used), JSON.stringify(att));
  check('5.4 member device never runs attendance for others', await b.evaluate(() => Object.keys(attendanceLog).every(k => k.startsWith('Mert Aydın|'))));

  // ============ 6) Yönetici yeni üye ekler ============
  await a.evaluate(() => openAddMemberScreen());
  await a.fill('#newMemberName', 'Yeni Üye'); await a.fill('#newMemberPhone', '0533 444 55 66');
  await a.evaluate(() => adminCreateMember()); await wait(a, 4000);
  const newCode = await a.evaluate(() => { const m = members.find(x => x.name === 'Yeni Üye'); return m && m.uid ? m.activationCode : null; });
  check('6.1 admin creates a member → login account opened, temporary password shown', /^[A-Z2-9]{8}$/.test(newCode || ''), String(newCode));
  const D = await device(); const d = D.page;
  await secureLoginUI(d, '+90 533 444 55 66', newCode);
  check('6.2 new member logs in (phone typed in another format)', await d.isVisible('#member-app') && await d.isVisible('#forcedPasswordOverlay'));
  await forcePw(d, 'Yeni-Uye-Sifre-1');
  check('6.3 new member reaches the consent screen', await d.isVisible('#view-contractgate'));
  await d.selectOption('#gateBirthDay', '5'); await d.selectOption('#gateBirthMonth', '3'); await d.selectOption('#gateBirthYear', '1995');
  await d.check('#contractAcceptCheckbox'); await d.check('#kvkkReadCheckbox'); await d.click('#contractAcceptBtn'); await d.evaluate(() => skipOnboarding());
  await wait(d, 3500);
  check('6.4 admin sees the new member as active with consent recorded', await a.evaluate(() => { const m = members.find(x => x.name === 'Yeni Üye'); return m.status === 'active' && !m.mustSetPassword && !m.activationCode && contractAccepted['Yeni Üye'] === true && !!consentRecords['Yeni Üye']; }));
  await d.reload(); await ready(d); await wait(d, 1500);
  check('6.5 member stays signed in after reload', await d.isVisible('#member-app') && !(await d.isVisible('#view-contractgate')));

  // ============ 7) Yönetici şifre sıfırlar → eski oturum ve şifre geçersiz ============
  await a.evaluate(() => { switchAdminTab('members'); if (!expandedMembers.has('Mert Aydın')) toggleMemberCard('Mert Aydın'); });
  await a.evaluate(async () => { const inp = [...document.querySelectorAll('[id^="cardNewPassword-"]')].find(el => el.offsetParent !== null); inp.value = 'Gecici-9876'; await adminSetMemberPassword('Mert Aydın', parseInt(inp.id.split('-')[1], 10)); });
  await wait(a, 3000);
  await ready(b); await wait(b, 1500);
  check('7.1 old device is signed out automatically after admin resets the password', await b.isVisible('#logged-out-screen') && await b.evaluate(() => members.length === 0));
  // Eski hesapla (eski şifre Firebase'de hâlâ duruyor) doğrudan bağlanan biri de veri okuyamamalı
  const oldAcct = await b.evaluate(async ([id, uid]) => {
    try { await firebase.auth().signInWithEmailAndPassword('05422493227@uye.ttfitness.app', 'Mert-Yeni-Sifre-1'); } catch (e) { return 'signin:' + e.code; }
    const same = firebase.auth().currentUser.uid === uid;
    const r = await db.collection('member_self').doc(id).get({ source: 'server' }).then(() => 'read').catch(e => e.code);
    const w = await db.collection('member_self').doc(id).set({ goalNotes: 'x' }, { merge: true }).then(() => 'wrote').catch(e => e.code);
    await firebase.auth().signOut(); return same + ',' + r + ',' + w;
  }, [M.id, M.uid]);
  check('7.1b the old login account itself has lost all access (server-side)', oldAcct === 'true,permission-denied,permission-denied', oldAcct);
  await b.reload(); await ready(b);
  await secureLoginUI(b, '0542 249 32 27', 'Mert-Yeni-Sifre-1');
  check('7.2 old password rejected in the app', await b.isVisible('#logged-out-screen'));
  await secureLoginUI(b, '0542 249 32 27', 'Gecici-9876');
  check('7.3 temporary password works and forces a new one again', await b.isVisible('#forcedPasswordOverlay'));
  await forcePw(b, 'Mert-Sifre-2');
  check('7.4 member data intact after reset', await b.evaluate(() => getMemberMeals('Mert Aydın')['Kahvaltı'].some(m => m.name === 'Yulaf')));

  // ============ 8) Fotoğraf dosyaları ============
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const url = await b.evaluate(u => uploadPhotoToStorage(u, 'meals'), png);
  check('8.1 member uploads a photo into own folder', typeof url === 'string' && /\/u(%2F|\/)/.test(url), String(url).slice(0, 120));
  const other = await d.evaluate(async u => { try { await storage.refFromURL(u).delete(); return 'deleted'; } catch (e) { return e.code; } }, url);
  check('8.2 another member cannot delete that photo', /unauthorized/.test(other), other);
  const up = await d.evaluate(async ([u, uid]) => { try { await storage.ref().child('u/' + uid + '/meals/hack.jpg').putString(u, 'data_url'); return 'uploaded'; } catch (e) { return e.code; } }, [png, M.uid]);
  check('8.3 another member cannot upload into that folder', /unauthorized/.test(up), up);
  const listing = await d.evaluate(async uid => { try { await storage.ref().child('u/' + uid).listAll(); return 'listed'; } catch (e) { return e.code; } }, M.uid);
  check('8.4 photo folders cannot be listed', /unauthorized/.test(listing), listing);

  // ============ 9) Üye kendi hesabını siler ============
  await d.evaluate(() => openSettings());
  await d.click('#deleteAccountBtn'); await d.fill('#deleteAccountPassword', 'Yeni-Uye-Sifre-1'); await d.click('#deleteAccountConfirmBtn');
  await wait(d, 5000); await ready(d);
  check('9.1 after self-deletion: back at login', await d.isVisible('#logged-out-screen'));
  await wait(a, 2000);
  check('9.2 admin no longer has the member or any of their data', await a.evaluate(() => !members.some(m => m.name === 'Yeni Üye') && !contractAccepted['Yeni Üye'] && !consentRecords['Yeni Üye']));
  await secureLoginUI(d, '0533 444 55 66', 'Yeni-Uye-Sifre-1');
  check('9.3 deleted member cannot log in', await d.isVisible('#logged-out-screen'));

  // ============ 10) Kısıtlı yönetici + yönetici üye siler ============
  const S = await device(); const s = S.page;
  await secureLoginUI(s, 'admin2', codeOf('Seray Atagan'));
  check('10.1 second admin logs in with temporary password and must change it', await adminVisible(s) && await s.isVisible('#forcedPasswordOverlay'));
  await forcePw(s, 'Seray-Sifre-1');
  check('10.2 second admin works after choosing a password', !(await s.isVisible('#forcedPasswordOverlay')) && await s.evaluate(() => members.length >= 5));
  await a.evaluate(() => adminDeleteMember('Can Doğan')); await a.evaluate(() => closeCustomConfirm(true)); await wait(a, 4000);
  check('10.3 admin deletes a member: records and login permission removed', denied(await probe(c, (db, k) => db.collection('login_index').get().then(() => 'x'))) && await a.evaluate(() => !members.some(m => m.name === 'Can Doğan'))
    && (await probe(a, (db, id) => db.collection('member_self').doc(id).get().then(s => s.exists ? 'exists' : 'gone'), ids['Can Doğan'].id)) === 'gone'
    && (await probe(a, (db, uid) => db.collection('users').doc(uid).get().then(s => s.exists ? 'exists' : 'gone'), ids['Can Doğan'].uid)) === 'gone');
  const Cn = await device();
  await secureLoginUI(Cn.page, '0555 444 55 66', codeOf('Can Doğan'));
  check('10.4 deleted member\'s temporary password gives no access', await Cn.page.isVisible('#logged-out-screen'));

  // ============ 11) Şifre sıfırlama isteği yöneticiye ulaşır ============
  check('11.1 admin sees the visitor\'s reset request', await a.evaluate(() => passwordResetRequests.some(r => r.phone === '0542 249 32 27')));

  const errs = [...clean(A.errors), ...clean(B.errors), ...clean(D.errors), ...clean(S.errors)];
  check('12 no unexpected JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  for (const x of [A, B, C, D, S, Cn]) await x.browser.close();
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
