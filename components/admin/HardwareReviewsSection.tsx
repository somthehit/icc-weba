'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { Product, Review } from '@/types';
import { 
  Star, 
  CheckCircle2, 
  ThumbsUp, 
  Flame, 
  Cpu, 
  ShieldCheck, 
  Volume2, 
  CircleDollarSign, 
  Filter, 
  Search, 
  PenLine, 
  SlidersHorizontal,
  X,
  Sparkles,
  Award,
  Check,
  Layers,
  Wrench
} from 'lucide-react';

interface HardwareReviewsSectionProps {
  product: Product;
}

export const HardwareReviewsSection: React.FC<HardwareReviewsSectionProps> = ({ product }) => {
  const { reviews, addReview, upvoteReview } = useStore();

  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [aspectFilter, setAspectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'helpful' | 'highest' | 'newest'>('helpful');
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('Kathmandu');
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState('');
  const [formSetup, setFormSetup] = useState('');
  const [formAspect, setFormAspect] = useState('General Hardware Performance');
  const [formThermals, setFormThermals] = useState(5);
  const [formBuildQuality, setFormBuildQuality] = useState(5);
  const [formAcoustics, setFormAcoustics] = useState(5);
  const [formPerformance, setFormPerformance] = useState(5);
  const [formValue, setFormValue] = useState(5);
  const [formPros, setFormPros] = useState('');
  const [formCons, setFormCons] = useState('');
  const [formComment, setFormComment] = useState('');

  // Get reviews for current product
  const productReviews = useMemo(() => {
    return reviews.filter((r) => r.productId === product.id);
  }, [reviews, product.id]);

  // Aggregate Metrics Calculations
  const stats = useMemo(() => {
    const total = productReviews.length;
    if (total === 0) {
      // No reviews means no rating. Inventing a 5.0 average and ~4.9 aspect
      // scores here would be fabricated social proof, so every figure is null
      // and the view renders an explicit "not yet rated" state instead.
      return {
        total: 0,
        average: null as number | null,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        aspectAverages: {
          thermals: null as number | null,
          buildQuality: null as number | null,
          acoustics: null as number | null,
          performance: null as number | null,
          value: null as number | null,
        },
      };
    }

    const sumRating = productReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = Number((sumRating / total).toFixed(1));

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let thermalsSum = 0, thermalsCount = 0;
    let buildSum = 0, buildCount = 0;
    let acousticsSum = 0, acousticsCount = 0;
    let perfSum = 0, perfCount = 0;
    let valueSum = 0, valueCount = 0;

    productReviews.forEach((r) => {
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      distribution[rounded] = (distribution[rounded] || 0) + 1;

      if (r.componentRatings) {
        if (r.componentRatings.thermals) {
          thermalsSum += r.componentRatings.thermals;
          thermalsCount++;
        }
        if (r.componentRatings.buildQuality) {
          buildSum += r.componentRatings.buildQuality;
          buildCount++;
        }
        if (r.componentRatings.acoustics) {
          acousticsSum += r.componentRatings.acoustics;
          acousticsCount++;
        }
        if (r.componentRatings.performance) {
          perfSum += r.componentRatings.performance;
          perfCount++;
        }
        if (r.componentRatings.value) {
          valueSum += r.componentRatings.value;
          valueCount++;
        }
      }
    });

    return {
      total,
      average: avg as number | null,
      distribution,
      // A reviewer can skip individual aspect sliders; an aspect nobody scored
      // stays null rather than defaulting to a flattering 4.8.
      aspectAverages: {
        thermals: thermalsCount > 0 ? Number((thermalsSum / thermalsCount).toFixed(1)) : null,
        buildQuality: buildCount > 0 ? Number((buildSum / buildCount).toFixed(1)) : null,
        acoustics: acousticsCount > 0 ? Number((acousticsSum / acousticsCount).toFixed(1)) : null,
        performance: perfCount > 0 ? Number((perfSum / perfCount).toFixed(1)) : null,
        value: valueCount > 0 ? Number((valueSum / valueCount).toFixed(1)) : null,
      },
    };
  }, [productReviews]);

  /** Aspect score as text, or an em dash when nobody has scored that aspect. */
  const aspectLabel = (v: number | null) => (v === null ? '—' : `${v} / 5.0`);
  /** Bar width for an aspect score; an unscored aspect draws an empty bar. */
  const aspectWidth = (v: number | null) => (v === null ? 0 : (v / 5) * 100);

  // Unique aspects in reviews for filter dropdown
  const availableAspects = useMemo(() => {
    const set = new Set<string>();
    productReviews.forEach((r) => {
      if (r.componentAspect) set.add(r.componentAspect);
    });
    return Array.from(set);
  }, [productReviews]);

  // Filtered and sorted reviews
  const filteredReviews = useMemo(() => {
    return productReviews
      .filter((r) => {
        if (ratingFilter !== 'all' && Math.round(r.rating) !== ratingFilter) return false;
        if (aspectFilter !== 'all' && r.componentAspect !== aspectFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchComment = r.comment.toLowerCase().includes(q);
          const matchTitle = r.title?.toLowerCase().includes(q) || false;
          const matchSetup = r.hardwareSetup?.toLowerCase().includes(q) || false;
          const matchUser = r.userName.toLowerCase().includes(q);
          if (!matchComment && !matchTitle && !matchSetup && !matchUser) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'helpful') {
          return (b.helpfulCount || 0) - (a.helpfulCount || 0);
        }
        if (sortBy === 'highest') {
          return b.rating - a.rating;
        }
        if (sortBy === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return 0;
      });
  }, [productReviews, ratingFilter, aspectFilter, searchQuery, sortBy]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formComment.trim()) return;

    const prosList = formPros
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const consList = formCons
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    addReview({
      productId: product.id,
      userName: formName.trim(),
      userCity: formCity.trim() || 'Kathmandu',
      rating: formRating,
      title: formTitle.trim() || undefined,
      comment: formComment.trim(),
      verifiedPurchase: true,
      hardwareSetup: formSetup.trim() || undefined,
      componentAspect: formAspect || 'General Hardware Performance',
      componentRatings: {
        thermals: formThermals,
        buildQuality: formBuildQuality,
        acoustics: formAcoustics,
        performance: formPerformance,
        value: formValue,
      },
      pros: prosList.length > 0 ? prosList : undefined,
      cons: consList.length > 0 ? consList : undefined,
      helpfulCount: 0,
    });

    setIsWriteModalOpen(false);
    setSuccessToast('Thank you! Your verified hardware review & testimonial have been published.');
    setTimeout(() => setSuccessToast(null), 5000);

    // Reset form
    setFormName('');
    setFormTitle('');
    setFormSetup('');
    setFormComment('');
    setFormPros('');
    setFormCons('');
  };

  return (
    <div id="hardware-reviews-section" className="space-y-8">
      {/* Toast Notification */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs font-semibold animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Section: Overall Rating & Hardware Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/80 rounded-3xl p-6 md:p-8 border border-slate-200/80">
        {/* Left Column: Big Star Score & Star Distribution */}
        <div className="lg:col-span-5 space-y-5 lg:border-r lg:border-slate-200/80 lg:pr-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center shadow-md flex-shrink-0">
              <span className="text-3xl font-black leading-none">
                {stats.average === null ? '—' : stats.average.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mt-1">out of 5</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-400 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      stats.average !== null && star <= Math.round(stats.average)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 fill-slate-100'
                    }`}
                  />
                ))}
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Verified Hardware Rating
              </h3>
              <p className="text-xs text-slate-500">
                {stats.total === 0 ? (
                  <>Not yet rated — no verified reviews for this product</>
                ) : (
                  <>
                    Based on{' '}
                    <span className="font-bold text-slate-700">
                      {stats.total} verified customer review{stats.total === 1 ? '' : 's'}
                    </span>{' '}
                    for this component
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Star Distribution Progress Bars */}
          <div className="space-y-2 pt-2 text-xs">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats.distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
              // With no reviews every bar is empty; showing 5-star at 100% would
              // imply a perfect score nobody gave.
              const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <button
                  key={stars}
                  onClick={() => setRatingFilter(ratingFilter === stars ? 'all' : stars)}
                  className={`w-full flex items-center gap-3 text-left py-1 px-2 rounded-lg transition-colors ${
                    ratingFilter === stars ? 'bg-blue-100/70 text-blue-900 font-bold' : 'hover:bg-slate-200/50 text-slate-600'
                  }`}
                >
                  <span className="w-12 font-semibold flex items-center gap-1">
                    {stars} <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline" />
                  </span>
                  <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-[11px] font-mono text-slate-500">{percent}%</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <PenLine className="w-4 h-4" />
              <span>Write Component Testimonial</span>
            </button>
          </div>
        </div>

        {/* Right Column: Hardware Component Diagnostic Ratings */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Component Benchmark Breakdown
              </h4>
            </div>
            {stats.total > 0 && (
              <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Tested in Nepal
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Thermals */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Thermal &amp; Cooling
                </span>
                <span className="font-extrabold text-slate-900 font-mono">{aspectLabel(stats.aspectAverages.thermals)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" 
                  style={{ width: `${aspectWidth(stats.aspectAverages.thermals)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Operating temperature &amp; sustained heat dissipation stability
              </p>
            </div>

            {/* Performance */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  Performance &amp; Speed
                </span>
                <span className="font-extrabold text-slate-900 font-mono">{aspectLabel(stats.aspectAverages.performance)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" 
                  style={{ width: `${aspectWidth(stats.aspectAverages.performance)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Clock speeds, throughput &amp; responsiveness under workloads
              </p>
            </div>

            {/* Build Quality */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Build Quality &amp; PCB
                </span>
                <span className="font-extrabold text-slate-900 font-mono">{aspectLabel(stats.aspectAverages.buildQuality)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full" 
                  style={{ width: `${aspectWidth(stats.aspectAverages.buildQuality)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Component materials, PCB solder quality &amp; structural rigidity
              </p>
            </div>

            {/* Acoustics */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-purple-600" />
                  Acoustic &amp; Noise Profile
                </span>
                <span className="font-extrabold text-slate-900 font-mono">{aspectLabel(stats.aspectAverages.acoustics)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full" 
                  style={{ width: `${aspectWidth(stats.aspectAverages.acoustics)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Whisper-quiet fan curves and minimal coil whine
              </p>
            </div>

            {/* Value */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CircleDollarSign className="w-4 h-4 text-amber-600" />
                  Nepal Price-to-Performance Ratio
                </span>
                <span className="font-extrabold text-slate-900 font-mono">{aspectLabel(stats.aspectAverages.value)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full" 
                  style={{ width: `${aspectWidth(stats.aspectAverages.value)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Authentic warranty value, competitive NPR pricing &amp; long-term durability
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search testimonials (e.g. thermals, speeds, fans)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end text-xs">
            {/* Aspect dropdown */}
            {availableAspects.length > 0 && (
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={aspectFilter}
                  onChange={(e) => setAspectFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Component Aspects</option>
                  {availableAspects.map((aspect) => (
                    <option key={aspect} value={aspect}>
                      {aspect}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sort By */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="helpful">Most Helpful</option>
                <option value="highest">Highest Rating</option>
                <option value="newest">Most Recent</option>
              </select>
            </div>

            {/* Clear Filters Button if active */}
            {(ratingFilter !== 'all' || aspectFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setRatingFilter('all');
                  setAspectFilter('all');
                  setSearchQuery('');
                }}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-2 rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Rating Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            Star Rating:
          </span>
          <button
            onClick={() => setRatingFilter('all')}
            className={`px-3 py-1 rounded-full font-bold transition-colors whitespace-nowrap ${
              ratingFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Ratings ({productReviews.length})
          </button>
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              onClick={() => setRatingFilter(ratingFilter === star ? 'all' : star)}
              className={`px-3 py-1 rounded-full font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                ratingFilter === star
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{star}</span>
              <Star className="w-3 h-3 fill-current" />
              <span className="text-[10px] opacity-80">({stats.distribution[star as 1 | 2 | 3 | 4 | 5] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer Testimonials List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-300 space-y-3">
            <Award className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">No reviews match your filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try resetting your search query or rating filter, or be the first to share your hardware setup experience!
            </p>
            <button
              onClick={() => {
                setRatingFilter('all');
                setAspectFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          filteredReviews.map((rev) => {
            const hasAspectRatings = rev.componentRatings && Object.keys(rev.componentRatings).length > 0;
            return (
              <div
                key={rev.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 transition-all hover:border-slate-300"
              >
                {/* Review Header: User Info, Verified Badge, Rating, Date */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar Initials */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs flex-shrink-0">
                      {rev.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-xs">
                          {rev.userName}
                        </span>
                        {rev.verifiedPurchase && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Verified Hardware Buyer
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{rev.userCity || 'Kathmandu, Nepal'}</span>
                        <span>•</span>
                        <span>{rev.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Star Rating Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-100'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-black text-slate-900 text-xs font-mono">{rev.rating}.0</span>
                  </div>
                </div>

                {/* Testimonial Title */}
                {rev.title && (
                  <h4 className="text-sm font-black text-slate-900 leading-snug">
                    &ldquo;{rev.title}&rdquo;
                  </h4>
                )}

                {/* Hardware Setup / Test Environment Tag */}
                {rev.hardwareSetup && (
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                    <Wrench className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span className="font-bold text-slate-900">Tested Rig Setup:</span>
                    <span className="font-mono text-slate-600">{rev.hardwareSetup}</span>
                  </div>
                )}

                {/* Component Aspect Ratings Micro-Badges */}
                {hasAspectRatings && (
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    {rev.componentRatings?.thermals !== undefined && (
                      <div className="bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                        <Flame className="w-3 h-3 text-rose-600" />
                        <span>Thermals: <strong>{rev.componentRatings.thermals}★</strong></span>
                      </div>
                    )}
                    {rev.componentRatings?.performance !== undefined && (
                      <div className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                        <Cpu className="w-3 h-3 text-blue-600" />
                        <span>Speed: <strong>{rev.componentRatings.performance}★</strong></span>
                      </div>
                    )}
                    {rev.componentRatings?.buildQuality !== undefined && (
                      <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Build: <strong>{rev.componentRatings.buildQuality}★</strong></span>
                      </div>
                    )}
                    {rev.componentRatings?.acoustics !== undefined && (
                      <div className="bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                        <Volume2 className="w-3 h-3 text-purple-600" />
                        <span>Acoustics: <strong>{rev.componentRatings.acoustics}★</strong></span>
                      </div>
                    )}
                    {rev.componentRatings?.value !== undefined && (
                      <div className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
                        <CircleDollarSign className="w-3 h-3 text-amber-600" />
                        <span>Value: <strong>{rev.componentRatings.value}★</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Testimonial Body */}
                <p className="text-xs text-slate-700 leading-relaxed">
                  {rev.comment}
                </p>

                {/* Pros and Cons */}
                {(rev.pros || rev.cons) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {rev.pros && rev.pros.length > 0 && (
                      <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 space-y-1">
                        <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                          Key Strengths (Pros):
                        </span>
                        <ul className="space-y-0.5">
                          {rev.pros.map((p, i) => (
                            <li key={i} className="text-xs text-emerald-900 flex items-center gap-1.5">
                              <span className="text-emerald-600 font-bold">+</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {rev.cons && rev.cons.length > 0 && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                          Things to Consider:
                        </span>
                        <ul className="space-y-0.5">
                          {rev.cons.map((c, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className="text-rose-500 font-bold">-</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Testimonial Footer / Helpful Upvote */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    {rev.componentAspect && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        Focus: {rev.componentAspect}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => upvoteReview(rev.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      rev.userUpvoted
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${rev.userUpvoted ? 'fill-blue-600 text-blue-600' : ''}`} />
                    <span>Helpful ({rev.helpfulCount || 0})</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Write Review & Hardware Testimonial Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                  <PenLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Write a Component Testimonial</h3>
                  <p className="text-xs text-slate-500">Share your hands-on hardware testing experience in Nepal</p>
                </div>
              </div>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
              {/* Product Name Banner */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-xs">{product.name}</div>
                  <div className="text-[11px] text-slate-500">SKU: {product.sku} | Brand: {product.brand}</div>
                </div>
              </div>

              {/* Star Rating Select */}
              <div>
                <label className="block font-extrabold text-slate-800 mb-1.5">
                  Overall Hardware Rating *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFormRating(star)}
                      className="p-1.5 rounded-lg hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= formRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 fill-slate-100'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="font-black text-slate-900 text-sm ml-2 font-mono">
                    {formRating} Star{formRating > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Name & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Shrestha"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City / District *</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Kathmandu, Pokhara, Dhangadhi"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Testimonial Headline */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Testimonial Headline / Key Takeaway
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Exceptional cooling under Blender renders, whisper-quiet fans"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tested Hardware Rig Setup */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tested Hardware Rig Setup (Optional)
                </label>
                <input
                  type="text"
                  value={formSetup}
                  onChange={(e) => setFormSetup(e.target.value)}
                  placeholder="e.g. Paired with AMD Ryzen 7 7800X3D + 32GB DDR5 + 750W Gold PSU"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Granular Component Benchmark Sliders */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-extrabold text-slate-900 block text-xs">
                  Rate Specific Component Metrics (1 - 5 Stars):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>🔥 Thermals &amp; Heat:</span>
                      <span className="font-mono text-blue-600">{formThermals}★</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={formThermals}
                      onChange={(e) => setFormThermals(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>⚡ Performance &amp; Stability:</span>
                      <span className="font-mono text-blue-600">{formPerformance}★</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={formPerformance}
                      onChange={(e) => setFormPerformance(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>🛠️ Build Quality &amp; PCB:</span>
                      <span className="font-mono text-blue-600">{formBuildQuality}★</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={formBuildQuality}
                      onChange={(e) => setFormBuildQuality(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                      <span>🔇 Acoustic &amp; Noise:</span>
                      <span className="font-mono text-blue-600">{formAcoustics}★</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={formAcoustics}
                      onChange={(e) => setFormAcoustics(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Pros & Cons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-800 mb-1">
                    Pros (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formPros}
                    onChange={(e) => setFormPros(e.target.value)}
                    placeholder="e.g. Fast speeds, Low heat, Silent"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cons (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formCons}
                    onChange={(e) => setFormCons(e.target.value)}
                    placeholder="e.g. No heatsink included, Bulky power brick"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Testimonial Comment */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Detailed Testimonial &amp; Experience *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Describe installation experience, benchmark readings, thermal behavior, or everyday performance in Nepal..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-md flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Publish Testimonial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
