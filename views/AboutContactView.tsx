'use client';

import React, { useState } from 'react';
import { useStore } from '@/context/StoreContext';
import { STORE_INFO } from '@/lib/data/initial-data';
import { GoogleMapEmbed } from '@/components/GoogleMapEmbed';
import { GoogleReviews } from '@/components/GoogleReviews';
import { SeoHead } from '@/context/SeoContext';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Send
} from 'lucide-react';

export const AboutContactView: React.FC = () => {
  const { siteSettings } = useStore();
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let response: Response;
    try {
      response = await fetch('/api/v1/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: contactForm.name, phone: contactForm.phone, email: contactForm.email, subject: contactForm.subject, message: contactForm.message }) });
    } catch {
      setError('Could not reach the contact service. Please try again.');
      return;
    }
    const responseText = await response.text();
    let data: { error?: string; inquiryNumber?: string } = {};
    try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = {}; }
    if (!response.ok) { setError(data.error || 'Could not submit your inquiry.'); return; }
    setInquiryNumber(data.inquiryNumber || '');
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 text-xs">
      <SeoHead
        title="Contact Intel Computer Dhangadhi | Store Address & Google Reviews"
        description="Visit Intel Computer Center in Dhangadhi, Nepal. Certified computer store, laptop repair, CCTV installation & genuine accessories."
        canonicalUrl="https://intelcomputer.com.np/contact"
        keywords={['Intel Computer Dhangadhi', 'Computer Shop Dhangadhi', 'Laptop Repair Kailali', 'Sudurpashchim Electronics']}
      />

      {/* 1. Header Hero */}
      <div className="bg-[#0056b3] text-white rounded-3xl p-8 md:p-12 shadow-xl border border-blue-700/50 space-y-4">
        <span className="bg-white/20 backdrop-blur-sm text-white font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
          Authorized Technology Outlet in Dhangadhi
        </span>
        <h1 className="text-3xl md:text-4xl font-black">{siteSettings.storeName} — Dhangadhi</h1>
        <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
          {siteSettings.tagline}. Located at {siteSettings.address}, we are a certified technology store and total hardware solutions provider for individuals, corporate offices, schools, and government institutions across Far-West Nepal.
        </p>
      </div>

      {/* 2. Interactive Google Map Location Embed */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-900">Google Map Store Location</h2>
          <p className="text-slate-500 text-xs">Main Road, Near Campus Chowk, Dhangadhi, Kailali, Nepal</p>
        </div>
        <GoogleMapEmbed />
      </div>

      {/* 3. Physical Store Location & Contact Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Store Information & Contact Details</span>
          </h2>

          <div className="space-y-3 text-slate-700">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Store Address:</div>
                <div>{siteSettings.address}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">GPS Coordinates: {STORE_INFO.address.mapCoordinates}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Telephone Hotlines:</div>
                <div>Support Phone: <a href={`tel:${siteSettings.phone}`} className="font-bold text-blue-700">{siteSettings.phone}</a></div>
                <div>Mobile / WhatsApp: <a href={`tel:${siteSettings.whatsappNumber}`} className="font-bold text-blue-700">{siteSettings.whatsappNumber}</a></div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Email Addresses:</div>
                <div>General Inquiry: {siteSettings.email}</div>
                <div>Sales & Quotation: {siteSettings.email}</div>
                <div>Technical Support: {siteSettings.email}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Store Opening Hours:</div>
                <div>{siteSettings.openingHours}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">Corporate Registration:</div>
                <div>VAT / PAN Reg No: <strong className="font-mono text-blue-800">{STORE_INFO.vatPanNumber}</strong></div>
                <div className="text-[11px] text-slate-500">Official tax invoices provided for institutional & government purchases.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <span>Send Us a Direct Message</span>
          </h2>

          {submitted ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Message Received!</h3>
              <p className="text-slate-600">
                Thank you for contacting Intel Computer Center. Our sales representative will reply to your phone or email shortly.
                {inquiryNumber && <span className="mt-2 block font-mono font-bold text-emerald-700">Inquiry {inquiryNumber}</span>}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="bg-blue-600 text-white font-bold py-2 px-5 rounded-xl"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="e.g. Som Thehit"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="98510XXXXX"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject</label>
                <select
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold"
                >
                  <option value="General Inquiry">General Product Inquiry</option>
                  <option value="Bulk Corporate Quotation">Bulk Corporate / Educational Quotation</option>
                  <option value="Warranty & Repair">Warranty Claim / Technical Repair</option>
                  <option value="CCTV Site Survey">CCTV On-site Survey Request</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Message Details *</label>
                <textarea
                  required
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Type your message or requested laptop models..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Inquiry to Intel Sales</span>
              </button>
              {error && <p className="text-center font-bold text-rose-600">{error}</p>}
            </form>
          )}
        </div>
      </div>

      {/* 4. Google Reviews Section */}
      <div className="pt-4">
        <GoogleReviews />
      </div>
    </div>
  );
};
