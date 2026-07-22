# Kerzz POS Entegrasyonu — Hazırlık Notları

> CEO, yazarkasa POS entegrasyonunun **Kerzz POS** ile yapılacağını ve teknik
> ekiple görüştüreceğini iletti (Temmuz 2026). Bu doküman görüşme öncesi
> hazırlıktır. (Not: mailde "Kerrz" yazıyor; firmanın resmi adı **Kerzz** —
> kerzz.com / kerzzpos.com)

## 1. Kerzz POS nedir?

Restoran/kafe sektörüne odaklı Türk POS ve otomasyon sistemi. Öne çıkanlar:

- Sipariş alma, adisyon, stok/reçete maliyet takibi, ödeme takibi
- **Çok şubeli merkezi yönetim**: menü, fiyat, stok ve kampanyalar tüm
  şubelere tek merkezden uygulanabiliyor (bizim 4 şube için önemli)
- **Müşteri sadakat uygulamaları** modülü mevcut
- Muhasebe entegrasyonları, anlık raporlama
- Online sipariş platformu entegrasyonları (siparişler doğrudan POS'a düşüyor)
- Cafe & Bar sektörüne özel çözümü var

Sitede halka açık API dokümantasyonu **bulunamadı** — API detayları teknik
görüşmede istenecek (aşağıdaki soru listesi).

## 2. Bizim uygulamada entegrasyonun dokunacağı noktalar

| Uygulama özelliği | Entegrasyon ihtiyacı |
|---|---|
| **Tara & Öde (QR/barkod)** | Kasiyer kodu okutunca: müşteriyi tanıma → Dosso Kart bakiyesinden düşme → damga işleme → uygulamaya anlık yansıma |
| **Damga / ikram** (5 kahve → 1) | Kasada yapılan her kahve satışının damga sayması; ikram kullanımının POS'ta indirim/bedelsiz kalem olarak işlenmesi |
| **Bakiye yükleme** (1.000 ₺ → 5 ikram) | Kasada nakit/kartla Dosso Kart'a yükleme yapılabilecek mi? Bonus kuralı kimde çalışacak? |
| **Gel-Al siparişi** | Uygulamadan verilen siparişin şubenin POS ekranına/yazıcısına düşmesi, hazırlanma durumu geri bildirimi |
| **Menü** | Menü/fiyatların tek kaynağı POS mu olacak? Öyleyse menü senkron endpoint'i gerekli |
| **Kampanyalar** | Kerzz kampanya modülü mü, bizim backend mi yönetecek? Çifte damga günü gibi kurallar |

## 3. Kod tarafında şimdiden hazır olanlar

- **QR/barkod üretimi tek fonksiyonda**: `lib/features/scan_pay/presentation/scan_pay_screen.dart`
  içindeki `_generateCode()`. Şu an `DDPAY|<telefon>|<zaman>` üretiyor; Kerzz'in
  beklediği formata geçiş tek noktadan yapılacak. Kod 60 sn'de yenileniyor
  (tek kullanımlık token mantığına uygun).
- **Repository deseni**: Tüm veri kaynakları interface arkasında
  (`MockXRepository` → `ApiXRepository`); POS'a bağlı akışlar ekran koduna
  dokunmadan değişecek.
- **API istemcisi iskeleti**: `lib/core/network/api_client.dart` +
  `api_endpoints.dart` hazır.
- **Kampanya kuralları tek dosyada**: `lib/core/constants/app_config.dart`
  (5 damga = 1 ikram, 1.000 ₺ → 5 ikram).

## 4. Mevzuat bağlamı (bilgi amaçlı)

Türkiye'de yazarkasa (ÖKC — Ödeme Kaydedici Cihaz) tarafında satış
yazılımı ↔ yazarkasa POS entegrasyonu GİB düzenlemelerine tabidir; ödeme
alındığında mali fiş ÖKC üzerinden kesilmek zorundadır. Pratik sonuç:
**uygulama içi Dosso Kart ödemesi bile kasada mali belgeye bağlanmalı** —
bu akışın nasıl kurgulandığını Kerzz ekibine sormak kritik.

## 5. Teknik ekibe sorulacak sorular

**API & altyapı**
1. REST API / webservis dokümantasyonu paylaşılabilir mi? (endpoint listesi, örnek istek/yanıt)
2. Kimlik doğrulama nasıl? (API key, OAuth, IP kısıtı, şube bazlı yetki)
3. Test/sandbox ortamı ve test şubesi verilebilir mi?
4. Webhook/anlık bildirim desteği var mı (ödeme tamamlandı, sipariş durumu değişti)?

**Tara & Öde akışı**
5. Kasadaki barkod/QR okuyucu bizim ürettiğimiz kodu okuyup Kerzz üzerinden bizim backend'e iletebilir mi, yoksa kod formatını Kerzz mi belirliyor?
6. Ödeme onayı akışı: bakiye düşme işlemini kim yapar — Kerzz mi, bizim backend mi? Çift taraflı mutabakat (settlement) nasıl olacak?
7. Kod tek kullanımlık/süreli olacak — sunucu imzalı token desteği var mı?

**Sadakat & kampanya**
8. Kerzz'in sadakat modülü mü kullanılacak, yoksa sadakat bizim backend'de kalıp Kerzz sadece satış bildirimi mi gönderecek? (Önerimiz: sadakat bizde, POS satış event'i gönderir)
9. Satış kaleminde "kahve" kategorisini damga sayacına bağlamak için ürün/kategori eşleşmesi nasıl yapılır?
10. İkram (bedelsiz içecek) POS'ta nasıl kaydedilir — %100 indirim mi, özel kalem mi?

**Sipariş & menü**
11. Uygulamadan Gel-Al siparişi POS'a hangi kanalla düşer? (Kerzz'in online sipariş entegrasyon modülü kullanılabilir mi?)
12. Menü ve fiyat senkronizasyonunun tek kaynağı hangisi olacak?
13. Şube bazlı stok/ürün kapatma bilgisi API'den okunabilir mi ("bugün cheesecake yok")?

**Operasyon**
14. 4 şubenin (Beylikdüzü Vadi Loca, Beylikdüzü Son Durak, Vatan Caddesi, Diyarbakır Stad) hepsinde aynı Kerzz sürümü/altyapısı mı var?
15. ÖKC/mali fiş akışı: uygulama içi ödemede fiş kasadan mı kesiliyor? E-arşiv desteği?

## 6. Önerilen mimari (görüşmede teyit edilecek)

```
Mobil Uygulama ──REST──▶ Dosso Backend (bizim API)
                              │  ▲
                    satış/ödeme│  │webhook (satış, sipariş durumu)
                              ▼  │
                         Kerzz POS (şubeler)
                              │
                         ÖKC / mali fiş
```

- Uygulama **yalnızca bizim backend** ile konuşur (güvenlik + tek sözleşme).
- Backend ↔ Kerzz arasında çift yönlü köprü: sipariş gönderme, satış
  webhook'u alma, bakiye düşme onayı.
- Sadakat/kampanya kuralları bizim backend'de kalır; Kerzz satış olaylarını
  bildirir. Böylece kampanya değişikliği POS güncellemesi gerektirmez.

## 7. Yapılacaklar

- [ ] CEO'dan Kerzz teknik ekip görüşmesini planlamasını iste
- [ ] Görüşmede yukarıdaki soruları sor, API dokümanını al
- [ ] Sandbox erişimi + test şubesi talep et
- [ ] QR kod formatını Kerzz'in beklediği yapıya göre `_generateCode()`'da güncelle
- [ ] `docs/API_CONTRACT.md`'ye (Faz 8) Kerzz köprü endpoint'lerini ekle
- [ ] Mutabakat (gün sonu bakiye/satış eşleşmesi) raporu ihtiyacını netleştir

## Kaynaklar

- [Kerzz resmi site](https://kerzz.com/) · [Kerzz POS özellikler](https://www.kerzzpos.com/tr/tum-ozellikler) · [Cafe & Bar çözümü](https://www.kerzzpos.com/tr/sektor/cafe-bar)
- Yazarkasa entegrasyon mevzuat bağlamı: [Optimus POS — yazarkasa entegrasyonları](https://www.optimuspos.com/yazarkasa-entegrasyonlari/), [Gökbim — entegrasyon zorunluluğu](https://www.gokbim.com.tr/yazarkasa-entegrasyon-zorunlulugu/)
