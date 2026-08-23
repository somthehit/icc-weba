'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { computeProductEffectivePrice } from '@/lib/offers/offerUtils';
import { 
  Heart, 
  ShoppingCart, 
  Trash2, 
  ArrowLeft, 
  Eye, 
  ShieldCheck, 
  Clock, 
  Check, 
  Sparkles,
  User,
  LogIn,
  Layers
} from 'lucide-react';

export const WishlistView: React.FC = () => {
  const { 
    wishlist, 
    products, 
    isUserLoggedIn, 
    currentUser, 
    setIsAuthModalOpen, 
    addToCart, 
    moveWishlistToCart, 
    addAllWishlistToCart, 
    toggleWishlist, 
    clearWishlist, 
    setQuickViewProduct, 
    navigateTo 
  } = useStore();

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 text-xs">
      {/* 1. Page Breadcrumb & Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateTo('shop')}
          className="inline-flex items-center gap-1.5 font-bold text-gray-600 hover:text-[#0056b3] transition-colors bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Shop Catalog</span>
        </button>

        {isUserLoggedIn && currentUser && (
          <div className="flex items-center gap-2 bg-blue-50 text-[#0056b3] px-3 py-1.5 rounded-full font-bold border border-blue-100">
            <User className="w-3.5 h-3.5" />
            <span>Wishlist for {currentUser.name}</span>
          </div>
        )}
      </div>

      {/* 2. Top Banner Header */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-700 text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Heart className="w-4 h-4 fill-current text-white" />
            </div>
            <span className="font-extrabold uppercase tracking-wider text-[11px] text-red-100">Saved Items</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black">My Personal Wishlist</h1>
          <p className="text-red-100 text-xs max-w-xl">
            Keep track of laptops, PC parts, and peripherals you want to buy later. Wishlist items stay saved across your sessions.
          </p>
        </div>

        {/* Action Counters */}
        {isUserLoggedIn && wishlistedProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={addAllWishlistToCart}
              className="bg-white text-red-600 hover:bg-red-50 font-black px-5 py-3 rounded-2xl shadow transition-all flex items-center gap-2 text-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Add All to Shopping Cart ({wishlistedProducts.length})</span>
            </button>
            <button
              onClick={clearWishlist}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-2xl backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 text-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Not Logged In Callout */}
      {!isUserLoggedIn && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Please Sign In to Access Your Saved Wishlist</h3>
            <p className="text-gray-600 text-xs max-w-md mx-auto">
              Your saved items are synced to your customer account. Sign in or create a free account to view and manage your saved products.
            </p>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-all text-xs inline-flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>Sign In to View Wishlist</span>
          </button>
        </div>
      )}

      {/* 4. Wishlist Items Grid */}
      {isUserLoggedIn && (
        <>
          {wishlistedProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-400 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[#1a1a1a]">Your Wishlist is Empty</h3>
                <p className="text-gray-500 max-w-sm mx-auto text-xs">
                  You haven&apos;t saved any products yet. Click the heart icon on any product card in the catalog to save it for later.
                </p>
              </div>
              <button
                onClick={() => navigateTo('shop')}
                className="bg-[#1a1a1a] hover:bg-black text-white font-bold py-3 px-8 rounded-xl shadow transition-colors text-xs inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Explore Shop Catalog</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {wishlistedProducts.map((product) => {
                const { effectivePrice, onOffer, discountPercentage } = computeProductEffectivePrice(product);

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all flex flex-col justify-between relative group"
                  >
                    {/* Top Badges & Actions */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-gray-100 text-[#1a1a1a] font-extrabold text-[10px] px-2 py-0.5 rounded uppercase">
                        {product.brand}
                      </span>
                      <button
                        onClick={() => toggleWishlist(product.id)}
                        className="p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 transition-colors"
                        title="Remove from Wishlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Image */}
                    <div 
                      onClick={() => navigateTo('product-detail', product.slug)}
                      className="bg-gray-50 rounded-xl p-3 aspect-square mb-3 flex items-center justify-center cursor-pointer relative overflow-hidden"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      {onOffer && (
                        <span className="absolute top-2 left-2 bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                          -{discountPercentage}% OFF
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h4
                          onClick={() => navigateTo('product-detail', product.slug)}
                          className="font-bold text-xs text-[#1a1a1a] hover:text-[#0056b3] transition-colors cursor-pointer line-clamp-2"
                          title={product.name}
                        >
                          {product.name}
                        </h4>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          SKU: {product.sku}
                        </div>
                      </div>

                      {/* Price & Stock */}
                      <div className="pt-1 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[#0056b3] font-black text-sm">
                              NPR {effectivePrice.toLocaleString()}
                            </div>
                            {product.mrp > effectivePrice && (
                              <div className="text-[10px] text-gray-400 line-through">
                                NPR {product.mrp.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                              product.inStock
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {product.inStock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => setQuickViewProduct(product)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Quick View</span>
                        </button>
                        <button
                          onClick={() => moveWishlistToCart(product.id)}
                          disabled={!product.inStock}
                          className="bg-[#0056b3] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 shadow transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Move to Cart</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
