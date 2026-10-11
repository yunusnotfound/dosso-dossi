import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/network/session_scope.dart';
import '../../../core/utils/error_feedback.dart';
import '../../../core/widgets/scrollable_page_scaffold.dart';
import '../application/account_providers.dart';
import 'account_widgets.dart';

class DataExportScreen extends ConsumerStatefulWidget {
  const DataExportScreen({super.key});
  @override
  ConsumerState<DataExportScreen> createState() => _DataExportScreenState();
}

class _DataExportScreenState extends ConsumerState<DataExportScreen> {
  static const _sections = {
    'profile': 'Profil ve tercihler',
    'orders': 'Siparişler',
    'wallet': 'Cüzdan hareketleri',
    'gifts': 'Hediyeler',
    'loyalty': 'Damga ve ikramlar',
    'requests': 'Hesap talepleri',
  };
  String _section = 'profile';
  int _page = 1;
  int _accountGeneration = 0;
  void _resetForAccount() {
    setState(() {
      _accountGeneration++;
      _section = 'profile';
      _page = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(accountRepositoryProvider, (previous, next) {
      if (!identical(previous, next)) _resetForAccount();
    });
    ref.listen(accountAccessProvider, (previous, next) {
      if (previous != next) _resetForAccount();
    });
    final query = (section: _section, page: _page);
    final data = ref.watch(dataExportProvider(query));
    return ScrollablePageScaffold(
      title: 'Verilerim',
      children: [
        if (!ref.watch(accountAccessProvider))
          const Text('Bu sayfa için hesabına giriş yapmalısın.')
        else ...[
          const Text(
            'Her sayfada en fazla 100 kayıt gösterilir. Kopyaladığın bilgiler kişisel verilerini içerir.',
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            key: ValueKey(_accountGeneration),
            initialValue: _section,
            decoration: const InputDecoration(labelText: 'Veri grubu'),
            items: _sections.entries
                .map(
                  (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                )
                .toList(),
            onChanged: (v) => setState(() {
              _section = v!;
              _page = 1;
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          data.when(
            data: (value) {
              final generation = _accountGeneration;
              final scope = ref.read(sessionScopeProvider);
              final epoch = scope.revision;
              bool current() =>
                  context.mounted &&
                  generation == _accountGeneration &&
                  epoch == scope.revision &&
                  ref.read(accountAccessProvider);
              final json = const JsonEncoder.withIndent(
                '  ',
              ).convert(value.toJson());
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  OutlinedButton.icon(
                    onPressed: () async {
                      if (!current()) return;
                      try {
                        await Clipboard.setData(ClipboardData(text: json));
                        if (!context.mounted || !current()) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Bu sayfadaki veriler kopyalandı.'),
                          ),
                        );
                      } catch (error) {
                        if (context.mounted && current()) {
                          showApiError(context, error);
                        }
                      }
                    },
                    icon: const Icon(Icons.copy_outlined),
                    label: const Text('Bu sayfayı kopyala'),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AccountCard(
                    child: value.entries.isEmpty
                        ? const Text('Bu grupta kayıt yok.')
                        : SelectableText(json),
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
              );
            },
            error: (_, _) => AccountLoadError(
              retry: () => ref.invalidate(dataExportProvider(query)),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
          ),
        ],
      ],
    );
  }
}
