import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/product_image.dart';
import '../../../routing/app_router.dart';
import '../../rewards/application/loyalty_providers.dart';
import '../../wallet/application/wallet_providers.dart';
import '../application/cart_controller.dart';
import '../application/order_providers.dart';
import '../domain/cart.dart';
import '../domain/product_options.dart';
import 'order_screen.dart' show showBranchPicker;
import 'widgets/option_selector.dart';

/// Sepet: şube + teslim saati + ürünler + kampanya kodu + ödeme.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  int _slotIndex = 0;
  bool _paying = false;

  List<String> _slots(int prepMinutes) {
    final now = DateTime.now();
    final earliest = now.add(Duration(minutes: prepMinutes));
    String fmt(DateTime t) =>
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
    final next = DateTime(now.year, now.month, now.day, earliest.hour,
            (earliest.minute ~/ 15) * 15)
        .add(const Duration(minutes: 15));
    return [
      'En kısa (~$prepMinutes dk)',
      fmt(next),
      fmt(next.add(const Duration(minutes: 15))),
    ];
  }

  Future<void> _pay() async {
    final branch = ref.read(activeBranchProvider).value;
    if (branch == null) return;
    final pickupLabel = _slots(branch.prepMinutes)[_slotIndex];

    setState(() => _paying = true);
    try {
      final record = await ref
          .read(cartProvider.notifier)
          .checkout(branch: branch, pickupLabel: pickupLabel);
      if (!mounted) return;
      if (record == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.danger,
            content:
                Text('Bakiye yetersiz. Tara & Öde ekranından yükleme yapabilirsin.'),
          ),
        );
        return;
      }
      context.go(Routes.orderSuccess);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final branch = ref.watch(activeBranchProvider);
    final wallet = ref.watch(walletProvider);

    return Scaffold(
      appBar: AppBar(title: Text('Sepet (${cart.count})')),
      body: cart.items.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🛍️', style: TextStyle(fontSize: 56)),
                  const SizedBox(height: AppSpacing.md),
                  Text('Sepetin boş', style: AppTypography.title),
                  const SizedBox(height: AppSpacing.xs),
                  Text('Menüden bir şeyler ekle',
                      style: AppTypography.bodySecondary),
                ],
              ),
            )
          : SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(AppSpacing.page),
                      children: [
                        branch.when(
                          loading: () => const SizedBox.shrink(),
                          error: (e, _) => const SizedBox.shrink(),
                          data: (b) => _BranchCard(
                            name: b.name,
                            address: b.address,
                            slots: _slots(b.prepMinutes),
                            selectedSlot: _slotIndex,
                            onSlotChanged: (i) =>
                                setState(() => _slotIndex = i),
                            onChangeBranch: () =>
                                showBranchPicker(context, ref),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius:
                                BorderRadius.circular(AppRadius.md),
                          ),
                          child: Column(
                            children: [
                              for (var i = 0; i < cart.items.length; i++) ...[
                                if (i > 0) const Divider(indent: AppSpacing.lg),
                                _CartItemRow(
                                  item: cart.items[i],
                                  onEdit: () => _editItem(i, cart.items[i]),
                                  onDelete: () => ref
                                      .read(cartProvider.notifier)
                                      .removeAt(i),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        _PromoRow(cart: cart),
                        const SizedBox(height: AppSpacing.lg),
                        const _FreeDrinkRow(),
                        const SizedBox(height: AppSpacing.lg),
                        if (cart.stampsEarned > 0)
                          Container(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceTint,
                              borderRadius:
                                  BorderRadius.circular(AppRadius.sm),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.local_cafe,
                                    size: 18, color: AppColors.primary),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text.rich(
                                    TextSpan(
                                      text: 'Bu siparişten ',
                                      style: AppTypography.bodySecondary,
                                      children: [
                                        TextSpan(
                                          text:
                                              '+${cart.stampsEarned} damga',
                                          style: AppTypography.body.copyWith(
                                              color: AppColors.primary),
                                        ),
                                        const TextSpan(
                                            text: ' kazanacaksın.'),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: AppSpacing.lg),
                        _TotalsCard(cart: cart),
                        const SizedBox(height: AppSpacing.lg),
                        wallet.when(
                          loading: () => const SizedBox.shrink(),
                          error: (e, _) => const SizedBox.shrink(),
                          data: (w) => Container(
                            padding: const EdgeInsets.all(AppSpacing.lg),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius:
                                  BorderRadius.circular(AppRadius.md),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  alignment: Alignment.center,
                                  decoration: const BoxDecoration(
                                    color: AppColors.surfaceTint,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                      Icons.account_balance_wallet_outlined,
                                      size: 22,
                                      color: AppColors.primary),
                                ),
                                const SizedBox(width: AppSpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text('Dosso Kart',
                                          style: AppTypography.body),
                                      Text(
                                        'Bakiye: ${formatTl(w.balance)}',
                                        style: AppTypography.bodySecondary
                                            .copyWith(fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                                const CircleAvatar(
                                  radius: 14,
                                  backgroundColor: AppColors.success,
                                  child: Icon(Icons.check,
                                      size: 16, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxl),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.page, 0,
                        AppSpacing.page, AppSpacing.md),
                    child: FilledButton(
                      onPressed: _paying ? null : _pay,
                      child: _paying
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'Dosso Kart ile Öde · ${formatTl(cart.total)}'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  void _editItem(int index, CartItem item) {
    var milk = item.milk;
    var shot = item.shot;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.page,
              AppSpacing.page,
              MediaQuery.of(context).viewInsets.bottom + AppSpacing.page,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.product.name, style: AppTypography.headline),
                const SizedBox(height: AppSpacing.lg),
                OptionSelector(
                  label: 'Süt',
                  options: ProductOptions.milks,
                  selected: milk,
                  onChanged: (o) => setSheetState(() => milk = o),
                ),
                const SizedBox(height: AppSpacing.lg),
                OptionSelector(
                  label: 'Shot',
                  options: ProductOptions.shots,
                  selected: shot,
                  onChanged: (o) => setSheetState(() => shot = o),
                ),
                const SizedBox(height: AppSpacing.xxl),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      ref.read(cartProvider.notifier).updateAt(
                            index,
                            item.copyWith(milk: milk, shot: shot),
                          );
                      Navigator.of(context).pop();
                    },
                    child: const Text('Güncelle'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({
    required this.name,
    required this.address,
    required this.slots,
    required this.selectedSlot,
    required this.onSlotChanged,
    required this.onChangeBranch,
  });

  final String name;
  final String address;
  final List<String> slots;
  final int selectedSlot;
  final ValueChanged<int> onSlotChanged;
  final VoidCallback onChangeBranch;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.surfaceTint,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.storefront_outlined,
                    size: 22, color: AppColors.primary),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppTypography.body),
                    Text(
                      address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          AppTypography.bodySecondary.copyWith(fontSize: 13),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onChangeBranch,
                child: Text(
                  'Değiştir',
                  style: AppTypography.body.copyWith(color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (var i = 0; i < slots.length; i++)
                GestureDetector(
                  onTap: () => onSlotChanged(i),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                    decoration: BoxDecoration(
                      color: i == selectedSlot
                          ? AppColors.gold
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(
                        color: i == selectedSlot
                            ? AppColors.gold
                            : AppColors.divider,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (i == 0) ...[
                          Icon(Icons.schedule,
                              size: 14,
                              color: i == selectedSlot
                                  ? AppColors.onGold
                                  : AppColors.textSecondary),
                          const SizedBox(width: AppSpacing.xs),
                        ],
                        Text(
                          slots[i],
                          style: AppTypography.badge.copyWith(
                            fontSize: 13,
                            color: i == selectedSlot
                                ? AppColors.onGold
                                : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CartItemRow extends StatelessWidget {
  const _CartItemRow({
    required this.item,
    required this.onEdit,
    required this.onDelete,
  });

  final CartItem item;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: SizedBox(
              width: 56,
              height: 56,
              child: ProductImage(product: item.product, emojiSize: 28),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.quantity > 1
                      ? '${item.quantity}x ${item.product.name}'
                      : item.product.name,
                  style: AppTypography.body,
                ),
                const SizedBox(height: 2),
                Text(item.optionsLabel,
                    style: AppTypography.bodySecondary.copyWith(fontSize: 13)),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    if (item.product.hasOptions) ...[
                      GestureDetector(
                        onTap: onEdit,
                        child: Text(
                          'Düzenle',
                          style: AppTypography.body
                              .copyWith(color: AppColors.primary, fontSize: 14),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.lg),
                    ],
                    GestureDetector(
                      onTap: onDelete,
                      child: const Icon(Icons.delete_outline,
                          size: 20, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Text(formatTl(item.total), style: AppTypography.title),
        ],
      ),
    );
  }
}

/// İkram hakkı anahtarı — hak varsa ve sepette içecek varsa görünür.
class _FreeDrinkRow extends ConsumerWidget {
  const _FreeDrinkRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final freeDrinks = ref.watch(
      loyaltyStatusProvider.select((s) => s.value?.freeDrinks ?? 0),
    );

    if (freeDrinks < 1 || cart.freeDrinkItem == null) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: cart.useFreeDrink
            ? Border.all(color: AppColors.gold, width: 2)
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.gold,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.card_giftcard,
                size: 22, color: AppColors.onGold),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('İkram hakkını kullan ($freeDrinks adet)',
                    style: AppTypography.body),
                Text(
                  '${cart.freeDrinkItem!.product.name} ücretsiz olur',
                  style: AppTypography.bodySecondary.copyWith(fontSize: 13),
                ),
              ],
            ),
          ),
          Switch(
            value: cart.useFreeDrink,
            activeTrackColor: AppColors.primary,
            onChanged: (v) =>
                ref.read(cartProvider.notifier).setUseFreeDrink(v),
          ),
        ],
      ),
    );
  }
}

class _PromoRow extends ConsumerWidget {
  const _PromoRow({required this.cart});

  final CartState cart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasPromo = cart.promoCode != null;

    return GestureDetector(
      onTap: hasPromo ? null : () => _showPromoSheet(context, ref),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.surfaceTint,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.confirmation_number_outlined,
                  size: 22, color: AppColors.primary),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: hasPromo
                  ? Text(
                      '${cart.promoCode} · %${(cart.discountRate * 100).round()} indirim',
                      style:
                          AppTypography.body.copyWith(color: AppColors.success),
                    )
                  : Text('Kampanya kodu ekle', style: AppTypography.body),
            ),
            hasPromo
                ? GestureDetector(
                    onTap: () =>
                        ref.read(cartProvider.notifier).removePromo(),
                    child: const Icon(Icons.close,
                        size: 20, color: AppColors.textSecondary),
                  )
                : const Icon(Icons.chevron_right,
                    color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  void _showPromoSheet(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.background,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.page,
          right: AppSpacing.page,
          top: AppSpacing.page,
          bottom:
              MediaQuery.of(context).viewInsets.bottom + AppSpacing.page,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kampanya Kodu', style: AppTypography.headline),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'Örn. DOSSO10'),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  final applied = ref
                      .read(cartProvider.notifier)
                      .applyPromo(controller.text);
                  Navigator.of(context).pop();
                  if (!applied) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        backgroundColor: AppColors.danger,
                        content: Text('Kod geçersiz veya süresi dolmuş'),
                      ),
                    );
                  }
                },
                child: const Text('Uygula'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.cart});

  final CartState cart;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          _totalRow('Ara toplam', formatTl(cart.subtotal)),
          const SizedBox(height: AppSpacing.sm),
          _totalRow('İndirim', '-${formatTl(cart.discount)}'),
          if (cart.freeDrinkDiscount > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            _totalRow('İkram (${cart.freeDrinkItem?.product.name})',
                '-${formatTl(cart.freeDrinkDiscount)}'),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: Divider(),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Toplam', style: AppTypography.title),
              Text(formatTl(cart.total), style: AppTypography.title),
            ],
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.bodySecondary),
        Text(value, style: AppTypography.bodySecondary),
      ],
    );
  }
}
