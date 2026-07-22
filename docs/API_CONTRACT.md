# Dosso Dossi — REST API Sözleşmesi (v1)

Bu sözleşme `dosso-dossi-backend/` içinde uygulanmıştır (Node.js + Express +
Prisma + PostgreSQL). Uygulamadaki her repository'nin `ApiXRepository`
karşılığı yazılmıştır; mock ↔ API geçişi derleme bayrağıyla yapılır:

```bash
flutter run --dart-define=USE_MOCKS=false --dart-define=API_BASE_URL=http://localhost:3000
```

- **Base URL:** `--dart-define=API_BASE_URL` (varsayılan `http://localhost:3000`)
- **Kimlik doğrulama:** `Authorization: Bearer <token>` (OTP doğrulamasında alınır, JWT 30 gün)
- **Para birimi:** tüm tutarlar kuruş hassasiyetli ondalık TL (`425.50`)
- **Tarihler:** ISO 8601 UTC
- **Geliştirme OTP'si:** kod sunucu konsoluna yazılır; `OTP_DEV_MODE=true` iken `111111` her zaman geçer

## 1. Kimlik (auth) — `features/auth/data/auth_repository.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | `/auth/otp/send` | `{ "phone": "5551112233" }` → SMS kodu gönderir |
| POST | `/auth/otp/verify` | `{ "phone", "code" }` → `{ "token", "user": { "phone", "name", "email" } }` |
| PATCH | `/me` | `{ "name"?, "email"? }` → güncel kullanıcı |

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
| POST | `/me/wallet/topup` | `{ "amount": 1000, "savedCardId" }` → yeni bakiye + uygulanan bonus: `{ "balance", "bonusDrinks": 5 }` |
| POST | `/me/wallet/qr-token` | Tara & Öde için tek kullanımlık kod: `{ "code", "expiresAt" }` (60 sn). Kerzz POS bu kodu çözer — bkz. `KERZZ_POS_ENTEGRASYON.md` |

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
| POST | `/gifts` | `{ "recipientPhone", "type": "drink"\|"balance", "productId"?, "amount"?, "note" }` → alıcıya SMS kodu |
| GET | `/gifts` | Gönderilen hediyeler |

## 9. Bildirim tercihleri — `features/profile/application/notification_prefs.dart`

| Metot | Endpoint | Açıklama |
|---|---|---|
| GET/PUT | `/me/notification-prefs` | `{ "campaigns": true, "orderStatus": true, "sms": false }` |

## 10. Kerzz POS köprüsü (sunucu ↔ sunucu)

Uygulama Kerzz ile doğrudan konuşmaz. Backend'in alacağı webhook'lar
(detay ve açık sorular: `KERZZ_POS_ENTEGRASYON.md`):

- `POST /webhooks/kerzz/sale` — kasadaki satış (damga işleme + QR ödeme onayı)
- `POST /webhooks/kerzz/order-status` — Gel-Al sipariş durumu (hazırlanıyor/hazır)

## Hata biçimi

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Bakiye yetersiz" } }
```

Beklenen kodlar: `INVALID_OTP`, `INSUFFICIENT_BALANCE`, `INVALID_PROMO`,
`BRANCH_CLOSED`, `PRODUCT_UNAVAILABLE`, `NO_FREE_DRINK` ve altyapı kodları
`UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `RATE_LIMITED` (429, OTP
gönderiminde 10 dakikada 3 kod sınırı), `NOT_FOUND`, `INTERNAL`.

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
