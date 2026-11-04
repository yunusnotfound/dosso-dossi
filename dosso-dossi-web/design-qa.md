# Sanal mağaza — sütunlar ve mermer yüzeyler

Tarih: 14 Ekim 2026. Yerel uygulama: http://localhost:4000/.

## Görsel karşılaştırma

- Kaynak görsel: `/Users/berkaydemir/dosso-dossi/output/store3d-review/roman-columns/approved-scene.png` (1536 × 1024).
- Uygulama görüntüsü: `/Users/berkaydemir/dosso-dossi/output/store3d-review/roman-columns/store-final.png` (1440 × 1000 CSS/piksel, DPR 1).
- Birlikte karşılaştırma: `../output/store3d-review/roman-columns/comparison-final.png`. İki görüntü de oranları korunarak 900 × 630 alanlara yerleştirildi; görüntü perspektifleri farklı olduğundan piksel eşitliği iddia edilmiyor.
- Yakın detay: `../output/store3d-review/roman-columns/capitals-comparison-final.png`. Sütun kıvrımları, düşey oyuklar, kaideler ve açık üst halka incelendi.
- Durum: mağaza turu açık, Genel görünüm; ayrıca Kahve seçkisi, Termos duvarı ve Kahve barı ziyaret edildi.

## Bulgular ve düzeltmeler

1. İlk görünümde üst halka başlık alanının arkasında kesiliyordu. Giriş kamerasının baktığı nokta yükseltildi; son masaüstü görüntüsünde kaideden halkaya tüm obje görünür.
2. Önceki geniş avize sütun siluetinin dışına taşıyordu; halka yarıçapları daraltıldı. Eşzamanlı başka çalışma daha sonra avizeyi silindir sarkıtlara dönüştürdü. Bu son değişiklik korunmuştur; son görüntüde kolonlarla çakışma görülmüyor.
3. Raflar kullanıcının sonraki isteğiyle turuncu mermer, içecek barı ve 44 çıtası kahverengi mermer yapıldı. Barın iki turuncu şeridi kaldırıldı. Mevcut ekipman ve ürün koordinatları korundu.
4. Afişlerdeki 6 cm krem paspartu kaldırıldı. Dört kaynak afişin tamamı 941 × 1672; görsel oranı aynı siyah çerçeve açıklığına birebir oturuyor, kırpma/esnetme yok. Yakın kanıt: `../output/store3d-review/roman-columns/brown-counter-posters-final.png`.

## Görsel yüzeyler

- Tipografi/içerik: mevcut arayüz ve afiş metinleri korundu. Afişler orijinal dosyalardır; logo yeniden çizilmedi.
- Yerleşim: dört sütun kaidesi mevcut merkez standının çarpışma sınırları içinde; raf üstleri 0.86 / 1.76 / 2.66 m olarak korundu.
- Renk: fildişi kuvars, turuncu mermer, kahverengi mermer ve ince bronz detaylar. Onay görselindeki daha sıcak çevresel ışık ve ahşap tavan kirişleri mevcut oda yapısını değiştirmemek için kopyalanmadı.
- Görsel kalite: gerçek Three.js geometri, oyuklu sütun ve kıvrımlı başlıklar. Tekrarlayan taş dokuları metre ölçekli UV kullanıyor. Gerçek zamanlı render ile referansın çevrimdışı ışık kalitesi farklıdır.
- İçerik farkları: son turuncu raf/kahverengi bar istekleri ve eşzamanlı avize/orta gövde güncellemeleri referans görselden bilinçli olarak farklıdır.

## Doğrulama

- `npm run typecheck`: geçti.
- `npm run build`: geçti. Sonrasında yalnız iki turuncu şerit mesh çağrısı kaldırıldı.
- Tarayıcı konsolunda hata/uyarı: yok.
- Raftaki Türk Kahvesi tıklanarak doğru ürün detayı açıldı.
- Yeşil termos tıklanarak doğru ürün ve yeşil varyant açıldı; kapatma/geri dönüş çalıştı.
- Bağımsız geometri kontrolü: sonlu koordinatlar, ürün destek yüzeyleri, çarpışma sınırları ve idempotent kaynak temizliği geçti.
- Sütunlar: 149.904 üçgen / 2 çizim çağrısı. Raflar: 27.288 üçgen / 4 çağrı. Kahverengi bar: 3.608 üçgen / 1 çağrı.
- 390 × 844 mobil DOM/canvas ölçüleri doğru; in-app tarayıcı ekran yakalaması küçültülmüş görüntü verdiği için bu görüntü mobil görsel onay kanıtı sayılmadı. Gerçek cihaz performans testi yapılmadı.

## Üretilen dokular

Built-in `image_gen` kullanıldı; özgün görseller korunarak 1024 × 1024 WebP kopyaları projeye alındı:

- `public/images/store3d/objects/roman-ivory-quartz-v1.webp`
- `public/images/store3d/objects/orange-marble-v1.webp`
- `public/images/store3d/objects/espresso-brown-marble-v1.webp`

İstem kayıtları: `../output/store3d-review/roman-columns/generation-prompts.json` ve `brown-marble-prompt.json`.

final result: passed

Bu sonuç, uygulanan 3D objelerin masaüstü görünümü ve kontrol edilen etkileşimler içindir. Piksel düzeyinde referans eşitliği veya gerçek cihaz performans garantisi değildir.
