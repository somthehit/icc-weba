'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Calendar,
  Building2,
  DollarSign,
  FileText,
  Upload,
  ArrowRight,
  ShieldAlert,
  Search,
  Check,
  ChevronDown,
  Layers,
  Sparkles,
  Info,
  Clock,
  KeyRound,
  FileSpreadsheet,
  Copy,
} from 'lucide-react';
import { calculatePoTotals, CalculatedPoLine, PoTotalsSummary } from '@/lib/procurement/po-calculator';
import { purchaseOrderFormSchema, PurchaseOrderLineInput } from '@/lib/procurement/po-validation';
import { formatNpr } from '@/lib/nepal/money';
import { adToBs, formatDualDate, getCurrentFiscalYear } from '@/lib/nepal/date';

interface ProductItem {
  id: string | number;
  name: string;
  sku: string;
  barcode?: string | null;
  brand?: string | null;
  costPrice?: number | string | null;
  price?: number | string | null;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
  requiresSerial?: boolean | null;
}

interface SupplierItem {
  id: string | number;
  name: string;
  vatPanNo?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  isActive?: boolean;
  creditDays?: number;
  leadTimeDays?: number;
  currentBalance?: string | number;
}

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (po: any, message: string) => void;
  products: ProductItem[];
  suppliers: SupplierItem[];
  currentUser?: {
    id?: number | string;
    name?: string;
    role?: string;
  } | null;
  initialData?: any;
}

const DEFAULT_LOCATIONS = [
  'Main Store - Dhangadhi (Showroom)',
  'Central Distribution Warehouse (Attariya)',
  'Service & Warranty Hub (Dhangadhi)',
];

const PAYMENT_TERMS_OPTIONS = [
  'Credit 30 Days',
  'Credit 15 Days',
  'Credit 45 Days',
  'Cash on Delivery (COD)',
  '100% Advance Payment',
  '50% Advance, 50% on Delivery',
];

const UNIT_OF_MEASURE_OPTIONS = ['Pcs', 'Box', 'Set', 'Roll', 'Kg', 'Pack', 'Meter'];

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  suppliers,
  currentUser,
  initialData,
}) => {
  // Fiscal year & next PO number preview
  const currentFiscalYear = useMemo(() => getCurrentFiscalYear(), []);
  const [poNumberPreview, setPoNumberPreview] = useState<string>('PO-2082-83-XXXX');

  // Form State
  const [supplierId, setSupplierId] = useState<number | string>(suppliers[0]?.id || '');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliverToLocation, setDeliverToLocation] = useState<string>(DEFAULT_LOCATIONS[0]);
  const [billingReference, setBillingReference] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('Credit 30 Days');
  const [currency, setCurrency] = useState<'NPR' | 'USD' | 'INR'>('NPR');
  const [exchangeRate, setExchangeRate] = useState<number>(1.0);
  const [supplierQuoteNo, setSupplierQuoteNo] = useState<string>('');
  const [otherCharges, setOtherCharges] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [attachmentRef, setAttachmentRef] = useState<string>('');

  // Date view mode toggle (AD vs BS)
  const [dateDisplayMode, setDateDisplayMode] = useState<'AD' | 'BS'>('AD');

  // Line items state
  const [lines, setLines] = useState<PurchaseOrderLineInput[]>([]);

  // Search & Selector State
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [activeProductSearchRowIndex, setActiveProductSearchRowIndex] = useState<number | null>(null);
  const [productSearchQueries, setProductSearchQueries] = useState<{ [rowIdx: number]: string }>({});

  // UI status, errors & feedback
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Approval PIN verification modal for direct "Approve & Issue"
  const [showPinModal, setShowPinModal] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingAction, setPendingAction] = useState<'save_draft' | 'submit_for_approval' | 'direct_approve'>('submit_for_approval');

  // Bulk CSV import modal
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Selected supplier details
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => String(s.id) === String(supplierId));
  }, [suppliers, supplierId]);

  // Lead time auto-calculation when supplier changes
  useEffect(() => {
    if (selectedSupplier && !expectedDeliveryDate) {
      const leadTime = selectedSupplier.leadTimeDays || 7;
      const d = new Date(orderDate || new Date().toISOString().slice(0, 10));
      d.setDate(d.getDate() + leadTime);
      setExpectedDeliveryDate(d.toISOString().slice(0, 10));
      if (selectedSupplier.creditDays) {
        setPaymentTerms(`Credit ${selectedSupplier.creditDays} Days`);
      }
    }
  }, [selectedSupplier, orderDate, expectedDeliveryDate]);

  // Load Initial Data or Prefills
  useEffect(() => {
    if (initialData) {
      if (initialData.supplierId) setSupplierId(initialData.supplierId);
      if (initialData.orderDate) setOrderDate(initialData.orderDate);
      if (initialData.expectedDeliveryDate) setExpectedDeliveryDate(initialData.expectedDeliveryDate);
      if (initialData.deliverToLocation) setDeliverToLocation(initialData.deliverToLocation);
      if (initialData.billingReference) setBillingReference(initialData.billingReference);
      if (initialData.paymentTerms) setPaymentTerms(initialData.paymentTerms);
      if (initialData.currency) setCurrency(initialData.currency);
      if (initialData.exchangeRate) setExchangeRate(initialData.exchangeRate);
      if (initialData.supplierQuoteNo) setSupplierQuoteNo(initialData.supplierQuoteNo);
      if (initialData.otherCharges) setOtherCharges(String(initialData.otherCharges));
      if (initialData.notes) setNotes(initialData.notes);
      if (initialData.internalNotes) setInternalNotes(initialData.internalNotes);
      if (initialData.items && Array.isArray(initialData.items) && initialData.items.length > 0) {
        setLines(
          initialData.items.map((it: any) => ({
            id: it.id || Math.random().toString(),
            productId: it.productId ? Number(it.productId) : null,
            sku: it.sku || '',
            supplierPartNo: it.supplierPartNo || '',
            description: it.description || it.productName || '',
            quantityOrdered: Number(it.quantityOrdered) || Number(it.suggestedQty) || 1,
            unitOfMeasure: it.unitOfMeasure || 'Pcs',
            unitCost: Number(it.unitCost) || Number(it.estimatedUnitCost) || 0,
            discountPercent: Number(it.discountPercent) || 0,
            discountAmount: Number(it.discountAmount) || 0,
            taxCategory: it.taxCategory === 'exempt' ? 'exempt' : 'vat_13',
            vatRate: 13,
            vatAmount: 0,
            lineTotal: 0,
            requiresSerial: Boolean(it.requiresSerial),
            lastPurchaseCost: it.lastPurchaseCost ? Number(it.lastPurchaseCost) : undefined,
            averageCost: it.averageCost ? Number(it.averageCost) : undefined,
            currentStock: it.currentStock !== undefined ? Number(it.currentStock) : undefined,
            expectedSellingPrice: it.expectedSellingPrice ? Number(it.expectedSellingPrice) : undefined,
          }))
        );
      }
    } else if (lines.length === 0) {
      // Start with 1 clean empty line (NO prefill of 10 or 1000)
      setLines([
        {
          id: Math.random().toString(),
          productId: null,
          sku: '',
          supplierPartNo: '',
          description: '',
          quantityOrdered: 0, // Starts 0 / empty
          unitOfMeasure: 'Pcs',
          unitCost: 0, // Starts 0 / empty
          discountPercent: 0,
          discountAmount: 0,
          taxCategory: 'vat_13',
          vatRate: 13,
          vatAmount: 0,
          lineTotal: 0,
          requiresSerial: false,
        },
      ]);
    }
  }, [initialData]);

  // Fetch sequential PO preview number from server
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/admin/inventory/purchase-orders')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.nextPreviewPoNumber) {
          setPoNumberPreview(res.nextPreviewPoNumber);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Live Totals & Landed Cost Calculation
  const totalsSummary: PoTotalsSummary = useMemo(() => {
    return calculatePoTotals(lines, parseFloat(otherCharges) || 0);
  }, [lines, otherCharges]);

  // Filtered suppliers for search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery) return suppliers;
    const q = supplierSearchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.vatPanNo && s.vatPanNo.includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearchQuery]);

  // Filtered products for line item product picker
  const getFilteredProducts = (query: string) => {
    if (!query) return products.slice(0, 15);
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      )
      .slice(0, 20);
  };

  // Add new empty line
  const handleAddLine = () => {
    setIsDirty(true);
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        productId: null,
        sku: '',
        supplierPartNo: '',
        description: '',
        quantityOrdered: 0,
        unitOfMeasure: 'Pcs',
        unitCost: 0,
        discountPercent: 0,
        discountAmount: 0,
        taxCategory: 'vat_13',
        vatRate: 13,
        vatAmount: 0,
        lineTotal: 0,
        requiresSerial: false,
      },
    ]);
  };

  // Add low-stock products to lines
  const handleAddFromLowStock = () => {
    setIsDirty(true);
    const lowStockItems = products.filter(
      (p) => (p.stockQuantity ?? 0) <= (p.lowStockThreshold ?? 3)
    );

    if (lowStockItems.length === 0) {
      alert('No low-stock products found to add.');
      return;
    }

    const newRows: PurchaseOrderLineInput[] = lowStockItems.map((p) => {
      const lastCost = Number(p.costPrice) || Number(p.price || 0) * 0.75;
      const targetStock = (p.lowStockThreshold || 3) * 3;
      const suggestedQty = Math.max(5, targetStock - (p.stockQuantity ?? 0));

      return {
        id: Math.random().toString(),
        productId: String(p.id),
        sku: p.sku,
        supplierPartNo: '',
        description: p.name,
        quantityOrdered: suggestedQty,
        unitOfMeasure: 'Pcs',
        unitCost: lastCost,
        discountPercent: 0,
        discountAmount: 0,
        taxCategory: 'vat_13',
        vatRate: 13,
        vatAmount: 0,
        lineTotal: 0,
        requiresSerial: Boolean(p.requiresSerial),
        lastPurchaseCost: lastCost,
        currentStock: p.stockQuantity ?? 0,
        expectedSellingPrice: Number(p.price || 0),
      };
    });

    // Replace first empty line or append
    setLines((prev) => {
      const activeRows = prev.filter((r) => r.sku || r.description);
      return [...activeRows, ...newRows];
    });
  };

  // Select a product into a specific row
  const handleSelectProduct = (rowIdx: number, p: ProductItem) => {
    setIsDirty(true);
    const lastCost = Number(p.costPrice) || Number(p.price || 0) * 0.75;
    const currentStock = p.stockQuantity ?? 0;
    const threshold = p.lowStockThreshold ?? 3;
    const suggestedQty = Math.max(1, threshold * 2 - currentStock);

    setLines((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        ...next[rowIdx],
        productId: String(p.id),
        sku: p.sku,
        description: p.name,
        unitCost: lastCost > 0 ? lastCost : 0,
        quantityOrdered: suggestedQty > 0 ? suggestedQty : 1,
        lastPurchaseCost: lastCost > 0 ? lastCost : undefined,
        currentStock,
        expectedSellingPrice: Number(p.price || 0),
        requiresSerial: Boolean(p.requiresSerial),
      };
      return next;
    });

    setActiveProductSearchRowIndex(null);
  };

  // Update specific field in a line
  const handleLineChange = (rowIdx: number, field: keyof PurchaseOrderLineInput, value: any) => {
    setIsDirty(true);
    setLines((prev) => {
      const next = [...prev];
      next[rowIdx] = {
        ...next[rowIdx],
        [field]: value,
      };
      return next;
    });
  };

  // Delete line
  const handleDeleteLine = (rowIdx: number) => {
    setIsDirty(true);
    setLines((prev) => {
      const next = prev.filter((_, idx) => idx !== rowIdx);
      if (next.length === 0) {
        return [
          {
            id: Math.random().toString(),
            productId: null,
            sku: '',
            supplierPartNo: '',
            description: '',
            quantityOrdered: 0,
            unitOfMeasure: 'Pcs',
            unitCost: 0,
            discountPercent: 0,
            discountAmount: 0,
            taxCategory: 'vat_13',
            vatRate: 13,
            vatAmount: 0,
            lineTotal: 0,
            requiresSerial: false,
          },
        ];
      }
      return next;
    });
  };

  // Duplicate line
  const handleDuplicateLine = (rowIdx: number) => {
    setIsDirty(true);
    setLines((prev) => {
      const itemToDup = prev[rowIdx];
      const next = [...prev];
      next.splice(rowIdx + 1, 0, {
        ...itemToDup,
        id: Math.random().toString(),
      });
      return next;
    });
  };

  // Parse Bulk CSV Paste
  const handleProcessCsvImport = () => {
    if (!csvText.trim()) return;
    const rows = csvText.split('\n').map((r) => r.trim()).filter(Boolean);
    const importedLines: PurchaseOrderLineInput[] = [];

    for (const row of rows) {
      // Format: SKU, Description, Qty, Unit Cost, Unit
      const parts = row.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const sku = parts[0];
        const desc = parts[1];
        const qty = parseInt(parts[2] || '1', 10) || 1;
        const cost = parseFloat(parts[3] || '0') || 0;
        const uom = parts[4] || 'Pcs';

        // Try to match catalog product
        const matched = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());

        importedLines.push({
          id: Math.random().toString(),
          productId: matched?.id ? String(matched.id) : null,
          sku: sku || matched?.sku || 'UNKNOWN',
          description: desc || matched?.name || 'Imported item',
          quantityOrdered: qty,
          unitCost: cost > 0 ? cost : Number(matched?.costPrice || 0),
          unitOfMeasure: uom,
          discountPercent: 0,
          discountAmount: 0,
          taxCategory: 'vat_13',
          vatRate: 13,
          vatAmount: 0,
          lineTotal: 0,
          requiresSerial: Boolean(matched?.requiresSerial),
        });
      }
    }

    if (importedLines.length > 0) {
      setIsDirty(true);
      setLines((prev) => {
        const clean = prev.filter((r) => r.sku && r.quantityOrdered > 0);
        return [...clean, ...importedLines];
      });
      setShowCsvImportModal(false);
      setCsvText('');
    }
  };

  // Form Validation & Submission
  const validateAndSubmit = async (action: 'save_draft' | 'submit_for_approval' | 'direct_approve', pin?: string) => {
    setErrors({});
    const cleanLines = lines.filter((l) => l.sku.trim() || l.description.trim());

    if (cleanLines.length === 0) {
      setErrors({ lines: 'Please add at least one valid line item with product or SKU.' });
      return;
    }

    // Check for lines with zero qty or unit cost
    for (let i = 0; i < cleanLines.length; i++) {
      const line = cleanLines[i];
      if (!line.quantityOrdered || line.quantityOrdered <= 0) {
        setErrors({ [`line_${i}_qty`]: `Line #${i + 1}: Quantity must be at least 1.` });
        return;
      }
      if (!line.unitCost || line.unitCost <= 0) {
        setErrors({ [`line_${i}_cost`]: `Line #${i + 1}: Unit cost must be greater than NPR 0.00.` });
        return;
      }
    }

    const payload = {
      supplierId: Number(supplierId),
      fiscalYear: currentFiscalYear,
      orderDate,
      expectedDeliveryDate: expectedDeliveryDate || orderDate,
      deliverToLocation,
      billingReference,
      paymentTerms,
      currency,
      exchangeRate: Number(exchangeRate) || 1.0,
      supplierQuoteNo,
      otherCharges: parseFloat(otherCharges) || 0,
      notes,
      internalNotes,
      items: cleanLines.map((l) => ({
        productId: l.productId ? Number(l.productId) : null,
        sku: l.sku,
        supplierPartNo: l.supplierPartNo || '',
        description: l.description,
        quantityOrdered: Number(l.quantityOrdered),
        unitOfMeasure: l.unitOfMeasure || 'Pcs',
        unitCost: Number(l.unitCost),
        discountPercent: Number(l.discountPercent) || 0,
        discountAmount: Number(l.discountAmount) || 0,
        taxCategory: l.taxCategory,
        vatRate: 13,
        requiresSerial: Boolean(l.requiresSerial),
        lastPurchaseCost: l.lastPurchaseCost ? Number(l.lastPurchaseCost) : undefined,
        currentStock: l.currentStock !== undefined ? Number(l.currentStock) : undefined,
        expectedSellingPrice: l.expectedSellingPrice ? Number(l.expectedSellingPrice) : undefined,
      })),
    };

    // Client-side Zod validation
    const parsed = purchaseOrderFormSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: { [k: string]: string } = {};
      parsed.error.issues.forEach((iss) => {
        fieldErrors[iss.path.join('.')] = iss.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'direct_approve' ? 'create' : action,
          ...payload,
          createdByName: currentUser?.name || 'Purchase Officer',
          createdById: currentUser?.id ? Number(currentUser.id) : undefined,
          supervisorPin: pin,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // If direct approve was requested with PIN
        if (action === 'direct_approve' && pin && data.purchaseOrder?.id) {
          const approveRes = await fetch('/api/admin/inventory/purchase-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'approve',
              poId: data.purchaseOrder.id,
              approverName: currentUser?.name || 'Supervisor',
              approverId: currentUser?.id ? Number(currentUser.id) : undefined,
              supervisorPin: pin,
            }),
          });
          const approveData = await approveRes.json();
          if (approveData.success) {
            onSuccess(approveData.purchaseOrder, approveData.message);
            onClose();
            return;
          } else {
            alert(`PO created, but approval failed: ${approveData.error}`);
            onSuccess(data.purchaseOrder, 'PO created (approval pending)');
            onClose();
            return;
          }
        }

        onSuccess(data.purchaseOrder, data.message || 'Purchase Order processed successfully!');
        onClose();
      } else {
        setErrors({ form: data.error || 'Failed to submit Purchase Order.' });
      }
    } catch {
      setErrors({ form: 'Network error communicating with the server.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut listener (Ctrl+S for Draft, Ctrl+Enter for Submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        validateAndSubmit('save_draft');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        validateAndSubmit('submit_for_approval');
      } else if (e.key === 'Escape' && !showPinModal && !showCsvImportModal) {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lines, supplierId, orderDate, expectedDeliveryDate, otherCharges, showPinModal, showCsvImportModal]);

  const handleSafeClose = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes in this Purchase Order. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-hidden">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl h-[95vh] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* =================================================================== */}
        {/* MODAL HEADER                                                        */}
        {/* =================================================================== */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-inner">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white tracking-wide">Create Purchase Order</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono text-xs font-bold">
                  {poNumberPreview}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono text-[11px]">
                  FY: {currentFiscalYear}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official procurement order for hardware restock, VAT invoicing, and automated 3-way GRN matching.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Action: Add from low stock */}
            <button
              type="button"
              onClick={handleAddFromLowStock}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Populate lines with products below safety stock"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Low-Stock</span>
            </button>

            {/* Quick Action: Bulk CSV Import */}
            <button
              type="button"
              onClick={() => setShowCsvImportModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Paste</span>
            </button>

            {/* Close Button */}
            <button
              onClick={handleSafeClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errors.form && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL BODY (SCROLLABLE)                                             */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* 1. HEADER SECTION (Supplier & Logistics Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            
            {/* Supplier Selector Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Supplier Details</span>
                </label>
                {selectedSupplier && !selectedSupplier.vatPanNo && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3" /> No PAN (VAT Risk)
                  </span>
                )}
              </div>

              {/* Searchable Supplier Dropdown */}
              <div className="relative">
                <select
                  value={supplierId}
                  onChange={(e) => {
                    setIsDirty(true);
                    setSupplierId(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.vatPanNo ? `(PAN: ${s.vatPanNo})` : '(No PAN)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Supplier Micro-Card */}
              {selectedSupplier && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Contact Person:</span>
                    <span className="text-slate-200 font-medium">{selectedSupplier.contactPerson || 'Procurement Rep'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Phone:</span>
                    <span className="text-slate-200 font-mono">{selectedSupplier.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lead Time:</span>
                    <span className="text-blue-300 font-medium">{selectedSupplier.leadTimeDays || 7} Days</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Outstanding AP:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {formatNpr(selectedSupplier.currentBalance || 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dates & Logistics Column */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Order Dates & Location</span>
                </label>
                {/* BS / AD Date Toggle */}
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDateDisplayMode('AD')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                      dateDisplayMode === 'AD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    AD
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateDisplayMode('BS')}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                      dateDisplayMode === 'BS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    BS (नेपाली)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">
                    Order Date {dateDisplayMode === 'BS' ? `(${adToBs(orderDate).formattedBS} BS)` : ''}
                  </span>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => {
                      setIsDirty(true);
                      setOrderDate(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  {errors['orderDate'] && <p className="text-[10px] text-rose-400 mt-0.5">{errors['orderDate']}</p>}
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">
                    Expected Delivery {expectedDeliveryDate && dateDisplayMode === 'BS' ? `(${adToBs(expectedDeliveryDate).formattedBS} BS)` : ''}
                  </span>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => {
                      setIsDirty(true);
                      setExpectedDeliveryDate(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  {errors['expectedDeliveryDate'] && (
                    <p className="text-[10px] text-rose-400 mt-0.5">{errors['expectedDeliveryDate']}</p>
                  )}
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Deliver-To Warehouse/Store</span>
                <select
                  value={deliverToLocation}
                  onChange={(e) => {
                    setIsDirty(true);
                    setDeliverToLocation(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                >
                  {DEFAULT_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Financial Terms & Reference Column */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Terms & Commercial Ref</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">Payment Terms</span>
                  <select
                    value={paymentTerms}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPaymentTerms(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">Currency</span>
                  <div className="flex gap-1">
                    <select
                      value={currency}
                      onChange={(e) => {
                        setIsDirty(true);
                        const c = e.target.value as any;
                        setCurrency(c);
                        setExchangeRate(c === 'USD' ? 134.5 : c === 'INR' ? 1.6 : 1.0);
                      }}
                      className="w-20 bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    >
                      <option value="NPR">NPR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                    {currency !== 'NPR' && (
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex. Rate"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1.5 text-xs text-white font-mono"
                        title="Exchange rate to NPR"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">Supplier Quotation / Ref #</span>
                  <input
                    type="text"
                    placeholder="e.g. QT-9942"
                    value={supplierQuoteNo}
                    onChange={(e) => {
                      setIsDirty(true);
                      setSupplierQuoteNo(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">Billing / Shipping Ref</span>
                  <input
                    type="text"
                    placeholder="e.g. DGD-PO-REF"
                    value={billingReference}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBillingReference(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* 2. MULTI-LINE ITEMS TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>Purchase Order Line Items</span>
                </label>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
                  {lines.length} {lines.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/30 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>
            </div>

            {errors.lines && <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl">{errors.lines}</p>}

            {/* Table Container */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 text-[11px] font-semibold border-b border-slate-800">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[280px]">Product / Item Description</th>
                      <th className="py-2.5 px-2 w-28">Part #</th>
                      <th className="py-2.5 px-2 w-20 text-center">UoM</th>
                      <th className="py-2.5 px-2 w-24 text-right">Qty</th>
                      <th className="py-2.5 px-2 w-28 text-right">Unit Cost (Rs)</th>
                      <th className="py-2.5 px-2 w-20 text-right">Disc %</th>
                      <th className="py-2.5 px-2 w-24 text-center">Tax Cat</th>
                      <th className="py-2.5 px-3 w-28 text-right font-bold">Line Total</th>
                      <th className="py-2.5 px-2 w-24 text-right text-slate-400">Landed / Unit</th>
                      <th className="py-2.5 px-2 w-14 text-center">Serial</th>
                      <th className="py-2.5 px-2 w-14 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {lines.map((line, idx) => {
                      const calculatedLine = totalsSummary.lines[idx];
                      const hasPriceVariance = calculatedLine?.isPriceVariance;
                      const variancePct = calculatedLine?.priceVariancePercent || 0;

                      return (
                        <tr
                          key={line.id || idx}
                          className="hover:bg-slate-900/50 transition-colors group"
                        >
                          {/* S.N. */}
                          <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Product Search & Picker */}
                          <td className="py-3 px-3 relative">
                            <div className="space-y-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Search by name, SKU, or barcode..."
                                  value={line.description || line.sku}
                                  onChange={(e) => {
                                    handleLineChange(idx, 'description', e.target.value);
                                    if (!line.sku) {
                                      handleLineChange(idx, 'sku', e.target.value.slice(0, 15).toUpperCase());
                                    }
                                    setProductSearchQueries({
                                      ...productSearchQueries,
                                      [idx]: e.target.value,
                                    });
                                    setActiveProductSearchRowIndex(idx);
                                  }}
                                  onFocus={() => {
                                    setProductSearchQueries({
                                      ...productSearchQueries,
                                      [idx]: line.description || '',
                                    });
                                    setActiveProductSearchRowIndex(idx);
                                  }}
                                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                                />
                                {line.productId && (
                                  <span className="absolute right-2 top-2 text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3" /> Master Linked
                                  </span>
                                )}
                              </div>

                              {/* Search Dropdown Modal */}
                              {activeProductSearchRowIndex === idx && (
                                <div className="absolute left-3 top-12 z-50 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                  <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Select product from inventory catalog:</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveProductSearchRowIndex(null)}
                                      className="hover:text-white"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="divide-y divide-slate-800/60">
                                    {getFilteredProducts(productSearchQueries[idx] || '').map((p) => (
                                      <div
                                        key={p.id}
                                        onClick={() => handleSelectProduct(idx, p)}
                                        className="p-2.5 hover:bg-blue-600/20 cursor-pointer transition-colors"
                                      >
                                        <div className="flex justify-between items-start">
                                          <div className="font-semibold text-xs text-white">{p.name}</div>
                                          <div className="font-mono text-emerald-400 font-bold text-xs">
                                            {formatNpr(p.costPrice || 0)}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                                          <span>SKU: {p.sku}</span>
                                          {p.barcode && <span>Bar: {p.barcode}</span>}
                                          <span className="text-blue-300">
                                            Stock: {p.stockQuantity ?? 0} (Min: {p.lowStockThreshold ?? 3})
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                    {getFilteredProducts(productSearchQueries[idx] || '').length === 0 && (
                                      <div className="p-4 text-center text-xs text-slate-400">
                                        No inventory product found matching query.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Micro Badges: Stock, Last Cost, Gross Margin */}
                              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                {line.currentStock !== undefined && (
                                  <span className="text-slate-400">Stock: {line.currentStock}</span>
                                )}
                                {line.lastPurchaseCost != null && line.lastPurchaseCost > 0 && (
                                  <span className="text-slate-400">
                                    Last: {formatNpr(line.lastPurchaseCost, { showFraction: false })}
                                  </span>
                                )}
                                {calculatedLine && calculatedLine.expectedMarginPercent > 0 && (
                                  <span
                                    className={
                                      calculatedLine.expectedMarginPercent < 10
                                        ? 'text-amber-400 font-bold'
                                        : 'text-emerald-400'
                                    }
                                  >
                                    Margin: {calculatedLine.expectedMarginPercent}%
                                  </span>
                                )}
                                {hasPriceVariance && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[9px] flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> {variancePct > 0 ? `+${variancePct}%` : `${variancePct}%`} Var
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Supplier Part No */}
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              placeholder="Part #"
                              value={line.supplierPartNo || ''}
                              onChange={(e) => handleLineChange(idx, 'supplierPartNo', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                            />
                          </td>

                          {/* Unit of Measure */}
                          <td className="py-3 px-2 text-center">
                            <select
                              value={line.unitOfMeasure || 'Pcs'}
                              onChange={(e) => handleLineChange(idx, 'unitOfMeasure', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-1 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500 font-medium"
                            >
                              {UNIT_OF_MEASURE_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={line.quantityOrdered || ''}
                              onChange={(e) =>
                                handleLineChange(idx, 'quantityOrdered', parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-full bg-slate-900 border rounded-xl px-2 py-1 text-xs text-right font-mono font-bold text-white focus:outline-none ${
                                !line.quantityOrdered
                                  ? 'border-amber-500/60 bg-amber-500/5'
                                  : 'border-slate-700/80 focus:border-blue-500'
                              }`}
                            />
                            {errors[`line_${idx}_qty`] && (
                              <p className="text-[9px] text-rose-400 text-right">{errors[`line_${idx}_qty`]}</p>
                            )}
                          </td>

                          {/* Unit Cost */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={line.unitCost || ''}
                              onChange={(e) =>
                                handleLineChange(idx, 'unitCost', parseFloat(e.target.value) || 0)
                              }
                              className={`w-full bg-slate-900 border rounded-xl px-2 py-1 text-xs text-right font-mono font-bold text-white focus:outline-none ${
                                !line.unitCost
                                  ? 'border-amber-500/60 bg-amber-500/5'
                                  : 'border-slate-700/80 focus:border-blue-500'
                              }`}
                            />
                            {errors[`line_${idx}_cost`] && (
                              <p className="text-[9px] text-rose-400 text-right">{errors[`line_${idx}_cost`]}</p>
                            )}
                          </td>

                          {/* Discount % */}
                          <td className="py-3 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={line.discountPercent || 0}
                              onChange={(e) =>
                                handleLineChange(idx, 'discountPercent', parseFloat(e.target.value) || 0)
                              }
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-1.5 py-1 text-xs text-right font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                            />
                          </td>

                          {/* Tax Category */}
                          <td className="py-3 px-2 text-center">
                            <select
                              value={line.taxCategory || 'vat_13'}
                              onChange={(e) => handleLineChange(idx, 'taxCategory', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-1 py-1 text-[11px] text-white text-center focus:outline-none focus:border-blue-500 font-semibold"
                            >
                              <option value="vat_13">VAT 13%</option>
                              <option value="exempt">Exempt 0%</option>
                            </select>
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-white text-xs">
                            {formatNpr(calculatedLine?.lineTotalCalculated || 0, { showCurrency: false })}
                          </td>

                          {/* Landed Cost Per Unit */}
                          <td className="py-3 px-2 text-right font-mono text-[11px] text-slate-400">
                            {formatNpr(calculatedLine?.landedCostPerUnit || 0, { showCurrency: false })}
                          </td>

                          {/* Requires Serial Toggle */}
                          <td className="py-3 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(line.requiresSerial)}
                              onChange={(e) => handleLineChange(idx, 'requiresSerial', e.target.checked)}
                              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                              title="Check if laptop/phone/CCTV requiring serial scanning at GRN"
                            />
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleDuplicateLine(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                title="Duplicate Row"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLine(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                title="Delete Line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. NOTES, INTERNAL NOTES & OTHER CHARGES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Notes to Supplier */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Notes to Supplier (Printed on PO)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Shipping instructions, packaging marks, delivery window..."
                value={notes}
                onChange={(e) => {
                  setIsDirty(true);
                  setNotes(e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Internal Notes (Confidential, Not Printed)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Reason for order, budget allocation, approval rationale..."
                value={internalNotes}
                onChange={(e) => {
                  setIsDirty(true);
                  setInternalNotes(e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Freight / Other Charges Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Other Charges (Freight, Customs, Handling)</span>
              </label>
              <div className="space-y-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={otherCharges}
                  onChange={(e) => {
                    setIsDirty(true);
                    setOtherCharges(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2 text-xs font-mono text-right text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
                <p className="text-[10px] text-slate-400">
                  Apportioned to lines to compute true landed cost and expected gross margin.
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* =================================================================== */}
        {/* STICKY FOOTER: FINANCIAL TOTALS & ACTION BUTTONS                    */}
        {/* =================================================================== */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/95 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Financial Breakdown Summary */}
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Subtotal</span>
              <span className="font-semibold text-slate-200">
                {formatNpr(totalsSummary.subtotal)}
              </span>
            </div>
            {totalsSummary.totalDiscount > 0 && (
              <div>
                <span className="text-slate-400 block text-[10px]">Discount</span>
                <span className="font-semibold text-rose-400">
                  - {formatNpr(totalsSummary.totalDiscount)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-[10px]">Taxable Amount</span>
              <span className="font-semibold text-slate-200">
                {formatNpr(totalsSummary.taxableAmount)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Nepal VAT (13%)</span>
              <span className="font-semibold text-blue-300">
                {formatNpr(totalsSummary.vatAmount)}
              </span>
            </div>
            {totalsSummary.otherCharges > 0 && (
              <div>
                <span className="text-slate-400 block text-[10px]">Other Charges</span>
                <span className="font-semibold text-amber-300">
                  + {formatNpr(totalsSummary.otherCharges)}
                </span>
              </div>
            )}
            <div className="pl-3 border-l border-slate-800">
              <span className="text-blue-400 block text-[10px] font-bold uppercase tracking-wider">
                Grand Total (NPR)
              </span>
              <span className="text-lg font-bold text-white tracking-wide">
                {formatNpr(totalsSummary.grandTotal)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSafeClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              Cancel
            </button>

            {/* Save as Draft */}
            <button
              type="button"
              onClick={() => validateAndSubmit('save_draft')}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow"
              title="Save as Draft (Ctrl+S)"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Save Draft</span>
            </button>

            {/* Submit for Approval */}
            <button
              type="button"
              onClick={() => validateAndSubmit('submit_for_approval')}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-900/40 border border-blue-400/40 transition-all flex items-center gap-1.5"
              title="Submit for Manager/Admin Approval (Ctrl+Enter)"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit for Approval'}</span>
            </button>

            {/* Direct Approve & Issue with PIN */}
            <button
              type="button"
              onClick={() => {
                setShowPinModal(true);
                setPinError('');
                setSupervisorPin('');
              }}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all flex items-center gap-1.5"
              title="Issue immediately with Supervisor/Manager PIN authorization"
            >
              <KeyRound className="w-4 h-4" />
              <span>Approve & Issue (PIN)</span>
            </button>
          </div>

        </div>

      </div>

      {/* =================================================================== */}
      {/* SUPERVISOR PIN AUTHORIZATION MODAL                                  */}
      {/* =================================================================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Supervisor Approval PIN</h3>
                  <p className="text-[11px] text-slate-400">Maker-Checker Authorization</p>
                </div>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Authorizing Purchase Order total of{' '}
                <strong className="text-white font-mono">{formatNpr(totalsSummary.grandTotal)}</strong>.
                {totalsSummary.grandTotal >= 500000 ? (
                  <span className="block text-amber-400 font-semibold mt-1">
                    System Administrator PIN required (Threshold ≥ 5,00,000).
                  </span>
                ) : (
                  <span className="block text-slate-400 mt-1">
                    Store Manager or Admin PIN required.
                  </span>
                )}
              </p>

              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Enter 4-digit PIN (e.g. 1234 or 9999)"
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && supervisorPin.length >= 4) {
                    setShowPinModal(false);
                    validateAndSubmit('direct_approve', supervisorPin);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-emerald-500"
              />

              {pinError && <p className="text-xs text-rose-400 text-center">{pinError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (supervisorPin.length < 4) {
                    setPinError('Please enter a valid supervisor PIN.');
                    return;
                  }
                  setShowPinModal(false);
                  validateAndSubmit('direct_approve', supervisorPin);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-900/40"
              >
                Authorize & Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BULK CSV / EXCEL PASTE MODAL                                        */}
      {/* =================================================================== */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Bulk Import PO Lines</h3>
                  <p className="text-[11px] text-slate-400">Paste CSV or spreadsheet lines</p>
                </div>
              </div>
              <button
                onClick={() => setShowCsvImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Format each line as:{' '}
                <code className="text-blue-300 font-mono">SKU, Description, Qty, Unit Cost, UoM</code>
              </p>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="RAM-DDR4-16G, Corsair 16GB DDR4 RAM, 10, 4500, Pcs&#10;SSD-NVME-1TB, Kingston NV2 1TB NVMe, 15, 7200, Pcs"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCsvImportModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessCsvImport}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-900/40"
              >
                Import Lines
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
