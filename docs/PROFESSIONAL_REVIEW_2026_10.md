# Kod ve ürün iyileştirmeleri — 7 Ekim 2026

Bu kayıt, derin inceleme sonrası onaylanan uygulama paketini anlatır. Önceki `RELIABILITY_WORK.md` tarihsel bir çalışma kaydıdır; güncel sonuçlar burada yer alır. Mevcut tasarım, proje teknolojileri ve kullanıcı değişiklikleri korunmuştur.

## Düzeltilen davranışlar

| Konu | Son durum |
| --- | --- |
| Para işlemlerinin tekrar denenmesi | Sipariş, hediye ve yükleme makbuzu ortak yardımcıyla doğrulanır. Bozuk/eksik başarı yanıtında veya pending yüklemede kalıcı işlem anahtarı korunur. |
| İlk yükleme kampanyası | Hak daha önce başarılı PaymentIntent bulunmasına göre hesaplanır. Panel bakiye düzeltmesi ADJUSTMENT olur; eski TOPUP düzeltmeleri de ilk gerçek yükleme hakkını tüketmez. |
| Hediye teslimi | Telefon ve kullanıcı kilitlerinin sırası kayıt/gönderim yarışını kapatır. İstemci claim çağrısını geçmişten önce yapar. Geç yanıtlar yeni geçmişi veya yeni hesabı ezemez. |
| QR | Aynı kullanıcıdaki paralel üretimler tek kullanılabilir koda iner; önceki kod tolerans penceresinde de kullanılamaz. |
| Teslim saati | Sunucu ve mobil şube çalışma aralığı, hazırlık süresi ve İstanbul saatine göre seçenekleri doğrular. Gece yarısını aşan şube saatleri desteklenir. |
| Raporlama | Gün başlangıcı, günlük seri, mutabakat ve saatlik yoğunluk Europe/Istanbul kullanır. ISO zaman damgaları UTC kalır. |
| HTTP ve günlükler | Bozuk JSON 400, aşırı gövde 413 döner. Loglar istek kimliği, yöntem, rota şablonu, süre ve durum içerir; query/body/token/ham hata mesajı içermez. |
| Admin sorguları | İstek ve gövde tipleri sıkılaştırıldı; sayfa/boyut/durum/tarih girdileri sınırlanıp doğrulanır. ADJUSTMENT filtre ve dışa aktarımda desteklenir. |
| Mobil hata takibi | Framework/platform ve işlem hataları yalnız kapalı operation/code/fatal alanlarıyla raporlanır; kişisel veri veya ham stack aktarılmaz. Varsayılan sink yerel geliştirici günlüğüdür. |
| Sipariş takip | Manuel ve ön plana dönüşte tekrar deneme; eski devam eden sorgunun yeni sonucu ezmesini önleyen koruma. |

## Yapı ve yeni tamamlanan akışlar

- Admin `strict` ve `noUncheckedIndexedAccess` kullanır. API DTO tipleri çalışma anındaki Zod doğrulamasından türetilir; geçersiz kimlik yanıtları depolanmaz.
- Menü yönetimi ve mobil bakiye yükleme akışı daha küçük bileşenlere ayrılmıştır. Beş admin lint uyarısı giderilmiştir.
- Mobil profil hesabın veri/kapatma taleplerini oluşturur ve izler; yönetici rol sınırları ve audit kaydıyla sonuçlandırır. Aktif talep tekrarları tek kayda gider.
- Hesap kapatma bakiye, aktif sipariş, bekleyen yükleme ve gelen/giden bekleyen hediye varsa durur. Kapanınca refresh token ve QR iptal olur; sonraki giriş, hediye alımı ve panel bakiye/sadakat düzeltmesi engellenir.
- Bu işlem fiziksel/hukuki veri silme değildir. Finans ve audit kayıtları korunur. Kullanıcı kapatmadan önce kendi verilerini sayfalı görüntüleyip kopyalayabilir; şifre/token/diğer hesapların ham verisi dışa aktarılmaz.
- Bildirim kutusu sipariş, hediye, hesap talebi ve aktif kampanyaları saklar. Tercih, sahiplik, okundu ve tek teslim kontrolleri vardır. İşlem bildirimleri ilgili DB transaction ile birlikte yazılır. Mobil kutu görünür ve uygulama ön plandayken yenilenir; dış link yerine yalnız izinli uygulama yollarına gider.
- Yerel kalite doğrulamaları backend, admin ve Flutter için ayrı çalıştırıldı. Backend testi geliştirme veritabanından ayrı `_test` DB kullanır; admin tarayıcı regresyonları API çağrılarını taklit eder. Ek testler ve GitHub Actions iş akışı kullanıcı tercihiyle bu branch'e dahil edilmedi; yerelde korundu.

## Veri geçişi

`20261007150000_account_requests_notifications` yalnız eklemeli migration'dır: `closedAt`, `ADJUSTMENT`, hesap talepleri ve bildirim tabloları/indeksleri. Mevcut local veritabanına `migrate deploy` ile uygulandı; ürün, müşteri veya finansal kayıtlar sıfırlanmadı. `.env`, portlar ve local DB yapılandırması değiştirilmedi. Eski cüzdan geçmişi topluca yeniden sınıflandırılmadı.

## Doğrulama

- Backend: 25 dosyada **267/267 test**, TypeScript build başarılı. Ayrı `dosso_professional_20261007_test` DB kullanıldı; gerçek kullanıcı finansal işlemi oluşturulmadı.
- Admin: tip kontrolü, sıfır uyarılı lint ve production build başarılı. **6 sözleşme + 16 admin + 9 hikâye testi** geçti.
- Mobil: son oturum korumaları dahil toplu **138/138 test** geçti; `flutter analyze` temiz. Hesap paketinin 8 senaryosu bu toplamın içindedir.
- Simülatörde yeniden başlatılan uygulamada profil, hesap talepleri ve kişisel veri ekranları gerçek local API ile açıldı. Görsel kontrol için kapatma talebi veya ödeme gönderilmedi.
- Backend ve admin üretim bağımlılıklarının `npm audit --omit=dev` taramasında bildirilen açık sayısı **0**. Bu bir bağımsız penetrasyon testi sonucu değildir.
- Son kontrolde local backend `/health` ve admin ana sayfası HTTP 200 döndürdü. Geçici test DB kaldırıldı; uygulamanın local DB'si çalışmaya devam ediyor.
- CI dosyası yalnız yerelde tutulur; GitHub üzerinde etkin değildir. Bu makinede Android SDK bulunmadığı için Android cihaz/build doğrulaması yapılmadı.

## Hazır olmayan dış ayarlar

Gerçek ödeme/SMS/POS sağlayıcıları ve local DB yapılandırması istek gereği kapsam dışıdır. Firebase/APNs projesi henüz hazır değildir; uzaktan push etkinleştirilmedi. Yayından önce canlı HTTPS API, onaylı gizlilik/KVKK bağlantısı, mağaza imzaları ve gerçek cihaz kontrolleri gerekir. Uygulama bu aşamada local çalışır. Telemetry dış servis bağlantısı da yapılandırılmamıştır; güvenli yerel hata olayları hazırdır.
