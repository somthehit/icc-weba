'use client';

import React from 'react';
import { Product } from '@/types';
import { useStore } from '@/context/StoreContext';
import { computeProductEffectivePrice, formatCountdownTime } from '@/lib/offers/offerUtils';
import { 
  ShoppingCart, 
  Heart, 
  Eye, 
  Layers, 
  Star, 
  Check, 
  ShieldCheck, 
  Tag,
  Clock
} from 'lucide-react';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { 
    addToCart, 
    toggleWishlist, 
    isInWishlist, 
    toggleCompare, 
    isInCompare, 
    setQuickViewProduct,
    navigateTo 
  } = useStore();

  const isWishlisted = isInWishlist(product.id);
  const isCompared = isInCompare(product.id);

  // Compute time-bound effective price & discount status dynamically
  const { effectivePrice, onOffer, timeRemainingMs, discountPercentage } = computeProductEffectivePrice(product);

  return (
    <div className="group bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative">
      {/* Top Badges */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          {onOffer && (
            <span className="bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded shadow pointer-events-auto flex items-center gap-1 uppercase tracking-wider animate-pulse">
              <Clock className="w-2.5 h-2.5" />
              <span>TIMED OFFER (-{discountPercentage}%)</span>
            </span>
          )}
          {!onOffer && discountPercentage > 0 && (
            <span className="bg-amber-500 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow pointer-events-auto">
              -{discountPercentage}% OFF
            </span>
          )}
          {product.isNewArrival && (
            <span className="bg-[#0056b3] text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider pointer-events-auto">
              NEW
            </span>
          )}
          {product.isTrending && (
            <span className="bg-purple-600 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider pointer-events-auto">
              🔥 TRENDING
            </span>
          )}
          {product.isBestSeller && !product.isNewArrival && !product.isTrending && (
            <span className="bg-emerald-600 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider pointer-events-auto">
              BESTSELLER
            </span>
          )}
        </div>

        {/* Quick Action Overlay Icons */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            className={`p-2 rounded-full shadow-md transition-all duration-200 transform active:scale-95 ${
              isWishlisted
                ? 'bg-red-500 text-white ring-2 ring-red-300 scale-105'
                : 'bg-white/95 text-gray-600 hover:text-red-500 hover:bg-white'
            }`}
            title={isWishlisted ? 'Saved in Wishlist (Click to remove)' : 'Save to Wishlist'}
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          >
            <Heart className={`w-4 h-4 transition-transform ${isWishlisted ? 'fill-current scale-110' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuickViewProduct(product);
            }}
            className="p-2 rounded-full bg-white/95 hover:bg-white text-gray-600 hover:text-[#0056b3] shadow-md transition-all active:scale-95"
            title="Quick View"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Product Image Frame */}
      <div 
        onClick={() => navigateTo('product-detail', product.slug)}
        className="bg-gray-50 rounded-xl p-2 aspect-square mb-3 flex items-center justify-center relative border border-transparent group-hover:border-gray-200 transition-all overflow-hidden cursor-pointer"
      >
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Hover / Touch Quick Add Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToCart(product, 1);
          }}
          disabled={!product.inStock}
          className="absolute bottom-3 left-3 right-3 bg-[#1a1a1a] hover:bg-black text-white py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>{product.inStock ? 'Add to Cart' : 'Out of Stock'}</span>
        </button>
      </div>

      {/* Product Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
            {product.brand}
          </p>
          {product.releaseDate && (
            <span className="text-[10px] text-slate-400 font-medium font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100" title={`Released on ${product.releaseDate}`}>
              {product.releaseDate.split('-')[0]}
            </span>
          )}
        </div>

        <h4 
          onClick={() => navigateTo('product-detail', product.slug)}
          className="text-sm font-bold text-[#1a1a1a] hover:text-[#0056b3] transition-colors cursor-pointer truncate"
          title={product.name}
        >
          {product.name}
        </h4>

        {/* Price Row */}
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[#0056b3] font-black text-sm">
              NPR {effectivePrice.toLocaleString()}
            </span>
            {(onOffer || product.mrp > effectivePrice) && (
              <span className="text-[10px] text-gray-400 line-through">
                NPR {product.sellingPrice > effectivePrice ? product.sellingPrice.toLocaleString() : product.mrp.toLocaleString()}
              </span>
            )}
          </div>

          {/* Countdown indicator when on offer */}
          {onOffer && timeRemainingMs > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              <Clock className="w-2.5 h-2.5 animate-pulse" />
              <span suppressHydrationWarning>Ends in: {formatCountdownTime(timeRemainingMs)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
