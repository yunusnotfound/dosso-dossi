import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_column.dart';
import '../../../routing/app_router.dart';
import '../application/auth_controller.dart';

/// Telefon numarası girişi — SMS kodu bu numaraya "gönderilir" (simüle).
class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _phoneController = TextEditingController();
  bool _sending = false;

  bool get _isValid {
    final digits = _phoneController.text;
    return digits.length == 10 && digits.startsWith('5');
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    setState(() => _sending = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .sendOtp(_phoneController.text);
      if (!mounted) return;
      context.go('${Routes.otp}?tel=${_phoneController.text}');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go(Routes.onboarding)),
      ),
      body: SafeArea(
        child: ScrollableColumn(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('Telefon numaran', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Sana 6 haneli bir doğrulama kodu göndereceğiz.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xxl),
            TextField(
              controller: _phoneController,
              autofocus: true,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              style: AppTypography.title,
              decoration: const InputDecoration(
                prefixText: '+90  ',
                hintText: '5XX XXX XX XX',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _isValid && !_sending ? _sendCode : null,
              child: _sending
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Kod Gönder'),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}
