# Dosso Dossi VPS işletimi

API, yönetim paneli ve PostgreSQL ayrı bir Docker Compose projesidir. Varsayılan
proje adı `dosso-dossi`; veri volume'ları `dosso-dossi_pgdata` ve
`dosso-dossi_uploads` olur. PostgreSQL dışarı açılmaz. API `127.0.0.1:13100`,
panel `127.0.0.1:13101` üzerinde dinler. Panelin `/api/` yolu API'ye gider;
mobil uygulama da sabit HTTPS alan adının `/api` adresini kullanabilir.

Başlangıç sınırları toplam **1 vCPU / 1600 MiB RAM**'dir. Limitler `.env.production`
içinden değiştirilebilir. Migration çalışırken API ve panel durdurulur; eski
servislerle ikinci bir tam uygulama kopyası çalıştırılmaz. İmajlar GitHub'da
üretilir; VPS üzerinde build yapılmaz. Diğer Compose projeleri durdurulmaz.

SMS, ödeme ve POS sağlayıcıları henüz gerçek entegrasyon içermez. Bu kurulum
`SMS_PROVIDER=disabled`, `PAYMENT_PROVIDER=disabled`, `POS_PROVIDER=disabled`
kullanır. İlgili işlemler hizmet hazır değil yanıtı verir; sahte tahsilat,
SMS gönderimi veya POS siparişi üretilmez. Gerçek müşteri işlemleri açılmadan
bu entegrasyonlar tamamlanmalıdır.

## İlk kurulum

Gerekenler: Linux, Docker Engine ve Compose v2, Bash, `flock`, `curl`, `python3`,
`sha256sum`, `sudo`; dış erişim için mevcut HTTPS reverse proxy. Portları,
disk/RAM kapasitesini ve mevcut Docker ağlarını önce kontrol edin.

`install-host.sh` aynı proje adına ait durmuş container'ları, volume'ları ve
ağları da kontrol eder; mevcut `dosso-dossi` kaynakları varsa kurulum yapmaz.
Başka bir dizinden oluşturulmuş eski verilerin yanlışlıkla devralınması önlenir.

Dosyaları sunucuda aşağıdaki düzene yerleştirin:

```text
/opt/dosso-dossi/
  deploy/compose.production.yml
  deploy/compose.ingress.yml       # Yalnız gerekiyorsa, bu sunucuya özgü
  deploy/scripts/*.sh
  shared/.env.production          # root:root 0600
  shared/release.env              # Son sağlıklı imajlar, script üretir
  shared/previous-release.env
  shared/pending-migration.env    # Sürmekte olan/uzlaştırılmamış migration
  backups/
```

`deploy/` ve scriptleri **root:root** sahibi, dizinleri `0755`, scriptleri `0755`
yapın. `shared/` ve `backups/` dizinleri `root:root 0700` olmalıdır. CI için
oluşturulan SSH kullanıcısı bu dosyalara yazamamalı ve `docker` grubunda
olmamalıdır. `.env.example` dosyasını `shared/.env.production` konumuna
`0600` izinle kopyalayın. Her sırrı ayrı ayrı `openssl rand -hex 32` ile üretin;
örnek değer bırakmayın. Dosya shell tarafından `source` edilmez; `ANAHTAR=deger`
biçimini kullanın. Veritabanı parolası URL içinde kullanıldığı için hex olmalıdır.

`ADMIN_ORIGINS` tam HTTPS panel origin'i, portlar sunucuda kullanılmayan
loopback portları olmalıdır. `TRUST_PROXY` yalnız güvenilen reverse proxy
IP/CIDR'larını içermelidir. Dış proxy istemciden gelen `X-Forwarded-For`
başlığını güvenilir istemci IP'siyle değiştirmelidir. Panel gateway'i bu IP'yi
API'ye tek değer olarak aktarır.

Mevcut Caddy başka Docker projesindeyse `compose.ingress.yml.example` dosyasını
bu sunucuda `compose.ingress.yml` olarak kopyalayın ve ağ adını doğrulayın.
Örnek yalnız paneli mevcut `edge` ağına `dosso-dossi-admin` alias'ı ile bağlar;
Caddy hedefi `dosso-dossi-admin:8080` olur. DB/API bu ortak ağa katılmaz.
Scriptler bu yerel override dosyasını otomatik ekler. Proxy yapılandırmasını
doğrulayıp mevcut servisi yeniden başlatmadan reload edin.

## GitHub Actions ve kısıtlı SSH

Workflow API testlerini, panel tarayıcı testlerini ve Flutter analiz/testlerini
çalıştırır. Başarılı `main` revizyonundan Linux/amd64 imajları GHCR'a tam commit
SHA etiketiyle gönderilir. `DEPLOY_ENABLED=true` otomatik yayını açar; elle
çalıştırmada `deploy=true` seçimi aynı kontrollerden sonra yayın yapar.

GitHub `production` environment veya repository secrets:
`VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `VPS_SSH_KNOWN_HOSTS`.
Repository variables: `DEPLOY_ENABLED`, gerekiyorsa `VPS_PORT` (varsayılan 22).
Host key'i güvenilir mevcut SSH bağlantısından doğrulayın; CI host key
kontrolünü kapatmaz. Registry erişimi her çalıştırmanın kısa ömürlü
`GITHUB_TOKEN` değeriyle sağlanır ve VPS'te kalıcı saklanmaz.

`ssh-receiver.sh` dosyasını root sahibi `/usr/local/sbin/dosso-dossi-ssh`
konumuna kurun. Deployment public key satırına şu kısıtı ekleyin:

```text
restrict,command="/usr/local/sbin/dosso-dossi-ssh" ssh-ed25519 PUBLIC_KEY
```

Bu anahtar yalnız `deploy <40-haneli-commit-SHA>` kabul eder. `sudoers` yalnız
bu kullanıcıya `/opt/dosso-dossi/deploy/scripts/release.sh` komutunu root olarak,
parolasız çalıştırma izni vermelidir; `env_reset` açık, `SETENV` izni kapalı
kalmalıdır. `visudo -cf` ile doğrulayın. Receiver SHA biçimini tekrar kontrol
eder; key'e shell, port forwarding veya genel Docker erişimi vermeyin.

Yetkili release scripti devralınan Docker context/host, Compose ve dosya yolu
override değişkenlerini temizler; yalnız yerel `/var/run/docker.sock` ile çalışır.

Release akışı: imajları indir → yalnız Dosso API/paneli durdur → DB+medya
yedeği al → `prisma migrate deploy` → health kontrolleri → yeni `release.env`
dosyasını kaydet. İlk kurulumda önceki uygulama yoksa yedek adımı atlanır.
Seed her deploy'da çalışmaz; paneldeki içerik korunur.

İlk kurulumda, **yalnız boş ve yeni veritabanında**, sunucu root shell'inde:

```bash
cd /opt/dosso-dossi
source deploy/scripts/common.sh
compose run --rm --no-deps -T api node dist/prisma/seed.js
compose run --rm --no-deps -T api node dist/prisma/seed-admin.js admin@example.com 'Yönetici'
```

İkinci komut yalnız bir kez geçici şifre gösterir; bu çıktıyı CI loguna veya
Git'e koymayın. `seed.js` mevcut ürün/şube/kampanyaları güncelleyebilir;
çalışan işletmede tekrar çalıştırmayın.

## Yedek ve başka VPS'e geçiş

```bash
sudo /opt/dosso-dossi/deploy/scripts/backup.sh
```

Bu işlem yalnız Dosso API/panelini kısa süre durdurur; DB dump ile medya aynı
duruma ait olur. Başarılı yedekte `COMPLETE` işareti ve `SHA256SUMS` bulunur.
`.env.production` sır içerir: yedeği özel izinlerle saklayın ve sunucu dışında
şifreli bir konuma kopyalayın. `backups/` büyümesini izleyin; otomatik silme
veya zamanlanmış yedek bu scriptin parçası değildir.

Deploy, imaj indirmeden önce hem Docker veri diskinde hem yedek diskinde en az
**10 GiB boş alan** arar. Yedek öncesinde çalışan veritabanı ve medya boyutlarını
ölçer; toplamın iki katı kadar ek alan ile 10 GiB rezerv ister. Bu kontrol
API/panel durdurulmadan yapılır. Alan yetersizse yayın reddedilir ve mevcut
uygulama çalışmaya devam eder. Eski yedek veya imajlar otomatik silinmez;
gereken yedekleri sunucu dışına taşıyıp yalnız Dosso'ya ait, artık gerekli
olmayan dosyaları inceleyerek temizleyin. Diğer projelerin disk tüketimi de
değişebileceğinden bu kontrol sürekli disk izleme yerine geçmez.

Müşteri VPS'inde aynı root sahibi dosya düzenini kurun. Yedeğin SHA256
değerlerini doğruladıktan sonra `.env.production` ve `release.env` dosyalarını
`shared/` içine `0600` izinle yerleştirin. Aynı API/panel imajlarını indirin
(özel GHCR için yalnız okuma yetkili registry erişimi gerekir). Domain ve sırları
koruyun; yeni sunucunun port/proxy ayarlarını kontrol edin. Eski hosta özgü
`compose.ingress.yml` dosyasını körlemesine kopyalamayın; yeni sunucu için
ağı yeniden doğrulayın. **API/paneli ve seed'i henüz başlatmayın.**

```bash
sudo /opt/dosso-dossi/deploy/scripts/restore.sh /secure/path/to/complete-backup
```

Restore checksum'ları ve medya arşivindeki yolları kontrol eder; symlink,
hardlink ve üst dizine kaçan yolları reddeder. Yalnız **boş veritabanı ve boş
uploads volume'u** kabul eder. Dolu hedefi temizlemez veya üstüne yazmaz.
DB restore tek transaction'dır; başarısızlıkta uygulama kapalı kalır. Başarılı
restore sonrasında kayıt sayıları ve dosyaları kontrol edip uygulamayı başlatın:

```bash
cd /opt/dosso-dossi
source deploy/scripts/common.sh
compose up -d --no-build --wait api admin
curl --fail http://127.0.0.1:13101/api/health
```

Yeni sunucuyu HTTPS üzerinden test ettikten sonra sabit alan adının DNS'ini
çevirin. Eski sunucuda yazmayı kapalı tutun; DNS önbelleği nedeniyle eski API'ye
ulaşan istemciler eski DB'ye işlem yazmamalıdır. Son yedeği almadan eskiyi
kapatmayın ve iki veritabanını aynı anda yazılabilir bırakmayın.

## Hata, geri dönüş ve altyapı güncellemesi

Scriptler `shared/deploy.lock` ile aynı anda backup/deploy/restore yapılmasını
engeller. Migration başlamadan hata olursa önceki uygulama başlatılabilir.
Migration başladıktan sonraki hatada API/panel durdurulur; **veritabanı otomatik
geri alınmaz**. Logları ve migration durumunu inceleyip düzeltme yayınlayın.

Migration başlamadan hemen önce hedef imajlar `shared/pending-migration.env`
dosyasına kalıcı yazılır. Bu işaret yalnız yeni uygulama sağlıklı olduğunda ve
`shared/release.env` güncellendiğinde silinir. İşaret kaldığında sonraki normal
deploy ve yedekler reddedilir: değişmiş veritabanının eski sağlıklı sürümle
yanlış eşleştirilmesi önlenir. Dosyayı sırf CI'ı yeniden çalıştırmak için silmeyin.
Root olarak migration durumunu ve hedef imajları inceleyin; başarılı hedefi
başlatıp doğrulayarak `release.env` dosyasını uzlaştırın veya gerekirse boş yeni
bir projeye önceki tutarlı yedeği geri yükleyin. Ancak durum doğrulandıktan sonra
işareti kaldırıp normal yayını/yedeği sürdürün. Uygun düzeltme yayınına geçmek
için de önce bu incelemeyi yapın; başarısız migration'ı otomatik tekrarlamayın.

Önceki imajlara dönmek yalnız yeni DB şemasıyla uyumluluk doğrulandıysa uygundur:
root shell'de `DOSSO_RELEASE_FILE=/opt/dosso-dossi/shared/previous-release.env`
ile `common.sh` yükleyip `compose up -d --no-build --no-deps --wait api admin`
çalıştırılabilir. Başarılı geri dönüşte kullanılan release dosyasını ayrıca
`shared/release.env` olarak kaydedin. Yeni işlemlerin üstüne eski DB yedeğini
restore etmek veri kaybettirir; restore scripti bu nedenle dolu DB'yi reddeder.

CI yalnız uygulama imajlarını değiştirir. Compose, ingress, script, secrets ve
PostgreSQL sürümü değişikliklerini sunucuda root olarak ayrıca gözden geçirip
uygulayın. `.env.production`, volume'lar ve `shared/` korunmalıdır. PostgreSQL
major yükseltmesini normal uygulama deploy'una karıştırmayın. Başka projeleri
etkileyebilecek `docker system prune`, genel `docker compose down` veya
`down --volumes` komutlarını üretim işletiminde kullanmayın.
