'use client';

import React, { useEffect } from 'react';
import { StoreProvider, useStore } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import { AdminView } from '@/views/AdminView';
import { AdminLoginView } from '@/views/AdminLoginView';
import { Loader2 } from 'lucide-react';

function AdminContent() {
  const { isAdminLoggedIn, authStatus, navigateTo } = useStore();

  useEffect(() => {
    navigateTo('admin');
  }, [navigateTo]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0F1420] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#0056b3] animate-spin mb-3" />
        <p className="text-sm text-gray-400 font-medium">Verifying staff credentials…</p>
      </div>
    );
  }

  if (!isAdminLoggedIn) {
    return <AdminLoginView />;
  }

  return <AdminView />;
}

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#0F1420] text-slate-100 flex flex-col font-sans">
      <StoreProvider>
        <SeoProvider>
          <AdminContent />
        </SeoProvider>
      </StoreProvider>
    </div>
  );
}
