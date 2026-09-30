# Dosso Dossi Coffee ☕

Dosso Dossi Coffee mobil uygulaması — Flutter ile geliştirilmiş, iOS ve Android destekli sadakat & sipariş uygulaması.

## Özellikler

- **Telefon + SMS ile giriş** (OTP doğrulama)
- **Damga kartı sadakat sistemi** — 5 damga = 1 ikram içecek
- **Yükle-Kazan kampanyası** — 1000 ₺ ve üzeri yüklemeye 5 kahve hediye
- **Sipariş & sepet** — gerçek menü (~200 ürün, 16 kategori), süt/shot seçenekleri
- **Dosso Kart** — bakiye yükleme ve QR ile ödeme (Tara & Öde)
- **Hediye gönderme** — arkadaşına kahve veya bakiye gönder
- **Kampanya sayfaları** — interaktif "Kahve İçtikçe Kahve Kazan" afişi
- **Şube seçimi** — 4 gerçek şube (Beylikdüzü Vadi Loca, Beylikdüzü Son Durak, Vatan Caddesi, Diyarbakır Stad), uygulama içi şube değiştirme

## Mimari

- **Flutter + Riverpod 3** (AsyncNotifier/Notifier) + **GoRouter** (StatefulShellRoute)
- **Repository pattern** — şu an `MockXRepository` sınıfları; gerçek API hazır olduğunda tek satırlık değişiklikle `ApiXRepository`'ye geçilir (bkz. [docs/API_CONTRACT.md](docs/API_CONTRACT.md))
- **Merkezi tema** — renk paleti `lib/core/theme/app_colors.dart` içinde tek yerden değiştirilir; tipografi ve boşluklar da aynı şekilde merkezidir
- **İş kuralları** — `lib/core/constants/app_config.dart` (damga hedefi, yükleme bonusu vb.)

## Klasör Yapısı

```
lib/
├── core/            # tema, sabitler, ortak widget'lar, yardımcılar
├── features/        # özellik bazlı modüller
│   ├── auth/        # telefon + OTP girişi
│   ├── home/        # ana sayfa, damga kartı, kampanya karuseli
│   ├── order/       # menü, ürün detayı, sepet, sipariş
│   ├── wallet/      # Dosso Kart, bakiye, Tara & Öde
│   ├── rewards/     # damga/ikram sistemi
│   ├── gift/        # hediye gönderme
│   ├── campaigns/   # kampanyalar + afiş sayfası
│   └── profile/     # profil ve ayarlar
└── routing/         # GoRouter yapılandırması
```

## Çalıştırma

İlk kurulumda `dart_defines.example.json` dosyasını `dart_defines.json` olarak
kopyalayıp `MAPBOX_TOKEN` değerini doldurun. Bu yerel dosya Git'e eklenmez.
Çalıştırma betiği ayar dosyasını otomatik yükler; harita mock modunda da bu
yapılandırmayı kullanır.

```bash
flutter pub get
./tool/run.sh
./tool/run.sh -t lib/main_preview.dart --dart-define=USE_MOCKS=true
```

`flutter run` seçeneklerini betiğe doğrudan ekleyebilirsiniz. Yayın
derlemelerinde de aynı ayar dosyasını aktarın:

```bash
flutter build apk --dart-define-from-file=dart_defines.json
flutter build ios --dart-define-from-file=dart_defines.json
```

Test ve analiz:

```bash
flutter analyze
flutter test
```

Giriş simülasyon modunda çalışır: herhangi bir 6 haneli doğrulama kodu kabul edilir (örn. **111111**).

## Dokümanlar

- [docs/ROADMAP.md](docs/ROADMAP.md) — geliştirme fazları ve sonraki adımlar
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — backend için endpoint sözleşmesi
- [docs/KERZZ_POS_ENTEGRASYON.md](docs/KERZZ_POS_ENTEGRASYON.md) — Kerzz POS entegrasyon hazırlık dokümanı
