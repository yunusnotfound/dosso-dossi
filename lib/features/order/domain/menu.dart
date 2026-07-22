/// Menü kategorisi.
class MenuCategory {
  const MenuCategory({required this.id, required this.name});

  final String id;
  final String name;
}

/// Menü ürünü.
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.categoryId,
    required this.description,
    required this.emoji,
    this.sizeMl = 350,
    this.stampMultiplier = 1,
    this.isNew = false,
    this.isFeatured = false,
    this.hasOptions = true,
    this.images = const [],
  });

  final String id;
  final String name;

  /// Orta boy temel fiyat (₺)
  final double price;

  final String categoryId;
  final String description;

  /// Görsel yerine kullanılan simge (gerçek fotoğraflar API ile gelecek)
  final String emoji;

  final int sizeMl;

  /// Sipariş başına kazandırdığı damga (0 = damga yok, 2 = "2x Damga")
  final int stampMultiplier;

  final bool isNew;

  /// "Öne Çıkanlar" sekmesinde görünür
  final bool isFeatured;

  /// Boy/süt/shot seçenekleri var mı (tatlılarda yok)
  final bool hasOptions;

  /// Ürün fotoğrafları (asset yolu). Boşsa emoji yer tutucu gösterilir.
  /// Birden fazla varsa detay ekranında kaydırmalı galeri olur.
  final List<String> images;
}
