'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { SeoHead } from '@/context/SeoContext';
import { TECHNICAL_SERVICES, STORE_INFO } from '@/lib/data/initial-data';
import { 
  Wrench, 
  ShieldCheck, 
  Clock, 
  Check, 
  Phone, 
  MapPin, 
  ArrowRight, 
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';

export const ServicesView: React.FC = () => {
  const { setIsServiceModalOpen, serviceRequests, navigateTo } = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      <SeoHead
        title="Computer Repair & Technical Services in Dhangadhi | Intel Computer"
        description="Fast laptop repair, PC assembly, CCTV installation, printer servicing, and network setup in Dhangadhi, Kailali with certified engineers."
        canonicalUrl="https://intelcomputer.com.np/services"
        keywords={['Laptop Repair Dhangadhi', 'PC Assembly Nepal', 'Printer Servicing Kailali', 'CCTV Installation Dhangadhi']}
      />

      {/* Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-600/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <Wrench className="w-3.5 h-3.5 text-amber-300" />
            <span>Certified Tech Engineers in Dhangadhi</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight">
            Computer, CCTV & Printer Technical Service Center
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Intel Computer & Electronics provides chip-level hardware repair, motherboard diagnostics, CCTV security camera installation, printer head maintenance, and structured networking across Dhangadhi and Far-West Nepal.
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3.5 px-7 rounded-xl shadow-lg transition-colors flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>Book Repair / On-site Technician</span>
            </button>

            <a
              href={`tel:${STORE_INFO.phonePrimary}`}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3.5 px-6 rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
            >
              <Phone className="w-4 h-4 text-blue-400" />
              <span>Hotline: {STORE_INFO.phonePrimary}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-black text-slate-900">Our Core Technical Services</h2>
          <p className="text-xs text-slate-500">Transparent diagnosis, genuine replacement parts, and local warranty</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TECHNICAL_SERVICES.map((srv) => (
            <div key={srv.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Wrench className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">{srv.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{srv.description}</p>

                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  {srv.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Request Service</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Service Requests Tracker for Logged In Customer */}
      {serviceRequests.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-4 text-xs">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>Active Service Request Tickets ({serviceRequests.length})</span>
          </h2>

          <div className="divide-y divide-slate-100">
            {serviceRequests.map((req) => (
              <div key={req.id} className="py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{req.id} — {req.serviceType.replace('-', ' ')}</div>
                  <div className="text-slate-500 text-[11px]">{req.deviceInfo} | {req.customerName} ({req.phone})</div>
                  <div className="text-slate-600 text-[11px] italic mt-0.5">&quot;{req.problemDescription}&quot;</div>
                </div>

                <div className="sm:text-right">
                  <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded uppercase text-[10px] inline-block">
                    {req.status.replace('_', ' ')}
                  </span>
                  {req.assignedTechnician && (
                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                      Assigned: {req.assignedTechnician}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
