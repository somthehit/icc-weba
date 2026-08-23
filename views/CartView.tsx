'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ArrowLeft, 
  Tag, 
  Truck, 
  ShieldCheck,
  Heart,
  CheckCircle2,
  Clock,
  Sparkles,
  Laptop
} from 'lucide-react';

export const CartView: React.FC = () => {
  const {
    cart,
    products,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    getCartSubtotal,
    getCartDiscount,
    getCartTotal,
    cartQuote,
    isQuoting,
    quoteError,
    cartError,
    activeCoupon,
    applyCoupon,
    removeCoupon,
    toggleWishlist,
    isInWishlist,
    addToCart,
    navigateTo
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [msg, setMsg] = useState({ text: '', isError: false });

  // Every figure below comes from `POST /api/orders/quote`, which is the same
  // module that prices the order when it is placed — so this summary cannot drift
  // from the invoice the way the old in-browser arithmetic did.
  const subtotal = getCartSubtotal();
  const discount = getCartDiscount();
  const total = getCartTotal();
  const net = Math.max(0, subtotal - discount);

  // Savings calculation (MRP difference + coupon discount)
  const totalMrp = cart.reduce((acc, item) => acc + (item.product.mrp * item.quantity), 0);
  const totalSavings = Math.max(0, totalMrp - net);

  // From `store_profile`, not a hardcoded 10000. Zero means the shop has no
  // free-delivery rule, in which case there is no meter to show.
  const freeDeliveryThreshold = cartQuote?.freeDeliveryThreshold ?? 0;
  const remainingForFreeDelivery = Math.max(0, freeDeliveryThreshold - net);
  // The fee depends on the delivery zone, which is chosen at checkout.
  const deliveryKnown = cartQuote !== null && (cartQuote.deliveryFee > 0 || cartQuote.freeDeliveryApplied);

  // Recommended accessories for cross-sell (peripherals, storage, accessories)
  const crossSellProducts = products.filter(
    (p) => p.category === 'peripherals-accessories' || p.category === 'networking' || p.category === 'pc-components'
  ).slice(0, 4);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || isApplying) return;
    setIsApplying(true);
    const res = await applyCoupon(couponInput);
    setIsApplying(false);
    setMsg({ text: res.message, isError: !res.success });
    if (res.success) setCouponInput('');
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 text-xs">
        {/* Empty State Banner */}
        <div className="max-w-2xl mx-auto text-center space-y-4 bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 text-[#0056b3] rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-[#1a1a1a]">Your Shopping Cart is Empty</h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Explore our wide selection of high-performance laptops, PC components, Hikvision CCTV systems, Canon printers, and smart electronics.
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigateTo('shop')}
              className="bg-[#1a1a1a] hover:bg-black text-white font-bold text-xs py-3 px-8 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Explore Shop Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Trending Recommendations */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h3 className="font-extrabold text-base text-[#1a1a1a]">Popular Products You Might Like</h3>
            <button onClick={() => navigateTo('shop')} className="text-[#0056b3] font-bold hover:underline">
              View All Shop
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {products.slice(0, 4).map((p) => (
              <div 
                key={p.id} 
                className="bg-white rounded-2xl border border-gray-100 p-3 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden p-2 flex items-center justify-center mb-2">
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-[10px] font-bold text-[#0056b3] uppercase">{p.brand}</span>
                  <h4 className="font-bold text-xs text-[#1a1a1a] line-clamp-1">{p.name}</h4>
                  <div className="font-extrabold text-xs text-[#0056b3] mt-1">NPR {p.sellingPrice.toLocaleString()}</div>
                </div>
                <button
                  onClick={() => addToCart(p)}
                  className="mt-3 w-full bg-gray-100 hover:bg-[#0056b3] hover:text-white text-[#1a1a1a] font-bold text-[11px] py-1.5 rounded-lg transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 text-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 gap-2">
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Shopping Cart ({cart.length} {cart.length === 1 ? 'Item' : 'Items'})</h1>
          <p className="text-gray-500 text-[11px] mt-0.5">Review your items, apply vouchers, and select shipping location.</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All Items</span>
        </button>
      </div>

      {/* Free Delivery Meter & Savings Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Meter — only when the shop actually has a free-delivery threshold */}
        {freeDeliveryThreshold > 0 && (
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-2">
            {remainingForFreeDelivery > 0 ? (
              <div className="flex justify-between items-center text-[#0056b3] font-bold">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#0056b3]" />
                  Add NPR {remainingForFreeDelivery.toLocaleString()} more to qualify for FREE delivery
                </span>
                <span>{Math.round((net / freeDeliveryThreshold) * 100)}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-700 font-extrabold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Your order qualifies for FREE delivery!</span>
              </div>
            )}
            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0056b3] h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, (net / freeDeliveryThreshold) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Savings banner */}
        {totalSavings > 0 && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-green-800 text-sm">Instant Order Savings!</span>
                <p className="text-green-700 text-[11px]">You are saving a total of NPR {totalSavings.toLocaleString()} on this purchase.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Item List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
            {cart.map((item) => {
              const specSummary = Array.isArray(item.product.specifications) 
                ? item.product.specifications.slice(0, 3).map(s => s.value).join(' · ') 
                : '';
              const inWishlist = isInWishlist(item.product.id);

              return (
                <div key={item.product.id} className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Image */}
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-20 h-20 object-contain rounded-2xl bg-gray-50 border border-gray-100 p-2 flex-shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#0056b3] bg-blue-50 px-2 py-0.5 rounded uppercase">
                        {item.product.brand}
                      </span>
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        In Stock ({item.product.stockQuantity} Left)
                      </span>
                      <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#0056b3]" />
                        {item.product.warranty}
                      </span>
                    </div>

                    <h3 
                      onClick={() => navigateTo('product-detail', item.product.slug)}
                      className="font-bold text-sm text-[#1a1a1a] hover:text-[#0056b3] cursor-pointer line-clamp-1"
                    >
                      {item.product.name}
                    </h3>

                    {specSummary && (
                      <p className="text-[11px] text-gray-500 line-clamp-1">{specSummary}</p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-extrabold text-sm text-[#0056b3]">
                        NPR {item.product.sellingPrice.toLocaleString()}
                      </span>
                      {item.product.mrp > item.product.sellingPrice && (
                        <span className="text-gray-400 line-through text-[11px]">
                          NPR {item.product.mrp.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controls & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 hover:bg-gray-200 text-[#1a1a1a]"
                        title="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-bold text-[#1a1a1a]">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 hover:bg-gray-200 text-[#1a1a1a]"
                        title="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right font-black text-sm text-[#1a1a1a] min-w-[90px]">
                      NPR {(item.product.sellingPrice * item.quantity).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleWishlist(item.product.id)}
                        className={`p-2 rounded-lg transition-colors ${inWishlist ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}
                        title={inWishlist ? 'In Wishlist' : 'Move to Wishlist'}
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => navigateTo('shop')}
              className="inline-flex items-center gap-2 font-bold text-xs text-[#0056b3] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>
          </div>

          {/* Cross-Sell Strip */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0056b3]" />
                <h3 className="font-bold text-xs text-[#1a1a1a]">Frequently Bought Together (Accessories)</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {crossSellProducts.map((p) => (
                <div key={p.id} className="bg-gray-50 p-2.5 rounded-2xl border border-gray-100 flex flex-col justify-between">
                  <div>
                    <img src={p.images[0]} alt={p.name} className="w-full h-16 object-contain mb-1" />
                    <div className="font-bold text-[11px] text-[#1a1a1a] line-clamp-1">{p.name}</div>
                    <div className="font-extrabold text-[11px] text-[#0056b3]">NPR {p.sellingPrice.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    className="mt-2 w-full bg-[#0056b3] text-white font-bold text-[10px] py-1 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sticky Summary Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5 text-xs sticky top-24">
            <h3 className="font-extrabold text-sm text-[#1a1a1a] border-b border-gray-100 pb-3">
              Order Summary
            </h3>

            {/* Coupon Promo Input */}
            {!activeCoupon ? (
              <form onSubmit={handleApply} className="space-y-2">
                <label className="font-bold text-gray-700 block">Apply Voucher Coupon</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="e.g. INTEL10"
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 uppercase font-bold text-[#1a1a1a] text-xs focus:outline-none focus:ring-2 focus:ring-[#0056b3]"
                  />
                  <button
                    type="submit"
                    disabled={isApplying}
                    className="bg-[#1a1a1a] hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    {isApplying ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {msg.text && (
                  <p className={`text-[11px] font-bold ${msg.isError ? 'text-red-600' : 'text-green-600'}`}>
                    {msg.text}
                  </p>
                )}
              </form>
            ) : (
              <div className="bg-green-50 border border-green-200 p-3 rounded-2xl flex items-center justify-between text-green-800">
                <div>
                  <span className="font-bold block">Coupon &apos;{activeCoupon.code}&apos; Active</span>
                  <span className="text-[10px] text-green-700">{activeCoupon.description}</span>
                </div>
                <button onClick={removeCoupon} className="text-red-600 font-bold hover:underline text-[11px]">
                  Remove
                </button>
              </div>
            )}

            {/* Anything the server refused — an expired coupon, a line that ran
                out of stock — said in its own words rather than guessed at. */}
            {(quoteError || cartError) && (
              <p className="bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px] p-2.5 rounded-xl">
                {quoteError || cartError}
              </p>
            )}

            {/* Price Breakdown */}
            <div className="space-y-2.5 border-t border-b border-gray-100 py-3 text-gray-600">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-bold text-[#1a1a1a]">NPR {subtotal.toLocaleString()}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-green-700 font-bold">
                  <span>Coupon Discount:</span>
                  <span>-NPR {discount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Delivery:</span>
                <span className="font-bold text-[#1a1a1a]">
                  {cartQuote?.freeDeliveryApplied ? (
                    <span className="text-green-700 font-black">FREE</span>
                  ) : deliveryKnown ? (
                    `NPR ${cartQuote!.deliveryFee.toLocaleString()}`
                  ) : (
                    <span className="text-gray-500 font-medium">Calculated at checkout</span>
                  )}
                </span>
              </div>

              {cartQuote && (
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>VAT / Tax:</span>
                  <span>
                    {cartQuote.pricesIncludeVat
                      ? `NPR ${cartQuote.vatAmount.toLocaleString()} (${cartQuote.vatRatePercent}% included)`
                      : `NPR ${cartQuote.vatAmount.toLocaleString()} (${cartQuote.vatRatePercent}%)`}
                  </span>
                </div>
              )}
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center text-sm font-black text-[#1a1a1a]">
              <span>{deliveryKnown ? 'Grand Total:' : 'Subtotal Due:'}</span>
              <span className="text-lg text-[#0056b3]">
                {isQuoting && !cartQuote ? (
                  <span className="inline-block w-24 h-5 bg-gray-100 rounded animate-pulse align-middle" />
                ) : (
                  `NPR ${total.toLocaleString()}`
                )}
              </span>
            </div>

            {/* Checkout CTA */}
            <button
              onClick={() => navigateTo('checkout')}
              className="w-full bg-[#1a1a1a] hover:bg-black text-white font-black text-sm py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 group"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Trust Badges Bar */}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0056b3]" />
                <span>100% Genuine Gear</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#0056b3]" />
                <span>Fast Nepal Dispatch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0056b3]" />
                <span>Official Brand Warranty</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0056b3]" />
                <span>7-Day Replacement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
