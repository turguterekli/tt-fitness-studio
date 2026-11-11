# Testler

Uygulama, gerçek Firebase yerine `fake-firebase.js` ile (bellekte çalışan sahte veritabanı)
açılır; böylece testler **canlı üye verilerine asla dokunmaz**.

```bash
cd tests
npm install
npx playwright install chromium   # ilk seferde
npm test        # akış testi (giriş, sözleşme, öğün, mesaj, aktivasyon) + eşitleme testi (iki cihaz, eski veriden aktarım, tarih ilerlemesi, yoklama)
npm run smoke   # üye / tam yetkili admin / kısıtlı admin ekranlarındaki her butona tıklar, JS hatası ve XSS arar
```
