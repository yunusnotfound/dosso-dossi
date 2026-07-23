# Dosso Dossi Coffee

Kahve zinciri için sadakat + sipariş platformu (monorepo).

```
├── dosso-dossi-app/       # Flutter mobil uygulaması (iOS + Android)
├── dosso-dossi-backend/   # Node.js + Express + Prisma + PostgreSQL REST API
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
npm test                         # vitest + supertest (dosso_dossi_test DB)
```

Geliştirme modunda OTP kodu konsola yazılır; `111111` her zaman geçerlidir.

### Flutter uygulaması

```bash
cd dosso-dossi-app
flutter pub get
flutter run                                  # gerçek API ile (localhost:3000, varsayılan)
flutter run --dart-define=USE_MOCKS=true     # mock veriyle (backend gerekmez)
flutter test                                 # testler kendiliğinden mock modunda çalışır
```

Android emülatöründe `--dart-define=API_BASE_URL=http://10.0.2.2:3000` ekleyin.

## Dokümanlar

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — REST API sözleşmesi
- [docs/KERZZ_POS_ENTEGRASYON.md](docs/KERZZ_POS_ENTEGRASYON.md) — POS entegrasyon planı
- [docs/ROADMAP.md](docs/ROADMAP.md) — yol haritası
