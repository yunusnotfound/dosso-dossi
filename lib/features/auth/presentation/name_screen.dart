import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_column.dart';
import '../application/auth_controller.dart';

/// Yeni kullanıcı için isim adımı — girişin son ekranı.
class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final _nameController = TextEditingController();
  bool _saving = false;

  bool get _isValid => _nameController.text.trim().length >= 2;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .completeProfile(_nameController.text.trim());
      // Router isim tamamlanınca ana sayfaya otomatik yönlendirir.
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ScrollableColumn(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            const SizedBox(height: AppSpacing.xxxl),
            Text('Sana nasıl hitap edelim?', style: AppTypography.displayLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Adın, selamlama ve siparişlerinde kullanılacak.',
              style: AppTypography.bodySecondary,
            ),
            const SizedBox(height: AppSpacing.xxl),
            TextField(
              controller: _nameController,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              style: AppTypography.title,
              decoration: const InputDecoration(hintText: 'Adın Soyadın'),
              onChanged: (_) => setState(() {}),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _isValid && !_saving ? _save : null,
              child: _saving
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Başlayalım'),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}
