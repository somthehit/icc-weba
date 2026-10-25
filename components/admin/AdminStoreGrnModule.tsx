'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Truck,
  Package,
  Barcode,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  ArrowRight,
  TrendingDown,
  Clock,
  ScanLine,
} from 'lucide-react';
import { formatNpr } from '@/lib/nepal/money';

export const AdminStoreGrnModule: React.FC = () => {
  const [tab, setTab] = useState<'pos' | 'grn' | 'lowstock'>('pos');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [grnList, setGrnList] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStoreData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Purchase Orders
      const poRes = await fetch('/api/admin/inventory/purchase-orders');
      const poData = await poRes.json();
      if (poData.success && poData.orders) {
        setPurchaseOrders(poData.orders);
      }

      // 2. Fetch GRN Records
      const grnRes = await fetch('/api/admin/inventory/grn');
      const grnData = await grnRes.json();
      if (grnData.success && grnData.records) {
        setGrnList(grnData.records);
      }

      // 3. Fetch Stock Levels for Low Stock
      const stockRes = await fetch('/api/inventory/stock-levels?limit=100');
      const stockData = await stockRes.json();
      if (stockData.data) {
        const lows = stockData.data.filter((item: any) => item.stockQuantity <= item.lowStockThreshold);
        setLowStockItems(lows);
      }
    } catch (e: any) {
      console.warn('Error loading store & GRN data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, []);

  const totalPoCount = purchaseOrders.length;
  const pendingPoCount = purchaseOrders.filter((po) => po.status === 'ordered' || po.status === 'draft').length;
  const lowStockCount = lowStockItems.length;

  const filteredPos = purchaseOrders.filter(
    (po) =>
      (po.poNumber && po.poNumber.toLowerCase().includes(search.toLowerCase())) ||
      (po.supplierName && po.supplierName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#12151C] tracking-tight">Store & Warehouse Inventory (GRN)</h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
              WAREHOUSE CONTROL
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Barcode-driven inventory inwarding (GRN), supplier purchase orders, and automated safety stock re-order tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStoreData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white hover:bg-[#F8F9FA] text-xs font-semibold text-[#12151C] transition-all shadow-2xs"
            title="Sync inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6B7280] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Stock</span>
          </button>

          <a
            href="/store-manage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            <span>Open Barcode Scanner Cockpit</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-200" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Active Purchase Orders</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12151C]">{totalPoCount}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 font-semibold">
              <span>{pendingPoCount} pending delivery / GRN</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Goods Received (GRN) Today</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-800">{grnList.length} Batches</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-[#6B7280]">
              <span>Inward batches inspected</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Critical Low Stock SKUs</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-700">{lowStockCount}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-rose-600 font-medium">
              <span>Items below reorder point</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E6E8EE] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#6B7280]">
            <span>Barcode Wedge Scanner</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Barcode className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ScanLine className="w-4 h-4 text-emerald-600" />
              <span>USB / Camera Scan Ready</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-[#6B7280]">
              <span>EAN-13, Code 128, QR Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E6E8EE] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setTab('pos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'pos'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            onClick={() => setTab('grn')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'grn'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Goods Received Notes ({grnList.length})
          </button>
          <button
            onClick={() => setTab('lowstock')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              tab === 'lowstock'
                ? 'bg-[#12151C] text-white shadow-xs'
                : 'text-[#6B7280] hover:text-[#12151C] hover:bg-[#F4F5F8]'
            }`}
          >
            Critical Low Stock ({lowStockItems.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9AA1AF]" />
          <input
            type="text"
            placeholder="Search PO #, supplier, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E6E8EE] rounded-xl text-[#12151C] placeholder-[#9AA1AF] focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Tab 1: Purchase Orders */}
      {tab === 'pos' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">Loading supplier purchase orders...</div>
          ) : filteredPos.length === 0 ? (
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
                {filteredPos.map((po) => (
                  <tr key={po.id} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-mono font-bold text-[#12151C]">
                      {po.poNumber || `PO-${po.id}`}
                    </td>
                    <td className="p-3.5 font-semibold text-[#12151C]">
                      {po.supplierName || 'Primary Distributor'}
                    </td>
                    <td className="p-3.5 text-[#6B7280]">
                      {po.orderDate ? new Date(po.orderDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3.5 text-[#6B7280]">
                      {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '7 Days'}
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

      {/* Tab 2: GRN Records */}
      {tab === 'grn' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {grnList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280]">
              No Goods Received Notes generated today. Scan barcode inwards in the storekeeper cockpit to record batches.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">GRN #</th>
                  <th className="p-3.5">PO Ref</th>
                  <th className="p-3.5">Supplier</th>
                  <th className="p-3.5">Date Inwarded</th>
                  <th className="p-3.5">Inspector / Receiver</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {grnList.map((g, idx) => (
                  <tr key={g.id || idx} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-mono font-bold text-emerald-700">{g.grnNumber || `GRN-${202600 + idx}`}</td>
                    <td className="p-3.5 font-mono">{g.poNumber || 'PO-2026-01'}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{g.supplierName || 'Distributor'}</td>
                    <td className="p-3.5 text-slate-500">{new Date(g.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td className="p-3.5 text-slate-700">{g.receivedByName || 'Storekeeper'}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">
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

      {/* Tab 3: Low Stock Alerts */}
      {tab === 'lowstock' && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8EE] bg-white shadow-2xs">
          {lowStockItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-600 font-semibold">
              All warehouse inventory levels are healthy! No items at or below safety stock.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EE]">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">SKU / Barcode</th>
                  <th className="p-3.5">Current Stock</th>
                  <th className="p-3.5">Reorder Threshold</th>
                  <th className="p-3.5">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EE]">
                {lowStockItems.map((item) => (
                  <tr key={item.productId} className="hover:bg-[#F8F9FA]/80">
                    <td className="p-3.5 font-semibold text-slate-900">{item.productName}</td>
                    <td className="p-3.5 font-mono text-slate-500">{item.sku}</td>
                    <td className="p-3.5 font-mono font-bold text-rose-600">{item.stockQuantity} units</td>
                    <td className="p-3.5 font-mono text-slate-600">{item.lowStockThreshold} units</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                        CRITICAL REORDER
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
