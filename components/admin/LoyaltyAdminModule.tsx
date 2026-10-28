// components/admin/LoyaltyAdminModule.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Coins,
  Users,
  Tag,
  BarChart3,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  Sliders,
  DollarSign,
  Gift,
  Merge,
  History,
} from 'lucide-react';
import { formatNepaliNumber } from '@/lib/nepal/money';

export function LoyaltyAdminModule() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'levels' | 'customers' | 'offers' | 'reports'>('dashboard');

  // Dashboard Stats State
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Levels State
  const [levels, setLevels] = useState<any[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any | null>(null);
  const [levelForm, setLevelForm] = useState({
    id: '',
    name: '',
    description: '',
    displayOrder: 1,
    badgeColor: 'slate',
    icon: '⭐',
    qualifyingSpendThreshold: '0',
    pointsEarningRate: '1.0',
    redemptionConversionRate: '1.0',
    minRedemptionPoints: 50,
    maxRedemptionPercentage: '50',
    maxRedemptionPointsPerTx: 5000,
    minPayableAfterRedemption: '50',
    levelDiscountPercentage: '0',
    isAutomaticUpgrade: true,
    isVipSpecial: false,
    isActive: true,
  });

  // Customers & Ledger State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerLedger, setCustomerLedger] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Manual Adjustment Modal
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjPoints, setAdjPoints] = useState('');
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit');
  const [adjReason, setAdjReason] = useState('');
  const [submittingAdj, setSubmittingAdj] = useState(false);

  // Manual Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideLevelId, setOverrideLevelId] = useState('happy_customer');
  const [overrideReason, setOverrideReason] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Customer Merge Modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [secondaryCustomerId, setSecondaryCustomerId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [submittingMerge, setSubmittingMerge] = useState(false);

  // Offers State
  const [offers, setOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({
    id: '',
    code: '',
    title: '',
    description: '',
    offerType: 'percentage_discount',
    offerValue: '10',
    eligibleLevels: ['silver', 'gold', 'platinum', 'happy_customer'],
    minSpend: '1000',
    maxDiscountCap: '500',
    usageLimitPerCustomer: 1,
    isActive: true,
  });

  // Reports State
  const [reportsData, setReportsData] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Expiry State
  const [expirySummary, setExpirySummary] = useState<any>(null);
  const [loadingExpiry, setLoadingExpiry] = useState(false);
  const [runningExpiry, setRunningExpiry] = useState(false);

  // Notification Banner
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Loaders
  const loadDashboard = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/loyalty/dashboard');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadExpirySummary = async () => {
    setLoadingExpiry(true);
    try {
      const res = await fetch('/api/admin/loyalty/expiry');
      const data = await res.json();
      if (data.success) setExpirySummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExpiry(false);
    }
  };

  const handleRunExpiry = async () => {
    if (!confirm('Are you sure you want to run the automated batch points expiry engine? This will expire all coins past their validity period and write immutable ledger records.')) return;
    setRunningExpiry(true);
    try {
      const res = await fetch('/api/admin/loyalty/expiry', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        loadExpirySummary();
        loadDashboard();
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    } finally {
      setRunningExpiry(false);
    }
  };

  const handleDeleteOffer = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to soft-delete offer "${code}"? It will be archived safely without deleting past redemption audit history.`)) return;
    try {
      const res = await fetch(`/api/admin/loyalty/offers?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        loadOffers();
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    }
  };

  const loadLevels = async () => {
    setLoadingLevels(true);
    try {
      const res = await fetch('/api/admin/loyalty/levels');
      const data = await res.json();
      if (data.success) setLevels(data.levels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLevels(false);
    }
  };

  const loadOffers = async () => {
    setLoadingOffers(true);
    try {
      const res = await fetch('/api/admin/loyalty/offers');
      const data = await res.json();
      if (data.success) setOffers(data.offers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOffers(false);
    }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/admin/loyalty/reports');
      const data = await res.json();
      if (data.success) setReportsData(data.report);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  const searchCustomers = async (q: string) => {
    setLoadingCustomers(true);
    try {
      const res = await fetch(`/api/pos/customers?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      if (data.success) setCustomerResults(data.customers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadCustomerLedger = async (customerId: string) => {
    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/admin/loyalty/ledger?customerId=${customerId}`);
      const data = await res.json();
      if (data.success) setCustomerLedger(data.ledger || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadExpirySummary();
    loadLevels();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
      loadExpirySummary();
    }
    if (activeTab === 'levels') loadLevels();
    if (activeTab === 'customers' && customerResults.length === 0) searchCustomers('');
    if (activeTab === 'offers') loadOffers();
    if (activeTab === 'reports') loadReports();
  }, [activeTab]);

  // Handlers
  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/loyalty/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(levelForm),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        setEditingLevel(null);
        loadLevels();
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/loyalty/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        setIsOfferModalOpen(false);
        loadOffers();
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    }
  };

  const handleManualAdjustment = async () => {
    if (!selectedCustomer) return;
    setSubmittingAdj(true);
    try {
      const res = await fetch('/api/admin/loyalty/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          points: Number(adjPoints),
          type: adjType,
          reason: adjReason,
          operatorName: 'Admin Supervisor',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        setIsAdjModalOpen(false);
        setAdjPoints('');
        setAdjReason('');
        loadCustomerLedger(selectedCustomer.id);
        searchCustomers(customerSearch);
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    } finally {
      setSubmittingAdj(false);
    }
  };

  const handleManualOverride = async () => {
    if (!selectedCustomer) return;
    setSubmittingOverride(true);
    try {
      const res = await fetch('/api/admin/loyalty/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          newLevelId: overrideLevelId,
          reason: overrideReason,
          operatorName: 'Admin Supervisor',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        setIsOverrideModalOpen(false);
        setOverrideReason('');
        searchCustomers(customerSearch);
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleCustomerMerge = async () => {
    if (!selectedCustomer || !secondaryCustomerId) return;
    setSubmittingMerge(true);
    try {
      const res = await fetch('/api/admin/loyalty/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryCustomerId: selectedCustomer.id,
          secondaryCustomerId,
          reason: mergeReason,
          operatorName: 'Admin Supervisor',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ message: data.message, type: 'success' });
        setIsMergeModalOpen(false);
        setMergeReason('');
        setSecondaryCustomerId('');
        searchCustomers(customerSearch);
      } else {
        setNotice({ message: data.error, type: 'error' });
      }
    } catch (err: any) {
      setNotice({ message: err.message, type: 'error' });
    } finally {
      setSubmittingMerge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {notice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition shadow-xs ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />}
            <span>{notice.message}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main Header & Sub-Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-inner">
            <Award className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Customer Loyalty &amp; Memberships
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Tiers, Shopping Coins Engine, Audit Ledger &amp; Promotional Offers
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {[
            { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
            { id: 'levels' as const, label: 'Tiers & Levels', icon: Layers },
            { id: 'customers' as const, label: 'Members & Ledger', icon: Users },
            { id: 'offers' as const, label: 'Offers & Promos', icon: Tag },
            { id: 'reports' as const, label: 'Reports', icon: TrendingUp },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition select-none ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: DASHBOARD                                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Registered Members</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {stats?.totalMembers?.toLocaleString('en-IN') || 0}
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Silver Default
                </span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Points Liability (NPR)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-500 font-mono">
                  NPR {stats?.availableCoinsLiability?.toLocaleString('en-IN') || 0}
                </span>
                <span className="text-xs text-slate-400 font-bold">1 Coin = 1 NPR</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Coins Earned</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 font-mono">
                  {stats?.totalEarnedCoins?.toLocaleString('en-IN') || 0}
                </span>
                <span className="text-xs text-slate-400 font-medium">All Time</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Coins Redeemed</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-600 font-mono">
                  {stats?.totalRedeemedCoins?.toLocaleString('en-IN') || 0}
                </span>
                <span className="text-xs text-slate-400 font-medium">Claimed Savings</span>
              </div>
            </div>
          </div>

          {/* Points Validity & Batch Expiry Health Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  Automated Points Expiry &amp; FIFO Health
                </span>
              </div>
              <h4 className="text-base font-black">
                {expirySummary?.overdueCount > 0 ? (
                  <span className="text-rose-400">
                    ⚠️ {Number(expirySummary?.overduePoints || 0).toLocaleString('en-IN')} Overdue Coins Ready to Expire ({expirySummary?.overdueCustomers} members)
                  </span>
                ) : (
                  <span className="text-emerald-300">
                    ✓ All customer shopping coins are current and valid within active period
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-300">
                Next 30 Days: {Number(expirySummary?.expiringNext30DaysPoints || 0).toLocaleString('en-IN')} coins approaching validity threshold across {expirySummary?.expiringNext30DaysCustomers || 0} members.
              </p>
            </div>
            <button
              type="button"
              disabled={runningExpiry}
              onClick={handleRunExpiry}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${runningExpiry ? 'animate-spin' : ''}`} />
              <span>{runningExpiry ? 'Processing Expiry...' : 'Run Batch Expiry Engine'}</span>
            </button>
          </div>

          {/* Membership Tier Breakdown Cards */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Membership Level Distribution
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(stats?.tierCounts || []).map((t: any) => (
                <div
                  key={t.levelId}
                  className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {t.icon} {t.levelName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {t.count} Members
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Total Spend: NPR {t.totalSpend?.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Members & Recent Ledger Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Members */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Top Members by Qualifying Spend
              </h4>
              <div className="space-y-2.5">
                {(stats?.topMembers || []).map((m: any, idx: number) => (
                  <div
                    key={m.customerId}
                    className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 font-black text-[11px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <div>
                        <h5 className="font-black text-slate-900 dark:text-white">{m.customerName}</h5>
                        <p className="text-[10px] text-slate-500 font-mono">{m.phone || m.membershipNumber}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-emerald-600 block">
                        Rs. {Number(m.qualifyingSpend || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-amber-500 font-bold">
                        🪙 {Number(m.availableCoins || 0).toLocaleString('en-IN')} Coins
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Ledger Activity */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Recent Loyalty Ledger Transactions
              </h4>
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {(stats?.recentActivity || []).map((act: any) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                            act.entryType === 'earned'
                              ? 'bg-emerald-100 text-emerald-800'
                              : act.entryType === 'redeemed'
                              ? 'bg-amber-100 text-amber-800'
                              : act.entryType === 'reversed'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {act.entryType}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                          {act.customerName}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[240px]">{act.reason}</p>
                    </div>

                    <div className="text-right font-mono font-bold shrink-0">
                      {Number(act.pointsCredited) > 0 ? (
                        <span className="text-emerald-600">+{act.pointsCredited} pts</span>
                      ) : (
                        <span className="text-amber-600">-{act.pointsDebited} pts</span>
                      )}
                      <span className="block text-[9px] text-slate-400 font-normal">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MEMBERSHIP LEVELS CONFIGURATION                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'levels' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium max-w-xl">
              Configure qualification thresholds, earning rates, coin redemption caps, and exclusive level discounts.
              New customers automatically enroll in the default Silver level.
            </p>
            <button
              type="button"
              onClick={() => {
                setLevelForm({
                  id: '',
                  name: '',
                  description: '',
                  displayOrder: levels.length + 1,
                  badgeColor: 'slate',
                  icon: '⭐',
                  qualifyingSpendThreshold: '10000',
                  pointsEarningRate: '1.0',
                  redemptionConversionRate: '1.0',
                  minRedemptionPoints: 50,
                  maxRedemptionPercentage: '50',
                  maxRedemptionPointsPerTx: 5000,
                  minPayableAfterRedemption: '50',
                  levelDiscountPercentage: '0',
                  isAutomaticUpgrade: true,
                  isVipSpecial: false,
                  isActive: true,
                });
                setEditingLevel('new');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create Custom Tier</span>
            </button>
          </div>

          {/* Level Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {levels.map((lvl) => (
              <div
                key={lvl.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{lvl.icon}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        lvl.badgeColor === 'amber'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : lvl.badgeColor === 'slate-silver'
                          ? 'bg-slate-200 text-slate-800 border-slate-400'
                          : lvl.badgeColor === 'emerald'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {lvl.badgeColor}
                    </span>
                  </div>

                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-2">{lvl.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{lvl.description}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Qualifying Spend:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        NPR {Number(lvl.qualifyingSpendThreshold).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Earning Rate:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {lvl.pointsEarningRate} pts / NPR 100
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Exclusive Discount:</span>
                      <span className="font-mono font-bold text-purple-600">
                        {lvl.levelDiscountPercentage}% off
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Redeem %:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {lvl.maxRedemptionPercentage}% of bill
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLevelForm({
                      ...lvl,
                      qualifyingSpendThreshold: String(lvl.qualifyingSpendThreshold),
                      pointsEarningRate: String(lvl.pointsEarningRate),
                      redemptionConversionRate: String(lvl.redemptionConversionRate),
                      maxRedemptionPercentage: String(lvl.maxRedemptionPercentage),
                      minPayableAfterRedemption: String(lvl.minPayableAfterRedemption),
                      levelDiscountPercentage: String(lvl.levelDiscountPercentage),
                    });
                    setEditingLevel(lvl.id);
                  }}
                  className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Edit Configuration</span>
                </button>
              </div>
            ))}
          </div>

          {/* Edit Tier Drawer / Modal */}
          {editingLevel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
              <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#141a17] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {editingLevel === 'new' ? 'Create Membership Tier' : `Configure ${levelForm.name} Tier`}
                  </h3>
                  <button type="button" onClick={() => setEditingLevel(null)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveLevel} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Level ID (Slug)</label>
                      <input
                        type="text"
                        disabled={editingLevel !== 'new'}
                        value={levelForm.id}
                        onChange={(e) => setLevelForm({ ...levelForm, id: e.target.value })}
                        placeholder="e.g. titanium"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={levelForm.name}
                        onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                        placeholder="e.g. Titanium VIP"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Badge Color</label>
                      <select
                        value={levelForm.badgeColor}
                        onChange={(e) => setLevelForm({ ...levelForm, badgeColor: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                      >
                        <option value="slate">Slate (Silver)</option>
                        <option value="amber">Amber (Gold)</option>
                        <option value="slate-silver">Slate-Silver (Platinum)</option>
                        <option value="emerald">Emerald (VIP Happy Customer)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Icon Emoji</label>
                      <input
                        type="text"
                        value={levelForm.icon}
                        onChange={(e) => setLevelForm({ ...levelForm, icon: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={levelForm.displayOrder}
                        onChange={(e) => setLevelForm({ ...levelForm, displayOrder: parseInt(e.target.value, 10) || 1 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Qualifying Spend (NPR)</label>
                      <input
                        type="number"
                        value={levelForm.qualifyingSpendThreshold}
                        onChange={(e) => setLevelForm({ ...levelForm, qualifyingSpendThreshold: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Points Earning Rate (per 100 NPR)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={levelForm.pointsEarningRate}
                        onChange={(e) => setLevelForm({ ...levelForm, pointsEarningRate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Max Redeem % of Bill</label>
                      <input
                        type="number"
                        value={levelForm.maxRedemptionPercentage}
                        onChange={(e) => setLevelForm({ ...levelForm, maxRedemptionPercentage: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Min Balance to Redeem</label>
                      <input
                        type="number"
                        value={levelForm.minRedemptionPoints}
                        onChange={(e) => setLevelForm({ ...levelForm, minRedemptionPoints: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Level Discount (%)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={levelForm.levelDiscountPercentage}
                        onChange={(e) => setLevelForm({ ...levelForm, levelDiscountPercentage: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingLevel(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md"
                    >
                      Save Configuration
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: CUSTOMERS & LEDGER                                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  searchCustomers(e.target.value);
                }}
                placeholder="Search member by Name, Phone, or Membership Number..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141a17] text-xs font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => searchCustomers(customerSearch)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
            >
              Search
            </button>
          </div>

          {/* Members Table */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#141a17] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Membership ID</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Available Coins</th>
                    <th className="px-4 py-3">Qualifying Spend</th>
                    <th className="px-4 py-3">Lifetime Spend</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerResults.map((c) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/60 transition ${
                        selectedCustomer?.id === c.id ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-black text-slate-900 dark:text-white block">{c.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.phone || c.email}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {c.membershipNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            c.badgeColor === 'amber'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : c.badgeColor === 'slate-silver'
                              ? 'bg-slate-200 text-slate-800 border-slate-400'
                              : c.badgeColor === 'emerald'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {c.icon || '⭐'} {c.membershipLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-amber-500">
                        🪙 {(c.availableCoins || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        Rs. {(c.qualifyingSpend || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                        Rs. {(c.lifetimeSpend || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              loadCustomerLedger(c.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold"
                          >
                            Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsAdjModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold"
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsOverrideModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold"
                          >
                            Override
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsMergeModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-[10px] font-bold"
                            title="Merge Accounts"
                          >
                            <Merge className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Immutable Points Ledger Audit */}
          {selectedCustomer && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Immutable Loyalty Ledger: {selectedCustomer.name} ({selectedCustomer.membershipNumber})
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Available Balance: {selectedCustomer.availableCoins} coins • Qualifying Spend: Rs.{' '}
                    {selectedCustomer.qualifyingSpend}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  Close Ledger
                </button>
              </div>

              {loadingLedger ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading immutable ledger...</div>
              ) : customerLedger.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No ledger transactions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Entry Type</th>
                        <th className="px-3 py-2">Invoice / Order #</th>
                        <th className="px-3 py-2">Credit</th>
                        <th className="px-3 py-2">Debit</th>
                        <th className="px-3 py-2">Balance After</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {customerLedger.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-slate-400">
                            {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.2 rounded font-black uppercase text-[9px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {row.entryType}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-bold">{row.orderNumber || '-'}</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">
                            {Number(row.pointsCredited) > 0 ? `+${row.pointsCredited}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-amber-600 font-bold">
                            {Number(row.pointsDebited) > 0 ? `-${row.pointsDebited}` : '-'}
                          </td>
                          <td className="px-3 py-2 font-black">{row.balanceAfter}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                            {row.reason}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{row.operatorName || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modal: Manual Points Adjustment */}
          {isAdjModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141a17] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Manual Point Adjustment: {selectedCustomer.name}
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Adjustment Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjType('credit')}
                        className={`flex-1 py-2 rounded-xl font-bold transition ${
                          adjType === 'credit' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        + Credit Coins
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjType('debit')}
                        className={`flex-1 py-2 rounded-xl font-bold transition ${
                          adjType === 'debit' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        - Debit Coins
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Points Amount</label>
                    <input
                      type="number"
                      min="1"
                      value={adjPoints}
                      onChange={(e) => setAdjPoints(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Mandatory Audit Reason
                    </label>
                    <textarea
                      rows={2}
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      placeholder="Explain why points are being adjusted..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAdjModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingAdj || !adjPoints || !adjReason}
                    onClick={handleManualAdjustment}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md disabled:opacity-40"
                  >
                    {submittingAdj ? 'Adjusting...' : 'Commit Adjustment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Manual Level Override */}
          {isOverrideModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141a17] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Manual Level Override: {selectedCustomer.name}
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">New Membership Tier</label>
                    <select
                      value={overrideLevelId}
                      onChange={(e) => setOverrideLevelId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                    >
                      {levels.map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          {lvl.name} {lvl.isVipSpecial ? '(VIP Special)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Mandatory Override Reason
                    </label>
                    <textarea
                      rows={2}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. VIP designation by Managing Director..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsOverrideModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingOverride || !overrideReason}
                    onClick={handleManualOverride}
                    className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black shadow-md disabled:opacity-40"
                  >
                    {submittingOverride ? 'Saving...' : 'Set Tier Override'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Customer Merge */}
          {isMergeModalOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141a17] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Merge Duplicate Customer Accounts
                </h3>
                <p className="text-[11px] text-slate-500">
                  Primary Profile (Keep): <span className="font-bold text-slate-900 dark:text-white">{selectedCustomer.name} ({selectedCustomer.membershipNumber})</span>
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Select Secondary Customer Account to Merge
                    </label>
                    <select
                      value={secondaryCustomerId}
                      onChange={(e) => setSecondaryCustomerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                    >
                      <option value="">-- Choose Account --</option>
                      {customerResults
                        .filter((c) => c.id !== selectedCustomer.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone || c.email}) - {c.availableCoins} coins
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Audit Reason for Account Merge
                    </label>
                    <textarea
                      rows={2}
                      value={mergeReason}
                      onChange={(e) => setMergeReason(e.target.value)}
                      placeholder="e.g. Duplicate customer registered with alternate mobile number..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsMergeModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingMerge || !secondaryCustomerId || !mergeReason}
                    onClick={handleCustomerMerge}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-md disabled:opacity-40"
                  >
                    {submittingMerge ? 'Merging...' : 'Execute Merge'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: OFFERS & PROMOTIONS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium max-w-xl">
              Create member-exclusive percentage discounts, fixed-amount cash discounts, and bonus shopping coin offers.
            </p>
            <button
              type="button"
              onClick={() => {
                setOfferForm({
                  id: '',
                  code: '',
                  title: '',
                  description: '',
                  offerType: 'percentage_discount',
                  offerValue: '10',
                  eligibleLevels: ['silver', 'gold', 'platinum', 'happy_customer'],
                  minSpend: '1000',
                  maxDiscountCap: '500',
                  usageLimitPerCustomer: 1,
                  isActive: true,
                });
                setIsOfferModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>New Promotional Offer</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((off) => (
              <div
                key={off.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                    {off.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      off.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {off.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{off.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{off.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offer Type:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {off.offerType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Value:</span>
                    <span className="font-bold text-emerald-600">
                      {off.offerType === 'percentage_discount'
                        ? `${off.offerValue}%`
                        : off.offerType === 'bonus_coins'
                        ? `+${off.offerValue} Coins`
                        : `NPR ${off.offerValue}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Order Spend:</span>
                    <span className="font-bold">NPR {Number(off.minSpend).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Redeemed:</span>
                    <span className="font-bold text-purple-600">{off.usedCount} times</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOfferForm({
                        ...off,
                        offerValue: String(off.offerValue),
                        minSpend: String(off.minSpend),
                        maxDiscountCap: off.maxDiscountCap ? String(off.maxDiscountCap) : '',
                      });
                      setIsOfferModalOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Edit Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOffer(off.id, off.code)}
                    className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition"
                    title="Soft delete offer safely"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Offer Modal */}
          {isOfferModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
              <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#141a17] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {offerForm.id ? `Edit Offer: ${offerForm.code}` : 'Create New Offer'}
                  </h3>
                  <button type="button" onClick={() => setIsOfferModalOpen(false)} className="text-slate-400 hover:text-white">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveOffer} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Coupon Code</label>
                      <input
                        type="text"
                        value={offerForm.code}
                        onChange={(e) => setOfferForm({ ...offerForm, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. VIPFEST5"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-mono font-bold outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={offerForm.title}
                        onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                        placeholder="e.g. 5% Festive Reward"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={offerForm.description}
                      onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                      placeholder="Offer terms shown on receipt..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Offer Type</label>
                      <select
                        value={offerForm.offerType}
                        onChange={(e) => setOfferForm({ ...offerForm, offerType: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none"
                      >
                        <option value="percentage_discount">Percentage Discount (%)</option>
                        <option value="fixed_discount">Fixed Cash Discount (NPR)</option>
                        <option value="bonus_coins">Bonus Shopping Coins</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Offer Value</label>
                      <input
                        type="number"
                        step="0.5"
                        value={offerForm.offerValue}
                        onChange={(e) => setOfferForm({ ...offerForm, offerValue: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Min Spend (NPR)</label>
                      <input
                        type="number"
                        value={offerForm.minSpend}
                        onChange={(e) => setOfferForm({ ...offerForm, minSpend: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Max Discount Cap (NPR)</label>
                      <input
                        type="number"
                        value={offerForm.maxDiscountCap}
                        onChange={(e) => setOfferForm({ ...offerForm, maxDiscountCap: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent font-bold outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsOfferModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-md"
                    >
                      Save Offer
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: REPORTS & AUDIT                                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Points Breakdown by Action */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Points Ledger Summary by Transaction Type
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              {(reportsData?.pointsByType || []).map((p: any) => (
                <div
                  key={p.entryType}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1"
                >
                  <span className="text-[10px] font-black uppercase text-slate-400 block">{p.entryType}</span>
                  <div className="text-base font-black">
                    {Number(p.totalCredited) > 0 ? (
                      <span className="text-emerald-600">+{p.totalCredited.toLocaleString('en-IN')} pts</span>
                    ) : (
                      <span className="text-amber-600">-{p.totalDebited.toLocaleString('en-IN')} pts</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block">{p.txCount} transactions</span>
                </div>
              ))}
            </div>
          </div>

          {/* Offer Performance Report */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Promotional Offer Performance &amp; Discount Expenditure
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Times Used</th>
                    <th className="px-4 py-3">Total Discount Funded</th>
                    <th className="px-4 py-3">Bonus Coins Granted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(reportsData?.offerPerformance || []).map((o: any) => (
                    <tr key={o.offerId}>
                      <td className="px-4 py-3 font-black text-emerald-600">{o.code}</td>
                      <td className="px-4 py-3 font-sans font-bold">{o.title}</td>
                      <td className="px-4 py-3">{o.usedCount} redemptions</td>
                      <td className="px-4 py-3 text-emerald-600 font-bold">
                        NPR {Number(o.totalDiscountGiven).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-amber-500 font-bold">
                        🪙 {Number(o.totalBonusPointsAwarded).toLocaleString('en-IN')} Coins
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default LoyaltyAdminModule;
