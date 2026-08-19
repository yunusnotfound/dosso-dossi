import 'package:flutter/material.dart';

/// Kart zeminlerinde kullanılan marka görseli (Venedik tablosu).
/// Kadraj kartın çan kulesi + gece göğü bandına denk gelecek şekilde ayarlıdır;
/// tek yerden değiştirmek için [alignment] varsayılanını düzenle.
class BrandArtwork extends StatelessWidget {
  const BrandArtwork({super.key, this.alignment = const Alignment(0, -0.65)});

  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/kart_arka_plan.jpg',
      fit: BoxFit.cover,
      alignment: alignment,
    );
  }
}
