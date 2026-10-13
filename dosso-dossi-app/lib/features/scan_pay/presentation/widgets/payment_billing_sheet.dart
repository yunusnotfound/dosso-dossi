import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/formatters.dart';
import '../../../auth/domain/app_user.dart';
import '../../../wallet/data/wallet_repository.dart';

class PaymentBillingSheet extends StatefulWidget {
  const PaymentBillingSheet({super.key, required this.amount, this.user});
  final double amount;
  final AppUser? user;
  @override
  State<PaymentBillingSheet> createState() => _PaymentBillingSheetState();
}

class _PaymentBillingSheetState extends State<PaymentBillingSheet> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.user?.name ?? '');
  final _surname = TextEditingController();
  late final _email = TextEditingController(text: widget.user?.email ?? '');
  final _identity = TextEditingController();
  final _city = TextEditingController();
  final _country = TextEditingController(text: 'Türkiye');
  final _address = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _name,
      _surname,
      _email,
      _identity,
      _city,
      _country,
      _address,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    int maxLength = 50,
    TextInputType? keyboard,
    int lines = 1,
    String? Function(String)? validate,
    List<TextInputFormatter>? formatters,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: TextFormField(
      controller: controller,
      keyboardType: keyboard,
      maxLength: maxLength,
      maxLines: lines,
      inputFormatters: formatters,
      autocorrect: false,
      enableSuggestions: false,
      decoration: InputDecoration(labelText: label, counterText: ''),
      validator: (value) {
        final text = value?.trim() ?? '';
        if (text.isEmpty) return '$label gerekli';
        return validate?.call(text);
      },
    ),
  );

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.page,
        AppSpacing.page,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.page,
      ),
      child: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ödeme bilgileri', style: AppTypography.headline),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${formatTl(widget.amount)} yüklemek için fatura bilgilerini doldur. '
                'Kart bilgilerin bir sonraki adımda iyzico’nun güvenli sayfasında alınır.',
                style: AppTypography.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.lg),
              _field('Ad', _name),
              _field('Soyad', _surname),
              _field(
                'E-posta',
                _email,
                maxLength: 254,
                keyboard: TextInputType.emailAddress,
                validate: (v) =>
                    RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v)
                    ? null
                    : 'Geçerli bir e-posta gir',
              ),
              _field(
                'T.C. kimlik numarası',
                _identity,
                maxLength: 11,
                keyboard: TextInputType.number,
                formatters: [FilteringTextInputFormatter.digitsOnly],
                validate: (v) => RegExp(r'^[1-9][0-9]{10}$').hasMatch(v)
                    ? null
                    : '11 haneli kimlik numaranı gir',
              ),
              _field('Şehir', _city),
              _field('Ülke', _country),
              _field(
                'Fatura adresi',
                _address,
                maxLength: 500,
                lines: 3,
                keyboard: TextInputType.streetAddress,
                validate: (v) => v.length >= 10 ? null : 'Açık adresini gir',
              ),
              Text(
                'Bu bilgiler yalnızca ödeme işlemi için kullanılır; cihazına kaydedilmez.',
                style: AppTypography.bodySecondary,
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: () {
                  if (!_form.currentState!.validate()) return;
                  Navigator.of(context).pop(
                    PaymentBuyer(
                      name: _name.text.trim(),
                      surname: _surname.text.trim(),
                      email: _email.text.trim(),
                      identityNumber: _identity.text.trim(),
                      city: _city.text.trim(),
                      country: _country.text.trim(),
                      address: _address.text.trim(),
                    ),
                  );
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                ),
                child: Text('iyzico ile devam et · ${formatTl(widget.amount)}'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
