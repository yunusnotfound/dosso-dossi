import 'dart:convert';

import 'package:dosso_dossi/core/network/api_exception.dart';
import 'package:dosso_dossi/core/storage/local_storage.dart';
import 'package:dosso_dossi/features/auth/application/auth_controller.dart';
import 'package:dosso_dossi/features/auth/data/auth_repository.dart';
import 'package:dosso_dossi/features/branches/application/branch_location_provider.dart';
import 'package:dosso_dossi/features/branches/application/branch_providers.dart';
import 'package:dosso_dossi/features/branches/data/branch_location_service.dart';
import 'package:dosso_dossi/features/branches/data/branch_repository.dart';
import 'package:dosso_dossi/features/branches/domain/branch.dart';
import 'package:dosso_dossi/features/branches/presentation/branch_location_button.dart';
import 'package:dosso_dossi/features/profile/presentation/kvkk_screen.dart';
import 'package:dosso_dossi/features/profile/presentation/personal_info_screen.dart';
import 'package:dosso_dossi/features/profile/presentation/saved_cards_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FailingProfileRepository implements AuthRepository {
  final List<({String? name, String? email})> requests = [];

  @override
  Future<void> updateProfile({String? name, String? email}) async {
    requests.add((name: name, email: email));
    throw const ApiException(
      code: 'NETWORK_ERROR',
      message: 'Sunucuya ulaşılamadı',
    );
  }

  @override
  Future<void> logout(String refreshToken) async {}
  @override
  Future<void> sendOtp(String phone) => throw UnimplementedError();
  @override
  Future<AuthResult> verifyOtp({required String phone, required String code}) =>
      throw UnimplementedError();
}

class _LocationService implements BranchLocationService {
  int requests = 0;
  bool deny = false;

  @override
  Future<BranchLocation> requestLocation() async {
    requests++;
    if (deny) {
      throw const ApiException(
        code: 'LOCATION_DENIED',
        message: 'Konum izni verilmedi',
      );
    }
    return const BranchLocation(41.01, 28.97);
  }
}

class _Branches implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async => const [
    Branch(
      id: 'far',
      name: 'Uzak',
      address: 'İstanbul',
      city: 'İstanbul',
      distanceMeters: 10,
      isOpen: true,
      hours: '08:00–22:00',
      lat: 41,
      lng: 28.65,
    ),
    Branch(
      id: 'near',
      name: 'Yakın',
      address: 'İstanbul',
      city: 'İstanbul',
      distanceMeters: 9999,
      isOpen: true,
      hours: '08:00–22:00',
      lat: 41.01,
      lng: 28.97,
    ),
  ];
}

void main() {
  testWidgets(
    'invalid email stays in form; network error is visible and edits survive retry',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'auth_user': jsonEncode({
          'phone': '5551112233',
          'name': 'Berkay',
          'email': '',
        }),
      });
      final prefs = await SharedPreferences.getInstance();
      final repository = _FailingProfileRepository();
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.future);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: PersonalInfoScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, 'Berkay Demir');
      await tester.enterText(find.byType(TextFormField).at(1), 'gecersiz@');
      await tester.ensureVisible(find.text('Kaydet'));
      await tester.tap(find.text('Kaydet'));
      await tester.pumpAndSettle();
      expect(repository.requests, isEmpty);
      expect(find.text('Geçerli bir e-posta adresi gir'), findsOneWidget);

      await tester.enterText(
        find.byType(TextFormField).at(1),
        'berkay@example.com',
      );
      await tester.ensureVisible(find.text('Kaydet'));
      await tester.tap(find.text('Kaydet'));
      await tester.pumpAndSettle();
      expect(find.text('Sunucuya ulaşılamadı'), findsOneWidget);
      expect(find.text('Berkay Demir'), findsOneWidget);
      expect(find.text('berkay@example.com'), findsOneWidget);
      expect(container.read(authControllerProvider).value!.name, 'Berkay');
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Kaydet'));
      await tester.pumpAndSettle();
      expect(repository.requests.length, 2);
      expect(repository.requests.last, (
        name: 'Berkay Demir',
        email: 'berkay@example.com',
      ));
    },
  );

  testWidgets('wallet identity is never presented as a saved bank card', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: SavedCardsScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Kayıtlı banka kartın yok'), findsOneWidget);
    expect(find.textContaining('Visa'), findsNothing);
    expect(find.text('Varsayılan kart'), findsNothing);
    expect(find.text('Yeni Kart Ekle'), findsNothing);
  });

  testWidgets('missing approved privacy URL shows no invented legal text', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [privacyPolicyUriProvider.overrideWithValue(null)],
        child: const MaterialApp(home: KvkkScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Gizlilik metnine şu anda erişilemiyor.'), findsOneWidget);
    expect(find.textContaining('taslak'), findsNothing);
    expect(find.text('Veri Sorumlusu'), findsNothing);
    expect(find.text('Gizlilik metnini aç'), findsNothing);
  });

  testWidgets('configured privacy document can be opened', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          privacyPolicyUriProvider.overrideWithValue(
            Uri.parse('https://example.com/privacy'),
          ),
        ],
        child: const MaterialApp(home: KvkkScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Gizlilik metnini aç'), findsOneWidget);
    expect(find.text('Gizlilik metnine şu anda erişilemiyor.'), findsNothing);
  });

  test('privacy URL requires HTTPS and rejects embedded credentials', () {
    for (final url in [
      '',
      'plain text',
      'http://example.com/privacy',
      'file:///policy',
      'https://user:secret@example.com',
    ]) {
      expect(privacyPolicyUri(url), isNull);
    }
    expect(
      privacyPolicyUri('https://example.com/privacy')?.host,
      'example.com',
    );
  });

  test(
    'no location is requested implicitly and fallback has no claimed distances',
    () async {
      final service = _LocationService();
      final container = ProviderContainer(
        overrides: [
          branchRepositoryProvider.overrideWithValue(_Branches()),
          branchLocationServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);
      final branches = await container.read(branchesProvider.future);
      expect(service.requests, 0);
      expect(branches.map((branch) => branch.id), ['far', 'near']);
      expect(
        branches.every(
          (branch) =>
              branch.distanceMeters == null && branch.distanceLabel.isEmpty,
        ),
        isTrue,
      );
      expect(await container.read(nearestBranchProvider.future), isNull);
    },
  );

  test(
    'requested device coordinates determine distances and nearest branch',
    () async {
      final service = _LocationService();
      final container = ProviderContainer(
        overrides: [
          branchRepositoryProvider.overrideWithValue(_Branches()),
          branchLocationServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);
      await container.read(branchesProvider.future);
      await container.read(branchLocationProvider.notifier).requestLocation();
      final branches = await container.read(branchesProvider.future);
      expect(service.requests, 1);
      expect(branches.map((branch) => branch.id), ['near', 'far']);
      expect(branches.first.distanceMeters, 0);
      expect(branches.last.distanceMeters, greaterThan(20000));
      expect((await container.read(nearestBranchProvider.future))?.id, 'near');

      service.deny = true;
      await container.read(branchLocationProvider.notifier).requestLocation();
      final fallback = await container.read(branchesProvider.future);
      expect(fallback.every((branch) => branch.distanceMeters == null), isTrue);
      expect(await container.read(nearestBranchProvider.future), isNull);
    },
  );

  testWidgets('location denial is visible and button allows another attempt', (
    tester,
  ) async {
    final service = _LocationService()..deny = true;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [branchLocationServiceProvider.overrideWithValue(service)],
        child: const MaterialApp(home: Scaffold(body: BranchLocationButton())),
      ),
    );
    await tester.pumpAndSettle();
    expect(service.requests, 0);
    await tester.tap(find.text('Mesafeler için konumumu kullan'));
    await tester.pumpAndSettle();
    expect(service.requests, 1);
    expect(find.text('Konum izni verilmedi'), findsOneWidget);
    expect(find.text('Mesafeler için konumumu kullan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
