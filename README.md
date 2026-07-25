# Kaner Optik Yönetim

Kaner Optik için saf HTML, CSS ve JavaScript ile geliştirilmiş; masaüstü ve mobil kullanıma uyarlanmış optik mağaza yönetim uygulaması.

## Modüller

- Yönetim paneli ve KPI kartları
- Müşteri kayıtları, etiketler ve detay ekranı
- Optik reçete yönetimi ve lens diyagramı
- Reçete ekranından ayrılmadan hızlı müşteri oluşturma
- Satış, tahsilat ve otomatik stok düşümü
- A5 fatura ve termal fiş çıktısı
- Ürün/stok yönetimi ve kritik stok uyarıları
- Ciro, ödeme ve müşteri raporları
- CSV dışa aktarma ve JSON yedekleme/geri yükleme
- Mobil alt navigasyon (Panel, Müşteri, Reçete, Satış, Stok) ve "Daha" sayfası
- Mobil hızlı işlem menüsü ve bağlama duyarlı eylem düğmesi
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

1. **Authentication > Sign-in method** bölümünden **Anonymous** yöntemini etkinleştirin.
2. **Firestore Database** bölümünden veritabanını oluşturun.
3. Bu repodaki güvenlik kurallarını ve uygulamayı yayınlayın:

```bash
npx firebase-tools login
npx firebase-tools deploy
```

Uygulama açılışta kimlik doğrulama istemez; arka planda sessizce anonim oturum açar ve
doğrudan panele düşer. Anonymous yöntemi etkin değilse uygulama yine açılır, yalnızca
bulut senkronizasyonu devre dışı kalır ve veriler cihazda tutulur.

## Veri saklama ve güvenlik

- Müşteri, reçete, satış ve stok kayıtları Firestore ile cihazlar arasında senkronize edilir.
- Firestore'un çevrimdışı önbelleği sayesinde bağlantı kesildiğinde çalışmaya devam eder.
- Firebase SDK'sına ulaşılamazsa uygulama yine doğrudan açılır ve yerel modda çalışır;
  değişiklikler cihazda saklanır ve bağlantı geri geldiğinde senkronize edilir.
- Ayarlar > Veri Yönetimi bölümünden JSON yedeği alınabilir.

> **Erişim uyarısı.** Uygulamada kilit ekranı, PIN veya oturum açma adımı yoktur:
> uygulamayı açan herkes aynı müşteri, reçete ve satış kayıtlarının tamamını görür ve
> düzenleyebilir. Firestore kuralları da adlandırılmış tek bir hesap yerine herhangi bir
> anonim oturuma izin verir; proje yapılandırması istemci kodunda yer aldığı için
> uygulamanın yayınlandığı adrese ulaşan herkes veritabanına erişebilir. Kayıtlar ad,
> soyad, telefon, TC kimlik numarası ve reçete bilgisi içerdiğinden dağıtımı yalnızca
> mağaza içi/özel bir adresle sınırlamanız önerilir.
