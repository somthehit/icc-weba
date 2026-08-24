'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';

export const Footer: React.FC = () => {
  const { navigateTo, siteSettings } = useStore();

  return (
    <footer id="main-footer" className="bg-[#121316] text-white mt-auto border-t border-white/5 py-10 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-10">
        
        {/* Brand & Logo Section */}
        <div className="flex flex-row lg:flex-col items-center lg:items-start justify-between w-full lg:w-auto gap-4">
          <button 
            onClick={() => navigateTo('home')} 
            className="text-left group cursor-pointer focus:outline-none"
          >
            <div className="font-extrabold text-xl leading-tight tracking-tight text-white group-hover:text-blue-400 transition-colors">
              ICE<br />
              Computers<br />
              &<br />
              Electronics
            </div>
          </button>

          {/* Stylized Logo Badge */}
          <div className="w-9 h-9 rounded-full bg-black/80 border border-white/20 flex items-center justify-center shadow-inner">
            <span className="font-bold text-sm text-white font-mono">N</span>
          </div>
        </div>

        {/* Info & Links Group */}
        <div className="space-y-4 text-sm flex-1 lg:max-w-xl">
          {/* Physical Store */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
              Physical Store
            </span>
            <p className="text-gray-200 text-xs sm:text-sm font-normal">
              {siteSettings.address || 'Main Road, Near Campus Chowk, Dhangadhi, Nepal'}
            </p>
          </div>

          {/* Sales & Support */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
              Sales & Support
            </span>
            <p className="text-gray-200 text-xs sm:text-sm font-normal">
              {siteSettings.phone || '+977-91-521890'} | {siteSettings.email || 'info@icecomputers.com.np'}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
              Quick Links
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-300">
              <button 
                onClick={() => navigateTo('shop')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Shop
              </button>
              <button 
                onClick={() => navigateTo('services')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Services
              </button>
              <button 
                onClick={() => navigateTo('track-order')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Track Order
              </button>
              <button 
                onClick={() => navigateTo('contact')} 
                className="hover:text-white transition-colors cursor-pointer"
              >
                Contact
              </button>
            </div>
          </div>
        </div>

        {/* Payment Gateways */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight text-left">
            WE<br />ACCEPT:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#1b2432] hover:bg-[#232f42] text-gray-200 font-semibold px-3 py-2 rounded-lg text-xs border border-white/5 shadow-sm transition-colors">
              eSewa
            </span>
            <span className="bg-[#1b2432] hover:bg-[#232f42] text-gray-200 font-semibold px-3 py-2 rounded-lg text-xs border border-white/5 shadow-sm transition-colors">
              Khalti
            </span>
            <span className="bg-[#1b2432] hover:bg-[#232f42] text-gray-200 font-semibold px-3 py-2 rounded-lg text-xs border border-white/5 shadow-sm transition-colors text-center leading-tight">
              Bank<br />Transfer
            </span>
            <span className="bg-[#1b2432] hover:bg-[#232f42] text-gray-200 font-semibold px-3 py-2 rounded-lg text-xs border border-white/5 shadow-sm transition-colors">
              COD
            </span>
          </div>
        </div>

        {/* Copyright Notice */}
        <div className="text-[11px] text-gray-400 leading-relaxed max-w-[220px] self-start lg:self-center lg:text-left">
          {siteSettings.footerNotice || '© 2026 ICE Computers & Electronics. All Rights Reserved. Official Nepal Warranty Authorized Retailer.'}
        </div>

      </div>
    </footer>
  );
};

