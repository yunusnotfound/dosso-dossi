# Dosso Dossi — Yönetim Paneli

Backend'in `/admin` route ağacıyla konuşan React SPA. Mobil uygulamanın görsel
kimliğini taşır; renk/köşe token'ları `src/theme/tokens.css`'te toplanır ve
`dosso-dossi-app/lib/core/theme/app_colors.dart` ile birebir aynıdır.

## Çalıştırma

```bash
npm install
npm run dev            # http://localhost:5173 (port sabit: backend allowlist'i)
```

Backend'in `.env`'inde şunlar gerekli:

```
ADMIN_JWT_SECRET=...            # JWT_SECRET'tan FARKLI olmalı
ADMIN_ORIGINS=http://localhost:5173
```

İlk yöneticiyi backend tarafında oluştur:

```bash
cd ../dosso-dossi-backend
npm run admin:create -- eposta@ornek.com "Ad Soyad"
```

## Test

```bash
npm run typecheck
npm run build
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run e2e      # gerçek Chrome ile uçtan uca
```

`e2e/smoke.mjs` sistemde kurulu Chrome'u kullanır (ayrı tarayıcı indirmez).
Giriş, hatalı şifre reddi, dashboard içeriği, oturum kalıcılığı ve çıkışı
doğrular; `--headed` ile tarayıcıyı görünür çalıştırır.

## Mimari

- `src/theme/` — tema token'ları. **Ekran kodlarına ham renk yazılmaz.**
- `src/api/client.ts` — fetch sarmalayıcı. Access token 15 dk; 401'de refresh
  ile bir kez yenilenip istek tekrarlanır. Eşzamanlı 401'ler tek yenilemede
  buluşur (kuyruk) — aksi halde her istek ayrı rotasyon başlatır ve rotasyon
  zinciri reuse tespitine takılırdı.
- `src/auth/` — oturum durumu; refresh de reddedilirse oturum düşer.
- `src/routes/AppShell.tsx` — koyu kahve sidebar + korumalı içerik alanı.
- `src/features/` — modül başına sayfa (dashboard, ileride siparişler, menü…).

Sidebar'da pasif görünen modüller yol haritasının sonraki fazları.
