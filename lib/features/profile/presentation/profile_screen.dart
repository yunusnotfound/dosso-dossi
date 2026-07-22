import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../routing/app_router.dart';
import '../../auth/application/auth_controller.dart';
import '../../favorites/application/favorites_controller.dart';
import '../../order/application/order_providers.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';

/// Profil: hesap, ödeme, siparişler ve diğer bölümleri (mockup birebir).
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    final loyalty = ref.watch(loyaltyStatusProvider).value;
    final wallet = ref.watch(walletProvider).value;
    final orders = ref.watch(ordersProvider);
    final favoritesCount = ref.watch(favoritesProvider).length;

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: AppColors.primary,
                  child: Text(
                    initialsOf(user?.name ?? ''),
                    style: AppTypography.headline.copyWith(color: Colors.white),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name ?? '', style: AppTypography.headline),
                      Text(
                        user != null && user.email.isNotEmpty
                            ? user.email
                            : '+90 ${user?.phone ?? ''}',
                        style: AppTypography.bodySecondary,
                      ),
                      if (loyalty != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.xs),
                          decoration: BoxDecoration(
                            color: AppColors.gold,
                            borderRadius:
                                BorderRadius.circular(AppRadius.pill),
                          ),
                          child: Text(
                            '☕ ${loyalty.stamps}/${loyalty.target} damga · ikrama ${loyalty.remaining} kahve',
                            style: AppTypography.badge.copyWith(
                                fontSize: 12, color: AppColors.onGold),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xxl),
            _Section(
              label: 'HESAP',
              rows: [
                _RowData(
                  icon: Icons.person_outline,
                  title: 'Kişisel Bilgiler',
                  onTap: () => context.push(Routes.personalInfo),
                ),
                _RowData(
                  icon: Icons.notifications_outlined,
                  title: 'Bildirim Tercihleri',
                  onTap: () => context.push(Routes.notificationPrefs),
                ),
              ],
            ),
            _Section(
              label: 'ÖDEME',
              rows: [
                _RowData(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Dosso Kart',
                  trailing: wallet == null ? null : formatTl(wallet.balance),
                  onTap: () => context.go(Routes.scanPay),
                ),
                _RowData(
                  icon: Icons.credit_card,
                  title: 'Kayıtlı Kartlar',
                  trailing: 'Visa •7412',
                  onTap: () => context.push(Routes.savedCards),
                ),
              ],
            ),
            _Section(
              label: 'SİPARİŞLER',
              rows: [
                _RowData(
                  icon: Icons.schedule,
                  title: 'Geçmiş Siparişler',
                  trailing: orders.isEmpty
                      ? null
                      : '${formatDayMonth(orders.first.createdAt)} · ${formatTl(orders.first.total)}',
                  onTap: () => context.push(Routes.orderHistory),
                ),
                _RowData(
                  icon: Icons.favorite_outline,
                  title: 'Favorilerim',
                  trailing: favoritesCount == 0 ? null : '$favoritesCount',
                  onTap: () => context.push(Routes.favorites),
                ),
              ],
            ),
            _Section(
              label: 'DİĞER',
              rows: [
                _RowData(
                  icon: Icons.storefront_outlined,
                  title: 'Şubeler',
                  onTap: () => context.push(Routes.branchList),
                ),
                _RowData(
                  icon: Icons.help_outline,
                  title: 'Yardım & SSS',
                  onTap: () => context.push(Routes.faq),
                ),
                _RowData(
                  icon: Icons.shield_outlined,
                  title: 'KVKK ve Gizlilik',
                  onTap: () => context.push(Routes.kvkk),
                ),
                _RowData(
                  icon: Icons.logout,
                  title: 'Çıkış Yap',
                  danger: true,
                  onTap: () =>
                      ref.read(authControllerProvider.notifier).logout(),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: Text('Dosso Dossi v1.0.0',
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13)),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _RowData {
  const _RowData({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
    this.danger = false,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final String? trailing;
  final bool danger;
}

class _Section extends StatelessWidget {
  const _Section({required this.label, required this.rows});

  final String label;
  final List<_RowData> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.sectionLabel),
        const SizedBox(height: AppSpacing.md),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(indent: 72),
                _SectionRow(data: rows[i]),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}

class _SectionRow extends StatelessWidget {
  const _SectionRow({required this.data});

  final _RowData data;

  @override
  Widget build(BuildContext context) {
    final color = data.danger ? AppColors.danger : AppColors.textPrimary;

    return InkWell(
      onTap: data.onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color:
                    data.danger ? AppColors.dangerSoft : AppColors.surfaceTint,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(data.icon,
                  size: 20,
                  color: data.danger ? AppColors.danger : AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(data.title,
                  style: AppTypography.body.copyWith(color: color)),
            ),
            if (data.trailing != null) ...[
              Text(data.trailing!, style: AppTypography.bodySecondary),
              const SizedBox(width: AppSpacing.xs),
            ],
            if (!data.danger)
              const Icon(Icons.chevron_right,
                  size: 20, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
