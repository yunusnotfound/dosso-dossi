import '../domain/menu.dart';
import 'menu_repository.dart';

/// GERÇEK menü ve fiyatlar — resmi fiyat listesinden (Temmuz 2026).
/// Fiyat güncellemesi geldiğinde yalnızca bu dosya değişir.
///
/// Kurallar:
/// - Damga yalnızca kahve kategorilerinde kazanılır (sıcak/soğuk/aromalı).
/// - Süt/shot seçenekleri yalnızca sütlü kahvelerde ve sıcak çikolatada açık;
///   ekstra fiyatları product_options.dart'ta (yulaf/badem +60, çift shot +40).
/// - "Çay Bardak Personel" (iç kullanım) listeye alınmadı.
/// - Fotoğraflar marka ekibinden gelince emoji yer tutucular değişecek.
class MockMenuRepository implements MenuRepository {
  static const _categories = [
    MenuCategory(id: 'sicak-kahveler', name: 'Sıcak Kahveler'),
    MenuCategory(id: 'sicak-cikolatalar', name: 'Sıcak Çikolatalar'),
    MenuCategory(id: 'caylar', name: 'Çaylar'),
    MenuCategory(id: 'soguk-kahveler', name: 'Soğuk Kahveler'),
    MenuCategory(id: 'aromali-kahveler', name: 'Aromalı Kahveler'),
    MenuCategory(id: 'soguk-cikolatali', name: 'Soğuk Çikolatalı İçecekler'),
    MenuCategory(id: 'soguk-meyveli', name: 'Soğuk Meyveli İçecekler'),
    MenuCategory(id: 'soguk-caylar', name: 'Soğuk Çaylar'),
    MenuCategory(id: 'soft-icecekler', name: 'Soft İçecekler'),
    MenuCategory(id: 'kahvalti', name: 'Kahvaltılıklar'),
    MenuCategory(id: 'tatlilar', name: 'Tatlılar'),
    MenuCategory(id: 'kek-kurabiye', name: 'Kek & Kurabiye'),
    MenuCategory(id: 'sandvic-tost', name: 'Sandviç & Tost'),
    MenuCategory(id: 'atistirmalik', name: 'Atıştırmalıklar'),
    MenuCategory(id: 'cekirdek', name: 'Çekirdek Kahveler'),
    MenuCategory(id: 'merch', name: 'Termos & Mug'),
  ];

  static final _products = <Product>[
    // ── SICAK KAHVELER (Filtered Coffee + Espresso Classico) ──
    _p('sicak-kahveler', 'Filtre Kahve', 150, ml: 410),
    _p('sicak-kahveler', 'Mehmedi Meşari Filtre', 170, ml: 410, isNew: true),
    _p('sicak-kahveler', 'Espresso', 140, ml: 60),
    _p('sicak-kahveler', 'Ristretto', 140, ml: 30),
    _p('sicak-kahveler', 'Cortado', 150, ml: 30),
    _p('sicak-kahveler', 'Affogato', 180, ml: 30),
    _p('sicak-kahveler', 'Türk Kahvesi', 140, ml: 120),
    _p('sicak-kahveler', 'Türk Kahvesi Büyük', 170, ml: 240),
    _p('sicak-kahveler', 'Cafe Americano', 160, ml: 410),
    _p('sicak-kahveler', 'Cappuccino', 190, ml: 410, options: true),
    _p('sicak-kahveler', 'Caffe Latte', 190,
        ml: 410, options: true, featured: true),
    _p('sicak-kahveler', 'Flat White', 190,
        ml: 410, options: true, featured: true),

    // ── AROMALI KAHVELER (Espresso Collection) ────────────────
    _p('aromali-kahveler', 'Cafe Mocha', 260,
        ml: 410, options: true, featured: true),
    _p('aromali-kahveler', 'Mocha Bianco', 260, ml: 410, options: true),
    _p('aromali-kahveler', 'Caramel Macchiato', 250,
        ml: 410, options: true, featured: true),
    _p('aromali-kahveler', 'Latte Brulee', 270, ml: 410, options: true),
    _p('aromali-kahveler', 'Spice Vaniglia Eleganza', 270,
        ml: 410, options: true),

    // ── SICAK ÇİKOLATALAR (Cioccolata Calda) ──────────────────
    _p('sicak-cikolatalar', 'Cacao Royale', 240, ml: 410, options: true),
    _p('sicak-cikolatalar', 'Cacao Bianco Royale', 240,
        ml: 410, options: true),

    // ── ÇAYLAR (Tea) ──────────────────────────────────────────
    _p('caylar', 'Çay (Bardak)', 70, ml: 240),
    _p('caylar', 'Çay (Fincan)', 90, ml: 410),
    _p('caylar', 'Yaprak Çay', 150, ml: 410),
    _p('caylar', 'Sahlep', 220, ml: 410),
    _p('caylar', 'Chai Tea Latte', 240, ml: 410),
    _p('caylar', 'Matcha Latte', 240, ml: 410),
    _p('caylar', 'Matcha Fragola Latte', 270, ml: 410),
    _p('caylar', 'Matcha Vaniglia Latte', 270, ml: 410),

    // ── SOĞUK KAHVELER (Dolce Freddo + Espresso Freddo) ───────
    _p('soguk-kahveler', 'Cafe Freddo', 180,
        ml: 470, options: true, featured: true),
    _p('soguk-kahveler', 'Americano Freddo', 180, ml: 470),
    _p('soguk-kahveler', 'Latte Freddo', 200, ml: 470, options: true),
    _p('soguk-kahveler', 'Dolce Mocha Freddo', 270, ml: 470, options: true),
    _p('soguk-kahveler', 'Bianco Mocha Freddo', 270, ml: 470, options: true),
    _p('soguk-kahveler', 'Dolce Caramel Macchiato', 260,
        ml: 470, options: true),
    _p('soguk-kahveler', 'Freddo Latte Brulee', 280, ml: 470, options: true),
    _p('soguk-kahveler', 'Caramel Volt', 280,
        ml: 470, options: true, isNew: true),
    _p('soguk-kahveler', 'Spice Vaniglia Eleganza Freddo', 290,
        ml: 470, options: true),

    // ── SOĞUK ÇAYLAR (soğuk chai/matcha + Fuse Tea) ───────────
    _p('soguk-caylar', 'Chai Tea Latte Freddo', 250, ml: 470),
    _p('soguk-caylar', 'Matcha Latte Freddo', 250, ml: 470),
    _p('soguk-caylar', 'Matcha Fragola Latte Freddo', 280, ml: 470),
    _p('soguk-caylar', 'Matcha Vaniglia Latte Freddo', 280, ml: 470),
    _p('soguk-caylar', 'Fuse Tea Limon', 130, ml: 250),
    _p('soguk-caylar', 'Fuse Tea Şeftali', 130, ml: 250),

    // ── SOĞUK ÇİKOLATALI (Cioccolata Freddo) ──────────────────
    _p('soguk-cikolatali', 'Velvet Cacao', 270, ml: 470),
    _p('soguk-cikolatali', 'Coco Bianca', 270, ml: 470),
    _p('soguk-cikolatali', 'Pink Velvet', 270, ml: 470, featured: true),
    _p('soguk-cikolatali', 'Oreo Crumble', 270, ml: 470),
    _p('soguk-cikolatali', 'Caramello', 270, ml: 470),
    _p('soguk-cikolatali', 'Banana Cacao', 245, ml: 470),
    _p('soguk-cikolatali', 'Fragola Cacao', 245, ml: 470),

    // ── SOĞUK MEYVELİ (Frutta Eleganza + Smoothie + Mix) ──────
    _p('soguk-meyveli', 'Mango', 270, ml: 470),
    _p('soguk-meyveli', 'Fragola', 270, ml: 470),
    _p('soguk-meyveli', 'Wild Forest', 270, ml: 470),
    _p('soguk-meyveli', 'Passione Limone', 240, ml: 470),
    _p('soguk-meyveli', 'Fragola Limone', 240, ml: 470),
    _p('soguk-meyveli', 'Mango Smoothie', 270, ml: 470),
    _p('soguk-meyveli', 'Fragola Smoothie', 270, ml: 470),
    _p('soguk-meyveli', 'Wild Forest Smoothie', 270, ml: 470),
    _p('soguk-meyveli', 'Casa Limone', 170, ml: 470, featured: true),
    _p('soguk-meyveli', 'Sole Lime', 230, ml: 470),
    _p('soguk-meyveli', 'Berries Fresco', 230, ml: 470),
    _p('soguk-meyveli', 'Dragon Frutta', 230, ml: 470),
    _p('soguk-meyveli', 'Mango Arancio', 230, ml: 470),

    // ── SOFT İÇECEKLER (Soft Drinks + süt bardak) ─────────────
    _p('soft-icecekler', 'Su Uludağ', 40, ml: 400, emoji: '💧'),
    _p('soft-icecekler', 'Soda Uludağ', 70, ml: 200, emoji: '🫧'),
    _p('soft-icecekler', 'Soda Uludağ Premium', 110, ml: 250, emoji: '🫧'),
    _p('soft-icecekler', 'Uludağ Mandalina', 130, ml: 250),
    _p('soft-icecekler', 'Uludağ Limonata', 130, ml: 250, emoji: '🍋'),
    _p('soft-icecekler', 'San Pellegrino', 130, ml: 250, emoji: '🫧'),
    _p('soft-icecekler', 'Cola Şişe', 130, ml: 250),
    _p('soft-icecekler', 'Cola Zero Şişe', 130, ml: 250),
    _p('soft-icecekler', 'Cola Kutu', 130, ml: 330),
    _p('soft-icecekler', 'Cola Zero Kutu', 130, ml: 330),
    _p('soft-icecekler', 'Fanta Kutu', 130, ml: 330),
    _p('soft-icecekler', 'Sprite Kutu', 130, ml: 330),
    _p('soft-icecekler', 'Ocean Drive Blue Hawai', 130, ml: 250),
    _p('soft-icecekler', 'Ocean Drive Mojito', 130, ml: 250),
    _p('soft-icecekler', 'Ocean Drive Cosmopolitan', 130, ml: 250),
    _p('soft-icecekler', 'Flavz Meyve Suyu Kayısı', 170, ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Vişne', 170, ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Elma', 170, ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Nar', 170, ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Portakal', 170,
        ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Elma & Şeftali', 170,
        ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Flavz Meyve Suyu Elma & Pancar', 170,
        ml: 250, emoji: '🧃'),
    _p('soft-icecekler', 'Beyoğlu Gazozu Klasik', 130, ml: 250),
    _p('soft-icecekler', 'Beyoğlu Gazozu Reyhan', 130, ml: 250),
    _p('soft-icecekler', 'Beyoğlu Gazozu Zencefilli', 130, ml: 250),
    _p('soft-icecekler', 'Beyoğlu Gazozu Turuncu', 130, ml: 250),
    _p('soft-icecekler', 'Beyoğlu Gazozu Limon', 130, ml: 250),
    _p('soft-icecekler', 'Elite Organic Portakal Havuç Elma', 170,
        ml: 200, emoji: '🧃'),
    _p('soft-icecekler', 'Elite Organic Karadut', 170, ml: 200, emoji: '🧃'),
    _p('soft-icecekler', 'Elite Organic Defence', 170, ml: 200, emoji: '🧃'),
    _p('soft-icecekler', 'Elite Organic Skinny', 170, ml: 200, emoji: '🧃'),
    _p('soft-icecekler', 'Elite Organic Super Hero', 170,
        ml: 200, emoji: '🧃'),
    _p('soft-icecekler', 'Süt (Bardak)', 60, ml: 250, emoji: '🥛'),

    // ── KAHVALTILIKLAR (Breakfast) ────────────────────────────
    _p('kahvalti', 'Tereyağlı Kruvasan', 160),
    _p('kahvalti', 'Çikolatalı Kruvasan', 180, featured: true),
    _p('kahvalti', 'Danish Üzümlü', 160),
    _p('kahvalti', 'Newyork Roll Kruvasan Çikolatalı', 230),
    _p('kahvalti', 'Newyork Roll Kruvasan Frambuazlı', 230),
    _p('kahvalti', 'Newyork Roll Kruvasan Beyaz Çikolatalı', 230),
    _p('kahvalti', 'Newyork Roll Kruvasan Fıstıklı', 230),

    // ── TATLILAR (Pastalar + Cheesecake + Waffle + Dondurma) ──
    _p('tatlilar', 'Snickers Pasta', 270),
    _p('tatlilar', 'Vişneli Brownie', 260),
    _p('tatlilar', 'Beyaz Çikolatalı Brownie', 260),
    _p('tatlilar', 'Mozaik Pasta', 220),
    _p('tatlilar', 'Frambuazlı Cheesecake', 260, featured: true),
    _p('tatlilar', 'Limonlu Cheesecake', 260),
    _p('tatlilar', 'Tiramisu', 260, featured: true),
    _p('tatlilar', 'Latte Pasta', 260),
    _p('tatlilar', 'Profiterol Pasta', 260),
    _p('tatlilar', 'Red Velvet Pasta', 260),
    _p('tatlilar', 'Magnolia Fıstıklı', 290),
    _p('tatlilar', 'Magnolia Vişneli', 290),
    _p('tatlilar', 'Magnolia Mangolu', 290),
    _p('tatlilar', 'Magnolia Lotus', 290),
    _p('tatlilar', 'Glutensiz Tiramisu Cup', 250),
    _p('tatlilar', 'Glutensiz Frambuazlı Cup', 250),
    _p('tatlilar', 'Glutensiz Çikolatalı Cup', 250),
    _p('tatlilar', 'Elmalı Crumble', 280),
    _p('tatlilar', 'Kestaneli Crumble', 280),
    _p('tatlilar', 'Dondurma (2 Top)', 100, emoji: '🍨'),
    _p('tatlilar', 'Siyah & Beyaz Waffle', 390, emoji: '🧇'),
    _p('tatlilar', 'Çilekli Çikolata Waffle', 390, emoji: '🧇'),
    _p('tatlilar', 'Muzlu Çikolata Waffle', 390, emoji: '🧇'),
    _p('tatlilar', 'Dossi Special Waffle', 460, emoji: '🧇', featured: true),
    _p('tatlilar', 'Oreo Waffle', 390, emoji: '🧇'),
    _p('tatlilar', 'Meyveli Çikolatalı Waffle', 430, emoji: '🧇'),
    _p('tatlilar', 'Dondurmalı Çikolatalı Brownie', 430),

    // ── KEK & KURABİYE (Kek + Kurabiye + Muffin + Donut) ──────
    _p('kek-kurabiye', 'Sweet Çikolatalı Cookie', 130),
    _p('kek-kurabiye', 'Sweet Cookie', 130),
    _p('kek-kurabiye', 'Mermer Kek', 180),
    _p('kek-kurabiye', 'Havuçlu Kek', 180),
    _p('kek-kurabiye', 'Limonlu Kek', 160),
    _p('kek-kurabiye', 'Glutensiz Havuçlu Kek', 260),
    _p('kek-kurabiye', 'Glutensiz Mozaik Kek', 270),
    _p('kek-kurabiye', 'Glutensiz Newyork Cookie', 185),
    _p('kek-kurabiye', 'Ay Çöreği', 105),
    _p('kek-kurabiye', 'Tuzlu Çatal', 90),
    _p('kek-kurabiye', 'Çikolatalı Muffin', 180),
    _p('kek-kurabiye', 'Vişneli Muffin', 180),
    _p('kek-kurabiye', 'Donut Çikolatalı', 170, emoji: '🍩'),
    _p('kek-kurabiye', 'Donut Beyaz Çikolatalı', 170, emoji: '🍩'),
    _p('kek-kurabiye', 'Donut Lotus', 170, emoji: '🍩'),
    _p('kek-kurabiye', 'Donut Çilekli', 170, emoji: '🍩'),

    // ── SANDVİÇ & TOST (Toasted Sandwiches) ───────────────────
    _p('sandvic-tost', 'Dört Peynirli Sandviç', 230, featured: true),
    _p('sandvic-tost', 'Kajun Tavuklu Sandviç', 260),
    _p('sandvic-tost', 'Kuru Domatesli Cevizli Mozzarella Sandviç', 280),
    _p('sandvic-tost', 'Kırmızı Biber Acılı Wrap', 230, emoji: '🌯'),
    _p('sandvic-tost', 'Falafel Hellim Sıcak Dürüm', 230, emoji: '🌯'),
    _p('sandvic-tost', 'Panini Dana Jambon Sandviç', 280),
    _p('sandvic-tost', 'Panini Kahvaltı Sandviç', 240),
    _p('sandvic-tost', 'Panini Roastbeef Sandviç', 290),
    _p('sandvic-tost', 'Las Vegas Üç Peynirli Bagel', 190, emoji: '🥯'),
    _p('sandvic-tost', 'Kare Mozzarella Sandviç', 195),
    _p('sandvic-tost', 'Panini Izgara Tavuklu Sandviç', 265),
    _p('sandvic-tost', 'Panini Hindi Füme Sandviç', 245),

    // ── ATIŞTIRMALIKLAR (Grabs N Go + Çikolata) ───────────────
    _p('atistirmalik', 'Çikolata Sütlü / Bitter / Beyaz', 120, emoji: '🍫'),
    _p('atistirmalik', 'Gramas İncir', 90),
    _p('atistirmalik', 'Çikolatalı Cookie 50 Gr', 100, emoji: '🍪'),
    _p('atistirmalik', 'Kakaolu Cookie 50 Gr', 100, emoji: '🍪'),
    _p('atistirmalik', 'Tuzlu Kare Kurabiye Çörekotlu', 200),
    _p('atistirmalik', 'Tuzlu Kare Kurabiye Keten Tohumlu', 200),
    _p('atistirmalik', 'Tuzlu Kare Kurabiye Susamlı', 200),
    _p('atistirmalik', 'Glutensiz Haşhaşlı Çubuk', 215),
    _p('atistirmalik', 'Glutensiz Hindistan Cevizli Bisküvi Portakallı', 240),
    _p('atistirmalik', 'Glutensiz Hindistan Cevizli Bisküvi Limonlu', 240),
    _p('atistirmalik', 'Glutensiz Hindistan Cevizli Bisküvi Fındıklı', 240),
    _p('atistirmalik', 'Glutensiz Hindistan Cevizli Bisküvi Beyaz Çikolatalı',
        240),
    _p('atistirmalik', 'Glutensiz Çörekotlu Kurabiye', 170),
    _p('atistirmalik', 'Glutensiz Tuzlu Kurabiye', 130),
    _p('atistirmalik', 'Glutensiz Tohumlu Kraker', 145),
    _p('atistirmalik', 'Dereotlu Kurabiye', 180),
    _p('atistirmalik', 'Ayçekirdekli Çubuk', 160),
    _p('atistirmalik', 'Mini Simit', 180, emoji: '🥨'),
    _p('atistirmalik', 'Susamlı (Tahinli) Cookie', 160, emoji: '🍪'),
    _p('atistirmalik', 'Selanik Gevreği', 240),
    _p('atistirmalik', 'Bonibonlu Kurabiye', 180, emoji: '🍪'),
    _p('atistirmalik', 'Munch Peanut Protein Bites', 160),
    _p('atistirmalik', 'Munch Matcha Bites', 140),
    _p('atistirmalik', 'Munch Strawberry Bites', 140),
    _p('atistirmalik', 'Munch Mango Chilli', 140),
    _p('atistirmalik', 'Puff Cheese', 80, emoji: '🧀'),
    _p('atistirmalik', 'Fropie Kuruyemiş Bar Çok Tohumlu', 170),
    _p('atistirmalik', 'Fropie Kuruyemiş Bar Çilekli', 140),
    _p('atistirmalik', 'Fropie Kuruyemiş Bar Fındıklı & Kakaolu', 140),
    _p('atistirmalik', 'Fropie Kuruyemiş Bar Yer Fıstığı Ezmeli & Kakaolu',
        140),
    _p('atistirmalik', 'Fropie Vegan Protein Bar Çilekli', 140),
    _p('atistirmalik', 'Fropie Vegan Protein Bar Fındıklı', 140),
    _p('atistirmalik', 'Fropie Vegan Protein Bar Hindistan Cevizli', 140),
    _p('atistirmalik', 'Fropie Probiyotik Bar Badem & Kakao', 140),
    _p('atistirmalik', 'Fropie Probiyotik Bar Kaju & Chia', 140),
    _p('atistirmalik', 'MC Nuss Fruit Balls Date & Coffee', 60),
    _p('atistirmalik', 'MC Nuss Fruit Balls Date & Pistachio', 60),
    _p('atistirmalik', 'Fit4U Bar Portakallı Yerfıstığı', 80),
    _p('atistirmalik', 'Tafe Portakallı Çikolatalı Lokum Draje', 230),
    _p('atistirmalik', 'Tafe Sütlü Çikolatalı Fındıklı Draje', 290),
    _p('atistirmalik', 'Musclestation Protein Supreme Salted Caramel', 90),
    _p('atistirmalik', 'Musclestation Protein Supreme Peanut Croquant', 90),
    _p('atistirmalik', 'Musclestation Protein Supreme Honey Almond', 90),
    _p('atistirmalik', 'Zbarz Guarana Apple', 120),
    _p('atistirmalik', 'Zbarz Active Espresso Coffee', 120),
    _p('atistirmalik', 'Zbarz Yer Fıstıklı Tuzlu Karamel Proteinli Bar', 120),
    _p('atistirmalik', 'Zbarz Bademli Hindistan Cevizli Proteinli Bar', 120),
    _p('atistirmalik', 'Zbarz Yer Fıstıklı Proteinli Meyve Bar', 120),
    _p('atistirmalik', 'Beyoğlu Çikolata Bite Joy Oreo', 190, emoji: '🍫'),
    _p('atistirmalik', 'Beyoğlu Çikolata Luxury Fıstıklı', 190, emoji: '🍫'),
    _p('atistirmalik', 'Beyoğlu Matchico Matcha Çikolata', 290, emoji: '🍫'),
    _p('atistirmalik', 'Beyoğlu Dubaco Çıtır Kadayıflı Dubai Çikolatası', 290,
        emoji: '🍫', isNew: true),
    _p('atistirmalik', "Macaron 6'lı", 230, emoji: '🍬'),

    // ── ÇEKİRDEK KAHVELER (Coffee Beans) ──────────────────────
    _p('cekirdek', 'Blend / Harman Kahveler 250 Gr', 580),
    _p('cekirdek', 'Origin / Yöresel Kahveler 250 Gr', 580),
    _p('cekirdek', 'Decaf / Kafeinsiz Kahveler 250 Gr', 580),
    _p('cekirdek', 'Türk Kahvesi 100 Gr', 150),
    _p('cekirdek', 'Türk Kahvesi 250 Gr', 350),
    _p('cekirdek', 'Türk Kahvesi 500 Gr', 650),

    // ── TERMOS & MUG (Merchandise) — termoslar 500 ml, 4 renk ─
    _p('merch', 'Termos Turuncu 500 ml', 890,
        emoji: '🧉',
        featured: true,
        desc: 'Çift cidarlı çelik termos, 500 ml — turuncu.',
        images: ['assets/images/termos_turuncu.png']),
    _p('merch', 'Termos Krem 500 ml', 890,
        emoji: '🧉',
        desc: 'Çift cidarlı çelik termos, 500 ml — krem.',
        images: ['assets/images/termos_krem.png']),
    _p('merch', 'Termos Pembe 500 ml', 890,
        emoji: '🧉',
        desc: 'Çift cidarlı çelik termos, 500 ml — pembe.',
        images: ['assets/images/termos_pembe.png']),
    _p('merch', 'Termos Yeşil 500 ml', 890,
        emoji: '🧉',
        desc: 'Çift cidarlı çelik termos, 500 ml — yeşil.',
        images: ['assets/images/termos_yesil.png']),
    _p('merch', 'Mug Konik', 390, emoji: '🏺'),
    _p('merch', 'Mug Terra Cotta', 790, emoji: '🏺'),
  ];

  @override
  Future<List<MenuCategory>> getCategories() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _categories;
  }

  @override
  Future<List<Product>> getProducts() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _products;
  }
}

/// Kategoriye göre varsayılanlar: damga (yalnızca kahveler), emoji, açıklama.
Product _p(
  String categoryId,
  String name,
  double price, {
  int ml = 0,
  String? emoji,
  String? desc,
  bool options = false,
  bool featured = false,
  bool isNew = false,
  List<String> images = const [],
}) {
  const coffeeCategories = {
    'sicak-kahveler',
    'aromali-kahveler',
    'soguk-kahveler',
  };
  const emojis = {
    'sicak-kahveler': '☕',
    'aromali-kahveler': '☕',
    'sicak-cikolatalar': '🍫',
    'caylar': '🍵',
    'soguk-kahveler': '🧋',
    'soguk-caylar': '🧋',
    'soguk-cikolatali': '🥤',
    'soguk-meyveli': '🍓',
    'soft-icecekler': '🥤',
    'kahvalti': '🥐',
    'tatlilar': '🍰',
    'kek-kurabiye': '🍪',
    'sandvic-tost': '🥪',
    'atistirmalik': '🥜',
    'cekirdek': '🫘',
    'merch': '🏺',
  };
  const descriptions = {
    'sicak-kahveler': 'Taze kavrulmuş çekirdeklerle, sipariş üzerine hazırlanır.',
    'aromali-kahveler': 'Ev yapımı şuruplarla hazırlanan imza kahve.',
    'sicak-cikolatalar': 'Yoğun çikolata, buharda ısıtılmış süt.',
    'caylar': 'Demleme ve latte çay çeşitleri.',
    'soguk-kahveler': 'Buz üzerine, ferahlatıcı soğuk kahve.',
    'soguk-caylar': 'Buz gibi servis edilir.',
    'soguk-cikolatali': 'Soğuk çikolata keyfi.',
    'soguk-meyveli': 'Taze meyveli, buz gibi.',
    'soft-icecekler': 'Soğuk servis edilir.',
    'kahvalti': 'Her sabah taze pişer.',
    'tatlilar': 'Günlük üretim, el yapımı tatlı.',
    'kek-kurabiye': 'Günlük üretim, el yapımı.',
    'sandvic-tost': 'Sipariş üzerine taze hazırlanır.',
    'atistirmalik': 'Yanında götürmelik atıştırmalık.',
    'cekirdek': 'Evinde Dosso Dossi keyfi — taze kavrulmuş çekirdek.',
    'merch': 'Dosso Dossi tasarım ürünü.',
  };

  return Product(
    id: _slug(name),
    name: name,
    price: price,
    categoryId: categoryId,
    description: desc ?? descriptions[categoryId] ?? '',
    emoji: emoji ?? emojis[categoryId] ?? '☕',
    sizeMl: ml,
    stampMultiplier: coffeeCategories.contains(categoryId) ? 1 : 0,
    isNew: isNew,
    isFeatured: featured,
    hasOptions: options,
    images: images,
  );
}

String _slug(String value) {
  const turkish = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
  };
  final buffer = StringBuffer();
  for (final char in value.split('')) {
    buffer.write(turkish[char] ?? char.toLowerCase());
  }
  return buffer
      .toString()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}
