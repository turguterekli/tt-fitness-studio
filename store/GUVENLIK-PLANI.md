# Şifre güvenliği: geçiş planı (henüz UYGULANMADI)

## Bugünkü durum

- Uygulama Firebase'e **anonim** giriş yapar ve `members` koleksiyonunun tamamını okur.
- Üye şifreleri bu koleksiyonda **açık metin** durur; giriş kontrolü telefonda yapılır.
- Sonuç: uygulamayı açan herkes teknik olarak tüm üyelerin verisini ve şifresini okuyabilir.
  Uygulamadaki giriş ekranı, hatalı deneme sınırı ve giriş kaydı bunu engellemez.

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
