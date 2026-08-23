'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingCart, 
  ArrowRight, 
  Truck, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const { 
    cart, 
    isCartDrawerOpen, 
    setIsCartDrawerOpen, 
    removeFromCart, 
    updateCartQuantity, 
    getCartSubtotal, 
    getCartDiscount, 
    getCartTotal, 
    navigateTo 
  } = useStore();

  if (!isCartDrawerOpen) return null;

  const subtotal = getCartSubtotal();
  const freeShippingThreshold = 10000;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl border-l border-gray-100">
        {/* Drawer Header */}
        <div className="p-4 bg-[#1a1a1a] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm">Shopping Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
          </div>
          <button
            onClick={() => setIsCartDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Meter */}
        <div className="bg-blue-50 border-b border-blue-100 p-3 text-xs text-[#0056b3] space-y-1.5">
          {remainingForFreeShipping > 0 ? (
            <div className="flex items-center justify-between font-semibold text-[11px]">
              <span className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-[#0056b3]" />
                Add NPR {remainingForFreeShipping.toLocaleString()} for Free Valley Delivery
              </span>
              <span>NPR {subtotal.toLocaleString()} / 10,000</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green-700 font-bold text-[11px]">
              <CheckCircle2 className="w-4 h-4" />
              <span>You qualify for FREE Kathmandu Valley Delivery!</span>
            </div>
          )}
          <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#0056b3] h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100 text-xs">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="p-4 bg-gray-100 text-gray-400 rounded-full">
                <ShoppingCart className="w-12 h-12" />
              </div>
              <div>
                <h4 className="font-bold text-[#1a1a1a] text-base">Your cart is empty</h4>
                <p className="text-xs text-gray-500 mt-1">Explore our latest laptops, components, CCTV kits and printers.</p>
              </div>
              <button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  navigateTo('shop');
                }}
                className="bg-[#1a1a1a] hover:bg-black text-white font-bold text-xs py-3 px-6 rounded-xl shadow transition-colors"
              >
                Browse Shop Catalog
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="py-3 flex gap-3 items-center">
                <img
                  src={item.product.images[0]}
                  alt={item.product.name}
                  className="w-16 h-16 object-contain rounded-xl border border-gray-100 bg-gray-50 p-1 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-xs text-[#1a1a1a] truncate">{item.product.name}</h5>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>Brand: {item.product.brand}</span>
                    <span className="text-green-700 font-semibold">• In Stock</span>
                  </div>
                  <div className="text-xs font-bold text-[#0056b3] mt-0.5">
                    NPR {item.product.sellingPrice.toLocaleString()}
                  </div>

                  {/* Quantity Control */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 hover:bg-gray-200 text-gray-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-bold text-[#1a1a1a]">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 hover:bg-gray-200 text-gray-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right font-black text-xs text-[#1a1a1a]">
                  NPR {(item.product.sellingPrice * item.quantity).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer Summary */}
        {cart.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3 text-xs">
            <div className="flex justify-between items-center text-[#1a1a1a]">
              <span className="font-bold">Subtotal:</span>
              <span className="font-black text-sm text-[#0056b3]">NPR {subtotal.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  navigateTo('cart');
                }}
                className="w-full bg-gray-200 hover:bg-gray-300 text-[#1a1a1a] font-bold py-2.5 rounded-xl transition-colors text-center"
              >
                View Full Cart
              </button>
              <button
                onClick={() => {
                  setIsCartDrawerOpen(false);
                  navigateTo('checkout');
                }}
                className="w-full bg-[#1a1a1a] hover:bg-black text-white font-bold py-2.5 rounded-xl shadow transition-colors text-center flex items-center justify-center gap-1"
              >
                <span>Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0056b3]" />
              <span>Official Warranty & Genuine Guarantee</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
