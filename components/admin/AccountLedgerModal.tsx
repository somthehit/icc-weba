'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Download,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

interface AccountLedgerModalProps {
  accountId: number | null;
  from?: string;
  to?: string;
  onClose: () => void;
  onPostNewEntry?: (accountId: number) => void;
}

interface LedgerData {
  account: {
    id: number;
    code: string;
    name: string;
    type: string;
  };
  openingBalance: number;
  closingBalance: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  transactions: Array<{
    id: number;
    journalEntryId: number;
    entryNumber: string;
    entryDate: string;
    description: string;
    sourceType: string | null;
    attachmentUrl: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

const money = (val: number) => `NPR ${Math.round(val).toLocaleString('en-IN')}`;
const money2 = (val: number) =>
  `NPR ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AccountLedgerModal: React.FC<AccountLedgerModalProps> = ({
  accountId,
  from,
  to,
  onClose,
  onPostNewEntry,
}) => {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);

    fetch(`/api/accounting/ledger/${accountId}?${query.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((resData) => {
        if (isMounted) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError('Failed to load transaction ledger.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accountId, from, to]);

  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (!search.trim()) return data.transactions;
    const q = search.toLowerCase();
    return data.transactions.filter(
      (t) =>
        t.entryNumber.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.sourceType && t.sourceType.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ['Date', 'Entry #', 'Description', 'Source', 'Debit', 'Credit', 'Running Balance'];
    const rows = data.transactions.map((t) => [
      t.entryDate,
      t.entryNumber,
      `"${t.description.replace(/"/g, '""')}"`,
      t.sourceType || 'manual',
      t.debit.toFixed(2),
      t.credit.toFixed(2),
      t.runningBalance.toFixed(2),
    ]);

    const csvContent = [
      `Account: ${data.account.code} - ${data.account.name}`,
      `Period: ${from || 'Beginning'} to ${to || 'Current'}`,
      `Opening Balance: ${data.openingBalance.toFixed(2)}`,
      '',
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      '',
      `Closing Balance: ${data.closingBalance.toFixed(2)}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ledger_${data.account.code}_${data.account.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!accountId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-mono font-bold text-sm shadow-xs">
              {data?.account.code || '...'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  {data?.account.name || 'Account Ledger'}
                </h2>
                {data?.account.type && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    {data.account.type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span>
                  Statement Period: {from || 'All time'} {to ? `to ${to}` : ''}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                title="Download statement as CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            )}
            {onPostNewEntry && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPostNewEntry(accountId);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-2xs"
              >
                <span>New Entry</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-bold">Loading ledger transactions...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-bold text-rose-700">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Financial Balance Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Opening Balance
                  </span>
                  <p className="text-sm font-mono font-black text-slate-900 mt-1">
                    {money2(data.openingBalance)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3" /> Total Period Debits
                  </span>
                  <p className="text-sm font-mono font-black text-emerald-800 mt-1">
                    {money2(data.totalPeriodDebit)}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> Total Period Credits
                  </span>
                  <p className="text-sm font-mono font-black text-blue-800 mt-1">
                    {money2(data.totalPeriodCredit)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-900 bg-slate-900 p-3.5 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Closing Net Balance
                  </span>
                  <p className="text-sm font-mono font-black text-white mt-1">
                    {money2(data.closingBalance)}
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search entry # or description..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                  {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Transactions Table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Entry #</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5">Source</th>
                      <th className="p-3.5 text-right">Debit</th>
                      <th className="p-3.5 text-right">Credit</th>
                      <th className="p-3.5 text-right">Running Balance</th>
                      <th className="p-3.5 text-center">Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                          No transactions found for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                            {tx.entryDate}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {tx.entryNumber}
                          </td>
                          <td className="p-3.5 font-semibold text-slate-900 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                              {tx.sourceType || 'manual'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                            {tx.debit > 0 ? money2(tx.debit) : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-blue-700">
                            {tx.credit > 0 ? money2(tx.credit) : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-slate-900">
                            {money2(tx.runningBalance)}
                          </td>
                          <td className="p-3.5 text-center">
                            {tx.attachmentUrl ? (
                              <a
                                href={tx.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex p-1 text-blue-600 hover:text-blue-800"
                                title="View voucher attachment"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
