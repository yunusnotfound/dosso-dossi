import 'package:flutter/material.dart';
import '../network/history_page.dart';

class HistoryLoadMore extends StatelessWidget {
  const HistoryLoadMore({
    super.key,
    required this.pagination,
    required this.onLoad,
    this.enabled = true,
  });
  final HistoryPagination pagination;
  final VoidCallback onLoad;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!pagination.hasMore) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          if (pagination.error != null)
            const Text('Eski kayıtlar yüklenemedi. Tekrar deneyebilirsin.'),
          TextButton.icon(
            onPressed: enabled && !pagination.isLoading ? onLoad : null,
            icon: pagination.isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.expand_more),
            label: Text(
              pagination.isLoading
                  ? 'Yükleniyor…'
                  : 'Daha eski kayıtları göster',
            ),
          ),
        ],
      ),
    );
  }
}
