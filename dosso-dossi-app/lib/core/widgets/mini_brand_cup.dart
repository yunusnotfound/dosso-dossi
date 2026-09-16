import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'brand_logo.dart';

/// Elle çizilmiş kapaklı marka bardağının küçük hâli: turuncu kapak, krem
/// gövde, koyu bant ve bandın ortasında beyaz daire içinde marka logosu.
/// Damga şeritlerinin ödül halkasında hediye ikonu yerine kullanılır.
class MiniBrandCup extends StatelessWidget {
  const MiniBrandCup({super.key, required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    final width = height * 0.74;
    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(child: CustomPaint(painter: _CupPainter())),
          // Bandın (0.40h–0.82h) tam ortasına oturur.
          Positioned(
            top: height * 0.404,
            child: BrandLogo(size: width * 0.56),
          ),
        ],
      ),
    );
  }
}

class _CupPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Kapak: üst kubbe + geniş kenar.
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        Rect.fromLTRB(w * 0.14, h * 0.02, w * 0.86, h * 0.12),
        topLeft: Radius.circular(w * 0.08),
        topRight: Radius.circular(w * 0.08),
      ),
      Paint()..color = AppColors.primary,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(w * 0.02, h * 0.10, w * 0.98, h * 0.185),
        Radius.circular(w * 0.04),
      ),
      Paint()
        ..color = Color.lerp(AppColors.primary, AppColors.coffeeDark, 0.25)!,
    );

    // Gövde: alta doğru daralan, alt köşeleri yuvarlatılmış karton bardak.
    final body = Path()
      ..moveTo(w * 0.07, h * 0.185)
      ..lineTo(w * 0.93, h * 0.185)
      ..lineTo(w * 0.81, h * 0.955)
      ..quadraticBezierTo(w * 0.80, h, w * 0.74, h)
      ..lineTo(w * 0.26, h)
      ..quadraticBezierTo(w * 0.20, h, w * 0.19, h * 0.955)
      ..close();
    canvas.drawPath(body, Paint()..color = const Color(0xFFFBF6EC));

    // Bant: açık zeminde kaybolmasın diye koyu kahve; logo bunun üstüne oturur.
    canvas.save();
    canvas.clipPath(body);
    canvas.drawRect(
      Rect.fromLTRB(0, h * 0.40, w, h * 0.82),
      Paint()..color = AppColors.onGold,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CupPainter oldDelegate) => false;
}
