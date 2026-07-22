import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_column.dart';
import '../../../routing/app_router.dart';
import '../application/auth_controller.dart';

/// 6 haneli SMS kodu doğrulama ekranı.
/// Simülasyonda herhangi bir 6 haneli kod geçerlidir ('000000' hariç).
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.phone});

  final String phone;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _codeLength = 6;
  static const _resendSeconds = 60;

  final _codeController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _timer;
  int _secondsLeft = _resendSeconds;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() => _secondsLeft = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 1) {
        timer.cancel();
      }
      setState(() => _secondsLeft = _secondsLeft > 0 ? _secondsLeft - 1 : 0);
    });
  }

  Future<void> _resend() async {
    await ref.read(authControllerProvider.notifier).sendOtp(widget.phone);
    if (!mounted) return;
    _codeController.clear();
    _startCountdown();
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Yeni kod gönderildi')));
  }

  Future<void> _verify(String code) async {
    setState(() => _verifying = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .verifyOtp(phone: widget.phone, code: code);
      // Başarılıysa router yönlendirmesi otomatik çalışır (isim adımı veya ana sayfa).
    } catch (e) {
      if (!mounted) return;
      _codeController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.danger,
          content: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = _codeController.text;

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go(Routes.login)),
      ),
      body: SafeArea(
        child: ScrollableColumn(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('Kodu gir', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '+90 ${widget.phone} numarasına gönderilen 6 haneli kodu gir.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xxl),
            GestureDetector(
              onTap: _focusNode.requestFocus,
              child: Stack(
                children: [
                  // Gizli gerçek giriş alanı — kutular sadece görsel.
                  Opacity(
                    opacity: 0,
                    child: TextField(
                      controller: _codeController,
                      focusNode: _focusNode,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(_codeLength),
                      ],
                      onChanged: (value) {
                        setState(() {});
                        if (value.length == _codeLength && !_verifying) {
                          _verify(value);
                        }
                      },
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(_codeLength, (i) {
                      final filled = i < code.length;
                      final active = i == code.length;
                      return Container(
                        width: 48,
                        height: 58,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                          border: Border.all(
                            width: 2,
                            color: active
                                ? AppColors.primary
                                : filled
                                ? AppColors.coffeeDark
                                : AppColors.divider,
                          ),
                        ),
                        child: Text(
                          filled ? code[i] : '',
                          style: AppTypography.title.copyWith(fontSize: 22),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
            Center(
              child: _secondsLeft > 0
                  ? Text(
                      'Tekrar gönder: $_secondsLeft sn',
                      style: AppTypography.bodySecondary,
                    )
                  : TextButton(
                      onPressed: _resend,
                      child: Text(
                        'Kodu Tekrar Gönder',
                        style: AppTypography.body.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ),
            ),
            if (_verifying) ...[
              const SizedBox(height: AppSpacing.xxl),
              const Center(child: CircularProgressIndicator()),
            ],
          ],
        ),
      ),
    );
  }
}
