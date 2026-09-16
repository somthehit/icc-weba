'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Truck, CreditCard } from 'lucide-react';

import { SUDURPASHCHIM_CONFIG } from '@/config/regional';
import { SeoHead } from '@/context/SeoContext';
import { buildFaqJsonLd } from '@/lib/seo/jsonld';
import { defaultFaqEntries } from '@/lib/seo/resolve';

export const FaqView: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  /**
   * The delivery/payment answers come from the SEO engine's regional record.
   *
   * They used to be typed out here and promised nationwide courier delivery to
   * "Dhangadhi, Chitwan, Biratnagar, Butwal, Dharan, Nepalgunj and Birtamode" — none
   * of which this warehouse ships to — and the same text was published as
   * FAQPage structured data. Deriving them from `config/regional.ts` means the
   * page, the JSON-LD and the delivery zones say one thing.
   */
  const regional = defaultFaqEntries().map((entry) => ({ q: entry.question, a: entry.answer }));

  const faqs = [
    {
      q: 'Are all products sold at Intel Computer 100% genuine with official Nepal warranty?',
      a: 'Yes, absolutely. Intel Computer Center imports hardware solely through authorized distributors in Nepal. Every laptop, printer, and CCTV unit comes with official VAT serial invoices and stamped brand warranty cards.',
    },
    ...regional,
    {
      q: 'What payment options do you accept?',
      a: 'Cash on Delivery in the districts listed above, plus eSewa, Khalti, Fonepay QR and direct bank transfer. Corporate purchases can be settled by company cheque.',
    },
    {
      q: 'Can I get a VAT Invoice for my company or school?',
      a: 'Yes, all our prices are inclusive of 13% VAT. Provide your company PAN/VAT number during checkout, and we will issue a tax invoice.',
    },
    {
      q: 'How does laptop repair or printer servicing work?',
      a: `Drop your device at our ${SUDURPASHCHIM_CONFIG.headquartersHub} on Main Road, ${SUDURPASHCHIM_CONFIG.headquartersCity}, or submit an online Service Request. Our engineers inspect the hardware, quote the cost, and repair with genuine replacement parts.`,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 text-xs">
      {/*
        Publish the FAQPage node from the list actually rendered below. The
        resolver has its own regional fallback, but only this component knows the
        full set — and structured data that does not match the visible page is
        what gets a rich result revoked.
      */}
      <SeoHead
        jsonLd={buildFaqJsonLd(faqs.map((faq) => ({ question: faq.q, answer: faq.a })))}
      />

      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Frequently Asked Questions</h1>
        <p className="text-xs text-slate-500">Everything you need to know about shopping and repairs at Intel Computer</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full p-4 text-left font-extrabold text-slate-900 text-xs sm:text-sm flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <span>{faq.q}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openIdx === idx ? 'rotate-180 text-blue-600' : ''}`} />
            </button>

            {openIdx === idx && (
              <div className="p-4 pt-2 text-slate-600 text-xs leading-relaxed border-t border-slate-100">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
