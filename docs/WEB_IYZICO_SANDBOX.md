# Web mağazası iyzico sandbox hazırlığı

Bu adaptör yalnız `https://sandbox-api.iyzipay.com` ile çalışır. Canlı ödeme, mobil uygulamanın `PAYMENT_PROVIDER` ayarı ve sahte başarılı ödeme simülasyonu bu akışa bağlı değildir. Anahtarlar henüz gelmediği için gerçek bir iyzico oturumu açılmadı; yerel testler sağlayıcı yanıtlarını taklit ederek protokol ve güvenlik sınırlarını doğrular.

## Yapılandırma

Backend `.env` dosyasında sunucuya özel alanlar:

```dotenv
WEB_PAYMENT_MODE=sandbox
WEB_IYZICO_API_KEY=
WEB_IYZICO_SECRET_KEY=
WEB_IYZICO_CALLBACK_URL=
WEB_PUBLIC_URL=http://127.0.0.1:4000
```

Anahtarlar ve callback boş kalabilir. Eksik/geçersiz yapılandırmada `getPaymentAvailability()` yalnız `{provider:'IYZICO', mode:'sandbox', configured:false}` döndürür; ağ isteği yapılmaz ve ödeme başarılı sayılmaz. Gizli anahtarlar istemciye aktarılmaz. Canlı anahtarlar ve sandbox dışındaki ödeme modları reddedilir.

`WEB_IYZICO_CALLBACK_URL`, geçerli SSL sertifikasına sahip dışarıdan erişilebilir bir backend adresi olmalı ve tam olarak `/web/payments/iyzico/callback` yolu ile bitmelidir. Örnek: `https://api.magaza.example.com/web/payments/iyzico/callback`. Kullanıcı girdisinden, Host başlığından veya sorgu parametresinden callback türetilmez. `localhost`, özel geliştirme hostları, IP adresleri, URL kullanıcı bilgileri, başka yollar ve sorgu parametreleri kabul edilmez. Bu iş kapsamında tünel açılmadı veya yayın yapılmadı; yalnız localhost adresleriyle gerçek sağlayıcı callback testi tamamlanamaz.

`WEB_PUBLIC_URL`, ödeme sonucundan sonra müşterinin döneceği sabit web originidir. Yerel development/test için HTTP loopback mümkündür; diğer durumlarda HTTPS gerekir. Kimlik bilgileri geldiğinde anahtarlar `.env` içine eklenip backend yeniden başlatılır. Gerçek uçtan uca sandbox kabul testi, erişilebilir HTTPS callback ve iyzico test kartları ile ayrıca yapılır; bu tamamlanmadan canlıya geçilmez.

## Sağlayıcı sözleşmesi

- Checkout Form Initialize: `/payment/iyzipos/checkoutform/initialize/auth/ecom`.
- Checkout Form Retrieve: `/payment/iyzipos/checkoutform/auth/ecom/detail`.
- Her istek için benzersiz random key ve `IYZWSv2` HMAC-SHA256 kullanılır. İmza, gönderilen JSON baytlarının aynısı üzerinden hesaplanır.
- Form HTML’i uygulamada çalıştırılmaz. İmzalı initialize yanıtından alınan, tokenı eşleşen `sandbox-cpp.iyzipay.com` hosted ödeme adresine yönlendirilir; belgelenmiş sandbox API `/checkoutform/` adresi de sınırlı olarak kabul edilir. Canlı/başka hostlar, ek portlar, URL kullanıcı bilgileri ve yönlendirme parametreleri reddedilir. Kart alanları uygulamaya veya kendi API’mize gönderilmez.
- TRY tutarları siparişin sunucuda hesaplanan snapshot’ından kuruş olarak alınır. `price` ve `paidPrice` tam sipariş toplamına eşittir; taksit seçenekleri `[1]` ile sınırlıdır. Ürün satırları miktar dahil toplam bedelle, pozitif kargo ücreti ayrı bir `VIRTUAL` sepet satırıyla gönderilir. Ücretsiz ürünler siparişte korunur ancak parasal sağlayıcı satırından çıkarılır. Toplamı sıfır olan ödeme başlatılmaz.
- iyzico’nun zorunlu `identityNumber` alanında yalnız resmi sandbox örneğindeki test değeri kullanılır. Müşteriden gerçek TCKN istenmez veya saklanmaz. Bu test kimliği canlı akışta kullanılamaz; canlı kimlik/fatura gereksinimleri geçiş sırasında ayrıca ele alınmalıdır.
- Initialize yanıtının `conversationId:token` imzası doğrulanır. Sağlayıcının verdiği geçerlilik varsa kısaltılarak, yoksa 15 dakikalık yerel ödeme penceresi uygulanır; bu süre sağlayıcı tokenının gerçek ömrü için garanti değildir.
- Callback içindeki token veya tarayıcı sonucu ödeme otoritesi değildir. Backend token ile tekrar Retrieve çağrısı yapar. İmza, token, conversation, sipariş/basket ID, TRY, `price` ve `paidPrice` ayrı ayrı doğrulanır. Para ayrıştırması yuvarlama yapmaz; kuruş altı bedeller reddedilir. İmza için ondalık son sıfırlar resmi kurala göre kaldırılır.
- Yalnız doğrulanmış `paymentStatus=SUCCESS` ve `fraudStatus=1` başarılı ödeme sonucudur. Risk incelemesi `0`, eksik/geçersiz fraud değeri veya bilinmeyen ödeme durumu siparişi sevke uygun yapmaz; reddedilen fraud `-1` başarısızdır. Sipariş servisi bu sonucu rezervasyon, iptal ve tekrar eden callback durumu ile birlikte değerlendirir.
- `itemTransactions` yalnız işlem/satır ID’leri ve kuruş bedelleriyle normalize edilir. İmzaya dahil olmayan bu satır verisi, authenticated HTTPS üzerinden alınan muhasebe/iade referansıdır; tek başına ödeme onayı vermez. Ham sağlayıcı yanıtı, kart bilgisi veya alıcı PII’si saklanmaz/loglanmaz.

## Belirsiz sonuçlar ve doğrulama

İstek ve yanıt okuması 15 saniye ile, yanıt gövdesi 256 KiB ile sınırlıdır. HTTP yönlendirmeleri izlenmez. Başlatma isteği otomatik tekrarlanmaz: timeout, ağ kopması, bozuk yanıt, imza/URL uyuşmazlığı veya doğrulanamayan durum, sağlayıcıda oturum oluşturulmuş olabileceği için `AMBIGUOUS`/`INVALID_RESPONSE` olarak ele alınır. Sipariş servisi bu durumda yeni bir ücretlendirme başlatmak yerine inceleme durumunu korur.

Yalnız kendi conversation ID’sini taşıyan, token üretmemiş ve açık hata kodlu initialize ret yanıtı `INITIALIZE_REJECTED` kabul edilir. Hata yanıtı conversation ID içermiyorsa sonuç temkinli biçimde belirsiz kalır. Retrieve sorgusunun başarısız olması, ödemenin başarısız olduğunun kanıtı değildir.

Yerel sağlayıcı testleri:

```bash
cd dosso-dossi-backend
npm run test:web -- src/web-test/iyzico.test.ts
```

Bu testler gerçek ağ/ödeme olmadan eksik yapılandırma, sabit endpoint ve yönlendirme sınırları, istek/yanıt imzaları, tam kuruş bedelleri, korelasyon, fraud durumları, zaman aşımı/tekrarlamama, yanıt boyutu ve hassas veri ayıklamasını denetler.

## Resmi kaynaklar

- [iyzico Checkout Form API sözleşmesi](https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/payment-methods/checkoutform)
- [IYZWSv2 HMACSHA256 kimlik doğrulama](https://docs.iyzico.com/on-hazirliklar/kimlik-dogrulama/hmacsha256-kimlik-dogrulama)
- [Yanıt imzası alan sırası ve trailing-zero kuralı](https://docs.iyzico.com/ek-servisler/imza-yanitinin-dogrulanmasi)
- [Resmi sandbox Checkout Form örneği ve test kimliği](https://github.com/iyzico/iyzipay-python/blob/master/samples/initialize_checkout_form.py)
