# Dosso Web: tek VPS üzerinde yayın ve kurtarma

Bu çalışma bir yayın altyapısı hazırlığıdır; sunucuya deploy yapmaz. Ödeme, Kerzz/POS ve SMS bağlantıları açılmaz. Web ödeme akışı hâlâ yalnız sandbox destekler. `WEB_VISIBILITY=public` arama motoru görünürlüğüdür, gerçek ödeme anahtarı değildir.

## Mevcut uygulamayı bozmayan süreç ayrımı

- `dosso-dossi-backend`: `npm run dev:web` yalnız `/web` API'sini dinler. Tam katalog, müşteri, panel ve sipariş API'sidir; salt okunur katalog önizlemesi değildir. İstekle yapılan gerçek yazmalar mümkün olduğundan inceleme sırasında hesap/sipariş oluşturmayın.
- `WEB_HOST=127.0.0.1`, `WEB_PORT=3000`. `WEB_ENABLED=true` ve ayrı web DB gerekir. Başka süreç aynı portu kullanıyorsa onu rastgele kapatmayın; doğru servisi belirleyin veya ayrı port ve eşleşen `BACKEND_URL` kullanın.
- `src/web-index.ts` mobil/POS rotalarını ve mobil ödeme/POS görevlerini başlatmaz. `WEB_ORDER_MAINTENANCE=false` varsayılandır. Sadece web rezervasyon süresi temizliği istenirse açıkça `true` seçilir. Bu iş mevcut web siparişlerini değiştirebilir.
- Mail dispatch worker otomatik başlamaz. Mevcut doğrulama/şifre e-postaları istekle çalışır; dış gönderim için ayrıca geçerli mail yapılandırması gerekir. Yerelde `WEB_EMAIL_MODE=preview`, üretimde yapılandırılana kadar `disabled` kullanın.
- Ortak backend `src/config/env.ts` kontrolleri korunur; web entry bunları atlamaz. Üretim ayarları eksikse süreç kapanır. Mobilde çalışan `.env` dosyasını web için değiştirmek yerine web servisine ayrı `/etc/dosso/backend.env` verin. Gerçek ödeme desteği eklenmeden bu değerleri satış başlatmak için kullanmayın.

## VPS yerleşimi

Ubuntu/Debian üzerinde Node24 LTS, PostgreSQL17 istemci/sunucu, Caddy ve systemd kullanılır. PostgreSQL sürümünü mevcut DB ile uyumlu tutun. Tek makinede bile mobil ve web farklı veritabanı ve uygulama kullanıcısıyla çalışmalı. Web uygulama rolü yalnız web DB yetkilerine sahip olmalı; migration sahibi daha yetkili ayrı rol olabilir.

```text
/srv/dosso/releases/<commit>/       doğrulanmış uygulama sürümü
/srv/dosso/current -> releases/...  çalışan sürüm
/srv/dosso/shared/uploads/web-catalog/  kalıcı görseller
/srv/dosso/backups/                 özel, host dışına da kopyalanacak yedekler
/etc/dosso/web.env                  web origin/preview/backend URL
/etc/dosso/backend.env              DB ve backend sırları
```

`dosso` ayrı servis kullanıcısı olmalı. Env dosyaları `root:dosso`,0640; yedekler0700/0600 olmalı. Sırlar Git'e ve komut satırı argümanlarına girmemeli. Her sürümün `dosso-dossi-backend/uploads` yolu `/srv/dosso/shared/uploads` dizinine sembolik bağlantı olmalı. İlk taşıma sırasında mevcut `uploads/web-catalog` içeriğini doğrulayarak kalıcı alana kopyalayın; boş bir dizinle eski görsellerin üzerine geçmeyin.

Yalnız SSH ve80/443 dışarı açık olur. PostgreSQL,3000,4000 portları internete açılmaz. SSH anahtarı kullanın. Caddy'nin `DOSSO_DOMAIN` değeri onaylı domainle, Next `WEB_ORIGIN` ve backend `WEB_PUBLIC_URL` tam aynı HTTPS originle eşleşmeli. www veya alternatif host kullanılıyorsa tek canonical domaine yönlendirin; CSRF origin kontrolünü gevşetmeyin.

## Doğrulama, kurulum, sürüm değiştirme

1. Mevcut DB ve medyanın doğrulanmış yedeğini alın. Yeni sürümü ayrı `releases/<commit>` klasöründe hazırlayın; çalışan dizinde `next build` çalıştırmayın.
2. Backend'de `npm ci` → `npm run typecheck` → `npm run test:web` → `npm run build`; web'de `npm ci` → `npm run typecheck` → `npm run build`. Güvenlik kontrolü: iki dizinde de `npm audit --audit-level=high`. CI `.github/workflows/web-checks.yml` aynı kontrolleri otomatikleştirir; DB entegrasyonları ayrıca izole test DB'de çalıştırılır.
3. Web build sırasında `/etc/dosso/web.env` ile aynı `WEB_ORIGIN`, `WEB_VISIBILITY`, `BACKEND_URL` ortamını sağlayın. Next header config build çıktısına girer; sadece servis env'ini değiştirmek yeterli değildir. İlk sürüm `WEB_VISIBILITY=preview` kalır.
4. DB migration dosyalarını gözden geçirin. Önce ayrı test/staging DB ve yedekten dönüş provası; sonra **ayrı bir operatör adımı olarak** `npm run prisma:web:migrate`. Bu runbook migration,seed veya katalog sıfırlama çalıştırmaz. Mevcut üretim DB'ye seed uygulamayın.
5. `ops/web/*.service` şablonlarında gerçek Node yolu ve dizinleri doğrulayın. Backend upload symlink'ini, `.next/cache` dizinini ve izinlerini hazırlayın. `ops/web/Caddyfile.example` domainini yapılandırın. Caddy config'i validate edin; systemd servislerini kurmak/yeniden başlatmak yayın adımıdır.
6. Yeni sürümü uygun zamanda `current` symlink'ine alın; web API ve Next servislerini yeniden başlatın. `scripts/ops/web-health.sh` iki readiness kontrolü yapar. Ardından kullanıcı hesabı, ürün/öğütüm/renk, sepet, panel görseli ve sandbox sipariş smoke testlerini test hesabıyla yapın. Test müşteri/siparişini gerçek raporlardan ayrı tutun.
7. Hata varsa kodu önceki release'e döndürün. **DB'yi düşünmeden geri almayın:** yeni migration eski kodla uyumlu değilse önce yazmaları durdurup onaylı DB kurtarma planını uygulayın. Şema değişikliklerini geriye uyumlu aşamalara bölmek kesintiyi azaltır.

systemd örnekleri `ProtectSystem=strict` ile yalnız kalıcı uploads/Next cache alanına yazma izni verir. Başka yerel çıktı kullanan yeni özellik eklenirse en dar dizin iznini ayrıca tanımlayın. Test e-posta önizlemesini üretime açmayın. Caddy tüm backend'i yayınlamaz; ödeme callback ingress'i sağlayıcı entegrasyonu tamamlandığında ayrıca değerlendirilir.

## Arama motorlarına açılış

`WEB_VISIBILITY` belirtilmezse veya `preview` ise bütün sayfalar noindex, robots.txt tamamen kapalı ve sitemap boş kalır. Public mod geçerli gerçek HTTPS `WEB_ORIGIN` ister. Public modda yalnız açıkça tanımlanan sayfa ve ürün rotaları index açar; hesap, sepet, API, panel, yeni/onaysız politika rotaları noindex kalır.

Onaylı içerikler, gerçek iletişim/şube bilgileri, hukuki metinler ve operasyon kontrolleri tamamlanınca `WEB_VISIBILITY=public` ile yeniden build/restart yapın. HTTPS yanıtında canonical/hreflang/OG, robots.txt, sitemap.xml ve private-route noindex kontrol edin. Search Console doğrulama ve sitemap bildirimi domain sahibi tarafından yapılır. İndeksleme ayarı hiçbir ödeme özelliğini etkinleştirmez.

Franchise/CEO eski bağlantıları yeni sayfalara308 yönlenir. Public ürün verisi değişirse ürün sayfaları/sitemap güncelliği izlenmeli. Politika sayfaları onaylanmadan sitemap'e eklenmemeli.

## Yedekleme ve geri yükleme provası

`scripts/ops/web-backup.sh`, `pg_dump` özel formatında web DB'yi ve medyayı tek timestamp klasörüne alır; SHA256 manifest ve ancak başarı halinde COMPLETE işareti yazar. `PGSERVICE` bağlantı profili ve `PGPASSFILE` kullanır; parola argümanda/logda görünmez. Ayrı web backup rolü için ihtiyaç duyulan tablo/sequence okuma yetkilerini DBA belirlemeli. `.pg_service.conf`/`.pgpass`0600 olmalı; şifreyi bu belgeye yazmayın.

```sh
export PGSERVICE=dosso_web_backup
export WEB_MEDIA_ROOT=/srv/dosso/shared/uploads/web-catalog
export WEB_BACKUP_DIR=/srv/dosso/backups
scripts/ops/web-backup.sh
scripts/ops/web-restore-check.sh /srv/dosso/backups/SEÇİLEN_YEDEK
```

Günlük DB+medya yedeği başlangıçtır; kaybedilebilecek sipariş süresine göre PostgreSQL WAL/PITR gerekir. Yedekler kişisel veri içerir: şifreli, erişimi kısıtlı **farklı bir host/sağlayıcıya** kopyalayın. Örnek saklama politikası7 günlük +4 haftalık +3 aylık; işletme veri saklama kararıyla kesinleştirin. Betik otomatik silme yapmaz. Harici kopyalama başarısını izleyin; aynı VPS diski tek yedek değildir.

Geri yükleme betiği varsayılan yalnız checksum ve arşiv formatını doğrular. Gerçek prova için önceden oluşturulmuş **boş ve adı `_restore_test` ile biten** ayrı DB ve yeni boş medya hedefi gerekir. Üretim DB adı veya içinde tablo bulunan DB reddedilir. Yalnız güvenilir kendi yedeklerinizi restore edin; SQL dump kod içerebilir.

```sh
export PGSERVICE=dosso_web_restore
export PGDATABASE=dosso_web_restore_test
export RESTORE_MEDIA_DIR=/srv/dosso/restore-test-media-YYYYMMDD
scripts/ops/web-restore-check.sh /srv/dosso/backups/SEÇİLEN_YEDEK --restore-test
```

Ürün/müşteri/sipariş adetlerini, örnek fiyat ve stok kayıtlarını, görsel dosyalarını kontrol edin. İzole API'yi bu DB'ye bağlayarak read-only smoke test yapın; mail ve bakım görevleri kapalı kalmalı. Prova tarihini ve geri dönüş süresini kaydedin. Üretim kurtarmasında önce yazmaları durdurun, hasarlı durumu da yedekleyin; doğrulanan restore DB+medyaya kontrollü cutover yapın. Bu betik üretim verisini silmez veya otomatik yönlendirmez.

## İzleme ve kabul koşulları

- `/api/health` ve backend `/web/health`200: DB, migration ve store kaydı hazır. Bu tek başına mail/ödeme/şube doğruluğunu kanıtlamaz.
- Uptime izlemesini60sn aralıkla kurun;3 ardışık hatada görevli kişiye alarm. Dış servise alarm gönderimi burada yapılandırılmaz.
- systemd yeniden başlama sayısı,5xx/süre, disk/DB bağlantısı/CPU/RAM, TLS bitişi, yedek+host dışı kopya yaşı izlenmeli. Yapılandırılmış backend logları journal'da tutulur; token/query/body loglamayın.
- Browser CSP önce report-only olarak Console/raporlama aracıyla izlenir. Frame koruması şimdiden enforce edilir. Rapor endpoint'i ve saklama politikası ayrıca seçilmeden raporların sunucuda toplandığı varsayılmamalı.
- En az düşük/orta sınıf Android ve iPhone Safari'de kurumsal sayfa, ürün, sepet ve isteğe bağlı3D kontrolü; düşük bağlantıda normal mağazaya geçiş; gerçek ölçülen LCP/INP/CLS sonuçları kaydedilmeli.
- Kod kontrollerinin geçmesi gerçek satış onayı değildir: domain, firma tarafından onaylı metinler, kargo tarifesi, gönderen domaini, ödeme/callback/iade operasyonu işletme tarafından tamamlanmalı.

Bu turda deploy, gerçek mail, canlı ödeme, üretim migration veya üretim restore yapılmadı. Sonradan kontrol sonuçları ve kullanılan sürüm/commit bu belgeye eklenebilir.
