# Testler

Uygulama, gerçek Firebase yerine `fake-firebase.js` ile (tarayıcı içinde çalışan sahte veritabanı)
açılır; böylece testler **canlı üye verilerine asla dokunmaz**.

```bash
cd tests
npm install
npx playwright install chromium   # ilk seferde
npm test        # akış + eşitleme (iki düzende) + yerel kütüphane testleri
npm run smoke   # üye / tam yetkili admin / kısıtlı admin ekranlarındaki her butona tıklar, JS hatası ve XSS arar
```

- `flow.test.js` — giriş, onay ekranı (ayrı onay kutuları), öğün, mesaj, aktivasyon, giriş kaydı ve deneme sınırı
- `sync.test.js` — iki cihaz aynı anda, eski veriden aktarım, tarih ilerlemesi, yoklama (`legacy` argümanıyla: kısıtlı veritabanı kuralları)
- `load.test.js` — 50 üyelik yük testi: yönetici 50 üye ekler, her üye giriş yapar; 8 gün sonrası yoklama (`npm run load`)
- `vendor.test.js` — repodaki gerçek Firebase SDK / jsPDF / fontların yüklendiğini ve CDN isteği kalmadığını doğrular
