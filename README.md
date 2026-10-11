# Dosso Dossi Coffee

Kahve zinciri için sadakat + sipariş platformu (monorepo).

```
├── dosso-dossi-app/       # Flutter mobil uygulaması (iOS + Android)
├── dosso-dossi-backend/   # Node.js + Express + Prisma + PostgreSQL REST API
├── dosso-dossi-admin/     # React + Vite yönetim paneli (backend'in /admin ağacı)
├── docs/                  # Ortak dokümanlar (API sözleşmesi, Kerzz POS notları, yol haritası)
└── docker-compose.yml     # Geliştirme veritabanı (PostgreSQL 17)
```

## Geliştirme ortamı

### Veritabanı

```bash
docker compose up -d db          # PostgreSQL 17, localhost:5433
```

### Backend

```bash
cd dosso-dossi-backend
cp .env.example .env             # gerekirse düzenle
npm install
npm run prisma:migrate           # migration + client üretimi
npm run prisma:seed              # menü, şubeler, kampanyalar, promo kodlar
npm run dev                      # http://localhost:3000
TEST_DATABASE_URL=postgresql://dosso:dosso@localhost:5433/dosso_dossi_test npm test
# Yalnız ayrı test DB: fixture tabloları sıfırlanır. Ayrı container için aşağıdaki rehber.
```

Geliştirme SMS adaptörü kodu konsola yazar. `111111` yalnız `OTP_DEV_MODE=true` iken geçerlidir. Backend ve veritabanı bu aşamada bilinçli olarak local çalışır.
API geliştirmede yalnız `127.0.0.1` üzerinden dinler. Fiziksel cihazdan test
gerektiğinde `HOST` açıkça ayarlanabilir; production varsayılanı `0.0.0.0`'dır.

Var olan verileri koruyarak kurulum güncellemek için `npx prisma migrate deploy && npx prisma generate` kullanın. `npm run build && npm start` derlenmiş sunucuyu başlatır.

### Yönetim paneli

```bash
cd dosso-dossi-backend
npm run admin:create -- eposta@ornek.com "Ad Soyad"   # ilk SUPER_ADMIN
cd ../dosso-dossi-admin
npm install
npm run dev                      # http://localhost:5173
```

Backend `.env`'inde `ADMIN_JWT_SECRET` (JWT_SECRET'tan farklı) ve
`ADMIN_ORIGINS` gerekir; ayrıntı için [dosso-dossi-admin/README.md](dosso-dossi-admin/README.md).

### Flutter uygulaması

İlk kurulumda `dosso-dossi-app/dart_defines.example.json` dosyasını
`dart_defines.json` olarak aynı klasöre kopyalayıp `MAPBOX_TOKEN` değerini
doldurun. `tool/run.sh` bu yerel ayar dosyasını her çalıştırmada yükler.

```bash
cd dosso-dossi-app
flutter pub get
./tool/run.sh                                # gerçek API ile (localhost:3000, varsayılan)
./tool/run.sh --dart-define=USE_MOCKS=true     # mock veriyle (backend gerekmez)
flutter test                                 # testler kendiliğinden mock modunda çalışır
```

Android emülatöründe `--dart-define=API_BASE_URL=http://10.0.2.2:3000` ekleyin.
Local geliştirmede canlı API adresi veya yayın imzası gerekmez.
Mağazalar ekranındaki **Mesafeler için konumumu kullan** işlemi izinle cihaz
konumunu alır; izin verilmezse mesafe veya en yakın şube iddiası gösterilmez.

Yayına geçerken ayar dosyasına gerçek HTTPS `API_BASE_URL`, `USE_MOCKS=false`
ve onaylı metne yönlenen HTTPS `PRIVACY_POLICY_URL` ekleyin. Gizlilik adresi
hazır değilken uygulama taslak hukuk metni göstermez. Release uygulaması HTTP,
localhost API veya mock verilerle açılmaz.

Android release için `android/key.properties.example` dosyasını gitignored
`android/key.properties` dosyasına kopyalayıp gerçek yayın anahtarını tanımlayın.
Eksik imza ayarı release derlemesini durdurur; debug anahtarına geri dönülmez.
Yayın derlemesinde ayar dosyasını aktarın:

```bash
flutter build apk --dart-define-from-file=dart_defines.json
flutter build ios --dart-define-from-file=dart_defines.json
```

## Dokümanlar

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST API sözleşmesi
- [docs/KERZZ_POS_ENTEGRASYON.md](docs/KERZZ_POS_ENTEGRASYON.md) — POS entegrasyon planı
- [docs/ROADMAP.md](docs/ROADMAP.md) — yol haritası

- [docs/RELIABILITY_WORK.md](docs/RELIABILITY_WORK.md) — bağımsız düzeltmeler, test izolasyonu, veri geçişi ve bakım kararları
- [docs/PROFESSIONAL_REVIEW_2026_10.md](docs/PROFESSIONAL_REVIEW_2026_10.md) — son kod iyileştirmeleri, doğrulamalar ve hazır olması gereken dış ayarlar

## Kalite kontrolleri

Temel kalite kontrolleri aşağıdaki komutlarla çalıştırılır. Son incelemede hazırlanan ek testler ve CI iş akışı yerelde korunur; bu branch'e dahil edilmemiştir.

```bash
# dosso-dossi-backend (önceden oluşturulmuş, yalnız teste ayrılan *_test DB)
npm run build
TEST_DATABASE_URL=postgresql://dosso:dosso@localhost:5433/dosso_dossi_test npm test

# dosso-dossi-admin
npm run typecheck
npm run lint -- --deny-warnings
npm run build
npm run test:regression
npm run test:stories

# dosso-dossi-app
flutter analyze
flutter test
```

Profilde **Bildirimler**, **Hesap ve Veri Talepleri** ve sayfalı kişisel veri görünümü bulunur. Yönetici talepleri panelde inceler; kapatma finansal işlemler sonuçlandıktan sonra oturumları iptal eder, işlem/audit kayıtlarını fiziksel olarak silmez. Uygulama içi bildirimler API'de saklanır. Firebase/APNs hazır olmadığından uygulama kapalıyken uzaktan push teslimi henüz etkin değildir.
