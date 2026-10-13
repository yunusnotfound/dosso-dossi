# iyzico ödeme altyapısı

13 Ekim 2026. Mobil uygulama, Dosso Dossi Kart bakiye yüklemesini iyzico'nun barındırdığı Checkout Form üzerinden yapar. Kart numarası, son kullanma tarihi ve CVV uygulamaya/backend'e alınmaz. Mevcut cüzdanla sipariş ödeme akışı korunur.

## API anahtarları geldiğinde

1. iyzico hesabının **Dosso Dossi Kart bakiye yükleme iş modelini** desteklediğini iyzico ile doğrulayın. Teknik Checkout Form desteği tek başına bu kullanım için ticari onay anlamına gelmez. Hesapla ilgili kısıtlar koddan doğrulanamaz.
2. Önce sandbox anahtarlarını sunucu secret ortamına koyun; mobil derlemeye veya repoya eklemeyin. Yerel `.env` içinde sağlayıcı `iyzico` olarak seçildi; anahtarlar eklenmedi. API bilgileri hazır olana kadar gerçek yükleme kapalıdır. Geliştirme simülasyonu gerekiyorsa `dev` açıkça seçilmelidir.
3. Backend için geçerli sertifikalı ve iyzico'nun erişebileceği HTTPS adresi sağlayın. Yerel geliştirmede kendi denetiminizde HTTPS tüneli kullanılabilir; callback URL'si uygulama bağlantısı değildir.
4. Aşağıdaki callback ve webhook yollarını yapılandırın. iyzico hesabında **X-IYZ-SIGNATURE-V3** özelliğini açtırın; imzasız/eski imzalı bildirimler kabul edilmez. Merchant Portal'dan webhook bildirimi ayarlanır. [Resmî webhook kılavuzu](https://docs.iyzico.com/en/advanced/webhook)
5. Ortam ayarlarını kaydettikten sonra backend sürecini yeniden başlatın. Farklı bir ortama kurarken `npx prisma generate`, `npx prisma migrate deploy` ve `npm run build` komutlarını backend dizininde çalıştırın; mevcut yerel veritabanına yeni eklemeli migration uygulandı. `npm run payment:check` yapılandırmayı kontrol eder.
6. Aşağıdaki kabul senaryolarını sandbox üzerinde tamamlayın. Sonra üretim API anahtarlarıyla `IYZICO_ENVIRONMENT=production` ve `NODE_ENV=production` kullanın. Uygulama yalnızca doğrulanmış sağlayıcı sonucunda bakiyeyi artırır.

```dotenv
PAYMENT_PROVIDER=iyzico
IYZICO_ENVIRONMENT=sandbox
IYZICO_API_KEY=<sunucu-secret>
IYZICO_SECRET_KEY=<sunucu-secret>
IYZICO_CALLBACK_URL=https://<backend-host>/webhooks/iyzico/callback
IYZICO_TIMEOUT_MS=10000
```

`IYZICO_ENVIRONMENT` API adresini sabit ve güvenli biçimde seçer; key'lerin gönderileceği serbest bir API URL ayarı yoktur. Zaman aşımı 1–30 saniye arasındadır. Anahtar/callback eksikliği sunucunun diğer özelliklerini kapatmaz; ödeme yapılandırması pasif döner ve ödeme başlatma 503 verir. iyzico arızasında ya da ayar eksikliğinde **dev sağlayıcıya dönüş yapılmaz**. `PAYMENT_PROVIDER=dev` yalnız açıkça seçilmiş yerel simülasyondur ve üretimde sunucunun açılmasını engeller. Canlı çalışmada sandbox seçimi de reddedilir.

Callback: `POST /webhooks/iyzico/callback` (`application/x-www-form-urlencoded`, token). Merchant Portal webhook: `POST /webhooks/iyzico/notification` (JSON, `X-IYZ-SIGNATURE-V3`). Mobil yapılandırma: `GET /me/wallet/payment-config` (oturum gerekli). Callback'in URL'si aynen yukarıdaki ortam değişkenine yazılmalıdır.

Backend bir reverse proxy arkasındaysa `TRUST_PROXY` değişkenine yalnız gerçek ingress IP/CIDR adreslerini virgülle ayırarak yazın. Varsayılan boş değer istemcinin gönderdiği `X-Forwarded-For` başlığına güvenmez. `true`, hop sayısı veya `/0` kullanılmaz. Canlı topolojide gerçek müşteri IP'sinin sağlayıcıya ulaştığını kabul testinde doğrulayın.

Backend dizininde `npm run payment:check` anahtar değerlerini göstermeden ortamın hazır olup olmadığını kontrol eder. Bu komut veritabanına bağlanmaz, iyzico'ya istek atmaz ve ödeme başlatmaz.

## Ödeme akışı ve sınırlar

- `POST /me/wallet/topup`: tutar, kalıcı idempotency anahtarı ve alıcı bilgileriyle ödeme oturumu açar. Alıcı adı/soyadı, e-posta, kimlik numarası ve fatura adresi müşteriden gelir; telefon doğrulanmış müşteri hesabından, IP sunucudan alınır. Sahte kimlik/e-posta/adres üretilmez. Kimlik ve adres bilgileri ödeme niyetine, tekrar deneme kaydına veya loga kaydedilmez.
- Sağlayıcıya tek `VIRTUAL` bakiye yükleme kalemi, TRY ve tek çekim gönderilir. `conversationId`, `basketId` ve kalem ID'si yerel PaymentIntent ID'sidir. Initialize sonucu ödeme başarısı sayılmaz; token ve izinli HTTPS ödeme adresi uygulamaya döner. [Checkout Form başlatma](https://docs.iyzico.com/en/payment-methods/checkoutform/cf-implementation/cf-initialize)
- API istekleri **IYZWSv2** ile imzalanır. Gönderilen gövdenin tam bayt dizisi imzaya dahildir. Her isteğin kriptografik rastgele değeri farklıdır. [Resmî istek imzası](https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth)
- Callback yalnız yeniden sorgulama tetikler; tarayıcının yönlendirilmesi, bildirimin `SUCCESS` demesi veya uygulamanın kendi beyanı bakiyeyi artırmaz. V3 webhook da sağlayıcıdan sonucu yeniden sorgular. İstek zamanı aşımı, hatalı imza ve imzasız API hatası “ödeme reddedildi” diye yorumlanmaz.
- Initialize ve retrieve yanıt imzaları sabit zamanlı karşılaştırılır; parasal değerlerin imzasında iyzico'nun sondaki sıfır normalizasyonu uygulanır. [Yanıt imzaları](https://docs.iyzico.com/ek-servisler/imza-yanitinin-dogrulanmasi)
- Sonuçta token, konuşma/sepet/kalem kimlikleri, TRY ve tutar eşleşmelidir. `status=success`, `paymentStatus=SUCCESS` ve `fraudStatus=1` birlikte sağlanınca cüzdan ve ikram bir kez artırılır. İncelemedeki risk sonucu (`fraudStatus=0`) bekler. Sağlayıcının ödeme ve kalem işlem referansları sonraki mutabakat/destek için saklanır. [Checkout Form sonuç alanları](https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/payment-methods/checkoutform)
- Müşterinin yalnız kendi ödemesine erişebildiği durum sorgusu ve arka plan kontrolü, kaçırılan callback'i telafi eder. Yenilenen bildirimler tekrar bakiye/ikram üretmez. Geç gelen doğrulanmış tahsilat, sayfa kapanmış olsa da kaybolmaz.
- Ödeme sayfasına devam süresi sağlayıcının `tokenExpireTime` değeridir; alan yoksa yerel arayüz 30 dakika kullanır. **Sayfa süresinin dolması ödeme başarısızlığının kanıtı değildir.** Başlatma zaman aşımından sonra aynı anahtarla ikinci sağlayıcı isteği yapılmaz.

İlk açılan ödeme adresleri tam alan adıyla sınırlandırılır: sandbox'ta `sandbox-cpp.iyzipay.com`, canlıda `cpp.iyzipay.com`; eski form URL'leri için ilgili `sandbox-api.iyzipay.com`/`api.iyzipay.com` üzerinde yalnız `/checkoutform/` yolu. Keyfi alt alan adı, HTTP, kullanıcı bilgisi veya özel port kabul edilmez. Banka/3DS yönlendirmeleri iyzico'nun barındırdığı akışta tamamlanır.

## Açılış kabul kontrolü

API anahtarı olmadan imzalı sağlayıcı fixture'larıyla kod akışı doğrulanabilir; gerçek iyzico hesabı, banka ve 3DS ekranı doğrulanmış sayılmaz. Sandbox hesabında şu senaryoları çalıştırın:

1. Başarılı tek çekim → bakiye ve uygun ikram tam bir kez.
2. Reddedilen kart/başarısız 3DS → bakiye değişmez.
3. Sayfayı kapatma, uygulamayı yeniden açma, bağlantı kesilmesi → sonuca devam/yeniden sorgulama; otomatik ikinci tahsilat yok.
4. Callback ve V3 webhook'un iki kez veya ters sırayla gelmesi → tek cüzdan işlemi.
5. Eksik/hatalı imza, farklı token/tutar/para birimi/sepet → bakiye değişmez.
6. Risk incelemesi ve geç onay → erken bakiye verilmez; nihai doğrulanmış tahsilat kaybolmaz.
7. Üretim anahtarıyla düşük tutarlı kontrollü işlem ve iyzico Merchant Portal kaydıyla tutar/referans karşılaştırması.

Kart saklama/tek tık tahsilat ve karttan otomatik yükleme bu entegrasyonun kapsamı değildir; uygulamadaki yerel kart kaydından tahsilat yapılmaz. Cüzdana yüklenen parayı karta iade etmek, mevcut sipariş iptalinin uygulama cüzdanına iadesinden farklıdır; otomatik sağlayıcı iade/chargeback yönetimi uygulanmamıştır. SMS, POS, gerçek push ve yerel veritabanı yapılandırması önceki kapsam gereği değiştirilmemiştir.


## Bu çalışmada doğrulananlar

- Gerçek sağlayıcı HTTP sözleşmesini taklit eden imzalı yanıtlar ve ayrı PostgreSQL test veritabanı üzerinde **329 doğrulama**: tekrarlanan/eşzamanlı bildirim, tek bakiye/ikram/defter kaydı, yanlış imza/tutar/para birimi/kalem/kimlik, fraud bekleme ve geç onay, bağlantı kesilmesi, süresi dolan sayfa, arka plan kurtarma, başkasının ödemesine erişim ve eksik ayarlar.
- **14 ortam kontrolü** ve **12 mevcut backend cüzdan/yükleme ve ödeme bütünlüğü testi** geçti; üretim backend derlemesi başarılı.
- Mobilde **27 ödeme kontrolü** ve **17 mevcut ağ/controller testi** geçti. Flutter analyzer temiz, iOS Simulator derlemesi başarılı.
- Yeni doğrulama dosyaları yalnız geçici dizinde çalıştırıldı; repoya test dosyası eklenmedi. Mevcut test dosyaları değiştirilmedi.
- Bu sonuçlar iyzico/banka ile yapılmış gerçek işlem anlamına gelmez. Anahtarlar gelince sandbox/3DS ve erişilebilir callback/webhook kabul denemesi hâlâ gereklidir. Önceki genel backend test paketindeki eski fixture/tip hataları bu ödeme çalışmasında değiştirilmedi.
