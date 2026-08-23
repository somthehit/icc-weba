'use client';

import React from 'react';
import { STORE_INFO } from '@/lib/data/initial-data';
import { MapPin, Navigation, Phone, Clock, ExternalLink, ShieldCheck } from 'lucide-react';

interface GoogleMapEmbedProps {
  className?: string;
  showDetailsCard?: boolean;
}

export const GoogleMapEmbed: React.FC<GoogleMapEmbedProps> = ({
  className = '',
  showDetailsCard = true,
}) => {
  const mapUrl = STORE_INFO.address.embedMapUrl;

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm ${className}`}>
      {showDetailsCard && (
        <div className="p-6 bg-[#0056b3] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-red-500 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Dhangadhi Outlet
              </span>
              <span className="text-blue-100 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                Verified Google Business Profile
              </span>
            </div>
            <h3 className="text-xl font-black">{STORE_INFO.name} — Dhangadhi Branch</h3>
            <p className="text-blue-100 text-xs">
              {STORE_INFO.address.street}, {STORE_INFO.address.area}, {STORE_INFO.address.city}, {STORE_INFO.address.district}, {STORE_INFO.address.province}, Nepal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://maps.google.com/?q=Dhangadhi+Nepal"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0056b3] hover:bg-blue-50 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </a>
            <a
              href={`tel:${STORE_INFO.phonePrimary}`}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-white/20"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Store</span>
            </a>
          </div>
        </div>
      )}

      {/* Google Map Iframe Container */}
      <div className="relative w-full h-[420px] bg-slate-100">
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title="Intel Computer & Electronics Dhangadhi Google Map"
          className="w-full h-full"
        />
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span><strong>Hours:</strong> {STORE_INFO.openingHours}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://maps.google.com/?q=Dhangadhi+Nepal"
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
