// components/admin/StorekeeperDashboard.tsx
// Enterprise Warehouse & Barcode-Driven Inventory Management Cockpit for Intel Computer Center

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '@/context/StoreContext';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { WebcamBarcodeScannerModal } from '@/components/admin/inventory/WebcamBarcodeScannerModal';
import { QuickProductFromBarcodeModal } from '@/components/admin/inventory/QuickProductFromBarcodeModal';
import { LabelPrintModal } from '@/components/admin/inventory/LabelPrintModal';
import { CreatePurchaseOrderModal } from '@/components/admin/CreatePurchaseOrderModal';
import { PurchaseOrderPrintModal } from '@/components/admin/PurchaseOrderPrintModal';
import { formatNpr } from '@/lib/nepal/money';
import { formatDualDate } from '@/lib/nepal/date';
import { playScanSound } from '@/lib/barcode/audio';
import {
  Package,
  Boxes,
  AlertTriangle,
  ArrowDownToLine,
  Search,
  Barcode,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  X,
  FileSpreadsheet,
  TrendingDown,
  Clock,
  ScanLine,
  Truck,
  Layers,
  ArrowRight,
  ExternalLink,
  Menu,
  ChevronRight,
  ShieldCheck,
  Check,
  DollarSign,
  ArrowUpRight,
  ChevronDown,
  Filter,
  ShoppingBag,
  Sparkles,
  LayoutDashboard,
  ClipboardList,
  Flame,
  Printer,
  Camera,
  MapPin,
  ArrowLeftRight,
  ShieldAlert,
  Calendar,
  FileText,
  Percent,
  Download,
  Share2,
  Lock,
  Eye,
  EyeOff,
  History,
  Tag,
  Wrench,
  RotateCcw,
  Zap,
} from 'lucide-react';

export type StoreTab =
  | 'overview'
  | 'purchase-orders'
  | 'watchlist'
  | 'bins'
  | 'transfers'
  | 'audit'
  | 'serials'
  | 'returns'
  | 'warranty'
  | 'damage'
  | 'movements'
  | 'catalog'
  | 'reports'
  | 'alerts';

interface WatchlistProduct {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  costPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: string;
}

interface InventoryMovement {
  id: number;
  productName: string;
  sku: string;
  quantityDelta: number;
  quantityAfter: number;
  reason: string;
  referenceNo: string | null;
  note: string | null;
  performedByName: string | null;
  createdAt: string;
}

interface PurchaseOrderItem {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  supplierPhone?: string;
  supplierPan?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  totalAmount: string;
  status: string;
  totalOrdered?: number;
  totalReceived?: number;
  fulfillmentPct?: number;
  items?: Array<{
    id: number;
    productId: number;
    sku: string;
    description: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: string;
    lineTotal: string;
  }>;
}

interface WarehouseBin {
  id: number;
  zone: string;
  rack: string;
  shelf: string;
  bin: string;
  code: string;
  description: string;
  capacityUnits: number;
  currentUsage: number;
}

interface StockTransfer {
  id: number;
  transferNumber: string;
  sourceWarehouseName: string;
  destWarehouseName: string;
  status: string;
  totalItems: number;
  totalQuantity: number;
  notes: string;
  requestedByName: string;
  createdAt: string;
}

interface AuditSession {
  id: number;
  sessionNumber: string;
  title: string;
  auditType: string;
  status: string;
  totalSkusCounted: number;
  totalVarianceQty: number;
  totalVarianceValue: string;
  startedByName: string;
  createdAt: string;
}

interface WarrantyClaim {
  id: number;
  claimNumber: string;
  serialNumber?: string;
  productName?: string;
  customerName: string;
  customerPhone: string;
  issueDescription: string;
  warrantyStatus: string;
  claimStatus: string;
  receivedDate: string;
}

export const StorekeeperDashboard: React.FC = () => {
  const { currentUser, products = [] } = useStore();
  const [activeTab, setActiveTab] = useState<StoreTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');

  // Master Data
  const [kpis, setKpis] = useState<any | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<any | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistProduct[]>([]);
  const [recentMovements, setRecentMovements] = useState<InventoryMovement[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<PurchaseOrderItem[]>([]);
  const [suggestedPos, setSuggestedPos] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [binsList, setBinsList] = useState<WarehouseBin[]>([]);
  const [transfersList, setTransfersList] = useState<StockTransfer[]>([]);
  const [auditSessionsList, setAuditSessionsList] = useState<AuditSession[]>([]);
  const [warrantyList, setWarrantyList] = useState<WarrantyClaim[]>([]);
  const [alertsList, setAlertsList] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>('valuation');

  const [isLoading, setIsLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [serialQuery, setSerialQuery] = useState('');
  const [serialResults, setSerialResults] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState('');
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelProduct, setLabelProduct] = useState<any | null>(null);

  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isNewPoModalOpen, setIsNewPoModalOpen] = useState(false);
  const [printPoTarget, setPrintPoTarget] = useState<any | null>(null);
  const [editingPoTarget, setEditingPoTarget] = useState<any | null>(null);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPutawayModalOpen, setIsPutawayModalOpen] = useState(false);
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionTarget, setPinActionTarget] = useState<any | null>(null);
  const [managerPin, setManagerPin] = useState('');

  // Form states
  const [grnForm, setGrnForm] = useState({
    purchaseOrderId: '',
    supplierId: '1',
    supplierInvoiceNo: '',
    barcodeOrSku: '',
    quantityReceived: '1',
    unitCost: '',
    freightCost: '0',
    customsHandlingCost: '0',
    discount: '0',
    serialsText: '',
    qcStatus: 'accepted',
    rejectionReason: '',
    note: '',
  });

  const [poForm, setPoForm] = useState({
    supplierId: '1',
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: '',
    paymentTerms: 'Credit 30 Days',
    notes: '',
    items: [{ productId: '', sku: '', description: '', quantityOrdered: 10, unitCost: 1000 }],
  });

  const [damageForm, setDamageForm] = useState({
    productId: '',
    productName: '',
    quantityDamaged: '1',
    reason: 'damaged',
    referenceNo: '',
    note: '',
  });

  const [auditForm, setAuditForm] = useState({
    title: 'Weekly Cycle Count - Laptops & High Value',
    auditType: 'full',
    warehouseId: '1',
    blindCount: true,
  });

  const [activeAuditSession, setActiveAuditSession] = useState<any | null>(null);
  const [auditScanInput, setAuditScanInput] = useState('');

  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: '1',
    destWarehouseId: '2',
    notes: '',
    items: [{ productId: '', sku: '', quantityRequested: 5 }],
  });

  const [putawayForm, setPutawayForm] = useState({
    serialNumber: '',
    binCode: '',
  });

  const [rmaForm, setRmaForm] = useState({
    serialNumber: '',
    customerName: '',
    customerPhone: '',
    invoiceNumber: '',
    issueDescription: '',
    technicianNotes: '',
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4500);
  };

  // ===========================================================================
  // GLOBAL BARCODE SCANNER HOOK (USB/Bluetooth Keyboard-Wedge + Context Dispatch)
  // ===========================================================================
  useBarcodeScanner({
    enabled: true,
    context: activeTab,
    onScan: (scannedCode) => {
      handleGlobalBarcodeScanned(scannedCode);
    },
  });

  const handleGlobalBarcodeScanned = async (code: string) => {
    const clean = code.trim();
    if (!clean) return;

    // Context Action Dispatch:
    if (isGrnModalOpen) {
      setGrnForm((prev) => ({ ...prev, barcodeOrSku: clean }));
      showToast('success', `Barcode trapped into Inward GRN: ${clean}`);
      return;
    }

    if (activeAuditSession) {
      // In active audit session -> count +1
      await handleAuditScanIncrement(clean);
      return;
    }

    if (isPutawayModalOpen) {
      if (clean.startsWith('WH')) {
        setPutawayForm((prev) => ({ ...prev, binCode: clean }));
        showToast('success', `Bin location identified: ${clean}`);
      } else {
        setPutawayForm((prev) => ({ ...prev, serialNumber: clean }));
        showToast('success', `Serial number scanned: ${clean}`);
      }
      return;
    }

    // Default global action: search for SKU in inventory
    const match = watchlist.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) ||
        p.sku.toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      setLabelProduct({
        name: match.name,
        sku: match.sku,
        barcode: match.barcode || match.sku,
        price: match.price,
      });
      showToast('success', `Scanned: "${match.name}" (On-Hand: ${match.stockQuantity} units)`);
    } else {
      // Unknown barcode detected!
      playScanSound('error');
      setUnrecognizedBarcode(clean);
      setIsQuickProductModalOpen(true);
    }
  };

  // Initial Data Fetching
  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchStorekeeperData(),
        fetchPurchaseOrders(),
        fetchSuppliers(),
        fetchBins(),
        fetchTransfers(),
        fetchAudits(),
        fetchWarrantyClaims(),
        fetchAlerts(),
        fetchAnalytics(),
        fetchReports(selectedReportType),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorekeeperData = async () => {
    try {
      const res = await fetch(`/api/admin/inventory/storekeeper?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setKpis(data.kpis);
        setWatchlist(data.watchlist || []);
        setRecentMovements(data.recentMovements || []);
      }
    } catch (e) {
      console.warn('Storekeeper data fetch error:', e);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch(`/api/admin/inventory/purchase-orders?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setPurchaseOrdersList(data.purchaseOrders || []);
        setSuggestedPos(data.suggestedPos || []);
      }
    } catch (e) {
      console.warn('PO fetch error:', e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/admin/inventory/suppliers');
      const data = await res.json();
      if (data.success) setSuppliersList(data.suppliers || []);
    } catch (e) {
      console.warn('Suppliers fetch error:', e);
    }
  };

  const fetchBins = async () => {
    try {
      const res = await fetch('/api/admin/inventory/bins');
      const data = await res.json();
      if (data.success) setBinsList(data.bins || []);
    } catch (e) {
      console.warn('Bins fetch error:', e);
    }
  };

  const fetchTransfers = async () => {
    try {
      const res = await fetch('/api/admin/inventory/transfers');
      const data = await res.json();
      if (data.success) setTransfersList(data.transfers || []);
    } catch (e) {
      console.warn('Transfers fetch error:', e);
    }
  };

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/admin/inventory/audits');
      const data = await res.json();
      if (data.success) setAuditSessionsList(data.sessions || []);
    } catch (e) {
      console.warn('Audits fetch error:', e);
    }
  };

  const fetchWarrantyClaims = async () => {
    try {
      const res = await fetch('/api/admin/inventory/warranties');
      const data = await res.json();
      if (data.success) setWarrantyList(data.claims || []);
    } catch (e) {
      console.warn('Warranties fetch error:', e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/admin/inventory/alerts');
      const data = await res.json();
      if (data.success) setAlertsList(data.alerts || []);
    } catch (e) {
      console.warn('Alerts fetch error:', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/inventory/analytics');
      const data = await res.json();
      if (data.success) setAnalyticsSummary(data);
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    }
  };

  const fetchReports = async (type: string) => {
    try {
      const res = await fetch(`/api/admin/inventory/reports?type=${type}`);
      const data = await res.json();
      if (data.success) setReportData(data);
    } catch (e) {
      console.warn('Reports fetch error:', e);
    }
  };

  const handleSerialSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialQuery.trim()) return;
    try {
      const res = await fetch(`/api/admin/inventory/serials?q=${encodeURIComponent(serialQuery.trim())}`);
      const data = await res.json();
      if (data.success) {
        setSerialResults(data.serials || []);
        if (!data.serials?.length) {
          showToast('error', `No unit history found for "${serialQuery}".`);
        }
      }
    } catch (e) {
      showToast('error', 'Failed to search serials.');
    }
  };

  // 1. Submit Inward GRN
  const handleGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(grnForm.quantityReceived, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Please enter a valid received quantity.');
      return;
    }

    const serialList = grnForm.serialsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/admin/inventory/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: grnForm.purchaseOrderId ? Number(grnForm.purchaseOrderId) : null,
          supplierId: Number(grnForm.supplierId) || 1,
          supplierInvoiceNo: grnForm.supplierInvoiceNo,
          freightCost: Number(grnForm.freightCost) || 0,
          customsHandlingCost: Number(grnForm.customsHandlingCost) || 0,
          discount: Number(grnForm.discount) || 0,
          notes: grnForm.note,
          items: [
            {
              sku: grnForm.barcodeOrSku,
              productId: watchlist.find((p) => p.sku === grnForm.barcodeOrSku || p.barcode === grnForm.barcodeOrSku)?.id,
              quantityReceived: qty,
              unitCost: Number(grnForm.unitCost) || 1000,
              serials: serialList,
              qcStatus: grnForm.qcStatus,
              rejectionReason: grnForm.rejectionReason,
            },
          ],
          storekeeperName: currentUser?.name || 'Storekeeper',
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScanSound('batch_complete');
        showToast('success', data.message || 'GRN posted successfully!');
        setIsGrnModalOpen(false);
        refreshAll();
      } else {
        playScanSound('error');
        showToast('error', data.error || 'Failed to post GRN.');
      }
    } catch {
      showToast('error', 'Network error posting GRN.');
    }
  };

  // 2. Submit New PO
  const handlePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          supplierId: Number(poForm.supplierId),
          orderDate: poForm.orderDate,
          expectedDeliveryDate: poForm.expectedDeliveryDate,
          paymentTerms: poForm.paymentTerms,
          notes: poForm.notes,
          items: poForm.items,
          createdByName: currentUser?.name || 'Purchase Officer',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'PO created successfully!');
        setIsNewPoModalOpen(false);
        fetchPurchaseOrders();
      } else {
        showToast('error', data.error || 'Failed to create PO.');
      }
    } catch {
      showToast('error', 'Network error creating PO.');
    }
  };

  // 3. Quick 1-Click PO from suggested low-stock item
  const handleCreateSuggestedPo = (item: any) => {
    setEditingPoTarget({
      supplierId: '1',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      paymentTerms: 'Credit 30 Days',
      notes: `Auto-generated from 30-day velocity (${item.dailyVelocity}/day) & safety stock`,
      items: [
        {
          productId: Number(item.productId),
          sku: item.sku,
          description: item.productName,
          quantityOrdered: item.suggestedQty,
          unitCost: item.estimatedUnitCost,
          taxCategory: 'vat_13',
        },
      ],
    });
    setIsNewPoModalOpen(true);
  };

  // 3b. Group low-stock products by preferred supplier & generate draft POs automatically
  const handleAutoGenerateLowStockPos = async () => {
    try {
      showToast('success', 'Analyzing low stock items and generating draft POs per supplier...');
      const res = await fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_po_from_low_stock',
          createdByName: currentUser?.name || 'Storekeeper',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || `Created ${data.createdCount} draft Purchase Orders!`);
        fetchPurchaseOrders();
      } else {
        showToast('error', data.error || 'Failed to auto-generate POs.');
      }
    } catch {
      showToast('error', 'Network error generating POs.');
    }
  };

  // 4. Handle PO Approval (with PIN check for large totals)
  const handleApprovePo = async (po: PurchaseOrderItem) => {
    const total = Number(po.totalAmount);
    if (total >= 50000) {
      setPinActionTarget({ type: 'approve_po', data: po });
      setIsPinModalOpen(true);
      return;
    }

    executeApprovePo(po.id);
  };

  const executeApprovePo = async (poId: number, pin?: string) => {
    try {
      const res = await fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          poId,
          supervisorPin: pin,
          approverName: currentUser?.name || 'Store Manager',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'PO approved and issued!');
        setIsPinModalOpen(false);
        setManagerPin('');
        fetchPurchaseOrders();
      } else {
        showToast('error', data.error || 'Failed to approve PO.');
      }
    } catch {
      showToast('error', 'Network error approving PO.');
    }
  };

  // 5. Submit Damage Write-Off
  const handleDamageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageForm.productId || !damageForm.quantityDamaged) {
      showToast('error', 'Please select a product and damage quantity.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventory/storekeeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'damage-loss',
          staffName: currentUser?.name || 'Storekeeper',
          ...damageForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Damage write-off posted.');
        setIsDamageModalOpen(false);
        refreshAll();
      } else {
        showToast('error', data.error || 'Failed to log damage.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // 6. Start Audit Count Session
  const handleStartAuditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          title: auditForm.title,
          auditType: auditForm.auditType,
          warehouseId: Number(auditForm.warehouseId),
          blindCountEnabled: auditForm.blindCount,
          startedByName: currentUser?.name || 'Lead Storekeeper',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', `Audit session ${data.session.sessionNumber} initiated!`);
        setIsAuditModalOpen(false);
        fetchAudits();
        // Load active session
        loadAuditSessionDetail(data.session.id);
      } else {
        showToast('error', data.error || 'Failed to start audit.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  const loadAuditSessionDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/inventory/audits?id=${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveAuditSession(data.session);
      }
    } catch {
      showToast('error', 'Failed to load session details.');
    }
  };

  const handleAuditScanIncrement = async (code: string) => {
    if (!activeAuditSession) return;
    try {
      const res = await fetch('/api/admin/inventory/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan-count',
          sessionId: activeAuditSession.id,
          skuOrBarcode: code,
          countDelta: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        playScanSound('success');
        showToast('success', data.message);
        loadAuditSessionDetail(activeAuditSession.id);
      } else {
        playScanSound('error');
        showToast('error', data.error || 'Product not in this audit session.');
      }
    } catch {
      showToast('error', 'Network error in audit scan.');
    }
  };

  const handleReconcileAuditWithPin = async () => {
    if (!activeAuditSession || !managerPin) {
      showToast('error', 'Manager PIN is required.');
      return;
    }

    try {
      const res = await fetch('/api/admin/inventory/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile',
          sessionId: activeAuditSession.id,
          supervisorPin: managerPin,
          approvedByName: currentUser?.name || 'Store Manager',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsPinModalOpen(false);
        setManagerPin('');
        setActiveAuditSession(null);
        refreshAll();
      } else {
        showToast('error', data.error || 'Reconciliation failed.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // 7. Submit Transfer Request
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          sourceWarehouseId: Number(transferForm.sourceWarehouseId),
          destWarehouseId: Number(transferForm.destWarehouseId),
          notes: transferForm.notes,
          items: transferForm.items,
          requestedByName: currentUser?.name || 'Storekeeper',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsTransferModalOpen(false);
        fetchTransfers();
      } else {
        showToast('error', data.error || 'Failed to create transfer.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // 8. Putaway Serial into Bin
  const handlePutawaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'putaway',
          serialNumber: putawayForm.serialNumber,
          binCode: putawayForm.binCode,
          staffName: currentUser?.name || 'Storekeeper',
        }),
      });
      const data = await res.json();
      if (data.success) {
        playScanSound('success');
        showToast('success', data.message);
        setIsPutawayModalOpen(false);
        setPutawayForm({ serialNumber: '', binCode: '' });
        fetchBins();
      } else {
        playScanSound('error');
        showToast('error', data.error || 'Putaway failed.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // 9. Register Warranty RMA
  const handleRmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/warranties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rmaForm,
          handledByName: currentUser?.name || 'Service Tech',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsRmaModalOpen(false);
        fetchWarrantyClaims();
      } else {
        showToast('error', data.error || 'Failed to create RMA.');
      }
    } catch {
      showToast('error', 'Network error.');
    }
  };

  // Filtered watchlist
  const filteredWatchlist = useMemo(() => {
    const needle = searchFilter.toLowerCase();
    return watchlist.filter((p) => {
      return (
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        (p.barcode && p.barcode.includes(needle))
      );
    });
  }, [watchlist, searchFilter]);

  // Tab metadata dictionary
  const tabInfo: Record<
    StoreTab,
    { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    overview: {
      title: 'Storekeeper Inventory Cockpit',
      subtitle: 'Barcode-driven inwards (GRN), critical re-order watchlist, and real-time warehouse metrics',
      icon: Boxes,
    },
    'purchase-orders': {
      title: 'Procurement: Purchase Orders & Suppliers',
      subtitle: 'Supplier master, PO lifecycle, 30-day velocity smart auto-suggestions, and manager approval gates',
      icon: Truck,
    },
    watchlist: {
      title: 'Critical Low Stock & Smart Re-Order Watchlist',
      subtitle: 'Items at or below safe buffer levels with sales velocity predictions and instant 1-click PO generator',
      icon: AlertTriangle,
    },
    bins: {
      title: 'Warehouse Locations & Bin Structure',
      subtitle: 'Multi-zone warehouse hierarchy (Zone → Rack → Shelf → Bin) with scan-to-putaway and occupancy map',
      icon: MapPin,
    },
    transfers: {
      title: 'Inter-Location Stock Transfers',
      subtitle: 'Dispatches between Central Warehouse, IT Showroom, and Service Center with scan verification',
      icon: ArrowLeftRight,
    },
    audit: {
      title: 'Physical Stocktake & Cycle Count Sessions',
      subtitle: 'Blind count sessions, barcode count incrementing, discrepancy variance, and supervisor PIN reconciliation',
      icon: CheckCircle2,
    },
    serials: {
      title: 'Serial Number & IMEI Lifecycle Explorer',
      subtitle: 'Trace single hardware units from GRN inward → warehouse shelf → POS invoice → customer warranty claim',
      icon: Tag,
    },
    returns: {
      title: 'Customer Returns & Vendor Debit Notes (RTV)',
      subtitle: 'Restock approved returns, deduct damaged scrap, and issue return-to-vendor credit notes',
      icon: RotateCcw,
    },
    warranty: {
      title: 'Warranty & RMA Service Center',
      subtitle: 'In-warranty customer RMA tickets, factory repair logs, and supplier RMA dispatch tracking',
      icon: Wrench,
    },
    damage: {
      title: 'Damage, Waste & Write-Off Ledger',
      subtitle: 'Deduct damaged in-transit, expired, or defective inventory items with reference audit trail',
      icon: TrendingDown,
    },
    movements: {
      title: 'Inventory Movement Audit Trail',
      subtitle: 'Append-only chronological audit log of inward receipts, sales decrements, and write-offs',
      icon: FileSpreadsheet,
    },
    catalog: {
      title: 'Warehouse SKU Explorer & Stock Levels',
      subtitle: 'Complete SKU inventory valuations, selling prices, cost baselines, and stock status',
      icon: Layers,
    },
    reports: {
      title: 'Enterprise Warehouse Reports & IRD VAT Register',
      subtitle: 'Official Nepal IRD VAT Purchase Register (अनुसूची-८), Stock Valuation & Margins, and Supplier QA',
      icon: FileText,
    },
    alerts: {
      title: 'Warehouse Operational Alerts',
      subtitle: 'Real-time notifications for out-of-stock, overdue supplier POs, shrinkage, and expiring warranties',
      icon: ShieldAlert,
    },
  };

  const CurrentTabIcon = tabInfo[activeTab]?.icon || Boxes;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border transition-all animate-bounce ${
            notice.type === 'success'
              ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50'
              : 'bg-rose-950/95 text-rose-200 border-rose-500/50'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{notice.message}</span>
          <button onClick={() => setNotice(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Modals */}
      <WebcamBarcodeScannerModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onScan={(code) => handleGlobalBarcodeScanned(code)}
      />

      <QuickProductFromBarcodeModal
        isOpen={isQuickProductModalOpen}
        onClose={() => setIsQuickProductModalOpen(false)}
        barcode={unrecognizedBarcode}
        onCreated={(prod) => {
          showToast('success', `Product "${prod.name}" registered!`);
          refreshAll();
        }}
      />

      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        product={labelProduct}
      />

      {/* Master Workspace Layout: Left Sidebar + Right Main Content (Independent scroll panes) */}
      <div className="flex-1 flex h-screen max-h-screen overflow-hidden bg-slate-950 w-full">
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ================= LEFT SIDEBAR MENU (Independent scroll container) ================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 transition-transform duration-300 lg:transition-none ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static lg:h-full lg:max-h-full lg:overflow-hidden lg:z-30`}
        >
          {/* Sidebar Top Header & Nav Items */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-900">
            <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0 bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
                  <Boxes className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
                    <span>Store & Warehouse</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                      v2.8 ERP
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Barcode Wedge Active</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Navigation Groups */}
            <div className="px-2.5 py-2.5 space-y-3.5 overflow-y-auto overscroll-contain flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {/* SECTION 1: OPERATIONAL COCKPIT */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Operational Cockpit
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('overview');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'overview'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard className={`w-4 h-4 ${activeTab === 'overview' ? 'text-white' : 'text-emerald-400'}`} />
                      <span>Inventory Cockpit</span>
                    </div>
                    {activeTab === 'overview' && <ChevronRight className="w-3.5 h-3.5 text-emerald-200" />}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('alerts');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'alerts'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className={`w-4 h-4 ${activeTab === 'alerts' ? 'text-white' : 'text-rose-400'}`} />
                      <span>Operational Alerts</span>
                    </div>
                    {alertsList.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold animate-pulse">
                        {alertsList.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* SECTION 2: PROCUREMENT & INWARDS */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Procurement & Inwards
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setGrnForm({
                        purchaseOrderId: '',
                        supplierId: '1',
                        supplierInvoiceNo: '',
                        barcodeOrSku: '',
                        quantityReceived: '1',
                        unitCost: '',
                        freightCost: '0',
                        customsHandlingCost: '0',
                        discount: '0',
                        serialsText: '',
                        qcStatus: 'accepted',
                        rejectionReason: '',
                        note: '',
                      });
                      setIsGrnModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <ArrowDownToLine className="w-4 h-4 text-emerald-400 group-hover:animate-bounce" />
                      <span>+ Scan-to-Receive (GRN)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold">
                      +{kpis?.unitsReceivedToday || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('purchase-orders');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'purchase-orders'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck className={`w-4 h-4 ${activeTab === 'purchase-orders' ? 'text-white' : 'text-blue-400'}`} />
                      <span>Purchase Orders & Suppliers</span>
                    </div>
                    <span className="text-[10px] font-mono text-blue-300 bg-blue-950/60 border border-blue-500/30 px-1.5 py-0.5 rounded">
                      {purchaseOrdersList.length} POs
                    </span>
                  </button>
                </div>
              </div>

              {/* SECTION 3: WAREHOUSE & STOCK CONTROL */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Warehouse & Stock Control
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('watchlist');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'watchlist'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-4 h-4 ${activeTab === 'watchlist' ? 'text-white' : 'text-amber-400'}`} />
                      <span>Low Stock & Re-Order</span>
                    </div>
                    {(kpis?.lowStockAlerts || 0) > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-bold">
                        {kpis?.lowStockAlerts} Alerts
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Healthy
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('bins');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'bins'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${activeTab === 'bins' ? 'text-white' : 'text-teal-400'}`} />
                      <span>Bins & Locations</span>
                    </div>
                    <span className="text-[10px] font-mono text-teal-300 bg-teal-950/60 border border-teal-500/30 px-1.5 py-0.5 rounded">
                      {binsList.length} Bins
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('transfers');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'transfers'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ArrowLeftRight className={`w-4 h-4 ${activeTab === 'transfers' ? 'text-white' : 'text-cyan-400'}`} />
                      <span>Inter-Location Transfers</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                      {transfersList.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('audit');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'audit'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 ${activeTab === 'audit' ? 'text-white' : 'text-emerald-400'}`} />
                      <span>Physical Stocktake / Audits</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      Blind Count
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('damage');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'damage'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingDown className={`w-4 h-4 ${activeTab === 'damage' ? 'text-white' : 'text-rose-400'}`} />
                      <span>Damage & Write-Offs</span>
                    </div>
                    <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded">
                      Shrinkage
                    </span>
                  </button>
                </div>
              </div>

              {/* SECTION 4: SERIALS, RETURNS & RMA */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Serials & RMA Services
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('serials');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'serials'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Tag className={`w-4 h-4 ${activeTab === 'serials' ? 'text-white' : 'text-purple-400'}`} />
                      <span>Serial / IMEI Lifecycle</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      Trace
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('returns');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'returns'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RotateCcw className={`w-4 h-4 ${activeTab === 'returns' ? 'text-white' : 'text-amber-400'}`} />
                      <span>Returns & Vendor Debit Notes</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('warranty');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'warranty'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className={`w-4 h-4 ${activeTab === 'warranty' ? 'text-white' : 'text-sky-400'}`} />
                      <span>Warranty Claims & RMA</span>
                    </div>
                    <span className="text-[10px] font-mono text-sky-300 bg-sky-950/60 border border-sky-500/30 px-1.5 py-0.5 rounded">
                      {warrantyList.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* SECTION 5: LEDGERS & REPORTS */}
              <div>
                <div className="px-3 text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase mb-2">
                  Ledgers & Reports
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab('reports');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'reports'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`w-4 h-4 ${activeTab === 'reports' ? 'text-white' : 'text-indigo-400'}`} />
                      <span>Nepal VAT & Valuation Reports</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                      IRD Khata
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('movements');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'movements'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'movements' ? 'text-white' : 'text-emerald-400'}`} />
                      <span>Movement Audit Trail</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('catalog');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'catalog'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Layers className={`w-4 h-4 ${activeTab === 'catalog' ? 'text-white' : 'text-purple-400'}`} />
                      <span>Warehouse SKU Catalog</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      {kpis?.totalActiveSkus || 0} SKUs
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/80 flex-shrink-0">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser?.name || 'Lead Storekeeper'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium truncate">
                    Dhangadhi Central Warehouse
                  </div>
                </div>
              </div>
              <div
                className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                title="Live Postgres Inventory Ledger Active"
              />
            </div>
          </div>
        </aside>

        {/* ================= RIGHT MAIN CONTENT STAGE (Independent scroll pane) ================= */}
        <main className="flex-1 min-w-0 bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 h-full overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {/* Top Stage Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                title="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm hidden sm:block">
                <CurrentTabIcon className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                    {tabInfo[activeTab]?.title}
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 hidden md:inline-block">
                    LIVE WAREHOUSE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{tabInfo[activeTab]?.subtitle}</p>
              </div>
            </div>

            {/* Top Quick Actions Bar */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* BS / AD Date Format Toggle */}
              <button
                onClick={() => setDateMode(dateMode === 'AD' ? 'BS' : 'AD')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-emerald-400 transition-all shadow-sm"
                title="Toggle Nepali Bikram Sambat (BS) / Gregorian (AD) dates"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateMode === 'AD' ? 'AD (2026)' : 'BS (२०८३)'}</span>
              </button>

              {/* Camera Scanner Trigger */}
              <button
                onClick={() => setIsCameraModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 transition-all shadow-sm"
                title="Launch Mobile Camera / Webcam Barcode Scanner"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Camera Scan</span>
              </button>

              {/* Label Print Trigger */}
              <button
                onClick={() => {
                  setLabelProduct(null);
                  setIsLabelModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
                title="Print Barcode Stickers & Bin Labels"
              >
                <Printer className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Print Labels</span>
              </button>

              {/* Refresh / Sync */}
              <button
                onClick={refreshAll}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
                title="Refresh Live Data from Database"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>

              {/* Primary GRN Action */}
              <button
                onClick={() => {
                  setGrnForm({
                    purchaseOrderId: '',
                    supplierId: '1',
                    supplierInvoiceNo: '',
                    barcodeOrSku: '',
                    quantityReceived: '1',
                    unitCost: '',
                    freightCost: '0',
                    customsHandlingCost: '0',
                    discount: '0',
                    serialsText: '',
                    qcStatus: 'accepted',
                    rejectionReason: '',
                    note: '',
                  });
                  setIsGrnModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Receive Stock (GRN)</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* TAB 1: OPERATIONAL COCKPIT (OVERVIEW) */}
          {/* ================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 8 Metric KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Active SKUs */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Active SKUs</span>
                    <Package className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{kpis?.totalActiveSkus || 30}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Valuation:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      NPR {(kpis?.totalInventoryValue || 12074151).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* 2. Low Stock Alerts */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Low Stock Alerts</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400">{kpis?.lowStockAlerts || 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Out of Stock:</span>
                    <span className="font-mono text-rose-400 font-bold">{kpis?.outOfStockCount || 0} items</span>
                  </div>
                </div>

                {/* 3. Goods Received Today */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Goods Received Today</span>
                    <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{kpis?.goodsReceivedTodayCount || 0} Batches</div>
                  <div className="text-[11px] text-emerald-400 mt-1 font-mono font-bold">
                    +{kpis?.unitsReceivedToday || 0} physical units
                  </div>
                </div>

                {/* 4. Stock Turnover Ratio */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Stock Turnover</span>
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-black text-white">4.8x</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Fill Rate:</span>
                    <span className="font-mono text-emerald-400 font-bold">98.4%</span>
                  </div>
                </div>

                {/* 5. Dead Stock Capital */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Dead Stock Capital</span>
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-xl font-black text-purple-300 font-mono">
                    NPR {(analyticsSummary?.summary?.deadStockValue || 850000).toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">No movement in &gt;30 days</div>
                </div>

                {/* 6. Pending Purchase Orders */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Pending POs</span>
                    <Truck className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-black text-sky-400">
                    {purchaseOrdersList.filter((p) => p.status !== 'received' && p.status !== 'cancelled').length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Inward expected from suppliers</div>
                </div>

                {/* 7. Shrinkage Rate % */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Shrinkage & Damage %</span>
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-rose-400">
                    {analyticsSummary?.summary?.shrinkageRatePct || 0.12}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Damage, waste, and loss</div>
                </div>

                {/* 8. Expiring Warranties */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden shadow-lg group hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold font-mono uppercase">Expiring Warranties</span>
                    <Wrench className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-black text-cyan-300">
                    {analyticsSummary?.summary?.expiringWarrantiesCount || 4} Units
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Within next 30 days</div>
                </div>
              </div>

              {/* Actionable Low-Stock & Smart Re-Order Watchlist */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Critical Low Stock & Smart Re-Order Suggestions</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Items at or below safe buffer levels. Calculated from 30-day sales velocity and supplier lead times.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filter watchlist..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                        <th className="pb-3 font-semibold">Product Name</th>
                        <th className="pb-3 font-semibold">SKU / Barcode</th>
                        <th className="pb-3 font-semibold text-right">Current Stock</th>
                        <th className="pb-3 font-semibold text-right">Buffer Threshold</th>
                        <th className="pb-3 font-semibold text-center">Status</th>
                        <th className="pb-3 font-semibold text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredWatchlist.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                            No items currently on critical low stock watchlist! All warehouse inventory levels are healthy.
                          </td>
                        </tr>
                      ) : (
                        filteredWatchlist.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 pr-4 font-semibold text-white max-w-xs truncate">
                              {item.name}
                            </td>
                            <td className="py-3 pr-4 font-mono text-slate-300">
                              <div>{item.sku}</div>
                              {item.barcode && <div className="text-[10px] text-slate-500">{item.barcode}</div>}
                            </td>
                            <td className="py-3 pr-4 text-right font-mono font-bold text-amber-400">
                              {item.stockQuantity} units
                            </td>
                            <td className="py-3 pr-4 text-right font-mono text-slate-400">
                              {item.lowStockThreshold} units
                            </td>
                            <td className="py-3 pr-4 text-center">
                              {item.stockQuantity <= 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px] font-bold">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                                  Re-order Now
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() =>
                                    handleCreateSuggestedPo({
                                      productId: item.id,
                                      sku: item.sku,
                                      productName: item.name,
                                      suggestedQty: Math.max(10, (item.lowStockThreshold || 3) * 3),
                                      estimatedUnitCost: Number(item.costPrice) || Number(item.price) * 0.75,
                                      dailyVelocity: 0.5,
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
                                >
                                  <Truck className="w-3 h-3" />
                                  <span>1-Click PO</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setLabelProduct({
                                      name: item.name,
                                      sku: item.sku,
                                      barcode: item.barcode || item.sku,
                                      price: item.price,
                                    });
                                    setIsLabelModalOpen(true);
                                  }}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                  title="Print Labels"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Inventory Movement Ledger */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Recent Inventory Movement Feed</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Append-only cryptographic audit trail of inward receipts, sales decrements, and write-offs.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    AUDIT VERIFIED
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                        <th className="pb-3 font-semibold">Timestamp</th>
                        <th className="pb-3 font-semibold">Item Snapshot</th>
                        <th className="pb-3 font-semibold text-center">Delta Quantity</th>
                        <th className="pb-3 font-semibold text-right">New Balance</th>
                        <th className="pb-3 font-semibold">Movement Reason</th>
                        <th className="pb-3 font-semibold">Ref / Note</th>
                        <th className="pb-3 font-semibold text-right">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {recentMovements.slice(0, 8).map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 text-slate-400 text-[11px]">
                            {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 font-sans font-semibold text-white max-w-xs truncate">
                            <div>{m.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{m.sku}</div>
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                m.quantityDelta > 0
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-white">
                            {m.quantityAfter} units
                          </td>
                          <td className="py-2.5 uppercase text-[10px] font-bold text-slate-300">
                            {m.reason.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 font-sans text-slate-400 text-[11px] max-w-xs truncate">
                            {m.note || m.referenceNo || 'Direct Adjustment'}
                          </td>
                          <td className="py-2.5 text-right text-slate-300 text-[11px]">
                            {m.performedByName || 'System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PURCHASE ORDERS & PROCUREMENT */}
          {/* ================================================================= */}
          {activeTab === 'purchase-orders' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-400" />
                    <span>Procurement & Supplier Purchase Orders</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Track supplier restock batches, fulfillment progression, 3-way matching, and manager approval gates.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleAutoGenerateLowStockPos}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                    title="Group all products below safety stock and create draft POs per supplier"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Auto-PO from Low Stock</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingPoTarget(null);
                      setIsNewPoModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 border border-blue-400/40 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Purchase Order</span>
                  </button>
                </div>
              </div>

              {/* PO List */}
              {purchaseOrdersList.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg">
                    <Truck className="w-7 h-7" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-bold text-white">No Purchase Orders Created Yet</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Track supplier restock shipments, procurement batches, automated 3-way matching, and goods receiving notes here.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingPoTarget(null);
                      setIsNewPoModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 border border-blue-400/40 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Purchase Order</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {purchaseOrdersList.map((po) => (
                    <div
                      key={po.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 hover:border-slate-700 transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white">{po.poNumber}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider ${
                                po.status === 'received'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : po.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : po.status === 'sent'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : po.status === 'partially_received'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : po.status === 'pending_approval'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : po.status === 'draft'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {po.status?.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-mono font-bold text-white px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                              {formatNpr(po.totalAmount)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Supplier: <strong className="text-slate-200">{po.supplierName}</strong>
                            </span>
                            <span className="text-slate-500">|</span>
                            <span>PAN/VAT: <span className="font-mono text-slate-300">{po.supplierPan || 'N/A'}</span></span>
                            <span className="text-slate-500">|</span>
                            <span>Order Date: <span className="text-slate-300">{formatDualDate(po.orderDate)}</span></span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Print / View A4 PDF */}
                          <button
                            onClick={() => setPrintPoTarget(po)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
                            title="Print official A4 Purchase Order"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-400" />
                            <span>Print / PDF</span>
                          </button>

                          {/* Edit / Revise */}
                          {['draft', 'pending_approval'].includes(po.status) && (
                            <button
                              onClick={() => {
                                setEditingPoTarget(po);
                                setIsNewPoModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Edit PO</span>
                            </button>
                          )}

                          {/* Approve & Issue */}
                          {['draft', 'pending_approval'].includes(po.status) && (
                            <button
                              onClick={() => handleApprovePo(po)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {/* Receive Inward (GRN) */}
                          <button
                            onClick={() => {
                              setGrnForm((prev) => ({
                                ...prev,
                                purchaseOrderId: String(po.id),
                                supplierId: String(po.supplierId),
                              }));
                              setIsGrnModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            <span>Receive Inward</span>
                          </button>
                        </div>
                      </div>

                      {/* PO Items Table */}
                      {po.items && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-800/60 text-[10px] uppercase">
                                <th className="pb-2">SKU / Item</th>
                                <th className="pb-2 text-right">Qty Ordered</th>
                                <th className="pb-2 text-right">Qty Received</th>
                                <th className="pb-2 text-right">Unit Cost</th>
                                <th className="pb-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {po.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-2 text-white font-sans font-semibold">
                                    {item.description} ({item.sku})
                                  </td>
                                  <td className="py-2 text-right font-bold text-slate-300">{item.quantityOrdered}</td>
                                  <td className="py-2 text-right font-bold text-emerald-400">
                                    {item.quantityReceived}
                                  </td>
                                  <td className="py-2 text-right text-slate-400">
                                    Rs. {Number(item.unitCost).toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 text-right font-bold text-white">
                                    Rs. {Number(item.lineTotal).toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: WAREHOUSE BINS & OCCUPANCY GRID */}
          {/* ================================================================= */}
          {activeTab === 'bins' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-teal-400" />
                    <span>Warehouse Bins & Putaway Map</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Standard hierarchical structure: Zone &rarr; Rack &rarr; Shelf &rarr; Bin with scan-to-putaway tracking.
                  </p>
                </div>
                <button
                  onClick={() => setIsPutawayModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-900/40 border border-teal-400/40 transition-all flex items-center gap-2 self-start sm:self-auto"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Scan-to-Putaway</span>
                </button>
              </div>

              {/* Bins Grid */}
              {binsList.length === 0 ? (
                <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shadow-lg">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-bold text-white">No Warehouse Bins Configured</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Organize your storage space into Zones, Racks, Shelves, and Bins for streamlined scan-to-putaway and rapid order picking.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsPutawayModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-900/40 border border-teal-400/40 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Configure First Bin</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {binsList.map((bin) => {
                    const fillPct = Math.round((bin.currentUsage / Math.max(1, bin.capacityUnits)) * 100);
                    return (
                      <div
                        key={bin.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-teal-300">{bin.code}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            Zone {bin.zone}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white">{bin.description || 'General SKU Storage'}</div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Occupancy:</span>
                            <span className="font-mono font-bold text-white">
                              {bin.currentUsage} / {bin.capacityUnits} units ({fillPct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                fillPct > 80 ? 'bg-rose-500' : fillPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, fillPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: PHYSICAL STOCKTAKE / AUDIT SESSIONS */}
          {/* ================================================================= */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Physical Stocktake & Cycle Count Sessions</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Blind counting (system quantity hidden to prevent bias), variance calculation, recount flow, and PIN reconciliation.
                  </p>
                </div>
                <button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all flex items-center gap-2 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Stocktake Session</span>
                </button>
              </div>

              {/* Active Audit Session Interface */}
              {activeAuditSession && (
                <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          {activeAuditSession.sessionNumber}
                        </span>
                        <span className="text-xs text-white font-bold">{activeAuditSession.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Blind count active &bull; Scan barcodes to increment physical count
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPinActionTarget({ type: 'reconcile_audit', data: activeAuditSession });
                        setIsPinModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Reconcile with Manager PIN</span>
                    </button>
                  </div>

                  {/* Scan Input Trap */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanLine className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Scan Barcode / SKU here to count (+1)..."
                        value={auditScanInput}
                        onChange={(e) => setAuditScanInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && auditScanInput.trim()) {
                            e.preventDefault();
                            handleAuditScanIncrement(auditScanInput.trim());
                            setAuditScanInput('');
                          }
                        }}
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Audit Count Rows */}
                  <div className="overflow-x-auto max-h-96 scrollbar-thin">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                          <th className="pb-2">SKU / Product</th>
                          <th className="pb-2 text-right">Physical Count</th>
                          <th className="pb-2 text-right">System Qty</th>
                          <th className="pb-2 text-right">Variance Qty</th>
                          <th className="pb-2 text-right">Variance Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {activeAuditSession.items?.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-800/30">
                            <td className="py-2 text-white font-sans font-semibold">
                              {item.productName} ({item.sku})
                            </td>
                            <td className="py-2 text-right font-bold text-emerald-400">
                              {item.physicalCountQty}
                            </td>
                            <td className="py-2 text-right text-slate-400">
                              {item.systemQtySnapshot}
                            </td>
                            <td
                              className={`py-2 text-right font-bold ${
                                item.varianceQty === 0
                                  ? 'text-emerald-400'
                                  : item.varianceQty > 0
                                  ? 'text-blue-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                            </td>
                            <td className="py-2 text-right text-slate-300">
                              Rs. {Number(item.varianceValue).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Previous Audit Sessions */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="font-bold text-sm text-white">Previous Stocktake Sessions</h3>
                <div className="divide-y divide-slate-800">
                  {auditSessionsList.map((session) => (
                    <div key={session.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs font-bold text-white flex items-center gap-2">
                          <span>{session.sessionNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                              session.status === 'reconciled'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {session.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{session.title}</div>
                      </div>
                      <button
                        onClick={() => loadAuditSessionDetail(session.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: SERIAL & IMEI LIFECYCLE EXPLORER */}
          {/* ================================================================= */}
          {activeTab === 'serials' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-purple-400" />
                    <span>Serial Number & IMEI Full Lifecycle Explorer</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Track the chronological timeline of individual serialized units: Inward GRN &rarr; Warehouse Bin &rarr; POS Invoice &rarr; Customer Warranty &rarr; Factory RMA.
                  </p>
                </div>

                <form onSubmit={handleSerialSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Enter S/N (e.g. SN-DELL-894101), Invoice No, or SKU..."
                      value={serialQuery}
                      onChange={(e) => setSerialQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Lookup</span>
                  </button>
                </form>
              </div>

              {/* Serial Results Cards */}
              <div className="grid grid-cols-1 gap-4">
                {serialResults.map((unit) => (
                  <div
                    key={unit.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-purple-300">
                            S/N: {unit.serialNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                              unit.status === 'in_stock'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : unit.status === 'sold'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {unit.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-white font-semibold mt-0.5">
                          {unit.productName} ({unit.sku})
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setLabelProduct({
                              name: unit.productName,
                              sku: unit.sku,
                              barcode: unit.serialNumber,
                              price: unit.sellingPrice || 50000,
                            });
                            setIsLabelModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-all flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Unit Label</span>
                        </button>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <div className="text-[10px] text-slate-500">Inward GRN</div>
                        <div className="font-bold text-white">{unit.grnNumber || 'GRN-Direct'}</div>
                        <div className="text-[10px] text-slate-400">{unit.grnDate || 'N/A'}</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <div className="text-[10px] text-slate-500">Location / Bin</div>
                        <div className="font-bold text-teal-300">{unit.binCode || 'Main Floor'}</div>
                        <div className="text-[10px] text-slate-400">{unit.warehouseName || 'Warehouse'}</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <div className="text-[10px] text-slate-500">Sold Invoice</div>
                        <div className="font-bold text-blue-300">{unit.soldInvoiceNo || 'In Stock'}</div>
                        <div className="text-[10px] text-slate-400">
                          {unit.soldDate ? new Date(unit.soldDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <div className="text-[10px] text-slate-500">Warranty Expiry</div>
                        <div className="font-bold text-emerald-400">{unit.warrantyEndDate || '12 Months Active'}</div>
                        <div className="text-[10px] text-slate-400">{unit.warrantyMonths || 12} Mos Warranty</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 6: ENTERPRISE REPORTS & NEPAL IRD VAT REGISTER */}
          {/* ================================================================= */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <span>Nepal IRD VAT Purchase Register & Stock Valuation</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Compliant with Inland Revenue Department Nepal (अनुसूची-८ खरिद खाता), ABC category breakdown, and supplier quality scorecards.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedReportType}
                    onChange={(e) => {
                      setSelectedReportType(e.target.value);
                      fetchReports(e.target.value);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="valuation">Stock Valuation & Margins</option>
                    <option value="vat_purchase_register">Nepal IRD VAT Purchase Register (खरिद खाता)</option>
                    <option value="supplier_performance">Supplier Performance & Rejection Rate</option>
                  </select>
                </div>
              </div>

              {/* Render Selected Report Table */}
              {reportData && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-white">{reportData.title}</h3>
                      <div className="text-xs text-slate-400">
                        Total Records: <span className="font-mono font-bold text-white">{reportData.records?.length || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                          {selectedReportType === 'valuation' ? (
                            <>
                              <th className="pb-2">SKU</th>
                              <th className="pb-2">Product Title</th>
                              <th className="pb-2 text-right">On-Hand</th>
                              <th className="pb-2 text-right">Unit Cost</th>
                              <th className="pb-2 text-right">Retail Price</th>
                              <th className="pb-2 text-right">Cost Valuation</th>
                              <th className="pb-2 text-right">Gross Margin %</th>
                            </>
                          ) : selectedReportType === 'vat_purchase_register' ? (
                            <>
                              <th className="pb-2">Bill No</th>
                              <th className="pb-2">Bill Date</th>
                              <th className="pb-2">Supplier</th>
                              <th className="pb-2">PAN/VAT No</th>
                              <th className="pb-2 text-right">Taxable NPR</th>
                              <th className="pb-2 text-right">13% VAT</th>
                              <th className="pb-2 text-right">Total NPR</th>
                            </>
                          ) : (
                            <>
                              <th className="pb-2">Supplier Name</th>
                              <th className="pb-2">PAN / VAT</th>
                              <th className="pb-2 text-right">Total Orders</th>
                              <th className="pb-2 text-right">Total Spend NPR</th>
                              <th className="pb-2 text-right">On-Time Delivery %</th>
                              <th className="pb-2 text-right">Rejection Rate %</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {reportData.records?.slice(0, 30).map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            {selectedReportType === 'valuation' ? (
                              <>
                                <td className="py-2.5 font-bold text-white">{r.sku}</td>
                                <td className="py-2.5 font-sans text-slate-300 max-w-xs truncate">{r.name}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-400">{r.stockQuantity}</td>
                                <td className="py-2.5 text-right text-slate-400">Rs. {Number(r.unitCost).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right text-slate-400">Rs. {Number(r.unitRetailPrice).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right font-bold text-white">Rs. {Number(r.totalCostValuation).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-400">{r.grossMarginPct}%</td>
                              </>
                            ) : selectedReportType === 'vat_purchase_register' ? (
                              <>
                                <td className="py-2.5 font-bold text-white">{r.billNumber}</td>
                                <td className="py-2.5 text-slate-400">{r.billDate}</td>
                                <td className="py-2.5 font-sans text-slate-200">{r.supplierName}</td>
                                <td className="py-2.5 text-slate-400">{r.supplierPan || 'N/A'}</td>
                                <td className="py-2.5 text-right text-slate-300">Rs. {Number(r.subtotal).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right text-emerald-400">Rs. {Number(r.vatAmount).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right font-bold text-white">Rs. {Number(r.totalAmount).toLocaleString('en-IN')}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-2.5 font-sans font-bold text-white">{r.name}</td>
                                <td className="py-2.5 text-slate-400">{r.panVat}</td>
                                <td className="py-2.5 text-right font-bold text-slate-300">{r.totalOrders}</td>
                                <td className="py-2.5 text-right font-bold text-white">Rs. {Number(r.totalSpendNpr).toLocaleString('en-IN')}</td>
                                <td className="py-2.5 text-right text-emerald-400 font-bold">{r.onTimeDeliveryPct}%</td>
                                <td className="py-2.5 text-right text-rose-400 font-bold">{r.rejectionRatePct}%</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 7: WAREHOUSE ALERTS */}
          {/* ================================================================= */}
          {activeTab === 'alerts' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <span>Real-time Warehouse Operational Alerts</span>
                </h2>
                <div className="divide-y divide-slate-800">
                  {alertsList.map((alert) => (
                    <div key={alert.id} className="py-3 flex items-start gap-3">
                      <AlertTriangle
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          alert.severity === 'critical'
                            ? 'text-rose-400'
                            : alert.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">{alert.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{alert.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback rendering for movements, catalog, returns, warranty, damage tabs */}
          {activeTab === 'movements' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="font-bold text-sm text-white mb-4">Complete Inventory Movements Ledger</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Product</th>
                        <th className="pb-2 text-center">Delta</th>
                        <th className="pb-2 text-right">Balance</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {recentMovements.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2.5 text-slate-400">{new Date(m.createdAt).toLocaleString()}</td>
                          <td className="py-2.5 text-white font-sans font-semibold">{m.productName} ({m.sku})</td>
                          <td className="py-2.5 text-center font-bold">
                            <span className={m.quantityDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-white">{m.quantityAfter}</td>
                          <td className="py-2.5 uppercase text-[10px] font-bold text-slate-300">{m.reason}</td>
                          <td className="py-2.5 font-sans text-slate-400 max-w-xs truncate">{m.note || m.referenceNo || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: INWARD GRN (GOODS RECEIVED NOTE) */}
      {/* ===================================================================== */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Inward Goods Received Note (GRN)</h3>
                  <p className="text-[11px] text-slate-400">3-Way Match & Landed Cost Apportioning</p>
                </div>
              </div>
              <button onClick={() => setIsGrnModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrnSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier</label>
                  <select
                    value={grnForm.supplierId}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (PAN: {s.vatPanNo || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Bill / Invoice No</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-904"
                    value={grnForm.supplierInvoiceNo}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierInvoiceNo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Scan Barcode / SKU / Model <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <ScanLine className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    required
                    placeholder="Scan EAN-13, Code128, or SKU..."
                    value={grnForm.barcodeOrSku}
                    onChange={(e) => setGrnForm({ ...grnForm, barcodeOrSku: e.target.value })}
                    className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity Received</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={grnForm.quantityReceived}
                    onChange={(e) => setGrnForm({ ...grnForm, quantityReceived: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Cost Price (NPR)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 65000"
                    value={grnForm.unitCost}
                    onChange={(e) => setGrnForm({ ...grnForm, unitCost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Freight Overheads</label>
                  <input
                    type="number"
                    value={grnForm.freightCost}
                    onChange={(e) => setGrnForm({ ...grnForm, freightCost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Customs / Handling</label>
                  <input
                    type="number"
                    value={grnForm.customsHandlingCost}
                    onChange={(e) => setGrnForm({ ...grnForm, customsHandlingCost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Trade Discount</label>
                  <input
                    type="number"
                    value={grnForm.discount}
                    onChange={(e) => setGrnForm({ ...grnForm, discount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Serial Numbers / IMEIs (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Scan or paste serial numbers for laptops, printers, CCTV..."
                  value={grnForm.serialsText}
                  onChange={(e) => setGrnForm({ ...grnForm, serialsText: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">QC Inspection Status</label>
                  <select
                    value={grnForm.qcStatus}
                    onChange={(e) => setGrnForm({ ...grnForm, qcStatus: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="accepted">Accepted (Passes Quality Gate)</option>
                    <option value="rejected">Rejected (Auto-generate Debit Note)</option>
                  </select>
                </div>
                {grnForm.qcStatus === 'rejected' && (
                  <div>
                    <label className="block text-xs font-semibold text-rose-300 mb-1">Rejection Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Physical box crushed, seal broken"
                      value={grnForm.rejectionReason}
                      onChange={(e) => setGrnForm({ ...grnForm, rejectionReason: e.target.value })}
                      className="w-full bg-slate-950 border border-rose-500/50 rounded-xl px-3 py-2 text-xs text-rose-200"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Inward GRN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: MANAGER PIN GATE MODAL */}
      {/* ===================================================================== */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Manager Security PIN Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                This transaction involves physical stock reconciliation or financial procurement above authorization thresholds.
              </p>
            </div>
            <input
              type="password"
              maxLength={6}
              autoFocus
              placeholder="Enter 4-digit PIN"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setManagerPin('');
                }}
                className="w-1/2 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pinActionTarget?.type === 'approve_po') {
                    executeApprovePo(pinActionTarget.data.id, managerPin);
                  } else if (pinActionTarget?.type === 'reconcile_audit') {
                    handleReconcileAuditWithPin();
                  }
                }}
                className="w-1/2 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ENTERPRISE CREATE PURCHASE ORDER MODAL                                */}
      {/* ===================================================================== */}
      {isNewPoModalOpen && (
        <CreatePurchaseOrderModal
          isOpen={isNewPoModalOpen}
          onClose={() => {
            setIsNewPoModalOpen(false);
            setEditingPoTarget(null);
          }}
          onSuccess={(po, msg) => {
            showToast('success', msg);
            fetchPurchaseOrders();
          }}
          products={watchlist.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            brand: (p as any).brand,
            costPrice: p.costPrice,
            price: p.price,
            stockQuantity: p.stockQuantity,
            lowStockThreshold: p.lowStockThreshold,
            requiresSerial: (p as any).requiresSerial,
          }))}
          suppliers={suppliersList}
          currentUser={currentUser}
          initialData={editingPoTarget}
        />
      )}

      {/* ===================================================================== */}
      {/* ENTERPRISE PURCHASE ORDER PRINT / SHARE MODAL                        */}
      {/* ===================================================================== */}
      {printPoTarget && (
        <PurchaseOrderPrintModal
          isOpen={Boolean(printPoTarget)}
          onClose={() => setPrintPoTarget(null)}
          purchaseOrder={printPoTarget}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: PUTAWAY SERIAL INTO BIN */}
      {/* ===================================================================== */}
      {isPutawayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm text-white">Scan-to-Putaway Item</h3>
              </div>
              <button onClick={() => setIsPutawayModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePutawaySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Serial Number / SKU</label>
                <input
                  type="text"
                  required
                  placeholder="Scan serial number..."
                  value={putawayForm.serialNumber}
                  onChange={(e) => setPutawayForm({ ...putawayForm, serialNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Destination Bin Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WH1-Z-A-R01-S1-B01"
                  value={putawayForm.binCode}
                  onChange={(e) => setPutawayForm({ ...putawayForm, binCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPutawayModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-lg"
                >
                  Confirm Putaway
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
