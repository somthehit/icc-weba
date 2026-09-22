'use client';

import React from 'react';
import { StoreProvider, useStore } from '@/context/StoreContext';
import { SeoProvider } from '@/context/SeoContext';
import { Header } from '@/components/Header';
import { MobileNav } from '@/components/MobileNav';
import { QuickViewModal } from '@/components/QuickViewModal';
import { CartDrawer } from '@/components/CartDrawer';
import { AiConsultantDrawer } from '@/components/AiConsultantDrawer';
import { ServiceBookingModal } from '@/components/ServiceBookingModal';
import { AuthModal } from '@/components/AuthModal';
import { SeoManager } from '@/components/SeoManager';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { HomeView } from '@/views/HomeView';
import { ShopView } from '@/views/ShopView';
import { ProductDetailView } from '@/views/ProductDetailView';
import { CartView } from '@/views/CartView';
import { CheckoutView } from '@/views/CheckoutView';
import { TrackOrderView } from '@/views/TrackOrderView';
import { ServicesView } from '@/views/ServicesView';
import { BrandsView } from '@/views/BrandsView';
import { AboutContactView } from '@/views/AboutContactView';
import { AccountView } from '@/views/AccountView';
import { WishlistView } from '@/views/WishlistView';
import { AdminView } from '@/views/AdminView';
import { CompareView } from '@/views/CompareView';
import { FaqView } from '@/views/FaqView';
import { CustomerLoginView } from '@/views/CustomerLoginView';
import { CustomerRegisterView } from '@/views/CustomerRegisterView';
import { AdminLoginView } from '@/views/AdminLoginView';
import { DriverTrackingView } from '@/views/DriverTrackingView';

function AppContent() {
  const { currentPage, isUserLoggedIn, isAdminLoggedIn, authStatus, navigateTo } = useStore();

  const REQUIRES_AUTH = ['cart', 'checkout', 'account', 'wishlist', 'track-order'];
  const ADMIN_ONLY = ['admin', 'driver-tracking'];

  /**
   * Where the current page should send an unauthorised visitor, or null if they
   * may stay. Computed rather than acted on directly: the previous version called
   * navigateTo() from inside the render function, which updates state mid-render
   * and makes React throw "Cannot update a component while rendering".
   */
  const redirectTo = (() => {
    // Still reading the session cookie — deciding now would bounce a signed-in
    // user who just reloaded the page.
    if (authStatus === 'loading') return null;
    if (REQUIRES_AUTH.includes(currentPage) && !isUserLoggedIn && !isAdminLoggedIn) {
      return 'customer-login';
    }
    if (ADMIN_ONLY.includes(currentPage) && !isAdminLoggedIn) return 'admin-login';
    return null;
  })();

  React.useEffect(() => {
    if (redirectTo) navigateTo(redirectTo);
  }, [redirectTo, navigateTo]);

  const renderActiveView = () => {
    // Render the destination straight away so the protected view never flashes
    // while the effect above updates the hash.
    if (redirectTo === 'customer-login') return <CustomerLoginView />;
    if (redirectTo === 'admin-login') return <AdminLoginView />;

    switch (currentPage) {
      case 'home':
        return <HomeView />;
      case 'shop':
        return <ShopView />;
      case 'product-detail':
        return <ProductDetailView />;
      case 'cart':
        return (
          <ProtectedRoute>
            <CartView />
          </ProtectedRoute>
        );
      case 'checkout':
        return (
          <ProtectedRoute>
            <CheckoutView />
          </ProtectedRoute>
        );
      case 'track-order':
        return (
          <ProtectedRoute>
            <TrackOrderView />
          </ProtectedRoute>
        );
      case 'services':
        return <ServicesView />;
      case 'brands':
        return <BrandsView />;
      case 'about':
      case 'contact':
        return <AboutContactView />;
      case 'account':
        return (
          <ProtectedRoute>
            <AccountView />
          </ProtectedRoute>
        );
      case 'wishlist':
        return (
          <ProtectedRoute>
            <WishlistView />
          </ProtectedRoute>
        );
      case 'admin':
        return (
          <ProtectedRoute requireAuth={true} allowedRoles={['admin', 'sales', 'inventory_manager', 'service_technician']}>
            <AdminView />
          </ProtectedRoute>
        );
      case 'compare':
        return <CompareView />;
      case 'faq':
        return <FaqView />;
      case 'customer-login':
        return <CustomerLoginView />;
      case 'customer-register':
        return <CustomerRegisterView />;
      case 'admin-login':
        return <AdminLoginView />;
      case 'driver-tracking':
        return (
          <ProtectedRoute requireAuth={true} allowedRoles={['admin', 'service_technician']}>
            <DriverTrackingView />
          </ProtectedRoute>
        );
      default:
        return <HomeView />;
    }
  };

  const isAdminPage = currentPage === 'admin';
  const isStandalonePage = isAdminPage || currentPage === 'customer-login' || currentPage === 'customer-register' || currentPage === 'admin-login' || currentPage === 'driver-tracking';

  return (
    <div
      className={`${isAdminPage ? 'h-screen overflow-hidden' : 'min-h-screen'} ${
        isStandalonePage ? (isAdminPage ? 'bg-[#0F1420]' : 'bg-white') : 'bg-white'
      } ${isAdminPage ? 'pb-0' : 'pb-16 md:pb-0'} flex flex-col text-[#1a1a1a] font-sans antialiased selection:bg-[#0056b3] selection:text-white`}
    >
      {/* Dynamic SEO Meta Tags Manager */}
      <SeoManager />

      {/* Top Header - Hidden on Admin Dashboard and Auth Pages */}
      {!isStandalonePage && <Header />}

      {/* Main Content Area */}
      <main className={`flex-1 ${isAdminPage ? 'min-h-0 h-full overflow-hidden' : ''}`}>
        {renderActiveView()}
      </main>

      {/* Mobile Bottom Navigation Bar - Hidden on Admin Dashboard and Auth Pages */}
      {!isStandalonePage && <MobileNav />}

      {/* Global Drawers & Modals */}
      {!isStandalonePage && (
        <>
          <QuickViewModal />
          <CartDrawer />
          <AiConsultantDrawer />
          <ServiceBookingModal />
          <AuthModal />
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <SeoProvider>
        <AppContent />
      </SeoProvider>
    </StoreProvider>
  );
}
