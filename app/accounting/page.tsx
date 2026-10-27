import React from 'react';
import { StoreProvider } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import { AccountingDashboardView } from '@/components/admin/AccountingDashboardView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Central Accounting & Invoices Hub | Intel Computer Center',
  description: 'Enterprise Accounting Dashboard: cashier shift reconciliations, tax invoices, purchase orders, vendor payables, and general ledger.',
};

export default function AccountingPage() {
  return (
    <StoreProvider>
      <SeoProvider>
        <div className="accounting-portal min-h-screen bg-slate-50">
          <AccountingDashboardView />
        </div>
      </SeoProvider>
    </StoreProvider>
  );
}
