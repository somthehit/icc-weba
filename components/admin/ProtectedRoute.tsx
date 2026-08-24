'use client';

import React from 'react';
import { useStore } from '@/context/StoreContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
  fallback?: React.ReactNode;
}

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
    <div className="text-center space-y-4 max-w-sm">{children}</div>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  allowedRoles,
  fallback,
}) => {
  const { isUserLoggedIn, currentUser, isAdminLoggedIn, authStatus, navigateTo } = useStore();

  // The cookie hasn't been checked yet. Denying here would lock out a signed-in
  // user for the first few hundred milliseconds after every reload.
  if (authStatus === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 text-[#0056b3] animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Checking your session…</p>
      </Centered>
    );
  }

  if (requireAuth && !isUserLoggedIn && !isAdminLoggedIn) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // This used to say "Redirecting to login…" and then never redirect, leaving a
    // permanent spinner. The redirect is the page router's job, so offer the link
    // rather than implying something is already happening.
    return (
      <Centered>
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-2xl">
          🔑
        </div>
        <h2 className="text-xl font-bold text-gray-900">Please sign in</h2>
        <p className="text-sm text-gray-500">
          You need an account to view this page.
        </p>
        <button
          onClick={() => navigateTo('customer-login')}
          className="bg-[#0056b3] hover:bg-[#004494] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Go to sign in
        </button>
      </Centered>
    );
  }

  // A missing role is not an allowed role. The previous condition required
  // `currentUser?.role` to be truthy, so a session without a role on it skipped
  // the check entirely and fell through to the protected children.
  if (allowedRoles && !allowedRoles.includes(currentUser?.role ?? '')) {
    return (
      <Centered>
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-2xl">
          🔒
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500">
          You don&apos;t have permission to access this page.
        </p>
        <button
          onClick={() => navigateTo('home')}
          className="text-sm text-[#0056b3] font-bold hover:underline"
        >
          Back to store
        </button>
      </Centered>
    );
  }

  return <>{children}</>;
};
