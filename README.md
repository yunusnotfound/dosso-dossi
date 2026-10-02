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
Yayın derlemesinde de ayar dosyasını aktarın:

```bash
flutter build apk --dart-define-from-file=dart_defines.json
flutter build ios --dart-define-from-file=dart_defines.json
```

## Dokümanlar

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST API sözleşmesi
- [docs/KERZZ_POS_ENTEGRASYON.md](docs/KERZZ_POS_ENTEGRASYON.md) — POS entegrasyon planı
- [docs/ROADMAP.md](docs/ROADMAP.md) — yol haritası

- [docs/RELIABILITY_WORK.md](docs/RELIABILITY_WORK.md) — bağımsız düzeltmeler, test izolasyonu, veri geçişi ve bakım kararları
