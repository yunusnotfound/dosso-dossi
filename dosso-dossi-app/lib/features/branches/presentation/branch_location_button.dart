import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/error_feedback.dart';
import '../application/branch_location_provider.dart';

class BranchLocationButton extends ConsumerWidget {
  const BranchLocationButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = ref.watch(branchLocationProvider);
    ref.listen(branchLocationProvider, (_, next) {
      if (next.hasError) showApiError(context, next.error!);
    });
    return TextButton.icon(
      onPressed: location.isLoading
          ? null
          : () => ref.read(branchLocationProvider.notifier).requestLocation(),
      icon: location.isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.my_location, size: 18),
      label: Text(
        location.isLoading
            ? 'Konum alınıyor…'
            : location.hasError || location.value == null
            ? 'Mesafeler için konumumu kullan'
            : 'Konumumu güncelle',
      ),
    );
  }
}
