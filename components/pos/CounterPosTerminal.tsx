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
} from 'lucide-react';
import TerminalDualAuthGate, { StaffProfile } from './TerminalDualAuthGate';
import BodFloatInputModal from './BodFloatInputModal';
import SupervisorSignOffModal from './SupervisorSignOffModal';
import BlindEodCloseModal from './BlindEodCloseModal';
import LineVoidModal, { LineVoidTarget } from './LineVoidModal';
import SupervisorReturnModal from './SupervisorReturnModal';
import { formatNpr, formatNepaliNumber } from '@/lib/nepal/money';
import { posIndexedDb, CatalogProduct } from '@/lib/pos/indexedDbCatalog';
import { catalogSearchIndex } from '@/lib/pos/searchIndex';

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
  onAdd: (product: ProductItem) => void;
  onInfo: (product: ProductItem) => void;
}

const ProductTile = React.memo(function ProductTile({
  product,
  theme,
  onAdd,
  onInfo,
}: ProductTileProps) {
  const isOutOfStock = product.stockQuantity <= 0;
  const isLowStock = !isOutOfStock && product.stockQuantity <= (product.lowStockThreshold || 3);
  const formattedPrice = `Rs. ${formatNepaliNumber(String(product.price))}`;

  return (
    <div className="relative group flex flex-col justify-between">
      <div
        onClick={() => {
          if (!isOutOfStock) onAdd(product);
        }}
        className={`w-full h-full flex flex-col justify-between text-left p-3 rounded-2xl border transition ${
          isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
        } ${
          theme === 'dark'
            ? 'bg-[#141a17] border-slate-800 hover:border-emerald-500/50 hover:bg-[#1a231f]'
            : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span
              className={`text-[10px] font-mono font-bold truncate max-w-[110px] ${
                theme === 'dark' ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {product.sku}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {product.isSerialized && (
                <span
                  className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-tight border ${
                    theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                  title="Serial/IMEI Tracked Product"
                >
                  SN
                </span>
              )}
              {Boolean(product.warrantyMonths && product.warrantyMonths > 0) && (
                <span
                  className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-tight border ${
                    theme === 'dark'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                  title={`${product.warrantyMonths}M Warranty`}
                >
                  {product.warrantyMonths}M
                </span>
              )}
            </div>
          </div>

          <h4
            className={`text-xs font-bold line-clamp-2 mt-0.5 leading-snug ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            {product.name}
          </h4>
        </div>

        <div
          className={`mt-3 pt-2 border-t border-dashed flex items-center justify-between ${
            theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'
          }`}
        >
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
                ? theme === 'dark'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
                : isLowStock
                ? theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
                : theme === 'dark'
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-slate-100 text-slate-900 border-slate-200 font-bold'
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

      {/* Quick Add overlay button */}
      {!isOutOfStock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd(product);
          }}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-md font-bold text-[10px] flex items-center gap-1"
          title="Quick add to cart"
        >
          <Plus className="h-3 w-3 stroke-[3]" />
        </button>
      )}
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
  const cartSubtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  const cartTotal = cartSubtotal;
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48); // Virtualized initial slice

  // Held / Parked Carts (State & Persistence)
  const [heldCarts, setHeldCarts] = useState<Array<{ id: string; time: string; items: CartLine[] }>>([]);

  // Hardware & Network Status Icons
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Checkout & Payment Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<'cash' | 'card' | 'qr' | 'esewa' | 'khalti' | 'connectips'>('cash');
  const [tenderAmount, setTenderAmount] = useState('');

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
      if (e.key === 'F4') {
        e.preventDefault();
        const discountStr = prompt('Enter Line/Cart Discount Percentage (e.g. 5 for 5%):');
        if (discountStr) {
          const pct = Math.min(50, Math.max(0, parseFloat(discountStr) || 0));
          if (pct > 0 && cart.length > 0) {
            setCart((prev) =>
              prev.map((item) => ({
                ...item,
                discountPercent: pct,
                lineTotal: item.price * item.quantity * (1 - pct / 100),
              }))
            );
          }
        }
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

    const tendered = tenderMethod === 'cash' ? parseFloat(tenderAmount) || cartTotal : cartTotal;
    if (tenderMethod === 'cash' && tendered < cartTotal) {
      alert(`Amount tendered (Rs. ${formatNepaliNumber(String(tendered))}) cannot be less than Total.`);
      return;
    }

    const change = Math.max(0, tendered - cartTotal);
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
          })),
          paymentMethod: tenderMethod,
          amountTendered: tendered,
          changeAmount: change,
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sale processing failed.');
      }

      setCompletedReceipt(data.receipt);
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err: any) {
      alert(`Checkout Error: ${err.message}`);
    } finally {
      setIsSubmittingSale(false);
    }
  };

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
    <div
      className={`pos-portal flex h-screen max-h-screen w-full flex-col overflow-hidden font-sans select-none ${
        theme === 'dark' ? 'bg-[#0a0f0d] text-slate-100' : 'bg-white text-slate-900'
      }`}
    >
      {/* 1. Counter POS Top Header */}
      <header
        className={`h-16 px-4 flex items-center justify-between border-b shrink-0 z-30 ${
          theme === 'dark' ? 'bg-[#0f1412] border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`font-black text-sm tracking-tight uppercase ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Intel Computer Center
              </span>
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}>
                Counter POS
              </span>
            </div>
            <span className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              {terminalName} ({terminalCode}) • Station #104
            </span>
          </div>
        </div>

        {/* Status Indicators & Non-Cashier Controls Removed */}
        <div className="flex items-center gap-2">
          {/* Online/Offline Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
              isOnline
                ? theme === 'dark'
                  ? 'border-slate-800 bg-slate-900 text-slate-200'
                  : 'border-slate-200 bg-slate-50 text-slate-900 shadow-xs'
                : 'border-rose-500/40 bg-rose-950/40 text-rose-300'
            }`}
            title={isOnline ? 'Online (LAN & Cloud Connected)' : 'Offline (Local Buffered Mode)'}
          >
            {isOnline ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-900">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-[11px] font-bold">Offline</span>
              </>
            )}
          </div>

          {/* Thermal Receipt Printer Status */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
              theme === 'dark'
                ? 'border-slate-700 bg-slate-800/80 text-slate-300'
                : 'border-slate-200 bg-white text-slate-700 shadow-xs'
            }`}
            title="Thermal POS Receipt Printer (80mm ESC/POS) Ready"
          >
            <Printer className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-[11px] font-bold">Printer: Ready</span>
          </div>

          {/* Unsynced Invoices Count Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
              theme === 'dark'
                ? 'border-slate-700 bg-slate-800/80 text-slate-300'
                : 'border-slate-200 bg-white text-slate-700 shadow-xs'
            }`}
            title="Local unposted invoices queue"
          >
            <Cloud className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-[11px] font-bold">{unsyncedCount} Unsynced</span>
          </div>

          {/* Customer Second Display Toggle */}
          <button
            onClick={() => setShowCustomerDisplay((prev) => !prev)}
            className={`p-2 rounded-xl border transition ${
              showCustomerDisplay
                ? 'border-slate-800 bg-slate-100 text-slate-900'
                : theme === 'dark'
                ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
            }`}
            title="Toggle Customer-Facing Second Display Window"
          >
            <Monitor className="h-4 w-4" />
          </button>

          {/* Shortcuts Overlay Toggle */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className={`p-2 rounded-xl border transition ${
              theme === 'dark'
                ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
            }`}
            title="POS Keyboard Shortcuts [?]"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Duty Supervisor Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              theme === 'dark'
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
            }`}
            title={dutySupervisor?.name ? `Supervisor: ${dutySupervisor.name}` : 'Supervisor On Duty'}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-bold">Supervisor On Duty</span>
          </div>

          {/* Cashier Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              theme === 'dark'
                ? 'bg-slate-900 border-slate-800 text-slate-200'
                : 'bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-slate-900">
              Cashier: <strong className="text-slate-950">{activeCashier?.name || 'Cashier'}</strong>
            </span>
          </div>

          {/* Theme Switch */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-xl border transition ${
              theme === 'dark'
                ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
            }`}
            title="Toggle Dark/Light Mode"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* F10 Fast Lock */}
          <button
            onClick={handleLockTerminal}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              theme === 'dark'
                ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
            }`}
            title="Emergency Lock Terminal [F10]"
          >
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            <span>F10 Lock</span>
          </button>

          {/* Supervisor Sign-Off */}
          <button
            onClick={() => setIsSignOffOpen(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              theme === 'dark'
                ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 shadow-xs'
            }`}
            title="Supervisor Authorization Required"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            <span>Sign-Off / Switch</span>
          </button>

          {/* End of Day Register Close */}
          <button
            onClick={() => setIsEodCloseOpen(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              theme === 'dark'
                ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                : 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 shadow-xs'
            }`}
            title="Supervisor Authorization Required"
          >
            <Banknote className="h-3.5 w-3.5 text-rose-600" />
            <span>Close Register (EOD)</span>
          </button>
        </div>
      </header>

      {/* 2. Main Retail Billing Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Product Catalog & Barcode Trap (60% width) */}
        <section
          className={`relative flex flex-col flex-1 min-h-0 border-r overflow-hidden ${
            theme === 'dark' ? 'border-slate-800 bg-[#0d1210]' : 'border-slate-200 bg-white'
          }`}
        >
          {/* Barcode Search Bar */}
          <div
            className={`p-3 border-b flex items-center gap-2 ${
              theme === 'dark' ? 'bg-[#0f1412] border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan Barcode (USB Trap) or type SKU / Product Name... [F2]"
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-mono outline-none transition ${
                  theme === 'dark'
                    ? 'bg-slate-900 border-slate-800 focus:border-emerald-500 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 focus:border-emerald-600 text-slate-900 placeholder-slate-400 font-semibold'
                }`}
              />
              <Barcode className={`absolute left-3 top-3 h-4 w-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </form>

            {/* Category Quick Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-sm">
              {['ALL', 'Laptops', 'Desktops', 'Accessories', 'Components'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : theme === 'dark'
                      ? 'bg-slate-900 text-slate-400 hover:text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-xs'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Grid (Virtualized / Windowed) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {isLoadingProducts && products.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                Loading inventory items...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-500">
                No matching retail products found.
              </div>
            ) : (
              filteredProducts.slice(0, visibleCount).map((p) => (
                <ProductTile
                  key={p.id}
                  product={p}
                  theme={theme}
                  onAdd={addToCart}
                  onInfo={(prod) => setDetailProduct(prod)}
                />
              ))
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
        <section
          className={`w-96 lg:w-[420px] flex flex-col h-full min-h-0 overflow-hidden shrink-0 border-l ${
            theme === 'dark' ? 'bg-[#0f1412] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Cart / Return Mode Tabs */}
          <div
            className={`px-3 pt-3 border-b shrink-0 z-10 ${
              theme === 'dark' ? 'border-slate-800 bg-[#121815]' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => {
                  setCartMode('sale');
                  setReturnSearchResult(null);
                  setReturnSearchError('');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black transition ${
                  cartMode === 'sale'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-slate-400 hover:text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-xs'
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                NEW SALE
                {cart.length > 0 && cartMode === 'sale' && (
                  <span className="bg-black/20 rounded-full px-1.5 py-0.5 text-[10px]">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCartMode('return')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black transition ${
                  cartMode === 'return'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : theme === 'dark'
                    ? 'bg-slate-800 text-slate-400 hover:text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-xs'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                RETURN / REFUND [F7]
              </button>
            </div>

            {cartMode === 'sale' && (
              <div className="pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <ShoppingCart className={`h-3.5 w-3.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  <span className={`font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Current Cart ({cart.reduce((s, i) => s + i.quantity, 0)} Items)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={handleHoldCart}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                      title="Hold / Park Cart [F5]"
                    >
                      <FolderInput className="h-3 w-3" /> Hold [F5]
                    </button>
                  )}
                  {heldCarts.length > 0 && (
                    <button
                      onClick={handleRecallCart}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                      title="Recall Held Cart [F6]"
                    >
                      <FolderOutput className="h-3 w-3" /> Recall ({heldCarts.length}) [F6]
                    </button>
                  )}
                  {cart.length > 0 && (
                    <button
                      onClick={handleRequestVoidCart}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 transition"
                      title="Requires Supervisor Authorization"
                    >
                      <Trash2 className="h-3 w-3" /> Void
                    </button>
                  )}
                </div>
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
              /* ---- EMPTY CART ---- */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <ShoppingCart className="h-10 w-10 stroke-[1.5] text-slate-600" />
                <p className="text-xs font-bold">Cart is empty</p>
                <p className="text-[11px] max-w-[200px]">
                  Scan barcode [F2] or click any product tile to add items.
                </p>
              </div>
            ) : (
              /* ---- CART ITEMS LIST ---- */
              cart.map((line) => (
                <div
                  key={line.productId}
                  className={`group flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                    theme === 'dark'
                      ? 'bg-[#141a17] border-slate-800 hover:border-slate-700'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-emerald-400 font-bold truncate">
                        {line.sku}
                      </span>
                      {line.discountPercent ? (
                        <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                          -{line.discountPercent}%
                        </span>
                      ) : null}
                    </div>
                    <p className="font-bold truncate mt-0.5">{line.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Rs. {formatNepaliNumber(String(line.price))} each
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (line.quantity <= 1) {
                          handleRequestLineVoid(line);
                        } else {
                          updateCartQty(line.productId, line.quantity - 1);
                        }
                      }}
                      className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition"
                      title={line.quantity <= 1 ? 'Line Void (Requires Supervisor)' : 'Decrease quantity'}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-bold font-mono">{line.quantity}</span>
                    <button
                      onClick={() => updateCartQty(line.productId, line.quantity + 1)}
                      className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 transition"
                      title="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="font-mono font-black text-right shrink-0 w-22">
                    Rs. {formatNepaliNumber(String(line.lineTotal))}
                  </div>

                  {/* Line Void button */}
                  <button
                    onClick={() => handleRequestLineVoid(line)}
                    className={`opacity-0 group-hover:opacity-100 transition h-6 w-6 rounded border flex items-center justify-center shrink-0 ml-1 ${
                      theme === 'dark'
                        ? 'border-rose-500/40 bg-rose-950/30 text-rose-400 hover:bg-rose-500/20'
                        : 'border-rose-300 bg-rose-50 text-rose-500 hover:bg-rose-100'
                    }`}
                    title="Line Void — Requires Supervisor Authorization"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Checkout Action */}
          <div
            className={`p-4 border-t shrink-0 z-10 space-y-3 mt-auto ${
              theme === 'dark' ? 'border-slate-800 bg-[#121815]' : 'border-slate-200 bg-white'
            }`}
          >
            {cartMode === 'sale' ? (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-semibold'}>Total Net Amount:</span>
                  <span className={`font-black text-lg font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                    NPR {formatNepaliNumber(String(cartTotal))}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (cart.length > 0) {
                      setTenderAmount(cartTotal.toString());
                      setIsCheckoutOpen(true);
                    }
                  }}
                  disabled={cart.length === 0}
                  className={`w-full py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-xs ${
                    cart.length === 0
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-[0.99] shadow-md'
                  }`}
                >
                  <span>Accept Tender / Pay (Space / Enter / F12)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : (
              <p className="text-[11px] text-center text-slate-500">
                Return processing mode active. Select invoice above to refund.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 3. Tender & Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-4 ${
              theme === 'dark' ? 'bg-[#121815] border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <div>
                <h3 className="text-base font-black uppercase text-emerald-400">Tender & Payment</h3>
                <p className="text-[11px] text-slate-400">Station #104 • {terminalName}</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleProcessSale} className="space-y-4">
              {/* Customer Attachment (Optional Phone & PAN) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Customer Name / Phone
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Customer PAN (For Tax Bill)
                  </label>
                  <input
                    type="text"
                    value={customerPan}
                    onChange={(e) => setCustomerPan(e.target.value)}
                    placeholder="9-digit PAN"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Total Payable Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-300">Net Due (Inc. 13% VAT):</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  NPR {formatNepaliNumber(String(cartTotal))}
                </span>
              </div>

              {/* Tender Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTenderMethod('cash')}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition ${
                    tenderMethod === 'cash'
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>Cash Tender</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTenderMethod('card')}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition ${
                    tenderMethod === 'card'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Card Swipe</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTenderMethod('qr')}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition ${
                    tenderMethod === 'qr'
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <QrCode className="h-4 w-4" />
                  <span>Fonepay / QR</span>
                </button>
              </div>

              {tenderMethod === 'cash' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-300">
                      Amount Tendered (NPR)
                    </label>
                    <input
                      type="number"
                      required
                      min={cartTotal}
                      value={tenderAmount}
                      onChange={(e) => setTenderAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-lg font-mono font-bold text-white outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Cash Quick Presets */}
                  <div className="flex gap-2">
                    {dynamicCashPresets.map((amt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNoteClick(amt, idx)}
                        className="flex-1 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white"
                      >
                        Rs. {amt}
                      </button>
                    ))}
                  </div>

                  {/* Change Return */}
                  {parseFloat(tenderAmount) >= cartTotal && (
                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-xs text-slate-400">Change Due to Customer:</span>
                      <span className="text-base font-black font-mono text-emerald-400">
                        NPR {formatNepaliNumber((parseFloat(tenderAmount) - cartTotal).toFixed(2))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {tenderMethod === 'qr' && (
                <div className="space-y-3">
                  {/* Bank QR Selection Tabs if multiple banks configured */}
                  {availableBankQrs.length > 1 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                          Choose Bank / Wallet QR:
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {availableBankQrs.length} Bank QRs Active
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {availableBankQrs.map((b) => {
                          const isSel = selectedBankQr?.id === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBankQr(b)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border flex items-center gap-1.5 ${
                                isSel
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                  : theme === 'dark'
                                  ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                              }`}
                            >
                              <span>{b.bankName}</span>
                              {b.isDefault && (
                                <span className="text-[9px] bg-amber-400/20 text-amber-500 px-1 py-0.2 rounded font-black">
                                  ★
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic QR Display Card */}
                  <div
                    className={`p-4 rounded-2xl border text-center space-y-3 ${
                      theme === 'dark'
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between px-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="h-4 w-4 text-slate-800" />
                        <span className={`font-black text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {selectedBankQr?.bankName || 'Fonepay / Mobile Banking'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] border border-slate-300">
                        Dynamic QR
                      </span>
                    </div>

                    {/* Scannable Dynamic QR Code Image */}
                    <div className="w-48 h-48 mx-auto bg-white p-2.5 rounded-2xl flex items-center justify-center shadow-md border border-slate-200">
                      {generatedQrDataUrl ? (
                        <img
                          src={generatedQrDataUrl}
                          alt={selectedBankQr?.bankName || 'QR Code'}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-36 h-36 text-slate-900 animate-pulse" />
                      )}
                    </div>

                    {/* Exact Bill Due & Account Info */}
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-slate-500 font-medium">Exact Amount to Pay:</div>
                      <div className={`text-xl font-black font-mono tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-950'}`}>
                        NPR {formatNepaliNumber(String(cartTotal))}
                      </div>
                      <p className={`text-xs font-bold mt-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                        {selectedBankQr?.accountName || 'Intel Computer Center Pvt. Ltd.'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        A/C: {selectedBankQr?.accountNumber || '01201017500123'} • Station #104
                      </p>
                    </div>

                    {/* Instructions */}
                    <p className="text-[11px] text-slate-500 italic max-w-xs mx-auto leading-tight">
                      {selectedBankQr?.instructions || 'Scan with Fonepay, eSewa, Khalti, or any Nepal Mobile Banking App'}
                    </p>
                  </div>

                  {/* Bank Reference / Trace Number input */}
                  <div>
                    <label className={`block text-[10px] font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Bank Reference / Trace # (Optional)
                    </label>
                    <input
                      type="text"
                      value={qrRefNumber}
                      onChange={(e) => setQrRefNumber(e.target.value)}
                      placeholder="e.g. 849201 (from customer payment confirmation)"
                      className={`w-full rounded-xl border px-3.5 py-2 text-xs font-mono font-bold outline-none transition ${
                        theme === 'dark'
                          ? 'border-slate-700 bg-slate-950 text-white focus:border-slate-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:border-slate-800 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingSale}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 font-black text-white text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md active:scale-[0.99]"
                >
                  {isSubmittingSale ? 'Completing Sale...' : 'Finalize Sale & Print Receipt'}
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Thermal ESC/POS Receipt Modal */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-white text-slate-900 shadow-2xl p-6 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
              <h4 className="font-black text-base uppercase">Intel Computer Center</h4>
              <p className="text-[10px] text-slate-600">Dhangadhi Flagship Station #104</p>
              <p className="text-[10px] text-slate-600">PAN: 601234567 | IRD Approved</p>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Invoice: {completedReceipt.orderNumber}</p>
              <p className="text-[10px] text-slate-500">{new Date(completedReceipt.createdAt).toLocaleString()}</p>
              {completedReceipt.customerPan && (
                <p className="text-[10px] text-slate-700 font-bold">Buyer PAN: {completedReceipt.customerPan}</p>
              )}
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 mb-3">
              {(completedReceipt.items || []).map((it, idx) => {
                const lineTotal = Number(
                  it.lineTotal ?? (it.price ?? (it as any).unitPrice ?? 0) * (it.quantity || 1)
                );
                return (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate max-w-[180px]">
                      {it.name} × {it.quantity}
                    </span>
                    <span className="font-bold">Rs. {formatNepaliNumber(String(lineTotal))}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 border-b border-dashed border-slate-300 pb-3 mb-3">
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
              <div className="flex justify-between text-slate-600">
                <span>Tendered ({completedReceipt.paymentMethod}):</span>
                <span>NPR {formatNepaliNumber(String(completedReceipt.amountTendered || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Change:</span>
                <span>NPR {formatNepaliNumber(String(completedReceipt.changeAmount || 0))}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500 mb-4">
              Thank you for shopping at Intel Computer Center!
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => setCompletedReceipt(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold hover:bg-slate-100"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#121815] text-slate-100 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="font-black text-sm uppercase text-emerald-400">POS Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Focus Barcode / Search</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F2</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Apply Discount %</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F4</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Park / Hold Current Cart</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F5</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Recall Held Cart</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F6</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Return / Refund Mode</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F7</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center">
                <span>Lock POS Terminal</span>
                <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F10</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center col-span-2">
                <span>Open Payment / Accept Tender</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">F12</kbd>
                  <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">Space</kbd>
                  <kbd className="px-2 py-1 rounded bg-slate-800 font-mono font-bold text-emerald-400">Enter</kbd>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              USB Barcode scanner captures keystrokes globally without needing to click the search box.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
