# Mağazalarda yayınlama rehberi

Uygulama [Capacitor](https://capacitorjs.com) ile sarılıdır: web dosyaları (`index.html`, `fonts/`, `vendor/`)
aynen Android ve iOS paketinin içine konur. Uygulama kimliği: **`com.ttfitness.studio`**
(mağazaya ilk yüklemeden sonra değiştirilemez; değiştirmek istersen önce `capacitor.config.json`,
`android/app/build.gradle` ve Xcode'daki Bundle Identifier'ı güncelle).

> Mağaza kuralları ve ücretleri değişebilir; başvurmadan önce resmi sayfalardan doğrula.

## Yayından önce bitmesi gerekenler

- [ ] **Veritabanı erişim kuralları** — bkz. `store/GUVENLIK-PLANI.md`. Şifreler artık özetli saklanıyor, ama üye verisi
      hâlâ uygulamayı açan herkesçe okunabilir; Firebase konsolunda yapılacak adımlar var.
- [ ] **Gizlilik politikası** — `privacy-policy.html` içindeki e-posta / telefon / adres alanlarını doldur.
- [ ] **Deneme hesapları** — `admin1` ve örnek üyelerin şifrelerini değiştir.
- [ ] **Yüksek çözünürlüklü logo** — eldeki logo 240 piksel; ikonlar ondan büyütüldü ve hafif bulanık.
      En az 1024×1024 logoyu `assets/icon-only.png` olarak koyup `npx @capacitor/assets generate --ios --android` çalıştır.
- [x] Hesap silme (Ayarlar → "Hesabımı ve tüm verilerimi sil")
- [x] Ayrı onay kutuları, gizlilik politikası bağlantısı

## Android (Google Play)

1. [Play Console](https://play.google.com/console) hesabı aç (tek seferlik ücret).
2. **İmza anahtarı oluştur** (bir kez; dosyayı ve şifreyi KAYBETME, repoya KOYMA):
   ```bash
   keytool -genkey -v -keystore upload.jks -alias ttfitness -keyalg RSA -keysize 2048 -validity 10000
   ```
3. GitHub → repo → Settings → Secrets and variables → Actions altına ekle:
   - `TTF_KEYSTORE_BASE64` — `base64 -w0 upload.jks` çıktısı
   - `TTF_KEYSTORE_PASSWORD`, `TTF_KEY_ALIAS` (`ttfitness`), `TTF_KEY_PASSWORD`
4. GitHub → Actions → **Android paketi** → *Run workflow*. Bitince *Artifacts* içinden indir:
   - `app-debug.apk` — telefona doğrudan kurup denemek için
   - `app-release.aab` — Play Console'a yüklenecek dosya
5. Play Console'da uygulama oluştur → `store/MAGAZA-METINLERI.md` içindeki metinleri ve
   `store/` altındaki görselleri gir → *Veri güvenliği* formunu doldur → AAB'yi yükle.
6. Yeni bireysel hesaplarda yayından önce kapalı test şartı vardır (test kullanıcı sayısı ve süre
   için Play Console'daki güncel şarta bak). Salon üyelerini test kullanıcısı olarak ekleyebilirsin.

Her yeni sürümde `android/app/build.gradle` içindeki `versionCode` değerini 1 artır.

## iOS (App Store)

Mac + Xcode gerekir (ya da Codemagic gibi bir bulut derleme servisi).

1. [Apple Developer Program](https://developer.apple.com/programs/) üyeliği al (yıllık ücret).
2. Mac'te:
   ```bash
   npm install
   npm run ios        # web dosyalarını kopyalar ve Xcode'u açar
   ```
3. Xcode → *App* hedefi → *Signing & Capabilities* → kendi Team'ini seç.
4. *Product → Archive* → *Distribute App* → App Store Connect.
5. [App Store Connect](https://appstoreconnect.apple.com)'te uygulama kaydını oluştur, metin ve
   ekran görüntülerini (`store/screenshots/ios/`) gir, *App Privacy* formunu doldur.
6. *App Review Information* bölümüne inceleme ekibi için **çalışan bir deneme üye hesabı** yaz.

Not: Apple, yalnızca bir web sitesini saran uygulamaları reddedebilir. Ret gelirse gerekçeyi ilet;
telefona özgü özellik (ör. anlık bildirim) eklemek gerekebilir.

## Uygulamayı güncellemek

Web dosyaları paketin içinde olduğu için, `index.html` değişince mağazadaki uygulama **kendiliğinden
güncellenmez**: yeni sürüm üretip mağazaya yüklemek gerekir. (Web sitesi ise `main` dalına birleştirince
hemen güncellenir.)

```bash
npm run sync       # web dosyalarını android/ ve ios/ içine kopyalar
```

## Bu klasördekiler

| Dosya | Ne için |
|---|---|
| `screenshots/ios/*.png` | App Store ekran görüntüleri (1290×2796) |
| `screenshots/android/*.png` | Play Store ekran görüntüleri (1080×1920) |
| `play-feature-graphic-1024x500.png` | Play Store tanıtım görseli |
| `play-icon-512.png`, `appstore-icon-1024.png` | Mağaza ikonları (düşük çözünürlüklü logodan) |
| `MAGAZA-METINLERI.md` | Açıklama metinleri ve veri formu cevap taslakları |
| `GUVENLIK-PLANI.md` | Şifre güvenliği için geçiş planı ve kural taslağı |

Ekran görüntülerini yeniden üretmek için: `cd tests && node screenshots.js`
