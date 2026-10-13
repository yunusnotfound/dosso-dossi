# Dosso Dossi — Kod Tabanı Değerlendirmesi

- **İnceleme tarihi:** 12 Ekim 2026
- **İncelenen dal:** `main`
- **İncelenen commit:** `9885dfaeaa3c26cca4fef64ca1dec26c03f6e19c`
- **Kapsam:** Flutter mobil uygulama, TypeScript backend, React yönetim paneli, testler ve yayına hazırlık.
- **Belgenin amacı:** Mevcut durumun, doğrulanan sorunların ve önerilen çalışma sırasının sonraki geliştirmelerde kullanılabilecek bir kaydını tutmak.
- **Durum:** Bu belge bir inceleme kaydıdır. Aşağıdaki sorunlar bu çalışma kapsamında düzeltilmemiştir.

> **Genel değerlendirme:** Projenin mimari temeli iyi; mevcut yapıyı koruyarak geliştirmeye devam etmek mantıklı. Baştan yazmayı gerektiren bir durum görmüyorum. Ancak mevcut sürümün gerçek para ve müşteri verisiyle üretime açılmasını önermiyorum. Öncelik; geliştirme sağlayıcılarının üretimde çalışmasını engellemek, derleme ve testleri düzeltmek, finansal işlemlerdeki belirli yarış koşullarını kapatmak ve yayın sürecini güvenilir hâle getirmek olmalı.

## 1. Ürünün mevcut kapsamı

Uygulama; bir kahve zincirinin müşteri hesabı, cüzdan/bakiye, sadakat, hediye, şubeden teslim siparişleri ve yönetim paneli ihtiyaçlarına odaklanıyor. Bu kapsam için Flutter + Express/TypeScript + Prisma/PostgreSQL + React yönetim paneli tercihi uygun.

iyzico ve Kerzz entegrasyonlarının tamamlanması için müşteriden ve sağlayıcılardan bilgi beklendiği biliniyor. Bu entegrasyonların henüz tamamlanmamış olması, tek başına beklenmeyen bir kusur olarak değerlendirilmedi. İncelemede kritik bulunan konu, gerçek sağlayıcılar hazır değilken geliştirme amaçlı sağlayıcıların üretim ayarları altında da başarılı işlem üretebilmesi.

Talep edilen kurumsal web sitesi ve e-ticaret mağazası ayrıca ele alınmalı. Mevcut mobil mağaza ve sepet yapısı, kargolu fiziksel ürün satışının tüm ihtiyaçlarını karşılamıyor. Üyelik, katalog ve yönetim panelinin uygun parçaları yeniden kullanılabilir; adres, stok miktarı, ürün varyantları ve kargo/sipariş yaşam döngüsü için ayrı bir e-ticaret modülü tasarlanmalı.

## 2. İnceleme yöntemi ve sınırları

Backend, mobil uygulama ve yönetim paneli statik olarak incelendi. Mevcut derleme, analiz ve test komutları çalıştırıldı. Özellikle ödeme, bakiye, sadakat, tekrar deneme, yetkilendirme ve webhook akışları üzerinde duruldu.

- Git güncellemesinden sonra yerel bağımlılıkların kodla uyumsuz olduğu görüldü. Sonuçlar raporlanmadan önce backend ve yönetim panelinde kilit dosyaları esas alınarak `npm ci --no-audit --no-fund`, backend tarafında da `npx prisma generate` çalıştırıldı.
- Backend testleri gerçek müşteri veritabanına bağlanmadan, yalnızca yerel makineye açılan geçici bir PostgreSQL 17 veritabanında çalıştırıldı. İnceleme sonunda geçici veritabanı konteyneri kaldırıldı.
- Kritik bulgulardan ödeme sağlayıcısı ve POS yeniden işleme yarışı, izole veritabanında çalıştırılarak yeniden üretildi. POS imza sorunu, gerçek middleware ve şemalarla bellek içi bir kontrol üzerinden doğrulandı.
- Mobil hediye tekrar deneme bulgusu, kod akışının incelenmesine dayanıyor; cihaz üzerinde uçtan uca yeniden üretilmiş bir hata olarak sunulmuyor.
- Yönetim panelinin tarayıcı testleri HTTP yanıtlarını taklit ediyor; gerçek backend ile uçtan uca entegrasyonu doğrulamıyor.
- Canlı iyzico/Kerzz bağlantısı, gerçek cihazlarda sürüm kabul testi, üretim yük testi ve kapsamlı sızma testi yapılmadı.
- Uygulama kaynak kodunda düzeltme, bağımlılık sürümü yükseltmesi veya yayın işlemi yapılmadı.

Bu belge belirtilen commit için geçerlidir. Dosya ve satır referansları sonraki değişikliklerde kayabilir. Bağlantılar, belge depo içinde taşınabilir kalsın diye göreli verilmiştir.

## 3. Güçlü taraflar

### 3.1 Mimari ve sorumluluk ayrımı

Proje yalnızca ekranlardan oluşan bir prototip değil. Backend tarafında özelliklere göre ayrılmış modüller; mobil tarafta veri, uygulama ve sunum katmanları ile repository sınırları bulunuyor. Riverpod ve GoRouter kullanımı bu yapıyla uyumlu. Mevcut ürün için modüler tek backend yaklaşımı yeterli; mikroservislere geçiş veya kapsamlı yeniden yazım gerekmiyor.

### 3.2 Finansal işlem güvenilirliği için iyi bir temel

Bakiye işlemlerinde kullanıcı satırı kilitleme, tutarlı kilit sırası, koşullu bakiye düşümü, Decimal/kuruş hassasiyeti ve veritabanı transaction kullanımı bulunuyor. Bakiye hareketleriyle ilişkili kayıtların aynı işlem içinde tutulması doğru bir yaklaşım.

Kalıcı idempotency kayıtları, normalize edilmiş istek içeriği doğrulaması, işlem sonucu şemaları ve webhook olay kayıtları düşünülmüş. İade ve geri alma akışlarında sonradan gerçekleşen sadakat değişikliklerini hesaba katan kayıtlar da var. Bunlar olumlu mühendislik kararları; aşağıdaki belirli açıklar, bütün finansal tasarımın eksik olduğu anlamına gelmiyor.

### 3.3 Kimlik doğrulama ve yetkilendirme

Yönetici ve müşteri oturumları ayrılmış. JWT audience kontrolleri, veritabanından güncel rol ve token sürümü kontrolü, hash'lenmiş ve döndürülen refresh token'lar, token ailesini iptal etme, Argon2, atomik OTP kullanımı ve şube kapsamı kontrolleri mevcut. Geçici yönetici şifresinde süre ve zorunlu değiştirme akışı da bulunuyor.

İncelenen akışlarda yaygın bir rol kontrolü atlatma sorunu tespit edilmedi. Bu tespit kapsamlı bir güvenlik sertifikasyonu anlamına gelmez; POS imzasına ilişkin somut bulgu ayrıca aşağıda yer alıyor.

### 3.4 Mobil oturum ve sipariş davranışları

Token'ların güvenli depolanması, eşzamanlı yenileme isteklerinin birleştirilmesi ve eski oturuma ait geç yanıtların engellenmesi iyi düşünülmüş. Sepette fiyat ve kullanılabilirlik değişiklikleri ele alınıyor. Sonucu kesinleşmeyen sipariş girişiminin korunması özellikle değerli; aynı yaklaşımın hediye akışına da taşınması gerekiyor.

Fiyat, bakiye, ikram ve çalışma saati kararlarının backend tarafından verilmesi doğru. Ağ kesintisi, eşzamanlılık, fiyat değişimi, hesap işlemleri ve görsel davranışlar için anlamlı testler de var. Sorun testlerin yokluğu değil; bir kısmının mevcut sözleşmelerin gerisinde kalmış olması.

## 4. Öncelikli bulgular

Öncelikler: **P1**, canlı kullanıma geçmeden giderilmesi gereken yüksek öncelikli sorunu; **P2**, belirli koşullarda ortaya çıkan ancak güvenlik veya finansal doğruluk açısından önemli sorunu ifade eder. Bu projede aşağıdaki P2 bulguları da gerçek para akışları açılmadan kapatılmalıdır.

### R1 — P1: Geliştirme sağlayıcıları üretim ayarlarında da çalışıyor

**Etkisi:** Gerçek ödeme alınmadan müşteri bakiyesi artabilir. POS'a gerçekte iletilmeyen bir işlem iletilmiş gibi işaretlenebilir. SMS gönderimi yerine OTP içeren mesaj log'a yazılabilir.

**Kod kanıtı:**

- [dev-payment-provider.ts](../dosso-dossi-backend/src/features/wallet/payments/dev-payment-provider.ts), satır 11–19: ödeme başlatma başarılı sonuç döndürüyor; dışa aktarılan sağlayıcı doğrudan `DevPaymentProvider`.
- [env.ts](../dosso-dossi-backend/src/config/env.ts), satır 19 ve üretim doğrulamaları: `PAYMENT_PROVIDER` ayarı bulunuyor ancak gerçek sağlayıcı seçimini güvenceye almıyor; geliştirme ödeme sağlayıcısı üretimde engellenmiyor.
- [topup.service.ts](../dosso-dossi-backend/src/features/wallet/payments/topup.service.ts), satır 48–86: ayardaki sağlayıcı adı kayda yazılırken çağrılan nesne sabit geliştirme sağlayıcısı olabiliyor.
- [pos-client.ts](../dosso-dossi-backend/src/features/orders/pos-client.ts), satır 24–31 ve 51: geliştirme POS istemcisi, gerçek dış çağrı olmadan iletim zamanını güncelliyor ve sabit olarak dışa aktarılıyor.
- [dev-sms-provider.ts](../dosso-dossi-backend/src/lib/sms/dev-sms-provider.ts), satır 6–12: gönderim yerine telefon ve mesaj içeriğini log'luyor; sabit geliştirme sağlayıcısı kullanılıyor.

**Doğrulama:** İzole veritabanında geçerli üretim ayarları, güçlü sentetik sırlar ve HTTPS origin kullanılarak `NODE_ENV=production`, `PAYMENT_PROVIDER=iyzico` ile çalıştırıldı. Gerçekte kullanılan sınıf yine `DevPaymentProvider` oldu. Gerçek ödeme gerçekleşmeden bakiye **0 TL'den 100 TL'ye** yükseldi. Ödeme kaydı sağlayıcıyı `iyzico`, referansı ise `dev_...` olarak tuttu.

**Öneri:** Sağlayıcı seçimi açık ve doğrulanan bir eşleştirme üzerinden yapılmalı. Üretimde gerçek sağlayıcı eksikse ilgili işlem veya uygulama başlangıcı güvenli biçimde reddedilmeli. Geliştirme sağlayıcıları yalnızca geliştirme/test ortamında kullanılabilmeli. Üretim ayarlarıyla sahte başarılı sonuç üretilemediğini doğrulayan test eklenmeli.

### R2 — P1: Backend derlemesi başarısız; testler güncel sözleşmelerle uyumsuz

**Etkisi:** İncelenen commit, mevcut standart backend derleme komutuyla derlenemiyor. Bu durum güvenilir ve tekrarlanabilir bir yayın sürecini engelliyor.

**Kod kanıtı:**

- [financial-integrity.test.ts](../dosso-dossi-backend/src/features/orders/financial-integrity.test.ts), satır 90: iki `adjustBalance` çağrısında zorunlu beşinci parametre olan `idempotencyKey` eksik.
- [customers.service.ts](../dosso-dossi-backend/src/features/admin/customers.service.ts), satır 209–214: güncel fonksiyon imzası bu parametreyi gerektiriyor.
- [tsconfig.json](../dosso-dossi-backend/tsconfig.json): test dosyaları da derleme kapsamına giriyor.

**Doğrulama:** Bağımlılıklar ve Prisma istemcisi güncellendikten sonra `npm run build`, aynı satırdaki iki çağrı için **iki TS2554 hatasıyla** başarısız oldu.

**Öneri:** Test çağrılarını güncel sözleşmeyle uyumlu hâle getirmek ve geçerli, senaryoya uygun idempotency anahtarları sağlamak gerekiyor. Gerekirse uygulama ve test derleme yapılandırmaları ayrılabilir; ancak testlerin tip kontrolünü devre dışı bırakmak çözüm olarak görülmemeli. Derleme ve ilgili testler her değişiklikte otomatik çalışmalı.

### R3 — P2: POS olayını yeniden kuyruğa alma yarışı sadakat ödülünü iki kez uygulayabiliyor

**Etkisi:** Belirli bir eşzamanlılıkta aynı POS satışı tekrar işlenerek müşteriye ikinci kez sadakat ödülü kazandırabiliyor.

**Kod kanıtı:**

- [pos-monitor.service.ts](../dosso-dossi-backend/src/features/admin/pos-monitor.service.ts), satır 101–121: olay önce `FAILED` durumunda okunuyor; sonraki güncellemede mevcut durum koşulu olmadan `RECEIVED` yapılıyor.
- [pos-events.service.ts](../dosso-dossi-backend/src/features/webhooks/pos-events.service.ts): eşzamanlı webhook tekrar denemesi aynı olayı işleyip `PROCESSED` durumuna getirebiliyor.
- [kerzz-sale.service.ts](../dosso-dossi-backend/src/features/webhooks/kerzz-sale.service.ts), satır 28–33: ilave mükerrer işlem kontrolü ilişkili bir `PosCharge` bulunduğunda devreye giriyor. QR ile müşteriyle ilişkilendirilmiş nakit/kart satışları bu korumadan aynı şekilde yararlanmıyor.

**Doğrulanan sıra:**

1. Yönetici yeniden işleme akışı olayı `FAILED` olarak okuyor.
2. Aynı sırada webhook tekrar denemesi satışı başarıyla işliyor ve olayı `PROCESSED` yapıyor.
3. Yönetici akışı eski okumasına dayanarak durumu tekrar `RECEIVED` yapıyor.
4. Aynı `saleId` ile gelen sonraki tekrar mükerrer sayılmadan işlenebiliyor.

**Doğrulama:** Bu sıra izole veritabanında kontrollü olarak yeniden üretildi. Durum `PROCESSED` sonrasında `RECEIVED` oldu; sonraki işleme `duplicate=false` döndü ve ödül sayısı **1'den 2'ye** çıktı.

**Öneri:** Yeniden kuyruğa alma, mevcut durumun hâlâ `FAILED` olduğunu koşul olarak içeren atomik bir güncelleme yapmalı veya uygun satır kilidi kullanmalı. Etkilenen satır sayısı kontrol edilmeli. Aynı satışın ödül etkisinin bir kez uygulanacağını güvenceye alan eşzamanlılık testi eklenmeli.

### R4 — P2: POS HMAC imzası işlem türüne ve URL'deki hedefe bağlı değil

**Etkisi:** Bir uç nokta için üretilmiş geçerli imzalı istek, başka bir POS işlemi için de doğrulanabiliyor. İmza gövdenin değişmediğini doğruluyor ancak hangi işlemin ve hangi hedefin yetkilendirildiğini tam olarak kapsamıyor.

**Kod kanıtı:**

- [pos-auth.ts](../dosso-dossi-backend/src/middleware/pos-auth.ts), satır 39–43 ve 60–68: imza zaman damgası ve ham gövde üzerinden hesaplanıyor; HTTP metodu ve URL yolu imzaya dahil değil.
- [pos.routes.ts](../dosso-dossi-backend/src/features/pos/pos.routes.ts), satır 28–40: iptal edilecek `chargeId`, URL içinde taşınıyor.
- [pos.schemas.ts](../dosso-dossi-backend/src/features/pos/pos.schemas.ts), satır 11–14: iptal şeması ek alanları ayıklayarak ödeme gövdesini de kabul edebiliyor.

**Doğrulama:** Gerçek middleware ve şemalarla, sentetik bir ortak sır kullanılarak yapılan bellek içi kontrolde `/pos/charge` için imzalanan gövde hem ödeme yolunda hem `/pos/charge/<hedef>/void` yolunda imza ve şema doğrulamasından geçti. Gerçek bir hedef işlemin uçtan uca iptali bu kontrolün kapsamında değildi.

**Koşul:** Bu, herhangi bir kişinin imzasız istekle işlem yapabildiği anlamına gelmiyor. Senaryo için geçerli imzalı bir isteğe ve hedef işlem kimliğine erişim gerekiyor; istek zaman penceresi içinde kullanılmalı. İncelenen uygulamada bu pencere beş dakika.

**Öneri:** İmzaya HTTP metodu ve standartlaştırılmış URL yolu eklenmeli veya imzalı gövdede açık işlem türü ve hedef kimliği bulunmalı. Gövde şemaları beklenmeyen alanları reddetmeli. Bir yol için imzalanan isteğin başka işlemde reddedildiği test edilmeli.

### R5 — P2: Sonucu belirsiz hediye işleminin tekrarında ikinci tahsilat riski var

**Etkisi:** İlk hediye işlemi sunucuda tamamlanıp yanıt istemciye ulaşmadığında, değişmiş içerikle yapılan tekrar ikinci hediye ve ikinci bakiye düşümü oluşturabilir.

**Kod kanıtı:**

- [gift_controller.dart](../dosso-dossi-app/lib/features/gift/application/gift_controller.dart), satır 158–175: hediye, o anki değerlerle gönderiliyor; sonucu belirsiz ilk girişimin içeriği sabitlenmiyor.
- [gift_screen.dart](../dosso-dossi-app/lib/features/gift/presentation/gift_screen.dart), satır 96–111: hata sonrasında gönderme durumu sıfırlanıyor ve yeniden deneme mümkün oluyor. Satır 187–191 civarında seçili ürün canlı katalog verisiyle yenilenebiliyor.
- [mutation_intents.dart](../dosso-dossi-app/lib/core/network/mutation_intents.dart), satır 58–65: kalıcı idempotency kaydı istek içeriğine bağlı.
- [api_gift_repository.dart](../dosso-dossi-app/lib/features/gift/data/api_gift_repository.dart), satır 44–50: beklenen tutar ve not istek içeriğine dahil.
- [gifts.service.ts](../dosso-dossi-backend/src/features/gifts/gifts.service.ts), satır 27–56: backend tekrar korumasını verilen anahtar üzerinden yapıyor; yeni anahtar yeni işlem olarak değerlendirilebiliyor.

**Olası senaryo:** İlk işlem tamamlanır, yanıt ağda kaybolur. Arada katalog fiyatı değişir veya kullanıcı notu düzenler. Kullanıcı başarısız sandığı işlemi yeniden dener. Değişen içerik yeni idempotency anahtarı oluşturur; ilk işlemle ilişki kurulamadığından ikinci tahsilat gerçekleşebilir.

**Kanıt düzeyi:** Kod akışından çıkarılan bulgu. Mobil cihaz ve backend birlikte çalıştırılarak uçtan uca yeniden üretilmedi. Aynı içerik ve aynı anahtarla yapılan sıradan tekrarların her durumda çift tahsilat oluşturduğu iddia edilmiyor.

**Öneri:** Sonucu belirsiz hediye girişiminin anahtarı ve içeriği korunmalı; önce ilk girişimin sonucu netleştirilmeli. Mevcut [cart_controller.dart](../dosso-dossi-app/lib/features/order/application/cart_controller.dart) içindeki `_unconfirmedAttempt` yaklaşımı buna örnek alınabilir. Yanıt kaybı ile katalog/not değişimini birlikte kapsayan test eklenmeli.

## 5. Çalıştırılan kontroller ve sonuçları

| Alan | Kontrol | Sonuç |
| --- | --- | --- |
| Backend | `npm run build` | Başarısız — aynı satırdaki iki çağrıda eksik parametre nedeniyle 2 TS2554 hatası |
| Backend | `npm test` | 222 test: **196 başarılı, 26 başarısız**; 19 dosya: 14 başarılı, 5 başarısız |
| Yönetim paneli | `npm run typecheck` | Başarılı |
| Yönetim paneli | `npm run lint -- --deny-warnings` | Başarılı |
| Yönetim paneli | `npm run build` | Başarılı |
| Yönetim paneli | `npm run test:regression` | Başarısız — giriş fixture'ları güncel profil şemasıyla uyumsuz |
| Yönetim paneli | `npm run test:stories` | Başarısız — `/auth/me` fixture'ı güncel profil şemasıyla uyumsuz |
| Flutter | `flutter analyze --no-pub` | Sorun bildirilmedi |
| Flutter | `flutter test --no-pub` | 77 test: **74 başarılı, 3 başarısız** |
| Backend ve yönetim paneli | `npm audit --omit=dev` | İnceleme anında üretim bağımlılıkları için bilinen güvenlik açığı raporlanmadı |

### 5.1 Backend: 26 başarısız test nasıl yorumlanmalı?

Bu sonuç **26 ayrı ürün hatası bulunduğu anlamına gelmiyor**. İncelenen başarısızlıkların dağılımı:

| Test dosyası | Başarısız test | İncelemede belirlenen neden |
| --- | ---: | --- |
| `financial-integrity.test.ts` | 1 | Güncel `adjustBalance` çağrılarında zorunlu idempotency anahtarları eksik |
| `admin/modules.test.ts` | 3 | Toplu fiyat ve bakiye işlem fixture'larında yeni zorunlu idempotency anahtarları eksik |
| `sync/sync.test.ts` | 9 | İki testte eksik anahtar; diğerlerinde doğrudan `AuditLog` eklemenin revizyon artıracağı varsayılıyor, oysa revizyon güncellemesi `audit()` yardımcı akışında yapılıyor |
| `orders/orders.test.ts` | 9 | Sabit `12:30` teslim saati ve sabitlenmemiş gerçek saat; inceleme sırasında geçmiş saat kontrolüne takılıyor |
| `webhooks/order-status.test.ts` | 4 | Aynı sabit teslim saati nedeniyle sipariş oluşturma aşamasından yayılan başarısızlıklar |

Saat bağımlı testler iş saatlerini ve tarihi açıkça kontrol etmeli. Fixture'lar güncel API sözleşmesine uyarlanmalı. Testler düzeltildikten sonra yeniden çalıştırılmadan bütün başarısızlıkların giderildiği varsayılmamalı.

### 5.2 Yönetim paneli: görülen giriş hatası gerçek girişin bozuk olduğunu göstermiyor

[Profil şeması](../dosso-dossi-admin/src/api/schemas.ts), satır 10–17, `mustChangePassword` ve `tempPasswordExpiresAt` alanlarını zorunlu tutuyor. [regression.mjs](../dosso-dossi-admin/e2e/regression.mjs), satır 32–35, içindeki dört profil ve [stories.mjs](../dosso-dossi-admin/e2e/stories.mjs), satır 53, içindeki profil bu alanları içermiyor. Gerçek backend bu alanları döndürüyor.

Gerçek şema ve fixture nesneleri bellek içinde birlikte doğrulandı: mevcut nesneler başarısız olurken yalnızca `mustChangePassword: false` ve `tempPasswordExpiresAt: null` eklenmesi dört giriş fixture'ının şemadan geçmesini sağladı. Kaynak dosyalar değiştirilmedi.

Ayrıca `stories.mjs` satır 158'deki yükleme çağrısı eski `upload(path, blob)` biçiminde. [API istemcisindeki](../dosso-dossi-admin/src/api/client.ts) güncel imza `upload(schema, path, file)` olduğu için ilk engel giderildikten sonra bu çağrı da güncellenmeli.

### 5.3 Flutter: üç hata revizyon senkronizasyonu testlerinde

Başarısızlıklar [revision_sync_test.dart](../dosso-dossi-app/test/revision_sync_test.dart) içindeki üç testte. Testler üç saniyelik ilerlemeyle sabit sorgulama davranışı bekliyor. [Güncel uygulama](../dosso-dossi-app/lib/core/sync/revision_sync.dart) ise varsayılan 15 saniyelik aralık, bir dakikalık azami normal aralık ve beş dakikaya kadar hata geri çekilmesi kullanıyor.

Bu sonuç tek başına gerçek senkronizasyonun çalışmadığını göstermiyor. Testlerin zamanlama sözleşmesi güncellenmeli ve sahte saatle doğrulanmalı.

### 5.4 Bağımlılık taramasının anlamı

`npm audit --omit=dev` sonucunun temiz olması olumlu, ancak yalnızca inceleme anında bilinen ve tarayıcının raporladığı üretim bağımlılığı açıklarını kapsıyor. İş mantığı, yapılandırma, yetkilendirme veya finansal doğruluk sorunlarını dışlamıyor.

## 6. Ek teknik ve operasyonel işler

### 6.1 Bekleyen ödeme kayıtları için sonuç uzlaştırma

[topup.service.ts](../dosso-dossi-backend/src/features/wallet/payments/topup.service.ts) mevcut girişim için veritabanındaki sonucu döndürüyor. Kayıt oluşturma, sağlayıcı çağrısı ve sonucun kaydı arasında süreç kesilirse `PENDING` durumunda kalan işlemleri sağlayıcıdan sorgulayarak sonuçlandıran bir akış görülmedi.

Gerçek iyzico entegrasyonunda webhook'a ek olarak sağlayıcıdan durum sorgulama, güvenli tekrar deneme ve yaşlanmış bekleyen işlemlerin ele alınması gerekir. Bu yalnızca müşteri ekranı konusu değil: bekleyen ödeme kaydı hesap kapatma işlemini de engelleyebiliyor. Bu gözlem statik incelemeye dayanıyor; gerçek sağlayıcıyla hata senaryosu test edilmedi.

### 6.2 Hediye geçmişinin yenilenmesi

Hediye geçmişi sağlayıcısı bellekte tutuluyor ve temel olarak ilk yükleme/hata akışlarında yenileniyor. Başka cihazda oluşan hediye sonrasında bakiyenin güncellenip hediye listesinin eski kalabileceği bir durum var. Ekrana dönüş ve uygulamanın ön plana gelmesi sırasında yenileme davranışı netleştirilmeli. Bu da statik inceleme gözlemidir.

### 6.3 Otomatik kontrol ve yayın süreci

İncelenen checkout içinde izlenen bir `.github` CI iş akışı görülmedi. Depo dışındaki servisler veya GitHub ayarları hakkında doğrulanmış bir yargı bulunmuyor.

Backend derleme/test, panel tip kontrolü/lint/derleme ve mobil analiz/test adımları tek bir tekrarlanabilir yayın kontrolü içinde çalışmalı. Başarısız kontroller varken üretim yayını engellenmeli. Test kapsamından çok, mevcut anlamlı testlerin gerçekten geçmesi ve sürekli çalışması öncelikli.

### 6.4 Gözlemlenebilirlik, yedekleme ve sürüm yönetimi

Mobildeki [app_telemetry.dart](../dosso-dossi-app/lib/core/diagnostics/app_telemetry.dart), satır 61–74, ağırlıklı olarak yerel geliştirici log'una ve sınırlı bellek içi kayda dayanıyor. Üretimde kişisel veri ve sırları ayıklayan merkezi hata takibi gerekir.

Ayrıca ödeme/webhook hata oranları, uzun süre bekleyen işlemler ve sipariş iletim sorunları için ölçüm ve uyarılar; veritabanı yedeğinden geri dönüş denemesi; sürüm geri alma ve veri migrasyonu prosedürü hazırlanmalı. Bu süreçlerin kodda görülmemesi, işletme tarafında kesinlikle hiç bulunmadıkları anlamına gelmez; yayına hazırlıkta somut olarak doğrulanmaları gerekir.

### 6.5 Bakım kolaylığı

Bazı mobil ekran dosyaları büyük ve birden fazla sorumluluğu bir arada taşıyor. Özellikle sepet, hediye ve QR ödeme ekranlarında parçalara ayırma bakım maliyetini düşürebilir. Ancak bu, finansal doğruluk ve üretim sağlayıcısı sorunlarından önce gelecek bir yeniden yapılandırma işi değil.

## 7. Önerilen çalışma sırası

### Aşama 1 — Üretimde hatalı başarı sonuçlarını engelle

- [ ] Üretimde geliştirme ödeme/POS/SMS sağlayıcılarını engelle.
- [ ] Gerçek sağlayıcı eksik veya ayarları geçersizse güvenli hata davranışı tanımla.
- [ ] Üretim yapılandırmasıyla sahte bakiye yüklenemediğini test et.

**Tamamlanma ölçütü:** Eksik entegrasyon yanlış başarılı sonuç veya parasal hareket oluşturamıyor.

### Aşama 2 — Derleme ve testleri güvenilir hâle getir

- [ ] Eksik idempotency anahtarlarını ve değişen API fixture'larını düzelt.
- [ ] Saat bağımlı testlerde tarihi ve saati kontrol altına al.
- [ ] Senkronizasyon testlerini güncel davranışa uyarla.
- [ ] Backend, panel ve mobil kontrolleri tekrar çalıştır; kalan gerçek hataları ayır.

**Tamamlanma ölçütü:** Temiz kurulumdan sonra derleme ve ilgili test komutları tutarlı biçimde geçiyor.

### Aşama 3 — Finansal ve güvenlik bulgularını kapat

- [ ] POS yeniden kuyruğa alma güncellemesini atomik durum koşuluyla koru.
- [ ] POS imzasını işlem türüne ve hedefe bağla.
- [ ] Sonucu belirsiz hediye girişimini anahtarı ve içeriğiyle koru.
- [ ] Üç bulgu için hedefli regresyon/eşzamanlılık testleri ekle.

**Tamamlanma ölçütü:** Doğrulanan senaryolar artık sorunu üretmiyor; mobil hediye senaryosu da uçtan uca doğrulanıyor.

### Aşama 4 — Yayın ve işletme hazırlığını tamamla

- [ ] Otomatik derleme, analiz ve test kontrollerini yayın sürecine bağla.
- [ ] Merkezi hata takibi ve kritik işlem uyarılarını kur.
- [ ] Yedekten geri dönüş ve sürüm geri alma denemelerini yap.
- [ ] Gerçek cihazlarda oturum, QR, sepet, hediye ve ağ kesintisi kabul testlerini tamamla.

**Tamamlanma ölçütü:** Hatalar görülebiliyor, veri kurtarma denenmiş ve yayın süreci tekrarlanabilir durumda.

### Aşama 5 — Gerçek entegrasyonlar ve kabul testleri

- [ ] Sağlayıcı bilgileri geldikten sonra gerçek iyzico, Kerzz ve gerekli SMS bağlantılarını tamamla.
- [ ] Başarılı/başarısız/yarım kalan ödeme, yinelenen callback, gecikmiş webhook ve iade senaryolarını doğrula.
- [ ] Bekleyen işlemleri sağlayıcı kayıtlarıyla uzlaştıran akışı tamamla.
- [ ] Müşteriyle kontrollü kabul testi yap.

**Tamamlanma ölçütü:** Para ve sadakat hareketleri gerçek sağlayıcı kayıtlarıyla tutarlı; kesinti ve tekrar durumlarında aynı iş etkisi ikinci kez oluşmuyor.

Bu sıralama teknik önceliği gösterir; entegrasyon bilgileri erken gelirse bağımsız çalışmalar paralel yürütülebilir. Süre veya maliyet taahhüdü değildir.

## 8. Sonuç

Proje, üzerine yatırım yapılabilecek bir temele sahip. Özellikle finansal işlem kayıtları, oturum yönetimi ve mobil sipariş güvenilirliği için iyi kararlar alınmış. En fazla değer yaratacak çalışma, yeni ekranlar eklemek veya mimariyi değiştirmekten önce mevcut iş akışlarını üretim koşullarında güvenilir hâle getirmek.

**Önerim: mevcut mimariyi koru; önce sağlayıcı seçimi, derleme/test disiplini ve finansal doğruluk açıklarını kapat. Ardından gerçek entegrasyonlar ve operasyonel hazırlık tamamlandığında kontrollü canlı kullanıma geç.**

İlgili mevcut belgeler: [API sözleşmesi](API_CONTRACT.md), [güvenilirlik çalışmaları](RELIABILITY_WORK.md), [Kerzz entegrasyonu](KERZZ_POS_ENTEGRASYON.md), [yol haritası](ROADMAP.md), [önceki değerlendirme](PROFESSIONAL_REVIEW_2026_10.md). Bu kayıt, önceki belgelerdeki tamamlanma durumlarını değiştirmez.
