'use client';

import React, { useEffect, useState } from 'react';
import { ImageUploadField } from './ImageUploadField';
import {
  Bell, Building2, Check, CreditCard, FileKey2, ImagePlus, Landmark,
  Link2, Loader2, Receipt, Save, ShoppingCart, Smartphone, Store,
} from 'lucide-react';

type Tab = 'general' | 'payments' | 'tax' | 'checkout' | 'notifications' | 'api';
type Profile = Record<string, any>;

const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General Profile', icon: <Building2 className="h-4 w-4" /> },
  { id: 'payments', label: 'Payment Gateways', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'tax', label: 'Tax & Regional', icon: <Receipt className="h-4 w-4" /> },
  { id: 'checkout', label: 'Checkout Rules', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'notifications', label: 'Alerts & SMS', icon: <Bell className="h-4 w-4" /> },
  { id: 'api', label: 'API Keys', icon: <FileKey2 className="h-4 w-4" /> },
];

const defaults: Profile = {
  storeName: '', legalName: '', panVatNumber: '', contactEmail: '', contactPhone: '', address: '',
  logoUrl: '', darkLogoUrl: '', faviconUrl: '', invoiceLogoUrl: '', currency: 'NPR',
  vatRatePercent: '13.00', pricesIncludeVat: true, multiCurrencyEnabled: false, calendar: 'AD',
  guestCheckoutEnabled: true, minimumOrderAmount: '0', stockLockMinutes: '15',
  unpaidOrderCancelMinutes: '30', freeDeliveryThreshold: '50000', configuration: {},
};

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: any; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span><input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10" /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm font-semibold text-slate-800">{label}</span><button type="button" aria-pressed={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} /></button></label>;
}



export const SettingsModule: React.FC = () => {
  const [tab, setTab] = useState<Tab>('general');
  const [profile, setProfile] = useState<Profile>(defaults);
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void Promise.all([fetch('/api/settings?type=profile'), fetch('/api/settings?type=payments')]).then(async ([profileRes, paymentsRes]) => {
      const profileData = await profileRes.json();
      const paymentsData = await paymentsRes.json();
      const loadedProfile = profileData.profile || {};
      setProfile({
        ...defaults,
        ...loadedProfile,
        logoUrl: loadedProfile.logoUrl ?? '',
        darkLogoUrl: loadedProfile.darkLogoUrl ?? '',
        faviconUrl: loadedProfile.faviconUrl ?? '',
        invoiceLogoUrl: loadedProfile.invoiceLogoUrl ?? '',
      });
      setPayments(Object.fromEntries((paymentsData.payments || []).map((payment: any) => [payment.method, payment])));
    }).catch(() => setMessage('Could not load settings.')).finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: any) => setProfile((current) => ({ ...current, [key]: value }));
  const config = (key: string) => profile.configuration?.[key] ?? '';
  const setConfig = (key: string, value: any) => set('configuration', { ...(profile.configuration || {}), [key]: value });

  async function save() {
    setSaving(true); setMessage('');
    try {
      // Nullable database columns are represented as null by the API, while the
      // settings validator accepts omitted optional fields rather than null.
      const profilePayload = Object.fromEntries(
        Object.entries(profile).filter(([, value]) => value !== null && value !== undefined),
      );
      const requests = [fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'profile', data: profilePayload }) })];
      for (const method of ['cod', 'esewa', 'khalti', 'bank_transfer']) {
        if (payments[method]) requests.push(fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'payment', data: { method, isEnabled: Boolean(payments[method].isEnabled), merchantId: payments[method].merchantId || undefined } }) }));
      }
      const responses = await Promise.all(requests);
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        const error = await failedResponse.json().catch(() => null) as { error?: string; details?: string[] } | null;
        throw new Error(error?.details?.join(', ') || error?.error || 'Settings could not be saved.');
      }
      window.dispatchEvent(new CustomEvent('store-settings-updated'));
      setMessage('Settings saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Settings could not be saved. Check your admin access.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading store settings...</div>;

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-slate-50 px-4 pt-4"><div className="flex gap-1 overflow-x-auto pb-0">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition ${tab === item.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item.icon}{item.label}</button>)}</div></div>
    <div className="space-y-6 p-5 md:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Store configuration</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{tabs.find((item) => item.id === tab)?.label}</h2></div><button type="button" onClick={save} disabled={saving} className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving' : 'Save changes'}</button></div>
      {message && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />{message}</div>}

      {tab === 'general' && <section className="space-y-6"><div><h3 className="section-title">Business details</h3><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="Store name" value={profile.storeName} onChange={(v) => set('storeName', v)} /><Field label="Registered legal name" value={profile.legalName} onChange={(v) => set('legalName', v)} /><Field label="9-digit PAN / VAT number" value={profile.panVatNumber} onChange={(v) => set('panVatNumber', v)} placeholder="302910482" /><Field label="Support phone number" value={profile.contactPhone} onChange={(v) => set('contactPhone', v)} /><Field label="Public support email" value={profile.contactEmail} onChange={(v) => set('contactEmail', v)} type="email" /><Field label="Store / warehouse address" value={profile.address} onChange={(v) => set('address', v)} /></div></div><div><h3 className="section-title">Brand assets</h3><div className="mt-3 grid gap-4 md:grid-cols-2"><ImageUploadField label="Logo (light mode)" purpose="branding" hint="Shown in the storefront header." value={profile.logoUrl ?? ''} onChange={(v) => set('logoUrl', v)} /><ImageUploadField label="Logo (dark mode)" purpose="branding" value={profile.darkLogoUrl ?? ''} onChange={(v) => set('darkLogoUrl', v)} /><ImageUploadField label="Favicon" purpose="branding" hint="PNG or ICO, 32x32 or larger." value={profile.faviconUrl ?? ''} onChange={(v) => set('faviconUrl', v)} /><ImageUploadField label="Invoice header logo" purpose="branding" value={profile.invoiceLogoUrl ?? ''} onChange={(v) => set('invoiceLogoUrl', v)} /></div></div></section>}

      {tab === 'payments' && <section className="space-y-5"><Gateway title="Cash on Delivery" icon={<Store className="h-5 w-5" />} enabled={payments.cod?.isEnabled ?? true} onToggle={(v) => setPayments({ ...payments, cod: { ...payments.cod, isEnabled: v } })}><Field label="Maximum COD order value (NPR)" value={config('codMaxOrderValue') || '50000'} onChange={(v) => setConfig('codMaxOrderValue', v)} type="number" /></Gateway><Gateway title="Fonepay Direct QR & Merchant API" icon={<Smartphone className="h-5 w-5" />} enabled={payments.fonepay?.isEnabled ?? false} onToggle={(v) => setConfig('fonepayEnabled', v)}><div className="grid gap-4 md:grid-cols-2"><Field label="Merchant ID" value={config('fonepayMerchantId')} onChange={(v) => setConfig('fonepayMerchantId', v)} /><Field label="Secret key" value={config('fonepaySecretKey')} onChange={(v) => setConfig('fonepaySecretKey', v)} type="password" /><ImageUploadField label="Static QR image" purpose="branding" hint="Customers scan this at checkout." value={config('fonepayQrUrl') ?? ''} onChange={(v) => setConfig('fonepayQrUrl', v)} /></div></Gateway><Gateway title="eSewa & Khalti" icon={<CreditCard className="h-5 w-5" />} enabled={Boolean(config('digitalPaymentsEnabled'))} onToggle={(v) => setConfig('digitalPaymentsEnabled', v)}><div className="grid gap-4 md:grid-cols-2"><Field label="Public / merchant key" value={config('digitalPublicKey')} onChange={(v) => setConfig('digitalPublicKey', v)} /><Field label="Secret key" value={config('digitalSecretKey')} onChange={(v) => setConfig('digitalSecretKey', v)} type="password" /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={config('digitalSandbox') === true} onChange={(e) => setConfig('digitalSandbox', e.target.checked)} /> Sandbox mode</label></div></Gateway><Gateway title="Direct bank deposit" icon={<Landmark className="h-5 w-5" />} enabled={Boolean(config('bankDepositEnabled'))} onToggle={(v) => setConfig('bankDepositEnabled', v)}><div className="grid gap-4 md:grid-cols-2"><Field label="Account name" value={config('bankAccountName')} onChange={(v) => setConfig('bankAccountName', v)} /><Field label="Bank name" value={config('bankName')} onChange={(v) => setConfig('bankName', v)} /><Field label="Account number" value={config('bankAccountNumber')} onChange={(v) => setConfig('bankAccountNumber', v)} /><Field label="Branch / SWIFT / IBAN" value={config('bankBranch')} onChange={(v) => setConfig('bankBranch', v)} /><ImageUploadField label="Bank QR image" purpose="branding" hint="Customers scan this to pay by bank transfer." value={config('bankQrUrl') ?? ''} onChange={(v: string) => setConfig('bankQrUrl', v)} /></div></Gateway></section>}

      {tab === 'tax' && <section className="grid gap-4 md:grid-cols-2"><Field label="Currency" value={profile.currency} onChange={(v) => set('currency', v)} /><Field label="Standard VAT rate (%)" value={profile.vatRatePercent} onChange={(v) => set('vatRatePercent', v)} type="number" /><Toggle label="Prices include VAT" checked={Boolean(profile.pricesIncludeVat)} onChange={(v) => set('pricesIncludeVat', v)} /><Toggle label="Enable multi-currency conversion" checked={Boolean(profile.multiCurrencyEnabled)} onChange={(v) => set('multiCurrencyEnabled', v)} /><label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">Order date calendar</span><select value={profile.calendar} onChange={(e) => set('calendar', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="AD">AD (Gregorian)</option><option value="BS">BS (Bikram Sambat)</option></select></label></section>}

      {tab === 'checkout' && <section className="space-y-4"><Toggle label="Allow guest checkout" checked={Boolean(profile.guestCheckoutEnabled)} onChange={(v) => set('guestCheckoutEnabled', v)} /><div className="grid gap-4 md:grid-cols-3"><Field label="Minimum order amount (NPR)" value={profile.minimumOrderAmount} onChange={(v) => set('minimumOrderAmount', v)} type="number" /><Field label="Stock lock duration (minutes)" value={profile.stockLockMinutes} onChange={(v) => set('stockLockMinutes', v)} type="number" /><Field label="Auto-cancel unpaid orders (minutes)" value={profile.unpaidOrderCancelMinutes} onChange={(v) => set('unpaidOrderCancelMinutes', v)} type="number" /></div></section>}

      {tab === 'notifications' && <section className="space-y-4"><Gateway title="SMS gateway" icon={<Smartphone className="h-5 w-5" />} enabled={Boolean(config('smsEnabled'))} onToggle={(v) => setConfig('smsEnabled', v)}><div className="grid gap-4 md:grid-cols-2"><Field label="Provider" value={config('smsProvider') || 'Sparrow SMS'} onChange={(v) => setConfig('smsProvider', v)} placeholder="Sparrow SMS or Aakash SMS" /><Field label="API key" value={config('smsApiKey')} onChange={(v) => setConfig('smsApiKey', v)} type="password" /></div></Gateway><div className="space-y-2"><Toggle label="SMS when order is placed" checked={config('smsOrderPlaced') !== false} onChange={(v) => setConfig('smsOrderPlaced', v)} /><Toggle label="SMS when rider is out for delivery" checked={Boolean(config('smsOutForDelivery'))} onChange={(v) => setConfig('smsOutForDelivery', v)} /><Toggle label="Email invoice after payment completion" checked={config('emailInvoice') !== false} onChange={(v) => setConfig('emailInvoice', v)} /></div></section>}

      {tab === 'api' && <section className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Mobile app API key" value={config('mobileApiKey')} onChange={(v) => setConfig('mobileApiKey', v)} type="password" /><Field label="Webhook signing secret" value={config('webhookSecret')} onChange={(v) => setConfig('webhookSecret', v)} type="password" /></div><div className="space-y-3"><p className="text-sm font-bold text-slate-800">Delivery partner webhooks</p>{['Pathao', 'Nepal Can Move', 'Aramex'].map((name) => <div key={name} className="grid items-center gap-3 md:grid-cols-[180px_1fr] md:gap-5"><span className="text-sm font-semibold text-slate-600">{name}</span><Field label="" value={config(`${name}Webhook`)} onChange={(v) => setConfig(`${name}Webhook`, v)} placeholder="https://..." /></div>)}</div></section>}
    </div>
  </div>;
};

function Gateway({ title, icon, enabled, onToggle, children }: { title: string; icon: React.ReactNode; enabled: boolean; onToggle: (value: boolean) => void; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span><h3 className="font-extrabold text-slate-900">{title}</h3></div><Toggle label={enabled ? 'Enabled' : 'Disabled'} checked={enabled} onChange={onToggle} /></div>{enabled && <div className="mt-4 border-t border-slate-100 pt-4">{children}</div>}</div>;
}
