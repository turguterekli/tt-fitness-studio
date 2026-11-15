# Kontrol listeleri (15 Kasım 2026)

Durum: ✅ var · ➖ bu uygulama için geçerli değil · ⚠️ senin yapman gereken · ❌ yok

## Güvenlik

| # | Konu | Durum | Açıklama |
|---|---|---|---|
| 1 | Kimlik doğrulama | ✅ / ⚠️ | Güvenli modda Firebase Authentication. Geçişi başlatman gerekiyor (`GUVENLIK-PLANI.md`). |
| 2 | Yetkilendirme | ✅ / ⚠️ | `firestore.rules`, `storage.rules`. Konsolda yayınlanınca geçerli olur. |
| 3 | Girdi doğrulama | ✅ | Metinler yazılırken, kaydedilirken ve okunurken süzülür; adlar temizlenir; şifre en az 6 karakter. |
| 4 | SQL injection | ➖ | SQL veritabanı yok (Firestore). |
| 5 | XSS | ✅ | İçerik süzgeci + İçerik Güvenlik Politikası (CSP): başka yerden kod yüklenemez. |
| 6 | CSRF | ➖ | Çerezle oturum yok; istekler oturum anahtarıyla gider. |
| 7 | CORS | ➖ | Kendi sunucumuz yok; Firebase yönetir. |
| 8 | HTTPS | ✅ / ⚠️ | http ile açılırsa https'e yönlendirir. GitHub → Settings → Pages → "Enforce HTTPS" açık olmalı. |
| 9 | Güvenli çerezler | ➖ | Çerez kullanılmıyor. |
| 10 | İstek sınırlama | ✅ / ⚠️ | Giriş denemelerini Firebase sınırlar. Daha fazlası için App Check'i aç. |
| 11 | Başkasının kaydına erişim (IDOR) | ✅ | Kurallar kişiye göre kısıtlar; 21 farklı deneme testte reddediliyor. |
| 12 | Gizli anahtar yönetimi | ✅ | Kodda sır yok. İmza anahtarları GitHub Secrets'ta durur. Firebase `apiKey` sır değildir. |
| 13 | Dosya yükleme doğrulama | ✅ | Yalnızca resim, en çok 6 MB, yalnızca kişinin kendi klasörüne. |
| 14 | Genel hata yakalama | ✅ | Beklenmeyen hatada kullanıcıya uyarı, ayrıntı konsola. |
| 15 | Güvenlik başlıkları | ✅ / ➖ | CSP ve referrer sayfa içinden ayarlı; çerçeveye gömülme engelli. Diğer başlıklar GitHub Pages'te ayarlanamaz. |
| 16 | Kayıt / denetim izi | ✅ | Giriş kayıtları; her rızanın tarih-saat geçmişi. |
| 17 | Kütüphane taraması | ✅ | Dependabot + her değişiklikte `npm audit`. |
| 18 | Veritabanı güvenliği | ✅ / ⚠️ | Kurallar yazıldı ve test ediliyor; yayınlaman gerekiyor. |
| 19 | Yedek | ✅ / ⚠️ | Yönetici → Ayarlar → Yedek (elle). Otomatik yedek Firebase ücretli planında. |
| 20 | CI/CD güvenlik taraması | ✅ | GitHub Actions: testler, emülatörde kural testi, CodeQL. |

## Yayın öncesi (web sitesi)

| # | Konu | Durum | Açıklama |
|---|---|---|---|
| 1 | Başlık | ✅ | "TT Fitness Studio — Üye Uygulaması" |
| 2 | Meta açıklama | ✅ | |
| 3 | Paylaşım görseli (OG) | ✅ | `og-image.png` |
| 4 | sitemap.xml | ✅ | |
| 5 | robots.txt | ✅ | |
| 6 | Canonical | ✅ | Adres değişirse `index.html`, `sitemap.xml`, `robots.txt` içinde güncelle. |
| 7 | Yapılandırılmış veri | ✅ | WebApplication. Salonun adres/telefonu eklenirse LocalBusiness'a çevrilebilir. |
| 8 | Görsel alt metinleri | ✅ | |
| 9 | 404 sayfası | ✅ | `404.html` |
| 10 | HTTPS yönlendirmesi | ✅ / ⚠️ | Bkz. güvenlik 8. |
| 11 | Mobil uyum | ✅ | Gerçek telefonda son kontrolü sen yapmalısın. |
| 12 | Sayfa hızı | ✅ | Tek dosya, yerel font ve kütüphane; postür modeli yalnızca gerektiğinde iner. |
| 13 | Favicon | ✅ | |
| 14 | Search Console | ⚠️ | Google hesabınla sen ekleyeceksin (isteğe bağlı; uygulama üyelere özel). |
| 15 | Analitik | ➖ | Bilerek yok: izleme yapılmıyor, çerez onayı gerekmiyor. |
| 16 | Çağrı butonu (CTA) | ➖ | Tanıtım sitesi değil; ilk ekran giriş. |
| 17 | Form sonrası teşekkür sayfası | ➖ | Form yok. |
| 18 | İletişim bilgileri | ⚠️ | Yönetici → Ayarlar → Veri sorumlusu bilgileri'ni doldur; `privacy-policy.html` içindeki boşlukları da. |
| 19 | KVKK aydınlatma + gizlilik | ✅ / ⚠️ | Metinler yazıldı ve ayrıldı; bir avukata onaylatılmalı. |
| 20 | Çerez onayı | ➖ | Çerez ve izleme yok; yalnızca gerekli bilgiler cihazda saklanır (gizlilik sayfasında yazıyor). |
