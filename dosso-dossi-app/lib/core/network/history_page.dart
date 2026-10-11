/// A stable, server-issued cursor keeps older records accessible as new ones arrive.
class HistoryPage<T> {
  const HistoryPage({required this.items, this.nextCursor});
  final List<T> items;
  final String? nextCursor;
}

class HistoryPagination {
  const HistoryPagination({
    this.nextCursor,
    this.isLoading = false,
    this.error,
  });
  final String? nextCursor;
  final bool isLoading;
  final Object? error;
  bool get hasMore => nextCursor != null;
}
