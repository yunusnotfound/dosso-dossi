import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/runtime_mode.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/application/guest_mode.dart';
import '../data/account_repository.dart';
import '../domain/account_records.dart';

final accountAccessProvider = Provider<bool>(
  (ref) =>
      !ref.watch(guestModeProvider) &&
      ref.watch(authControllerProvider).value != null,
);

final accountRepositoryProvider = Provider<AccountRepository>((ref) {
  // A new account gets a fresh repository and fresh provider results.
  ref.watch(authControllerProvider.select((value) => value.value?.phone));
  return ref.watch(apiModeProvider)
      ? ApiAccountRepository(ref.watch(apiClientProvider))
      : MockAccountRepository();
});

final accountRequestsProvider =
    FutureProvider.autoDispose<List<AccountRequest>>((ref) {
      if (!ref.watch(accountAccessProvider)) return [];
      return ref.watch(accountRepositoryProvider).requests();
    });

final inboxProvider = FutureProvider.autoDispose.family<InboxPage, int>((
  ref,
  page,
) {
  if (!ref.watch(accountAccessProvider)) {
    return const InboxPage(entries: [], unreadCount: 0, hasMore: false);
  }
  return ref.watch(accountRepositoryProvider).inbox(page);
});

final dataExportProvider = FutureProvider.autoDispose
    .family<ExportPage, ({String section, int page})>((ref, query) {
      if (!ref.watch(accountAccessProvider)) {
        return ExportPage(
          section: query.section,
          page: query.page,
          entries: [],
          hasMore: false,
        );
      }
      return ref
          .watch(accountRepositoryProvider)
          .export(query.section, query.page);
    });
