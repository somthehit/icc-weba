'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { 
  X, 
  ShoppingCart, 
  Heart, 
  ShieldCheck, 
  Truck, 
  Star, 
  Layers, 
  Check 
} from 'lucide-react';

export const QuickViewModal: React.FC = () => {
  const { 
    quickViewProduct, 
    setQuickViewProduct, 
    addToCart, 
    toggleWishlist, 
    isInWishlist,
    toggleCompare,
    isInCompare,
    navigateTo 
  } = useStore();

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const isWishlisted = isInWishlist(product.id);
  const isCompared = isInCompare(product.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden relative border border-slate-200 my-8">
        {/* Close Button */}
        <button
          onClick={() => setQuickViewProduct(null)}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Image Gallery */}
          <div className="bg-slate-50 p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-200">
            <img
              src={product.images[0]}
              alt={product.name}
              className="max-h-72 w-auto object-contain"
            />
          </div>

          {/* Right Product Details */}
          <div className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-2 py-0.5 rounded uppercase">
                  {product.brand}
                </span>
                <span className="text-xs text-slate-500 font-medium">SKU: {product.sku}</span>
              </div>

              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                {product.name}
              </h2>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <div className="flex items-center text-amber-400">
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <span className="font-bold text-slate-900">{product.rating}</span>
                <span>({product.reviewCount} customer reviews)</span>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                {product.shortDescription}
              </p>

              {/* Price */}
              <div className="pt-2">
                <div className="text-2xl font-black text-blue-700">
                  NPR {product.sellingPrice.toLocaleString()}
                </div>
                {product.mrp > product.sellingPrice && (
                  <div className="text-xs text-slate-400 line-through">
                    MRP NPR {product.mrp.toLocaleString()} ({product.discountPercent}% OFF)
                  </div>
                )}
              </div>

              {/* Warranty & Delivery */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{product.warranty}</span>
                </div>
                <div className="flex items-center gap-2 text-amber-700 font-medium">
                  <Truck className="w-4 h-4" />
                  <span> Kathmandu Valley Same-day Delivery Available</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    addToCart(product, 1);
                    setQuickViewProduct(null);
                  }}
                  disabled={!product.inStock}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Shopping Cart</span>
                </button>

                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={`p-3 rounded-xl border transition-colors ${
                    isWishlisted ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title="Wishlist"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={() => toggleCompare(product.id)}
                  className={`p-3 rounded-xl border transition-colors ${
                    isCompared ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title="Compare Specs"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  setQuickViewProduct(null);
                  navigateTo('product-detail', product.slug);
                }}
                className="w-full text-center text-xs font-bold text-blue-700 hover:underline py-1"
              >
                View Full Specifications & Warranty Details →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
