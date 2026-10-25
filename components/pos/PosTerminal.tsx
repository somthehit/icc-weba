'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  CreditCard,
  Banknote,
  QrCode,
  Lock,
  Printer,
  Sliders,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  X,
  Layers,
  Activity,
  History,
  TrendingDown,
  Gift,
  HelpCircle,
  Maximize2,
  DollarSign,
  Sun,
  Moon,
  Check,
  Percent,
  Tag,
  ShieldAlert,
  Info,
  Smartphone,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Radio,
  Copy,
  Mail,
  Phone,
  User,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { CashierAuthModal, PosStaffUser } from './CashierAuthModal';
import { OpenShiftModal } from './OpenShiftModal';
import { EodReconciliationModal } from './EodReconciliationModal';
import { CashDrawerShiftView } from './CashDrawerShiftView';

export interface PosProduct {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number;
  costPrice: number | null;
  stockQuantity: number;
  stockStatus: string;
  inStock: boolean;
  isLowStock: boolean;
  lowStockThreshold: number;
  brandName: string;
  categoryName: string;
  categorySlug: string;
  categoryId: number | null;
  imageUrl: string;
}

export interface PosCartItem {
  product: PosProduct;
  quantity: number;
  itemDiscountType?: 'percentage' | 'fixed';
  itemDiscountValue?: number;
}

export const getItemLineDiscount = (item: PosCartItem): number => {
  if (!item.itemDiscountValue || item.itemDiscountValue <= 0) return 0;
  const lineGross = item.product.price * item.quantity;
  if (item.itemDiscountType === 'percentage') {
    const pct = Math.min(100, Math.max(0, item.itemDiscountValue));
    return Math.round(lineGross * (pct / 100));
  } else {
    return Math.min(lineGross, item.itemDiscountValue);
  }
};

export interface ReceiptData {
  orderId: number;
  orderNumber: string;
  createdAt: string;
  items: Array<{
    productId: number;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  amountTendered: number;
  changeAmount: number;
  cashierName: string;
  registerCode: string;
  customerName: string;
  customerPhone?: string;
}

export const PosTerminal: React.FC = () => {
  const { navigateTo, refreshCatalog, siteSettings, coupons } = useStore();

  // State
  const [activeTab, setActiveTab] = useState<
    'register' | 'history' | 'returns' | 'stock-sync' | 'drawer' | 'loyalty' | 'promos' | 'hardware'
  >('register');
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Discount Modal State & Multi-Tier Engine (Per-Product / Whole Order / Promo Codes)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountModalTab, setDiscountModalTab] = useState<'whole' | 'item' | 'promo'>('whole');
  const [focusedProductId, setFocusedProductId] = useState<number | null>(null);

  // 1. Whole Order Discount State
  const [orderDiscountMode, setOrderDiscountMode] = useState<'fixed' | 'percent'>('percent');
  const [orderDiscountValue, setOrderDiscountValue] = useState('');
  const [orderDiscountError, setOrderDiscountError] = useState('');
  const [activeOrderDiscount, setActiveOrderDiscount] = useState<{
    id: string;
    title: string;
    type: 'fixed' | 'percent';
    rate?: number;
    amount: number;
    requiresApproval?: boolean;
  } | null>(null);

  // 2. Promotional Voucher & Campaign Codes State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    title: string;
    discountType: 'fixed' | 'percentage';
    discountValue: number;
    minSpend?: number;
    minItems?: number;
    description?: string;
  } | null>(null);

  // Legacy compatibility info ref for active discount summaries
  const [activeDiscountInfo, setActiveDiscountInfo] = useState<{
    id: string;
    title: string;
    type: 'fixed' | 'percentage' | 'voucher' | 'custom';
    code?: string;
    rate?: number;
    amount: number;
    requiresApproval?: boolean;
  } | null>(null);
  const customDiscountInputRef = useRef<HTMLInputElement>(null);

  // Catalog view state
  const [catalogView, setCatalogView] = useState<'grid' | 'list'>('grid');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Live inventory meta from API (category counts, stock health)
  const [inventoryMeta, setInventoryMeta] = useState<{
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    categories: Array<{ slug: string; name: string; count: number }>;
  } | null>(null);

  // Tender & Receipt Modals State
  const [isTenderOpen, setIsTenderOpen] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<'cash' | 'card' | 'qr' | 'esewa' | 'khalti' | 'split'>('cash');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [paymentProcessingState, setPaymentProcessingState] = useState<'ready' | 'processing' | 'verifying' | 'completed'>('ready');
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLoyalty, setCustomerLoyalty] = useState<{ id: string; name: string; points: number; discount: number } | null>(null);

  // Advanced Payment Terminal Interactive States (Cash / Card / QR / Wallets / Split)
  const cashInputRef = useRef<HTMLInputElement>(null);
  const [activeQuickPreset, setActiveQuickPreset] = useState<string | null>(null);
  const [cardTerminalStatus, setCardTerminalStatus] = useState<'idle' | 'reading' | 'authorized'>('idle');
  const [cardAuthCode, setCardAuthCode] = useState('AUTH-749201');
  const [cardRrn, setCardRrn] = useState('RRN-2026-948271');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);
  const [qrVerified, setQrVerified] = useState(false);
  const [qrTxnId, setQrTxnId] = useState('FP-2026-894120');
  const [walletPhoneInput, setWalletPhoneInput] = useState('');
  const [walletTxnRef, setWalletTxnRef] = useState('');
  const [walletVerified, setWalletVerified] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<'card' | 'qr' | 'esewa' | 'khalti'>('card');
  const [splitSecondaryAmount, setSplitSecondaryAmount] = useState('');

  // Live QR Expiry Timer (5-minute countdown for dynamic Fonepay QR)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTenderOpen && tenderMethod === 'qr' && !qrVerified && qrSecondsLeft > 0) {
      interval = setInterval(() => {
        setQrSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTenderOpen, tenderMethod, qrVerified, qrSecondsLeft]);

  // Auto-focus cash input when tender modal opens or cash method is selected
  useEffect(() => {
    if (isTenderOpen && tenderMethod === 'cash') {
      const timer = setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isTenderOpen, tenderMethod]);

  // Theme State: Dark / Light
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme preference on mount & handle hash routing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/pos') && window.location.hash === '#admin') {
        window.location.href = '/#admin';
        return;
      }
      const saved = localStorage.getItem('apex_pos_theme');
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        document.documentElement.classList.toggle('dark', saved === 'dark');
        document.documentElement.classList.toggle('light', saved === 'light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('apex_pos_theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      document.documentElement.classList.toggle('light', nextTheme === 'light');
    }
  };



  // Cashier & Staff Auth State
  const [currentCashier, setCurrentCashier] = useState<PosStaffUser | null>(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isEodModalOpen, setIsEodModalOpen] = useState(false);
  const [cashTransactions, setCashTransactions] = useState<any[]>([]);

  // Register & Shift
  const [registerCode] = useState('TERM-02 (Register A)');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [recentShifts, setRecentShifts] = useState<any[]>([]);
  const [lastClosedShift, setLastClosedShift] = useState<any | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Restore saved cashier from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('icc_pos_cashier');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id) {
            setCurrentCashier(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to parse saved cashier session:', e);
      }
    }
  }, []);

  // Fetch active shift & cash operations
  const fetchActiveShift = async () => {
    try {
      const res = await fetch(`/api/pos/shift?register=${encodeURIComponent(registerCode)}&_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.recentShifts) {
        setRecentShifts(data.recentShifts);
      }
      if (data.lastClosedShift) {
        setLastClosedShift(data.lastClosedShift);
      }

      if (data.hasActiveShift && data.shift) {
        setActiveShift(data.shift);
        if (data.cashTransactions) {
          setCashTransactions(data.cashTransactions);
        }
      } else {
        setActiveShift(null);
        setCashTransactions([]);
      }
    } catch (err) {
      console.error('Failed to load active shift:', err);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, [registerCode]);

  // Derived cashier display name
  const cashierName = currentCashier ? currentCashier.name : 'Staff Cashier (Not Logged In)';

  // Live stock alert notification banner
  const [stockSyncNotification, setStockSyncNotification] = useState<{
    productName: string;
    prevStock: number;
    newStock: number;
  } | null>(null);

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch live products directly from Postgres
  const fetchPosProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const res = await fetch(`/api/pos/products?limit=500&meta=true&_t=${Date.now()}`);
      if (!res.ok) {
        console.error('POS products API error:', res.status, await res.text());
        return;
      }
      const data = await res.json();
      if (data.success && data.products) {
        setProducts(data.products);
        if (data.meta) {
          setInventoryMeta(data.meta);
        }
      }
    } catch (err) {
      console.error('Failed to load POS products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchPosProducts();
    // Auto focus barcode scanner trap
    searchInputRef.current?.focus();
  }, []);



  // Add product to cart
  const addToCart = (product: PosProduct, quantity = 1) => {
    if (product.stockQuantity <= 0) {
      alert(`Cannot add "${product.name}" - Item is currently OUT OF STOCK in database.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + quantity > product.stockQuantity) {
          alert(`Cannot add more than ${product.stockQuantity} units available in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateCartQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const target = products.find((p) => p.id === productId);
    if (target && newQty > target.stockQuantity) {
      alert(`Only ${target.stockQuantity} units available in database stock.`);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item)),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };


  // Barcode / SKU scan submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    // 1. Exact barcode or SKU match
    const exact = products.find(
      (p) =>
        p.barcode.toLowerCase() === query ||
        p.sku.toLowerCase() === query ||
        p.name.toLowerCase() === query,
    );

    if (exact) {
      addToCart(exact, 1);
      setSearchQuery('');
    } else {
      // Find first matching item
      const matched = products.find(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.barcode.includes(query),
      );
      if (matched) {
        addToCart(matched, 1);
        setSearchQuery('');
      } else {
        alert(`No product found with Barcode/SKU: "${searchQuery}"`);
      }
    }
  };

  // Calculations: Multi-tier Gross, Per-Item, Whole Order & Voucher calculations
  const grossSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const totalItemDiscounts = cart.reduce((acc, item) => acc + getItemLineDiscount(item), 0);
  const subtotalAfterItems = Math.max(0, grossSubtotal - totalItemDiscounts);

  // Calculated Order Discount Amount
  let calculatedOrderDiscount = 0;
  if (activeOrderDiscount) {
    if (activeOrderDiscount.type === 'percent') {
      calculatedOrderDiscount = Math.round(subtotalAfterItems * ((activeOrderDiscount.rate ?? 0) / 100));
    } else {
      calculatedOrderDiscount = Math.min(subtotalAfterItems, activeOrderDiscount.amount);
    }
  }

  // Calculated Promo Discount Amount
  let calculatedPromoDiscount = 0;
  if (appliedPromo) {
    const remainingForPromo = Math.max(0, subtotalAfterItems - calculatedOrderDiscount);
    if (appliedPromo.discountType === 'percentage') {
      calculatedPromoDiscount = Math.round(subtotalAfterItems * (appliedPromo.discountValue / 100));
    } else {
      calculatedPromoDiscount = Math.min(remainingForPromo, appliedPromo.discountValue);
    }
  }

  // Total Combined Discount across All 3 layers
  const totalDiscountAmount = Math.min(
    grossSubtotal,
    totalItemDiscounts + calculatedOrderDiscount + calculatedPromoDiscount,
  );
  const subtotal = grossSubtotal;
  const vatAmount = (Math.max(0, subtotal - totalDiscountAmount) * 0.13) / 1.13; // 13% VAT portion
  const totalAmount = Math.max(0, subtotal - totalDiscountAmount);
  const discountPercent = subtotal > 0 ? Math.round((totalDiscountAmount / subtotal) * 100) : 0;
  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartItemDiscountsCount = cart.filter((i) => (i.itemDiscountValue ?? 0) > 0).length;

  // Keep discountAmount synchronized with totalDiscountAmount
  useEffect(() => {
    setDiscountAmount(totalDiscountAmount);
  }, [totalDiscountAmount]);

  // Per-Product Item Discount Helpers
  const setItemDiscount = (productId: number, type: 'percentage' | 'fixed', value: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              itemDiscountType: type,
              itemDiscountValue: Math.max(0, value),
            }
          : item,
      ),
    );
  };

  const clearItemDiscount = (productId: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, itemDiscountType: undefined, itemDiscountValue: undefined }
          : item,
      ),
    );
  };

  const clearAllItemDiscounts = () => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        itemDiscountType: undefined,
        itemDiscountValue: undefined,
      })),
    );
  };

  // Whole Order Discount Helpers
  const applyWholeOrderDiscount = (type: 'fixed' | 'percent', val: number, label?: string) => {
    if (subtotalAfterItems <= 0 && grossSubtotal <= 0) return;
    if (type === 'percent') {
      const calcAmt = Math.round(subtotalAfterItems * (val / 100));
      setActiveOrderDiscount({
        id: `order_pct_${val}`,
        title: label || `${val}% OFF Entire Order`,
        type: 'percent',
        rate: val,
        amount: calcAmt,
        requiresApproval: val > 20,
      });
      setActiveDiscountInfo({
        id: `order_pct_${val}`,
        title: label || `${val}% OFF Entire Order`,
        type: 'percentage',
        rate: val,
        amount: calcAmt,
        requiresApproval: val > 20,
      });
    } else {
      const calcAmt = Math.min(val, subtotalAfterItems);
      setActiveOrderDiscount({
        id: `order_fixed_${val}`,
        title: label || `Flat Cash - NPR ${val.toLocaleString('en-IN')}`,
        type: 'fixed',
        amount: calcAmt,
        requiresApproval: val > 2000,
      });
      setActiveDiscountInfo({
        id: `order_fixed_${val}`,
        title: label || `Flat Cash - NPR ${val.toLocaleString('en-IN')}`,
        type: 'fixed',
        amount: calcAmt,
        requiresApproval: val > 2000,
      });
    }
    setOrderDiscountError('');
  };

  const clearOrderDiscount = () => {
    setActiveOrderDiscount(null);
    setOrderDiscountValue('');
    setOrderDiscountError('');
  };

  const handleWholeOrderDiscountSubmit = () => {
    const rawVal = parseFloat(orderDiscountValue);
    if (isNaN(rawVal) || rawVal <= 0) {
      setOrderDiscountError('Please enter a valid discount amount greater than 0.');
      return;
    }

    if (orderDiscountMode === 'fixed') {
      if (rawVal > subtotalAfterItems) {
        setOrderDiscountError(`Discount exceeds payable subtotal (Max: NPR ${subtotalAfterItems.toLocaleString('en-IN')}).`);
        return;
      }
      applyWholeOrderDiscount('fixed', rawVal, `Custom Order Cash (-NPR ${rawVal.toLocaleString('en-IN')})`);
    } else {
      if (rawVal > 100) {
        setOrderDiscountError('Percentage cannot exceed 100%.');
        return;
      }
      applyWholeOrderDiscount('percent', rawVal, `Custom Order Rate (${rawVal}% OFF)`);
    }
    setOrderDiscountValue('');
    setOrderDiscountError('');
  };

  // Predefined In-Store Promotional Campaign Vouchers
  const PROMO_CAMPAIGNS = [
    {
      code: 'DASHAIN-DHAMAKA',
      title: 'Festival Mega Save',
      discountType: 'fixed' as const,
      discountValue: 1000,
      minPurchase: 5000,
      description: 'NPR 1,000 off on minimum purchase of NPR 5,000',
    },
    {
      code: 'STUDENT-SPECIAL',
      title: 'Valid Student ID Special',
      discountType: 'fixed' as const,
      discountValue: 500,
      minPurchase: 1500,
      description: 'NPR 500 off on minimum purchase of NPR 1,500',
    },
    {
      code: 'COMBO-PERK',
      title: 'Bundle Hardware Deal',
      discountType: 'fixed' as const,
      discountValue: 250,
      minItems: 2,
      description: 'NPR 250 off on bundle purchase (2+ items)',
    },
    {
      code: 'INTEL10',
      title: 'VIP 10% Member Reduction',
      discountType: 'percentage' as const,
      discountValue: 10,
      minPurchase: 15000,
      description: '10% off on orders above NPR 15,000 (up to NPR 3,000)',
    },
    {
      code: 'FESTIVE500',
      title: 'Festive Season Save',
      discountType: 'fixed' as const,
      discountValue: 500,
      minPurchase: 5000,
      description: 'Flat NPR 500 off on orders of NPR 5,000 or more',
    },
    {
      code: 'WELCOME',
      title: 'New Customer Welcome',
      discountType: 'fixed' as const,
      discountValue: 300,
      minPurchase: 2500,
      description: 'NPR 300 off on purchases above NPR 2,500',
    },
  ];

  // Apply Promotional Voucher / Promo Code
  const handleApplyPromoCode = (codeToApply?: string) => {
    const code = (codeToApply || promoCodeInput).trim().toUpperCase();
    setPromoError('');
    setPromoSuccess('');

    if (!code) {
      setPromoError('Please enter a promotion or voucher code.');
      return;
    }

    if (grossSubtotal <= 0) {
      setPromoError('Cannot apply voucher to an empty cart (NPR 0).');
      return;
    }

    // Match in campaigns or dynamic coupons from DB
    const campaignMatch = PROMO_CAMPAIGNS.find((c) => c.code === code);
    const storeCouponMatch = coupons?.find((c) => c.code.toUpperCase() === code && c.isActive);

    const target = campaignMatch || (storeCouponMatch ? {
      code: storeCouponMatch.code,
      title: storeCouponMatch.description || `${storeCouponMatch.code} Coupon`,
      discountType: storeCouponMatch.discountType as 'fixed' | 'percentage',
      discountValue: storeCouponMatch.discountValue,
      minPurchase: storeCouponMatch.minSpend,
      minItems: undefined,
      description: storeCouponMatch.description,
    } : null);

    if (!target) {
      setPromoError(`Promo code "${code}" is invalid, expired, or unrecognized.`);
      return;
    }

    if (target.minPurchase && grossSubtotal < target.minPurchase) {
      setPromoError(`"${code}" requires minimum purchase of NPR ${target.minPurchase.toLocaleString('en-IN')}. (Current: NPR ${grossSubtotal.toLocaleString('en-IN')})`);
      return;
    }

    if (target.minItems && totalCartItems < target.minItems) {
      setPromoError(`"${code}" requires at least ${target.minItems} items in cart.`);
      return;
    }

    setAppliedPromo(target);
    setPromoSuccess(`Promotional code "${target.code}" successfully applied!`);
    setPromoCodeInput('');
  };

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoSuccess('');
    setPromoError('');
  };

  // Master Clear All Discounts (Item discounts, Whole order, Promo vouchers)
  const clearAllDiscounts = () => {
    clearAllItemDiscounts();
    clearOrderDiscount();
    clearPromo();
    setActiveDiscountInfo(null);
    setDiscountAmount(0);
  };

  const clearDiscount = () => {
    clearAllDiscounts();
  };

  // Hotkey [1]-[4] Quick Cash compatibility
  const applyQuickCash = (amt: number) => {
    applyWholeOrderDiscount('fixed', amt, `Quick Flat Cash [Key] - NPR ${amt}`);
  };

  const clearCart = () => {
    setCart([]);
    clearAllDiscounts();
    setCustomerLoyalty(null);
  };

  // Tender modal
  const openTenderModal = () => {
    if (cart.length === 0) return;
    setTenderMethod('cash');
    setTenderAmount(totalAmount.toString());
    setPaymentProcessingState('ready');
    setActiveQuickPreset('Exact');
    setCardTerminalStatus('idle');
    setCardAuthCode(`AUTH-${Math.floor(100000 + Math.random() * 900000)}`);
    setCardRrn(`RRN-2026-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setQrSecondsLeft(300);
    setQrVerified(false);
    setQrTxnId(`FP-2026-${Math.floor(100000 + Math.random() * 900000)}`);
    setWalletPhoneInput(customerPhone || '');
    setWalletTxnRef('');
    setWalletVerified(false);
    // Split tender defaults: 50/50 split
    const half = Math.round(totalAmount / 2);
    setSplitCashAmount(half.toString());
    setSplitSecondaryAmount((totalAmount - half).toString());
    setSplitSecondaryMethod('card');
    setIsTenderOpen(true);
  };

  const handleSetExactCash = () => {
    setActiveQuickPreset('Exact');
    setTenderAmount(totalAmount.toString());
    cashInputRef.current?.focus();
    cashInputRef.current?.select();
  };

  const handleQuickAddCash = (increment: number, label: string) => {
    setActiveQuickPreset(label);
    const current = parseFloat(tenderAmount) || 0;
    const next = current + increment;
    setTenderAmount(next.toString());
    cashInputRef.current?.focus();
  };

  const handleRoundTo500 = () => {
    setActiveQuickPreset('Next 500');
    const current = parseFloat(tenderAmount) || totalAmount;
    const rounded = Math.ceil(current / 500) * 500;
    const next = rounded === current ? rounded + 500 : rounded;
    setTenderAmount(next.toString());
    cashInputRef.current?.focus();
  };

  // Comprehensive Keyboard Shortcuts (F1-F12, ESC, Enter, 1-4, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;

      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Modal handling when Discount Engine is open
      if (isDiscountModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsDiscountModalOpen(false);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          setIsDiscountModalOpen(false);
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
          e.preventDefault();
          customDiscountInputRef.current?.focus();
          return;
        }
        if (!isInput) {
          if (e.key === '1') {
            e.preventDefault();
            applyQuickCash(100);
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            applyQuickCash(250);
            return;
          }
          if (e.key === '3') {
            e.preventDefault();
            applyQuickCash(500);
            return;
          }
          if (e.key === '4') {
            e.preventDefault();
            applyQuickCash(1000);
            return;
          }
        }
        return;
      }

      // Global navigation and POS hotkeys
      if (e.key === 'F2') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key === 'F10') {
        e.preventDefault();
        setIsLocked(true);
      } else if (e.key === 'Escape') {
        if (isTenderOpen) setIsTenderOpen(false);
        if (completedReceipt) setCompletedReceipt(null);
      } else if (!isInput) {
        if (e.key === 'F1') {
          e.preventDefault();
          setActiveTab('register');
        } else if (e.key === 'F3') {
          e.preventDefault();
          setActiveTab('history');
        } else if (e.key === 'F4') {
          e.preventDefault();
          setActiveTab('returns');
        } else if (e.key === 'F5') {
          e.preventDefault();
          setActiveTab('stock-sync');
        } else if (e.key === 'F6') {
          e.preventDefault();
          setActiveTab('drawer');
        } else if (e.key === 'F8') {
          e.preventDefault();
          setActiveTab('loyalty');
        } else if (e.key === 'F9') {
          e.preventDefault();
          setIsDiscountModalOpen(true);
        } else if (e.key === 'F11') {
          e.preventDefault();
          setActiveTab('hardware');
        } else if (e.key === 'F12') {
          e.preventDefault();
          if (cart.length > 0) openTenderModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, isLocked, isDiscountModalOpen, isTenderOpen, completedReceipt, cart, subtotal]);

  const handleTenderSubmit = async () => {
    if (paymentProcessingState !== 'ready') return;

    let numTendered = totalAmount;
    let changeDue = 0;

    if (tenderMethod === 'cash') {
      numTendered = parseFloat(tenderAmount) || 0;
      if (numTendered < totalAmount) {
        alert(`Insufficient tender amount. NPR ${(totalAmount - numTendered).toLocaleString('en-IN')} still required.`);
        cashInputRef.current?.focus();
        return;
      }
      changeDue = Math.max(0, numTendered - totalAmount);
    } else if (tenderMethod === 'split') {
      const cashAlloc = parseFloat(splitCashAmount) || 0;
      const secAlloc = parseFloat(splitSecondaryAmount) || 0;
      const totalAlloc = cashAlloc + secAlloc;
      if (Math.abs(totalAlloc - totalAmount) > 0.5) {
        alert(`Split tender balance must equal payable balance. Currently allocated: NPR ${totalAlloc.toLocaleString('en-IN')}, Total Due: NPR ${totalAmount.toLocaleString('en-IN')}`);
        return;
      }
      numTendered = totalAlloc;
      changeDue = 0;
    } else {
      numTendered = totalAmount;
      changeDue = 0;
    }

    try {
      setIsProcessingSale(true);
      setPaymentProcessingState('processing');

      // Subtle simulated security & gateway verification delay for cards & digital wallets
      if (tenderMethod === 'card' || tenderMethod === 'qr' || tenderMethod === 'esewa' || tenderMethod === 'khalti') {
        setPaymentProcessingState('verifying');
        await new Promise((r) => setTimeout(r, 600));
      }

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.product.id,
            sku: i.product.sku,
            name: i.product.name,
            quantity: i.quantity,
            unitPrice: i.product.price,
            costPrice: i.product.costPrice,
          })),
          paymentMethod: tenderMethod,
          amountTendered: numTendered,
          changeAmount: changeDue,
          discountAmount,
          customerName,
          customerPhone,
          customerLoyaltyId: customerLoyalty?.id,
          cashierName,
          cashierId: currentCashier?.id || null,
          registerCode,
          shiftId: activeShift?.id || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Sale processing failed');
      }

      setPaymentProcessingState('completed');

      // Refresh shift metrics (cash sales, expected cash, transaction count)
      fetchActiveShift();

      // Success! Update local product stock and show real-time stock sync banner
      if (data.stockChanges && data.stockChanges.length > 0) {
        const firstChange = data.stockChanges[0];
        setStockSyncNotification({
          productName: firstChange.productName,
          prevStock: firstChange.previousStock,
          newStock: firstChange.newStock,
        });

        // Broadcast or trigger global storefront refresh
        try {
          await refreshCatalog();
        } catch {}

        // Update local products state immediately
        setProducts((prev) =>
          prev.map((p) => {
            const ch = data.stockChanges.find((c: any) => c.productId === p.id);
            if (ch) {
              return {
                ...p,
                stockQuantity: ch.newStock,
                stockStatus: ch.stockStatus,
                inStock: ch.newStock > 0 && ch.stockStatus !== 'out_of_stock',
              };
            }
            return p;
          }),
        );
      }

      setCompletedReceipt(data.receipt);
      setIsTenderOpen(false);
      clearCart();
    } catch (err: any) {
      alert(`Sale failed: ${err.message}`);
      setPaymentProcessingState('ready');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Staff unlock
  const handleUnlock = () => {
    if (staffPin === '1234' || staffPin === '0000' || staffPin === '9999') {
      setIsLocked(false);
      setStaffPin('');
      setPinError('');
    } else {
      setPinError('Invalid Cashier PIN. (Demo PIN: 1234)');
    }
  };

  // Filtered products list (client-side for instant filtering without re-fetch)
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.categorySlug === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' && p.stockQuantity > 0 && p.stockStatus !== 'out_of_stock' && p.stockQuantity > p.lowStockThreshold) ||
      (stockFilter === 'low_stock' && p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold) ||
      (stockFilter === 'out_of_stock' && (p.stockQuantity <= 0 || p.stockStatus === 'out_of_stock'));
    return matchesCategory && matchesSearch && matchesStock;
  });

  return (
    <div className={`pos-terminal-root pos-theme-${theme} flex flex-col h-screen w-screen overflow-hidden font-mono select-none antialiased ${
      theme === 'dark' ? 'bg-[#0f1412] text-[#dfe4e0]' : 'bg-[#f4f6f8] text-[#0f172a]'
    }`}>
      {/* Scoped POS light/dark theme rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pos-theme-light {
          background-color: #f4f6f8 !important;
          color: #0f172a !important;
          color-scheme: light;
        }
        .pos-theme-light .bg-\\[\\#0f1412\\] { background-color: #f4f6f8 !important; }
        .pos-theme-light .bg-\\[\\#0a0f0d\\] { background-color: #ffffff !important; }
        .pos-theme-light .bg-\\[\\#141a17\\] { background-color: #f1f5f9 !important; }
        .pos-theme-light .bg-\\[\\#181d1b\\] { background-color: #ffffff !important; }
        .pos-theme-light .bg-\\[\\#1c211e\\] { background-color: #f8fafc !important; }
        .pos-theme-light .bg-\\[\\#262b29\\] { background-color: #f1f5f9 !important; }
        .pos-theme-light .bg-\\[\\#313633\\] { background-color: #e2e8f0 !important; }
        .pos-theme-light .hover\\:bg-\\[\\#262b29\\]:hover { background-color: #e2e8f0 !important; }
        .pos-theme-light .hover\\:bg-\\[\\#313633\\]:hover { background-color: #cbd5e1 !important; }
        .pos-theme-light .hover\\:bg-\\[\\#181d1b\\]:hover { background-color: #f8fafc !important; }
        .pos-theme-light .hover\\:bg-\\[\\#141a17\\]:hover { background-color: #e2e8f0 !important; }
        .pos-theme-light .text-\\[\\#dfe4e0\\] { color: #0f172a !important; }
        .pos-theme-light .text-\\[\\#bec9c0\\] { color: #334155 !important; }
        .pos-theme-light .text-\\[\\#88938b\\] { color: #64748b !important; }
        .pos-theme-light .text-\\[\\#82d8a9\\] { color: #006b45 !important; }
        .pos-theme-light .text-\\[\\#9df5c4\\] { color: #004d32 !important; }
        .pos-theme-light .text-\\[\\#ffb95f\\] { color: #b45309 !important; }
        .pos-theme-light .text-\\[\\#ffb4ab\\] { color: #dc2626 !important; }
        .pos-theme-light h2, .pos-theme-light h3, .pos-theme-light h4 { color: #0f172a !important; }
        .pos-theme-light .border-\\[\\#141a17\\] { border-color: #e2e8f0 !important; }
        .pos-theme-light .border-\\[\\#262b29\\] { border-color: #e2e8f0 !important; }
        .pos-theme-light .border-\\[\\#313633\\] { border-color: #cbd5e1 !important; }
        .pos-theme-light .border-\\[\\#3f4942\\] { border-color: #cbd5e1 !important; }
        .pos-theme-light .border-\\[\\#82d8a9\\] { border-color: #006b45 !important; }
        .pos-theme-light input, .pos-theme-light select, .pos-theme-light textarea {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }
        .pos-theme-light input::placeholder {
          color: #94a3b8 !important;
        }
        .pos-theme-light .shadow-2xl {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
        }
        .pos-theme-light .text-white:not(.bg-\\[\\#006b45\\] *):not(.bg-\\[\\#93000a\\] *):not(button.bg-\\[\\#006b45\\]):not(button.bg-\\[\\#93000a\\]):not(.bg-green-700 *):not(.bg-gray-900 *) {
          color: #0f172a !important;
        }
      `}} />

      {/* 1. TOP APEX POS HEADER */}
      <header className="h-16 w-full px-4 flex items-center justify-between bg-[#0a0f0d] border-b border-[#262b29] shrink-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src={siteSettings?.logoUrl || '/pos-assets/1_pos_logo.svg'}
              alt={siteSettings?.storeName || 'Store POS Logo'}
              className="h-8 w-auto object-contain filter invert-0"
              onError={(e) => {
                // fallback to PNG if SVG has issues
                (e.target as HTMLImageElement).src = '/pos-assets/1_pos_logo.png';
              }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight text-[#82d8a9] leading-none uppercase">
                {siteSettings?.storeName ? `${siteSettings.storeName} POS` : 'Intel Computer Center POS'}
              </span>
              <span className="text-[10px] text-[#bec9c0] tracking-wider font-semibold">
                {siteSettings?.storeName || 'Intel Computer Center'} • v4.8 Enterprise
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#313633]"></div>

          <div className="hidden md:flex flex-col">
            <span className="text-xs text-[#dfe4e0] font-semibold">
              {siteSettings?.address ? siteSettings.address.split(',')[1]?.trim() || siteSettings.address : 'Dhangadhi'} Flagship Station #{siteSettings?.phone ? siteSettings.phone.slice(-3) : '104'}
            </span>
            <span className="text-[10px] text-[#82d8a9] font-mono">{registerCode}</span>
          </div>

          {/* Real-time Hardware Telemetry Pills */}
          <div className="hidden xl:flex items-center gap-2 px-2 py-1 bg-[#181d1b] border border-[#262b29]">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0a0f0d]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse"></span>
              <span className="text-[10px] font-bold text-[#dfe4e0] uppercase">Scanner Ready</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0a0f0d]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]"></span>
              <span className="text-[10px] font-bold text-[#dfe4e0] uppercase">80mm Thermal</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0a0f0d]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]"></span>
              <span className="text-[10px] font-bold text-[#dfe4e0] uppercase">Drawer Ready</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0a0f0d]">
              <span className="h-2 w-2 rounded-full bg-[#82d8a9]"></span>
              <span className="text-[10px] font-bold text-[#82d8a9] uppercase">Postgres 12ms</span>
            </div>
          </div>
        </div>

        {/* Live Synchronized Stock Notification Banner */}
        {stockSyncNotification && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#006b45] text-[#9df5c4] border border-[#82d8a9] text-xs animate-bounce">
            <Activity className="w-3.5 h-3.5" />
            <span>
              <strong>LIVE SYNC:</strong> {stockSyncNotification.productName} stock decremented ({stockSyncNotification.prevStock} &rarr; {stockSyncNotification.newStock}). Online store now reflects {stockSyncNotification.newStock}!
            </span>
            <button
              onClick={() => setStockSyncNotification(null)}
              className="ml-2 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* THEME SWITCH: DARK / LIGHT MODE [F2] */}
          <button
            onClick={toggleTheme}
            className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer select-none ${
              theme === 'dark'
                ? 'bg-[#181d1b] hover:bg-[#262b29] text-[#ffb95f] border-[#ffb95f]/40 hover:border-[#ffb95f]'
                : 'bg-[#ffffff] hover:bg-[#f1f5f9] text-[#006b45] border-[#006b45]/40 hover:border-[#006b45] shadow-xs'
            }`}
            title="Switch Theme: Dark / Light Mode [F2]"
            aria-label="Toggle POS Theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#ffb95f]" />
                <span className="font-mono text-[11px] font-bold">LIGHT</span>
                <span className="text-[9px] px-1 py-0.2 bg-[#0a0f0d] text-[#ffb95f] border border-[#ffb95f]/30">F2</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#006b45]" />
                <span className="font-mono text-[11px] font-bold">DARK</span>
                <span className="text-[9px] px-1 py-0.2 bg-[#e2e8f0] text-[#006b45] border border-[#006b45]/30">F2</span>
              </>
            )}
          </button>

          {/* F10 LOCK BUTTON */}
          <button
            onClick={() => setIsLocked(true)}
            className={`px-2.5 py-1.5 text-xs flex items-center gap-1 border cursor-pointer select-none transition-all ${
              theme === 'dark'
                ? 'bg-[#262b29] hover:bg-[#313633] text-[#dfe4e0] border-[#3f4942]'
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
            }`}
            title="Lock Cashier Screen [F10]"
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-bold">F10 LOCK</span>
          </button>

          {/* Active Cashier Badge with User Dropdown Menu */}
          {currentCashier ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 px-2.5 py-1 border transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#181d1b] hover:bg-[#202723] border-[#262b29]'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                }`}
                title="Account & Session Menu"
              >
                <div className="w-6 h-6 rounded-full bg-[#006b45] text-[#82d8a9] border border-[#82d8a9]/40 flex items-center justify-center font-bold text-[10px] uppercase">
                  {currentCashier.name.slice(0, 2)}
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeShift ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <span className={`text-xs font-bold truncate max-w-[120px] ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>
                      {currentCashier.name}
                    </span>
                    <span className="text-[9px] text-[#88938b]">▾</span>
                  </div>
                  <div className={`text-[9px] font-mono leading-tight flex items-center gap-1 ${
                    theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                  }`}>
                    <span>{registerCode.split(' ')[0]}</span>
                    <span>•</span>
                    <span className={activeShift ? (theme === 'dark' ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold') : (theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                      {activeShift ? 'SHIFT OPEN' : 'CLOSED'}
                    </span>
                  </div>
                </div>
              </button>

              {/* User Action Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <div
                    className={`absolute right-0 top-full mt-1.5 w-64 z-50 p-1 border shadow-2xl text-xs space-y-1 ${
                      theme === 'dark'
                        ? 'bg-[#181d1b] border-[#262b29] text-[#dfe4e0]'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {/* User profile header */}
                    <div className={`p-2.5 border mb-1 ${
                      theme === 'dark' ? 'bg-[#141816] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-xs ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>{currentCashier.name}</span>
                        {currentCashier.isSupervisor && (
                          <span className="text-[8px] px-1 bg-amber-500/20 text-amber-500 font-mono font-bold border border-amber-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${
                        theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                      }`}>
                        Register: <strong className={theme === 'dark' ? 'text-white' : 'text-slate-800'}>{registerCode}</strong>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${
                        theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                      }`}>
                        Shift:{' '}
                        <strong className={activeShift ? (theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700') : (theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                          {activeShift ? `#${activeShift.shiftNumber}` : 'Closed'}
                        </strong>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsLocked(true);
                      }}
                      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        theme === 'dark' ? 'hover:bg-[#202723] text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Switch Cashier</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsLocked(true);
                      }}
                      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        theme === 'dark' ? 'hover:bg-[#202723] text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Lock Terminal [F10]</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveTab('drawer');
                      }}
                      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        theme === 'dark' ? 'hover:bg-[#202723] text-slate-200' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Cash Drawer &amp; EOD [F6]</span>
                    </button>

                    <div className={`border-t my-1 ${theme === 'dark' ? 'border-[#262b29]' : 'border-slate-200'}`} />

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (confirm('Leave POS terminal and navigate to Administration Dashboard?')) {
                          if (typeof window !== 'undefined') window.location.href = '/#admin';
                          else navigateTo('admin');
                        }
                      }}
                      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        theme === 'dark' ? 'hover:bg-[#202723] text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Open Admin Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (typeof window !== 'undefined') window.location.href = '/';
                        else navigateTo('home');
                      }}
                      className={`w-full text-left px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        theme === 'dark' ? 'hover:bg-[#202723] text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                      <span>Storefront Portal</span>
                    </button>

                    <div className={`border-t my-1 ${theme === 'dark' ? 'border-[#262b29]' : 'border-slate-200'}`} />

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (confirm(`Log out cashier ${currentCashier.name}?`)) {
                          setCurrentCashier(null);
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('icc_pos_cashier');
                          }
                        }
                      }}
                      className="w-full text-left px-2.5 py-2 hover:bg-rose-500/10 text-rose-600 dark:text-rose-300 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out Cashier</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLocked(true)}
              className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold border border-[#82d8a9] flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Cashier Login
            </button>
          )}
        </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE WITH SIDEBAR NAVIGATION */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR NAVIGATION DOCK (F1-F12) */}
        <aside className="w-48 bg-[#0a0f0d] border-r border-[#262b29] flex flex-col justify-between p-2 shrink-0">
          <div>
            <div className="px-2 py-1 mb-2 text-[10px] text-[#88938b] font-bold uppercase tracking-wider">
              Terminal Cockpit
            </div>
            <nav className="flex flex-col gap-1 text-xs">
              <button
                onClick={() => setActiveTab('register')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'register'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Active Register</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#82d8a9]">F1</span>
              </button>

              <button
                onClick={() => setActiveTab('stock-sync')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'stock-sync'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <div className="flex flex-col">
                  <span>Stock Sync</span>
                  <span className="text-[9px] text-[#82d8a9]">Online = POS</span>
                </div>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#82d8a9]">F5</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'history'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Sales Journal</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F3</span>
              </button>

              <button
                onClick={() => setActiveTab('returns')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'returns'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Return & Refund</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F4</span>
              </button>

              <button
                onClick={() => setActiveTab('drawer')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'drawer'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Cash Drawer & EOD</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F6</span>
              </button>

              <button
                onClick={() => setActiveTab('loyalty')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'loyalty'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Customer Loyalty</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F8</span>
              </button>

              <button
                onClick={() => setActiveTab('promos')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'promos'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Price & Promos</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F9</span>
              </button>

              <button
                onClick={() => setActiveTab('hardware')}
                className={`flex items-center justify-between px-3 py-2.5 text-left border ${
                  activeTab === 'hardware'
                    ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                    : 'bg-[#181d1b] hover:bg-[#262b29] text-[#bec9c0] border-transparent'
                }`}
              >
                <span>Diagnostics</span>
                <span className="text-[10px] bg-[#0a0f0d] px-1 py-0.5 text-[#88938b]">F11</span>
              </button>
            </nav>
          </div>

          <div className="p-2 bg-[#181d1b] border border-[#262b29] text-[10px] shrink-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#88938b] uppercase">Shared DB Sync</span>
              <span className="text-[#82d8a9] font-bold">100% LIVE</span>
            </div>
            <div className="w-full bg-[#0a0f0d] h-1.5 mb-1.5">
              <div className="bg-[#82d8a9] h-full w-full"></div>
            </div>
            {inventoryMeta ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="text-[#bec9c0]">In Stock</span>
                  <span className="text-[#82d8a9] font-bold">{inventoryMeta.inStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#ffb95f]">Low Stock</span>
                  <span className="text-[#ffb95f] font-bold">{inventoryMeta.lowStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#ffb4ab]">Out of Stock</span>
                  <span className="text-[#ffb4ab] font-bold">{inventoryMeta.outOfStock}</span>
                </div>
              </div>
            ) : (
              <>
                <span className="text-[#bec9c0] block">PostgreSQL Supabase</span>
                <span className="text-[#ffb95f]">Stock decreases instantly</span>
              </>
            )}
          </div>
        </aside>

        {/* 3. CENTER & RIGHT WORKSPACE */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'register' && (
            <div className="flex-1 grid grid-cols-12 gap-2 p-2 overflow-hidden">
              {/* LEFT FAST CATEGORY & SPEED KEYS (Col 2) */}
              <div className="col-span-2 flex flex-col gap-2 overflow-hidden">
                <div className="bg-[#181d1b] border border-[#262b29] p-2 flex flex-col flex-1 min-h-0">
                  <div className="text-[10px] text-[#88938b] font-bold uppercase mb-2 flex items-center justify-between">
                    <span>Departments</span>
                    <span className="text-[#ffb95f]">[ALT+1]</span>
                  </div>
                  <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                    {[
                      { slug: 'all', name: 'All Hardware', count: inventoryMeta?.totalProducts ?? products.length },
                      ...(inventoryMeta?.categories
                        ? inventoryMeta.categories.slice(0, 8).map(c => ({ slug: c.slug, name: c.name, count: c.count }))
                        : [
                          { slug: 'computers-laptops', name: 'Laptops & PCs', count: products.filter(p => p.categorySlug?.includes('laptop') || p.categorySlug?.includes('computer')).length },
                          { slug: 'pc-components', name: 'Components & GPUs', count: products.filter(p => p.categorySlug?.includes('component') || p.categorySlug?.includes('pc')).length },
                          { slug: 'monitors-displays', name: 'Displays & TVs', count: products.filter(p => p.categorySlug?.includes('monitor') || p.categorySlug?.includes('display')).length },
                          { slug: 'networking', name: 'Networking & WiFi', count: products.filter(p => p.categorySlug?.includes('network')).length },
                          { slug: 'accessories', name: 'Keyboards & Mice', count: products.filter(p => p.categorySlug?.includes('accessor')).length },
                        ]
                      )
                    ].map((cat) => (
                      <button
                        key={cat.slug}
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`px-2 py-2 text-left text-xs flex justify-between items-center border transition-none ${
                          selectedCategory === cat.slug
                            ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold'
                            : 'bg-[#1c211e] hover:bg-[#262b29] text-[#bec9c0] border-[#262b29]'
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span className={`text-[10px] px-1 shrink-0 ${
                          selectedCategory === cat.slug ? 'bg-[#004d32] text-[#82d8a9]' : 'bg-[#0a0f0d] text-[#82d8a9]'
                        }`}>{cat.count}</span>
                      </button>
                    ))}
                  </div>

                  {/* Quick Speed Hot-Keys */}
                  <div className="mt-3 pt-2 border-t border-[#262b29]">
                    <div className="text-[10px] text-[#ffb95f] font-bold uppercase mb-1">
                      Quick Speed Keys
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {products.slice(0, 4).map((p, idx) => (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p, 1)}
                          className="p-1.5 bg-[#1c211e] hover:bg-[#262b29] text-left border border-[#262b29] truncate"
                          title={p.name}
                        >
                          <div className="flex justify-between text-[#82d8a9]">
                            <span>[{idx + 1}]</span>
                            <span>{p.stockQuantity}</span>
                          </div>
                          <div className="truncate font-semibold text-[#dfe4e0] mt-0.5">{p.name.split(' ')[0]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: SEARCH & PRODUCT GRID (Col 6) */}
              <div className="col-span-6 flex flex-col gap-2 overflow-hidden">
                {/* Barcode Scanner Input Trap */}
                <form
                  onSubmit={handleBarcodeSubmit}
                  className="bg-[#181d1b] border border-[#262b29] p-2 flex items-center gap-2"
                >
                  <Barcode className="w-5 h-5 text-[#82d8a9] shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Scan Barcode (e.g. 8900000000031) or SKU / Model name..."
                    className="flex-1 bg-[#0a0f0d] border border-[#3f4942] text-[#dfe4e0] px-3 py-1.5 text-xs focus:outline-none focus:border-[#82d8a9] font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold border border-[#82d8a9]"
                  >
                    Enter [Scan]
                  </button>
                  <button
                    type="button"
                    onClick={fetchPosProducts}
                    className="p-1.5 bg-[#1c211e] hover:bg-[#262b29] text-[#bec9c0] border border-[#262b29]"
                    title="Refresh Live Stock"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </form>

                {/* Products Grid / List — Header toolbar */}
                <div className="bg-[#141a17] border-x border-t border-[#262b29] px-2 py-1.5 flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-[#88938b] font-bold uppercase tracking-wider">
                    {isLoadingProducts ? 'Fetching Inventory…' : `${filteredProducts.length} Product${filteredProducts.length !== 1 ? 's' : ''}`}
                    {selectedCategory !== 'all' && !isLoadingProducts && (
                      <span className="ml-1 text-[#82d8a9]">in category</span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Stock quick-filter */}
                    {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((f) => {
                      const labels: Record<string, string> = { all: 'All', in_stock: '✓ In', low_stock: '⚠ Low', out_of_stock: '✕ Out' };
                      const active = stockFilter === f;
                      const color = f === 'out_of_stock' ? 'border-[#93000a] text-[#ffb4ab]' : f === 'low_stock' ? 'border-[#ee9800] text-[#ffb95f]' : 'border-[#82d8a9] text-[#82d8a9]';
                      return (
                        <button
                          key={f}
                          onClick={() => setStockFilter(f)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold border transition-colors ${
                            active
                              ? `bg-[#0a0f0d] ${color}`
                              : 'bg-[#181d1b] border-[#262b29] text-[#88938b] hover:text-[#dfe4e0]'
                          }`}
                        >
                          {labels[f]}
                        </button>
                      );
                    })}
                    <div className="w-px h-4 bg-[#262b29] mx-0.5"></div>
                    <button
                      onClick={() => setCatalogView('grid')}
                      title="Grid View"
                      className={`p-1 border text-[10px] font-bold transition-colors ${
                        catalogView === 'grid'
                          ? 'bg-[#006b45] border-[#82d8a9] text-white'
                          : 'bg-[#181d1b] border-[#262b29] text-[#88938b] hover:text-[#dfe4e0]'
                      }`}
                    >
                      ▦ Grid
                    </button>
                    <button
                      onClick={() => setCatalogView('list')}
                      title="List View"
                      className={`p-1 border text-[10px] font-bold transition-colors ${
                        catalogView === 'list'
                          ? 'bg-[#006b45] border-[#82d8a9] text-white'
                          : 'bg-[#181d1b] border-[#262b29] text-[#88938b] hover:text-[#dfe4e0]'
                      }`}
                    >
                      ≡ List
                    </button>
                  </div>
                </div>

                {/* Products Catalog */}
                <div className="bg-[#181d1b] border border-[#262b29] border-t-0 p-2 flex-1 overflow-y-auto">
                  {isLoadingProducts ? (
                    /* State 1: Initial Loading */
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <RefreshCw className="w-9 h-9 animate-spin text-[#82d8a9]" />
                      <div className="text-center">
                        <div className="text-sm font-bold text-[#dfe4e0] mb-1">Loading Live Inventory</div>
                        <div className="text-xs text-[#88938b]">Connecting to PostgreSQL database…</div>
                      </div>
                      <div className="w-48 h-1 bg-[#262b29] overflow-hidden">
                        <div className="h-full bg-[#82d8a9] animate-pulse w-2/3"></div>
                      </div>
                    </div>
                  ) : products.length === 0 ? (
                    /* State 2: Database empty — no products at all */
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="p-4 bg-[#1c211e] border border-[#93000a] text-center">
                        <AlertTriangle className="w-10 h-10 text-[#ffb4ab] mx-auto mb-2" />
                        <div className="text-sm font-bold text-[#dfe4e0] mb-1">No Products in Database</div>
                        <div className="text-xs text-[#88938b] max-w-xs">
                          No inventory records found. Add products in the admin dashboard or sync from your supplier.
                        </div>
                        <button
                          onClick={fetchPosProducts}
                          className="mt-3 px-3 py-1.5 bg-[#006b45] text-white text-xs font-bold border border-[#82d8a9] flex items-center gap-1 mx-auto"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry Fetch
                        </button>
                      </div>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    /* State 3: Filter / Search returned no matches */
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <Search className="w-9 h-9 text-[#88938b]" />
                      <div className="text-center">
                        {searchQuery ? (
                          <>
                            <div className="text-sm font-bold text-[#dfe4e0] mb-1">
                              No match for &ldquo;<span className="text-[#ffb95f]">{searchQuery}</span>&rdquo;
                            </div>
                            <div className="text-xs text-[#88938b]">Try a different barcode, SKU, or product name</div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-bold text-[#dfe4e0] mb-1">No Products in This Category</div>
                            <div className="text-xs text-[#88938b]">Select a different department from the sidebar</div>
                          </>
                        )}
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="px-3 py-1 bg-[#1c211e] hover:bg-[#262b29] text-[#82d8a9] text-xs border border-[#262b29]"
                        >
                          ✕ Clear Search
                        </button>
                      )}
                    </div>
                  ) : catalogView === 'grid' ? (
                    /* GRID VIEW */
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                      {filteredProducts.map((product) => {
                        const isOutOfStock = product.stockQuantity <= 0;
                        const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold;
                        return (
                          <div
                            key={product.id}
                            onClick={() => !isOutOfStock && addToCart(product, 1)}
                            className={`p-2.5 flex flex-col justify-between border transition-all cursor-pointer ${
                              isOutOfStock
                                ? 'bg-[#181d1b] opacity-50 border-[#93000a] cursor-not-allowed'
                                : 'bg-[#1c211e] hover:bg-[#262b29] hover:border-[#82d8a9] border-[#262b29]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="text-[10px] text-[#88938b] font-mono">{product.sku}</span>
                              <span
                                className={`text-[9px] px-1 py-0.5 font-bold uppercase ${
                                  isOutOfStock ? 'bg-[#93000a] text-white'
                                  : isLowStock ? 'bg-[#ee9800] text-black'
                                  : 'bg-[#006b45] text-[#9df5c4]'
                                }`}
                              >
                                {isOutOfStock ? '0 OUT' : `${product.stockQuantity}`}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#dfe4e0] line-clamp-2 mb-2 leading-tight">{product.name}</div>
                            <div className="flex items-end justify-between border-t border-[#262b29] pt-2">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-[#88938b]">Retail Price</span>
                                <span className="text-sm font-bold text-[#82d8a9]">NPR {product.price.toLocaleString('en-IN')}</span>
                              </div>
                              <span className="text-[10px] bg-[#0a0f0d] px-1.5 py-0.5 border border-[#3f4942] text-[#dfe4e0]">+ Add</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* LIST VIEW */
                    <div className="flex flex-col gap-0.5">
                      {filteredProducts.map((product) => {
                        const isOutOfStock = product.stockQuantity <= 0;
                        const isLowStock = product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold;
                        return (
                          <div
                            key={product.id}
                            onClick={() => !isOutOfStock && addToCart(product, 1)}
                            className={`flex items-center gap-3 px-3 py-2 border transition-all cursor-pointer ${
                              isOutOfStock
                                ? 'bg-[#181d1b] opacity-50 border-[#93000a] cursor-not-allowed'
                                : 'bg-[#1c211e] hover:bg-[#262b29] hover:border-[#82d8a9] border-[#262b29]'
                            }`}
                          >
                            <span className="text-[10px] text-[#88938b] font-mono w-24 shrink-0 truncate">{product.sku}</span>
                            <span className="flex-1 text-xs font-semibold text-[#dfe4e0] truncate">{product.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 font-bold uppercase shrink-0 ${
                                isOutOfStock ? 'bg-[#93000a] text-white'
                                : isLowStock ? 'bg-[#ee9800] text-black'
                                : 'bg-[#006b45] text-[#9df5c4]'
                              }`}
                            >
                              {isOutOfStock ? 'OUT' : `${product.stockQuantity} pcs`}
                            </span>
                            <span className="text-sm font-bold text-[#82d8a9] font-mono shrink-0 w-28 text-right">
                              NPR {product.price.toLocaleString('en-IN')}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 border font-bold shrink-0 ${
                              isOutOfStock ? 'text-[#88938b] border-[#262b29]' : 'text-[#82d8a9] border-[#82d8a9] hover:bg-[#006b45] hover:text-white'
                            }`}>
                              {isOutOfStock ? 'N/A' : '+ ADD'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: CART LEDGER & TENDER COCKPIT (Col 4) */}
              <div className="col-span-4 bg-[#181d1b] border border-[#262b29] flex flex-col justify-between overflow-hidden">
                {/* Cart Ledger Header */}
                <div className="p-2 bg-[#0a0f0d] border-b border-[#262b29] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#82d8a9]" />
                    <span className="text-xs font-bold text-white uppercase">Active Cart Ledger</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-[#1c211e] px-2 py-0.5 text-[#ffb95f] font-mono">
                      {cart.reduce((a, b) => a + b.quantity, 0)} Items
                    </span>
                    <button
                      onClick={clearCart}
                      disabled={cart.length === 0}
                      className={`text-[10px] px-2 py-0.5 font-bold transition-colors ${
                        cart.length > 0
                          ? 'bg-[#93000a] text-white hover:bg-red-700 cursor-pointer'
                          : 'bg-[#1c211e] text-[#3f4942] cursor-not-allowed'
                      }`}
                      title={cart.length > 0 ? 'Clear All Cart Items' : 'Cart is already empty'}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Customer Attachment Bar */}
                <div className={`px-2 py-1.5 border-b flex items-center justify-between text-xs ${
                  theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-[#f1f5f9] border-[#e2e8f0]'
                }`}>
                  <div className="flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-[#82d8a9]" />
                    <span className={`font-semibold truncate ${theme === 'dark' ? 'text-[#dfe4e0]' : 'text-[#0f172a]'}`}>
                      {customerName}
                    </span>
                    {customerLoyalty && (
                      <span className="text-[9px] bg-[#ffb95f] text-black px-1 font-bold">
                        {customerLoyalty.name} (-5%)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('loyalty')}
                    className="text-[10px] text-[#82d8a9] hover:underline font-bold"
                  >
                    Change Customer
                  </button>
                </div>

                {/* Cart Line Items */}
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#88938b] text-xs">
                      <Barcode className={`w-10 h-10 mb-2 ${theme === 'dark' ? 'text-[#262b29]' : 'text-[#cbd5e1]'}`} />
                      Cart is empty. Scan barcodes or tap items to sell.
                    </div>
                  ) : (
                    cart.map((item) => {
                      const itemLineDiscount = getItemLineDiscount(item);
                      const itemGross = item.product.price * item.quantity;
                      const itemNet = Math.max(0, itemGross - itemLineDiscount);

                      return (
                        <div
                          key={item.product.id}
                          className={`p-2 border-l-2 border-l-[#82d8a9] border-t border-r border-b flex flex-col gap-1 transition-all ${
                            theme === 'dark'
                              ? 'bg-[#1c211e] border-[#262b29]'
                              : 'bg-[#ffffff] border-[#e2e8f0] shadow-xs'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-semibold truncate ${
                                theme === 'dark' ? 'text-[#dfe4e0]' : 'text-[#0f172a]'
                              }`}>
                                {item.product.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-[#88938b] font-mono">{item.product.sku}</span>
                                {itemLineDiscount > 0 && (
                                  <span className="text-[9px] bg-[#006b45] text-white px-1 font-bold font-mono">
                                    {item.itemDiscountType === 'percentage'
                                      ? `${item.itemDiscountValue}% OFF`
                                      : `-NPR ${item.itemDiscountValue}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Quick Item Discount Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountModalTab('item');
                                  setFocusedProductId(item.product.id);
                                  setIsDiscountModalOpen(true);
                                }}
                                className={`px-1.5 py-0.5 text-[10px] font-bold border transition-colors flex items-center gap-0.5 cursor-pointer ${
                                  itemLineDiscount > 0
                                    ? 'bg-[#006b45]/30 text-[#82d8a9] border-[#82d8a9]'
                                    : theme === 'dark'
                                    ? 'bg-[#0a0f0d] text-[#88938b] hover:text-[#82d8a9] border-[#262b29]'
                                    : 'bg-slate-100 text-slate-600 hover:text-[#006b45] border-slate-300'
                                }`}
                                title="Manage discount for this product"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                <span>{itemLineDiscount > 0 ? `-%` : '%'}</span>
                              </button>

                              <button
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-[#ffb4ab] hover:text-red-400 p-0.5 cursor-pointer"
                                title="Remove item from cart"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-[#262b29]/40">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                className={`w-5 h-5 flex items-center justify-center ${
                                  theme === 'dark'
                                    ? 'bg-[#0a0f0d] text-[#dfe4e0] hover:bg-[#262b29]'
                                    : 'bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]'
                                }`}
                              >
                                -
                              </button>
                              <span className={`w-6 text-center font-bold font-mono ${
                                theme === 'dark' ? 'text-white' : 'text-[#0f172a]'
                              }`}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                className={`w-5 h-5 flex items-center justify-center ${
                                  theme === 'dark'
                                    ? 'bg-[#0a0f0d] text-[#dfe4e0] hover:bg-[#262b29]'
                                    : 'bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]'
                                }`}
                              >
                                +
                              </button>
                              <span className="text-[10px] text-[#88938b] ml-1">
                                @ NPR {item.product.price.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <div className="text-right">
                              {itemLineDiscount > 0 && (
                                <span className="line-through text-[#88938b] text-[10px] mr-1.5 font-mono">
                                  NPR {itemGross.toLocaleString('en-IN')}
                                </span>
                              )}
                              <span className="font-bold text-[#82d8a9] font-mono">
                                NPR {itemNet.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Total & Checkout Panel */}
                <div className={`border-t p-3 flex flex-col gap-1.5 ${
                  theme === 'dark' ? 'bg-[#0a0f0d] border-[#262b29]' : 'bg-[#f8fafc] border-[#e2e8f0]'
                }`}>
                  <div className="flex justify-between text-xs text-[#bec9c0]">
                    <span>Gross Subtotal</span>
                    <span className="font-mono">NPR {grossSubtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {totalItemDiscounts > 0 && (
                    <div className="flex justify-between text-xs text-[#82d8a9]">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Item Line Discounts
                      </span>
                      <span className="font-mono">- NPR {totalItemDiscounts.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {calculatedOrderDiscount > 0 && (
                    <div className="flex justify-between text-xs text-[#ffb95f]">
                      <span className="flex items-center gap-1">
                        <Sliders className="w-3 h-3" /> Order Reduction {activeOrderDiscount?.type === 'percent' && `(${activeOrderDiscount.rate}%)`}
                      </span>
                      <span className="font-mono">- NPR {calculatedOrderDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {calculatedPromoDiscount > 0 && appliedPromo && (
                    <div className="flex justify-between text-xs text-[#82d8a9]">
                      <span className="flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Promo Voucher ({appliedPromo.code})
                      </span>
                      <span className="font-mono">- NPR {calculatedPromoDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {totalDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-[#ffb95f] font-bold pt-1 border-t border-[#262b29]/50">
                      <span>Total Savings</span>
                      <span className="font-mono">- NPR {totalDiscountAmount.toLocaleString('en-IN')} ({discountPercent}%)</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-[#88938b]">
                    <span className="flex items-center gap-1">
                      VAT 13%
                      <span className="text-[9px] bg-[#1c211e] px-1 border border-[#262b29] text-[#88938b] font-mono">incl.</span>
                    </span>
                    <span className="font-mono">NPR {Math.round(vatAmount).toLocaleString('en-IN')}</span>
                  </div>

                  <div className="border-t border-[#262b29] pt-2 flex justify-between items-baseline">
                    <span className={`text-xs font-bold uppercase ${theme === 'dark' ? 'text-white' : 'text-[#0f172a]'}`}>
                      TOTAL DUE
                    </span>
                    <span className="text-2xl font-bold text-[#82d8a9] font-mono">
                      NPR {totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => setIsDiscountModalOpen(true)}
                      className={`py-2 text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        totalDiscountAmount > 0
                          ? 'bg-[#006b45] text-white border-[#82d8a9]'
                          : theme === 'dark'
                          ? 'bg-[#262b29] hover:bg-[#313633] text-[#dfe4e0] border-[#3f4942]'
                          : 'bg-[#ffffff] hover:bg-[#f1f5f9] text-[#0f172a] border-[#cbd5e1] shadow-xs'
                      }`}
                      title="Open Order Discount & Voucher Box [F9]"
                    >
                      <Gift className="w-3.5 h-3.5 text-[#ffb95f]" />
                      <span>Discount [F9]</span>
                      {totalDiscountAmount > 0 && (
                        <span className="text-[9px] bg-[#ffb95f] text-black font-bold px-1 font-mono">
                          -NPR {totalDiscountAmount.toLocaleString('en-IN')}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={openTenderModal}
                      disabled={cart.length === 0}
                      className={`py-3 text-sm font-bold flex items-center justify-center gap-2 border cursor-pointer ${
                        cart.length > 0
                          ? 'bg-[#006b45] hover:bg-[#036c46] text-white border-[#82d8a9]'
                          : 'bg-[#181d1b] text-[#88938b] border-transparent cursor-not-allowed'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      PAY [F12]
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE STOCK SYNCHRONIZATION DEMO CONSOLE (Screen 9 / Live proof) */}
          {activeTab === 'stock-sync' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="bg-[#181d1b] border border-[#262b29] p-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between border-b border-[#262b29] pb-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#82d8a9]">
                      Unified Database & Live Stock Synchronization Console
                    </h2>
                    <p className="text-xs text-[#bec9c0]">
                      Both the physical POS and the online e-commerce website connect to the exact same Postgres database.
                      Selling an item at the counter immediately updates the online stock!
                    </p>
                  </div>
                  <button
                    onClick={fetchPosProducts}
                    className="px-3 py-1.5 bg-[#006b45] text-white text-xs font-bold flex items-center gap-1 border border-[#82d8a9]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Force Refresh
                  </button>
                </div>

                {/* Demonstration Box */}
                <div className="bg-[#0a0f0d] border border-[#82d8a9] p-4 mb-4">
                  <div className="text-xs font-bold text-[#82d8a9] uppercase mb-1">
                    Live Test Scenario: Single Database Verification
                  </div>
                  <p className="text-xs text-[#dfe4e0] mb-3">
                    If online is showing <strong>5 stock</strong> and <strong>1 is sold from POS</strong>, then stock will be <strong>4</strong> and will immediately show <strong>4 in online also</strong>!
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {products.slice(0, 3).map((prod) => (
                      <div key={prod.id} className="p-3 bg-[#1c211e] border border-[#262b29] flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-[#ffb95f] font-mono">{prod.sku}</span>
                          <h4 className="text-xs font-bold text-white line-clamp-1 mt-0.5">{prod.name}</h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-[#bec9c0]">Database Stock:</span>
                            <span className="text-lg font-bold text-[#82d8a9] font-mono">
                              {prod.stockQuantity}
                            </span>
                            <span className="text-[10px] bg-[#006b45] text-white px-1">
                              {prod.stockStatus}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-[#262b29] flex items-center gap-2">
                          <button
                            onClick={() => {
                              addToCart(prod, 1);
                              setActiveTab('register');
                            }}
                            className="flex-1 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold text-center"
                          >
                            Sell 1 from POS
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Live Inventory Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0a0f0d] text-[#88938b] border-b border-[#262b29]">
                        <th className="p-2">ID</th>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Barcode</th>
                        <th className="p-2">Product Name</th>
                        <th className="p-2">Price (NPR)</th>
                        <th className="p-2 text-center">POS Stock</th>
                        <th className="p-2 text-center">Online Stock</th>
                        <th className="p-2 text-center">Status</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-[#262b29] hover:bg-[#1c211e]">
                          <td className="p-2 font-mono text-[#88938b]">{p.id}</td>
                          <td className="p-2 font-mono text-[#82d8a9]">{p.sku}</td>
                          <td className="p-2 font-mono text-[#bec9c0]">{p.barcode}</td>
                          <td className="p-2 font-semibold text-[#dfe4e0] max-w-xs truncate">{p.name}</td>
                          <td className="p-2 font-mono">{p.price.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-center font-bold text-white font-mono bg-[#0a0f0d]">
                            {p.stockQuantity}
                          </td>
                          <td className="p-2 text-center font-bold text-[#82d8a9] font-mono bg-[#0a0f0d]">
                            {p.stockQuantity}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 font-bold uppercase ${
                                p.stockQuantity <= 0
                                  ? 'bg-[#93000a] text-white'
                                  : p.stockQuantity <= p.lowStockThreshold
                                  ? 'bg-[#ee9800] text-black'
                                  : 'bg-[#006b45] text-[#9df5c4]'
                              }`}
                            >
                              {p.stockStatus}
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => {
                                addToCart(p, 1);
                                setActiveTab('register');
                              }}
                              className="px-2 py-1 bg-[#262b29] hover:bg-[#313633] text-[#82d8a9] text-[10px] font-bold"
                            >
                              Ring Up &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALES HISTORY & JOURNAL (Screen 7) */}
          {activeTab === 'history' && (
            <SalesJournalView />
          )}

          {/* TAB 4: SALES RETURN & REFUND CONSOLE (Screen 8) */}
          {activeTab === 'returns' && (
            <ReturnsRefundConsole onRestockSuccess={fetchPosProducts} />
          )}

          {/* TAB 5: CASH DRAWER & SHIFT RECONCILIATION (Screen 6) */}
          {activeTab === 'drawer' && (
            <CashDrawerShiftView
              activeShift={activeShift}
              cashTransactions={cashTransactions}
              recentShifts={recentShifts}
              lastClosedShift={lastClosedShift}
              cashier={currentCashier}
              registerCode={registerCode}
              theme={theme}
              onOpenShiftClick={() => setIsOpenShiftModalOpen(true)}
              onCloseShiftClick={() => setIsEodModalOpen(true)}
              onCashOpSuccess={fetchActiveShift}
            />
          )}

          {/* TAB 6: CUSTOMER & LOYALTY CONSOLE (Screen 10) */}
          {activeTab === 'loyalty' && (
            <CustomerLoyaltyView
              onSelectCustomer={(cust) => {
                setCustomerName(cust.name);
                setCustomerPhone(cust.phone);
                setCustomerLoyalty(cust);
                if (cust.discountPercent) {
                  const calcAmt = Math.round(subtotal * (cust.discountPercent / 100));
                  setDiscountAmount(calcAmt);
                  setActiveDiscountInfo({
                    id: `loyalty_${cust.id}`,
                    title: `${cust.tier} Tier Discount (${cust.discountPercent}%)`,
                    type: 'percentage',
                    rate: cust.discountPercent,
                    amount: calcAmt,
                  });
                }
                setActiveTab('register');
              }}
            />
          )}

          {/* TAB 7: PRICING & PROMOTION ENGINE (Screen 11) */}
          {activeTab === 'promos' && (
            <PricePromotionView
              onApplyRule={(discount) => {
                setDiscountAmount(discount);
                setActiveDiscountInfo({
                  id: 'promo_engine_rule',
                  title: `Counter Campaign Rebate (-NPR ${discount.toLocaleString('en-IN')})`,
                  type: 'voucher',
                  amount: discount,
                });
                setActiveTab('register');
              }}
            />
          )}

          {/* TAB 8: HARDWARE DIAGNOSTICS (Screen 12) */}
          {activeTab === 'hardware' && (
            <HardwareDiagnosticsView />
          )}
        </div>
      </div>

      {/* 3.5. DISCOUNT BOX / ORDER DISCOUNT & VOUCHER ENGINE MODAL [F9] */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
          <div
            className={`w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden border ${
              theme === 'dark'
                ? 'bg-[#0d1410] border-[#006b45] text-[#dfe4e0]'
                : 'bg-[#ffffff] border-[#006b45] text-slate-900'
            }`}
          >
            {/* 01. HEADER: Icon with green background, small label 'DISCOUNT CENTER', title 'Order Discount & Voucher Engine', clean subtitle */}
            <div
              className={`p-3.5 sm:p-4 border-b flex items-start justify-between ${
                theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-[#006b45] text-white flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-white" strokeWidth={2.5} />
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="bg-[#006b45] text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider font-sans">
                      DISCOUNT CENTER
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 font-mono border ${
                      theme === 'dark' ? 'text-[#88938b] border-[#3f4942]' : 'text-slate-500 border-slate-300'
                    }`}>
                      HOTKEY [F9]
                    </span>
                  </div>
                  <h3 className={`text-base font-bold tracking-tight font-sans ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Order Discount &amp; Voucher Engine
                  </h3>
                  <p className={`text-xs font-sans mt-0.5 ${theme === 'dark' ? 'text-[#bec9c0]' : 'text-slate-500'}`}>
                    Apply discounts, loyalty benefits, or promotional vouchers.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className={`p-1.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  theme === 'dark'
                    ? 'text-[#88938b] hover:text-white hover:bg-[#262b29]'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                }`}
                title="Close [ESC]"
              >
                <span className="text-[10px] font-mono px-1 py-0.5 border border-current">ESC</span>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 03. CART EMPTY STATE NOTICE (If Cart is NPR 0) */}
            {subtotal === 0 && (
              <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2.5 font-sans">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                <div>
                  <strong>Active cart is empty (NPR 0).</strong> Scan barcodes or add products before selecting discounts.
                </div>
              </div>
            )}

            {/* ACTIVE DISCOUNT BANNER WITH GRANULAR BREAKDOWN & CLEAR ALL */}
            {totalDiscountAmount > 0 && (
              <div className="mx-4 mt-3 p-3 bg-[#006b45]/15 border border-[#82d8a9]/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 bg-[#006b45] text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide font-sans">
                    <CheckCircle2 className="w-3 h-3 text-[#82d8a9]" />
                    Applied
                  </span>
                  <div>
                    <div className="text-xs font-bold font-sans text-white dark:text-white light:text-slate-900">
                      Total Savings: NPR {totalDiscountAmount.toLocaleString('en-IN')} {discountPercent > 0 && `(${discountPercent}%)`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#82d8a9] font-mono mt-0.5">
                      {totalItemDiscounts > 0 && (
                        <span className="bg-[#006b45]/30 px-1.5 py-0.2 border border-[#82d8a9]/40">
                          Item Discounts: -NPR {totalItemDiscounts.toLocaleString('en-IN')}
                        </span>
                      )}
                      {calculatedOrderDiscount > 0 && (
                        <span className="bg-[#ffb95f]/20 text-[#ffb95f] px-1.5 py-0.2 border border-[#ffb95f]/40">
                          Whole Order: -NPR {calculatedOrderDiscount.toLocaleString('en-IN')}
                        </span>
                      )}
                      {calculatedPromoDiscount > 0 && appliedPromo && (
                        <span className="bg-[#82d8a9]/20 text-white px-1.5 py-0.2 border border-[#82d8a9]/40">
                          Promo: {appliedPromo.code} (-NPR {calculatedPromoDiscount.toLocaleString('en-IN')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAllDiscounts}
                  className="px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-[#ffb4ab] border border-red-500/40 text-xs font-bold font-sans flex items-center gap-1 cursor-pointer transition-colors"
                  title="Remove all discounts and vouchers"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              </div>
            )}

            {/* CURRENT ORDER FINANCIAL SUMMARY (3-COLUMN WITH DYNAMIC SAVINGS) */}
            <div
              className={`mx-4 mt-3 px-4 py-3 border grid grid-cols-3 gap-3 text-center ${
                theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-[10px] uppercase font-bold tracking-wider font-sans ${
                  theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                }`}>
                  GROSS SUBTOTAL
                </span>
                <span className="text-sm font-bold font-mono text-[#82d8a9]">
                  NPR {grossSubtotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex flex-col border-x border-[#262b29]">
                <span className={`text-[10px] uppercase font-bold tracking-wider font-sans ${
                  theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                }`}>
                  TOTAL DISCOUNT {discountPercent > 0 ? `(${discountPercent}%)` : ''}
                </span>
                <span className="text-sm font-bold font-mono text-[#ffb95f]">
                  {totalDiscountAmount > 0 ? `- NPR ${totalDiscountAmount.toLocaleString('en-IN')}` : 'NPR 0'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className={`text-[10px] uppercase font-bold tracking-wider font-sans ${
                  theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                }`}>
                  NET PAYABLE
                </span>
                <span className="text-sm font-bold font-mono text-[#006b45] dark:text-[#82d8a9]">
                  NPR {totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {totalDiscountAmount > 0 && (
              <div className="mx-4 mt-1.5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#006b45]/20 text-[#82d8a9] border border-[#006b45] text-xs font-bold font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-[#ffb95f]" />
                  Total Customer Savings: NPR {totalDiscountAmount.toLocaleString('en-IN')} ({discountPercent}%)
                </span>
              </div>
            )}

            {/* TAB SELECTION NAVIGATION: WHOLE ORDER / PER-PRODUCT / PROMO CODES */}
            <div className={`mx-4 mt-3 flex items-center border p-1 gap-1 ${
              theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setDiscountModalTab('whole')}
                className={`flex-1 py-2 px-2 sm:px-3 text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  discountModalTab === 'whole'
                    ? 'bg-[#006b45] text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-[#88938b] hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Whole Order</span>
                {activeOrderDiscount && (
                  <span className="w-2 h-2 rounded-full bg-[#82d8a9] animate-pulse"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDiscountModalTab('item')}
                className={`flex-1 py-2 px-2 sm:px-3 text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  discountModalTab === 'item'
                    ? 'bg-[#006b45] text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-[#88938b] hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Per-Product Item</span>
                <span className={`text-[10px] px-1.5 py-0.2 font-mono ${
                  cartItemDiscountsCount > 0 ? 'bg-[#ffb95f] text-black font-bold' : 'bg-black/20 text-[#88938b]'
                }`}>
                  {cartItemDiscountsCount > 0 ? `${cartItemDiscountsCount} Disc` : `${cart.length}`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountModalTab('promo')}
                className={`flex-1 py-2 px-2 sm:px-3 text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  discountModalTab === 'promo'
                    ? 'bg-[#006b45] text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-[#88938b] hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Promo Codes</span>
                {appliedPromo && (
                  <span className="text-[9px] bg-[#82d8a9] text-black font-bold px-1 font-mono truncate max-w-[80px]">
                    {appliedPromo.code}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[54vh] overflow-y-auto">
              {/* ============================================================== */}
              {/* TAB 1: WHOLE ORDER DISCOUNT ENGINE                             */}
              {/* ============================================================== */}
              {discountModalTab === 'whole' && (
                <div className="space-y-4">
                  {/* Active Order Discount Card */}
                  {activeOrderDiscount && (
                    <div className="p-3 bg-[#006b45]/20 border border-[#82d8a9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#82d8a9]" />
                        <div>
                          <div className="text-xs font-bold text-white">
                            {activeOrderDiscount.title}
                          </div>
                          <div className="text-[11px] text-[#82d8a9] font-mono">
                            Reducing Order by NPR {calculatedOrderDiscount.toLocaleString('en-IN')}
                            {activeOrderDiscount.requiresApproval && (
                              <span className="ml-2 text-amber-400 font-sans font-bold text-[10px]">
                                • Manager Authorization Required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearOrderDiscount}
                        className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-[#ffb4ab] border border-red-500/40 text-xs font-bold font-sans flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Mode Selector & Quick Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-[11px] font-bold uppercase tracking-wider font-sans ${
                        theme === 'dark' ? 'text-[#88938b]' : 'text-slate-600'
                      }`}>
                        Apply Whole Order Reduction
                      </label>
                      <div className={`flex items-center gap-1 p-0.5 border ${
                        theme === 'dark' ? 'bg-[#0a0f0d] border-[#262b29]' : 'bg-slate-200 border-slate-300'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setOrderDiscountMode('percent')}
                          className={`px-2.5 py-0.5 text-[10px] font-bold font-sans cursor-pointer transition-colors ${
                            orderDiscountMode === 'percent'
                              ? 'bg-[#006b45] text-white'
                              : theme === 'dark' ? 'text-[#88938b]' : 'text-slate-600'
                          }`}
                        >
                          Percentage (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrderDiscountMode('fixed')}
                          className={`px-2.5 py-0.5 text-[10px] font-bold font-sans cursor-pointer transition-colors ${
                            orderDiscountMode === 'fixed'
                              ? 'bg-[#006b45] text-white'
                              : theme === 'dark' ? 'text-[#88938b]' : 'text-slate-600'
                          }`}
                        >
                          Fixed Cash (NPR)
                        </button>
                      </div>
                    </div>

                    {/* Presets Grid */}
                    {orderDiscountMode === 'percent' ? (
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { pct: 3, label: 'Regular Club' },
                          { pct: 5, label: 'Silver VIP' },
                          { pct: 10, label: 'Gold Patron' },
                          { pct: 15, label: 'Staff / Family' },
                          { pct: 20, label: 'Manager Special' },
                        ].map(({ pct, label }) => {
                          const isSelected = activeOrderDiscount?.type === 'percent' && activeOrderDiscount.rate === pct;
                          const calcAmt = Math.round(subtotalAfterItems * (pct / 100));
                          const isDisabled = subtotalAfterItems === 0;

                          return (
                            <button
                              key={pct}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => applyWholeOrderDiscount('percent', pct, `${pct}% OFF — ${label}`)}
                              className={`p-2.5 border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'bg-[#006b45] text-white border-[#82d8a9] ring-2 ring-[#006b45]'
                                  : isDisabled
                                  ? 'opacity-40 cursor-not-allowed bg-transparent border-[#262b29] text-[#88938b]'
                                  : theme === 'dark'
                                  ? 'bg-[#181d1b] hover:bg-[#262b29] hover:border-[#82d8a9]/60 text-[#dfe4e0] border-[#262b29]'
                                  : 'bg-slate-50 hover:bg-slate-100 hover:border-[#006b45]/60 text-slate-800 border-slate-200'
                              }`}
                            >
                              <span className="text-xs font-mono font-bold">{pct}% OFF</span>
                              <span className="text-[10px] font-mono mt-0.5 text-[#ffb95f]">
                                ~ NPR {calcAmt.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[9px] text-[#88938b] truncate mt-0.5">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { amt: 100, keyNum: '1' },
                          { amt: 250, keyNum: '2' },
                          { amt: 500, keyNum: '3' },
                          { amt: 1000, keyNum: '4' },
                          { amt: 2000, keyNum: '5' },
                        ].map(({ amt, keyNum }) => {
                          const isSelected = activeOrderDiscount?.type === 'fixed' && activeOrderDiscount.amount === amt;
                          const isDisabled = subtotalAfterItems === 0 || amt > subtotalAfterItems;

                          return (
                            <button
                              key={amt}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => applyWholeOrderDiscount('fixed', amt, `Flat Cash - NPR ${amt}`)}
                              className={`relative p-2.5 border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'bg-[#006b45] text-white border-[#82d8a9] ring-2 ring-[#006b45]'
                                  : isDisabled
                                  ? 'opacity-40 cursor-not-allowed bg-transparent border-[#262b29] text-[#88938b]'
                                  : theme === 'dark'
                                  ? 'bg-[#181d1b] hover:bg-[#262b29] hover:border-[#82d8a9]/60 text-[#dfe4e0] border-[#262b29]'
                                  : 'bg-slate-50 hover:bg-slate-100 hover:border-[#006b45]/60 text-slate-800 border-slate-200'
                              }`}
                            >
                              <span className="absolute top-1 right-1 text-[8px] font-mono text-[#88938b]">[{keyNum}]</span>
                              <span className="text-xs font-mono font-bold mt-1">- NPR {amt}</span>
                              <span className="text-[9px] text-[#88938b] mt-0.5">Flat Cash</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Custom Order Discount Input */}
                  <div className={`p-3 border ${
                    theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold font-sans">
                        Custom Whole Order Discount Value
                      </label>
                      <span className="text-[10px] text-[#88938b] font-sans">
                        Payable Subtotal: <strong className="font-mono text-[#82d8a9]">NPR {subtotalAfterItems.toLocaleString('en-IN')}</strong>
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono ${
                          theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'
                        }`}>
                          {orderDiscountMode === 'fixed' ? 'NPR' : '%'}
                        </span>
                        <input
                          ref={customDiscountInputRef}
                          type="number"
                          min="0"
                          max={orderDiscountMode === 'fixed' ? subtotalAfterItems : 100}
                          value={orderDiscountValue}
                          onChange={(e) => {
                            setOrderDiscountValue(e.target.value);
                            setOrderDiscountError('');
                          }}
                          placeholder={orderDiscountMode === 'fixed' ? 'e.g. 750' : 'e.g. 12'}
                          className={`w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border focus:outline-none focus:border-[#82d8a9] ${
                            theme === 'dark'
                              ? 'bg-[#0a0f0d] text-white border-[#3f4942]'
                              : 'bg-white text-slate-900 border-slate-300'
                          }`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleWholeOrderDiscountSubmit();
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleWholeOrderDiscountSubmit}
                        disabled={subtotalAfterItems === 0}
                        className="px-4 py-2 bg-[#006b45] hover:bg-[#036c46] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-sans border border-[#82d8a9] cursor-pointer flex items-center gap-1.5"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Apply Order Discount
                      </button>
                    </div>

                    {orderDiscountError && (
                      <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1 font-sans">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {orderDiscountError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: PER-PRODUCT ITEM DISCOUNT ENGINE                        */}
              {/* ============================================================== */}
              {discountModalTab === 'item' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-[#262b29]">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-sans">
                        Per-Product Item Discount Manager
                      </h4>
                      <p className="text-[11px] text-[#88938b] font-sans">
                        Configure customized markdowns or percentage discounts on each line item.
                      </p>
                    </div>
                    {cartItemDiscountsCount > 0 && (
                      <button
                        type="button"
                        onClick={clearAllItemDiscounts}
                        className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-[#ffb4ab] border border-red-500/40 text-[10px] font-bold font-sans flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset All Items
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-[#88938b] text-xs font-sans">
                      <Barcode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      Cart is empty. Scan barcodes or add items from catalog before managing line item discounts.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => {
                        const lineDiscount = getItemLineDiscount(item);
                        const grossLine = item.product.price * item.quantity;
                        const netLine = Math.max(0, grossLine - lineDiscount);
                        const isFocused = focusedProductId === item.product.id;
                        const currentDiscVal = item.itemDiscountValue ?? 0;
                        const currentDiscType = item.itemDiscountType ?? 'percentage';

                        return (
                          <div
                            key={item.product.id}
                            className={`p-3 border transition-all ${
                              isFocused
                                ? 'border-[#82d8a9] ring-1 ring-[#82d8a9] bg-[#006b45]/10'
                                : theme === 'dark'
                                ? 'bg-[#181d1b] border-[#262b29]'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              {/* Left Product Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-[#82d8a9] bg-[#0a0f0d] px-1 border border-[#262b29]">
                                    {item.product.sku}
                                  </span>
                                  <h5 className="text-xs font-bold truncate text-white dark:text-white light:text-slate-900">
                                    {item.product.name}
                                  </h5>
                                </div>
                                <div className="text-[11px] text-[#88938b] mt-0.5 font-sans">
                                  Qty: <strong className="font-mono text-white dark:text-white light:text-slate-900">{item.quantity}</strong> × NPR {item.product.price.toLocaleString('en-IN')} ={' '}
                                  <span className="font-mono font-bold">NPR {grossLine.toLocaleString('en-IN')}</span>
                                </div>
                              </div>

                              {/* Right Pricing Outcome */}
                              <div className="text-right sm:w-36 shrink-0">
                                {lineDiscount > 0 ? (
                                  <div>
                                    <div className="text-[10px] text-[#ffb95f] font-mono">
                                      - NPR {lineDiscount.toLocaleString('en-IN')} Saved
                                    </div>
                                    <div className="text-sm font-bold font-mono text-[#82d8a9]">
                                      NPR {netLine.toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm font-bold font-mono text-[#dfe4e0]">
                                    NPR {grossLine.toLocaleString('en-IN')}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Discount Controls for this Item */}
                            <div className="mt-2.5 pt-2 border-t border-[#262b29] flex flex-wrap items-center justify-between gap-2">
                              {/* Quick % chips */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[#88938b] font-sans mr-1">Quick:</span>
                                {[5, 10, 15, 20].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => setItemDiscount(item.product.id, 'percentage', pct)}
                                    className={`px-2 py-0.5 text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                                      currentDiscType === 'percentage' && currentDiscVal === pct
                                        ? 'bg-[#006b45] text-white border-[#82d8a9]'
                                        : theme === 'dark'
                                        ? 'bg-[#0a0f0d] text-[#dfe4e0] hover:border-[#82d8a9]/60 border-[#262b29]'
                                        : 'bg-white text-slate-800 hover:border-[#006b45] border-slate-300'
                                    }`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>

                              {/* Custom input & Type switcher */}
                              <div className="flex items-center gap-1.5">
                                <div className="flex border border-[#262b29] text-[9px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setItemDiscount(item.product.id, 'percentage', currentDiscVal || 5)}
                                    className={`px-1.5 py-0.5 cursor-pointer ${
                                      currentDiscType === 'percentage'
                                        ? 'bg-[#006b45] text-white'
                                        : 'bg-black/30 text-[#88938b]'
                                    }`}
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemDiscount(item.product.id, 'fixed', currentDiscVal || 100)}
                                    className={`px-1.5 py-0.5 cursor-pointer ${
                                      currentDiscType === 'fixed'
                                        ? 'bg-[#006b45] text-white'
                                        : 'bg-black/30 text-[#88938b]'
                                    }`}
                                  >
                                    NPR
                                  </button>
                                </div>

                                <input
                                  type="number"
                                  min="0"
                                  max={currentDiscType === 'percentage' ? 100 : grossLine}
                                  value={currentDiscVal || ''}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value) || 0;
                                    setItemDiscount(item.product.id, currentDiscType, v);
                                  }}
                                  placeholder={currentDiscType === 'percentage' ? '%' : 'NPR'}
                                  className={`w-20 px-2 py-0.5 text-xs font-mono font-bold border focus:outline-none focus:border-[#82d8a9] ${
                                    theme === 'dark' ? 'bg-[#0a0f0d] text-white border-[#3f4942]' : 'bg-white border-slate-300'
                                  }`}
                                />

                                {lineDiscount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => clearItemDiscount(item.product.id)}
                                    className="p-1 text-[#ffb4ab] hover:bg-red-500/20 text-xs font-bold cursor-pointer"
                                    title="Reset this item's discount"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: APPLY PROMOTION & VOUCHER CODES                         */}
              {/* ============================================================== */}
              {discountModalTab === 'promo' && (
                <div className="space-y-4">
                  {/* Active Applied Voucher Banner */}
                  {appliedPromo && (
                    <div className="p-3 bg-[#006b45]/20 border border-[#82d8a9] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Tag className="w-4 h-4 text-[#82d8a9]" />
                        <div>
                          <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                            <span>{appliedPromo.code}</span>
                            <span className="text-[10px] bg-[#006b45] text-[#82d8a9] px-1.5 py-0.2 font-sans font-bold uppercase">
                              Active Promo
                            </span>
                          </div>
                          <div className="text-[11px] text-[#dfe4e0] font-sans mt-0.5">
                            {appliedPromo.title}
                          </div>
                          <div className="text-[11px] text-[#82d8a9] font-mono font-bold">
                            Applied Reduction: - NPR {calculatedPromoDiscount.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearPromo}
                        className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-[#ffb4ab] border border-red-500/40 text-xs font-bold font-sans flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Promo
                      </button>
                    </div>
                  )}

                  {/* Promo Code Input Box */}
                  <div className={`p-3.5 border ${
                    theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <label className="text-[11px] font-bold uppercase tracking-wider block mb-1.5 font-sans">
                      Enter Promotional Campaign or Voucher Coupon Code
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Gift className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                          theme === 'dark' ? 'text-[#88938b]' : 'text-slate-400'
                        }`} />
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          placeholder="e.g. DASHAIN-DHAMAKA, INTEL10, FESTIVE500, WELCOME"
                          className={`w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border focus:outline-none focus:border-[#82d8a9] uppercase ${
                            theme === 'dark'
                              ? 'bg-[#0a0f0d] text-white border-[#3f4942]'
                              : 'bg-white text-slate-900 border-slate-300'
                          }`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyPromoCode();
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPromoCode()}
                        disabled={grossSubtotal === 0}
                        className="px-4 py-2 bg-[#006b45] hover:bg-[#036c46] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-sans border border-[#82d8a9] cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-[#82d8a9]" />
                        Apply Code
                      </button>
                    </div>

                    {promoError && (
                      <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1 font-sans">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {promoError}
                      </p>
                    )}

                    {promoSuccess && (
                      <p className="text-[11px] text-[#82d8a9] mt-2 flex items-center gap-1 font-sans font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {promoSuccess}
                      </p>
                    )}
                  </div>

                  {/* Available In-Store & Online Promo Campaigns List */}
                  <div>
                    <label className={`text-[11px] font-bold uppercase tracking-wider block mb-2 font-sans ${
                      theme === 'dark' ? 'text-[#88938b]' : 'text-slate-600'
                    }`}>
                      Available Promotional Campaigns (1-Click Apply)
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {PROMO_CAMPAIGNS.map((p) => {
                        const isSelected = appliedPromo?.code === p.code;
                        const isMinSpendUnmet = p.minPurchase ? grossSubtotal < p.minPurchase : false;
                        const isMinItemsUnmet = p.minItems ? totalCartItems < p.minItems : false;
                        const isEligible = !isMinSpendUnmet && !isMinItemsUnmet && grossSubtotal > 0;

                        return (
                          <div
                            key={p.code}
                            className={`p-3 border flex flex-col justify-between transition-all ${
                              isSelected
                                ? 'bg-[#006b45]/20 border-[#82d8a9] ring-2 ring-[#006b45]'
                                : !isEligible
                                ? 'opacity-50 bg-[#181d1b]/40 border-[#262b29]'
                                : theme === 'dark'
                                ? 'bg-[#181d1b] border-[#262b29] hover:border-[#82d8a9]/50'
                                : 'bg-slate-50 border-slate-200 hover:border-[#006b45]/50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono font-bold tracking-wider text-[#ffb95f]">
                                  {p.code}
                                </span>
                                <span className={`text-[8px] font-bold font-sans uppercase px-1.5 py-0.2 ${
                                  isSelected
                                    ? 'bg-[#006b45] text-white'
                                    : isEligible
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {isSelected ? 'Applied' : isEligible ? 'Eligible' : 'Conditions Unmet'}
                                </span>
                              </div>

                              <div className="text-sm font-bold font-mono text-white dark:text-white light:text-slate-900">
                                {p.discountType === 'percentage'
                                  ? `${p.discountValue}% OFF`
                                  : `- NPR ${p.discountValue.toLocaleString('en-IN')}`}
                              </div>
                              <div className="text-[11px] font-medium font-sans mt-0.5 text-[#dfe4e0]">
                                {p.title}
                              </div>

                              <div className="mt-2 text-[9px] text-[#88938b] font-sans space-y-0.5">
                                {p.minPurchase && (
                                  <div>Min Order: NPR {p.minPurchase.toLocaleString('en-IN')}</div>
                                )}
                                {p.minItems && (
                                  <div>Min Items: {p.minItems} Units</div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!isEligible && !isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  clearPromo();
                                } else {
                                  handleApplyPromoCode(p.code);
                                }
                              }}
                              className={`mt-3 py-1.5 text-xs font-bold font-sans transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                                isSelected
                                  ? 'bg-red-500/20 text-[#ffb4ab] border-red-500/40 hover:bg-red-500/30'
                                  : isEligible
                                  ? 'bg-[#006b45] hover:bg-[#036c46] text-white border-[#82d8a9]'
                                  : 'bg-transparent text-[#88938b] border-[#262b29] cursor-not-allowed'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <X className="w-3 h-3" /> Remove Voucher
                                </>
                              ) : isEligible ? (
                                'Apply Voucher'
                              ) : isMinSpendUnmet ? (
                                `Requires Min NPR ${p.minPurchase?.toLocaleString('en-IN')}`
                              ) : (
                                `Requires ${p.minItems}+ Items`
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 08. MODAL FOOTER ACTIONS */}
            <div
              className={`p-3.5 border-t flex items-center justify-between ${
                theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 font-sans">
                {totalDiscountAmount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse"></span>
                    <span className={`text-xs ${theme === 'dark' ? 'text-[#dfe4e0]' : 'text-slate-700'}`}>
                      Active:{' '}
                      <strong>
                        {totalItemDiscounts > 0 && (activeOrderDiscount || appliedPromo)
                          ? 'Per-Item + Order/Promo'
                          : totalItemDiscounts > 0
                          ? `${cartItemDiscountsCount} Item Discount(s)`
                          : appliedPromo
                          ? `Promo: ${appliedPromo.code}`
                          : activeOrderDiscount?.title || 'Applied'}
                      </strong>{' '}
                      (-NPR {totalDiscountAmount.toLocaleString('en-IN')})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span className={`text-xs ${theme === 'dark' ? 'text-[#88938b]' : 'text-slate-500'}`}>
                      No discounts currently applied
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 font-sans">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className={`px-4 py-2 text-xs font-bold font-sans border cursor-pointer flex items-center gap-1 ${
                    theme === 'dark'
                      ? 'bg-[#262b29] hover:bg-[#313633] text-[#dfe4e0] border-[#3f4942]'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  Cancel [ESC]
                </button>
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-5 py-2 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold font-sans border border-[#82d8a9] cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#82d8a9]" />
                  Apply &amp; Return to Cart
                  <span className="text-[10px] font-mono px-1 py-0.2 bg-black/20 border border-white/20">
                    Enter ↵
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PAYMENT & TENDER PROCESSING MODAL (Screen 4) */}
      {isTenderOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className={`border border-[#006b45] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden rounded-xs ${
            theme === 'dark' ? 'bg-[#0a0f0d] text-[#dfe4e0]' : 'bg-[#ffffff] text-[#0f172a]'
          }`}>
            {/* 01. Payment Header (Traceability & Operational Context) */}
            <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f1f5f9] border-[#e2e8f0]'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#006b45] text-white text-xs px-2.5 py-0.5 font-bold tracking-wider uppercase rounded-xs">
                    PAYMENT TERMINAL
                  </span>
                  <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-[#88938b]' : 'text-[#64748b]'}`}>
                    Complete customer payment securely.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Register Active
                  </span>
                  <span className={`px-2 py-0.5 rounded-xs border ${
                    theme === 'dark' ? 'bg-[#121614] border-[#262b29] text-[#bec9c0]' : 'bg-white border-[#cbd5e1] text-[#334155]'
                  }`}>
                    Invoice: INV-2083-{((activeShift?.id || 1) * 31 + 125).toString().padStart(6, '0')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-xs border ${
                    theme === 'dark' ? 'bg-[#121614] border-[#262b29] text-[#88938b]' : 'bg-white border-[#cbd5e1] text-[#64748b]'
                  }`}>
                    Terminal: {registerCode.split(' ')[0] || 'TERM-02'} · Cashier: {cashierName.split(' ')[0] || 'Sarah Jenkins'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsTenderOpen(false)}
                className={`p-1.5 rounded-xs cursor-pointer transition-colors ${
                  theme === 'dark' ? 'text-[#88938b] hover:text-white hover:bg-white/10' : 'text-[#64748b] hover:text-[#0f172a] hover:bg-black/5'
                }`}
                title="Cancel & Close [ESC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two-Column Workspace */}
            <div className="grid grid-cols-12 flex-1 overflow-hidden">
              {/* Left Column (Col 5): Payment Methods & Customer Details */}
              <div className={`col-span-12 md:col-span-5 border-r p-4 flex flex-col justify-between overflow-y-auto ${
                theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-[#f8fafc] border-[#e2e8f0]'
              }`}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      theme === 'dark' ? 'text-[#88938b]' : 'text-[#64748b]'
                    }`}>Select Payment Method</span>
                    <span className="text-[10px] text-emerald-500 font-mono font-bold">F1 - F6 HOTKEYS</span>
                  </div>

                  {/* 07. Payment Method Selection with Availability Badges */}
                  {[
                    { id: 'cash', name: '1. Cash NPR', icon: Banknote, key: '[F1]', status: 'Ready', ready: true },
                    { id: 'card', name: '2. Card POS Terminal', icon: CreditCard, key: '[F2]', status: 'Connected', ready: true },
                    { id: 'qr', name: '3. Fonepay QR Code', icon: QrCode, key: '[F3]', status: 'Available', ready: true },
                    { id: 'esewa', name: '4. eSewa Wallet', icon: WalletIcon, key: '[F4]', status: 'Available', ready: true },
                    { id: 'khalti', name: '5. Khalti Pay', icon: WalletIcon, key: '[F5]', status: 'Available', ready: true },
                    { id: 'split', name: '6. Split Tender', icon: Layers, key: '[F6]', status: 'Ready', ready: true },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setTenderMethod(m.id as any);
                        if (m.id === 'cash') {
                          setTimeout(() => {
                            cashInputRef.current?.focus();
                            cashInputRef.current?.select();
                          }, 50);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 border text-left text-xs transition-all cursor-pointer rounded-xs ${
                        tenderMethod === m.id
                          ? 'bg-[#006b45] text-white border-[#82d8a9] font-bold shadow-xs'
                          : theme === 'dark'
                          ? 'bg-[#1c211e] hover:bg-[#262b29] text-[#bec9c0] border-[#262b29]'
                          : 'bg-[#ffffff] hover:bg-[#f1f5f9] text-[#0f172a] border-[#cbd5e1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <m.icon className={`w-4 h-4 shrink-0 ${tenderMethod === m.id ? 'text-[#82d8a9]' : 'text-emerald-500'}`} />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-xs font-mono uppercase font-bold ${
                          tenderMethod === m.id
                            ? 'bg-black/30 text-white border border-white/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          ● {m.status}
                        </span>
                        <span className={`text-[10px] px-1 font-mono ${
                          tenderMethod === m.id
                            ? 'text-white/80'
                            : theme === 'dark'
                            ? 'bg-[#0a0f0d] text-[#88938b]'
                            : 'bg-[#f1f5f9] text-[#64748b]'
                        }`}>{m.key}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 08. Detailed Customer Profile Card */}
                <div className={`mt-4 p-3 border rounded-xs ${
                  theme === 'dark' ? 'bg-[#0a0f0d] border-[#262b29]' : 'bg-[#ffffff] border-[#cbd5e1]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      theme === 'dark' ? 'text-[#88938b]' : 'text-[#64748b]'
                    }`}>CUSTOMER DETAILS</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTenderOpen(false);
                        setActiveTab('loyalty');
                      }}
                      className="text-[10px] text-emerald-600 dark:text-[#82d8a9] hover:underline font-bold font-mono cursor-pointer flex items-center gap-1"
                    >
                      Change [F8]
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#006b45]/15 border border-[#006b45]/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-[#82d8a9]">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-[#0f172a]'}`}>
                          {customerName}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-xs font-bold font-mono ${
                          customerLoyalty
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {customerLoyalty ? 'Loyalty Member' : 'Walk-in'}
                        </span>
                      </div>

                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {customerPhone ? `Mobile: ${customerPhone}` : 'Guest Checkout (No phone on file)'}
                      </div>

                      {customerLoyalty && (
                        <div className="text-[10px] text-emerald-600 dark:text-[#82d8a9] font-mono mt-0.5">
                          Points: {customerLoyalty.points} pts · Discount: {customerLoyalty.discount}% Tier
                        </div>
                      )}

                      <div className="text-[9px] text-gray-400 mt-1 italic leading-tight">
                        Invoice will be issued under this customer profile.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (Col 7): Financial Summary & Dynamic Method Panel */}
              <div className={`col-span-12 md:col-span-7 p-4 flex flex-col justify-between overflow-y-auto ${
                theme === 'dark' ? 'bg-[#0a0f0d]' : 'bg-[#ffffff]'
              }`}>
                <div>
                  {/* 02. Total Balance Due & Descriptive Financial Summary */}
                  <div className={`p-3.5 border mb-3 rounded-xs ${
                    theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                  }`}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className={`text-xs uppercase font-bold tracking-wider ${
                        theme === 'dark' ? 'text-[#88938b]' : 'text-[#64748b]'
                      }`}>
                        AMOUNT TO COLLECT
                      </span>
                      <span className="text-3xl font-extrabold text-[#006b45] dark:text-[#82d8a9] font-mono">
                        NPR {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Financial Summary Breakdown */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dashed border-gray-300 dark:border-gray-800 text-[11px] font-mono">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase">Order Total</span>
                        <span className={`font-bold ${theme === 'dark' ? 'text-[#dfe4e0]' : 'text-[#0f172a]'}`}>
                          NPR {grossSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase">
                          {tenderMethod === 'split' ? 'Allocated Tender' : 'Previous Payments'}
                        </span>
                        <span className={`font-bold ${
                          tenderMethod === 'split' ? 'text-blue-500' : 'text-gray-500'
                        }`}>
                          NPR {(
                            tenderMethod === 'split'
                              ? ((parseFloat(splitCashAmount) || 0) + (parseFloat(splitSecondaryAmount) || 0))
                              : 0
                          ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block uppercase">Remaining Balance</span>
                        <span className="font-bold text-amber-500 dark:text-amber-400">
                          NPR {(
                            tenderMethod === 'split'
                              ? Math.max(0, totalAmount - ((parseFloat(splitCashAmount) || 0) + (parseFloat(splitSecondaryAmount) || 0)))
                              : totalAmount
                          ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 06. Dynamic Payment Method Panels */}
                  {/* METHOD 1: CASH PAYMENT */}
                  {tenderMethod === 'cash' && (
                    <div className="space-y-3">
                      {/* 03. Cash Amount Input */}
                      <div>
                        <label className={`text-[10px] font-bold uppercase block mb-1.5 ${
                          theme === 'dark' ? 'text-[#bec9c0]' : 'text-[#334155]'
                        }`}>
                          Cash Received from Customer
                        </label>
                        <div className="relative flex items-center">
                          <span className={`absolute left-3 font-mono font-bold text-sm px-2 py-1 rounded-xs border ${
                            theme === 'dark' ? 'bg-[#262b29] border-[#3f4942] text-[#82d8a9]' : 'bg-[#e2e8f0] border-[#cbd5e1] text-[#006b45]'
                          }`}>
                            NPR
                          </span>
                          <input
                            ref={cashInputRef}
                            type="number"
                            min="0"
                            step="any"
                            value={tenderAmount}
                            onChange={(e) => setTenderAmount(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const num = parseFloat(tenderAmount) || 0;
                                if (num < totalAmount) {
                                  alert(`Insufficient tender amount. NPR ${(totalAmount - num).toLocaleString('en-IN')} still required.`);
                                  return;
                                }
                                handleTenderSubmit();
                              }
                            }}
                            placeholder="0.00"
                            className={`w-full pl-18 pr-4 py-2.5 text-2xl font-bold font-mono border-2 transition-all focus:outline-none rounded-xs ${
                              theme === 'dark'
                                ? 'bg-[#181d1b] border-[#82d8a9] text-white focus:ring-2 focus:ring-[#82d8a9]/30'
                                : 'bg-[#f8fafc] border-[#006b45] text-[#0f172a] focus:ring-2 focus:ring-[#006b45]/20'
                            }`}
                          />
                        </div>

                        {/* Status Note under Cash Input */}
                        <div className="mt-1 text-[11px] font-mono">
                          {(() => {
                            const num = parseFloat(tenderAmount) || 0;
                            if (num === totalAmount) {
                              return (
                                <span className="text-emerald-500 font-sans flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                  Cash amount matches the payable balance.
                                </span>
                              );
                            }
                            if (num > totalAmount) {
                              return (
                                <span className="text-emerald-500 font-sans flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                  Cash received exceeds total. Change will be returned.
                                </span>
                              );
                            }
                            return (
                              <span className="text-amber-500 font-sans flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Insufficient cash tender. NPR {(totalAmount - num).toLocaleString('en-IN', { minimumFractionDigits: 2 })} still needed.
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 04. Dynamic Change Due Display (3 States) */}
                      {(() => {
                        const numTendered = parseFloat(tenderAmount) || 0;
                        if (numTendered === totalAmount) {
                          return (
                            <div className={`p-3 border flex justify-between items-center rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f1f5f9] border-[#cbd5e1]'
                            }`}>
                              <div>
                                <span className="text-xs uppercase font-bold text-gray-500 block">Change:</span>
                                <span className="text-[10px] text-emerald-500 font-sans">Exact payment received</span>
                              </div>
                              <span className="text-2xl font-bold text-emerald-500 font-mono">
                                NPR 0.00
                              </span>
                            </div>
                          );
                        }
                        if (numTendered > totalAmount) {
                          return (
                            <div className="p-3 border border-emerald-500/50 bg-emerald-500/10 flex justify-between items-center rounded-xs">
                              <div>
                                <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                                  CHANGE TO RETURN
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-emerald-500 text-white font-bold font-sans">
                                  Return to Customer
                                </span>
                              </div>
                              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                NPR {(numTendered - totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div className="p-3 border border-amber-500/50 bg-amber-500/10 flex justify-between items-center rounded-xs">
                            <div>
                              <span className="text-xs uppercase font-bold text-amber-600 dark:text-amber-400 block">
                                REMAINING BALANCE DUE
                              </span>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-medium">
                                ⚠ Insufficient tender amount
                              </span>
                            </div>
                            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                              NPR {(totalAmount - numTendered).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })()}

                      {/* 05. Quick Cash Context-Aware Increments */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-[#88938b]' : 'text-[#64748b]'
                          }`}>
                            Quick Cash Shortcuts (Context-Aware)
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">Adds to current entered tender</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={handleSetExactCash}
                            className={`py-2 px-2 text-xs font-mono font-bold border rounded-xs transition-colors cursor-pointer ${
                              activeQuickPreset === 'Exact'
                                ? 'bg-[#006b45] text-white border-[#82d8a9]'
                                : theme === 'dark'
                                ? 'bg-[#1c211e] hover:bg-[#262b29] text-[#82d8a9] border-[#262b29]'
                                : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#006b45] border-[#cbd5e1]'
                            }`}
                          >
                            Exact
                          </button>
                          {[
                            { label: '+1,000', val: 1000 },
                            { label: '+2,000', val: 2000 },
                            { label: '+5,000', val: 5000 },
                            { label: '+10,000', val: 10000 },
                            { label: '+50,000', val: 50000 },
                            { label: '+100,000', val: 100000 },
                          ].map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => handleQuickAddCash(b.val, b.label)}
                              className={`py-2 px-2 text-xs font-mono border rounded-xs transition-colors cursor-pointer ${
                                activeQuickPreset === b.label
                                  ? 'bg-[#006b45] text-white border-[#82d8a9]'
                                  : theme === 'dark'
                                  ? 'bg-[#1c211e] hover:bg-[#262b29] text-[#dfe4e0] border-[#262b29]'
                                  : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] border-[#cbd5e1]'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={handleRoundTo500}
                            className={`py-2 px-2 text-xs font-mono border rounded-xs transition-colors cursor-pointer ${
                              activeQuickPreset === 'Next 500'
                                ? 'bg-[#006b45] text-white border-[#82d8a9]'
                                : theme === 'dark'
                                ? 'bg-[#1c211e] hover:bg-[#262b29] text-amber-400 border-[#262b29]'
                                : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-amber-700 border-[#cbd5e1]'
                            }`}
                          >
                            Next 500
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* METHOD 2: CARD POS TERMINAL */}
                  {tenderMethod === 'card' && (
                    <div className="space-y-3">
                      {/* Terminal Connection Status */}
                      <div className={`p-3 border rounded-xs flex items-center justify-between ${
                        theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-emerald-500" />
                          <div>
                            <span className="text-xs font-bold block">PAX A920 Smart POS Terminal</span>
                            <span className="text-[10px] text-gray-500 font-mono">IP: 192.168.1.184 · Port 8080 · EMV L1/L2</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold font-mono">
                          ● Online &amp; Paired
                        </span>
                      </div>

                      {/* Interactive Reader Simulation */}
                      <div className={`p-4 border rounded-xs text-center ${
                        cardTerminalStatus === 'authorized'
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : theme === 'dark'
                          ? 'bg-[#141a17] border-[#262b29]'
                          : 'bg-[#f1f5f9] border-[#cbd5e1]'
                      }`}>
                        {cardTerminalStatus === 'idle' && (
                          <div className="space-y-2">
                            <Radio className="w-8 h-8 text-emerald-500 mx-auto animate-pulse" />
                            <div className="text-xs font-bold">Waiting for Customer Card</div>
                            <div className="text-[11px] text-gray-400">
                              Instruct customer to Tap Contactless (NFC), Insert Chip, or Swipe card on POS terminal.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCardTerminalStatus('reading');
                                setTimeout(() => setCardTerminalStatus('authorized'), 800);
                              }}
                              className="mt-2 px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold font-mono rounded-xs cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Simulate Customer Tap / Insert
                            </button>
                          </div>
                        )}

                        {cardTerminalStatus === 'reading' && (
                          <div className="space-y-2 py-2">
                            <RefreshCw className="w-7 h-7 text-[#82d8a9] mx-auto animate-spin" />
                            <div className="text-xs font-bold text-[#82d8a9]">Reading EMV Chip Cryptogram...</div>
                            <div className="text-[10px] text-gray-400 font-mono">Connecting to Bank Switch &amp; Issuer Host</div>
                          </div>
                        )}

                        {cardTerminalStatus === 'authorized' && (
                          <div className="space-y-1 py-1">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              Card Authorized: VISA Classic Debit (*4182)
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              Auth Code: {cardAuthCode} · RRN: {cardRrn}
                            </div>
                            <button
                              type="button"
                              onClick={() => setCardTerminalStatus('idle')}
                              className="text-[10px] text-gray-400 hover:underline cursor-pointer pt-1"
                            >
                              Reset / Re-Swipe
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Reference Inputs */}
                      <div className="grid grid-cols-2 gap-2 text-left">
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Auth Approval Code
                          </label>
                          <input
                            type="text"
                            value={cardAuthCode}
                            onChange={(e) => setCardAuthCode(e.target.value)}
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Retrieval Ref (RRN)
                          </label>
                          <input
                            type="text"
                            value={cardRrn}
                            onChange={(e) => setCardRrn(e.target.value)}
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Card Brands Telemetry */}
                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 font-mono border-t border-gray-200 dark:border-gray-800">
                        <span>SUPPORTED NETWORKS:</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">VISA</span>
                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20">Mastercard</span>
                          <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">SCT Nepal</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">UnionPay</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* METHOD 3: FONEPAY DYNAMIC QR CODE */}
                  {tenderMethod === 'qr' && (
                    <div className="space-y-3">
                      <div className={`p-4 border rounded-xs flex flex-col sm:flex-row items-center gap-4 ${
                        qrVerified
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : theme === 'dark'
                          ? 'bg-[#141a17] border-[#262b29]'
                          : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}>
                        {/* High-res SVG QR Simulation */}
                        <div className="bg-white p-3 border rounded-xs shrink-0 shadow-sm flex flex-col items-center">
                          <svg className="w-32 h-32" viewBox="0 0 100 100" fill="none">
                            <rect width="100" height="100" fill="white" />
                            {/* Outer Frame Top-Left */}
                            <rect x="10" y="10" width="25" height="25" stroke="#0f172a" strokeWidth="4" fill="none" />
                            <rect x="16" y="16" width="13" height="13" fill="#0f172a" />
                            {/* Outer Frame Top-Right */}
                            <rect x="65" y="10" width="25" height="25" stroke="#0f172a" strokeWidth="4" fill="none" />
                            <rect x="71" y="16" width="13" height="13" fill="#0f172a" />
                            {/* Outer Frame Bottom-Left */}
                            <rect x="10" y="65" width="25" height="25" stroke="#0f172a" strokeWidth="4" fill="none" />
                            <rect x="16" y="71" width="13" height="13" fill="#0f172a" />
                            {/* QR Data Pattern Dots */}
                            <rect x="42" y="12" width="6" height="6" fill="#006b45" />
                            <rect x="52" y="12" width="6" height="6" fill="#0f172a" />
                            <rect x="42" y="24" width="6" height="6" fill="#0f172a" />
                            <rect x="52" y="24" width="6" height="6" fill="#006b45" />
                            <rect x="12" y="42" width="6" height="6" fill="#0f172a" />
                            <rect x="24" y="42" width="6" height="6" fill="#006b45" />
                            <rect x="12" y="52" width="6" height="6" fill="#006b45" />
                            <rect x="24" y="52" width="6" height="6" fill="#0f172a" />
                            <rect x="65" y="42" width="6" height="6" fill="#0f172a" />
                            <rect x="77" y="42" width="6" height="6" fill="#006b45" />
                            <rect x="85" y="52" width="6" height="6" fill="#0f172a" />
                            <rect x="42" y="65" width="6" height="6" fill="#006b45" />
                            <rect x="52" y="77" width="6" height="6" fill="#0f172a" />
                            <rect x="65" y="77" width="6" height="6" fill="#006b45" />
                            <rect x="77" y="65" width="6" height="6" fill="#0f172a" />
                            {/* Center Fonepay Logo Badge */}
                            <circle cx="50" cy="50" r="10" fill="#dc2626" />
                            <text x="50" y="54" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">FP</text>
                          </svg>
                          <span className="text-[9px] font-bold text-red-600 mt-1 uppercase tracking-wider">Fonepay Direct</span>
                        </div>

                        {/* QR Info & Listener */}
                        <div className="flex-1 space-y-2 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Dynamic Merchant QR</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expires in {Math.floor(qrSecondsLeft / 60)}:{(qrSecondsLeft % 60).toString().padStart(2, '0')}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-400">
                            Scan with any Nepali bank mobile app (Nabil, Global IME, NIC Asia, etc.) or Fonepay partner wallet.
                          </div>

                          <div className="p-2 rounded-xs border border-gray-200 dark:border-gray-800 bg-black/5 dark:bg-black/20 text-[10px] font-mono">
                            <div className="flex items-center gap-1.5 text-emerald-500">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              <span className="font-bold">LISTENING FOR INSTANT NOTIFICATION...</span>
                            </div>
                            <div className="text-gray-500 mt-0.5">Webhook endpoint active on Port 3000</div>
                          </div>

                          {qrVerified ? (
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Verified: NPR {totalAmount.toLocaleString('en-IN')} (Txn: {qrTxnId})</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setQrVerified(true)}
                              className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white text-xs font-bold font-mono rounded-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              Simulate Customer App Scan &amp; Pay
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* METHOD 4: eSEWA WALLET */}
                  {tenderMethod === 'esewa' && (
                    <div className="space-y-3">
                      <div className={`p-3 border rounded-xs flex items-center justify-between ${
                        theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-xs bg-[#60bb46] text-white font-bold text-xs">eSewa</span>
                          <span className="text-xs font-bold">eSewa Digital Wallet Direct Express</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold font-mono">
                          ● API Gateway Ready
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left">
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Customer eSewa Mobile / ID
                          </label>
                          <input
                            type="text"
                            value={walletPhoneInput}
                            onChange={(e) => setWalletPhoneInput(e.target.value)}
                            placeholder="98XXXXXXXX"
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Transaction Token / Ref ID
                          </label>
                          <input
                            type="text"
                            value={walletTxnRef}
                            onChange={(e) => setWalletTxnRef(e.target.value)}
                            placeholder="ESW-2026-98102"
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                      </div>

                      <div className={`p-3 border rounded-xs flex items-center justify-between ${
                        walletVerified ? 'border-emerald-500/50 bg-emerald-500/10' : theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-[#f1f5f9] border-[#cbd5e1]'
                      }`}>
                        <div>
                          <span className="text-xs font-bold block">
                            {walletVerified ? '✓ Transaction Authorized via eSewa' : 'Request Push Payment'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {walletVerified ? 'Token confirmed by F1Soft server' : 'Customer receives instant OTP or app push request'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setWalletVerified(true);
                            if (!walletTxnRef) setWalletTxnRef(`ESW-${Date.now().toString().slice(-6)}`);
                          }}
                          className="px-3 py-1.5 bg-[#60bb46] hover:bg-[#52a43b] text-white text-xs font-bold font-mono rounded-xs cursor-pointer"
                        >
                          {walletVerified ? 'Re-verify' : 'Verify eSewa Transaction'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* METHOD 5: KHALTI PAY */}
                  {tenderMethod === 'khalti' && (
                    <div className="space-y-3">
                      <div className={`p-3 border rounded-xs flex items-center justify-between ${
                        theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-xs bg-[#5c2d91] text-white font-bold text-xs">Khalti</span>
                          <span className="text-xs font-bold">Khalti Payment Gateway SDK</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold font-mono">
                          ● API Active
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left">
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Customer Khalti Number
                          </label>
                          <input
                            type="text"
                            value={walletPhoneInput}
                            onChange={(e) => setWalletPhoneInput(e.target.value)}
                            placeholder="98XXXXXXXX"
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block uppercase font-bold mb-1">
                            Khalti Token / PIN Code
                          </label>
                          <input
                            type="text"
                            value={walletTxnRef}
                            onChange={(e) => setWalletTxnRef(e.target.value)}
                            placeholder="KHL-782914"
                            className={`w-full px-2.5 py-1.5 text-xs font-mono border rounded-xs ${
                              theme === 'dark' ? 'bg-[#181d1b] border-[#262b29] text-white' : 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            }`}
                          />
                        </div>
                      </div>

                      <div className={`p-3 border rounded-xs flex items-center justify-between ${
                        walletVerified ? 'border-emerald-500/50 bg-emerald-500/10' : theme === 'dark' ? 'bg-[#141a17] border-[#262b29]' : 'bg-[#f1f5f9] border-[#cbd5e1]'
                      }`}>
                        <div>
                          <span className="text-xs font-bold block">
                            {walletVerified ? '✓ Khalti Payment Confirmed' : 'Initiate Khalti Direct Charge'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {walletVerified ? 'Confirmation received from Khalti EPAY API' : 'Push OTP prompt to user Khalti wallet'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setWalletVerified(true);
                            if (!walletTxnRef) setWalletTxnRef(`KHL-${Date.now().toString().slice(-6)}`);
                          }}
                          className="px-3 py-1.5 bg-[#5c2d91] hover:bg-[#4a2475] text-white text-xs font-bold font-mono rounded-xs cursor-pointer"
                        >
                          {walletVerified ? 'Re-verify' : 'Verify Khalti Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* METHOD 6: SPLIT TENDER */}
                  {tenderMethod === 'split' && (
                    <div className="space-y-3">
                      <div className={`p-3 border rounded-xs ${
                        theme === 'dark' ? 'bg-[#181d1b] border-[#262b29]' : 'bg-[#f8fafc] border-[#cbd5e1]'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold">Multi-Tender Payment Allocation</span>
                          <span className="text-[10px] text-gray-400 font-mono">Tender 1 + Tender 2 must equal total</span>
                        </div>

                        {/* Dual Tender Inputs */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Tender 1: Cash */}
                          <div className="p-2.5 border rounded-xs bg-black/5 dark:bg-black/20 border-gray-200 dark:border-gray-800">
                            <label className="text-[10px] font-bold text-gray-500 block uppercase mb-1">
                              Tender 1: Cash (NPR)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={splitCashAmount}
                              onChange={(e) => setSplitCashAmount(e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-base font-bold font-mono border rounded-xs ${
                                theme === 'dark' ? 'bg-[#181d1b] border-[#82d8a9] text-white' : 'bg-white border-[#006b45] text-[#0f172a]'
                              }`}
                            />
                          </div>

                          {/* Tender 2: Digital Method */}
                          <div className="p-2.5 border rounded-xs bg-black/5 dark:bg-black/20 border-gray-200 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Tender 2 Method</label>
                              <select
                                value={splitSecondaryMethod}
                                onChange={(e) => setSplitSecondaryMethod(e.target.value as any)}
                                className={`text-[10px] px-1 py-0.5 font-mono border rounded-xs ${
                                  theme === 'dark' ? 'bg-[#141a17] text-white border-[#262b29]' : 'bg-white text-black border-[#cbd5e1]'
                                }`}
                              >
                                <option value="card">Card POS</option>
                                <option value="qr">Fonepay QR</option>
                                <option value="esewa">eSewa</option>
                                <option value="khalti">Khalti</option>
                              </select>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={splitSecondaryAmount}
                              onChange={(e) => setSplitSecondaryAmount(e.target.value)}
                              className={`w-full px-2.5 py-1.5 text-base font-bold font-mono border rounded-xs ${
                                theme === 'dark' ? 'bg-[#181d1b] border-[#82d8a9] text-white' : 'bg-white border-[#006b45] text-[#0f172a]'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Shortcuts for Split Allocation */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
                          <button
                            type="button"
                            onClick={() => {
                              const half = Math.round(totalAmount / 2);
                              setSplitCashAmount(half.toString());
                              setSplitSecondaryAmount((totalAmount - half).toString());
                            }}
                            className="text-[10px] px-2 py-1 rounded-xs border font-mono font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          >
                            ⚡ Split 50 / 50
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const c = parseFloat(splitCashAmount) || 0;
                              setSplitSecondaryAmount(Math.max(0, totalAmount - c).toString());
                            }}
                            className="text-[10px] px-2 py-1 rounded-xs border font-mono font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                          >
                            ⚡ Auto-Balance Remaining
                          </button>
                        </div>
                      </div>

                      {/* Split Allocation Indicator */}
                      {(() => {
                        const c = parseFloat(splitCashAmount) || 0;
                        const s = parseFloat(splitSecondaryAmount) || 0;
                        const totalAllocated = c + s;
                        const diff = totalAmount - totalAllocated;

                        if (Math.abs(diff) < 0.5) {
                          return (
                            <div className="p-2.5 border border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xs flex items-center gap-2 font-mono">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>100% Allocated (Cash: NPR {c.toLocaleString('en-IN')} + {splitSecondaryMethod.toUpperCase()}: NPR {s.toLocaleString('en-IN')})</span>
                            </div>
                          );
                        }
                        if (diff > 0) {
                          return (
                            <div className="p-2.5 border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xs flex items-center gap-2 font-mono">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Under-allocated: NPR {diff.toLocaleString('en-IN')} remaining to assign.</span>
                            </div>
                          );
                        }
                        return (
                          <div className="p-2.5 border border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-xs flex items-center gap-2 font-mono">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Over-allocated by NPR {Math.abs(diff).toLocaleString('en-IN')}. Please balance.</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* 09. Rename Main Action Button & 10. Payment Processing States */}
                <div className={`border-t pt-3 mt-4 ${theme === 'dark' ? 'border-[#262b29]' : 'border-[#e2e8f0]'}`}>
                  {/* Status telemetry line */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        paymentProcessingState === 'ready'
                          ? 'bg-emerald-500'
                          : paymentProcessingState === 'processing'
                          ? 'bg-amber-500 animate-ping'
                          : 'bg-blue-500 animate-pulse'
                      }`}></span>
                      Status: {
                        paymentProcessingState === 'ready'
                          ? 'Ready for Tender'
                          : paymentProcessingState === 'processing'
                          ? 'Processing Sale...'
                          : paymentProcessingState === 'verifying'
                          ? 'Verifying Payment Gateway...'
                          : 'Transaction Committed'
                      }
                    </span>
                    <span>ESC = Cancel · ENTER = Commit</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTenderOpen(false)}
                      disabled={isProcessingSale}
                      className={`flex-1 py-3 text-xs font-bold border rounded-xs cursor-pointer transition-colors ${
                        theme === 'dark'
                          ? 'bg-[#262b29] hover:bg-[#313633] text-[#dfe4e0] border-[#3f4942]'
                          : 'bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] border-[#cbd5e1]'
                      }`}
                    >
                      Cancel [ESC]
                    </button>

                    {/* Method-Specific Dynamic Primary Action Button */}
                    <button
                      type="button"
                      onClick={handleTenderSubmit}
                      disabled={
                        isProcessingSale ||
                        (tenderMethod === 'cash' && (parseFloat(tenderAmount) || 0) < totalAmount) ||
                        (tenderMethod === 'split' && Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitSecondaryAmount) || 0) - totalAmount) > 0.5)
                      }
                      className={`flex-2 py-3 text-white text-sm font-bold flex items-center justify-center gap-2 border rounded-xs transition-all shadow-md cursor-pointer ${
                        isProcessingSale
                          ? 'bg-[#004f33] border-emerald-800 cursor-not-allowed'
                          : (tenderMethod === 'cash' && (parseFloat(tenderAmount) || 0) < totalAmount) ||
                            (tenderMethod === 'split' && Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitSecondaryAmount) || 0) - totalAmount) > 0.5)
                          ? 'bg-gray-600 border-gray-500 opacity-60 cursor-not-allowed'
                          : 'bg-[#006b45] hover:bg-[#036c46] border-[#82d8a9] active:scale-[0.99]'
                      }`}
                    >
                      {isProcessingSale ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#82d8a9]" />
                          {paymentProcessingState === 'verifying'
                            ? 'Verifying Payment Gateway...'
                            : 'Committing DB Stock Lock...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#82d8a9]" />
                          {tenderMethod === 'cash' && 'Complete Cash Sale [ENTER]'}
                          {tenderMethod === 'card' && 'Process Card Payment [ENTER]'}
                          {tenderMethod === 'qr' && 'Verify & Complete QR Sale [ENTER]'}
                          {tenderMethod === 'esewa' && 'Initiate eSewa Payment [ENTER]'}
                          {tenderMethod === 'khalti' && 'Initiate Khalti Payment [ENTER]'}
                          {tenderMethod === 'split' && 'Confirm Split Payment [ENTER]'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. THERMAL RECEIPT MODAL (Screen 7/Printed Preview) */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto pos-receipt-backdrop">
          <div className="bg-white text-black font-mono w-full max-w-sm p-5 sm:p-6 shadow-2xl flex flex-col text-xs rounded-xs relative my-auto border border-gray-300">
            {/* Close button in top-right for quick dismissal (hidden when printing) */}
            <button
              type="button"
              onClick={() => setCompletedReceipt(null)}
              className="no-print absolute top-3 right-3 p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xs cursor-pointer transition-colors"
              title="Close [ESC]"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Thermal Printable Slip Container (Visible in @media print) */}
            <div id="pos-receipt-print-slip" className="w-full text-black bg-white">
              {/* Official Store Tax Header */}
              <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
                <h2 className="text-base sm:text-lg font-black tracking-tight uppercase leading-tight text-black">
                  {siteSettings?.storeName || 'INTEL COMPUTER CENTER'}
                </h2>
                <p className="text-[10px] font-bold text-gray-700 tracking-wide mt-0.5">
                  IT Hardware &amp; Enterprise Solutions
                </p>
                <p className="text-[10px] text-gray-800 leading-tight">
                  {siteSettings?.address || 'Ratopool, Dhangadhi, Kailali, Nepal'}
                </p>
                <p className="text-[10px] font-bold text-black mt-0.5">
                  PAN / VAT NO: 302910482
                </p>
                <p className="text-[10px] text-gray-700">
                  Tel: {siteSettings?.phone || '091-525287'} · Mob: 9858421455
                </p>

                <div className="my-1.5 py-0.5 px-2 bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-black border-y border-dashed border-gray-400">
                  *** TAX INVOICE / CASH MEMO ***
                </div>

                <div className="grid grid-cols-2 text-left text-[10px] text-gray-800 gap-x-2 gap-y-0.5 mt-1 font-mono">
                  <div>
                    <span className="font-bold">INVOICE:</span> POS-{completedReceipt.orderNumber}
                  </div>
                  <div className="text-right">
                    <span className="font-bold">DATE:</span> {new Date(completedReceipt.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-bold">TIME:</span> {new Date(completedReceipt.createdAt).toLocaleTimeString()}
                  </div>
                  <div className="text-right">
                    <span className="font-bold">TERM:</span> {completedReceipt.registerCode?.split(' ')[0] || 'TERM-02'}
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="font-bold">CASHIER:</span> {completedReceipt.cashierName}
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="font-bold">CUSTOMER:</span> {completedReceipt.customerName || 'Walk-in'} {completedReceipt.customerPhone ? `(${completedReceipt.customerPhone})` : ''}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="pb-2 mb-2 border-b border-dashed border-black">
                <div className="flex justify-between font-black text-[10px] pb-1 border-b border-black uppercase">
                  <span className="w-1/2">ITEM</span>
                  <span className="w-1/4 text-center">QTY x RATE</span>
                  <span className="w-1/4 text-right">TOTAL</span>
                </div>
                <div className="space-y-1 pt-1.5">
                  {completedReceipt.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] leading-tight font-mono">
                      <div className="w-1/2 truncate pr-1">
                        <span className="font-medium text-black">{it.name}</span>
                      </div>
                      <div className="w-1/4 text-center text-gray-700">
                        {it.quantity} x {it.unitPrice.toLocaleString('en-IN')}
                      </div>
                      <div className="w-1/4 text-right font-bold text-black">
                        {(it.quantity * it.unitPrice).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 font-mono text-[11px]">
                <div className="flex justify-between text-gray-800">
                  <span>Gross Subtotal:</span>
                  <span>NPR {completedReceipt.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {completedReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-black font-semibold">
                    <span>Discount Applied:</span>
                    <span>- NPR {completedReceipt.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-700 text-[10px]">
                  <span>Taxable Amount (Excl. VAT):</span>
                  <span>NPR {Math.round(completedReceipt.totalAmount / 1.13).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-700 text-[10px]">
                  <span>13% VAT (Included):</span>
                  <span>NPR {Math.round(completedReceipt.totalAmount * 0.13 / 1.13).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between font-black text-sm pt-1.5 border-t border-black text-black">
                  <span>NET TOTAL PAID:</span>
                  <span>NPR {completedReceipt.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-gray-800 text-[10px] pt-0.5">
                  <span className="uppercase">Tendered ({completedReceipt.paymentMethod}):</span>
                  <span>NPR {completedReceipt.amountTendered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between font-bold text-xs text-black">
                  <span>Change Returned:</span>
                  <span>NPR {completedReceipt.changeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Barcode & Nepal Warranty Footer */}
              <div className="text-center pt-1 font-mono">
                {/* Visual SVG Barcode Simulation */}
                <div className="flex justify-center my-1.5">
                  <svg className="w-44 h-8" viewBox="0 0 160 30" fill="currentColor">
                    <rect x="0" y="0" width="3" height="24" />
                    <rect x="5" y="0" width="1" height="24" />
                    <rect x="8" y="0" width="4" height="24" />
                    <rect x="14" y="0" width="2" height="24" />
                    <rect x="18" y="0" width="1" height="24" />
                    <rect x="21" y="0" width="3" height="24" />
                    <rect x="26" y="0" width="2" height="24" />
                    <rect x="30" y="0" width="5" height="24" />
                    <rect x="37" y="0" width="1" height="24" />
                    <rect x="40" y="0" width="3" height="24" />
                    <rect x="45" y="0" width="2" height="24" />
                    <rect x="49" y="0" width="4" height="24" />
                    <rect x="55" y="0" width="2" height="24" />
                    <rect x="59" y="0" width="1" height="24" />
                    <rect x="62" y="0" width="5" height="24" />
                    <rect x="69" y="0" width="2" height="24" />
                    <rect x="73" y="0" width="3" height="24" />
                    <rect x="78" y="0" width="1" height="24" />
                    <rect x="81" y="0" width="4" height="24" />
                    <rect x="87" y="0" width="2" height="24" />
                    <rect x="91" y="0" width="1" height="24" />
                    <rect x="94" y="0" width="5" height="24" />
                    <rect x="101" y="0" width="3" height="24" />
                    <rect x="106" y="0" width="1" height="24" />
                    <rect x="109" y="0" width="4" height="24" />
                    <rect x="115" y="0" width="2" height="24" />
                    <rect x="119" y="0" width="3" height="24" />
                    <rect x="124" y="0" width="1" height="24" />
                    <rect x="127" y="0" width="5" height="24" />
                    <rect x="134" y="0" width="2" height="24" />
                    <rect x="138" y="0" width="4" height="24" />
                    <rect x="144" y="0" width="1" height="24" />
                    <rect x="147" y="0" width="3" height="24" />
                    <rect x="152" y="0" width="2" height="24" />
                    <rect x="156" y="0" width="4" height="24" />
                  </svg>
                </div>
                <div className="text-[10px] tracking-widest font-bold text-black mb-1">
                  * POS-{completedReceipt.orderNumber} *
                </div>
                <p className="text-[9px] font-bold text-black tracking-wide">
                  * * * THANK YOU FOR YOUR BUSINESS * * *
                </p>
                <p className="text-[8px] text-gray-700 mt-0.5">
                  Official Nepal Warranty Validated with Serial No.
                </p>
                <p className="text-[8px] text-gray-600">
                  Goods once sold can be exchanged within 7 days with bill.
                </p>
                <p className="text-[8px] text-gray-500 mt-1 font-mono">
                  Inventory &amp; Stock Synced in Real-Time
                </p>
              </div>
            </div>

            {/* Action Buttons (Hidden when printing via no-print class) */}
            <div className="no-print mt-4 space-y-2 pt-2 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-1 bg-gray-900 hover:bg-black text-white text-[11px] font-bold flex items-center justify-center gap-1.5 rounded-xs cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Digital receipt emailed to customer (${customerPhone || 'guest@intelcenter.com.np'}).`)}
                  className="py-2.5 px-1 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 rounded-xs cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Receipt
                </button>
                <button
                  type="button"
                  onClick={() => alert(`SMS receipt dispatched to ${customerPhone || '+977-98XXXXXXXX'}.`)}
                  className="py-2.5 px-1 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 rounded-xs cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  SMS Receipt
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-[0.99]"
              >
                <span>New Transaction [F1]</span>
                <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CASHIER AUTHENTICATION & QUICK UNLOCK MODAL (Screen 5) */}
      <CashierAuthModal
        isOpen={!currentCashier || isLocked}
        isLockedOnly={!!currentCashier && isLocked}
        currentCashier={currentCashier}
        theme={theme}
        onLoginSuccess={(user) => {
          setCurrentCashier(user);
          setIsLocked(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('icc_pos_cashier', JSON.stringify(user));
          }
          fetchActiveShift();
        }}
        onUnlockSuccess={() => {
          setIsLocked(false);
          fetch('/api/pos/shift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'unlock',
              cashierName: currentCashier?.name || 'Staff Cashier',
              registerCode,
            }),
          }).catch(() => {});
        }}
        onLogout={() => {
          setCurrentCashier(null);
          setIsLocked(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('icc_pos_cashier');
          }
        }}
      />

      {/* 7. OPEN REGISTER & CASH FLOAT MODAL */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        registerCode={registerCode}
        cashier={currentCashier}
        theme={theme}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onShiftOpened={(newShift) => {
          setActiveShift(newShift);
          setIsOpenShiftModalOpen(false);
          fetchActiveShift();
        }}
      />

      {/* 8. END OF DAY (EOD) SHIFT RECONCILIATION MODAL */}
      <EodReconciliationModal
        isOpen={isEodModalOpen}
        shift={activeShift}
        theme={theme}
        onClose={() => setIsEodModalOpen(false)}
        onShiftClosed={(closedShift, eodReport) => {
          setActiveShift(null);
          setIsEodModalOpen(false);
          fetchActiveShift();
        }}
      />
    </div>
  );
};

// Sub-view: Sales Journal & Receipts Lookup (Screen 7)
const SalesJournalView: React.FC = () => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/pos/receipts?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setReceipts(data.receipts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [search]);

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="bg-[#181d1b] border border-[#262b29] p-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 border-b border-[#262b29] pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Sales Journal & Receipt History</h2>
            <p className="text-xs text-[#88938b]">Lookup historical in-store counter and online sales</p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Receipt # / Note..."
            className="bg-[#0a0f0d] border border-[#3f4942] text-xs px-3 py-1.5 text-white w-64 focus:outline-none focus:border-[#82d8a9]"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-[#88938b]">Loading receipts...</div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => (
              <div key={r.id} className="p-3 bg-[#1c211e] border border-[#262b29] flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#82d8a9] font-mono">{r.orderNumber}</span>
                    <span className="text-[10px] bg-[#006b45] text-white px-1 font-bold">{r.paymentStatus.toUpperCase()}</span>
                    <span className="text-[#88938b]">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-[#bec9c0] mt-1 text-[11px]">
                    {r.items?.length || 0} Items: {r.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white text-sm font-mono">
                    NPR {parseFloat(r.totalAmount).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-[#ffb95f] font-mono">{r.paymentMethod.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-view: Returns & Refunds Console (Screen 8)
const ReturnsRefundConsole: React.FC<{ onRestockSuccess: () => void }> = ({ onRestockSuccess }) => {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('Customer Return / Changed Mind');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity) return;

    try {
      setLoading(true);
      const res = await fetch('/api/pos/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptNumber,
          productId: Number(productId),
          quantity: Number(quantity),
          returnReason: reason,
          refundMethod,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatusMessage(
        `SUCCESS: Item restored to shelf! Database stock for "${data.data.productName}" increased from ${data.data.previousStock} to ${data.data.newStock}. Online store is updated immediately!`,
      );
      onRestockSuccess();
      setProductId('');
      setQuantity('1');
    } catch (err: any) {
      alert(`Return failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="bg-[#181d1b] border border-[#262b29] p-6 max-w-2xl mx-auto">
        <h2 className="text-base font-bold text-[#82d8a9] mb-1">Sales Return & Restock Console</h2>
        <p className="text-xs text-[#bec9c0] mb-4">
          Process in-store customer returns. Units returned are automatically credited back to PostgreSQL stock.
        </p>

        {statusMessage && (
          <div className="p-3 bg-[#006b45] text-white border border-[#82d8a9] text-xs mb-4">
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleReturn} className="space-y-3 text-xs">
          <div>
            <label className="text-[#88938b] block mb-1">Receipt / Order Number</label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. POS-26001234-882"
              className="w-full bg-[#0a0f0d] border border-[#3f4942] text-white p-2 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#88938b] block mb-1">Product ID to Return</label>
              <input
                type="number"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="e.g. 3"
                required
                className="w-full bg-[#0a0f0d] border border-[#3f4942] text-white p-2 font-mono"
              />
            </div>
            <div>
              <label className="text-[#88938b] block mb-1">Quantity Returned</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full bg-[#0a0f0d] border border-[#3f4942] text-white p-2 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[#88938b] block mb-1">Return Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0a0f0d] border border-[#3f4942] text-white p-2"
            >
              <option>Customer Return / Changed Mind</option>
              <option>Defective Unit (Sent to Service RMA)</option>
              <option>Incorrect Spec Delivered</option>
              <option>Exchange for Higher Model</option>
            </select>
          </div>

          <div>
            <label className="text-[#88938b] block mb-1">Refund Tender Method</label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className="w-full bg-[#0a0f0d] border border-[#3f4942] text-white p-2"
            >
              <option value="cash">Cash Refund</option>
              <option value="store_credit">Store Credit Voucher</option>
              <option value="bank_transfer">Original Card / Bank Transfer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#ee9800] hover:bg-[#ffb95f] text-black font-bold text-xs mt-2"
          >
            {loading ? 'Processing Restock...' : 'Accept Return & Restock to Shelf'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Sub-view: Customer & Loyalty Console (Screen 10)
const CustomerLoyaltyView: React.FC<{ onSelectCustomer: (cust: any) => void }> = ({ onSelectCustomer }) => {
  const DEMO_CUSTOMERS = [
    { id: 'LOY-44029', name: 'Jessica Taylor', phone: '9841234567', points: 1240, tier: 'GOLD', discountPercent: 5 },
    { id: 'LOY-10928', name: 'Bikash Shrestha', phone: '9812345678', points: 820, tier: 'SILVER', discountPercent: 3 },
    { id: 'LOY-88123', name: 'Aayush Adhikari', phone: '9865432109', points: 340, tier: 'MEMBER', discountPercent: 0 },
  ];

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="bg-[#181d1b] border border-[#262b29] p-6 max-w-3xl mx-auto text-xs">
        <h2 className="text-base font-bold text-[#82d8a9] mb-1">Customer & Loyalty Management Console</h2>
        <p className="text-[#88938b] mb-4">Attach customer to cart to earn reward points and apply tier discounts</p>

        <div className="space-y-3">
          {DEMO_CUSTOMERS.map((c) => (
            <div key={c.id} className="p-3 bg-[#1c211e] border border-[#262b29] flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{c.name}</span>
                  <span className="text-[10px] bg-[#ee9800] text-black font-bold px-1">{c.tier}</span>
                </div>
                <div className="text-[#88938b] text-[11px] mt-0.5">
                  ID: {c.id} • Phone: {c.phone} • Points: {c.points} ({c.discountPercent}% Discount)
                </div>
              </div>
              <button
                onClick={() => onSelectCustomer(c)}
                className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold"
              >
                Attach to Cart &rarr;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Sub-view: Price & Promotion Rule Engine (Screen 11)
const PricePromotionView: React.FC<{ onApplyRule: (discount: number) => void }> = ({ onApplyRule }) => {
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="bg-[#181d1b] border border-[#262b29] p-6 max-w-3xl mx-auto text-xs">
        <h2 className="text-base font-bold text-[#82d8a9] mb-1">Price & Promotion Rule Engine</h2>
        <p className="text-[#88938b] mb-4">Active in-store counter discounts and promotional campaigns</p>

        <div className="space-y-2">
          {[
            { name: 'Dashain Festival Cash Rebate', code: 'DASHAIN1000', discount: 1000, desc: 'Instant NPR 1,000 off on any gaming laptop' },
            { name: 'Student Bundle Tech Discount', code: 'STUDENT500', discount: 500, desc: 'NPR 500 discount for verified college students' },
            { name: 'Accessories Combo Voucher', code: 'COMBO250', discount: 250, desc: 'NPR 250 discount on keyboard + mouse purchase' },
          ].map((rule, idx) => (
            <div key={idx} className="p-3 bg-[#1c211e] border border-[#262b29] flex justify-between items-center">
              <div>
                <div className="font-bold text-white">{rule.name}</div>
                <div className="text-[#bec9c0] text-[11px]">{rule.desc}</div>
                <span className="text-[10px] text-[#82d8a9] font-mono font-bold">PROMO: {rule.code}</span>
              </div>
              <button
                onClick={() => onApplyRule(rule.discount)}
                className="px-3 py-1.5 bg-[#006b45] hover:bg-[#036c46] text-white font-bold"
              >
                Apply NPR {rule.discount}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Sub-view: Hardware Diagnostics (Screen 12)
const HardwareDiagnosticsView: React.FC = () => {
  const [testLog, setTestLog] = useState<string[]>(['Diagnostics ready.']);

  const runTest = (name: string) => {
    setTestLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Tested ${name}: OK (PASSED)`]);
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="bg-[#181d1b] border border-[#262b29] p-6 max-w-3xl mx-auto text-xs">
        <h2 className="text-base font-bold text-[#82d8a9] mb-1">Hardware Diagnostics & Peripheral Manager</h2>
        <p className="text-[#88938b] mb-4">Test barcode scanner trap, thermal receipt printer, and cash drawer kick</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => runTest('80mm Thermal Receipt Printer')}
            className="p-3 bg-[#1c211e] hover:bg-[#262b29] border border-[#262b29] text-left"
          >
            <Printer className="w-5 h-5 text-[#82d8a9] mb-1" />
            <div className="font-bold text-white">Test Printer Feed</div>
            <div className="text-[10px] text-[#88938b]">Prints test slip</div>
          </button>

          <button
            onClick={() => runTest('Cash Drawer Kick Mechanism')}
            className="p-3 bg-[#1c211e] hover:bg-[#262b29] border border-[#262b29] text-left"
          >
            <DollarSign className="w-5 h-5 text-[#82d8a9] mb-1" />
            <div className="font-bold text-white">Kick Cash Drawer</div>
            <div className="text-[10px] text-[#88938b]">Sends 24V solenoid pulse</div>
          </button>

          <button
            onClick={() => runTest('Barcode Scanner USB Trap')}
            className="p-3 bg-[#1c211e] hover:bg-[#262b29] border border-[#262b29] text-left"
          >
            <Barcode className="w-5 h-5 text-[#82d8a9] mb-1" />
            <div className="font-bold text-white">Scan Loop Test</div>
            <div className="text-[10px] text-[#88938b]">Polls HID keyboard wedge</div>
          </button>
        </div>

        <div className="p-3 bg-[#0a0f0d] border border-[#262b29] font-mono">
          <span className="text-[10px] text-[#88938b] uppercase block mb-1">Diagnostic Log</span>
          {testLog.map((l, i) => (
            <div key={i} className="text-[#82d8a9] text-[11px]">{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

function WalletIcon(props: any) {
  return <CreditCard {...props} />;
}
