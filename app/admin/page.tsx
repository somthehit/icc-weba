import React from 'react';
import type { Metadata } from 'next';
import { StoreProvider } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import { AdminClient } from './AdminClient';

export const metadata: Metadata = {
  title: 'Admin Console | Intel Computer Center',
  description: 'Enterprise Admin Portal: manage inventory, catalog, customer orders, services, accounting, and site content.',
};

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0F1420] text-slate-100 flex flex-col font-sans">
      <StoreProvider>
        <SeoProvider>
          <AdminClient />
        </SeoProvider>
      </StoreProvider>
    </div>
  );
}
