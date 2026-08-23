'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { Home, ShoppingBag, ShoppingCart, Heart, User, Sparkles } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { cart, wishlist, currentPage, navigateTo, setIsCartDrawerOpen } = useStore();

  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-around">
        <button
          onClick={() => navigateTo('home')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium ${
            currentPage === 'home' ? 'text-[#0056b3] font-bold' : 'text-slate-600'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => navigateTo('shop')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium ${
            currentPage === 'shop' ? 'text-[#0056b3] font-bold' : 'text-slate-600'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span>Shop</span>
        </button>

        <button
          onClick={() => navigateTo('ai-studio')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium ${
            currentPage === 'ai-studio' ? 'text-indigo-600 font-bold' : 'text-indigo-700'
          }`}
        >
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>AI Lab</span>
        </button>

        <button
          onClick={() => setIsCartDrawerOpen(true)}
          className="relative flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium text-slate-600"
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#0056b3] text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </div>
          <span>Cart</span>
        </button>

        <button
          onClick={() => navigateTo('wishlist')}
          className={`relative flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium ${
            currentPage === 'wishlist' ? 'text-red-600 font-bold' : 'text-slate-600'
          }`}
        >
          <div className="relative">
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-red-600 text-white font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </div>
          <span>Wishlist</span>
        </button>

        <button
          onClick={() => navigateTo('account')}
          className={`flex flex-col items-center gap-0.5 p-1.5 text-[11px] font-medium ${
            currentPage === 'account' ? 'text-[#0056b3] font-bold' : 'text-slate-600'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Account</span>
        </button>
      </div>
    </div>
  );
};
