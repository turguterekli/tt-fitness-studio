const { open, login } = require('./lib');
const results = [];
const check = (name, cond, extra='') => { results.push((cond?'PASS ':'FAIL ')+name+(extra?' — '+extra:'')); };
(async () => {
  const { browser, page, errors } = await open();
  const reload = async () => { await page.reload(); await page.waitForFunction(() => document.getElementById('cloudLoadingOverlay').style.display==='none'); };
  const flush = () => page.evaluate(() => flushAllAutosaves());
  // 1. wrong password
  await login(page, '0542 249 32 27', 'wrong');
  check('wrong password rejected', (await page.textContent('#loginError')).includes('hatalı'));
  // 2. member login -> contract gate
  await login(page, '0542 249 32 27', '1234');
  check('contract gate shown', await page.isVisible('#view-contractgate'));
  await page.selectOption('#gateBirthDay', '5'); await page.selectOption('#gateBirthMonth', '3'); await page.selectOption('#gateBirthYear', '1995');
  await page.check('#contractAcceptCheckbox');
  check('accept btn enabled', !(await page.isDisabled('#contractAcceptBtn')));
  await page.click('#contractAcceptBtn');
  check('onboarding shown', await page.isVisible('#onboardingOverlay'));
  for (let i=0;i<4;i++) await page.click('#onboardingNextBtn');
  check('onboarding closed', !(await page.isVisible('#onboardingOverlay')));
  // 3. add meal via UI
  await page.click('#member-app .tab[data-view="nutrition"]');
  await page.click('.meal-block >> nth=0 >> .meal-add');
  await page.fill('#addName-0', 'Yumurta <b>haşlama</b>');
  await page.fill('#addCal-0', '155');
  await page.click('#confirmAddMealBtn-0');
  await page.waitForTimeout(300);
  const mealText = await page.textContent('#mealBlocks');
  check('meal added & escaped', mealText.includes('Yumurta <b>haşlama</b>'));
  // 4. message
  await page.evaluate(() => openMemberSubScreen('messages'));
  await page.fill('#myMessageInput', 'Merhaba <img src=x onerror="window.__pwn=1">');
  await page.click('#view-messages button:has-text("Gönder")');
  check('member message rendered as text', (await page.textContent('#myMessageThread')).includes('<img src=x'));
  await flush(); await page.waitForTimeout(300);
  // 5. reload -> auto login, data persisted
  await reload();
  check('auto login after reload', await page.isVisible('#member-app'));
  check('no contract gate after reload', !(await page.isVisible('#view-contractgate')));
  const persisted = await page.evaluate(() => ({ meals: getMemberMeals(currentMemberName)['Kahvaltı'].length, msgs: (memberMessages[currentMemberName]||[]).length, bday: getMemberProfile(currentMemberName).birthday }));
  check('meal persisted', persisted.meals >= 1, JSON.stringify(persisted));
  check('message persisted', persisted.msgs === 1);
  check('birthday persisted', persisted.bday === '1995-03-05');
  await page.evaluate(() => { getMemberMeals(currentMemberName)['Öğle'].push({name:'Salata', cal:200, portion:1, photo:'https://example.invalid/p.jpg', date: toLocalDateStr(getNow())}); });
  await flush(); await page.waitForTimeout(200);
  // 6. logout -> admin
  await page.evaluate(() => logOut());
  check('logout shows login screen', await page.isVisible('#logged-out-screen'));
  await login(page, 'admin1', 'tt2026');
  check('admin app shown', await page.evaluate(()=>getComputedStyle(document.getElementById('admin-app')).display!=='none'));
  check('admin unread badge', await page.evaluate(()=>Object.values(adminMessageUnread).some(Boolean)));
  await page.evaluate(() => { switchAdminTab('announce'); switchCommTab('messages'); openAdminMessageThread('Mert Aydın'); });
  await page.waitForTimeout(400);
  check('XSS did not execute in admin thread', !(await page.evaluate(()=>window.__pwn)));
  await page.fill('#adminMessageInput', 'Merhaba Mert, görüşürüz');
  await page.evaluate(() => sendAdminMessage());
  // admin meal review shows meal (escaped)
  await page.evaluate(() => { navigateToAdminScreen('mealreview'); toggleMealCard('Mert Aydın'); });
  const mr = await page.textContent('#adminMealList');
  check('admin sees member meal escaped', mr.includes('Yumurta <b>haşlama</b>'));
  const commented = await page.evaluate(() => { const inp = document.querySelector('[id^=photoComment-]'); if(!inp) return false; inp.value='Güzel <i>tabak</i>'; inp.nextElementSibling.click(); return true; });
  check('admin can comment on meal photo', commented);
  // 7. create member
  await page.evaluate(() => openAddMemberScreen());
  await page.fill('#newMemberName', 'Deneme Üye'); await page.fill('#newMemberPhone', '0500 000 00 01');
  await page.click('button:has-text("Hesap Oluştur ve Davet Gönder")');
  await page.waitForTimeout(300);
  const code = await page.evaluate(() => (members.find(m=>m.name==='Deneme Üye')||{}).activationCode);
  check('member created with code', !!code);
  await flush(); await page.waitForTimeout(300);
  await page.evaluate(() => logOut());
  // 8. new member activates
  await login(page, '05000000001', code);
  check('new member activated and logged in', await page.isVisible('#member-app'), await page.textContent('#loginError'));
  check('new member sees contract gate', await page.isVisible('#view-contractgate'));
  await page.evaluate(() => logOut());
  // 9. Mert sees admin reply
  await login(page, '0542 249 32 27', '1234');
  await page.evaluate(() => { skipOnboarding(); openMemberSubScreen('messages'); });
  await page.evaluate(() => switchTab('nutrition'));
  check('member sees trainer photo comment', (await page.textContent('#mealBlocks')).includes('Antrenör: Güzel <i>tabak</i>'));
  await page.evaluate(() => openMemberSubScreen('messages'));
  check('member sees admin reply', (await page.textContent('#myMessageThread')).includes('görüşürüz'));
  // 10. stored doc size sanity
  const sizes = await page.evaluate(() => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('__fakeStore'))).map(([k,v])=>[k, JSON.stringify(v).length])));
  check('all docs under 1MB', Math.max(...Object.values(sizes)) < 1048576, 'largest doc '+Math.max(...Object.values(sizes))+' bytes, docs '+Object.keys(sizes).length);
  const errs = errors.filter(e=>!/ERR_FAILED|Postür modeli|status of 404/.test(e));
  check('no JS errors', errs.length===0, errs.join(' | '));
  console.log(results.join('\n'));
  await browser.close();
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n').slice(0,4).join('\n')); process.exit(1); });
