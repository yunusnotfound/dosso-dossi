import 'package:dio/dio.dart';
import '../../../core/network/api_exception.dart';
import '../domain/account_records.dart';

abstract interface class AccountRepository {
  Future<List<AccountRequest>> requests();
  Future<void> submit(String kind, String note);
  Future<void> cancel(String id);
  Future<InboxPage> inbox(int page);
  Future<void> markRead(String id);
  Future<ExportPage> export(String section, int page);
}

class ApiAccountRepository implements AccountRepository {
  ApiAccountRepository(this.dio);
  final Dio dio;
  @override
  Future<List<AccountRequest>> requests() => apiCall(() async {
    final r = await dio.get<List<dynamic>>('/me/account-requests');
    return r.data!
        .map((e) => AccountRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  });
  @override
  Future<void> submit(String kind, String note) => apiCall(() async {
    await dio.post<dynamic>(
      '/me/account-requests',
      data: {'kind': kind, 'note': note},
    );
  });
  @override
  Future<void> cancel(String id) => apiCall(() async {
    await dio.post<dynamic>(
      '/me/account-requests/${Uri.encodeComponent(id)}/cancel',
    );
  });
  @override
  Future<InboxPage> inbox(int page) => apiCall(() async {
    final r = await dio.get<Map<String, dynamic>>(
      '/me/notifications',
      queryParameters: {'page': page},
    );
    return InboxPage.fromJson(r.data!);
  });
  @override
  Future<void> markRead(String id) => apiCall(() async {
    await dio.patch<dynamic>(
      '/me/notifications/${Uri.encodeComponent(id)}/read',
    );
  });
  @override
  Future<ExportPage> export(String section, int page) => apiCall(() async {
    final r = await dio.get<Map<String, dynamic>>(
      '/me/data-export',
      queryParameters: {'section': section, 'page': page},
    );
    return ExportPage.fromJson(r.data!);
  });
}

/// Preview mode is deliberately explicit; no simulated requests reach the API.
class MockAccountRepository implements AccountRepository {
  final List<AccountRequest> _requests = [];
  @override
  Future<List<AccountRequest>> requests() async => List.unmodifiable(_requests);
  @override
  Future<void> submit(String kind, String note) async {
    if (_requests.any((r) => r.kind == kind && r.active)) return;
    _requests.insert(
      0,
      AccountRequest(
        id: '${DateTime.now().microsecondsSinceEpoch}',
        kind: kind,
        status: 'OPEN',
        note: note,
        response: '',
        createdAt: DateTime.now(),
      ),
    );
  }

  @override
  Future<void> cancel(String id) async {
    final index = _requests.indexWhere((r) => r.id == id);
    if (index < 0) return;
    final r = _requests[index];
    _requests[index] = AccountRequest(
      id: r.id,
      kind: r.kind,
      status: 'CANCELLED',
      note: r.note,
      response: r.response,
      createdAt: r.createdAt,
    );
  }

  @override
  Future<InboxPage> inbox(int page) async =>
      const InboxPage(entries: [], unreadCount: 0, hasMore: false);
  @override
  Future<void> markRead(String id) async {}
  @override
  Future<ExportPage> export(String section, int page) async =>
      ExportPage(section: section, page: page, entries: [], hasMore: false);
}
