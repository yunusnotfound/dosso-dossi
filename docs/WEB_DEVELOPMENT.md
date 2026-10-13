# Web geliştirme ortamı

Next.js TR/EN ana sayfa ve mağaza, `/yonetim` ürün paneli ve mevcut backend içinde ayrı web PostgreSQL kataloğu hazırdır. Müşteri e-posta/şifre üyeliği, hesaba bağlı kalıcı sepet, Türkiye teslimat adresleri ve panelden kargo ücretleri yerel kabul kontrolleriyle tamamlandı. Resend etkin değildir: yerel e-posta önizlemesi kullanılır ve gerçek e-posta gönderilmez. Hesaba bağlı test siparişleri, stok rezervasyonu, sipariş paneli ve iyzico sandbox adaptörü eklenmiştir. Gerçek sandbox bağlantısı anahtarlar ve erişilebilir HTTPS dönüş adresi sağlandıktan sonra doğrulanacaktır. Kapsam ve sonraki adımlar: [WEB_PLATFORM_PLAN.md](WEB_PLATFORM_PLAN.md).

## Yerel servisler

| Servis | Adres | Veri |
| --- | --- | --- |
| Next.js | `http://127.0.0.1:4000` | TR/EN kurumsal site, mağaza, `/hesabim`, `/sepet`, `/hesabim/adreslerim`, `/hesabim/siparislerim` ve `/yonetim` |
| Ortak Express backend | `http://127.0.0.1:3000` | Mevcut mobil API ve yeni `/web` API |
| Mobil PostgreSQL | `localhost:5433` | Mevcut `dosso_dossi` veritabanı ve volume |
| Web PostgreSQL | `127.0.0.1:5444` | `dosso_dossi_web` ve ayrı `dosso_dossi_web_test` |

Tek backend iki veritabanına bağlanır. Yerel Docker düzeninde mobil ve web PostgreSQL servisleri de ayrıdır; bu sayede web kurulumu mevcut mobil volume veya rollerini değiştirmez. Yayında iki veritabanı, erişim yetkileri ayrılarak aynı PostgreSQL sunucusunda da barındırılabilir.

## Kurulum

Node.js ve npm kullanılır; katalog testinin TypeScript yüklemesi için Node.js 22.14+ veya 24 gerekir. Docker Desktop çalışıyor olmalıdır. Repo kökünde:

```bash
docker compose --profile web up -d --wait db db-web
```

`web` profili isteğe bağlıdır; yalnız mobil için mevcut `docker compose up -d db` komutu geçerlidir. Web servisi ilk açılışta [init-web.sql](../scripts/postgres/init-web.sql) ile geliştirme ve test veritabanlarını oluşturur. Her biri farklı, superuser olmayan bir kullanıcıya aittir; diğer web veritabanına bağlanamaz. Compose ve örnek ortam dosyalarındaki parolalar yalnız yerel geliştirme içindir.

Mevcut web volume üzerinde başlangıç SQL’ini tekrar uygulamak gerektiğinde:

```bash
docker compose exec -T db-web psql -U dosso_web_admin -d postgres -f /docker-entrypoint-initdb.d/10-web.sql
```

Bu işlem mevcut kayıtları veya rol parolalarını sıfırlamaz. Ortamı durdurmak için `docker compose --profile web stop` kullanılabilir; volume silme komutları kurulumun parçası değildir.

Backend klasöründe:

```bash
cd dosso-dossi-backend
npm ci
```

Mevcut `.env` korunur. İlk kurulumsa `.env.example` dosyasından oluşturulur ve mevcut backend’in zorunlu JWT/admin/webhook sırları doldurulur. Web için aşağıdaki alanlar eklenir; örnek değerler [.env.example](../dosso-dossi-backend/.env.example) içinde bulunur:

- `WEB_ENABLED=true`
- `WEB_DATABASE_URL`: `dosso_dossi_web` veritabanına ait uygulama bağlantısı.
- `WEB_TEST_DATABASE_URL`: yalnız `dosso_dossi_web_test` veritabanına ait test bağlantısı.
- `WEB_DATABASE_POOL_SIZE`: isteğe bağlı havuz sınırı; varsayılan 5.

`DATABASE_URL` mobil bağlantısıdır ve web bağlantısıyla değiştirilmez. `WEB_ENABLED=false` varsayılanında web bağlantısı zorunlu değildir ve `/web` uçları açılmaz. Web açıksa hedef DB’nin mobil DB’den farklı olduğu hem sunucu açılışında hem web migration/seed komutlarında denetlenir; sadece `schema` değiştirmek ayrı DB sayılmaz.

Yalnız web şemasını kurmak için:

```bash
npm run prisma:web:migrate
npm run prisma:web:seed
npm run dev
```

Migration komutu yalnız `prisma/web/migrations` geçmişini uygular; temel mağaza, katalog/yönetici, müşteri üyeliği, sepet/teslimat ve sipariş/sandbox migration’larını içerir. Müşteri aşaması `WebCustomer`, `WebCustomerSession` ve `WebCustomerToken` tablolarını; sepet/teslimat aşaması `WebCart`, `WebCartItem`, `WebDeliveryAddress` ve `WebShippingAudit` tablolarını yalnız web DB’ye ekler. `WebStoreSettings` kargo ücreti, eşik, aktiflik ve sürüm alanlarını taşır. Sipariş aşaması `WebOrder`, `WebOrderItem`, `WebPaymentAttempt` ve `WebOrderAudit` tablolarını ekler. `prisma:web:seed` mevcut mağaza ayarlarını ezmeden başlangıç kaydını ekler; müşteri oluşturmaz. Mobil `prisma/schema.prisma` ve migration geçmişi değişmez; mobil geliştirme veritabanını migrate veya seed etmek web kurulumunun parçası değildir.

Başka bir terminalde:

```bash
cd dosso-dossi-web
npm ci
cp .env.example .env.local   # yalnız dosya henüz yoksa
npm run dev
```

`BACKEND_URL` sunucuya özel ayardır; varsayılan `http://127.0.0.1:3000`. `WEB_ORIGIN` yönetici ve müşteri yazma isteklerinin beklenen tarayıcı origin’idir: yerelde `http://127.0.0.1:4000`; üretimde açıkça verilmesi zorunludur. Bu ayarları `NEXT_PUBLIC_` önekiyle tanımlamayın. Next.js veritabanına doğrudan bağlanmaz ve DB bağlantılarını tarayıcıya göndermez. Hem backend hem Next.js geliştirme sunucusu varsayılan olarak yalnız yerel bilgisayarı dinler.

## Müşteri üyeliği ve yerel e-posta önizlemesi

Hesap ekranları `/hesabim` ve `/en/hesabim` yollarındadır. Aynı ekranda kayıt, giriş, doğrulama bağlantısını yeniden isteme ve şifremi unuttum akışları bulunur. E-posta bağlantıları Türkçe için `/hesabim/dogrula` ve `/hesabim/sifre-yenile`, İngilizce için aynı yolların `/en` önekli karşılıklarını açar.

Backend `.env` dosyasında mevcut yerel seçim:

```dotenv
WEB_EMAIL_MODE=preview
WEB_PUBLIC_URL=http://127.0.0.1:4000
```

`RESEND_API_KEY` ve `WEB_EMAIL_FROM` yerel önizleme için gerekmez. Alan adı/gönderen erişimi henüz sağlanmadığından Resend açılmadı; bu aşamada gerçek gönderim veya teslimat testi yapılmadı. Önizleme modu yalnız geliştirme/test ortamında ve loopback site adresinde çalışır. Mod belirtilmezse sadece `NODE_ENV=development` için `preview`, diğer ortamlarda `disabled` kullanılır.

Uygun bir kayıt veya bağlantı talebi, backend klasöründeki `.local/web-emails/` altında aynı UUID’ye ait `.html` ve `.json` önizlemeleri oluşturur. Klasör izinleri `0700`, dosyalar `0600` değerindedir; Git’e eklenmez ve HTTP üzerinden sunulmaz. Bu dosyalar tek kullanımlık hesap bağlantıları içerir; paylaşılmamalıdır. Son HTML dosyasının yolunu görmek için backend klasöründe:

```bash
npm run web:email:preview
```

Bu komut e-posta göndermez; son HTML dosyasının yerel yolunu yazdırır. Dosyayı açıp içindeki bağlantıya gidilebilir. Bağlantının açılması tek başına doğrulama veya şifre değişikliği yapmaz: kullanıcı son hesap şifresini belirleyip formu gönderir. Token URL fragment’ındadır (`#token=…`), sayfa okuduktan sonra adres çubuğundan kaldırılır. Token tarayıcı depolamasına veya loglara yazılmaz. Sayfa yenilenirse özgün e-posta bağlantısı yeniden açılmalıdır.

Kayıt şifresi 12–128 karakterdir. E-posta sahibi doğrulama ekranında hesabında kullanacağı **son şifreyi** belirler; böylece adresi daha önce başka biri kaydetmiş olsa bile o kişinin bildiği şifre etkinleşmez. Doğrulama bağlantısı 24 saat, sıfırlama bağlantısı 1 saat geçerlidir. Bağlantılar tek kullanımlıktır; bir bağlantı kullanıldığında aynı amaçtaki diğer bağlantılar da iptal edilir. Şifre yenileme tüm müşteri oturumlarını kapatır.

Yalnız aktif ve e-postası doğrulanmış müşteri giriş yapabilir. Oturum süresi 7 gündür; `dosso_web_customer` çerezi HttpOnly, SameSite=Lax ve üretimde Secure’dür. Oturum kaydı/hash’i yalnız web PostgreSQL’de saklanır; mobil müşteri veya web yöneticisi aynı e-posta adresiyle otomatik eşleştirilmez. Hesap ekranı temel profil/doğrulama durumu ile sepet ve teslimat adreslerine bağlantı sunar. Sipariş geçmişi `/hesabim/siparislerim` altındadır; profil düzenleme ve SMS girişi henüz yoktur.

Kayıt/yeniden gönderim/şifremi unuttum istekleri genel `202 {ok:true,delivery:"preview"|"resend"}` yanıtı verir; bu yanıt e-postanın teslim edildiğini veya hesabın varlığını doğrulamaz. Bilinmeyen, pasif ya da işlem için uygun olmayan hesapta önizleme oluşmayabilir. E-posta ve işlem amacı başına 60 saniye bekleme, saatlik 10 talep sınırı vardır; kayıt ve doğrulama yeniden gönderimi aynı sayacı paylaşır. Gönderim hatasında da bekleme uygulanır. Eksik/kapalı e-posta yapılandırması 503 döndürür.

Canlı e-posta daha sonra açıkça etkinleştirilecek. Backend’de `WEB_EMAIL_MODE=resend`, `RESEND_API_KEY`, doğrulanmış gönderici `WEB_EMAIL_FROM` ve HTTPS origin olarak `WEB_PUBLIC_URL`; Next.js tarafında aynı site origin’i için `WEB_ORIGIN` tanımlanmalıdır. Anahtarlar sadece sunucu ortamında kalır. Adaptör Resend gönderim API’sini kullanır; geçici ağ/429/5xx hatalarında aynı gövde ve idempotency anahtarıyla en fazla iki deneme yapar, deneme başına zaman aşımı 5 saniyedir. Sağlayıcı sözleşmesi: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

Gönderim henüz kalıcı iş kuyruğu kullanmaz. Genel yanıt ve bekleme davranışı hesap bilgisini doğrudan açıklamaz; gönderim beklenen ve gönderim yapılmayan yolların sürelerinin tamamen eşit olduğu iddia edilmez. Üretim ölçeklemesinde kalıcı e-posta işi/yeniden deneme düzeni ve ortak rate-limit depolaması ayrıca değerlendirilmelidir.

## Kalıcı sepet ve teslimat adresleri

Sepet `/sepet` ve `/en/sepet`, adres yönetimi `/hesabim/adreslerim` ve `/en/hesabim/adreslerim` yollarındadır. Mağazada ürün incelemek herkese açıktır; sepete eklemek için doğrulanmış müşteri hesabıyla giriş gerekir. Ziyaretçi sepeti veya girişte sepet birleştirme yoktur. Hesaba ait sepet web PostgreSQL’de saklanır; sayfa yenileme, dil değiştirme ve çıkıştan sonra aynı hesaba yeniden giriş sepeti silmez. İstemci depolaması kalıcı veri kaynağı değildir.

Sepette aynı varyant/öğütüm seçimi bir satırda birleştirilir; en fazla 100 farklı satır ve satır başına 99 adet tutulur. Tüm öğütümler aynı varyant stoğunu paylaşır. Fiyat, öğütüm farkı, stok ve kargo her okumada sunucudaki güncel kayıtlardan hesaplanır. Stok düşmüş veya seçenek kullanılamaz olmuşsa satır sessizce kaldırılmaz: uyarı, azaltma ve silme sunulur. Ekleme/artırma stoğu aşamaz; sorunlu satırın adedi azaltılabilir. Sepet stok ayırmaz ve sipariş oluşturmaz.

Her hesap en fazla 10 Türkiye adresi kaydedebilir. Başlık, alıcı, telefon, il, ilçe, mahalle, açık adres ve varsayılan seçimi yönetilir. İl `01–81` listesinden seçilir; ilçe ve mahalle serbest metindir. Telefon Türkiye biçimine (`+90` ve 10 hane) normalleştirilir. Posta kodu isteğe bağlıdır; girilirse 5 haneli olmalı ve il koduyla başlamalıdır. İlk adres varsayılan olur; **sepette teslimat adresi ayrıca seçilir**. Seçili adres düzenlenince sepet sürümü değişir; silinince sepetin adres seçimi kaldırılır.

Sepet/adres yazmaları müşteri kimliğine göre sınırlandırılır, transaction ve sürüm denetimiyle eşzamanlı değişikliklerin üzerine yazması engellenir. Eski sürüm 409 döndürür ve arayüz güncel veriyi yüklemeyi sunar. Adres listesi/yanıtı ve sepet müşteri kimliği içerir; arayüz mevcut oturumla eşleştirir. Giriş/çıkış/şifre yenilemede sekmeler arası oturum bildirimi, gizlenen sayfada özel veriyi gizleme ve yeniden etkinleşince oturum kontrolü uygulanır.

## Panelde kargo ayarları

`/yonetim` içindeki **Kargo ayarları** yalnız `ADMIN` rolüne açıktır; `EDITOR` API’de de reddedilir. Türkiye içi kargo aktifliği, KDV dahil standart TL ücreti ve isteğe bağlı ücretsiz kargo eşiği düzenlenir. Ücretsiz kargo eşiği ürün ara toplamına uygulanır; kargo ücretini içermez ve eşik tutarına eşit sepeti de kapsar.

Ücretler tam kuruş olarak saklanır. Örneğin `42,50` veya `42.50` girişi `4250` kuruş olur. **Boş ücret (`null`) henüz belirlenmemiştir; `0` ücretsiz kargodur.** İlk ayar ücret/eşik `null`, kargo aktif şeklindedir. Ücret bilinmiyorsa veya kargo kapalıysa dolu sepetin kargo ve genel toplamı kesinleştirilmez; geçersiz satır ya da seçilmemiş adres de genel toplamı engeller. Gerçek kargo tarifesi firmadan beklenmektedir; test ücretleri gerçek satış tarifesi değildir.

Ayarlar sürümlenir ve önce/sonra değerleri işlem yapan yöneticiyle denetim kaydına yazılır. Eski sürüm kaydı 409 ile reddedilir; kaydedilmemiş form korunur. Sipariş anındaki kargo ücreti sabitlenir. Panelden kargo firması ve takip numarasıyla hazırlama/gönderme/teslim adımları yönetilir. Taşıyıcı API’si, etiket ve otomatik teslimat takibi henüz yoktur.

## Sipariş oluşturma ve takip

TR/EN `/hesabim/siparislerim` sipariş listesi, `/hesabim/siparislerim/yeni` sepetin son kontrolü ve `/hesabim/siparislerim/:id` sipariş detayıdır. Sepetten son kontrole geçilir; fiyatlar, teslimat adresi ve kargo bir kez daha gösterilir. Test siparişi onayı gerçek satış sözleşmesi kabulü değildir. Siparişler yalnız ayrı web DB’de tutulur.

Sipariş oluşturulunca ürün adları/seçenekleri, fiyatlar, miktarlar, müşteri ve teslimat bilgileri sabitlenir. Sonradan ürün/adres/kargo düzenlemek eski siparişi değiştirmez. Son teklif değişmişse istek reddedilir; aynı istek anahtarının tekrarı ikinci sipariş veya rezervasyon üretmez. Ödeme ayrı bir adımdır. Stok 30 dakika ayrılır; hesap başına en fazla üç açık, ödenmemiş sipariş olabilir. İptal ve süre dolumunda stok bir kez geri verilir. Rezervasyon katalog sürümünü artırır; eski stokla açık bırakılmış yönetim formu sessizce üzerine yazamaz.

Yönetimde **Siparişler** yalnız ADMIN içindir. Sipariş numarası/müşteri arama, sipariş/ödeme/gönderim filtreleri ve sayfalama bulunur. Ödemesi doğrulanmış siparişler sırasıyla hazırlanır, firma/takip numarası girilerek kargoya verilir ve teslim edilir. İşlem notları ve geçmiş yöneticiye aittir; müşteri API’si iç notları göstermez. Ödenmemiş uygun sipariş iptal edilebilir; elle ödendi işaretleme yoktur. Taşıyıcı API’si veya otomatik takip bağlantısı kullanılmaz.

Siparişler sandbox etiketlidir. Anahtarlar henüz yokken sipariş oluşturulur, ödeme “yapılandırma bekliyor” olarak kalır. Kart bilgisi uygulamada toplanmaz. [iyzico sandbox rehberi](WEB_IYZICO_SANDBOX.md) gerekli `.env` alanlarını, HTTPS callback koşulunu ve gerçek sağlayıcı testi sınırını açıklar. Resend halen preview modundadır; sipariş e-postası gönderilmez. İade, canlı tahsilat, e-fatura, webhook ve otomatik ödeme uzlaştırma işi henüz yoktur.

## Yönetici ve başlangıç kataloğu

Panel [http://127.0.0.1:4000/yonetim](http://127.0.0.1:4000/yonetim) adresindedir. İlk yönetici `iletisim@bitirgitsin.com` olarak ayrı web DB’de oluşturuldu. Yerel giriş bilgileri repo kökündeki Git tarafından dışlanan `.local/web-admin-credentials.json` dosyasındadır; parola dokümana veya kaynak koda eklenmez. Bu kurulum e-posta göndermez.

Yeni ortamda yönetici oluşturmak için backend çalışma ortamında `WEB_ADMIN_EMAIL`, `WEB_ADMIN_NAME`, `WEB_ADMIN_PASSWORD` (14–200 karakter) ve isteğe bağlı `WEB_ADMIN_ROLE` (`ADMIN` veya `EDITOR`, varsayılan `ADMIN`) tanımlanır, ardından:

```bash
npm run web:admin:create
```

Kimlik bilgileri CLI argümanı olarak verilmez. Komut mevcut e-posta hesabını veya parolasını ezmez. Mobil `admin:create` komutu web yöneticisi oluşturmak için kullanılmaz.

Projedeki mevcut görsellerden isteğe bağlı örnek katalog eklemek için backend klasöründe:

```bash
npm run prisma:web:seed:catalog
```

Bu ayrı komut bir Türk kahvesi ana ürünü/250 g varyantı ve bir termos ana ürünü/dört renk varyantı ekler. Başlangıç stokları **sıfırdır**, fiyatların örnek olduğu ürün açıklamasında belirtilir. Aynı slug varsa ürüne dokunmaz; tekrar çalıştırmak panelde yapılan değişiklikleri ezmez. Normal mağaza ayarı seed’i ürün eklemez. Satış öncesinde firma ürün/fiyat/stok bilgilerini onaylamalıdır.

## Panelde ürün yönetimi

Ürün ekle/düzenle ekranında TR/EN ad ve açıklama, slug, kahve/termos türü, yayın durumu ve sıralama yönetilir. Varyantlarda SKU, renk, gramaj veya isteğe bağlı hacim, TL fiyatı, stok, aktiflik ve galeri görseli bulunur. Kahveye uygun öğütümler, iki dilde ad ve ek ücretle tanımlanır; stokları gramaj SKU’suyla ortaktır.

Yayın için görsel, İngilizce ad ve aktif varyant gerekir. Taslak/arşiv ürünler mağazada görünmez; stok sıfırsa mağaza “Tükendi” gösterir. Stok düzenlemesi gerekçe ister; yönetici işlem ve stok geçmişi kaydedilir. Eşzamanlı düzenlemede eski ürün sürümü 409 ile reddedilir. Kayıtlı varyant ve öğütümler silinmez, pasif yapılır; ürün arşivlenebilir.

JPG/PNG/WebP görseller en fazla 5 MiB olarak yüklenir; backend gerçek dosya türünü doğrular, tek kareyi en çok 1600×1600 boyuta sığdırıp WebP kaydeder. Galeri sırası, TR/EN alternatif metin ve varyant görseli yönetilir. Dosyalar `dosso-dossi-backend/uploads/web-catalog/` altında, DB kayıtlarından ayrı saklanır. Üretimde bu dizin kalıcı volume/depolamaya bağlanmalı ve web DB ile birlikte yedeklenmelidir; bu yayın yapılandırması henüz yapılmadı.

Yönetici oturumu 12 saatlik HttpOnly cookie kullanır. Next.js yalnız izin verilen `/web/admin` işlemlerini sunucuda iletir; backend ayrı web yönetici oturumunu denetler. Mevcut mobil hesap, veri ve oturumlar aktarılmaz.

## Bağlantıyı doğrulama

```bash
curl --fail http://127.0.0.1:3000/web/health
curl --fail http://127.0.0.1:3000/web/config
curl --fail http://127.0.0.1:3000/web/catalog
curl --fail http://127.0.0.1:4000/api/health
```

Web sağlık kontrolü yalnız TCP bağlantısını değil, web tablosunu ve başlangıç mağaza kaydını da denetler. Migration veya seed eksikse 503 döner. Mevcut mobil `/health` davranışı korunur; web DB arızası mobil sağlık sonucuna eklenmez.

Ana sayfa ve mağaza tasarımları `/`, `/alisveris`, `/en` ve `/en/alisveris` yollarındadır. TR/EN ve mobil uyumludur; mağaza yalnız sandbox test siparişleri oluşturur, gerçek satış yapmaz. Arama motorlarına kapalıdır. HTTP sözleşmesi: [WEB_API_CONTRACT.md](WEB_API_CONTRACT.md).

## Test ve derleme

Backend içinde:

```bash
npm run build
npm run test:web
npm run test:web:integration
```

`test:web` veritabanı gerektirmeyen yapılandırma ve rota testleridir. Entegrasyon testleri `WEB_TEST_DATABASE_URL` ister; yerel, `_test` ile biten ve mobil/web geliştirme DB’lerinden farklı bir hedef olmadan çalışmaz. Mevcut mobil test komutu kendi `TEST_DATABASE_URL` bağlantısını kullanır ve web modülünü kapalı tutar. Test veritabanları yalnız test verisi içermelidir.

Next.js içinde:

```bash
npm run test:catalog
npm run test:admin-boundary
npm run test:customer-boundary
npm run test:commerce-boundary
npm run test:shipping
npm run test:orders-boundary
npm run test:orders
npm run typecheck
npm run build
```

Proxy sınır testleri çalışan yerel Next.js servisini kullanır. Müşteri backend entegrasyon testleri yalnız ayrı web test DB’sindeki yapay hesaplarla ve enjekte edilmiş e-posta taşıyıcısıyla çalışır; gerçek e-posta göndermez. E-posta birim testlerinde Resend ağ çağrıları taklit edilir, yerel önizlemeler geçici özel klasörde üretilip temizlenir. Tarayıcı kabul kontrollerinde de gerçek alıcı adresi yerine yerel test hesabı kullanılmalıdır.

Backend’in `postinstall` ve `build` adımları iki Prisma client’ını ayrı çıktılara üretir. Web client, `node_modules/@dosso-dossi/web-prisma` altında oluşturulur; derlenmiş backend de aynı paketi kullanır. Üretilmiş client veya `node_modules` Git’e eklenmez. Üretim paketleme ileride seçilirken client üretimi ve Prisma motorlarının pakette bulunması korunmalıdır.

## İşletim sınırları

Bu kurulum yereldir; alan adı, Resend, SMS ve iyzico erişimi gerektirmez. Gerçek ödeme veya e-posta gönderimi yapmaz. Veritabanı bağlantıları ve havuzları ayrıdır; backend süreci yine ortaktır. Üretime geçişte TLS, kalıcı dosya depolama, yedekler, uygulama/migration yetkileri ve canlı hizmet sırları ayrıca yapılandırılacaktır.

## İlk kurulum doğrulaması

13 Ekim 2026 tarihinde:

- Backend derlemesi, Next.js derlemesi ve TypeScript kontrolü geçti.
- Web altyapısının 37 birim testi ve gerçek PostgreSQL üzerinde 3 entegrasyon testi geçti.
- Web migration ve seed uygulandı; seed tekrarlandığında mevcut mağaza değerleri korundu.
- Web geliştirme/test kullanıcılarının superuser olmadığı ve birbirlerinin DB’sine bağlanamadığı doğrulandı.
- `/health`, `/web/health`, `/web/config` ve Next.js `/api/health` gerçek servislerle 200 verdi.
- Web PostgreSQL durdurulunca web sağlık/ayar uçları ve Next.js sağlık ucu 503, mobil `/health` 200 verdi. Web DB yeniden açılınca web kontrolleri tekrar 200 verdi.
- Dört başlangıç sayfası HTTP 200, doğru HTML dili ve noindex başlığıyla doğrulandı; tarayıcıda mağaza ve dil bağlantıları kontrol edildi.
- Mevcut mobil geliştirme veritabanına migration/seed uygulanmadı; mobil testler ayrı `dosso_dossi_foundation_test` üzerinde çalıştırıldı.

Mobil test paketinin tamamı yeşil değildir: güncel kodda 222 testin 197’si geçti, 25’i başarısız oldu. Yeni web değişikliklerinden önceki `8d1570b01b215a040a405d544191bd92873e5562` sürümü ayrı `dosso_dossi_foundation_baseline_test` DB’sinde çalıştırıldığında 196 geçti, 26 başarısız oldu. Her iki sürümde `admin/modules` 3, `sync` 9, `orders` 9 ve `webhooks/order-status` 4 hata verdi. Eski sürümün ek hatası, derlemeyi de engelleyen iki eksik idempotency argümanlı finans testi çağrısıydı; yalnız bu test çağrıları mevcut servis sözleşmesine uyarlandı. Mobil iş mantığı değiştirilmedi. Kalan eski test hataları ayrı bakım gerektirir; bu kurulum için tüm mobil testlerin geçtiği iddia edilmez.


## Ana sayfa ve mağaza tasarımı — 13 Ekim 2026

Bu bölüm ilk görsel teslimi kaydeder; statik ürün kaynağı aşağıdaki katalog aşamasında, bellek sepeti ise sepet/teslimat aşamasında web PostgreSQL ile değiştirildi. Bu bölümdeki kalıcılık sınırlamaları o ilk teslimin tarihsel kaydıdır.

Espressolab PDF’lerinin geniş tanıtım alanı, ferah ürün kartları, görsel/metin bölümleri ve mağaza hiyerarşisi Dosso Dossi logosu, sıcak turuncu/krem renkler ve yerel fontlarla uygulandı.

- Ana sayfa: iki manuel tanıtım slaydı, ürün seçkisi, kahve/sanat/birlikte içerikleri, şehirle filtrelenen dört şube, sıcak/soğuk menü seçkisi ve franchising iletişim çağrısı.
- İlk mağaza tasarımı: beş önizleme kartı (250 g Türk kahvesi ve dört renk termos), kategori/arama/sıralama, renk değiştiren ürün diyaloğu, miktar kontrolleri ve önizleme sepeti.
- İlk teslimde sorgu parametreleri kategori/arama ve ürün açılışını destekliyordu; aynı mağaza içindeki filtre, footer ve üst arama geçişleri sepeti koruyordu. Dil/ana sayfa geçişi veya tam yenilemede kalıcılık yoktu; güncel hesap sepetinde bu sınır kaldırılmıştır.
- İlk teslimde sepet yalnız React belleğindeydi; localStorage, ödeme veya sipariş kaydı kullanılmıyordu. O teslimdeki sabit `src/lib/catalog.ts` ürün seçkisi artık kaldırıldı; güncel katalog ve kalıcı sepet kaynağı ayrı web PostgreSQL veritabanıdır.
- Başlangıç ürününde doğrulanmış 250 g paket ve Türk kahvesi öğütümü bulunur. Yeni gramajlar ve ürüne uygun öğütümler artık panelden tanımlanabilir; seed doğrulanmamış seçenek eklemez.
- Yasal bağlantılar revizyon beklediğini açıklar. Tam hukuki metinler, üyelik/Resend, bağımsız kurumsal sayfalar, başvuru formları ve iyzico bu görsel çalışma kapsamında tamamlanmış değildir.
- Eski Dosso Dossi web sitesinin görselleri sayfalarda kullanılmadı. Ürün/marka varlıkları projeden, ana kahve fotoğrafı yeni imagegen üretiminden gelir. Kaynaklar: [WEB_ASSET_SOURCES.md](WEB_ASSET_SOURCES.md).

Doğrulama: `npm run typecheck` ve `npm run build` geçti. Dört rota HTTP 200, doğru `html lang`, H1 ve noindex başlığı döndürdü. Tarayıcıda 1440×1000 masaüstü, 390×844 mobil ve 320×800 dar mobil görünüm kontrol edildi. Görsel yükleme ve yatay taşma kontrolleri; TR/EN geçişi; slayt, hikâye, şehir/menü filtreleri; ürün rengi/miktarı, sepette azaltma/silme/toplam/boş durum; sonuç bulunamadı/sıralama ve sorgu değişiminde sepetin korunması doğrulandı. Mobil menü Escape ile kapanır.

Geliştirme sırasında font/renk değişiklikleri eski HMR çıktısıyla bir hydration uyarısı oluşturdu; geliştirme sunucusu yeniden başlatılıp temiz yükleme ve etkileşim kontrollerinde hata alınmadı. Tasarım değişikliği backend dosyalarını veya veritabanlarını değiştirmedi; eski mobil testler bu görsel aşamada tekrar çalıştırılmadı.

Ekran görüntüleri `output/web-preview/` altında saklanır. Yerel önizleme: http://127.0.0.1:4000/ .


## Katalog/panel doğrulaması — 13 Ekim 2026

- Backend: 37 birim ve ayrı web test PostgreSQL üzerinde 16 entegrasyon testi geçti.
- Frontend: 6 katalog/sepet ve 9 yönetici proxy sınır testi geçti. Aynı SKU’nun farklı öğütümlerdeki sepet toplamı stokla sınırlanır; tutarlar kuruş üzerinden hesaplanır.
- Gerçek servislerde iki yayın ürün/beş aktif varyant TR/EN mağaza ve ana sayfada web DB’den okundu; gerçek WebP görsel proxy’si 200 verdi. Backend kullanılamadığında eski örnek ürünlere dönmek yerine hata/yeniden dene gösterildi.
- Tarayıcıdan iki gramaj, iki öğütüm ve yüklenen WebP ile ürün oluşturma; TR/EN mağazada görünme; kuruş hassasiyetinde fiyat/öğütüm farkı; gerekçeli stok güncelleme ve hareket geçmişi doğrulandı. Kontrol ürünü sıfır stokla arşivlendi ve mağazadan kalktığı görüldü. Panelde bu arşiv kaydı test örneği olarak kalır.
- Termos galerisinin sıralanması ve mevcut renk/görsel bağlantılarıyla kaydetme; eksik alan ve stok nedeni doğrulamaları; giriş/çıkış ve oturum iptali kontrol edildi. Proxy tokenı tarayıcı JSON yanıtından çıkarır; HttpOnly/SameSite=Strict çerezi ve çıkıştan sonra 401 davranışı gerçek servislerle doğrulandı.
- 1440 px masaüstü ve 390 px mobil panel kontrol edildi; mobil tablo kendi içinde yatay kayar, sayfayı taşırmaz. Ekranlar `output/web-preview/admin-*.png` içinde bulunur. Backend ve Next.js üretim derlemeleri, TypeScript kontrolleri geçti.
- Bu katalog aşamasında mobil geliştirme DB’sine yazılmadı. O aşamada müşteri üyeliği/Resend, kargo ayarları, stok rezervasyonu, gerçek sipariş ve iyzico kapsam dışındaydı; müşteri üyeliğinin sonraki ilerlemesi aşağıdadır.

## Müşteri üyeliği doğrulaması — 13 Ekim 2026

Ayrı müşteri tabloları, e-posta/şifre API’si, token/oturum denetimi, yerel e-posta önizlemesi, etkinleştirilmemiş Resend adaptörü ve TR/EN hesap ekranları tamamlandı.

- 74 backend birim testi, ayrı web test PostgreSQL üzerinde 39 entegrasyon testi, 6 katalog/sepet testi, 9 yönetici ve 6 müşteri proxy sınır testi geçti: web kapsamı toplam 134 test. Backend/Next.js üretim derlemeleri ve TypeScript kontrolleri geçti.
- Web müşteri migration’ı yalnız `dosso_dossi_web` veritabanına uygulandı. Mobil geliştirme veritabanı değiştirilmedi; bu aşamada eski mobil test paketi yeniden çalıştırılmadı.
- Gerçek yerel servislerde yapay hesap kaydı ve özel e-posta önizlemesi, doğrulanmamış girişin reddi, şifre belirleyerek doğrulama, token tekrarının reddi, HttpOnly müşteri çerezi ve oturum doğrulandı. Tarayıcı JSON yanıtı oturum tokenı içermez.
- TR/EN şifre yenileme önizlemesi, yeni şifreyle giriş, eski şifre ve tüm eski oturumların reddi, tek kullanımlık reset bağlantısı kontrol edildi. Ön kayıtla hesap ele geçirme, gönderim arızasında bekleme ve eşzamanlı işlemler backend regresyon testleriyle kapsanır.
- Tarayıcıda giriş, sayfa yenilemesinde oturumun korunması, profil, çıkış, şifremi unuttum ve süresi dolmuş oturumdan çıkış kontrol edildi. Doğrulama bağlantısı açılınca token adres çubuğundan temizlendi; dil değişiminde doğrulama formu korundu.
- Altı hesap rotası 200, doğru HTML dili ve `no-referrer` döndürdü. Masaüstü 1440 px, mobil 390 px ve dar mobil 320 px görünümlerde yatay taşma görülmedi. Ekran görüntüleri `output/web-preview/customer-*.png` altındadır.
- Resend kapalı kaldı; gerçek e-posta gönderilmedi. Yerel önizleme komutu oluşturulmuş özel HTML dosyasını buldu. Üyelik teslimi sırasında adresler ve kalıcı sepet henüz yoktu; sonraki aşama aşağıdadır. Canlı e-posta teslimi ve siparişler beklenmektedir.

## Kalıcı sepet, adres ve kargo doğrulaması — 13 Ekim 2026

- 74 backend birim, ayrı web test PostgreSQL üzerinde 63 entegrasyon testi geçti; bunların 24’ü yeni sepet/adres/kargo testidir. Frontend’de 6 katalog, 9 yönetici, 6 müşteri, 6 ticaret proxy sınır ve 5 kargo ücret testi geçti. Güncel web kapsamı toplam **169 otomatik testtir**.
- Backend ve Next.js üretim derlemeleri ile TypeScript kontrolleri geçti. Yeni TR/EN sepet ve adres rotaları derlemeye dahildir.
- Gerçek yerel müşteri çereziyle mağazadan ekleme, miktar düzenleme/silme, yenileme ve yeniden girişten sonra sepet kalıcılığı kontrol edildi. Başka hesaba ait sepet/adres erişimi, sürüm çakışmaları, ortak SKU/öğütüm stoğu ve güncel fiyatlandırma entegrasyon testleriyle kapsanır.
- Tarayıcıda adres oluşturma/düzenleme/varsayılan seçme ve sepet için teslimat adresi seçme çalıştı. TR/EN ve 390 px mobil görünümler, dil değişiminde adres taslağının korunması ve çıkıştan sonra sepette kişisel veri yerine giriş ekranı gösterilmesi kontrol edildi. Dört yeni rota 200, doğru HTML dili ve `no-referrer` verdi; temiz geliştirme sunucusunda yeni kontrol sekmesinin konsolunda hata/uyarı görülmedi.
- Yönetimde geçici **42,50 TL standart ücret / 500 TL ücretsiz kargo eşiği** ile ücret ve eşik davranışı kontrol edildi. Bunlar yalnız test değerleridir; gerçek kargo tarifesi olarak kullanılmaz.
- Kontrol sonrasında ücret ve eşik `null`, kargo aktif olarak geri alındı (ayar sürümü 3). Oluşturulan test adresleri ve sepet satırları temizlendi; yapay kontrol ürünü sıfır stokla arşivlendi.
- Gerçek sipariş, stok rezervasyonu, ödeme, kargo gönderimi veya e-posta gönderimi yapılmadı. Resend önizleme modunda kaldı; mobil geliştirme veritabanına yazılmadı.

## Sipariş ve sandbox doğrulaması — 14 Ekim 2026

- Backend’de **157 birim testi** (83 iyzico adaptör testi dahil) ve ayrı web test PostgreSQL üzerinde **86 entegrasyon testi** (23 yeni sipariş testi dahil) geçti. Son tam PostgreSQL çalışması 86/86 başarılıdır. Bir önceki yoğun paralel giriş sınırı testinde geçici bağlantı zaman aşımı oluştu; aynı testin ve tam paketin yeniden çalışması geçti.
- Frontend’de 6 katalog, 9 yönetici sınır, 6 müşteri sınır, 6 sepet/adres sınır, 5 kargo, 6 sipariş sınır ve 5 ödeme yönlendirme/hata testi geçti. Güncel toplam **286 otomatik web testi**. Backend/Next.js üretim derlemeleri ve TypeScript kontrolleri geçti.
- `20261014030000_web_orders` migration’ı yalnız `127.0.0.1:5444/dosso_dossi_web` üzerinde uygulandı. Mobil veritabanına migration, seed veya iş verisi yazılmadı.
- Testler değişmiş teklif, tekrarlı/eşzamanlı oluşturma, iki hesabın son stok yarışı, farklı öğütümlerin ortak stoğu, eski yönetici stok formu, rezervasyon varken stok üst sınırı, tek seferlik iptal/süre iadesi ve yeniden başlatmada yarım kalmış ödeme başlatmasını kapsar.
- Taklit sağlayıcıyla doğrulanmış ödeme → hazırlama → kargoya verme → teslim, tekrar/sırasız callback, bozuk imza/tutar, fraud incelemesi, geç ödeme, yetki ayrımı ve iç notların gizlenmesi doğrulandı. Bunlar gerçek iyzico bağlantı testi değildir.
- Gerçek yerel servislerle tarayıcıdan son kontrol ve test siparişi oluşturuldu. Sepet boşaldı, stok 8’den 6’ya düştü, toplam 293,50 TL olarak saklandı. Eksik sandbox yapılandırması ödeme başlatmayı reddetti. Yenileme, TR/EN geçişi, geçmiş/detay, 390 px mobil, yönetici arama/filtreleri ve notlu iptal kontrol edildi. İptal stoğu 6’dan 8’e geri verdi.
- Altı yeni sipariş rotası HTTP 200, doğru HTML dili, noindex ve no-referrer verdi. Mobilde sayfa yatay taşmadı; yönetim tablosu kendi alanında kayar. Kontrol sekmesinin konsolunda hata/uyarı yoktu. Müşteri çıkışından sonra sipariş numarası/e-posta gösterilmedi.
- Kontrol siparişi iptal edilmiş deneme kaydı olarak saklandı. Geçici ürün sıfır stokla arşivlendi; test adresi temizlendi. Kargo aktif, ücret/eşik tekrar `null` bırakıldı (sürüm 5). Gerçek ödeme, e-posta, kargo gönderimi veya dış ortam yayını yapılmadı.
- Ekranlar `output/web-preview/order-review-desktop.png`, `order-detail-desktop.png`, `order-detail-en-mobile.png`, `orders-list-en-mobile.png`, `orders-admin-list-mobile.png`, `order-admin-detail-mobile.png` ve `order-admin-desktop.png` altında saklanır. Görünen fiyat/ürün/adresler yapay kabul testi verileridir.
