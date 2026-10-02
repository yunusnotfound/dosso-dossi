# Bağımsız sağlamlaştırma çalışması - 02.10.2026

Bu çalışma D01-D24 planının uygulamasıdır. Backend ve PostgreSQL local çalışmaya devam eder. Gerçek ödeme, Kerzz POS, SMS/push teslim bağlantıları bekleyen entegrasyon kapsamındadır.

## Veri ve uyumluluk

- `tokenVersion` alanları varsayılan 0 ile eklendi. Sürüm bilgisi içermeyen eski access token'lar, yalnız sürümü hâlâ 0 olan hesaplarda geçerli kalır.
- Tüm oturumları iptal, admin şifre değişimi/sıfırlama ve erişim kapsamı değişimi eski access token'ları da reddeder. Normal tek cihaz çıkışı o refresh token'ını iptal eder; access token kısa ömrü boyunca geçerli kalabilir. İstemci çıkışta kişisel belleği hemen temizler.
- Bloke müşteri kendi hesap verisini okuyabilir; yeni finansal mutasyon yapamaz. Kasada önceden oluşturulmuş QR tahsilatı da işlem içinde kontrol edilir.
- `FinancialRequest`, kullanıcı/işlem/anahtar bazında tekrar denemeyi tanımlar. Yeni istemci UUID gönderir. Eski istemciler için alan opsiyoneldir; tam tekrar koruması anahtar gönderen istemcilerde sağlanır.
- Sipariş `expectedTotal` değişirse, cüzdandan düşmeden `409 PRICE_CHANGED` ve `error.details.total` döner. Müşteri yeni fiyatı görüp yeniden onaylar.
- Damga hedefi değişiminde kazanılmış ilerleme ve aktif kartın hedefi korunur. Sonraki kart yeni hedefle açılır. Yeni sadakat olayları iptal hesabını destekleyen yapılandırılmış işlem izi taşır; eski geçmiş yeniden yazılmaz.
- İade defteri aynı sipariş için ödeme ve iadenin ayrı satır olmasına izin verir; her işlem türü sipariş başına benzersizdir.
- İki uyumlu migration mevcuttur. Bakiyeler, damgalar, ürünler ve kullanıcılar sıfırlanmaz.

## Yerel test akışı

Test veritabanı açıkça seçilmelidir. Testler her senaryoda fixture tablolarını sıfırlar; uygulamanın veritabanını kesinlikle kullanmayın. URL local olmalı ve veritabanı adı `_test` ile bitmelidir. Kurulum `migrate deploy` kullanır; `db push --accept-data-loss` kaldırıldı.

```bash
# Yalnız ayrı test container'ı; mevcut dosso-db / 5433 değişmez.
docker run --name dosso-reliability-tests -d -p 127.0.0.1:55434:5432 \
  -e POSTGRES_USER=fixes -e POSTGRES_PASSWORD=isolated_fixes_only \
  -e POSTGRES_DB=dosso_fixes_test postgres:17
cd dosso-dossi-backend
TEST_DATABASE_URL=postgresql://fixes:isolated_fixes_only@127.0.0.1:55434/dosso_fixes_test npm test
npm run typecheck
npm run build
# Standart başlangıç: dist/src/index.js
npm start
```

## Bağımlılık bakım kararı

`qs`, `brace-expansion` (iki dal), `vitest`/`@vitest/mocker`, `nanoid`, `postcss` ve `sharp` için mevcut sürüm aralıkları içindeki güvenlik yamaları kilit dosyasına işlendi. Prisma veya ExcelJS otomatik olarak eski ana sürüme düşürülmedi.

İki kök duyuru için dar kapsamlı, belgeli risk kararı:

- [deepmerge-ts GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): Prisma konfigürasyon aracının bağımlılığı. Sorun döngüsel JavaScript nesne grafiği birleştirilmesini gerektiriyor; sıradan JSON bunu oluşturamaz. Bu projede istemci girdisi Prisma config birleştiricisine verilmez. `prisma.config.ts` / derleme yapılandırması yalnız güvenilen kaynak kabul edilir. Uyumlu üst paket yaması gelince kaldırılacak; Prisma'yı geriye almak veya major override uygulamak yerine mevcut çalışma korunur.
- [uuid GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): ExcelJS zincirinde eski sürüm var. Etkilenen v3/v5/v6 + dış buffer yolu uygulamada kullanılmıyor; ExcelJS'nin kaynak kullanımı koşullu biçimlendirme kimliğinde parametresiz v4. Dışarıdan XLSX şablonu yükleyen bir API yok; export sunucu tarafından oluşturulur. Uyumlu ExcelJS yaması veya ayrı doğrulanmış major geçişi izlenir.

Bu kararlar audit sayısını sıfır göstermez. Son taramadaki 5 kayıt, bu iki kök duyurunun üst paketlere yansımasıdır. Yeni bir dış şablon/konfigürasyon içe aktarma özelliği açılmadan bu erişilebilirlik değerlendirmesi yenilenmelidir.

## Dışa aktarım ve iş kuralları

- Liste/CSV/XLSX aynı arama ve tarih filtrelerini kullanır. CSV artık ilk 200 satırla sınırlanmaz.
- 10.000 satırın üstünde dosya sessizce kırpılmaz; API 400 ile filtre daraltmayı ister.
- Kullanıcı metninin formül başlangıçları CSV'de etkisizleştirilir. Sayısal tutarlar sayı olarak kalır. XLSX hücreleri uygulama tarafından tipli üretilir.
- Şube müdürünün kapsamlandırılamayan global CRM, cüzdan/finans ve POS ekranları/API'leri kapalıdır; kendi şube siparişleri korunur.
- Kahve hediyesi için mevcut genel ikram hakkı kuralı korunur. Uygun içecek (damga kazandıran ürün) zorunludur; paket çekirdek veya merch ürünü ikrama dönüştürülemez.
- Hesap silme/saklama politikası, GPS ürün kararı ve gerçek sağlayıcı akışları bu teknik düzeltmeye karıştırılmadı.

## Planın uygulama karşılığı

| Paket | Uygulanan değişiklik |
| --- | --- |
| D01 | İptal ve iade ortak kullanıcı kilidi altında; aynı siparişe ikinci iade yazılmaz. Tekrarlanan iptal önceki sonucu döndürür. |
| D02 | Manuel bakiye düzeltmesi atomik; yetersiz bakiye reddedilir. Para girişlerinde kuruş altı tutar kabul edilmez. |
| D03 | Sipariş, hediye, ikram, yükleme ve admin düzeltmeleri ortak kilit sırasını kullanır; ilk yükleme bonusu bir kez kazanılır. |
| D04 | Sipariş/hediye/yükleme için kalıcı UUID ve sunucuda işlem kaydı; mobilde yükleme sırasında ortak tek işlem koruması. Belirsiz sonuç aynı anahtarla sorgulanır/tekrarlanır. |
| D05 | Global müşteri/finans/POS erişimleri şube müdürüne API ve panel seviyesinde kapalı; sipariş şube kapsamı korunur. |
| D06 | Admin sorgu önbelleği her oturuma özel; mobil sepet/şube/kişisel durum sıfırlanır. Eski oturumun geç yanıtı yeni oturuma uygulanmaz. |
| D07 | Hesap blokajı işlem içinde yeniden kontrol edilir; toplu oturum iptali, şifre ve yetki değişimi eski erişim token'larını geçersizleştirir. |
| D08 | Dio yenilemesi ortak Future kullanır; tekrar deneme kuyruğu kilitlenmez. Geçici bağlantı hatası token silmez. |
| D09 | Seçili şube ve aktif opsiyon fiyatları API'den gelir. Onaylanan toplam değişirse finansal işlemden önce açık hata ve yeniden onay gerekir. |
| D10 | Anahtara özel ayar doğrulaması ve public kampanya modeli; afiş/SSS hesaplama ile aynı kuralları kullanır. Aktif damga kartı tamamlanınca yeni hedefe geçer. |
| D11 | Şube kartından sipariş seçilen şubeyle açılır; ürün müsaitliğini değiştirmek özel fiyatı silmez. |
| D12 | Kahve hediyesi yalnız damga kazandıran uygun ürünlerden gönderilir; genel ikram hakkı sözleşmesi ekranda açıklanır. |
| D13 | Canlı pano aktif siparişleri sunucudan ayrı ve sayfalı alır; geçmiş liste filtresi aktif işleri gizlemez. |
| D14 | QR gerçek expiresAt ile yaşar; süresi geçmiş kod gizlenir, hata/yeniden dene gösterilir. Görünmeyen ekranda yenileme durur. |
| D15 | Ana sayfa yenilemesi cüzdan/sadakati bekler; geçmişte hata ve boş durum ayrıdır. Geçerli şube yoksa sipariş ilerlemez; tercihler sıralı kaydedilir. |
| D16 | Mağaza içeriği ortak kaydırmada; küçük ekranda klavye taşması giderildi. Sepet, favori ve ilerleme açıklamaları erişilebilirlik için güçlendirildi. |
| D17 | Panel grid ve detay görsellerini açıkça ayrı veya birlikte yönetir; mobil görsel hata yedeği vardır. |
| D18 | Ortak liste/export filtreleri, açık 10.000 satır sınırı, CSV metin/formül koruması ve kuruş gösterimi. |
| D19 | Ödeme+iade aynı sipariş detayında; LTV sıralaması tüm müşterilerde sayfalama öncesi; sipariş sayısı ve bonus adedi doğru hesaplanır. |
| D20 | OTP tek tüketim ve kota atomik; IP/telefon sınırları, süre aşımı temizliği ve sınırlı bellek kullanımı. |
| D21 | Takip ekranında dispose/geç yanıt koruması; hazır durumundan sonra tamamlandı/iptal durumuna kadar takip sürer. |
| D22 | Standart başlangıç derlenen `dist/src/index.js` dosyasıyla hizalandı; ayrı port/DB ile gerçek başlangıç doğrulandı. |
| D23 | Uyumlu yamalar uygulandı; kalan iki kök duyuru için yukarıdaki dar risk kararı ve takip şartı belgelendi. |
| D24 | Admin sayfaları ayrı yüklenir. Sync gerçek HTTP ve ayrı PostgreSQL üzerinde ölçüldü; gereksiz cache veya mimari geçiş yapılmadı. |

## Performans ölçümü

`scripts/benchmark-sync.ts` açıkça seçilen local `dosso_sync_perf*_test` veritabanını zorunlu tutar. Test 10.000 sentetik AuditLog ile gerçek `/sync/revisions` HTTP çağrılarını kullandı.

| Ölçüm | Sonuç |
| --- | --- |
| 100 ardışık istek | p50 5,729 ms; p95 7,136 ms; en yüksek 9,417 ms |
| 10 eşzamanlı istek | p50 24,140 ms; p95 29,340 ms; grubun toplam süresi 30,910 ms |
| PostgreSQL EXPLAIN ANALYZE | 4,612 ms; 271 bellek bloğu isabeti, diskten okuma 0 |
| Admin ana JavaScript | 723,63 kB → 274,55 kB; gzip 210,31 kB → 86,75 kB |
| En büyük ayrı admin parçası | 380,46 kB; gzip 109,43 kB |

Sorgu AuditLog üzerinde hâlâ tam tarama yapıyor. Bu küçük yerel ölçekte belirgin darboğaz görülmedi; çok sayıda gerçek istemci için kapasite/SLA sonucu çıkarılmaz. Canlı revision davranışını geciktirecek yeni cache süresi eklenmedi.

## Bilinen sınırlar ve işletim kararı

- Ödeme, Kerzz ve gerçek SMS/push teslimi kullanıcı talebiyle kapsam dışıdır. Local backend/PostgreSQL bilerek korunur; bu çalışma canlı sağlayıcı kabul testi değildir.
- Yeni sadakat kayıtları sıralı işlem iziyle yeniden hesaplanabilir. Eski veya karışık geçmişte eksik bilgiyi uydurmak yerine korumalı ters işlem uygulanır; audit kaydına `loyaltyReviewRequired` yazılır. Bu kayıtlar yönetici incelemesi gerektirir.
- Eski, yalnız açıklama metniyle tutulmuş iadeler tahmin yoluyla siparişe bağlanmadı. Yeni iadeler gerçek `orderId` ile ilişkilidir; tarihi veri için ayrıca doğrulanmış eşleştirme gerekir.
- Rate limit şu an tek backend sürecinin belleğindedir. Birden çok backend örneğine geçişte ortak limit deposu gerekir; mevcut local mimariye yeni servis eklenmedi.
- Dosya sınırının üzerindeki export, veri kaybetmek yerine filtre daraltılmasını ister.
- D23'teki iki geçişli bağımlılık duyurusu belgeli risk kararıdır; bağımlılık taraması sıfır açık iddiası taşımaz.
- Widget ve tarayıcı regresyonları gerçek banka/POS, tam cihaz matrisi veya bağımsız penetrasyon testi yerine geçmez.

## Son doğrulama kaydı

- Backend: 18 test dosyasında 191/191 başarılı; finansal eşzamanlılık/fiyat/sadakat senaryolarını içeren 32 yeni regresyon ve yetki/OTP/rapor senaryolarını içeren 15 yeni regresyon dahil. Typecheck ve build başarılı.
- Admin: 13 tarayıcı regresyonu başarılı; API yanıtları izole olarak taklit edildi (65 istek). Son build başarılı. Lint: 0 hata, önceden mevcut 5 uyarı.
- Mobil: `flutter analyze` temiz; tüm 59/59 test başarılı. Klavye açık 320×568 ve 375×667 görünüm, 1×/2× yazı boyutu, sepet/favori/ilerleme etiketleri, şube değişiminde eski fiyat yanıtı ve geç bakiye yanıtı senaryoları dahil. Büyük metinde mağaza kartları tek sütuna geçer; normal metinde mevcut grid korunur. Fiziksel VoiceOver/TalkBack cihaz testi yapılmadı.
- Geçici test container’ı son doğrulamadan sonra kaldırıldı; mevcut `dosso-db` çalışıyor.
- Prisma şeması geçerli; iki migration önce ayrı test DB'de, sonra yedek alınmış mevcut local DB'de `migrate deploy` ile uygulandı. Kullanıcı/ürün/bakiye kayıtlarını sıfırlayan işlem yapılmadı.
- `npm start` derlenmiş sunucusu ayrı port ve test DB ile açıldı; health, public config, menü ve sync uçları 200 ve geçerli JSON döndürdü. Bu deneme sunucusu kapatıldı; mevcut geliştirme backend'i çalışmaya devam etti.
- Güncellenen sharp paketinde yerel PNG üretimi başarılı. Kaynak diff beyaz boşluk kontrolü temiz.
- Çalışan iPhone 17 Pro simülatöründe full restart sonrası ana sayfa, sipariş kataloğu, ürün detayı ve online mağaza görsel olarak kontrol edildi. Latte'nin 190 TL taban fiyatı +60 TL yulaf sütü seçiminde 250 TL gösterdi. Sepete ekleme/tahsilat yapılmadan ana sayfaya dönüldü. Mevcut hesap bakiyesi ve 4/5 ilerlemesi korundu.
- Son yerel erişim kontrolü: backend `http://localhost:3000/health` ve admin `http://localhost:5173/` HTTP 200. Uygulama ana sayfada açık bırakıldı.

Testler gerçek kullanıcı bakiyesiyle sipariş, hediye veya tahsilat oluşturmadı. Finansal senaryolar ayrı test veritabanında yürütüldü.
