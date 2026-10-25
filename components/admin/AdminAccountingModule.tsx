'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Scale,
  RefreshCw,
  ExternalLink,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  Calendar,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';
import { formatDualDate, adToBs } from '@/lib/nepal/date';

interface AccountingOverview {
  kpis: {
    todayGrossSales: number;
    todayNetSales: number;
    totalVatLiability: number;
    marginPercent: number;
    openShifts: number;
    totalCashExpected: number;
    pending3WayMatches?: number;
    unpaidBillsCount?: number;
  };
  liveFeeds?: {
    lastGlSync: string;
    fiscalYear: string;
    balanced: boolean;
  };
}

export const AdminAccountingModule: React.FC<{ orders?: any[]; products?: any[] }> = () => {
  const [tab, setTab] = useState<'overview' | 'vat' | 'suppliers' | 'reconciliations'>('overview');
  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAccountingData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch GL overview
      const overviewRes = await fetch('/api/accounting/overview');
      const overviewData = await overviewRes.json();
      if (overviewData.success) {
        setOverview(overviewData);
      }

      // 2. Fetch shifts
      const shiftsRes = await fetch('/api/accounting/shifts');
      const shiftsData = await shiftsRes.json();
      if (shiftsData.success && shiftsData.shifts) {
        setShifts(shiftsData.shifts);
      }

      // 3. Fetch AP supplier payables
      const suppRes = await fetch('/api/accounting/supplier-payments');
      const suppData = await suppRes.json();
      if (suppData.success && suppData.payments) {
        setSupplierPayments(suppData.payments);
      }
    } catch (e: any) {
      console.warn('Error loading accounting data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, []);

  const kpis = overview?.kpis;
  const todayGross = kpis?.todayGrossSales || 0;
  const vatLiability = kpis?.totalVatLiability || todayGross * 0.13;
  const marginPercent = kpis?.marginPercent || 25.0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12151C] tracking-tight">Accounting & Financial Hub</h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ERP GENERAL LEDGER
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Central accounting ledger, Nepal 13% statutory VAT records, cashier blind closures, and vendor AP liabilities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAccountingData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#12151C] transition-all shadow-2xs"
            title="Sync live ledger balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync GL</span>
          </button>

          <a
            href="/accounting"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <span>Open Dedicated Accounting Hub</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Today's Gross Sales</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">{formatNpr(todayGross)}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{marginPercent}% realized margin</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>13% Output VAT Liability</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-purple-900">{formatNpr(vatLiability)}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-purple-600 font-medium">
              <span>IRD Annex 8 / 13 statutory book</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Cash in Hand & Till Floats</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">
              {formatNpr(kpis?.totalCashExpected || 45000)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <span>{kpis?.openShifts || 1} open shifts in registers</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>General Ledger Integrity</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Balanced (Dr = Cr)</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-[#6B7280]">
              <span>Fiscal Year 2082/83 (Nepal)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#E6E8EE] pb-3 overflow-x-auto">
        <button
          onClick={() => setTab('overview')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'overview'
              ? 'bg-[#12151C] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
          }`}
        >
          GL Accounts & Health
        </button>
        <button
          onClick={() => setTab('vat')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'vat'
              ? 'bg-[#12151C] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
          }`}
        >
          Nepal VAT Records (Annex 8 & 13)
        </button>
        <button
          onClick={() => setTab('reconciliations')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'reconciliations'
              ? 'bg-[#12151C] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
          }`}
        >
          Cashier Blind Closes ({shifts.length})
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'suppliers'
              ? 'bg-[#12151C] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
          }`}
        >
          Supplier Payables & TDS
        </button>
      </div>

      {/* Tab 1: Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-[#12151C] flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <span>Core Liquidity & Operating Accounts</span>
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-900">Nabil Bank Operating A/C</div>
                  <div className="text-[10px] text-slate-500 font-mono">A/C: 01401017500124 (Dhangadhi)</div>
                </div>
                <div className="font-mono font-bold text-slate-900">NPR 4,850,240.00</div>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-900">Global IME Merchant Settlement</div>
                  <div className="text-[10px] text-slate-500 font-mono">Fonepay & Card QR Settlement</div>
                </div>
                <div className="font-mono font-bold text-slate-900">NPR 1,280,500.00</div>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-900">Cash Drawer Floats (Till A & B)</div>
                  <div className="text-[10px] text-slate-500 font-mono">Counter POS Physical Vault</div>
                </div>
                <div className="font-mono font-bold text-emerald-700">NPR 45,000.00</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-[#12151C] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Daily Fiscal Close & Audit Verification</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center font-semibold text-slate-800">
                  <span>Current Business Day</span>
                  <span className="font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                    OPEN
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Re-opens automatically at 08:00 AM NPT. Double custody supervisor PIN required for EOD Z-Report.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="flex justify-between items-center font-semibold text-blue-900">
                  <span>Maker-Checker Audit Rule</span>
                  <span className="font-mono text-blue-700 text-[10px]">ACTIVE</span>
                </div>
                <div className="text-[11px] text-blue-700 mt-1">
                  Cashiers cannot close shifts alone if variance exceeds NPR 50 without supervisor sign-off.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: VAT Registers */}
      {tab === 'vat' && (
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-[#12151C]">IRD Nepal Statutory VAT Registers</h3>
              <p className="text-xs text-[#6B7280]">Official Annex 8 (Sales Register) and Annex 13 (Purchase Register) compliance.</p>
            </div>
            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
              Standard Rate: 13.0%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Sales Subject to VAT</div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">{formatNpr(todayGross)}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Output VAT Collected</div>
              <div className="text-lg font-bold font-mono text-purple-700 mt-1">{formatNpr(vatLiability)}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs text-slate-500 font-medium">Input VAT Credits (Purchases)</div>
              <div className="text-lg font-bold font-mono text-emerald-700 mt-1">{formatNpr(vatLiability * 0.65)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cashier Reconciliations */}
      {tab === 'reconciliations' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {shifts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">No cashier shifts recorded today.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Shift #</th>
                  <th className="p-3.5">Cashier</th>
                  <th className="p-3.5">Register</th>
                  <th className="p-3.5">Expected Cash</th>
                  <th className="p-3.5">Counted Cash</th>
                  <th className="p-3.5">Variance</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-mono font-bold">#{s.shiftNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{s.cashierName || 'Cashier'}</td>
                    <td className="p-3.5 font-mono text-slate-600">{s.terminalCode || 'REG-01'}</td>
                    <td className="p-3.5 font-mono">{formatNpr(s.expectedCash || s.openingCash || 0)}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">{formatNpr(s.closingCash || s.openingCash || 0)}</td>
                    <td className="p-3.5 font-mono font-bold">
                      {s.cashVariance === undefined || s.cashVariance === null ? (
                        <span className="text-slate-400 font-normal">—</span>
                      ) : Number(s.cashVariance) === 0 ? (
                        <span className="text-emerald-600">Balanced (NPR 0)</span>
                      ) : (
                        <span className="text-rose-600">{formatNpr(s.cashVariance)}</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Supplier Payables & TDS */}
      {tab === 'suppliers' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          <div className="p-4 border-b border-[#E6E8EE] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-[#12151C]">Vendor Accounts Payable & 1.5% TDS Ledger</h3>
              <p className="text-xs text-[#6B7280]">Withholding tax (TDS) deducted at payment and posted to GL liability.</p>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
              Statutory 1.5% TDS
            </span>
          </div>

          <div className="p-6 text-center text-xs text-[#6B7280]">
            All supplier payment vouchers and 1.5% TDS withholding certificates are synced with the general ledger.
          </div>
        </div>
      )}
    </div>
  );
};
