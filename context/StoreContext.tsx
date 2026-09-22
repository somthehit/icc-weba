'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  Product,
  ProductCategory,
  CategoryItem,
  Brand,
  CartItem,
  CartQuote,
  Order,
  PaymentMethod,
  ServiceRequest,
  Coupon,
  Review,
  OrderStatus,
  SiteSettings
} from '@/types';
import {
  INITIAL_SERVICE_REQUESTS,
  INITIAL_COUPONS,
  INITIAL_SITE_SETTINGS,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
} from '@/lib/data/initial-data';
import { computeProductEffectivePrice } from '@/lib/offers/offerUtils';
import { DB_STATUS, orderRowIds, toUiOrder, type DbOrderDetail } from '@/lib/adapters/orders';
import { auth, googleProvider, signInWithPopup } from '@/lib/firebase';
import {
  addCartLine,
  archiveProductRequest,
  createProductRequest,
  deleteCartLine,
  fetchCart,
  fetchOrders,
  fetchQuote,
  placeOrderRequest,
  setCartLineQuantity,
  updateProductRequest,
  type ProductWriteInput,
  type QuoteRequest,
  type ServerCartRow,
} from '@/lib/api/storefront';

/** UI-facing name for each staff role stored in the database. */
type AdminRole = 'super_admin' | 'sales' | 'inventory' | 'service';

/**
 * The database uses `user_role` values; the dashboard was written against its own
 * shorter names. Anything absent from this map — `customer` included — has no
 * staff access, which is what makes it the single place that decides who is an
 * admin on the client.
 */
const ADMIN_ROLE_BY_DB_ROLE: Record<string, AdminRole> = {
  admin: 'super_admin',
  sales: 'sales',
  inventory_manager: 'inventory',
  service_technician: 'service',
};

interface StoreContextType {
  products: Product[];
  categories: CategoryItem[];
  brands: Brand[];
  /** True while the catalogue is being fetched for the first time. */
  isCatalogLoading: boolean;
  /** Set when the catalogue fetch failed, so views can offer a retry. */
  catalogError: string | null;
  /** Re-reads the catalogue from the API (after an admin edit, or a failed load). */
  refreshCatalog: () => Promise<void>;
  cart: CartItem[];
  /**
   * The cart's money as the server computed it — `null` until the first quote
   * lands, or while the cart is empty. Nothing in the browser adds up an order
   * total any more; the same module prices the order that actually gets written.
   */
  cartQuote: CartQuote | null;
  isQuoting: boolean;
  /** Why the last quote failed — an expired coupon, a line that went out of stock. */
  quoteError: string | null;
  /** Why the last cart change failed. */
  cartError: string | null;
  /** The delivery zone the checkout has chosen, which the quote is priced for. */
  deliveryZoneId: number | null;
  setDeliveryZoneId: (id: number | null) => void;
  wishlist: string[];
  compareList: string[];
  orders: Order[];
  isOrdersLoading: boolean;
  ordersError: string | null;
  /** Re-reads the caller's orders (all of them, for staff). */
  refreshOrders: () => Promise<void>;
  serviceRequests: ServiceRequest[];
  coupons: Coupon[];
  activeCoupon: Coupon | null;
  reviews: Review[];
  siteSettings: SiteSettings;
  savedImages: Array<{ id: string; url: string; prompt: string; createdAt: string; aspectRatio?: string; originalPrompt?: string }>;
  saveGeneratedImage: (img: { url: string; prompt: string; originalPrompt?: string; aspectRatio?: string }) => Promise<void>;
  deleteGeneratedImage: (id: string) => Promise<void>;
  
  // Navigation & View State
  currentPage: string;
  selectedProductSlug: string | null;
  searchQuery: string;
  quickViewProduct: Product | null;
  isCartDrawerOpen: boolean;
  isAiAssistantOpen: boolean;
  isServiceModalOpen: boolean;
  
  // Admin State
  isAdminLoggedIn: boolean;
  adminRole: AdminRole;

  // User Auth State
  isUserLoggedIn: boolean;
  /**
   * 'loading' until the session cookie has been checked against /api/auth/me.
   * Route guards need this: treating the first render as "not signed in" bounces
   * a returning user to the login page before their session has been read.
   */
  authStatus: 'loading' | 'authenticated' | 'anonymous';
  currentUser: { id?: number; name: string; email: string; phone?: string; role?: string; avatarUrl?: string } | null;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (isOpen: boolean) => void;
  logoutUser: () => void;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (name: string, email: string, pass: string, phone: string, address?: { province: string; district: string; municipality: string; wardNo: string; tole?: string; houseNumber?: string }) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;

  // Actions
  navigateTo: (page: string, slug?: string | null) => void;
  setSearchQuery: (query: string) => void;
  setQuickViewProduct: (product: Product | null) => void;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  setIsAiAssistantOpen: (isOpen: boolean) => void;
  setIsServiceModalOpen: (isOpen: boolean) => void;

  // Cart Actions
  //
  // All four hit /api/cart once the customer is signed in, and fall back to the
  // browser-held guest cart until then. They resolve when the server has agreed,
  // so a caller that needs the new cart can await them.
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartSubtotal: () => number;
  getCartDiscount: () => number;
  getCartTotal: () => number;

  // Wishlist Actions
  toggleWishlist: (productId: string) => boolean;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  moveWishlistToCart: (productId: string) => Promise<void>;
  addAllWishlistToCart: () => Promise<void>;

  // Compare Actions
  toggleCompare: (productId: string) => void;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;

  // Coupon Actions
  //
  // The code is checked against the `coupons` table and the basket it is being
  // applied to, so "invalid", "expired", "already redeemed" and "your subtotal is
  // too low" come back as the server's own wording.
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;

  // Order Actions
  /**
   * Places the order from the customer's saved cart.
   *
   * Only the choices belong to the caller — where it goes, how it is paid for.
   * Prices, delivery fee, discount, VAT and the total are all computed inside the
   * same transaction as the stock decrement, so what is charged is what is quoted.
   */
  placeOrder: (details: {
    shippingAddressId?: number;
    deliveryZoneId?: number;
    paymentMethod: PaymentMethod;
    customerNote?: string;
  }) => Promise<{ ok: true; order: Order } | { ok: false; error: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  updateOrderStatusExtended: (
    orderId: string,
    status: OrderStatus,
    options?: { note?: string; location?: string; updatedBy?: string; riderId?: string; riderName?: string; paymentStatus?: 'pending' | 'paid' | 'verified' }
  ) => Promise<void>;
  addStaffNoteToOrder: (orderId: string, author: string, noteText: string, role?: string) => void;
  updateOrder: (updatedOrder: Order) => void;
  getOrderById: (orderId: string) => Order | undefined;

  // Service Actions
  createServiceRequest: (request: Omit<ServiceRequest, 'id' | 'createdAt' | 'status'>) => ServiceRequest;
  updateServiceStatus: (id: string, status: ServiceRequest['status'], technician?: string, cost?: number) => void;

  // Review Actions
  addReview: (review: Omit<Review, 'id' | 'date'>) => void;
  upvoteReview: (reviewId: string) => void;

  // Admin Actions
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  /**
   * Write a product to the database — create when `productId` is omitted, update
   * when it is given — and pull the catalogue back in. Unlike `addProduct` /
   * `updateProduct`, which only move local state, this one persists.
   */
  saveProduct: (
    input: ProductWriteInput,
    productId?: string,
  ) => Promise<{ ok: true; product: Product } | { ok: false; error: string }>;
  /** Retire a product in the database (`status = 'discontinued'`). */
  archiveProduct: (productId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateSiteSettings: (newSettings: Partial<SiteSettings>) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// v2: the catalogue now comes from Postgres, so any v1 blob (which cached whole
// Product objects and the old string product ids) must not be resurrected.
const LOCAL_STORAGE_KEY_PREFIX = 'intel_computer_store_v2_';

/** Product count to pull into the SPA shell; the API caps this at 200. */
const CATALOG_PAGE_SIZE = 200;

/**
 * Postgres `numeric` arrives as a string, so anything priced has to be coerced
 * before it can be compared or added. Used only for display fallbacks — the
 * figures that matter are computed server-side.
 */
const money = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The catalogue starts empty and is filled from the API on mount — never from
  // lib/data/initial-data.ts, which is now only the seed's source material.
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /**
   * The guest cart, held in localStorage until someone signs in.
   *
   * A signed-in customer's cart lives in `cart_items` instead — see `serverCart`.
   * Keeping the two apart means the merge on sign-in has something definite to
   * merge, and that a shared computer doesn't leak one shopper's basket to the
   * next.
   */
  const [localCart, setLocalCart] = useState<CartItem[]>([]);
  /** Rows from `GET /api/cart`, or null when nobody is signed in. */
  const [serverCart, setServerCart] = useState<ServerCartRow[] | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartQuote, setCartQuote] = useState<CartQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [deliveryZoneId, setDeliveryZoneId] = useState<number | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);
  /** Raw order rows from the API; `orders` below is the UI shape derived from them. */
  const [orderRows, setOrderRows] = useState<DbOrderDetail[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  /**
   * Annotations the `orders` table has no column for — staff notes and the
   * assigned rider. Held here so the dashboard keeps working; they do not survive
   * a reload, which is honest about their being unsaved.
   */
  const [orderExtras, setOrderExtras] = useState<Record<string, Partial<Order>>>({});
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>(INITIAL_SERVICE_REQUESTS);
  const [coupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(INITIAL_SITE_SETTINGS);
  const [savedImages, setSavedImages] = useState<Array<{ id: string; url: string; prompt: string; createdAt: string; aspectRatio?: string; originalPrompt?: string }>>([]);
  const isInitialLoadedRef = useRef(false);
  /**
   * The same signal as `isInitialLoadedRef`, but as state so an effect can wait
   * for it. The cart merge on sign-in has to know the guest basket has been read
   * out of localStorage before it decides there is nothing to carry over.
   */
  const [isLocalLoaded, setIsLocalLoaded] = useState(false);
  /**
   * Which user's saved cart has already been adopted, so a re-render doesn't merge
   * the guest basket in a second time.
   */
  const cartSyncedForRef = useRef<number | null>(null);

  useEffect(() => {
    const loadStoreProfile = () => fetch('/api/settings?type=profile')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const profile = data?.profile;
        if (!profile) return;
        const config = (profile.configuration as Record<string, unknown>) || {};
        setSiteSettings((current) => ({
          ...current,
          storeName: profile.storeName || current.storeName,
          tagline: profile.tagline || current.tagline,
          logoUrl: profile.logoUrl || current.logoUrl,
          phone: (profile.contactPhone && !profile.contactPhone.includes('521890')) ? profile.contactPhone : current.phone,
          email: (profile.contactEmail && !profile.contactEmail.includes('icecomputers')) ? profile.contactEmail : current.email,
          address: (profile.address && !profile.address.includes('Campus Chowk')) ? profile.address : current.address,
          openingHours: profile.openingHours || current.openingHours,
          announcementText: profile.announcementText || current.announcementText,
          announcementEnabled: profile.announcementEnabled ?? current.announcementEnabled,
          googleMapEmbedUrl: (profile.googleMapEmbedUrl || config.googleMapEmbedUrl || current.googleMapEmbedUrl) as string,
          googleMapLocationUrl: (profile.googleMapLocationUrl || config.googleMapLocationUrl || current.googleMapLocationUrl) as string,
          googleMapLatitude: (profile.googleMapLatitude ?? config.googleMapLatitude ?? current.googleMapLatitude) as number | undefined,
          googleMapLongitude: (profile.googleMapLongitude ?? config.googleMapLongitude ?? current.googleMapLongitude) as number | undefined,
          googlePlaceId: (profile.googlePlaceId || config.googlePlaceId || current.googlePlaceId) as string,
        }));
      })
      .catch(() => undefined);
    loadStoreProfile();
    window.addEventListener('store-settings-updated', loadStoreProfile);
    return () => window.removeEventListener('store-settings-updated', loadStoreProfile);
  }, []);

  const saveGeneratedImage = async (img: { url: string; prompt: string; originalPrompt?: string; aspectRatio?: string }) => {
    const newImg = {
      id: `img-${Date.now()}`,
      url: img.url,
      prompt: img.prompt,
      originalPrompt: img.originalPrompt,
      aspectRatio: img.aspectRatio,
      createdAt: new Date().toISOString(),
    };
    setSavedImages((prev) => [newImg, ...prev]);
  };

  const deleteGeneratedImage = async (id: string) => {
    setSavedImages((prev) => prev.filter((i) => i.id !== id));
  };

  // Load the catalogue from the API / database with fallback to initial data
  const refreshCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      const [productRes, categoryRes, brandRes, reviewRes] = await Promise.all([
        fetch(`/api/products?limit=${CATALOG_PAGE_SIZE}`).catch(() => null),
        fetch('/api/categories').catch(() => null),
        fetch('/api/brands').catch(() => null),
        fetch('/api/reviews').catch(() => null),
      ]);

      let loadedProducts: Product[] = [];
      let loadedCategories: CategoryItem[] = [];

      if (productRes && productRes.ok) {
        try {
          const productData = await productRes.json();
          if (Array.isArray(productData.products) && productData.products.length > 0) {
            loadedProducts = productData.products;
          }
        } catch (e) {
          console.warn('Failed to parse products json:', e);
        }
      }

      if (categoryRes && categoryRes.ok) {
        try {
          const categoryData = await categoryRes.json();
          if (Array.isArray(categoryData.categories) && categoryData.categories.length > 0) {
            loadedCategories = categoryData.categories;
          }
        } catch (e) {
          console.warn('Failed to parse categories json:', e);
        }
      }

      setProducts(loadedProducts.length > 0 ? loadedProducts : INITIAL_PRODUCTS);
      setCategories(loadedCategories.length > 0 ? loadedCategories : INITIAL_CATEGORIES);

      // Brands and reviews
      if (brandRes && brandRes.ok) {
        try {
          const brandData = await brandRes.json();
          setBrands(
            Array.isArray(brandData.brands) && brandData.brands.length > 0
              ? brandData.brands
              : INITIAL_BRANDS,
          );
        } catch {
          setBrands(INITIAL_BRANDS);
        }
      } else {
        setBrands(INITIAL_BRANDS);
      }

      if (reviewRes && reviewRes.ok) {
        try {
          const reviewData = await reviewRes.json();
          setReviews(Array.isArray(reviewData.reviews) ? reviewData.reviews : []);
        } catch {
          setReviews([]);
        }
      }
    } catch (error) {
      console.error('Error loading catalogue, using fallback initial data:', error);
      setProducts(INITIAL_PRODUCTS);
      setCategories(INITIAL_CATEGORIES);
      setBrands(INITIAL_BRANDS);
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // Load saved state from localStorage after initial client mount to prevent hydration mismatch
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedCart = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}cart`);
        if (savedCart) setLocalCart(JSON.parse(savedCart));

        const savedWishlist = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}wishlist`);
        if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

        const savedCompare = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}compare`);
        if (savedCompare) setCompareList(JSON.parse(savedCompare));

        // Orders are read from the database now. An old blob left here would show a
        // signed-out visitor somebody else's purchase history on a shared machine,
        // so it is cleared rather than ignored.
        localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}orders`);

        const savedServices = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}services`);
        if (savedServices) setServiceRequests(JSON.parse(savedServices));

        const savedSettings = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}site_settings`);
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            // Auto-migrate stale cached contact numbers / address / maps in visitor browsers
            if (
              !parsed.whatsappNumber || 
              parsed.whatsappNumber === '+9779851034291' || 
              parsed.whatsappNumber === '+977-9851034291' || 
              parsed.whatsappNumber.includes('9851034291')
            ) {
              parsed.whatsappNumber = INITIAL_SITE_SETTINGS.whatsappNumber;
            }
            if (
              !parsed.phone || 
              parsed.phone.includes('521890') || 
              parsed.phone.includes('+977+091') || 
              parsed.phone === '+977-1-4261890'
            ) {
              parsed.phone = INITIAL_SITE_SETTINGS.phone;
            }
            if (
              !parsed.address || 
              parsed.address.includes('Campus Chowk') || 
              parsed.address.includes('New Road Plaza')
            ) {
              parsed.address = INITIAL_SITE_SETTINGS.address;
            }
            if (
              !parsed.email || 
              parsed.email.includes('icecomputers')
            ) {
              parsed.email = INITIAL_SITE_SETTINGS.email;
            }
            if (
              !parsed.googleMapEmbedUrl ||
              parsed.googleMapEmbedUrl.includes('101348.57094050164') ||
              parsed.googleMapEmbedUrl.includes('0x39a1ed0ffb42cc37')
            ) {
              parsed.googleMapEmbedUrl = INITIAL_SITE_SETTINGS.googleMapEmbedUrl;
              parsed.googleMapLocationUrl = INITIAL_SITE_SETTINGS.googleMapLocationUrl;
            }
            setSiteSettings((current) => ({ ...current, ...parsed }));
          } catch {
            setSiteSettings(INITIAL_SITE_SETTINGS);
          }
        }
      } catch (e) {
        console.error('Error loading state from localStorage:', e);
      } finally {
        isInitialLoadedRef.current = true;
        setIsLocalLoaded(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // View Controls
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);

  // Admin Controls
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<AdminRole>('super_admin');

  // User Auth State
  //
  // The session itself lives in an httpOnly `auth-token` cookie the server sets,
  // so there is deliberately no token in React state or localStorage — nothing
  // here can read it, and neither can injected script. The state below is just a
  // cache of who /api/auth/me says we are.
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [currentUser, setCurrentUser] = useState<{ id?: number; name: string; email: string; phone?: string; role?: string; avatarUrl?: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  /** Applies a signed-in user to both the customer and the staff view of state. */
  const adoptSession = (user: { id?: number; name: string; email: string; phone?: string; role?: string; avatarUrl?: string }) => {
    setIsUserLoggedIn(true);
    setAuthStatus('authenticated');
    setCurrentUser(user);
    const staffRole = user.role ? ADMIN_ROLE_BY_DB_ROLE[user.role] : undefined;
    // One session covers both surfaces: a staff member browsing the storefront is
    // still signed in, and their admin access follows from the role on the token
    // rather than from a separate client-side flag.
    setIsAdminLoggedIn(Boolean(staffRole));
    if (staffRole) setAdminRole(staffRole);
  };

  const clearSession = () => {
    setIsUserLoggedIn(false);
    setAuthStatus('anonymous');
    setCurrentUser(null);
    setIsAdminLoggedIn(false);
  };

  const logoutUser = () => {
    clearSession();
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      if (!firebaseUser.email) {
        return { success: false, error: 'Google account has no email address.' };
      }

      // Send the Firebase user info to our server to find-or-create the user
      // and get back a custom JWT cookie.
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          email: firebaseUser.email,
          avatarUrl: firebaseUser.photoURL,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Google sign-in failed.' };
      }

      adoptSession(data.user);
      setIsAuthModalOpen(false);

      return { success: true };
    } catch (error: unknown) {
      // Firebase throws a specific error when the user closes the popup.
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          return { success: false, error: 'Sign-in cancelled.' };
        }
        if (firebaseError.code === 'auth/popup-blocked') {
          return { success: false, error: 'Pop-up was blocked by your browser. Please allow pop-ups for this site.' };
        }
      }
      return { success: false, error: 'Google sign-in failed. Please try again.' };
    }
  };

  const loginWithEmail = async (userEmail: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      adoptSession(data.user);
      setIsAuthModalOpen(false);

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const registerWithEmail = async (userName: string, userEmail: string, password: string, userPhone: string, address?: { province: string; district: string; municipality: string; wardNo: string; tole?: string; houseNumber?: string }) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          password,
          phone: userPhone || undefined,
          address: address || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // The API reports per-field problems (password length, phone format);
        // surfacing them beats a generic "Registration failed".
        const detail = Array.isArray(data.details) ? data.details.join(' · ') : null;
        return { success: false, error: detail || data.error || 'Registration failed' };
      }

      adoptSession(data.user);
      setIsAuthModalOpen(false);

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const checkAuth = async () => {
    try {
      // No Authorization header: the cookie travels with a same-origin request,
      // and it is the only copy of the token the browser has.
      const response = await fetch('/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        adoptSession(data.user);
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    }
  };

  // Sync state to localStorage (only after initial load has completed)
  //
  // Only the guest cart is persisted. Once someone signs in their basket lives in
  // `cart_items`, and writing the derived cart back here would leave a copy behind
  // for whoever uses the browser next.
  useEffect(() => {
    if (!isInitialLoadedRef.current) return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}cart`, JSON.stringify(localCart));
    } catch (e) { console.error(e); }
  }, [localCart]);

  useEffect(() => {
    if (!isInitialLoadedRef.current) return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}wishlist`, JSON.stringify(wishlist));
    } catch (e) { console.error(e); }
  }, [wishlist]);

  useEffect(() => {
    if (!isInitialLoadedRef.current) return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}compare`, JSON.stringify(compareList));
    } catch (e) { console.error(e); }
  }, [compareList]);

  useEffect(() => {
    if (!isInitialLoadedRef.current) return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}services`, JSON.stringify(serviceRequests));
    } catch (e) { console.error(e); }
  }, [serviceRequests]);

  useEffect(() => {
    if (!isInitialLoadedRef.current) return;
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}site_settings`, JSON.stringify(siteSettings));
    } catch (e) { console.error(e); }
  }, [siteSettings]);

  // Sync hash routing if present
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        if (hash.startsWith('product/')) {
          const slug = hash.replace('product/', '');
          setCurrentPage('product-detail');
          setSelectedProductSlug(slug);
        } else {
          setCurrentPage(hash);
        }
        return;
      }

      /**
       * No hash — fall back to the path.
       *
       * The views are hash-routed, but the sitemap and every canonical tag
       * advertise real paths (`/shop`, `/product/<slug>`). `next.config.ts`
       * rewrites those onto this single route, so without reading the pathname a
       * visitor arriving from a search result would land on the homepage instead
       * of the page Google indexed — and the canonical would be a lie.
       */
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (!path) {
        setCurrentPage('home');
        setSelectedProductSlug(null);
        return;
      }
      if (path.startsWith('product/')) {
        setCurrentPage('product-detail');
        setSelectedProductSlug(path.slice('product/'.length));
        return;
      }
      setCurrentPage(path);
      setSelectedProductSlug(null);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Stable identity so route guards can depend on it in an effect without
  // re-running on every render.
  const navigateTo = useCallback((page: string, slug: string | null = null) => {
    setCurrentPage(page);
    setSelectedProductSlug(slug);
    if (slug) {
      window.location.hash = `product/${slug}`;
    } else {
      window.location.hash = page;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ---------------------------------------------------------------- the cart
  //
  // Two sources, one shape. A guest's basket is `localCart`; a signed-in
  // customer's is `serverCart`, read from `cart_items`. `serverCart === null`
  // means "nobody is signed in", which is what decides where a change is written.

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  /**
   * A stand-in for a cart line whose product isn't on the catalogue page the SPA
   * loaded.
   *
   * The shell pulls 200 products; a saved cart can reference any of them. Showing
   * the row from the server's own join beats dropping it, which would look to the
   * customer like the shop had quietly emptied their basket.
   */
  const stubProduct = (row: ServerCartRow): Product => {
    const price = money(row.unitPrice) + money(row.priceAdjustment);
    return {
      id: String(row.productId ?? ''),
      name: row.productName ?? 'Item',
      slug: row.productSlug ?? '',
      brand: '',
      category: '' as ProductCategory,
      shortDescription: '',
      mrp: price,
      sellingPrice: price,
      inStock: (row.stockQuantity ?? 0) > 0,
      stockQuantity: row.stockQuantity ?? 0,
      rating: 0,
      reviewCount: 0,
      images: row.productImage ? [row.productImage] : [],
      tags: [],
    };
  };

  const cart = useMemo<CartItem[]>(() => {
    if (serverCart === null) return localCart;
    return serverCart.map((row) => ({
      cartItemId: row.id,
      quantity: row.quantity,
      product: productById.get(String(row.productId)) ?? stubProduct(row),
    }));
  }, [serverCart, localCart, productById]);

  /**
   * The basket as the quote endpoint wants it.
   *
   * Derived from the raw rows rather than from `cart`, so a catalogue refresh —
   * which changes `cart`'s identity without changing what is in it — doesn't
   * trigger a re-quote.
   */
  const quoteLines = useMemo(() => {
    const lines =
      serverCart !== null
        ? serverCart.map((row) => ({ productId: Number(row.productId), quantity: row.quantity }))
        : localCart.map((item) => ({ productId: Number(item.product.id), quantity: item.quantity }));
    return lines.filter((line) => Number.isInteger(line.productId) && line.productId > 0);
  }, [serverCart, localCart]);

  const refreshServerCart = useCallback(async () => {
    const result = await fetchCart();
    if (!result.ok) {
      setCartError(result.error);
      return;
    }
    setCartError(null);
    setServerCart(result.data.items ?? []);
  }, []);

  // Adopt the saved cart on sign-in, and hand back the guest basket on sign-out.
  useEffect(() => {
    if (authStatus === 'anonymous') {
      cartSyncedForRef.current = null;
      setServerCart(null);
      return;
    }
    if (authStatus !== 'authenticated' || !currentUser?.id) return;
    // Wait for the guest basket to be read out of localStorage, or the merge would
    // decide there was nothing to carry over.
    if (!isLocalLoaded) return;
    if (cartSyncedForRef.current === currentUser.id) return;
    cartSyncedForRef.current = currentUser.id;

    let cancelled = false;

    (async () => {
      const existing = await fetchCart();
      if (cancelled) return;
      if (!existing.ok) {
        setCartError(existing.error);
        return;
      }

      const held = new Set((existing.data.items ?? []).map((row) => Number(row.productId)));
      // POST /api/cart *adds* to a line rather than replacing it, so pushing a
      // guest line the server already holds would double the quantity.
      const toPush = localCart.filter((item) => {
        const productId = Number(item.product.id);
        return Number.isInteger(productId) && productId > 0 && !held.has(productId);
      });

      for (const item of toPush) {
        const pushed = await addCartLine(Number(item.product.id), item.quantity);
        if (cancelled) return;
        if (!pushed.ok) {
          setCartError(pushed.error);
          break;
        }
      }

      if (toPush.length > 0) {
        const merged = await fetchCart();
        if (cancelled) return;
        setServerCart(merged.ok ? merged.data.items ?? [] : existing.data.items ?? []);
      } else {
        setServerCart(existing.data.items ?? []);
      }
      setLocalCart([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, currentUser?.id, isLocalLoaded, localCart]);

  // Price the basket on the server whenever it, the coupon or the delivery zone
  // changes. Nothing in this file adds an order up.
  useEffect(() => {
    if (authStatus === 'loading') return;

    // `quoteOrder` refuses an empty basket, so there is nothing to ask for.
    if (quoteLines.length === 0) {
      setCartQuote(null);
      setQuoteError(null);
      setIsQuoting(false);
      return;
    }

    const payload: QuoteRequest = serverCart !== null ? { fromCart: true } : { items: quoteLines };
    if (appliedCouponCode) payload.couponCode = appliedCouponCode;
    if (deliveryZoneId !== null) payload.deliveryZoneId = deliveryZoneId;

    let cancelled = false;
    setIsQuoting(true);

    // Debounced: a quantity stepper being tapped shouldn't price the cart five
    // times over.
    const timer = setTimeout(async () => {
      const result = await fetchQuote(payload);
      if (cancelled) return;
      setIsQuoting(false);

      if (result.ok) {
        setCartQuote(result.data);
        setQuoteError(null);
        return;
      }

      setQuoteError(result.error);
      // A coupon the basket no longer qualifies for must not hide the totals:
      // drop it and let this effect run again without it.
      if (appliedCouponCode) setAppliedCouponCode(null);
      else setCartQuote(null);
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteLines, appliedCouponCode, deliveryZoneId, authStatus, serverCart]);

  /**
   * The applied coupon, as the server reported it.
   *
   * Reported as a flat amount even for a percentage coupon: the discount has
   * already been worked out against this basket (and capped), so re-deriving a
   * percentage here would only invite the UI to apply it a second time.
   */
  const activeCoupon = useMemo<Coupon | null>(() => {
    if (!cartQuote?.couponCode) return null;
    return {
      code: cartQuote.couponCode,
      discountType: 'fixed',
      discountValue: cartQuote.discountAmount,
      expiryDate: '',
      isActive: true,
      description: cartQuote.couponDescription ?? '',
    };
  }, [cartQuote]);

  // -------------------------------------------------------------- the orders

  const productImagesById = useMemo(() => {
    const images = new Map<string, string>();
    for (const product of products) {
      if (product.images?.[0]) images.set(product.id, product.images[0]);
    }
    return images;
  }, [products]);

  /**
   * The API's rows in the UI's shape, with the unsaved annotations laid over.
   *
   * `orderExtras` is keyed by order number, so a staff note added in the dashboard
   * survives a refresh of the list — though not a reload of the page, which is
   * honest about there being no column for it yet.
   */
  const orders = useMemo<Order[]>(
    () =>
      orderRows.map((row) => {
        const base = toUiOrder(row, { imagesByProductId: productImagesById });
        const extra = orderExtras[base.id];
        return extra ? { ...base, ...extra } : base;
      }),
    [orderRows, productImagesById, orderExtras],
  );

  /** Order number → database id, which is what the write endpoints take. */
  const orderRowIdByNumber = useMemo(() => orderRowIds(orderRows), [orderRows]);

  const refreshOrders = useCallback(async () => {
    if (authStatus !== 'authenticated') {
      setOrderRows([]);
      setOrdersError(null);
      return;
    }

    setIsOrdersLoading(true);
    const result = await fetchOrders({ limit: 100 });
    if (result.ok) {
      setOrderRows(result.data.orders ?? []);
      setOrdersError(null);
    } else {
      setOrdersError(result.error);
    }
    setIsOrdersLoading(false);
  }, [authStatus]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  // Cart actions
  //
  // Each writes to whichever cart is in play and then re-reads it, so what the
  // screen shows is what the database holds rather than an optimistic guess.
  const addToCart = async (product: Product, quantity: number = 1) => {
    setIsCartDrawerOpen(true);
    setCartError(null);

    if (serverCart === null) {
      setLocalCart((prev) => {
        const index = prev.findIndex((item) => item.product.id === product.id);
        if (index === -1) return [...prev, { product, quantity }];
        const updated = [...prev];
        updated[index] = { ...updated[index], quantity: updated[index].quantity + quantity };
        return updated;
      });
      return;
    }

    const result = await addCartLine(Number(product.id), quantity);
    if (!result.ok) {
      setCartError(result.error);
      return;
    }
    await refreshServerCart();
  };

  const removeFromCart = async (productId: string) => {
    setCartError(null);

    if (serverCart === null) {
      setLocalCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }

    const row = serverCart.find((item) => String(item.productId) === productId);
    if (!row) return;

    const result = await deleteCartLine(row.id);
    if (!result.ok) {
      setCartError(result.error);
      return;
    }
    await refreshServerCart();
  };

  const updateCartQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    setCartError(null);

    if (serverCart === null) {
      setLocalCart((prev) =>
        prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
      );
      return;
    }

    const row = serverCart.find((item) => String(item.productId) === productId);
    if (!row) return;

    // The API clamps to what is in stock and to 99 a line, so the re-read below is
    // what settles the quantity actually shown.
    const result = await setCartLineQuantity(row.id, quantity);
    if (!result.ok) {
      setCartError(result.error);
      return;
    }
    await refreshServerCart();
  };

  const clearCart = async () => {
    setAppliedCouponCode(null);
    setCartQuote(null);
    setQuoteError(null);
    setCartError(null);

    if (serverCart === null) {
      setLocalCart([]);
      return;
    }

    // /api/cart has no bulk delete, so the lines go one at a time. The screen is
    // emptied first because the outcome is not in doubt — only its timing.
    const rows = serverCart;
    setServerCart([]);
    for (const row of rows) {
      const result = await deleteCartLine(row.id);
      if (!result.ok) {
        setCartError(result.error);
        await refreshServerCart();
        return;
      }
    }
  };

  /**
   * A subtotal from the catalogue's own prices, used only until the first quote
   * lands. Never a total: delivery and VAT come from the database.
   */
  const localSubtotal = () =>
    cart.reduce((sum, item) => {
      const { effectivePrice } = computeProductEffectivePrice(item.product);
      return sum + effectivePrice * item.quantity;
    }, 0);

  const getCartSubtotal = () => cartQuote?.subtotal ?? localSubtotal();
  const getCartDiscount = () => cartQuote?.discountAmount ?? 0;
  const getCartTotal = () => cartQuote?.totalAmount ?? Math.max(0, localSubtotal());

  // Wishlist actions
  const toggleWishlist = (productId: string): boolean => {
    if (!isUserLoggedIn) {
      setIsAuthModalOpen(true);
      return false;
    }
    setWishlist((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
    return true;
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  const clearWishlist = () => {
    setWishlist([]);
  };

  const moveWishlistToCart = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    await addToCart(product, 1);
    setWishlist((prev) => prev.filter((id) => id !== productId));
  };

  const addAllWishlistToCart = async () => {
    // Sequential rather than parallel: each add re-reads the server cart, and
    // concurrent writes to the same cart would leave the last read stale.
    for (const product of products.filter((p) => wishlist.includes(p.id))) {
      await addToCart(product, 1);
    }
    setIsCartDrawerOpen(true);
  };

  // Compare actions
  const toggleCompare = (productId: string) => {
    setCompareList((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 4) {
        alert('You can compare up to 4 items simultaneously.');
        return prev;
      }
      return [...prev, productId];
    });
  };

  const isInCompare = (productId: string) => compareList.includes(productId);
  const clearCompare = () => setCompareList([]);

  // Coupon actions
  //
  // Applying a coupon *is* asking for a quote. The code's terms, its remaining
  // uses and the minimum spend all live in the `coupons` table, and the reply is
  // the same wording the order endpoint would use — so a coupon that passes here
  // cannot then be rejected at the last step.
  const applyCoupon = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { success: false, message: 'Enter a coupon code.' };
    if (quoteLines.length === 0) {
      return { success: false, message: 'Add something to your cart before applying a coupon.' };
    }

    const payload: QuoteRequest =
      serverCart !== null
        ? { fromCart: true, couponCode: trimmed }
        : { items: quoteLines, couponCode: trimmed };
    if (deliveryZoneId !== null) payload.deliveryZoneId = deliveryZoneId;

    setIsQuoting(true);
    const result = await fetchQuote(payload);
    setIsQuoting(false);

    if (!result.ok) {
      setQuoteError(result.error);
      return { success: false, message: result.error };
    }

    setCartQuote(result.data);
    setQuoteError(null);
    setAppliedCouponCode(trimmed);

    const saved = result.data.discountAmount;
    return {
      success: true,
      message:
        saved > 0
          ? `Coupon '${result.data.couponCode ?? trimmed}' applied — you saved NPR ${saved.toLocaleString()}.`
          : `Coupon '${result.data.couponCode ?? trimmed}' applied.`,
    };
  };

  const removeCoupon = () => {
    setAppliedCouponCode(null);
    setQuoteError(null);
  };

  // Order actions
  const placeOrder = async (details: {
    shippingAddressId?: number;
    deliveryZoneId?: number;
    paymentMethod: PaymentMethod;
    customerNote?: string;
  }): Promise<{ ok: true; order: Order } | { ok: false; error: string }> => {
    if (authStatus !== 'authenticated') {
      return { ok: false, error: 'Please sign in to place your order.' };
    }

    const result = await placeOrderRequest({
      // Always the saved cart: it is the copy the server can price, and it is the
      // same rows the stock decrement runs against inside the transaction.
      fromCart: true,
      shippingAddressId: details.shippingAddressId,
      deliveryZoneId: details.deliveryZoneId ?? deliveryZoneId ?? undefined,
      paymentMethod: details.paymentMethod,
      couponCode: appliedCouponCode ?? undefined,
      customerNote: details.customerNote,
    });

    if (!result.ok) return { ok: false, error: result.error };

    const order = toUiOrder(
      { ...result.data.order, items: result.data.items ?? [] },
      { imagesByProductId: productImagesById, customerName: currentUser?.name },
    );

    // The server emptied the cart as part of placing the order, so the local copy
    // has to follow rather than be re-read.
    setServerCart([]);
    setLocalCart([]);
    setAppliedCouponCode(null);
    setCartQuote(null);
    setQuoteError(null);
    await refreshOrders();

    return { ok: true, order };
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, note?: string) => {
    await updateOrderStatusExtended(orderId, status, { note });
  };

  const updateOrderStatusExtended = async (
    orderId: string,
    status: OrderStatus,
    options?: {
      note?: string;
      location?: string;
      updatedBy?: string;
      riderId?: string;
      riderName?: string;
      paymentStatus?: 'pending' | 'paid' | 'verified';
    }
  ) => {
    // Rider assignment has no column in `orders`, so it stays an overlay. The
    // status and the payment state are the parts the API owns.
    if (options?.riderId !== undefined || options?.riderName !== undefined) {
      setOrderExtras((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          ...(options.riderId !== undefined ? { assignedRiderId: options.riderId } : {}),
          ...(options.riderName !== undefined ? { assignedRiderName: options.riderName } : {}),
        },
      }));
    }

    const rowId = orderRowIdByNumber.get(orderId);
    if (rowId === undefined) {
      setOrdersError(`Order ${orderId} is no longer loaded — refresh and try again.`);
      return;
    }

    const body: {
      status: string;
      note?: string;
      paymentStatus?: 'pending' | 'paid';
    } = { status: DB_STATUS[status] };
    if (options?.note) body.note = options.note;
    // 'verified' is a dashboard distinction — a COD envelope counted at the desk.
    // The database records the money as received either way.
    if (options?.paymentStatus) {
      body.paymentStatus = options.paymentStatus === 'verified' ? 'paid' : options.paymentStatus;
    }

    try {
      const response = await fetch(`/api/orders/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setOrdersError(payload?.error || `Could not update order ${orderId}.`);
        return;
      }

      setOrdersError(null);
      await refreshOrders();
    } catch {
      setOrdersError('Network error. The order was not updated.');
    }
  };

  const addStaffNoteToOrder = (orderId: string, author: string, noteText: string, role?: string) => {
    setOrderExtras((prev) => {
      const existing = prev[orderId];
      const current =
        existing?.staffNotes ?? orders.find((order) => order.id === orderId)?.staffNotes ?? [];
      return {
        ...prev,
        [orderId]: {
          ...existing,
          staffNotes: [
            ...current,
            {
              id: `note-${Date.now()}`,
              author,
              text: noteText,
              timestamp: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
              role: role || 'Staff',
            },
          ],
        },
      };
    });
  };

  /**
   * Keeps an edited order's annotations.
   *
   * Deliberately narrow: prices, items, status and address belong to the database,
   * and letting the dashboard overwrite them here would show the shop figures the
   * invoice doesn't have. Use `updateOrderStatusExtended` to change the status.
   */
  const updateOrder = (updatedOrder: Order) => {
    setOrderExtras((prev) => ({
      ...prev,
      [updatedOrder.id]: {
        ...prev[updatedOrder.id],
        staffNotes: updatedOrder.staffNotes,
        assignedRiderId: updatedOrder.assignedRiderId,
        assignedRiderName: updatedOrder.assignedRiderName,
      },
    }));
  };

  const getOrderById = (orderId: string) => {
    return orders.find((o) => o.id.trim().toUpperCase() === orderId.trim().toUpperCase());
  };

  // Service actions
  const createServiceRequest = (
    request: Omit<ServiceRequest, 'id' | 'createdAt' | 'status'>
  ): ServiceRequest => {
    const newReq: ServiceRequest = {
      ...request,
      id: `SRV-2026-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setServiceRequests((prev) => [newReq, ...prev]);
    return newReq;
  };

  const updateServiceStatus = (
    id: string,
    status: ServiceRequest['status'],
    technician?: string,
    cost?: number
  ) => {
    setServiceRequests((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            status,
            assignedTechnician: technician || s.assignedTechnician,
            estimatedCost: cost !== undefined ? cost : s.estimatedCost,
          };
        }
        return s;
      })
    );
  };

  // Review Actions
  const addReview = (review: Omit<Review, 'id' | 'date'>) => {
    const newReview: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      helpfulCount: review.helpfulCount ?? 0,
      userUpvoted: false,
    };
    setReviews((prev) => [newReview, ...prev]);

    // Also update product rating and review count
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === review.productId) {
          const currentCount = p.reviewCount || 0;
          const currentRating = p.rating || 5;
          const newCount = currentCount + 1;
          const newRating = Number(((currentRating * currentCount + review.rating) / newCount).toFixed(1));
          return {
            ...p,
            rating: newRating,
            reviewCount: newCount,
          };
        }
        return p;
      })
    );
  };

  const upvoteReview = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          const isUpvoted = r.userUpvoted;
          return {
            ...r,
            userUpvoted: !isUpvoted,
            helpfulCount: Math.max(0, (r.helpfulCount || 0) + (isUpvoted ? -1 : 1)),
          };
        }
        return r;
      })
    );
  };

  // Admin Actions
  //
  // This used to be `loginAdmin(role)` — it flipped a boolean and returned true,
  // so the console was reachable by anyone who could call it, with whatever role
  // they asked for. The real thing signs in against /api/auth/login and takes the
  // role from the row in the database.
  const loginAdmin = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Sign in failed' };
      }

      const staffRole = ADMIN_ROLE_BY_DB_ROLE[data.user?.role ?? ''];
      if (!staffRole) {
        // Valid credentials, wrong door. The customer session is still
        // established, so send them somewhere they can actually use.
        adoptSession(data.user);
        return {
          success: false,
          error: 'This account does not have staff access to the dashboard.',
        };
      }

      adoptSession(data.user);
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logoutAdmin = () => {
    // Ends the whole session, not just the admin flag — the cookie is what grants
    // access to the admin APIs, so leaving it in place would only hide the UI.
    clearSession();
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [product, ...prev]);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  /**
   * The catalogue form's save path.
   *
   * Everything the storefront shows about a product — price, stock, spec sheet,
   * gallery — is read from the database, so a product that only ever reached
   * `setProducts` would vanish on the next refresh. The endpoint validates and
   * writes; we replace the local row with what came back rather than with what we
   * sent, because the server assigns the id and recomputes the discount.
   */
  const saveProduct = async (
    input: ProductWriteInput,
    productId?: string,
  ): Promise<{ ok: true; product: Product } | { ok: false; error: string }> => {
    if (productId !== undefined) {
      const numericId = Number(productId);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        return { ok: false, error: 'This product has no database id yet, so it cannot be updated.' };
      }
      const result = await updateProductRequest(numericId, input);
      if (!result.ok) return result;
      const saved = result.data.product;
      setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      return { ok: true, product: saved };
    }

    const result = await createProductRequest(input);
    if (!result.ok) return result;
    const saved = result.data.product;
    setProducts((prev) => [saved, ...prev]);
    return { ok: true, product: saved };
  };

  const archiveProduct = async (
    productId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const numericId = Number(productId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return { ok: false, error: 'This product has no database id yet, so it cannot be retired.' };
    }
    const result = await archiveProductRequest(numericId);
    if (!result.ok) return result;
    // The row still exists — it is discontinued, not deleted — so reflect the new
    // status instead of dropping it out of the admin list.
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status: 'discontinued' as const } : p)),
    );
    return { ok: true };
  };

  const updateSiteSettings = (newSettings: Partial<SiteSettings>) => {
    setSiteSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        brands,
        isCatalogLoading,
        catalogError,
        refreshCatalog,
        cart,
        cartQuote,
        isQuoting,
        quoteError,
        cartError,
        deliveryZoneId,
        setDeliveryZoneId,
        wishlist,
        compareList,
        orders,
        isOrdersLoading,
        ordersError,
        refreshOrders,
        serviceRequests,
        coupons,
        activeCoupon,
        reviews,
        siteSettings,
        savedImages,
        saveGeneratedImage,
        deleteGeneratedImage,
        currentPage,
        selectedProductSlug,
        searchQuery,
        quickViewProduct,
        isCartDrawerOpen,
        isAiAssistantOpen,
        isServiceModalOpen,
        isAdminLoggedIn,
        adminRole,
        isUserLoggedIn,
        authStatus,
        currentUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        logoutUser,
        navigateTo,
        setSearchQuery,
        setQuickViewProduct,
        setIsCartDrawerOpen,
        setIsAiAssistantOpen,
        setIsServiceModalOpen,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        getCartSubtotal,
        getCartDiscount,
        getCartTotal,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        moveWishlistToCart,
        addAllWishlistToCart,
        toggleCompare,
        isInCompare,
        clearCompare,
        applyCoupon,
        removeCoupon,
        placeOrder,
        updateOrderStatus,
        updateOrderStatusExtended,
        addStaffNoteToOrder,
        updateOrder,
        getOrderById,
        createServiceRequest,
        updateServiceStatus,
        addReview,
        upvoteReview,
        loginAdmin,
        logoutAdmin,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        checkAuth,
        addProduct,
        updateProduct,
        deleteProduct,
        saveProduct,
        archiveProduct,
        updateSiteSettings,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
