class AccountRequest {
  const AccountRequest({
    required this.id,
    required this.kind,
    required this.status,
    required this.note,
    required this.response,
    required this.createdAt,
  });
  final String id, kind, status, note, response;
  final DateTime createdAt;
  bool get active => status == 'OPEN' || status == 'IN_REVIEW';
  String get title => kind == 'CLOSURE' ? 'Hesap kapatma' : 'Veri talebi';
  String get statusLabel =>
      const {
        'OPEN': 'Talep alındı',
        'IN_REVIEW': 'İnceleniyor',
        'COMPLETED': 'Tamamlandı',
        'REJECTED': 'Sonuçlandırıldı',
        'CANCELLED': 'İptal edildi',
      }[status] ??
      status;
  factory AccountRequest.fromJson(Map<String, dynamic> j) => AccountRequest(
    id: j['id'] as String,
    kind: j['kind'] as String,
    status: j['status'] as String,
    note: j['note'] as String,
    response: j['response'] as String,
    createdAt: DateTime.parse(j['createdAt'] as String),
  );
}

class InboxItem {
  const InboxItem({
    required this.id,
    required this.title,
    required this.body,
    required this.targetPath,
    required this.readAt,
    required this.createdAt,
  });
  final String id, title, body, targetPath;
  final DateTime? readAt;
  final DateTime createdAt;
  factory InboxItem.fromJson(Map<String, dynamic> j) => InboxItem(
    id: j['id'] as String,
    title: j['title'] as String,
    body: j['body'] as String,
    targetPath: j['targetPath'] as String,
    readAt: j['readAt'] == null ? null : DateTime.parse(j['readAt'] as String),
    createdAt: DateTime.parse(j['createdAt'] as String),
  );
}

class InboxPage {
  const InboxPage({
    required this.entries,
    required this.unreadCount,
    required this.hasMore,
  });
  final List<InboxItem> entries;
  final int unreadCount;
  final bool hasMore;
  factory InboxPage.fromJson(Map<String, dynamic> j) => InboxPage(
    entries: (j['entries'] as List)
        .map((e) => InboxItem.fromJson(e as Map<String, dynamic>))
        .toList(),
    unreadCount: j['unreadCount'] as int,
    hasMore: j['hasMore'] as bool,
  );
}

class ExportPage {
  const ExportPage({
    required this.section,
    required this.page,
    required this.entries,
    required this.hasMore,
  });
  final String section;
  final int page;
  final List<dynamic> entries;
  final bool hasMore;
  factory ExportPage.fromJson(Map<String, dynamic> j) => ExportPage(
    section: j['section'] as String,
    page: j['page'] as int,
    entries: j['entries'] as List<dynamic>,
    hasMore: j['hasMore'] as bool,
  );
  Map<String, dynamic> toJson() => {
    'section': section,
    'page': page,
    'entries': entries,
    'hasMore': hasMore,
  };
}

/// Server-controlled links may only navigate to known application pages.
String? safeNotificationTarget(String target) {
  const allowed = {
    '/',
    '/siparis',
    '/ikramlarim',
    '/tara-ode',
    '/online-magaza',
    '/kampanyalar',
    '/kampanya/yukle-kazan',
    '/kampanya/kahve-ictikce',
    '/profil/hesap-talepleri',
  };
  if (allowed.contains(target) ||
      RegExp(r'^/siparis-takip/DD-\d+$').hasMatch(target)) {
    return target;
  }
  return null;
}
