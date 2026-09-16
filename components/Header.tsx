'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { useSeoOptional } from '@/context/SeoContext';
import { RealtimeSearch } from '@/components/RealtimeSearch';
import { 
  Search, 
  ShoppingCart, 
  Heart, 
  User, 
  Phone, 
  MapPin, 
  Clock, 
  Sparkles, 
  Layers, 
  Wrench, 
  Menu, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  Package, 
  CheckCircle,
  Truck
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    cart, 
    wishlist, 
    categories, 
    currentPage, 
    navigateTo, 
    setIsCartDrawerOpen, 
    setIsAiAssistantOpen,
    setIsServiceModalOpen,
    isAdminLoggedIn,
    isUserLoggedIn,
    currentUser,
    siteSettings
  } = useStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  /**
   * The delivery promise, from the SEO engine's regional record.
   *
   * Read from `SeoContext` rather than kept here so the banner, the JSON-LD
   * `areaServed` and the FAQ answers cannot disagree — the announcement used to
   * say "Free Local Delivery" while the schema claimed all 77 districts.
   */
  const seo = useSeoOptional();
  const announcement =
    seo?.deliveryBanner ?? siteSettings.announcementText ?? 'FREE LOCAL DELIVERY';
  const announcementVisible = siteSettings.announcementEnabled && Boolean(announcement);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      {/* 1. Top Announcement Bar */}
      {announcementVisible && <div className="bg-[#1B3A8C] text-[#DCE6FF] py-2 px-4 md:px-10 text-xs font-mono tracking-wide flex justify-between items-center">
        <div>
          <strong className="text-white font-semibold">{announcement}</strong>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <button onClick={() => navigateTo('contact')} className="opacity-90 hover:opacity-100 hover:text-white transition-opacity">Store Locator</button>
          <span className="opacity-35">|</span>
          <button onClick={() => navigateTo('track-order')} className="opacity-90 hover:opacity-100 hover:text-white transition-opacity">Track Order</button>
          <span className="opacity-35">|</span>
          <button onClick={() => navigateTo('contact')} className="opacity-90 hover:opacity-100 hover:text-white transition-opacity">Support</button>
          <button 
            onClick={() => isAdminLoggedIn ? navigateTo('admin') : navigateTo('admin-login')}
            className="bg-white/12 hover:bg-white/20 text-white px-2.5 py-0.5 rounded-md font-mono transition-colors"
          >
            {isAdminLoggedIn ? 'Admin Panel' : 'Admin'}
          </button>
        </div>
      </div>}

      {/* 2. Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[#1a1a1a] hover:text-[#0056b3] rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div 
            onClick={() => navigateTo('home')} 
            className="cursor-pointer flex items-center gap-3 select-none py-0.5"
            title={siteSettings.storeName}
          >
            <BrandLogo key={siteSettings.logoUrl} logoUrl={siteSettings.logoUrl} storeName={siteSettings.storeName} />
            <span className="font-extrabold text-xl sm:text-2xl text-[#0056b3] tracking-tight hover:text-[#004494] transition-colors">
              {siteSettings.storeName}
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-[13px] font-semibold text-gray-600">
          <button 
            onClick={() => navigateTo('home')} 
            className={`transition-colors ${currentPage === 'home' ? 'text-[#0056b3]' : 'hover:text-[#0056b3]'}`}
          >
            Home
          </button>
          <button 
            onClick={() => navigateTo('shop')} 
            className={`transition-colors ${currentPage === 'shop' ? 'text-[#0056b3]' : 'hover:text-[#0056b3]'}`}
          >
            Shop
          </button>
          <button 
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} 
            className="hover:text-[#0056b3] transition-colors flex items-center gap-1 relative"
          >
            <span>Categories</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isCategoryDropdownOpen ? 'rotate-90' : ''}`} />
          </button>
          <button 
            onClick={() => navigateTo('services')} 
            className={`transition-colors ${currentPage === 'services' ? 'text-[#0056b3]' : 'hover:text-[#0056b3]'}`}
          >
            Services
          </button>
          <button 
            onClick={() => navigateTo('brands')} 
            className={`transition-colors ${currentPage === 'brands' ? 'text-[#0056b3]' : 'hover:text-[#0056b3]'}`}
          >
            Brands
          </button>
          <button 
            onClick={() => navigateTo('about')} 
            className={`transition-colors ${currentPage === 'about' ? 'text-[#0056b3]' : 'hover:text-[#0056b3]'}`}
          >
            About
          </button>
        </nav>

        {/* Live Realtime Multi-Category Search */}
        <div className="hidden md:block flex-1 max-w-lg mx-4">
          <RealtimeSearch placeholder="Search products, services, categories..." />
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-4 text-[#1a1a1a]">
          {/* AI Advisor Launcher */}
          <button
            onClick={() => setIsAiAssistantOpen(true)}
            className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-[#4C7CFF] to-[#7C5CFF] text-white text-[13px] font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
            title="AI Consultant"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Advisor</span>
          </button>

          {/* Book Service Quick CTA */}
          <button
            onClick={() => setIsServiceModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 border border-gray-300 text-gray-800 text-[13px] font-semibold px-4 py-2 rounded-full hover:border-[#4C7CFF] hover:text-[#4C7CFF] transition-all cursor-pointer transform hover:-translate-y-0.5"
            title="Book Repair"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Service</span>
          </button>

          {/* Wishlist */}
          <button
            onClick={() => navigateTo('wishlist')}
            className={`relative p-2 rounded-lg hover:bg-gray-100 transition-colors ${
              currentPage === 'wishlist' ? 'text-red-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Wishlist"
          >
            <Heart className={`w-5 h-5 ${wishlist.length > 0 ? 'fill-red-50 text-red-500' : ''}`} />
            {wishlist.length > 0 && (
              <span className="absolute 1 top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold font-mono shadow-sm">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart Drawer */}
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#FF5470] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold font-mono shadow-sm">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* Account */}
          <button
            onClick={() => navigateTo(isUserLoggedIn ? 'account' : 'customer-login')}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
            title={isUserLoggedIn ? 'Open profile' : 'Sign in'}
          >
            {isUserLoggedIn && currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser.name} className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0056b3] text-xs font-black text-white">{isUserLoggedIn && currentUser ? currentUser.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}</span>}
            {isUserLoggedIn && currentUser && <span className="hidden max-w-[100px] truncate text-xs font-bold sm:inline">{currentUser.name}</span>}
          </button>
        </div>
      </div>

      {/* Dropdown Categories Overlay */}
      {isCategoryDropdownOpen && (
        <div 
          className="absolute left-0 right-0 bg-white border-b border-gray-200 shadow-xl z-40 py-4 px-8"
          onMouseLeave={() => setIsCategoryDropdownOpen(false)}
        >
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setIsCategoryDropdownOpen(false);
                  navigateTo('shop');
                }}
                className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="font-bold text-sm text-[#1a1a1a] mb-1">{cat.name}</div>
                <div className="text-xs text-gray-500 line-clamp-1">{cat.subcategories.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-4">
          <RealtimeSearch isMobile onCloseMobile={() => setIsMobileMenuOpen(false)} />

          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-700">
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('home'); }} className="p-2.5 bg-gray-50 rounded-lg text-left">Home</button>
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('shop'); }} className="p-2.5 bg-gray-50 rounded-lg text-left text-[#0056b3]">Shop Catalog</button>
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('services'); }} className="p-2.5 bg-gray-50 rounded-lg text-left">Services</button>
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('brands'); }} className="p-2.5 bg-gray-50 rounded-lg text-left">Brands</button>
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('track-order'); }} className="p-2.5 bg-gray-50 rounded-lg text-left text-[#0056b3]">Track Order</button>
            <button onClick={() => { setIsMobileMenuOpen(false); navigateTo('about'); }} className="p-2.5 bg-gray-50 rounded-lg text-left">About</button>
          </div>
        </div>
      )}
    </header>
  );
};

function BrandLogo({ logoUrl, storeName }: { logoUrl: string; storeName: string }) {
  const [failed, setFailed] = useState(false);
  const usableUrl = logoUrl.startsWith('/') || /^https?:\/\//i.test(logoUrl);

  if (!usableUrl || failed) {
    const initials = storeName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();

    return (
      <span className="hidden h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-[#0056b3] text-base font-black tracking-wider text-white sm:flex">
        {initials}
      </span>
    );
  }

  return (
    // The logo URL is managed by the store administrator and may be local or hosted.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={`${storeName} logo`}
      onError={() => setFailed(true)}
      className="hidden h-14 w-20 shrink-0 object-contain sm:block lg:h-16 lg:w-28"
    />
  );
}
