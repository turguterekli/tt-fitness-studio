# Şifre güvenliği: geçiş planı (henüz UYGULANMADI)

## Bugünkü durum

Uygulama kodunda yapılanlar (testi: `tests/security.test.js`):

- Şifreler artık **açık metin saklanmıyor**: rastgele tuz + PBKDF2 (SHA-256, 150.000 tur) özeti saklanır.
  Eski şifreler, üye bir sonraki başarılı girişinde otomatik özetlenir.
- Yönetimin verdiği kodla/geçici şifreyle giren üye, devam etmeden **kendi şifresini belirler** (en az 6 karakter).
- "Beni hatırla" oturumu şifre özetine bağlı bir anahtarla doğrulanır; sahte oturum ve şifre
  değiştikten sonraki eski oturum reddedilir.
- 5 hatalı denemede hem cihaz hem **hesap** (tüm cihazlardan) 5 dakika kilitlenir.
- Bilinmeyen numara ile yanlış şifre aynı hata mesajını verir.
- Metinlerdeki `< > "` karakterleri yazılırken, buluta yazılırken ve buluttan okunurken süzülür (kod enjeksiyonu).

Kodla kapatılamayan, **hâlâ açık** olanlar:

- Uygulama Firebase'e **anonim** giriş yapar ve tüm üye verisini (sağlık beyanları dahil) okur;
  veritabanı kuralları kişiye göre kısıtlamaz. Uygulamayı açan herkes teknik olarak bu veriyi okuyabilir.
- Şifre özetleri de okunabildiği için kısa/tahmin edilebilir şifreler deneme-yanılma ile bulunabilir.
- Giriş kontrolü ve deneme sınırı telefonda çalışır; veritabanına doğrudan bağlanan biri bunları atlar.

Bunların çözümü aşağıdaki geçiştir.

## Hedef

Girişi Firebase Authentication yapsın; veritabanı kuralları kimin neyi okuyup yazabileceğini
**sunucu tarafında** belirlesin.

## Adımlar

1. **Firebase konsolu** → Authentication → Sign-in method → *E-posta/Şifre*'yi aç. *(sen)*
2. **Kod** — giriş, telefon numarasından üretilen bir e-posta (`905xxxxxxxxx@uye.ttfitness.app`)
   ve şifreyle Firebase Authentication'a yapılır; yönetici üye eklerken hesap da açılır.
   Mevcut üyeler ilk girişlerinde otomatik taşınır; taşınan üyenin `password` alanı silinir. *(Claude)*
3. **Geçiş dönemi** — tüm aktif üyeler bir kez giriş yapana kadar eski kurallar kalır.
4. **Kuralları sıkılaştır** — aşağıdaki taslak konsola yapıştırılır (Firestore → Rules). *(sen)*
5. Anonim girişi kapat. *(sen)*

Bu geçiş, üye verisinin üyeye göre ayrı belgelere bölünmesini de gerektirir (şu an bir veri türü
tek belgede tüm üyeleri tutuyor; kural "sadece kendi verini oku" diyemez). Bu, kayıt düzeninde
bir adım daha değişiklik demektir.

## Kural taslağı (hedef düzen için; bugünkü veri düzenine UYMAZ, olduğu gibi yapıştırma)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null && request.auth.token.firebase.sign_in_provider != 'anonymous'; }
    function me() { return get(/databases/$(db)/documents/members/$(request.auth.uid)).data; }
    function isAdmin() { return signedIn() && me().role == 'admin'; }

    match /members/{uid} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == uid);
      allow create, delete: if isAdmin() || (signedIn() && request.auth.uid == uid);
      allow update: if isAdmin() || (signedIn() && request.auth.uid == uid
        && request.resource.data.role == resource.data.role);   // üye kendi rolünü değiştiremez
    }
    match /member_data/{uid}/{document=**} {      // üyeye özel tüm veriler
      allow read, write: if isAdmin() || (signedIn() && request.auth.uid == uid);
    }
    match /shared/{doc} {                         // duyurular, antrenörler, fiyatlar
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /admin_only/{doc} {                     // finans, giriş kayıtları
      allow read, write: if isAdmin();
    }
  }
}
```

## O zamana kadar

- Deneme/yönetici şifrelerini tahmin edilmesi zor şifrelerle değiştir.
- Firebase konsolunda App Check'i açmak, uygulama dışından erişimi zorlaştırır (tam çözüm değildir).
