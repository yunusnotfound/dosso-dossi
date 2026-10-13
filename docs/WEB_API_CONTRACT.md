# Web API sözleşmesi

Güncel kapsam: ayrı web PostgreSQL bağlantısı, mağaza ayarları, katalog, web yönetici oturumu, ürün yönetimi, müşteri üyeliği, hesaba bağlı kalıcı sepet, Türkiye teslimat adresleri, kargo ücret ayarları, sipariş oluşturma/takibi ve iyzico sandbox ödeme hazırlığı. Backend uçları `WEB_ENABLED=true` olduğunda `/web` altında açılır; kapalıyken 404 döner. Mevcut mobil API ve `/admin` ağacı ayrıdır. Müşteri e-postaları şu anda yalnız yerel önizlemedir; Resend etkin değildir.

JSON hata biçimi `{ "error": { "code": "...", "message": "..." } }` şeklindedir. Web JSON yanıtları `Cache-Control: no-store` taşır; görseller aşağıda belirtilen istisnadır.

## Herkese açık uçlar

| Yöntem ve yol | Yanıt / davranış |
| --- | --- |
| `GET /web/health` | Web mağaza başlangıç kaydı okunabiliyorsa `200 {ok:true,service:"web"}`, DB/tablo/kayıt hazır değilse aynı biçimde `503` ve `ok:false` |
| `GET /web/config` | `{store:{name,defaultLocale:"tr",locales:["tr","en"],currency:"TRY",shippingCountry:"TR"}}`; hazır değilse `503 WEB_UNAVAILABLE` |
| `GET /web/catalog` | `{products: Product[]}`; yalnız `PUBLISHED` ürünler, aktif varyantlar ve aktif öğütüm seçenekleri. Aktif varyantı olmayan ürün gelmez; stok sıfır olan varyant gelmeye devam eder. |
| `GET /web/shipping` | `{shipping: ShippingSettings}`; Türkiye/TRY kargo ayarları, standart ücret, ücretsiz kargo eşiği, aktiflik ve sürüm. Oturum gerekmez. |
| `GET /web/media/:filename` | DB’de kayıtlı UUID v4 isimli `.webp` dosyası; `image/webp`, `nosniff`, bir yıllık `public, immutable` önbellek. Bulunamazsa 404. |

Katalog ürünleri `sortOrder`, ardından oluşturulma zamanına; görseller ve öğütümler kendi `sortOrder` alanlarına, varyantlar SKU’ya göre sıralanır. Medya yolu herkese açıktır; taslak ürünün galeriye yüklenen görseli de dosya adresini bilen kişi tarafından açılabilir.

Next.js ana sayfa ve mağaza kataloğu sunucuda, 5 saniye zaman aşımı ve `no-store` ile alır. Başarısız/uyumsuz yanıt sabit örnek ürünlerle doldurulmaz; bağlantı hatası gösterilir. Boş katalog ayrı bir durumdur. Filtre/arama istemcide uygulanır.

## Ürün modeli

`Product` yanıtının alanları:

```text
id, slug, type: COFFEE | THERMOS, status: DRAFT | PUBLISHED | ARCHIVED
nameTr, nameEn, descriptionTr, descriptionEn, sortOrder, version
images: [{id, mediaId, url, altTr, altEn, sortOrder}]
variants: [{id, sku, labelTr, labelEn, colorNameTr, colorNameEn, colorHex,
            weightGrams, volumeMl, priceMinor, stock, active, imageId}]
grindOptions: [{id, code, nameTr, nameEn, priceDeltaMinor, sortOrder, active}]
```

Renk/gramaj/hacim ve varyant görseli alanları `null` olabilir. `imageId`, ürün görsel ilişkisinin `id` alanını değil, galerideki **`mediaId`** alanını işaret eder. Görsel URL’si backend’de `/web/media/<uuid>.webp`, tarayıcıda aynı origin `/api/web/catalog-media/<uuid>.webp` yoludur.

Para alanları tam **kuruş** cinsindendir: `35000 = 350,00 TL`. Seçilen tutar `variant.priceMinor + grind.priceDeltaMinor` olarak hesaplanır. Öğütüm için ayrı stok oluşturulmaz; aynı varyantın tüm öğütümleri aynı SKU stoğunu paylaşır. Sepet müşteri hesabına bağlı olarak web DB’de saklanır; stok rezervasyonu, ödeme veya sipariş oluşturmaz.

## Web müşteri üyeliği

Hesaplar yalnız web DB’deki `WebCustomer`, `WebCustomerSession` ve `WebCustomerToken` tablolarında tutulur. Mobil kullanıcılar ve web yöneticileri ayrı kimliklerdir; aynı e-posta otomatik eşleştirme yapmaz. E-posta trim edilip küçük harfe çevrilir, en fazla 254 karakterdir. Şifre Argon2id ile, oturum ve tek kullanımlık tokenlar amaç/alan ayrımı içeren SHA-256 özetleriyle saklanır; açık token DB’ye yazılmaz.

Tüm POST uçları `application/json` ve en fazla **4096 bayt** gövde kabul eder. Aşağıdaki gövdelerde bilinmeyen alanlar reddedilir. `locale` zorunlu `tr|en`; kayıt, doğrulama ve şifre yenilemede şifre 12–128 karakterdir. Girişte önceki/yanlış şifreler için 1–128 karakter kabul edilir. `token` tam 64 karakter base64url biçimindedir.

| Yöntem ve backend yolu | İstek / yanıt |
| --- | --- |
| `POST /web/auth/register` | `{name,email,password,locale}`; ad trim sonrası 2–120 karakter. Genel `202 {ok:true,delivery}`; `delivery` değeri `preview` veya `resend`. Yeni kayıt doğrulanmamıştır; mevcut hesabın şifre/profili değiştirilmez. |
| `POST /web/auth/resend-verification` | `{email,locale}` → aynı genel 202. Yalnız aktif ve henüz doğrulanmamış hesap için bağlantı hazırlanır. |
| `POST /web/auth/verify-email` | `{token,password}` → `200 {ok:true}`. E-posta sahibi hesabında kullanacağı son şifreyi belirler; doğrulama ve şifre değişikliği tek transaction’dır. Eksik şifre 400’dür. |
| `POST /web/auth/login` | `{email,password}` → `{token,customer}`. Yanlış/pasif/bilinmeyen hesap `401 UNAUTHORIZED`; doğru şifreyle henüz doğrulanmamış hesap `403 EMAIL_NOT_VERIFIED`. |
| `GET /web/auth/session` | `Authorization: Bearer <customer-token>` → `{customer}`; geçersiz, süresi dolmuş, pasif veya doğrulanmamış oturum 401. |
| `POST /web/auth/logout` | Müşteri Bearer oturumu gerekir; JSON `{}`. Mevcut oturum silinir, 204. |
| `POST /web/auth/forgot-password` | `{email,locale}` → aynı genel 202. Yalnız aktif ve doğrulanmış hesap için sıfırlama bağlantısı hazırlanır; doğrulanmamış hesap yeniden doğrulama akışını kullanır. |
| `POST /web/auth/reset-password` | `{token,password}` → `200 {ok:true}`; yeni parola kaydedilir ve hesabın bütün müşteri oturumları iptal edilir. |

`customer` alanı yalnız `{id,name,email,locale,emailVerifiedAt}` içerir; tarih JSON’da ISO 8601 dizesidir. Giriş yalnız aktif ve doğrulanmış hesaba **7 günlük** müşteri oturumu verir. Backend login yanıtındaki token, aşağıdaki Next.js proxy tarafından tarayıcı JSON’undan çıkarılır.

Doğrulama tokenı 24 saat, sıfırlama tokenı 1 saat geçerlidir. Amaçlar birbirinin yerine kullanılamaz. Süresi dolan, tüketilen, yanlış amaçlı veya geçersiz token `400 INVALID_TOKEN` döndürür. GET ile token tüketen uç yoktur. Aynı amaçta yeni bağlantı istenmesi önceki henüz geçerli bağlantıyı iptal etmez; herhangi biri başarıyla kullanıldığında aynı amaçtaki tüm diğer bağlantılar geçersiz olur. Müşteri satır kilidi, giriş ve şifre yenileme yarışında eski şifreyle açılan oturumun yenilemeden sonra geçerli kalmasını engeller.

Doğrulama sırasında şifrenin yeniden belirlenmesi hesap sahipliği kontrolünün parçasıdır: bir başkası e-posta adresini önceden kaydetmiş olsa da onun bildiği kayıt şifresi hesabın etkin şifresi olarak kalmaz. Doğrulama otomatik giriş yapmaz; kullanıcı daha sonra giriş ekranını kullanır.

### E-posta yanıtları ve sınırlama

Kayıt/yeniden doğrulama/şifremi unuttum için genel 202 gövdesi hesabın varlığını veya teslimatı doğrulamaz. Bilinmeyen ya da uygun olmayan hesapta mesaj üretilmez. Sağlayıcı gönderim hatasında da aynı 202 verilir; yeni gönderimin token/DB bekleme kaydı geri alınır, önceki geçerli bağlantı korunur ve yalnız genel işlem türü loglanır. Eksik, kapalı veya geçersiz e-posta yapılandırması her hesap için `503 WEB_EMAIL_UNAVAILABLE` döndürür.

- E-posta ve amaç başına 60 saniye bekleme, saatte en fazla 10 talep vardır. Kayıt ve yeniden doğrulama aynı `VERIFY_EMAIL` sayacını kullanır; sıfırlama ayrı `RESET_PASSWORD` sayacıdır. Aşımlarda `429 RATE_LIMITED` ve `Retry-After` döner. Gönderim arızası ile bilinmeyen hesap aynı beklemeye tabidir.
- Mevcut hesaba gerçek token çıkarma aralığı web DB’de de saklanır. Genel talep/hata sayaçları süreç belleğindedir; her biri sınırlı sayıda anahtar tutar. Çok backend kopyası için ortak sayaç depolaması henüz yoktur.
- Müşteri POST uçlarının toplam limiti bağlantı adresi başına 5 dakikada 300; giriş hesabı başına 15 dakikada 10 başarısız/eşzamanlı denemedir. Müşteri ve yönetici sayaçları ayrıdır. Proxy arkasında backend bağlantı adresi ortak olabilir; istemciden gelen forwarded-IP başlığına güvenilmez.
- Yanıt gövdesi/bekleme davranışı geneldir; gerçek gönderim beklenen ve gönderim yapılmayan yolların süreleri tamamen eşitlenmemiştir. Kalıcı e-posta kuyruğu ve bu zamanlama sınırı üretim çalışmasında ayrıca ele alınmalıdır.

Yerelde `WEB_EMAIL_MODE=preview`, `WEB_PUBLIC_URL=http://127.0.0.1:4000` kullanılır. Önizlemeler yalnız backend `.local/web-emails/` altında özel `.html`/`.json` dosyalarıdır; HTTP endpoint’i yoktur. `npm run web:email:preview` son HTML dosyasının yolunu verir. URL’ler `/hesabim/dogrula#token=…`, `/hesabim/sifre-yenile#token=…` veya `/en` önekli karşılıklarıdır. Token fragment’ı HTTP isteğine dahil olmaz; arayüz açık kullanıcı onayında POST eder.

Resend adaptörü ileride `WEB_EMAIL_MODE=resend`, `RESEND_API_KEY`, doğrulanmış `WEB_EMAIL_FROM` ve HTTPS origin olan `WEB_PUBLIC_URL` ile açılabilir. Şu anda kapalıdır ve canlı teslim test edilmemiştir. Aynı gövde/idempotency anahtarıyla en fazla iki deneme; deneme başına 5 saniye zaman aşımı; yalnız ağ, 429 ve 5xx durumlarında tekrar uygulanır. Resend’in [gönderim API’si](https://resend.com/docs/api-reference/emails/send-email) ve [idempotency sözleşmesi](https://resend.com/docs/dashboard/emails/idempotency-keys) esas alınır.

## Kalıcı müşteri sepeti

Aşağıdaki uçlar aktif/doğrulanmış web müşterisinin Bearer oturumunu gerektirir. Müşteri kimliği gövdeden alınmaz. Misafir sepeti veya girişte misafir sepeti birleştirme ucu yoktur. Yazmalarda JSON sınırı 4096 bayttır; bilinmeyen alanlar reddedilir. Tutar veya stok istemciden kabul edilmez.

| Yöntem ve backend yolu | İstek / yanıt |
| --- | --- |
| `GET /web/cart` | `{cart: Cart}`; salt okuma, DB kaydı oluşturmayan boş sepetin sürümü `0` |
| `POST /web/cart/items` | `{version,variantId,grindId:null|string,quantity}` → `{cart}`. Aynı varyant/öğütüm satırı varsa mevcut adede ekler. |
| `PATCH /web/cart/items/:id` | `{version,quantity}` → `{cart}`. Adet mutlak yeni değerdir. |
| `DELETE /web/cart/items/:id` | JSON `{version}` → `{cart}`; yalnız mevcut müşterinin satırını siler |
| `PUT /web/cart/address` | `{version,addressId:null|string}` → `{cart}`; yalnız müşterinin kendi adresi seçilir, `null` seçimi kaldırır |

`version`, en son okunan sepet sürümüdür; tüm yazmalar sürümü artırır. İşlemler müşteri satır kilidi ve serializable transaction içinde yapılır. Eski sürüm veya çözülemeyen eşzamanlı yazma `409 IDEMPOTENCY_CONFLICT` döndürür; istemci yeni sepeti yükleyip kullanıcıya güncel durumu gösterir. Sürüm denetimiyle reddedilen tekrar ikinci kez adet artırmaz. Sipariş oluşturma ayrıca aşağıda tanımlanan UUID idempotency anahtarını ve özet hash’ini kullanır.

Bir sepette en fazla 100 farklı satır, her satırda 1–99 adet vardır. Aynı SKU’nun farklı öğütüm satırlarının toplamı mevcut stoğu aşamaz. Aktif öğütümü olan kahvede geçerli öğütüm seçimi gerekir; termos öğütüm kabul etmez. Kullanılamayan ürün/seçenek veya stok aşımı 409, adet/satır sınırı gibi doğrulama hatası 400’dür. Sorunlu satır miktarını azaltmak veya satırı silmek mümkündür; miktar artırmak güncel seçenek ve stok kontrolünden geçer.

```text
Cart: {
  customerId, version, lines: CartLine[], itemCount, subtotalMinor,
  selectedAddressId: string|null,
  shipping: {enabled, configured, feeMinor, freeShippingThresholdMinor,
             country:"TR", currency:"TRY"},
  shippingFeeMinor: number|null, totalMinor: number|null,
  freeShippingRemainingMinor: number|null, valid: boolean
}
CartLine: {
  id, variantId, grindId: string|null, quantity, productId: string|null,
  slug: string|null, nameTr, nameEn, variantLabelTr, variantLabelEn,
  grindNameTr: string|null, grindNameEn: string|null, imageUrl: string|null,
  unitPriceMinor: number|null, lineTotalMinor: number|null,
  availableQuantity, issue: null|"UNAVAILABLE"|"INSUFFICIENT_STOCK"
}
```

Okuma repeatable-read anlık görüntüsüyle güncel fiyat, yayın/aktiflik, stok ve kargo ayarlarını yeniden hesaplar. Silinmiş veya devre dışı seçimler eski isimleriyle görünür kalır; sessizce atılmaz. `availableQuantity`, diğer öğütüm satırlarının tüketimi çıkarıldıktan sonra **bu satırın ulaşabileceği en yüksek toplam adettir**, eklenebilecek fark değildir; 0–99 aralığındadır.

`subtotalMinor` hesaplanabilen satır tutarlarının toplamıdır; kullanılamayan satır tutarı `null` olabilir. Dolu sepette sorunlu satır, tanımsız/kapalı kargo veya seçilmemiş adres varsa `totalMinor:null` ve `valid:false` döner. Kargo hesaplanabiliyorsa adres seçilmeden kargo tahmini dönebilir, genel toplam yine `null` kalır. Boş sepette ara/kargo/genel toplam `0`, `valid:false` olur. Ücretsiz kargo eşiği ürün ara toplamına eşit veya onun altında kaldığında ücret sıfırlanır. Bunlar güncel sepet hesaplarıdır; fiyat sabitleme veya stok rezervasyonu yoktur.

## Türkiye teslimat adresleri

| Yöntem ve backend yolu | İstek / yanıt |
| --- | --- |
| `GET /web/addresses` | `{customerId,addresses:Address[]}`; varsayılan önce, sonra oluşturulma tarihi artan |
| `POST /web/addresses` | `AddressInput` → `201 {customerId,address}` |
| `PUT /web/addresses/:id` | Tam `AddressInput` ve mevcut `{version}` → `{customerId,address}` |
| `DELETE /web/addresses/:id` | JSON `{version}` → 204 |

```text
AddressInput: {
  title, recipientName, phone, country:"TR", provinceCode,
  district, neighborhood, addressLine, postalCode:""|string, isDefault:boolean
}
Address: AddressInput + {id, version, createdAt, updatedAt}
```

- En fazla 10 adres; başlık 1–60, alıcı 2–120, ilçe 2–100, mahalle 2–120, açık adres 10–500 karakterdir. Alanlar trim edilir; açık adresteki satır sonları boşluğa çevrilir. İlçe/mahalle serbest metindir; harita veya dış adres doğrulama servisi yoktur.
- `country` yalnız `TR`, `provinceCode` yalnız `01`–`81` kabul eder. Telefon boşluk/parantez/tire ve Türkiye öneklerinden `+90` biçimine normalleştirilir; sonuç `+90[2-5]` ardından dokuz rakam olmalıdır.
- `postalCode` gönderilmezse veya boşsa `""`; doluysa 5 rakam ve seçilen il koduyla aynı ilk iki hane zorunludur.
- İlk adres otomatik varsayılan olur. Varsayılan değiştirme atomiktir; adres kaldığı sürece bir varsayılan korunur. Varsayılanlık **sepete adres atamaz**; `PUT /cart/address` ayrıca gerekir.
- Güncelleme/silme mevcut adres sürümünü (`>=1`) ister. Başka hesap veya bulunmayan adres 404, eski sürüm 409 döndürür. Varsayılan değişince etkilenen diğer adreslerin sürümü de artabilir; başarılı yazma sonrası liste yeniden okunmalıdır.
- Sepette seçili adresi düzenlemek sepet sürümünü artırır. Silmek seçimi `null` yapar ve sepet sürümünü artırır. Adresler sipariş adres özeti değildir; sipariş oluşturulurken ayrı, değişmez bir kopya alınır. Sonraki adres düzenleme/silme kayıtlı siparişi değiştirmez.

## Kargo ayarları

```text
ShippingSettings: {
  version, enabled:boolean, feeMinor:number|null,
  freeShippingThresholdMinor:number|null, country:"TR", currency:"TRY"
}
```

`GET /web/admin/shipping` → `{shipping}` ve `PUT /web/admin/shipping` → `{shipping}` yalnız **ADMIN** oturumu kabul eder; `EDITOR` 403 alır. PUT gövdesi mevcut `version` dahil yukarıdaki alanların tamamıdır; `country` ve `currency` sabitleri de gönderilir.

Ücret `0..100000000` tam kuruş veya `null`, ücretsiz kargo eşiği `1..100000000` tam kuruş veya `null` olabilir. Ücret `null` iken eşik de `null` olmalıdır. **`feeMinor:null` bilinmeyen ücret, `feeMinor:0` ücretsiz kargodur.** İlk değerler sürüm 1, aktif, ücret/eşik `null` şeklindedir. Eşik ürün ara toplamına uygulanır; kapatmak için eşik `null` gönderilir. Düzenleme sürümü artırır, önce/sonra değerlerini ve yönetici kimliğini `WebShippingAudit` tablosuna yazar. Eski sürüm 409’dur. Kargo firması ve takip numarası siparişin `SHIP` işleminde saklanır. Kargo şirketi API’si, etiket satın alma veya gerçek gönderim oluşturma entegrasyonu yoktur.

## Sipariş oluşturma ve geçmişi

Siparişler, satırlar, stok rezervasyonları, ödeme denemeleri ve denetim kayıtları yalnız ayrı web PostgreSQL veritabanındadır. Müşteri uçları aktif/doğrulanmış **web müşteri** oturumu gerektirir. Sahiplik sunucuda oturumdan belirlenir; başka müşterinin siparişi 404 döner. Tüm JSON yazmaları en fazla 4096 bayttır; ek alanlar reddedilir. Fiyat, toplam, müşteri kimliği, adres snapshot’ı veya ödeme durumu istemciden kabul edilmez.

| Yöntem ve backend yolu | İstek / yanıt |
| --- | --- |
| `GET /web/orders/quote` | `{customerId,quote:OrderQuote}`. Güncel sepet, ürün, stok, adres ve kargo bilgilerini okur; sipariş veya rezervasyon oluşturmaz. |
| `POST /web/orders` | `{cartVersion,quoteHash,idempotencyKey,locale}` → ilk oluşturma `201 {customerId,order:Order}`, aynı istek tekrarı `200` ve aynı sipariş. |
| `GET /web/orders` | `{customerId,orders:Order[],pagination,payment:PaymentAvailability}`; yalnız mevcut müşterinin siparişleri. |
| `GET /web/orders/:id` | `{customerId,order:Order,payment:PaymentAvailability}`. |
| `POST /web/orders/:id/cancel` | `{version}` → `{customerId,order}`; yalnız `canCancel:true` olan ödenmemiş sipariş. |
| `POST /web/orders/:id/payment` | `{version}` → `{customerId,order,payment:{...PaymentAvailability,paymentPageUrl:string|null}}`; yapılandırma eksikse 503, doğrulanamayan sağlayıcı sonucu 502. |
| `POST /web/orders/:id/payment/refresh` | `{version}` → `{customerId,order}`; kayıtlı ödeme tokenı ile sağlayıcı sonucunu yeniden doğrular. Tarayıcıdan token veya başarılı/başarısız sonucu alınmaz. |

Liste sorgusu müşteri ve yönetici için aynıdır: `page` varsayılan 1 (1–100000), `limit` varsayılan 20 (1–50), isteğe bağlı `status`, `paymentStatus`, `fulfillmentStatus` ve trim sonrası 1–100 karakter `q`. `q`, sipariş numarası ve **sipariş anındaki müşteri adı/e-postası** üzerinde büyük/küçük harf duyarsız arar. Sıra oluşturulma zamanı ve ID azalandır. `pagination:{page,limit,total,pages}` döner; boş sonuçta `pages:0`. Sorgudaki bilinmeyen alanlar reddedilir.

```text
PaymentAvailability: {provider:"IYZICO", mode:"sandbox", configured:boolean}
OrderQuote: {
  customerId, cartVersion, quoteHash, currency:"TRY",
  customer:{name,email}, address:Address,
  lines: CartLine[] (availableQuantity ve issue hariç),
  shippingVersion, shipping:Cart.shipping,
  subtotalMinor, shippingFeeMinor, totalMinor,
  payment:PaymentAvailability, reservationMinutes:30
}
Order: {
  id, number, version,
  status:"OPEN"|"CANCELLED"|"EXPIRED"|"COMPLETED",
  paymentStatus:"PENDING"|"PAID"|"FAILED"|"REVIEW",
  fulfillmentStatus:"UNFULFILLED"|"PREPARING"|"SHIPPED"|"DELIVERED",
  currency:"TRY", subtotalMinor, shippingFeeMinor, totalMinor,
  customer:{name,email},
  address:{title,recipientName,phone,country:"TR",provinceCode,
           district,neighborhood,addressLine,postalCode},
  lines:[{id,productId,variantId,grindId:string|null,sku,
          nameTr,nameEn,variantLabelTr,variantLabelEn,
          grindNameTr:string|null,grindNameEn:string|null,imageUrl:string|null,
          quantity,unitPriceMinor,lineTotalMinor}],
  carrier:string|null, trackingNumber:string|null,
  createdAt, updatedAt, reservationExpiresAt,
  paidAt:null|string, cancelledAt:null|string,
  shippedAt:null|string, deliveredAt:null|string,
  canCancel:boolean, canPay:boolean, canRefreshPayment:boolean,
  audits:[{id,action,note,createdAt}]
}
```

Tüm para alanları kuruş, tüm tarihler ISO 8601’dir. Sipariş numarası `DD-YYYYMMDD-<rastgele ek>` biçimindedir. Sipariş ürün/fiyat, müşteri, adres ve kargo snapshot’ları sonraki katalog/adres/tarife değişikliklerinden etkilenmez. `audits` en yeni 50 hareketi içerir. **İşlem notları yalnız yönetici yanıtında görünür; müşteri DTO’sunda `note:""` döner.** DTO’da kart bilgisi, ödeme API anahtarı, sağlayıcı tokenı, ham sağlayıcı yanıtı, idempotency anahtarı veya dahili hata yığını yoktur. Hosted ödeme URL’si yalnız ödeme başlatma yanıtında, yönlendirme için döner; geçmiş/detay DTO’suna eklenmez.

### Özet onayı, tekrar güvenliği ve stok

- Özet için dolu/geçerli sepet, yeterli stok, seçilmiş müşteri adresi (`TR`) ve aktif/tanımlı kargo ücreti gerekir. Toplam sıfırdan büyük ve en fazla `100000000` kuruştur. `quoteHash` 64 haneli SHA-256 hex dizesi; `cartVersion` sıfır veya pozitif tam sayıdır.
- `POST /orders` gövdesindeki `locale` `tr|en` (backend varsayılanı `tr`), `idempotencyKey` UUID’dir. Sipariş oluşturma anında sunucu özeti tekrar hesaplar. Sepet sürümü uyuşmazsa 409; fiyat, adres veya kargo özeti değişmişse `409 PRICE_CHANGED`. İstemci yeni özeti göstermeli ve kullanıcıdan tekrar açık onay almalıdır.
- Anahtar müşteri hesabı içinde benzersizdir. Aynı anahtar + aynı `cartVersion`, `quoteHash`, `locale` mevcut siparişi döndürür; tekrar stok düşmez ve yeni kayıt oluşmaz. Anahtar aynı ama gövde farklıysa 409. Ağ kesilmesi veya zaman aşımı, oluşturmanın başarısız olduğunu kanıtlamaz; tekrar **aynı anahtar ve aynı gövdeyle** yapılır.
- Oluşturma müşteri/ürün kilitleri ve serializable transaction ile yapılır. Aynı SKU’nun tüm öğütümleri birlikte sayılır. Uygun stok atomik düşürülerek **30 dakika** ayrılır; sipariş `OPEN / PENDING / UNFULFILLED` başlar. Sepet satırları temizlenir ve sepet sürümü artar. Ödeme başlatma ayrı, açık bir POST işlemidir.
- Bir müşterinin aynı anda en fazla **3 açık, ödenmemiş** siparişi olabilir; incelemedeki açık kayıtlar da bu sınıra dahildir. Yeni sipariş için önce bunlar sonuçlandırılmalı veya iptal edilebilir olanlar iptal edilmelidir.
- Rezervasyon ve stok iadesi ürün sürümünü de artırır; yöneticinin rezervasyon öncesi mutlak stok değeriyle kaydetmesi 409 alır. Her hareket `WebStockAdjustment` kaydı oluşturur.
- `canCancel`, rezervasyonu dolmamış `OPEN` ve `PENDING|FAILED` siparişte, ödeme başlatma işlemi sürmüyorsa doğrudur. İptal tek transaction’da stoku bir kez iade eder. İptal/süre aşımı satırları sepete geri eklemez.
- Başlangıçta ve 30 saniyelik sınırlı bakım döngüsünde süreler denetlenir; sipariş uçları da sınırlı temizleme yapar. Süresi dolmuş ve ödenmemiş sipariş `EXPIRED` olur, rezervasyon yalnız bir kez bırakılır. Backend kapalıyken bakım çalışmaz; tekrar başladığında temizlenir. `PAID` siparişin stok rezervasyonu süreden dolayı bırakılmaz.
- Ödeme başlatma sırasında süreç kesilirse 90 saniyeyi geçen `INITIALIZING` denemesi `REVIEW` olur; körlemesine yeni sağlayıcı çağrısı yapılmaz. Sonuç belirsizken ödeme başarısız sayılmaz. İptal/süre aşımından sonra gelen başarılı ödeme `REVIEW` olarak inceleme ister ve sevkiyat yetkisi vermez.
- `canPay`, yapılandırılmış sandbox ve geçerli ödenmemiş sipariş için sunucuda hesaplanır. Hazır ve süresi geçmemiş ödeme oturumu varsa aynı hosted URL kullanılır. `canRefreshPayment`, kayıtlı `READY|REVIEW` tokenı bulunan ve ödenmemiş siparişlerde doğrudur. Arayüz bu bayrakları kullanır; her POST sunucuda yeniden doğrulanır.

Sipariş yazmalarında oturum sahibi başına süreç belleğinde dakikada 30 istek sınırı vardır; 429’da `Retry-After` döner. Callback için aynı sınırlayıcı bağlantı adresini kullanır. Çok sunuculu dağıtım için bu sayaçlar ortak depoya taşınmalıdır.

## Yönetim paneli sipariş takibi

Tüm uçlar yalnız aktif **ADMIN** web yönetici oturumu kabul eder. EDITOR, müşteri veya mobil oturumu kullanılamaz.

| Yöntem ve backend yolu | İstek / yanıt |
| --- | --- |
| `GET /web/admin/orders` | Yukarıdaki liste filtreleri → `{orders,pagination,payment}` |
| `GET /web/admin/orders/:id` | `{order,payment}`; müşteri/adres snapshot’ı ve yönetici işlem notları dahil |
| `PATCH /web/admin/orders/:id` | `{version,action,carrier?,trackingNumber?,note?}` → `{order}` |

`version` en son okunan, en az 1 olan sipariş sürümüdür. Eski sürüm 409’dur. `action` yalnız `PREPARE|SHIP|DELIVER|CANCEL` olabilir:

| Eylem | Önkoşul ve sonuç |
| --- | --- |
| `PREPARE` | `OPEN + PAID + UNFULFILLED` → `PREPARING` |
| `SHIP` | `OPEN + PAID + PREPARING` → `SHIPPED`; `carrier` (1–80) ve `trackingNumber` (1–100) zorunlu, `shippedAt` yazılır |
| `DELIVER` | `OPEN + PAID + SHIPPED` → `DELIVERED`; sipariş `COMPLETED`, `deliveredAt` yazılır |
| `CANCEL` | Müşteri iptaliyle aynı `canCancel` kuralları; ödenmemiş sipariş iptal edilir ve stok iade edilir |

Not isteğe bağlı, trim sonrası 1–500 karakterdir; kargo metinleri ve not kontrol karakteri içeremez. `carrier` ve `trackingNumber` yalnız `SHIP` gövdesinde kabul edilir. İşlemler sürümü artırır; önce/sonra durumları, yönetici ve not denetim kaydına yazılır. Durum atlama, geri alma, ödenmiş siparişi bu uçtan iptal etme veya elle `PAID` işaretleme yoktur. Kargo takip numarası veri olarak saklanır; üçüncü taraf gönderim veya takip API’si çağrılmaz.

## iyzico sandbox ve callback

Ödeme modeli yalnız **sandbox**’tır. `WEB_PAYMENT_MODE=sandbox`, `WEB_IYZICO_API_KEY`, `WEB_IYZICO_SECRET_KEY`, `WEB_IYZICO_CALLBACK_URL` ve `WEB_PUBLIC_URL` sunucuda okunur; mobil ödeme ayarları kullanılmaz. Anahtarlar/callback henüz yoksa `configured:false` döner: sipariş oluşturulabilir, ödeme başlatılamaz, dış servis çağrısı ve sahte başarı oluşmaz. Gerçek sandbox kabul testi, anahtarlar ve erişilebilir HTTPS callback sağlandıktan sonra ayrıca yapılmalıdır.

`POST /web/payments/iyzico/callback`, müşteri çerezi gerektirmeyen sağlayıcı dönüş ucudur. Yalnız `application/x-www-form-urlencoded`, en fazla 2048 bayt, tam `{token}` kabul edilir; token 8–256 karakter `[A-Za-z0-9_-]` olmalıdır. JSON, GET ile sonuç bildirme veya tarayıcıdan `paid` alanı kabul edilmez. Token yalnız kayıtlı ödeme denemesini bulur. Callback ya da müşterinin yenileme işlemi, iyzico’ya sunucudan imzalı Retrieve çağrısı yapmadan siparişi ödenmiş sayamaz.

Sağlayıcı yanıtında imza, token/conversation, sipariş/basket ID, TRY ve kuruş tutarları denetlenir. Yalnız doğrulanmış başarılı ve fraud onaylı sonuç `PAID` yapar. Tekrarlanan callback ikinci kez stok düşmez veya ödeme işlemez; eski başarısız deneme yeni başarılı sonucu geri alamaz. Uyuşmazlık, gecikmiş/ek başarılı ödeme veya belirsiz sonuç `REVIEW` durumudur. Normalleştirilmiş sağlayıcı işlem referansları yalnız backend’de tutulur; ham yanıt ve kart verisi saklanmaz.

Dönüşte backend, yapılandırılmış `WEB_PUBLIC_URL` origininde `/hesabim/siparislerim/:id` veya `/en/hesabim/siparislerim/:id` adresine **303** gönderir. İstemci hedef origin veya sipariş ID’si belirleyemez. Callback sabit HTTPS backend yoludur; Next.js müşteri JSON proxy’sine, `localhost` adresine veya kullanıcı girdisinden üretilen URL’ye gönderilmez. Gerçek sağlayıcı akışı için dışarıdan erişilebilir callback gerekir; bu geliştirme yerel servisleri yayınlamaz.

Tarayıcıya iyzico HTML’i enjekte edilmez ve kart formu oluşturulmaz. Yönlendirme yalnız doğrulanmış `https://sandbox-cpp.iyzipay.com/` veya kısıtlı `https://sandbox-api.iyzipay.com/checkoutform/...` adresine yapılır; canlı/başka host, kullanıcı bilgisi, port, fragment, eksik/tekrarlı token ve ilave yönlendirme parametreleri reddedilir. Callback dönüşü veya ekrandaki başarı metni tek başına ödeme kanıtı değildir.

Protokol ayrıntıları ve yapılandırma: [Web iyzico sandbox kılavuzu](WEB_IYZICO_SANDBOX.md). Sağlayıcının [resmi Checkout Form sözleşmesi](https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/payment-methods/checkoutform) ve [yanıt imzası kuralları](https://docs.iyzico.com/ek-servisler/imza-yanitinin-dogrulanmasi) esas alınır.

## Web yönetici oturumu

Backend’de oturum açma dışındaki `/web/admin` uçları `Authorization: Bearer <opaque-token>` ister. Bu token mobil JWT’den bağımsızdır. Parola Argon2id ile, oturum tokenının özeti SHA-256 ile ayrı web DB’de tutulur. Oturum 12 saat geçerlidir; kullanıcı aktif olmalı ve rolü `ADMIN` veya `EDITOR` olmalıdır. İki rol de katalog işlemlerini yapabilir; kargo ayarları ve tüm sipariş yönetim uçları yalnız `ADMIN` rolüne açıktır; `EDITOR` 403 alır. Diğer operasyonlar için ayrıntılı izin matrisi henüz yoktur.

| Yöntem ve yol | İstek / yanıt |
| --- | --- |
| `POST /web/admin/auth/login` | JSON `{email,password}` → `{token,admin:{id,email,name,role}}`; yanlış/pasif hesap 401 |
| `GET /web/admin/auth/session` | `{admin:{id,email,name,role}}`; geçersiz/süresi dolmuş oturum 401 |
| `POST /web/admin/auth/logout` | Oturum kaydı silinir, 204 |

Giriş sınırlaması hesap başına 15 dakikada 10 başarısız/eşzamanlı deneme; bağlantı adresi başına 5 dakikada 300 istektir. Başarılı giriş hesap hata sayacını temizler. Sayaçlar süreç belleğindedir; çok backend kopyasıyla yayın için ortak sayaç depolaması ayrıca gerekir.

## Katalog yönetimi

| Yöntem ve yol | İstek / yanıt |
| --- | --- |
| `GET /web/admin/products` | Taslak/yayında/arşiv tüm ürünler ve pasif alt kayıtlar dahil `{products:Product[]}` |
| `GET /web/admin/products/:id` | `{product:Product}`; ürün yoksa 404 |
| `POST /web/admin/products` | Tam ürün gövdesi → `201 {product:Product}` |
| `PUT /web/admin/products/:id` | Tam ürün gövdesi ve mevcut `version` → `{product:Product}`; sürüm artırılır |
| `GET /web/admin/products/:id/history` | En yeni 100'er kayıt: `{audits:[{id,action,createdAt,admin:{name}}], adjustments:[{id,sku,previous,current,reason,createdAt,admin:{name}}]}`; seed yöneticisi `null` olabilir |
| `POST /web/admin/media` | `{filename,mimeType,data}`; `data` saf Base64 → `201 {media:{id,url}}` |

Ürün yazma gövdesi yanıtın ürün alanlarını, `images`, `variants`, `grindOptions` dizilerini ve isteğe bağlı `stockReason` alanını içerir; üst düzey `id` ve görsel `url` gönderilmez. `version` düzenlemede zorunludur. Yeni alt kayıtta `id` gönderilmez; mevcut alt kayıt kimlikleri korunur. Gövde kısmi PATCH değildir; bilinmeyen alanlar reddedilir.

- En fazla 20 görsel, 100 varyant, 30 öğütüm seçeneği kabul edilir. Ürün gövdesi sınırı 250 KB’tır.
- Slug ve SKU benzersizdir; öğütüm kodu aynı ürün içinde benzersizdir. Başka ürüne ait alt kayıt kimliği kullanılamaz.
- Yayın için İngilizce ad, en az bir galeri görseli ve aktif varyant gerekir. Kahve varyantı gramaj ister; termos gramajı ve öğütümü kabul etmez.
- Fiyat ve öğütüm farkı `0..100000000` kuruş, stok `0..1000000` tam sayı; gramaj/hacim doluysa `1..100000` tam sayıdır. Panel, satış fiyatı ve iki dilde varyant/renk alanları için ek form doğrulamaları uygular.
- Mevcut üründe stok değişikliğine gerekçe gerekir. Ürün, alt kayıtlar, yönetici denetim kaydı ve stok hareketi tek transaction içinde yazılır.
- Eski `version` veya benzersizlik çakışması `409 IDEMPOTENCY_CONFLICT` döndürür; panel güncel ürünü yeniden yüklemeyi sunar. İstemci hataları 400 döner.
- Ürün silme ucu yoktur; `ARCHIVED` ile mağazadan kaldırılır. Kaydedilmiş varyant/öğütüm silinmez, `active:false` yapılır. Galeri ilişkisi kaldırılabilir; kaynak medya dosyası otomatik silinmez.

Medya yüklemesi yalnız tek kareli JPEG/PNG/WebP ve en fazla **5 MiB** kabul eder. Beyan edilen tür gerçek dosya biçimiyle karşılaştırılır; en fazla 40 milyon giriş pikseli işlenir. Görsel yönü düzeltilerek oranı korunur, büyütülmeden en çok 1600×1600 kutusuna sığdırılır ve WebP kaydedilir. Base64 JSON gövdesi için backend sınırı 7 MB’tır. SVG/GIF ve animasyon kabul edilmez. Dosyalar `dosso-dossi-backend/uploads/web-catalog/` dizinindedir.

## Next.js sınırı

- `GET /api/health`: sabit `/web/health` hedefine erişimi kontrol eder; 200/503, `no-store`.
- `/api/web/admin/...`: yalnız yukarıdaki yönetim yolları/yöntemleri için proxy. Tarayıcının backend hedefini veya mobil yolunu seçmesine izin verilmez.
- `/api/web/auth/:action`: yalnız yukarıdaki müşteri POST eylemleri ile GET `session` için sabit `/web/auth/:action` proxy’si. Ek yol parçaları/yöntemler 404; tarayıcı Authorization başlığı mobil veya yönetici oturumu geçirmek için kullanılmaz.
- `/api/web/orders`, `/api/web/orders/quote`, `/api/web/orders/:id`, `/api/web/orders/:id/cancel`, `/api/web/orders/:id/payment` ve `/api/web/orders/:id/payment/refresh`: yukarıdaki yöntemler için müşteri çerezi kullanan sabit proxy. Liste GET sorgusunda yalnız `page`, `limit`, `q`, `status`, `paymentStatus`, `fulfillmentStatus` kabul edilir; tekrarlı/geçersiz/bilinmeyen parametre reddedilir. Yönetici sipariş listesi aynı sorgu denetimini kullanır. Sipariş callback’i bu müşteri proxy’sinden geçmez.
- `/api/web/cart`, `/api/web/cart/items[/:id]`, `/api/web/cart/address`, `/api/web/addresses[/:id]` ve `/api/web/shipping`: yukarıdaki yöntemler için sabit backend hedefleri. Kargo okuması herkese açık; diğerleri yalnız `dosso_web_customer` çerezini kullanır. Yönetici çerezi veya tarayıcı Authorization başlığı müşteri oturumu sayılmaz. Ek/parçalı yollar 404’tür.
- Müşteri girişinde yalnız izin verilen `customer` alanları JSON’da kalır; token `dosso_web_customer` isimli 7 günlük `HttpOnly`, `SameSite=Lax`, üretimde `Secure` cookie’ye yazılır. Çerez web yönetici çerezinden ayrıdır; token localStorage/sessionStorage’a yazılmaz. Oturum 401’inde, başarılı çıkışta ve başarılı şifre yenilemede müşteri çerezi temizlenir.
- Yönetici girişinde backend tokenı JSON’dan çıkarılır ve `dosso_web_admin` isimli 12 saatlik `HttpOnly`, `SameSite=Strict`, üretimde `Secure` cookie’ye yazılır. Tarayıcı JavaScript’ine token verilmez; localStorage kullanılmaz.
- Tüm yazma istekleri, giriş dahil, JSON ve doğru `Origin` ister. Beklenen origin Next.js sunucusundaki `WEB_ORIGIN` değeridir; geliştirmede varsayılan `http://127.0.0.1:4000`, üretimde açık ayar zorunludur. `cross-site` istekler reddedilir; forwarded host/origin değerleri güven kaynağı değildir.
- Proxy gövdeyi akış sırasında da sınırlar: müşteri üyelik işlemleri için 4096, sepet/adres/sipariş işlemleri için 8192 bayt; bu işlemlerin backend sınırı ayrıca 4096 bayttır. Yönetici kargo/sipariş yazmaları proxy’de 8192, backend’de 4096 baytla sınırlıdır. Yönetici medyası 7.100.000, diğer yönetici yazmaları 1.000.000 baytla sınırlıdır. Zaman aşımı üyelik/medyada 20, sepet/adreste 15, müşteri sipariş uçlarında 25, normal yönetici isteklerinde 10 saniyedir. Tarayıcı müşteri istekleri 20 saniyeyle sınırlıdır; sağlayıcı çağrısının kendi sınırı 15 saniyedir. Zaman aşımı yazmanın geri alındığını veya tahsilat yapılmadığını kanıtlamaz.
- Hesap sayfaları ve müşteri proxy yanıtları `Referrer-Policy: no-referrer` kullanır; token fragment’ı sayfa tarafından okunduktan sonra URL’den çıkarılır. Proxy yanıtları no-store/noindex taşır.
- `GET /api/web/catalog-media/:filename`: sabit backend medya yolunu açar; yalnız WebP yanıtı ve güvenli dosya adı kabul eder. Dosya yoksa 404, backend kullanılamıyorsa 503, beklenmeyen medya türünde 502.

## Henüz uygulanmayanlar

Canlı ödeme/satış, gerçek iyzico sandbox uçtan uca kabul testi, ödeme iadesi/iptali, canlı kimlik/fatura gereksinimleri, kargo şirketi entegrasyonu/etiket üretimi, profil düzenleme ve SMS/OTP girişi henüz tamamlanmadı. Siparişlerin kargo durumu ve takip numarası panelden yönetilebilir; bu, gerçek gönderim oluşturmaz. Genel iyzico webhook aboneliği yoktur; burada uygulanan uç Checkout Form callback’idir. Resend adaptörü yazılmıştır; alan adı/gönderen erişimi ve canlı teslim doğrulaması beklenir. Mobil, müşteri ve web yönetici tokenları birbirlerinin oturumu yerine kullanılamaz.
