'use client';

import React, { useState } from 'react';
import { type SiteSettings } from '@/types';
import {
  Check,
  Save,
} from 'lucide-react';

/**
 * Module 7 — site name, logo and the announcement bar.
 *
 * These three fields live in `siteSettings`, which is still client-side state.
 * The `hero_slides`, `pages`, `navigation_menu_items` and `announcement_bar`
 * tables have no admin write path yet.
 */
export interface ContentModuleProps {
  siteSettings: SiteSettings;
  updateSiteSettings: (newSettings: Partial<SiteSettings>) => void;
  logAuditAction: (module: string, action: string, details: string) => void;
}

export const ContentModule: React.FC<ContentModuleProps> = ({ siteSettings, updateSiteSettings, logAuditAction }) => {
  const [settingsForm, setSettingsForm] = useState(siteSettings);
  const [isSettingsSavedMsg, setIsSettingsSavedMsg] = useState(false);

  const handleSaveSiteSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settingsForm);
    setIsSettingsSavedMsg(true);
    logAuditAction('Site Elements & Branding', 'Update Branding', 'Updated site name, logo URL, and announcement banner.');
    setTimeout(() => {
      setIsSettingsSavedMsg(false);
    }, 3000);
  };

  return (
    <form onSubmit={handleSaveSiteSettings} className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-6 shadow-sm">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h2 className="text-lg font-black text-[#1a1a1a]">Store Branding &amp; Content Management</h2>
            <p className="text-xs text-gray-500">Edit storefront identity, header marquee text, physical address, and logo.</p>
          </div>

          <div className="flex items-center gap-3">
            {isSettingsSavedMsg && (
              <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
            <button type="submit" className="bg-[#0056b3] text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Store Name</label>
            <input
              type="text"
              value={settingsForm.storeName}
              onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
              className="w-full p-2.5 border rounded-xl font-bold text-sm"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Top Bar Announcement Banner Text</label>
            <input
              type="text"
              value={settingsForm.announcementText}
              onChange={(e) => setSettingsForm({ ...settingsForm, announcementText: e.target.value })}
              className="w-full p-2.5 border rounded-xl"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Logo Image File Path / URL</label>
            <input
              type="text"
              value={settingsForm.logoUrl}
              onChange={(e) => setSettingsForm({ ...settingsForm, logoUrl: e.target.value })}
              className="w-full p-2.5 border rounded-xl font-mono text-xs"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Physical Store Address</label>
            <input
              type="text"
              value={settingsForm.address}
              onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
