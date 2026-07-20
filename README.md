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
- Karanlık tema ve erişilebilir hareket tercihleri

## Çalıştırma

Herhangi bir kurulum veya derleme gerekmez. `index.html` dosyasını açın ya da statik bir sunucuda yayınlayın.

```bash
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın.

## Veri saklama

Uygulama verileri tarayıcının `localStorage` alanında tutulur. Ayarlar > Veri Yönetimi bölümünden düzenli JSON yedeği alınabilir.

