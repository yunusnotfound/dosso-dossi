// Existing homepage content is preserved for the immersive storefront.
export const storeInfoCopy = {
  tr: {
    storyLabel: "KAHVENİN ETRAFINDA",
    storyTitle: "BİR FİNCANDAN\nDAHA FAZLASI.",
    storyTabs: ["Kahve", "Sanat", "Birlikte"],
    storyTexts: [
      "Dosso Dossi’de kahve, günün bir parçasından fazlası. Her fincan; sohbetlere, yeni fikirlere ve kendine ayırdığın zamana eşlik eden küçük bir ritüel.",
      "İlhamı bir kahve molasında bulabilir misin? Bizce evet. Sanatın, müziğin ve kahvenin bir araya geldiği yaşam alanları yaratmayı seviyoruz.",
      "En güzel anlar paylaştıklarımız. Bazen bir dostla buluşmak, bazen yeni bir yüzle tanışmak için. Dosso Dossi, birlikte olmanın tadını çıkardığımız yer.",
    ],
    storyCta: "Bir kahvede buluşalım",
    storyImage: "Dosso Dossi kahve bardağı ve kahve çekirdekleri",
    locationLabel: "SANA YAKIN BİR DOSSO DOSSI",
    locationTitle: "BİR KAHVEYE\nBEKLERİZ.",
    locationText:
      "Şehrin içinde, sana ait bir mola. Sana en yakın Dosso Dossi’yi keşfet.",
    cityLabel: "Şehir seç",
    allCities: "Tüm şehirler",
    map: "Yol tarifi al",
    menuLabel: "DOSSO DOSSI MENÜ",
    menuTitle: "HER MODUNA\nBİR KAHVE.",
    menuText:
      "Kimi gün sıcacık bir klasik, kimi gün buz gibi bir mola. Bugün senin kahven hangisi?",
    hot: "Sıcak kahveler",
    cold: "Soğuk kahveler",
    menuNote: "Şubelerdeki ürün bulunurluğu değişebilir.",
    menuCta: "En yakın şubeyi bul",
    franchiseLabel: "BİRLİKTE BÜYÜYELİM",
    franchiseTitle: "BU HİKÂYEYE\nSEN DE KATIL.",
    franchiseText:
      "Kahveye duyduğumuz tutkuyu yeni şehirlere, yeni buluşmalara taşıyalım. Dosso Dossi franchising dünyasını birlikte keşfedelim.",
    franchiseCta: "Birlikte konuşalım",
    coffeeAlt: "Kahveye süt dökerek latte sanatı hazırlayan barista",
    cupAlt: "Dosso Dossi kahve bardağı",
    coldAlt: "Dosso Dossi soğuk içecekleri",
  },
  en: {
    storyLabel: "GATHER AROUND COFFEE",
    storyTitle: "MORE THAN\nA CUP OF COFFEE.",
    storyTabs: ["Coffee", "Art", "Together"],
    storyTexts: [
      "At Dosso Dossi, coffee is more than part of the day. Every cup is a small ritual, made for good conversations, new ideas and a little time for yourself.",
      "Can inspiration begin with a coffee break? We think so. We love creating spaces where art, music and coffee come together.",
      "Our favourite moments are the ones we share. Catching up with a friend, meeting someone new. Dosso Dossi is a place to enjoy being together.",
    ],
    storyCta: "Let’s meet over coffee",
    storyImage: "Dosso Dossi coffee cup with coffee beans",
    locationLabel: "FIND YOUR DOSSO DOSSI",
    locationTitle: "COME OVER\nFOR COFFEE.",
    locationText:
      "A moment of your own, right in the city. Find a Dosso Dossi near you.",
    cityLabel: "Select a city",
    allCities: "All cities",
    map: "Get directions",
    menuLabel: "THE DOSSO DOSSI MENU",
    menuTitle: "A COFFEE FOR\nEVERY MOOD.",
    menuText:
      "Some days call for a comforting classic. Others, a refreshing pause. What’s your coffee today?",
    hot: "Hot coffees",
    cold: "Iced coffees",
    menuNote: "Product availability may vary by location.",
    menuCta: "Find your nearest location",
    franchiseLabel: "LET’S GROW TOGETHER",
    franchiseTitle: "BE PART OF\nOUR STORY.",
    franchiseText:
      "Let’s take our love of coffee to new cities and new conversations. Discover the world of Dosso Dossi franchising with us.",
    franchiseCta: "Let’s talk",
    coffeeAlt: "Barista pouring milk to create latte art",
    cupAlt: "Dosso Dossi coffee cup",
    coldAlt: "Dosso Dossi cold drinks",
  },
} as const;

export const storeInfoUi = {
  tr: {
    close: "Kapat",
    navigation: "Bölümler",
    sections: {
      story: "Kahve ve biz",
      mobile: "MOBİL",
      menu: "Menümüz",
      branches: "Şubelerimiz",
      franchise: "Franchising",
    },
  },
  en: {
    close: "Close",
    navigation: "Sections",
    sections: {
      story: "Coffee & us",
      mobile: "MOBILE",
      menu: "Our menu",
      branches: "Our locations",
      franchise: "Franchising",
    },
  },
} as const;

export const storeBranches = [
  {
    name: "Beylikdüzü Vadi Loca",
    city: "İstanbul",
    address: "Adnan Kahveci Mah. Sayaca Cad. No:13, Beylikdüzü / İstanbul",
    coordinates: "41.00838,28.632925",
  },
  {
    name: "Beylikdüzü Son Durak",
    city: "İstanbul",
    address:
      "Cumhuriyet Mah. Yıldıray Çınar Sok. No:47-1, Büyükçekmece / İstanbul",
    coordinates: "41.021873,28.623523",
  },
  {
    name: "Vatan Caddesi",
    city: "İstanbul",
    address:
      "Akşemsettin Mah. Adnan Menderes Vatan Bulvarı, Dosso Dossi Hotel No:46-48, Fatih / İstanbul",
    coordinates: "41.016863,28.940617",
  },
  {
    name: "Diyarbakır Stad",
    city: "Diyarbakır",
    address:
      "Fırat Mah. 507. Sok. Dicle Fırat No:5 İç Kapı No:29, Kayapınar / Diyarbakır",
    coordinates: "37.926528,40.164817",
  },
] as const;

export const storeMenuItems = {
  hot: ["Espresso", "Cafe Americano", "Caffe Latte"],
  cold: ["Americano Freddo", "Latte Freddo", "Matcha Latte Freddo"],
} as const;

export const franchisePhone = "tel:+902122422121";
