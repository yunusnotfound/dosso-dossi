import type { Locale } from "@/lib/site";

export const menuCopy = {
  tr: {
    label: "DOSSO DOSSI · MENÜMÜZ", title: "HER MODUNA", titleAccent: "BİR LEZZET.",
    intro: "İlk yudumdan son lokmaya. Sıcacık klasikler, buz gibi renkler ve kahvenin en güzel eşlikçileri.",
    explore: "Menüyü keşfet", hot: "Sıcak bir mola", fresh: "Biraz ferahlık", sweet: "Tatlı bir kaçamak",
    categories: "MENÜDE KEŞFET", all: "Tüm lezzetler", search: "Canın ne çekiyor?", searchLabel: "Menüde ürün ara",
    reset: "Temizle", featured: "Öne çıkanlar", new: "Yeni lezzetler", count: "lezzet", categoryCount: "kategori",
    results: "Aradığın lezzetler", empty: "Bu kez buluşamadık.", emptyText: "Başka bir isim dene ya da tüm menüye göz at.",
    noPhoto: "DOSSO DOSSI", detail: "Keşfet", newBadge: "YENİ", featuredBadge: "SEÇKİ", size: "ml",
    endLabel: "BİR KAHVEDE BULUŞALIM", endTitle: "GERİSİ GÜZEL\nBİR SOHBET.",
    endText: "Favorini buldun. Şimdi sana en yakın Dosso Dossi’de bir mola ver.", branches: "Şubelerimizi keşfet",
    note: "Fiyatlar ve ürün bulunurluğu şubeye göre değişebilir.", full: "Tam sayfa görüntüle", back: "Sanal mağazaya dön",
    browse: "Klasik mağaza", clearSearch: "Aramayı temizle", footer: "KAHVE. RENK. BİRAZ DA SEN.",
  },
  en: {
    label: "DOSSO DOSSI · OUR MENU", title: "A FLAVOUR FOR", titleAccent: "EVERY MOOD.",
    intro: "From the first sip to the last bite. Comforting classics, refreshing colours and coffee’s favourite companions.",
    explore: "Explore the menu", hot: "A warm moment", fresh: "Something refreshing", sweet: "A sweet escape",
    categories: "EXPLORE THE MENU", all: "All flavours", search: "What are you craving?", searchLabel: "Search the menu",
    reset: "Clear", featured: "Our selection", new: "New flavours", count: "flavours", categoryCount: "categories",
    results: "Your discoveries", empty: "Not this time.", emptyText: "Try another name or explore our complete menu.",
    noPhoto: "DOSSO DOSSI", detail: "Explore", newBadge: "NEW", featuredBadge: "SELECTED", size: "ml",
    endLabel: "LET’S MEET OVER COFFEE", endTitle: "STAY FOR\nTHE CONVERSATION.",
    endText: "Found your favourite? Take a moment at a Dosso Dossi near you.", branches: "Explore our locations",
    note: "Prices and availability may vary by location.", full: "Open full page", back: "Back to the virtual store",
    browse: "Online shop", clearSearch: "Clear search", footer: "COFFEE. COLOUR. A LITTLE YOU.",
  },
} as const;

const categoryEnglish: Record<string, string> = {
  "sicak-kahveler": "Hot coffees", "sicak-cikolatalar": "Hot chocolates", caylar: "Teas",
  "soguk-kahveler": "Iced coffees", "aromali-kahveler": "Flavoured coffees", "soguk-cikolatali": "Iced chocolate drinks",
  "soguk-meyveli": "Fruit drinks", "soguk-caylar": "Iced teas", "soft-icecekler": "Soft drinks",
  kahvalti: "Breakfast", tatlilar: "Desserts", "kek-kurabiye": "Cakes & cookies", "sandvic-tost": "Sandwiches & toast", atistirmalik: "Snacks",
};
export function categoryLabel(id: string, name: string, locale: Locale) {
  return locale === "en" ? categoryEnglish[id] ?? name : name;
}
export function menuPrice(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 2, minimumFractionDigits: 0,
  }).format(value);
}
export function searchable(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
}
