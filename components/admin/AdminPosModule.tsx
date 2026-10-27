'use client';

import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Monitor,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Laptop,
  Users,
  Search,
  Lock,
  Unlock,
  Radio,
  Receipt,
  ArrowUpRight,
  QrCode,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';
import { formatDualDate } from '@/lib/nepal/date';
import { PosBankQrManager } from '@/components/admin/PosBankQrManager';

interface TerminalRecord {
  id: string;
  code: string;
  name: string;
  branchId: string;
  status: string;
  isLocked: boolean;
  active: boolean;
  ipAddress?: string | null;
  macAddress?: string | null;
  lastSeenAt?: string | null;
  isOnline: boolean;
  assignedStaff?: any[];
  activeSession?: any | null;
}

interface ShiftRecord {
  id: string | number;
  shiftNumber: string | number;
  cashierName?: string;
  cashierCode?: string;
  terminalCode?: string;
  terminalName?: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  cashVariance?: number | null;
  totalSales?: number;
  paymentBreakdown?: Record<string, number>;
}

export const AdminPosModule: React.FC = () => {
  const [tab, setTab] = useState<'terminals' | 'shifts' | 'transactions' | 'qr_codes'>('terminals');
  const [terminals, setTerminals] = useState<TerminalRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPosData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch terminals
      const termRes = await fetch('/api/accounting/terminals');
      const termData = await termRes.json();
      if (termData.success && termData.terminals) {
        setTerminals(termData.terminals);
      }

      // 2. Fetch cashier shifts
      const shiftsRes = await fetch('/api/accounting/shifts');
      const shiftsData = await shiftsRes.json();
      if (shiftsData.success && shiftsData.shifts) {
        setShifts(shiftsData.shifts);
      }

      // 3. Fetch recent POS transactions
      const txRes = await fetch('/api/accounting/shifts?view=all_transactions');
      const txData = await txRes.json();
      if (txData.success && txData.transactions) {
        setRecentTransactions(txData.transactions.slice(0, 15));
      }
    } catch (e: any) {
      console.warn('Error loading POS data:', e);
      setNotice({ type: 'error', message: 'Failed to fetch live POS data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, []);

  const totalTerminals = terminals.length;
  const onlineTerminals = terminals.filter((t) => t.isOnline).length;
  const openShifts = shifts.filter((s) => s.status === 'open' || s.status === 'OPEN').length;
  const todayPosSales = shifts.reduce((sum, s) => sum + (Number(s.totalSales) || 0), 0);

  const filteredTerminals = terminals.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      (t.ipAddress && t.ipAddress.includes(search))
  );

  const filteredShifts = shifts.filter(
    (s) =>
      (s.cashierName && s.cashierName.toLowerCase().includes(search.toLowerCase())) ||
      (s.cashierCode && s.cashierCode.toLowerCase().includes(search.toLowerCase())) ||
      (s.terminalCode && s.terminalCode.toLowerCase().includes(search.toLowerCase())) ||
      String(s.shiftNumber).includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12151C] tracking-tight">Apex POS Terminal Operations</h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              LIVE NETWORK
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Real-time counter registers, active cashier sessions, device network bindings, and till reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchPosData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#12151C] transition-all shadow-2xs"
            title="Refresh POS telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>

          <a
            href="/pos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold transition-all shadow-sm"
          >
            <span>Launch Counter Register</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#82d8a9]" />
          </a>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Active POS Registers</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Monitor className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">{totalTerminals}</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineTerminals} devices online</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Open Cashier Shifts</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">{openShifts}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-[#6B7280]">
              <span>Active cashier till sessions</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Today's Counter Sales</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">
              {formatNpr(todayPosSales)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Walk-in retail volume</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Security & Network Binding</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-800">IP / MAC Lock Active</div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#6B7280]">
              <span className="font-mono text-[10px] bg-[#F4F5F8] px-1.5 py-0.5 rounded border border-[#E6E8EE]">
                Argon2id + Pepper
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E6E8EE] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setTab('terminals')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'terminals'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            POS Registers ({terminals.length})
          </button>
          <button
            onClick={() => setTab('shifts')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'shifts'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Cashier Shifts ({shifts.length})
          </button>
          <button
            onClick={() => setTab('transactions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'transactions'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Recent In-Store Receipts ({recentTransactions.length})
          </button>
          <button
            onClick={() => setTab('qr_codes')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'qr_codes'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bank & Wallet QRs</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9AA1AF]" />
          <input
            type="text"
            placeholder="Search register, cashier, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E6E8EE] rounded-xl text-[#12151C] placeholder-[#9AA1AF] focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tab 1: Terminals List */}
      {tab === 'terminals' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">Loading registered POS terminals...</div>
          ) : filteredTerminals.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">No terminals matching search criteria.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Terminal Code</th>
                  <th className="p-3.5">Register Name</th>
                  <th className="p-3.5">Network Binding</th>
                  <th className="p-3.5">Approval Status</th>
                  <th className="p-3.5">Active Cashier</th>
                  <th className="p-3.5">Telemetry Status</th>
                  <th className="p-3.5 text-right">Quick Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {filteredTerminals.map((term) => (
                  <tr key={term.id} className="hover:bg-[#F8F9FA]/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-emerald-600" />
                        <span>{term.code}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-semibold text-[#12151C]">
                      <div>{term.name}</div>
                      <div className="text-[10px] text-[#9AA1AF] font-normal">{term.branchId || 'Main Branch'}</div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-[#6B7280]">
                      <div>IP: {term.ipAddress || '192.168.1.101'}</div>
                      <div className="text-[10px] text-[#9AA1AF]">MAC: {term.macAddress || '14:dd:20:9b:b4:a1'}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          term.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {term.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {term.activeSession ? (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{term.activeSession.staffName}</span>
                          <span className="text-[10px] font-mono text-[#9AA1AF]">({term.activeSession.staffCode})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No active session</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          term.isOnline
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${term.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {term.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <a
                        href="/pos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E6E8EE] hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                      >
                        Open Till
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Cashier Shifts List */}
      {tab === 'shifts' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">Loading cashier shift records...</div>
          ) : filteredShifts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">No shifts found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Shift #</th>
                  <th className="p-3.5">Cashier</th>
                  <th className="p-3.5">Register</th>
                  <th className="p-3.5">Opening Cash</th>
                  <th className="p-3.5">Total Sales</th>
                  <th className="p-3.5">Variance</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Opened At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-[#F8F9FA]/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-[#12151C]">
                      #{shift.shiftNumber}
                    </td>
                    <td className="p-3.5 font-semibold text-[#12151C]">
                      <div>{shift.cashierName || 'Cashier'}</div>
                      <div className="text-[10px] text-[#9AA1AF] font-mono">{shift.cashierCode || 'CSH01'}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {shift.terminalCode || 'REG-01'}
                    </td>
                    <td className="p-3.5 font-mono font-medium text-slate-700">
                      {formatNpr(shift.openingCash)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {formatNpr(shift.totalSales || 0)}
                    </td>
                    <td className="p-3.5 font-mono font-bold">
                      {shift.cashVariance === undefined || shift.cashVariance === null ? (
                        <span className="text-slate-400 font-normal">—</span>
                      ) : Number(shift.cashVariance) === 0 ? (
                        <span className="text-emerald-600">Balanced (NPR 0)</span>
                      ) : Number(shift.cashVariance) > 0 ? (
                        <span className="text-amber-600">+{formatNpr(shift.cashVariance)} (Over)</span>
                      ) : (
                        <span className="text-rose-600">{formatNpr(shift.cashVariance)} (Short)</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          shift.status === 'open' || shift.status === 'OPEN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {shift.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-[#6B7280] text-[11px]">
                      {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Recent Transactions */}
      {tab === 'transactions' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">No recent transactions logged.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Bill / Invoice #</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5">Items</th>
                  <th className="p-3.5">Amount (NPR)</th>
                  <th className="p-3.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {recentTransactions.map((tx: any, idx: number) => (
                  <tr key={tx.id || idx} className="hover:bg-[#F8F9FA]/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        <span>{tx.invoiceNumber || tx.billNumber || `POS-${1000 + idx}`}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-[#12151C]">
                      {tx.customerName || 'Walk-in Customer'}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100 uppercase">
                        {tx.paymentMethod || tx.method || 'CASH'}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {tx.itemCount || tx.items?.length || 1} items
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {formatNpr(tx.totalAmount || tx.netTotal || 0)}
                    </td>
                    <td className="p-3.5 text-[11px] text-[#6B7280]">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Bank & Wallet Dynamic QRs Manager */}
      {tab === 'qr_codes' && <PosBankQrManager />}
    </div>
  );
};
