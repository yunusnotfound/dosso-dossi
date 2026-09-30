import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// Başlık ve geri düğmesi dahil tüm içeriği ekran boyunca kaydırılan sayfa.
/// Güvenli alan boşluğu sabit bir bant yerine kaydırılan içeriğe eklenir.
class ScrollablePageScaffold extends StatelessWidget {
  const ScrollablePageScaffold({
    super.key,
    required this.title,
    required List<Widget> children,
    this.titleStyle,
  }) : _children = children,
       _slivers = null;

  const ScrollablePageScaffold.slivers({
    super.key,
    required this.title,
    required List<Widget> slivers,
    this.titleStyle,
  }) : _slivers = slivers,
       _children = null;

  final String title;
  final TextStyle? titleStyle;
  final List<Widget>? _children;
  final List<Widget>? _slivers;

  @override
  Widget build(BuildContext context) {
    final insets = MediaQuery.paddingOf(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: SafeArea(
          top: false,
          bottom: false,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  insets.top + AppSpacing.sm,
                  AppSpacing.page,
                  AppSpacing.lg,
                ),
                sliver: SliverToBoxAdapter(
                  child: Row(
                    children: [
                      if (Navigator.of(context).canPop()) ...[
                        const BackButton(),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: Text(
                            title,
                            style: titleStyle ?? AppTypography.headline,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  0,
                  AppSpacing.page,
                  insets.bottom + AppSpacing.page,
                ),
                sliver: _children != null
                    ? SliverList.list(children: _children)
                    : SliverMainAxisGroup(slivers: _slivers!),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
