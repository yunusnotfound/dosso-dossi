import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/error_feedback.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';
import '../application/account_providers.dart';
import '../domain/account_records.dart';
import 'account_widgets.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with WidgetsBindingObserver {
  Timer? _timer;
  int _page = 1;
  bool _foreground = true;
  String? _opening;
  int _accountGeneration = 0;
  void _resetForAccount() {
    setState(() {
      _accountGeneration++;
      _page = 1;
      _opening = null;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  void _refresh() {
    if (!mounted ||
        !_foreground ||
        ModalRoute.of(context)?.isCurrent == false ||
        !ref.read(accountAccessProvider) ||
        ref.read(inboxProvider(_page)).isLoading) {
      return;
    }
    ref.invalidate(inboxProvider(_page));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) _refresh();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _open(InboxItem item) async {
    if (_opening != null || !ref.read(accountAccessProvider)) return;
    final scope = ref.read(sessionScopeProvider);
    final epoch = scope.revision;
    final generation = _accountGeneration;
    final repository = ref.read(accountRepositoryProvider);
    bool current() =>
        mounted &&
        epoch == scope.revision &&
        generation == _accountGeneration &&
        ref.read(accountAccessProvider) &&
        identical(ref.read(accountRepositoryProvider), repository);
    setState(() => _opening = item.id);
    try {
      if (item.readAt == null) {
        await repository.markRead(item.id);
      }
      if (!mounted || !current()) return;
      ref.invalidate(inboxProvider);
      final target = safeNotificationTarget(item.targetPath);
      if (target != null) await context.push(target);
    } catch (error) {
      if (mounted && current()) showApiError(context, error);
    } finally {
      if (mounted && generation == _accountGeneration) {
        setState(() => _opening = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(accountRepositoryProvider, (previous, next) {
      if (!identical(previous, next)) _resetForAccount();
    });
    ref.listen(accountAccessProvider, (previous, next) {
      if (previous != next) _resetForAccount();
    });
    final data = ref.watch(inboxProvider(_page));
    return ScrollablePageScaffold(
      title: 'Bildirimler',
      children: [
        if (!ref.watch(accountAccessProvider))
          const Text('Bu sayfa için hesabına giriş yapmalısın.')
        else ...[
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Yenile'),
            ),
          ),
          data.when(
            data: (value) => Column(
              children: [
                if (value.entries.isEmpty)
                  const AccountCard(
                    child: Text(
                      'Henüz bildirimin yok. Yeni gelişmeler burada görünecek.',
                    ),
                  ),
                for (final item in value.entries)
                  AccountCard(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        item.readAt == null
                            ? Icons.notifications_active_outlined
                            : Icons.notifications_none,
                        color: item.readAt == null
                            ? AppColors.primary
                            : AppColors.textSecondary,
                      ),
                      title: Text(
                        item.title,
                        style: TextStyle(
                          fontWeight: item.readAt == null
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Text(item.body),
                      ),
                      trailing: _opening == item.id
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : null,
                      onTap: _opening == null ? () => _open(item) : null,
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: _page > 1
                          ? () => setState(() => _page--)
                          : null,
                      child: const Text('Önceki'),
                    ),
                    Text('Sayfa $_page'),
                    TextButton(
                      onPressed: value.hasMore
                          ? () => setState(() => _page++)
                          : null,
                      child: const Text('Sonraki'),
                    ),
                  ],
                ),
              ],
            ),
            error: (_, _) => AccountLoadError(
              retry: () => ref.invalidate(inboxProvider(_page)),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
          ),
        ],
      ],
    );
  }
}
