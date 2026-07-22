import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/scrollable_column.dart';
import '../../auth/application/auth_controller.dart';

/// Ad ve e-posta düzenleme. Telefon değişimi API fazında (SMS doğrulama gerekir).
class PersonalInfoScreen extends ConsumerStatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  ConsumerState<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends ConsumerState<PersonalInfoScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).value;
    _nameController = TextEditingController(text: user?.name ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateProfile(
            name: _nameController.text.trim(),
            email: _emailController.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.success,
          content: Text('Bilgilerin güncellendi'),
        ),
      );
      context.pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Kişisel Bilgiler')),
      body: SafeArea(
        child: ScrollableColumn(
          padding: const EdgeInsets.all(AppSpacing.page),
          children: [
            Text('AD SOYAD', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _nameController,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text('E-POSTA', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(hintText: 'ornek@eposta.com'),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text('TELEFON', style: AppTypography.sectionLabel),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              enabled: false,
              decoration: InputDecoration(hintText: '+90 ${user?.phone ?? ''}'),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Telefon numarası değişikliği için müşteri hizmetleriyle iletişime geç.',
              style: AppTypography.bodySecondary.copyWith(fontSize: 12),
            ),
            const Spacer(),
            FilledButton(
              onPressed: _nameController.text.trim().length >= 2 && !_saving
                  ? _save
                  : null,
              child: const Text('Kaydet'),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}
