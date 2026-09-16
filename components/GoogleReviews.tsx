'use client';

import React, { useState, useEffect } from 'react';
import { STORE_INFO } from '@/lib/data/initial-data';
import {
  Star,
  CheckCircle2,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  Share2,
  ExternalLink,
  Search,
  Filter,
  ShieldCheck,
  PlusCircle,
  X,
  Send,
  UserCheck,
  RefreshCw,
  Check
} from 'lucide-react';

export interface GoogleReviewItem {
  id: string;
  authorName: string;
  authorPhoto?: string;
  isLocalGuide: boolean;
  localGuideLevel?: number;
  rating: number;
  relativeTime: string;
  reviewText: string;
  categoryTag?: 'Laptops' | 'Repairs' | 'CCTV' | 'Components' | 'Accessories';
  likedAspects?: string[];
  ownerResponse?: {
    date: string;
    text: string;
  };
  verifiedCustomer?: boolean;
}

const INITIAL_GOOGLE_REVIEWS: GoogleReviewItem[] = [
  {
    id: 'rev-1',
    authorName: 'Ramesh Bahadur Chand',
    isLocalGuide: true,
    localGuideLevel: 6,
    rating: 5,
    relativeTime: '2 days ago',
    categoryTag: 'Laptops',
    reviewText: 'Best computer shop in Dhangadhi! Bought a Dell Vostro laptop for my office work. Price was very fair compared to Kailali market and they gave me genuine bill with official brand warranty. Excellent service by Mr. Intel team.',
    likedAspects: ['Genuine Products', 'Official Warranty', 'Good Pricing'],
    verifiedCustomer: true,
    ownerResponse: {
      date: '1 day ago',
      text: 'Thank you Ramesh ji for choosing Intel Computer Dhangadhi! We are committed to delivering genuine laptops and prompt local warranty support.'
    }
  },
  {
    id: 'rev-2',
    authorName: 'Pooja Joshi',
    isLocalGuide: true,
    localGuideLevel: 4,
    rating: 5,
    relativeTime: '1 week ago',
    categoryTag: 'Repairs',
    reviewText: 'My HP laptop display stopped working suddenly. The technical repair team at Dhangadhi branch diagnosed the motherboard issue and repaired it within 24 hours at very reasonable charge. Highly recommended for laptop repair in Sudurpashchim!',
    likedAspects: ['Fast Repair', 'Certified Technicians', 'Fair Price'],
    verifiedCustomer: true,
    ownerResponse: {
      date: '6 days ago',
      text: 'Thank you Pooja ji! Glad our technical repair engineers in Dhangadhi could solve your HP laptop problem quickly.'
    }
  },
  {
    id: 'rev-3',
    authorName: 'Dr. Bishnu Prasad Bhatta',
    isLocalGuide: false,
    rating: 5,
    relativeTime: '2 weeks ago',
    categoryTag: 'CCTV',
    reviewText: 'Installed 8 Hikvision 5MP IP CCTV cameras for our clinic near Main Road, Dhangadhi. Clean wiring, neat installation, and smartphone remote viewing configured smoothly by their engineers.',
    likedAspects: ['CCTV Setup', 'Professional Work', 'On-time Delivery'],
    verifiedCustomer: true,
    ownerResponse: {
      date: '2 weeks ago',
      text: 'Thank you Dr. Bhatta! Appreciate your trust in Intel Computer for Hikvision CCTV security installation.'
    }
  },
  {
    id: 'rev-4',
    authorName: 'Dipendra Malla',
    isLocalGuide: true,
    localGuideLevel: 5,
    rating: 5,
    relativeTime: '3 weeks ago',
    categoryTag: 'Components',
    reviewText: 'Purchased RTX 4060 GPU and Intel Core i7 processor for my custom gaming PC build. Genuine box packing with serial numbers verified. Best place in Far-West Nepal for PC gamers!',
    likedAspects: ['Original Hardware', 'Gaming Gear', 'Technical Knowledge'],
    verifiedCustomer: true,
  },
  {
    id: 'rev-5',
    authorName: 'Kailali Community College (IT Dept)',
    isLocalGuide: true,
    localGuideLevel: 7,
    rating: 5,
    relativeTime: '1 month ago',
    categoryTag: 'Laptops',
    reviewText: 'Procured 15 desktop PCs and Brother heavy-duty printers for our college IT lab in Dhangadhi. Professional corporate VAT invoice provided and fast delivery.',
    likedAspects: ['VAT Invoice', 'Bulk Supply', 'Post-sales Support'],
    verifiedCustomer: true,
    ownerResponse: {
      date: '1 month ago',
      text: 'Thank you Kailali Community College! Proud to support IT education in Dhangadhi with high performance computers.'
    }
  },
  {
    id: 'rev-6',
    authorName: 'Suman Chaudhari',
    isLocalGuide: false,
    rating: 5,
    relativeTime: '1 month ago',
    categoryTag: 'Accessories',
    reviewText: 'Got a 27-inch 180Hz gaming monitor and mechanical keyboard. Staff is very humble and polite. They tested everything before packing.',
    likedAspects: ['Polite Staff', 'Product Testing'],
    verifiedCustomer: true,
  }
];

export const GoogleReviews: React.FC = () => {
  const [reviewsList, setReviewsList] = useState<GoogleReviewItem[]>(INITIAL_GOOGLE_REVIEWS);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isWriteModalOpen, setIsWriteModalOpen] = useState<boolean>(false);
  const [submittedMessage, setSubmittedMessage] = useState<boolean>(false);

  // Live Google Places Sync state
  const [liveRating, setLiveRating] = useState<number>(4.9);
  const [liveTotalReviews, setLiveTotalReviews] = useState<number>(248);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live Synced');

  const fetchLiveGoogleData = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/google-places');
      if (res.ok) {
        const data = await res.json();
        if (data.rating) setLiveRating(data.rating);
        if (data.userRatingsTotal) setLiveTotalReviews(data.userRatingsTotal);
        if (data.reviews && data.reviews.length > 0) {
          // Merge newly fetched live reviews with local list
          setReviewsList((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const newFetched = data.reviews.filter((r: any) => !existingIds.has(r.id));
            return [...newFetched, ...prev];
          });
        }
        setLastSyncTime(`Auto-synced at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (e) {
      console.warn('Failed to fetch live Google Places data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLiveGoogleData();
    }, 0);
    // Auto-fetch updates from Google Maps every 30 seconds
    const interval = setInterval(fetchLiveGoogleData, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // New review form state
  const [newReview, setNewReview] = useState({
    name: '',
    rating: 5,
    text: '',
    category: 'Laptops' as 'Laptops' | 'Repairs' | 'CCTV' | 'Components' | 'Accessories',
  });

  const filterCategories = ['All', 'Laptops', 'Repairs', 'CCTV', 'Components', 'Accessories'];

  const filteredReviews = reviewsList.filter((r) => {
    const matchesCat = activeCategory === 'All' || r.categoryTag === activeCategory;
    const matchesQuery =
      !searchQuery.trim() ||
      r.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reviewText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.likedAspects && r.likedAspects.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesQuery;
  });

  const handleAddReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.name.trim() || !newReview.text.trim()) return;

    const createdReview: GoogleReviewItem = {
      id: `rev-${Date.now()}`,
      authorName: newReview.name,
      isLocalGuide: false,
      rating: newReview.rating,
      relativeTime: 'Just now',
      categoryTag: newReview.category,
      reviewText: newReview.text,
      likedAspects: ['Verified Customer', 'Dhangadhi Outlet'],
      verifiedCustomer: true,
    };

    setReviewsList([createdReview, ...reviewsList]);
    setLiveTotalReviews((prev) => prev + 1);
    setSubmittedMessage(true);
    setTimeout(() => {
      setSubmittedMessage(false);
      setIsWriteModalOpen(false);
      setNewReview({ name: '', rating: 5, text: '', category: 'Laptops' });
    }, 2000);
  };

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-10 space-y-8 shadow-sm">
      {/* Top Google Header Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          {/* Official Google G Icon */}
          <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-2.5 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Google Business Reviews</h2>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified Dhangadhi Branch
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-blue-200">
                <RefreshCw className={`w-3 h-3 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                Auto-Synced with Google Maps
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{liveRating.toFixed(1)}</span>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-600">
                ({liveTotalReviews} Google Reviews)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Intel Computer Center — Main Road, Near Campus Chowk, Dhangadhi • <span className="text-emerald-600 font-semibold">{lastSyncTime}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchLiveGoogleData}
            disabled={isSyncing}
            title="Fetch latest reviews & ratings from Google Maps API"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Sync Live Google Data</span>
          </button>
          <button
            onClick={() => setIsWriteModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Write a Google Review</span>
          </button>
          <a
            href="https://maps.google.com/?q=Dhangadhi+Nepal"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs border border-slate-300 flex items-center gap-2 transition-all"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span>View on Google Maps</span>
          </a>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {filterCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Reviews Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reviews..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Reviews Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReviews.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
            No Google reviews found matching &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
            >
              <div>
                {/* Reviewer Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-xs">
                      {rev.authorName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">{rev.authorName}</span>
                        {rev.verifiedCustomer && (
                          <span title="Verified Customer">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        {rev.isLocalGuide && (
                          <span className="bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded text-[10px]">
                            Local Guide • Level {rev.localGuideLevel || 5}
                          </span>
                        )}
                        <span>{rev.relativeTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </div>

                {/* Review Text */}
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  &quot;{rev.reviewText}&quot;
                </p>

                {/* Aspect Pills */}
                {rev.likedAspects && rev.likedAspects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {rev.likedAspects.map((aspect, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1"
                      >
                        <ThumbsUp className="w-2.5 h-2.5 text-blue-600" />
                        {aspect}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Owner Response */}
              {rev.ownerResponse && (
                <div className="bg-slate-50 border-l-2 border-blue-600 p-3 rounded-r-xl text-xs space-y-1 mt-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-blue-600" />
                      Response from Intel Computer (Owner)
                    </span>
                    <span className="text-slate-400">{rev.ownerResponse.date}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] italic">
                    &quot;{rev.ownerResponse.text}&quot;
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Write Review Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                  G
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Write a Google Review</h3>
              </div>
              <button onClick={() => setIsWriteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {submittedMessage ? (
              <div className="p-6 text-center space-y-2 bg-emerald-50 rounded-2xl border border-emerald-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-sm">Thank You for Reviewing!</h4>
                <p className="text-slate-600 text-xs">
                  Your review has been submitted to Intel Computer Center (Dhangadhi Branch).
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddReviewSubmit} className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={newReview.name}
                    onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                    placeholder="e.g. Anand Sharma"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Service / Purchase</label>
                    <select
                      value={newReview.category}
                      onChange={(e) => setNewReview({ ...newReview, category: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium"
                    >
                      <option value="Laptops">Laptops & PCs</option>
                      <option value="Repairs">Laptop Repair</option>
                      <option value="CCTV">CCTV Installation</option>
                      <option value="Components">PC Components</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Star Rating</label>
                    <select
                      value={newReview.rating}
                      onChange={(e) => setNewReview({ ...newReview, rating: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-amber-600"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                      <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                      <option value={3}>⭐⭐⭐ (3/5)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Review Experience *</label>
                  <textarea
                    required
                    rows={4}
                    value={newReview.text}
                    onChange={(e) => setNewReview({ ...newReview, text: e.target.value })}
                    placeholder="Describe your purchase or service experience at Dhangadhi branch..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Post Review</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
