'use client';

// components/admin/AccountingModule.tsx
//
// Accounting & general ledger: chart of accounts, journal entries, and COD driver
// settlements.
//
// The manual journal was previously one debit and one credit picked from two
// selects, which cannot express a real entry — an expense with VAT is three lines.
// It is now a line repeater with a live balance guard, and the post button stays
// disabled until debits equal credits.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BanknoteArrowUp,
  CheckCircle2,
  DollarSign,
  FilePlus2,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Truck,
  Wallet,
  X,
} from 'lucide-react';

import type { Order, Product } from '@/types';
import { UploadButton } from './ImageUploadField';

interface AccountingModuleProps {
  orders: Order[];
  products: Product[];
}

type Account = { id: number; code: string; name: string; type: string };
type Entry = {
  id: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType: string | null;
  attachmentUrl: string | null;
  debit: string;
  credit: string;
};
type Balance = { accountId: number; debit: string; credit: string };
type Settlement = {
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
};

/** A row in the manual journal repeater. `debit`/`credit` stay strings so a cleared field stays cleared. */
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

/** Reads a response without assuming it parses — an empty 500 body must not throw. */
async function readJson(response: Response): Promise<any> {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const TRANSIT_CODE = '1250';

export const AccountingModule: React.FC<AccountingModuleProps> = ({ orders, products }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [outstandingTransit, setOutstandingTransit] = useState(0);

  const [tab, setTab] = useState<'overview' | 'coa' | 'journal' | 'cod'>('overview');
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);

  // Manual journal
  const [showJournal, setShowJournal] = useState(false);
  const [jeDate, setJeDate] = useState(today);
  const [jeReference, setJeReference] = useState('');
  const [jeDescription, setJeDescription] = useState('');
  const [jeAttachment, setJeAttachment] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(), newLine()]);
  const [postingJe, setPostingJe] = useState(false);
  const [jeError, setJeError] = useState('');

  // COD settlement
  const [showCod, setShowCod] = useState(false);
  const [codDriver, setCodDriver] = useState('');
  const [codOrder, setCodOrder] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [codDeposit, setCodDeposit] = useState('');
  const [codBankRef, setCodBankRef] = useState('');
  const [codAttachment, setCodAttachment] = useState('');
  const [postingCod, setPostingCod] = useState(false);
  const [codError, setCodError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledgerRes, codRes] = await Promise.all([
        fetch('/api/accounting'),
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paidRevenue = useMemo(
    () =>
      orders
        .filter((o) => o.paymentStatus === 'paid' || o.paymentStatus === 'verified')
        .reduce((sum, o) => sum + o.totalAmount, 0),
    [orders],
  );

  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.stockQuantity * (p.mrp || p.sellingPrice), 0),
    [products],
  );

  const accountBalance = (accountId: number, type: string) => {
    const row = balances.find((b) => b.accountId === accountId);
    const value = Number(row?.debit ?? 0) - Number(row?.credit ?? 0);
    // Liability, equity and revenue are credit-natured, so a credit surplus is a
    // positive balance for them.
    return ['liability', 'equity', 'revenue'].includes(type) ? -value : value;
  };

  /** Asset accounts money can be deposited into, minus the transit account itself. */
  const depositAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && a.code !== TRANSIT_CODE),
    [accounts],
  );

  // ---- Journal totals ----------------------------------------------------
  const totalDebit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0),
    [lines],
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0),
    [lines],
  );
  const difference = totalDebit - totalCredit;

  /** Lines that will actually be sent: an account plus exactly one non-zero side. */
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

  /**
   * Typing in one column clears the other.
   *
   * `journal_lines` has a CHECK allowing a value on exactly one side, so a line
   * carrying both would be rejected at insert. Enforcing it as you type is clearer
   * than surfacing a constraint error after submit.
   */
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
      setJeError('Debits and credits must balance, across at least two complete lines.');
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
        setJeError(data.details?.join(', ') ?? data.error ?? `Could not post the entry (${response.status}).`);
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
        setCodError(data.details?.join(', ') ?? data.error ?? `Could not record the settlement (${response.status}).`);
        return;
      }

      setShowCod(false);
      setCodDriver('');
      setCodOrder('');
      setCodAmount('');
      setCodBankRef('');
      setCodAttachment('');
      setNotice({
        text: `Settlement ${data.settlement?.settlementNumber ?? ''} recorded and posted to the ledger.`,
        kind: 'success',
      });
      await load();
    } catch {
      setCodError('Could not reach the accounting service.');
    } finally {
      setPostingCod(false);
    }
  };

  const selectedDeposit = depositAccounts.find((a) => String(a.id) === codDeposit);
  const codPreview = Number(codAmount) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Accounting &amp; General Ledger</h2>
          <p className="mt-1 text-xs text-slate-500">
            Double-entry records for revenue, inventory, VAT, expenses, and cash.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void load()}
            title="Reload"
            className="rounded-xl border border-slate-200 bg-white p-2.5"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setCodError('');
              setCodDeposit((prev) => prev || String(depositAccounts[0]?.id ?? ''));
              setShowCod(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <BanknoteArrowUp className="h-4 w-4" />
            COD settlement
          </button>
          <button
            onClick={() => {
              resetJournal();
              setShowJournal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            <FilePlus2 className="h-4 w-4" />
            Manual journal
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-bold ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.kind === 'error' ? (
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<DollarSign />} label="Paid revenue" value={money(paidRevenue)} />
        <Metric icon={<Wallet />} label="Inventory value" value={money(inventoryValue)} />
        <Metric icon={<Scale />} label="Posted entries" value={entries.length.toLocaleString()} />
        <Metric
          icon={<Truck />}
          label="Cash still with drivers"
          value={money(outstandingTransit)}
          tone={outstandingTransit > 0 ? 'warn' : 'default'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        {([
          ['overview', 'Overview'],
          ['coa', 'Chart of Accounts'],
          ['journal', 'Journal Entries'],
          ['cod', `COD Settlements${settlements.length ? ` (${settlements.length})` : ''}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${
              tab === id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {accounts.slice(0, 8).map((account) => (
            <div key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-400">{account.code}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                  {account.type}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-extrabold text-slate-900">{account.name}</h3>
              <p className="mt-2 text-lg font-black text-slate-950">
                {money(accountBalance(account.id, account.type))}
              </p>
            </div>
          ))}
          {accounts.length === 0 && !loading && (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No accounts in the chart of accounts.
            </p>
          )}
        </div>
      )}

      {tab === 'coa' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Code</th>
                <th className="p-4">Account</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="p-4 font-mono text-slate-500">{account.code}</td>
                  <td className="p-4 font-bold text-slate-900">{account.name}</td>
                  <td className="p-4 capitalize text-slate-500">{account.type}</td>
                  <td className="p-4 text-right font-black">
                    {money(accountBalance(account.id, account.type))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {accounts.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-500">No accounts yet.</p>
          )}
        </div>
      )}

      {tab === 'journal' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Entry</th>
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4">Source</th>
                <th className="p-4 text-right">Debit</th>
                <th className="p-4 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="p-4 font-mono font-bold text-blue-600">
                    <span className="inline-flex items-center gap-1">
                      {entry.entryNumber}
                      {entry.attachmentUrl && (
                        <a href={entry.attachmentUrl} target="_blank" rel="noreferrer" title="Voucher">
                          <Paperclip className="h-3 w-3 text-slate-400" />
                        </a>
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{entry.entryDate}</td>
                  <td className="p-4 font-semibold text-slate-800">{entry.description}</td>
                  <td className="p-4">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                      {entry.sourceType ?? 'manual'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold">{money2(Number(entry.debit))}</td>
                  <td className="p-4 text-right font-bold">{money2(Number(entry.credit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-500">
              No journal entries posted yet.
            </p>
          )}
        </div>
      )}

      {tab === 'cod' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-4">Settlement</th>
                <th className="p-4">Driver / Agent</th>
                <th className="p-4">Order ref</th>
                <th className="p-4">Deposited to</th>
                <th className="p-4">Bank ref</th>
                <th className="p-4">Entry</th>
                <th className="p-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td className="p-4 font-mono font-bold text-emerald-700">
                    <span className="inline-flex items-center gap-1">
                      {s.settlementNumber}
                      {s.attachmentUrl && (
                        <a href={s.attachmentUrl} target="_blank" rel="noreferrer" title="Deposit slip">
                          <Paperclip className="h-3 w-3 text-slate-400" />
                        </a>
                      )}
                    </span>
                    <div className="font-sans text-[10px] font-normal text-slate-400">
                      {new Date(s.settledAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-900">{s.driverName}</td>
                  <td className="p-4 text-slate-500">{s.orderReference ?? '—'}</td>
                  <td className="p-4 text-slate-600">
                    {s.depositAccountCode ? `${s.depositAccountCode} · ${s.depositAccountName}` : '—'}
                  </td>
                  <td className="p-4 font-mono text-slate-500">{s.bankReference ?? '—'}</td>
                  <td className="p-4 font-mono text-[10px] text-blue-600">{s.entryNumber ?? '—'}</td>
                  <td className="p-4 text-right font-black">{money2(Number(s.collectedAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {settlements.length === 0 && (
            <p className="p-6 text-center text-xs text-slate-500">
              No COD settlements recorded yet.
            </p>
          )}
        </div>
      )}

      {/* ================= ADVANCED MANUAL JOURNAL ================= */}
      {showJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={postJournal}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Create manual journal entry</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Multi-line double entry with live balance validation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowJournal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">Entry date</span>
                  <input
                    type="date"
                    required
                    value={jeDate}
                    onChange={(e) => setJeDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">Reference / Invoice #</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={jeReference}
                    onChange={(e) => setJeReference(e.target.value)}
                    placeholder="e.g. INV-2026-99"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </label>
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-600">Voucher / slip</span>
                  {/* Uses the private `documents` bucket via the shared upload route. */}
                  <div className="flex items-center gap-2">
                    <UploadButton
                      purpose="payment-proof"
                      onUploaded={([url]) => setJeAttachment(url)}
                      title="Attach a receipt or bank slip"
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {jeAttachment ? 'Replace' : 'Attach'}
                    </UploadButton>
                    {jeAttachment && (
                      <button
                        type="button"
                        onClick={() => setJeAttachment('')}
                        className="text-[10px] font-bold text-rose-600 hover:underline"
                      >
                        remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Description / particulars</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={300}
                  value={jeDescription}
                  onChange={(e) => setJeDescription(e.target.value)}
                  placeholder="e.g. Monthly rent expense and VAT adjustment"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                />
              </label>

              {/* Line repeater */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-3">Account</th>
                      <th className="p-3">Line memo</th>
                      <th className="p-3 text-right">Debit (NPR)</th>
                      <th className="p-3 text-right">Credit (NPR)</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line) => (
                      <tr key={line.key} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <select
                            value={line.accountId}
                            onChange={(e) => patchLine(line.key, { accountId: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                          >
                            <option value="">Select account…</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} · {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            maxLength={300}
                            value={line.memo}
                            onChange={(e) => patchLine(line.key, { memo: e.target.value })}
                            placeholder="Optional"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.debit}
                            onChange={(e) => setAmount(line.key, 'debit', e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.credit}
                            onChange={(e) => setAmount(line.key, 'credit', e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            // Two lines is the minimum a double entry can have.
                            disabled={lines.length <= 2}
                            onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                            title={lines.length <= 2 ? 'An entry needs at least two lines' : 'Remove line'}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, newLine()])}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add line
                  </button>
                  <div className="flex items-center gap-5 font-mono text-xs font-bold">
                    <span className="text-slate-500">
                      Debit <span className="text-slate-900">{money2(totalDebit)}</span>
                    </span>
                    <span className="text-slate-500">
                      Credit <span className="text-slate-900">{money2(totalCredit)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance guard */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs font-bold ${
                  isBalanced
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isBalanced ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Balanced — {usableLines.length} lines ready to post.
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      {totalDebit === 0 && totalCredit === 0
                        ? 'Enter amounts on at least two lines.'
                        : usableLines.length < 2
                          ? 'Each line needs an account and a value on exactly one side.'
                          : 'Unbalanced — debits must equal credits.'}
                    </>
                  )}
                </span>
                <span className="font-mono">Difference {money2(Math.abs(difference))}</span>
              </div>

              {jeError && (
                <p className="flex items-start gap-1.5 rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {jeError}
                </p>
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setShowJournal(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isBalanced || postingJe}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {postingJe ? 'Posting…' : 'Post journal entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= COD SETTLEMENT ================= */}
      {showCod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={postSettlement}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-black text-slate-900">COD driver cash settlement</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Banks cash collected on delivery and posts the ledger entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCod(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Driver / courier agent</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={150}
                  value={codDriver}
                  onChange={(e) => setCodDriver(e.target.value)}
                  placeholder="e.g. Ram Bahadur (Ba 2 Pa 4589)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">Order # / reference</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={codOrder}
                    onChange={(e) => setCodOrder(e.target.value)}
                    placeholder="e.g. ICE-2026-8841"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">Amount collected (NPR)</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-bold outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Deposit target account</span>
                <select
                  required
                  value={codDeposit}
                  onChange={(e) => setCodDeposit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="">Select an account…</option>
                  {depositAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
                {depositAccounts.length === 0 && (
                  <span className="text-[10px] text-rose-600">
                    No asset accounts available — add a bank or cash account first.
                  </span>
                )}
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Bank voucher / deposit slip ref</span>
                <input
                  type="text"
                  maxLength={80}
                  value={codBankRef}
                  onChange={(e) => setCodBankRef(e.target.value)}
                  placeholder="e.g. DEP-2026-004812"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </label>

              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-600">Deposit slip attachment</span>
                <div className="flex items-center gap-2">
                  <UploadButton
                    purpose="payment-proof"
                    onUploaded={([url]) => setCodAttachment(url)}
                    title="Attach the deposit slip"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {codAttachment ? 'Replace' : 'Attach'}
                  </UploadButton>
                  {codAttachment && (
                    <button
                      type="button"
                      onClick={() => setCodAttachment('')}
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      remove
                    </button>
                  )}
                </div>
              </div>

              {/* Ledger preview — the exact entry that will be posted. */}
              <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
                <p className="font-bold">Journal entry to be posted</p>
                <p>
                  <b>DEBIT</b>{' '}
                  {selectedDeposit ? `${selectedDeposit.code} ${selectedDeposit.name}` : 'deposit account'}{' '}
                  <span className="font-mono">+{money2(codPreview)}</span>
                </p>
                <p>
                  <b>CREDIT</b> {TRANSIT_CODE} Cash in Transit (Driver){' '}
                  <span className="font-mono">−{money2(codPreview)}</span>
                </p>
                <p className="pt-1 text-[10px] text-emerald-700">
                  Both lines and the settlement record are written in one transaction, so a
                  settlement can never exist without its balanced entry.
                </p>
              </div>

              {codError && (
                <p className="flex items-start gap-1.5 rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {codError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCod(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={postingCod || codPreview <= 0 || !codDeposit}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {postingCod ? 'Posting…' : 'Confirm settlement & post JE'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

function Metric({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
        }`}
      >
        {icon}
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
