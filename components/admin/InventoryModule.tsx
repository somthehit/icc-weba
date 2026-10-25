'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Box,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Warehouse,
  X,
  Truck,
  CheckCircle2,
  ExternalLink,
  Search,
  ScanLine,
  ArrowRight,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { ReceiveInventoryModal } from './ReceiveInventoryModal';
import { formatNpr } from '@/lib/nepal/money';

type StockRow = {
  productId: number;
  sku: string;
  productName: string;
  stockQuantity: number;
  availableQuantity: number;
  unitCost: number | null;
  stockValue: number | null;
  lowStockThreshold: number;
  stockStatus: string;
  warehouseName: string | null;
  drift: boolean | null;
};

type WarehouseRow = {
  id: number;
  name: string;
  district: string | null;
  province?: string | null;
  isActive: boolean;
  unitsOnHand: number;
  stockRows: number;
};

type Movement = {
  id: number;
  createdAt: string;
  productName: string;
  sku: string;
  quantityDelta: number;
  reason: string;
  performedByName: string | null;
  note: string | null;
};

type PurchaseOrderRow = {
  id: number;
  poNumber: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  totalAmount: number;
  status: string;
};

type GrnRecordRow = {
  id: number;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  createdAt: string;
  receivedByName: string | null;
  status?: string;
};

export const InventoryModule: React.FC<{
  products?: unknown[];
  stockAdjustments?: unknown[];
}> = () => {
  const [tab, setTab] = useState<'stock' | 'grn' | 'pos' | 'adjustments' | 'warehouses'>('stock');

  const [stock, setStock] = useState<StockRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [grnList, setGrnList] = useState<GrnRecordRow[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Modals state
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('supplier_restock');
  const [note, setNote] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseDistrict, setWarehouseDistrict] = useState('');

  const loadAllInventoryData = async () => {
    setLoading(true);
    try {
      const [stockRes, whRes, movRes, poRes, grnRes] = await Promise.all([
        fetch('/api/inventory/stock-levels?limit=100&sort=name'),
        fetch('/api/inventory/warehouses'),
        fetch('/api/inventory/movements?limit=100'),
        fetch('/api/admin/inventory/purchase-orders'),
        fetch('/api/admin/inventory/grn'),
      ]);

      const stockData = await stockRes.json();
      const whData = await whRes.json();
      const movData = await movRes.json();
      const poData = await poRes.json();
      const grnData = await grnRes.json();

      if (stockRes.ok) setStock(stockData.data ?? []);
      if (whRes.ok) setWarehouses(whData.data ?? []);
      if (movRes.ok) setMovements(movData.data ?? []);
      if (poRes.ok && poData.orders) setPurchaseOrders(poData.orders);
      if (grnRes.ok && grnData.records) setGrnList(grnData.records);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllInventoryData();
  }, []);

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adjusting) return;
    const response = await fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: adjusting.productId,
        quantityDelta: Number(delta),
        reason,
        note,
        expectedQuantity: adjusting.stockQuantity,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? 'Adjustment failed');
      return;
    }
    setMessage(data.message);
    setAdjusting(null);
    setDelta('');
    setNote('');
    await loadAllInventoryData();
  };

  const addWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/inventory/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: warehouseName,
        district: warehouseDistrict || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? 'Unable to add warehouse');
      return;
    }
    setMessage(`Warehouse ${data.warehouse.name} added.`);
    setShowWarehouse(false);
    setWarehouseName('');
    setWarehouseDistrict('');
    await loadAllInventoryData();
  };

  // Filtered Stock
  const visibleStock = stock.filter((row) =>
    `${row.productName} ${row.sku}`.toLowerCase().includes(search.toLowerCase())
  );

  // Filtered POs
  const visiblePos = purchaseOrders.filter(
    (po) =>
      po.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  // Filtered GRNs
  const visibleGrns = grnList.filter(
    (g) =>
      g.grnNumber?.toLowerCase().includes(search.toLowerCase()) ||
      g.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      g.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  // Computed metrics
  const totalUnits = stock.reduce((sum, row) => sum + row.stockQuantity, 0);
  const totalValue = stock.reduce((sum, row) => sum + (row.stockValue ?? 0), 0);
  const lowStockCount = stock.filter((row) => row.stockQuantity <= row.lowStockThreshold).length;
  const pendingPoCount = purchaseOrders.filter(
    (po) => po.status === 'ordered' || po.status === 'draft'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12151C] tracking-tight">
              Inventory & Warehouse Management
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
              CENTRAL STOCK & GRN
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Unified stock control, supplier purchase orders, goods inwarding (GRN), and physical audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void loadAllInventoryData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#12151C] transition-all shadow-2xs"
            title="Refresh inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Stock</span>
          </button>

          <button
            onClick={() => setShowReceive(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Inward Stock</span>
          </button>

          <a
            href="/store-manage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
            title="Open physical barcode gun scanner in new tab"
          >
            <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
            <span>Barcode Scanner Terminal</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
          </a>
        </div>
      </div>

      {message && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs font-bold text-blue-700 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Products Tracked</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-[#12151C]">{stock.length}</div>
            <div className="text-[11px] text-[#6B7280] mt-0.5">Active SKU catalogue</div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Units on Hand</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Box className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-emerald-700">{totalUnits.toLocaleString()}</div>
            <div className="text-[11px] text-[#6B7280] mt-0.5">Physical items counted</div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Low Stock Alerts</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-rose-600">{lowStockCount}</div>
            <div className="text-[11px] text-rose-500 font-semibold mt-0.5">Below safety threshold</div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Purchase Orders</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono text-amber-800">{purchaseOrders.length}</div>
            <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
              {pendingPoCount} awaiting GRN
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Total Valuation</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold font-mono text-purple-900">{formatNpr(totalValue)}</div>
            <div className="text-[11px] text-[#6B7280] mt-0.5">Landed inventory cost</div>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E6E8EE] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTab('stock')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'stock'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Stock Levels ({stock.length})
          </button>

          <button
            onClick={() => setTab('grn')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'grn'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Goods Received (GRN) ({grnList.length})
          </button>

          <button
            onClick={() => setTab('pos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'pos'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>

          <button
            onClick={() => setTab('adjustments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'adjustments'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Movements Ledger ({movements.length})
          </button>

          <button
            onClick={() => setTab('warehouses')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              tab === 'warehouses'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Warehouses ({warehouses.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(tab === 'stock' || tab === 'pos' || tab === 'grn') && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9AA1AF]" />
              <input
                type="text"
                placeholder="Search SKU, product, PO #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E6E8EE] rounded-xl text-[#12151C] placeholder-[#9AA1AF] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {tab === 'warehouses' && (
            <button
              onClick={() => setShowWarehouse(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Warehouse</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Stock Levels */}
      {tab === 'stock' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {loading ? (
            <p className="p-8 text-center text-xs text-[#6B7280]">Loading live stock data...</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">SKU / Code</th>
                  <th className="p-3.5">On Hand</th>
                  <th className="p-3.5">Available</th>
                  <th className="p-3.5">Unit Cost</th>
                  <th className="p-3.5">Stock Value</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {visibleStock.map((row) => (
                  <tr key={row.productId} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-bold text-[#12151C]">
                      <div>{row.productName}</div>
                      <div className="text-[10px] font-normal text-[#9AA1AF]">
                        {row.warehouseName ?? 'Main Central Warehouse'}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[#6B7280]">{row.sku}</td>
                    <td className="p-3.5 font-mono font-bold text-[#12151C]">{row.stockQuantity}</td>
                    <td className="p-3.5 font-mono text-slate-600">{row.availableQuantity}</td>
                    <td className="p-3.5 font-mono text-[#6B7280]">
                      {row.unitCost ? formatNpr(row.unitCost) : '—'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {row.stockValue ? formatNpr(row.stockValue) : '—'}
                    </td>
                    <td className="p-3.5">
                      {row.stockQuantity <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          Out of stock
                        </span>
                      ) : row.stockQuantity <= row.lowStockThreshold ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          Low: {row.stockQuantity} units
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In stock
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setAdjusting(row)}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-white transition-all"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Goods Received (GRN) */}
      {tab === 'grn' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {visibleGrns.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">
              No Goods Received Notes generated yet. Click &quot;Receive Inward Stock&quot; above to log an arrival.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">GRN Number</th>
                  <th className="p-3.5">PO Ref</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Inward Date</th>
                  <th className="p-3.5">Received By</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {visibleGrns.map((g, idx) => (
                  <tr key={g.id || idx} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-mono font-bold text-emerald-700">
                      {g.grnNumber || `GRN-${202600 + idx}`}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{g.poNumber || 'PO-2026-01'}</td>
                    <td className="p-3.5 font-semibold text-[#12151C]">{g.supplierName || 'Distributor'}</td>
                    <td className="p-3.5 text-[#6B7280]">
                      {new Date(g.createdAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-slate-700">{g.receivedByName || 'Storekeeper'}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        VERIFIED & RESTOCKED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Purchase Orders */}
      {tab === 'pos' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {visiblePos.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">No purchase orders found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">PO Number</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Order Date</th>
                  <th className="p-3.5">Expected Delivery</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {visiblePos.map((po) => (
                  <tr key={po.id} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-mono font-bold text-[#12151C]">
                      {po.poNumber || `PO-${po.id}`}
                    </td>
                    <td className="p-3.5 font-semibold text-[#12151C]">{po.supplierName || 'Distributor'}</td>
                    <td className="p-3.5 text-[#6B7280]">
                      {po.orderDate ? new Date(po.orderDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3.5 text-[#6B7280]">
                      {po.expectedDeliveryDate
                        ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                        : '7 Days'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {formatNpr(po.totalAmount || 0)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          po.status === 'received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : po.status === 'ordered'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {po.status || 'DRAFT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Movements Ledger */}
      {tab === 'adjustments' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          <div className="border-b border-[#E6E8EE] p-4 bg-[#F8F9FA]">
            <h3 className="font-bold text-[#12151C] text-sm">Inventory Movement Ledger</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Append-only statutory audit trail. All manual corrections, sales deductions, and inwardings are logged.
            </p>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Product SKU</th>
                <th className="p-3.5">Quantity Change</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Staff Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8EE]">
              {movements.map((movement) => (
                <tr key={movement.id} className="hover:bg-[#F8F9FA]/80">
                  <td className="p-3.5 text-[#6B7280]">
                    {new Date(movement.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3.5 font-bold text-[#12151C]">
                    <div>{movement.productName}</div>
                    <div className="font-mono text-[10px] text-[#9AA1AF]">{movement.sku}</div>
                  </td>
                  <td
                    className={`p-3.5 font-mono font-bold ${
                      movement.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {movement.quantityDelta > 0 ? `+${movement.quantityDelta}` : movement.quantityDelta}
                  </td>
                  <td className="p-3.5 font-medium capitalize text-slate-700">
                    {movement.reason.replaceAll('_', ' ')}
                  </td>
                  <td className="p-3.5 text-[#6B7280]">
                    {movement.note || 'Regular warehouse movement'}
                    {movement.performedByName && (
                      <span className="text-[10px] block text-[#9AA1AF]">
                        By: {movement.performedByName}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Warehouses */}
      {tab === 'warehouses' && (
        <div className="grid gap-4 md:grid-cols-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="rounded-2xl border border-[#E6E8EE] bg-white p-5 shadow-2xs hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Warehouse className="h-5 w-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
              <h3 className="mt-4 font-bold text-[#12151C] text-sm">{warehouse.name}</h3>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                {warehouse.district ?? 'Primary Hub (Kathmandu)'}
              </p>
              <div className="mt-4 pt-3 border-t border-[#E6E8EE] flex justify-between text-xs">
                <span className="text-[#6B7280]">Product Lines</span>
                <b className="font-mono text-[#12151C]">{warehouse.stockRows}</b>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-[#6B7280]">Units on Hand</span>
                <b className="font-mono text-emerald-700">{warehouse.unitsOnHand}</b>
              </div>
            </div>
          ))}

          {warehouses.length === 0 && (
            <div className="col-span-3 rounded-2xl border border-dashed border-[#E6E8EE] p-10 text-center text-xs text-[#6B7280]">
              No secondary warehouses configured. Click &quot;Add Warehouse&quot; to register locations.
            </div>
          )}
        </div>
      )}

      {/* Receive Stock Modal */}
      {showReceive && (
        <ReceiveInventoryModal
          products={stock.map((row) => ({
            productId: row.productId,
            sku: row.sku,
            productName: row.productName,
            stockQuantity: row.stockQuantity,
            unitCost: row.unitCost,
          }))}
          warehouses={warehouses.map((w) => ({
            id: w.id,
            name: w.name,
            district: w.district,
            isActive: w.isActive,
          }))}
          onClose={() => setShowReceive(false)}
          onReceived={async (msg) => {
            setMessage(msg);
            await loadAllInventoryData();
          }}
        />
      )}

      {/* Add Warehouse Modal */}
      {showWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E6E8EE]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#12151C]">Add New Warehouse Location</h3>
                <p className="mt-0.5 text-xs text-[#6B7280]">Registers a new storage facility in Nepal.</p>
              </div>
              <button
                onClick={() => setShowWarehouse(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={addWarehouse} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#12151C] block mb-1">Warehouse Name</label>
                <input
                  required
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                  placeholder="e.g. Pokhara Regional Fulfillment Center"
                  className="w-full rounded-xl border border-[#E6E8EE] p-2.5 text-xs text-[#12151C] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#12151C] block mb-1">District / Location</label>
                <input
                  value={warehouseDistrict}
                  onChange={(e) => setWarehouseDistrict(e.target.value)}
                  placeholder="e.g. Kaski / Bagmati"
                  className="w-full rounded-xl border border-[#E6E8EE] p-2.5 text-xs text-[#12151C] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarehouse(false)}
                  className="rounded-xl border border-[#E6E8EE] px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F8F9FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={submitAdjustment}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E6E8EE]"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#12151C]">Adjust Physical Stock</h3>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Target: <span className="font-semibold text-slate-800">{adjusting.productName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjusting(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#E6E8EE] mb-4 text-xs">
              <div className="flex justify-between text-[#6B7280]">
                <span>SKU Code:</span>
                <span className="font-mono font-bold text-[#12151C]">{adjusting.sku}</span>
              </div>
              <div className="flex justify-between text-[#6B7280] mt-1">
                <span>Current On Hand:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {adjusting.stockQuantity} units
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#12151C] block mb-1">
                  Quantity Delta (Positive adds, Negative deducts)
                </label>
                <input
                  required
                  type="number"
                  step="1"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="e.g. +5 or -2"
                  className="w-full rounded-xl border border-[#E6E8EE] p-2.5 text-xs text-[#12151C] focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#12151C] block mb-1">Adjustment Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-[#E6E8EE] p-2.5 text-xs text-[#12151C] bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="supplier_restock">Supplier Restock (Inward)</option>
                  <option value="customer_return">Customer Return</option>
                  <option value="damaged">Damaged Goods / Scrap</option>
                  <option value="stolen">Stock Shrinkage / Missing</option>
                  <option value="audit_correction">Audit Physical Count Correction</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#12151C] block mb-1">
                  Audit Remark / Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reference invoice # or physical count note..."
                  rows={2}
                  className="w-full rounded-xl border border-[#E6E8EE] p-2.5 text-xs text-[#12151C] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjusting(null)}
                className="rounded-xl border border-[#E6E8EE] px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F8F9FA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                Post Immutable Adjustment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
