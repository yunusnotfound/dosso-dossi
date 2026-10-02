# Dosso Dossi — REST API Sözleşmesi (v1)

Bu sözleşme `dosso-dossi-backend/` içinde uygulanmıştır (Node.js + Express +
Prisma + PostgreSQL). Uygulamadaki her repository'nin `ApiXRepository`
karşılığı yazılmıştır. `flutter run` varsayılan olarak gerçek API'ye bağlanır;
mock veriye dönmek için `--dart-define=USE_MOCKS=true` verilir (testler
kendiliğinden mock modunda çalışır).

- **Base URL:** `--dart-define=API_BASE_URL` (varsayılan `http://localhost:3000`)
- **Kimlik doğrulama:** `Authorization: Bearer <token>` (OTP doğrulamasında alınır, JWT 30 gün)
- **Para birimi:** tüm tutarlar kuruş hassasiyetli ondalık TL (`425.50`)
- **Tarihler:** ISO 8601 UTC
- **Geliştirme OTP'si:** kod sunucu konsoluna yazılır; `OTP_DEV_MODE=true` iken `111111` her zaman geçer

## Panel değişikliklerinin uygulamaya yansıması

`GET /sync/revisions` kimlik doğrulaması gerektirmeden
`{ "menu", "branches", "campaigns", "loyalty", "wallet", "orders" }`
alanlarında opak sürüm değerleri döndürür (`Cache-Control: no-store`).
Yalnız tamamlanmış, audit kaydı bulunan panel işlemleri sürümü değiştirir;
müşteri bilgileri veya audit içerikleri paylaşılmaz.

Gerçek API modunda uygulama ön plandayken üç saniyede bir bu küçük yanıtı
kontrol eder ve yalnız değişen alanın mevcut API verilerini yeniler. Arka
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
| POST | `/auth/refresh` | `{ "refreshToken" }` → yeni `{ "token", "refreshToken" }` (rotasyon; iptal edilmiş token yeniden kullanılırsa tüm oturumlar iptal edilir) |
| POST | `/auth/logout` | `{ "refreshToken"? }` → refresh token iptali (her zaman 200) |
| PATCH | `/me` | `{ "name"?, "email"? }` → güncel kullanıcı |

Access token (JWT) ~15 dk geçerlidir; uygulama 401 aldığında refresh ile
sessizce yeniler ve isteği tekrarlar.

`name` boş dönerse uygulama isim adımını gösterir (yeni kullanıcı).

## 2. Sadakat — `features/rewards/data/loyalty_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/me/loyalty` | `{ "stamps": 3, "target": 5, "freeDrinks": 1, "history": [{ "title", "date", "used" }] }` |

Kurallar **sunucuda** uygulanır (kaynak: CEO kampanyaları):
- Her kahve satışı damga ekler; `target` (5) dolunca damgalar sıfırlanıp `freeDrinks` +1.
- Tek seferde 1.000 ₺+ yükleme → `freeDrinks` +5 (aşağıda `topup`).
- İkram kullanımı sipariş isteğinde `useFreeDrink` ile gelir.

## 3. Cüzdan — `features/wallet/data/wallet_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/me/wallet` | `{ "balance": 425.50, "cardLast4": "7412" }` |
| POST | `/me/wallet/topup` | `{ "amount": 1000, "savedCardId" }` → `{ "balance", "bonusDrinks", "paymentId", "status": "succeeded"\|"pending", "redirectUrl"? }` |
| POST | `/me/wallet/qr-token` | Tara & Öde için tek kullanımlık kod: `{ "code", "expiresAt" }` (60 sn). POS köprüsü `/pos/charge` ile tahsil eder |

Yükleme iki fazlıdır: `PaymentIntent` PENDING açılır, sağlayıcı onayı
(`/webhooks/payment/confirmation`) gelmeden bakiyeye yazılmaz. Dev
sağlayıcı anında onaylar; iyzico'da `status: "pending"` + `redirectUrl`
(3DS) dönecek.

## 4. Menü — `features/order/data/menu_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/menu/categories` | `[{ "id", "name" }]` |
| GET | `/menu/products` | `[{ "id", "name", "price", "categoryId", "description", "imageUrl", "sizeMl", "stampMultiplier", "isNew", "isFeatured", "hasOptions" }]` |

`imageUrl`: marka ekibinden görseller gelince doldurulacak; uygulama şu an
emoji yer tutucu gösteriyor. Boy/süt/shot fiyat farkları şimdilik uygulamada
(`product_options.dart`); istenirse `/menu/options` endpoint'ine taşınabilir.

## 5. Şubeler — `features/branches/data/branch_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/branches` | `[{ "id", "name", "address", "city", "phone", "lat", "lng", "hours", "isOpen", "prepMinutes" }]` |

Uygulama `lat/lng` ile gerçek mesafe hesaplayacak (şu an temsili).

## 6. Kampanyalar — `features/campaigns/data/campaign_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | `/campaigns` | `[{ "id", "title", "badge", "description", "style" }]` |
| POST | `/campaigns/validate-code` | `{ "code": "DOSSO10" }` → `{ "valid", "discountRate": 0.10 }` (sepetteki kampanya kodu) |

## 7. Siparişler — `features/order/application/cart_controller.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/orders` | Aşağıdaki gövde → `{ "id": "DD-1042", "status": "received", "total", "stampsEarned" }` |
| GET | `/orders` | Geçmiş siparişler (yeniden eskiye) |
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
| GET | `/gifts` | Gönderilen hediyeler |

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
  toplamlara güvenilmez. Opsiyon farkları sunucuda sabittir: yulaf/badem
  sütü +60 ₺, çift shot +40 ₺ (ileride `/menu/options` endpoint'ine taşınabilir).
- İkram, sepetteki damga kazandıran en yüksek birim fiyatlı içeceği bedava
  yapar; ikram edilen içecek de damga kazandırır.
- Çoklu şube: menü ve fiyatlar merkezidir; şube bazlı müsaitlik (ve ileride
  fiyat farkı) `BranchProduct` tablosuyla yönetilir. Müsait olmayan ürün
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
