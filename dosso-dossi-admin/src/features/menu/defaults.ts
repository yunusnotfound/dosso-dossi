import type { Product } from '../../api/schemas';
export const EMPTY: Product = {
  id: '',
  name: '',
  price: 0,
  categoryId: '',
  categoryName: '',
  description: '',
  imageUrl: null,
  gridImageUrl: null,
  sizeMl: 0,
  stampMultiplier: 1,
  isNew: false,
  isFeatured: false,
  hasOptions: false,
  isActive: true,
};
