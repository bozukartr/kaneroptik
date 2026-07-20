# Kaner Optik Yönetim

Kaner Optik için saf HTML, CSS ve JavaScript ile geliştirilmiş; masaüstü ve mobil kullanıma uyarlanmış optik mağaza yönetim uygulaması.

## Modüller

- Yönetim paneli ve KPI kartları
- Müşteri kayıtları, etiketler ve detay ekranı
- Optik reçete yönetimi ve lens diyagramı
- Satış, tahsilat ve otomatik stok düşümü
- A5 fatura ve termal fiş çıktısı
- Ürün/stok yönetimi ve kritik stok uyarıları
- Ciro, ödeme ve müşteri raporları
- CSV dışa aktarma ve JSON yedekleme/geri yükleme
- Mobil alt navigasyon ve hızlı işlem menüsü
- iPhone/iPad Safari safe-area, yatay kullanım ve klavye optimizasyonu
- Karanlık tema ve erişilebilir hareket tercihleri

## Çalıştırma

Herhangi bir kurulum veya derleme gerekmez. `index.html` dosyasını açın ya da statik bir sunucuda yayınlayın.

```bash
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın.

## Firebase kurulumu

Uygulama `kaneroptik` Firebase projesine bağlıdır. Derleme veya npm paketi gerekmez; resmi Firebase CDN modülleri kullanılır.

İlk kurulumdan önce Firebase Console'da:

1. **Authentication > Sign-in method** bölümünden Email/Password yöntemini etkinleştirin.
2. **Authentication > Users** bölümünde `admin@kaneroptik.app` kullanıcısını güçlü bir parolayla oluşturun.
3. **Firestore Database** bölümünden veritabanını oluşturun.
4. Bu repodaki güvenlik kurallarını ve uygulamayı yayınlayın:

```bash
npx firebase-tools login
npx firebase-tools deploy
```

İlk açılışta Firebase yönetici parolası yalnızca cihazı yetkilendirmek için bir kez istenir ve cihazda saklanmaz. Ardından belirlenen 4 haneli PIN kullanılır.

## Veri saklama ve güvenlik

- Müşteri, reçete, satış ve stok kayıtları Firestore ile cihazlar arasında senkronize edilir.
- Firestore'un çevrimdışı önbelleği sayesinde bağlantı kesildiğinde çalışmaya devam eder.
- PIN PBKDF2/SHA-256 ile özetlenerek yalnızca ilgili cihazda saklanır.
- Beş hatalı PIN denemesinden sonra 30 saniyelik kilit uygulanır.
- 15 dakika işlem yapılmadığında uygulama otomatik kilitlenir.
- Firestore kuralları yalnızca `admin@kaneroptik.app` hesabına erişim verir.
- Ayarlar > Veri Yönetimi bölümünden ayrıca JSON yedeği alınabilir.
