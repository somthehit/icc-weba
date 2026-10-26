'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ImagePlus,
  Link2,
  Menu,
  PanelsTopBottom,
  Plus,
  Save,
  Settings2,
  Trash2,
  ShieldCheck,
  Truck,
  Wrench,
  CreditCard,
  Phone,
  MapPin,
  Mail,
  Clock,
  MessageCircle,
} from 'lucide-react';
import {
  type SiteSettings,
  type FooterSettings,
  type FooterColumn,
  type FooterTrustPillar,
  type FooterLinkItem,
} from '@/types';
import { DEFAULT_FOOTER_SETTINGS } from '@/lib/data/initial-data';
import { ImageUploadField } from './ImageUploadField';
import { type HomepageBlock, DEFAULT_HOMEPAGE_BLOCKS } from '@/lib/content/homepage-layout';

type Tab = 'banners' | 'layout' | 'pages' | 'navigation' | 'footer' | 'branding';
type Banner = {
  id?: number;
  title: string;
  subtitle?: string;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  status: 'draft' | 'published';
  displayOrder: number;
  startsAt?: string;
  endsAt?: string;
};
type Section = HomepageBlock;
type Page = {
  id?: number;
  title: string;
  slug: string;
  content: { html: string };
  status: 'draft' | 'published';
  metaTitle?: string;
  metaDescription?: string;
};
type Notice = { text: string; kind: 'success' | 'error' } | null;

const tabs: Array<[Tab, string, React.ElementType]> = [
  ['banners', 'Hero Sliders & Banners', ImagePlus],
  ['layout', 'Homepage Layout', Menu],
  ['pages', 'Custom Pages', FileText],
  ['navigation', 'Header Menu', Link2],
  ['footer', 'Footer Management', PanelsTopBottom],
  ['branding', 'Branding & Identity', Settings2],
];

const blankBanner: Banner = {
  title: '',
  subtitle: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  ctaLabel: 'Shop Now',
  ctaUrl: '',
  status: 'draft',
  displayOrder: 0,
};
const emptyPage = (): Page => ({
  title: '',
  slug: '',
  content: { html: '' },
  status: 'published',
  metaTitle: '',
  metaDescription: '',
});
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const ContentModule: React.FC<{
  siteSettings: SiteSettings;
  updateSiteSettings: (newSettings: Partial<SiteSettings>) => void;
  logAuditAction: (module: string, action: string, details: string) => void;
}> = ({ siteSettings, updateSiteSettings, logAuditAction }) => {
  const [tab, setTab] = useState<Tab>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<Section[]>(DEFAULT_HOMEPAGE_BLOCKS);
  const [pages, setPages] = useState<Page[]>([]);
  const [banner, setBanner] = useState<Banner>(blankBanner);
  const [page, setPage] = useState<Page>(() => emptyPage());
  const [notice, setNotice] = useState<Notice>(null);

  const [branding, setBranding] = useState<any>({
    ...siteSettings,
    metaTitle: '',
    metaDescription: '',
    openGraphImageUrl: '',
    googleAnalyticsId: '',
    facebookPixelId: '',
    backgroundColor: '#1B3A8C',
    actionLink: '',
  });

  const [navigation, setNavigation] = useState<any>({
    items: [],
    settings: {
      socialLinks: {},
      footerColumns: [],
      copyrightText: '',
      metaTitle: '',
      metaDescription: '',
      openGraphImageUrl: '',
      googleAnalyticsId: '',
      facebookPixelId: '',
    },
  });

  const [footerData, setFooterData] = useState<FooterSettings>(() => ({
    ...DEFAULT_FOOTER_SETTINGS,
    ...(siteSettings.footerSettings || {}),
  }));

  useEffect(() => {
    void Promise.all([
      fetch('/api/v1/content/banners'),
      fetch('/api/v1/content/homepage-layout'),
      fetch('/api/v1/content/pages'),
      fetch('/api/v1/content/navigation'),
      fetch('/api/settings?type=profile'),
    ])
      .then(async ([b, l, p, n, s]) => {
        const [bd, ld, pd, nd, sd] = await Promise.all([
          b.json(),
          l.json(),
          p.json(),
          n.json(),
          s.json(),
        ]);
        setBanners(bd.banners || []);
        setSections(ld.sections?.length ? ld.sections : DEFAULT_HOMEPAGE_BLOCKS);
        setPages(pd.pages || []);
        setNavigation((current: any) => ({
          items: nd.items || [],
          settings: { ...current.settings, ...(nd.settings || {}) },
        }));

        if (sd.profile) {
          const loadedProfile = sd.profile;
          setBranding((current: any) => ({
            ...current,
            ...loadedProfile,
            logoUrl: isUsableImageUrl(loadedProfile.logoUrl) ? loadedProfile.logoUrl : '',
          }));

          const config = (loadedProfile.configuration as Record<string, unknown>) || {};
          if (config.footerSettings) {
            setFooterData((current) => ({
              ...current,
              ...(config.footerSettings as FooterSettings),
            }));
          }
        }
      })
      .catch(() => setNotice({ text: 'Could not load CMS data.', kind: 'error' }));
  }, []);

  const request = async (url: string, method: string, body: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }
    if (!response.ok)
      throw new Error(payload?.error || `${response.status} ${response.statusText || 'Request failed'}`);
    return payload;
  };

  const describe = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? `${fallback} (${error.message})` : fallback;

  const save = async (url: string, method: string, body: unknown) => {
    await request(url, method, body);
    setNotice({ text: 'Saved successfully.', kind: 'success' });
  };

  async function saveLayout() {
    try {
      await save(
        '/api/v1/content/homepage-layout',
        'PUT',
        sections.map((section, index) => ({ ...section, displayOrder: index }))
      );
    } catch (error) {
      setNotice({ text: describe(error, 'Homepage order could not be saved.'), kind: 'error' });
    }
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    const title = banner.title.trim();
    if (!title) {
      setNotice({ text: 'Banner title is required.', kind: 'error' });
      return;
    }
    const payload = {
      ...(banner.id ? { id: banner.id } : {}),
      title,
      subtitle: banner.subtitle?.trim() || '',
      desktopImageUrl: banner.desktopImageUrl?.trim() || '',
      mobileImageUrl: banner.mobileImageUrl?.trim() || '',
      ctaLabel: banner.ctaLabel?.trim() || '',
      ctaUrl: banner.ctaUrl?.trim() || '',
      ...(banner.startsAt ? { startsAt: banner.startsAt } : {}),
      ...(banner.endsAt ? { endsAt: banner.endsAt } : {}),
      status: banner.status,
      displayOrder: Number(banner.displayOrder) || 0,
    };
    try {
      const data = await request(
        '/api/v1/content/banners',
        banner.id ? 'PUT' : 'POST',
        payload
      );
      setBanners((current) =>
        banner.id
          ? current.map((item) => (item.id === banner.id ? data.banner : item))
          : [...current, data.banner]
      );
      setBanner(blankBanner);
      setNotice({ text: 'Banner saved.', kind: 'success' });
    } catch (error) {
      setNotice({ text: describe(error, 'Banner could not be saved.'), kind: 'error' });
    }
  }

  async function savePage(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await request(
        '/api/v1/content/pages',
        page.id ? 'PUT' : 'POST',
        { ...page, slug: page.slug || slugify(page.title) }
      );
      setPages((current) =>
        page.id
          ? current.map((item) => (item.id === page.id ? data.page : item))
          : [...current, data.page]
      );
      setPage(emptyPage());
      setNotice({ text: 'Page saved.', kind: 'success' });
    } catch (error) {
      setNotice({ text: describe(error, 'Page could not be saved.'), kind: 'error' });
    }
  }

  function createNewPage() {
    setPage(emptyPage());
    setNotice(null);
  }

  function editPage(item: Page) {
    setPage({ ...item, content: { html: item.content?.html || '' } });
    setNotice(null);
  }

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
          googleMapLatitude: branding.googleMapLatitude
            ? Number(branding.googleMapLatitude)
            : undefined,
          googleMapLongitude: branding.googleMapLongitude
            ? Number(branding.googleMapLongitude)
            : undefined,
          googlePlaceId: branding.googlePlaceId,
        },
      };
      await request('/api/settings', 'POST', { type: 'profile', data: profilePayload });
      await save('/api/v1/content/navigation', 'PUT', navigation);
      logAuditAction(
        'Site Content',
        'Update branding & map',
        'Updated storefront identity, physical address, Google Maps location, navigation and footer settings.'
      );
      setNotice({
        text: 'Store identity, address, and Google Maps settings saved successfully.',
        kind: 'success',
      });
    } catch (error) {
      setNotice({ text: describe(error, 'Branding could not be saved.'), kind: 'error' });
    }
  }

  async function saveFooter(e: React.FormEvent) {
    e.preventDefault();
    const updatedSettings: Partial<SiteSettings> = {
      ...siteSettings,
      storeName: branding.storeName || siteSettings.storeName,
      tagline: branding.tagline || siteSettings.tagline,
      phone: branding.contactPhone || siteSettings.phone,
      email: branding.contactEmail || siteSettings.email,
      address: branding.address || siteSettings.address,
      openingHours: branding.openingHours || siteSettings.openingHours,
      whatsappNumber: branding.whatsappNumber || siteSettings.whatsappNumber,
      viberNumber: footerData.viberNumber || siteSettings.viberNumber,
      facebookUrl: branding.facebookUrl ?? siteSettings.facebookUrl,
      instagramUrl: branding.instagramUrl ?? siteSettings.instagramUrl,
      tiktokUrl: branding.tiktokUrl ?? siteSettings.tiktokUrl,
      youtubeUrl: branding.youtubeUrl ?? siteSettings.youtubeUrl,
      googleMapLocationUrl: branding.googleMapLocationUrl ?? siteSettings.googleMapLocationUrl,
      footerNotice: footerData.copyrightText ?? siteSettings.footerNotice,
      footerSettings: footerData,
    };
    updateSiteSettings(updatedSettings);

    try {
      const profilePayload = {
        ...branding,
        configuration: {
          ...(branding.configuration || {}),
          footerSettings: footerData,
          whatsappNumber: branding.whatsappNumber,
          viberNumber: footerData.viberNumber,
          facebookUrl: branding.facebookUrl,
          instagramUrl: branding.instagramUrl,
          tiktokUrl: branding.tiktokUrl,
          youtubeUrl: branding.youtubeUrl,
          footerNotice: footerData.copyrightText,
        },
      };
      await request('/api/settings', 'POST', { type: 'profile', data: profilePayload });
      await save('/api/v1/content/navigation', 'PUT', {
        items: navigation.items,
        settings: {
          ...navigation.settings,
          socialLinks: {
            facebook: branding.facebookUrl || '',
            instagram: branding.instagramUrl || '',
            tiktok: branding.tiktokUrl || '',
            youtube: branding.youtubeUrl || '',
          },
          footerColumns: footerData.columns || [],
          copyrightText: footerData.copyrightText || '',
        },
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('store-settings-updated'));
      }

      logAuditAction(
        'Site Content',
        'Update footer settings',
        'Updated footer store bio, trust pillars, link columns, payments, and contact gateways.'
      );
      setNotice({
        text: 'Footer configuration saved and synchronized with storefront.',
        kind: 'success',
      });
    } catch (error) {
      setNotice({ text: describe(error, 'Footer settings could not be saved.'), kind: 'error' });
    }
  }

  // Column helpers for footer
  const addFooterColumn = () => {
    const currentCols = footerData.columns || [];
    if (currentCols.length >= 4) return;
    setFooterData({
      ...footerData,
      columns: [
        ...currentCols,
        {
          title: `Column ${currentCols.length + 1}`,
          links: [{ label: 'New Link', url: '/shop' }],
        },
      ],
    });
  };

  const removeFooterColumn = (colIndex: number) => {
    const currentCols = footerData.columns || [];
    setFooterData({
      ...footerData,
      columns: currentCols.filter((_, i) => i !== colIndex),
    });
  };

  const updateColumnTitle = (colIndex: number, title: string) => {
    const currentCols = [...(footerData.columns || [])];
    if (currentCols[colIndex]) {
      currentCols[colIndex] = { ...currentCols[colIndex], title };
      setFooterData({ ...footerData, columns: currentCols });
    }
  };

  const addColumnLink = (colIndex: number) => {
    const currentCols = [...(footerData.columns || [])];
    if (currentCols[colIndex]) {
      currentCols[colIndex] = {
        ...currentCols[colIndex],
        links: [...currentCols[colIndex].links, { label: 'New Link', url: '/shop' }],
      };
      setFooterData({ ...footerData, columns: currentCols });
    }
  };

  const removeColumnLink = (colIndex: number, linkIndex: number) => {
    const currentCols = [...(footerData.columns || [])];
    if (currentCols[colIndex]) {
      currentCols[colIndex] = {
        ...currentCols[colIndex],
        links: currentCols[colIndex].links.filter((_, i) => i !== linkIndex),
      };
      setFooterData({ ...footerData, columns: currentCols });
    }
  };

  const updateColumnLink = (
    colIndex: number,
    linkIndex: number,
    field: 'label' | 'url',
    value: string
  ) => {
    const currentCols = [...(footerData.columns || [])];
    if (currentCols[colIndex]?.links[linkIndex]) {
      const updatedLinks = [...currentCols[colIndex].links];
      updatedLinks[linkIndex] = { ...updatedLinks[linkIndex], [field]: value };
      currentCols[colIndex] = { ...currentCols[colIndex], links: updatedLinks };
      setFooterData({ ...footerData, columns: currentCols });
    }
  };

  const updateTrustPillar = (
    index: number,
    field: keyof FooterTrustPillar,
    value: string
  ) => {
    const currentPillars = [...(footerData.trustPillars || DEFAULT_FOOTER_SETTINGS.trustPillars || [])];
    if (currentPillars[index]) {
      currentPillars[index] = { ...currentPillars[index], [field]: value };
      setFooterData({ ...footerData, trustPillars: currentPillars });
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 pt-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(([id, label, Icon]) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold ${
                tab === id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-5 md:p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">
              Site & content
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              {tabs.find(([id]) => id === tab)?.[1]}
            </h2>
          </div>
          {notice && (
            <span
              className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${
                notice.kind === 'error'
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {notice.kind === 'error' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {notice.text}
            </span>
          )}
        </div>

        {/* 1. HERO SLIDERS & BANNERS */}
        {tab === 'banners' && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-3">
              {banners.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-extrabold">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.status} · {item.desktopImageUrl ? 'Desktop image set' : 'No desktop image'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBanner(item)}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/v1/content/banners?id=${item.id}`, { method: 'DELETE' });
                        setBanners(banners.filter((b) => b.id !== item.id));
                      }}
                      className="rounded-lg bg-rose-50 p-2 text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!banners.length && (
                <Empty text="No hero banners yet. Create your first responsive promotional banner." />
              )}
            </div>

            <form onSubmit={saveBanner} className="space-y-4 rounded-2xl bg-slate-50 p-4">
              <h3 className="font-extrabold">Banner carousel builder</h3>
              <Field
                label="Campaign title"
                required
                maxLength={200}
                value={banner.title}
                onChange={(v) => setBanner({ ...banner, title: v })}
              />
              <ImageUploadField
                label="Desktop banner"
                hint="Recommended 1920 x 600"
                purpose="banner"
                value={banner.desktopImageUrl}
                onChange={(v) => setBanner({ ...banner, desktopImageUrl: v })}
              />
              <ImageUploadField
                label="Mobile banner"
                hint="Recommended 800 x 800"
                purpose="banner"
                value={banner.mobileImageUrl}
                onChange={(v) => setBanner({ ...banner, mobileImageUrl: v })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="CTA label"
                  value={banner.ctaLabel}
                  onChange={(v) => setBanner({ ...banner, ctaLabel: v })}
                />
                <Field
                  label="Target link"
                  value={banner.ctaUrl}
                  onChange={(v) => setBanner({ ...banner, ctaUrl: v })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Starts at"
                  type="datetime-local"
                  value={banner.startsAt || ''}
                  onChange={(v) => setBanner({ ...banner, startsAt: v })}
                />
                <Field
                  label="Ends at"
                  type="datetime-local"
                  value={banner.endsAt || ''}
                  onChange={(v) => setBanner({ ...banner, endsAt: v })}
                />
              </div>
              <Select
                label="Status"
                value={banner.status}
                options={['draft', 'published']}
                onChange={(v) => setBanner({ ...banner, status: v as Banner['status'] })}
              />
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white">
                <Save className="h-4 w-4" />
                Save banner
              </button>
            </form>
          </div>
        )}

        {/* 2. HOMEPAGE LAYOUT */}
        {tab === 'layout' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800">Homepage Layout Blocks</h3>
              <p className="text-sm text-slate-500">
                Enable, disable, and reorder sections displayed on your main storefront.
              </p>
            </div>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div
                  key={section.id || section.sectionType}
                  className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                    section.isEnabled
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-100 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={!index}
                        onClick={() =>
                          setSections(
                            move(sections, index, index - 1).map((item, i) => ({
                              ...item,
                              displayOrder: i + 1,
                            }))
                          )
                        }
                        className="rounded bg-slate-100 p-1 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === sections.length - 1}
                        onClick={() =>
                          setSections(
                            move(sections, index, index + 1).map((item, i) => ({
                              ...item,
                              displayOrder: i + 1,
                            }))
                          )
                        }
                        className="rounded bg-slate-100 p-1 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div>
                      <span className="mr-2 text-xs font-extrabold text-slate-400">#{index + 1}</span>
                      <span className="font-extrabold text-slate-800">{section.title}</span>
                      <span className="ml-3 rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600">
                        {section.sectionType}
                      </span>
                      <p className="mt-1 text-xs text-slate-400">
                        {String(section.configuration.type || 'CONTENT_BLOCK')}
                      </p>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={section.isEnabled}
                      onChange={() =>
                        setSections(
                          sections.map((item, i) =>
                            i === index ? { ...item, isEnabled: !item.isEnabled } : item
                          )
                        )
                      }
                      className="h-4 w-4"
                    />
                    {section.isEnabled ? 'Visible' : 'Hidden'}
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                void saveLayout();
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
            >
              <Save className="h-4 w-4" />
              Save homepage order
            </button>
          </div>
        )}

        {/* 3. CUSTOM PAGES */}
        {tab === 'pages' && (
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-3">
              {pages.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => editPage(item)}
                  className={`block w-full rounded-2xl border p-4 text-left ${
                    page.id === item.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <p className="font-extrabold">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    /pages/{item.slug} · {item.status}
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={createNewPage}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                New custom page
              </button>
            </div>

            <form onSubmit={savePage} className="space-y-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {page.id ? `Editing page #${page.id}` : 'Create new page'}
              </p>
              <Field
                label="Page title"
                required
                maxLength={200}
                value={page.title}
                onChange={(v) =>
                  setPage({ ...page, title: v, slug: page.id ? page.slug : slugify(v) })
                }
              />
              <Field
                label="URL slug"
                required
                maxLength={220}
                value={page.slug}
                onChange={(v) => setPage({ ...page, slug: slugify(v) })}
              />
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600">Rich text content</span>
                <textarea
                  required
                  value={page.content.html}
                  onChange={(e) => setPage({ ...page, content: { html: e.target.value } })}
                  rows={14}
                  placeholder="Write policy, warranty, or about-us content here..."
                  className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm outline-none focus:border-slate-900"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Meta title"
                  value={page.metaTitle}
                  onChange={(v) => setPage({ ...page, metaTitle: v })}
                />
                <Field
                  label="Meta description"
                  value={page.metaDescription}
                  onChange={(v) => setPage({ ...page, metaDescription: v })}
                />
              </div>
              <Select
                label="Status"
                value={page.status}
                options={['draft', 'published']}
                onChange={(v) => setPage({ ...page, status: v as Page['status'] })}
              />
              <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                <Save className="h-4 w-4" />
                {page.id ? 'Update page' : 'Create page'}
              </button>
            </form>
          </div>
        )}

        {/* 4. HEADER NAVIGATION MENU */}
        {tab === 'navigation' && (
          <form onSubmit={saveBranding} className="space-y-5">
            <div className="space-y-3">
              <h3 className="font-extrabold text-slate-900">Header Top Navigation Links</h3>
              <p className="text-xs text-slate-500">
                Configure menu items displayed in the storefront top navigation header.
              </p>
              {navigation.items.map((item: any, index: number) => (
                <div
                  key={item.id || index}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-center rounded-xl border border-slate-100 bg-slate-50/50 p-2.5"
                >
                  <Field
                    label="Label"
                    value={item.label}
                    onChange={(v) =>
                      setNavigation({
                        ...navigation,
                        items: navigation.items.map((x: any, i: number) =>
                          i === index ? { ...x, label: v } : x
                        ),
                      })
                    }
                  />
                  <Field
                    label="URL / View Route"
                    value={item.url || ''}
                    placeholder="/shop, /services, /contact"
                    onChange={(v) =>
                      setNavigation({
                        ...navigation,
                        items: navigation.items.map((x: any, i: number) =>
                          i === index ? { ...x, url: v } : x
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNavigation({
                        ...navigation,
                        items: navigation.items.filter((_: any, i: number) => i !== index),
                      })
                    }
                    className="self-end rounded-lg bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setNavigation({
                    ...navigation,
                    items: [
                      ...navigation.items,
                      {
                        label: 'New item',
                        url: '/shop',
                        displayOrder: navigation.items.length,
                        isActive: true,
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add menu item
              </button>
            </div>

            <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
              <Save className="h-4 w-4" />
              Save header navigation
            </button>
          </form>
        )}

        {/* 5. FOOTER MANAGEMENT (NEW & COMPREHENSIVE) */}
        {tab === 'footer' && (
          <form onSubmit={saveFooter} className="space-y-8">
            {/* Top Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
              <div>
                <h3 className="text-sm font-extrabold text-blue-900 flex items-center gap-2">
                  <PanelsTopBottom className="w-4 h-4 text-blue-600" />
                  <span>Storefront Footer Management</span>
                </h3>
                <p className="text-xs text-blue-700 mt-0.5">
                  Update live showroom status, customer support hotlines (WhatsApp, Viber), link columns, trust badges, and Nepal tax info.
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save footer settings</span>
              </button>
            </div>

            {/* 1. Store Bio, Live Status & Official Tax Registration */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>1. Store Bio &amp; Showroom Beacon</span>
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">
                    Footer About Description
                  </span>
                  <textarea
                    rows={3}
                    value={footerData.aboutDescription || ''}
                    onChange={(e) =>
                      setFooterData({ ...footerData, aboutDescription: e.target.value })
                    }
                    placeholder="Brief intro about Intel Computer Center shown under the logo..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <Field
                  label="Registered PAN / VAT Number"
                  placeholder="302910482"
                  value={footerData.panNumber || ''}
                  onChange={(v) => setFooterData({ ...footerData, panNumber: v })}
                />

                <Field
                  label="Custom Status Override (Optional)"
                  placeholder="Leave empty for auto Nepal Time calculation"
                  value={footerData.customStatusText || ''}
                  onChange={(v) => setFooterData({ ...footerData, customStatusText: v })}
                />

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={footerData.showLiveStatus !== false}
                      onChange={(e) =>
                        setFooterData({ ...footerData, showLiveStatus: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      Display live showroom open/closed beacon in footer
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 2. Direct Contact Gateways & Viber / WhatsApp Integration */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <span>2. Showroom Hotlines &amp; Direct Messaging</span>
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="WhatsApp Number (With Country Code)"
                  placeholder="+977-9848424859"
                  value={branding.whatsappNumber || ''}
                  onChange={(v) => setBranding({ ...branding, whatsappNumber: v })}
                />

                <div>
                  <Field
                    label="Viber Number / Chat Target"
                    placeholder="+977-9848424859"
                    value={footerData.viberNumber || branding.whatsappNumber || ''}
                    onChange={(v) => setFooterData({ ...footerData, viberNumber: v })}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Provides direct <code>viber://chat?number=...</code> launch for mobile &amp; desktop users in Nepal.
                  </p>
                </div>

                <Field
                  label="Showroom Primary Phone"
                  placeholder="091-525287"
                  value={branding.contactPhone || ''}
                  onChange={(v) => setBranding({ ...branding, contactPhone: v })}
                />

                <Field
                  label="Support / Tech Hotline Phone"
                  placeholder="+977-9848424859"
                  value={footerData.secondaryPhone || ''}
                  onChange={(v) => setFooterData({ ...footerData, secondaryPhone: v })}
                />

                <Field
                  label="Official Contact Email"
                  placeholder="iccdhangadhi@gmail.com"
                  value={branding.contactEmail || ''}
                  onChange={(v) => setBranding({ ...branding, contactEmail: v })}
                />

                <Field
                  label="Showroom Physical Address"
                  placeholder="Ratopool, Dhangadhi, Nepal"
                  value={branding.address || ''}
                  onChange={(v) => setBranding({ ...branding, address: v })}
                />

                <Field
                  label="Opening Hours Text"
                  placeholder="Sun - Fri: 9:30 AM - 7:00 PM | Sat: By Appt"
                  value={branding.openingHours || ''}
                  onChange={(v) => setBranding({ ...branding, openingHours: v })}
                />

                <Field
                  label="Google Maps Location URL"
                  placeholder="https://maps.app.goo.gl/..."
                  value={branding.googleMapLocationUrl || ''}
                  onChange={(v) => setBranding({ ...branding, googleMapLocationUrl: v })}
                />
              </div>

              {/* Social Channels */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-3">
                  Social Channels (Links in bottom footer bar):
                </span>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Facebook URL"
                    placeholder="https://facebook.com/..."
                    value={branding.facebookUrl || ''}
                    onChange={(v) => setBranding({ ...branding, facebookUrl: v })}
                  />
                  <Field
                    label="Instagram URL"
                    placeholder="https://instagram.com/..."
                    value={branding.instagramUrl || ''}
                    onChange={(v) => setBranding({ ...branding, instagramUrl: v })}
                  />
                  <Field
                    label="TikTok URL"
                    placeholder="https://tiktok.com/@..."
                    value={branding.tiktokUrl || ''}
                    onChange={(v) => setBranding({ ...branding, tiktokUrl: v })}
                  />
                  <Field
                    label="YouTube URL"
                    placeholder="https://youtube.com/@..."
                    value={branding.youtubeUrl || ''}
                    onChange={(v) => setBranding({ ...branding, youtubeUrl: v })}
                  />
                </div>
              </div>
            </div>

            {/* 3. Top Trust Pillars (4 Key Customer Assurances) */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                3. Top Trust Pillars (4 Header Badges)
              </h4>
              <p className="text-xs text-slate-500">
                Displayed in the clean white bar right above the directory directory.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(footerData.trustPillars || DEFAULT_FOOTER_SETTINGS.trustPillars || []).map(
                  (pillar: FooterTrustPillar, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5"
                    >
                      <span className="text-[11px] font-extrabold uppercase text-blue-700">
                        Badge #{idx + 1}
                      </span>
                      <Field
                        label="Title"
                        value={pillar.title}
                        onChange={(v) => updateTrustPillar(idx, 'title', v)}
                      />
                      <Field
                        label="Subtitle"
                        value={pillar.subtitle}
                        onChange={(v) => updateTrustPillar(idx, 'subtitle', v)}
                      />
                      <Select
                        label="Icon"
                        value={pillar.icon || 'shield'}
                        options={['shield', 'truck', 'wrench', 'card']}
                        onChange={(v) => updateTrustPillar(idx, 'icon', v)}
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 4. Dynamic Link Columns Builder */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    4. Footer Link Columns
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add or rearrange navigation columns (e.g. Catalog, Services, Policies).
                  </p>
                </div>
                {(footerData.columns || []).length < 4 && (
                  <button
                    type="button"
                    onClick={addFooterColumn}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Column</span>
                  </button>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {(footerData.columns || []).map((col: FooterColumn, cIdx: number) => (
                  <div
                    key={cIdx}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Field
                        label={`Column #${cIdx + 1} Title`}
                        value={col.title}
                        onChange={(v) => updateColumnTitle(cIdx, v)}
                      />
                      <button
                        type="button"
                        onClick={() => removeFooterColumn(cIdx)}
                        className="self-end rounded-lg bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 transition-colors"
                        title="Delete column"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-slate-600 block">
                        Column Links:
                      </span>
                      {col.links.map((link: FooterLinkItem, lIdx: number) => (
                        <div
                          key={lIdx}
                          className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={link.label}
                            placeholder="Link text"
                            onChange={(e) =>
                              updateColumnLink(cIdx, lIdx, 'label', e.target.value)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-900"
                          />
                          <input
                            type="text"
                            value={link.url}
                            placeholder="/shop, /about, /faq..."
                            onChange={(e) =>
                              updateColumnLink(cIdx, lIdx, 'url', e.target.value)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => removeColumnLink(cIdx, lIdx)}
                            className="rounded-lg bg-slate-200/70 hover:bg-rose-100 hover:text-rose-600 p-1.5 text-slate-500 transition-colors"
                            title="Remove link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addColumnLink(cIdx)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Link</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Accepted Nepal Payment Gateways */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                5. Accepted Nepal Payment Gateways
              </h4>
              <p className="text-xs text-slate-500">
                Toggle which payment badges are rendered in the footer verification bar.
              </p>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'esewa', label: 'eSewa Digital Wallet' },
                  { key: 'khalti', label: 'Khalti Payment Gateway' },
                  { key: 'fonepay', label: 'Fonepay QR' },
                  { key: 'bankTransfer', label: 'Bank Direct Transfer' },
                  { key: 'cod', label: 'Cash on Delivery (COD)' },
                ].map(({ key, label }) => {
                  const currentVals = footerData.acceptedPayments || {};
                  const isChecked = currentVals[key as keyof typeof currentVals] !== false;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setFooterData({
                            ...footerData,
                            acceptedPayments: {
                              ...currentVals,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 6. Bottom Copyright Notice */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                6. Bottom Legal &amp; Copyright Notice
              </h4>
              <Field
                label="Copyright Text"
                placeholder="© 2026 INTEL COMPUTER CENTER. All rights reserved."
                value={footerData.copyrightText || ''}
                onChange={(v) => setFooterData({ ...footerData, copyrightText: v })}
              />
            </div>

            {/* Submit Bar */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save All Footer Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* 6. BRANDING & IDENTITY */}
        {tab === 'branding' && (
          <form onSubmit={saveBranding} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Store name"
                value={branding.storeName}
                onChange={(v) => setBranding({ ...branding, storeName: v })}
              />
              <Field
                label="Store tagline"
                value={branding.tagline || ''}
                onChange={(v) => setBranding({ ...branding, tagline: v })}
              />
              <Field
                label="Support phone"
                value={branding.contactPhone || ''}
                onChange={(v) => setBranding({ ...branding, contactPhone: v })}
              />
              <Field
                label="Support email"
                value={branding.contactEmail || ''}
                onChange={(v) => setBranding({ ...branding, contactEmail: v })}
              />
              <Field
                label="Opening hours"
                value={branding.openingHours || ''}
                onChange={(v) => setBranding({ ...branding, openingHours: v })}
              />
              <Field
                label="WhatsApp / Mobile number"
                value={branding.whatsappNumber || ''}
                onChange={(v) => setBranding({ ...branding, whatsappNumber: v })}
              />
              <ImageUploadField
                label="Light logo"
                purpose="branding"
                value={branding.logoUrl}
                onChange={(v) => setBranding({ ...branding, logoUrl: v })}
              />
              <ImageUploadField
                label="Dark logo"
                purpose="branding"
                value={branding.darkLogoUrl || ''}
                onChange={(v) => setBranding({ ...branding, darkLogoUrl: v })}
              />
              <ImageUploadField
                label="Favicon"
                hint="PNG or ICO, 32 x 32 or larger"
                purpose="branding"
                value={branding.faviconUrl || ''}
                onChange={(v) => setBranding({ ...branding, faviconUrl: v })}
              />
              <Field
                label="Announcement / free delivery text"
                value={branding.announcementText}
                onChange={(v) => setBranding({ ...branding, announcementText: v })}
              />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={branding.announcementEnabled !== false}
                  onChange={(e) =>
                    setBranding({ ...branding, announcementEnabled: e.target.checked })
                  }
                />
                Show announcement bar
              </label>
              <Field
                label="Announcement background color"
                value={branding.backgroundColor}
                onChange={(v) => setBranding({ ...branding, backgroundColor: v })}
              />
            </div>

            {/* Store Location & Google Maps Configuration */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Store Physical Address &amp; Google Maps Embed
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                Set the physical store location, share URL, coordinates, and embedded map iframe shown on the Contact page, Footer, and customer invoices.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Physical Store Address"
                  value={branding.address || ''}
                  onChange={(v) => setBranding({ ...branding, address: v })}
                />
                <Field
                  label="Google Maps App / Share Link"
                  placeholder="https://maps.app.goo.gl/..."
                  value={branding.googleMapLocationUrl || ''}
                  onChange={(v) => setBranding({ ...branding, googleMapLocationUrl: v })}
                />
                <Field
                  label="GPS Latitude"
                  placeholder="28.7042726"
                  value={branding.googleMapLatitude ?? ''}
                  onChange={(v) => setBranding({ ...branding, googleMapLatitude: v })}
                />
                <Field
                  label="GPS Longitude"
                  placeholder="80.576736"
                  value={branding.googleMapLongitude ?? ''}
                  onChange={(v) => setBranding({ ...branding, googleMapLongitude: v })}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Google Maps Embed Iframe URL"
                    placeholder="https://www.google.com/maps/embed?pb=..."
                    value={branding.googleMapEmbedUrl || ''}
                    onChange={(v) => setBranding({ ...branding, googleMapEmbedUrl: v })}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tip: In Google Maps, click <strong>Share &gt; Embed a map &gt; Copy HTML</strong> and paste the <code>src="..."</code> URL here.
                  </p>
                </div>
              </div>

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
              <Save className="h-4 w-4" />
              Save branding &amp; map settings
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">{text}</p>;
}
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  maxLength,
  placeholder,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
      />
    </label>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
function isUsableImageUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('/') || /^https?:\/\//i.test(value))
  );
}
