import snapshot from "@/data/menu-snapshot.json";

export type MobileMenuOption = {
  id: string;
  name: string;
  /** Added to the product's base price, in TRY. */
  priceDelta: number;
};

export type MobileMenuOptions = {
  milks: MobileMenuOption[];
  shots: MobileMenuOption[];
};

export type MobileMenuProduct = {
  id: string;
  name: string;
  description: string;
  /** Turkish lira, not minor currency units. */
  price: number;
  categoryId: string;
  /** Local copies of the application's detail and grid photographs. */
  imageUrl: string | null;
  gridImageUrl: string | null;
  /** Grid photograph first, then detail photograph; absent images remain null. */
  image: string | null;
  sizeMl: number;
  stampMultiplier: number;
  isNew: boolean;
  isFeatured: boolean;
  hasOptions: boolean;
};

export type MobileMenuCategory = {
  id: string;
  name: string;
  products: MobileMenuProduct[];
};

export type MobileMenuResult = {
  available: boolean;
  categories: MobileMenuCategory[];
  products: MobileMenuProduct[];
  options: MobileMenuOptions;
};

/** A fixed copy of the app's menu; this module never contacts its backend. */
export const menuSnapshot: MobileMenuResult = {
  available: true,
  products: snapshot.products,
  categories: snapshot.categories.map((category) => ({
    ...category,
    products: snapshot.products.filter((product) => product.categoryId === category.id),
  })),
  options: snapshot.options,
};
