'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Check, ChevronDown, ChevronUp, FileText, ImagePlus, Link2, Menu, Save, Send, Settings2, Trash2 } from 'lucide-react';
import { type SiteSettings } from '@/types';
import { ImageUploadField } from './ImageUploadField';
import { type HomepageBlock, DEFAULT_HOMEPAGE_BLOCKS } from '@/lib/content/homepage-layout';

type Tab = 'banners' | 'layout' | 'pages' | 'navigation' | 'branding';
type Banner = { id?: number; title: string; subtitle?: string; desktopImageUrl?: string; mobileImageUrl?: string; ctaLabel?: string; ctaUrl?: string; status: 'draft' | 'published'; displayOrder: number; startsAt?: string; endsAt?: string };
type Section = HomepageBlock;
type Page = { id?: number; title: string; slug: string; content: { html: string }; status: 'draft' | 'published'; metaTitle?: string; metaDescription?: string };
/** A notice carries its kind so a failure cannot render as a green tick. */
type Notice = { text: string; kind: 'success' | 'error' } | null;

const tabs: Array<[Tab, string, React.ElementType]> = [['banners', 'Hero Sliders & Banners', ImagePlus], ['layout', 'Homepage Layout', Menu], ['pages', 'Custom Pages', FileText], ['navigation', 'Nav & Footer', Link2], ['branding', 'Branding & Identity', Settings2]];
const blankBanner: Banner = { title: '', subtitle: '', desktopImageUrl: '', mobileImageUrl: '', ctaLabel: 'Shop Now', ctaUrl: '', status: 'draft', displayOrder: 0 };
const emptyPage = (): Page => ({ title: '', slug: '', content: { html: '' }, status: 'published', metaTitle: '', metaDescription: '' });
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const ContentModule: React.FC<{ siteSettings: SiteSettings; updateSiteSettings: (newSettings: Partial<SiteSettings>) => void; logAuditAction: (module: string, action: string, details: string) => void }> = ({ siteSettings, updateSiteSettings, logAuditAction }) => {
  const [tab, setTab] = useState<Tab>('banners'); const [banners, setBanners] = useState<Banner[]>([]); const [sections, setSections] = useState<Section[]>(DEFAULT_HOMEPAGE_BLOCKS); const [pages, setPages] = useState<Page[]>([]); const [banner, setBanner] = useState<Banner>(blankBanner); const [page, setPage] = useState<Page>(() => emptyPage()); const [notice, setNotice] = useState<Notice>(null);
  const [branding, setBranding] = useState<any>({ ...siteSettings, metaTitle: '', metaDescription: '', openGraphImageUrl: '', googleAnalyticsId: '', facebookPixelId: '', backgroundColor: '#1B3A8C', actionLink: '' });
  const [navigation, setNavigation] = useState<any>({ items: [], settings: { socialLinks: {}, footerColumns: [], copyrightText: '', metaTitle: '', metaDescription: '', openGraphImageUrl: '', googleAnalyticsId: '', facebookPixelId: '' } });
  useEffect(() => { void Promise.all([fetch('/api/v1/content/banners'), fetch('/api/v1/content/homepage-layout'), fetch('/api/v1/content/pages'), fetch('/api/v1/content/navigation'), fetch('/api/settings?type=profile')]).then(async ([b, l, p, n, s]) => { const [bd, ld, pd, nd, sd] = await Promise.all([b.json(), l.json(), p.json(), n.json(), s.json()]); setBanners(bd.banners || []); setSections(ld.sections?.length ? ld.sections : DEFAULT_HOMEPAGE_BLOCKS); setPages(pd.pages || []); setNavigation((current: any) => ({ items: nd.items || [], settings: { ...current.settings, ...(nd.settings || {}) } })); if (sd.profile) setBranding((current: any) => ({ ...current, ...sd.profile, logoUrl: isUsableImageUrl(sd.profile.logoUrl) ? sd.profile.logoUrl : '' })); }).catch(() => setNotice({ text: 'Could not load CMS data.', kind: 'error' })); }, []);
  /**
   * Sends a write and returns the parsed body.
   *
   * The thrown Error carries the server's own message and status. It used to be a
   * bare `new Error()`, which gave the dev overlay nothing to display and made a
   * 401 from `withRole` look identical to a 500 from a missing table.
   */
  const request = async (url: string, method: string, body: unknown) => {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    // Read as text first: an empty body (or an HTML error page) makes `.json()` throw.
    const raw = await response.text();
    let payload: any = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
    if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText || 'Request failed'}`);
    return payload;
  };
  const describe = (error: unknown, fallback: string) => (error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback);
  const save = async (url: string, method: string, body: unknown) => { await request(url, method, body); setNotice({ text: 'Saved successfully.', kind: 'success' }); };
  /**
   * Wrapper for the homepage-order button.
   *
   * `onClick={() => save(...)}` returned a floating promise, so a failed save
   * became an unhandled rejection and Next's overlay reported it as a runtime
   * crash instead of the module showing an error notice.
   */
  async function saveLayout() { try { await save('/api/v1/content/homepage-layout', 'PUT', sections.map((section, index) => ({ ...section, displayOrder: index }))); } catch (error) { setNotice({ text: describe(error, 'Homepage order could not be saved.'), kind: 'error' }); } }
  async function saveBanner(e: React.FormEvent) { e.preventDefault(); const title = banner.title.trim(); if (!title) { setNotice({ text: 'Banner title is required.', kind: 'error' }); return; } const payload = { ...(banner.id ? { id: banner.id } : {}), title, subtitle: banner.subtitle?.trim() || '', desktopImageUrl: banner.desktopImageUrl?.trim() || '', mobileImageUrl: banner.mobileImageUrl?.trim() || '', ctaLabel: banner.ctaLabel?.trim() || '', ctaUrl: banner.ctaUrl?.trim() || '', ...(banner.startsAt ? { startsAt: banner.startsAt } : {}), ...(banner.endsAt ? { endsAt: banner.endsAt } : {}), status: banner.status, displayOrder: Number(banner.displayOrder) || 0 }; try { const data = await request('/api/v1/content/banners', banner.id ? 'PUT' : 'POST', payload); setBanners((current) => banner.id ? current.map((item) => item.id === banner.id ? data.banner : item) : [...current, data.banner]); setBanner(blankBanner); setNotice({ text: 'Banner saved.', kind: 'success' }); } catch (error) { setNotice({ text: describe(error, 'Banner could not be saved.'), kind: 'error' }); } }
  async function savePage(e: React.FormEvent) { e.preventDefault(); try { const data = await request('/api/v1/content/pages', page.id ? 'PUT' : 'POST', { ...page, slug: page.slug || slugify(page.title) }); setPages((current) => page.id ? current.map((item) => item.id === page.id ? data.page : item) : [...current, data.page]); setPage(emptyPage()); setNotice({ text: 'Page saved.', kind: 'success' }); } catch (error) { setNotice({ text: describe(error, 'Page could not be saved.'), kind: 'error' }); } }
  function createNewPage() { setPage(emptyPage()); setNotice(null); }
  function editPage(item: Page) { setPage({ ...item, content: { html: item.content?.html || '' } }); setNotice(null); }
  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    updateSiteSettings(branding);
    try {
      const profilePayload = {
        ...branding,
        configuration: {
          ...(branding.configuration || {}),
          googleMapEmbedUrl: branding.googleMapEmbedUrl,
          googleMapLocationUrl: branding.googleMapLocationUrl,
          googleMapLatitude: branding.googleMapLatitude ? Number(branding.googleMapLatitude) : undefined,
          googleMapLongitude: branding.googleMapLongitude ? Number(branding.googleMapLongitude) : undefined,
          googlePlaceId: branding.googlePlaceId,
        },
      };
      await request('/api/settings', 'POST', { type: 'profile', data: profilePayload });
      await save('/api/v1/content/navigation', 'PUT', navigation);
      logAuditAction('Site Content', 'Update branding & map', 'Updated storefront identity, physical address, Google Maps location, navigation and footer settings.');
      setNotice({ text: 'Store identity, address, and Google Maps settings saved successfully.', kind: 'success' });
    } catch (error) {
      setNotice({ text: describe(error, 'Branding could not be saved.'), kind: 'error' });
    }
  }
  return <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 bg-slate-50 px-5 pt-4"><div className="flex gap-1 overflow-x-auto">{tabs.map(([id, label, Icon]) => <button type="button" key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold ${tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></div><div className="space-y-6 p-5 md:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">Site & content</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{tabs.find(([id]) => id === tab)?.[1]}</h2></div>{notice && <span className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{notice.kind === 'error' ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}{notice.text}</span>}</div>
    {tab === 'banners' && <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-3">{banners.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><p className="font-extrabold">{item.title}</p><p className="text-xs text-slate-500">{item.status} · {item.desktopImageUrl ? 'Desktop image set' : 'No desktop image'}</p></div><div className="flex gap-2"><button type="button" onClick={() => setBanner(item)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Edit</button><button type="button" onClick={async () => { await fetch(`/api/v1/content/banners?id=${item.id}`, { method: 'DELETE' }); setBanners(banners.filter((b) => b.id !== item.id)); }} className="rounded-lg bg-rose-50 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button></div></div>)}{!banners.length && <Empty text="No hero banners yet. Create your first responsive promotional banner." />}</div><form onSubmit={saveBanner} className="space-y-4 rounded-2xl bg-slate-50 p-4"><h3 className="font-extrabold">Banner carousel builder</h3><Field label="Campaign title" required maxLength={200} value={banner.title} onChange={(v) => setBanner({ ...banner, title: v })} /><ImageUploadField label="Desktop banner" hint="Recommended 1920 x 600" purpose="banner" value={banner.desktopImageUrl} onChange={(v) => setBanner({ ...banner, desktopImageUrl: v })} /><ImageUploadField label="Mobile banner" hint="Recommended 800 x 800" purpose="banner" value={banner.mobileImageUrl} onChange={(v) => setBanner({ ...banner, mobileImageUrl: v })} /><div className="grid gap-3 sm:grid-cols-2"><Field label="CTA label" value={banner.ctaLabel} onChange={(v) => setBanner({ ...banner, ctaLabel: v })} /><Field label="Target link" value={banner.ctaUrl} onChange={(v) => setBanner({ ...banner, ctaUrl: v })} /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Starts at" type="datetime-local" value={banner.startsAt || ''} onChange={(v) => setBanner({ ...banner, startsAt: v })} /><Field label="Ends at" type="datetime-local" value={banner.endsAt || ''} onChange={(v) => setBanner({ ...banner, endsAt: v })} /></div><Select label="Status" value={banner.status} options={['draft', 'published']} onChange={(v) => setBanner({ ...banner, status: v as Banner['status'] })} /><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" />Save banner</button></form></div>}
    {tab === 'layout' && <div className="space-y-6"><div><h3 className="text-lg font-extrabold text-slate-800">Homepage Layout Blocks</h3><p className="text-sm text-slate-500">Enable, disable, and reorder sections displayed on your main storefront.</p></div><div className="space-y-3">{sections.map((section, index) => <div key={section.id || section.sectionType} className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${section.isEnabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}><div className="flex items-center gap-4"><div className="flex flex-col gap-1"><button type="button" disabled={!index} onClick={() => setSections(move(sections, index, index - 1).map((item, i) => ({ ...item, displayOrder: i + 1 })))} className="rounded bg-slate-100 p-1 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button><button type="button" disabled={index === sections.length - 1} onClick={() => setSections(move(sections, index, index + 1).map((item, i) => ({ ...item, displayOrder: i + 1 })))} className="rounded bg-slate-100 p-1 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></div><div><span className="mr-2 text-xs font-extrabold text-slate-400">#{index + 1}</span><span className="font-extrabold text-slate-800">{section.title}</span><span className="ml-3 rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">{section.sectionType}</span><p className="mt-1 text-xs text-slate-400">{String(section.configuration.type || 'CONTENT_BLOCK')}</p></div></div><label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={section.isEnabled} onChange={() => setSections(sections.map((item, i) => i === index ? { ...item, isEnabled: !item.isEnabled } : item))} className="h-4 w-4" />{section.isEnabled ? 'Visible' : 'Hidden'}</label></div>)}</div><button type="button" onClick={() => { void saveLayout(); }} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" />Save homepage order</button></div>}
    {tab === 'pages' && <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]"><div className="space-y-3">{pages.map((item) => <button type="button" key={item.id} onClick={() => editPage(item)} className={`block w-full rounded-2xl border p-4 text-left ${page.id === item.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}><p className="font-extrabold">{item.title}</p><p className="text-xs text-slate-500">/pages/{item.slug} · {item.status}</p></button>)}<button type="button" onClick={createNewPage} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">New custom page</button></div><form onSubmit={savePage} className="space-y-4"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{page.id ? `Editing page #${page.id}` : 'Create new page'}</p><Field label="Page title" required maxLength={200} value={page.title} onChange={(v) => setPage({ ...page, title: v, slug: page.id ? page.slug : slugify(v) })} /><Field label="URL slug" required maxLength={220} value={page.slug} onChange={(v) => setPage({ ...page, slug: slugify(v) })} /><label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">Rich text content</span><textarea required value={page.content.html} onChange={(e) => setPage({ ...page, content: { html: e.target.value } })} rows={14} placeholder="Write policy, warranty, or about-us content here..." className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm outline-none focus:border-slate-900" /></label><div className="grid gap-3 sm:grid-cols-2"><Field label="Meta title" value={page.metaTitle} onChange={(v) => setPage({ ...page, metaTitle: v })} /><Field label="Meta description" value={page.metaDescription} onChange={(v) => setPage({ ...page, metaDescription: v })} /></div><Select label="Status" value={page.status} options={['draft', 'published']} onChange={(v) => setPage({ ...page, status: v as Page['status'] })} /><button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" />{page.id ? 'Update page' : 'Create page'}</button></form></div>}
    {tab === 'navigation' && <form onSubmit={saveBranding} className="space-y-5"><div className="space-y-3"><h3 className="font-extrabold">Header navigation</h3>{navigation.items.map((item: any, index: number) => <div key={item.id || index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"> <Field label="Label" value={item.label} onChange={(v) => setNavigation({ ...navigation, items: navigation.items.map((x: any, i: number) => i === index ? { ...x, label: v } : x) })} /><Field label="URL" value={item.url || ''} onChange={(v) => setNavigation({ ...navigation, items: navigation.items.map((x: any, i: number) => i === index ? { ...x, url: v } : x) })} /><button type="button" onClick={() => setNavigation({ ...navigation, items: navigation.items.filter((_: any, i: number) => i !== index) })} className="self-end rounded-lg bg-rose-50 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" onClick={() => setNavigation({ ...navigation, items: [...navigation.items, { label: 'New item', url: '/', displayOrder: navigation.items.length, isActive: true }] })} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold">Add menu item</button></div><div className="grid gap-4 md:grid-cols-2"><Field label="Facebook URL" value={navigation.settings.socialLinks?.facebook || ''} onChange={(v) => setNavigation({ ...navigation, settings: { ...navigation.settings, socialLinks: { ...navigation.settings.socialLinks, facebook: v } } })} /><Field label="Instagram URL" value={navigation.settings.socialLinks?.instagram || ''} onChange={(v) => setNavigation({ ...navigation, settings: { ...navigation.settings, socialLinks: { ...navigation.settings.socialLinks, instagram: v } } })} /><Field label="TikTok URL" value={navigation.settings.socialLinks?.tiktok || ''} onChange={(v) => setNavigation({ ...navigation, settings: { ...navigation.settings, socialLinks: { ...navigation.settings.socialLinks, tiktok: v } } })} /><Field label="Copyright text" value={navigation.settings.copyrightText || ''} onChange={(v) => setNavigation({ ...navigation, settings: { ...navigation.settings, copyrightText: v } })} /></div><button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><Save className="h-4 w-4" />Save navigation & footer</button></form>}
    {tab === 'branding' && <form onSubmit={saveBranding} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Store name" value={branding.storeName} onChange={(v) => setBranding({ ...branding, storeName: v })} />
        <Field label="Store tagline" value={branding.tagline || ''} onChange={(v) => setBranding({ ...branding, tagline: v })} />
        <Field label="Support phone" value={branding.contactPhone || ''} onChange={(v) => setBranding({ ...branding, contactPhone: v })} />
        <Field label="Support email" value={branding.contactEmail || ''} onChange={(v) => setBranding({ ...branding, contactEmail: v })} />
        <Field label="Opening hours" value={branding.openingHours || ''} onChange={(v) => setBranding({ ...branding, openingHours: v })} />
        <Field label="WhatsApp / Mobile number" value={branding.whatsappNumber || ''} onChange={(v) => setBranding({ ...branding, whatsappNumber: v })} />
        <ImageUploadField label="Light logo" purpose="branding" value={branding.logoUrl} onChange={(v) => setBranding({ ...branding, logoUrl: v })} />
        <ImageUploadField label="Dark logo" purpose="branding" value={branding.darkLogoUrl || ''} onChange={(v) => setBranding({ ...branding, darkLogoUrl: v })} />
        <ImageUploadField label="Favicon" hint="PNG or ICO, 32 x 32 or larger" purpose="branding" value={branding.faviconUrl || ''} onChange={(v) => setBranding({ ...branding, faviconUrl: v })} />
        <Field label="Announcement / free delivery text" value={branding.announcementText} onChange={(v) => setBranding({ ...branding, announcementText: v })} />
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={branding.announcementEnabled !== false} onChange={(e) => setBranding({ ...branding, announcementEnabled: e.target.checked })} />Show announcement bar</label>
        <Field label="Announcement background color" value={branding.backgroundColor} onChange={(v) => setBranding({ ...branding, backgroundColor: v })} />
      </div>

      {/* Store Location & Google Maps Configuration */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
          <h3 className="font-extrabold text-slate-900 text-sm">Store Physical Address &amp; Google Maps Embed</h3>
        </div>
        <p className="text-xs text-slate-600">
          Set the physical store location, share URL, coordinates, and embedded map iframe shown on the Contact page, Footer, and customer invoices.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Physical Store Address" value={branding.address || ''} onChange={(v) => setBranding({ ...branding, address: v })} />
          <Field label="Google Maps App / Share Link" placeholder="https://maps.app.goo.gl/..." value={branding.googleMapLocationUrl || ''} onChange={(v) => setBranding({ ...branding, googleMapLocationUrl: v })} />
          <Field label="GPS Latitude" placeholder="28.7042726" value={branding.googleMapLatitude ?? ''} onChange={(v) => setBranding({ ...branding, googleMapLatitude: v })} />
          <Field label="GPS Longitude" placeholder="80.576736" value={branding.googleMapLongitude ?? ''} onChange={(v) => setBranding({ ...branding, googleMapLongitude: v })} />
          <div className="md:col-span-2">
            <Field label="Google Maps Embed Iframe URL" placeholder="https://www.google.com/maps/embed?pb=..." value={branding.googleMapEmbedUrl || ''} onChange={(v) => setBranding({ ...branding, googleMapEmbedUrl: v })} />
            <p className="mt-1 text-[11px] text-slate-500">
              Tip: In Google Maps, click <strong>Share &gt; Embed a map &gt; Copy HTML</strong> and paste the <code>src="..."</code> URL here.
            </p>
          </div>
        </div>

        {/* Live Map Preview inside Admin */}
        {branding.googleMapEmbedUrl && (
          <div className="mt-3 space-y-2">
            <span className="text-xs font-bold text-slate-700">Live Map Preview:</span>
            <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-inner">
              <iframe
                src={branding.googleMapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Admin Map Preview"
              />
            </div>
          </div>
        )}
      </div>

      <p className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
        Meta titles, descriptions, OpenGraph images, Schema.org data and Sudurpashchim regional targeting live in <b>SEO &amp; Region</b>.
      </p>

      <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white w-full sm:w-auto">
        <Save className="h-4 w-4" />Save branding &amp; map settings
      </button>
    </form>}
  </div></div>;
};

function move<T>(items: T[], from: number, to: number) { const next = [...items]; [next[from], next[to]] = [next[to], next[from]]; return next; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">{text}</p>; }
function Field({ label, value, onChange, type = 'text', required = false, maxLength, placeholder }: { label: string; value: any; onChange: (value: string) => void; type?: string; required?: boolean; maxLength?: number; placeholder?: string }) { return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span><input type={type} placeholder={placeholder} required={required} maxLength={maxLength} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900" /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function isUsableImageUrl(value: unknown): value is string { return typeof value === 'string' && (value.startsWith('/') || /^https?:\/\//i.test(value)); }
