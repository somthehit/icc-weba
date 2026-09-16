'use client';

// components/admin/SeoModule.tsx
//
// The SEO engine's console.
//
// Everything a search engine reads used to be a string literal in
// `hooks/useSeoMeta.ts`, so fixing a meta description meant a code deploy — and
// the literals had drifted from the shop they describe. This module owns four
// concerns, one per tab:
//
//   global    site-wide title/description/OG defaults + Sudurpashchim targeting
//   pages     per-route overrides, keyed on the storefront's `currentPage`
//   products  the per-SKU title/description matrix
//   sitemap   what gets indexed, and the robots/sitemap policy
//
// The previews on the right render from the same `settings` object the form edits
// and the storefront resolves, so what is shown is what will ship — no separate
// mock string to fall out of date.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Globe2,
  Layers,
  Loader2,
  MapPin,
  Package,
  Save,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';

import {
  SUDURPASHCHIM_CONFIG,
  SUDURPASHCHIM_DISTRICTS,
  SAME_DAY_HUBS,
} from '@/config/regional';
import { DEFAULT_PAGE_META, DEFAULT_SEO_SETTINGS } from '@/lib/seo/defaults';
import { areaServed, buildLocalBusinessPreview } from '@/lib/seo/jsonld';
import {
  SITEMAP_FREQUENCIES,
  type ProductSeoRow,
  type SeoPageMeta,
  type SeoSettings,
  type SitemapFrequency,
} from '@/lib/seo/types';

import { ImageUploadField } from './ImageUploadField';
import { CharCount } from './shared';

type Tab = 'global' | 'pages' | 'products' | 'sitemap';

/** A notice carries its kind so a failure cannot render as a green tick. */
type Notice = { text: string; kind: 'success' | 'error' | 'info' } | null;

const TABS: Array<[Tab, string, React.ElementType]> = [
  ['global', 'Global Store SEO', Globe2],
  ['pages', 'Page Meta & Routes', Layers],
  ['products', 'Product SEO Matrix', Package],
  ['sitemap', 'Sitemap & Indexing', Search],
];

/** Google truncates around here; the counters warn rather than block. */
const TITLE_TARGET = 60;
const DESC_TARGET = 160;

const BUSINESS_TYPES = [
  'ComputerStore',
  'ElectronicsStore',
  'HardwareStore',
  'Store',
  'LocalBusiness',
] as const;

const describe = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

// ---------------------------------------------------------------------------
// Small presentational pieces, declared at module scope so typing in a field
// does not remount it and drop the caret.
// ---------------------------------------------------------------------------

const Label: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => (
  <div className="mb-1 flex items-center justify-between gap-2">
    <span className="text-xs font-bold text-slate-700">{text}</span>
    {children}
  </div>
);

const textInput =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

const Text: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  target?: number;
  hint?: string;
  placeholder?: string;
  mono?: boolean;
}> = ({ label, value, onChange, max, target, hint, placeholder, mono }) => (
  <div>
    <Label text={label}>
      {target ? (
        <span
          className={`font-mono text-[10px] ${
            value.length > target ? 'font-bold text-amber-600' : 'text-slate-400'
          }`}
        >
          {value.length}/{target}
        </span>
      ) : max ? (
        <CharCount value={value} max={max} />
      ) : null}
    </Label>
    <input
      type="text"
      value={value}
      maxLength={max}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${textInput} ${mono ? 'font-mono text-[11px]' : ''}`}
    />
    {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const Area: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  target?: number;
  max?: number;
  hint?: string;
}> = ({ label, value, onChange, rows = 3, target, max, hint }) => (
  <div>
    <Label text={label}>
      {target ? (
        <span
          className={`font-mono text-[10px] ${
            value.length > target ? 'font-bold text-amber-600' : 'text-slate-400'
          }`}
        >
          {value.length}/{target}
        </span>
      ) : null}
    </Label>
    <textarea
      rows={rows}
      value={value}
      maxLength={max}
      onChange={(e) => onChange(e.target.value)}
      className={textInput}
    />
    {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

const Check1: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label
    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
      checked ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 h-4 w-4 accent-[#0056b3]"
    />
    <span className="min-w-0">
      <span className="block text-xs font-bold text-slate-800">{label}</span>
      {description && (
        <span className="block text-[10px] leading-snug text-slate-500">{description}</span>
      )}
    </span>
  </label>
);

const Pick: React.FC<{
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  render?: (value: string) => string;
  hint?: string;
}> = ({ label, value, options, onChange, render, hint }) => (
  <div>
    <Label text={label} />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={textInput}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {render ? render(option) : option}
        </option>
      ))}
    </select>
    {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
  </div>
);

/** Empty-state row, so a failed fetch does not look like "no data". */
const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
    {text}
  </div>
);

// ---------------------------------------------------------------------------

export const SeoModule: React.FC<{
  logAuditAction?: (module: string, action: string, details: string) => void;
}> = ({ logAuditAction }) => {
  const [tab, setTab] = useState<Tab>('global');
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS);
  const [pages, setPages] = useState<SeoPageMeta[]>(DEFAULT_PAGE_META);
  const [catalog, setCatalog] = useState<ProductSeoRow[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [persisted, setPersisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  /**
   * One place that turns a fetch into either data or a thrown Error.
   *
   * The console previously read `response.json()` without checking `ok`, which
   * made a 401 from the role guard indistinguishable from an empty table.
   */
  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    const raw = await response.text();
    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    if (!response.ok) {
      throw new Error(
        payload.error ||
          (response.status === 401 || response.status === 403
            ? 'Your session does not have permission to manage SEO.'
            : `Request failed (${response.status}).`),
      );
    }
    return payload as T;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await request<{
          settings: SeoSettings;
          pages: SeoPageMeta[];
          persisted: boolean;
        }>('/api/v1/seo');
        if (cancelled) return;
        setSettings({ ...DEFAULT_SEO_SETTINGS, ...data.settings });
        setPages(data.pages?.length ? data.pages : DEFAULT_PAGE_META);
        setPersisted(Boolean(data.persisted));
        if (!data.persisted) {
          setNotice({
            kind: 'info',
            text: 'No saved SEO record yet — showing the built-in Sudurpashchim defaults. Publish to make them editable.',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ kind: 'error', text: describe(error, 'Could not load SEO settings.') });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  // The product matrix is a heavier read, so it is only fetched when its tab is
  // first opened rather than on mount with everything else.
  useEffect(() => {
    if (tab !== 'products' || catalog.length) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await request<{ products: ProductSeoRow[] }>(
          '/api/v1/seo?include=products&limit=200',
        );
        if (!cancelled) setCatalog(data.products ?? []);
      } catch (error) {
        if (!cancelled) {
          setNotice({ kind: 'error', text: describe(error, 'Could not load the product catalogue.') });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, catalog.length, request]);

  const set = <K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const patchPage = (pageKey: string, changes: Partial<SeoPageMeta>) =>
    setPages((prev) =>
      prev.map((page) => (page.pageKey === pageKey ? { ...page, ...changes } : page)),
    );

  const patchProduct = (id: number, changes: Partial<ProductSeoRow>) =>
    setCatalog((prev) => prev.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const save = async (type: Tab) => {
    setSaving(true);
    setNotice(null);
    try {
      if (type === 'products') {
        const dirty = catalog.filter((row) => row.metaTitle || row.metaDescription);
        if (!dirty.length) {
          setNotice({ kind: 'error', text: 'Nothing to save — no product overrides entered.' });
          return;
        }
        await request('/api/v1/seo', {
          method: 'PUT',
          body: JSON.stringify({
            type: 'products',
            data: dirty.map((row) => ({
              id: row.id,
              metaTitle: row.metaTitle ?? '',
              metaDescription: row.metaDescription ?? '',
            })),
          }),
        });
        logAuditAction?.('SEO', 'Update product SEO', `Saved meta overrides for ${dirty.length} SKUs.`);
        setNotice({ kind: 'success', text: `Saved SEO for ${dirty.length} products.` });
        return;
      }

      if (type === 'pages') {
        const result = await request<{ pages: SeoPageMeta[] }>('/api/v1/seo', {
          method: 'PUT',
          body: JSON.stringify({ type: 'pages', data: pages }),
        });
        if (result.pages?.length) setPages(result.pages);
        logAuditAction?.('SEO', 'Update route meta', `Saved meta for ${pages.length} storefront routes.`);
        setNotice({ kind: 'success', text: 'Route metadata published to the storefront.' });
        return;
      }

      // global and sitemap write the same row — the split is only which fields
      // the operator was looking at.
      await request('/api/v1/seo', {
        method: 'PUT',
        body: JSON.stringify({ type: 'global', data: settings }),
      });
      setPersisted(true);
      logAuditAction?.(
        'SEO',
        type === 'sitemap' ? 'Update indexing policy' : 'Update global SEO',
        type === 'sitemap'
          ? `Indexing ${settings.robotsIndexingEnabled ? 'enabled' : 'DISABLED'}; sitemap frequency ${settings.sitemapDefaultFrequency}.`
          : `Scope ${settings.activeScope}; title "${settings.defaultMetaTitle}".`,
      );
      setNotice({ kind: 'success', text: 'Saved and pushed to the storefront.' });
    } catch (error) {
      setNotice({ kind: 'error', text: describe(error, 'Could not save SEO settings.') });
    } finally {
      setSaving(false);
    }
  };

  const jsonLdPreview = useMemo(
    () => JSON.stringify(buildLocalBusinessPreview(settings), null, 2),
    [settings],
  );

  const previewUrl = useMemo(
    () => settings.canonicalBaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    [settings.canonicalBaseUrl],
  );

  /** The title as it will actually render, suffix included. */
  const previewTitle = useMemo(() => {
    const base = settings.defaultMetaTitle || settings.siteName;
    const suffix = settings.titleSuffix ?? '';
    if (!suffix) return base;
    const combined = `${base} ${suffix}`.replace(/\s+/g, ' ').trim();
    return combined.length <= 70 ? combined : base;
  }, [settings.defaultMetaTitle, settings.siteName, settings.titleSuffix]);

  const filteredCatalog = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return catalog;
    return catalog.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        (row.sku ?? '').toLowerCase().includes(term) ||
        row.slug.toLowerCase().includes(term),
    );
  }, [catalog, productSearch]);

  const nationwide = settings.activeScope === 'nepal_nationwide';

  /**
   * Fills empty product meta from the regional pattern.
   *
   * Local intent is the whole point — "Dell Vostro 3520 price in Dhangadhi" is a
   * query someone in Kailali actually types, while the bare product name competes
   * with every marketplace in India. Only blanks are touched, so a hand-written
   * override is never overwritten.
   */
  const autofillProducts = () => {
    let filled = 0;
    setCatalog((prev) =>
      prev.map((row) => {
        if (row.metaTitle && row.metaDescription) return row;
        filled += 1;
        return {
          ...row,
          metaTitle:
            row.metaTitle ||
            `${row.name} Price in ${SUDURPASHCHIM_CONFIG.headquartersCity}`.slice(0, 200),
          metaDescription:
            row.metaDescription ||
            `Buy ${row.name} in ${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.headquartersDistrict} with official warranty. COD and same-day delivery in ${SAME_DAY_HUBS.join(', ')}; express dispatch across ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`.slice(
              0,
              500,
            ),
        };
      }),
    );
    setNotice({
      kind: 'info',
      text: `Drafted regional meta for ${filled} products. Review, then publish.`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-10 text-xs font-bold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading SEO engine…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">
            Search & regional engine
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">
            Search Engine Optimization (SEO)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Meta tags, OpenGraph previews, Schema.org JSON-LD and {SUDURPASHCHIM_CONFIG.primaryProvinceShort} regional
            targeting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
              nationwide
                ? 'border-slate-300 bg-slate-200 text-slate-700'
                : 'border-emerald-300 bg-emerald-100 text-emerald-800'
            }`}
          >
            <MapPin className="mr-1 inline h-3 w-3" />
            Target: {SUDURPASHCHIM_CONFIG.primaryProvinceShort} {nationwide ? 'Primary' : 'Active'}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
              nationwide
                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                : 'border-slate-300 bg-slate-200 text-slate-700'
            }`}
          >
            Nepal Nationwide {nationwide ? 'Live' : '(Coming Soon)'}
          </span>
          {!persisted && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
              Using built-in defaults
            </span>
          )}
        </div>
      </div>

      {/* ---------------- Tabs ---------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {TABS.map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tab === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}

        {notice && (
          <span
            className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold ${
              notice.kind === 'error'
                ? 'bg-rose-50 text-rose-700'
                : notice.kind === 'info'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {notice.kind === 'error' ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {notice.text}
          </span>
        )}
      </div>

      {/* ================= GLOBAL ================= */}
      {tab === 'global' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Editor */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save('global');
            }}
            className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-7"
          >
            <h3 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
              Global search engine metadata
            </h3>

            <Text
              label="Meta title tag"
              value={settings.defaultMetaTitle}
              onChange={(v) => set('defaultMetaTitle', v)}
              max={200}
              target={TITLE_TARGET}
            />

            <Area
              label="Meta description"
              value={settings.defaultMetaDescription}
              onChange={(v) => set('defaultMetaDescription', v)}
              max={500}
              target={DESC_TARGET}
            />

            <Text
              label={`Title suffix (appended when it fits within ${TITLE_TARGET + 10} chars)`}
              value={settings.titleSuffix}
              onChange={(v) => set('titleSuffix', v)}
              max={200}
              hint="Long product titles skip the suffix rather than getting truncated by Google."
            />

            <Area
              label={`Target keywords (${SUDURPASHCHIM_CONFIG.primaryProvinceShort} local SEO focus)`}
              value={settings.defaultKeywords}
              onChange={(v) => set('defaultKeywords', v)}
              rows={2}
              max={2000}
              hint="Comma separated. Every page inherits these before its own keywords are appended."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Text
                label="Canonical base URL"
                value={settings.canonicalBaseUrl}
                onChange={(v) => set('canonicalBaseUrl', v)}
                max={300}
                mono
                hint="No trailing slash — paths are appended to this."
              />
              <Text
                label="Site name"
                value={settings.siteName}
                onChange={(v) => set('siteName', v)}
                max={150}
              />
            </div>

            <ImageUploadField
              label="Social OpenGraph image (og:image)"
              hint="Recommended 1200 x 630 — used by Facebook, Messenger, WhatsApp and Viber previews."
              purpose="branding"
              value={settings.ogImageUrl}
              onChange={(v) => set('ogImageUrl', v)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Text
                label="Twitter / X handle"
                value={settings.twitterHandle}
                onChange={(v) => set('twitterHandle', v)}
                max={60}
                placeholder="@intelcomputernp"
              />
              <Text
                label="OpenGraph locale"
                value={settings.ogLocale}
                onChange={(v) => set('ogLocale', v)}
                max={12}
                mono
                hint="en_NP for Nepal English, ne_NP for Nepali."
              />
            </div>

            {/* ---- Regional targeting ---- */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Regional targeting
              </h4>

              <Pick
                label="Active delivery & SEO scope"
                value={settings.activeScope}
                options={['region_exclusive', 'nepal_nationwide']}
                onChange={(v) => set('activeScope', v as SeoSettings['activeScope'])}
                render={(v) =>
                  v === 'region_exclusive'
                    ? `${SUDURPASHCHIM_CONFIG.primaryProvinceShort} only (9 districts)`
                    : 'Nepal nationwide (all 77 districts)'
                }
                hint="Switching to nationwide changes areaServed, the banner copy and the FAQ delivery answers everywhere at once."
              />

              <Text
                label="Storefront delivery banner"
                value={settings.regionBannerMessage}
                onChange={(v) => set('regionBannerMessage', v)}
                max={300}
              />

              <Check1
                label="Show the delivery banner on the storefront"
                description="Appears in the announcement bar above the header."
                checked={settings.regionBannerEnabled}
                onChange={(v) => set('regionBannerEnabled', v)}
              />

              <Area
                label="Additional areas served"
                value={settings.extraAreasServed}
                onChange={(v) => set('extraAreasServed', v)}
                rows={2}
                max={2000}
                hint={`Comma separated, added to the ${SUDURPASHCHIM_DISTRICTS.length} districts and ${areaServed(settings).length - 1} hubs already published from config/regional.ts.`}
              />
            </div>

            {/* ---- Structured data ---- */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Structured data (Schema.org)
              </h4>

              <Check1
                label="Emit JSON-LD structured data"
                description="LocalBusiness, Product, FAQPage and BreadcrumbList nodes."
                checked={settings.structuredDataEnabled}
                onChange={(v) => set('structuredDataEnabled', v)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Pick
                  label="Business type"
                  value={settings.localBusinessType}
                  options={BUSINESS_TYPES}
                  onChange={(v) => set('localBusinessType', v)}
                />
                <Text
                  label="Price range"
                  value={settings.priceRange}
                  onChange={(v) => set('priceRange', v)}
                  max={60}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Text
                  label="Latitude"
                  value={settings.geoLatitude === null ? '' : String(settings.geoLatitude)}
                  onChange={(v) => set('geoLatitude', v === '' ? null : Number(v))}
                  mono
                  hint={`Dhangadhi is ${SUDURPASHCHIM_CONFIG.geo.latitude}`}
                />
                <Text
                  label="Longitude"
                  value={settings.geoLongitude === null ? '' : String(settings.geoLongitude)}
                  onChange={(v) => set('geoLongitude', v === '' ? null : Number(v))}
                  mono
                  hint={`Dhangadhi is ${SUDURPASHCHIM_CONFIG.geo.longitude}`}
                />
              </div>
            </div>

            {/* ---- JSON-LD preview ---- */}
            <div>
              <Label text="Auto-generated Schema.org JSON-LD (LocalBusiness)" />
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
                {jsonLdPreview}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-[10px] text-slate-400">
                Published immediately — the storefront re-reads this on the next page load.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Publish local SEO changes
              </button>
            </div>
          </form>

          {/* Previews */}
          <div className="space-y-6 xl:col-span-5">
            {/* Google SERP */}
            <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Google search snippet preview
              </h4>
              <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-1 text-[12px] text-slate-600">
                  <span>{previewUrl || 'yourstore.com'}</span>
                  <span className="text-[10px]">▾</span>
                </div>
                <h4 className="line-clamp-1 cursor-pointer text-base font-medium text-blue-800 hover:underline">
                  {previewTitle}
                </h4>
                <p className="line-clamp-2 text-xs text-slate-600">
                  {settings.defaultMetaDescription}
                </p>
              </div>
              {(settings.defaultMetaTitle.length > TITLE_TARGET ||
                settings.defaultMetaDescription.length > DESC_TARGET) && (
                <p className="flex items-start gap-1 text-[10px] font-bold text-amber-600">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                  Over the display limit — Google will truncate with an ellipsis.
                </p>
              )}
            </div>

            {/* Social card */}
            <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Facebook / WhatsApp share preview
              </h4>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {settings.ogImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary
                  // remote hosts are allowed for the OG image, which next/image
                  // would reject without whitelisting every host.
                  <img
                    src={settings.ogImageUrl}
                    alt="OpenGraph preview"
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs font-bold text-slate-500">
                    No OG image set
                  </div>
                )}
                <div className="space-y-1 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {previewUrl || 'YOURSTORE.COM'}
                  </p>
                  <p className="line-clamp-1 text-xs font-bold text-slate-800">{previewTitle}</p>
                  <p className="line-clamp-2 text-[11px] text-slate-500">
                    {settings.defaultMetaDescription}
                  </p>
                </div>
              </div>
            </div>

            {/* Regional logistics */}
            <div className="space-y-3 rounded-3xl bg-gradient-to-br from-blue-900 to-indigo-900 p-5 text-white shadow-md">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-200">
                <Truck className="h-3.5 w-3.5" />
                Active delivery coverage
              </h4>
              <div className="space-y-1.5 text-xs">
                <p>
                  <MapPin className="mr-1 inline h-3 w-3" />
                  <strong>Primary zone:</strong> all {SUDURPASHCHIM_DISTRICTS.length} districts of{' '}
                  {SUDURPASHCHIM_CONFIG.primaryProvinceShort}
                </p>
                <p>
                  <strong>Same-day hubs:</strong> {SAME_DAY_HUBS.join(', ')}
                </p>
                <p>
                  <strong>Express window:</strong> 24 to 96 hours
                </p>
                <p>
                  <strong>Head office:</strong> {SUDURPASHCHIM_CONFIG.headquartersHub}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 border-t border-blue-800/80 pt-3">
                {SUDURPASHCHIM_CONFIG.keyDistricts.map((district) => (
                  <span
                    key={district.name}
                    title={`${district.hubs.join(', ')} — ${district.estTime}`}
                    className="rounded bg-blue-800/70 px-2 py-0.5 text-[10px] font-bold text-blue-100"
                  >
                    {district.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-blue-800/80 pt-3">
                <span className="text-[11px] text-blue-300">Nepal-wide rollout:</span>
                <span className="rounded bg-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-100">
                  {nationwide ? 'Live' : 'Phase 2 queue'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGES ================= */}
      {tab === 'pages' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs text-slate-500">
              One row per storefront route. Blank fields fall back to the global metadata above.
              Cart, checkout, account and admin are held at <code className="font-mono">noindex</code>{' '}
              in code regardless of what is saved here.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save('pages')}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save all routes
            </button>
          </div>

          {!pages.length && <Empty text="No routes configured." />}

          <div className="space-y-3">
            {pages.map((page) => (
              <details
                key={page.pageKey}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="text-xs font-extrabold text-slate-800">{page.label}</span>
                  <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {page.path}
                  </code>
                  {page.noIndex && (
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      noindex
                    </span>
                  )}
                  {!page.includeInSitemap && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      off sitemap
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-slate-400">
                    {(page.metaTitle || '').length}/{TITLE_TARGET} title ·{' '}
                    {(page.metaDescription || '').length}/{DESC_TARGET} desc
                  </span>
                </summary>

                <div className="space-y-4 border-t border-slate-100 p-4">
                  <Text
                    label="Meta title"
                    value={page.metaTitle}
                    onChange={(v) => patchPage(page.pageKey, { metaTitle: v })}
                    max={200}
                    target={TITLE_TARGET}
                  />
                  <Area
                    label="Meta description"
                    value={page.metaDescription}
                    onChange={(v) => patchPage(page.pageKey, { metaDescription: v })}
                    max={500}
                    target={DESC_TARGET}
                  />
                  <Text
                    label="Route keywords"
                    value={page.keywords}
                    onChange={(v) => patchPage(page.pageKey, { keywords: v })}
                    max={2000}
                    hint="Appended to the global keyword list for this route only."
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Text
                      label="Path"
                      value={page.path}
                      onChange={(v) => patchPage(page.pageKey, { path: v })}
                      max={300}
                      mono
                    />
                    <Text
                      label="Sitemap priority (0.0 - 1.0)"
                      value={String(page.sitemapPriority)}
                      onChange={(v) =>
                        patchPage(page.pageKey, { sitemapPriority: Number(v) || 0 })
                      }
                      mono
                    />
                    <Pick
                      label="Change frequency"
                      value={page.sitemapFrequency}
                      options={SITEMAP_FREQUENCIES}
                      onChange={(v) =>
                        patchPage(page.pageKey, { sitemapFrequency: v as SitemapFrequency })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Check1
                      label="Exclude from search engines (noindex)"
                      checked={page.noIndex}
                      onChange={(v) => patchPage(page.pageKey, { noIndex: v })}
                    />
                    <Check1
                      label="Include in sitemap.xml"
                      checked={page.includeInSitemap}
                      onChange={(v) => patchPage(page.pageKey, { includeInSitemap: v })}
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* ================= PRODUCTS ================= */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Filter by name, SKU or slug…"
                className="w-56 bg-transparent text-xs outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={autofillProducts}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                title={`Draft "<product> Price in ${SUDURPASHCHIM_CONFIG.headquartersCity}" for every product with no override`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Auto-draft regional meta
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save('products')}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Publish product SEO
              </button>
            </div>
          </div>

          {!filteredCatalog.length ? (
            <Empty
              text={
                catalog.length
                  ? 'No products match that filter.'
                  : 'No active products found — add products in the Catalog module first.'
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 font-bold">Meta title</th>
                    <th className="px-4 py-3 font-bold">Meta description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {row.sku || row.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.metaTitle ?? ''}
                          maxLength={200}
                          onChange={(e) => patchProduct(row.id, { metaTitle: e.target.value })}
                          placeholder={`${row.name} Price in ${SUDURPASHCHIM_CONFIG.headquartersCity}`}
                          className={textInput}
                        />
                        <span
                          className={`font-mono text-[10px] ${
                            (row.metaTitle ?? '').length > TITLE_TARGET
                              ? 'font-bold text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {(row.metaTitle ?? '').length}/{TITLE_TARGET}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          rows={2}
                          value={row.metaDescription ?? ''}
                          maxLength={500}
                          onChange={(e) =>
                            patchProduct(row.id, { metaDescription: e.target.value })
                          }
                          placeholder={`Buy ${row.name} in ${SUDURPASHCHIM_CONFIG.headquartersCity} with official warranty and COD.`}
                          className={textInput}
                        />
                        <span
                          className={`font-mono text-[10px] ${
                            (row.metaDescription ?? '').length > DESC_TARGET
                              ? 'font-bold text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {(row.metaDescription ?? '').length}/{DESC_TARGET}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= SITEMAP ================= */}
      {tab === 'sitemap' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save('sitemap');
          }}
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm xl:col-span-7">
            <h3 className="border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
              Indexing policy
            </h3>

            <Check1
              label="Allow search engines to index the storefront"
              description="Turning this off emits noindex site-wide and a Disallow: / robots policy. Use only for a staging domain."
              checked={settings.robotsIndexingEnabled}
              onChange={(v) => set('robotsIndexingEnabled', v)}
            />

            {!settings.robotsIndexingEnabled && (
              <p className="flex items-start gap-1.5 rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                The whole site is currently hidden from Google. Existing rankings will decay while
                this is off.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Check1
                label="Products in sitemap"
                checked={settings.sitemapIncludeProducts}
                onChange={(v) => set('sitemapIncludeProducts', v)}
              />
              <Check1
                label="Categories in sitemap"
                checked={settings.sitemapIncludeCategories}
                onChange={(v) => set('sitemapIncludeCategories', v)}
              />
              <Check1
                label="Custom pages in sitemap"
                checked={settings.sitemapIncludePages}
                onChange={(v) => set('sitemapIncludePages', v)}
              />
            </div>

            <Pick
              label="Default change frequency"
              value={settings.sitemapDefaultFrequency}
              options={SITEMAP_FREQUENCIES}
              onChange={(v) => set('sitemapDefaultFrequency', v as SitemapFrequency)}
              hint="Per-route overrides live on the Page Meta tab."
            />

            <Area
              label="Extra robots.txt disallow paths"
              value={settings.robotsExtraDisallow}
              onChange={(v) => set('robotsExtraDisallow', v)}
              rows={3}
              max={2000}
              hint="One path per line or comma separated. /admin/ and /checkout/ are always disallowed."
            />

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Search console verification
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Text
                  label="Google site verification"
                  value={settings.googleSiteVerification}
                  onChange={(v) => set('googleSiteVerification', v)}
                  max={200}
                  mono
                />
                <Text
                  label="Bing site verification"
                  value={settings.bingSiteVerification}
                  onChange={(v) => set('bingSiteVerification', v)}
                  max={200}
                  mono
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Text
                  label="Google Analytics ID"
                  value={settings.googleAnalyticsId}
                  onChange={(v) => set('googleAnalyticsId', v)}
                  max={100}
                  mono
                  placeholder="G-XXXXXXXXXX"
                />
                <Text
                  label="Facebook Pixel ID"
                  value={settings.facebookPixelId}
                  onChange={(v) => set('facebookPixelId', v)}
                  max={100}
                  mono
                />
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save indexing policy
              </button>
            </div>
          </div>

          <div className="space-y-6 xl:col-span-5">
            <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Live indexing endpoints
              </h4>
              <div className="space-y-2 text-xs">
                {[
                  ['/sitemap.xml', 'Generated on request from the routes, products and pages'],
                  ['/robots.txt', 'Reflects the policy on the left'],
                ].map(([path, note]) => (
                  <div key={path} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <a
                      href={path}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] font-bold text-blue-700 hover:underline"
                    >
                      {settings.canonicalBaseUrl}
                      {path}
                    </a>
                    <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                After a large catalogue change, resubmit the sitemap in Google Search Console —
                nothing here pings Google automatically.
              </p>
            </div>

            <div className="space-y-2 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Route summary
              </h4>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Indexable routes</dt>
                  <dd className="font-bold text-slate-800">
                    {pages.filter((p) => !p.noIndex).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">In sitemap</dt>
                  <dd className="font-bold text-slate-800">
                    {pages.filter((p) => p.includeInSitemap && !p.noIndex).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Held at noindex</dt>
                  <dd className="font-bold text-slate-800">
                    {pages.filter((p) => p.noIndex).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Districts published as areaServed</dt>
                  <dd className="font-bold text-slate-800">{SUDURPASHCHIM_DISTRICTS.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
