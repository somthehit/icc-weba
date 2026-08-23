'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Truck, CreditCard } from 'lucide-react';

export const FaqView: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Are all products sold at Intel Computer 100% genuine with official Nepal warranty?',
      a: 'Yes, absolutely. Intel Computer & Electronics imports hardware solely through authorized distributors in Nepal. Every laptop, printer, and CCTV unit comes with official VAT serial invoices and stamped brand warranty cards.',
    },
    {
      q: 'Do you deliver outside Kathmandu Valley across Nepal?',
      a: 'Yes, we deliver nationwide to all major cities including Pokhara, Chitwan, Biratnagar, Butwal, Dharan, Nepalgunj, and Birtamode via reliable courier partners. Kathmandu Valley orders qualify for same-day/next-day express delivery.',
    },
    {
      q: 'What payment options do you accept?',
      a: 'We accept Cash on Delivery (COD) within Kathmandu, eSewa mobile wallet, Khalti, Fonepay QR code transfers, and direct Nabil Bank wires. Corporate purchases can be settled via company cheques.',
    },
    {
      q: 'Can I get a VAT Invoice for my company or school?',
      a: 'Yes, all our prices are inclusive of 13% VAT. Provide your company PAN/VAT number during checkout, and we will issue a tax invoice.',
    },
    {
      q: 'How does laptop repair or printer servicing work?',
      a: 'You can drop off your device at our New Road Kathmandu store or submit an online Service Request. Our certified engineers inspect the hardware, provide a cost quote, and complete repairs with genuine replacement parts.',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 text-xs">
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
