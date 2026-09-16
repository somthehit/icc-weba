'use client';

import React, { useEffect, useState } from 'react';
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
  Clock,
  ImageOff
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
  const imageUrl = product.images?.[0] || '';
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const imageFailed = !imageUrl || failedImageUrl === imageUrl;

  // Compute time-bound effective price & discount status dynamically
  const { effectivePrice, onOffer, timeRemainingMs, discountPercentage } = computeProductEffectivePrice(product);

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg sm:p-4">
      {/* Top Badges */}
      <div className="pointer-events-none absolute left-5 right-5 top-5 z-10 flex items-start justify-between gap-2">
        <div className="flex max-w-[calc(100%-44px)] flex-wrap items-start gap-1">
          {onOffer && (
            <span className="pointer-events-auto flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-sm">
              <Clock className="w-2.5 h-2.5" />
              <span>-{discountPercentage}% LIMITED</span>
            </span>
          )}
          {!onOffer && discountPercentage > 0 && (
            <span className="pointer-events-auto rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
              -{discountPercentage}% OFF
            </span>
          )}
          {product.isNewArrival && (
            <span className="pointer-events-auto rounded-md bg-[#0056b3] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
              NEW
            </span>
          )}
          {product.isTrending && (
            <span className="pointer-events-auto rounded-md bg-purple-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
              TRENDING
            </span>
          )}
          {product.isBestSeller && !product.isNewArrival && !product.isTrending && (
            <span className="pointer-events-auto rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
              BESTSELLER
            </span>
          )}
        </div>

        {/* Quick Action Overlay Icons */}
        <div className="pointer-events-auto flex shrink-0 flex-col gap-1.5">
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
        className="relative mb-4 flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100 p-4 transition-all group-hover:border-blue-100"
      >
        {!imageFailed ? <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setFailedImageUrl(imageUrl)}
        /> : <div className="flex flex-col items-center justify-center gap-2 px-8 text-center text-slate-400"><span className="rounded-2xl bg-white p-4 shadow-sm"><ImageOff className="h-8 w-8" /></span><span className="text-[10px] font-bold uppercase tracking-widest">Image unavailable</span><span className="text-xs font-semibold text-slate-500">{product.brand}</span></div>}

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
      <div className="flex flex-1 flex-col space-y-1">
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
          className="min-h-10 cursor-pointer text-sm font-bold leading-5 text-[#1a1a1a] transition-colors line-clamp-2 hover:text-[#0056b3]"
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
