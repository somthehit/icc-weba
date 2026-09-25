'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { STORE_INFO, INITIAL_SITE_SETTINGS } from '@/lib/data/initial-data';
import { MapPin, Navigation, Phone, Clock, ExternalLink, ShieldCheck } from 'lucide-react';

interface GoogleMapEmbedProps {
  className?: string;
  showDetailsCard?: boolean;
}

export const GoogleMapEmbed: React.FC<GoogleMapEmbedProps> = ({
  className = '',
  showDetailsCard = true,
}) => {
  const { siteSettings } = useStore();

  const embedUrl = siteSettings?.googleMapEmbedUrl || STORE_INFO.address.embedMapUrl;
  const mapsLocationUrl = siteSettings?.googleMapLocationUrl || STORE_INFO.address.googleMapsUrl || 'https://maps.app.goo.gl/vRUaFjDbk9s8YiAy6';
  const storeAddress = (siteSettings?.address && !siteSettings.address.includes('Campus Chowk')) 
    ? siteSettings.address 
    : INITIAL_SITE_SETTINGS.address;
  const storePhone = siteSettings?.phone || STORE_INFO.phonePrimary;
  const storeHours = siteSettings?.openingHours || STORE_INFO.openingHours;
  const storeName = siteSettings?.storeName || STORE_INFO.name;

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm ${className}`}>
      {showDetailsCard && (
        <div className="px-4 py-3 bg-[#0056b3] text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="bg-red-500 text-white font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <MapPin className="w-2.5 h-2.5" />
                Dhangadhi Outlet
              </span>
              <span className="text-blue-100 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-200" />
                Verified Google Business Profile
              </span>
            </div>
            <h3 className="text-sm font-black">{storeName} — Dhangadhi Branch</h3>
            <p className="text-blue-100 text-[11px]">
              {storeAddress}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={mapsLocationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0056b3] hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Navigation className="w-3 h-3" />
              <span>Get Directions</span>
            </a>
            <a
              href={`tel:${storePhone}`}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 transition-colors border border-white/20"
            >
              <Phone className="w-3 h-3" />
              <span>Call Store</span>
            </a>
          </div>
        </div>
      )}

      {/* Google Map Iframe Container */}
      <div className="relative w-full h-[260px] bg-slate-100">
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title="Intel Computer Center Dhangadhi Google Map"
          className="w-full h-full"
        />
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span><strong>Hours:</strong> {storeHours}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={mapsLocationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-bold flex items-center gap-1"
          >
            <span>Open in Google Maps App</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

