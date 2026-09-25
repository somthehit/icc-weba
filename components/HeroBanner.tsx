'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/context/StoreContext';
import { ChevronLeft, ChevronRight, ArrowRight, Check, ShoppingCart } from 'lucide-react';

interface FlyingItem {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge?: string;
  initX: number; // base percentage X
  initY: number; // base percentage Y
  radiusX: number; // flight range X in pixels
  radiusY: number; // flight range Y in pixels
  speedX: number; // flight frequency X
  speedY: number; // flight frequency Y
  phase: number;
}

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
  image: string;
  flyingItems: FlyingItem[];
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
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80',
    flyingItems: [
      {
        id: 'float-1',
        image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=240&q=80',
        title: 'Precision Mouse',
        subtitle: 'Logitech MX 3S',
        badge: 'Wireless',
        initX: 42,
        initY: 10,
        radiusX: 95,
        radiusY: 55,
        speedX: 0.0012,
        speedY: 0.0009,
        phase: 0.2
      },
      {
        id: 'float-2',
        image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=240&q=80',
        title: '32GB DDR5',
        subtitle: '5600 MT/s Dual',
        badge: 'RAM',
        initX: 38,
        initY: 62,
        radiusX: 110,
        radiusY: 60,
        speedX: 0.0009,
        speedY: 0.0013,
        phase: 2.1
      },
      {
        id: 'float-3',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=240&q=80',
        title: 'GeForce RTX',
        subtitle: '4060 6GB GDDR6',
        badge: 'GPU',
        initX: 76,
        initY: 8,
        radiusX: 85,
        radiusY: 65,
        speedX: 0.0014,
        speedY: 0.0010,
        phase: 4.3
      },
      {
        id: 'float-4',
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=240&q=80',
        title: '3.5K OLED',
        subtitle: '100% DCI-P3 Color',
        badge: 'Display',
        initX: 12,
        initY: 68,
        radiusX: 90,
        radiusY: 50,
        speedX: 0.0011,
        speedY: 0.0008,
        phase: 1.5
      }
    ],
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
    image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80',
    flyingItems: [
      {
        id: 'float-1',
        image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=240&q=80',
        title: '7.1 Surround',
        subtitle: 'Spatial Audio',
        badge: 'Pro Audio',
        initX: 44,
        initY: 12,
        radiusX: 100,
        radiusY: 60,
        speedX: 0.0013,
        speedY: 0.0010,
        phase: 0.5
      },
      {
        id: 'float-2',
        image: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=240&q=80',
        title: 'RGB Mechanical',
        subtitle: 'TrueStrike Switch',
        badge: 'Keyboard',
        initX: 36,
        initY: 65,
        radiusX: 115,
        radiusY: 55,
        speedX: 0.0010,
        speedY: 0.0014,
        phase: 3.2
      },
      {
        id: 'float-3',
        image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=240&q=80',
        title: 'RTX 4070',
        subtitle: '140W Max TGP',
        badge: 'Peak FPS',
        initX: 80,
        initY: 10,
        radiusX: 90,
        radiusY: 70,
        speedX: 0.0012,
        speedY: 0.0009,
        phase: 1.8
      },
      {
        id: 'float-4',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=240&q=80',
        title: '240Hz 2.5K',
        subtitle: 'HDR400 G-Sync',
        badge: 'eSports',
        initX: 10,
        initY: 70,
        radiusX: 85,
        radiusY: 55,
        speedX: 0.0009,
        speedY: 0.0012,
        phase: 4.8
      }
    ],
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
    image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=900&q=80',
    flyingItems: [
      {
        id: 'float-1',
        image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=240&q=80',
        title: '4TB Surveillance',
        subtitle: 'WD Purple 24/7',
        badge: 'Storage',
        initX: 42,
        initY: 10,
        radiusX: 95,
        radiusY: 55,
        speedX: 0.0011,
        speedY: 0.0009,
        phase: 0.8
      },
      {
        id: 'float-2',
        image: 'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?auto=format&fit=crop&w=240&q=80',
        title: 'PoE 8-Port',
        subtitle: 'Gigabit Switch',
        badge: 'PoE Hub',
        initX: 38,
        initY: 64,
        radiusX: 110,
        radiusY: 60,
        speedX: 0.0013,
        speedY: 0.0011,
        phase: 2.7
      },
      {
        id: 'float-3',
        image: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=240&q=80',
        title: 'AI ColorVu',
        subtitle: '24/7 Full Color',
        badge: 'Night 4K',
        initX: 78,
        initY: 12,
        radiusX: 90,
        radiusY: 65,
        speedX: 0.0010,
        speedY: 0.0014,
        phase: 5.1
      },
      {
        id: 'float-4',
        image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=240&q=80',
        title: '4K Ultra HD',
        subtitle: 'Smart Dome Cam',
        badge: '8MP',
        initX: 12,
        initY: 68,
        radiusX: 95,
        radiusY: 50,
        speedX: 0.0012,
        speedY: 0.0008,
        phase: 3.4
      }
    ],
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

/**
 * High-performance animated flying badge that flies across the hero area in real time
 * using requestAnimationFrame with multi-harmonic floating physics.
 */
const FlyingBadge: React.FC<{ item: FlyingItem }> = ({ item }) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    let animId: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (badgeRef.current && !isHoveredRef.current) {
        // Multi-frequency organic flight trajectory calculation
        const dx = Math.sin(elapsed * item.speedX + item.phase) * item.radiusX
                 + Math.cos(elapsed * (item.speedX * 0.6) + item.phase * 1.5) * (item.radiusX * 0.35);
        const dy = Math.cos(elapsed * item.speedY + item.phase) * item.radiusY
                 + Math.sin(elapsed * (item.speedY * 0.7) + item.phase * 0.8) * (item.radiusY * 0.3);
        const rot = Math.sin(elapsed * 0.0008 + item.phase) * 5;

        badgeRef.current.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0px) rotate(${rot.toFixed(2)}deg)`;
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [item]);

  return (
    <div
      ref={badgeRef}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
      className="hidden md:flex absolute z-20 items-center gap-2.5 bg-white/95 backdrop-blur-md border border-slate-200/90 py-1.5 px-3 rounded-2xl shadow-xl shadow-slate-300/40 hover:shadow-2xl hover:scale-105 pointer-events-auto cursor-pointer select-none transition-shadow duration-200"
      style={{
        left: `${item.initX}%`,
        top: `${item.initY}%`,
        willChange: 'transform',
      }}
    >
      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 flex-shrink-0 shadow-inner">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-left leading-tight pr-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs text-slate-800">{item.title}</span>
          {item.badge && (
            <span className="font-mono text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100">
              {item.badge}
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">{item.subtitle}</div>
      </div>
    </div>
  );
};

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
      className="relative bg-gradient-to-b from-slate-50/90 via-white to-slate-50/70 text-slate-900 overflow-hidden my-2 max-w-[1536px] mx-auto rounded-3xl border border-slate-200/80 px-6 lg:px-12 py-6 lg:py-8 select-none shadow-sm"
    >
      {/* Background Subtle Radial Glow & Accents */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none -top-40 -right-20 opacity-70"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.09), transparent 70%)',
        }}
      />
      <div
        className="absolute w-[450px] h-[450px] rounded-full pointer-events-none -bottom-24 -left-16 opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)',
        }}
      />

      {/* Dynamic Flying Photo Badges across Hero Canvas (Real-time Physics Animation) */}
      {current.flyingItems.map((item) => (
        <FlyingBadge key={`${current.id}-${item.id}`} item={item} />
      ))}

      {/* Cyber Circuit SVG Background Grid (Crisp & Subtle) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
        viewBox="0 0 1400 700"
        preserveAspectRatio="none"
      >
        <g stroke="#3b82f6" strokeWidth="1" opacity="0.12">
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

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
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
          <div className="flex flex-wrap items-center gap-3 pt-1 relative z-30">
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
          <div className="pt-4 border-t border-slate-200/80 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-slate-600">
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

        {/* Right Column: Featured Build Card */}
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

          {/* Main Spec Card Container */}
          <div className="relative z-10 bg-white border border-slate-200/90 rounded-[24px] p-4 sm:p-5 shadow-xl shadow-slate-200/70">
            {/* Discount Badge */}
            <div className="absolute top-4 right-4 z-20 bg-red-500 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-full shadow-xs">
              {current.badge}
            </div>

            {/* Card Label */}
            <div className="font-mono text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-2">
              {current.cardLabel}
            </div>

            {/* Direct High-Quality Product Photo Showcase */}
            <div className="relative rounded-2xl h-44 sm:h-48 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 border border-slate-700/60 overflow-hidden group mb-3 shadow-inner">
              <img
                key={current.id}
                src={current.image}
                alt={current.model}
                className="w-full h-full object-cover object-center opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out animate-fade-in"
              />
              
              {/* Subtle Gradient & Glare Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />
              
              {/* Live Terminal Telemetry Overlay Tag */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/85 backdrop-blur-md rounded-xl p-2 border border-slate-700/60 font-mono text-[10px] text-emerald-400 flex items-center justify-between">
                <div className="truncate pr-2">
                  {current.bootLines[0]} <span className="text-slate-400">| {current.bootLines[1]}</span>
                </div>
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Brand & Model */}
            <div className="font-mono text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {current.brand}
            </div>
            <div className="font-sans font-extrabold text-lg sm:text-xl text-slate-900 mb-2 truncate">
              {current.model}
            </div>

            {/* Spec Matrix Table */}
            <div className="border-t border-slate-200 divide-y divide-slate-100 mb-2.5">
              {current.specs.map((spec, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 font-mono text-xs">
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
      <div className="relative z-10 mt-6 pt-3 border-t border-slate-200/80 flex items-center justify-between">
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
