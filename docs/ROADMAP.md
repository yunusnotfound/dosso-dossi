# Dosso Dossi — Yol Haritası

Güncelleme: 7 Ekim 2026. Bu belge uygulanan özelliklerle henüz dış bilgi veya
sağlayıcı bekleyen işleri ayırır. API ayrıntıları: [API_CONTRACT.md](API_CONTRACT.md).

## Mevcut yapı

- **Mobil:** Flutter, Riverpod ve GoRouter. Normal geliştirme çalıştırması gerçek
  yerel REST API'yi kullanır; mock repository'ler test ve açıkça seçilen demo modu içindir.
- **Backend:** Express + TypeScript, Prisma ve PostgreSQL. Menü, şube, müşteri,
  cüzdan, sipariş, hediye, sadakat, kampanya ve yönetim API'leri uygulanmıştır.
- **Yönetim paneli:** React + TypeScript. Ayrı yönetici oturumu; super admin,
  yönetici, şube yöneticisi ve görüntüleyici yetkileri; işlem denetim kayıtları.
- **Veri kaynağı:** Ürünler, fiyatlar, şube müsaitliği, seçenek ücretleri ve kampanya
  ayarları backend/panel üzerinden yönetilir. Mobildeki mock katalog üretim veri kaynağı değildir.
- **Görseller:** Ürün grid/detay görselleri ve marka kampanya görselleri uygulamaya
  entegredir; tüm katalog artık yalnız emoji yer tutucularından oluşmaz.
- **Çalışma ortamı:** Yayın aşamasına kadar yerel API ile geliştirme devam eder.
  Bu çalışma yerel veritabanı bağlantı/servis yapılandırmasını değiştirmez.

## Uygulanan özellikler

- [x] Telefon/OTP oturumu, erişim tokenı ve dönen refresh tokenları; profil ve tercihler.
- [x] Menü, kategori, arama, ürün detay, şubeye özel fiyat/müsaitlik ve API'den ürün seçenekleri.
- [x] Sepet, promosyon, ikram kullanımı, sunucuda fiyat hesabı, sipariş geçmişi ve durum takibi.
- [x] Belirsiz ağ yanıtlarında korunan işlem anahtarı; tekrarın ikinci sipariş/hediye/yükleme oluşturmaması.
- [x] Cüzdan hareket defteri, tek kullanımlık QR, atomik iade ve sadakat geri alımı.
- [x] Paralel QR yenilemelerinin tek geçerli kod bırakması; yenilenen eski kodun iptali.
- [x] Kahve/bakiye hediyesi, kayıt sırasında güvenli aktarım ve bekleyen hediyeyi yeniden talep etme.
- [x] Panelden damga hedefi ve ilk yükleme kampanyası yönetimi; panel bakiye düzeltmesinin ilk yükleme hakkını tüketmemesi.
- [x] Gerçek konum izinli şube mesafesi; konum yokken uydurma mesafe göstermeyen akış.
- [x] Kampanya hikâyeleri, tarihli görünürlük, yüklenen görseller ve kampanya bağlantıları.
- [x] Admin sipariş, müşteri, menü, şube, kampanya ve finans modülleri; CSV/XLSX dışa aktarımı.
- [x] Sipariş + QR cirosunun şube ve tarih kırılımı; Türkiye saat diliminde işletme günü.
- [x] Teslim saatinin sunucuda hazırlık süresi ve çalışma saatlerine göre denetlenmesi.
- [x] Hesap kapatma/veri talebi API'leri, yönetici incelemesi ve kullanıcıya özel sayfalı JSON dışa aktarımı.
- [x] Uygulama içi sipariş, hediye, talep ve kampanya bildirimleri; okundu durumu ve tercih denetimi.
- [x] Finansal, yetkilendirme ve yarış koşulu regresyon testleri; geliştirme ve yayın ayarlarının ayrılması.

## İş kuralları

Varsayılan damga hedefi 5'tir. Varsayılan yükleme kampanyası, kullanıcının ilk
başarılı gerçek yüklemesi en az 1.000 TL ise 5 ikram verir. İlk yükleme eşik
altındaysa sonraki yükleme ilk-yükleme hakkını geri getirmez. Paneldeki kampanya
ayarları bu varsayılanları değiştirebilir; manuel bakiye düzeltmesi gerçek
müşteri yüklemesi sayılmaz.

Şubenin `isOpen` alanı manuel operasyon anahtarıdır. Sipariş kabulü ayrıca
`Europe/Istanbul` saat diliminde çalışma saatini ve hazırlık süresini denetler.
Görseldeki teslim saati istemci tarafından gönderilmiş olsa da son karar sunucudadır.

Hesap kapatma **hukuki veri silme işlemi değildir**. Bakiye ve bekleyen işlemler
sonuçlandıktan sonra girişler, oturumlar ve QR kodları kapatılır; finansal ve denetim
kayıtları korunur. Saklama/silme politikası onaylı hukuki metne göre ayrıca belirlenmelidir.

## Yayın öncesi dış bilgi veya hizmet bekleyenler

- [ ] Canlı API adresi, yayın altyapısı, Android/iOS imzalama ve mağaza hesapları.
- [ ] Onaylı KVKK/gizlilik metni ve gerçek bağlantısı; placeholder metin hukuki onay sayılmaz.
- [ ] Firebase/APNs bilgileri ve cihaz üzerinde uzaktan push teslimatının doğrulanması.
  Mevcut bildirim merkezi uygulama içindedir; cihaz arka plandayken uzaktan push gönderildiği iddia edilmez.
- [ ] Gerçek ödeme sağlayıcısı, SMS sağlayıcısı ve Kerzz POS bağlantıları.
  Bunlar mevcut iyileştirme çalışmasının kapsamı dışındadır; hazır arayüzlerin varlığı canlı entegrasyon anlamına gelmez.
- [ ] Gerçek cihazlarda iOS/Android yayın adayı kabul testi ve işletme ekibinin menü/fiyat/kampanya içerik onayı.

## Kodun geliştirilmesi

Mevcut feature klasörleri ve repository arayüzleri korunur. Yeni bir iş kuralı
önce küçük, bağımsız bir politika fonksiyonuna ayrılır; para, sadakat, bildirim
ve denetim yazımları aynı transaction içinde kalır. API gövdeleri şemayla doğrulanır,
yetki kontrolü yalnız mobil/panel arayüzüne bırakılmaz.

Testler uygulamanın geliştirme verisine karşı çalıştırılmaz. Backend entegrasyon
testleri yalnız adı `_test` ile biten ayrı ve doğrulanmış test veritabanını kullanır.
Güncel çalışma/test komutları için proje kökündeki [README.md](../README.md) izlenir.
