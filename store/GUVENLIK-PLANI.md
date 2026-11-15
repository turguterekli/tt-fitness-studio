# Güvenli moda geçiş rehberi

Uygulamada iki çalışma düzeni var. **Güvenli mod hazır ve test edildi, ama senin başlatman gerekiyor.**

| | Eski düzen (şu an) | Güvenli mod |
|---|---|---|
| Giriş | Telefonda kontrol edilir | Firebase Authentication doğrular |
| Şifre | Özet olarak veritabanında | Firebase'de; uygulama hiç görmez |
| Veri | Uygulamayı açan herkesin cihazına iner | Yalnızca giriş yapanın kendi verisi iner |
| Yetki | Uygulama kodu karar verir | Veritabanı kuralları sunucuda zorlar |

## Geçiş — 3 adım (sırayı değiştirme)

### 1) Firebase konsolunda giriş yöntemini aç
[Firebase konsolu](https://console.firebase.google.com) → **tt-fitness-app** → Authentication → Sign-in method →
**Email/Password** → Enable → Save.

### 2) Uygulamada geçişi başlat
Tam yetkili yönetici olarak gir → Ayarlar → **Veri Güvenliği** → yönetici şifreni yaz → **Güvenli moda geç**.

- Yönetici şifren en az 6 karakter olmalı (değilse önce değiştir).
- Uygulama herkese (ikinci yönetici dahil) 8 karakterlik **geçici şifre** üretir ve listeler. Bunlar üye
  kartlarında da görünür. Her üye ilk girişinde kendi şifresini belirler.
- Aynı telefon numarası iki kayıtta varsa geçiş durur ve hangileri olduğunu söyler.
- Eski kayıtlar silinmez; yalnızca yöneticinin okuyabildiği yedek olarak kalır.

### 3) Kuralları yayınla (asıl korumayı bu sağlar)
Konsolda:
- **Firestore Database → Rules**: repodaki `firestore.rules` dosyasının tamamını yapıştır → Publish.
- **Storage → Rules**: repodaki `storage.rules` dosyasının tamamını yapıştır → Publish.

Bilgisayarda Firebase CLI varsa tek komut: `firebase deploy --only firestore:rules,storage --project tt-fitness-app`

> 2. adımı yapıp 3. adımı yapmazsan uygulama güvenli modda çalışır ama veritabanı hâlâ herkese açıktır.
> 3. adımı 2. adımdan ÖNCE yaparsan kimse giriş yapamaz.

### 4) İsteğe bağlı sıkılaştırma
- Authentication → Sign-in method → **Anonymous** → kapat.
- Authentication → Settings → Password policy → en az 8 karakter.
- App Check'i aç (uygulama dışından erişimi zorlaştırır).

## Güvenli modda kim neyi görebilir (`firestore.rules`)

| Kayıt | Üye | Yönetici | Giriş yapmamış |
|---|---|---|---|
| Kendi yazdıkları (öğün, mesaj, profil, onaylar, sağlık beyanı) | okur, yazar | okur, yazar | — |
| Salonun onun hakkında tuttukları (program, paket, ödeme, ölçüm, yoklama) | sadece okur | okur, yazar | — |
| Yönetim notları | — | okur, yazar | — |
| Başka üyelerin herhangi bir verisi | — | okur, yazar | — |
| Gelir/gider, tüm duyurular, giriş kayıtları | — | okur, yazar | — |
| Fiyatlar, sözleşme sürümü, sıralama özeti (maskeli adlar) | sadece okur | okur, yazar | — |
| Şifre sıfırlama isteği bırakma | — | okur, siler | sadece bırakır |

`tests/secure.test.js` bunları gerçek Firebase emülatöründe, bu kural dosyasıyla dener (50 kontrol):
ziyaretçi, anonim oturum, kendi kendine kayıt olan yabancı ve bir üye için toplam 30'dan fazla yetkisiz
okuma/yazma denemesi reddedilir.

## Bilinen sınırlar
- **İkinci yönetici:** kurallarda iki yönetici de tam yetkilidir; "kısıtlı yönetici" ayrımı yalnızca ekrandadır.
- **Şifre sıfırlama sonrası eski cihaz:** yetki hemen silinir ve o cihaz kendini çıkışa zorlar. Kötü niyetli,
  değiştirilmiş bir istemci açık bağlantısından en fazla yaklaşık 1 saat daha okuyabilir; yazamaz.
- **Silinen üyenin giriş hesabı** Firebase Authentication'da kalır ama hiçbir veriye erişemez. İstersen
  konsoldan (Authentication → Users) silebilirsin.
- **API anahtarı:** `index.html` içindeki Firebase `apiKey` bir sır değildir; tasarım gereği herkese açıktır ve
  `.env` dosyasına taşımak onu gizlemez (tarayıcıya giden her şey okunabilir). Koruma, yukarıdaki kurallardır.
- **Yedek:** Yönetici → Ayarlar → Yedek ile elle indirilir. Otomatik günlük yedek için Firebase'in ücretli
  planındaki zamanlanmış yedekleme gerekir.
