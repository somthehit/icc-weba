'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';

interface BankReconciliationModalProps {
  accounts: Array<{ id: number; code: string; name: string; type: string }>;
  entries: Array<{
    id: number;
    entryNumber: string;
    entryDate: string;
    description: string;
    debit: string;
    credit: string;
  }>;
  onClose: () => void;
  onCreateManualEntry: (preset: { date: string; amount: number; isDebit: boolean; description: string; accountId: number }) => void;
}

interface ParsedStatementLine {
  id: string;
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance?: number;
  matchedEntryId?: number;
  matchStatus: 'matched' | 'unmatched';
}

const money = (val: number) => `NPR ${Math.round(val).toLocaleString('en-IN')}`;
const money2 = (val: number) =>
  `NPR ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const BankReconciliationModal: React.FC<BankReconciliationModalProps> = ({
  accounts,
  entries,
  onClose,
  onCreateManualEntry,
}) => {
  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && (a.code.startsWith('10') || a.name.toLowerCase().includes('bank'))),
    [accounts],
  );

  const [selectedAccountId, setSelectedAccountId] = useState<number>(() => bankAccounts[0]?.id || 0);
  const [statementText, setStatementText] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedStatementLine[]>([]);
  const [statementBalance, setStatementBalance] = useState('');
  const [hasReconciled, setHasReconciled] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Parse CSV / TSV text pasted by the user
  const handleParseStatement = () => {
    if (!statementText.trim()) return;

    const lines = statementText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: ParsedStatementLine[] = [];
    let lineIdx = 0;

    for (const line of lines) {
      // Split by comma or tab or semicolon
      const parts = line.split(/[,\t;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 3) continue;

      // Ignore header rows
      if (parts[0].toLowerCase().includes('date') || parts[1].toLowerCase().includes('desc')) continue;

      const dateStr = parts[0];
      const desc = parts[1];
      const val1 = parseFloat(parts[2]?.replace(/[^0-9.-]+/g, '') || '0') || 0;
      const val2 = parts[3] ? parseFloat(parts[3]?.replace(/[^0-9.-]+/g, '') || '0') || 0 : 0;

      let withdrawal = 0;
      let deposit = 0;

      if (parts.length >= 4) {
        withdrawal = Math.max(0, val1);
        deposit = Math.max(0, val2);
      } else {
        if (val1 < 0) withdrawal = Math.abs(val1);
        else deposit = val1;
      }

      parsed.push({
        id: `stmt-${++lineIdx}`,
        date: dateStr,
        description: desc,
        withdrawal,
        deposit,
        matchStatus: 'unmatched',
      });
    }

    // Attempt automatic matching with system entries
    const matched = parsed.map((stmt) => {
      const match = entries.find((e) => {
        const debitNum = parseFloat(e.debit) || 0;
        const creditNum = parseFloat(e.credit) || 0;
        const amountMatches =
          (stmt.deposit > 0 && Math.abs(debitNum - stmt.deposit) < 1) ||
          (stmt.withdrawal > 0 && Math.abs(creditNum - stmt.withdrawal) < 1);
        return amountMatches;
      });

      if (match) {
        return {
          ...stmt,
          matchedEntryId: match.id,
          matchStatus: 'matched' as const,
        };
      }
      return stmt;
    });

    setParsedLines(matched);
    setHasReconciled(true);
  };

  const handleLoadSampleStatement = () => {
    const sample = [
      '2026-09-20, Nabil QR Payment Merchant Settled, 0, 89999',
      '2026-09-18, Counter Cash Deposit Ratopool Vault, 0, 124000',
      '2026-09-15, Internet & Fiber Bill Payment, 3500, 0',
      '2026-09-12, Bank SMS & Annual Maintenance Fee, 350, 0',
    ].join('\n');

    setStatementText(sample);
  };

  const stats = useMemo(() => {
    const totalDeposits = parsedLines.reduce((sum, l) => sum + l.deposit, 0);
    const totalWithdrawals = parsedLines.reduce((sum, l) => sum + l.withdrawal, 0);
    const matchedCount = parsedLines.filter((l) => l.matchStatus === 'matched').length;
    const unmatchedCount = parsedLines.filter((l) => l.matchStatus === 'unmatched').length;
    return { totalDeposits, totalWithdrawals, matchedCount, unmatchedCount };
  }, [parsedLines]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Bank Account Statement Reconciliation
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Match official bank statement records (CSV / Text) with internal General Ledger accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Bank Account selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Bank / Treasury Account to Reconcile
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleStatement}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Load Sample Statement
              </button>
            </div>
          </div>

          {/* Paste CSV section if not reconciled */}
          {!hasReconciled ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Paste Bank Statement Lines (CSV / TSV format: Date, Description, Withdrawal, Deposit)
              </label>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                placeholder="2026-09-20, Nabil QR Payment, 0, 89999&#10;2026-09-18, Internet Bill, 3500, 0"
                rows={7}
                className="w-full rounded-2xl border border-slate-200 p-4 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseStatement}
                  disabled={!statementText.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Parse &amp; Match Statement</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Statement Deposits
                  </span>
                  <p className="text-sm font-mono font-black text-emerald-800 mt-1">
                    {money(stats.totalDeposits)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Statement Withdrawals
                  </span>
                  <p className="text-sm font-mono font-black text-rose-800 mt-1">
                    {money(stats.totalWithdrawals)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Matched Lines
                  </span>
                  <p className="text-sm font-mono font-black text-emerald-900 mt-1">
                    {stats.matchedCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Unmatched
                  </span>
                  <p className="text-sm font-mono font-black text-amber-900 mt-1">
                    {stats.unmatchedCount}
                  </p>
                </div>
              </div>

              {/* Parsed & Matched lines table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Statement Description</th>
                      <th className="p-3.5 text-right">Debit / Deposit</th>
                      <th className="p-3.5 text-right">Credit / Withdrawal</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedLines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                          {line.date}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">{line.description}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                          {line.deposit > 0 ? money2(line.deposit) : '—'}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                          {line.withdrawal > 0 ? money2(line.withdrawal) : '—'}
                        </td>
                        <td className="p-3.5 text-center">
                          {line.matchStatus === 'matched' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                              <AlertCircle className="h-3 w-3" /> Needs Entry
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          {line.matchStatus === 'unmatched' && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onCreateManualEntry({
                                  date: line.date,
                                  amount: line.deposit || line.withdrawal,
                                  isDebit: line.deposit > 0,
                                  description: line.description,
                                  accountId: selectedAccountId,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-bold hover:bg-slate-800"
                              title="Create journal voucher for this bank transaction"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Create Voucher</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setHasReconciled(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Clear &amp; Re-paste Statement
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
