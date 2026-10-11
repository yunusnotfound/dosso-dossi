import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../domain/account_records.dart';

class AccountCard extends StatelessWidget {
  const AccountCard({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: AppSpacing.md),
    padding: const EdgeInsets.all(AppSpacing.lg),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
    ),
    child: child,
  );
}

class AccountLoadError extends StatelessWidget {
  const AccountLoadError({super.key, required this.retry});
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => AccountCard(
    child: Column(
      children: [
        const Text('Bilgiler yüklenemedi. Tekrar deneyebilirsin.'),
        TextButton(onPressed: retry, child: const Text('Tekrar dene')),
      ],
    ),
  );
}

class AccountRequestCard extends StatelessWidget {
  const AccountRequestCard({
    super.key,
    required this.request,
    required this.onCancel,
  });
  final AccountRequest request;
  final VoidCallback? onCancel;
  @override
  Widget build(BuildContext context) => AccountCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(request.title, style: AppTypography.title),
        const SizedBox(height: AppSpacing.sm),
        Text(
          request.statusLabel,
          style: AppTypography.body.copyWith(color: AppColors.coffeeDark),
        ),
        if (request.note.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(request.note),
        ],
        if (request.response.isNotEmpty) ...[
          const Divider(),
          Text(request.response),
        ],
        if (request.active)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: onCancel,
              child: const Text('Talebi iptal et'),
            ),
          ),
      ],
    ),
  );
}
