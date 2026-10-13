# Web görsel kaynakları

Güncelleme: 13 Ekim 2026. Bu kayıt, ana sayfa ve online mağaza tasarımında kullanılabilecek yerel görsellerin kaynağını ve sınırlarını açıklar.

## Kullanım kararı

- Dosso Dossi'nin mevcut web sitesinden yalnızca kullanıcının izin verdiği CEO fotoğrafı kullanılabilir. Eski sitenin logosu, bannerları ve diğer fotoğrafları bu pakete alınmadı.
- Marka logosu ve ürün görselleri mevcut proje dosyalarından alındı. Kaynak dosyalar değiştirilmedi.
- Espressolab PDF'leri bölüm düzeni ve alışveriş arayüzü için referanstır; Espressolab marka veya ürün fotoğrafları siteye kopyalanmadı.
- Paket üzerinde görünen gramaj ile gösterilen ürün eşleşmelidir. Mevcut 100 g, 250 g ve 500 g Türk kahvesi dosyaları aynı **250 g** paketini gösterdiğinden yalnızca 250 g dosyası seçildi.
- Dosyalardaki ürün isimleri ve görselleri, yeni web kataloğunun yayınlanmış veya stokta olduğu anlamına gelmez. Fiyat, stok ve satışa açılacak ürün listesi ayrı olarak onaylanacaktır.

## Hazırlanan dosyalar

Çıktı kökü: [`dosso-dossi-web/public/images`](../dosso-dossi-web/public/images/).

| Web dosyası | Ölçü | Kaynak (depo kökünden) | Kullanım |
| --- | --- | --- | --- |
| `brand/logo.png` | 360 × 360 | `dosso-dossi-app/assets/images/logo.png` | Üst/alt bölüm marka amblemi; şeffaf PNG |
| `products/thermos-orange.webp` | 354 × 982 | `dosso-dossi-app/assets/images/termos_turuncu.png` | Turuncu termos; şeffaf ürün fotoğrafı |
| `products/thermos-cream.webp` | 380 × 986 | `dosso-dossi-app/assets/images/termos_krem.png` | Krem termos; şeffaf ürün fotoğrafı |
| `products/thermos-pink.webp` | 374 × 982 | `dosso-dossi-app/assets/images/termos_pembe.png` | Pembe termos; şeffaf ürün fotoğrafı |
| `products/thermos-green.webp` | 383 × 982 | `dosso-dossi-app/assets/images/termos_yesil.png` | Yeşil termos; şeffaf ürün fotoğrafı |
| `products/turkish-coffee-250.webp` | 573 × 961 | `dosso-dossi-backend/uploads/products/turk-kahvesi-250-gr.webp` | Yalnızca Türk Kahvesi 250 g; şeffaf ürün fotoğrafı |
| `editorial/coffee-origins.webp` | 1774 × 887 | `dosso-dossi-app/assets/images/shop_coffee_origins.png` | Kolombiya, Kenya, Nikaragua paketli tanıtım görseli |
| `editorial/coffee-ritual.webp` | 1774 × 887 | `dosso-dossi-app/assets/images/shop_coffee_ritual.png` | Türk Kahvesi ve Mehmedi Meşari paketli tanıtım görseli |
| `editorial/thermos-collection.webp` | 1774 × 887 | `dosso-dossi-app/assets/images/shop_thermos_collection.webp` | Dört renk termos tanıtım görseli |
| `editorial/coffee-cup.webp` | 512 × 512 | `dosso-dossi-app/assets/images/story_cover_coffee.webp` | Markalı sıcak içecek bardağı; şeffaf kategori görseli |
| `editorial/cold-drinks.webp` | 512 × 512 | `dosso-dossi-app/assets/images/story_cover_drinks.webp` | İki soğuk içecek; şeffaf kategori görseli |
| `editorial/coffee-beans.webp` | 512 × 512 | `dosso-dossi-app/assets/images/story_cover_beans.webp` | Kolombiya/Kenya paketleri; şeffaf kategori görseli |
| `editorial/ceo.webp` | 1453 × 1044 | `docs/website-source/dossodossi-coffee/2026-10-13/assets/ceo.jpg` | Hikmet Eraslan portresi; izin verilen eski site fotoğrafı |

CEO fotoğrafının kayıtlı dış kaynağı: [Dosso Dossi CEO fotoğrafı](https://dossodossicoffee.com/image/catalog/banner/ceo.jpg). Diğer dosyalar için bu çalışma sırasında dış kaynaktan yeni indirme yapılmadı.

## Teknik ve görsel notlar

- Logo 360 px'e küçültülerek PNG olarak korundu. Yeni WebP dönüşümlerinde kalite 88 kullanıldı; mevcut WebP dosyaları yeniden sıkıştırılmadan kopyalandı. Kaynak görsellerin şeffaflığı korundu.
- Üç yatay tanıtım görselinde **Türkçe başlıklar ve görsele gömülü butonlar** bulunur. Bunları İngilizce sayfalarda tam genişlikte kullanmak uygun değildir. İki dilde de metin ve bağlantıları HTML ile oluşturmak, görselin yalnızca ürün bölümünü CSS kadrajında göstermek gerekir. Görsele gömülü butonlar gerçek etkileşimli buton yerine geçmez.
- `coffee-origins` ve `coffee-ritual` için proje içindeki [üretim notları](../design-previews/online-magaza/2026-09-30-v1/uretim-notlari.json) mevcut ürün fotoğraflarından ImageGen ile oluşturulmuş, uygulama için onaylanmış tanıtım kompozisyonları olduğunu belirtir. Bunlar bağımsız stüdyo çekimi veya yeni katalog kaydı olarak sunulmamalıdır.
- `design-previews/online-magaza/2026-09-30-v1/02-imza-harmanlar.png` üretim notlarında onaysızdır; seçilmedi.
- Ürün ve kategori görsellerinde `object-fit: contain`, fotoğraf panellerinde `object-fit: cover` uygundur. Termoslar yüksek ve dar olduğundan kartlar arasında aynı görünen ürün yüksekliği tercih edilmelidir.
- `coffee-cup`, `cold-drinks` ve `coffee-beans` 512 px kaynaklardır; tam ekran fotoğraf alanlarında aşırı büyütülmemelidir.
- Mevcut proje varlıkları arasında bu çalışma için kullanılabilecek yazısız gerçek şube iç mekân fotoğrafı veya yerel web fontu bulunmadı. Yeni tanıtım görseli eklenirse kaynağı ve gerçek bir şubeyi temsil edip etmediği ayrıca kaydedilmelidir.

## Yeni ana sayfa hero görseli

- Dosya: [`editorial/coffee-moment.webp`](../dosso-dossi-web/public/images/editorial/coffee-moment.webp), 1536 × 1024 px, 114.850 bayt.
- Üretim: 13 Ekim 2026, yerleşik `image_gen` aracı; `photorealistic-natural` kullanım türü. Referans fotoğraf veya eski web sitesi görseli kullanılmadı.
- Özgün çıktı: `/Users/celik/.codex/generated_images/01a136af-6911-7293-b37d-2676d11535a5/exec-098d4138-9f96-4c9a-a901-f3e478774059.png`. Çıktı korunarak proje içine WebP (kalite 86) kopyası alındı; kadraj veya fotoğraf içeriği değiştirilmedi.
- Kullanım: Ana sayfada metni HTML ile bindirilen kahve hazırlama görseli. Bu yapay zekâ ile üretilmiş genel bir editoryal kompozisyondur; gerçek Dosso Dossi şubesini, çalışanını veya servis ekipmanını belgeleyen fotoğraf olarak sunulmamalıdır.
- Kontrol: Sağdaki fincan ve doğal el pozları, soldaki koyu metin boşluğu, logosuz ve yazısız kompozisyon görsel olarak incelendi.

Tam üretim istemi:

```text
Use case: photorealistic-natural
Asset type: editorial full-width website hero photograph, wide landscape approximately 3:2.
Primary request: A beautifully lit, photorealistic editorial coffee moment in a warm espresso bar. Close view of a barista's naturally posed hands pouring a thin stream of steamed milk from a small stainless steel jug into a plain small ivory ceramic cup, creating credible latte art. Cup and hands occupy the right half of an oak counter; no face.
Scene/backdrop: Rich dark coffee-brown espresso bar, softly blurred metallic professional espresso machine in the rear, gentle warm sunlight.
Composition/framing: Wide landscape. Camera close to counter height, natural 50 mm photographic perspective. The left 45 percent is quiet dark softly blurred negative space with no important objects, suitable for white HTML heading. Latte cup remains complete and dominant in right half, natural human hand anatomy and believable milk flow.
Lighting/mood: Refined warm editorial photography, subtle window light, deep shadow detail, tactile oak grain, ivory ceramic, softly worn stainless steel. Attractive and inviting without artificial glossy CGI.
Constraints: This is an original generic coffee editorial concept, not a depiction of an actual named store or location. No text, no logos, no watermarks, no brand names, no visible product packaging, no signage. Do not include letters or decorative typography. No extra hands or fingers.
```
