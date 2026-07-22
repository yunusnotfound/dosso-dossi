import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/application/auth_controller.dart';
import '../features/auth/domain/app_user.dart';
import '../features/auth/presentation/name_screen.dart';
import '../features/auth/presentation/onboarding_screen.dart';
import '../features/auth/presentation/otp_screen.dart';
import '../features/auth/presentation/phone_login_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/branches/presentation/branch_list_screen.dart';
import '../features/campaigns/presentation/campaign_kahve_screen.dart';
import '../features/campaigns/presentation/campaigns_screen.dart';
import '../features/favorites/presentation/favorites_screen.dart';
import '../features/gift/presentation/gift_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/order/presentation/cart_screen.dart';
import '../features/order/presentation/order_screen.dart';
import '../features/order/presentation/order_success_screen.dart';
import '../features/order/presentation/product_detail_screen.dart';
import '../features/profile/presentation/faq_screen.dart';
import '../features/profile/presentation/kvkk_screen.dart';
import '../features/profile/presentation/notification_prefs_screen.dart';
import '../features/profile/presentation/order_history_screen.dart';
import '../features/profile/presentation/personal_info_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/profile/presentation/saved_cards_screen.dart';
import '../features/rewards/presentation/rewards_screen.dart';
import '../features/scan_pay/presentation/scan_pay_screen.dart';
import 'main_shell.dart';

/// Tüm sayfa yolları. Yeni ekran eklerken önce buraya path tanımla.
abstract final class Routes {
  // Giriş akışı
  static const splash = '/acilis';
  static const onboarding = '/tanitim';
  static const login = '/giris';
  static const otp = '/giris/kod';
  static const completeProfile = '/giris/isim';

  // Ana sekmeler
  static const home = '/';
  static const scanPay = '/tara-ode';
  static const order = '/siparis';
  static const gift = '/hediye';
  static const campaigns = '/kampanyalar';

  // Sekme üstüne açılan sayfalar
  static const profile = '/profil';
  static const rewards = '/ikramlarim';

  // Sipariş akışı
  static const product = '/urun/:id';
  static const cart = '/sepet';
  static const orderSuccess = '/siparis-onay';

  // Kampanya detayları
  static const campaignKahve = '/kampanya/kahve-ictikce';

  // Profil alt sayfaları
  static const personalInfo = '/profil/bilgiler';
  static const notificationPrefs = '/profil/bildirimler';
  static const savedCards = '/profil/kartlar';
  static const orderHistory = '/profil/siparisler';
  static const favorites = '/profil/favoriler';
  static const branchList = '/subeler';
  static const faq = '/profil/sss';
  static const kvkk = '/profil/kvkk';

  static String productPath(String id) => '/urun/$id';
}

final appRouterProvider = Provider<GoRouter>((ref) {
  // Oturum durumu değiştiğinde router yönlendirmeyi yeniden değerlendirir.
  final authState =
      ValueNotifier<AsyncValue<AppUser?>>(ref.read(authControllerProvider));
  ref.onDispose(authState.dispose);
  ref.listen(authControllerProvider, (_, next) => authState.value = next);

  return GoRouter(
    initialLocation: Routes.home,
    refreshListenable: authState,
    redirect: (context, state) {
      final auth = authState.value;
      final location = state.matchedLocation;
      final onAuthRoute = location == Routes.splash ||
          location == Routes.onboarding ||
          location.startsWith(Routes.login);

      // Oturum diskten okunurken açılış ekranı göster.
      if (auth.isLoading) {
        return location == Routes.splash ? null : Routes.splash;
      }

      final user = auth.value;

      // Giriş yapılmamış → onboarding'e.
      if (user == null) {
        return onAuthRoute && location != Routes.splash
            ? null
            : Routes.onboarding;
      }

      // Giriş var ama isim adımı eksik → isim ekranına.
      if (user.name.isEmpty) {
        return location == Routes.completeProfile
            ? null
            : Routes.completeProfile;
      }

      // Oturum tamam; giriş ekranlarında durmanın anlamı yok → ana sayfa.
      return onAuthRoute ? Routes.home : null;
    },
    routes: [
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const PhoneLoginScreen(),
      ),
      GoRoute(
        path: Routes.otp,
        builder: (context, state) =>
            OtpScreen(phone: state.uri.queryParameters['tel'] ?? ''),
      ),
      GoRoute(
        path: Routes.completeProfile,
        builder: (context, state) => const NameScreen(),
      ),
      GoRoute(
        path: Routes.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: Routes.rewards,
        builder: (context, state) => const RewardsScreen(),
      ),
      GoRoute(
        path: Routes.product,
        builder: (context, state) =>
            ProductDetailScreen(productId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: Routes.cart,
        builder: (context, state) => const CartScreen(),
      ),
      GoRoute(
        path: Routes.orderSuccess,
        builder: (context, state) => const OrderSuccessScreen(),
      ),
      GoRoute(
        path: Routes.campaignKahve,
        builder: (context, state) => const CampaignKahveScreen(),
      ),
      GoRoute(
        path: Routes.personalInfo,
        builder: (context, state) => const PersonalInfoScreen(),
      ),
      GoRoute(
        path: Routes.notificationPrefs,
        builder: (context, state) => const NotificationPrefsScreen(),
      ),
      GoRoute(
        path: Routes.savedCards,
        builder: (context, state) => const SavedCardsScreen(),
      ),
      GoRoute(
        path: Routes.orderHistory,
        builder: (context, state) => const OrderHistoryScreen(),
      ),
      GoRoute(
        path: Routes.favorites,
        builder: (context, state) => const FavoritesScreen(),
      ),
      GoRoute(
        path: Routes.branchList,
        builder: (context, state) => const BranchListScreen(),
      ),
      GoRoute(
        path: Routes.faq,
        builder: (context, state) => const FaqScreen(),
      ),
      GoRoute(
        path: Routes.kvkk,
        builder: (context, state) => const KvkkScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.home,
              builder: (context, state) => const HomeScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.scanPay,
              builder: (context, state) => const ScanPayScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.order,
              builder: (context, state) => const OrderScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.gift,
              builder: (context, state) => const GiftScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: Routes.campaigns,
              builder: (context, state) => const CampaignsScreen(),
            ),
          ]),
        ],
      ),
    ],
  );
});
