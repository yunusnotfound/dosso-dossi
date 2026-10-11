import { useState } from 'react';
import { Tabs } from '../../components/form';
import { PageHeader } from '../../components/table';

import { CategoriesTab } from './CategoriesTab';
import { OptionsTab } from './OptionsTab';
import { ProductsTab } from './ProductsTab';
export function MenuPage() {
  const [tab, setTab] = useState('products');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-brand-ink uppercase">Menü & katalog</p>
        <PageHeader title="Menü" subtitle="Ürünleri, fiyatları ve görünürlüğü tek yerden yönetin." />
      </div>
      <Tabs
        tabs={[
          { id: 'products', label: 'Ürünler' },
          { id: 'categories', label: 'Kategoriler' },
          { id: 'options', label: 'Opsiyonlar' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'products' ? <ProductsTab /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
      {tab === 'options' ? <OptionsTab /> : null}
    </div>
  );
}
