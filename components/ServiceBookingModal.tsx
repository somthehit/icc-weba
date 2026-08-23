'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { 
  X, 
  Wrench, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  FileText 
} from 'lucide-react';

export const ServiceBookingModal: React.FC = () => {
  const { isServiceModalOpen, setIsServiceModalOpen, createServiceRequest, navigateTo } = useStore();

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    email: '',
    serviceType: 'laptop-repair' as any,
    deviceInfo: '',
    problemDescription: '',
    preferredDate: '',
    preferredTime: 'Morning (10 AM - 1 PM)',
    address: 'Kathmandu Valley',
  });

  const [submittedRequest, setSubmittedRequest] = useState<any | null>(null);

  if (!isServiceModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const req = createServiceRequest(formData);
    setSubmittedRequest(req);
  };

  const handleClose = () => {
    setSubmittedRequest(null);
    setIsServiceModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden relative border border-slate-200 my-8">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-400" />
            <h3 className="font-extrabold text-sm">Intel Technical & Service Request</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedRequest ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Service Request Ticket Created!</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left space-y-2 max-w-md mx-auto">
              <div className="flex justify-between font-bold text-blue-700">
                <span>Ticket Number:</span>
                <span>{submittedRequest.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{submittedRequest.customerName} ({submittedRequest.phone})</span>
              </div>
              <div className="flex justify-between">
                <span>Service Type:</span>
                <span className="capitalize">{submittedRequest.serviceType.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded uppercase text-[10px]">
                  Pending Allocation
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Our service supervisor will call your mobile number (<span className="font-bold">{submittedRequest.phone}</span>) within 2 working hours to confirm technician schedule.
            </p>

            <div className="pt-2 flex gap-3 justify-center">
              <button
                onClick={() => {
                  handleClose();
                  navigateTo('services');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow"
              >
                View Services & Pricing
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <p className="text-slate-600 bg-blue-50 p-3 rounded-xl border border-blue-100 leading-relaxed">
              Book expert computer/laptop repair, printer servicing, or CCTV installation with certified engineers in Kathmandu.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Bijay Gurung"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 98510XXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Type *</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="laptop-repair">Laptop Hardware / Screen Repair</option>
                  <option value="computer-repair">Desktop PC & Gaming Rig Service</option>
                  <option value="cctv-installation">CCTV Camera Installation / AMC</option>
                  <option value="printer-service">Printer / Copier Maintenance</option>
                  <option value="networking">Wi-Fi & LAN Network Setup</option>
                  <option value="hardware-upgrade">SSD / RAM / Component Upgrade</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Device Model & Brand</label>
                <input
                  type="text"
                  value={formData.deviceInfo}
                  onChange={(e) => setFormData({ ...formData, deviceInfo: e.target.value })}
                  placeholder="e.g. Dell Inspiron 15 or Epson L3210"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Problem Description / Notes *</label>
              <textarea
                required
                rows={3}
                value={formData.problemDescription}
                onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                placeholder="Describe issue (e.g. No power, screen flickering, paper jam, or CCTV night vision issue)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preferred Time Window</label>
                <select
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Morning (10 AM - 1 PM)">Morning (10 AM - 1 PM)</option>
                  <option value="Afternoon (1 PM - 4 PM)">Afternoon (1 PM - 4 PM)</option>
                  <option value="Evening (4 PM - 7 PM)">Evening (4 PM - 7 PM)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Service Address / Store Drop</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. New Road Store Drop or Doorstep Location in Baneshwor"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>Submit Service Request Ticket</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
