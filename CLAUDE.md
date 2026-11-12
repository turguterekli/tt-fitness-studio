# TT Fitness Studio

Spor salonu üyelik uygulaması. Arayüz ve yorumlar Türkçe; kullanıcıyla Türkçe konuş, teknik terim kullanma.

## Yapı
- `index.html` — uygulamanın TAMAMI (HTML + CSS + JS, ~9000 satır, ~600 KB; içinde base64 logo var).
  **Dosyayı baştan sona okuma** — `grep -n "function adı"` ile yeri bul, `sed -n` ile sadece o aralığı oku.
- `fonts/`, `vendor/` — yerel fontlar, Firebase SDK 10.13.0 (compat), jsPDF. CDN kullanılmaz.
- `tests/` — Playwright testleri, sahte Firebase ile (`tests/fake-firebase.js`). Canlı veriye dokunmaz.
- `android/`, `ios/`, `capacitor.config.json`, `scripts/build-www.js` — mağaza paketleri (Capacitor).
- `store/` — yayın rehberi, mağaza metinleri, ekran görüntüleri, güvenlik planı.
- Web sitesi GitHub Pages ile repo kökünden (`main`) yayınlanır.

## index.html içindeki ana bölümler (grep ile bul)
- `BULUT EŞİTLEME` — `createDocSync`, `createCollectionSync`, `initFirebaseAndLoadData`, `stateRefs`
- `runTimeChecks`, `runAutoAttendance`, `claimAttendanceBatch` — tarihe bağlı işler, yoklama
- `loginMember`, `completeLogin`, `logOut`, `deleteMemberCompletely`
- `refreshAllViews` — başka cihazdan veri gelince / gün değişince ekranı yeniler
- Üye ekranları `#view-*`, yönetici ekranları `#admin-view-*`

## Veri
- Firestore: `members/*`, `trainers/*`, `app_data/memberPackages`, `app_data/state_<alan>`.
  Kurallar izin vermezse eski tek belge `app_data/appState` kullanılır (`legacyStorageMode`).
- Yeni kalıcı veri eklerken `stateRefs` listesine ekle; değişkeni yeniden ATAMA (`x = ...`), yerinde değiştir.
- Kullanıcı metnini HTML'e basarken `escapeHtml()` kullan.
- Bilinen açık: şifreler Firestore'da açık metin (bkz. `store/GUVENLIK-PLANI.md`).

## Test (her değişiklikten sonra)
```bash
cd tests && npm install && npm test     # akış + eşitleme (2 mod) + vendor
npm run smoke                            # tüm butonlar, 3 rol
```
Canlı Firebase'e bağlanan test/komut ÇALIŞTIRMA.
