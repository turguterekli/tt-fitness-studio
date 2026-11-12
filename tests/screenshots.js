// Mağaza ekran görüntülerini üretir (örnek verilerle, sahte veritabanı üzerinde).
// Kullanım: node screenshots.js  → ../store/screenshots/{ios,android}/
const { newContext, openPage, login } = require('./lib');
const path = require('path');
const OUT = path.resolve(__dirname, '..', 'store', 'screenshots');
const targets = [
  { dir: 'ios', viewport: { width: 430, height: 932 }, scale: 3 },      // 1290 x 2796 (iPhone 6.7")
  { dir: 'android', viewport: { width: 360, height: 640 }, scale: 3 },  // 1080 x 1920
];
(async () => {
  for (const t of targets) {
    const { browser, ctx } = await newContext({ ctx: { viewport: t.viewport, deviceScaleFactor: t.scale } });
    const { page } = await openPage(ctx, { time: '2026-11-11T09:30:00' });
    const shot = async name => { await page.waitForTimeout(2600); await page.screenshot({ path: path.join(OUT, t.dir, name + '.png') }); };
    await login(page, '0542 249 32 27', '1234');
    await page.evaluate(() => {
      contractAccepted[currentMemberName] = true; contractAcceptedVersion[currentMemberName] = CONTRACT_VERSION;
      getMemberProfile(currentMemberName).birthday = '1994-04-12';
      memberPackages[currentMemberName] = { size: 12, used: 5, start: '2026-10-20', end: '2026-11-20' };
      goalNotes[currentMemberName] = 'Yıl sonuna kadar 80 kiloya inmek';
      document.getElementById('hamburgerBtn').style.visibility = 'visible';
      document.getElementById('memberSearchBtn').style.visibility = 'visible';
      try { localStorage.setItem('ttf_onboarded_' + currentMemberName, '1'); } catch (e) {}
      skipOnboarding(); notificationCenterItems = []; refreshAllViews();
      switchTab('home', document.querySelector('#member-app .tab[data-view="home"]'));
    });
    await shot('1-ana-sayfa');
    await page.evaluate(() => switchTab('program', document.querySelector('#member-app .tab[data-view="program"]'))); await shot('2-program');
    await page.evaluate(() => switchTab('nutrition', document.querySelector('#member-app .tab[data-view="nutrition"]'))); await shot('3-beslenme');
    await page.evaluate(() => { switchTab('progress', document.querySelector('#member-app .tab[data-view="progress"]')); openMemberSubScreen('weighttrack'); }); await shot('4-gelisim');
    await page.evaluate(() => switchTab('membership', document.querySelector('#member-app .tab[data-view="membership"]'))); await shot('5-uyelik');
    await page.evaluate(() => logOut());
    await login(page, 'admin1', 'tt2026');
    await page.evaluate(() => switchAdminTab('home')); await shot('6-yonetici');
    await browser.close();
  }
  console.log('tamam');
})();
