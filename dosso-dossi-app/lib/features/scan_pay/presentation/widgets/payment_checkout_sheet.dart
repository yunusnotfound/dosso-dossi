import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/session_scope.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../rewards/application/loyalty_providers.dart';
import '../../../wallet/application/wallet_providers.dart';
import '../../../wallet/data/wallet_repository.dart';
import '../../../auth/application/auth_controller.dart';

/// Reject lookalike hosts, user-info URLs and unexpected hosted checkout paths.
Uri? trustedIyzicoCheckout(String? value) {
  final uri = value == null ? null : Uri.tryParse(value);
  if (uri == null ||
      uri.scheme != 'https' ||
      uri.userInfo.isNotEmpty ||
      uri.port != 443 ||
      uri.hasFragment) {
    return null;
  }
  const hosted = {'cpp.iyzipay.com', 'sandbox-cpp.iyzipay.com'};
  const legacy = {'api.iyzipay.com', 'sandbox-api.iyzipay.com'};
  if (!hosted.contains(uri.host) &&
      !(legacy.contains(uri.host) && uri.path.startsWith('/checkoutform/'))) {
    return null;
  }
  return uri;
}

final pendingWalletPaymentProvider = FutureProvider.autoDispose<TopUpResult?>((
  ref,
) {
  final user = ref.watch(authControllerProvider).value;
  if (user == null) return null;
  return ref.watch(walletRepositoryProvider).getPendingPayment();
});

final walletPaymentConfigProvider = FutureProvider.autoDispose<PaymentConfig>((
  ref,
) {
  ref.watch(authControllerProvider);
  return ref.watch(walletRepositoryProvider).getPaymentConfig();
});

enum PaymentCheckoutAction { done, newAttempt }

Future<PaymentCheckoutAction?> showPaymentCheckout(
  BuildContext context,
  TopUpResult receipt, {
  bool openBrowser = false,
  bool allowNewAttempt = false,
}) => showModalBottomSheet<PaymentCheckoutAction>(
  context: context,
  useRootNavigator: true,
  isScrollControlled: true,
  backgroundColor: AppColors.background,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
  ),
  builder: (_) => PaymentCheckoutSheet(
    initial: receipt,
    openBrowser: openBrowser,
    allowNewAttempt: allowNewAttempt,
  ),
);

class PaymentCheckoutSheet extends ConsumerStatefulWidget {
  const PaymentCheckoutSheet({
    super.key,
    required this.initial,
    this.openBrowser = false,
    this.allowNewAttempt = false,
  });
  final TopUpResult initial;
  final bool openBrowser;
  final bool allowNewAttempt;
  @override
  ConsumerState<PaymentCheckoutSheet> createState() =>
      _PaymentCheckoutSheetState();
}

class _PaymentCheckoutSheetState extends ConsumerState<PaymentCheckoutSheet>
    with WidgetsBindingObserver {
  late TopUpResult _receipt;
  late final SessionScope _scope;
  late final int _epoch;
  Timer? _timer;
  bool _checking = false;
  bool _opening = false;
  bool _foreground = true;
  String? _notice;
  int _attempts = 0;
  bool get _current => mounted && _scope.revision == _epoch;

  @override
  void initState() {
    super.initState();
    _receipt = widget.initial;
    _scope = ref.read(sessionScopeProvider);
    _epoch = _scope.revision;
    WidgetsBinding.instance.addObserver(this);
    _schedule();
    if (widget.openBrowser && !_receipt.checkoutExpired) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _open());
    }
  }

  void _schedule() {
    _timer?.cancel();
    if (_current && _foreground && _receipt.isPending && _attempts < 120) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) => _check());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) {
      _attempts = 0;
      _check();
    }
    _schedule();
  }

  Future<void> _open() async {
    if (!_current ||
        _opening ||
        !_receipt.isPending ||
        _receipt.checkoutExpired) {
      return;
    }
    final uri = trustedIyzicoCheckout(_receipt.redirectUrl);
    if (uri == null) {
      setState(
        () => _notice =
            'Ödeme sayfası henüz hazır değil. Durumu tekrar kontrol et.',
      );
      return;
    }
    setState(() => _opening = true);
    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (_current && !opened) {
        setState(
          () => _notice =
              'Tarayıcı açılamadı. Ödeme sayfasını tekrar açabilirsin.',
        );
      }
    } catch (_) {
      if (_current) {
        setState(() => _notice = 'Ödeme sayfası açılamadı. Tekrar dene.');
      }
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  Future<void> _check() async {
    if (!_current || _checking || !_receipt.isPending || !_foreground) {
      return;
    }
    setState(() => _checking = true);
    _attempts++;
    try {
      final result = await ref
          .read(walletRepositoryProvider)
          .getPaymentStatus(_receipt.paymentId!);
      if (!_current) return;
      setState(() {
        _receipt = result;
        _notice = null;
      });
      if (result.isTerminal) {
        ref.invalidate(walletProvider);
        ref.invalidate(loyaltyStatusProvider);
        ref.invalidate(pendingWalletPaymentProvider);
      }
    } catch (_) {
      if (_current) {
        setState(
          () => _notice =
              'Sonuç şu an doğrulanamadı. Bağlantını kontrol edip tekrar deneyebilirsin.',
        );
      }
    } finally {
      if (mounted) setState(() => _checking = false);
      _schedule();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pending = _receipt.isPending;
    final success = _receipt.isSucceeded;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              pending
                  ? Icons.lock_outline
                  : success
                  ? Icons.check_circle_outline
                  : Icons.info_outline,
              color: success ? AppColors.success : AppColors.primary,
              size: 36,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              pending
                  ? (_receipt.checkoutExpired
                        ? 'Ödeme sayfasının süresi doldu'
                        : 'Ödemenin sonucu bekleniyor')
                  : success
                  ? 'Bakiye yüklendi'
                  : _receipt.status == 'expired'
                  ? 'Ödeme oturumunun süresi doldu'
                  : 'Ödeme tamamlanamadı',
              style: AppTypography.title,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              pending
                  ? (_receipt.checkoutExpired
                        ? 'Sonuç kontrol edilmeye devam ediyor. Banka hesabından çekim olduysa yeni yükleme başlatma; ödeme sonucunu kontrol et.'
                        : 'iyzico sayfasında ödemeyi tamamla ve uygulamaya dön. '
                              'Bakiye yalnızca ödeme sunucuda doğrulandıktan sonra eklenir.')
                  : success
                  ? 'Güncel bakiyen ${formatTl(_receipt.balance)}.'
                        '${_receipt.bonusDrinks > 0 ? ' ${_receipt.bonusDrinks} ikram kahve kazandın.' : ''}'
                  : 'Bu işlem için bakiye eklenmedi. Yeni bir yükleme başlatabilirsin.',
              style: AppTypography.bodySecondary,
            ),
            if (_notice != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(_notice!, style: AppTypography.bodySecondary),
            ],
            const SizedBox(height: AppSpacing.xl),
            if (pending) ...[
              if (!_receipt.checkoutExpired &&
                  trustedIyzicoCheckout(_receipt.redirectUrl) != null)
                FilledButton(
                  onPressed: _opening ? null : _open,
                  child: const Text('iyzico ödeme sayfasını aç'),
                ),
              TextButton(
                onPressed: _checking
                    ? null
                    : () {
                        _attempts = 0;
                        _check();
                      },
                child: Text(
                  _checking ? 'Kontrol ediliyor…' : 'Ödeme sonucunu kontrol et',
                ),
              ),
              if (_receipt.checkoutExpired && widget.allowNewAttempt)
                TextButton(
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Yeni yükleme başlatılsın mı?'),
                        content: const Text(
                          'Önceki ödeme hâlâ kontrol ediliyor. Bankanda çekim veya bekleyen provizyon varsa önce sonucu bekle.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Bekle'),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Yeni yükleme'),
                          ),
                        ],
                      ),
                    );
                    if (confirmed == true && mounted && context.mounted) {
                      Navigator.of(
                        context,
                      ).pop(PaymentCheckoutAction.newAttempt);
                    }
                  },
                  child: const Text('Yeni yükleme'),
                ),
              TextButton(
                onPressed: () =>
                    Navigator.of(context).pop(PaymentCheckoutAction.done),
                child: const Text('Daha sonra kontrol et'),
              ),
            ] else
              FilledButton(
                onPressed: () =>
                    Navigator.of(context).pop(PaymentCheckoutAction.done),
                child: const Text('Tamam'),
              ),
          ],
        ),
      ),
    );
  }
}

/// Server-backed recovery also works when the app closes before an init response.
class PendingPaymentBanner extends ConsumerStatefulWidget {
  const PendingPaymentBanner({super.key});
  @override
  ConsumerState<PendingPaymentBanner> createState() =>
      _PendingPaymentBannerState();
}

class _PendingPaymentBannerState extends ConsumerState<PendingPaymentBanner>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      ref.invalidate(pendingWalletPaymentProvider);
      ref.invalidate(walletProvider);
      ref.invalidate(loyaltyStatusProvider);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final payment = ref.watch(pendingWalletPaymentProvider).value;
    if (payment == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Material(
        color: AppColors.surfaceTint,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: ListTile(
          leading: const Icon(Icons.receipt_long, color: AppColors.primary),
          title: Text(
            payment.isPending
                ? 'Devam eden yüklemen var'
                : 'Son yüklemenin sonucu hazır',
          ),
          subtitle: const Text('Ödeme durumunu görüntüle'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            await showPaymentCheckout(context, payment);
            if (mounted) ref.invalidate(pendingWalletPaymentProvider);
          },
        ),
      ),
    );
  }
}
