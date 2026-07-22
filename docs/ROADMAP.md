# Dosso Dossi — Yol Haritası

Kahve dükkânı sadakat + sipariş uygulaması (Flutter, iOS + Android).

## Kararlar
- **Veri:** Şimdilik mock repository'ler; REST API sonra yazılacak. Sözleşme: `API_CONTRACT.md`
- **Ödeme:** Simülasyon (gerçek sağlayıcı sonraki fazda)
- **Giriş:** Telefon + SMS kodu (simüle)
- **State:** Riverpod · **Navigasyon:** GoRouter · **Font:** Baloo 2
- **Sadakat kampanyaları (CEO onaylı):** (1) 5 kahve alana 1 kahve — damga hedefi dolunca ikram hakkına dönüşür; (2) tek seferde 1.000 ₺+ bakiye yükleyene 5 ikram kahve. Eşikler `lib/core/constants/app_config.dart` içinden değişir.
- **POS entegrasyonu:** Yazarkasa entegrasyonu **Kerzz POS** ile yapılacak (CEO teknik ekiple görüştürecek). Hazırlık notları ve teknik ekibe sorulacak sorular: `docs/KERZZ_POS_ENTEGRASYON.md`
- **Ürün görselleri:** Çekirdek kahve (250 gr / 1 kg), mug ve içecek/yiyecek fotoğrafları marka ekibinden gelecek; şimdilik emoji yer tutucu kullanılıyor.
- **Menü:** Resmi fiyat listesi (Tem 2026) birebir işlendi — 16 kategori, ~200 ürün, `mock_menu_repository.dart` tek dosyada. 9 içecek kategorisi + Kahvaltılıklar, Tatlılar, Kek & Kurabiye, Sandviç & Tost, Atıştırmalıklar, Çekirdek Kahveler, Termos & Mug. Süt ekstraları +60 ₺, çift shot +40 ₺ (`product_options.dart`). Boy seçeneği yok (ürün boyları sabit: 14/16 oz). Damga yalnızca kahve kategorilerinde.
- **Şubeler:** Resmi mağaza listesindeki 4 gerçek şube (Tem 2026) — Beylikdüzü Vadi Loca (08:00–01:00), Beylikdüzü Son Durak (24 saat), Vatan Caddesi (08:00–24:00), Diyarbakır Stad (08:00–01:00). Uygulama içi şube değiştirme Faz 3'te eklendi.

## Fazlar

- [x] **Faz 0 — Temel:** proje iskeleti, tema sistemi (`lib/core/theme/`), 5 sekmeli alt menü, API istemci iskeleti
- [x] **Faz 1 — Giriş:** onboarding, telefon + SMS kod ekranı, oturum saklama
- [x] **Faz 2 — Ana Sayfa:** selamlama, damga kartı (3/5), Dosso Kart + Yükle, "Sana Özel" kampanya kartları, yakın şube
- [x] **Faz 3 — Sipariş:** şube seçici + uygulama içi şube değiştirme, menü + kategoriler + arama, ürün detay (boy/süt/shot), sepet, pickup saati, kampanya kodu, ödeme simülasyonu
- [x] **Faz 4 — Tara & Öde:** Dosso Kart görseli, 60 sn yenilenen QR + barkod, bakiye yükleme (hızlı tutarlar + serbest tutar)
- [x] **Faz 5 — İkramlarım:** damga ilerlemesi, damga → ikram dönüşümü, sepette ikram kullanma, yükleme bonusu (1.000 ₺ → 5 ikram), ikram geçmişi
- [x] **Faz 6 — Hediye & Kampanyalar:** arkadaşa kahve/bakiye hediye akışı, kampanya listesi + interaktif "Kahve İçtikçe Kahve Kazan" kampanya sayfası (pankart uyarlaması)
- [x] **Faz 7 — Profil:** kişisel bilgiler, bildirim tercihleri, kayıtlı kartlar, geçmiş siparişler, favoriler, şubeler (il bazlı liste + şube değiştirme), SSS, KVKK, çıkış
- [x] **Faz 8 — Cila & API:** boş/hata durumları, uçtan uca sipariş testi düzeltildi, `API_CONTRACT.md` yazıldı (Kerzz köprü endpoint'leri dahil)

## Sonraki Adımlar (API dönemi)
- [ ] Backend geliştirme (`API_CONTRACT.md` sözleşmesine göre)
- [ ] Kerzz POS teknik görüşmesi (`KERZZ_POS_ENTEGRASYON.md` soru listesi)
- [ ] Gerçek ürün görselleri geldiğinde emoji yer tutucuların değişmesi
- [ ] Gerçek SMS sağlayıcı + push bildirim (Firebase Messaging)
- [ ] Ödeme sağlayıcı entegrasyonu (kart saklama / 3D Secure)
- [ ] KVKK metninin hukuk onayı

## Klasör Yapısı

```
lib/
├── main.dart              # Giriş noktası
├── app.dart               # MaterialApp + tema + router bağlantısı
├── core/
│   ├── theme/             # 🎨 TÜM görsel kimlik burada
│   │   ├── app_colors.dart      # Renk paleti — rengi buradan değiştir
│   │   ├── app_typography.dart  # Yazı tipleri — fontu buradan değiştir
│   │   ├── app_spacing.dart     # Boşluk ve köşe yarıçapları
│   │   └── app_theme.dart       # Material temasına bağlayan katman
│   ├── network/           # Dio istemcisi + endpoint sabitleri
│   └── widgets/           # Ortak widget'lar (buton, kart, rozet...)
├── features/              # Her özellik kendi klasöründe
│   ├── auth/  home/  scan_pay/  order/  rewards/
│   ├── gift/  campaigns/  profile/  branches/
│   │   └── (her biri) data/ → repository + mock, presentation/ → ekranlar
└── routing/
    ├── app_router.dart    # Tüm sayfa yolları
    └── main_shell.dart    # 5 sekmeli alt menü
```

## Kurallar
- Renk/font değişikliği **sadece** `core/theme/` içinden yapılır; ekran kodlarına ham renk (`Color(0xFF...)`) yazılmaz.
- Her feature'ın verisi bir `Repository` interface'inin arkasındadır: `MockXRepository` → ileride `ApiXRepository`.
- Yeni ekran = önce `routing/app_router.dart`'a yol tanımı, sonra `features/<özellik>/presentation/` altına dosya.
