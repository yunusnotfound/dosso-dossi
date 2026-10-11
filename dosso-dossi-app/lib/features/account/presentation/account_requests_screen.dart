import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/error_feedback.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';
import '../../../routing/app_router.dart';
import '../application/account_providers.dart';
import '../data/account_repository.dart';
import 'account_widgets.dart';

class AccountRequestsScreen extends ConsumerStatefulWidget {
  const AccountRequestsScreen({super.key});
  @override
  ConsumerState<AccountRequestsScreen> createState() =>
      _AccountRequestsScreenState();
}

class _AccountRequestsScreenState extends ConsumerState<AccountRequestsScreen> {
  final _note = TextEditingController();
  String _kind = 'DATA_EXPORT';
  bool _busy = false;
  int _accountGeneration = 0;

  void _resetForAccount() {
    setState(() {
      _accountGeneration++;
      _busy = false;
      _kind = 'DATA_EXPORT';
      _note.clear();
    });
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final kind = _kind;
    final note = _note.text.trim();
    await _run(
      (repository) => repository.submit(kind, note),
      clearNote: true,
      confirm: kind != 'CLOSURE'
          ? null
          : () => showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Hesap kapatma talebi'),
                content: const Text(
                  'Talebin ekip tarafından incelenecek. Hesabın kapatıldığında giriş yapamayacaksın. Saklamak istediğin verileri önce dışa aktar. İşlem kayıtları saklama yükümlülükleri kapsamında tutulabilir.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Vazgeç'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Talep oluştur'),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _run(
    Future<void> Function(AccountRepository repository) action, {
    bool clearNote = false,
    Future<bool?> Function()? confirm,
  }) async {
    if (_busy || !ref.read(accountAccessProvider)) return;
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
    setState(() => _busy = true);
    try {
      if (confirm != null && await confirm() != true) return;
      if (!current()) return;
      await action(repository);
      if (!current()) return;
      if (clearNote) _note.clear();
      ref.invalidate(accountRequestsProvider);
    } catch (error) {
      if (mounted && current()) showApiError(context, error);
    } finally {
      if (mounted && generation == _accountGeneration) {
        setState(() => _busy = false);
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
    final access = ref.watch(accountAccessProvider);
    final requests = ref.watch(accountRequestsProvider);
    final duplicate =
        requests.value?.any((r) => r.kind == _kind && r.active) ?? false;
    return ScrollablePageScaffold(
      title: 'Hesap ve Veri',
      children: [
        if (!access)
          const Text('Bu sayfa için hesabına giriş yapmalısın.')
        else ...[
          AccountCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hesabının kontrolü sende', style: AppTypography.title),
                const SizedBox(height: AppSpacing.sm),
                const Text(
                  'Kayıtlı verilerini görüntüleyebilir, veri veya hesap kapatma talebi oluşturabilirsin.',
                ),
                TextButton.icon(
                  onPressed: () => context.push(Routes.dataExport),
                  icon: const Icon(Icons.description_outlined),
                  label: const Text('Verilerimi görüntüle'),
                ),
              ],
            ),
          ),
          AccountCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  key: ValueKey(_accountGeneration),
                  initialValue: _kind,
                  decoration: const InputDecoration(labelText: 'Talep türü'),
                  items: const [
                    DropdownMenuItem(
                      value: 'DATA_EXPORT',
                      child: Text('Veri talebi'),
                    ),
                    DropdownMenuItem(
                      value: 'CLOSURE',
                      child: Text('Hesap kapatma'),
                    ),
                  ],
                  onChanged: _busy ? null : (v) => setState(() => _kind = v!),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_kind == 'CLOSURE')
                  const Text(
                    'Kapatma için bakiyenin ve devam eden sipariş, yükleme ve hediye işlemlerinin sonuçlanması gerekir.',
                  ),
                TextField(
                  controller: _note,
                  enabled: !_busy,
                  maxLength: 1000,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Notun (isteğe bağlı)',
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                if (duplicate)
                  const Text('Bu türde devam eden bir talebin var.'),
                FilledButton(
                  onPressed:
                      _busy ||
                          duplicate ||
                          requests.isLoading ||
                          requests.hasError
                      ? null
                      : _submit,
                  child: Text(_busy ? 'Gönderiliyor…' : 'Talep oluştur'),
                ),
              ],
            ),
          ),
          Text('Taleplerim', style: AppTypography.title),
          const SizedBox(height: AppSpacing.md),
          requests.when(
            data: (items) => Column(
              children: [
                if (items.isEmpty)
                  const AccountCard(child: Text('Henüz bir talebin yok.')),
                for (final item in items)
                  AccountRequestCard(
                    request: item,
                    onCancel: _busy
                        ? null
                        : () =>
                              _run((repository) => repository.cancel(item.id)),
                  ),
              ],
            ),
            error: (_, _) => AccountLoadError(
              retry: () => ref.invalidate(accountRequestsProvider),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
          ),
        ],
      ],
    );
  }
}
