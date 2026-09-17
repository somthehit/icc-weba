'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { HeroBanner } from '@/components/HeroBanner';
import { ProductCard } from '@/components/ProductCard';
import { STORE_INFO, TECHNICAL_SERVICES } from '@/lib/data/initial-data';
import { DEFAULT_HOMEPAGE_BLOCKS, type HomepageBlockKey, type HomepageBlock } from '@/lib/content/homepage-layout';
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
  BadgeCheck,
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
  const [homepageBlocks, setHomepageBlocks] = React.useState<HomepageBlock[]>(DEFAULT_HOMEPAGE_BLOCKS);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/public/homepage-layout', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.sections) setHomepageBlocks(data.sections); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const blockStyle = (key: HomepageBlockKey): React.CSSProperties => {
    const block = homepageBlocks.find((item) => item.sectionType === key);
    return { order: block?.displayOrder ?? 99, display: block?.isEnabled === false ? 'none' : undefined };
  };

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
    <div className="flex flex-col gap-10 pb-12">
      {/* 1. Hero Banner */}
      <div style={blockStyle('hero_slider')}><HeroBanner /></div>

      {/* 2. Value Props Grid (Clean Minimalism) */}
      <div style={{ order: 90 }} className="bg-white py-6 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 grid grid-cols-2 md:grid-cols-4 border-y border-gray-100 max-w-[1536px] mx-auto gap-4">
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
      <section style={blockStyle('featured_categories')} className="max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
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

      {products.some((product) => product.offer?.enabled || product.offerToggle) && <section style={blockStyle('flash_sales')} className="max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12"><div className="mb-6"><h2 className="text-2xl font-bold text-[#1a1a1a]">Flash Sale / Hot Deals</h2><p className="text-xs text-gray-500">Limited-time offers while stocks last</p></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{products.filter((product) => product.offer?.enabled || product.offerToggle).slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}

      {/* 4. Products Showcase with Date-wise & Featured Filters */}
      <section style={blockStyle('trending_laptops')} className="max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
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
      <section style={blockStyle('custom_promo')} className="max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
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
      <section style={blockStyle('brand_showcase')} className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <div className="rounded-3xl border border-slate-100 bg-slate-50/60 px-4 py-8 sm:px-6 md:py-10">
          <div className="mb-7 text-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700"><BadgeCheck className="h-3.5 w-3.5" />100% Genuine Guarantee</span><h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">Authorized Partner Brands</h2><p className="mx-auto mt-1 max-w-xl text-xs text-slate-500 sm:text-sm">Direct imports and official warranty backed by verified Nepal distributors.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">{partnerBrands.map((brand) => <BrandTile key={brand.id} name={brand.name} fallbackLogo={brand.logo} onClick={() => navigateTo('brands')} />)}</div>
        </div>
      </section>
      )}

      <section style={blockStyle('latest_blogs')} className="max-w-[1536px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12"><div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><h2 className="text-xl font-bold text-slate-800">Tech News & Buying Guides</h2><p className="mt-2 text-sm text-slate-500">Published buying guides will appear here.</p></div></section>

    </div>
  );
};

const OFFICIAL_LOGOS: Record<string, string> = {
  dell: 'https://cdn.simpleicons.org/dell/0076CE', epson: 'https://cdn.simpleicons.org/epson/003399', hikvision: 'https://cdn.simpleicons.org/hikvision/E60012', hp: 'https://cdn.simpleicons.org/hp/0096D6', lenovo: 'https://cdn.simpleicons.org/lenovo/E2231A', samsung: 'https://cdn.simpleicons.org/samsung/1428A0', 'tp-link': 'https://cdn.simpleicons.org/tplink/00A9E0', asus: 'https://cdn.simpleicons.org/asus/000000', acer: 'https://cdn.simpleicons.org/acer/83B81A', logitech: 'https://cdn.simpleicons.org/logitech/00B8FC', apple: 'https://cdn.simpleicons.org/apple/000000',
};

function BrandTile({ name, fallbackLogo, onClick }: { name: string; fallbackLogo: string; onClick: () => void }) {
  const [officialFailed, setOfficialFailed] = React.useState(false); const [fallbackFailed, setFallbackFailed] = React.useState(false); const key = name.toLowerCase().replace(/\s+/g, '-'); const official = OFFICIAL_LOGOS[key]; const logo = !officialFailed && official ? official : !fallbackFailed ? fallbackLogo : '';
  return <button type="button" onClick={onClick} className="group flex min-h-28 flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="flex h-10 w-full items-center justify-center">{logo ? <img src={logo} alt={`${name} official logo`} onError={() => official && !officialFailed ? setOfficialFailed(true) : setFallbackFailed(true)} className="max-h-8 max-w-[85%] object-contain grayscale opacity-65 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100" /> : <span className="text-lg font-black text-slate-500">{name}</span>}</div><span className="mt-3 text-[11px] font-semibold text-slate-500 transition-colors group-hover:text-slate-900">{name}</span></button>;
}
