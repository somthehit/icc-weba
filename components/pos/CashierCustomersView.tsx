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
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8faf9] dark:bg-[#0c120f] overflow-hidden p-6 space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141a17] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
              Customer Ledger &amp; Khata
            </span>
            <span className="text-xs font-bold text-slate-400">
              {customers.length} registered buyers
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1 tracking-tight">
            Customer Directory
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Search customer records, view purchase history &amp; credit status, and attach them to active checkout.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
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
            className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141a17] text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition shadow-2xs"
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
          className="p-2.5 rounded-2xl bg-white dark:bg-[#141a17] border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 transition"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 3. Walk-in Customer Quick Selector */}
      <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
            W
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">Walk-in Customer</h4>
            <p className="text-[11px] text-slate-500">Standard retail cash memo (No tax PAN or account required)</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleAttachCustomer({ name: 'Walk-in Customer', phone: '', pan: '' })}
          className="px-3 py-1.5 rounded-xl bg-[#00c569] hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>Use Walk-in</span>
        </button>
      </div>

      {/* 4. Customers List Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
        {loading && customers.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Loading customer records...
          </div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-20 text-center text-xs text-slate-400">
            No customer accounts found. Click &quot;New Customer&quot; above to create one.
          </div>
        ) : (
          customers.map((cust) => (
            <div
              key={cust.id}
              className="p-4 rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-500 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {cust.name}
                    </h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      {cust.phone || 'No phone'}
                    </span>
                  </div>

                  {cust.isVip && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-[9px] font-black uppercase tracking-wider border border-purple-200 shrink-0">
                      VIP Client
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Orders</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cust.orderCount} Bills</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Spend</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Rs. {formatNepaliNumber(String(cust.lifetimeSpend))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleAttachCustomer({ name: cust.name, phone: cust.phone, pan: cust.pan })}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-[#00c569] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setIsRegisterOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#141a17] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
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
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Shrestha / Himalayan Tech"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Mobile Number (Nepal 10 Digits)
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  maxLength={10}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Buyer PAN (For IRD Nepal VAT Bill)
                </label>
                <input
                  type="text"
                  value={newPan}
                  onChange={(e) => setNewPan(e.target.value)}
                  placeholder="9-digit PAN number"
                  maxLength={9}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="flex-1 py-2.5 rounded-2xl bg-[#00c569] hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-1.5"
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
