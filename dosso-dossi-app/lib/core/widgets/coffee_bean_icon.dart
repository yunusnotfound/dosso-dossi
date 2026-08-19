import 'package:flutter/material.dart';

/// Kahve çekirdeği ikonu — Material Icons'ta karşılığı olmadığı için çizilir.
/// Icon() ile aynı şekilde size + color alır; damga rozetlerinde kullanılır.
class CoffeeBeanIcon extends StatelessWidget {
  const CoffeeBeanIcon({super.key, this.size = 18, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _CoffeeBeanPainter(color)),
    );
  }
}

class _CoffeeBeanPainter extends CustomPainter {
  const _CoffeeBeanPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    if (s <= 0) return;

    // Gövde: uzun ekseni dikey elips (kutuyu tam doldurmaz, ikon ağırlığı
    // eski fincan glyph'iyle benzer kalsın diye).
    final body = Path()
      ..addOval(Rect.fromCenter(
        center: Offset.zero,
        width: s * 0.60,
        height: s * 0.86,
      ));

    // Ortadaki yarık: uzun eksen boyunca S kıvrımı. Uç noktalar ve kıvrım
    // genliği, yuvarlak uçlu fırça gövdenin dışına taşmayacak şekilde seçildi.
    final crease = Path()
      ..moveTo(0, -s * 0.34)
      ..cubicTo(-s * 0.17, -s * 0.17, s * 0.17, s * 0.17, 0, s * 0.34);

    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(-0.60); // ~ -34°, çekirdek çapraz dursun.

    // Yarık, her zeminde (dolu turuncu / şeffaf pasif damga) doğru görünsün
    // diye sabit renkle boyanmaz; gövdeden delinir.
    canvas.saveLayer(Rect.fromCenter(center: Offset.zero, width: s * 2, height: s * 2), Paint());
    canvas.drawPath(body, Paint()..color = color);
    canvas.drawPath(
      crease,
      Paint()
        ..blendMode = BlendMode.clear
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.13
        ..strokeCap = StrokeCap.round,
    );
    canvas.restore();

    canvas.restore();
  }

  @override
  bool shouldRepaint(_CoffeeBeanPainter oldDelegate) =>
      oldDelegate.color != color;
}
