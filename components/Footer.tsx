'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import {
  ShieldCheck,
  Truck,
  Wrench,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Clock,
  Sparkles,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Cpu,
  FileCheck2,
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigateTo, siteSettings, setIsServiceModalOpen, setIsAiAssistantOpen } = useStore();

  const [storeStatus, setStoreStatus] = useState<{ isOpen: boolean; text: string }>({
    isOpen: true,
    text: 'Showroom Open • Ratopool, Dhangadhi',
  });

  // Calculate live store status based on Nepal Time (UTC + 5:45)
  useEffect(() => {
    const updateStatus = () => {
      try {
        const now = new Date();
        const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
        const nptTime = new Date(utcTime + 345 * 60000); // +5:45 in minutes
        const day = nptTime.getDay(); // 0 = Sun, 6 = Sat
        const hour = nptTime.getHours();
        const min = nptTime.getMinutes();
        const currentMins = hour * 60 + min;

        // Sun(0) to Fri(5): 9:30 AM (570m) to 7:00 PM (1140m)
        if (day === 6) {
          setStoreStatus({
            isOpen: false,
            text: 'Saturday: Closed • Support by Appointment',
          });
        } else if (currentMins >= 570 && currentMins <= 1140) {
          setStoreStatus({
            isOpen: true,
            text: 'Showroom Open Now • 9:30 AM - 7:00 PM',
          });
        } else {
          setStoreStatus({
            isOpen: false,
            text: 'Showroom Closed • Opens 9:30 AM (Sun - Fri)',
          });
        }
      } catch {
        // Fallback gracefully
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const whatsappLink = siteSettings.whatsappNumber
    ? `https://wa.me/${siteSettings.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        'Namaste! I would like to inquire about products and services at ICE Computers Dhangadhi.'
      )}`
    : 'https://wa.me/9779848424859';

  const mapLink =
    siteSettings.googleMapLocationUrl ||
    'https://maps.app.goo.gl/vRUaFjDbk9s8YiAy6';

  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="main-footer"
      className="relative bg-slate-50 border-t border-slate-200 text-slate-600 font-sans antialiased"
    >
      {/* 1. Subtle top glowing line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

      {/* 2. Top Trust Pillars (Streamlined, Minimal Light Cards) */}
      <div className="border-b border-slate-200/70 bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Trust Item 1 */}
            <div className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400 hover:shadow-xs transition-all duration-200">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  100% Genuine Tech
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  Official Nepal Warranty
                </p>
              </div>
            </div>

            {/* Trust Item 2 */}
            <div className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400 hover:shadow-xs transition-all duration-200">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 group-hover:scale-105 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  Express Delivery
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  Same-Day Kailali Hubs
                </p>
              </div>
            </div>

            {/* Trust Item 3 */}
            <div className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400 hover:shadow-xs transition-all duration-200">
              <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0 text-sky-600 group-hover:scale-105 transition-transform">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  Service & Repair Lab
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  Chip-Level Diagnostics
                </p>
              </div>
            </div>

            {/* Trust Item 4 */}
            <div className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400 hover:shadow-xs transition-all duration-200">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 group-hover:scale-105 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  Verified Payments
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  eSewa, Khalti, Fonepay & COD
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Main Directory Grid (Clean Light Aesthetic) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Brand & Showroom Information (5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Brand Logo & Name */}
            <button
              onClick={() => navigateTo('home')}
              className="group flex items-center gap-3 text-left focus:outline-none cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-700 transition-colors">
                <Cpu className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors block">
                  ICE COMPUTERS
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase block">
                  & Electronics • Dhangadhi
                </span>
              </div>
            </button>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm">
              Sudurpashchim’s premier IT hardware store. Authorized laptops, custom PC builds, CCTV surveillance, and certified chip-level repair services.
            </p>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    storeStatus.isOpen ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    storeStatus.isOpen ? 'bg-emerald-600' : 'bg-amber-600'
                  }`}
                />
              </span>
              <span className="font-medium text-slate-700">
                {storeStatus.text}
              </span>
            </div>

            {/* Fast Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-all group"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`tel:${(siteSettings.phone || '091-525287').replace(/[^0-9]/g, '')}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>{siteSettings.phone || '091-525287'}</span>
              </a>

              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Google Maps</span>
              </a>
            </div>

            {/* Tax Compliance */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Regd. PAN: 302910482 • Official Nepal Tax Invoiced</span>
            </div>
          </div>

          {/* Column 2: Products & Hardware (2 Columns) */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Explore Catalog
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Laptops & Notebooks</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Custom Desktop PCs</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Components & GPUs</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>CCTV & Surveillance</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('shop')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Printers & Consumables</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('brands')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Authorized Brands</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care & Services (2 Columns) */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Care & Services
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => setIsServiceModalOpen(true)}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Book Repair Service</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setIsAiAssistantOpen(true)}
                  className="group flex items-center gap-1.5 text-blue-700 hover:text-blue-800 transition-colors cursor-pointer font-medium"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>AI Tech Consultant</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('track-order')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Track My Order</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('about')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>About Our Company</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('faq')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>FAQ & Warranty Rules</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('contact')}
                  className="group flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  <span>Contact & Store</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Physical Location & Timing (3 Columns) */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Physical Showroom
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  {siteSettings.address || 'Ratopool, Dhangadhi Sub-Metropolitan City, Nepal'}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  {siteSettings.openingHours || 'Sun - Fri: 9:30 AM - 7:00 PM | Sat: By Appt'}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="truncate">
                  {siteSettings.email || 'iccdhangadhi@gmail.com'}
                </span>
              </div>
            </div>

            {/* Sudurpashchim 9 Districts Tag Cloud */}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Province 7 Express Coverage:
              </span>
              <div className="flex flex-wrap gap-1">
                {['Kailali', 'Kanchanpur', 'Dadeldhura', 'Doti', 'Baitadi', 'Achham', 'Bajhang', 'Bajura', 'Darchula'].map(
                  (district) => (
                    <span
                      key={district}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] text-slate-600"
                    >
                      {district}
                    </span>
                  )
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* 4. Verified Nepal Payment Gateways Row (Minimal Light Badges) */}
      <div className="border-t border-slate-200 bg-white/80 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 text-xs">
              Accepted Nepal Payments:
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* eSewa */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>eSewa</span>
            </div>

            {/* Khalti */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              <span>Khalti</span>
            </div>

            {/* Fonepay */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>Fonepay</span>
            </div>

            {/* Bank Transfer */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Bank Transfer</span>
            </div>

            {/* Cash on Delivery */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>Cash on Delivery</span>
            </div>
          </div>

          {/* Minimal Back to Top Trigger */}
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

        </div>
      </div>

      {/* 5. Sub-Footer Bottom Copyright & Legal Links */}
      <div className="border-t border-slate-200 bg-slate-100/70 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          
          <div className="text-center sm:text-left">
            <span>
              {siteSettings.footerNotice ||
                `© ${currentYear} Intel Computer Center (ICE Computers & Electronics). All rights reserved.`}
            </span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {siteSettings.facebookUrl && (
              <a
                href={siteSettings.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-blue-600 transition-colors"
                aria-label="Facebook"
              >
                Facebook
              </a>
            )}
            {siteSettings.instagramUrl && (
              <a
                href={siteSettings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-pink-600 transition-colors"
                aria-label="Instagram"
              >
                Instagram
              </a>
            )}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-emerald-600 transition-colors"
              aria-label="WhatsApp"
            >
              WhatsApp
            </a>
            <button
              onClick={() => navigateTo('faq')}
              className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Warranty Policy
            </button>
          </div>

        </div>
      </div>
    </footer>
  );
};
