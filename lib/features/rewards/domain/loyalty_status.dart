import '../../../core/constants/app_config.dart';

/// İkram geçmişi satırı.
class RewardEntry {
  const RewardEntry({
    required this.title,
    required this.date,
    required this.used,
  });

  final String title;
  final DateTime date;

  /// true = ikram kullanıldı, false = ikram kazanıldı
  final bool used;
}

/// Kullanıcının damga ve ikram durumu.
class LoyaltyStatus {
  const LoyaltyStatus({
    required this.stamps,
    this.target = AppConfig.stampsPerReward,
    this.freeDrinks = 0,
    this.history = const [],
  });

  /// Mevcut turdaki damga sayısı (0..target-1; dolunca ikrama dönüşür)
  final int stamps;

  /// İkram için gereken damga sayısı
  final int target;

  /// Kullanılabilir ikram içecek hakkı
  final int freeDrinks;

  /// Kazanılan/kullanılan ikramların geçmişi (yeniden eskiye)
  final List<RewardEntry> history;

  int get remaining => target - stamps;

  LoyaltyStatus copyWith({
    int? stamps,
    int? freeDrinks,
    List<RewardEntry>? history,
  }) =>
      LoyaltyStatus(
        stamps: stamps ?? this.stamps,
        target: target,
        freeDrinks: freeDrinks ?? this.freeDrinks,
        history: history ?? this.history,
      );
}
