import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';

/// Yalnızca işletmenin yayımladığı onaylı metne yönlendirilir.
final privacyPolicyUriProvider = Provider<Uri?>((ref) {
  return privacyPolicyUri(const String.fromEnvironment('PRIVACY_POLICY_URL'));
});

Uri? privacyPolicyUri(String value) {
  final uri = Uri.tryParse(value.trim());
  return uri != null &&
          uri.scheme == 'https' &&
          uri.host.isNotEmpty &&
          uri.userInfo.isEmpty
      ? uri
      : null;
}

class KvkkScreen extends ConsumerWidget {
  const KvkkScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policyUri = ref.watch(privacyPolicyUriProvider);
    return ScrollablePageScaffold(
      title: 'KVKK ve Gizlilik',
      children: [
        Text(
          policyUri == null
              ? 'Gizlilik metnine şu anda erişilemiyor.'
              : 'Kişisel verilerinle ilgili aydınlatma ve gizlilik metnini inceleyebilirsin.',
          style: AppTypography.body,
        ),
        const SizedBox(height: AppSpacing.lg),
        if (policyUri == null)
          Text(
            'Bilgi almak için şubelerimizle iletişime geçebilirsin.',
            style: AppTypography.bodySecondary,
          )
        else
          FilledButton.icon(
            icon: const Icon(Icons.open_in_new),
            label: const Text('Gizlilik metnini aç'),
            onPressed: () async {
              var opened = false;
              try {
                opened = await launchUrl(
                  policyUri,
                  mode: LaunchMode.externalApplication,
                );
              } catch (_) {}
              if (!opened && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Gizlilik metni açılamadı. Lütfen tekrar dene.',
                    ),
                  ),
                );
              }
            },
          ),
      ],
    );
  }
}
