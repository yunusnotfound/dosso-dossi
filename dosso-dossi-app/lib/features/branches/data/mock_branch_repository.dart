import '../domain/branch.dart';
import 'branch_repository.dart';

/// Gerçek Dosso Dossi Coffee şube listesi (resmi mağaza adres tablosundan,
/// Temmuz 2026). Mesafeler temsilidir; gerçek konum servisi API ile gelecek.
class MockBranchRepository implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return const [
      Branch(
        id: 'beylikduzu-vadi-loca',
        lat: 41.00838,
        lng: 28.632925,
        name: 'Beylikdüzü Vadi Loca',
        address: 'Adnan Kahveci Mah. Sayaca Cad. No:13, Beylikdüzü / İstanbul',
        city: 'İstanbul',
        phone: '(0212) 242 21 21',
        distanceMeters: 350,
        isOpen: true,
        hours: '08:00–01:00',
        prepMinutes: 7,
      ),
      Branch(
        id: 'beylikduzu-son-durak',
        lat: 41.021873,
        lng: 28.623523,
        name: 'Beylikdüzü Son Durak',
        address:
            'Cumhuriyet Mah. Yıldıray Çınar Sok. No:47-1, Büyükçekmece / İstanbul',
        city: 'İstanbul',
        distanceMeters: 2100,
        isOpen: true,
        hours: '24 saat açık',
        prepMinutes: 8,
      ),
      Branch(
        id: 'vatan-caddesi',
        lat: 41.016863,
        lng: 28.940617,
        name: 'Vatan Caddesi',
        address:
            'Akşemsettin Mah. Adnan Menderes Vatan Bulvarı, Dosso Dossi Hotel No:46-48 İç Kapı No:1, Fatih / İstanbul',
        city: 'İstanbul',
        distanceMeters: 24000,
        isOpen: true,
        hours: '08:00–24:00',
        prepMinutes: 10,
      ),
      Branch(
        id: 'diyarbakir-stad',
        lat: 37.926528,
        lng: 40.164817,
        name: 'Diyarbakır Stad',
        address:
            'Fırat Mah. 507. Sok. Dicle Fırat No:5 İç Kapı No:29, Kayapınar / Diyarbakır',
        city: 'Diyarbakır',
        distanceMeters: 1360000,
        isOpen: true,
        hours: '08:00–01:00',
        prepMinutes: 9,
      ),
    ];
  }
}
