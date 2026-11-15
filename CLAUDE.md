# TT Fitness Studio

Spor salonu üyelik uygulaması. Arayüz ve yorumlar Türkçe; kullanıcıyla Türkçe konuş, teknik terim kullanma.

## Yapı
- `index.html` — uygulamanın TAMAMI (HTML + CSS + JS, ~9000 satır, ~600 KB; içinde base64 logo var).
  **Dosyayı baştan sona okuma** — `grep -n "function adı"` ile yeri bul, `sed -n` ile sadece o aralığı oku.
- `fonts/`, `vendor/` — yerel fontlar, Firebase SDK 10.13.0 (compat), jsPDF. CDN kullanılmaz.
- `tests/` — Playwright testleri, sahte Firebase ile (`tests/fake-firebase.js`). Canlı veriye dokunmaz.
- `android/`, `ios/`, `capacitor.config.json`, `scripts/build-www.js` — mağaza paketleri (Capacitor).
- `store/` — yayın rehberi, mağaza metinleri, ekran görüntüleri, güvenli moda geçiş rehberi, kontrol listeleri.
- `firestore.rules`, `storage.rules`, `firebase.json` — veritabanı kuralları ve emülatör ayarı.
- Web sitesi GitHub Pages ile repo kökünden (`main`) yayınlanır.

## index.html içindeki ana bölümler (grep ile bul)
- `BULUT EŞİTLEME` — `createDocSync`, `createCollectionSync`, `initFirebaseAndLoadData`, `stateRefs`
- `runTimeChecks`, `runAutoAttendance`, `claimAttendanceBatch` — tarihe bağlı işler, yoklama
- `loginMember`, `completeLogin`, `logOut`, `deleteMemberCompletely`, `saveForcedPassword`, `tryAutoLogin`
- `refreshAllViews` — başka cihazdan veri gelince / gün değişince ekranı yeniler
- `GÜVENLİ MOD` — `secureMode`, `loadSecureData`, `ensureMemberSyncs`, `memberFieldDefs`, `provisionMemberAccount`, `migrateToSecureMode`
- `SÖZLEŞME · AYDINLATMA · AÇIK RIZA` — `noticeSections`, `consentItems`, `LEGAL_TEXT_VERSION` (metin değişince artır)
- Üye ekranları `#view-*`, yönetici ekranları `#admin-view-*`

## Veri
- İki düzen var: ESKİ (anonim giriş, herkes her şeyi okur) ve GÜVENLİ MOD (Firebase Auth + kişiye özel belgeler:
  `member_self/{id}`, `member_admin/{id}`, `member_private/{id}`, `users/{uid}`). İkisi de çalışır durumda tutulmalı.
  Üyeye ait yeni bir veri eklerken `memberFieldDefs()` içinde doğru gruba (self/admin/priv) da ekle.
- Eski düzen — Firestore: `members/*`, `trainers/*`, `app_data/memberPackages`, `app_data/state_<alan>`.
  Kurallar izin vermezse eski tek belge `app_data/appState` kullanılır (`legacyStorageMode`).
- Yeni kalıcı veri eklerken `stateRefs` listesine ekle; değişkeni yeniden ATAMA (`x = ...`), yerinde değiştir.
- Kullanıcı metnini HTML'e basarken `escapeHtml()` kullan. Ayrıca tüm metinler buluta yazılırken/okunurken `neutralizeText()` ile süzülür; isimler için `safeName()`.
- Şifre: `setMemberPassword` / `verifyMemberPassword` (PBKDF2 özeti, `member.pw`); açık metin `member.password` YAZMA.
- Eski düzende veritabanı herkese açıktır; koruma güvenli modda gelir (bkz. `store/GUVENLIK-PLANI.md`).
- Sayfada CSP var: yeni bir dış adres (script, resim, bağlantı) eklenirse `<meta http-equiv="Content-Security-Policy">` güncellenmeli.

## Test (her değişiklikten sonra)
```bash
cd tests && npm install && npm test     # akış + eşitleme (2 mod) + vendor + güvenlik
npm run load                             # 50 üyelik yük testi
npm run smoke                            # tüm butonlar, 3 rol
# Güvenli mod (gerçek kurallar): önce emülatör, sonra test
npx firebase-tools@13 emulators:exec --only auth,firestore,storage --project demo-ttfitness "cd tests && node secure.test.js"
```
Canlı Firebase'e bağlanan test/komut ÇALIŞTIRMA.
