import '../domain/loyalty_status.dart';
import 'loyalty_repository.dart';

class MockLoyaltyRepository implements LoyaltyRepository {
  @override
  Future<LoyaltyStatus> getStatus() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return LoyaltyStatus(
      stamps: 3,
      freeDrinks: 1,
      history: [
        RewardEntry(
          title: 'Cappuccino',
          date: DateTime(2026, 6, 12),
          used: true,
        ),
        RewardEntry(
          title: 'Filtre Kahve',
          date: DateTime(2026, 5, 28),
          used: true,
        ),
      ],
    );
  }
}
