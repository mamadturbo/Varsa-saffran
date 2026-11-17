import { Link } from 'wouter';
import type { Product } from '@/lib/types';
import { formatPrice, formatWeight } from '@/lib/site';
import { productPath } from '@/lib/routes';
import { UnitPrice } from './UnitPrice';
import { rememberDialogTrigger } from '@/lib/dialog-focus';

export function ProductComparison({ products, search }: { products: Product[]; search: string }) {
  return <details className="card-luxe mb-8 p-4 sm:p-6">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-cream-50">مقایسه وزن و مبلغ محصولات</summary>
    <p className="mt-3 text-sm leading-7 text-cream-300">فقط محصولات مطابق فیلترهای فعلی نمایش داده می‌شوند. بهای واحد وزن تقریبی است؛ فقط واحدهای یکسان را کنار هم مقایسه کنید. تفاوت نوع زعفران، کیفیت و محتویات بسته نیز مهم است.</p>
    <p className="mt-3 text-xs leading-6 text-cream-400 lg:hidden">برای دیدن ستون‌های دیگر، جدول را افقی حرکت دهید.</p>
    <div role="region" aria-label="جدول مقایسه محصولات" tabIndex={0} className="mt-4 overflow-x-auto rounded-xl border border-gold-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-600">
      <table className="w-full min-w-[660px] text-right text-sm">
        <caption className="sr-only">مقایسه وزن و مبلغ بسته‌های موجود در نتایج فعلی</caption>
        <thead className="bg-gold-500/10 text-cream-100"><tr>{['محصول و دسته', 'وزن ثبت‌شده', 'مبلغ هر بسته', 'بهای واحد وزن', 'انتخاب'].map(label => <th key={label} scope="col" className="p-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{products.map(product => <tr key={product.id} className="border-t border-gold-500/15 text-cream-200">
          <th scope="row" className="max-w-64 p-4 font-medium"><span className="block">{product.name}</span><span className="mt-1 block text-xs text-cream-400">{product.category}</span></th>
          <td className="p-4">{formatWeight(product.weight, product.weight_unit)}</td>
          <td className="p-4">{formatPrice(product.price)}</td>
          <td className="max-w-52 p-4"><UnitPrice product={product} /></td>
          <td className="p-4"><Link href={productPath(product.slug) + search} onClick={event => rememberDialogTrigger('product-dialog', event.currentTarget)} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4" aria-label={`انتخاب ${product.name}`}>انتخاب محصول</Link></td>
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
}
