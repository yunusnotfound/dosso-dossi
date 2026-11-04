# Dosso Dossi web

Next.js App Router, TypeScript ve React ile Türkçe/İngilizce kurumsal site ve web mağazası. Kurumsal içerik, isteğe bağlı 3D mağaza, ürün detayları, müşteri hesabı, sepet, adresler, sandbox siparişleri ve yönetim paneli bulunur. Web müşteri ve veritabanı mobil uygulamadan ayrıdır.

**Yayın durumu: önizleme.** Gerçek satış/ödeme açılmış değildir. `WEB_VISIBILITY=public` yalnız onaylı public sayfaların arama motoru görünürlüğünü açar; ödeme, Kerzz/POS, SMS veya e-posta sağlayıcısını etkinleştirmez. Onaylı hukuki metinler, domain/sunucu ayarları ve dış entegrasyon kabul testleri tamamlanmadan bu ayarı canlı ticaret onayı saymayın.

## Çalıştırma

Node.js 24 LTS önerilir; Next.js en az Node.js 20.9 gerektirir.

```bash
cd dosso-dossi-web
npm ci
cp .env.example .env.local
npm run dev
```

Uygulama yalnız `127.0.0.1:4000` üzerinde dinler. Backend, `http://127.0.0.1:3000` adresinde çalışmalı ve web modülü etkin olmalıdır. Backend dizininde `npm run dev:web` yalnız `/web` API'sini başlatır; mobil/POS endpoint ve görevleri başlamaz. Web sipariş bakım görevi varsayılan kapalıdır; gerçek mail için ayrıca açık sağlayıcı yapılandırması gerekir. Backend kurulumu için [ana depo README](../README.md) ve [yayın runbook'una](../docs/WEB_PRODUCTION_RUNBOOK.md) bakın. `BACKEND_URL` yalnız sunucuda okunur; `NEXT_PUBLIC_` öneki kullanılmaz. Next.js veritabanına doğrudan bağlanmaz. Tarayıcıda `WEB_ORIGIN` ile aynı adresi kullanın; `localhost` ve `127.0.0.1` CSRF açısından farklı originlerdir.

| Adres | İşlev |
| --- | --- |
| `/` | Türkçe ana sayfa |
| `/alisveris` | Ürün kataloğu |
| `/urun/[slug]` | Paylaşılabilir ürün detayı |
| `/sanal-magaza` | İsteğe bağlı 3D mağaza |
| `/hesabim`, `/sepet` | Web müşteri hesabı ve sepet |
| `/yonetim` | Web mağazası yönetimi |
| `/en` | İngilizce ana sayfa |
| `/en/alisveris` | İngilizce katalog; public sayfaların `/en` karşılıkları bulunur |
| `/api/health` | Backend `/web/health` kontrolü; hazırsa 200, aksi halde 503 |
| `/robots.txt`, `/sitemap.xml` | Önizlemede tüm taramalar kapalı, sitemap boş; onaylı public modda açık sayfalar ve yayımlı ürünler |

Public veri yalnız sabit backend yollarından okunur; oturumlu işlemler ayrı ve sınırlı proxy'lerden geçer. Yazmalar aynı-origin JSON kontrolüne, gövde sınırına ve ilgili oturuma tabidir. Backend kapalıysa kurumsal içerik kalır; ana sayfanın katalog bölümü ayrı Suspense sınırında yüklenir ve hata durumu gösterir. `/api/health` hazır olmayan backend/DB için503 üretir. İstemcinin seçtiği URL'ye serbest proxy yapılmaz.

Dil geçişi aynı sayfanın karşılığına gider; HTML `lang`, canonical, hreflang ve paylaşım metadata'sı yerelleştirilir. `WEB_VISIBILITY` varsayılan `preview` değerinde tüm sayfalar indekslemeye kapalıdır. Public mod gerçek HTTPS `WEB_ORIGIN` ister ve yeniden build gerektirir. Hesap, sepet, API, panel ve henüz onaylanmamış hukuki sayfalar kapalı kalır. Frame koruması enforce edilir; geniş CSP önce report-only olarak gözlemlenir. Uzak font veya üçüncü taraf takip kodu eklenmemiştir.

## Kontroller

```bash
npm run typecheck
npm run build
npm start
# Yerel sunucu çalışırken; sınır testleri başarılı sipariş/başvuru göndermez:
node --experimental-strip-types --test scripts/*.test.mjs
```

`npm start` da yalnız `127.0.0.1:4000` adresinde çalışır. Çalışan dev sunucusuyla aynı `.next` dizininde build/typegen çalıştırmayın; dev'i durdurun veya ayrı release dizini kullanın. `.env.local`, `.next` ve `node_modules` Git'e eklenmez. CI tanımı [.github/workflows/web-checks.yml](../.github/workflows/web-checks.yml) içindedir. Kalıcı görseller, DB/medya yedekleri, test geri yükleme ve tek VPS servis şablonları [runbook'ta](../docs/WEB_PRODUCTION_RUNBOOK.md) açıklanır. Bu değişiklikler tek başına domain kaydı, bulut deployment veya canlı satış başlatmaz.
