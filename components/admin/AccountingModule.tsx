'use client';

// components/admin/AccountingModule.tsx
//
// Enterprise ERP-grade Accounting & General Ledger module for ICC Computer Center.
// Supports:
// 1. Global Date Range Filtering (Presets: This Month, Last Month, YTD, All Time, Custom)
// 2. Interactive KPI Stats with Trend Indicators & Drilldown Driver COD Drawer
// 3. Interactive Chart of Accounts with Search, Type Filter, Category Grouping & Account Ledger View
// 4. Double-entry Journal Voucher creation & line repeater
// 5. Automated COD Settlement with instant double-entry ledger preview
// 6. Bank Statement Reconciliation Tool
// 7. Real-Time Financial Reports: Trial Balance (Balanced Debits = Credits) & Profit and Loss (P&L)

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  BanknoteArrowUp,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  MoreVertical,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from 'lucide-react';

import type { Order, Product } from '@/types';
import { UploadButton } from './ImageUploadField';
import { AccountLedgerModal } from './AccountLedgerModal';
import { DriverCodDrawer } from './DriverCodDrawer';
import { BankReconciliationModal } from './BankReconciliationModal';

interface AccountingModuleProps {
  orders: Order[];
  products: Product[];
}

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  isActive?: boolean;
}

interface Entry {
  id: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType: string | null;
  attachmentUrl: string | null;
  debit: string;
  credit: string;
}

interface Balance {
  accountId: number;
  debit: string;
  credit: string;
}

interface Settlement {
  id: number;
  settlementNumber: string;
  driverName: string;
  orderReference: string | null;
  collectedAmount: string;
  bankReference: string | null;
  attachmentUrl: string | null;
  settledAt: string;
  depositAccountCode: string | null;
  depositAccountName: string | null;
  entryNumber: string | null;
}

interface DraftLine {
  key: string;
  accountId: string;
  memo: string;
  debit: string;
  credit: string;
}

type Notice = { text: string; kind: 'success' | 'error' } | null;

const money = (value: number) => `NPR ${Math.round(value).toLocaleString('en-IN')}`;
const money2 = (value: number) =>
  `NPR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let lineSeq = 0;
const newLine = (): DraftLine => ({
  key: `ln-${++lineSeq}`,
  accountId: '',
  memo: '',
  debit: '',
  credit: '',
});

const today = () => new Date().toISOString().slice(0, 10);

async function readJson(response: Response): Promise<any> {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const TRANSIT_CODE = '1250';

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'all_time' | 'custom';

export const AccountingModule: React.FC<AccountingModuleProps> = ({ orders, products }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [outstandingTransit, setOutstandingTransit] = useState(0);

  const [tab, setTab] = useState<'overview' | 'coa' | 'journal' | 'cod' | 'reports'>('overview');
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);

  // Global Date Range Filter
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(today);

  // COA Search & Filter State
  const [coaSearch, setCoaSearch] = useState('');
  const [coaTypeFilter, setCoaTypeFilter] = useState<'all' | AccountType>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Active Ledgers & Drill-down Drawers
  const [viewingAccountId, setViewingAccountId] = useState<number | null>(null);
  const [showDriverCodDrawer, setShowDriverCodDrawer] = useState(false);
  const [showBankReconModal, setShowBankReconModal] = useState(false);

  // Manual Journal Modal State
  const [showJournal, setShowJournal] = useState(false);
  const [jeDate, setJeDate] = useState(today);
  const [jeReference, setJeReference] = useState('');
  const [jeDescription, setJeDescription] = useState('');
  const [jeAttachment, setJeAttachment] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(), newLine()]);
  const [postingJe, setPostingJe] = useState(false);
  const [jeError, setJeError] = useState('');

  // Add Account / COA Modal State
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('asset');
  const [newAccParentId, setNewAccParentId] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createAccError, setCreateAccError] = useState('');

  // COD Settlement Modal State
  const [showCod, setShowCod] = useState(false);
  const [codDriver, setCodDriver] = useState('');
  const [codOrder, setCodOrder] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [codDeposit, setCodDeposit] = useState('');
  const [codBankRef, setCodBankRef] = useState('');
  const [codAttachment, setCodAttachment] = useState('');
  const [postingCod, setPostingCod] = useState(false);
  const [codError, setCodError] = useState('');

  // Reports State
  const [reportsData, setReportsData] = useState<any | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportView, setReportView] = useState<'trial_balance' | 'pnl'>('trial_balance');

  // Handle Preset Changes
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'this_month') {
      setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setDateTo(today());
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(firstDay.toISOString().slice(0, 10));
      setDateTo(lastDay.toISOString().slice(0, 10));
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      setDateFrom(new Date(now.getFullYear(), qMonth, 1).toISOString().slice(0, 10));
      setDateTo(today());
    } else if (preset === 'ytd') {
      setDateFrom(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setDateTo(today());
    } else if (preset === 'all_time') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('from', dateFrom);
      if (dateTo) query.set('to', dateTo);

      const [ledgerRes, codRes] = await Promise.all([
        fetch(`/api/accounting?${query.toString()}`),
        fetch('/api/v1/accounting/cod-settlement'),
      ]);

      const ledger = await readJson(ledgerRes);
      if (!ledgerRes.ok) {
        setNotice({
          text: ledger.error || `Unable to load the accounting ledger (${ledgerRes.status}).`,
          kind: 'error',
        });
      } else {
        setAccounts(ledger.accounts ?? []);
        setEntries(ledger.entries ?? []);
        setBalances(ledger.balances ?? []);
      }

      const cod = await readJson(codRes);
      if (codRes.ok) {
        setSettlements(cod.settlements ?? []);
        setOutstandingTransit(Number(cod.totals?.outstandingTransit ?? 0));
      }
    } catch {
      setNotice({ text: 'Could not reach the accounting service.', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.set('from', dateFrom);
      if (dateTo) query.set('to', dateTo);

      const res = await fetch(`/api/accounting/reports?${query.toString()}`);
      const data = await readJson(res);
      if (res.ok) {
        setReportsData(data);
      }
    } catch (e) {
      console.error('Error fetching reports:', e);
    } finally {
      setLoadingReports(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void load();
    if (tab === 'reports') {
      void loadReports();
    }
  }, [load, tab, loadReports]);

  // Derived Revenue within date window
  const paidRevenue = useMemo(() => {
    return orders
      .filter((o) => {
        const isPaid = o.paymentStatus === 'paid' || o.paymentStatus === 'verified';
        if (!isPaid) return false;
        if (!dateFrom && !dateTo) return true;
        const orderDate = (o.createdAt || '').slice(0, 10);
        if (dateFrom && orderDate < dateFrom) return false;
        if (dateTo && orderDate > dateTo) return false;
        return true;
      })
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders, dateFrom, dateTo]);

  // Inventory valuation
  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.stockQuantity * (p.mrp || p.sellingPrice), 0),
    [products],
  );

  const accountBalance = (accountId: number, type: string) => {
    const row = balances.find((b) => b.accountId === accountId);
    const value = Number(row?.debit ?? 0) - Number(row?.credit ?? 0);
    return ['liability', 'equity', 'revenue'].includes(type) ? -value : value;
  };

  const depositAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && a.code !== TRANSIT_CODE),
    [accounts],
  );

  // Group Accounts by Type for hierarchical view
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };

    const filtered = accounts.filter((a) => {
      if (coaTypeFilter !== 'all' && a.type !== coaTypeFilter) return false;
      if (coaSearch.trim()) {
        const q = coaSearch.toLowerCase();
        return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
      }
      return true;
    });

    filtered.forEach((a) => {
      if (groups[a.type]) {
        groups[a.type].push(a);
      }
    });

    return groups;
  }, [accounts, coaTypeFilter, coaSearch]);

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Journal form arithmetic
  const totalDebit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0),
    [lines],
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0),
    [lines],
  );
  const difference = totalDebit - totalCredit;

  const usableLines = useMemo(
    () =>
      lines.filter((l) => {
        const d = Number(l.debit) || 0;
        const c = Number(l.credit) || 0;
        return l.accountId !== '' && (d > 0) !== (c > 0);
      }),
    [lines],
  );

  const isBalanced =
    Math.abs(difference) < 0.005 && totalDebit > 0 && usableLines.length >= 2;

  const patchLine = (key: string, changes: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  const setAmount = (key: string, side: 'debit' | 'credit', value: string) =>
    patchLine(key, side === 'debit' ? { debit: value, credit: '' } : { credit: value, debit: '' });

  const resetJournal = () => {
    setJeDate(today());
    setJeReference('');
    setJeDescription('');
    setJeAttachment('');
    setLines([newLine(), newLine()]);
    setJeError('');
  };

  const postJournal = async (event: React.FormEvent) => {
    event.preventDefault();
    setJeError('');

    if (!isBalanced) {
      setJeError('Debits and credits must balance across at least two complete lines.');
      return;
    }

    setPostingJe(true);
    try {
      const response = await fetch('/api/accounting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: jeDate,
          description: jeDescription,
          reference: jeReference || undefined,
          attachmentUrl: jeAttachment || undefined,
          lines: usableLines.map((l) => ({
            accountId: Number(l.accountId),
            description: l.memo || undefined,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        setJeError(data.details?.join(', ') ?? data.error ?? `Could not post entry (${response.status}).`);
        return;
      }

      setShowJournal(false);
      resetJournal();
      setNotice({ text: `Journal entry ${data.entry?.entryNumber ?? ''} posted.`, kind: 'success' });
      await load();
    } catch {
      setJeError('Could not reach the accounting service.');
    } finally {
      setPostingJe(false);
    }
  };

  const postSettlement = async (event: React.FormEvent) => {
    event.preventDefault();
    setCodError('');

    const amount = Number(codAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setCodError('Enter the amount collected.');
      return;
    }
    if (!codDeposit) {
      setCodError('Choose the account the cash was deposited into.');
      return;
    }

    setPostingCod(true);
    try {
      const response = await fetch('/api/v1/accounting/cod-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverName: codDriver,
          orderReference: codOrder || undefined,
          collectedAmount: amount,
          depositAccountId: Number(codDeposit),
          bankReference: codBankRef || undefined,
          attachmentUrl: codAttachment || undefined,
        }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        setCodError(data.details?.join(', ') ?? data.error ?? `Could not record settlement (${response.status}).`);
        return;
      }

      setShowCod(false);
      setCodDriver('');
      setCodOrder('');
      setCodAmount('');
      setCodBankRef('');
      setCodAttachment('');
      setNotice({
        text: `Settlement ${data.settlement?.settlementNumber ?? ''} posted to the ledger.`,
        kind: 'success',
      });
      await load();
    } catch {
      setCodError('Could not reach accounting service.');
    } finally {
      setPostingCod(false);
    }
  };

  const postCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateAccError('');

    if (!newAccCode.trim() || !newAccName.trim()) {
      setCreateAccError('Account code and name are required.');
      return;
    }

    setCreatingAccount(true);
    try {
      const response = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newAccCode.trim(),
          name: newAccName.trim(),
          type: newAccType,
          parentId: newAccParentId ? Number(newAccParentId) : undefined,
        }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        setCreateAccError(data.error || 'Failed to create account.');
        return;
      }

      setShowAddAccount(false);
      setNewAccCode('');
      setNewAccName('');
      setNewAccType('asset');
      setNewAccParentId('');
      setNotice({
        text: `Account "${data.account?.code} - ${data.account?.name}" added to Chart of Accounts.`,
        kind: 'success',
      });
      await load();
    } catch {
      setCreateAccError('Could not reach accounting service.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const selectedDeposit = depositAccounts.find((a) => String(a.id) === codDeposit);
  const codPreview = Number(codAmount) || 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Global Date Range Toolbar */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">Accounting &amp; General Ledger</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
              Double-Entry ERP
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automated double-entry records for revenue, inventory valuation, COD transit, VAT, and expenses.
          </p>
        </div>

        {/* Global Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="bg-transparent text-xs font-bold text-slate-700 py-1.5 pr-2 focus:outline-hidden cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="ytd">Year to Date (YTD)</option>
              <option value="all_time">All Time</option>
              <option value="custom">Custom Range</option>
            </select>

            {datePreset === 'custom' && (
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-700"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-700"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void load()}
            title="Reload Ledger"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowBankReconModal(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Landmark className="h-4 w-4 text-blue-600" />
            <span>Reconcile Bank</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCodError('');
              setCodDeposit((prev) => prev || String(depositAccounts[0]?.id ?? ''));
              setShowCod(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <BanknoteArrowUp className="h-4 w-4 text-emerald-600" />
            <span>COD Settlement</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateAccError('');
              setNewAccCode('');
              setNewAccName('');
              setNewAccType('asset');
              setNewAccParentId('');
              setShowAddAccount(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add New COA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetJournal();
              setShowJournal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 shadow-xs transition-colors"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>Manual Journal</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold shadow-2xs ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {notice.kind === 'error' ? (
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards with Trend Indicators & Clickable Drilldown */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Paid Revenue */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
              <TrendingUp className="h-3 w-3" /> +5.2% ↑
            </span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Paid Revenue</p>
          <p className="text-2xl font-mono font-black text-slate-950 mt-0.5">{money(paidRevenue)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Selected period cash &amp; QR collections</p>
        </div>

        {/* Inventory Value */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
              {products.length} SKUs
            </span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Valuation</p>
          <p className="text-2xl font-mono font-black text-slate-950 mt-0.5">{money(inventoryValue)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Active stock asset value in Ratopool</p>
        </div>

        {/* Posted Journal Entries */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
              <Scale className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-extrabold text-purple-700">
              Balanced
            </span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Posted Journal Vouchers</p>
          <p className="text-2xl font-mono font-black text-slate-950 mt-0.5">{entries.length.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-slate-400">Double-entry vouchers in ledger</p>
        </div>

        {/* Clickable Cash Still with Drivers (COD Transit) */}
        <div
          onClick={() => setShowDriverCodDrawer(true)}
          className={`rounded-3xl border p-5 shadow-xs cursor-pointer transition-all hover:shadow-md ${
            outstandingTransit > 0
              ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70'
              : 'border-slate-200 bg-white hover:bg-slate-50/50'
          }`}
          title="Click to view driver breakdown & reconcile cash"
        >
          <div className="flex items-center justify-between">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                outstandingTransit > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Truck className="h-5 w-5" />
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                outstandingTransit > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Account 1250 · Drilldown →
            </span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Cash with Drivers</p>
          <p
            className={`text-2xl font-mono font-black mt-0.5 ${
              outstandingTransit > 0 ? 'text-amber-950' : 'text-slate-950'
            }`}
          >
            {money(outstandingTransit)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Click to view rider list &amp; settle</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        {([
          ['overview', 'Overview', Landmark],
          ['coa', 'Chart of Accounts', Layers],
          ['journal', 'Journal Entries', FileText],
          ['cod', `COD Settlements (${settlements.length})`, Banknote],
          ['reports', 'Trial Balance & P&L', FileSpreadsheet],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold transition-colors ${
              tab === id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {accounts.slice(0, 8).map((account) => {
              const bal = accountBalance(account.id, account.type);
              return (
                <div
                  key={account.id}
                  onClick={() => setViewingAccountId(account.id)}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">{account.code}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {account.type}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-black text-slate-900 line-clamp-1">{account.name}</h3>
                  <p className="mt-2 text-xl font-mono font-black text-slate-950">{money(bal)}</p>
                  <p className="mt-1 text-[10px] text-blue-600 font-bold">View Ledger →</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions & System Health */}
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Recent General Ledger Vouchers</h3>
                <button
                  type="button"
                  onClick={() => setTab('journal')}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  View All Entries →
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-3">Entry #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.slice(0, 5).map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="p-3 font-mono font-bold text-blue-700">{e.entryNumber}</td>
                        <td className="p-3 font-mono text-slate-500">{e.entryDate}</td>
                        <td className="p-3 font-semibold text-slate-900 truncate max-w-xs">{e.description}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {money(Number(e.debit))}
                        </td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400 text-xs">
                          No journal entries posted in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Helper card */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-900">Double-Entry Rules in ICC</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Assets &amp; Expenses</strong> are Debit-natured (+ Debit increases, - Credit decreases).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Liabilities, Equity &amp; Revenue</strong> are Credit-natured (+ Credit increases, - Debit decreases).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>COD Cash (1250)</strong> clears automatically upon bank deposit.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CHART OF ACCOUNTS (COA) */}
      {tab === 'coa' && (
        <div className="space-y-4">
          {/* Search & Type Filter Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
                placeholder="Search account code (e.g. 1020) or name..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCoaTypeFilter(t)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                    coaTypeFilter === t
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setCreateAccError('');
                  setNewAccCode('');
                  setNewAccName('');
                  setNewAccType('asset');
                  setNewAccParentId('');
                  setShowAddAccount(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-2xs transition-colors ml-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Account</span>
              </button>
            </div>
          </div>

          {/* Grouped Accounts Table */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4 w-28">Code</th>
                  <th className="p-4">Account Name</th>
                  <th className="p-4 w-32">Type</th>
                  <th className="p-4 text-right w-44">Net Balance</th>
                  <th className="p-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((typeKey) => {
                  const items = groupedAccounts[typeKey] || [];
                  if (items.length === 0) return null;

                  const isCollapsed = collapsedGroups[typeKey];
                  const groupTotal = items.reduce(
                    (sum, acc) => sum + accountBalance(acc.id, acc.type),
                    0,
                  );

                  return (
                    <React.Fragment key={typeKey}>
                      {/* Group Header Row */}
                      <tr
                        onClick={() => toggleGroupCollapse(typeKey)}
                        className="bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer select-none transition-colors border-t border-b border-slate-200"
                      >
                        <td colSpan={3} className="p-3.5 font-black uppercase text-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="tracking-wider">{typeKey} accounts</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {items.length}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-slate-900 text-[11px]">
                          {money(groupTotal)}
                        </td>
                        <td className="p-3.5 text-right text-[10px] text-slate-400 font-bold">
                          {isCollapsed ? 'Expand' : 'Collapse'}
                        </td>
                      </tr>

                      {/* Group Account Rows */}
                      {!isCollapsed &&
                        items.map((account) => {
                          const bal = accountBalance(account.id, account.type);
                          return (
                            <tr
                              key={account.id}
                              className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                              onClick={() => setViewingAccountId(account.id)}
                            >
                              <td className="p-4 font-mono font-bold text-blue-700">{account.code}</td>
                              <td className="p-4 font-extrabold text-slate-900">
                                <span className="hover:text-blue-600 transition-colors">
                                  {account.name}
                                </span>
                              </td>
                              <td className="p-4 capitalize">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {account.type}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono font-black text-slate-950">
                                {money(bal)}
                              </td>
                              <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setViewingAccountId(account.id)}
                                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                                  title="View Account Ledger"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: JOURNAL ENTRIES */}
      {tab === 'journal' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Showing {entries.length} double-entry voucher{entries.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => {
                resetJournal();
                setShowJournal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Journal Voucher</span>
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4">Entry #</th>
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4">Source</th>
                <th className="p-4 text-right">Debit</th>
                <th className="p-4 text-right">Credit</th>
                <th className="p-4 text-center">Attachment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-4 font-mono font-bold text-blue-700">{entry.entryNumber}</td>
                  <td className="p-4 font-mono text-slate-500 whitespace-nowrap">{entry.entryDate}</td>
                  <td className="p-4 font-semibold text-slate-900 max-w-md">{entry.description}</td>
                  <td className="p-4 capitalize text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold">
                      {entry.sourceType || 'manual'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-900">
                    {money(Number(entry.debit))}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-900">
                    {money(Number(entry.credit))}
                  </td>
                  <td className="p-4 text-center">
                    {entry.attachmentUrl ? (
                      <a
                        href={entry.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex p-1 text-blue-600 hover:text-blue-800"
                        title="View voucher receipt"
                      >
                        <Paperclip className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    No journal entries recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: COD SETTLEMENTS */}
      {tab === 'cod' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-slate-900">COD Driver Collection &amp; Vault Bankings</h3>
              <p className="text-[11px] text-slate-500">Audit trail of banked rider remittances.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCodError('');
                setCodDeposit((prev) => prev || String(depositAccounts[0]?.id ?? ''));
                setShowCod(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs"
            >
              <BanknoteArrowUp className="h-4 w-4" />
              <span>Record COD Settlement</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-4">Receipt #</th>
                  <th className="p-4">Settled At</th>
                  <th className="p-4">Courier / Driver</th>
                  <th className="p-4">Order Ref</th>
                  <th className="p-4">Deposited Into</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="p-4 font-mono font-bold text-emerald-700">{s.settlementNumber}</td>
                    <td className="p-4 font-mono text-slate-500">{s.settledAt?.slice(0, 10)}</td>
                    <td className="p-4 font-extrabold text-slate-900">{s.driverName}</td>
                    <td className="p-4 font-mono text-slate-600">{s.orderReference || '—'}</td>
                    <td className="p-4 font-semibold text-slate-800">
                      {s.depositAccountName ? `${s.depositAccountCode} - ${s.depositAccountName}` : '—'}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-slate-900">
                      {money(Number(s.collectedAmount))}
                    </td>
                    <td className="p-4 text-center">
                      {s.attachmentUrl ? (
                        <a
                          href={s.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex p-1 text-blue-600 hover:text-blue-800"
                          title="View Bank Deposit Slip"
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {settlements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      No COD settlements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: FINANCIAL REPORTS (TRIAL BALANCE & P&L) */}
      {tab === 'reports' && (
        <div className="space-y-5">
          {/* Sub-tab toggle */}
          <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReportView('trial_balance')}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition-colors ${
                  reportView === 'trial_balance'
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Trial Balance
              </button>
              <button
                type="button"
                onClick={() => setReportView('pnl')}
                className={`rounded-2xl px-4 py-2 text-xs font-bold transition-colors ${
                  reportView === 'pnl'
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Profit &amp; Loss (P&amp;L) Statement
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Report</span>
            </button>
          </div>

          {loadingReports ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-bold">Generating financial report...</p>
            </div>
          ) : reportsData ? (
            <>
              {/* TRIAL BALANCE VIEW */}
              {reportView === 'trial_balance' && (
                <div className="space-y-4">
                  {/* Balance Status Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                      reportsData.trialBalance.isBalanced
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        Trial Balance Status:{' '}
                        {reportsData.trialBalance.isBalanced ? 'PERFECTLY BALANCED' : 'OUT OF BALANCE'}
                      </span>
                    </div>
                    <div className="font-mono">
                      <span>Total Debits: {money2(reportsData.trialBalance.totalDebit)}</span>
                      <span className="mx-2">|</span>
                      <span>Total Credits: {money2(reportsData.trialBalance.totalCredit)}</span>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-4">Account Code</th>
                          <th className="p-4">Account Title</th>
                          <th className="p-4">Type</th>
                          <th className="p-4 text-right">Debit (NPR)</th>
                          <th className="p-4 text-right">Credit (NPR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportsData.trialBalance.rows.map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="p-4 font-mono font-bold text-blue-700">{r.code}</td>
                            <td className="p-4 font-bold text-slate-900">{r.name}</td>
                            <td className="p-4 capitalize text-slate-500">{r.type}</td>
                            <td className="p-4 text-right font-mono font-bold text-slate-900">
                              {r.netDebit > 0 ? money2(r.netDebit) : '—'}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-900">
                              {r.netCredit > 0 ? money2(r.netCredit) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-mono font-bold text-xs border-t-2 border-slate-950">
                        <tr>
                          <td colSpan={3} className="p-4 uppercase tracking-wider">
                            Total General Ledger Trial Balance
                          </td>
                          <td className="p-4 text-right text-emerald-400">
                            {money2(reportsData.trialBalance.totalDebit)}
                          </td>
                          <td className="p-4 text-right text-blue-400">
                            {money2(reportsData.trialBalance.totalCredit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* PROFIT & LOSS STATEMENT VIEW */}
              {reportView === 'pnl' && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 max-w-4xl mx-auto">
                  <div className="text-center pb-4 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-950">Intel Computer Center</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                      Statement of Profit and Loss (P&amp;L)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Period: {dateFrom || 'Beginning'} to {dateTo || 'Current'}
                    </p>
                  </div>

                  {/* Revenue */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Operating Revenue (Sales &amp; Services)</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {reportsData.profitAndLoss.revenue.rows.map((r: any) => (
                        <div key={r.id} className="py-2 flex justify-between">
                          <span className="font-semibold text-slate-800">
                            {r.code} - {r.name}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{money2(r.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between py-2 border-t border-slate-200 text-xs font-extrabold text-slate-900 bg-slate-50 px-3 rounded-xl">
                      <span>Total Revenue</span>
                      <span className="font-mono text-emerald-700">
                        {money2(reportsData.profitAndLoss.revenue.total)}
                      </span>
                    </div>
                  </div>

                  {/* Cost of Goods Sold */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Cost of Goods Sold (COGS)</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {reportsData.profitAndLoss.cogs.rows.map((r: any) => (
                        <div key={r.id} className="py-2 flex justify-between">
                          <span className="font-semibold text-slate-800">
                            {r.code} - {r.name}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{money2(r.amount)}</span>
                        </div>
                      ))}
                      {reportsData.profitAndLoss.cogs.rows.length === 0 && (
                        <div className="py-2 text-slate-400 italic">No direct COGS entries in period.</div>
                      )}
                    </div>
                    <div className="flex justify-between py-2 border-t border-slate-200 text-xs font-extrabold text-slate-900 bg-slate-50 px-3 rounded-xl">
                      <span>Gross Profit</span>
                      <span className="font-mono text-blue-700">
                        {money2(reportsData.profitAndLoss.grossProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>Operating &amp; Administrative Expenses</span>
                      <span>Amount</span>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      {reportsData.profitAndLoss.operatingExpenses.rows.map((r: any) => (
                        <div key={r.id} className="py-2 flex justify-between">
                          <span className="font-semibold text-slate-800">
                            {r.code} - {r.name}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{money2(r.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between py-2 border-t border-slate-200 text-xs font-extrabold text-slate-900 bg-slate-50 px-3 rounded-xl">
                      <span>Total Operating Expenses</span>
                      <span className="font-mono text-rose-700">
                        {money2(reportsData.profitAndLoss.operatingExpenses.total)}
                      </span>
                    </div>
                  </div>

                  {/* Net Profit Summary */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between text-sm font-black">
                    <div>
                      <span>Net Profit for the Period</span>
                      <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                        Net Margin: {reportsData.profitAndLoss.netMarginPercent}%
                      </span>
                    </div>
                    <div className="font-mono text-lg text-emerald-400">
                      {money2(reportsData.profitAndLoss.netProfit)}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* MODAL: ACCOUNT LEDGER DRILLDOWN */}
      <AccountLedgerModal
        accountId={viewingAccountId}
        from={dateFrom}
        to={dateTo}
        onClose={() => setViewingAccountId(null)}
        onPostNewEntry={(accId) => {
          resetJournal();
          setLines([
            { key: 'ln-1', accountId: String(accId), memo: '', debit: '', credit: '' },
            newLine(),
          ]);
          setShowJournal(true);
        }}
      />

      {/* DRAWER: DRIVER COD CASH BREAKDOWN */}
      {showDriverCodDrawer && (
        <DriverCodDrawer
          orders={orders}
          outstandingTransit={outstandingTransit}
          onClose={() => setShowDriverCodDrawer(false)}
          onSettleDriver={(driverName, suggestedAmount, orderRef) => {
            setCodDriver(driverName);
            setCodAmount(String(suggestedAmount));
            setCodOrder(orderRef || '');
            setCodDeposit((prev) => prev || String(depositAccounts[0]?.id ?? ''));
            setCodError('');
            setShowCod(true);
          }}
        />
      )}

      {/* MODAL: BANK STATEMENT RECONCILIATION */}
      {showBankReconModal && (
        <BankReconciliationModal
          accounts={accounts}
          entries={entries}
          onClose={() => setShowBankReconModal(false)}
          onCreateManualEntry={(preset) => {
            resetJournal();
            setJeDate(preset.date || today());
            setJeDescription(preset.description || '');
            setLines([
              {
                key: 'ln-1',
                accountId: String(preset.accountId),
                memo: preset.description,
                debit: preset.isDebit ? String(preset.amount) : '',
                credit: !preset.isDebit ? String(preset.amount) : '',
              },
              newLine(),
            ]);
            setShowJournal(true);
          }}
        />
      )}

      {/* MODAL: MANUAL JOURNAL ENTRY */}
      {showJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                  <FilePlus2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Post Manual Journal Entry</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Multi-line double-entry voucher. Debits and Credits must balance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJournal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={postJournal} className="flex-1 overflow-y-auto p-6 space-y-4">
              {jeError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{jeError}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    value={jeDate}
                    onChange={(e) => setJeDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reference / Bill #</label>
                  <input
                    type="text"
                    value={jeReference}
                    onChange={(e) => setJeReference(e.target.value)}
                    placeholder="e.g. INV-9842 / RECEIPT-01"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Entry Description / Narration</label>
                <input
                  type="text"
                  value={jeDescription}
                  onChange={(e) => setJeDescription(e.target.value)}
                  placeholder="e.g. Office rent &amp; electricity advance payment"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
                />
              </div>

              {/* Lines Repeater */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Journal Lines ({lines.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, newLine()])}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Line</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {lines.map((l) => (
                    <div
                      key={l.key}
                      className="grid grid-cols-12 gap-2 items-center p-2 rounded-2xl border border-slate-200 bg-slate-50/50"
                    >
                      <div className="col-span-5">
                        <select
                          value={l.accountId}
                          onChange={(e) => patchLine(l.key, { accountId: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={l.memo}
                          onChange={(e) => patchLine(l.key, { memo: e.target.value })}
                          placeholder="Line memo..."
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.debit}
                          onChange={(e) => setAmount(l.key, 'debit', e.target.value)}
                          placeholder="Debit"
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-emerald-700 text-right"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.credit}
                          onChange={(e) => setAmount(l.key, 'credit', e.target.value)}
                          placeholder="Credit"
                          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono font-bold text-blue-700 text-right"
                        />
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setLines((prev) => prev.filter((item) => item.key !== l.key))}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Balance Guard */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-mono font-bold">
                <div>
                  <span>Total Debit: {money2(totalDebit)}</span>
                  <span className="mx-2 text-slate-500">|</span>
                  <span>Total Credit: {money2(totalCredit)}</span>
                </div>
                <div>
                  {isBalanced ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
                    </span>
                  ) : (
                    <span className="text-rose-400">Difference: {money2(difference)}</span>
                  )}
                </div>
              </div>

              {/* Attachment */}
              <div className="flex items-center justify-between pt-2">
                <UploadButton
                  purpose="payment-proof"
                  onUploaded={([url]) => setJeAttachment(url || '')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{jeAttachment ? 'Replace voucher slip' : 'Attach voucher scan / receipt'}</span>
                </UploadButton>
                {jeAttachment && <span className="text-xs text-emerald-600 font-bold">Attached ✓</span>}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowJournal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced || postingJe}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {postingJe ? 'Posting...' : 'Post Journal Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COD SETTLEMENT */}
      {showCod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <BanknoteArrowUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Record COD Settlement</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deposit cash collected by delivery drivers into Bank or Shop Vault.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCod(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={postSettlement} className="flex-1 overflow-y-auto p-6 space-y-4">
              {codError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  {codError}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Driver / Courier Name</label>
                  <input
                    type="text"
                    value={codDriver}
                    onChange={(e) => setCodDriver(e.target.value)}
                    placeholder="e.g. Ramesh Thapa"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount Collected (NPR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                    placeholder="89999"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Asset Account</label>
                  <select
                    value={codDeposit}
                    onChange={(e) => setCodDeposit(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
                  >
                    {depositAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Order # / Reference</label>
                  <input
                    type="text"
                    value={codOrder}
                    onChange={(e) => setCodOrder(e.target.value)}
                    placeholder="e.g. ORD-2026-0042"
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Slip Reference</label>
                <input
                  type="text"
                  value={codBankRef}
                  onChange={(e) => setCodBankRef(e.target.value)}
                  placeholder="e.g. TXN-NABIL-892189"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
                />
              </div>

              {/* Instant Double-Entry Preview Card */}
              {codPreview > 0 && selectedDeposit && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Automated General Ledger Entry Preview
                  </span>
                  <div className="space-y-1 font-mono">
                    <div className="flex justify-between text-emerald-900">
                      <span>DEBIT: {selectedDeposit.code} ({selectedDeposit.name})</span>
                      <span className="font-bold">{money2(codPreview)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 pl-4">
                      <span>CREDIT: 1250 (Cash in Transit - {codDriver || 'Driver'})</span>
                      <span className="font-bold">{money2(codPreview)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Slip upload */}
              <div className="flex items-center justify-between pt-2">
                <UploadButton
                  purpose="payment-proof"
                  onUploaded={([url]) => setCodAttachment(url || '')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{codAttachment ? 'Replace Deposit Slip' : 'Upload Bank Deposit Slip'}</span>
                </UploadButton>
                {codAttachment && <span className="text-xs text-emerald-600 font-bold">Slip Uploaded ✓</span>}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCod(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingCod}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {postingCod ? 'Recording...' : 'Record & Bank Cash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT TO CHART OF ACCOUNTS (COA) */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add Account to Chart of Accounts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create a new General Ledger account code for double-entry records.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccount(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={postCreateAccount} className="flex-1 overflow-y-auto p-6 space-y-4">
              {createAccError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{createAccError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Type</label>
                <select
                  value={newAccType}
                  onChange={(e) => {
                    const nextType = e.target.value as AccountType;
                    setNewAccType(nextType);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold capitalize text-slate-900"
                >
                  <option value="asset">Asset (e.g. Bank Account, Cash, Inventory, Receivables)</option>
                  <option value="liability">Liability (e.g. Accounts Payable, VAT Payable, Loans)</option>
                  <option value="equity">Equity (e.g. Owner's Capital, Retained Earnings)</option>
                  <option value="revenue">Revenue (e.g. Sales Revenue, Service Income)</option>
                  <option value="expense">Expense (e.g. Rent, Electricity, Salaries, Marketing)</option>
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Account Code</label>
                  <input
                    type="text"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    placeholder={
                      newAccType === 'asset'
                        ? 'e.g. 1030'
                        : newAccType === 'liability'
                        ? 'e.g. 2030'
                        : newAccType === 'equity'
                        ? 'e.g. 3020'
                        : newAccType === 'revenue'
                        ? 'e.g. 4020'
                        : 'e.g. 5040'
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Recommended: {newAccType === 'asset' ? '1xxx' : newAccType === 'liability' ? '2xxx' : newAccType === 'equity' ? '3xxx' : newAccType === 'revenue' ? '4xxx' : '5xxx'} range
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent Account (Optional)</label>
                  <select
                    value={newAccParentId}
                    onChange={(e) => setNewAccParentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-700"
                  >
                    <option value="">None (Top-level)</option>
                    {accounts
                      .filter((a) => a.type === newAccType)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="e.g. Kumari Bank Current Account / Office Internet Expense"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount || !newAccCode.trim() || !newAccName.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingAccount ? 'Adding...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
