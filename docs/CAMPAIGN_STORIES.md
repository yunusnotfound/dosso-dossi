# Kampanya hikâyeleri

Ana sayfada **Sana Özel** bölümünden önce yer alır. Misafirler ve üyeler aynı yayınları, beyaz yuvarlak zemin ve marka turuncusuyla geçişli çerçeve içinde görür.

## Panelden yönetim

**Kampanyalar → Hikâyeler → Yeni hikâye** üzerinden başlık, açıklama, görsel, hedef sayfa, düğme metni ve gösterim sırası düzenlenir. İsteğe bağlı başlangıç/bitiş zamanı belirlenebilir. SUPER_ADMIN ve MANAGER düzenler; diğer panel rolleri yalnız görüntüler.

- PNG, JPEG veya WebP yüklenebilir (en fazla 10 MB ve 16 megapiksel). Sunucu görseli doğrulayıp WebP olarak kaydeder.
- Kahve Kazan ve Yükle Kazan, görsel yüklenmezse uygulamanın güncel ortak kampanya tasarımlarını kullanır.
- Hedefler: kahve kampanyası, yükleme kampanyası, online mağaza, sipariş veya yalnızca hikâye.
- Pasif, henüz başlamamış veya süresi dolmuş hikâyeler uygulamada gösterilmez. Bağlı kampanya kapalıysa ilgili hikâye de gizlenir.
- Panel değişiklikleri mevcut uygulama senkronizasyonuyla alınır. İleri tarihli yayın başlangıçları ana sayfa görünürken 30 saniyelik kontrolle fark edilir; süre bitişi cihazda da uygulanır.

## Uygulamada kullanım

Afiş, üstteki hikâye kontrollerinin arkasından ekranın alt kenarına kadar uzanır. Alt eylem düğmesi veya ayrı bir düğme alanı gösterilmez. Kampanya ayrıntıları ana sayfadaki Sana Özel kartlarından açılabilir. Paneldeki hedef alanı kampanya ve kapak eşleştirmesi için korunur; düğme metni mevcut mobil hikâye görünümünde gösterilmez.

Dokunarak açılır; sağ/sol dokunma veya kaydırmayla geçilir. Her hikâye 8 saniye gösterilir; basılı tutma veya duraklatma düğmesi süreyi durdurur. Arka planda, görsel yüklenirken ve yükleme hatasında süre ilerlemez. Erişilebilirlik/hareket azaltma ayarında otomatik geçiş başlangıçta kapalıdır.

İzlenen içerik sürümü cihazda saklanır. Panelde içerik güncellendiğinde yeniden izlenmemiş sayılır; yuvarlak çerçeveler izlendikten sonra da turuncu geçişli kalır. Hikâyeyi izlemek üyelik gerektirmez; hesap gerektiren işlemler mevcut üyelik kontrollerini korur.

## API

- `GET /campaign-stories`: herkese açık, yayın koşullarını sağlayan sıralı hikâyeler.
- `GET /admin/campaign-stories`: yönetim listesi.
- `POST /admin/campaign-stories`: id olmadan oluşturma; mevcut id ile güncelleme.
- `DELETE /admin/campaign-stories/:id`: silme.
- `POST /admin/campaign-stories/image`: ham görsel gövdesi ve görsel Content-Type; `{ imageUrl }` döndürür.

Migration: `20261002180000_campaign_stories`. İki başlangıç yayını Kahve Kazan ve Yükle Kazan'dır. Mevcut müşteri, bakiye, sipariş ve sadakat kayıtları değiştirilmez.
