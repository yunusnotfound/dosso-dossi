# Dosso Dossi — REST API Sözleşmesi (v1)

Bu sözleşme `dosso-dossi-backend/` içinde uygulanmıştır (Node.js + Express +
Prisma + PostgreSQL). Uygulamadaki her repository'nin `ApiXRepository`
karşılığı yazılmıştır. `flutter run` varsayılan olarak gerçek API'ye bağlanır;
mock veriye dönmek için `--dart-define=USE_MOCKS=true` verilir (testler
kendiliğinden mock modunda çalışır).

- **Base URL:** `--dart-define=API_BASE_URL` (varsayılan `http://localhost:3000`)
- **Kimlik doğrulama:** `Authorization: Bearer <token>` (OTP doğrulamasında alınır, JWT varsayılan 15 dakika)
- **Para birimi:** tüm tutarlar kuruş hassasiyetli ondalık TL (`425.50`)
- **Tarihler:** Anlık zamanlar ISO 8601 UTC; işletme günü/saat kırılımları `Europe/Istanbul`
- **Geliştirme OTP'si:** kod sunucu konsoluna yazılır; `OTP_DEV_MODE=true` iken `111111` her zaman geçer

## Panel değişikliklerinin uygulamaya yansıması

`GET /sync/revisions` kimlik doğrulaması gerektirmeden
`{ "menu", "branches", "campaigns", "loyalty", "wallet", "orders" }`
alanlarında opak sürüm değerleri döndürür (`Cache-Control: no-store`).
Yalnız tamamlanmış, audit kaydı bulunan panel işlemleri sürümü değiştirir;
müşteri bilgileri veya audit içerikleri paylaşılmaz.

Sürümler değişiklikle aynı transaction içinde `SyncRevision` tablosunda
artırılır; sorgu audit geçmişini taramaz. Müşteri Bearer token'ı gönderilirse
cüzdan/sadakat/sipariş sürümleri yalnız o müşterinin değişikliklerini kapsar.
Misafir isteklerinde yalnız ortak içerik sürümleri değişir; hatalı token
sessizce misafire dönüştürülmez, 401 döner.

Gerçek API modunda uygulama ön plandayken 15 saniyeden başlayan ve değişiklik
olmadığında 60 saniyeye çıkan aralıklarla bu küçük yanıtı kontrol eder ve
yalnız değişen alanın mevcut API verilerini yeniler. Hata halinde bekleme
en çok 5 dakikaya kadar artar. Arka
planda kontrol durur; açılışta ve ön plana dönüşte tüm alanlar yenilenir.
Hatalı yenilemeler tekrar denenir, mevcut menü görünümü korunur. Ürün
değişiklikleri grid, açık detay ve sepete yansır; satıştan kaldırılan ürünler
sepetten bilgilendirme ile çıkarılır. Kişisel veriler yalnız giriş yapan
kullanıcının mevcut yetkili endpoint'lerinden alınır.

Bu mekanizma API'den okunan verileri yeniler; uygulamadaki sabit seçenek
listelerini veya görsele gömülü kampanya metinlerini sunucudan yönetilebilir
hale getirmez. Audit dışından doğrudan SQL/seed ile yapılan değişiklikler
ön plana dönüşteki tam yenilemede alınır.

## 1. Kimlik (auth) — `features/auth/data/auth_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/auth/otp/send` | `{ "phone": "5551112233" }` → SMS kodu gönderir (10 dk'da en çok 3) |
| POST | `/auth/otp/verify` | `{ "phone", "code" }` → `{ "token", "refreshToken", "user": { "phone", "name", "email" } }` |
| POST | `/auth/refresh` | `{ "refreshToken" }` → yeni `{ "token", "refreshToken" }` (rotasyon; geçerli sürede eski token yeniden kullanılırsa yalnız ilgili oturum ailesi iptal edilir) |
| POST | `/auth/logout` | `{ "refreshToken"? }` → ilgili oturum ailesinin access/refresh iptali (her zaman 200) |
| PATCH | `/me` | `{ "name"?, "email"? }` → güncel kullanıcı |

Access token (JWT) ~15 dk geçerlidir; uygulama 401 aldığında refresh ile
sessizce yeniler ve isteği tekrarlar.

`name` boş dönerse uygulama isim adımını gösterir (yeni kullanıcı).

## 2. Sadakat — `features/rewards/data/loyalty_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/me/loyalty?limit=20&cursor=...` | `{ "stamps": 3, "target": 5, "freeDrinks": 1, "history": [{ "id", "title", "date", "used" }], "nextCursor": string\|null }` |

Kurallar **sunucuda** uygulanır (kaynak: CEO kampanyaları):
- Her kahve satışı damga ekler; `target` (5) dolunca damgalar sıfırlanıp `freeDrinks` +1.
- Varsayılan kampanyada ilk başarılı gerçek yükleme 1.000 ₺+ ise `freeDrinks` +5 (aşağıda `topup`); eşik, adet ve ilk-yükleme koşulu panel ayarıdır.
- İkram kullanımı sipariş isteğinde `useFreeDrink` ile gelir.

## 3. Cüzdan — `features/wallet/data/wallet_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/me/wallet` | `{ "balance": 425.50, "cardLast4": "7412" }` |
| GET | `/me/wallet/payment-config` | `{ "provider": "iyzico"\|"dev", "enabled", "requiresBillingDetails" }`; anahtarlar hiçbir zaman istemciye dönmez |
| POST | `/me/wallet/topup` | `{ "amount", "idempotencyKey", "buyer"? }` → aşağıdaki ödeme makbuzu |
| GET | `/me/wallet/payments/pending` | `{ "payment": makbuz\|null }`; uygulama yeniden açıldığında devam eden yüklemeyi kurtarır |
| GET | `/me/wallet/payments/:paymentId` | Yalnız ödeme sahibi için güncel makbuz; gerekiyorsa sunucu iyzico sonucunu tekrar sorgular |
| POST | `/me/wallet/qr-token` | Tara & Öde için tek kullanımlık kod: `{ "code", "expiresAt" }` (60 sn). POS köprüsü `/pos/charge` ile tahsil eder |

Ödeme makbuzu: `{ "paymentId", "amount", "balance", "bonusDrinks", "status": "pending"|"succeeded"|"failed"|"expired", "redirectUrl"?, "checkoutExpired", "idempotencyKeys": [] }`.
`idempotencyKeys` yalnız oturum sahibinin bu ödemeye bağlı tekrar anahtarlarını içerir. Sonuç doğrulandığında başka bir yüklemenin tekrar kimliği yanlışlıkla temizlenmez.

`buyer`: `{ name, surname, email, identityNumber, address, city, country, zipCode? }`.
Bu bilgiler iyzico başlatma isteğine iletilir; backend/uygulama tekrar kaydında veya loglarda tutulmaz. Telefon oturum sahibinden, IP güvenilen bağlantıdan alınır. Kart numarası/CVV uygulamaya veya bu API'ye gönderilmez; kart bilgileri iyzico'nun HTTPS ödeme sayfasında girilir.

Yükleme iki fazlıdır: kalıcı `PaymentIntent` ve tekrar anahtarı, dış çağrıdan önce oluşturulur. iyzico başlatma yalnız `pending` ve doğrulanmış ödeme adresi döndürür. Bakiyeye yazmak için sunucu imzalı sorgu yanıtını; ödeme/işlem kimliği, sepet, TRY tutarı, kalem ve dolandırıcılık onayıyla birlikte doğrular. Bakiye, ikram ve benzersiz defter kaydı aynı veritabanı işleminde yazılır.

`POST /webhooks/iyzico/callback` form `token` alanını alır; tarayıcı dönüşü tek başına ödeme onayı sayılmaz. `POST /webhooks/iyzico/notification` iyzico HPP `X-IYZ-SIGNATURE-V3` imzasını doğrular ve sonucu yeniden sorgular. Eski `/webhooks/payment/confirmation` yalnız dev simülasyonları içindir ve iyzico ödemelerini onaylayamaz.

Ödeme sayfasının süresi dolması banka tahsilatının başarısız olduğu anlamına gelmez. Bu yüzden `checkoutExpired=true` olan kayıt kontrol edilmeye devam eder; kullanıcı açıkça seçerse yeni işlem anahtarıyla başka yükleme açılabilir. Geç gelen doğrulanmış başarı da yalnız bir kez işlenir. Zaman aşımı, bağlantı kaybı ve fraud incelemesi bakiye/ikram oluşturmaz. API bilgileri eksikken iyzico yüklemeleri kontrollü olarak kapalıdır; dev moduna otomatik geçiş olmaz.

Kurulum ve doğrulama: [IYZICO.md](IYZICO.md).

## 4. Menü — `features/order/data/menu_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/menu/categories` | `[{ "id", "name" }]` |
| GET | `/menu/products?branchId=...` | `[{ "id", "name", "price", "categoryId", "description", "imageUrl", "gridImageUrl", "sizeMl", "stampMultiplier", "isNew", "isFeatured", "hasOptions" }]` |
| GET | `/menu/options` | Aktif süt/shot seçenekleri: `[{ "id", "group", "name", "priceDelta", "sortOrder", "isActive" }]` |

`imageUrl` ürün detayını, `gridImageUrl` kare menü vitrinini besler.
Süt/shot seçenekleri ve fiyat farkları `/menu/options` üzerinden gelir; sunucu
sipariş sırasında aktif seçenekleri ve güncel fiyatlarını yeniden doğrular.

## 5. Şubeler — `features/branches/data/branch_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/branches` | `[{ "id", "name", "address", "city", "phone", "lat", "lng", "hours", "isOpen", "isAcceptingOrders", "prepMinutes" }]` |

Uygulama, konum izni ve cihaz konumu varsa `lat/lng` ile gerçek mesafe hesaplar;
konum yokken temsili mesafe üretmez. `isOpen` manuel operasyon bayrağıdır;
`isAcceptingOrders` İstanbul saati, geceye taşan çalışma saatleri ve hazırlık
süresi dahil sunucunun anlık sipariş kabul durumudur. Mobil görünüm aynı
kuralla dakika değişimlerinde güncellenir; checkout tekrar sunucuda doğrulanır.

## 6. Kampanyalar — `features/campaigns/data/campaign_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/campaigns` | `[{ "id", "title", "badge", "description", "style" }]` |
| POST | `/campaigns/validate-code` | `{ "code": "DOSSO10" }` → `{ "valid", "discountRate": 0.10 }` (sepetteki kampanya kodu) |

## 7. Siparişler — `features/order/application/cart_controller.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/orders` | Aşağıdaki gövde → `{ "id": "DD-1042", "status": "received", "total", "stampsEarned" }` |
| GET | `/orders?paginated=true&limit=20&cursor=...` | Geçmiş siparişler: `{ "items": [...], "nextCursor": string\|null }` |
| GET | `/orders/:id` | Canlı takip: `status` = `received` → `preparing` → `ready` → `completed` (veya `cancelled`). Uygulama ~10 sn'de bir yoklar |

```json
{
  "branchId": "beylikduzu-vadi-loca",
  "pickupSlot": "12:30",
  "items": [
    { "productId": "findikli-latte", "quantity": 1,
      "size": "Orta", "milk": "Yulaf sütü", "shot": "Çift shot" }
  ],
  "promoCode": "DOSSO10",
  "useFreeDrink": true,
  "payment": { "method": "dosso_card" }
}
```

Sunucu: bakiye düşer, damga/ikram işler, siparişi şubenin Kerzz POS'una iletir.

## 8. Hediye — `features/gift/application/gift_controller.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/gifts` | `{ "recipientPhone", "type": "drink"\|"balance", "productId"?, "amount"?, "note" }` → alıcının telefonuna bağlı uygulama hesabına hediye |
| GET | `/gifts?paginated=true&limit=20&cursor=...` | Gönderilen hediyeler: `{ "items": [...], "nextCursor": string\|null }` |

Geçmiş sayfaları `(createdAt, id)` azalan sırasıyla kararlı cursor kullanır.
İlk istekte `cursor` gönderilmez; sonraki isteğe dönen `nextCursor` aynen
aktarılır; `null` listenin sonudur. `limit` 1–100 arasıdır. Her sayfada
hesap sahipliği yeniden uygulanır. Yeni kayıtlar, sonraki eski sayfayı
kaydırmaz. Geriye uyumluluk için `/orders` ve `/gifts` parametresiz istekleri
son 50 kaydı eski dizi biçiminde döndürür; mobil uygulama sayfalı sözleşmeyi
kullanır. `/me/loyalty` limit verilmezse ilk 50 geçmiş kaydını döndürür.

Hediyeler yalnızca uygulamada, alıcı telefon numarası doğrulanarak giriş yapılan hesap üzerinden kullanılır. Kayıtlı alıcının kahve hediyesi ikram hakkına, bakiye hediyesi cüzdanına eklenir; henüz hesabı olmayan alıcının hediyesi aynı numarayla giriş yapana kadar bekler. SMS yalnızca bilgilendirme/giriş davetidir ve kullanım kodu içermez. Hediye koduyla veya misafir olarak kullanım uç noktası yoktur. `redeemed` durumu hesaba aktarımı belirtir; kahvenin ya da bakiyenin harcandığı anlamına gelmez. Geliştirme ortamındaki SMS sağlayıcısı mesajı yalnızca loglar; gerçek SMS teslimatı için sağlayıcı entegrasyonu gerekir.

## 9. Bildirim tercihleri — `features/profile/application/notification_prefs.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET/PUT | `/me/notification-prefs` | `{ "campaigns": true, "orderStatus": true, "sms": false }` |

## 10. POS köprüsü ve sağlayıcı webhook'ları (sunucu ↔ sunucu)

Uygulama Kerzz ile doğrudan konuşmaz. Tüm POS/ödeme uçları **HMAC-SHA256
imzalıdır** ve **idempotenttir** (aynı `requestId`/`saleId`/`eventId`/
`paymentId` ikinci kez gelirse ilk yanıt aynen döner, işlem tekrarlanmaz):

```
X-Dosso-Signature: t=<unixSaniye>,v1=<hex hmac_sha256(secret, "<t>.<hamGövde>")>
```
Tolerans ±300 sn; sırlar `POS_WEBHOOK_SECRET` / `PAYMENT_WEBHOOK_SECRET`.

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/pos/charge` | `{ requestId, branchId, code, amount, saleRef? }` → `{ ok, chargeId, amount, customerName }`. Kodu tüketir + bakiyeyi düşer (15 sn grace penceresi). Redde `INVALID_QR` / `INSUFFICIENT_BALANCE`; red durumunda kod tüketilmez |
| POST | `/pos/charge/:chargeId/void` | `{ requestId, reason? }` → tam iade (15 dk pencere); dışında `VOID_NOT_ALLOWED` |
| POST | `/webhooks/kerzz/sale` | `{ saleId, branchId, customer:{chargeId?\|qrCode?}, items:[{productId, quantity}] }` → kasada damga işleme. Müşteri eşleşmezse `{ ok, skipped }`; bilinmeyen ürün 0 damga |
| POST | `/webhooks/kerzz/order-status` | `{ eventId, orderId:"DD-1043", status }` → sipariş durumu. Geç gelen eski durum sessizce atlanır; geçersiz sıçrama `INVALID_STATUS_TRANSITION` |
| POST | `/webhooks/payment/confirmation` | `{ paymentId, status:"succeeded"\|"failed" }` → yükleme onayı (bakiye burada yazılır) |

Gerçek POS olmadan deneme: `npm run pos:sim -- charge|void|sale|order-status|pay-confirm`
(bkz. `KERZZ_POS_ENTEGRASYON.md` demo bölümü).

## Hata biçimi

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Bakiye yetersiz" } }
```

Beklenen kodlar: `INVALID_OTP`, `INSUFFICIENT_BALANCE`, `INVALID_PROMO`,
`BRANCH_CLOSED`, `PRODUCT_UNAVAILABLE`, `NO_FREE_DRINK`, POS/ödeme kodları
`INVALID_SIGNATURE` (401), `INVALID_QR` (400), `INVALID_STATUS_TRANSITION`
(409), `VOID_NOT_ALLOWED` (409), `PAYMENT_NOT_PENDING` (409) ve altyapı
kodları `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `RATE_LIMITED`
(429 — OTP 3/10 dk; topup·sipariş·hediye 10/dk; qr-token 30/dk),
`NOT_FOUND`, `INTERNAL`.

## Uygulama notları (v1)

- Sipariş fiyatı **sunucuda yeniden hesaplanır**; istemcinin gönderdiği
  toplamlara güvenilmez. Opsiyon farkları panelden yönetilen `ProductOption`
  kayıtlarından okunur; istemcinin tanınmayan/pasif seçenek göndermesi reddedilir.
- İkram, sepetteki damga kazandıran en yüksek birim fiyatlı içeceği bedava
  yapar; ikram edilen içecek de damga kazandırır.
- Çoklu şube: merkezi menü ve şube bazlı fiyat/müsaitlik
  `BranchProduct` tablosuyla yönetilir. Müsait olmayan ürün
  siparişte `PRODUCT_UNAVAILABLE` döner.
- Kayıtlı olmayan telefona gönderilen hediye `PENDING` bekler; alıcı o
  numarayla ilk giriş yaptığında otomatik hesabına işlenir.
- `POST /orders` yanıtı ayrıca `subtotal`, `discount`, `freeDrinkDiscount`,
  `branchName` ve yapılandırılmış `items[]` (productName, unitPrice,
  isFreeDrink...) alanlarını içerir.

## Güvenilirlik ekleri (02.10.2026)

- `GET /config/public`: `{ stampTarget, topupThreshold, topupBonusDrinks, topupFirstOnly }`. Kimlik gerekmez. Değerler paneldeki doğrulanmış ayarlardan gelir.
- Sipariş, hediye ve yükleme POST gövdeleri opsiyonel UUID `idempotencyKey` kabul eder. Anahtar kullanıcı ve endpoint kapsamındadır. Aynı anahtar + aynı içerik aynı sonucu döndürür; farklı içerik `409 IDEMPOTENCY_CONFLICT` alır. Eski istemci için alan opsiyonel tutuldu; yeni istemci belirsiz yanıt boyunca anahtarı kalıcı tutar.
- `POST /orders` ve `POST /gifts` opsiyonel `expectedTotal` kabul eder. Güncel tutar farklıysa cüzdana dokunulmadan `409 PRICE_CHANGED`, `{ error: { code, message, details: { total } } }` döner. Yeni toplam yeniden onaylanmalıdır. Kahve hediyesi global katalog fiyatını kullanır; şube fiyatı sipariş içindir.
- `GET /menu/products?branchId=...` seçili şubenin fiyat/müsaitliğini yansıtır. Aktif opsiyonlar menü opsiyon API'sinden okunur; pasif/bilinmeyen seçenek ödeme hesabında reddedilir.
- `GET /me/wallet/payments/:id` yalnız sahibinin yükleme sonucunu sorgular; bu okuma sağlayıcıda yeni tahsilat başlatmaz.
- `GET /admin/orders?activeOnly=true` yalnız RECEIVED/PREPARING/READY siparişleri sayfalar. Liste ve CSV/XLSX aynı filtre sözleşmesini paylaşır.
- Finans defteri CSV/XLSX aynı `type`, `from`, `to`, `q` filtrelerini kullanır. 10.000 satır üstü açık hata; kısmi dosya döndürülmez.
- `POST /admin/branches/:id/availability/:productId` gövdesinde `priceOverride` gönderilmezse mevcut fiyat korunur. `null` açıkça temizler.
- Para girişleri en çok iki ondalık basamaktır. Ayarlar: hedef 1..100 tam sayı; ikram adedi 0..100 tam sayı; eşik 0,01..100000 TL; ilk-yükleme seçeneği gerçek boolean.

## Panel işlem ve oturum güvenliği (11.10.2026)

- `POST /admin/customers/:id/balance` ve `POST /admin/menu/bulk-price`
  gövdelerinde UUID `idempotencyKey` zorunludur. Anahtar yönetici ve işlem
  kapsamında tutulur. Aynı anahtar ve gövde ilk başarılı sonucu döndürür;
  farklı gövde `409 IDEMPOTENCY_CONFLICT` olur. İşlem, audit ve sonuç kaydı
  aynı transaction içindedir; geri alınan işlem aynı anahtarla yeniden denenebilir.
- Panel anahtarı isteği göndermeden önce kalıcılaştırır; belirsiz yanıt veya
  sayfa yenileme anahtarı değiştirmez. Mobil de anahtar yazımı doğrulanmadan
  sipariş/hediye/yükleme isteği göndermez.
- `/admin/auth/login` ve `/admin/auth/me` içindeki yönetici bilgisi
  `mustChangePassword` ve `tempPasswordExpiresAt` alanlarını içerir. Yeni
  oluşturulan/sıfırlanan geçici şifreler 24 saat geçerlidir. Şifre değiştirilene
  kadar panel işlemleri `403 PASSWORD_CHANGE_REQUIRED` döndürür; oturum
  bilgisi ve `POST /admin/auth/password` erişilebilir. Süresi dolmuş geçici
  şifre `401 TEMP_PASSWORD_EXPIRED` olur. Mevcut kalıcı şifreler korunur.
- Müşteri ve yönetici refresh tekrar kullanımı yalnız ilgili oturum ailesini
  kapatır; süresi dolmuş eski token diğer girişleri iptal etmez. Aileye bağlı
  access token'ları da iptal kontrolünden geçer.
- Müşterinin tüm oturumlarını iptal etme ve hesap dondurma, henüz kullanılmamış
  ödeme QR'larını aynı transaction içinde geçersiz kılar. QR üretimi ve
  tahsilatı aynı kullanıcı kilidiyle bu işlemlerle sıralanır.
- Promo güncellemesinde `expiresAt` verilmezse mevcut süre korunur;
  ISO tarih yeni süreyi belirler, yalnız açıkça gönderilen `null` süreyi kaldırır.


## Hesap talepleri ve kişisel veri dışa aktarımı (07.10.2026)

Tüm `/me` uçları müşteri Bearer tokenı gerektirir ve yalnız oturum sahibini kapsar.
Hesap talebi kaydı şu alanları döndürür:
`{ id, kind, status, note, response, createdAt, updatedAt }`.
`kind`: `CLOSURE | DATA_EXPORT`; `status`: `OPEN | IN_REVIEW | COMPLETED | REJECTED | CANCELLED`.

| Metot | Endpoint | Gövde / yanıt |
|---|---|---|
| GET | `/me/account-requests` | Kullanıcının talepleri, yeni → eski kayıt dizisi |
| POST | `/me/account-requests` | `{ kind, note? }` → kayıt (201); not en çok 1000 karakter |
| POST | `/me/account-requests/:id/cancel` | Kendi açık/incelemedeki talebini iptal eder → kayıt; aynı iptalin tekrarı güvenlidir |
| GET | `/me/data-export?section=profile&page=1` | `{ section, page, entries, hasMore }`; sayfa başına en çok 100 satır |
| GET | `/admin/account-requests?status=OPEN&page=1` | `{ page, total, pageSize: 30, entries }` |
| PATCH | `/admin/account-requests/:id` | `{ status: IN_REVIEW|COMPLETED|REJECTED, response }` → güncel kayıt |

Aynı kullanıcı ve tür için yalnız bir açık talep bulunur; eşzamanlı POST tekrarları
aynı kaydı döndürür. Sonuçlanma veya iptalden sonra yeni talep açılabilir.
Yönetici yanıtı 3–2000 karakterdir. Yönetici/super admin güncelleyebilir;
görüntüleyici listeleyebilir; şube yöneticisi bu modüle erişemez.

Kapatma tamamlanmadan önce cüzdan bakiyesi sıfır olmalı; aktif sipariş, bekleyen
yükleme ve gönderilen/alınan bekleyen hediye bulunmamalıdır. Tamamlama,
`closedAt` kaydı, hesap engeli, token sürüm artışı, refresh/QR iptali ve audit
kaydını tek transaction içinde yazar. Kapatılan hesap yeniden OTP girişi yapamaz.
Bu işlem hukuki silme/anonimleştirme taahhüdü değildir; finans ve denetim kayıtları korunur.

Dışa aktarım bölümleri:

| `section` | İçerik |
|---|---|
| `profile` | Kendi kimliği/iletişimi, oluşturulma tarihi, bildirim tercihleri, cüzdan özeti ve sadakat özeti; tek kayıt |
| `orders` | Kendi siparişleri, ürün kalemleri ve işlem anındaki tutarlar |
| `wallet` | Kendi hareketleri; üçüncü kişi telefonları açıklamalarda maskelenir |
| `gifts` | Gönderilen/alınan kendi hediyeleri; gönderim alıcısının telefonu maskelenir |
| `loyalty` | Kendi sadakat geçmişi; iç journal metadata'sı paylaşılmaz |
| `requests` | Kendi hesap talepleri |

API açık alan listeleri kullanır; tokenlar, token hash'leri, OTP kodları, şifreler
ve başka kullanıcıların hesap kayıtları dışa aktarılmaz. `page` pozitif tam sayıdır;
`hasMore` true oldukça sonraki sayfa alınır. Veri talebinin tamamlanması, bu
kişisel dışa aktarımın hazır olduğuna ilişkin yönetici yanıtıdır; tek seferde
sınırsız sunucu dosyası veya hukuki uyumluluk garantisi değildir.

## Uygulama içi bildirim merkezi (07.10.2026)

| Metot | Endpoint | Yanıt |
|---|---|---|
| GET | `/me/notifications?page=1` | `{ page, entries, unreadCount, hasMore }`; sayfa boyu 30 |
| PATCH | `/me/notifications/:id/read` | Yalnız sahibinin bildirimini okundu yapar → `{ id, readAt }` |

Bildirim: `{ id, kind, title, body, targetPath, readAt, createdAt }`.
Türler: `ORDER_STATUS`, `GIFT_RECEIVED`, `ACCOUNT_REQUEST`, `CAMPAIGN`.
`readAt` okunmamış kayıtta null'dır; tekrar okundu isteği tarihi değiştirmez.

Sipariş/iptal ve hediye/talep bildirimleri alan işlemiyle aynı transaction'da
oluşturulur. Kullanıcı + olay anahtarı tekildir; aynı olay tekrar bildirim üretmez.
Sipariş ve kampanya tercihleri gözetilir; hediye ve hesap talebi mesajları
operasyonel olduğundan bu iki tercihle kapatılmaz.

Liste okuması, kullanıcının kampanya tercihi açıksa en yeni 50 aktif hikâyeyi
başlangıç/bitiş ve bağlı kampanya durumuna göre değerlendirir. Her hikâye kullanıcıya
yalnız bir kez eklenir; metni düzenlemek tekrar bildirim göndermez.
Bu merkez uygulama içi listeleme/yenilemedir. Firebase/APNs yapılandırması henüz
hazır olmadığından uzaktan cihaz push'u veya arka planda teslim garantisi vermez.

## Hediye, finans ve zaman tutarlılığı ekleri (07.10.2026)

- `POST /gifts/claim`: gövdesiz, oturumlu ve idempotent; `{ claimed: number }`
  döndürür. Kayıt/hesap açılması sonrasında beklemiş hediyeleri yeniden değerlendirir.
  Telefon kilidi kullanıcı kilitlerinden önce alınır; kayıt ile gönderim yarışı
  hediyeyi kaçırmaz. Kapatılmış hesaba yeni hediye gönderimi reddedilir.
- `WalletTxType.ADJUSTMENT`: yeni manuel panel düzeltmelerinin ayrı hareket türüdür.
  Artı/eksi tutar işareti korunur; düzeltme gerçek yükleme veya sipariş sayılmaz.
  Eski hareketler yeniden yazılmaz. İlk yükleme kampanyası yalnız başarılı
  `PaymentIntent` kayıtlarını sayar; geçmişte `TOPUP` diye yazılmış panel düzeltmesi
  kampanya hakkını tüketmez. Kapatılan hesaba bakiye/sadakat düzeltmesi yapılamaz.
- Paralel QR üretimi kullanıcı kilidiyle seri hale gelir. Yenilenen eski kodlar
  açıkça iptal edilir; tahsilatın süre toleransı bu eski kodları canlandırmaz.
- `pickupSlot`, `asap`, `En kısa (~7 dk)` benzeri mevcut en-kısa etiketi veya `HH:mm`
  olabilir. Sunucu `Europe/Istanbul` saatinde çalışma aralığını, hazırlık süresini ve
  kapanıştan önce hazır olmayı doğrular. Gece yarısını aşan açık şubede ertesi günün
  uygun saati kabul edilebilir; geçmiş/hatalı/çok yakın saat reddedilir.
- Şube çalışma saati biçimi `08:00–01:00`, `08:00–24:00` veya `24 saat açık`tır.
  Manuel `isOpen=false` her durumda siparişi durdurur. Geçersiz saat formatı panelde reddedilir.
- Günlük/saatlik işletme raporları `Europe/Istanbul` kullanır; sunucunun yerel
  saat dilimi sonucu değiştirmez. Anlık kayıt tarihleri JSON'da ISO 8601 UTC kalır.
  Ciro, iptal edilmemiş siparişleri ve iptal edilmemiş QR tahsilatlarını kapsar;
  şube filtresi her ikisine de uygulanır.
