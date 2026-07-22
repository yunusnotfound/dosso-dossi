import 'package:flutter/material.dart';

/// Dosso Dossi Coffee resmi logosu (assets/images/logo.png — şeffaf zeminli).
/// Beyaz daire içinde, kenarlardan taşmadan gösterir; boyut vermek yeterli.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: Colors.white,
        padding: EdgeInsets.all(size * 0.04),
        child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
      ),
    );
  }
}
