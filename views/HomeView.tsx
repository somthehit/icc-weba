'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { HeroBanner } from '@/components/HeroBanner';
import { ProductCard } from '@/components/ProductCard';
import { STORE_INFO, TECHNICAL_SERVICES } from '@/lib/data/initial-data';
import { 
  ShieldCheck, 
  Truck, 
  Headphones, 
  Award, 
  MapPin, 
  Phone, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Wrench, 
  Star, 
  ChevronRight, 
  CheckCircle2,
  Check,
  Building2,
  Cpu,
  Laptop,
  Printer,
  Wifi,
  Tv
} from 'lucide-react';

export const HomeView: React.FC = () => {
  const { products, categories, brands, navigateTo, setIsServiceModalOpen } = useStore();
  const [homeProductFilter, setHomeProductFilter] = React.useState<'featured' | 'newest' | 'older'>('featured');
  const [homeVisibleCount, setHomeVisibleCount] = React.useState(8);

  const displayProducts = React.useMemo(() => {
    let list = [...products];
    if (homeProductFilter === 'featured') {
      list = list.filter((p) => p.isFeatured);
    } else if (homeProductFilter === 'newest') {
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    } else if (homeProductFilter === 'older') {
      list.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
    }
    return list;
  }, [products, homeProductFilter]);

  const visibleProducts = displayProducts.slice(0, homeVisibleCount);
  const hasMoreHome = homeVisibleCount < displayProducts.length;

  // `brands` holds every brand the catalogue references so the shop filter can
  // offer them all; only the curated partners have a logo worth merchandising.
  const partnerBrands = React.useMemo(
    () => brands.filter((b) => b.isPartner && b.logo),
    [brands],
  );

  return (
    <div className="space-y-10 pb-12">
      {/* 1. Hero Banner */}
      <HeroBanner />

      {/* 2. Value Props Grid (Clean Minimalism) */}
      <div className="bg-white py-6 px-4 md:px-12 grid grid-cols-2 md:grid-cols-4 border-y border-gray-100 max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-3 border-r border-gray-100 justify-center pr-4">
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[#0056b3]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold uppercase tracking-tight text-[#1a1a1a]">Genuine Products</p>
            <p className="text-gray-500">100% Guaranteed</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 justify-center pr-4">
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[#0056b3]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold uppercase tracking-tight text-[#1a1a1a]">Official Warranty</p>
            <p className="text-gray-500">Peace of Mind</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 justify-center pr-4">
          <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold uppercase tracking-tight text-[#1a1a1a]">Fast Delivery</p>
            <p className="text-gray-500">Across Nepal</p>
          </div>
        </div>

        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold uppercase tracking-tight text-[#1a1a1a]">Expert Support</p>
            <p className="text-gray-500">Technical Guidance</p>
          </div>
        </div>
      </div>

      {/* 3. Product Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#1a1a1a]">Product Categories</h2>
          <button
            onClick={() => navigateTo('shop')}
            className="text-[#0056b3] text-sm font-bold border-b border-[#0056b3] hover:opacity-80 transition-opacity"
          >
            View All Categories
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigateTo('shop')}
              className="group bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all flex flex-col justify-between"
            >
              <div className="bg-white rounded-lg p-4 h-32 flex items-center justify-center mb-3">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="max-h-24 object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1a1a1a] group-hover:text-[#0056b3] transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{cat.subcategories.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Products Showcase with Date-wise & Featured Filters */}
      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1a1a1a]">Explore Tech Catalog</h2>
            <p className="text-xs text-gray-500 mt-0.5">Official products with warranty in Dhangadhi, Nepal</p>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => {
                  setHomeProductFilter('featured');
                  setHomeVisibleCount(8);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  homeProductFilter === 'featured' ? 'bg-white text-[#0056b3] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Featured
              </button>
              <button
                onClick={() => {
                  setHomeProductFilter('newest');
                  setHomeVisibleCount(8);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  homeProductFilter === 'newest' ? 'bg-white text-[#0056b3] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Latest (2026/25)
              </button>
              <button
                onClick={() => {
                  setHomeProductFilter('older');
                  setHomeVisibleCount(8);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  homeProductFilter === 'older' ? 'bg-white text-[#0056b3] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Older Models
              </button>
            </div>

            <button
              onClick={() => navigateTo('shop')}
              className="text-[#0056b3] text-xs font-bold hover:underline hidden md:inline ml-2"
            >
              Full Shop →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Load More Button */}
        {hasMoreHome && (
          <div className="text-center pt-8">
            <button
              onClick={() => setHomeVisibleCount((prev) => prev + 4)}
              className="bg-white border-2 border-gray-200 hover:border-[#0056b3] hover:text-[#0056b3] text-gray-800 text-xs font-bold px-8 py-3 rounded-xl transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Load More Products ({displayProducts.length - visibleProducts.length} remaining)</span>
            </button>
          </div>
        )}
      </section>

      {/* 5. Service & Repairs Feature Box */}
      <section className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[#0056b3] font-bold text-xs uppercase tracking-widest">Local Tech Service</span>
            <h3 className="text-2xl font-bold text-[#1a1a1a]">Computer Repair & Maintenance in Dhangadhi</h3>
            <p className="text-sm text-gray-600 max-w-2xl">
              Chip-level laptop repair, CCTV network setup, printer servicing, and custom desktop assembly with local Dhangadhi warranty support.
            </p>
          </div>
          <button
            onClick={() => setIsServiceModalOpen(true)}
            className="bg-[#1a1a1a] text-white text-xs font-bold px-6 py-3.5 rounded-lg hover:bg-black transition-colors flex-shrink-0"
          >
            Book Repair Service
          </button>
        </div>
      </section>

      {/* 6. Authorized Partner Brands */}
      {partnerBrands.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 md:px-8 overflow-hidden">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-[#1a1a1a]">Authorized Partner Brands</h2>
          <p className="text-xs text-gray-500">Genuine items direct from official Nepal distributors</p>
        </div>

        <div className="relative overflow-hidden w-full py-3 bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-2xl border border-gray-100 shadow-sm">
          {/* Edge gradient overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />

          {/* Right to Left Continuous Sliding Marquee */}
          <div className="animate-marquee flex items-center gap-6">
            {[...partnerBrands, ...partnerBrands, ...partnerBrands].map((brand, idx) => (
              <div
                key={`${brand.id}-${idx}`}
                onClick={() => navigateTo('brands')}
                className="flex-shrink-0 bg-white border border-gray-100 shadow-xs rounded-xl px-6 py-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#0056b3] hover:shadow-md transition-all group min-w-[150px] h-20"
              >
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="h-8 w-auto max-w-[110px] object-contain group-hover:scale-105 transition-transform"
                />
                <span className="text-[11px] font-bold text-gray-700 font-mono group-hover:text-[#0056b3] transition-colors">
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

    </div>
  );
};
