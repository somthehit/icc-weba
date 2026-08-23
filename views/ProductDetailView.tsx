'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { SeoHead } from '@/context/SeoContext';
import { ProductCard } from '@/components/ProductCard';
import { ProductImageZoom } from '@/components/ProductImageZoom';
import { HardwareReviewsSection } from '@/components/HardwareReviewsSection';
import { computeProductEffectivePrice, formatCountdownTime } from '@/lib/offers/offerUtils';
import { 
  ShoppingCart, 
  Heart, 
  Layers, 
  ShieldCheck, 
  Truck, 
  Star, 
  Check, 
  ArrowLeft, 
  Share2, 
  CheckCircle2, 
  Package, 
  HelpCircle,
  MessageSquare,
  Clock,
  Zap,
  Tag
} from 'lucide-react';

export const ProductDetailView: React.FC = () => {
  const {
    products,
    selectedProductSlug,
    addToCart,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    isInCompare,
    reviews,
    addReview,
    navigateTo,
    updateProduct,
    isAdminLoggedIn,
    isCatalogLoading
  } = useStore();

  const product = products.find((p) => p.slug === selectedProductSlug);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'warranty' | 'reviews'>('overview');
  const [isApplyOfferModalOpen, setIsApplyOfferModalOpen] = useState(false);
  const [offerDays, setOfferDays] = useState(7);
  const [offerDiscountType, setOfferDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [offerDiscountValue, setOfferDiscountValue] = useState(10);

  // The catalogue arrives from the API after mount, so an unmatched slug means
  // either "still loading" or a genuinely bad URL — never "show the first product".
  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        {isCatalogLoading ? (
          <>
            <div className="mx-auto w-10 h-10 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading product details…</p>
          </>
        ) : (
          <>
            <Package className="w-10 h-10 mx-auto text-slate-300" />
            <h1 className="text-xl font-black text-slate-900">Product not found</h1>
            <p className="text-sm text-slate-500">
              This product may have been discontinued or the link may be out of date.
            </p>
            <button
              onClick={() => navigateTo('shop')}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Shop</span>
            </button>
          </>
        )}
      </div>
    );
  }

  // Calculate live effective price and offer status from offerService
  const { effectivePrice, onOffer, timeRemainingMs, discountPercentage } = computeProductEffectivePrice(product);

  const isWishlisted = isInWishlist(product.id);
  const isCompared = isInCompare(product.id);

  const productReviews = reviews.filter((r) => r.productId === product.id);
  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const specsList = Array.isArray(product.specifications)
    ? product.specifications
    : product.specifications && typeof product.specifications === 'object'
      ? Object.entries(product.specifications).map(([key, value]) => ({ key, value: String(value) }))
      : [];

  const handleReviewTabClick = () => {
    setActiveTab('reviews');
    document.getElementById('product-detail-tabs')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Deep-nested SEO metadata pushed to layout head */}
      <SeoHead
        title={`${product.name} Price in Nepal (NPR ${product.sellingPrice.toLocaleString()}) | Intel Computer`}
        description={product.shortDescription || `Buy genuine ${product.name} in Nepal at Intel Computer & Electronics with brand warranty.`}
        canonicalUrl={`https://intelcomputer.com.np/product/${product.slug}`}
        ogImage={product.images[0]}
        ogType="product"
        keywords={[product.name, product.brand, product.category, 'Nepal Electronics', 'Kathmandu Store']}
        jsonLd={{
          '@context': 'https://schema.org/',
          '@type': 'Product',
          name: product.name,
          image: product.images,
          description: product.shortDescription,
          sku: product.sku,
          brand: {
            '@type': 'Brand',
            name: product.brand,
          },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'NPR',
            price: product.sellingPrice,
            availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: {
              '@type': 'Organization',
              name: 'Intel Computer & Electronics',
            },
          },
        }}
      />

      {/* Back Button */}
      <button
        onClick={() => navigateTo('shop')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Shop Catalog</span>
      </button>

      {/* Main Product Layout */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left Gallery with Hover-To-Zoom & Component Inspector */}
        <ProductImageZoom
          images={product.images}
          selectedImageIndex={selectedImageIndex}
          onSelectImage={setSelectedImageIndex}
          productName={product.name}
          discountPercent={product.discountPercent}
        />

        {/* Right Info */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded uppercase">
                {product.brand}
              </span>
              <span className="text-slate-500 font-mono">SKU: {product.sku}</span>
            </div>

            <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mt-2 text-xs">
              <button
                onClick={handleReviewTabClick}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity text-left cursor-pointer"
                title="View Customer Testimonials & Hardware Ratings"
              >
                {/* A filled star next to "0" reads as a bad product rather than
                    an unrated one, so an empty catalogue rating says so plainly. */}
                {productReviews.length > 0 ? (
                  <>
                    <div className="flex items-center text-amber-400">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <span className="font-bold text-slate-900">{product.rating}</span>
                    <span className="text-blue-600 underline font-semibold">
                      ({productReviews.length} Review{productReviews.length === 1 ? '' : 's'} &amp;
                      Testimonials)
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center text-slate-300">
                      <Star className="w-4 h-4" />
                    </div>
                    <span className="text-blue-600 underline font-semibold">
                      No reviews yet — be the first
                    </span>
                  </>
                )}
              </button>
              <span className="text-slate-300">|</span>
              {product.inStock ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> In Stock ({product.stockQuantity} units in Kathmandu)
                </span>
              ) : (
                <span className="text-red-600 font-bold">Out of Stock</span>
              )}
            </div>
          </div>

          {/* Price Box with Auto Discount Calculation */}
          <div className="space-y-3">
            {onOffer && (
              <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 rounded-2xl shadow-md space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-bounce" />
                    Automatic Time-Bound Offer Active (-{discountPercentage}%)
                  </span>
                  <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    Auto-Reverts After Window
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-100">
                  <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span suppressHydrationWarning>Offer Expires In: <strong className="text-white font-mono text-sm">{formatCountdownTime(timeRemainingMs)}</strong></span>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-2xl md:text-3xl font-black text-blue-700">
                  NPR {effectivePrice.toLocaleString()}
                </div>
                {(onOffer || product.mrp > effectivePrice) && (
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    {/* Only strike the selling price when an offer is actually
                        undercutting it — otherwise we'd cross out the real price. */}
                    {effectivePrice < product.sellingPrice && (
                      <span className="line-through">
                        Selling Price: NPR {product.sellingPrice.toLocaleString()}
                      </span>
                    )}
                    {product.mrp > product.sellingPrice && (
                      <span className="line-through text-slate-400">
                        MRP: NPR {product.mrp.toLocaleString()}
                      </span>
                    )}
                    {/* Savings run from the highest struck-through figure, so an
                        MRP-only discount still reads as a saving. */}
                    {Math.max(product.mrp, product.sellingPrice) > effectivePrice && (
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        You Save NPR{' '}
                        {(Math.max(product.mrp, product.sellingPrice) - effectivePrice).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  VAT Invoice Included
                </span>

                {isAdminLoggedIn && (
                  <button
                    onClick={() => setIsApplyOfferModalOpen(true)}
                    className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Apply Timed Offer</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
            {product.shortDescription}
          </p>

          {/* Warranty & Shipping Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
              <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-slate-900">Nepal Official Warranty</div>
                <div className="text-[11px] text-slate-500">{product.warranty}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
              <Truck className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-slate-900">Kathmandu Express Delivery</div>
                <div className="text-[11px] text-slate-500">Same-day dispatch for Valley orders</div>
              </div>
            </div>
          </div>

          {/* Quantity & Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-700">Quantity:</span>
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-slate-700 hover:bg-slate-200 font-bold"
                >
                  -
                </button>
                <span className="px-4 text-xs font-extrabold text-slate-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-2 text-slate-700 hover:bg-slate-200 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => addToCart(product, quantity)}
                disabled={!product.inStock}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-xs py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Add to Shopping Cart</span>
              </button>

              <button
                onClick={() => {
                  addToCart(product, quantity);
                  navigateTo('checkout');
                }}
                disabled={!product.inStock}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-extrabold text-xs py-3.5 px-6 rounded-xl shadow transition-colors"
              >
                Buy Now
              </button>

              <button
                onClick={() => toggleWishlist(product.id)}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isWishlisted ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Wishlist"
              >
                <Heart className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => toggleCompare(product.id)}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isCompared ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Compare Specs"
              >
                <Layers className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Specifications & Warranty Details & Hardware Reviews */}
      <div id="product-detail-tabs" className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex border-b border-slate-200 gap-6 text-sm font-bold mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Product Overview
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'specs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Full Specifications ({specsList.length})
          </button>
          <button
            onClick={() => setActiveTab('warranty')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'warranty' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Warranty &amp; What&apos;s In The Box
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'reviews' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Hardware Reviews &amp; Testimonials</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
              activeTab === 'reviews' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {productReviews.length}
            </span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <p className="text-sm text-slate-800">{product.longDescription || product.fullDescription}</p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Key Highlights:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {specsList.slice(0, 6).map((s, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span><strong>{s.key}:</strong> {s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="divide-y divide-slate-100 text-xs">
            {specsList.map((spec, idx) => (
              <div key={idx} className="py-2.5 grid grid-cols-1 md:grid-cols-3 gap-2">
                <span className="font-bold text-slate-800">{spec.key}</span>
                <span className="md:col-span-2 text-slate-600 font-mono">{spec.value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'warranty' && (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
              <h4 className="font-bold text-emerald-900 text-sm">Official Manufacturer Warranty</h4>
              <p>{product.warranty}</p>
              <p className="text-[11px] text-emerald-700 pt-1">
                Note: Warranty cards are stamped and issued by Intel Computer & Electronics upon dispatch. Serial numbers are registered in our customer database.
              </p>
            </div>

            {product.whatsInTheBox && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">What&apos;s In The Box:</h4>
                <ul className="space-y-1">
                  {product.whatsInTheBox.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-blue-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <HardwareReviewsSection product={product} />
        )}
      </div>

      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">Related Products in {product.category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Admin Apply Timed Offer Modal */}
      {isApplyOfferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Launch Timed Auto-Offer</h3>
                  <p className="text-[10px] text-slate-500">Automatically reverts when window expires</p>
                </div>
              </div>
              <button onClick={() => setIsApplyOfferModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base">
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const now = new Date();
                const endsAt = new Date(now.getTime() + offerDays * 24 * 60 * 60 * 1000);

                // Call offerService server API route
                try {
                  await fetch('/api/offers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      productId: product.id,
                      discountType: offerDiscountType,
                      discountValue: offerDiscountValue,
                      days: offerDays,
                      name: `${offerDays}-Day Flash Discount`,
                    }),
                  });
                } catch (err) {
                  console.log('Offer saved in state');
                }

                // Update client state
                updateProduct({
                  ...product,
                  offer: {
                    enabled: true,
                    discountType: offerDiscountType,
                    discountValue: offerDiscountValue,
                    startsAt: now.toISOString(),
                    endsAt: endsAt.toISOString(),
                    isFlashSale: true,
                    isStackableWithCoupons: false,
                  },
                });

                setIsApplyOfferModalOpen(false);
                alert(`Successfully launched ${offerDays}-day timed offer! The product will automatically revert to normal price on ${endsAt.toLocaleDateString()}.`);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product</label>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-semibold text-slate-800">
                  {product.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={offerDiscountType}
                    onChange={(e) => setOfferDiscountType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (NPR)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={offerDiscountValue}
                    onChange={(e) => setOfferDiscountValue(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Offer Window (Days)</label>
                <select
                  value={offerDays}
                  onChange={(e) => setOfferDays(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold"
                >
                  <option value={1}>1 Day (24 Hours Flash Sale)</option>
                  <option value={3}>3 Days Weekend Deal</option>
                  <option value={7}>7 Days (1 Week Launch Offer)</option>
                  <option value={14}>14 Days (Fortnight Special)</option>
                  <option value={30}>30 Days Festival Sale</option>
                </select>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Zero Maintenance Automatic Reversion</span>
                </div>
                <p>
                  Once <strong className="font-mono">{offerDays} days</strong> pass, queries stop matching the offer window. The product instantly reverts to original selling price (NPR {product.sellingPrice.toLocaleString()}).
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Launch Timed Offer Now</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
