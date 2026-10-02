# Dosso Dossi Coffee — yönetici tanıtım ve kullanım videosu

**Onaylanan sunum:** yatay, 1920×1080; yalnızca yazılı anlatım; seslendirme, konuşma ve müzik yok. Gerçek uygulama ekranları ve gerçek panel arayüzü kullanılacak. Toplam 51 sahne; süreyi yazının okunabilirliği belirler. Çoğu sahne 15–22 saniye, çok kısa açılış/kapanış 8–12 saniye olabilir. Yaklaşık 15–18 dakika, süre hedefi veya üst sınır değildir.

Bu dosya mevcut Flutter rotaları, ekran bileşenleri ve React panel menüsü incelenerek hazırlanmıştır. Bu çalışma sırasında UI çalıştırılmamış, uygulama kaynaklarına veya verilere müdahale edilmemiştir. Görsel akış müşteri yolculuğunu baştan sona kapsar; ardından yöneticinin aynı deneyimi hangi panellerden izleyeceğini açıklar. Teknik entegrasyonların üretim durumu ayrı özellik denetimiyle son kurgudan önce eşleştirilmelidir.

## Görsel anlatım sistemi

- **Ana başlık:** “Dosso Dossi Coffee / Uygulama ve Yönetim Rehberi”. Alt başlık: “Müşteri deneyiminden günlük operasyona”.
- **Yazı düzeni:** her sahnede bir kısa başlık, en fazla iki açıklama paragrafı ve gerekirse küçük “Adımlar” satırı. Aşağıdaki “Ekran metni” hücreleri doğrudan kullanılabilir; ayraç ` / ` paragraf ayrımını gösterir. Bir kareye üçten fazla metin bloğu koyma.
- **Müşteri sahneleri:** solda gerçek dikey telefon ekranı, sağda başlık ve açıklama; sağdaki boşluk metnin rahat okunmasını sağlasın. Gerektiğinde telefondaki ayrıntıyı ayrı yakın plan kutusunda göster; telefonu yatay esnetme.
- **Panel sahneleri:** gerçek panel görüntüsü ekranın yaklaşık dörtte üçünü kapsasın; altta veya yanda kısa açıklama alanı. Tabloyu küçültüp okunmaz hâle getirmek yerine ilgili bölüme yavaş yakınlaş.
- **Renk:** açık krem ve sıcak bej zemin, kahve tonunda yazı, tek turuncu vurgu. Marka logosu gerçek varlıktan alınmalı. Uygulama içine sahte etiket, düğme, başarı bildirimi yerleştirme.
- **Hareket:** bölüm açılışında hafif giriş, ekranda yavaş kaydırma/ölçülü yakınlaşma, gerçek kontrol üstünde küçük turuncu halka. Yan metin sırayla belirirken önceki bilgi okunacak kadar kalsın. Sürekli hareket kullanma.
- **Görüntü kaynağı:** ekran bir fixture ile doldurulduysa çerçevenin dışında küçük “Örnek hesap · tanıtım verisi” etiketi. Gerçek işleme karşılık gelmeyen hareketleri ekranda olmuş gibi üretme; kontrolü vurgulayıp nasıl kullanıldığını yazıyla açıkla.
- **Ses:** çıktı sessiz olmalı; TTS, anlatıcı veya fon müziği eklenmemeli. Yazılı anlatım, ek ses gerektirmeden bütün akışı açıklamalı.

## Bölüm yapısı

1. **Başlangıç ve üyelik** — S01–S05.
2. **Ana sayfa, sadakat ve kampanyalar** — S06–S10.
3. **Mağazalar ve sipariş** — S11–S22.
4. **Kart, mağaza ve hediye** — S23–S29.
5. **Profil ve destek** — S30–S37.
6. **Yönetim ve operasyon** — S38–S50.
7. **Kapanış** — S51.

## Çekim ve kurgu listesi

Kaynak kodlarının tam dosya yolları belgenin sonundadır. “Gösterim” sütunu editör içindir, videoya teknik talimat olarak yazılmaz.

| Sahne | Kaynak ve ekran | Başlık | Ekran metni — doğrudan kullanılabilir | Gösterim / vurgu |
|---|---|---|---|---|
| S01 | M01, M07, A03 | Dosso Dossi Coffee | Uygulama ve Yönetim Rehberi / Müşteri deneyiminden günlük operasyona. | Gerçek logo; ana sayfa ile panelin kısa tanıtım görüntüsü. Marka kapanışından farklı, sade açılış. |
| S02 | M02, M08 | Uygulamayı tanıyalım | Ana Sayfa, Sipariş, Tara & Öde, Online Mağaza ve Mağazalar. / Beş ana sekme müşterinin temel işlemlerini bir araya getirir. | Tanıtımdaki QR, damga, hediye kartlarından kısa kesit; alt menüde beş etiketi sırayla göster. |
| S03 | M02, M03 | Üye olmadan keşfet | Müşteri ürünleri ve mağazaları konuk olarak inceleyebilir. / Sipariş, bakiye ve hediye gibi hesaba bağlı işlemler için giriş yapması istenir. | Üye olmadan devam; menü; giriş davet penceresi. Gerçek pencere görüntüsü kullan. |
| S04 | M04, M05 | Telefonla giriş | Telefon numarasını yaz → doğrulama adımına geç → kodu gir. / Gerekirse doğrulama ekranından yeni kod istenebilir. | +90 ön eki, altı haneli kutular ve tekrar gönder sayacı. Gerçek telefon/OTP gösterme. |
| S05 | M06, M07 | Hesabını tamamla | İlk girişte isim bilgisi tamamlanır. / Ana sayfa, hesaba ait bakiye ve sadakat bilgilerine başlangıç noktasıdır. | Kurgusal isim alanı, ardından kişiye özel selamlama. Hesap adı bütün kayıt boyunca aynı olsun. |
| S06 | M07, M09, M10 | Damga ilerlemeni gör | Damga kartı, hedefe doğru ilerlemeyi gösterir. / “Nasıl çalışır?” açıklamasından damga kazanma ve ikram adımları incelenebilir. | 3/5 örneği, çekirdekler, Nasıl çalışır alt penceresi. Uygulamadaki hedef sayısını kaynak görüntüyle eşleştir. |
| S07 | M11 | İkramlarım | Kazanılan haklar ve ikram geçmişi bu bölümde görülür. / Kullanılabilir ikram, sipariş sırasında sepette seçilir. | Hak/ilerleme alanı ve geçmişi ayrı yakın planlarla göster. Kazanmak ile kullanmayı aynı olay gibi anlatma. |
| S08 | M07, M12 | Dosso Dossi Kart özeti | Kart bakiyesi ana sayfada görünür. / Yükleme ve ödeme ekranlarına kart üzerindeki kısa yollardan geçilebilir. | Gerçek bakiye kartı; Yükle ve QR düğmesi vurgusu. Çerçeve dışında örnek hesap etiketi. |
| S09 | M13–M16 | Sana Özel ve Kampanyalar | Ana sayfadaki kartlar kampanya ayrıntılarına götürür. / “Tümü” ile kampanya listesi açılır; müşteri ilgili açıklamayı inceleyebilir. | Yeni Yükle Kazan kartı, Tümü, kampanya listesi, Kahve İçtikçe afişi. Görsel geçişleri okunacak tempoda yap. |
| S10 | M17 | Yükle Kazan | Teklif, hesap özeti ve kampanya koşulları aynı ekranda bulunur. / “Uygulamadan yükle” ile bakiye yükleme adımına geçilir. | Hero, teklif, koşullar alt penceresi ve yükleme butonu. Metinde tutar/süreyi kalıcı genel kural hâline getirme. |
| S11 | M18 | Mağazaları keşfet | Şubeler harita üzerinde görüntülenir. / Arama alanından şube bulunabilir; bir işaret seçildiğinde mağaza özeti açılır. | Gerçek yüklü harita, arama, pin ve alt kart. Harita atfını koru. |
| S12 | M19, M20 | Mağaza bilgileri | Liste ve detay ekranlarından adres, çalışma saatleri ve iletişim bilgileri incelenir. / “Şubeyi Seç” sipariş şubesini belirler; “Sipariş Ver” menüyü açar. | Şehir bazlı liste, seçilen mağaza, Yol Tarifi, saatler ve düğmeler. Gerçek arama başlatma. |
| S13 | M21 | Sipariş ekranı | Aktif şube, arama alanı ve kategoriler üst bölümde yer alır. / Ürünler görsel, isim ve fiyat bilgileriyle listelenir. | Menü grid’ini tam göster; seçili şube ve kategorileri yakınlaştır. |
| S14 | M21 | Ürününü kolayca bul | Kategori seçerek ürün grubunu daralt. / Belirli bir ürün için arama alanına adını yaz; gerekirse sipariş şubesini değiştir. | Sıcak/soğuk/yiyecek örnekleri, arama sonucu ve şube seçici. Olmayan kategori adı uydurma. |
| S15 | M22 | Ürün ayrıntısı | Ürünün görselini, açıklamasını ve fiyatını incele. / Aynı kategorideki ürünler arasında kaydırarak karşılaştırma yap. | Gerçek detay ekranı, görsel vitrin ve yatay geçiş örneği. |
| S16 | M22, M21 | Seçenekler ve sepete ekleme | Opsiyon sunulan ürünlerde süt ve shot tercihlerini belirle. / Güncel tutarı kontrol edip “Sepete Ekle” düğmesini kullan. | Süt/Shot seçicileri, fiyat değişimi, eklenme durumu ve sepet rozeti. Her ürün için boy seçici varmış gibi gösterme. |
| S17 | M23 | Teslim bilgilerini kontrol et | Sepette teslim alınacak şube ve zaman seçilir. / Mevcut sipariş akışı, seçilen şubeden Gel-Al teslimine göre düzenlenmiştir. | Şube/teslim zamanı kartı ve zaman seçenekleri. Adres/kargo formu üretme. |
| S18 | M23 | Sepeti düzenle | Ürün seçenekleri “Düzenle” üzerinden değiştirilebilir; kalemler sepetten çıkarılabilir. / Promosyon kodu varsa ilgili alana uygulanır. | Düzenle alt penceresi, silme ikonu, kampanya kodu alanı. Gerçek olmayan adet artır/azalt kontrolü gösterme. |
| S19 | M23 | İkram ve ödeme | Uygun içecek ve hak varsa “İkram hakkını kullan” seçeneği görünür. / İndirimleri, toplamı ve bakiyeyi kontrol ederek “Dosso Dossi Kart ile Öde” adımına geçilir. | İkram anahtarı; ara toplam, indirim, ikram, toplam; gerçek buton etiketi. İşlem yalnız fixture/mock örneği. |
| S20 | M24 | Siparişin alındı | Onay ekranı sipariş numarası, şube, teslim ve tutarı gösterir. / “Siparişimi Takip Et” düğmesi hazırlık ekranına götürür. | Aynı demo siparişin gerçek onay görünümü; numara ve takip düğmesi. |
| S21 | M25 | Sipariş takibi | Siparişin alındı → Hazırlanıyor → Hazır. / Müşteri güncel durumla birlikte ürün ve teslim özetini bu ekrandan izler. | Aynı siparişin demo durumları. Fixture geçişi gerçek POS olayıymış gibi ilişkilendirilmesin. |
| S22 | M28, M07 | Geçmiş ve hesap durumu | Geçmiş Siparişler önceki işlemleri listeler. / Aktif sipariş yeniden açılabilir; ana sayfadan güncel bakiye ve sadakat bilgileri kontrol edilir. | Dolu geçmiş listesi; tarih, şube ve tutar; ana sayfa hesap durumu. |
| S23 | M26 | Tara & Öde | Müşteri hesabına ait QR ve barkodu bu ekrandan gösterir. / Kodun yenilenme bilgisi ve kart bakiyesi aynı bölümde yer alır. | Kart, demo QR, barkod ve sayaç. Gerçek ödeme token’ı veya çözümlenebilir kişisel veri kullanma. |
| S24 | M26 | Bakiye Yükle | Hazır bir tutar seçilebilir veya farklı bir tutar girilebilir. / Yükleme öncesi tutar ve kart bilgisi onay penceresinde kontrol edilir. | Hızlı Yükleme, Bakiye Yükle sekmesi, özel tutar ve onay. Çerçeve dışında örnek işlem etiketi. |
| S25 | M27 | Online Mağaza | Görsel afişler müşteriyi kahve koleksiyonlarına yönlendirir. / Afişe dokunarak ilgili kategori incelenebilir. | Kullanıcının onayladığı açık krem ve sıcak bej afiş; yatay kaydırma ve çekirdek kategorisi. |
| S26 | M27 | Mağaza ürünlerini keşfet | Kategori ve arama alanlarıyla mağaza ürünleri bulunur. / Üst bölümden favorilere ve sepete ulaşılır. | Termos & Mug / kahve çekirdekleri gibi gerçekten görünen kategoriler; arama ve üst ikonlar. |
| S27 | M22, M27 | Paket kahve ve marka ürünleri | Ürün görseli, açıklaması ve fiyatı ayrıntı ekranında incelenir. / Seçilen ürün mevcut sepet akışına eklenir; teslim bilgisi sepette kontrol edilir. | Gerçek paket kahve detayı, gerekiyorsa bir termos/mug örneği. Mevcut olmayan kargo akışı ekleme. |
| S28 | M30 | Kahve Gönder | Alıcının telefon numarasını gir, kahveyi seç ve istersen not ekle. / Hediyeyi kullanmak için alıcı aynı numarayla uygulamaya giriş yapmalıdır. | Kahve Gönder sekmesi, görselli ürünler, telefon ve not; gönderilen listesi. Alıcı numarası yalnız mock veri. |
| S29 | M30, M11, M26 | Bakiye hediyesi ve kullanım | “Bakiye Gönder” sekmesinde ürün yerine tutar seçilir. / Kahve hediyesi İkramlarım’a, bakiye hediyesi Dosso Dossi Kart hesabına eklenir; hesabı olmayan alıcı için giriş beklenir. | Bakiye tutarları ve gerçek açıklama ekranı. SMS’in kullanım kodu olmadığını küçük üçüncü metinle belirt: “Kullanım uygulama üzerinden yapılır.” |
| S30 | M31 | Profil | Hesap, Ödeme, Siparişler ve Diğer başlıkları tek merkezde toplanır. / Müşteri bilgilerini, geçmişini ve destek bölümlerini buradan açar. | Profilin üst ve alt bölümlerini yavaş kaydır; en fazla üç grup aynı anda vurgulansın. |
| S31 | M32 | Kişisel Bilgiler | Ad ve e-posta alanları düzenlenebilir. / Telefon numarası değişikliği için ekrandaki müşteri hizmetleri yönlendirmesi izlenir. | Form, sabit telefon alanı, Kaydet. Gerçek profil verisi değiştirme. |
| S32 | M33 | Bildirim Tercihleri | Kampanya, sipariş durumu ve SMS tercihleri ayrı ayrı seçilir. / Müşteri hangi konularda bilgilendirilmek istediğini bu bölümden yönetir. | Üç anahtar ve alt açıklamaları. Tercih kaydını gerçek push/SMS teslim kanıtı olarak anlatma. |
| S33 | M34 | Kayıtlı Kartlar | Kart bilgisi maskelenmiş biçimde görüntülenir. / Bu sürümde “Yeni Kart Ekle”, ödeme sağlayıcısı entegrasyonuna ilişkin bilgilendirme sunar. | Maskeli kart ve mevcut Yeni Kart Ekle açıklaması. Olmayan gerçek kart formu gösterme. |
| S34 | M29, M22 | Favorilerim | Ürün detayındaki kalp simgesi ürünü favorilere ekler. / Favorilerim listesinden ürünün ayrıntısına yeniden dönülebilir. | Kalp işareti → aynı ürün favori satırı → detay. Ürün adı sürekliliği. |
| S35 | M35 | Yardım & SSS | Damga, ikram, hediye ve teslim konuları soru başlıkları altında açıklanır. / Müşteri ilgili soruyu açarak kullanım adımlarını tekrar inceleyebilir. | İki veya üç soru aç; metinleri aşırı küçültmeden göster. |
| S36 | M36 | KVKK ve Gizlilik | Kişisel verilere ilişkin bilgilendirme bu bölümde yer alır. / Mevcut metin taslak olarak işaretlidir; yayın öncesinde nihai metinle tamamlanmalıdır. | Bölüm başlıkları ve gerçek taslak notu; uzun metni video üzerinde tekrar etme. |
| S37 | M31, A02 | Müşteriden operasyona | Müşteri profil üzerinden oturumunu kapatabilir. / Yönetim paneli, müşteri deneyiminin arkasındaki sipariş ve içerik yönetimini bir araya getirir. | Çıkış Yap kontrolü, sade bölüm geçişi, panel menüsü. Gerçek oturumu kapatma; demo görüntü yeterli. |
| S38 | A01, A02 | Yönetim paneline giriş | Panel kullanıcıları yetkilerine uygun ekranlara erişir. / Menü; sipariş, katalog, şube, kampanya, müşteri, finans ve izleme alanlarını içerir. | Giriş formu boş görüntü → demo panel. Şifre ve geçici anahtar asla görünmesin. |
| S39 | A03 | Günlük görünüm | Panel; ciro, sipariş, bakiye yükleme ve damga özetlerini gösterir. / Dönem grafikleri, saatlik yoğunluk ve şube tablosu birlikte incelenebilir. | Dört KPI → grafikler → şube tablosu. Tüm sayıları kurgusal veriden al. |
| S40 | A04 | Siparişler | “Canlı pano” günlük durumları; “Tüm siparişler” geçmişi gösterir. / Arama ve filtrelerle ilgili siparişe ulaşılır. | Pano sütunları, liste sekmesi, arama. Gerçek sipariş durumuna müdahale etme. |
| S41 | A04, M25 | Sipariş ayrıntısı | Şube, teslim, ürünler, tutar ve bağlı hareketler aynı kayıtta incelenir. / Durum yönetimi, iptal gerekçesi ve rapor araçları bu operasyonu destekler. | Demo ayrıntı çekmecesi; aynı numaralı müşteri takip ekranı küçük referans olabilir. Mock ile panel arasında gerçek senkron kanıtı üretme. |
| S42 | A05 | Menü yönetimi | Ürün adı, fiyatı, kategorisi, açıklaması ve görsel bilgileri yönetilir. / Aktiflik, seçenek desteği ve damga uygunluğu ürün kaydının parçalarıdır. | Ürün tablosu ve demo düzenleme formu. Görsel URL veya iç teknik adresleri yakınlaştırma. |
| S43 | A05 | Katalog düzeni | Kategoriler menünün gruplamasını; Opsiyonlar seçenek fiyat farklarını düzenler. / Toplu fiyat aracı kapsam, yöntem ve gerekçe ile birlikte değerlendirilir. | Kategoriler → Opsiyonlar → Toplu fiyat penceresi. Kaydetme/uygulama yok. |
| S44 | A06 | Şubeler | Mağaza bilgileri, konum, çalışma saatleri ve hazırlık süresi yönetilir. / Açık/kapalı durumu ve şubeye özel ürün müsaitliği operasyonu tamamlar. | Şube tablosu, düzenleme formu, müsaitlik listesi. Canlı mağazayı kapatma veya stok değiştirme. |
| S45 | A07 | Kampanyalar ve promosyonlar | Kampanya başlığı, açıklaması, sırası ve görünürlüğü düzenlenir. / Promosyon kodları, müşterinin sepette uyguladığı indirimlerin ayrı yönetim alanıdır. | Kampanya formu → Promosyon kodları. Sabit afişleri sınırsız editlenebilir gibi anlatma. |
| S46 | A07, M11 | Sadakat kuralları | Damga hedefi, yükleme eşiği ve ikram adedi bu bölümde görülür. / Kural değişiklikleri yetkili kullanıcı ve doğrulanmış kampanya koşullarıyla yönetilir. | Gerçek alanlar ve yalnız ilk yükleme seçeneği. Değişiklik yapma; tüm mobil metinlerin otomatik değiştiğini iddia etme. |
| S47 | A08 | Müşteriler | Müşteri kartı bakiye, damga ve ikram özetini bir araya getirir. / Cüzdan, Siparişler, Sadakat ve Hediyeler sekmeleri destek incelemesini kolaylaştırır. | Kurgusal müşteri arama → özet → dört sekme; gerekçe isteyen düzeltme kontrolüne kısa vurgu, işlem yok. |
| S48 | A09 | Finans | Cüzdan defteri, yüklemeler ve QR tahsilatları ayrı görünümlerden izlenir. / Mutabakat ve dışa aktarım araçları kayıtların kontrolünü destekler. | Dört sekme, kurgusal ledger satırları, Excel/CSV menüsü. Gerçek mali kayıtları veya iptal işlemini kullanma. |
| S49 | A10 | POS İzleme | Sağlık ve olay defteri, entegrasyon akışının incelenmesi için kullanılır. / İletilemeyen siparişler ve hata durumları bu görünümde değerlendirilir. | Kaynak durumları, outbox ve olay listesi. Ham payload/anahtar gösterme; gerçek yeniden kuyruğa alma yapma. |
| S50 | A11 | Yönetim ve işlem geçmişi | Yetkili yönetici, panel kullanıcılarının rol ve şube kapsamını düzenler. / İşlem geçmişi kim tarafından neyin değiştirildiğini gösterir. | Demo yönetici listesi, rol/şube formu, kurgusal önce/sonra ayrıntısı. Şifre yaratma veya gerçek rol değiştirme yok. |
| S51 | M07, A03 | Ortak bir uygulama düzeni | Müşteri ürününü keşfeder, siparişini ve kazanımlarını takip eder. / Ekip; sipariş, içerik, müşteri ve finans kayıtlarını ilgili yönetim ekranlarından izler. | Ana sayfa ve panel yan yana; marka kapanışı. Canlıya çıkılmış veya her entegrasyon tamamlanmış iddiası ekleme. |

## Kayıt ortamı ve süreklilik notları

1. Güncel yönlendirme gereği gerçek API ve veri değişikliği gerekli değildir. Kontrollü demo fixture ekranlarını kullan; yönetimsel kaydet/iptal/iade/rol işlemlerini yalnız göster, uygulama.
2. İşlem akışı simülatörde oynatılacaksa ayrılmış demo oturumu ve açık `USE_MOCKS=true` gerekir. Normal Flutter çalıştırmanın varsayılanı gerçek API'dir; mock sanarak ödeme/hediye gönderme. Kullanıcının mevcut uygulama verisini sıfırlama.
3. `main_preview.dart` belirli bir kişi adı ve telefon kaydeder. Video için kurgusal kimlik veya maskeleme gerekir. Mock numarayı gerçek SMS sağlayıcısına gönderme.
4. Mock başlangıç değerleri: cüzdan ₺425,50; maskeli kart sonu 7412; damga 3/5; ikram hakkı 1. Bunlar yalnız çekim hazırlama referansıdır.
5. Mock doğrulama kodu davranışı videonun konusu değildir; demo kod gösterilmez. Giriş, numara doğrulama akışı olarak açıklanır.
6. Mock sipariş takibi yaklaşık 8/20 saniyelik yaş eşiklerine göre ilerler, 10 saniyede bir yeniler. Hazır durumunda `ordersProvider` yenilemesi mock listeyi boşaltabilir. Dolu Geçmiş Siparişler görüntüsünü önceden al veya tutarlı fixture kullan.
7. Mock hediye, gönderenin ekranını göstermek içindir; başka telefona teslim kanıtı oluşturmaz. Ayrı “Hediyelerim” alıcı sayfası mevcut değildir; alıcı hakları İkramlarım / Dosso Dossi Kart üzerinden anlatılır.
8. Admin değişikliğinin mock müşteri ekranına yansıdığı şeklinde kurgu yapma. Gerçek uçtan uca kanıt ayrı izole backend gerektirir; mevcut sessiz eğitim videosunda görevleri ve ekranları göstermek yeterlidir.
9. Harita atfını koru; konum hesabı doğrulanmadan “canlı konumuna göre en yakın şube” iddiası yazma. Yol tarifi ve telefon düğmesini gösterirken gerçek arama başlatma.
10. Kampanya şartları, SMS, kart ekleme, ödeme ve POS bağlantılarının durumu teknik özellik denetimiyle tutarlı kalmalı. Kayıtlı kart görüntüsü gerçek kart saklama ve tahsilatın tamamlandığı anlamına gelmez.

## Kaynak ekran dizini — mobil

Kısa kaynak kodları yukarıdaki çekimlerde kullanılmıştır. Yolların tümü bu projenin gerçek dosyalarıdır.

| Kod | Ekran / bileşen | Kaynak dosya |
|---|---|---|
| M01 | Açılış | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/splash_screen.dart` |
| M02 | Karşılama | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/onboarding_screen.dart` |
| M03 | Konuk giriş daveti | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/guest_gate.dart` |
| M04 | Telefonla giriş | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/phone_login_screen.dart` |
| M05 | Doğrulama kodu | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/otp_screen.dart` |
| M06 | İsim tamamlama | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/auth/presentation/name_screen.dart` |
| M07 | Ana sayfa | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/home/presentation/home_screen.dart` |
| M08 | Beş sekmeli alt menü | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/routing/main_shell.dart` |
| M09 | Damga kartı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/home/presentation/widgets/stamp_card.dart` |
| M10 | Nasıl çalışır | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/rewards/presentation/loyalty_how_it_works_sheet.dart` |
| M11 | İkramlarım | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/rewards/presentation/rewards_screen.dart` |
| M12 | Ana sayfa cüzdan kartı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/home/presentation/widgets/wallet_card.dart` |
| M13 | Yükle Kazan yatay giriş | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/home/presentation/widgets/load_rewards_banner.dart` |
| M14 | Sana Özel kampanya kartı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/home/presentation/widgets/load_rewards_campaign_card.dart` |
| M15 | Kampanya listesi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/campaigns/presentation/campaigns_screen.dart` |
| M16 | Kahve İçtikçe kampanyası | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/campaigns/presentation/campaign_kahve_screen.dart` |
| M17 | Yükle Kazan kampanyası | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/campaigns/presentation/campaign_yukle_kazan_screen.dart` |
| M18 | Şube haritası ve özet penceresi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/branches/presentation/branch_map_screen.dart` |
| M19 | Şube listesi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/branches/presentation/branch_list_screen.dart` |
| M20 | Şube detayı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/branches/presentation/branch_detail_screen.dart` |
| M21 | Sipariş menüsü ve şube seçici | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/order_screen.dart` |
| M22 | Ürün detayı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/product_detail_screen.dart` |
| M23 | Sepet ve alt pencereleri | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/cart_screen.dart` |
| M24 | Sipariş onayı | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/order_success_screen.dart` |
| M25 | Sipariş takibi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/order_tracking_screen.dart` |
| M26 | QR, barkod ve bakiye yükleme | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/scan_pay/presentation/scan_pay_screen.dart` |
| M27 | Online Mağaza | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/shop/presentation/shop_screen.dart` |
| M28 | Geçmiş Siparişler | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/order_history_screen.dart` |
| M29 | Favorilerim | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/favorites/presentation/favorites_screen.dart` |
| M30 | Kahve/bakiye hediyesi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/gift/presentation/gift_screen.dart` |
| M31 | Profil | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/profile_screen.dart` |
| M32 | Kişisel Bilgiler | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/personal_info_screen.dart` |
| M33 | Bildirim Tercihleri | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/notification_prefs_screen.dart` |
| M34 | Kayıtlı Kartlar | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/saved_cards_screen.dart` |
| M35 | Yardım & SSS | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/faq_screen.dart` |
| M36 | KVKK ve Gizlilik | `/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/kvkk_screen.dart` |

## Kaynak ekran dizini — yönetim

| Kod | Ekran / bileşen | Kaynak dosya |
|---|---|---|
| A01 | Yönetici girişi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/auth/LoginPage.tsx` |
| A02 | Menü ve yetki görünümü | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/routes/AppShell.tsx` |
| A03 | Panel özeti | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/dashboard/DashboardPage.tsx` |
| A04 | Sipariş yönetimi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/orders/OrdersPage.tsx` |
| A05 | Menü yönetimi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/menu/MenuPage.tsx` |
| A06 | Şube yönetimi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/branches/BranchesPage.tsx` |
| A07 | Kampanya, promosyon ve sadakat | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/campaigns/CampaignsPage.tsx` |
| A08 | Müşteri yönetimi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/customers/CustomersPage.tsx` |
| A09 | Finans | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/finance/FinancePage.tsx` |
| A10 | POS İzleme | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/pos/PosPage.tsx` |
| A11 | Yönetim ve işlem geçmişi | `/Users/berkaydemir/dosso-dossi/dosso-dossi-admin/src/features/admins/AdminsPage.tsx` |

## Kurgu teslim kontrolü

- 51 sahne bütün müşteri sekmelerini, profil alt sayfalarını ve dokuz yönetim menüsü başlığını kapsıyor.
- Yatay çıktı 1920×1080; video sessiz. Metinler ses olmadan anlaşılır.
- Her karede en fazla üç metin bloğu; başlık kısa, paragraflar okunabilir. Teknik talimatlar seyirci metnine taşınmıyor.
- Müşteri ve panel görüntüleri gerçek arayüzden; kontrolü olmayan özellikler veya sahte sonuçlar eklenmiyor.
- Demo hesap/tutar/ürün/sipariş bilgileri sahneler boyunca tutarlı. Gerçek kişi ve finansal bilgi görünmüyor.
- Hediye kullanımı için uygulama ve aynı telefon numarasıyla giriş şartı açıkça anlatılıyor.
- Sipariş teslimi mevcut Gel-Al akışına uygun; olmayan kargo, alıcı hediye listesi veya gerçek kart ekleme adımı eklenmiyor.
- Mock ilerleme, canlı panel senkronizasyonu veya gerçek POS olayı gibi sunulmuyor.
