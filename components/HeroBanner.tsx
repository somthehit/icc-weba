'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { ChevronLeft, ChevronRight, ArrowRight, Check, ShoppingCart } from 'lucide-react';

interface HeroSlide {
  id: string;
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  titleSuffix: string;
  subtitle: string;
  badge: string;
  cardLabel: string;
  brand: string;
  model: string;
  bootLines: string[];
  specs: { k: string; v: string }[];
  mrp: number;
  sellingPrice: number;
  stockLeft: number;
  location: string;
  stockPercent: number;
  /** Product slug the slide's Add-to-Cart button resolves against. */
  productSlug?: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-dell-xps',
    eyebrow: 'Spec Sheet · Winter 2026 Builds',
    titlePrefix: 'Next-Gen ',
    titleAccent: 'Laptops',
    titleSuffix: ' &\nWorkstations',
    subtitle: 'Upgrade your productivity with 13th/14th Gen Intel & Ryzen laptops — every unit backed by official Nepal warranty.',
    badge: '-7% OFF',
    cardLabel: 'Featured Build',
    brand: 'Dell Technologies',
    model: 'XPS 15 High Performance',
    bootLines: [
      '> boot sequence ok',
      '> gpu: rtx 4060 detected',
      '> ram: 32gb dual-channel',
      '> status: ready'
    ],
    specs: [
      { k: 'CPU', v: 'Intel Core i7-14700H' },
      { k: 'RAM', v: '32GB DDR5' },
      { k: 'GPU', v: 'RTX 4060 6GB' },
      { k: 'DISPLAY', v: '15.6" 3.5K OLED' },
      { k: 'WARRANTY', v: '2Y Official NP' }
    ],
    mrp: 285000,
    sellingPrice: 264999,
    stockLeft: 4,
    location: 'Kailali warehouse',
    stockPercent: 26,
    productSlug: 'dell-inspiron-15-3520-i5'
  },
  {
    id: 'slide-lenovo-legion',
    eyebrow: 'Extreme Gaming · 2026 Flagship',
    titlePrefix: 'Pro ',
    titleAccent: 'Gaming',
    titleSuffix: ' Rig &\nWorkstation',
    subtitle: 'Dominate esports and heavy rendering with Intel Core i9-14900HX and RTX 4070 140W max TGP graphics.',
    badge: '-8% OFF',
    cardLabel: 'Flagship Battle Rig',
    brand: 'Lenovo Legion',
    model: 'Legion Pro 5 (i9 14th Gen)',
    bootLines: [
      '> legion coldfront 5.0 engaged',
      '> cpu: core i9-14900hx unlocked',
      '> display: 240hz wqxga hdr400',
      '> status: peak performance'
    ],
    specs: [
      { k: 'CPU', v: 'Core i9-14900HX (24C/32T)' },
      { k: 'RAM', v: '32GB DDR5 5600MHz' },
      { k: 'GPU', v: 'RTX 4070 8GB (140W)' },
      { k: 'DISPLAY', v: '16" 240Hz 2.5K IPS' },
      { k: 'WARRANTY', v: '2Y Lenovo NP + ADP' }
    ],
    mrp: 295000,
    sellingPrice: 269999,
    stockLeft: 3,
    location: 'Dhangadhi showroom',
    stockPercent: 20,
    productSlug: 'lenovo-legion-pro-5-14th-i9-rtx4070'
  },
  {
    id: 'slide-cctv-security',
    eyebrow: 'Enterprise Tech · 24/7 Security',
    titlePrefix: 'Smart ',
    titleAccent: 'Surveillance',
    titleSuffix: ' &\nCCTV Systems',
    subtitle: 'Protect your commercial premises and home with Hikvision AI ColorVu 4K Night Vision cameras and dedicated NVRs.',
    badge: '-15% OFF',
    cardLabel: 'Security Package',
    brand: 'Hikvision Digital',
    model: '4K ColorVu AI Smart Kit',
    bootLines: [
      '> acusense motion detection: on',
      '> 24/7 full color night vision',
      '> nvr storage: 4tb surveillance',
      '> status: armed & active'
    ],
    specs: [
      { k: 'RESOLUTION', v: '4K Ultra HD (8MP)' },
      { k: 'CHANNELS', v: '8-Channel PoE NVR' },
      { k: 'NIGHT VISION', v: 'ColorVu 24/7 Color' },
      { k: 'STORAGE', v: '4TB WD Purple Surveillance' },
      { k: 'SUPPORT', v: 'Free Onsite Setup' }
    ],
    mrp: 110000,
    sellingPrice: 93500,
    stockLeft: 7,
    location: 'Dhangadhi inventory',
    stockPercent: 45,
    productSlug: 'hikvision-4ch-2mp-full-hd-cctv-package'
  }
];

export const HeroBanner: React.FC = () => {
  const { navigateTo, addToCart, products } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const current = HERO_SLIDES[currentIndex];

  const handleAddToCart = () => {
    // Matched by slug, not id: product ids are database keys now, but slugs are
    // stable, human-authored and safe to reference from hardcoded slide copy.
    const matchedProduct = products.find((p) => p.slug === current.productSlug);
    if (matchedProduct) {
      addToCart(matchedProduct);
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2000);
    }
  };

  return (
    <section
      id="hero-redesign-section"
      className="relative bg-white text-slate-900 overflow-hidden my-2 max-w-7xl mx-auto rounded-3xl border border-slate-200/80 px-6 lg:px-12 py-5 lg:py-6 select-none shadow-xs"
    >
      {/* Background Subtle Radial Glow */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none -top-40 -right-20 opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)',
        }}
      />

      {/* Cyber Circuit SVG Background Grid (Subtle Light) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
        viewBox="0 0 1400 700"
        preserveAspectRatio="none"
      >
        <g stroke="#3b82f6" strokeWidth="1" opacity="0.08">
          <path d="M0 120 H340 V60 H700" fill="none" />
          <path d="M0 300 H180 V420 H520 V520" fill="none" />
          <path d="M1400 90 H1040 V220 H820" fill="none" />
          <path d="M1400 460 H1180 V560 H900 V640" fill="none" />
          <path d="M300 700 V560 H620" fill="none" />
          <circle cx="340" cy="120" r="3" fill="#3b82f6" />
          <circle cx="700" cy="60" r="3" fill="#3b82f6" />
          <circle cx="180" cy="300" r="3" fill="#3b82f6" />
          <circle cx="520" cy="420" r="3" fill="#3b82f6" />
          <circle cx="1040" cy="90" r="3" fill="#3b82f6" />
          <circle cx="820" cy="220" r="3" fill="#3b82f6" />
          <circle cx="1180" cy="460" r="3" fill="#3b82f6" />
          <circle cx="900" cy="560" r="3" fill="#3b82f6" />
        </g>
      </svg>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Column: Hero Content */}
        <div className="lg:col-span-7 space-y-4">
          {/* Eyebrow with pulsing blue/cyan status dot */}
          <div className="inline-flex items-center gap-2.5 font-mono text-xs tracking-wider text-blue-600 uppercase font-bold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0" />
            <span>{current.eyebrow}</span>
          </div>

          {/* Hero Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold text-slate-900 leading-[1.12] tracking-tight whitespace-pre-line">
            {current.titlePrefix}
            <span className="text-blue-600">{current.titleAccent}</span>
            {current.titleSuffix}
          </h1>

          {/* Subtitle */}
          <p className="text-slate-600 text-base lg:text-[17px] leading-relaxed max-w-lg">
            {current.subtitle}
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => navigateTo('shop')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base py-3 px-6 rounded-xl transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateTo('services')}
              className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base py-3 px-6 rounded-xl border border-slate-300 hover:border-slate-400 transition-all duration-200 cursor-pointer shadow-2xs"
            >
              Our Services
            </button>
          </div>

          {/* Trust Features Strip */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              Official NP Warranty
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              Cash on Delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              eSewa / Khalti
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
              Free Delivery 50,000+
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Tech Spec Card */}
        <div className="lg:col-span-5 relative">
          {/* Animated Circuit Trace Line (Desktop only) */}
          <svg
            className="hidden xl:block absolute -top-8 -left-56 w-[380px] h-[280px] pointer-events-none z-0"
            viewBox="0 0 520 340"
          >
            <path
              d="M0 300 H120 V200 H260 V90 H400"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              className="animate-draw-circuit opacity-30"
            />
            <circle cx="400" cy="90" r="4" fill="#3b82f6" />
          </svg>

          {/* Spec Card Container */}
          <div className="relative z-10 bg-slate-50 border border-slate-200/90 rounded-[22px] p-3 sm:p-4 shadow-lg shadow-slate-200/50">
            {/* Discount Badge */}
            <div className="absolute top-4 right-4 z-20 bg-red-500 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-xs">
              {current.badge}
            </div>

            {/* Card Label */}
            <div className="font-mono text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-2">
              {current.cardLabel}
            </div>

            {/* Virtual Device Display Screen */}
            <div className="relative rounded-t-xl rounded-b h-36 bg-slate-950 border border-slate-800 overflow-hidden p-4 flex flex-col justify-center shadow-inner">
              {/* Radial Highlight in Screen */}
              <div
                className="absolute -top-12 -left-8 w-44 h-44 rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(59,130,246,0.35), transparent 70%)',
                }}
              />
              <div className="relative font-mono text-[11px] text-emerald-400 space-y-1">
                <div>{current.bootLines[0]}</div>
                {current.bootLines.slice(1).map((line, idx) => (
                  <div key={idx} className="text-slate-400">
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Device Metallic Base */}
            <div
              className="h-2 rounded-b-lg mx-2.5 mb-2.5 shadow-2xs border-t border-slate-300"
              style={{
                background: 'linear-gradient(90deg, #e2e8f0, #cbd5e1 50%, #e2e8f0)',
              }}
            />

            {/* Brand & Model */}
            <div className="font-mono text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {current.brand}
            </div>
            <div className="font-sans font-extrabold text-lg text-slate-900 mb-2 truncate">
              {current.model}
            </div>

            {/* Spec Matrix Table */}
            <div className="border-t border-slate-200 divide-y divide-slate-200 mb-2.5">
              {current.specs.map((spec, i) => (
                <div key={i} className="flex justify-between items-center py-1 font-mono text-xs">
                  <span className="text-slate-500 tracking-wide font-medium">{spec.k}</span>
                  <span className="text-slate-900 font-semibold text-right">{spec.v}</span>
                </div>
              ))}
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline gap-2.5 mb-2">
              <span className="font-mono text-xs text-slate-400 line-through">
                NPR {current.mrp.toLocaleString()}
              </span>
              <span className="font-mono font-extrabold text-xl sm:text-2xl text-blue-600">
                NPR {current.sellingPrice.toLocaleString()}
              </span>
            </div>

            {/* Stock Progress Status */}
            <div className="mb-3">
              <div className="flex justify-between font-mono text-[11px] text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">{current.stockLeft} units left</span>
                <span>{current.location}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${current.stockPercent}%`,
                    background: 'linear-gradient(90deg, #ef4444, #f87171)',
                  }}
                />
              </div>
            </div>

            {/* Add to Cart Action */}
            <button
              onClick={handleAddToCart}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm border-2 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${addedNotice
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50 shadow-2xs'
                }`}
            >
              {addedNotice ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hero Carousel Navigation Footer */}
      <div className="relative z-10 mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
        {/* Slide Dots Indicator */}
        <div className="flex items-center gap-2">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${idx === currentIndex ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Previous / Next Arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            className="w-8 h-8 rounded-full border border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length)}
            className="w-8 h-8 rounded-full border border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

