'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Star,
  RefreshCw,
  Building2,
  Smartphone,
  CreditCard,
  ExternalLink,
  Eye,
  Sliders,
  Check,
  X,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';

export interface BankQrRecord {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrType: string;
  merchantCode?: string | null;
  qrImageUrl?: string | null;
  qrPayloadTemplate?: string | null;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
  instructions?: string | null;
  createdAt: string;
}

const PRESETS = [
  {
    name: 'Nabil Bank (Fonepay)',
    type: 'fonepay',
    merchant: 'ICC-NABIL-01',
    instructions: 'Scan with Nabil Smart, Fonepay, Global, Siddhartha or any Mobile Banking App',
    template: 'fonepay://pay?merchant=ICC-NABIL-01&amount={amount}&remarks={orderId}',
  },
  {
    name: 'NIC Asia Bank (Smart QR)',
    type: 'smart_qr',
    merchant: 'NIC-ICC-DHG-99',
    instructions: 'Scan with MoBank, Smart QR or any NepalPay supported mobile banking app',
    template: 'smartqr://pay?merchant=NIC-ICC-DHG-99&amount={amount}&remarks={orderId}',
  },
  {
    name: 'eSewa Merchant QR',
    type: 'esewa',
    merchant: 'ESEWA-ICC-RETAIL',
    instructions: 'Scan with eSewa App or any linked partner wallet',
    template: 'esewa://pay?merchant=ESEWA-ICC-RETAIL&amount={amount}&remarks={orderId}',
  },
  {
    name: 'Global IME Bank (NepalPay)',
    type: 'bank_nepal_pay',
    merchant: 'GIBL-ICC-04',
    instructions: 'Scan with Global Smart Plus or NepalPay network apps',
    template: 'nepalpay://pay?merchant=GIBL-ICC-04&amount={amount}&remarks={orderId}',
  },
  {
    name: 'Khalti Merchant QR',
    type: 'khalti',
    merchant: 'KHALTI-ICC-01',
    instructions: 'Scan with Khalti Digital Wallet app',
    template: 'khalti://pay?merchant=KHALTI-ICC-01&amount={amount}&remarks={orderId}',
  },
];

export const PosBankQrManager: React.FC = () => {
  const [qrList, setQrList] = useState<BankQrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BankQrRecord | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testAmount, setTestAmount] = useState('5000');
  const [previewQrMap, setPreviewQrMap] = useState<Record<string, string>>({});

  // Form State
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('Intel Computer Center Pvt. Ltd.');
  const [accountNumber, setAccountNumber] = useState('');
  const [qrType, setQrType] = useState('fonepay');
  const [merchantCode, setMerchantCode] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [qrPayloadTemplate, setQrPayloadTemplate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  const fetchQrs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/pos/qr-codes');
      const data = await res.json();
      if (data.success && data.qrCodes) {
        setQrList(data.qrCodes);
        generateQrPreviews(data.qrCodes, testAmount);
      }
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', message: 'Failed to load bank QR codes.' });
    } finally {
      setIsLoading(false);
    }
  };

  const generateQrPreviews = async (list: BankQrRecord[], amount: string) => {
    const map: Record<string, string> = {};
    for (const item of list) {
      if (item.qrImageUrl) {
        map[item.id] = item.qrImageUrl;
      } else {
        try {
          const payload = (item.qrPayloadTemplate || `bankqr://${item.bankName}?acc=${item.accountNumber}&amt={amount}`)
            .replace('{amount}', amount)
            .replace('{orderId}', 'TEST-ORD');
          const dataUrl = await QRCode.toDataURL(payload, {
            width: 180,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          map[item.id] = dataUrl;
        } catch {
          // fallback
        }
      }
    }
    setPreviewQrMap(map);
  };

  useEffect(() => {
    fetchQrs();
  }, []);

  useEffect(() => {
    if (qrList.length > 0) {
      generateQrPreviews(qrList, testAmount);
    }
  }, [testAmount]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setBankName('Nabil Bank (Fonepay)');
    setAccountName('Intel Computer Center Pvt. Ltd.');
    setAccountNumber('');
    setQrType('fonepay');
    setMerchantCode('ICC-NABIL-01');
    setQrImageUrl('');
    setQrPayloadTemplate('fonepay://pay?merchant=ICC-NABIL-01&amount={amount}&remarks={orderId}');
    setInstructions('Scan with Nabil Smart, Fonepay, or any Mobile Banking App');
    setIsActive(true);
    setIsDefault(qrList.length === 0);
    setDisplayOrder(String(qrList.length + 1));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: BankQrRecord) => {
    setEditingItem(item);
    setBankName(item.bankName);
    setAccountName(item.accountName);
    setAccountNumber(item.accountNumber);
    setQrType(item.qrType);
    setMerchantCode(item.merchantCode || '');
    setQrImageUrl(item.qrImageUrl || '');
    setQrPayloadTemplate(item.qrPayloadTemplate || '');
    setInstructions(item.instructions || '');
    setIsActive(item.isActive);
    setIsDefault(item.isDefault);
    setDisplayOrder(String(item.displayOrder || 0));
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setBankName(preset.name);
    setQrType(preset.type);
    setMerchantCode(preset.merchant);
    setQrPayloadTemplate(preset.template);
    setInstructions(preset.instructions);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      alert('Please fill out Bank Name, Account Name, and Account/Wallet Number.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: editingItem?.id,
        bankName,
        accountName,
        accountNumber,
        qrType,
        merchantCode: merchantCode || null,
        qrImageUrl: qrImageUrl || null,
        qrPayloadTemplate: qrPayloadTemplate || null,
        instructions: instructions || null,
        isActive,
        isDefault,
        displayOrder: parseInt(displayOrder, 10) || 0,
      };

      const res = await fetch('/api/admin/pos/qr-codes', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save QR configuration.');
      }

      setNotice({ type: 'success', message: data.message || 'Saved successfully!' });
      setIsModalOpen(false);
      fetchQrs();
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: BankQrRecord) => {
    try {
      const res = await fetch('/api/admin/pos/qr-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', message: `${item.bankName} status updated.` });
        fetchQrs();
        setTimeout(() => setNotice(null), 3000);
      }
    } catch {
      alert('Failed to update status.');
    }
  };

  const handleSetDefault = async (item: BankQrRecord) => {
    try {
      const res = await fetch('/api/admin/pos/qr-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isDefault: true, isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', message: `${item.bankName} set as primary default POS QR.` });
        fetchQrs();
        setTimeout(() => setNotice(null), 3000);
      }
    } catch {
      alert('Failed to set default.');
    }
  };

  const handleDelete = async (item: BankQrRecord) => {
    if (!confirm(`Are you sure you want to delete "${item.bankName}" QR code?`)) return;
    try {
      const res = await fetch(`/api/admin/pos/qr-codes?id=${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotice({ type: 'success', message: `${item.bankName} deleted.` });
        fetchQrs();
        setTimeout(() => setNotice(null), 3000);
      }
    } catch {
      alert('Failed to delete.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            notice.type === 'success'
              ? 'bg-slate-900 border-slate-700 text-white shadow-md'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-slate-900 text-white">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                POS Bank & Wallet Dynamic QRs
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Configure multiple bank and wallet payment QRs (Fonepay, Nabil, NIC Asia, eSewa, NepalPay) displayed on the Counter POS checkout screen.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchQrs}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add Bank QR
          </button>
        </div>
      </div>

      {/* Test QR Amount Live Preview Simulator */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-slate-600" />
          <span className="font-bold text-slate-800">Dynamic Amount Simulator:</span>
          <span className="text-slate-500">Test how the bill amount embeds inside dynamic QRs:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-600">NPR</span>
          <input
            type="number"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            className="w-28 px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 outline-none focus:border-slate-800 text-xs"
            placeholder="5000"
          />
        </div>
      </div>

      {/* Bank QR Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-600" />
          Loading Bank & Wallet QR profiles...
        </div>
      ) : qrList.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <QrCode className="h-10 w-10 mx-auto text-slate-400 stroke-1" />
          <p className="font-bold text-slate-700">No Bank QR codes configured yet.</p>
          <p className="max-w-md mx-auto text-slate-500">
            Click &quot;Add Bank QR&quot; to set up Nabil Fonepay, NIC Asia Smart QR, eSewa, or other bank payment accounts.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm"
          >
            + Create First Bank QR
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {qrList.map((item) => {
            const previewUrl = previewQrMap[item.id];
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between p-5 rounded-3xl border transition bg-white shadow-xs ${
                  item.isDefault
                    ? 'border-slate-900 ring-2 ring-slate-900/10'
                    : item.isActive
                    ? 'border-slate-200 hover:border-slate-300'
                    : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  {/* Top Bar with Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black uppercase text-slate-900 tracking-tight">
                          {item.bankName}
                        </span>
                        {item.isDefault && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        Type: {item.qrType}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.isActive ? 'Active on POS (Click to disable)' : 'Inactive (Click to enable)'}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                        item.isActive
                          ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  {/* QR Image Preview & Details */}
                  <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-3">
                    <div className="w-24 h-24 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-1.5 shrink-0 shadow-xs">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={item.bankName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-16 h-16 text-slate-800" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Account Name</span>
                        <p className="text-xs font-bold text-slate-900 truncate">{item.accountName}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Account / Number</span>
                        <p className="text-xs font-mono font-bold text-slate-800 truncate">{item.accountNumber}</p>
                      </div>
                      {item.merchantCode && (
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Merchant Code</span>
                          <p className="text-[11px] font-mono font-semibold text-slate-600 truncate">{item.merchantCode}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {item.instructions && (
                    <p className="text-[11px] text-slate-500 italic mb-4 leading-relaxed">
                      &quot;{item.instructions}&quot;
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  {!item.isDefault ? (
                    <button
                      onClick={() => handleSetDefault(item)}
                      className="text-[11px] font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 transition"
                    >
                      <Star className="h-3 w-3" />
                      Make Default
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500">Primary POS QR</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                      title="Edit QR Profile"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                      title="Delete QR Profile"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingItem ? 'Edit Bank QR Profile' : 'Add Bank / Wallet QR Profile'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Setup dynamic payment QR configuration for the Counter POS checkout.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Presets */}
            {!editingItem && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Nepal Bank / Wallet Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bank / Provider Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Nabil Bank (Fonepay)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Intel Computer Center Pvt. Ltd."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account / Wallet Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 01201017500123"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    QR Type / Protocol
                  </label>
                  <select
                    value={qrType}
                    onChange={(e) => setQrType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                  >
                    <option value="fonepay">Fonepay Network (Nabil/Global/etc)</option>
                    <option value="smart_qr">Smart QR / NepalPay</option>
                    <option value="esewa">eSewa Merchant</option>
                    <option value="khalti">Khalti Merchant</option>
                    <option value="bank_nepal_pay">NepalPay Direct</option>
                    <option value="custom">Custom Static/Dynamic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Merchant Code / ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={merchantCode}
                    onChange={(e) => setMerchantCode(e.target.value)}
                    placeholder="e.g. ICC-NABIL-01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-semibold text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Static QR Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={qrImageUrl}
                    onChange={(e) => setQrImageUrl(e.target.value)}
                    placeholder="https://.../my-bank-qr-sticker.png (leave blank to auto-generate dynamic QR)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dynamic QR Payload Template (Optional)
                  </label>
                  <input
                    type="text"
                    value={qrPayloadTemplate}
                    onChange={(e) => setQrPayloadTemplate(e.target.value)}
                    placeholder="fonepay://pay?merchant=ICC-NABIL-01&amount={amount}&remarks={orderId}"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 outline-none focus:border-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Use <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">&#123;amount&#125;</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">&#123;orderId&#125;</code> for real-time bill amount injection.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cashier & Customer Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Scan via Nabil Smart or any Fonepay supported banking app"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  Active on POS Terminals
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded text-slate-900 focus:ring-slate-900"
                  />
                  Set as Default Primary QR
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingItem ? 'Update QR' : 'Create QR Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
