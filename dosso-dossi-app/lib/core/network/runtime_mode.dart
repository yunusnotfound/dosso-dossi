import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_config.dart';

/// Separates controller logic from repository transport, including offline API tests.
final apiModeProvider = Provider<bool>((ref) => !AppConfig.useMocks);
