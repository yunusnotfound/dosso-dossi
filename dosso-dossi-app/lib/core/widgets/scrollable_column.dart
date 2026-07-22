import 'package:flutter/material.dart';

/// "Bottom overflow" önleyici sütun: klavye açıldığında veya küçük ekranlarda
/// içerik sığmazsa kayar; sığıyorsa Spacer'lar sayfayı normal doldurur.
/// Sabit yükseklikli Column + Spacer düzeni kullanan tüm ekranlarda kullanılır.
class ScrollableColumn extends StatelessWidget {
  const ScrollableColumn({
    super.key,
    required this.children,
    this.padding = EdgeInsets.zero,
    this.crossAxisAlignment = CrossAxisAlignment.start,
  });

  final List<Widget> children;
  final EdgeInsetsGeometry padding;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: IntrinsicHeight(
            child: Padding(
              padding: padding,
              child: Column(
                crossAxisAlignment: crossAxisAlignment,
                children: children,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
