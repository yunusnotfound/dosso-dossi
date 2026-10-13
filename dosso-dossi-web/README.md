# Dosso Dossi web

Yerel geliştirme için native Next.js App Router, TypeScript ve React başlangıç projesi. Bu aşamada yalnız Türkçe/İngilizce ana sayfa, mağaza başlangıç sayfası ve backend bağlantısı vardır. Ürünler, üyelik, sepet, ödeme ve yönetim paneli sonraki aşamalardır.

## Çalıştırma

Node.js 24 LTS önerilir; Next.js en az Node.js 20.9 gerektirir.

```bash
cd dosso-dossi-web
npm ci
cp .env.example .env.local
npm run dev
```

Uygulama yalnız `127.0.0.1:4000` üzerinde dinler. Backend, `http://127.0.0.1:3000` adresinde çalışmalı ve web modülü etkin olmalıdır. Backend kurulumu için [ana depo README](../README.md) ve [proje planına](../docs/WEB_PLATFORM_PLAN.md) bakın. `BACKEND_URL` yalnız sunucuda okunur; `NEXT_PUBLIC_` öneki kullanılmaz. Next.js veritabanına doğrudan bağlanmaz.

| Adres | İşlev |
| --- | --- |
| `/` | Türkçe ana sayfa |
| `/alisveris` | Türkçe mağaza başlangıcı |
| `/en` | İngilizce ana sayfa |
| `/en/alisveris` | İngilizce mağaza başlangıcı |
| `/api/health` | Backend `/web/health` kontrolü; hazırsa 200, aksi halde 503 |
| `/robots.txt` | Tüm taramaları engelleyen yerel önizleme kuralı |

Sayfalar backend’den yalnız sabit `/web/config` yolunu okur. Backend kapalıysa marka başlangıç sayfaları görüntülenmeye devam eder; `/api/health` sağlıklı yanıt vermez. Sağlık kontrolü backend yanıtını üç saniye içinde bekler; bağlantı sorunu, hata HTTP durumu veya beklenmeyen yanıt 503 üretir. Her iki backend isteği de önbelleksizdir. İstemcinin gönderdiği bir URL veya hedef yol üzerinden proxy yapılmaz.

Dil geçişi aynı sayfanın karşılığına gider; HTML `lang` değeri ve metadata yerelleştirilir. Her sayfa robots metadata ve `X-Robots-Tag` ile indekslemeye kapalıdır. Yayına geçişte bu kurallar kontrollü biçimde değiştirilecektir. Uzak font, eski kurumsal site görseli veya üçüncü taraf takip kodu yoktur.

## Kontroller

```bash
npm run typecheck
npm run build
npm start
```

`npm start` da yalnız `127.0.0.1:4000` adresinde çalışır. `.env.local`, `.next` ve `node_modules` Git’e eklenmez. Bağımlılıklar `package-lock.json` ile sabitlenir. Bu proje için alan adı, bulut kayıt veya yayın işlemi yapılmadı.
