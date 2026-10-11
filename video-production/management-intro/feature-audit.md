# Dosso Dossi Coffee — yönetim tanıtımı için özellik doğrulaması

30 Eylül 2026 · İncelenen kaynak sürümü: `ffba174`. Bu belge, mevcut kodun salt okunur incelenmesine dayanır. Yeni sipariş, ödeme, hediye, SMS veya müşteri kaydı oluşturulmadı. Canlı işletme kullanımı ve harici sağlayıcı teslimatı doğrulanmış sayılmamalıdır.

**Durum anahtarı:** **Çalışıyor** = uygulama/API akışı uygulanmış; **Kısmi** = belirli bir sınır veya eksik var; **Demo** = gerçek harici hizmet yerine geliştirme sağlayıcısı kullanılıyor; **Hazırlık** = ekran/arayüz var, uçtan uca entegrasyon yok. “Çalışıyor”, üretime tamamen hazır veya dış sistemlerle sahada kabul edilmiş anlamına gelmez.

## Videoda mutlaka doğru aktarılacak noktalar

1. **Gerçek banka tahsilatı yok.** `DevPaymentProvider` ödemeyi anında başarılı kabul ediyor; bankadan para çekmiyor. Kart ekleme/tokenizasyon ve 3DS akışı tamamlanmış değil.
2. **Gerçek SMS teslimatı yok.** OTP ve hediye mesajları `DevSmsProvider` ile yalnız sunucu loguna yazılıyor. Geliştirme OTP kolaylığı gerçek telefon sahipliği doğrulaması gibi sunulmamalı.
3. **Gerçek Kerzz sipariş iletimi yok.** `DevKerzzPosClient` log yazıyor ve iletildi alanını işaretliyor. İsteğe bağlı hazırlık/hazır zamanlayıcısı bir simülasyon. Sunucuya gelen imzalı POS/webhook işleme altyapısı mevcut; gerçek mağaza adaptörünün bağlı olduğu kanıtlanmış değil.
4. **Yükle Kazan varsayılanı yalnız ilk yüklemeye özel.** İlk başarılı yükleme tek seferde en az 1.000 TL ise 5 ikram. İlk yükleme daha düşükse sonraki yükleme bu ilk-yükleme bonusunu kazanmaz. 2.000 TL için 10 değil, mevcut kuralla 5 ikram verilir. Panelden eşik/adet/ilk-yükleme koşulu değiştirilebilir.
5. **Online Mağaza şubeden teslim akışına bağlı.** Çekirdek, termos ve mug ürünleri ortak sepete giriyor. Adres, kargo, kurye veya kapıya teslim akışı yok.
6. **Bildirim tercihleri gerçek push gönderimi değildir.** Tercihler kaydediliyor; Firebase/APNs/device-token kaydı ve push teslimatı henüz yok.
7. **Mağaza mesafeleri canlı konuma göre değil.** Sabit Beylikdüzü referans noktasından hesaplanıyor. Harita, mağaza işaretçileri ve harici yol tarifi var; canlı GPS ile “sana en yakın mağaza” iddiası uygun değil.
8. **Kahve hediyesi ürün kilitli kupon değildir.** Gönderilen ürünün adı kaydediliyor; alıcıya 1 genel ikram hakkı ekleniyor. Ayrı gelen-hediye kutusu ve göndericiye tüketim durum takibi bulunmuyor.

## Müşteri uygulaması: ekran ve iş akışı envanteri

| Özellik / ekran | Gerçek kullanıcı akışı | Durum ve anlatım sınırı |
|---|---|---|
| Açılış ve tanıtım | Marka açılışı → tanıtım → telefonla giriş veya misafir devam | **Çalışıyor.** Mevcut oturum kontrol ediliyor; açılış animasyonu var. |
| Telefonla giriş / üyelik | Telefon gir → 6 haneli kod doğrula → yeni kullanıcıysa adını tamamla → ana sayfa | **Kısmi/Demo.** OTP oluşturma, süre/deneme sınırı, oturum ve yenileme altyapısı var; SMS servisi demo. “Gerçek SMS ile doğruladık” denmemeli. |
| Misafir kullanım | Menü, mağaza vitrini, kampanyalar ve şubeleri incele; hesap gerektiren işlemde giriş çağrısı | **Çalışıyor.** Sipariş verme, QR/bakiye ve hediye için oturum gerekiyor. Misafire kişisel cüzdan gösterilmiyor. |
| Ana sayfa | Kişisel selamlama/tarih → damga kartı → Dosso Dossi Kart bakiyesi → hediye görselli Yükle Kazan bağlantısı → Sana Özel kampanyaları | **Çalışıyor.** “Sana Özel” ortak kampanya listesinin başlığı; kişiye özel öneri/segmentasyon motoru kanıtı yok. |
| Damga ilerlemesi | Mevcut damga sayısı ve hedef gör → İkramlarım veya Nasıl çalışır aç | **Çalışıyor.** Varsayılan hedef 5 damga. 5 damga tamamlanınca 1 ikram hakkı; “beşinci kahve ücretsiz” yerine bu ifade kullanılmalı. |
| İkramlarım | İlerlemeyi ve kazanılan/kullanılan ikram geçmişini gör → siparişte ikramını seç | **Çalışıyor.** Kazanım ve kullanım geçmişi API’den geliyor. Kasada bağımsız hediye/SMS kodu kullanımı yok. |
| Yükle Kazan kampanya sayfası | Ana sayfadaki hediye kutusu/Sana Özel kartından aç → koşulları incele → Uygulamadan yükle → Bakiye Yükle | **Çalışıyor + yüklemede Demo.** Kampanya sayfası ilk yükleme koşulunu açıklar. Görsel/metinlerdeki eşik ve ikram sayısı mobil sabitlerinden geliyor. |
| Kampanyalar | Sana Özel → Tümü → kampanya afişi veya açıklaması → tanımlı kampanya detayı | **Çalışıyor/Kısmi.** Liste API’den; iki özel kampanya görseli/detayı uygulamaya gömülü. Her yeni kampanya için otomatik yeni detay sayfası üretilmiyor. |
| Sipariş menüsü | Şube seç → kategoriler veya arama → ürün fotoğrafı/ad/fiyat → ürüne dokun | **Çalışıyor.** Aktif ürün kataloğu sunucudan; bazı ürünler için görsel yoksa yedek simge kullanılır. Ürün/kategori sayısını çekim anındaki veriden doğrulamadan sabitlemeyin. |
| Ürün detayı | Fotoğraf ve açıklama → uygun üründe süt/shot → adet → favori/sepet | **Çalışıyor/Kısmi.** Süt/shot seçimi var; tüm ürünlerde seçenek yok. Ürün hacmi bilgi olarak gösteriliyor; tüm kahvelerde serbest boy seçimi varmış gibi anlatmayın. |
| Sepet | Ürün/adet/seçenek düzenle veya çıkar → şube/teslim seç → promosyon/ikram → Dosso Dossi Kart ile Öde | **Çalışıyor.** Ödeme yöntemi hesap cüzdanı. Fiyat, müsaitlik, şube açıklığı ve bakiye sunucuda yeniden kontrol edilir. Ürün fiyatı güncellenirse sepet yenilenir; pasife alınan ürün çıkarılır. |
| Gel-al saati | En kısa tahmini hazırlık veya sonraki iki 15 dakikalık seçeneği seç | **Kısmi.** Saatler cihazda `prepMinutes` üzerinden üretilir. Şube kapasitesi/rezervasyon motoru veya kesin teslim süresi garantisi yok. |
| Kampanya kodu | Sepette kod gir → doğrula → toplamda indirim gör; istenirse kaldır | **Çalışıyor.** Kod, aktiflik ve bitiş tarihi sunucuda kontrol edilir; mevcut model yüzdesel indirimdir. |
| Siparişte ikram kullanımı | Uygun içecek ve ikram hakkı varsa anahtarı aç → indirimli toplamı gör → sipariş ver | **Çalışıyor.** Bir siparişte bir hak; damga kazandıran ürünler arasındaki en pahalı birim içecek bedelsiz olur. Çok adetli satırın tamamı bedelsiz olmaz. |
| Sipariş onayı ve takibi | Onayda sipariş numarası → takip → Alındı / Hazırlanıyor / Hazır → kasadan teslim | **Çalışıyor + POS Demo.** Mobil yaklaşık 10 saniyede bir sorgular; gerçek zamanlı push değil. Hazır durumunda sorgu durur. Gerçek hazırlık durumu, yönetici işlemi veya entegre POS bildirimi gerektirir. |
| Dosso Dossi Kart / Tara & Öde | Bakiye gör → tek kullanımlık QR/barkodu kasaya göster → kod otomatik yenilenir | **Çalışıyor + saha entegrasyonu bekliyor.** Sunucu kodu 60 saniyelik üretir; POS tahsilat ucu kodu ve bakiyeyi denetler. Kod üretiminin çalışması gerçek kasada satış yapıldığını kanıtlamaz. |
| Bakiye yükleme | Hızlı tutar veya özel tutar seç → yükleme onayı → hesap bakiyesi ve uygunsa ikram güncellenir | **Demo.** Sunucu cüzdan/işlem kaydı gerçek DB’ye yazılır ama banka tahsilatı simüledir. Ekrandaki onay metni de bunu belirtir. |
| Kahve hediye et | Profil → Hediye Gönder → Kahve Gönder → alıcı telefonu → görselli ürün → not → gönder | **Çalışıyor + SMS Demo.** Gönderen cüzdanından ürün bedeli düşer. Kayıtlı alıcıya genel ikram hakkı eklenir. Alıcı hediyeyi uygulamada aynı numarayla giriş yaparak kullanır. |
| Bakiye hediye et | Aynı ekranda Bakiye Gönder → 50/100/250/500 TL → telefon/not → gönder | **Çalışıyor + SMS Demo.** Alıcı kayıtlıysa cüzdanına eklenir; kayıtlı değilse aynı telefonla giriş yapana kadar bekler. SMS bilgilendirme içindir, kullanım kodu içermez. |
| Gönderilen hediyeler | Hediye ekranının altında ürün/tutar, alıcı telefon ve tarih listesini gör | **Çalışıyor/Kısmi.** Gönderi geçmişi var; mobil model tüketim/teslim durumunu taşımıyor. Backend `redeemed`, hesaba aktarım demektir; harcanmış demek değildir. |
| Online Mağaza | Termos & Mug / Çekirdek Kahveler → arama → ürün detayı/favori/sepete ekle | **Çalışıyor/Kısmi.** İki yeni krem/bej afiş dokununca çekirdek kategorisini açar. Ortak şubeden teslim sipariş akışı; e-ticaret kargosu yok. |
| Mağazalar | Harita/liste → mağaza seç → adres/saat/telefon → detay, yol tarifi veya sipariş | **Çalışıyor/Kısmi.** Mapbox anahtarı ve internet gerekir; hata halinde liste seçeneği var. Yol tarifi Google Maps’i harici açar; telefon `tel:` bağlantısıdır. Mesafe canlı GPS değildir. |
| Profil | Ad/telefon ve hesap özetleri → hesap, ödeme, sipariş ve diğer bağlantılar | **Çalışıyor.** Misafir ve üyeye farklı girişler gösteriliyor. Profil alt sayfalarında başlık içerikle kayıyor. |
| Kişisel bilgiler | Ad/e-posta değiştir → Kaydet | **Çalışıyor.** Telefon alanı salt okunur; uygulama içinden numara değişimi yok. |
| Bildirim tercihleri | Kampanya, sipariş durumu ve SMS anahtarlarını değiştir | **Kısmi.** Tercihler API’ye kaydedilir; gerçek bildirim gönderim/abonelik altyapısı bağlı değildir. |
| Kayıtlı kartlar | Maskeli varsayılan kart göster → Yeni Kart Ekle | **Hazırlık.** Yeni Kart Ekle yalnız entegrasyon bekleniyor mesajı verir. Görünen kart bilgisi gerçek tokenize kart kaydı kanıtı değildir. |
| Geçmiş siparişler | Sipariş, tarih, şube, ürün, tutar ve damga özetini gör; aktif siparişe dokunarak takip et | **Çalışıyor.** Yeniden sipariş oluşturma veya müşteri tarafından iptal düğmesi yok. |
| Favorilerim | Ürün detayındaki/mağaza kartındaki kalbi seç → favori listesi → ürüne dön veya çıkar | **Çalışıyor/Kısmi.** Favoriler cihazdaki SharedPreferences’ta tutulur; hesaplar/cihazlar arası bulut senkronu yok. |
| Yardım & SSS | Soruları açıp açıklamalarını oku | **Çalışıyor.** Statik SSS; canlı destek veya destek talebi sistemi yok. |
| KVKK ve Gizlilik | Bilgilendirme metnini oku | **Taslak.** Ekran yayın öncesi hukuki onay gerektiğini açıkça söylüyor. “Hukuken onaylı nihai metin” denmemeli. |
| Çıkış | Profil → Çıkış Yap → hesap oturumunu kapat | **Çalışıyor.** Refresh oturumu iptal edilip kullanıcıya bağlı ekran durumu yenileniyor. |

## İş kuralları: doğru örnekler

- **Sadakat:** ürünün `stampMultiplier` değeri × adet kadar damga; damga vermeyen ürünler de var. Biriken damga hedefe bölünür, kalan sonraki karta taşınır. İkramla alınan uygun içecek mevcut uygulamada yine damga kazandırır.
- **Yükle Kazan:** ilk yükleme 1.000 TL → varsayılan 5 ikram. İlk yükleme 500 TL, ikinci yükleme 1.000 TL → varsayılan 0 yükleme bonusu. Bu nedenle videoda ilk yükleme koşulu hem sesle hem metinle görünmeli.
- **Hediye:** gönderenin hesabından düşülen bedel ve alıcı hakkı sunucuda işlenir; eşleşme hediyenin kayıtlı telefonuna göre yapılır. Aynı hediye iki kez hesaba aktarılmaz. Dondurulan alıcının hakkı bekletilir. Tek bir SMS kodunu üçüncü kişiye verme akışı yoktur.
- **Ödeme:** cüzdan bakiyesiyle uygulama siparişi kayıt altına alınır. Cüzdana kredi kartından gerçek para yüklemek için dış ödeme sağlayıcısı ve mobil ödeme dönüş akışı hâlâ gerekir. API’nin `pending`/`redirectUrl` alanlarını desteklemesi, mobil 3DS’nin tamamlandığı anlamına gelmez; mobil yükleme modeli şu anda bu alanları işlemiyor.
- **Şube ve seçenek fiyatları:** nihai bedelde sunucu şube fiyat farkını ve paneldeki opsiyon farkını kullanabilir. Mobil katalog merkezi fiyatı, süt/shot seçimleri ise yerel sabitleri gösterir. Bu farklılaştırmaları “tüm ekranlarda kusursuz eşzamanlı fiyatlandırma” diye tanıtmayın.

## Yönetim paneli envanteri

| Modül | Uygulanmış işlevler | Sunumda sınır |
|---|---|---|
| Panel / genel görünüm | Günlük sipariş/QR ciro özetleri, yükleme, yeni kullanıcı, sadakat ve bekleyen hediye göstergeleri; zaman grafikleri, şube karşılaştırması, saatlik yoğunluk | Kayıtların özeti; demo işlemler gerçek işletme geliri gibi anlatılmamalı. İkram göstergesi hak adedi yerine olay sayıyor; yükleme olayındaki 5 hakkı tek olay sayabilir. |
| Siparişler | Durum/şube/tarih/isim-telefon-sipariş arama; detay; hazırlık/hazır/tamamlandı ilerletme; gerekçeli iptal/iade; yeniden POS iletimi; CSV/Excel dışa aktarım | Gerçek Kerzz iletimi dev adaptör. İşletme durum ilerletmesi panelden çalışabilir. İptal/iade cüzdan ve sadakat kayıtlarına bağlı; banka kartına otomatik iade değildir. |
| Menü | Kategori ekle/düzenle/sırala/sil; ürün isim/açıklama/fiyat/görsel bağlantıları, damga katsayısı, yeni/öne çıkan/aktif durumu; toplu fiyat güncelleme; seçenek yönetimi | Mobil seçenek listesi sabit; paneldeki her yeni seçenek otomatik seçilebilir hale gelmiyor. Görsel yönetimi URL alanı üzerinden; bağımsız dosya yükleme akışı varmış gibi göstermeyin. |
| Şubeler | Bilgi, koordinat, saat, hazırlık süresi; açık/kapalı; şube bazında ürün müsaitliği ve fiyat farkı | Açık/kapalı durum bir yönetim alanı; canlı doluluk, stok adedi veya çalışma saatinden otomatik kapasite hesabı yok. |
| Kampanyalar | Kart başlık/açıklama/rozet/stil/sıra/aktiflik; promosyon kodu/indirim/son tarih; yükleme bonus ayarları | Uygulamadaki gömülü afişler/metinler otomatik değişmez. `loyalty.stampTarget` ayarı kaydediliyor ama sadakat hesabı/hesap açılış motorunda okunmuyor; hedef değişikliği uçtan uca hazır denmemeli. |
| Müşteriler | Arama ve değer/sıklık görünümü; profil, cüzdan, sipariş, sadakat, tercih ve hediye bilgileri; gerekçeli bakiye/ikram düzeltmesi; bekleyen hediyeler; oturum iptali/dondurma | Dondurma bayrağı ve refresh iptali var; müşteri işlem uçlarında genel `isBlocked` kontrolü yok. “Dondurunca tüm işlemler anında engellenir” denmemeli. |
| Finans | Cüzdan hareketleri; yükleme denemeleri/durumları; QR tahsilatlar; 15 dakika içinde QR işlem iptali; CSV/Excel; referans eşleşme özeti | Mutabakat mevcut QR kayıtlarında `saleRef` doluluğu kontrolüdür; canlı bankadan/POS’tan veri çekip dış hesap karşılaştırması yapmıyor. |
| POS İzleme | Gelen olayların kaynak/tür/durum/hata/payload görünümü; son olay/başarısız olay sayıları; iletilmemiş siparişler; başarısız olayı yeniden işlenebilir duruma alma | Yeniden kuyruğa alma kaydı açar; kendi başına dış servise yeni ağ isteği gönderip olayı tamamlamaz. Sağlık göstergesi canlı terminal bağlantısı testi değildir. |
| Yönetim | Yönetici ekleme; rol/şube/pasiflik; parola sıfırlama; audit kayıtları | Süper yönetici, yönetici, şube yöneticisi ve görüntüleyici rolleri var. Şube kapsamı sipariş/şube sorgularında uygulanır; tüm CRM/finans verisi için eksiksiz şube izolasyonu iddiası kurmayın. |
| Mobil güncelleme | Ön planda yaklaşık 3 saniyede bir sürüm kontrolü; değişen menü/şube/kampanya/cüzdan/sadakat/sipariş alanını yeniden yükleme; açılış/ön plana dönüşte yenileme | Websocket/push veya tüm kullanıcı olaylarının anlık yayını değildir. Panel audit kayıtlarına bağlıdır; doğrudan DB yazımları ve kullanıcıdan kullanıcıya hediye gönderimi aynı anlık tetik kapsamına girmez. |

## Anlatım için güvenli cümleler

| Kaçınılacak iddia | Kullanılabilecek anlatım |
|---|---|
| “Kartınızdan güvenle tahsil edip hemen yüklüyoruz.” | “Bakiye yükleme deneyimi hazır; bu tanıtımda ödeme adımı geliştirme sağlayıcısıyla simüle ediliyor.” |
| “Her bin lirada beş kahve kazanırsınız.” | “Mevcut kampanyada ilk yüklemesini tek seferde en az bin lira yapan kullanıcı beş ikram kazanır.” |
| “Beşinci kahve ücretsiz.” | “Beş damga tamamlandığında bir ikram hakkı oluşur.” |
| “Sipariş doğrudan mağazanın canlı kasasına düştü.” | “Sipariş uygulama ve panelde takip edilir; gerçek kasa bağlantısı için POS adaptörü devreye alınacak.” |
| “Alıcıya SMS ulaştı; bu kodu kasada kullanır.” | “Hediye alıcının telefonuna bağlı hesabına tanımlanır. Kullanmak için uygulamada aynı numarayla giriş gerekir; SMS yalnız bilgilendirme kanalıdır.” |
| “Hediyenin kullanıldığını anında görüyoruz.” | “Gönderilen hediyeler geçmişte listelenir; alıcının hesabına aktarımı sunucuda kayıtlıdır.” |
| “Konumuna en yakın mağazayı otomatik buluyor.” | “Mağazaları haritada inceleyebilir, seçebilir ve yol tarifi açabilirsiniz.” |
| “Online sipariş kapınıza gelir.” | “Online mağaza ürünleri de ortak sepete eklenerek seçilen şubeden teslim akışına katılır.” |
| “Tüm panel ayarları anında her ekrana yansır.” | “API’ye bağlı menü, şube ve kampanya bilgileri uygulama ön plandayken kısa aralıklarla güncellenir.” |

## Çekim önerisi: tüm özellikleri kapsayan sıralama

1. Marka açılışı/tanıtım; üyelik ve misafir seçeneğinin açıklaması.
2. Ana sayfa, kişisel karşılama, damga ilerlemesi ve Dosso Dossi Kart.
3. İkramlarım ve nasıl çalışır; ardından Yükle Kazan koşulları.
4. Sipariş menüsü, kategori/arama, ürün fotoğrafı ve detay seçenekleri.
5. Favori ekleme/liste; sepette şube, teslim zamanı, seçenek düzenleme, promosyon ve ikram.
6. Ödeme/sipariş takip ekranları: tamamlanmış mevcut örnek kayıt veya açıkça demo olarak sunulan materyal. Çekim için gerçek para/hediye işlemi gerekmez.
7. Tara & Öde, yenilenen QR ve bakiye yükleme formu; son onaydan önce durulabilir.
8. Online Mağaza, onaylı iki afiş, çekirdek/termos-mug kategorileri, ortak sepet bağlantısı.
9. Mağazalar haritası/liste, şube detayı, yol tarifi ve telefon bağlantısı.
10. Hediye Gönder’de iki sekme, ürün seçimi/telefon/not, geçmiş ve uygulama zorunluluğu. Gönderimi tamamlamadan açıklanabilir.
11. Profil ve bütün alt sayfalar: kişisel bilgiler, tercihler, kayıtlı kartların mevcut sınırı, geçmiş, SSS, gizlilik, çıkış.
12. Yönetim panelinin dokuz modülü, mobil veri güncellenmesi, ardından açık entegrasyon maddeleri.

Gerçek isim, telefon, e-posta, bakiye ve sipariş geçmişi yöneticilere dağıtılacak videoda gerekmiyorsa maskelenmeli. QR ve oturum/giriş bilgileri kalıcı videoda kullanılabilir kimlik bilgisi olarak bırakılmamalı. Örnek senaryo görüntülerini canlı operasyon sonucu gibi etiketlemeyin.

## Kanıt kaynakları

- Rotalar/ekran kapsamı: [app_router.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/routing/app_router.dart), [profil](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/profile_screen.dart).
- Çalışma modu: [AppConfig](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/core/constants/app_config.dart). README/API sözleşmesinin bazı eski açıklamaları güncel kodla uyuşmuyor; bu rapor kodu esas alır.
- OTP ve SMS: [otp.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/auth/otp.service.ts), [dev-sms-provider.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/lib/sms/dev-sms-provider.ts).
- Tahsilat ve yükleme: [dev-payment-provider.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/wallet/payments/dev-payment-provider.ts), [topup.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/wallet/payments/topup.service.ts), [api_wallet_repository.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/wallet/data/api_wallet_repository.dart), [kayıtlı kartlar](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/saved_cards_screen.dart).
- Kampanya koşulu: [settings.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/settings/settings.service.ts), [LoadRewardsOffer](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/campaigns/presentation/widgets/load_rewards_offer.dart).
- Sadakat, sepet, seçenekler: [loyalty-apply.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/loyalty/loyalty-apply.ts), [orders.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/orders/orders.service.ts), [cart_screen.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/presentation/cart_screen.dart), [product_options.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/domain/product_options.dart).
- POS/takip: [pos-client.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/orders/pos-client.ts), [wallet.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/wallet/wallet.service.ts), [order_tracking_provider.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/order/application/order_tracking_provider.dart).
- Hediye: [gifts.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/gifts/gifts.service.ts), [gift-claim.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/gifts/gift-claim.ts), [GiftRecord](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/gift/domain/gift_record.dart).
- Mağaza: [shop_screen.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/shop/presentation/shop_screen.dart). Şubeler: [api_branch_repository.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/branches/data/api_branch_repository.dart), [branch_directions.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/branches/presentation/branch_directions.dart).
- Yerel favoriler/push sınırı/taslak metin: [favorites_controller.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/favorites/application/favorites_controller.dart), [notification_prefs.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/application/notification_prefs.dart), [kvkk_screen.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/features/profile/presentation/kvkk_screen.dart).
- Panel rotaları/roller: [modules.routes.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/modules.routes.ts), [orders.routes.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/orders.routes.ts), [admin-auth.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/middleware/admin-auth.ts).
- Panel raporlama sınırları: [dashboard.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/dashboard.service.ts), [finance.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/finance.service.ts), [pos-monitor.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/pos-monitor.service.ts), [customers.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/admin/customers.service.ts), [müşteri oturum kontrolü](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/middleware/auth.ts).
- Mobil güncelleme kapsamı: [app_data_sync.dart](/Users/berkaydemir/dosso-dossi/dosso-dossi-app/lib/core/sync/app_data_sync.dart), [sync.service.ts](/Users/berkaydemir/dosso-dossi/dosso-dossi-backend/src/features/sync/sync.service.ts).
