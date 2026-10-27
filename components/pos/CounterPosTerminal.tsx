'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  CreditCard,
  Banknote,
  QrCode,
  Lock,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  RefreshCw,
  X,
  Package,
  Check,
  Sliders,
  Sun,
  Moon,
  Clock,
  Laptop,
  RotateCcw,
  Info,
  Tag,
  Layers,
  Wifi,
  WifiOff,
  Cloud,
  HelpCircle,
  Monitor,
  FolderInput,
  FolderOutput,
  Percent,
  LayoutDashboard,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  Bell,
  Menu,
  ChevronDown,
} from 'lucide-react';
import TerminalDualAuthGate, { StaffProfile } from './TerminalDualAuthGate';
import BodFloatInputModal from './BodFloatInputModal';
import SupervisorSignOffModal from './SupervisorSignOffModal';
import BlindEodCloseModal from './BlindEodCloseModal';
import LineVoidModal, { LineVoidTarget } from './LineVoidModal';
import SupervisorReturnModal from './SupervisorReturnModal';
import CashierDashboardView from './CashierDashboardView';
import CashierProductsView from './CashierProductsView';
import CashierCustomersView from './CashierCustomersView';
import CashierReportView from './CashierReportView';
import CashierSettingsView from './CashierSettingsView';
import { formatNpr, formatNepaliNumber } from '@/lib/nepal/money';
import { posIndexedDb, CatalogProduct } from '@/lib/pos/indexedDbCatalog';
import { catalogSearchIndex } from '@/lib/pos/searchIndex';

export type SidebarTab = 'dashboard' | 'sales' | 'products' | 'customers' | 'reports' | 'settings';

export type PosState =
  | 'LOCKED_TERMINAL'
  | 'CASHIER_LOGIN'
  | 'BOD_FLOAT_INPUT'
  | 'ACTIVE_BILLING'
  | 'SUPERVISOR_SIGNOFF_GATE'
  | 'BLIND_EOD_CLOSE';

export interface ProductItem {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  price: number;
  stockQuantity: number;
  stockStatus?: string;
  lowStockThreshold?: number;
  brandName?: string;
  categoryName?: string;
  categorySlug?: string;
  imageUrl?: string;
  isSerialized?: boolean;
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyText?: string;
}

export interface CartLine {
  productId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  discountPercent?: number;
  serialNumber?: string;
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyText?: string;
  imageUrl?: string | null;
}

interface ReceiptData {
  orderId: number;
  orderNumber: string;
  createdAt: string;
  items: CartLine[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  amountTendered: number;
  changeAmount: number;
  cashierName: string;
  registerCode: string;
  customerName?: string;
  customerPhone?: string;
  customerPan?: string;
  vatAmount?: number;
  taxableAmount?: number;
}

// -------------------------------------------------------------
// MEMOIZED HIGH-PERFORMANCE PRODUCT TILE COMPONENT
// Eliminates re-rendering the whole catalog when cart changes!
// -------------------------------------------------------------
interface ProductTileProps {
  product: ProductItem;
  theme: 'dark' | 'light';
  cartQty?: number;
  onAdd: (product: ProductItem) => void;
  onInfo: (product: ProductItem) => void;
}

const ProductTile = React.memo(function ProductTile({
  product,
  theme,
  cartQty = 0,
  onAdd,
  onInfo,
}: ProductTileProps) {
  const isOutOfStock = product.stockQuantity <= 0;
  const isLowStock = !isOutOfStock && product.stockQuantity <= (product.lowStockThreshold || 3);
  const formattedPrice = `Rs. ${formatNepaliNumber(String(product.price))}`;
  const isInCart = cartQty > 0;

  // Curated category visual icon fallback when imageUrl is null
  const categoryIcon = useMemo(() => {
    const name = (product.name || '').toLowerCase();
    const cat = (product.categoryName || '').toLowerCase();
    if (name.includes('macbook') || name.includes('laptop') || cat.includes('laptop')) return '💻';
    if (name.includes('monitor') || cat.includes('monitor')) return '🖥️';
    if (name.includes('printer') || cat.includes('printer')) return '🖨️';
    if (name.includes('switch') || name.includes('router') || name.includes('nvr') || cat.includes('network')) return '🌐';
    if (name.includes('geforce') || name.includes('rtx') || name.includes('graphics') || name.includes('gpu')) return '🎮';
    if (name.includes('ram') || name.includes('memory') || name.includes('corsair') || name.includes('motherboard') || name.includes('cooler')) return '⚡';
    if (name.includes('ups') || name.includes('power')) return '🔋';
    return '📦';
  }, [product.name, product.categoryName]);

  return (
    <div className="relative group flex flex-col justify-between">
      <div
        onClick={() => {
          if (!isOutOfStock) onAdd(product);
        }}
        className={`w-full h-full flex flex-col justify-between text-left p-3 rounded-2xl border transition ${
          isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'
        } ${
          isInCart
            ? theme === 'dark'
              ? 'bg-[#18231c] border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
              : 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
            : theme === 'dark'
            ? 'bg-[#141a17] border-slate-800 hover:border-emerald-500/50 hover:bg-[#1a231f]'
            : 'bg-white border-slate-200/80 hover:border-emerald-500 hover:shadow-md'
        }`}
      >
        <div>
          {/* Top Image Container (Matching SupaPOS Screenshot) */}
          <div className="relative w-full h-32 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden mb-2.5 p-2 border border-slate-100 dark:border-slate-800">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transition group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center select-none group-hover:scale-110 transition">
                <span className="text-4xl filter drop-shadow-sm">{categoryIcon}</span>
              </div>
            )}

            {/* SupaPOS Discount or Warranty Pill Badge */}
            {product.warrantyMonths && product.warrantyMonths > 0 ? (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[9px] shadow-xs">
                {product.warrantyMonths}M War.
              </span>
            ) : product.stockQuantity > 20 ? (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[9px] shadow-xs">
                Hot Deal
              </span>
            ) : null}

            {/* In Cart Active Quantity Badge */}
            {isInCart && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[9px] shadow-sm flex items-center gap-1">
                <Check className="h-2.5 w-2.5 stroke-[3]" /> {cartQty}×
              </span>
            )}

            {/* SupaPOS Floating Green Plus Button */}
            {!isOutOfStock && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(product);
                }}
                className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-[#00c569] hover:bg-emerald-400 text-white flex items-center justify-center shadow-md active:scale-90 transition opacity-90 group-hover:opacity-100"
                title="Add to order"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
              </button>
            )}
          </div>

          <h4
            className={`text-xs font-bold line-clamp-2 leading-snug ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            {product.name}
          </h4>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span
            className={`text-xs font-black font-mono tracking-tight ${
              theme === 'dark' ? 'text-white' : 'text-slate-950'
            }`}
          >
            {formattedPrice}
          </span>

          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border ${
              isOutOfStock
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400'
                : isLowStock
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                : 'bg-slate-100 text-slate-800 border-slate-200 font-bold dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {isOutOfStock ? 'OUT' : `Qty: ${product.stockQuantity}`}
          </span>
        </div>
      </div>

      {/* Info button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onInfo(product);
        }}
        className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition p-1 rounded-lg ${
          theme === 'dark'
            ? 'bg-slate-800 text-slate-400 hover:text-white'
            : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
        }`}
        title="Product details"
      >
        <Info className="h-3 w-3" />
      </button>
    </div>
  );
});

// -------------------------------------------------------------
// MAIN COUNTER POS TERMINAL
// -------------------------------------------------------------
export default function CounterPosTerminal() {
  const terminalCode = 'REG-01';
  const terminalName = 'Counter 1 - Main Checkout';

  // State Machine
  const [terminalState, setTerminalState] = useState<PosState>('LOCKED_TERMINAL');
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('sales');

  // Staff & Shift
  const [dutySupervisor, setDutySupervisor] = useState<StaffProfile | null>(null);
  const [activeCashier, setActiveCashier] = useState<StaffProfile | null>(null);
  const [activeShift, setActiveShift] = useState<any | null>(null);

  // Products & Cart
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscountAmount, setOrderDiscountAmount] = useState(0);
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48); // Virtualized initial slice

  // Accurate Nepal IRD 13% VAT & Subtotal calculations
  const cartGrossSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const lineDiscountsTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + Math.max(0, (item.price * item.quantity) - (item.lineTotal || 0)), 0);
  }, [cart]);

  const totalDiscountAmount = useMemo(() => {
    return lineDiscountsTotal + orderDiscountAmount;
  }, [lineDiscountsTotal, orderDiscountAmount]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartGrossSubtotal - totalDiscountAmount);
  }, [cartGrossSubtotal, totalDiscountAmount]);

  const cartTaxableAmount = useMemo(() => {
    return Number((cartTotal / 1.13).toFixed(2));
  }, [cartTotal]);

  const cartVatAmount = useMemo(() => {
    return Number((cartTotal - cartTaxableAmount).toFixed(2));
  }, [cartTotal, cartTaxableAmount]);

  const cartSubtotal = cartGrossSubtotal;

  // Held / Parked Carts (State & Persistence)
  const [heldCarts, setHeldCarts] = useState<Array<{ id: string; time: string; items: CartLine[] }>>([]);

  // Hardware & Network Status Icons
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // SupaPOS Live Header Timestamp
  const [liveHeaderTime, setLiveHeaderTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const timePart = now.toLocaleTimeString('en-GB');
      setLiveHeaderTime(`${datePart} • ${timePart}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Customer Selection Modal State
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [tempCustomerName, setTempCustomerName] = useState('Walk-in Customer');
  const [tempCustomerPhone, setTempCustomerPhone] = useState('');
  const [tempCustomerPan, setTempCustomerPan] = useState('');
  const [customerCreditLimit, setCustomerCreditLimit] = useState<number>(0);

  // Discount & Profit Margin Calculator State
  const [isDiscountCalcOpen, setIsDiscountCalcOpen] = useState(false);
  const [calcDiscountPctInput, setCalcDiscountPctInput] = useState<string>('0');
  const [calcDiscountFlatInput, setCalcDiscountFlatInput] = useState<string>('0');
  const [calcSupervisorPin, setCalcSupervisorPin] = useState<string>('');
  const [calcDiscountTargetItem, setCalcDiscountTargetItem] = useState<CartLine | null>(null);

  // Serial Number Modal State
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [serialTargetLine, setSerialTargetLine] = useState<CartLine | null>(null);
  const [serialInputNumber, setSerialInputNumber] = useState('');

  // Checkout & Payment Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<'cash' | 'card' | 'qr' | 'esewa' | 'khalti' | 'connectips' | 'split' | 'bank_transfer' | 'credit'>('cash');
  const [tenderAmount, setTenderAmount] = useState('');

  // Split Payment Allocation States
  const [splitCashAmount, setSplitCashAmount] = useState<string>('0');
  const [splitCardAmount, setSplitCardAmount] = useState<string>('0');
  const [splitQrAmount, setSplitQrAmount] = useState<string>('0');
  const [splitCardRef, setSplitCardRef] = useState<string>('');
  const [splitQrRef, setSplitQrRef] = useState<string>('');

  // Card EDC & Bank Transfer Verification States
  const [cardAuthCode, setCardAuthCode] = useState<string>('');
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'sct' | 'unionpay'>('visa');
  const [bankTransferRef, setBankTransferRef] = useState<string>('');
  const [isPaymentVerified, setIsPaymentVerified] = useState<boolean>(true);

  // Dynamic Cash Presets based on current cartTotal
  const dynamicCashPresets = useMemo(() => {
    if (!cartTotal || cartTotal <= 0) {
      return [100, 500, 1000, 2000, 5000];
    }

    const presets: number[] = [cartTotal];
    const roundUp = (val: number, step: number) => Math.ceil(val / step) * step;

    // Standard cash intervals tailored to cart total
    const candidates = [
      cartTotal < 500 ? roundUp(cartTotal, 50) : roundUp(cartTotal, 100),
      roundUp(cartTotal, 500),
      roundUp(cartTotal, 1000),
      roundUp(cartTotal, 2000),
      roundUp(cartTotal, 5000),
      roundUp(cartTotal, 10000),
      roundUp(cartTotal, 20000),
      roundUp(cartTotal, 50000),
    ];

    for (const cand of candidates) {
      if (cand > cartTotal && !presets.includes(cand)) {
        presets.push(cand);
      }
      if (presets.length >= 5) break;
    }

    // Fill remaining presets to always provide 5 intuitive note choices
    let currentMax = presets[presets.length - 1];
    while (presets.length < 5) {
      const step = currentMax >= 10000 ? 5000 : currentMax >= 2000 ? 1000 : 500;
      currentMax = roundUp(currentMax + step, step);
      if (!presets.includes(currentMax)) {
        presets.push(currentMax);
      }
    }

    return presets.slice(0, 5);
  }, [cartTotal]);

  // Dynamic Cash Note Click Function
  const handleNoteClick = (amt: number, idx: number) => {
    if (idx === 0 || amt === cartTotal) {
      // First preset is always exact cartTotal
      setTenderAmount(cartTotal.toString());
      return;
    }

    setTenderAmount((prev) => {
      const prevNum = parseFloat(prev || '0');
      // If empty, 0, NaN, or currently exact cart total, set note directly
      if (!prev || isNaN(prevNum) || prevNum === 0 || prevNum === cartTotal) {
        return amt.toString();
      }
      // If clicking the same note button again or adding notes under cartTotal, accumulate
      if (prevNum === amt || prevNum < cartTotal) {
        return (prevNum + amt).toString();
      }
      // If switching between presets when already >= cartTotal, select that preset
      return amt.toString();
    });
  };

  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPan, setCustomerPan] = useState('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);

  // Dynamic Bank & Wallet QR States
  const [availableBankQrs, setAvailableBankQrs] = useState<any[]>([]);
  const [selectedBankQr, setSelectedBankQr] = useState<any | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [qrRefNumber, setQrRefNumber] = useState('');
  const [isLoadingQrs, setIsLoadingQrs] = useState(false);

  // Modals for States 5 & 6
  const [isSignOffOpen, setIsSignOffOpen] = useState(false);
  const [isEodCloseOpen, setIsEodCloseOpen] = useState(false);

  // Cart mode: new sale vs return
  const [cartMode, setCartMode] = useState<'sale' | 'return'>('sale');
  const [returnInvoiceQuery, setReturnInvoiceQuery] = useState('');
  const [returnSearchResult, setReturnSearchResult] = useState<any | null>(null);
  const [returnSearchLoading, setReturnSearchLoading] = useState(false);
  const [returnSearchError, setReturnSearchError] = useState('');

  // Product detail popup
  const [detailProduct, setDetailProduct] = useState<ProductItem | null>(null);

  // Line Void & Cart Void authorization modal
  const [voidTarget, setVoidTarget] = useState<LineVoidTarget | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidNotice, setVoidNotice] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Return & Refund authorization modal
  const [isReturnAuthOpen, setIsReturnAuthOpen] = useState(false);
  const [completedReturnSlip, setCompletedReturnSlip] = useState<any | null>(null);

  // Keyboard Shortcuts Modal & Second Display Toggle
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false);

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  // Barcode input ref
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 1. Online / Offline network detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Real-Time Stock Broadcast via SSE
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource('/api/pos/stock-stream');

    es.addEventListener('stock_change', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === data.productId
              ? { ...p, stockQuantity: data.newStock, stockStatus: data.stockStatus }
              : p
          )
        );
      } catch {}
    });

    return () => {
      es.close();
    };
  }, []);

  // 3. Initial Session Check & Stale-While-Revalidate Catalog Load
  useEffect(() => {
    checkTerminalSession();
    loadCatalogWithSwr();

    // Load parked carts from local storage
    try {
      const stored = localStorage.getItem('icc_pos_parked_carts');
      if (stored) setHeldCarts(JSON.parse(stored));
    } catch {}
  }, []);

  // Fetch active bank QRs for POS when checkout opens
  useEffect(() => {
    if (isCheckoutOpen) {
      setIsLoadingQrs(true);
      fetch('/api/pos/qr-codes')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.qrCodes && data.qrCodes.length > 0) {
            setAvailableBankQrs(data.qrCodes);
            setSelectedBankQr((curr: any) => {
              if (curr) return curr;
              return data.qrCodes.find((q: any) => q.isDefault) || data.qrCodes[0];
            });
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingQrs(false));
    }
  }, [isCheckoutOpen]);

  // Generate dynamic QR code data URL whenever selected bank QR or cartTotal changes
  useEffect(() => {
    if (!selectedBankQr) return;
    if (selectedBankQr.qrImageUrl) {
      setGeneratedQrDataUrl(selectedBankQr.qrImageUrl);
      return;
    }
    const template =
      selectedBankQr.qrPayloadTemplate ||
      `fonepay://pay?merchant=${selectedBankQr.merchantCode || 'ICC'}&amount={amount}&remarks={orderId}`;
    const payload = template
      .replace('{amount}', String(cartTotal))
      .replace('{orderId}', `POS-${terminalCode}-${Date.now().toString().slice(-4)}`);

    QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setGeneratedQrDataUrl)
      .catch((err) => console.warn('QR generation error:', err));
  }, [selectedBankQr, cartTotal, terminalCode]);

  const checkTerminalSession = async () => {
    try {
      const res = await fetch(`/api/pos/terminal/streamlined?terminalCode=${terminalCode}&_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.activeShift && (data.activeShift.status === 'OPEN' || data.activeShift.status === 'PAUSED')) {
        setActiveShift(data.activeShift);
        setActiveCashier({
          id: String(data.activeShift.cashierId || 'cashier'),
          name: data.activeShift.cashierName || 'Cashier',
          staffCode: 'CASHIER',
          role: 'cashier',
        });
        setDutySupervisor({
          id: 'sup-active',
          name: data.activeShift.openedBySupervisorName || 'Duty Supervisor',
          staffCode: 'SUPERVISOR',
          role: 'supervisor',
        });

        if (data.terminal && data.terminal.isLocked) {
          setTerminalState('LOCKED_TERMINAL');
        } else {
          setTerminalState('ACTIVE_BILLING');
        }
      } else {
        setActiveShift(null);
        setTerminalState('LOCKED_TERMINAL');
      }
    } catch (e) {
      console.error('Session check failed:', e);
      setTerminalState('LOCKED_TERMINAL');
    }
  };

  /**
   * Stale-While-Revalidate Catalog Loading:
   * 1. Instant load from IndexedDB (<30ms).
   * 2. Background revalidation from /api/pos/products with Server-Timing.
   */
  const loadCatalogWithSwr = async () => {
    // Phase A: Fast load from IndexedDB
    try {
      const cached = await posIndexedDb.getAll();
      if (cached && cached.length > 0) {
        setProducts(cached);
        catalogSearchIndex.build(cached);
        setFilteredProducts(cached.slice(0, visibleCount));
      }
    } catch (e) {
      console.warn('IndexedDB initial read skipped:', e);
    }

    // Phase B: Network fetch & update
    setIsLoadingProducts(true);
    try {
      const res = await fetch('/api/pos/products?limit=250&meta=true');
      const data = await res.json();
      if (data.products && data.products.length > 0) {
        setProducts(data.products);
        catalogSearchIndex.build(data.products);
        setFilteredProducts(data.products.slice(0, visibleCount));
        posIndexedDb.putAll(data.products).catch(() => {});
      }
    } catch (e) {
      console.error('Network catalog fetch failed:', e);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 4. Instant In-Memory Filter by Search & Category (<5ms)
  useEffect(() => {
    const results = catalogSearchIndex.search(searchQuery, selectedCategory, 100);
    setFilteredProducts(results);
  }, [searchQuery, selectedCategory, products]);

  // 5. Global Keyboard Shortcuts & USB Barcode Trap
  useEffect(() => {
    let scanBuffer = '';
    let lastScanTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setTempCustomerName(customerName);
        setTempCustomerPhone(customerPhone);
        setTempCustomerPan(customerPan);
        setIsCustomerPickerOpen(true);
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setCalcDiscountTargetItem(null);
        setCalcDiscountPctInput(orderDiscountPercent ? String(orderDiscountPercent) : '0');
        setCalcDiscountFlatInput(orderDiscountAmount ? String(orderDiscountAmount) : '0');
        setIsDiscountCalcOpen(true);
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        handleHoldCart();
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        handleRecallCart();
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setCartMode((m) => (m === 'sale' ? 'return' : 'sale'));
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        handleLockTerminal();
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) {
          setTenderAmount(cartTotal.toString());
          setIsCheckoutOpen(true);
        }
        return;
      }

      // USB Barcode Scanner hardware listener (characters emitted within 35ms)
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      const now = Date.now();
      if (now - lastScanTime > 80) scanBuffer = '';
      lastScanTime = now;

      if (e.key === 'Enter') {
        if (scanBuffer.length >= 3) {
          const found = catalogSearchIndex.findByExactBarcode(scanBuffer);
          if (found) {
            addToCart(found);
            scanBuffer = '';
          }
        }
      } else if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, heldCarts]);

  // Cart Operations
  const addToCart = useCallback(
    (product: ProductItem) => {
      setCart((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          const newQty = existing.quantity + 1;
          const disc = existing.discountPercent || 0;
          return prev.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: newQty,
                  lineTotal: newQty * item.price * (1 - disc / 100),
                }
              : item
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: product.price,
            quantity: 1,
            lineTotal: product.price,
            warrantyMonths: product.warrantyMonths,
            warrantyType: product.warrantyType,
            warrantyText: product.warrantyText,
            imageUrl: product.imageUrl,
          },
        ];
      });

      // Reserve stock in background with Redis
      fetch('/api/pos/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          terminalCode,
        }),
      }).catch(() => {});
    },
    [terminalCode]
  );

  const updateCartQty = useCallback(
    (productId: number, qty: number) => {
      if (qty <= 0) {
        const line = cart.find((i) => i.productId === productId);
        if (line) {
          handleRequestLineVoid(line);
        } else {
          removeFromCart(productId);
        }
        return;
      }
      setCart((prev) =>
        prev.map((item) => {
          if (item.productId === productId) {
            const disc = item.discountPercent || 0;
            return {
              ...item,
              quantity: qty,
              lineTotal: qty * item.price * (1 - disc / 100),
            };
          }
          return item;
        })
      );
    },
    [cart]
  );

  const removeFromCart = useCallback(
    (productId: number) => {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      fetch('/api/pos/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, release: true, terminalCode }),
      }).catch(() => {});
    },
    [terminalCode]
  );

  const clearCart = useCallback(() => {
    for (const item of cart) {
      fetch('/api/pos/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: item.productId, release: true, terminalCode }),
      }).catch(() => {});
    }
    setCart([]);
  }, [cart, terminalCode]);

  // Park / Hold Cart (F5)
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString(),
      items: [...cart],
    };
    const updated = [newHold, ...heldCarts];
    setHeldCarts(updated);
    localStorage.setItem('icc_pos_parked_carts', JSON.stringify(updated));
    setCart([]);
    setVoidNotice({
      type: 'info',
      message: `Cart held successfully (${newHold.id} with ${newHold.items.length} lines). Press F6 to recall.`,
    });
  };

  // Recall Held Cart (F6)
  const handleRecallCart = () => {
    if (heldCarts.length === 0) {
      alert('No parked carts to recall.');
      return;
    }
    const [recalled, ...remaining] = heldCarts;
    setHeldCarts(remaining);
    localStorage.setItem('icc_pos_parked_carts', JSON.stringify(remaining));
    setCart(recalled.items);
    setVoidNotice({
      type: 'success',
      message: `Recalled parked cart ${recalled.id} (${recalled.items.length} items).`,
    });
  };

  // Line Void Request (Requires Supervisor)
  const handleRequestLineVoid = (line: CartLine) => {
    setVoidTarget({
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      price: line.price,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      isEntireCart: false,
    });
    setIsVoidModalOpen(true);
  };

  // Void Entire Cart Request (Requires Supervisor)
  const handleRequestVoidCart = () => {
    if (cart.length === 0) return;
    setVoidTarget({
      productId: 0,
      sku: 'ALL',
      name: `All ${cart.reduce((s, i) => s + i.quantity, 0)} items in current cart`,
      price: 0,
      quantity: cart.reduce((s, i) => s + i.quantity, 0),
      lineTotal: cartTotal,
      isEntireCart: true,
    });
    setIsVoidModalOpen(true);
  };

  const handleLineVoidApproved = (
    productId: number,
    reason: string,
    supervisorName: string,
    isEntireCart?: boolean
  ) => {
    if (isEntireCart) {
      clearCart();
      setVoidNotice({
        type: 'success',
        message: `Entire transaction voided (${reason}) • Authorized by ${supervisorName}`,
      });
    } else {
      const target = voidTarget;
      const itemName = target?.name || 'Item';
      removeFromCart(productId);
      setVoidNotice({
        type: 'success',
        message: `Line voided: ${itemName} (${reason}) • Authorized by ${supervisorName}`,
      });
    }

    setIsVoidModalOpen(false);
    setVoidTarget(null);
    setTimeout(() => setVoidNotice(null), 4500);
  };

  const handleReturnSuccess = (returnSlip: any) => {
    setCompletedReturnSlip(returnSlip);
    setIsReturnAuthOpen(false);
    setReturnSearchResult(null);
    setReturnInvoiceQuery('');
    setVoidNotice({
      type: 'success',
      message: `Return ${returnSlip.returnSlipNumber} (Rs. ${formatNepaliNumber(
        String(returnSlip.refundAmount)
      )}) authorized by ${returnSlip.authorizedBy}`,
    });
    setTimeout(() => setVoidNotice(null), 5000);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const matched = catalogSearchIndex.findByExactBarcode(searchQuery);
    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    } else {
      alert(`Barcode or SKU "${searchQuery}" not recognized.`);
    }
  };

  const handleDualAuthCompleted = (supervisor: StaffProfile, cashier: StaffProfile, existingShift?: any) => {
    setDutySupervisor(supervisor);
    setActiveCashier(cashier);
    const shift = existingShift || activeShift;
    if (shift && (shift.status === 'OPEN' || shift.status === 'PAUSED')) {
      setActiveShift(shift);
      setTerminalState('ACTIVE_BILLING');
    } else {
      setTerminalState('BOD_FLOAT_INPUT');
    }
  };

  const handleShiftStarted = (shift: any) => {
    setActiveShift(shift);
    setTerminalState('ACTIVE_BILLING');
  };

  const handleSignOffApproved = async () => {
    setIsSignOffOpen(false);
    setActiveShift(null);
    setActiveCashier(null);
    setDutySupervisor(null);
    setCart([]);
    setTerminalState('LOCKED_TERMINAL');
  };

  const handleEodCloseCompleted = async () => {
    setIsEodCloseOpen(false);
    setActiveShift(null);
    setActiveCashier(null);
    setDutySupervisor(null);
    setCart([]);
    setTerminalState('LOCKED_TERMINAL');
  };

  const handleLockTerminal = async () => {
    try {
      await fetch('/api/pos/terminal/streamlined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock_terminal', terminalCode }),
      });
    } catch {}
    setTerminalState('LOCKED_TERMINAL');
  };

  // Checkout Submission with Idempotency Key
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    let tendered = cartTotal;
    let change = 0;
    let finalAllocations: any[] = [];

    if (tenderMethod === 'cash') {
      const parsedTender = parseFloat(tenderAmount) || cartTotal;
      if (parsedTender < cartTotal) {
        alert(`Amount tendered (Rs. ${formatNepaliNumber(String(parsedTender))}) cannot be less than Total.`);
        return;
      }
      tendered = parsedTender;
      change = Math.max(0, parsedTender - cartTotal);
      finalAllocations = [{ method: 'cash', amount: cartTotal }];
    } else if (tenderMethod === 'split') {
      const cAmt = parseFloat(splitCashAmount) || 0;
      const cardAmt = parseFloat(splitCardAmount) || 0;
      const qAmt = parseFloat(splitQrAmount) || 0;
      const splitSum = cAmt + cardAmt + qAmt;

      if (splitSum < cartTotal) {
        alert(`Split allocations total (NPR ${formatNepaliNumber(String(splitSum))}) is less than total due (NPR ${formatNepaliNumber(String(cartTotal))}).`);
        return;
      }

      if (cAmt > 0) finalAllocations.push({ method: 'cash', amount: cAmt });
      if (cardAmt > 0) finalAllocations.push({ method: 'card', amount: cardAmt, reference: splitCardRef });
      if (qAmt > 0) finalAllocations.push({ method: 'qr', amount: qAmt, reference: splitQrRef });

      tendered = splitSum;
      change = Math.max(0, splitSum - cartTotal);
    } else if (tenderMethod === 'card') {
      finalAllocations = [{ method: 'card', amount: cartTotal, reference: cardAuthCode }];
    } else if (tenderMethod === 'qr') {
      finalAllocations = [{ method: 'qr', amount: cartTotal, reference: qrRefNumber, verified: isPaymentVerified }];
    } else if (tenderMethod === 'bank_transfer') {
      finalAllocations = [{ method: 'bank_transfer', amount: cartTotal, reference: bankTransferRef }];
    } else if (tenderMethod === 'credit') {
      if (!customerPhone && !customerPan) {
        alert('Authorized credit sales require an identified customer with mobile phone or PAN.');
        return;
      }
      finalAllocations = [{ method: 'credit', amount: cartTotal }];
    }

    const idempotencyKey = `pos_${terminalCode}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setIsSubmittingSale(true);
    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.productId,
            sku: i.sku,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            price: i.price,
            lineTotal: i.lineTotal ?? i.price * i.quantity,
            costPrice: (i as any).costPrice,
            warrantyMonths: i.warrantyMonths,
            warrantyType: i.warrantyType,
            warrantyText: i.warrantyText,
            serialNumber: i.serialNumber,
          })),
          paymentMethod: tenderMethod,
          amountTendered: tendered,
          changeAmount: change,
          discountAmount: totalDiscountAmount,
          customerName,
          customerPhone,
          customerPan,
          cashierName: activeCashier?.name || 'Cashier 1',
          cashierId: activeCashier?.id ? parseInt(activeCashier.id, 10) : null,
          registerCode: terminalCode,
          shiftId: activeShift?.id || null,
          idempotencyKey,
          qrProvider: tenderMethod === 'qr' ? selectedBankQr?.bankName : undefined,
          qrReference: tenderMethod === 'qr' ? qrRefNumber : undefined,
          bankAccountId: tenderMethod === 'qr' ? selectedBankQr?.chartAccountId : undefined,
          allocations: finalAllocations,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sale processing failed.');
      }

      setCompletedReceipt(data.receipt);
      setCart([]);
      setOrderDiscountAmount(0);
      setOrderDiscountPercent(0);
      setSplitCashAmount('0');
      setSplitCardAmount('0');
      setSplitQrAmount('0');
      setCardAuthCode('');
      setBankTransferRef('');
      setIsCheckoutOpen(false);
    } catch (err: any) {
      alert(`Checkout Error: ${err.message}`);
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Dedicated thermal receipt printer handler (Double Slip: Customer + Office)
  const handlePrintReceipt = useCallback(() => {
    if (!completedReceipt) return;
    const slip = document.getElementById('pos-receipt-print-slip');
    const contentHtml = slip ? slip.innerHTML : '';

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt-${completedReceipt.orderNumber}</title>
  <style>
    @page {
      size: auto;
      margin: 8mm auto;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 auto;
      padding: 0;
      background: #ffffff;
      color: #000000;
      width: 100%;
      min-height: 100%;
      font-family: 'Courier New', Courier, monospace, system-ui, sans-serif;
      font-size: 11px;
      line-height: 1.25;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    .receipt-print-wrapper {
      width: 80mm;
      max-width: 80mm;
      margin: 8mm auto;
      padding: 6mm 6mm 12mm 6mm;
      background: #ffffff;
      border: 1px dashed #555555;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .slip {
      width: 100%;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cut-divider {
      margin: 16px 0;
      text-align: center;
      border-top: 1px dashed #444;
      position: relative;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cut-badge {
      position: relative;
      top: -9px;
      background: #ffffff;
      padding: 0 6px;
      font-size: 9px;
      font-weight: bold;
      color: #333333;
    }
    .badge-warranty {
      display: inline-block;
      background: #ecfdf5;
      border: 1px solid #059669;
      color: #065f46;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 2px;
    }
    .border-b { border-bottom: 1px dashed #444; }
    .border-t { border-top: 1px dashed #444; }
    .border-dashed { border-style: dashed; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .gap-1 { gap: 4px; }
    .gap-2 { gap: 6px; }
    .space-y-1 > * + * { margin-top: 4px; }
    .space-y-1\\.5 > * + * { margin-top: 6px; }
    .space-y-2 > * + * { margin-top: 8px; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: 1fr 1fr; }
    .my-1\\.5 { margin-top: 6px; margin-bottom: 6px; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 6px; }
    .mb-3 { margin-bottom: 10px; }
    .pb-1\\.5 { padding-bottom: 6px; }
    .pb-2 { padding-bottom: 8px; }
    .pb-3 { padding-bottom: 12px; }
    .pt-1 { padding-top: 4px; }
    .mt-0\\.5 { margin-top: 2px; }
    .mt-1 { margin-top: 4px; }
    .mt-2 { margin-top: 8px; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-base { font-size: 14px; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-\\[9px\\] { font-size: 9px; }
    .text-\\[8px\\] { font-size: 8px; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-slate-900 { background-color: #0f172a; }
    .text-white { color: #ffffff; }
    .text-slate-900 { color: #000000; }
    .text-slate-600 { color: #444444; }
    .text-slate-500 { color: #666666; }
    .text-slate-400 { color: #888888; }
    @media print {
      @page {
        size: auto;
        margin: 8mm auto;
      }
      html, body {
        width: 100% !important;
        margin: 0 auto !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        background: #ffffff !important;
      }
      .receipt-print-wrapper {
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 6mm auto !important;
        padding: 6mm 6mm 10mm 6mm !important;
        border: 1px dashed #555555 !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-print-wrapper">
    ${contentHtml}
  </div>
</body>
</html>`;

    // Strategy 1: Dedicated popup print window (Direct DOM render, zero clipping)
    try {
      const printWin = window.open('', '_blank', 'width=460,height=800,menubar=no,toolbar=no,location=no,status=no');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
        }, 350);
        return;
      }
    } catch (e) {
      console.warn('Popup blocked, using iframe fallback:', e);
    }

    // Strategy 2: In-DOM iframe with actual dimensions and opacity to force browser layout
    try {
      let iframe = document.getElementById('receipt-print-iframe') as HTMLIFrameElement | null;
      if (iframe) iframe.remove();
      iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.bottom = '10px';
      iframe.style.right = '10px';
      iframe.style.width = '320px';
      iframe.style.height = '400px';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        setTimeout(() => {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        }, 400);
        return;
      }
    } catch (e) {
      console.error('Iframe fallback error:', e);
    }

    // Strategy 3: Direct browser print
    window.print();
  }, [completedReceipt]);

  // -------------------------------------------------------------
  // RENDER: STATE 1 & 2 (Terminal Locked & Cashier Login Gate)
  // -------------------------------------------------------------
  if (terminalState === 'LOCKED_TERMINAL' || terminalState === 'CASHIER_LOGIN') {
    return (
      <TerminalDualAuthGate
        terminalName={terminalName}
        terminalCode={terminalCode}
        activeShift={activeShift}
        activeCashier={activeCashier}
        dutySupervisor={dutySupervisor}
        onAuthCompleted={handleDualAuthCompleted}
      />
    );
  }

  // -------------------------------------------------------------
  // RENDER: STATE 3 (BOD Float Entry Modal)
  // -------------------------------------------------------------
  if (terminalState === 'BOD_FLOAT_INPUT') {
    return (
      <div className="pos-portal min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <BodFloatInputModal
          isOpen={true}
          terminalCode={terminalCode}
          supervisor={dutySupervisor}
          cashier={activeCashier}
          onShiftStarted={handleShiftStarted}
          onCancel={handleLockTerminal}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: STATE 4 (Active Retail Billing Workspace)
  // -------------------------------------------------------------
  return (
    <div className="pos-portal flex h-screen max-h-screen w-full overflow-hidden font-sans select-none bg-[#f4f7f6] text-slate-900">
      {/* 1. SupaPOS Left Dark Emerald Navigation Sidebar */}
      <aside className="w-56 lg:w-60 shrink-0 bg-[#064e3b] text-white flex flex-col justify-between p-4 z-30 select-none shadow-xl border-r border-emerald-950">
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
              <Layers className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-white">SupaPOS</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] font-semibold text-emerald-200/70">ICC Electronics</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
              { id: 'sales' as const, label: 'Sales', icon: ShoppingBag },
              { id: 'products' as const, label: 'Products', icon: Package },
              { id: 'customers' as const, label: 'Customers', icon: Users },
              { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
              { id: 'settings' as const, label: 'Settings', icon: Settings },
            ].map((item) => {
              const isActive = activeSidebarTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSidebarTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition select-none ${
                    isActive
                      ? 'bg-[#00c569] text-white shadow-md font-black'
                      : 'text-white hover:bg-emerald-800/60 hover:text-emerald-100'
                  }`}
                  title={item.label}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-emerald-300'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Help & Support Card */}
        <div className="bg-[#033d2f] rounded-2xl p-3.5 border border-emerald-800/60 text-white space-y-2.5 shadow-sm">
          <div className="space-y-0.5">
            <h5 className="text-xs font-black text-white">Need help?</h5>
            <p className="text-[11px] text-emerald-200/90 leading-relaxed font-medium">
              Contact our support team for assistance
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-900 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <HelpCircle className="h-4 w-4 text-emerald-700" />
            <span>Contact Support</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#f4f7f6]">
        {/* SupaPOS Top Header */}
        <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-2xs">
          {/* Left: Menu & Greeting */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              title="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-black text-slate-800 tracking-tight">
                Welcome back!
              </h2>
              <p className="text-[10px] font-bold text-slate-400">
                {terminalName} ({terminalCode}) • Station #104
              </p>
            </div>
          </div>

          {/* Center: Live Date & Time Clock matching SupaPOS */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 font-mono shadow-2xs">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            <span>{liveHeaderTime || 'Wednesday, July 2, 2025 • 15:55:16'}</span>
          </div>

          {/* Right: Operational Status, Cashier & Controls */}
          <div className="flex items-center gap-2.5">
            {/* Online Status Dot */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${
                isOnline
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
              title={isOnline ? 'Online (LAN & Cloud Connected)' : 'Offline (Local Buffered Mode)'}
            >
              {isOnline ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#00c569] animate-pulse" />
                  <span className="text-[11px]">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-rose-500" />
                  <span className="text-[11px]">Offline</span>
                </>
              )}
            </div>

            {/* Thermal Printer Status */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600"
              title="Thermal POS Receipt Printer Ready"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-bold">Printer: Ready</span>
            </div>

            {/* Customer Second Display Toggle */}
            <button
              onClick={() => setShowCustomerDisplay((prev) => !prev)}
              className={`p-2 rounded-full border transition ${
                showCustomerDisplay
                  ? 'border-slate-800 bg-slate-100 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
              }`}
              title="Toggle Customer Facing Second Display"
            >
              <Monitor className="h-4 w-4" />
            </button>

            {/* Notification Bell with Red Dot */}
            <div
              className="relative p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-2xs"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </div>

            {/* Cashier / Store Manager Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                {activeCashier?.name
                  ? activeCashier.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : 'JD'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-black text-slate-800 leading-none">
                  {activeCashier?.name || 'James Davidson'}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  {dutySupervisor ? 'Store Manager' : 'Cashier'}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Quick Actions (F10 Lock, Sign-off, EOD) */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <button
                onClick={handleLockTerminal}
                className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition border border-transparent hover:border-amber-200"
                title="Lock Terminal [F10]"
              >
                <Lock className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsSignOffOpen(true)}
                className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold shadow-2xs transition"
                title="Supervisor Authorization Required"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                <span>Switch</span>
              </button>
              <button
                onClick={() => setIsEodCloseOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 text-[11px] font-bold shadow-2xs transition"
                title="Close Register (End of Day)"
              >
                <Banknote className="h-3.5 w-3.5 text-rose-600" />
                <span>EOD</span>
              </button>
            </div>
          </div>
        </header>

        {/* 3. Split Main Workspace (Catalog on Left, Cart on Right) */}
        {activeSidebarTab === 'sales' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left / Center Column: SupaPOS Sales Transaction Catalog */}
        <section className="flex-1 flex flex-col min-h-0 bg-[#f8faf9] overflow-hidden border-r border-slate-200">
          {/* Header & Filter Bar */}
          <div className="px-6 pt-5 pb-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Sales Transaction</h1>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: '2-digit',
                    year: 'numeric',
                  })}{' '}
                  - {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
              </div>

              {/* Search Bar with USB Barcode listener trap */}
              <form onSubmit={handleBarcodeSubmit} className="relative w-full sm:w-72 md:w-80">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products... [F2]"
                  className="w-full pl-9 pr-4 py-2 rounded-full border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 font-semibold shadow-2xs outline-none focus:border-[#00c569] focus:ring-2 focus:ring-emerald-500/20 transition"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </form>
            </div>

            {/* Category Filter Pills (matching SupaPOS screenshot) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'ALL', label: 'All Products' },
                { id: 'Laptops', label: 'Laptops' },
                { id: 'Desktops', label: 'Desktops' },
                { id: 'Accessories', label: 'Accessories' },
                { id: 'Components', label: 'Components' },
                { id: 'Printers', label: 'Printers' },
              ].map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? 'bg-[#00c569] text-white shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Items Grid (Retail Inventory Items Only) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {isLoadingProducts && products.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#00c569]" />
                Loading inventory items...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-slate-500">
                No matching retail products found.
              </div>
            ) : (
              filteredProducts.slice(0, visibleCount).map((p) => {
                const inCartItem = cart.find((i) => i.productId === p.id);
                return (
                  <ProductTile
                    key={p.id}
                    product={p}
                    theme={theme}
                    cartQty={inCartItem?.quantity || 0}
                    onAdd={addToCart}
                    onInfo={(prod) => setDetailProduct(prod)}
                  />
                );
              })
            )}

            {filteredProducts.length > visibleCount && (
              <div className="col-span-full py-4 text-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 48)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                >
                  Load More Products ({filteredProducts.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>

          {/* Product Detail Popup */}
          {detailProduct && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setDetailProduct(null)}
            >
              <div
                className={`w-full max-w-sm rounded-2xl border shadow-2xl p-5 space-y-4 ${
                  theme === 'dark' ? 'bg-[#141a17] border-slate-700' : 'bg-white border-slate-200'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-mono font-bold text-emerald-400">
                      {detailProduct.sku}
                    </span>
                    <h3 className="text-sm font-black mt-0.5 leading-tight">{detailProduct.name}</h3>
                  </div>
                  <button
                    onClick={() => setDetailProduct(null)}
                    className="p-1 rounded-lg hover:bg-slate-700 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-3 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Sale Price
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-400">
                      Rs. {formatNepaliNumber(String(detailProduct.price))}
                    </span>
                  </div>
                  <div className={`rounded-xl p-3 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Stock</span>
                    <span
                      className={`text-lg font-black ${
                        detailProduct.stockQuantity === 0
                          ? 'text-rose-400'
                          : detailProduct.stockQuantity <= 3
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {detailProduct.stockQuantity} pcs
                    </span>
                  </div>
                  {detailProduct.brandName && (
                    <div
                      className={`rounded-xl p-3 flex items-center gap-2 ${
                        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">Brand</span>
                        <span className="text-xs font-bold">{detailProduct.brandName}</span>
                      </div>
                    </div>
                  )}
                  {detailProduct.categoryName && (
                    <div
                      className={`rounded-xl p-3 flex items-center gap-2 ${
                        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-slate-500">
                          Category
                        </span>
                        <span className="text-xs font-bold">{detailProduct.categoryName}</span>
                      </div>
                    </div>
                  )}
                </div>
                {detailProduct.barcode && (
                  <div className={`rounded-xl p-3 ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Barcode</span>
                    <p className="font-mono text-xs font-bold mt-0.5">{detailProduct.barcode}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    addToCart(detailProduct);
                    setDetailProduct(null);
                  }}
                  disabled={detailProduct.stockQuantity === 0}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition disabled:opacity-40"
                >
                  {detailProduct.stockQuantity === 0 ? 'Out of Stock' : '+ Add to Cart'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Checkout Cart & Tenders (40% width) */}
        {/* Right Column: SupaPOS Order Detail Cart (matching SupaPOS screenshot) */}
        <section className="w-80 lg:w-[380px] bg-white flex flex-col h-full min-h-0 overflow-hidden shrink-0 shadow-lg border-l border-slate-200">
          {/* Header: Order Detail Title & Actions */}
          <div className="p-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-slate-800 tracking-tight">Order Detail</h3>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={handleHoldCart}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
                    title="Hold Cart [F5]"
                  >
                    <FolderInput className="h-3 w-3" /> Hold
                  </button>
                )}
                {heldCarts.length > 0 && (
                  <button
                    onClick={handleRecallCart}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                    title="Recall Cart [F6]"
                  >
                    <FolderOutput className="h-3 w-3" /> Recall ({heldCarts.length})
                  </button>
                )}
                {cart.length > 0 && (
                  <button
                    onClick={handleRequestVoidCart}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-0.5"
                    title="Void Entire Cart"
                  >
                    <Trash2 className="h-3 w-3" /> Void
                  </button>
                )}
              </div>
            </div>

            {/* Mode Switcher: New Sale vs Return */}
            <div className="flex gap-1.5 mb-3">
              <button
                onClick={() => {
                  setCartMode('sale');
                  setReturnSearchResult(null);
                  setReturnSearchError('');
                }}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 ${
                  cartMode === 'sale'
                    ? 'bg-[#00c569] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Sale
              </button>
              <button
                onClick={() => setCartMode('return')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 ${
                  cartMode === 'return'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Return [F7]
              </button>
            </div>

            {/* Customer Selector (matching SupaPOS dropdown UI) */}
            {cartMode === 'sale' && (
              <div
                onClick={() => {
                  setTempCustomerName(customerName);
                  setTempCustomerPhone(customerPhone);
                  setTempCustomerPan(customerPan);
                  setIsCustomerPickerOpen(true);
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="h-4 w-4 text-[#00c569] shrink-0" />
                  <span className="text-xs font-bold text-slate-700 truncate">
                    {customerName || 'Select Customer'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              </div>
            )}

            {/* Line Void Feedback Banner */}
            {voidNotice && (
              <div className="mb-2 p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{voidNotice.message}</span>
                </div>
                <button
                  onClick={() => setVoidNotice(null)}
                  className="text-slate-400 hover:text-white ml-2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List OR Return Panel */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {cartMode === 'return' ? (
              /* ---- RETURN / REFUND PANEL ---- */
              <div className="space-y-3">
                <div
                  className={`rounded-xl border p-3 ${
                    theme === 'dark' ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-300'
                  }`}
                >
                  <p
                    className={`text-[10px] font-black uppercase tracking-wider mb-2 ${
                      theme === 'dark' ? 'text-amber-300' : 'text-amber-800'
                    }`}
                  >
                    <RotateCcw className="inline h-3 w-3 mr-1" />
                    Invoice / Receipt Return
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={returnInvoiceQuery}
                      onChange={(e) => setReturnInvoiceQuery(e.target.value)}
                      placeholder="Enter Invoice # or Order ID..."
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-mono outline-none ${
                        theme === 'dark'
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                      }`}
                    />
                    <button
                      onClick={async () => {
                        if (!returnInvoiceQuery.trim()) return;
                        setReturnSearchLoading(true);
                        setReturnSearchError('');
                        setReturnSearchResult(null);
                        try {
                          const res = await fetch(
                            `/api/pos/receipts?orderNumber=${encodeURIComponent(returnInvoiceQuery.trim())}`
                          );
                          const data = await res.json();
                          if (data.order) setReturnSearchResult(data.order);
                          else setReturnSearchError(data.error || 'Invoice not found.');
                        } catch {
                          setReturnSearchError('Network error. Please try again.');
                        } finally {
                          setReturnSearchLoading(false);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1 hover:bg-amber-400 transition"
                    >
                      {returnSearchLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {returnSearchError && (
                    <p className="mt-2 text-[11px] font-bold text-rose-400">{returnSearchError}</p>
                  )}
                </div>

                {returnSearchResult && (
                  <div
                    className={`rounded-xl border p-3 space-y-2 ${
                      theme === 'dark' ? 'bg-[#171f1b] border-slate-700' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Invoice Found
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {returnSearchResult.orderNumber}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] space-y-1 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>Date</span>
                        <span className="font-mono">
                          {new Date(returnSearchResult.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Paid</span>
                        <span className="font-black font-mono">
                          Rs. {formatNepaliNumber(String(returnSearchResult.totalAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment</span>
                        <span className="uppercase font-bold">{returnSearchResult.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-700 pt-2 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Items Sold:</p>
                      {(returnSearchResult.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="truncate max-w-[200px]">
                            {it.name} × {it.quantity}
                          </span>
                          <span className="font-mono font-bold">
                            Rs. {formatNepaliNumber(String(it.lineTotal || it.unitPrice * it.quantity))}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setIsReturnAuthOpen(true)}
                      className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Authorize Return & Issue Refund Slip
                    </button>
                  </div>
                )}
              </div>
            ) : cart.length === 0 ? (
              /* ---- EMPTY CART STATE ---- */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <ShoppingCart className="h-7 w-7 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">Cart is empty</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Scan barcode [F2] or click any product to add items.
                </p>
              </div>
            ) : (
              /* ---- SUPAPOS MODERN CART LINE ITEMS ---- */
              cart.map((line) => {
                const categoryIcon = line.name.toLowerCase().includes('laptop') || line.name.toLowerCase().includes('macbook')
                  ? '💻'
                  : line.name.toLowerCase().includes('monitor')
                  ? '🖥️'
                  : line.name.toLowerCase().includes('printer')
                  ? '🖨️'
                  : line.name.toLowerCase().includes('gpu') || line.name.toLowerCase().includes('rtx')
                  ? '🎮'
                  : '📦';

                return (
                  <div
                    key={line.productId}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border border-slate-150 hover:border-slate-300 bg-white hover:bg-slate-50/50 transition shadow-2xs"
                  >
                    {/* Left: Product Thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.name}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <span className="text-xl">{categoryIcon}</span>
                      )}
                    </div>

                    {/* Center: Title & Price */}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-slate-800 truncate leading-snug">
                        {line.name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-black font-mono text-slate-900">
                          Rs. {formatNepaliNumber(String(line.price))}
                        </span>
                        {line.serialNumber ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSerialTargetLine(line);
                              setSerialInputNumber(line.serialNumber || '');
                              setIsSerialModalOpen(true);
                            }}
                            className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100"
                            title="Edit Serial Number"
                          >
                            S/N: {line.serialNumber}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSerialTargetLine(line);
                              setSerialInputNumber('');
                              setIsSerialModalOpen(true);
                            }}
                            className="text-[9px] px-1.5 py-0.2 rounded border border-dashed border-slate-300 text-slate-400 hover:text-[#00c569] hover:border-emerald-400 font-semibold"
                          >
                            + S/N
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Stepper Controls & Red Trash Icon */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (line.quantity <= 1) {
                            handleRequestLineVoid(line);
                          } else {
                            updateCartQty(line.productId, line.quantity - 1);
                          }
                        }}
                        className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition"
                        title="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-xs text-slate-800">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(line.productId, line.quantity + 1)}
                        className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition"
                        title="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestLineVoid(line)}
                        className="h-6 w-6 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition ml-1"
                        title="Remove Item (Requires Auth if configured)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Sticky Checkout Controls (matching SupaPOS screenshot) */}
          <div className="p-4 border-t border-slate-200 shrink-0 bg-white space-y-3 mt-auto">
            {cartMode === 'sale' ? (
              <>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold text-slate-700">
                      NPR {formatNepaliNumber(cartGrossSubtotal.toFixed(2))}
                    </span>
                  </div>

                  {totalDiscountAmount > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span className="flex items-center gap-1">Discount:</span>
                      <span className="font-mono">-NPR {formatNepaliNumber(totalDiscountAmount.toFixed(2))}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Tax (13% VAT)</span>
                    <span className="font-mono font-bold text-slate-700">
                      NPR {formatNepaliNumber(cartVatAmount.toFixed(2))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="font-black text-sm text-slate-800">Total</span>
                    {/* Bright Green SupaPOS Total Accent */}
                    <span className="font-black text-2xl font-mono text-[#00c569]">
                      NPR {formatNepaliNumber(cartTotal.toFixed(2))}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector (matching SupaPOS screenshot) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Payment Method
                  </label>
                  <select
                    value={tenderMethod}
                    onChange={(e) => setTenderMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-800 outline-none focus:border-[#00c569] transition cursor-pointer"
                  >
                    <option value="cash">Cash Tender</option>
                    <option value="qr">Fonepay / Dynamic QR</option>
                    <option value="card">Card / POS Terminal</option>
                    <option value="split">Split Tender (Multi-Payment)</option>
                    <option value="credit">Credit / Customer Khata</option>
                  </select>
                </div>

                {/* SupaPOS Bright Emerald Action Button: Make Order (F12) */}
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length > 0) {
                      setTenderAmount(cartTotal.toString());
                      setSplitCashAmount(cartTotal.toString());
                      setSplitCardAmount('0');
                      setSplitQrAmount('0');
                      setIsCheckoutOpen(true);
                    }
                  }}
                  disabled={cart.length === 0}
                  className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-[0.99] ${
                    cart.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#00c569] hover:bg-[#00b05e] text-white cursor-pointer shadow-emerald-500/20'
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Make Order (F12)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <p className="text-[11px] text-center text-slate-500 py-2">
                Return processing mode active. Select invoice above to refund.
              </p>
            )}
          </div>
        </section>
      </div>
    )}

    {/* SupaPOS Tab: Dashboard Overview */}
    {activeSidebarTab === 'dashboard' && (
      <CashierDashboardView
        activeCashier={activeCashier}
        activeShift={activeShift}
        terminalCode={terminalCode}
        theme={theme}
        onSwitchTab={(tab) => setActiveSidebarTab(tab)}
      />
    )}

    {/* SupaPOS Tab: Products (Read-Only Inventory, NO Add Allowed) */}
    {activeSidebarTab === 'products' && (
      <CashierProductsView
        products={products}
        theme={theme}
        onAddToCart={addToCart}
        onSwitchToSales={() => setActiveSidebarTab('sales')}
      />
    )}

    {/* SupaPOS Tab: Customers Directory & Khata */}
    {activeSidebarTab === 'customers' && (
      <CashierCustomersView
        theme={theme}
        onSelectCustomer={(c) => {
          setCustomerName(c.name);
          setCustomerPhone(c.phone || '');
          setCustomerPan(c.pan || '');
        }}
        onSwitchToSales={() => setActiveSidebarTab('sales')}
      />
    )}

    {/* SupaPOS Tab: Reports (Cashier Shift X-Reading) */}
    {activeSidebarTab === 'reports' && (
      <CashierReportView
        activeCashier={activeCashier}
        activeShift={activeShift}
        terminalCode={terminalCode}
        theme={theme}
      />
    )}

    {/* SupaPOS Tab: Settings (Cashier Change PIN & Password) */}
    {activeSidebarTab === 'settings' && (
      <CashierSettingsView
        activeCashier={activeCashier}
        terminalCode={terminalCode}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
      />
    )}
  </div>

      {/* 3. Tender & Checkout Modal */}
      {/* 2. Customer Selection Modal [F3] */}
      {isCustomerPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-4 ${
              theme === 'dark' ? 'bg-[#121815] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-wide">Attach Customer (F3)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setCustomerName('Walk-in Customer');
                  setCustomerPhone('');
                  setCustomerPan('');
                  setIsCustomerPickerOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
                  customerName === 'Walk-in Customer' && !customerPhone
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <span>Walk-in Customer (Standard Retail Cash Memo)</span>
                <Check className="h-4 w-4 text-emerald-600" />
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-2 text-[10px] font-bold uppercase text-slate-400">Or Registered Buyer</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Customer / Business Name
                </label>
                <input
                  type="text"
                  value={tempCustomerName}
                  onChange={(e) => setTempCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma / Nepal Telecom"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Mobile Number (Nepal 10 Digits)
                </label>
                <input
                  type="text"
                  value={tempCustomerPhone}
                  onChange={(e) => setTempCustomerPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Buyer PAN (For IRD Nepal Tax Bill)
                </label>
                <input
                  type="text"
                  value={tempCustomerPan}
                  onChange={(e) => setTempCustomerPan(e.target.value)}
                  placeholder="9-digit PAN"
                  maxLength={9}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCustomerPickerOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerName(tempCustomerName.trim() || 'Walk-in Customer');
                  setCustomerPhone(tempCustomerPhone.trim());
                  setCustomerPan(tempCustomerPan.trim());
                  setIsCustomerPickerOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
              >
                Save &amp; Attach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount & Profit Margin Calculator Modal [F4] */}
      {isDiscountCalcOpen && (() => {
        const isLineTarget = !!calcDiscountTargetItem;
        const grossAmount = isLineTarget
          ? calcDiscountTargetItem.price * calcDiscountTargetItem.quantity
          : cartGrossSubtotal;
        const costAmount = isLineTarget
          ? ((calcDiscountTargetItem as any).costPrice || calcDiscountTargetItem.price * 0.75) * calcDiscountTargetItem.quantity
          : cart.reduce((s, i) => s + ((i as any).costPrice || i.price * 0.75) * i.quantity, 0);

        const pctVal = parseFloat(calcDiscountPctInput) || 0;
        const discountAmt = parseFloat(calcDiscountFlatInput) || (grossAmount * pctVal) / 100;
        const netSelling = Math.max(0, grossAmount - discountAmt);
        const projectedProfit = netSelling - costAmount;
        const marginPct = netSelling > 0 ? (projectedProfit / netSelling) * 100 : 0;
        const markupPct = costAmount > 0 ? (projectedProfit / costAmount) * 100 : 0;
        const isSupervisorRequired = pctVal > 10;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
            <div
              className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-4 ${
                theme === 'dark' ? 'bg-[#121815] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide">Discount &amp; Margin Calculator (F4)</h3>
                    <p className="text-[10px] text-slate-500">
                      {isLineTarget ? `Target: ${calcDiscountTargetItem.name}` : 'Target: Entire Cart Order'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiscountCalcOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Profitability Analysis Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Gross Price</span>
                  <span className="text-xs font-mono font-black">NPR {formatNepaliNumber(grossAmount.toFixed(2))}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Est. Cost (COGS)</span>
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">NPR {formatNepaliNumber(costAmount.toFixed(2))}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="block text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Net Selling</span>
                  <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-300">NPR {formatNepaliNumber(netSelling.toFixed(2))}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`p-2.5 rounded-xl border ${projectedProfit >= 0 ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Gross Profit</span>
                  <span className={`text-xs font-mono font-black ${projectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    NPR {formatNepaliNumber(projectedProfit.toFixed(2))}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Margin %</span>
                  <span className="text-xs font-mono font-black">{marginPct.toFixed(1)}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Markup %</span>
                  <span className="text-xs font-mono font-black">{markupPct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Discount Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={calcDiscountPctInput}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      setCalcDiscountPctInput(e.target.value);
                      setCalcDiscountFlatInput(((grossAmount * p) / 100).toFixed(2));
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Discount Amount (NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={grossAmount}
                    step="1"
                    value={calcDiscountFlatInput}
                    onChange={(e) => {
                      const flat = parseFloat(e.target.value) || 0;
                      setCalcDiscountFlatInput(e.target.value);
                      setCalcDiscountPctInput(grossAmount > 0 ? ((flat / grossAmount) * 100).toFixed(1) : '0');
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Cashier Policy Limit Warning (10%) */}
              {isSupervisorRequired && (
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Supervisor Authorization Required (Exceeds 10% Cashier Limit)</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                      Supervisor PIN Code
                    </label>
                    <input
                      type="password"
                      value={calcSupervisorPin}
                      onChange={(e) => setCalcSupervisorPin(e.target.value)}
                      placeholder="Enter 4-digit PIN..."
                      className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDiscountCalcOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSupervisorRequired && !calcSupervisorPin.trim()) {
                      alert('Please enter a supervisor PIN to authorize a discount above 10%.');
                      return;
                    }
                    if (isLineTarget) {
                      setCart((prev) =>
                        prev.map((it) =>
                          it.productId === calcDiscountTargetItem.productId
                            ? {
                                ...it,
                                discountPercent: pctVal,
                                lineTotal: it.price * it.quantity * (1 - pctVal / 100),
                              }
                            : it
                        )
                      );
                    } else {
                      setOrderDiscountPercent(pctVal);
                      setOrderDiscountAmount(discountAmt);
                    }
                    setIsDiscountCalcOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
                >
                  Apply Discount
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Serial Number Entry Modal */}
      {isSerialModalOpen && serialTargetLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 space-y-4 ${
              theme === 'dark' ? 'bg-[#121815] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-wide">Attach Serial Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSerialModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{serialTargetLine.name}</p>
              <p className="text-[10px] font-mono text-slate-500">{serialTargetLine.sku}</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Serial Number (Scan or Type)
              </label>
              <input
                type="text"
                autoFocus
                value={serialInputNumber}
                onChange={(e) => setSerialInputNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setCart((prev) =>
                      prev.map((it) =>
                        it.productId === serialTargetLine.productId
                          ? { ...it, serialNumber: serialInputNumber.trim() }
                          : it
                      )
                    );
                    setIsSerialModalOpen(false);
                  }
                }}
                placeholder="Scan S/N barcode..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Required for manufacturer warranty claims and invoice linking.
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSerialModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCart((prev) =>
                    prev.map((it) =>
                      it.productId === serialTargetLine.productId
                        ? { ...it, serialNumber: serialInputNumber.trim() }
                        : it
                    )
                  );
                  setIsSerialModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition"
              >
                Save S/N
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Redesigned Payment Option Modal (Matching Reference Screenshot 3) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-4 my-auto ${
              theme === 'dark' ? 'bg-[#121815] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                Select Payment Option
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleProcessSale} className="space-y-3.5">
              {/* Option 1: Cash */}
              <div
                onClick={() => setTenderMethod('cash')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                  tenderMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-600/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    tenderMethod === 'cash' ? 'border-emerald-600 bg-white' : 'border-slate-400'
                  }`}>
                    {tenderMethod === 'cash' && <div className="h-2 w-2 rounded-full bg-emerald-600" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Cash</div>
                    <div className="text-[11px] text-slate-500">Complete payment using cash</div>
                  </div>
                </div>

                {tenderMethod === 'cash' && (
                  <div className="mt-3 pl-7 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Amount Tendered (NPR)
                      </label>
                      <input
                        type="number"
                        required
                        min={cartTotal}
                        value={tenderAmount}
                        onChange={(e) => setTenderAmount(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-base font-mono font-bold outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Dynamic Cash Note Presets */}
                    <div className="flex gap-1.5 flex-wrap">
                      {dynamicCashPresets.map((amt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleNoteClick(amt, idx)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Rs. {amt}
                        </button>
                      ))}
                    </div>

                    {parseFloat(tenderAmount) >= cartTotal && (
                      <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">Change Due:</span>
                        <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-300">
                          NPR {formatNepaliNumber((parseFloat(tenderAmount) - cartTotal).toFixed(2))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Option 2: E-Wallet / Dynamic QR (Matching Screenshot 3 Grid) */}
              <div
                onClick={() => setTenderMethod('qr')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                  tenderMethod === 'qr'
                    ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-600/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    tenderMethod === 'qr' ? 'border-emerald-600 bg-white' : 'border-slate-400'
                  }`}>
                    {tenderMethod === 'qr' && <div className="h-2 w-2 rounded-full bg-emerald-600" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">E-Wallet / Dynamic QR</div>
                    <div className="text-[11px] text-slate-500">Generate QR code and pay using e-money</div>
                  </div>
                </div>

                {tenderMethod === 'qr' && (
                  <div className="mt-3 pl-7 space-y-3">
                    {/* Nepal E-Wallet Sub-Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'Fonepay', color: 'text-red-600 border-red-200' },
                        { name: 'eSewa', color: 'text-green-600 border-green-200' },
                        { name: 'Khalti', color: 'text-purple-600 border-purple-200' },
                      ].map((wallet, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border text-center font-bold text-xs bg-white dark:bg-slate-900 ${wallet.color}`}
                        >
                          <QrCode className="h-4 w-4 mx-auto mb-1" />
                          <span>{wallet.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Centered Dynamic QR Image */}
                    <div className="w-44 h-44 mx-auto bg-white p-2 rounded-2xl flex items-center justify-center shadow-md border border-slate-200">
                      {generatedQrDataUrl ? (
                        <img
                          src={generatedQrDataUrl}
                          alt={selectedBankQr?.bankName || 'QR Code'}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-32 h-32 text-slate-900 animate-pulse" />
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Bank Reference / Trace # (From Confirmation SMS)
                      </label>
                      <input
                        type="text"
                        value={qrRefNumber}
                        onChange={(e) => setQrRefNumber(e.target.value)}
                        placeholder="e.g. 984029104"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Electronic Data Capture (EDC) / Card */}
              <div
                onClick={() => setTenderMethod('card')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                  tenderMethod === 'card'
                    ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-600/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    tenderMethod === 'card' ? 'border-emerald-600 bg-white' : 'border-slate-400'
                  }`}>
                    {tenderMethod === 'card' && <div className="h-2 w-2 rounded-full bg-emerald-600" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Electronic Data Capture (EDC) / Card</div>
                    <div className="text-[11px] text-slate-500">Use POS terminal swipe or chip insertion</div>
                  </div>
                </div>

                {tenderMethod === 'card' && (
                  <div className="mt-3 pl-7 space-y-2.5">
                    <div className="flex gap-2">
                      {(['visa', 'mastercard', 'sct', 'unionpay'] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setCardBrand(b)}
                          className={`flex-1 py-1.5 rounded-lg border text-[11px] font-bold uppercase transition ${
                            cardBrand === b
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        EDC Approval Code / RRN (From POS Slip)
                      </label>
                      <input
                        type="text"
                        value={cardAuthCode}
                        onChange={(e) => setCardAuthCode(e.target.value)}
                        placeholder="e.g. APP-049182"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Option 4: Split Payment (Multi-Tender) */}
              <div
                onClick={() => setTenderMethod('split')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                  tenderMethod === 'split'
                    ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-600/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    tenderMethod === 'split' ? 'border-emerald-600 bg-white' : 'border-slate-400'
                  }`}>
                    {tenderMethod === 'split' && <div className="h-2 w-2 rounded-full bg-emerald-600" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Split Payment (Multi-Tender)</div>
                    <div className="text-[11px] text-slate-500">Divide payment across Cash, Card, and QR</div>
                  </div>
                </div>

                {tenderMethod === 'split' && (() => {
                  const c = parseFloat(splitCashAmount) || 0;
                  const cd = parseFloat(splitCardAmount) || 0;
                  const q = parseFloat(splitQrAmount) || 0;
                  const allocated = c + cd + q;
                  const remaining = cartTotal - allocated;

                  return (
                    <div className="mt-3 pl-7 space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Cash (NPR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={splitCashAmount}
                            onChange={(e) => setSplitCashAmount(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Card (NPR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={splitCardAmount}
                            onChange={(e) => setSplitCardAmount(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            QR / Wallet (NPR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={splitQrAmount}
                            onChange={(e) => setSplitQrAmount(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className={`p-2 rounded-xl border flex justify-between text-xs font-bold ${
                        remaining === 0
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        <span>Remaining to Allocate:</span>
                        <span className="font-mono">NPR {formatNepaliNumber(remaining.toFixed(2))}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Total Payment & Emerald Submit Button (Matching Reference Screenshot 3) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Total Payment</span>
                  <span className="font-black text-xl font-mono text-slate-900 dark:text-white">
                    NPR {formatNepaliNumber(String(cartTotal))}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSale}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md active:scale-[0.99] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmittingSale ? 'Processing...' : 'Finalize Sale & Print Double Slip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Thermal ESC/POS Receipt Modal (Double Slip: Customer + Office) */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm pos-receipt-backdrop overflow-y-auto">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-white text-slate-900 shadow-2xl p-5 font-mono text-xs my-auto flex flex-col max-h-[90vh]">
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 no-print shrink-0 font-sans">
              <div className="flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-xs text-slate-800">Double Slip Receipt</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Customer + Office
              </span>
            </div>

            {/* Thermal Printable Slip Container (Both Slips) */}
            <div id="pos-receipt-print-slip" className="w-full text-slate-900 bg-white overflow-y-auto pr-1 flex-1">
              {/* ========================================================= */}
              {/* SLIP 1: CUSTOMER COPY                                     */}
              {/* ========================================================= */}
              <div className="slip customer-slip pb-1">
                <div className="text-center border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
                  <h4 className="font-black text-sm uppercase tracking-tight">Intel Computer Center</h4>
                  <p className="text-[10px] text-slate-600">Dhangadhi Flagship Station #104</p>
                  <p className="text-[10px] text-slate-600 font-bold">PAN: 601234567 | IRD Approved</p>
                  <p className="text-[9px] text-slate-500">Tel: 091-525287 · Ratopool, Kailali</p>
                  <div className="my-1 py-0.5 px-2 bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-800 border-y border-dashed border-slate-300">
                    *** TAX INVOICE / CASH MEMO ***
                  </div>
                  <div className="inline-block bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded mt-0.5">
                    [ 1. CUSTOMER COPY ]
                  </div>
                  <div className="grid grid-cols-2 text-left text-[10px] text-slate-600 gap-x-2 gap-y-0.5 mt-2">
                    <div><span className="font-bold">Invoice:</span> {completedReceipt.orderNumber}</div>
                    <div className="text-right"><span className="font-bold">Date:</span> {new Date(completedReceipt.createdAt).toLocaleDateString()}</div>
                    <div><span className="font-bold">Customer:</span> {completedReceipt.customerName || 'Walk-in Customer'}</div>
                    <div className="text-right"><span className="font-bold">Time:</span> {new Date(completedReceipt.createdAt).toLocaleTimeString()}</div>
                    {completedReceipt.customerPan && (
                      <div className="col-span-2"><span className="font-bold">Buyer PAN:</span> {completedReceipt.customerPan}</div>
                    )}
                    {completedReceipt.customerPhone && (
                      <div className="col-span-2"><span className="font-bold">Phone:</span> {completedReceipt.customerPhone}</div>
                    )}
                    <div><span className="font-bold">Cashier:</span> {completedReceipt.cashierName || 'Cashier 1'}</div>
                    <div className="text-right"><span className="font-bold">Reg:</span> {completedReceipt.registerCode || '#104'}</div>
                  </div>
                </div>

                {/* Items List with Warranty / Guarantee */}
                <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2 mb-2">
                  {(completedReceipt.items || []).map((it, idx) => {
                    const lineTotal = Number(
                      it.lineTotal ?? (it.price ?? (it as any).unitPrice ?? 0) * (it.quantity || 1)
                    );
                    const prodInfo = products.find(
                      (p) => String(p.id) === String(it.productId || (it as any).id) || p.sku === it.sku
                    );
                    const itemWarranty =
                      it.warrantyText ||
                      prodInfo?.warrantyText ||
                      (it.warrantyMonths ? `${it.warrantyMonths} Months Official Warranty` : null) ||
                      (prodInfo?.warrantyMonths ? `${prodInfo.warrantyMonths} Months Official Warranty` : null);

                    return (
                      <div key={idx} className="pb-1 border-b border-dashed border-slate-100 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 leading-snug">{it.name}</p>
                            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 mt-0.5">
                              <span>{it.quantity} × Rs. {formatNepaliNumber(String(it.price ?? (it as any).unitPrice ?? 0))}</span>
                              {it.sku && <span className="font-mono text-slate-400">[{it.sku}]</span>}
                              {it.serialNumber && (
                                <span className="font-mono text-blue-600 font-semibold">S/N: {it.serialNumber}</span>
                              )}
                            </div>
                            {/* Warranty & Guarantee Details */}
                            {itemWarranty ? (
                              <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium badge-warranty">
                                <span className="font-bold">🛡️ Warranty:</span>
                                <span>{itemWarranty}</span>
                              </div>
                            ) : (
                              <div className="mt-0.5 text-[8px] text-slate-400">
                                Warranty: 7 Days Store Checking Guarantee
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900">Rs. {formatNepaliNumber(String(lineTotal))}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 mb-2 text-xs">
                  <div className="flex justify-between font-black text-sm">
                    <span>TOTAL:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.totalAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Taxable Amount:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.taxableAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>13% VAT:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.vatAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Tendered ({completedReceipt.paymentMethod}):</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.amountTendered || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Change:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.changeAmount || 0))}</span>
                  </div>
                </div>

                {/* Customer Policy Footer */}
                <div className="text-center text-[9px] text-slate-500 space-y-0.5 mb-2">
                  <p className="font-bold text-slate-700">Thank you for shopping at Intel Computer Center!</p>
                  <p>Official Warranty Validated with Invoice &amp; Serial No.</p>
                  <p>Goods once sold can be exchanged within 7 days with bill.</p>
                </div>
              </div>

              {/* ========================================================= */}
              {/* TEAR-OFF / CUT SEPARATOR                                  */}
              {/* ========================================================= */}
              <div className="cut-divider my-3 text-center border-t border-dashed border-slate-400 relative">
                <span className="cut-badge relative -top-2.5 bg-white px-2 text-[9px] font-mono font-bold text-slate-500">
                  ✂ - - - - - - - CUT / TEAR HERE - - - - - - - ✂
                </span>
              </div>

              {/* ========================================================= */}
              {/* SLIP 2: OFFICE / ACCOUNTS COPY                            */}
              {/* ========================================================= */}
              <div className="slip office-slip pt-1">
                <div className="text-center border-b border-dashed border-slate-300 pb-2.5 mb-2.5">
                  <h4 className="font-black text-sm uppercase tracking-tight">Intel Computer Center</h4>
                  <p className="text-[10px] text-slate-600 font-bold">PAN: 601234567 | Station #104</p>
                  <div className="my-1 py-0.5 px-2 bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-800 border-y border-dashed border-slate-300">
                    *** SALES AUDIT SLIP / SHIFT VOUCHER ***
                  </div>
                  <div className="inline-block bg-slate-700 text-white text-[9px] font-black px-2 py-0.5 rounded mt-0.5">
                    [ 2. OFFICE / ACCOUNTS COPY ]
                  </div>
                  <div className="grid grid-cols-2 text-left text-[10px] text-slate-600 gap-x-2 gap-y-0.5 mt-2">
                    <div><span className="font-bold">Invoice:</span> {completedReceipt.orderNumber}</div>
                    <div className="text-right"><span className="font-bold">Date:</span> {new Date(completedReceipt.createdAt).toLocaleDateString()}</div>
                    <div><span className="font-bold">Customer:</span> {completedReceipt.customerName || 'Walk-in Customer'}</div>
                    <div className="text-right"><span className="font-bold">Time:</span> {new Date(completedReceipt.createdAt).toLocaleTimeString()}</div>
                    {completedReceipt.customerPan && (
                      <div className="col-span-2"><span className="font-bold">Buyer PAN:</span> {completedReceipt.customerPan}</div>
                    )}
                    {completedReceipt.customerPhone && (
                      <div className="col-span-2"><span className="font-bold">Phone:</span> {completedReceipt.customerPhone}</div>
                    )}
                    <div><span className="font-bold">Payment:</span> {completedReceipt.paymentMethod.toUpperCase()}</div>
                    <div className="text-right"><span className="font-bold">Cashier:</span> {completedReceipt.cashierName || 'Cashier 1'}</div>
                  </div>
                </div>

                {/* Audit Items Summary */}
                <div className="space-y-1 border-b border-dashed border-slate-300 pb-2 mb-2">
                  {(completedReceipt.items || []).map((it, idx) => {
                    const lineTotal = Number(
                      it.lineTotal ?? (it.price ?? (it as any).unitPrice ?? 0) * (it.quantity || 1)
                    );
                    return (
                      <div key={idx} className="flex justify-between items-start text-[10px]">
                        <div className="flex-1 min-w-0 pr-1">
                          <span className="font-bold text-slate-900">{it.name}</span>
                          <span className="text-slate-500"> × {it.quantity}</span>
                          {it.serialNumber && <div className="text-[9px] text-blue-600">S/N: {it.serialNumber}</div>}
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">Rs. {formatNepaliNumber(String(lineTotal))}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Financial Summary */}
                <div className="space-y-0.5 border-b border-dashed border-slate-300 pb-2 mb-2 text-xs">
                  <div className="flex justify-between font-black text-xs">
                    <span>NET TOTAL:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.totalAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Taxable Sales:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.taxableAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>13% VAT Collected:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.vatAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Tendered ({completedReceipt.paymentMethod}):</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.amountTendered || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>Change Returned:</span>
                    <span>NPR {formatNepaliNumber(String(completedReceipt.changeAmount || 0))}</span>
                  </div>
                </div>

                {/* Accounting Signatures */}
                <div className="mt-3 pt-2 text-[9px] text-slate-700">
                  <div className="flex justify-between pt-4">
                    <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                      Cashier Signature
                    </div>
                    <div className="text-center border-t border-slate-400 w-[45%] pt-1 font-bold">
                      Customer Signature
                    </div>
                  </div>
                  <p className="text-[8px] text-center text-slate-400 mt-2">
                    [ Retain for Daily Shift Settlement &amp; IRD VAT Audit ]
                  </p>
                </div>
              </div>
            </div>

            {/* Print & Dismiss Actions (Hidden when printing via no-print class) */}
            <div className="flex gap-2 pt-3 border-t border-slate-200 mt-2 no-print shrink-0">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800 transition shadow-sm"
              >
                <Printer className="h-4 w-4" /> Print Double Slip
              </button>
              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold hover:bg-slate-100 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Supervisor Sign-Off Modal */}
      <SupervisorSignOffModal
        isOpen={isSignOffOpen}
        terminalCode={terminalCode}
        shiftId={activeShift?.id || null}
        cashierName={activeCashier?.name || 'Cashier'}
        onSuccess={handleSignOffApproved}
        onClose={() => setIsSignOffOpen(false)}
      />

      {/* 6. Blind EOD Close Modal */}
      <BlindEodCloseModal
        isOpen={isEodCloseOpen}
        terminalCode={terminalCode}
        shiftId={activeShift?.id || null}
        cashierName={activeCashier?.name || 'Cashier'}
        onClosed={handleEodCloseCompleted}
        onCloseModal={() => setIsEodCloseOpen(false)}
      />

      {/* 7. Line Void / Cart Void Modal */}
      <LineVoidModal
        isOpen={isVoidModalOpen}
        targetItem={voidTarget}
        terminalCode={terminalCode}
        dutySupervisorName={dutySupervisor?.name || 'Duty Supervisor'}
        theme={theme}
        onApprove={handleLineVoidApproved}
        onCancel={() => {
          setIsVoidModalOpen(false);
          setVoidTarget(null);
        }}
      />

      {/* 8. Return & Refund Authorization Modal */}
      <SupervisorReturnModal
        isOpen={isReturnAuthOpen}
        order={returnSearchResult}
        terminalCode={terminalCode}
        shiftId={activeShift?.id || null}
        cashierName={activeCashier?.name || 'Cashier'}
        dutySupervisorName={dutySupervisor?.name || 'Duty Supervisor'}
        theme={theme}
        onSuccess={handleReturnSuccess}
        onClose={() => setIsReturnAuthOpen(false)}
      />

      {/* 9. Thermal Return & Credit Slip Modal */}
      {completedReturnSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-white text-slate-900 shadow-2xl p-6 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                Credit Note / Return Voucher
              </span>
              <h4 className="font-black text-base uppercase">Intel Computer Center</h4>
              <p className="text-[10px] text-slate-600">Dhangadhi Flagship Station #104</p>
              <p className="text-[10px] text-slate-500 font-bold">
                Return Voucher: {completedReturnSlip.returnSlipNumber}
              </p>
              <p className="text-[10px] text-slate-500">Orig. Invoice: {completedReturnSlip.orderNumber}</p>
              <p className="text-[10px] text-slate-500">
                {new Date(completedReturnSlip.returnDate).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-3">
              {(completedReturnSlip.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate max-w-[180px]">
                    {it.name} × {it.quantity}
                  </span>
                  <span className="font-bold text-rose-600">
                    -Rs. {formatNepaliNumber(String(it.lineTotal || it.unitPrice * it.quantity))}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 border-b border-dashed border-slate-300 pb-3 mb-3">
              <div className="flex justify-between font-black text-sm">
                <span>TOTAL REFUND:</span>
                <span className="text-rose-600 font-bold">
                  NPR {formatNepaliNumber(String(completedReturnSlip.refundAmount))}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => setCompletedReturnSlip(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Customer-Facing Second Display Popup */}
      {showCustomerDisplay && (
        <div className="fixed bottom-4 right-4 z-40 w-80 rounded-2xl border border-emerald-500/40 bg-slate-950/95 text-white shadow-2xl p-4 backdrop-blur-md animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-tight text-emerald-400">
                Customer Live Display
              </span>
            </div>
            <button
              onClick={() => setShowCustomerDisplay(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="py-3 max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
            {cart.length === 0 ? (
              <p className="text-center text-slate-500 text-[11px] py-4">Welcome to Intel Computer Center</p>
            ) : (
              cart.map((it) => (
                <div key={it.productId} className="flex justify-between">
                  <span className="truncate max-w-[160px]">{it.name} × {it.quantity}</span>
                  <span className="font-bold text-emerald-400">Rs. {formatNepaliNumber(String(it.lineTotal))}</span>
                </div>
              ))
            )}
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-mono">
            <span className="text-xs text-slate-400 font-bold uppercase">Total Due:</span>
            <span className="text-base font-black text-emerald-400">
              NPR {formatNepaliNumber(String(cartTotal))}
            </span>
          </div>
        </div>
      )}

      {/* 11. Keyboard Shortcuts Cheat-Sheet Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 space-y-4 ${
              theme === 'dark'
                ? 'bg-[#121815] border-slate-700 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between border-b pb-3.5 ${
                theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[#00c569] shadow-2xs">
                  <HelpCircle className="h-5 w-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3
                    className={`font-black text-sm uppercase tracking-wide ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    POS Keyboard Shortcuts
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Quick hardware keys &amp; register operations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className={`p-1.5 rounded-xl transition ${
                  theme === 'dark'
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                }`}
                title="Close Shortcuts Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcut Grid with High-Contrast Dark Text & Crisp Key Badges */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                { label: 'Focus Barcode / Search', keys: ['F2'] },
                { label: 'Apply Discount & Margin', keys: ['F4'] },
                { label: 'Park / Hold Current Cart', keys: ['F5'] },
                { label: 'Recall Held Cart', keys: ['F6'] },
                { label: 'Return / Refund Mode', keys: ['F7'] },
                { label: 'Lock POS Terminal', keys: ['F10'] },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`p-3 rounded-2xl border flex items-center justify-between transition shadow-2xs ${
                    theme === 'dark'
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50/80 border-slate-200/90 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`font-bold text-xs ${
                      theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    {item.label}
                  </span>
                  <div className="flex gap-1 shrink-0 ml-2">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className={`px-2.5 py-1 rounded-xl font-mono font-black text-xs shadow-2xs border ${
                          theme === 'dark'
                            ? 'bg-slate-800 border-slate-700 text-[#00c569]'
                            : 'bg-white border-slate-250 text-[#00c569]'
                        }`}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}

              {/* Col-span-2 for Payment / Checkout Tender */}
              <div
                className={`col-span-2 p-3.5 rounded-2xl border flex items-center justify-between transition shadow-2xs ${
                  theme === 'dark'
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50/80 border-slate-200/90 hover:bg-slate-100/80 hover:border-slate-300'
                }`}
              >
                <span
                  className={`font-black text-xs ${
                    theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  Open Payment / Accept Tender
                </span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {['F12', 'Space', 'Enter'].map((k) => (
                    <kbd
                      key={k}
                      className={`px-2.5 py-1 rounded-xl font-mono font-black text-xs shadow-2xs border ${
                        theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-[#00c569]'
                          : 'bg-white border-slate-250 text-[#00c569]'
                      }`}
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className={`pt-2.5 border-t text-center ${
                theme === 'dark' ? 'border-slate-800/80' : 'border-slate-200/80'
              }`}
            >
              <p
                className={`text-[11px] font-semibold leading-relaxed ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                USB Barcode scanner captures keystrokes globally without needing to click the search box.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
