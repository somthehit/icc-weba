import React from 'react';
import { StoreProvider } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import { StorekeeperDashboard } from '@/components/admin/StorekeeperDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Store & Warehouse Inventory Manager | Intel Computer Center',
  description: 'Manage warehouse inventory, GRN (Goods Received Notes), barcode stock tracking, and supplier restocks.',
};

export default function StoreManagePage() {
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 antialiased selection:bg-emerald-600 selection:text-white flex flex-col">
      <StoreProvider>
        <SeoProvider>
          <StorekeeperDashboard />
        </SeoProvider>
      </StoreProvider>
    </div>
  );
}
