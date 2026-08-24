'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { TECHNICAL_SERVICES } from '@/lib/data/initial-data';
import { 
  Search, 
  X, 
  Wrench, 
  Package, 
  Layers, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  ChevronRight, 
  Tag, 
  CheckCircle2, 
  Trash2,
  Cpu,
  Laptop,
  Printer,
  ShieldCheck,
  Wifi,
  ShoppingBag
} from 'lucide-react';

interface RealtimeSearchProps {
  placeholder?: string;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

const TRENDING_SEARCHES = [
  'Dell Core i5',
  'Epson EcoTank',
  'CCTV Installation',
  'Lenovo LOQ RTX 3050',
  'Laptop Battery Repair',
  'Wi-Fi 6 Router',
  'Custom Gaming PC'
];

const RECENT_SEARCHES_STORAGE_KEY = 'ice_recent_searches_v1';

export const RealtimeSearch: React.FC<RealtimeSearchProps> = ({
  placeholder = 'Search products, services, categories...',
  isMobile = false,
  onCloseMobile
}) => {
  const { 
    products, 
    categories, 
    searchQuery, 
    setSearchQuery, 
    navigateTo, 
    setIsServiceModalOpen, 
    setIsAiAssistantOpen 
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'categories' | 'services'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      return saved ? JSON.parse(saved).slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveRecentSearch = React.useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage error
    }
  }, []);

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut (Cmd+K / Ctrl+K / '/' key) to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cleanQuery = searchQuery.trim().toLowerCase();

  // Filter Products
  const matchingProducts = useMemo(() => {
    if (!cleanQuery) return [];
    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(cleanQuery);
      const brandMatch = p.brand.toLowerCase().includes(cleanQuery);
      const skuMatch = p.sku ? p.sku.toLowerCase().includes(cleanQuery) : false;
      const catMatch = p.category.toLowerCase().includes(cleanQuery);
      const subcatMatch = p.subcategory ? p.subcategory.toLowerCase().includes(cleanQuery) : false;
      const tagMatch = p.tags ? p.tags.some((t) => t.toLowerCase().includes(cleanQuery)) : false;
      return nameMatch || brandMatch || skuMatch || catMatch || subcatMatch || tagMatch;
    });
  }, [products, cleanQuery]);

  // Filter Categories
  const matchingCategories = useMemo(() => {
    if (!cleanQuery) return [];
    return categories.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(cleanQuery);
      const descMatch = c.description.toLowerCase().includes(cleanQuery);
      const subMatch = c.subcategories.some((sub) => sub.toLowerCase().includes(cleanQuery));
      return nameMatch || descMatch || subMatch;
    });
  }, [categories, cleanQuery]);

  // Filter Technical Services
  const matchingServices = useMemo(() => {
    if (!cleanQuery) return [];
    return TECHNICAL_SERVICES.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(cleanQuery);
      const descMatch = s.description.toLowerCase().includes(cleanQuery);
      const featMatch = s.features.some((f) => f.toLowerCase().includes(cleanQuery));
      return titleMatch || descMatch || featMatch;
    });
  }, [cleanQuery]);

  const totalResultsCount = matchingProducts.length + matchingCategories.length + matchingServices.length;

  // Flattened list for keyboard arrow navigation
  const navigationItems = useMemo(() => {
    const items: Array<{ type: 'product' | 'category' | 'service'; id: string; action: () => void }> = [];

    if (activeTab === 'all' || activeTab === 'products') {
      matchingProducts.slice(0, 6).forEach((p) => {
        items.push({
          type: 'product',
          id: p.id,
          action: () => {
            saveRecentSearch(p.name);
            setIsOpen(false);
            if (onCloseMobile) onCloseMobile();
            navigateTo('product-detail', p.slug);
          }
        });
      });
    }

    if (activeTab === 'all' || activeTab === 'categories') {
      matchingCategories.slice(0, 4).forEach((c) => {
        items.push({
          type: 'category',
          id: c.id,
          action: () => {
            saveRecentSearch(c.name);
            setIsOpen(false);
            if (onCloseMobile) onCloseMobile();
            navigateTo('shop');
          }
        });
      });
    }

    if (activeTab === 'all' || activeTab === 'services') {
      matchingServices.slice(0, 3).forEach((s) => {
        items.push({
          type: 'service',
          id: s.id,
          action: () => {
            saveRecentSearch(s.title);
            setIsOpen(false);
            if (onCloseMobile) onCloseMobile();
            setIsServiceModalOpen(true);
          }
        });
      });
    }

    return items;
  }, [activeTab, matchingProducts, matchingCategories, matchingServices, navigateTo, setIsServiceModalOpen, onCloseMobile, saveRecentSearch]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanQuery) {
      saveRecentSearch(searchQuery);
      setIsOpen(false);
      if (onCloseMobile) onCloseMobile();
      navigateTo('shop');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || navigationItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < navigationItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : navigationItems.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < navigationItems.length) {
      e.preventDefault();
      navigationItems[selectedIndex].action();
    }
  };

  const executePillSearch = (term: string) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // Helper icon generator for service items
  const getServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Laptop': return <Laptop className="w-4 h-4 text-blue-600" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'Printer': return <Printer className="w-4 h-4 text-purple-600" />;
      case 'Wifi': return <Wifi className="w-4 h-4 text-indigo-600" />;
      case 'Cpu': return <Cpu className="w-4 h-4 text-amber-600" />;
      default: return <Wrench className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className={`relative w-full ${isMobile ? '' : 'max-w-lg mx-auto'}`} ref={containerRef}>
      {/* Search Bar Form */}
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center gap-1">
          <Search className="w-4 h-4 text-[#0056b3]" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-slate-100/80 hover:bg-slate-100 border border-transparent focus:border-[#0056b3]/30 focus:bg-white rounded-full py-2.5 pl-10 pr-20 text-xs sm:text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:ring-2 focus:ring-[#0056b3]/20 transition-all outline-none font-medium"
        />

        {/* Clear & Keyboard shortcut indicator */}
        <div className="absolute right-3.5 flex items-center gap-1.5">
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200/60 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!isMobile && !searchQuery && (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-gray-400 bg-white border border-gray-200 rounded-md shadow-xs pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>
      </form>

      {/* Realtime Search Results Popover Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* STATE 1: ACTIVE QUERY HAS RESULTS */}
          {cleanQuery && totalResultsCount > 0 && (
            <div className="flex flex-col max-h-[80vh] sm:max-h-[550px] overflow-hidden">
              
              {/* Category Filter Tabs */}
              <div className="bg-slate-50 p-2 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'bg-[#0056b3] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  All Matches ({totalResultsCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
                    activeTab === 'products'
                      ? 'bg-[#0056b3] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Package className="w-3 h-3" />
                  <span>Products ({matchingProducts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('categories')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
                    activeTab === 'categories'
                      ? 'bg-[#0056b3] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Categories ({matchingCategories.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('services')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
                    activeTab === 'services'
                      ? 'bg-[#0056b3] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Wrench className="w-3 h-3 text-amber-500" />
                  <span>Services ({matchingServices.length})</span>
                </button>
              </div>

              {/* Scrollable Results List */}
              <div className="overflow-y-auto p-2 divide-y divide-gray-100">
                
                {/* SECTION: PRODUCTS */}
                {(activeTab === 'all' || activeTab === 'products') && matchingProducts.length > 0 && (
                  <div className="py-2 space-y-1">
                    <div className="px-3 py-1 flex items-center justify-between text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#0056b3]" />
                        <span>Products</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">({matchingProducts.length} items)</span>
                    </div>

                    {matchingProducts.slice(0, activeTab === 'products' ? 12 : 5).map((product) => {
                      const itemNavIndex = navigationItems.findIndex((item) => item.id === product.id);
                      const isKeyboardSelected = itemNavIndex === selectedIndex;

                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            saveRecentSearch(product.name);
                            setIsOpen(false);
                            if (onCloseMobile) onCloseMobile();
                            navigateTo('product-detail', product.slug);
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-colors ${
                            isKeyboardSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-12 h-12 object-contain rounded-lg bg-slate-100 p-1 flex-shrink-0 border border-slate-200/80"
                          />

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="text-xs font-extrabold text-slate-900 line-clamp-1">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-bold text-slate-700">{product.brand}</span>
                              {product.sku && <span>• SKU: {product.sku}</span>}
                              <span className="capitalize text-slate-400">• {product.subcategory || product.category}</span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 space-y-0.5">
                            <div className="text-xs font-black text-[#0056b3]">
                              NPR {product.sellingPrice.toLocaleString()}
                            </div>
                            {product.inStock ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 inline-block">
                                In Stock
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 inline-block">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SECTION: CATEGORIES */}
                {(activeTab === 'all' || activeTab === 'categories') && matchingCategories.length > 0 && (
                  <div className="py-2 space-y-1">
                    <div className="px-3 py-1 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0056b3]" />
                      <span>Categories</span>
                    </div>

                    {matchingCategories.slice(0, activeTab === 'categories' ? 8 : 3).map((category) => {
                      const itemNavIndex = navigationItems.findIndex((item) => item.id === category.id);
                      const isKeyboardSelected = itemNavIndex === selectedIndex;

                      return (
                        <div
                          key={category.id}
                          onClick={() => {
                            saveRecentSearch(category.name);
                            setIsOpen(false);
                            if (onCloseMobile) onCloseMobile();
                            navigateTo('shop');
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                            isKeyboardSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0056b3] flex items-center justify-center font-bold flex-shrink-0 border border-blue-100">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-slate-900">{category.name}</div>
                              <div className="text-[10px] text-slate-500 line-clamp-1">
                                {category.subcategories.slice(0, 3).join(', ')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {category.productCount || '40+'} items
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SECTION: TECHNICAL SERVICES */}
                {(activeTab === 'all' || activeTab === 'services') && matchingServices.length > 0 && (
                  <div className="py-2 space-y-1">
                    <div className="px-3 py-1 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-500" />
                      <span>Technical Repair Services &amp; AMC</span>
                    </div>

                    {matchingServices.map((service) => {
                      const itemNavIndex = navigationItems.findIndex((item) => item.id === service.id);
                      const isKeyboardSelected = itemNavIndex === selectedIndex;

                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            saveRecentSearch(service.title);
                            setIsOpen(false);
                            if (onCloseMobile) onCloseMobile();
                            setIsServiceModalOpen(true);
                          }}
                          className={`p-3 rounded-xl cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors border ${
                            isKeyboardSelected ? 'bg-amber-50 border-amber-300' : 'bg-slate-50/60 border-slate-200/80 hover:bg-amber-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-900 flex items-center justify-center font-bold flex-shrink-0 mt-0.5 sm:mt-0">
                              {getServiceIcon(service.icon)}
                            </div>

                            <div className="space-y-0.5 min-w-0">
                              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                <span>{service.title}</span>
                                <span className="bg-blue-100 text-blue-900 text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                  Service Center
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-1">{service.description}</p>
                              
                              <div className="flex flex-wrap gap-1 pt-1">
                                {service.features.slice(0, 2).map((feat, idx) => (
                                  <span key={idx} className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                                    ✓ {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              saveRecentSearch(service.title);
                              setIsOpen(false);
                              if (onCloseMobile) onCloseMobile();
                              setIsServiceModalOpen(true);
                            }}
                            className="w-full sm:w-auto bg-[#0056b3] hover:bg-[#004494] text-white text-[10px] font-extrabold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 flex-shrink-0 shadow-xs"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Book Service</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Popover Footer bar */}
              <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  className="font-extrabold text-[#0056b3] hover:text-[#004494] flex items-center gap-1 transition-colors"
                >
                  <span>View All {totalResultsCount} Results in Shop</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  Press <kbd className="font-mono bg-white border border-gray-200 px-1 rounded">↵ Enter</kbd> to search
                </span>
              </div>
            </div>
          )}

          {/* STATE 2: ACTIVE QUERY HAS NO MATCHES */}
          {cleanQuery && totalResultsCount === 0 && (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-900">
                  No matches found for &quot;{searchQuery}&quot;
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try checking spelling, searching brand names (Dell, Epson, Hikvision), or explore technical services.
                </p>
              </div>

              {/* AI & Service Fallback CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onCloseMobile) onCloseMobile();
                    setIsAiAssistantOpen(true);
                  }}
                  className="w-full sm:w-auto bg-[#0056b3] hover:bg-[#004494] text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ask AI Advisor for &quot;{searchQuery}&quot;</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onCloseMobile) onCloseMobile();
                    setIsServiceModalOpen(true);
                  }}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                >
                  <Wrench className="w-3.5 h-3.5 text-blue-600" />
                  <span>Request Custom Service Quote</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: DEFAULT / EMPTY SEARCH QUERY (ON FOCUS) */}
          {!cleanQuery && (
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
              
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 lowercase text-[10px]"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => executePillSearch(term)}
                        className="bg-slate-100 hover:bg-blue-50 hover:text-[#0056b3] hover:border-blue-200 border border-slate-200/80 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Store Searches */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5 text-[#0056b3]" />
                  <span>Trending Searches in Store</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_SEARCHES.map((term, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => executePillSearch(term)}
                      className="bg-blue-50/60 hover:bg-[#0056b3] hover:text-white border border-blue-100 text-[#0056b3] text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Categories & Services Shortcuts */}
              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onCloseMobile) onCloseMobile();
                    navigateTo('shop');
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#0056b3] rounded-xl border border-slate-200/80 transition-colors text-left flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-[#0056b3]" />
                  <span>Browse Shop Catalog</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onCloseMobile) onCloseMobile();
                    setIsServiceModalOpen(true);
                  }}
                  className="p-2.5 bg-amber-50/80 hover:bg-amber-100 text-amber-900 rounded-xl border border-amber-200/80 transition-colors text-left flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4 text-amber-700" />
                  <span>Book Repair Service</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
