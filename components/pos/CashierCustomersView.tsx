'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  FileText,
  ShoppingBag,
  CheckCircle2,
  X,
  CreditCard,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { formatNepaliNumber } from '@/lib/nepal/money';

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  pan?: string;
  orderCount: number;
  lifetimeSpend: number;
  lastOrderAt?: string | null;
  isVip?: boolean;
  membershipNumber?: string;
  membershipLevel?: string;
  badgeColor?: string;
  icon?: string;
  availableCoins?: number;
  qualifyingSpend?: number;
}

interface CashierCustomersViewProps {
  theme: 'dark' | 'light';
  onSelectCustomer: (customer: { name: string; phone: string; pan?: string }) => void;
  onSwitchToSales: () => void;
}

export default function CashierCustomersView({
  theme,
  onSelectCustomer,
  onSwitchToSales,
}: CashierCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // New Customer Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPan, setNewPan] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCustomers = async (searchQuery = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/customers?search=${encodeURIComponent(searchQuery)}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.customers) {
          setCustomers(data.customers);
        }
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(search);
  }, [search]);

  const handleAttachCustomer = (c: { name: string; phone: string; pan?: string }) => {
    onSelectCustomer(c);
    onSwitchToSales();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) {
      setFormError('Customer name is required.');
      return;
    }

    setSubmittingNew(true);
    try {
      const res = await fetch('/api/pos/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          pan: newPan.trim(),
          email: newEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register customer.');
      }

      // Attach customer and close modal
      handleAttachCustomer({
        name: data.customer.name,
        phone: data.customer.phone || '',
        pan: data.customer.pan || '',
      });
      setIsRegisterOpen(false);
      setNewName('');
      setNewPhone('');
      setNewPan('');
      setNewEmail('');
    } catch (err: any) {
      setFormError(err.message || 'Error creating customer');
    } finally {
      setSubmittingNew(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 overflow-hidden p-6 space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-300">
              Customer Ledger &amp; Khata
            </span>
            <span className="text-xs font-bold text-slate-500">
              {customers.length} registered buyers
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Search customer records, view purchase history &amp; credit status, and attach them to active checkout.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, 10-digit mobile, or email..."
            className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-2xs"
          />
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => fetchCustomers(search)}
          className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 3. Walk-in Customer Quick Selector */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
            W
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">Walk-In Customer</h4>
            <p className="text-[11px] text-slate-600 font-medium">Standard retail cash memo (No tax PAN or account required)</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleAttachCustomer({ name: 'Walk-in Customer', phone: '' })}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
        >
          <span>Use Walk-In</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4. Customer Cards Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
        {customers.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-500 font-medium bg-white rounded-3xl border border-dashed border-slate-200">
            No customer accounts found. Click &quot;New Customer&quot; above to create one.
          </div>
        ) : (
          customers.map((cust) => (
            <div
              key={cust.id}
              className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-500 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {cust.name}
                    </h4>
                    <span className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5 font-mono font-bold">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      {cust.phone || 'No phone'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {cust.membershipLevel && (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                          cust.badgeColor === 'amber'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : cust.badgeColor === 'slate-silver'
                            ? 'bg-slate-800 text-white border-slate-900'
                            : cust.badgeColor === 'emerald'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {cust.icon || '⭐'} {cust.membershipLevel}
                      </span>
                    )}
                    {cust.isVip && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[9px] font-black uppercase tracking-wider border border-purple-300 shrink-0">
                        VIP
                      </span>
                    )}
                  </div>
                </div>

                {cust.membershipNumber && (
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 font-bold">ID: {cust.membershipNumber}</span>
                    <span className="font-black text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      🪙 {(cust.availableCoins || 0).toLocaleString('en-IN')} Coins
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px]">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Orders</span>
                    <span className="font-black text-slate-900 text-xs">{cust.orderCount} Bills</span>
                  </div>
                  <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-800 block font-bold uppercase tracking-wider">Total Spend</span>
                    <span className="font-mono font-black text-emerald-800 text-xs">
                      Rs. {formatNepaliNumber(String(cust.lifetimeSpend))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleAttachCustomer({ name: cust.name, phone: cust.phone, pan: cust.pan })}
                  className="w-full py-2.5 rounded-xl bg-[#00c569] hover:bg-emerald-600 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Attach to Sale</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 5. Register New Customer Modal */}
      {isRegisterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setIsRegisterOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Register New Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Shrestha / Himalayan Tech"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Mobile Number (Nepal 10 Digits)
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  maxLength={10}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Buyer PAN (For IRD Nepal VAT Bill)
                </label>
                <input
                  type="text"
                  value={newPan}
                  onChange={(e) => setNewPan(e.target.value)}
                  placeholder="9-digit PAN number"
                  maxLength={9}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="flex-1 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                >
                  {submittingNew ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Save &amp; Attach</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
